import { request } from './request';
import type { AiGenerationTask, AiGenerationTaskType } from '../types/ai-generation-task';

export const aiGenerationTaskApi = {
  async getTask(taskId: string): Promise<AiGenerationTask> {
    return request.get<AiGenerationTask>(`/api/ai-generation/tasks/${taskId}`);
  },

  async getLatestTask(type: AiGenerationTaskType, sourceId: number): Promise<AiGenerationTask | null> {
    return request.get<AiGenerationTask | null>('/api/ai-generation/tasks/latest', {
      params: { type, sourceId },
    });
  },
};
