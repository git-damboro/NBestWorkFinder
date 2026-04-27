import { request } from './request';
import type {
  CreateWorkflowEventForm,
  JobApplicationWorkflow,
  JobApplicationWorkflowEvent,
} from '../types/job-workflow';

export const jobWorkflowApi = {
  async get(jobId: number): Promise<JobApplicationWorkflow | null> {
    return request.get<JobApplicationWorkflow | null>(`/api/jobs/${jobId}/workflow`);
  },

  async createEvent(jobId: number, data: CreateWorkflowEventForm): Promise<JobApplicationWorkflowEvent> {
    return request.post<JobApplicationWorkflowEvent>(`/api/jobs/${jobId}/workflow/events`, data);
  },
};
