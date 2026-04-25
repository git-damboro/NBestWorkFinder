import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { aiGenerationTaskApi, getErrorMessage } from '../api';
import { interviewApi } from '../api/interview';
import ConfirmDialog from '../components/ConfirmDialog';
import InterviewChatPanel from '../components/InterviewChatPanel';
import InterviewConfigPanel from '../components/InterviewConfigPanel';
import type { AiGenerationTask } from '../types/ai-generation-task';
import type { InterviewJobTarget, InterviewQuestion, InterviewSession } from '../types/interview';

type InterviewStage = 'config' | 'interview';

interface Message {
  type: 'interviewer' | 'user';
  content: string;
  category?: string;
  questionIndex?: number;
}

interface InterviewProps {
  resumeText: string;
  resumeId?: number;
  jobTarget?: InterviewJobTarget | null;
  onBack: () => void;
  onInterviewComplete: () => void;
}

const INTERVIEW_TASK_POLL_INTERVAL_MS = 3000;

const isRestorableSession = (interviewSession: InterviewSession | null | undefined) =>
  Boolean(
    interviewSession &&
      (interviewSession.status === 'CREATED' || interviewSession.status === 'IN_PROGRESS')
  );

const parseInterviewTaskResult = (task: AiGenerationTask): string | null => {
  if (!task.resultJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(task.resultJson) as { sessionId?: unknown };
    return typeof parsed.sessionId === 'string' ? parsed.sessionId : null;
  } catch {
    return null;
  }
};

const buildMessagesFromSession = (interviewSession: InterviewSession): Message[] => {
  if (interviewSession.questions.length === 0) {
    return [];
  }

  const currentIndex = Math.min(
    interviewSession.currentQuestionIndex,
    interviewSession.questions.length - 1
  );
  const restoredMessages: Message[] = [];

  for (let index = 0; index <= currentIndex; index += 1) {
    const question = interviewSession.questions[index];
    restoredMessages.push({
      type: 'interviewer',
      content: question.question,
      category: question.category,
      questionIndex: question.questionIndex,
    });

    if (question.userAnswer) {
      restoredMessages.push({
        type: 'user',
        content: question.userAnswer,
      });
    }
  }

  return restoredMessages;
};

export default function Interview({
  resumeText,
  resumeId,
  jobTarget,
  onBack,
  onInterviewComplete,
}: InterviewProps) {
  const [stage, setStage] = useState<InterviewStage>('config');
  const [questionCount, setQuestionCount] = useState(8);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [checkingUnfinished, setCheckingUnfinished] = useState(false);
  const [unfinishedSession, setUnfinishedSession] = useState<InterviewSession | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [forceCreateNew, setForceCreateNew] = useState(false);
  const [interviewTaskId, setInterviewTaskId] = useState<string | null>(null);

  const restoreSession = useCallback((sessionToRestore: InterviewSession) => {
    if (!isRestorableSession(sessionToRestore) || sessionToRestore.questions.length === 0) {
      return;
    }

    const safeCurrentIndex = Math.min(
      sessionToRestore.currentQuestionIndex,
      sessionToRestore.questions.length - 1
    );
    const restoredQuestion = sessionToRestore.questions[safeCurrentIndex] ?? null;

    setSession(sessionToRestore);
    setCurrentQuestion(restoredQuestion);
    setMessages(buildMessagesFromSession(sessionToRestore));
    setAnswer(restoredQuestion?.userAnswer ?? '');
    setStage('interview');
  }, []);

  const applyInterviewTask = useCallback(
    async (task: AiGenerationTask) => {
      setInterviewTaskId(task.taskId);

      if (task.status === 'PENDING' || task.status === 'PROCESSING') {
        setIsCreating(true);
        setError('');
        return;
      }

      if (task.status === 'FAILED') {
        setIsCreating(false);
        setInterviewTaskId(null);
        setError(task.errorMessage || '面试题生成失败，请重试');
        return;
      }

      const sessionId = parseInterviewTaskResult(task);
      if (!sessionId) {
        setIsCreating(false);
        setInterviewTaskId(null);
        setError('面试题任务结果缺少会话信息，请重新生成');
        return;
      }

      try {
        const generatedSession = await interviewApi.getSession(sessionId);
        if (!isRestorableSession(generatedSession)) {
          setIsCreating(false);
          setInterviewTaskId(null);
          return;
        }

        setForceCreateNew(false);
        setUnfinishedSession(null);
        setError('');
        restoreSession(generatedSession);
      } catch (taskError) {
        setError(getErrorMessage(taskError));
      } finally {
        setIsCreating(false);
        setInterviewTaskId(null);
      }
    },
    [restoreSession]
  );

  const checkUnfinishedSession = useCallback(async () => {
    if (!resumeId) {
      setUnfinishedSession(null);
      return;
    }

    setCheckingUnfinished(true);
    try {
      const foundSession = await interviewApi.findUnfinishedSession(resumeId);
      if (isRestorableSession(foundSession)) {
        setUnfinishedSession(foundSession);
      } else {
        setUnfinishedSession(null);
      }
    } catch (taskError) {
      console.error('检查未完成面试失败', taskError);
      setUnfinishedSession(null);
    } finally {
      setCheckingUnfinished(false);
    }
  }, [resumeId]);

  useEffect(() => {
    void checkUnfinishedSession();
  }, [checkUnfinishedSession]);

  useEffect(() => {
    if (!resumeId) {
      return;
    }

    let cancelled = false;

    const recoverLatestInterviewTask = async () => {
      try {
        const latestTask = await aiGenerationTaskApi.getLatestTask(
          'INTERVIEW_SESSION_CREATE',
          resumeId
        );
        if (!latestTask || cancelled) {
          return;
        }

        await applyInterviewTask(latestTask);
      } catch (taskError) {
        if (!cancelled) {
          console.error('恢复最近面试题任务失败', taskError);
        }
      }
    };

    void recoverLatestInterviewTask();

    return () => {
      cancelled = true;
    };
  }, [resumeId, applyInterviewTask]);

  useEffect(() => {
    if (!interviewTaskId) {
      return;
    }

    let cancelled = false;

    const pollTask = async () => {
      try {
        const task = await aiGenerationTaskApi.getTask(interviewTaskId);
        if (!cancelled) {
          await applyInterviewTask(task);
        }
      } catch (taskError) {
        if (!cancelled) {
          setIsCreating(false);
          setInterviewTaskId(null);
          setError(getErrorMessage(taskError));
        }
      }
    };

    const timer = window.setInterval(() => {
      void pollTask();
    }, INTERVIEW_TASK_POLL_INTERVAL_MS);

    void pollTask();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [interviewTaskId, applyInterviewTask]);

  const handleContinueUnfinished = () => {
    if (!unfinishedSession) {
      return;
    }

    setForceCreateNew(false);
    setError('');
    setInterviewTaskId(null);
    restoreSession(unfinishedSession);
    setUnfinishedSession(null);
  };

  const handleStartNew = () => {
    setUnfinishedSession(null);
    setForceCreateNew(true);
  };

  const startInterview = async () => {
    setIsCreating(true);
    setError('');
    setSession(null);
    setCurrentQuestion(null);
    setMessages([]);
    setAnswer('');

    try {
      const task = await interviewApi.createSessionTask({
        resumeText,
        questionCount,
        resumeId,
        jobId: jobTarget?.jobId,
        forceCreate: forceCreateNew,
      });

      await applyInterviewTask(task);
    } catch (taskError) {
      setError(getErrorMessage(taskError));
      setForceCreateNew(false);
      setInterviewTaskId(null);
      setIsCreating(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !session || !currentQuestion) {
      return;
    }

    setIsSubmitting(true);
    setMessages(previous => [
      ...previous,
      {
        type: 'user',
        content: answer,
      },
    ]);

    try {
      const response = await interviewApi.submitAnswer({
        sessionId: session.sessionId,
        questionIndex: currentQuestion.questionIndex,
        answer: answer.trim(),
      });

      setAnswer('');

      if (response.hasNextQuestion && response.nextQuestion) {
        const nextQuestion = response.nextQuestion;
        setCurrentQuestion(nextQuestion);
        setMessages(previous => [
          ...previous,
          {
            type: 'interviewer',
            content: nextQuestion.question,
            category: nextQuestion.category,
            questionIndex: nextQuestion.questionIndex,
          },
        ]);
      } else {
        onInterviewComplete();
      }
    } catch (submitError) {
      setError('提交答案失败，请重试');
      console.error(submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteEarly = async () => {
    if (!session) {
      return;
    }

    setIsSubmitting(true);
    try {
      await interviewApi.completeInterview(session.sessionId);
      setShowCompleteConfirm(false);
      onInterviewComplete();
    } catch (submitError) {
      setError('提前交卷失败，请重试');
      console.error(submitError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderConfig = () => (
    <InterviewConfigPanel
      questionCount={questionCount}
      onQuestionCountChange={setQuestionCount}
      onStart={startInterview}
      isCreating={isCreating}
      checkingUnfinished={checkingUnfinished}
      unfinishedSession={unfinishedSession}
      onContinueUnfinished={handleContinueUnfinished}
      onStartNew={handleStartNew}
      resumeText={resumeText}
      jobTarget={jobTarget}
      onBack={onBack}
      error={error}
      interviewTaskId={interviewTaskId}
    />
  );

  const renderInterview = () => {
    if (!session || !currentQuestion) {
      return (
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="mb-3 text-xl font-semibold text-amber-900 dark:text-amber-200">
            面试内容正在准备中
          </h2>
          <p className="mb-6 text-sm leading-6 text-amber-700 dark:text-amber-300">
            当前会话还没有拿到可展示的题目。请返回配置页重新恢复或重新生成。
          </p>
          <button
            type="button"
            onClick={() => setStage('config')}
            className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            返回面试配置
          </button>
        </div>
      );
    }

    return (
      <InterviewChatPanel
        session={session}
        currentQuestion={currentQuestion}
        messages={messages}
        answer={answer}
        onAnswerChange={setAnswer}
        onSubmit={handleSubmitAnswer}
        onCompleteEarly={handleCompleteEarly}
        isSubmitting={isSubmitting}
        showCompleteConfirm={showCompleteConfirm}
        onShowCompleteConfirm={setShowCompleteConfirm}
      />
    );
  };

  const stageSubtitles = {
    config: jobTarget ? '围绕目标职位配置本次定向面试' : '配置您的面试参数',
    interview: '认真回答每个问题，展示您的真实实力',
  };

  return (
    <div className="pb-10">
      <motion.div
        className="mb-10 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="mb-2 flex items-center justify-center gap-3 text-3xl font-bold text-slate-900 dark:text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19 10v2a7 7 0 0 1-14 0v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="12"
                y1="19"
                x2="12"
                y2="23"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="8"
                y1="23"
                x2="16"
                y2="23"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          模拟面试
        </h1>
        <p className="text-slate-500 dark:text-slate-400">{stageSubtitles[stage]}</p>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        {stage === 'config' && (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderConfig()}
          </motion.div>
        )}
        {stage === 'interview' && (
          <motion.div
            key="interview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderInterview()}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={showCompleteConfirm}
        title="提前交卷"
        message="确定要提前交卷吗？未回答的问题将按 0 分计算。"
        confirmText="确定交卷"
        cancelText="取消"
        confirmVariant="warning"
        loading={isSubmitting}
        onConfirm={handleCompleteEarly}
        onCancel={() => setShowCompleteConfirm(false)}
      />
    </div>
  );
}
