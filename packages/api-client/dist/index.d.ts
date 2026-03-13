import * as axios from 'axios';
import { AxiosError, InternalAxiosRequestConfig, AxiosResponse, AxiosRequestConfig } from 'axios';

interface RetryConfig {
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
interface ApiConfig {
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
declare function initApi(config: ApiConfig): void;

/**
 * customedAxios — initApi() 이후 사용 가능한 axios 인스턴스
 *
 * Proxy 패턴: initApi() 호출 이전에는 getAxiosInstance() 지연 참조
 * 기존 customedAxios.get(...), .post(...) 등 사용처 변경 없음
 */
declare const customedAxios: axios.AxiosInstance;

/**
 * HTTP 요청 메서드 인터페이스
 * 모든 응답은 apiRequest()를 통해 transformResponse 처리됩니다.
 */
interface ApiInstance {
  /**
   * GET 요청
   * @param url 요청 경로
   * @param config Axios 설정
   * @returns 변환된 응답 데이터
   */
  get(url: string, config?: AxiosRequestConfig): Promise<unknown>;
  /**
   * POST 요청
   * @param url 요청 경로
   * @param data 요청 바디
   * @param config Axios 설정
   * @returns 변환된 응답 데이터
   */
  post(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>;
  /**
   * PUT 요청
   * @param url 요청 경로
   * @param data 요청 바디
   * @param config Axios 설정
   * @returns 변환된 응답 데이터
   */
  put(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>;
  /**
   * PATCH 요청
   * @param url 요청 경로
   * @param data 요청 바디
   * @param config Axios 설정
   * @returns 변환된 응답 데이터
   */
  patch(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>;
  /**
   * DELETE 요청
   * @param url 요청 경로
   * @param config Axios 설정
   * @returns 변환된 응답 데이터
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
declare const api: ApiInstance;

/**
 * Axios 응답을 처리하고 transformResponse를 적용합니다.
 * 일반적으로 api.get/post/put/patch/delete에서 내부적으로 호출됩니다.
 *
 * transformResponse 적용 순서:
 * 1. 'camelCase' → snake_case를 camelCase로 변환
 * 2. 함수 → 커스텀 변환 함수 실행
 * 3. false/undefined → 원본 데이터 반환
 *
 * @param request Axios Promise (예: customedAxios.get())
 * @returns ApiConfig의 transformResponse가 적용된 데이터
 *
 * @example
 * // api.get 내부에서 자동으로 사용됨
 * const data = await apiRequest(customedAxios.get('/users'));
 */
declare function apiRequest(request: Promise<any>): Promise<unknown>;

export { type ApiConfig, api, apiRequest, customedAxios, initApi };
