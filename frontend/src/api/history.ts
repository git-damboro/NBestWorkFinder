import { downloadBlob, request } from './request';

export type AnalyzeStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type EvaluateStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ResumeListItem {
  id: number;
  filename: string;
  fileSize: number;
  uploadedAt: string;
  accessCount: number;
  latestScore?: number;
  lastAnalyzedAt?: string;
  interviewCount: number;
  analyzeStatus?: AnalyzeStatus;
  analyzeError?: string;
  storageUrl?: string;
}

export interface ResumeStats {
  totalCount: number;
  totalInterviewCount: number;
  totalAccessCount: number;
}

export interface AnalysisItem {
  id: number;
  overallScore: number;
  contentScore: number;
  structureScore: number;
  skillMatchScore: number;
  expressionScore: number;
  projectScore: number;
  summary: string;
  analyzedAt: string;
  strengths: string[];
  suggestions: unknown[];
}

export interface InterviewItem {
  id: number;
  sessionId: string;
  targetJobId?: number | null;
  targetJobTitle?: string | null;
  targetJobCompany?: string | null;
  totalQuestions: number;
  status: string;
  evaluateStatus?: EvaluateStatus;
  evaluateError?: string;
  overallScore: number | null;
  overallFeedback: string | null;
  createdAt: string;
  completedAt: string | null;
  questions?: unknown[];
  strengths?: string[];
  improvements?: string[];
  referenceAnswers?: unknown[];
}

export interface AnswerItem {
  questionIndex: number;
  question: string;
  category: string;
  userAnswer: string;
  score: number;
  feedback: string;
  referenceAnswer?: string;
  keyPoints?: string[];
  answeredAt: string;
}

export interface ResumeDetail {
  id: number;
  filename: string;
  fileSize: number;
  contentType: string;
  storageUrl: string;
  uploadedAt: string;
  accessCount: number;
  resumeText: string;
  analyzeStatus?: AnalyzeStatus;
  analyzeError?: string;
  analyses: AnalysisItem[];
  interviews: InterviewItem[];
}

export interface InterviewDetail extends InterviewItem {
  evaluateStatus?: EvaluateStatus;
  evaluateError?: string;
  answers: AnswerItem[];
}

export const historyApi = {
  async getResumes(): Promise<ResumeListItem[]> {
    return request.get<ResumeListItem[]>('/api/resumes');
  },

  async getResumeDetail(id: number): Promise<ResumeDetail> {
    return request.get<ResumeDetail>(`/api/resumes/${id}/detail`);
  },

  async getInterviewDetail(sessionId: string): Promise<InterviewDetail> {
    return request.get<InterviewDetail>(`/api/interview/sessions/${sessionId}/details`);
  },

  async exportAnalysisPdf(resumeId: number): Promise<Blob> {
    return downloadBlob(`/api/resumes/${resumeId}/export`);
  },

  async exportInterviewPdf(sessionId: string): Promise<Blob> {
    return downloadBlob(`/api/interview/sessions/${sessionId}/export`);
  },

  async deleteResume(id: number): Promise<void> {
    return request.delete(`/api/resumes/${id}`);
  },

  async deleteInterview(sessionId: string): Promise<void> {
    return request.delete(`/api/interview/sessions/${sessionId}`);
  },

  async getStatistics(): Promise<ResumeStats> {
    return request.get<ResumeStats>('/api/resumes/statistics');
  },

  async reanalyze(id: number): Promise<void> {
    return request.post(`/api/resumes/${id}/reanalyze`);
  },
};
