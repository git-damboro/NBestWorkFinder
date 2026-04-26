import { request } from './request';
import type { CreateJobFollowUpForm, JobFollowUpRecord } from '../types/job-follow-up';

export const jobFollowUpApi = {
  async list(jobId: number): Promise<JobFollowUpRecord[]> {
    return request.get<JobFollowUpRecord[]>(`/api/jobs/${jobId}/follow-ups`);
  },

  async create(jobId: number, data: CreateJobFollowUpForm): Promise<JobFollowUpRecord> {
    return request.post<JobFollowUpRecord>(`/api/jobs/${jobId}/follow-ups`, data);
  },
};
