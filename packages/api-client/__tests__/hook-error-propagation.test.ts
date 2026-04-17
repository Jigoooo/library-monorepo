/**
 * 사용자 훅(onRequest/onErrorRequest/onResponse/onErrorResponse) 내부에서
 * 발생한 에러가 인터셉터 밖으로 정상 전파되는지 검증합니다.
 *
 * 기존 구현은 `try { ... } catch { /* 훅 미설정 무시 *\/ }` 패턴으로
 * 훅 내부 throw까지 삼켰음. isApiConfigured() 체크로 변경되어 전파되도록 수정됨.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  message: string;
  name: string;
}

const makeMockAxiosInstance = () => ({
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
});

const extractHandlers = (mockInstance: ReturnType<typeof makeMockAxiosInstance>) => ({
  requestSuccessHandler: mockInstance.interceptors.request.use.mock.calls[0]?.[0],
  requestErrorHandler: mockInstance.interceptors.request.use.mock.calls[0]?.[1],
  responseSuccessHandler: mockInstance.interceptors.response.use.mock.calls[0]?.[0],
  responseErrorHandler: mockInstance.interceptors.response.use.mock.calls[0]?.[1],
});

const makeAxiosError = (status: number): MockAxiosError => ({
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
});

describe('사용자 훅 에러 전파', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('onRequest 훅이 throw하면 requestSuccessHandler도 reject한다', async () => {
    const mockAxiosInstance = makeMockAxiosInstance();
    const mockAxiosRequest = vi.fn();
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

    const hookError = new Error('onRequest hook failed');
    setApiConfig({
      baseURL: 'https://api.example.com',
      onRequest: () => {
        throw hookError;
      },
    });

    interceptors(mockAxiosInstance as any);
    const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);

    await expect(
      requestSuccessHandler({
        method: 'get',
        url: '/test',
        headers: {},
      }),
    ).rejects.toThrow('onRequest hook failed');
  });

  it('onErrorRequest 훅이 throw하면 원 에러가 아닌 훅 에러로 reject된다', async () => {
    const mockAxiosInstance = makeMockAxiosInstance();
    const mockAxiosRequest = vi.fn();
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
      onErrorRequest: () => {
        throw new Error('onErrorRequest hook failed');
      },
    });

    interceptors(mockAxiosInstance as any);
    const { requestErrorHandler } = extractHandlers(mockAxiosInstance);

    const originalError = new Error('original request error');
    await expect(requestErrorHandler(originalError)).rejects.toThrow('onErrorRequest hook failed');
  });

  it('onResponse 훅이 throw하면 responseSuccessHandler도 reject한다', async () => {
    const mockAxiosInstance = makeMockAxiosInstance();
    const mockAxiosRequest = vi.fn();
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
      onResponse: () => {
        throw new Error('onResponse hook failed');
      },
    });

    interceptors(mockAxiosInstance as any);
    const { responseSuccessHandler } = extractHandlers(mockAxiosInstance);

    await expect(
      responseSuccessHandler({ data: {}, status: 200, config: { method: 'get', url: '/x' } }),
    ).rejects.toThrow('onResponse hook failed');
  });

  it('onErrorResponse 훅이 throw하면 해당 에러가 전파된다 (401 아님)', async () => {
    const mockAxiosInstance = makeMockAxiosInstance();
    const mockAxiosRequest = vi.fn();
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
      onErrorResponse: () => {
        throw new Error('onErrorResponse hook failed');
      },
    });

    interceptors(mockAxiosInstance as any);
    const { responseErrorHandler } = extractHandlers(mockAxiosInstance);

    // 500 에러 → 401 재시도 경로 안 탐 → 훅 실행
    await expect(responseErrorHandler(makeAxiosError(500))).rejects.toThrow(
      'onErrorResponse hook failed',
    );
  });

  it('훅이 throw하지 않으면 기존 흐름 유지 (요청 통과)', async () => {
    const mockAxiosInstance = makeMockAxiosInstance();
    const mockAxiosRequest = vi.fn();
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

    const onRequest = vi.fn((c) => c);
    setApiConfig({
      baseURL: 'https://api.example.com',
      onRequest,
    });

    interceptors(mockAxiosInstance as any);
    const { requestSuccessHandler } = extractHandlers(mockAxiosInstance);

    const config = { method: 'get', url: '/ok', headers: {} };
    const result = await requestSuccessHandler(config);

    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(result.url).toBe('/ok');
  });
});
