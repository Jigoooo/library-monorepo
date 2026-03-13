import axios from 'axios';

import { setApiConfig, setAxiosInstance, type ApiConfig } from './config';
import { interceptors } from './interceptors';

type Params = Record<
  string,
  (string | number | boolean | (string | number | boolean)[]) | null | undefined
>;

/**
 * GET 요청의 query 파라미터를 직렬화합니다.
 * 배열 값을 반복된 key로 변환합니다.
 * 예: { ids: [1, 2] } -> "ids=1&ids=2"
 *
 * @param params 직렬화할 파라미터 객체
 * @returns URL 인코딩된 쿼리 문자열
 */
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

/**
 * API 클라이언트를 초기화합니다.
 * 앱 시작 시 가장 먼저 호출해야 합니다.
 *
 * @param config API 설정 객체 (baseURL, 토큰 함수, 재시도 설정 등)
 *
 * @example
 * initApi({
 *   baseURL: 'https://api.example.com',
 *   getToken: () => localStorage.getItem('accessToken'),
 *   refreshTokenFn: async () => {
 *     const res = await fetch('/auth/refresh', { method: 'POST' });
 *     const data = await res.json();
 *     localStorage.setItem('accessToken', data.accessToken);
 *     return data.accessToken;
 *   },
 *   transformResponse: 'camelCase',
 * });
 */
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
