import type { AxiosRequestConfig } from 'axios';

import { apiRequest } from './api-request';
import { customedAxios } from './customed-axios';

interface ApiInstance {
  get(url: string, config?: AxiosRequestConfig): Promise<unknown>;
  post(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>;
  put(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>;
  patch(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>;
  delete(url: string, config?: AxiosRequestConfig): Promise<unknown>;
}

export const api: ApiInstance = {
  get: (url, config) => apiRequest(customedAxios.get(url, config)),
  post: (url, data, config) => apiRequest(customedAxios.post(url, data, config)),
  put: (url, data, config) => apiRequest(customedAxios.put(url, data, config)),
  patch: (url, data, config) => apiRequest(customedAxios.patch(url, data, config)),
  delete: (url, config) => apiRequest(customedAxios.delete(url, config)),
};
