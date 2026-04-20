import { request } from './request';
import type { AiGenerationTask } from '../types/ai-generation-task';
import type { JobDraftBatchCreated } from '../types/job-draft';
import type {
  CreateJobForm,
  JobDetailSyncForm,
  JobApplicationStatus,
  JobDetail,
  JobListItem,
  JobMatchResult,
  MatchJobForm,
  ResumeJobDraft,
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
   * 根据简历生成职位草稿
   */
  async generateDraftsFromResume(resumeId: number): Promise<ResumeJobDraft[]> {
    return request.post<ResumeJobDraft[]>(`/api/jobs/drafts/from-resume/${resumeId}`);
  },

  /**
   * 创建根据简历生成职位草稿的后台任务
   */
  async createDraftTaskFromResume(resumeId: number): Promise<AiGenerationTask> {
    return request.post<AiGenerationTask>(`/api/jobs/draft-tasks/from-resume/${resumeId}`);
  },

  /**
   * 创建职位草稿池批次（兼容入口）
   */
  async createDraftBatchFromResume(resumeId: number): Promise<JobDraftBatchCreated> {
    return request.post<JobDraftBatchCreated>(`/api/jobs/draft-batches/from-resume/${resumeId}`);
  },

  /**
   * 更新职位
   */
  async updateJob(id: number, data: UpdateJobForm): Promise<JobDetail> {
    return request.put<JobDetail>(`/api/jobs/${id}`, data);
  },

  async syncJobDetail(id: number, data: JobDetailSyncForm): Promise<JobDetail> {
    return request.post<JobDetail>(`/api/jobs/${id}/detail-sync`, data);
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
