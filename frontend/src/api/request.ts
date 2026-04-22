import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { clearAuthSession, getAccessToken } from '../auth/auth-storage';

export interface Result<T = unknown> {
  code: number;
  message: string;
  data: T;
}

const AUTH_ERROR_CODES = new Set([401, 403, 9004, 9005]);
export const SESSION_EXPIRED_MESSAGE = '登录状态已失效，请重新登录';

const baseURL = import.meta.env.PROD ? '' : 'http://localhost:8080';

const instance: AxiosInstance = axios.create({
  baseURL,
  timeout: 60000,
});

function hasCodeProperty(value: object): value is object & { code: unknown } {
  return 'code' in value;
}

export function isResult(value: unknown): value is Result {
  return value !== null && typeof value === 'object' && hasCodeProperty(value);
}

export function isAuthErrorCode(code: unknown): boolean {
  return typeof code === 'number' && AUTH_ERROR_CODES.has(code);
}

export function getResultMessage(value: unknown, fallback = '请求失败'): string {
  if (isResult(value) && typeof value.message === 'string' && value.message.trim()) {
    return value.message;
  }
  return fallback;
}

function parseJsonText(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getHeaderValue(header: string | string[] | undefined): string | undefined {
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
}

async function parseBlobResult(blob: Blob, contentType?: string): Promise<unknown | null> {
  if (!contentType?.includes('application/json')) {
    return null;
  }
  return parseJsonText(await blob.text());
}

export function handleAuthExpired(message = SESSION_EXPIRED_MESSAGE): Error {
  clearAuthSession();
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
  return new Error(message);
}

export function buildAuthHeaders(headers: HeadersInit = {}): Headers {
  const nextHeaders = new Headers(headers);
  const token = getAccessToken();
  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }
  return nextHeaders;
}

export async function parseResponseJsonSafely(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

instance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => {
    if (response.config.responseType === 'blob') {
      return response;
    }

    const result = response.data as unknown;
    if (isResult(result)) {
      if (result.code === 200) {
        response.data = result.data;
        return response;
      }
      if (isAuthErrorCode(result.code)) {
        return Promise.reject(handleAuthExpired(getResultMessage(result, SESSION_EXPIRED_MESSAGE)));
      }
      return Promise.reject(new Error(getResultMessage(result)));
    }

    return response;
  },
  async (error: AxiosError<unknown>) => {
    if (error.response) {
      const { data, headers, status } = error.response;

      if (status === 401 || status === 403) {
        return Promise.reject(handleAuthExpired());
      }

      if (isResult(data)) {
        if (isAuthErrorCode(data.code)) {
          return Promise.reject(handleAuthExpired(getResultMessage(data, SESSION_EXPIRED_MESSAGE)));
        }
        return Promise.reject(new Error(getResultMessage(data)));
      }

      if (data instanceof Blob) {
        const blobResult = await parseBlobResult(data, getHeaderValue(headers['content-type']));
        if (isResult(blobResult)) {
          if (isAuthErrorCode(blobResult.code)) {
            return Promise.reject(handleAuthExpired(getResultMessage(blobResult, SESSION_EXPIRED_MESSAGE)));
          }
          return Promise.reject(new Error(getResultMessage(blobResult)));
        }
      }

      return Promise.reject(new Error('请求失败，请重试'));
    }

    const config = error.config;
    const isUpload = config && (
      config.url?.includes('/upload') ||
      config.headers?.['Content-Type']?.toString().includes('multipart')
    );

    if (isUpload) {
      return Promise.reject(new Error('上传失败，可能是网络超时或连接中断，请重试'));
    }

    return Promise.reject(new Error('网络连接失败，请检查网络'));
  }
);

export const request = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return instance.get(url, config).then(res => res.data);
  },

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return instance.post(url, data, config).then(res => res.data);
  },

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return instance.put(url, data, config).then(res => res.data);
  },

  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return instance.delete(url, config).then(res => res.data);
  },

  upload<T>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> {
    return instance.post(url, formData, {
      timeout: 120000,
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config,
    }).then(res => res.data);
  },

  getInstance(): AxiosInstance {
    return instance;
  },
};

export async function downloadBlob(url: string, config?: AxiosRequestConfig): Promise<Blob> {
  const response = await instance.get<Blob>(url, {
    ...config,
    responseType: 'blob',
  });
  const contentType = getHeaderValue(response.headers['content-type']);
  const blobResult = await parseBlobResult(response.data, contentType);

  if (isResult(blobResult)) {
    if (isAuthErrorCode(blobResult.code)) {
      throw handleAuthExpired(getResultMessage(blobResult, SESSION_EXPIRED_MESSAGE));
    }
    if (blobResult.code !== 200) {
      throw new Error(getResultMessage(blobResult, '下载失败'));
    }
  }

  return response.data;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return '未知错误';
}

export default request;
