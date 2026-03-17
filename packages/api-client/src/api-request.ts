import { getApiConfig } from './config';
import { deepCamelCase } from './utils/camelize';
import { deepSnakeCase } from './utils/snakelize';

/**
 * 요청 데이터를 ApiConfig의 transformRequest 설정에 따라 변환합니다.
 *
 * transformRequest 적용 순서:
 * 1. 'snakeCase' → camelCase를 snake_case로 변환
 * 2. 함수 → 커스텀 변환 함수 실행
 * 3. false/undefined → 원본 데이터 반환
 *
 * @param data 변환할 요청 데이터
 * @returns transformRequest가 적용된 데이터
 *
 * @internal
 * @example
 * const transformed = transformRequestData({ userId: 1, userName: 'John' });
 * // transformRequest가 'snakeCase'인 경우 -> { user_id: 1, user_name: 'John' }
 */
/**
 * 요청 데이터를 ApiConfig의 transformRequest 설정에 따라 변환합니다.
 * FormData, File, Blob 등의 특수 타입은 변환하지 않습니다.
 *
 * transformRequest 적용 순서:
 * 1. FormData/File/Blob/ArrayBuffer/URLSearchParams 등 → 그대로 반환
 * 2. 'snakeCase' → camelCase를 snake_case로 변환
 * 3. 함수 → 커스텀 변환 함수 실행
 * 4. false/undefined → 원본 데이터 반환
 *
 * @param data 변환할 요청 데이터
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
export async function apiRequest(request: Promise<any>) {
  const response = await request;
  const { transformResponse } = getApiConfig();

  // transformResponse 설정에 따라 응답 데이터 변환
  let data: unknown;
  if (transformResponse === 'camelCase') {
    data = deepCamelCase(response.data);
  } else if (typeof transformResponse === 'function') {
    data = transformResponse(response.data);
  } else {
    data = response.data;
  }

  return data;
}
