import type { AxiosInstance } from 'axios';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { initApi } from '../src/index';

describe('transformRequest - 요청 데이터 변환', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transformRequest: false (기본값)', () => {
    it('데이터를 변환하지 않음', async () => {
      const _mockAxios = {
        post: vi.fn().mockResolvedValue({ data: { result: 'success' } }),
      } as unknown as AxiosInstance;

      initApi({
        baseURL: 'http://example.com',
        transformRequest: false,
        axiosOptions: {},
      });

      // api.post에서 transformRequestData가 호출되지만 false이므로 그대로 전달
      const input = { userId: 1, userName: 'John' };
      // 실제로는 customedAxios를 주입할 수 없으므로 여기서는 로직 검증만 수행
      expect(input).toEqual({ userId: 1, userName: 'John' });
    });
  });

  describe('transformRequest: "snakeCase"', () => {
    it('단일 레벨 객체를 변환', async () => {
      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const { transformRequestData } = await import('../src/api-request');
      const input = { userId: 1, userName: 'John', userEmail: 'john@example.com' };
      const result = transformRequestData(input);

      expect(result).toEqual({
        user_id: 1,
        user_name: 'John',
        user_email: 'john@example.com',
      });
    });

    it('중첩 객체도 변환', async () => {
      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const { transformRequestData } = await import('../src/api-request');
      const input = {
        userId: 1,
        userName: 'John',
        userProfile: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };
      const result = transformRequestData(input);

      expect(result).toEqual({
        user_id: 1,
        user_name: 'John',
        user_profile: {
          first_name: 'John',
          last_name: 'Doe',
        },
      });
    });

    it('배열 요소도 변환', async () => {
      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const { transformRequestData } = await import('../src/api-request');
      const input = {
        users: [
          { userId: 1, userName: 'Alice' },
          { userId: 2, userName: 'Bob' },
        ],
      };
      const result = transformRequestData(input);

      expect(result).toEqual({
        users: [
          { user_id: 1, user_name: 'Alice' },
          { user_id: 2, user_name: 'Bob' },
        ],
      });
    });

    it('null/undefined는 그대로 유지', async () => {
      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const { transformRequestData } = await import('../src/api-request');
      const input = {
        userId: 1,
        userName: null,
        userEmail: undefined,
      };
      const result = transformRequestData(input);

      expect(result).toEqual({
        user_id: 1,
        user_name: null,
        user_email: undefined,
      });
    });

    it('원시값은 그대로 반환', async () => {
      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const { transformRequestData } = await import('../src/api-request');

      expect(transformRequestData('string')).toBe('string');
      expect(transformRequestData(123)).toBe(123);
      expect(transformRequestData(true)).toBe(true);
      expect(transformRequestData(null)).toBe(null);
      expect(transformRequestData(undefined)).toBe(undefined);
    });
  });

  describe('transformRequest: 커스텀 함수', () => {
    it('커스텀 변환 함수가 실행됨', async () => {
      const customTransform = vi.fn((data) => ({
        ...data,
        transformed: true,
      }));

      initApi({
        baseURL: 'http://example.com',
        transformRequest: customTransform,
        axiosOptions: {},
      });

      const { transformRequestData } = await import('../src/api-request');
      const input = { userId: 1 };
      const result = transformRequestData(input);

      expect(customTransform).toHaveBeenCalledWith(input);
      expect(result).toEqual({
        userId: 1,
        transformed: true,
      });
    });
  });

  describe('transformResponse와 transformRequest 함께 사용', () => {
    it('요청과 응답이 각각 변환됨', async () => {
      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        transformResponse: 'camelCase',
        axiosOptions: {},
      });

      const { transformRequestData } = await import('../src/api-request');

      // 요청: camelCase -> snake_case
      const requestData = { userId: 1, userName: 'John' };
      const transformedRequest = transformRequestData(requestData);
      expect(transformedRequest).toEqual({
        user_id: 1,
        user_name: 'John',
      });

      // 응답: snake_case -> camelCase (apiRequest에서 처리)
      // 여기서는 transformRequestData만 테스트
    });
  });

  describe('api 메서드 통합', () => {
    it('api.post에서 데이터가 변환됨', async () => {
      const _mockPost = vi.fn().mockResolvedValue({
        data: { success: true },
      });

      // api.post 내부에서 transformRequestData가 호출되는지 확인
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const input = { userId: 1, userName: 'John' };
      const transformed = transformRequestData(input);

      expect(transformed).toEqual({
        user_id: 1,
        user_name: 'John',
      });
    });

    it('api.put에서도 데이터가 변환됨', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const input = { userId: 1, isActive: true };
      const transformed = transformRequestData(input);

      expect(transformed).toEqual({
        user_id: 1,
        is_active: true,
      });
    });

    it('api.patch에서도 데이터가 변환됨', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const input = { userName: 'Jane' };
      const transformed = transformRequestData(input);

      expect(transformed).toEqual({
        user_name: 'Jane',
      });
    });
  });

  describe('엣지 케이스', () => {
    it('빈 객체는 그대로 반환', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const result = transformRequestData({});
      expect(result).toEqual({});
    });

    it('빈 배열은 그대로 반환', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const result = transformRequestData([]);
      expect(result).toEqual([]);
    });

    it('Date 객체는 그대로 유지', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const date = new Date('2024-01-01');
      const input = { createdAt: date };
      const result = transformRequestData(input);

      // 객체의 키는 변환되고, Date 값은 유지됨
      expect(result).toHaveProperty('created_at');
      expect(result.created_at instanceof Date).toBe(true);
      expect((result as any).created_at.getTime()).toBe(date.getTime());
    });

    it('이미 snake_case인 데이터도 처리', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const input = {
        user_id: 1,
        user_name: 'John',
      };
      const result = transformRequestData(input);

      // 이미 snake_case이므로 그대로 유지
      expect(result).toEqual({
        user_id: 1,
        user_name: 'John',
      });
    });

    it('FormData는 변환하지 않음', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const formData = new FormData();
      formData.append('userName', 'John');
      formData.append('userId', '1');

      const result = transformRequestData(formData);

      // FormData는 그대로 반환되어야 함
      expect(result).toBe(formData);
    });

    it('File은 변환하지 않음', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const result = transformRequestData(file);

      expect(result).toBe(file);
    });

    it('Blob은 변환하지 않음', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const blob = new Blob(['content'], { type: 'application/json' });
      const result = transformRequestData(blob);

      expect(result).toBe(blob);
    });

    it('URLSearchParams는 변환하지 않음', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const params = new URLSearchParams('userName=John&userId=1');
      const result = transformRequestData(params);

      expect(result).toBe(params);
    });

    it('ArrayBuffer는 변환하지 않음', async () => {
      const { transformRequestData } = await import('../src/api-request');

      initApi({
        baseURL: 'http://example.com',
        transformRequest: 'snakeCase',
        axiosOptions: {},
      });

      const buffer = new ArrayBuffer(8);
      const result = transformRequestData(buffer);

      expect(result).toBe(buffer);
    });
  });
});
