import { describe, it, expect, beforeEach } from 'vitest';

import { apiRequest } from '../api-request';
import { setApiConfig, type ApiConfig } from '../config';

describe('apiRequest', () => {
  beforeEach(() => {
    // 각 테스트 전에 기본 설정 적용
    setApiConfig({
      baseURL: 'https://api.example.com',
    } as ApiConfig);
  });

  it('응답 데이터를 반환 (transformResponse 미설정)', async () => {
    const mockResponse = {
      data: { user_name: 'John', user_email: 'john@example.com' },
      status: 200,
    };

    const promise = Promise.resolve(mockResponse);
    const result = await apiRequest(promise);

    expect(result).toEqual({
      user_name: 'John',
      user_email: 'john@example.com',
    });
  });

  it('transformResponse가 camelCase일 때 snake_case를 변환', async () => {
    setApiConfig({
      baseURL: 'https://api.example.com',
      transformResponse: 'camelCase',
    } as ApiConfig);

    const mockResponse = {
      data: {
        user_profile: {
          first_name: 'Alice',
          last_name: 'Smith',
        },
      },
    };

    const result = await apiRequest(Promise.resolve(mockResponse));

    expect(result).toEqual({
      userProfile: {
        firstName: 'Alice',
        lastName: 'Smith',
      },
    });
  });

  it('transformResponse가 함수일 때 커스텀 변환 적용', async () => {
    const customTransform = (data: any) => ({
      ...data,
      transformed: true,
    });

    setApiConfig({
      baseURL: 'https://api.example.com',
      transformResponse: customTransform,
    } as ApiConfig);

    const mockResponse = {
      data: { user_name: 'Bob' },
    };

    const result = await apiRequest(Promise.resolve(mockResponse));

    expect(result).toEqual({
      user_name: 'Bob',
      transformed: true,
    });
  });

  it('transformResponse가 false일 때 원본 데이터 반환', async () => {
    setApiConfig({
      baseURL: 'https://api.example.com',
      transformResponse: false,
    } as ApiConfig);

    const mockResponse = {
      data: { user_name: 'Charlie' },
    };

    const result = await apiRequest(Promise.resolve(mockResponse));

    expect(result).toEqual({
      user_name: 'Charlie',
    });
  });

  it('빈 응답 데이터 처리', async () => {
    const mockResponse = {
      data: {},
    };

    const result = await apiRequest(Promise.resolve(mockResponse));

    expect(result).toEqual({});
  });

  it('배열 응답 처리', async () => {
    setApiConfig({
      baseURL: 'https://api.example.com',
      transformResponse: 'camelCase',
    } as ApiConfig);

    const mockResponse = {
      data: [
        { user_id: 1, user_name: 'Alice' },
        { user_id: 2, user_name: 'Bob' },
      ],
    };

    const result = await apiRequest(Promise.resolve(mockResponse));

    expect(result).toEqual([
      { userId: 1, userName: 'Alice' },
      { userId: 2, userName: 'Bob' },
    ]);
  });

  it('null 데이터 처리', async () => {
    const mockResponse = {
      data: null,
    };

    const result = await apiRequest(Promise.resolve(mockResponse));

    expect(result).toBeNull();
  });

  it('Promise 거부 시 에러 전파', async () => {
    const error = new Error('Network error');
    const promise = Promise.reject(error);

    await expect(apiRequest(promise)).rejects.toThrow('Network error');
  });
});
