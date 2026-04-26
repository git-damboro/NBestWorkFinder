import { request } from './request';
import type {
  CreateDraftBatchFromPageSyncForm,
  ImportJobDraftItemsResult,
  JobDraftBatch,
  JobDraftBatchCreated,
  JobDraftDetailSyncForm,
  JobDraftItem,
} from '../types/job-draft';

export const jobDraftApi = {
  async createBatchFromResume(resumeId: number): Promise<JobDraftBatchCreated> {
    return request.post<JobDraftBatchCreated>(`/api/job-drafts/batches/from-resume/${resumeId}`);
  },

  async createBatchFromPageSync(data: CreateDraftBatchFromPageSyncForm): Promise<JobDraftBatchCreated> {
    return request.post<JobDraftBatchCreated>('/api/job-drafts/batches/from-page-sync', data);
  },

  async getBatch(batchId: string): Promise<JobDraftBatch> {
    return request.get<JobDraftBatch>(`/api/job-drafts/batches/${batchId}`);
  },

  async getItems(batchId: string): Promise<JobDraftItem[]> {
    return request.get<JobDraftItem[]>(`/api/job-drafts/batches/${batchId}/items`);
  },

  async getLatestBatch(): Promise<JobDraftBatch | null> {
    return request.get<JobDraftBatch | null>('/api/job-drafts/batches/latest');
  },

  async updateSelection(batchId: string, selectedDraftItemIds: string[]): Promise<JobDraftBatch> {
    return request.put<JobDraftBatch>(`/api/job-drafts/batches/${batchId}/selection`, {
      selectedDraftItemIds,
    });
  },

  async importItems(batchId: string, draftItemIds: string[]): Promise<ImportJobDraftItemsResult> {
    return request.post<ImportJobDraftItemsResult>(`/api/job-drafts/batches/${batchId}/import`, {
      draftItemIds,
    });
  },

  async syncItemDetail(draftItemId: string, data: JobDraftDetailSyncForm): Promise<JobDraftItem> {
    return request.post<JobDraftItem>(`/api/job-drafts/items/${draftItemId}/detail-sync`, data);
  },

  async updateItem(draftItemId: string, data: JobDraftDetailSyncForm): Promise<JobDraftItem> {
    return request.put<JobDraftItem>(`/api/job-drafts/items/${draftItemId}`, data);
  },
};
