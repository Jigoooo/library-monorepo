import type { AxiosRequestConfig } from 'axios';

import { apiRequest, transformRequestData } from './api-request';
import { customedAxios } from './customed-axios';

/**
 * HTTP 요청 메서드 인터페이스.
 *
 * 요청 변환(transformRequest):
 * - POST/PUT/PATCH의 `data`(request body)는 호출 시 transformRequest 규칙으로 변환됩니다.
 * - 모든 메서드의 `config.params`(query params)는 인터셉터에서 동일 규칙으로 변환됩니다.
 * - FormData/File/Blob/ArrayBuffer/URLSearchParams/Date/Map/Set/RegExp/Error/원시값은 변환되지 않습니다.
 *
 * 응답 변환(transformResponse):
 * - 모든 메서드 응답은 apiRequest()를 통해 transformResponse 규칙으로 변환됩니다.
 */
export interface ApiInstance {
  /**
   * GET 요청
   * @param url 요청 경로 (baseURL에 결합)
   * @param config Axios 설정. `config.params`는 transformRequest 규칙으로 변환됩니다.
   * @returns transformResponse가 적용된 응답 데이터
   */
  get(url: string, config?: AxiosRequestConfig): Promise<unknown>;

  /**
   * POST 요청
   * @param url 요청 경로 (baseURL에 결합)
   * @param data 요청 바디. transformRequest 규칙으로 변환됩니다.
   * @param config Axios 설정. `config.params`도 동일 규칙으로 변환됩니다.
   * @returns transformResponse가 적용된 응답 데이터
   */
  post(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>;

  /**
   * PUT 요청
   * @param url 요청 경로 (baseURL에 결합)
   * @param data 요청 바디. transformRequest 규칙으로 변환됩니다.
   * @param config Axios 설정. `config.params`도 동일 규칙으로 변환됩니다.
   * @returns transformResponse가 적용된 응답 데이터
   */
  put(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>;

  /**
   * PATCH 요청
   * @param url 요청 경로 (baseURL에 결합)
   * @param data 요청 바디. transformRequest 규칙으로 변환됩니다.
   * @param config Axios 설정. `config.params`도 동일 규칙으로 변환됩니다.
   * @returns transformResponse가 적용된 응답 데이터
   */
  patch(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>;

  /**
   * DELETE 요청
   * @param url 요청 경로 (baseURL에 결합)
   * @param config Axios 설정. `config.params`는 transformRequest 규칙으로 변환됩니다.
   * @returns transformResponse가 적용된 응답 데이터
   */
  delete(url: string, config?: AxiosRequestConfig): Promise<unknown>;
}

/**
 * 기본 HTTP 클라이언트 인스턴스
 *
 * 모든 요청에는 다음이 자동으로 적용됩니다:
 * - Authorization 헤더에 Bearer 토큰 주입
 * - 401 에러 시 토큰 자동 갱신 및 재요청
 * - 응답 데이터 transformResponse 처리
 *
 * @example
 * // GET
 * const users = await api.get('/users');
 *
 * // POST
 * const newUser = await api.post('/users', { name: 'John', email: 'john@example.com' });
 *
 * // DELETE
 * await api.delete('/users/1');
 */
export const api: ApiInstance = {
  get: (url, config) => apiRequest(customedAxios.get(url, config)),
  post: (url, data, config) =>
    apiRequest(customedAxios.post(url, transformRequestData(data), config)),
  put: (url, data, config) =>
    apiRequest(customedAxios.put(url, transformRequestData(data), config)),
  patch: (url, data, config) =>
    apiRequest(customedAxios.patch(url, transformRequestData(data), config)),
  delete: (url, config) => apiRequest(customedAxios.delete(url, config)),
};
