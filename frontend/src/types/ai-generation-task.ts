export type AiGenerationTaskStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export type AiGenerationTaskType =
  | 'RESUME_JOB_DRAFT'
  | 'INTERVIEW_SESSION_CREATE'
  | 'JOB_DRAFT_PAGE_SYNC'
  | 'JOB_DRAFT_DETAIL_SYNC';

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
