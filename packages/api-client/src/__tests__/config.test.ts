import { describe, it, expect, beforeEach } from 'vitest';

import { setApiConfig, getApiConfig, isApiConfigured, type ApiConfig } from '../config';

describe('config', () => {
  beforeEach(() => {
    // 각 테스트 전에 설정 초기화
    setApiConfig(null as any);
  });

  describe('setApiConfig', () => {
    it('기본 설정을 저장할 수 있음', () => {
      const config: ApiConfig = {
        baseURL: 'https://api.example.com',
      };

      setApiConfig(config);

      expect(getApiConfig()).toEqual(config);
    });

    it('토큰 관련 설정을 포함할 수 있음', () => {
      const config: ApiConfig = {
        baseURL: 'https://api.example.com',
        getToken: () => 'token123',
        refreshTokenFn: async () => 'newToken',
        onUnauthorized: () => {
          console.log('unauthorized');
        },
      };

      setApiConfig(config);

      expect(getApiConfig().getToken?.()).toBe('token123');
    });

    it('재시도 설정을 포함할 수 있음', () => {
      const config: ApiConfig = {
        baseURL: 'https://api.example.com',
        retryConfig: {
          maxRetries: 3,
          retryDelay: 1000,
        },
      };

      setApiConfig(config);

      const savedConfig = getApiConfig();
      expect(savedConfig.retryConfig?.maxRetries).toBe(3);
      expect(savedConfig.retryConfig?.retryDelay).toBe(1000);
    });

    it('훅 함수들을 저장할 수 있음', () => {
      const onRequest = (config: any) => config;
      const onResponse = (response: any) => response;
      const onErrorRequest = (error: any) => error;
      const onErrorResponse = (error: any) => error;

      const config: ApiConfig = {
        baseURL: 'https://api.example.com',
        onRequest,
        onResponse,
        onErrorRequest,
        onErrorResponse,
      };

      setApiConfig(config);

      const savedConfig = getApiConfig();
      expect(savedConfig.onRequest).toBe(onRequest);
      expect(savedConfig.onResponse).toBe(onResponse);
      expect(savedConfig.onErrorRequest).toBe(onErrorRequest);
      expect(savedConfig.onErrorResponse).toBe(onErrorResponse);
    });
  });

  describe('getApiConfig', () => {
    it('설정이 없을 때 에러 발생', () => {
      expect(() => getApiConfig()).toThrow('@jigoooo/api-client: initApi()를 먼저 호출하세요.');
    });

    it('설정된 값을 반환', () => {
      const testConfig: ApiConfig = {
        baseURL: 'https://test.api.com',
        transformResponse: 'camelCase',
      };

      setApiConfig(testConfig);

      const config = getApiConfig();
      expect(config.baseURL).toBe('https://test.api.com');
      expect(config.transformResponse).toBe('camelCase');
    });
  });

  describe('isApiConfigured', () => {
    it('설정되지 않았을 때 false 반환', () => {
      // 초기 상태
      setApiConfig(null as any);
      expect(isApiConfigured()).toBe(false);
    });

    it('설정되었을 때 true 반환', () => {
      const config: ApiConfig = {
        baseURL: 'https://api.example.com',
      };

      setApiConfig(config);
      expect(isApiConfigured()).toBe(true);
    });
  });
});
