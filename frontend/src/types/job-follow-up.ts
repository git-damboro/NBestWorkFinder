import type { JobApplicationStatus } from './job';

export type JobFollowUpType =
  | 'STATUS_CHANGE'
  | 'MANUAL_NOTE'
  | 'CONTACT'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTION';

export interface JobFollowUpRecord {
  id: number;
  jobId: number;
  type: JobFollowUpType;
  title: string;
  content: string | null;
  fromStatus: JobApplicationStatus | null;
  toStatus: JobApplicationStatus | null;
  contactMethod: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
}

export interface CreateJobFollowUpForm {
  type?: JobFollowUpType;
  title?: string;
  content?: string;
  contactMethod?: string;
  nextFollowUpAt?: string;
}

export const jobFollowUpTypeLabelMap: Record<JobFollowUpType, string> = {
  STATUS_CHANGE: '状态变化',
  MANUAL_NOTE: '备注',
  CONTACT: '沟通',
  INTERVIEW: '面试',
  OFFER: 'Offer',
  REJECTION: '拒绝',
};
