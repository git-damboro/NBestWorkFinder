export type JobDraftBatchStatus =
  | 'CREATED'
  | 'ANALYZING'
  | 'READY'
  | 'PARTIAL_IMPORTED'
  | 'COMPLETED'
  | 'FAILED';

export type JobDraftSourceType = 'RESUME_GENERATION' | 'PAGE_SYNC';

export type JobDraftDetailSyncStatus = 'UNSYNCED' | 'PARTIAL' | 'COMPLETED' | 'FAILED';

export interface JobDraftBatch {
  batchId: string;
  sourceType: JobDraftSourceType;
  resumeId: number | null;
  sourcePlatform: string | null;
  sourcePageUrl: string | null;
  sourcePageTitle: string | null;
  totalCount: number;
  selectedCount: number;
  importedCount: number;
  status: JobDraftBatchStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface JobDraftItem {
  draftItemId: string;
  batchId: string;
  sourceType: JobDraftSourceType;
  sourcePlatform: string | null;
  externalJobId: string | null;
  sourceUrl: string | null;
  sourceFingerprint: string;
  title: string;
  company: string;
  descriptionPreview: string | null;
  descriptionFull: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryTextRaw: string | null;
  experienceTextRaw: string | null;
  educationTextRaw: string | null;
  techTags: string[];
  benefits: string[];
  recruiterName: string | null;
  selected: boolean;
  imported: boolean;
  importedJobId: number | null;
  detailSyncStatus: JobDraftDetailSyncStatus;
  coarseMatchScore: number | null;
  preciseMatchScore: number | null;
  matchSummary: string | null;
  openerText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobDraftBatchCreated {
  batchId: string;
  status: JobDraftBatchStatus;
  totalCount: number;
  resumeId: number | null;
  taskId: string | null;
  needResumeSelection: boolean;
}

export interface PageSyncJobDraft {
  externalJobId?: string;
  sourceUrl?: string;
  title: string;
  company: string;
  location?: string;
  salaryTextRaw?: string;
  salaryMin?: number;
  salaryMax?: number;
  experienceTextRaw?: string;
  educationTextRaw?: string;
  descriptionPreview?: string;
  techTags?: string[];
  benefits?: string[];
  recruiterName?: string;
  rawPayload?: Record<string, unknown>;
}

export interface CreateDraftBatchFromPageSyncForm {
  resumeId?: number;
  sourcePlatform: string;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
  pageFingerprint?: string;
  jobs: PageSyncJobDraft[];
}

export interface ImportJobDraftItemsResult {
  batchId: string;
  importedCount: number;
  skippedCount: number;
  importedJobIds: number[];
}

export interface JobDraftDetailSyncForm {
  resumeId?: number;
  externalJobId?: string;
  sourceUrl?: string;
  title?: string;
  company?: string;
  location?: string;
  salaryTextRaw?: string;
  salaryMin?: number;
  salaryMax?: number;
  experienceTextRaw?: string;
  educationTextRaw?: string;
  descriptionPreview?: string;
  descriptionFull?: string;
  techTags?: string[];
  benefits?: string[];
  recruiterName?: string;
  rawPayload?: Record<string, unknown>;
}
