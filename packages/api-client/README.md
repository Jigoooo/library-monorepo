# @jigoooo/api-client

Axios 기반의 완전한 API 클라이언트 라이브러리입니다. JWT 토큰 자동 갱신, 요청/응답 인터셉팅, camelCase 자동 변환 등의 기능을 제공합니다.

## 설치

```bash
npm install @jigoooo/api-client axios qs
# 또는
pnpm add @jigoooo/api-client axios qs
```

## 사용법

### 1. 초기화

앱 시작 시 `initApi`를 호출하여 설정합니다:

```typescript
import { initApi } from '@jigoooo/api-client';

initApi({
  baseURL: 'https://api.example.com',
  getToken: () => localStorage.getItem('accessToken'),
  refreshTokenFn: async () => {
    const response = await fetch('/api/auth/refresh', { method: 'POST' });
    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    return data.accessToken;
  },
  onUnauthorized: () => {
    window.location.href = '/login';
  },
  transformResponse: 'camelCase', // snake_case → camelCase 자동 변환
});
```

### 2. API 호출

```typescript
import { api } from '@jigoooo/api-client';

// GET
const users = await api.get('/users');

// POST
const newUser = await api.post('/users', { name: 'John', email: 'john@example.com' });

// PUT
const updated = await api.put('/users/1', { name: 'Jane' });

// PATCH
const patched = await api.patch('/users/1', { email: 'jane@example.com' });

// DELETE
await api.delete('/users/1');
```

### 3. 고급 설정

```typescript
initApi({
  baseURL: 'https://api.example.com',
  getToken: () => localStorage.getItem('accessToken'),
  refreshTokenFn: async () => {
    /* ... */
  },

  // 재시도 설정
  retryConfig: {
    maxRetries: 2,
    retryDelay: 1000,
    maxQueueSize: 50,
    isTokenExpired: () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return false;

      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    },
  },

  // 훅 함수들
  onRequest: (config) => {
    console.log('Request:', config);
    return config;
  },
  onResponse: (response) => {
    console.log('Response:', response);
    return response;
  },
  onErrorRequest: (error) => {
    console.error('Request error:', error);
  },
  onErrorResponse: (error) => {
    console.error('Response error:', error);
  },

  // 커스텀 transformResponse
  transformResponse: (data) => {
    // 커스텀 변환 로직
    return data;
  },
});
```

## ApiConfig 옵션 전체

| 옵션                | 타입                                        | 필수 | 설명                                                            |
| ------------------- | ------------------------------------------- | ---- | --------------------------------------------------------------- |
| `baseURL`           | `string`                                    | ✓    | API 기본 URL                                                    |
| `getToken`          | `() => string \| null`                      |      | 요청마다 호출되는 토큰 getter                                   |
| `refreshTokenFn`    | `() => Promise<string>`                     |      | 401 발생 시 호출되는 토큰 갱신 함수                             |
| `onUnauthorized`    | `() => void`                                |      | 토큰 갱신 실패 시 호출되는 콜백 (기본: `/login`으로 리다이렉트) |
| `retryConfig`       | `RetryConfig`                               |      | 재시도 설정 객체                                                |
| `transformResponse` | `false \| 'camelCase' \| (data) => unknown` |      | 응답 데이터 전처리 방식                                         |
| `onRequest`         | `(config) => config`                        |      | 요청 전 실행되는 훅                                             |
| `onResponse`        | `(response) => response`                    |      | 응답 후 실행되는 훅                                             |
| `onErrorRequest`    | `(error) => void`                           |      | 요청 에러 시 실행되는 훅                                        |
| `onErrorResponse`   | `(error) => void`                           |      | 응답 에러 시 실행되는 훅                                        |
| `axiosOptions`      | `AxiosRequestConfig`                        |      | axios 추가 옵션                                                 |

## 토큰 자동 갱신

라이브러리는 401 응답을 자동으로 감지하여 다음 흐름을 실행합니다:

1. `refreshTokenFn` 호출 → 새 토큰 획득
2. 원래 요청에 새 토큰 적용
3. 원래 요청 재전송

동시에 여러 401이 발생한 경우, 첫 요청만 토큰 갱신을 수행하고 나머지 요청들은 대기열에 저장되어 새 토큰이 획득된 후 재전송됩니다.

## camelCase 변환

`transformResponse: 'camelCase'`를 설정하면 응답의 snake_case를 camelCase로 자동 변환합니다:

```typescript
initApi({
  baseURL: 'https://api.example.com',
  transformResponse: 'camelCase',
  // ...
});

// API 응답: { user_name: 'John', user_email: 'john@example.com' }
const user = await api.get('/users/1');
// user는 자동으로: { userName: 'John', userEmail: 'john@example.com' }
```

## 기타 내보내기

```typescript
// axios 인스턴스 직접 접근 (권장하지 않음)
import { customedAxios } from '@jigoooo/api-client';
customedAxios.get('/users'); // api.get()과 동일

// apiRequest 유틸리티
import { apiRequest } from '@jigoooo/api-client';
const data = await apiRequest(customedAxios.get('/users'));

// 타입 정의
import type { ApiConfig } from '@jigoooo/api-client';
```

## 라이선스

MIT
