import { getAxiosInstance } from './config';

/**
 * customedAxios — initApi() 이후 사용 가능한 axios 인스턴스
 *
 * Proxy 패턴: initApi() 호출 이전에는 getAxiosInstance() 지연 참조
 * 기존 customedAxios.get(...), .post(...) 등 사용처 변경 없음
 */
export const customedAxios = new Proxy({} as ReturnType<typeof getAxiosInstance>, {
  get(_target, prop) {
    const instance = getAxiosInstance();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
