import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from '../api-request';
import { setApiConfig, getApiConfig } from '../config';

describe('transformResponse 응답 데이터 변환', () => {
  beforeEach(() => {
    // 각 테스트마다 ApiConfig 초기화
    setApiConfig({
      baseURL: 'https://api.example.com',
      getToken: () => 'test-token',
    });
  });

  describe('transformResponse: "camelCase"', () => {
    beforeEach(() => {
      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'test-token',
        transformResponse: 'camelCase',
      });
    });

    it('snake_case 객체를 camelCase로 변환', async () => {
      const mockResponse = {
        data: {
          user_id: 1,
          user_name: 'John',
          user_email: 'john@example.com',
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest);

      expect(result).toEqual({
        userId: 1,
        userName: 'John',
        userEmail: 'john@example.com',
      });
    });

    it('중첩된 객체도 변환', async () => {
      const mockResponse = {
        data: {
          user_id: 1,
          user_profile: {
            first_name: 'John',
            last_name: 'Doe',
          },
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest);

      expect(result).toEqual({
        userId: 1,
        userProfile: {
          firstName: 'John',
          lastName: 'Doe',
        },
      });
    });

    it('배열 요소도 변환', async () => {
      const mockResponse = {
        data: [
          { user_id: 1, user_name: 'Alice' },
          { user_id: 2, user_name: 'Bob' },
        ],
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest);

      expect(result).toEqual([
        { userId: 1, userName: 'Alice' },
        { userId: 2, userName: 'Bob' },
      ]);
    });

    it('Date 객체는 변환하지 않음', async () => {
      const date = new Date('2024-01-01');
      const mockResponse = {
        data: {
          user_id: 1,
          created_at: date,
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest) as any;

      expect(result.userId).toBe(1);
      expect(result.createdAt).toEqual(date);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('Map 객체는 변환하지 않음', async () => {
      const map = new Map([['key1', 'value1']]);
      const mockResponse = {
        data: {
          user_id: 1,
          data_map: map,
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest) as any;

      expect(result.userId).toBe(1);
      expect(result.dataMap).toEqual(map);
      expect(result.dataMap).toBeInstanceOf(Map);
    });

    it('Set 객체는 변환하지 않음', async () => {
      const set = new Set(['a', 'b', 'c']);
      const mockResponse = {
        data: {
          user_id: 1,
          tags_set: set,
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest) as any;

      expect(result.userId).toBe(1);
      expect(result.tagsSet).toEqual(set);
      expect(result.tagsSet).toBeInstanceOf(Set);
    });

    it('RegExp 객체는 변환하지 않음', async () => {
      const regex = /test/gi;
      const mockResponse = {
        data: {
          user_id: 1,
          pattern: regex,
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest) as any;

      expect(result.userId).toBe(1);
      expect(result.pattern).toEqual(regex);
      expect(result.pattern).toBeInstanceOf(RegExp);
    });

    it('Error 객체는 변환하지 않음', async () => {
      const error = new Error('test error');
      const mockResponse = {
        data: {
          user_id: 1,
          error_obj: error,
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest) as any;

      expect(result.userId).toBe(1);
      expect(result.errorObj).toEqual(error);
      expect(result.errorObj).toBeInstanceOf(Error);
    });

    it('원시값 (string, number, boolean)은 그대로 유지', async () => {
      const mockResponse = {
        data: {
          user_id: 1,
          user_name: 'John',
          is_active: true,
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest) as any;

      expect(result.userId).toBe(1);
      expect(typeof result.userName).toBe('string');
      expect(typeof result.isActive).toBe('boolean');
    });

    it('null/undefined는 그대로 유지', async () => {
      const mockResponse = {
        data: {
          user_id: 1,
          optional_field: null,
          undefined_field: undefined,
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest) as any;

      expect(result.userId).toBe(1);
      expect(result.optionalField).toBeNull();
      expect(result.undefinedField).toBeUndefined();
    });
  });

  describe('transformResponse: 커스텀 함수', () => {
    it('커스텀 함수로 응답 데이터 변환', async () => {
      const customTransform = vi.fn((data) => ({
        ...data,
        transformed: true,
      }));

      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'test-token',
        transformResponse: customTransform,
      });

      const mockResponse = {
        data: {
          user_id: 1,
          user_name: 'John',
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest);

      expect(customTransform).toHaveBeenCalledWith(mockResponse.data);
      expect(result).toEqual({
        user_id: 1,
        user_name: 'John',
        transformed: true,
      });
    });
  });

  describe('transformResponse: false/undefined (변환 없음)', () => {
    it('transformResponse가 false이면 원본 반환', async () => {
      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'test-token',
        transformResponse: false,
      });

      const mockResponse = {
        data: {
          user_id: 1,
          user_name: 'John',
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest);

      expect(result).toEqual({
        user_id: 1,
        user_name: 'John',
      });
    });

    it('transformResponse가 undefined이면 원본 반환', async () => {
      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'test-token',
        // transformResponse를 설정하지 않음
      });

      const mockResponse = {
        data: {
          user_id: 1,
          user_name: 'John',
        },
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest);

      expect(result).toEqual({
        user_id: 1,
        user_name: 'John',
      });
    });
  });

  describe('응답 데이터가 특수 타입인 경우', () => {
    beforeEach(() => {
      setApiConfig({
        baseURL: 'https://api.example.com',
        getToken: () => 'test-token',
        transformResponse: 'camelCase',
      });
    });

    it('응답 데이터 자체가 null이면 그대로 반환', async () => {
      const mockResponse = {
        data: null,
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest);

      expect(result).toBeNull();
    });

    it('응답 데이터가 문자열이면 그대로 반환', async () => {
      const mockResponse = {
        data: 'response string',
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest);

      expect(result).toBe('response string');
    });

    it('응답 데이터가 숫자면 그대로 반환', async () => {
      const mockResponse = {
        data: 123,
      };
      const mockRequest = Promise.resolve(mockResponse);

      const result = await apiRequest(mockRequest);

      expect(result).toBe(123);
    });
  });
});
