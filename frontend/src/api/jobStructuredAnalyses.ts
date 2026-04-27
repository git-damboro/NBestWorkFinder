import { request } from './request';
import type { JobStructuredAnalysis } from '../types/job-structured-analysis';

export const jobStructuredAnalysisApi = {
  async get(jobId: number): Promise<JobStructuredAnalysis | null> {
    return request.get<JobStructuredAnalysis | null>(`/api/jobs/${jobId}/structured-analysis`);
  },

  async analyze(jobId: number): Promise<JobStructuredAnalysis> {
    return request.post<JobStructuredAnalysis>(`/api/jobs/${jobId}/structured-analysis`);
  },
};
