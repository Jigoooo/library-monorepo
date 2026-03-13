import { getApiConfig } from './config';
import { deepCamelize } from './utils/camelize';

export async function apiRequest(request: Promise<any>) {
  const response = await request;
  const { transformResponse } = getApiConfig();

  // Step 1: transformResponse 적용 (response.data 전처리)
  let data: unknown;
  if (transformResponse === 'camelCase') {
    // camelCase 변환 명시
    data = deepCamelize(response.data);
  } else if (typeof transformResponse === 'function') {
    // 커스텀 함수
    data = transformResponse(response.data);
  } else {
    data = response.data;
  }

  return data;
}
