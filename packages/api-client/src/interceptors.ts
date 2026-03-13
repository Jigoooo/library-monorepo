import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import qs from 'qs';

import { getApiConfig } from './config';
import { logOnDev } from './utils/log';

/**
 * 토큰 갱신 중 여부 플래그
 * 동일 시점에 여러 401 에러가 발생할 때 중복 갱신을 방지
 */
let isRefreshing = false;
/**
 * 토큰 갱신 대기 중인 요청들 큐
 */
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

/**
 * 대기 중인 요청들에 새 토큰 전달 또는 에러 처리합니다.
 * 토큰 갱신 후 대기 중인 요청들을 깨우기 위한 내부 함수입니다.
 *
 * @param error - 에러가 발생했을 경우 에러 객체 (null이면 성공)
 * @param token - 새로 갱신된 토큰 문자열 (에러 없을 때만 전달)
 */
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * 밀리초 단위로 대기합니다.
 * 재시도 지연 시간에 사용됩니다.
 *
 * @param ms - 대기 시간(밀리초)
 * @returns 대기 후 resolve되는 Promise
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 선제적으로 토큰 만료 여부를 확인하고 필요하면 갱신합니다.
 * ApiConfig에 isTokenExpired 함수가 설정되어 있을 때만 작동합니다.
 *
 * @param headers - Axios 요청 헤더 객체 (Authorization 헤더 추가에 사용)
 */
const injectToken = async (headers: AxiosRequestConfig['headers']) => {
  try {
    const { refreshTokenFn, retryConfig } = getApiConfig();
    if (!retryConfig?.isTokenExpired?.()) return;

    try {
      const newToken = await refreshTokenFn?.();
      if (newToken && headers) {
        headers.Authorization = `Bearer ${newToken}`;
      }
    } catch {
      const { onUnauthorized } = getApiConfig();
      onUnauthorized?.();
    }
  } catch {
    // config 미설정 시 무시
  }
};

/**
 * 현재 유효한 토큰을 요청 헤더에 주입합니다.
 * getToken() 함수를 호출하여 토큰을 가져오고 Authorization 헤더에 설정합니다.
 *
 * @param headers - Axios 요청 헤더 객체 (Authorization 헤더 추가에 사용)
 */
const applyToken = (headers: AxiosRequestConfig['headers']) => {
  try {
    const { getToken } = getApiConfig();
    const token = getToken?.();
    if (token && headers) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // config 미설정 또는 토큰 없음 무시
  }
};

/**
 * 요청 인터셉터 메인 함수입니다.
 * 선제적 토큰 갱신, 토큰 주입, 사용자 훅 실행 순서로 진행됩니다.
 *
 * @param config - Axios 요청 설정 객체
 * @returns 처리된 InternalAxiosRequestConfig 객체
 */
const onRequest = async (config: AxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
  const { method, url, headers, params, baseURL } = config;

  logOnDev(`onRequest [API] ${method?.toUpperCase()} ${url} | Request`);

  if (!headers) {
    throw new Error('axios header is undefined');
  }

  if (params) {
    config.params = params;
  }

  // ── 내장: 선제적 토큰 만료 확인 후 refresh
  await injectToken(headers);

  // ── 내장: 토큰 주입
  applyToken(headers);

  let fullUrl = `${baseURL || ''}${url}`;
  if (method?.toUpperCase() === 'GET' && config.params) {
    const queryString = qs.stringify(config.params, { arrayFormat: 'brackets' });
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
  }

  logOnDev(`onRequest [API] ${method?.toUpperCase()} ${fullUrl} | Request`);

  // ── 사용자 훅 (토큰 주입 이후)
  try {
    const { onRequest: userHook } = getApiConfig();
    if (userHook) {
      return await userHook({ ...config } as InternalAxiosRequestConfig);
    }
  } catch {
    // 훅 미설정 무시
  }

  return { ...config } as InternalAxiosRequestConfig;
};

/**
 * 요청 에러를 분류하여 로깅합니다.
 * config 존재 여부에 따라 다르게 메시지를 포맷합니다.
 *
 * @param error - Axios 요청 에러 객체
 */
const logRequestError = (error: AxiosError<AxiosRequestConfig>) => {
  if (error.config) {
    logOnDev(`onErrorRequest: 요청 실패: ${error}`);
  } else if (error.request) {
    logOnDev(`onErrorRequest: 응답 없음 ${error}`);
  } else {
    logOnDev(`onErrorRequest: ${error}`);
  }
};

/**
 * 요청 에러 인터셉터입니다.
 * 내장 로깅과 사용자 훅을 실행합니다.
 *
 * @param error - Axios 요청 에러 객체
 * @throws 항상 에러를 던집니다 (처리 후에도)
 */
const onErrorRequest = async (error: AxiosError<AxiosRequestConfig>) => {
  // ── 내장: 로깅
  logRequestError(error);

  // ── 사용자 훅
  try {
    const { onErrorRequest: userHook } = getApiConfig();
    if (userHook) {
      await userHook(error);
    }
  } catch {
    // 훅 미설정 무시
  }

  throw error;
};

/**
 * 응답 인터셉터입니다.
 * 요청-응답 사이클 정보를 로깅합니다.
 *
 * @param response - Axios 응답 객체
 * @returns 변경되지 않은 응답 객체
 */
const onResponse = async (response: AxiosResponse): Promise<AxiosResponse> => {
  const { method, url } = response.config;
  const { status } = response;

  // ── 내장: 로깅
  logOnDev(`onResponse [API] ${method?.toUpperCase()} ${url} | Request ${status}`);

  try {
    const { onResponse: userHook } = getApiConfig();
    if (userHook) {
      return await userHook(response);
    }
  } catch {
    // 사용자 훅이 없거나 에러 발생시 무시
  }

  return response;
};

/**
 * 객체 내 base64 인코딩 문자열과 긴 문자열을 축약합니다.
 * 로깅 시 가독성과 성능을 위해 이미지 데이터 등 긴 문자열을 생략합니다.
 *
 * @param obj - 축약 대상 객체 (또는 배열, 문자열, 원시 값)
 * @param maxLength - 문자열 최대 길이 (기본: 100)
 * @returns 축약된 객체 (재귀 처리)
 */
const truncateBase64 = (obj: unknown, maxLength = 100): unknown => {
  if (typeof obj === 'string') {
    // base64 패턴 감지 (data:image/ 또는 긴 영숫자 문자열)
    if (obj.startsWith('data:image/') || (obj.length > 200 && /^[A-Za-z0-9+/=]+$/.test(obj))) {
      return `[BASE64_IMAGE: ${obj.length} chars]`;
    }
    if (obj.length > maxLength) {
      return obj.slice(0, maxLength) + '...';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => truncateBase64(item, maxLength));
  }

  if (obj && typeof obj === 'object') {
    const truncated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      truncated[key] = truncateBase64(value, maxLength);
    }
    return truncated;
  }

  return obj;
};

/**
 * 요청 설정 데이터를 로깅용으로 정제합니다.
 * base64 인코딩 문자열과 긴 문자열을 축약합니다.
 *
 * @param data - 요청 설정 데이터
 * @returns 축약된 데이터
 */
const getConfigData = (data: unknown): unknown => {
  if (!data) return undefined;
  if (typeof data === 'string') {
    return truncateBase64(data, 200);
  }
  return truncateBase64(data);
};

/**
 * 응답 데이터를 로깅용으로 정제합니다.
 * JSON 직렬화 후 긴 문자열을 축약합니다.
 *
 * @param data - 응답 데이터
 * @returns 축약된 데이터
 */
const getResponseData = (data: unknown): unknown => {
  if (!data) return undefined;
  return truncateBase64(JSON.stringify(data), 500);
};

/**
 * Axios 에러를 축약된 형식으로 콘솔에 로깅합니다.
 * 핵심 정보(상태 코드, URL, 메서드, 데이터)만 추출합니다.
 *
 * @param error - Axios 에러 객체
 */
const logAxiosErrorShort = (error: AxiosError) => {
  const safeError = {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    url: error.config?.url,
    method: error.config?.method?.toUpperCase(),
    params: error.config?.params,
    data: getConfigData(error.config?.data),
    responseData: getResponseData(error.response?.data),
  };

  console.log('AxiosError (short):', safeError);
};

/**
 * 응답 데이터와 요청 설정 데이터를 로깅합니다.
 * 에러 응답 분석에 사용되는 헬퍼 함수입니다.
 *
 * @param data - 응답 본문 데이터
 * @param configData - 요청 설정 데이터
 */
const logResponseData = (data: unknown, configData: unknown) => {
  if (data) {
    logOnDev('onErrorResponse [API] data: ', JSON.stringify(data, null, 2));
  }

  if (configData) {
    try {
      if (typeof configData === 'string') {
        logOnDev('onErrorResponse [API] config.data: ', truncateBase64(JSON.parse(configData)));
      } else {
        logOnDev('onErrorResponse [API] config.data: ', truncateBase64(configData));
      }
    } catch {
      logOnDev('onErrorResponse [API] config.data (raw): ', truncateBase64(configData));
    }
  }
};

/**
 * 토큰 갱신을 재시도합니다.
 * 지정한 횟수만큼 재시도하고, 모두 실패하면 onUnauthorized를 호출합니다.
 *
 * @param maxRetries - 최대 재시도 횟수
 * @param retryDelay - 재시도 사이 대기 시간(ms)
 * @param refreshTokenFn - 토큰 갱신 함수
 * @param onUnauthorized - 갱신 실패 시 콜백 (예: 로그인 페이지로 이동)
 * @returns 새로 갱신된 토큰
 * @throws Error - 모든 재시도 실패 시
 */
const attemptTokenRefresh = async (
  maxRetries: number,
  retryDelay: number,
  refreshTokenFn: (() => Promise<string>) | undefined,
  onUnauthorized: (() => void) | undefined,
): Promise<string> => {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      if (retryDelay > 0) await delay(retryDelay);
      if (!refreshTokenFn) throw new Error('No refreshTokenFn');

      return await refreshTokenFn();
    } catch {
      attempt++;
      if (attempt >= maxRetries) {
        onUnauthorized?.();
        throw new Error('Token refresh failed');
      }
    }
  }

  throw new Error('Token refresh failed');
};

/**
 * 401 토큰 만료 에러를 처리하여 토큰을 갱신하고 요청을 재시도합니다.
 * 동시에 여러 401 에러가 발생하면 큐 메커니즘으로 중복 갱신을 방지합니다.
 *
 * @param error - Axios 에러 객체 (401 상태 코드)
 * @returns 갱신된 토큰으로 재시도한 응답, 또는 갱신이 불필요하면 undefined
 */
const handleTokenRefresh = async (error: AxiosError): Promise<AxiosResponse | void> => {
  try {
    const { refreshTokenFn, onUnauthorized, retryConfig } = getApiConfig();
    const {
      maxRetries = 1,
      retryDelay = 0,
      maxQueueSize = 50,
      shouldRetry = (e: AxiosError) => e.response?.status === 401,
    } = retryConfig ?? {};

    if (!shouldRetry(error) || !error.config) return;

    if (failedQueue.length >= maxQueueSize) {
      throw error;
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            if (error.config) {
              error.config.headers.Authorization = `Bearer ${token}`;
              resolve(axios(error.config));
            }
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const newToken = await attemptTokenRefresh(
        maxRetries,
        retryDelay,
        refreshTokenFn,
        onUnauthorized,
      );
      processQueue(null, newToken);
      if (error.config) error.config.headers.Authorization = `Bearer ${newToken}`;
      return axios(error.config);
    } finally {
      isRefreshing = false;
    }
  } catch {
    // config 미설정 시 무시
  }
};

/**
 * 응답 에러 인터셉터입니다.
 * 401 토큰 만료 처리, 로깅, 사용자 훅 실행을 순서대로 진행합니다.
 * 401이 성공적으로 갱신되면 재시도 응답을 반환합니다.
 *
 * @param error - Axios 에러 또는 일반 Error 객체
 * @throws 항상 에러를 던집니다 (401 성공 갱신 제외)
 */
const onErrorResponse = async (error: AxiosError | Error) => {
  if (axios.isAxiosError(error)) {
    logAxiosErrorShort(error);

    if (error.response) {
      const { status, statusText, data } = error.response;
      const method = error.config?.method;
      const url = error.config?.url;

      // ── 내장: 401 재시도 처리
      const refreshResult = await handleTokenRefresh(error);
      if (refreshResult) {
        return refreshResult;
      }

      // ── 내장: 로깅
      logOnDev(
        `onErrorResponse [API] ${method?.toUpperCase?.()} ${url} | Error ${status} ${statusText} | ${error.message}`,
      );

      logResponseData(data, error.config?.data);
    } else {
      const method = error.config?.method;
      const url = error.config?.url;
      logOnDev(
        `onErrorResponse [API] ${method?.toUpperCase?.()} ${url} | Network Error or Request Canceled | ${error.message}`,
      );
    }
  } else if (error.name === 'TimeoutError') {
    logOnDev(`[API] | TimeError ${error.toString()}`);
  } else {
    logOnDev(`[API] | Error ${error.toString()}`);
  }

  // ── 사용자 훅 (401 해결된 경우는 여기 도달하지 않음)
  try {
    const { onErrorResponse: userHook } = getApiConfig();
    if (userHook) {
      await userHook(error);
    }
  } catch {
    // 훅 미설정 무시
  }

  throw error;
};

/**
 * Axios 인스턴스에 요청/응답 인터셉터를 등록합니다.
 * 토큰 관리, 에러 처리, 로깅, 사용자 훅 등의 기능을 포함합니다.
 *
 * 요청 인터셉터 실행 순서:
 * 1. 선제적 토큰 만료 확인 → 필요하면 갱신
 * 2. 현재 유효한 토큰 주입 (Authorization 헤더)
 * 3. 사용자 정의 onRequest 훅 실행
 *
 * 응답 인터셉터 실행 순서:
 * 1. 성공 시: 로깅 후 응답 반환
 * 2. 에러 시:
 *    - 401 에러: 토큰 갱신 후 원래 요청 재시도
 *    - 기타 에러: 로깅 후 사용자 정의 onErrorResponse 훅 실행
 *
 * @param axiosInstance - 인터셉터를 등록할 Axios 인스턴스
 * @returns 인터셉터가 등록된 같은 인스턴스 (체이닝 가능)
 *
 * @example
 * const instance = axios.create({ baseURL: 'https://api.example.com' });
 * interceptors(instance);
 * // 이제 instance는 자동으로 토큰 관리, 401 재시도 등을 수행
 */
export const interceptors = (axiosInstance: AxiosInstance): AxiosInstance => {
  axiosInstance.interceptors.request.use(onRequest, onErrorRequest);
  axiosInstance.interceptors.response.use(onResponse, onErrorResponse);

  return axiosInstance;
};
