import { request } from './request';
import type {
  CreateJobForm,
  JobApplicationStatus,
  JobDetail,
  JobListItem,
  JobMatchResult,
  MatchJobForm,
  UpdateJobForm,
} from '../types/job';

export const jobApi = {
  /**
   * 获取职位列表（可按状态筛选）
   */
  async getJobs(status?: JobApplicationStatus): Promise<JobListItem[]> {
    return request.get<JobListItem[]>('/api/jobs', {
      params: status ? { status } : undefined,
    });
  },

  /**
   * 获取职位详情
   */
  async getJobDetail(id: number): Promise<JobDetail> {
    return request.get<JobDetail>(`/api/jobs/${id}`);
  },

  /**
   * 创建职位
   */
  async createJob(data: CreateJobForm): Promise<JobDetail> {
    return request.post<JobDetail>('/api/jobs', data);
  },

  /**
   * 更新职位
   */
  async updateJob(id: number, data: UpdateJobForm): Promise<JobDetail> {
    return request.put<JobDetail>(`/api/jobs/${id}`, data);
  },

  /**
   * 删除职位
   */
  async deleteJob(id: number): Promise<void> {
    return request.delete<void>(`/api/jobs/${id}`);
  },

  /**
   * 职位与简历匹配
   */
  async matchJob(id: number, data: MatchJobForm): Promise<JobMatchResult> {
    return request.post<JobMatchResult>(`/api/jobs/${id}/match`, undefined, {
      params: { resumeId: data.resumeId },
      timeout: 180000,
    });
  },
};

