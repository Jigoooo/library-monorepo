import axios from 'axios';

import { setApiConfig, setAxiosInstance, type ApiConfig } from './config';
import { interceptors } from './interceptors';

type Params = Record<
  string,
  (string | number | boolean | (string | number | boolean)[]) | null | undefined
>;

export function customParamsSerializer(params: Params) {
  const parts: string[] = [];
  for (const key in params) {
    if (Object.hasOwn(params, key)) {
      const value = params[key];
      if (Array.isArray(value)) {
        value.forEach((v) => {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
        });
      } else if (value !== null && value !== undefined) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
  }
  return parts.join('&');
}

export function initApi(config: ApiConfig): void {
  setApiConfig(config);

  const instance = axios.create({
    ...config.axiosOptions,
    baseURL: config.baseURL,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      accept: 'application/json',
      ...config.axiosOptions?.headers,
    },
    responseType: 'json',
    paramsSerializer: config.axiosOptions?.paramsSerializer ?? customParamsSerializer,
    timeoutErrorMessage: '요청시간이 초과되었습니다.',
    timeout: config.axiosOptions?.timeout ?? 1000 * 60 * 2,
  });

  interceptors(instance);
  setAxiosInstance(instance);
}
