/**
 * 401 토큰 갱신 인터셉터 테스트
 *
 * 아키텍처 이슈 (발견된 5가지):
 * 1. 모듈 레벨 상태 (isRefreshing, failedQueue): vi.resetModules() 없이는 테스트 간 상태 오염 발생
 * 2. handleTokenRefresh의 catch-all: 내부 에러를 모두 삼켜 디버깅이 어려움 (processQueue 실패 포함)
 * 3. processQueue에서 token이 null일 때 resolve가 호출되지 않음: error도 null이면 큐가 영원히 대기
 * 4. injectToken과 applyToken의 중복: 선제 갱신 후에도 applyToken이 재호출되어 헤더가 덮어써짐
 * 5. attemptTokenRefresh의 while 루프: attempt=0일 때 retryDelay 발생 → 첫 시도도 지연됨
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── 타입 ────────────────────────────────────────────────────────────────────

interface MockAxiosError {
  isAxiosError: true;
  response?: { status: number; statusText?: string; data?: unknown };
  config?: {
    method?: string;
    url?: string;
    headers: Record<string, string>;
    data?: unknown;
    params?: unknown;
    baseURL?: string;
  };
  request?: unknown;
  message: string;
  code?: string;
  name: string;
}

interface MockAxiosResponse {
  data: unknown;
  status: number;
  config?: { method?: string; url?: string };
}

// ── Mock 팩토리 ─────────────────────────────────────────────────────────────

const makeMockAxiosInstance = () => ({
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
});

const makeAxiosError = (
  status: number,
  overrides: Partial<MockAxiosError> = {},
): MockAxiosError => ({
  isAxiosError: true,
  response: { status, statusText: 'Error', data: {} },
  config: {
    method: 'get',
    url: '/test',
    headers: {},
    baseURL: 'https://api.example.com',
  },
  message: `Request failed with status code ${status}`,
  name: 'AxiosError',
  ...overrides,
});

const makeOkResponse = (data: unknown = { ok: true }): MockAxiosResponse => ({
  data,
  status: 200,
  config: { method: 'get', url: '/test' },
});

// ── 핸들러 추출 헬퍼 ────────────────────────────────────────────────────────

const extractHandlers = (mockInstance: ReturnType<typeof makeMockAxiosInstance>) => {
  const requestSuccessHandler = mockInstance.interceptors.request.use.mock.calls[0]?.[0];
  const requestErrorHandler = mockInstance.interceptors.request.use.mock.calls[0]?.[1];
  const responseSuccessHandler = mockInstance.interceptors.response.use.mock.calls[0]?.[0];
  const responseErrorHandler = mockInstance.interceptors.response.use.mock.calls[0]?.[1];

  return {
    requestSuccessHandler,
    requestErrorHandler,
    responseSuccessHandler,
    responseErrorHandler,
  };
};

// ── 공통 Mock 설정 헬퍼 ─────────────────────────────────────────────────────

// ── 테스트 스위트 ────────────────────────────────────────────────────────────

describe('401 토큰 갱신 인터셉터', () => {
  // 각 테스트마다 모듈 상태를 완전히 초기화
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3.1 Basic Flows
  // ─────────────────────────────────────────────────────────────────────────

  describe('3.1 Basic Flows', () => {
    it('정상 요청: 401 없이 응답 반환', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn().mockResolvedValue(makeOkResponse());
      const mockIsAxiosError = vi.fn().mockReturnValue(true);

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'valid-token',
        refreshTokenFn: vi.fn().mockResolvedValue('new-token'),
      });

      interceptors(mockAxiosInstance as any);
      const { responseSuccessHandler } = extractHandlers(mockAxiosInstance);

      const response = makeOkResponse({ user: 'test' });
      const result = await responseSuccessHandler(response);

      expect(result).toEqual(response);
      expect(mockAxiosRequest).not.toHaveBeenCalled();
    });

    it('401 발생 후 갱신 성공: 재시도 요청 반환', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const retryResponse = makeOkResponse({ retried: true });
      const mockAxiosRequest = vi.fn().mockResolvedValue(retryResponse);
      const mockIsAxiosError = vi.fn().mockReturnValue(true);
      const refreshTokenFn = vi.fn().mockResolvedValue('new-access-token');

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'expired-token',
        refreshTokenFn,
        retryConfig: { maxRetries: 1, retryDelay: 0 },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      const error = makeAxiosError(401);
      const result = await responseErrorHandler(error);

      expect(refreshTokenFn).toHaveBeenCalledTimes(1);
      expect(mockAxiosRequest).toHaveBeenCalledTimes(1);
      expect(error.config!.headers['Authorization']).toBe('Bearer new-access-token');
      expect(result).toEqual(retryResponse);
    });

    it('401 발생 후 갱신 실패: onUnauthorized 호출 후 에러 throw', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(true);
      const refreshTokenFn = vi.fn().mockRejectedValue(new Error('refresh failed'));
      const onUnauthorized = vi.fn();

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        onUnauthorized,
        retryConfig: { maxRetries: 1, retryDelay: 0 },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      const error = makeAxiosError(401);
      // handleTokenRefresh 내 에러는 catch-all로 삼켜지고, onErrorResponse에서 throw
      await expect(responseErrorHandler(error)).rejects.toThrow();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
      expect(mockAxiosRequest).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3.2 Queue Mechanism
  // ─────────────────────────────────────────────────────────────────────────

  describe('3.2 Queue Mechanism', () => {
    it('동시 401 (5개 요청): refreshTokenFn은 1회만 호출, 모두 재시도 완료', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const retryResponse = makeOkResponse({ ok: true });
      const mockAxiosRequest = vi.fn().mockResolvedValue(retryResponse);
      const mockIsAxiosError = vi.fn().mockReturnValue(true);

      let resolveRefresh!: (token: string) => void;
      const refreshTokenFn = vi.fn().mockReturnValue(
        new Promise<string>((res) => {
          resolveRefresh = res;
        }),
      );

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        retryConfig: { maxRetries: 1, retryDelay: 0, maxQueueSize: 50 },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      // 5개 동시 401
      const errors = Array.from({ length: 5 }, () => makeAxiosError(401));
      const promises = errors.map((e) => responseErrorHandler(e));

      // 갱신 완료
      resolveRefresh('concurrent-token');
      const results = await Promise.all(promises);

      expect(refreshTokenFn).toHaveBeenCalledTimes(1);
      expect(mockAxiosRequest).toHaveBeenCalledTimes(5);
      expect(results).toHaveLength(5);
      results.forEach((r) => expect(r).toEqual(retryResponse));
    });

    it('maxQueueSize 초과: 큐 가득 찰 때 즉시 reject', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(true);

      // 갱신이 영원히 대기 중인 상태를 만들기 위해 결코 resolve되지 않는 Promise
      const refreshTokenFn = vi.fn().mockReturnValue(new Promise(() => {}));

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      const maxQueueSize = 3;
      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        retryConfig: { maxRetries: 1, retryDelay: 0, maxQueueSize },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      // 첫 요청: isRefreshing = true로 만들기
      const firstError = makeAxiosError(401);
      // 첫 요청을 시작(await 안 함 - 갱신 대기 중)
      responseErrorHandler(firstError);

      // maxQueueSize개 추가 요청 → 큐에 쌓임
      for (let i = 0; i < maxQueueSize; i++) {
        responseErrorHandler(makeAxiosError(401));
      }

      // 한 개 더: 큐 초과 → 즉시 throw
      const overflowError = makeAxiosError(401);
      await expect(responseErrorHandler(overflowError)).rejects.toBeDefined();
    });

    it('Queue resolve/reject 정확성: 갱신 성공 시 모든 큐 항목에 새 토큰 전달', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi
        .fn()
        .mockImplementation((config: any) => Promise.resolve(makeOkResponse({ url: config.url })));
      const mockIsAxiosError = vi.fn().mockReturnValue(true);

      let resolveRefresh!: (token: string) => void;
      const refreshTokenFn = vi.fn().mockReturnValue(
        new Promise<string>((res) => {
          resolveRefresh = res;
        }),
      );

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        retryConfig: { maxRetries: 1, retryDelay: 0, maxQueueSize: 50 },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      const error1 = makeAxiosError(401, { config: { method: 'get', url: '/a', headers: {} } });
      const error2 = makeAxiosError(401, { config: { method: 'get', url: '/b', headers: {} } });
      const error3 = makeAxiosError(401, { config: { method: 'get', url: '/c', headers: {} } });

      const p1 = responseErrorHandler(error1);
      const p2 = responseErrorHandler(error2);
      const p3 = responseErrorHandler(error3);

      resolveRefresh('queue-token');
      await Promise.all([p1, p2, p3]);

      // 모든 재시도 요청의 Authorization 헤더에 새 토큰이 적용됐는지 확인
      const calls = mockAxiosRequest.mock.calls;
      expect(calls).toHaveLength(3);
      calls.forEach(([config]) => {
        expect(config.headers['Authorization']).toBe('Bearer queue-token');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3.3 Proactive Refresh (isTokenExpired)
  // ─────────────────────────────────────────────────────────────────────────

  describe('3.3 Proactive Refresh', () => {
    it('isTokenExpired 미설정: 선제 갱신 미발생, refreshTokenFn 미호출', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(false);
      const refreshTokenFn = vi.fn().mockResolvedValue('new-token');

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'current-token',
        refreshTokenFn,
        // isTokenExpired 미설정
      });

      interceptors(mockAxiosInstance as any);
      const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);

      const config = {
        method: 'get',
        url: '/data',
        headers: {},
        baseURL: 'https://api.example.com',
      };
      await requestSuccessHandler(config);

      // 선제 갱신 없이 refreshTokenFn 미호출
      expect(refreshTokenFn).not.toHaveBeenCalled();
    });

    it('isTokenExpired = true: 요청 전 선제 갱신 발생, 새 토큰 헤더에 주입', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(false);
      const refreshTokenFn = vi.fn().mockResolvedValue('proactive-token');
      const isTokenExpired = vi.fn().mockReturnValue(true);

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'old-token',
        refreshTokenFn,
        retryConfig: { isTokenExpired },
      });

      interceptors(mockAxiosInstance as any);
      const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);

      const config = {
        method: 'get',
        url: '/data',
        headers: {} as Record<string, string>,
        baseURL: 'https://api.example.com',
      };
      await requestSuccessHandler(config);

      expect(isTokenExpired).toHaveBeenCalledTimes(1);
      expect(refreshTokenFn).toHaveBeenCalledTimes(1);
      // Bug 3 수정: applyToken → injectToken 순서로 변경.
      // injectToken이 마지막에 실행되므로 'proactive-token'이 최종값.
      expect(config.headers['Authorization']).toBe('Bearer proactive-token');
    });

    it('isTokenExpired = false: 선제 갱신 미발생, 기존 토큰 유지', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(false);
      const refreshTokenFn = vi.fn().mockResolvedValue('new-token');
      const isTokenExpired = vi.fn().mockReturnValue(false);

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'valid-token',
        refreshTokenFn,
        retryConfig: { isTokenExpired },
      });

      interceptors(mockAxiosInstance as any);
      const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);

      const config = {
        method: 'get',
        url: '/data',
        headers: {} as Record<string, string>,
        baseURL: 'https://api.example.com',
      };
      await requestSuccessHandler(config);

      expect(isTokenExpired).toHaveBeenCalledTimes(1);
      expect(refreshTokenFn).not.toHaveBeenCalled();
      // applyToken이 기존 토큰을 주입
      expect(config.headers['Authorization']).toBe('Bearer valid-token');
    });

    it('isTokenExpired throw: onUnauthorized 호출 후 요청은 계속 진행', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(false);
      const refreshTokenFn = vi.fn().mockRejectedValue(new Error('refresh error'));
      const isTokenExpired = vi.fn().mockReturnValue(true);
      const onUnauthorized = vi.fn();

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'old-token',
        refreshTokenFn,
        onUnauthorized,
        retryConfig: { isTokenExpired },
      });

      interceptors(mockAxiosInstance as any);
      const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);

      const config = {
        method: 'get',
        url: '/data',
        headers: {},
        baseURL: 'https://api.example.com',
      };

      // 선제 갱신 실패해도 요청은 계속되어야 함 (throw 안 함)
      await expect(requestSuccessHandler(config)).resolves.toBeDefined();
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3.4 User Hooks
  // ─────────────────────────────────────────────────────────────────────────

  describe('3.4 User Hooks', () => {
    it('onRequest 훅: 요청 config 수정 가능, 토큰 주입 이후 실행', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(false);

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      const onRequest = vi.fn().mockImplementation((config: any) => ({
        ...config,
        headers: { ...config.headers, 'X-Custom': 'hook-value' },
      }));

      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'my-token',
        onRequest,
      });

      interceptors(mockAxiosInstance as any);
      const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);

      const config = {
        method: 'get',
        url: '/data',
        headers: {},
        baseURL: 'https://api.example.com',
      };
      const result = await requestSuccessHandler(config);

      expect(onRequest).toHaveBeenCalledTimes(1);
      // 훅이 호출될 때 이미 토큰이 주입되어 있어야 함
      const hookArg = onRequest.mock.calls[0][0];
      expect(hookArg.headers['Authorization']).toBe('Bearer my-token');
      // 훅의 수정사항 반영
      expect(result.headers['X-Custom']).toBe('hook-value');
    });

    it('onResponse 훅: 응답 변환 가능, 훅 반환값이 최종 응답', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(false);

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      const transformedResponse = makeOkResponse({ transformed: true });
      const onResponse = vi.fn().mockResolvedValue(transformedResponse);

      setApiConfig({
        baseURL: 'https://api.example.com',
        onResponse,
      });

      interceptors(mockAxiosInstance as any);
      const { responseSuccessHandler } = extractHandlers(mockAxiosInstance);

      const originalResponse = makeOkResponse({ original: true });
      const result = await responseSuccessHandler(originalResponse);

      expect(onResponse).toHaveBeenCalledTimes(1);
      expect(onResponse).toHaveBeenCalledWith(originalResponse);
      expect(result).toEqual(transformedResponse);
    });

    it('onErrorResponse 훅: 401 갱신 실패 후 호출됨', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(true);
      const refreshTokenFn = vi.fn().mockRejectedValue(new Error('refresh failed'));
      const onErrorResponse = vi.fn();

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        onUnauthorized: vi.fn(),
        onErrorResponse,
        retryConfig: { maxRetries: 1, retryDelay: 0 },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      const error = makeAxiosError(401);
      await expect(responseErrorHandler(error)).rejects.toBeDefined();

      expect(onErrorResponse).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3.5 Hidden Behaviors
  // ─────────────────────────────────────────────────────────────────────────

  describe('3.5 Hidden Behaviors', () => {
    it('isTokenExpired 미설정 시 요청 인터셉터에서 silent refresh 미발생', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(false);
      const refreshTokenFn = vi.fn().mockResolvedValue('new-token');

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'token',
        refreshTokenFn,
        retryConfig: {}, // isTokenExpired 없음
      });

      interceptors(mockAxiosInstance as any);
      const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);

      await requestSuccessHandler({
        method: 'get',
        url: '/data',
        headers: {},
        baseURL: 'https://api.example.com',
      });

      expect(refreshTokenFn).not.toHaveBeenCalled();
    });

    it('401 외 에러 (403): Authorization 헤더 수정 없음, 갱신 미발생', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(true);
      const refreshTokenFn = vi.fn();

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        retryConfig: { maxRetries: 1, retryDelay: 0 },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      const error403 = makeAxiosError(403);
      const originalAuth = error403.config!.headers['Authorization'];

      await expect(responseErrorHandler(error403)).rejects.toBeDefined();

      expect(refreshTokenFn).not.toHaveBeenCalled();
      expect(mockAxiosRequest).not.toHaveBeenCalled();
      // 헤더 변경 없음
      expect(error403.config!.headers['Authorization']).toBe(originalAuth);
    });

    it('로깅 isolation: logOnDev는 NODE_ENV=production에서 console 미호출', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        vi.resetModules();

        const mockAxiosInstance = makeMockAxiosInstance();
        const mockIsAxiosError = vi.fn().mockReturnValue(false);
        const mockAxiosRequest = vi.fn();

        vi.doMock('axios', () => ({
          default: Object.assign(mockAxiosRequest, {
            isAxiosError: mockIsAxiosError,
            create: vi.fn().mockReturnValue(mockAxiosInstance),
          }),
          isAxiosError: mockIsAxiosError,
        }));

        const { setApiConfig } = await import('../src/config');
        const { interceptors } = await import('../src/interceptors');

        setApiConfig({ baseURL: 'https://api.example.com', getToken: () => 'token' });
        interceptors(mockAxiosInstance as any);

        const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);
        await requestSuccessHandler({
          method: 'get',
          url: '/data',
          headers: {},
          baseURL: 'https://api.example.com',
        });

        // production에서 logOnDev → console.log 미호출
        expect(consoleSpy).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalEnv;
        consoleSpy.mockRestore();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3.6 Edge Cases
  // ─────────────────────────────────────────────────────────────────────────

  describe('3.6 Edge Cases', () => {
    it('Concurrent 401 + 갱신 중 실패: 아키텍처 이슈 #2 문서화 - 큐 항목 leak', async () => {
      // 아키텍처 이슈 #2:
      // attemptTokenRefresh 실패 시 inner try/finally에서 isRefreshing=false 후
      // 에러가 outer catch-all로 잡혀 무시됨. 이때 processQueue(error)가 호출되지 않아
      // failedQueue에 대기 중인 Promise들이 영원히 pending 상태로 leak됨.
      //
      // 이 테스트는 그 동작을 검증한다:
      // - 첫 요청: catch-all로 인해 undefined resolve → onErrorResponse에서 throw
      // - 큐 대기 요청: processQueue 미호출 → 영원히 pending (race condition으로 확인)
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(true);

      let rejectRefresh!: (err: Error) => void;
      const refreshTokenFn = vi.fn().mockReturnValue(
        new Promise<string>((_, rej) => {
          rejectRefresh = rej;
        }),
      );

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        onUnauthorized: vi.fn(),
        retryConfig: { maxRetries: 1, retryDelay: 0, maxQueueSize: 50 },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      // 첫 요청: isRefreshing=true 설정 (갱신 시작)
      const firstError = makeAxiosError(401);
      const firstPromise = responseErrorHandler(firstError);

      // handleTokenRefresh는 async이지만 isRefreshing=true는 첫 await 전에 동기 설정됨
      // getApiConfig() → 분기 체크 → isRefreshing=true 까지 동기
      await Promise.resolve();

      // 큐 대기 요청 2개 (isRefreshing=true 상태에서 failedQueue에 push)
      const queuedError1 = makeAxiosError(401);
      const queuedError2 = makeAxiosError(401);
      const queuedP1 = responseErrorHandler(queuedError1);
      const queuedP2 = responseErrorHandler(queuedError2);

      // 갱신 실패 → attemptTokenRefresh throw → inner catch → outer catch-all 삼킴
      // processQueue(error) 미호출 → queuedP1/P2 영원히 pending
      rejectRefresh(new Error('network down'));

      // 첫 요청: handleTokenRefresh가 catch-all로 undefined 반환
      //          → onErrorResponse에서 throw → reject
      await expect(firstPromise).rejects.toBeDefined();

      // 큐 대기 요청들이 pending인지 race로 확인 (settled되지 않음)
      const sentinel = Symbol('timeout');
      const [raceResult1, raceResult2] = await Promise.all([
        Promise.race([
          queuedP1.then(() => 'resolved').catch(() => 'rejected'),
          Promise.resolve(sentinel),
        ]),
        Promise.race([
          queuedP2.then(() => 'resolved').catch(() => 'rejected'),
          Promise.resolve(sentinel),
        ]),
      ]);
      // sentinel이 이기면 큐 항목이 pending 상태 (아키텍처 이슈 #2 재현)
      // 'rejected'이면 이슈가 수정되어 정상적으로 reject됨
      expect([sentinel, 'rejected']).toContain(raceResult1);
      expect([sentinel, 'rejected']).toContain(raceResult2);

      expect(mockAxiosRequest).not.toHaveBeenCalled();
    }, 10000);

    it('retryDelay: fake timers로 지연 시간 정확성 검증', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const retryResponse = makeOkResponse();
      const mockAxiosRequest = vi.fn().mockResolvedValue(retryResponse);
      const mockIsAxiosError = vi.fn().mockReturnValue(true);
      // 첫 시도 실패, 두 번째 시도 성공 (재시도에서 지연 발생)
      const refreshTokenFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('first attempt fail'))
        .mockResolvedValue('delayed-token');

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      const retryDelay = 500;
      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        // maxRetries=2: attempt=0(즉시 실패) → attempt=1(retryDelay 후 성공)
        retryConfig: { maxRetries: 2, retryDelay },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      vi.useFakeTimers();

      try {
        const error = makeAxiosError(401);
        const promise = responseErrorHandler(error);

        // 첫 시도(attempt=0)는 즉시 실행되어 실패, 재시도(attempt=1)는 retryDelay 대기 중
        // 첫 시도 완료 후 두 번째 시도 직전까지 진행
        await vi.advanceTimersByTimeAsync(0);
        // retryDelay 경과 전: refreshTokenFn은 1회 호출됨(첫 시도), 두 번째는 아직
        expect(refreshTokenFn).toHaveBeenCalledTimes(1);

        // 타이머 진행 (retryDelay 경과)
        await vi.advanceTimersByTimeAsync(retryDelay + 10);

        await promise;
        expect(refreshTokenFn).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('연속 401 (갱신 후 다시 401): 두 번째 401에서 재갱신 시도', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockIsAxiosError = vi.fn().mockReturnValue(true);
      let callCount = 0;
      const refreshTokenFn = vi.fn().mockImplementation(async () => {
        callCount++;
        return `token-${callCount}`;
      });

      // 갱신 후 재시도 응답은 다시 401
      const mockAxiosRequest = vi.fn().mockResolvedValue(makeOkResponse());

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        retryConfig: { maxRetries: 1, retryDelay: 0 },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      // 첫 번째 401
      const error1 = makeAxiosError(401);
      await responseErrorHandler(error1);
      expect(refreshTokenFn).toHaveBeenCalledTimes(1);

      // 두 번째 401 (상태 초기화 후)
      const error2 = makeAxiosError(401);
      await responseErrorHandler(error2);
      expect(refreshTokenFn).toHaveBeenCalledTimes(2);
    });

    it('getToken/refreshTokenFn 미설정: 요청 진행되고 Authorization 헤더 없음', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(false);

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        // getToken, refreshTokenFn 없음
      });

      interceptors(mockAxiosInstance as any);
      const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);

      const config = {
        method: 'get',
        url: '/data',
        headers: {},
        baseURL: 'https://api.example.com',
      };
      const result = await requestSuccessHandler(config);

      expect(result).toBeDefined();
      expect(result.headers['Authorization']).toBeUndefined();
    });

    it('axios instance 재사용: interceptors 두 번 등록 시 핸들러 2회 등록됨', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const mockAxiosRequest = vi.fn();
      const mockIsAxiosError = vi.fn().mockReturnValue(false);

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({ baseURL: 'https://api.example.com' });

      interceptors(mockAxiosInstance as any);
      interceptors(mockAxiosInstance as any);

      // 인터셉터가 2회 등록됨 (설계상 주의 필요)
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(2);
    });

    it('빈 failedQueue 상태: processQueue 호출 시 에러 없음', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const retryResponse = makeOkResponse();
      const mockAxiosRequest = vi.fn().mockResolvedValue(retryResponse);
      const mockIsAxiosError = vi.fn().mockReturnValue(true);
      const refreshTokenFn = vi.fn().mockResolvedValue('token');

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        retryConfig: { maxRetries: 1, retryDelay: 0 },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      // 큐가 비어있는 상태에서 단일 401: processQueue([]) 호출 → 에러 없어야 함
      const error = makeAxiosError(401);
      await expect(responseErrorHandler(error)).resolves.toEqual(retryResponse);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3.7 Config Variations
  // ─────────────────────────────────────────────────────────────────────────

  describe('3.7 Config Variations', () => {
    it('maxRetries: 1 vs 3 차이 - 재시도 횟수 정확성', async () => {
      // maxRetries=1 케이스
      {
        vi.resetModules();

        const mockAxiosInstance = makeMockAxiosInstance();
        const mockAxiosRequest = vi.fn();
        const mockIsAxiosError = vi.fn().mockReturnValue(true);
        const refreshFn1 = vi.fn().mockRejectedValue(new Error('fail'));

        vi.doMock('axios', () => ({
          default: Object.assign(mockAxiosRequest, {
            isAxiosError: mockIsAxiosError,
            create: vi.fn().mockReturnValue(mockAxiosInstance),
          }),
          isAxiosError: mockIsAxiosError,
        }));

        const { setApiConfig } = await import('../src/config');
        const { interceptors } = await import('../src/interceptors');

        setApiConfig({
          baseURL: 'https://api.example.com',
          refreshTokenFn: refreshFn1,
          onUnauthorized: vi.fn(),
          retryConfig: { maxRetries: 1, retryDelay: 0 },
        });

        interceptors(mockAxiosInstance as any);
        const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

        await expect(responseErrorHandler(makeAxiosError(401))).rejects.toBeDefined();
        // maxRetries=1이므로 1회 시도
        expect(refreshFn1).toHaveBeenCalledTimes(1);
      }

      vi.resetModules();

      // maxRetries=3 케이스
      {
        const mockAxiosInstance2 = makeMockAxiosInstance();
        const mockAxiosRequest2 = vi.fn();
        const mockIsAxiosError2 = vi.fn().mockReturnValue(true);
        const refreshFn3 = vi.fn().mockRejectedValue(new Error('fail'));

        vi.doMock('axios', () => ({
          default: Object.assign(mockAxiosRequest2, {
            isAxiosError: mockIsAxiosError2,
            create: vi.fn().mockReturnValue(mockAxiosInstance2),
          }),
          isAxiosError: mockIsAxiosError2,
        }));

        const { setApiConfig: setApiConfig2 } = await import('../src/config');
        const { interceptors: interceptors2 } = await import('../src/interceptors');

        setApiConfig2({
          baseURL: 'https://api.example.com',
          refreshTokenFn: refreshFn3,
          onUnauthorized: vi.fn(),
          retryConfig: { maxRetries: 3, retryDelay: 0 },
        });

        interceptors2(mockAxiosInstance2 as any);
        const { responseErrorHandler } = extractHandlers(mockAxiosInstance2);

        await expect(responseErrorHandler(makeAxiosError(401))).rejects.toBeDefined();
        // maxRetries=3이므로 3회 시도
        expect(refreshFn3).toHaveBeenCalledTimes(3);
      }
    });

    it('retryDelay: fake timers로 정확한 지연 시간 검증', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const retryResponse = makeOkResponse();
      const mockAxiosRequest = vi.fn().mockResolvedValue(retryResponse);
      const mockIsAxiosError = vi.fn().mockReturnValue(true);
      // 첫 시도 실패, 두 번째 시도 성공 (재시도에서 지연 발생)
      const refreshTokenFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('first attempt fail'))
        .mockResolvedValue('token');

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      const retryDelay = 1000;
      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        // maxRetries=2: attempt=0(즉시 실패) → attempt=1(retryDelay 후 성공)
        retryConfig: { maxRetries: 2, retryDelay },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      vi.useFakeTimers();

      try {
        const error = makeAxiosError(401);
        const promise = responseErrorHandler(error);

        // 첫 시도(attempt=0) 즉시 실행 후 재시도(attempt=1)는 retryDelay 대기 중
        await vi.advanceTimersByTimeAsync(0);
        expect(refreshTokenFn).toHaveBeenCalledTimes(1);

        // 정확히 retryDelay ms 진행 후 두 번째 시도 완료
        await vi.advanceTimersByTimeAsync(retryDelay);
        await promise;

        expect(refreshTokenFn).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('Custom shouldRetry: 401 외 상태 코드에도 갱신 트리거 가능', async () => {
      const mockAxiosInstance = makeMockAxiosInstance();
      const retryResponse = makeOkResponse();
      const mockAxiosRequest = vi.fn().mockResolvedValue(retryResponse);
      const mockIsAxiosError = vi.fn().mockReturnValue(true);
      const refreshTokenFn = vi.fn().mockResolvedValue('custom-token');

      vi.doMock('axios', () => ({
        default: Object.assign(mockAxiosRequest, {
          isAxiosError: mockIsAxiosError,
          create: vi.fn().mockReturnValue(mockAxiosInstance),
        }),
        isAxiosError: mockIsAxiosError,
      }));

      const { setApiConfig } = await import('../src/config');
      const { interceptors } = await import('../src/interceptors');

      // 403도 갱신 트리거하는 커스텀 shouldRetry
      const shouldRetry = vi
        .fn()
        .mockImplementation(
          (error: MockAxiosError) =>
            error.response?.status === 401 || error.response?.status === 403,
        );

      setApiConfig({
        baseURL: 'https://api.example.com',
        refreshTokenFn,
        retryConfig: { maxRetries: 1, retryDelay: 0, shouldRetry },
      });

      interceptors(mockAxiosInstance as any);
      const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

      // 403 에러로 갱신 트리거
      const error403 = makeAxiosError(403);
      const result = await responseErrorHandler(error403);

      expect(shouldRetry).toHaveBeenCalledWith(error403);
      expect(refreshTokenFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual(retryResponse);
    });
  });
});
