/**
 * 개발 모드에서만 콘솔에 로그를 출력합니다.
 * 프로덕션 환경에서는 조용히 실행되므로 개발 중 디버깅 메시지를 안전하게 남길 수 있습니다.
 *
 * @param args 콘솔에 출력할 값들 (여러 개의 인수 지원)
 *
 * @example
 * // 개발 모드에서는 출력됨
 * logOnDev('User ID:', userId, 'API Config:', apiConfig);
 * // → User ID: 123 API Config: { ... }
 *
 * // 프로덕션 모드에서는 출력되지 않음
 * process.env.NODE_ENV = 'production';
 * logOnDev('This will not be logged');
 * // (출력 없음)
 */
export const logOnDev = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};
