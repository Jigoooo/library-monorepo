import { getApiConfig } from './config';
import { deepCamelCase } from './utils/camelize';
import { deepSnakeCase } from './utils/snakelize';

/**
 * 요청 데이터를 ApiConfig의 transformRequest 설정에 따라 변환합니다.
 * POST/PUT/PATCH의 request body와 모든 메서드의 query params(config.params)에 적용됩니다.
 *
 * 특수 타입 처리 (변환 없이 그대로 반환):
 * - FormData/File/Blob/ArrayBuffer/URLSearchParams
 * - 원시값 (string, number, boolean)
 * - null/undefined
 * - Date/Map/Set/RegExp/Error (deepSnakeCase 내부에서 보존)
 *
 * transformRequest 적용 순서:
 * 1. 특수 타입이면 원본 반환
 * 2. 'snakeCase' → camelCase를 snake_case로 변환
 * 3. 함수 → 커스텀 변환 함수 실행
 * 4. false/undefined → 원본 데이터 반환
 *
 * @param data 변환할 요청 데이터 (body 또는 params)
 * @returns transformRequest가 적용된 데이터
 *
 * @internal
 * @example
 * const transformed = transformRequestData({ userId: 1, userName: 'John' });
 * // transformRequest가 'snakeCase'인 경우 -> { user_id: 1, user_name: 'John' }
 *
 * @example
 * // FormData는 변환하지 않음
 * const formData = new FormData();
 * const result = transformRequestData(formData); // formData 그대로 반환
 */
export function transformRequestData(data: unknown): unknown {
  // 특수 타입들은 변환하지 않음
  if (
    data instanceof FormData ||
    data instanceof File ||
    data instanceof Blob ||
    data instanceof ArrayBuffer ||
    data instanceof URLSearchParams
  ) {
    return data;
  }

  // 원시값들은 그대로 반환
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  // null/undefined는 그대로 반환
  if (data === null || data === undefined) {
    return data;
  }

  // 객체/배열 변환
  const { transformRequest } = getApiConfig();

  if (transformRequest === 'snakeCase') {
    return deepSnakeCase(data);
  } else if (typeof transformRequest === 'function') {
    return transformRequest(data);
  }

  return data;
}

/**
 * 응답 데이터를 ApiConfig의 transformResponse 설정에 따라 변환합니다.
 * transformRequestData와 동일하게 특수 타입은 변환 없이 그대로 반환합니다.
 *
 * 특수 타입 처리 (responseType을 'blob'/'arraybuffer' 등으로 바꿔도 안전):
 * - FormData/File/Blob/ArrayBuffer/URLSearchParams → 그대로 반환
 * - 원시값 (string, number, boolean) → 그대로 반환
 * - null/undefined → 그대로 반환
 * - Date/Map/Set/RegExp/Error → deepCamelCase 내부에서 그대로 반환
 *
 * transformResponse 적용 순서:
 * 1. 특수 타입이면 원본 반환
 * 2. 'camelCase' → snake_case를 camelCase로 변환
 * 3. 함수 → 커스텀 변환 함수 실행
 * 4. false/undefined → 원본 데이터 반환
 *
 * @param data 변환할 응답 데이터
 * @returns transformResponse가 적용된 데이터
 *
 * @internal
 * @example
 * const transformed = transformResponseData({ user_id: 1, user_name: 'John' });
 * // transformResponse가 'camelCase'인 경우 -> { userId: 1, userName: 'John' }
 *
 * @example
 * // responseType: 'blob'으로 파일 다운로드 시 Blob을 그대로 반환
 * const blob = transformResponseData(new Blob([...])); // Blob 그대로
 */
function transformResponseData(data: unknown): unknown {
  // 특수 타입들은 변환하지 않음 (responseType 변경 시 데이터 손실 방지)
  if (
    data instanceof FormData ||
    data instanceof File ||
    data instanceof Blob ||
    data instanceof ArrayBuffer ||
    data instanceof URLSearchParams
  ) {
    return data;
  }

  // 원시값들은 그대로 반환
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  // null/undefined는 그대로 반환
  if (data === null || data === undefined) {
    return data;
  }

  const { transformResponse } = getApiConfig();

  // transformResponse 설정에 따라 응답 데이터 변환
  if (transformResponse === 'camelCase') {
    return deepCamelCase(data);
  } else if (typeof transformResponse === 'function') {
    return transformResponse(data);
  }

  return data;
}

/**
 * Axios 응답을 처리하고 transformResponse를 적용합니다.
 * 일반적으로 api.get/post/put/patch/delete에서 내부적으로 호출됩니다.
 * 내부에서 transformResponseData()를 호출하므로 특수 타입 보호 규칙이 그대로 적용됩니다.
 *
 * @param request Axios Promise (예: customedAxios.get())
 * @returns ApiConfig의 transformResponse가 적용된 데이터
 *
 * @example
 * // api.get 내부에서 자동으로 사용됨
 * const data = await apiRequest(customedAxios.get('/users'));
 *
 * @example
 * // 날짜 객체가 포함된 응답도 제대로 처리됨
 * const response = await apiRequest(customedAxios.get('/events'));
 * // { created_at: Date(...) } -> { createdAt: Date(...) }
 */
export async function apiRequest(request: Promise<any>) {
  const response = await request;
  const data = transformResponseData(response.data);

  return data;
}
