export type JobApplicationStatus =
  | 'SAVED'
  | 'APPLIED'
  | 'INTERVIEWING'
  | 'OFFERED'
  | 'REJECTED';

export interface JobListItem {
  id: number;
  title: string;
  company: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryText: string | null;
  techTags: string[];
  applicationStatus: JobApplicationStatus;
  sourcePlatform: string | null;
  sourceUrl: string | null;
  externalJobId: string | null;
  createdAt: string;
  appliedAt: string | null;
  lastFollowUpAt: string | null;
  nextFollowUpAt: string | null;
}

export interface JobDetail {
  id: number;
  title: string;
  company: string;
  description: string;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryText: string | null;
  techTags: string[];
  applicationStatus: JobApplicationStatus;
  notes: string | null;
  sourcePlatform: string | null;
  sourceUrl: string | null;
  externalJobId: string | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  lastFollowUpAt: string | null;
  nextFollowUpAt: string | null;
}

export interface JobMatchResult {
  overallScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: string[];
  summary: string;
}

export interface ResumeJobDraft {
  title: string;
  summary: string;
  reason: string;
  techTags: string[];
  defaultDescription: string;
  defaultNotes: string;
}

export interface CreateJobForm {
  title: string;
  company: string;
  description: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  notes?: string;
}

export interface ImportJobForm {
  sourcePlatform: string;
  externalJobId?: string;
  sourceUrl?: string;
  title: string;
  company: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryText?: string;
  description: string;
  techTags?: string[];
  notes?: string;
}

export interface UpdateJobForm {
  title?: string;
  company?: string;
  description?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  applicationStatus?: JobApplicationStatus;
  notes?: string;
}

export interface MatchJobForm {
  resumeId: number;
}

export interface JobDetailSyncForm {
  sourcePlatform?: string;
  externalJobId?: string;
  sourceUrl?: string;
  title?: string;
  company?: string;
  location?: string;
  salaryMin?: number;
  salaryMax?: number;
  descriptionFull?: string;
  techTags?: string[];
}

export interface JobStatusOption {
  value: JobApplicationStatus;
  label: string;
}

export const jobStatusOptions: JobStatusOption[] = [
  { value: 'SAVED', label: '已收藏' },
  { value: 'APPLIED', label: '已投递' },
  { value: 'INTERVIEWING', label: '面试中' },
  { value: 'OFFERED', label: '已拿 Offer' },
  { value: 'REJECTED', label: '已拒绝' },
];

export const jobStatusLabelMap: Record<JobApplicationStatus, string> = {
  SAVED: '已收藏',
  APPLIED: '已投递',
  INTERVIEWING: '面试中',
  OFFERED: '已拿 Offer',
  REJECTED: '已拒绝',
};
