import {
  buildAuthHeaders,
  getErrorMessage,
  getResultMessage,
  handleAuthExpired,
  isAuthErrorCode,
  isResult,
  parseResponseJsonSafely,
  request,
} from './request';

const API_BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:8080';

export interface RagChatSession {
  id: number;
  title: string;
  knowledgeBaseIds: number[];
  createdAt: string;
}

export interface RagChatSessionListItem {
  id: number;
  title: string;
  messageCount: number;
  knowledgeBaseNames: string[];
  updatedAt: string;
  isPinned: boolean;
}

export interface RagChatMessage {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface KnowledgeBaseItem {
  id: number;
  name: string;
  originalFilename: string;
  fileSize: number;
  contentType: string;
  uploadedAt: string;
  lastAccessedAt: string;
  accessCount: number;
  questionCount: number;
}

export interface RagChatSessionDetail {
  id: number;
  title: string;
  knowledgeBases: KnowledgeBaseItem[];
  messages: RagChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export const ragChatApi = {
  async createSession(knowledgeBaseIds: number[], title?: string): Promise<RagChatSession> {
    return request.post<RagChatSession>('/api/rag-chat/sessions', {
      knowledgeBaseIds,
      title,
    });
  },

  async listSessions(): Promise<RagChatSessionListItem[]> {
    return request.get<RagChatSessionListItem[]>('/api/rag-chat/sessions');
  },

  async getSessionDetail(sessionId: number): Promise<RagChatSessionDetail> {
    return request.get<RagChatSessionDetail>(`/api/rag-chat/sessions/${sessionId}`);
  },

  async updateSessionTitle(sessionId: number, title: string): Promise<void> {
    return request.put(`/api/rag-chat/sessions/${sessionId}/title`, { title });
  },

  async updateKnowledgeBases(sessionId: number, knowledgeBaseIds: number[]): Promise<void> {
    return request.put(`/api/rag-chat/sessions/${sessionId}/knowledge-bases`, {
      knowledgeBaseIds,
    });
  },

  async togglePin(sessionId: number): Promise<void> {
    return request.put(`/api/rag-chat/sessions/${sessionId}/pin`);
  },

  async deleteSession(sessionId: number): Promise<void> {
    return request.delete(`/api/rag-chat/sessions/${sessionId}`);
  },

  async sendMessageStream(
    sessionId: number,
    question: string,
    onMessage: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rag-chat/sessions/${sessionId}/messages/stream`,
        {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ question }),
        }
      );

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

      const extractEventContent = (event: string): string | null => {
        if (!event.trim()) {
          return null;
        }

        const lines = event.split('\n');
        const contentParts: string[] = [];

        for (const line of lines) {
          if (line.startsWith('data:')) {
            contentParts.push(line.substring(5));
          }
        }

        if (contentParts.length === 0) {
          return null;
        }

        return contentParts.join('')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r');
      };

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer) {
            const content = extractEventContent(buffer);
            if (content) {
              onMessage(content);
            }
          }
          onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf('\n\n');
        if (newlineIndex === -1) {
          const singleLineIndex = buffer.indexOf('\n');
          if (singleLineIndex !== -1 && buffer.substring(0, singleLineIndex).startsWith('data:')) {
            const line = buffer.substring(0, singleLineIndex);
            const content = extractEventContent(line);
            if (content) {
              onMessage(content);
            }
            buffer = buffer.substring(singleLineIndex + 1);
          }
          continue;
        }

        const eventBlock = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 2);

        const content = extractEventContent(eventBlock);
        if (content !== null) {
          onMessage(content);
        }
      }
    } catch (error) {
      onError(new Error(getErrorMessage(error)));
    }
  },
};
