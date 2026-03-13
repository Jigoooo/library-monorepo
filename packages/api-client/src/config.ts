import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

export interface RetryConfig {
  /** 토큰 갱신 재시도 횟수. 기본: 1 */
  maxRetries?: number;
  /** 재시도 사이 대기 시간(ms). 기본: 0 */
  retryDelay?: number;
  /** 동시 401 발생 시 대기열 최대 크기. 기본: 50. 초과 시 즉시 reject */
  maxQueueSize?: number;
  /**
   * retry 조건 함수. true 반환 시 refreshTokenFn 시도.
   * 기본: (error) => error.response?.status === 401
   */
  shouldRetry?: (error: AxiosError) => boolean;
  /**
   * 재시도 전 토큰 만료 여부를 선제적으로 확인하는 함수.
   * true 반환 시 요청 전에 refreshTokenFn 먼저 호출.
   * 기본: undefined (사용 안 함)
   */
  isTokenExpired?: () => boolean;
}

export interface ApiConfig {
  baseURL: string;

  /** 요청마다 호출. Bearer 토큰 반환. 없으면 Authorization 헤더 생략 */
  getToken?: () => string | null | undefined;

  /**
   * 401 시 새 accessToken 반환 클로저.
   * store 업데이트 포함. throw 시 onUnauthorized 호출.
   */
  refreshTokenFn?: () => Promise<string>;

  /** refreshTokenFn 실패 또는 미설정 시 콜백. 기본: window.location.href = '/login' */
  onUnauthorized?: () => void;

  /** retry 관련 세부 설정 */
  retryConfig?: RetryConfig;

  /**
   * adaptResponse 호출 전 response.data 전처리.
   * - undefined 또는 false(기본): 변환 없음
   * - 'camelCase': deepCamelize 적용
   * - 함수: 해당 함수로 변환
   */
  transformResponse?: false | 'camelCase' | ((data: unknown) => unknown);

  /** 요청 전 (토큰 주입 이전) 실행. config 수정 가능 */
  onRequest?: (
    config: InternalAxiosRequestConfig,
  ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;

  /** 응답 후 (로깅 이후) 실행. response 수정 가능 */
  onResponse?: (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>;

  /** 요청 에러 시 (내장 로깅 이후) 추가 처리 */
  onErrorRequest?: (error: AxiosError) => void | Promise<void>;

  /**
   * 응답 에러 시 (내장 401 처리 이후) 추가 처리.
   * 401이 refresh로 해결된 경우 호출되지 않음.
   */
  onErrorResponse?: (error: AxiosError | Error) => void | Promise<void>;

  /** axios.create()에 전달할 추가 옵션 (baseURL 제외) */
  axiosOptions?: Omit<AxiosRequestConfig, 'baseURL'>;
}

// ── 싱글턴 저장소 ──────────────────────────────────
let _config: ApiConfig | null = null;
let _axiosInstance: import('axios').AxiosInstance | null = null;

/**
 * API 클라이언트 설정을 저장합니다.
 * 내부적으로 싱글턴 패턴으로 관리되며, 일반적으로 initApi()에서 자동 호출됩니다.
 *
 * @param config - API 설정 객체 (baseURL, 토큰 함수, 콜백 등)
 * @throws 없음 (항상 성공)
 *
 * @example
 * setApiConfig({
 *   baseURL: 'https://api.example.com',
 *   getToken: () => localStorage.getItem('token'),
 *   transformResponse: 'camelCase',
 * });
 */
export function setApiConfig(config: ApiConfig): void {
  _config = config;
}

/**
 * 저장된 API 설정을 반환합니다.
 * initApi()를 호출하지 않으면 에러가 발생합니다.
 *
 * @returns 저장된 ApiConfig 객체
 * @throws Error - initApi()가 호출되지 않은 경우
 *
 * @example
 * const config = getApiConfig();
 * console.log(config.baseURL); // 'https://api.example.com'
 */
export function getApiConfig(): ApiConfig {
  if (!_config) {
    throw new Error('@jigoooo/api-client: initApi()를 먼저 호출하세요.');
  }
  return _config;
}

/**
 * Axios 인스턴스를 저장합니다.
 * 내부적으로 싱글턴 패턴으로 관리되며, 일반적으로 initApi()에서 자동 호출됩니다.
 *
 * @param instance - Axios 인스턴스
 *
 * @example
 * const axiosInstance = axios.create({ baseURL: 'https://api.example.com' });
 * setAxiosInstance(axiosInstance);
 */
export function setAxiosInstance(instance: import('axios').AxiosInstance): void {
  _axiosInstance = instance;
}

/**
 * 저장된 Axios 인스턴스를 반환합니다.
 * initApi()를 호출하지 않으면 에러가 발생합니다.
 *
 * @returns 저장된 Axios 인스턴스
 * @throws Error - initApi()가 호출되지 않은 경우
 *
 * @example
 * const instance = getAxiosInstance();
 * instance.get('/users');
 */
export function getAxiosInstance(): import('axios').AxiosInstance {
  if (!_axiosInstance) {
    throw new Error('@jigoooo/api-client: initApi()를 먼저 호출하세요.');
  }
  return _axiosInstance;
}

/**
 * API 설정 여부를 확인합니다.
 * initApi()가 호출되었는지 검사하는 헬퍼 함수입니다.
 *
 * @returns true - initApi() 호출됨, false - 미호출
 *
 * @example
 * if (isApiConfigured()) {
 *   const api = getApiConfig();
 * } else {
 *   console.log('initApi()를 먼저 호출하세요');
 * }
 */
export function isApiConfigured(): boolean {
  return _config !== null;
}
