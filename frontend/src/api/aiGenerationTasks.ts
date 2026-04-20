import { request } from './request';
import type {
  AiGenerationTask,
  AiGenerationTaskStatus,
  AiGenerationTaskType,
} from '../types/ai-generation-task';

interface ListTaskParams {
  type?: AiGenerationTaskType;
  status?: AiGenerationTaskStatus;
}

export const aiGenerationTaskApi = {
  async getTask(taskId: string): Promise<AiGenerationTask> {
    return request.get<AiGenerationTask>(`/api/ai-generation/tasks/${taskId}`);
  },

  async getLatestTask(type: AiGenerationTaskType, sourceId: number): Promise<AiGenerationTask | null> {
    return request.get<AiGenerationTask | null>('/api/ai-generation/tasks/latest', {
      params: { type, sourceId },
    });
  },

  async getTasks(params?: ListTaskParams): Promise<AiGenerationTask[]> {
    return request.get<AiGenerationTask[]>('/api/ai-generation/tasks', {
      params,
    });
  },

  async retryTask(taskId: string): Promise<AiGenerationTask> {
    return request.post<AiGenerationTask>(`/api/ai-generation/tasks/${taskId}/retry`);
  },
};
