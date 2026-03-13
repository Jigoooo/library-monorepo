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
 * 대기 중인 요청들에 새 토큰 전달
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const logRequestError = (error: AxiosError<AxiosRequestConfig>) => {
  if (error.config) {
    logOnDev(`onErrorRequest: 요청 실패: ${error}`);
  } else if (error.request) {
    logOnDev(`onErrorRequest: 응답 없음 ${error}`);
  } else {
    logOnDev(`onErrorRequest: ${error}`);
  }
};

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

const onResponse = (response: AxiosResponse): AxiosResponse => {
  const { method, url } = response.config;
  const { status } = response;

  // ── 내장: 로깅
  logOnDev(`onResponse [API] ${method?.toUpperCase()} ${url} | Request ${status}`);

  return response;
};

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

const getConfigData = (data: unknown): unknown => {
  if (!data) return undefined;
  if (typeof data === 'string') {
    return truncateBase64(data, 200);
  }
  return truncateBase64(data);
};

const getResponseData = (data: unknown): unknown => {
  if (!data) return undefined;
  return truncateBase64(JSON.stringify(data), 500);
};

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

export const interceptors = (axiosInstance: AxiosInstance): AxiosInstance => {
  axiosInstance.interceptors.request.use(onRequest, onErrorRequest);
  axiosInstance.interceptors.response.use(onResponse, onErrorResponse);

  return axiosInstance;
};
