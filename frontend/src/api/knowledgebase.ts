import {
  buildAuthHeaders,
  downloadBlob,
  getErrorMessage,
  getResultMessage,
  handleAuthExpired,
  isAuthErrorCode,
  isResult,
  parseResponseJsonSafely,
  request,
} from './request';

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:8080';

export type VectorStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface KnowledgeBaseItem {
  id: number;
  name: string;
  category: string | null;
  originalFilename: string;
  fileSize: number;
  contentType: string;
  uploadedAt: string;
  lastAccessedAt: string;
  accessCount: number;
  questionCount: number;
  vectorStatus: VectorStatus;
  vectorError: string | null;
  chunkCount: number;
}

export interface KnowledgeBaseStats {
  totalCount: number;
  totalQuestionCount: number;
  totalAccessCount: number;
  completedCount: number;
  processingCount: number;
}

export type SortOption = 'time' | 'size' | 'access' | 'question';

export interface UploadKnowledgeBaseResponse {
  knowledgeBase: {
    id: number;
    name: string;
    category: string;
    fileSize: number;
    contentLength: number;
  };
  storage: {
    fileKey: string;
    fileUrl: string;
  };
  duplicate: boolean;
}

export interface QueryRequest {
  knowledgeBaseIds: number[];
  question: string;
}

export interface QueryResponse {
  answer: string;
  knowledgeBaseId: number;
  knowledgeBaseName: string;
}

export const knowledgeBaseApi = {
  async uploadKnowledgeBase(file: File, name?: string, category?: string): Promise<UploadKnowledgeBaseResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (name) {
      formData.append('name', name);
    }
    if (category) {
      formData.append('category', category);
    }
    return request.upload<UploadKnowledgeBaseResponse>('/api/knowledgebase/upload', formData);
  },

  async downloadKnowledgeBase(id: number): Promise<Blob> {
    return downloadBlob(`/api/knowledgebase/${id}/download`);
  },

  async getAllKnowledgeBases(
    sortBy?: SortOption,
    vectorStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  ): Promise<KnowledgeBaseItem[]> {
    const params = new URLSearchParams();
    if (sortBy) {
      params.append('sortBy', sortBy);
    }
    if (vectorStatus) {
      params.append('vectorStatus', vectorStatus);
    }
    const queryString = params.toString();
    return request.get<KnowledgeBaseItem[]>(`/api/knowledgebase/list${queryString ? `?${queryString}` : ''}`);
  },

  async getKnowledgeBase(id: number): Promise<KnowledgeBaseItem> {
    return request.get<KnowledgeBaseItem>(`/api/knowledgebase/${id}`);
  },

  async deleteKnowledgeBase(id: number): Promise<void> {
    return request.delete(`/api/knowledgebase/${id}`);
  },

  async getAllCategories(): Promise<string[]> {
    return request.get<string[]>('/api/knowledgebase/categories');
  },

  async getByCategory(category: string): Promise<KnowledgeBaseItem[]> {
    return request.get<KnowledgeBaseItem[]>(`/api/knowledgebase/category/${encodeURIComponent(category)}`);
  },

  async getUncategorized(): Promise<KnowledgeBaseItem[]> {
    return request.get<KnowledgeBaseItem[]>('/api/knowledgebase/uncategorized');
  },

  async updateCategory(id: number, category: string | null): Promise<void> {
    return request.put(`/api/knowledgebase/${id}/category`, { category });
  },

  async search(keyword: string): Promise<KnowledgeBaseItem[]> {
    return request.get<KnowledgeBaseItem[]>(`/api/knowledgebase/search?keyword=${encodeURIComponent(keyword)}`);
  },

  async getStatistics(): Promise<KnowledgeBaseStats> {
    return request.get<KnowledgeBaseStats>('/api/knowledgebase/stats');
  },

  async revectorize(id: number): Promise<void> {
    return request.post(`/api/knowledgebase/${id}/revectorize`);
  },

  async queryKnowledgeBase(req: QueryRequest): Promise<QueryResponse> {
    return request.post<QueryResponse>('/api/knowledgebase/query', req, {
      timeout: 180000,
    });
  },

  async queryKnowledgeBaseStream(
    req: QueryRequest,
    onMessage: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/knowledgebase/query/stream`, {
        method: 'POST',
        headers: buildAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(req),
      });

      const result = await parseResponseJsonSafely(response);
      if (isResult(result)) {
        if (isAuthErrorCode(result.code)) {
          throw handleAuthExpired(getResultMessage(result));
        }
        if (result.code !== 200) {
          throw new Error(getResultMessage(result, `请求失败 (${response.status})`));
        }
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw handleAuthExpired();
        }
        throw new Error(getResultMessage(result, `请求失败 (${response.status})`));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const extractContent = (line: string): string | null => {
        if (!line.startsWith('data:')) {
          return null;
        }

        let content = line.substring(5);
        if (content.startsWith(' ')) {
          content = content.substring(1);
        }
        if (content.length === 0) {
          return '\n';
        }
        return content;
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer) {
            const content = extractContent(buffer);
            if (content) {
              onMessage(content);
            }
          }
          onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const content = extractContent(line);
          if (content !== null) {
            onMessage(content);
          }
        }
      }
    } catch (error) {
      onError(new Error(getErrorMessage(error)));
    }
  },
};
