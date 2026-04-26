import { request } from './request';
import type { UserExperience, UserExperienceForm } from '../types/user-experience';

export const userExperienceApi = {
  async list(enabled?: boolean): Promise<UserExperience[]> {
    return request.get<UserExperience[]>('/api/profile/experiences', {
      params: enabled === undefined ? undefined : { enabled },
    });
  },

  async create(data: UserExperienceForm): Promise<UserExperience> {
    return request.post<UserExperience>('/api/profile/experiences', data);
  },

  async update(id: number, data: UserExperienceForm): Promise<UserExperience> {
    return request.put<UserExperience>(`/api/profile/experiences/${id}`, data);
  },

  async delete(id: number): Promise<void> {
    return request.delete<void>(`/api/profile/experiences/${id}`);
  },
};
