export type AiGenerationTaskStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export type AiGenerationTaskType =
  | 'RESUME_JOB_DRAFT'
  | 'INTERVIEW_SESSION_CREATE';

export interface AiGenerationTask {
  taskId: string;
  type: AiGenerationTaskType;
  sourceId: number;
  targetId: number | null;
  status: AiGenerationTaskStatus;
  resultJson: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
}
