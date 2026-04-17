# @jigoooo/api-client

Axios 기반의 완전한 API 클라이언트 라이브러리입니다. JWT 토큰 자동 갱신, 요청/응답 인터셉팅, camelCase 자동 변환 등의 기능을 제공합니다.

## 설치

```bash
npm install @jigoooo/api-client axios qs
# 또는
pnpm add @jigoooo/api-client axios qs
```

## 전체 Exports

```typescript
// 함수
import { initApi } from '@jigoooo/api-client'; // API 클라이언트 초기화
import { isApiConfigured } from '@jigoooo/api-client'; // 초기화 여부 확인

// 객체
import { api } from '@jigoooo/api-client'; // HTTP 메서드 인터페이스

// 타입
import type { ApiConfig } from '@jigoooo/api-client'; // initApi() 설정 타입
import type { ApiInstance } from '@jigoooo/api-client'; // api 객체 타입
import type { RetryConfig } from '@jigoooo/api-client'; // 재시도 설정 타입
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
    window.location.href = '/';
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

| 옵션                | 타입                                        | 필수 | 기본값    | 설명                                                              |
| ------------------- | ------------------------------------------- | ---- | --------- | ----------------------------------------------------------------- |
| `baseURL`           | `string`                                    | ✓    | -         | API 기본 URL                                                      |
| `getToken`          | `() => string \| null \| undefined`         |      | -         | 요청마다 호출되는 토큰 getter. 반환값이 있으면 Bearer 헤더 주입   |
| `refreshTokenFn`    | `() => Promise<string>`                     |      | -         | 401 발생 시 호출되는 토큰 갱신 함수. 새 토큰을 반환해야 함        |
| `onUnauthorized`    | `() => void`                                |      | -         | 토큰 갱신 실패 시 호출되는 콜백. 미설정 시 아무 동작도 없음       |
| `retryConfig`       | `RetryConfig`                               |      | 아래 참고 | 재시도 설정 객체                                                  |
| `transformRequest`  | `false \| 'snakeCase' \| (data) => unknown` |      | `false`   | request body + query params 전처리 (아래 "요청 데이터 변환" 참고) |
| `transformResponse` | `false \| 'camelCase' \| (data) => unknown` |      | `false`   | 응답 데이터 전처리 방식 (snake_case → camelCase 변환 등)          |
| `shouldSkipAuth`    | `(config) => boolean`                       |      | -         | true 반환 시 Authorization 헤더 주입 생략 (로그인/회원가입 등)    |
| `onRequest`         | `(config) => InternalAxiosRequestConfig`    |      | -         | 토큰 주입 이후 실행되는 요청 훅. config 수정 가능                 |
| `onResponse`        | `(response) => AxiosResponse`               |      | -         | 응답 후 실행되는 훅. response 수정 가능                           |
| `onErrorRequest`    | `(error: AxiosError) => void`               |      | -         | 요청 에러 시 내장 로깅 이후 추가 처리                             |
| `onErrorResponse`   | `(error: AxiosError \| Error) => void`      |      | -         | 응답 에러 시 내장 401 처리 이후 추가 처리                         |
| `axiosOptions`      | `AxiosRequestConfig`                        |      | -         | axios.create()에 전달할 추가 옵션 (baseURL 제외)                  |

## RetryConfig 옵션

| 옵션             | 타입                             | 기본값                              | 설명                                                            |
| ---------------- | -------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| `maxRetries`     | `number`                         | `1`                                 | 토큰 갱신 재시도 최대 횟수                                      |
| `retryDelay`     | `number`                         | `0`                                 | 재시도 사이 대기 시간(ms)                                       |
| `maxQueueSize`   | `number`                         | `50`                                | 동시 401 발생 시 대기열 최대 크기. 초과 시 즉시 reject          |
| `shouldRetry`    | `(error: AxiosError) => boolean` | `(e) => e.response?.status === 401` | 재시도 실행 조건 함수. true 반환 시 refreshTokenFn 호출         |
| `isTokenExpired` | `() => boolean`                  | -                                   | 요청 전 선제적 토큰 만료 확인 함수. true 반환 시 사전 갱신 수행 |

## API 참조

### `initApi(config: ApiConfig): void`

API 클라이언트를 초기화합니다. 앱 진입점에서 가장 먼저 호출해야 합니다.

내부적으로 다음을 수행합니다.

1. `axios.create()`로 인스턴스 생성 (기본 타임아웃 2분, Content-Type: application/json)
2. 요청/응답 인터셉터 등록
3. 설정과 인스턴스를 싱글턴으로 저장

### `isApiConfigured(): boolean`

`initApi()`가 호출된 상태인지 확인합니다.

```typescript
import { isApiConfigured } from '@jigoooo/api-client';

if (!isApiConfigured()) {
  initApi({ baseURL: '...' });
}
```

### `api` 객체

모든 메서드는 `transformResponse` 처리 후의 데이터를 반환합니다.

```typescript
api.get(url: string, config?: AxiosRequestConfig): Promise<unknown>
api.post(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>
api.put(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>
api.patch(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<unknown>
api.delete(url: string, config?: AxiosRequestConfig): Promise<unknown>
```

#### 매개변수

| 매개변수 | 타입                 | 설명                                                              |
| -------- | -------------------- | ----------------------------------------------------------------- |
| `url`    | `string`             | 요청 경로 (`baseURL`에 추가됨)                                    |
| `data`   | `unknown`            | 요청 바디 (POST, PUT, PATCH)                                      |
| `config` | `AxiosRequestConfig` | 요청별 axios 옵션 (headers, params, timeout, signal 등 개별 지정) |

#### 반환 타입

모든 메서드는 `Promise<unknown>`을 반환합니다. 응답 타입이 필요하면 호출 측에서 캐스팅하세요.

```typescript
const users = (await api.get('/users')) as User[];
const user = (await api.post('/users', { name: 'John' })) as User;
```

## 타입 정의 예제

```typescript
import type { ApiConfig, ApiInstance, RetryConfig } from '@jigoooo/api-client';

// ApiConfig 타입 활용
const config: ApiConfig = {
  baseURL: 'https://api.example.com',
  getToken: () => sessionStorage.getItem('token'),
  transformResponse: 'camelCase',
};

// RetryConfig 타입 활용
const retryConfig: RetryConfig = {
  maxRetries: 3,
  retryDelay: 500,
  maxQueueSize: 100,
  shouldRetry: (error) => [401, 403].includes(error.response?.status ?? 0),
  isTokenExpired: () => {
    const exp = Number(localStorage.getItem('tokenExp'));
    return Date.now() > exp;
  },
};

// ApiInstance 타입 활용 (커스텀 wrapper 함수 작성 시)
function createApiWrapper(client: ApiInstance) {
  return {
    getUser: (id: number) => client.get(`/users/${id}`) as Promise<User>,
  };
}
```

## 고급 기능

### 인증 건너뛰기 (`shouldSkipAuth`)

로그인, 회원가입, 공개 엔드포인트 등 **Authorization 헤더가 필요 없는 요청**을 위한 훅입니다. `true`를 반환하면 해당 요청에 `getToken()` 호출과 Bearer 헤더 주입을 건너뜁니다.

```typescript
initApi({
  baseURL: 'https://api.example.com',
  getToken: () => localStorage.getItem('accessToken'),
  shouldSkipAuth: (config) => {
    const path = config.url ?? '';
    return path.startsWith('/auth/') || path === '/public';
  },
});

await api.post('/auth/login', { email, password }); // Authorization 헤더 없이 전송
await api.get('/users/me'); // Authorization: Bearer ... 주입
```

> **주의**: 선제적 토큰 갱신(`isTokenExpired`)은 `shouldSkipAuth`와 독립적으로 동작합니다. 완전히 인증 로직을 우회하고 싶다면 `isTokenExpired`도 해당 요청에서 `false`를 반환하도록 구성하세요.

### 요청 인터셉팅

`onRequest` 훅은 토큰 주입 이후에 실행됩니다. `config`를 반환해야 하며 `Promise`도 허용합니다.

이 시점의 `config.params`는 이미 `transformRequest` 규칙이 적용된 상태입니다. 원형 params가 필요하면 `api.get(url, { params })` 호출 측에서 별도 보관하세요.

```typescript
initApi({
  baseURL: 'https://api.example.com',
  onRequest: (config) => {
    // 요청 헤더에 추가 정보 주입
    config.headers['X-Request-ID'] = crypto.randomUUID();
    config.headers['X-Client-Version'] = '1.0.0';
    return config;
  },
});
```

### 응답 인터셉팅

`onResponse` 훅은 성공 응답 후에 실행됩니다.

```typescript
initApi({
  baseURL: 'https://api.example.com',
  onResponse: (response) => {
    // 서버 응답 헤더에서 새 토큰 갱신
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      localStorage.setItem('accessToken', newToken);
    }
    return response;
  },
});
```

### 401 토큰 갱신 메커니즘

라이브러리는 401 응답을 자동으로 감지하여 다음 흐름을 실행합니다:

```text
요청 → 401 응답
  ├─ isRefreshing === false (첫 번째 401)
  │    ├─ isRefreshing = true
  │    ├─ refreshTokenFn() 호출 (maxRetries 횟수만큼 재시도)
  │    ├─ 성공: 대기열의 모든 요청에 새 토큰 전달 → 재전송
  │    └─ 실패: onUnauthorized() 호출 → 대기열 전체 reject → 원 요청도 reject
  │
  └─ isRefreshing === true (동시 401 발생)
       ├─ failedQueue에 추가 (최대 maxQueueSize)
       └─ 토큰 갱신 완료 시 자동으로 재전송
```

**선제적 갱신**: `retryConfig.isTokenExpired`를 설정하면 요청 전에 토큰 만료를 미리 확인하여 갱신합니다. 401이 발생하기 전에 처리하므로 더 빠르게 동작합니다.

```typescript
initApi({
  baseURL: 'https://api.example.com',
  retryConfig: {
    isTokenExpired: () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return false;
      const { exp } = JSON.parse(atob(token.split('.')[1]));
      // 만료 30초 전부터 갱신
      return exp * 1000 - 30_000 < Date.now();
    },
  },
});
```

**동작 세부 사항**:

- **선제 갱신 실패 시**: `refreshTokenFn`이 throw하면 `onUnauthorized`가 호출되고, **원 요청은 기존 토큰으로 그대로 진행**됩니다 (이후 401을 받으면 표준 재시도 경로를 탑니다).
- **401 갱신 실패 시**: `refreshTokenFn`이 `maxRetries`만큼 모두 실패하면 `onUnauthorized` 호출 후, **원 요청과 대기열의 모든 요청이 reject**됩니다.
- **401 재시도 요청**: 갱신된 토큰으로 재전송할 때는 **전역 `axios`로 실행**되어 라이브러리의 인터셉터를 다시 타지 않습니다 (params/body 변환과 baseURL은 이미 원요청에서 적용됨).
- **`maxQueueSize` 초과**: 동시 401이 대기열 크기를 넘으면 해당 요청은 즉시 원 에러로 reject됩니다.

### 요청 데이터 변환

`transformRequest`는 **request body**와 **query params(`config.params`)** 양쪽에 동일한 규칙으로 적용됩니다.

적용 범위:

- **body**: POST / PUT / PATCH의 두 번째 인자 (`data`)
- **query params**: 모든 메서드(GET / POST / PUT / PATCH / DELETE)의 `config.params`

```typescript
initApi({
  baseURL: 'https://api.example.com',
  transformRequest: 'snakeCase', // camelCase → snake_case
});

// body 변환
await api.post('/users', { userId: 1, userName: 'John' });
// 실제 전송: { user_id: 1, user_name: 'John' }

// query params 변환
await api.get('/users', { params: { pageSize: 20, sortBy: 'createdAt' } });
// 실제 요청: GET /users?page_size=20&sort_by=created_at
```

중첩 객체와 배열도 동일하게 처리됩니다:

```typescript
// 요청 데이터
const data = {
  userId: 1,
  userProfile: {
    firstName: 'John',
    lastName: 'Doe',
  },
  userRoles: [
    { roleId: 1, roleName: 'admin' },
    { roleId: 2, roleName: 'user' },
  ],
};

await api.post('/users', data);

// 실제 전송
{
  user_id: 1,
  user_profile: {
    first_name: 'John',
    last_name: 'Doe',
  },
  user_roles: [
    { role_id: 1, role_name: 'admin' },
    { role_id: 2, role_name: 'user' },
  ],
}
```

커스텀 변환 함수도 지원합니다. 이 함수 역시 **body와 params 양쪽 모두에 적용**되므로, params 구조에도 안전하게 동작해야 합니다:

```typescript
initApi({
  baseURL: 'https://api.example.com',
  transformRequest: (data) => {
    // 커스텀 변환 로직 (body와 params 모두에 호출됨)
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      return {
        ...data,
        timestamp: new Date().toISOString(),
      };
    }
    return data;
  },
});
```

#### 변환에서 제외되는 특수 타입

다음 타입은 `transformRequest` 설정과 무관하게 **그대로 전달**됩니다. 파일 업로드나 특수 객체 전송 시 안전합니다.

- **이진/파일**: `FormData`, `File`, `Blob`, `ArrayBuffer`
- **URL 인코딩**: `URLSearchParams`
- **내장 객체**: `Date`, `Map`, `Set`, `RegExp`, `Error`
- **원시값**: `string`, `number`, `boolean`
- **빈 값**: `null`, `undefined`

```typescript
// FormData는 변환되지 않음
const form = new FormData();
form.append('userName', 'John');
await api.post('/upload', form); // 'userName' 그대로 유지

// 중첩된 Date/Map도 그대로 보존
await api.post('/events', {
  eventName: 'Conference',
  eventDate: new Date('2024-06-15'),
  metadata: new Map([['key', 'value']]),
});
```

#### body와 params를 다르게 변환하고 싶다면

설정은 하나의 규칙을 공유합니다. 서로 다른 규칙이 필요하면 `onRequest` 훅에서 `config.params`를 직접 조작하세요.

```typescript
initApi({
  baseURL: 'https://api.example.com',
  transformRequest: 'snakeCase', // body와 params 모두 snake_case
  onRequest: (config) => {
    // 특정 요청만 params 원형 유지
    if (config.url?.startsWith('/legacy/')) {
      config.params = originalParamsMap.get(config.url);
    }
    return config;
  },
});
```

### camelCase 자동 변환

`transformResponse: 'camelCase'`를 설정하면 응답의 모든 키를 snake_case에서 camelCase로 깊은 재귀 변환합니다.

```typescript
initApi({
  baseURL: 'https://api.example.com',
  transformResponse: 'camelCase',
});

// 서버 응답: { user_name: 'John', created_at: '2024-01-01', address: { zip_code: '12345' } }
const user = await api.get('/users/1');
// 변환 후:  { userName: 'John', createdAt: '2024-01-01', address: { zipCode: '12345' } }
```

배열도 동일하게 처리됩니다.

```typescript
// 서버 응답: [{ user_id: 1, first_name: 'Alice' }, { user_id: 2, first_name: 'Bob' }]
const users = await api.get('/users');
// 변환 후:  [{ userId: 1, firstName: 'Alice' }, { userId: 2, firstName: 'Bob' }]
```

### 에러 핸들링 전략

에러 인터셉터의 실행 순서는 다음과 같습니다:

```text
응답 에러 발생
  ├─ 1. 내장 로깅 (AxiosError 요약 출력)
  ├─ 2. 401 처리: refreshTokenFn으로 갱신 후 재요청 (성공 시 정상 반환, 훅 호출 안 함)
  ├─ 3. 에러 로깅 (status, url, method, response data)
  └─ 4. onErrorResponse 사용자 훅 실행 → 에러 throw
```

> **훅 내부 throw**: `onRequest`/`onErrorRequest`/`onResponse`/`onErrorResponse` 훅 내부에서 throw한 에러는 **원 에러를 대체하여 전파**됩니다 (axios의 promise chain으로 정상 reject). 훅에서 fallback 값을 반환하거나 요청을 중단하려면 throw 대신 그에 맞는 값을 return하세요.

`onErrorResponse`에서 에러를 분류하여 처리하는 예시:

```typescript
import type { AxiosError } from 'axios';

initApi({
  baseURL: 'https://api.example.com',
  onErrorResponse: (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;

      if (status === 403) {
        alert('접근 권한이 없습니다.');
      } else if (status === 404) {
        console.warn('요청한 리소스를 찾을 수 없습니다.');
      } else if (status && status >= 500) {
        alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  },
});
```

호출 측에서 개별 에러를 처리할 수도 있습니다:

```typescript
try {
  const user = await api.get('/users/1');
} catch (error) {
  if (axios.isAxiosError(error) && error.response?.status === 404) {
    // 404 처리
  }
}
```

## 내부 동작 방식

### initApi()의 내부 동작

`initApi()` 호출 시 다음 순서로 처리됩니다:

1. `setApiConfig(config)` — 설정 객체를 모듈 스코프 변수에 저장
2. `axios.create(options)` — 아래 기본값으로 인스턴스 생성
   - `Content-Type: application/json;charset=UTF-8`
   - `accept: application/json`
   - `responseType: json`
   - `timeout: 120,000ms` (2분, `axiosOptions.timeout`으로 재정의 가능)
   - 배열 파라미터를 반복 키로 직렬화하는 커스텀 `paramsSerializer` (`?ids=1&ids=2`). `axiosOptions.paramsSerializer`를 지정하면 **완전히 교체**됩니다.
3. `interceptors(instance)` — 요청/응답 인터셉터 등록
4. `setAxiosInstance(instance)` — 생성된 인스턴스를 모듈 스코프 변수에 저장

### paramsSerializer 교체

기본 동작을 바꾸고 싶을 때 `axiosOptions.paramsSerializer`를 지정합니다.

```typescript
import qs from 'qs';

initApi({
  baseURL: 'https://api.example.com',
  axiosOptions: {
    // 예: 배열을 ids[]=1&ids[]=2 형태로 직렬화
    paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'brackets' }),
  },
});
```

### 내장 로깅

요청/응답/에러 흐름에서 라이브러리가 남기는 내장 로그는 **`process.env.NODE_ENV !== 'production'`에서만** `console.log`로 출력됩니다. 프로덕션 빌드에서는 조용히 동작하므로 안전합니다.

- 로깅 대상: 요청 URL·메서드, 응답 상태, Axios 에러 요약(상태·URL·메서드·data·응답data)
- base64 인코딩 문자열/긴 문자열은 자동으로 축약되어 로그 가독성을 유지합니다.

> **로그 URL vs 실제 요청 URL**: 개발 로그에 출력되는 GET 요청의 전체 URL은 `qs.stringify`(배열은 `ids[]=1&ids[]=2` 형태)로 조립됩니다. 실제 요청은 기본 `paramsSerializer`(또는 사용자가 지정한 것)를 사용하므로, 배열이 포함된 params는 **로그의 URL과 실제 URL이 다르게 보일 수 있습니다**. 실제 네트워크 호출은 브라우저 DevTools로 확인하세요.

### 싱글턴 패턴

설정과 axios 인스턴스는 모듈 레벨 변수(`_config`, `_axiosInstance`)에 저장됩니다. `initApi()`를 여러 번 호출하면 마지막 설정으로 덮어씁니다.

`initApi()` 호출 전에 `api.get()` 등을 사용하면 다음 에러가 발생합니다:

```text
Error: @jigoooo/api-client: initApi()를 먼저 호출하세요.
```

### Proxy 기반 지연 참조

`api` 객체는 내부적으로 `customedAxios`를 통해 axios 인스턴스에 접근합니다. `customedAxios`는 ES `Proxy`로 구현되어 있어, 모듈 임포트 시점이 아닌 메서드 호출 시점에 인스턴스를 조회합니다.

```typescript
// 내부 구조
const customedAxios = new Proxy(
  {},
  {
    get(_target, prop) {
      const instance = getAxiosInstance(); // 호출 시점에 조회
      const value = instance[prop];
      return typeof value === 'function' ? value.bind(instance) : value;
    },
  },
);
```

이 덕분에 다음과 같은 순서로 사용해도 안전합니다:

```typescript
// 파일 상단에서 임포트 (이 시점엔 initApi() 미호출)
import { api } from '@jigoooo/api-client';

// 앱 진입점에서 초기화
initApi({ baseURL: '...' });

// 이후 어디서든 사용 가능
const data = await api.get('/users'); // 정상 동작
```

## 문제 해결

### 토큰 갱신 실패 시 처리

`refreshTokenFn`이 throw하거나 `refreshTokenFn` 자체가 설정되지 않은 경우, `onUnauthorized`가 호출됩니다. **`onUnauthorized`를 설정하지 않으면 토큰 갱신 실패 시 아무 동작도 수행되지 않습니다.** 반드시 `onUnauthorized`를 명시적으로 설정하세요:

```typescript
initApi({
  baseURL: 'https://api.example.com',
  refreshTokenFn: async () => {
    const res = await fetch('/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Refresh failed');
    const { accessToken } = await res.json();
    store.dispatch(setToken(accessToken)); // Redux store 갱신
    return accessToken;
  },
  onUnauthorized: () => {
    store.dispatch(logout()); // 상태 초기화
    router.replace('/'); // 라우터로 리다이렉트
  },
});
```

#### React Router v6 적용 예시

```typescript
import { createBrowserRouter } from 'react-router-dom';
import { initApi } from '@jigoooo/api-client';

const router = createBrowserRouter([...]);

initApi({
  baseURL: 'https://api.example.com',
  onUnauthorized: () => {
    router.navigate('/');
  },
});
```

#### TanStack Router 적용 예시

```typescript
import { createRouter } from '@tanstack/react-router';
import { initApi } from '@jigoooo/api-client';

const router = createRouter({ routeTree });

initApi({
  baseURL: 'https://api.example.com',
  onUnauthorized: () => {
    router.navigate({ to: '/' });
  },
});
```

> **`window.location.href = '/'` vs 라우터 navigate 차이**:
>
> - `window.location.href = '/'` → 전체 페이지 새로고침, SPA 히스토리 초기화
> - 라우터 `navigate` → SPA 내비게이션 유지, 상태 보존

### 요청 타임아웃 설정

기본 타임아웃은 2분(120,000ms)입니다. `axiosOptions.timeout`으로 전역 재정의하거나, 요청별로 설정할 수 있습니다.

```typescript
// 전역 설정 (initApi에서)
initApi({
  baseURL: 'https://api.example.com',
  axiosOptions: {
    timeout: 30_000, // 30초
  },
});

// 요청별 설정 (api.get 등에서)
const data = await api.get('/heavy-endpoint', { timeout: 60_000 }); // 60초
```

타임아웃 발생 시 에러 메시지는 `"요청시간이 초과되었습니다."`로 설정되어 있습니다.

```typescript
initApi({
  baseURL: 'https://api.example.com',
  onErrorResponse: (error) => {
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      alert('요청 시간이 초과되었습니다. 네트워크 상태를 확인하세요.');
    }
  },
});
```

### 커스텀 에러 처리

특정 요청에 대해서만 에러를 다르게 처리해야 하는 경우, `try/catch`와 함께 사용하세요:

```typescript
async function fetchUserSilently(id: number): Promise<User | null> {
  try {
    return (await api.get(`/users/${id}`)) as User;
  } catch (error) {
    // 전역 onErrorResponse는 이미 실행됨
    // 여기서 추가 처리 또는 fallback 반환
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null; // 404는 null로 처리
    }
    throw error; // 그 외 에러는 다시 throw
  }
}
```

요청 취소(AbortController)를 활용하면 컴포넌트 언마운트 시 불필요한 요청을 중단할 수 있습니다:

```typescript
const controller = new AbortController();

const data = await api.get('/users', { signal: controller.signal });

// 취소 시
controller.abort();
```

## Public API vs Internal API

### Public API (엔트리포인트에서 접근 가능)

`@jigoooo/api-client`에서 바로 import할 수 있는 공식 API입니다.

- 함수: `initApi`, `isApiConfigured`
- 객체: `api`
- 타입: `ApiConfig`, `ApiInstance`, `RetryConfig`

### Internal API (외부 사용 비권장)

아래 심볼들은 소스 파일에서 `export`되어 있지만 **패키지 엔트리포인트에서 re-export되지 않습니다**. `package.json`의 `exports` 필드가 루트 엔트리(`.`)만 공개하므로 외부에서 import할 수 없습니다. 테스트나 내부 확장 용도로만 존재합니다.

- `src/config.ts`: `setApiConfig`, `setAxiosInstance`, `getApiConfig`, `getAxiosInstance`
- `src/customed-axios.ts`: `customedAxios` (Proxy 기반 지연 참조 객체)
- `src/api-request.ts`: `apiRequest`, `transformRequestData`
- `src/interceptors.ts`: `interceptors`

이들의 시그니처는 **명시적 공지 없이 변경될 수 있습니다**. 외부에서 직접 참조하지 마세요.

## 라이선스

MIT
