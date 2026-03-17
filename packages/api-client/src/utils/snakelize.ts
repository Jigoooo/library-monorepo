/**
 * camelCase를 snake_case로 변환하는 타입
 * @example "userName" -> "user_name"
 */
/**
 * camelCase를 snake_case로 변환하는 타입
 * @example "userName" -> "user_name"
 */
type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${T}${SnakeCase<U>}`
    : `${T}_${Uncapitalize<U>}${SnakeCase<U>}`
  : S;

/**
 * 객체 전체를 재귀적으로 camelCase -> snake_case로 변환하는 타입
 * 배열과 중첩 객체도 처리합니다.
 */
/**
 * 객체 전체를 재귀적으로 camelCase -> snake_case로 변환하는 타입
 * 배열과 중첩 객체도 처리합니다.
 */
type DeepSnakeCase<T> =
  T extends Array<infer U>
    ? Array<DeepSnakeCase<U>>
    : T extends object
      ? { [K in keyof T as SnakeCase<string & K>]: DeepSnakeCase<T[K]> }
      : T;

/**
 * 단일 문자열을 camelCase에서 snake_case로 변환합니다.
 * 예: "userName" -> "user_name"
 *
 * @param str 변환할 문자열
 * @returns snake_case로 변환된 문자열
 */
const toSnakeCase = (str: string): string =>
  str.replace(/([A-Z])/g, (_, letter: string) => `_${letter.toLowerCase()}`);

/**
 * 객체를 재귀적으로 camelCase -> snake_case로 변환합니다.
 * - 객체의 모든 키를 변환
 * - 중첩된 객체도 변환
 * - 배열 요소도 변환
 * - null/undefined는 그대로 유지
 * - Date, Map, Set, RegExp 등 특수 객체는 그대로 유지
 *
 * @param obj 변환할 객체, 배열, 또는 원시 값
 * @returns snake_case로 변환된 객체
 *
 * @example
 * deepSnakelize({ userName: 'John', userEmail: 'john@example.com' })
 * // -> { user_name: 'John', user_email: 'john@example.com' }
 *
 * @example
 * deepSnakelize({
 *   users: [{ userId: 1, userName: 'Alice' }]
 * })
 * // -> { users: [{ user_id: 1, user_name: 'Alice' }] }
 */
/**
 * 객체를 재귀적으로 camelCase -> snake_case로 변환합니다.
 * - 객체의 모든 키를 변환
 * - 중첩된 객체도 변환
 * - 배열 요소도 변환
 * - null/undefined는 그대로 유지
 *
 * @param obj 변환할 객체, 배열, 또는 원시 값
 * @returns snake_case로 변환된 객체
 *
 * @example
 * deepSnakeCase({ userName: 'John', userEmail: 'john@example.com' })
 * // -> { user_name: 'John', user_email: 'john@example.com' }
 *
 * @example
 * deepSnakeCase({
 *   users: [{ userId: 1, userName: 'Alice' }]
 * })
 * // -> { users: [{ user_id: 1, user_name: 'Alice' }] }
 */
export const deepSnakeCase = <T>(obj: T): DeepSnakeCase<T> => {
  if (Array.isArray(obj)) {
    return obj.map(deepSnakeCase) as DeepSnakeCase<T>;
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [toSnakeCase(key), deepSnakeCase(value)]),
    ) as DeepSnakeCase<T>;
  }
  return obj as DeepSnakeCase<T>;
};
