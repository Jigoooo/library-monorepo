/**
 * snake_case를 camelCase로 변환하는 타입
 * @example "user_name" -> "userName"
 */
type CamelCase<S extends string> = S extends `${infer P}_${infer Q}`
  ? `${P}${Capitalize<CamelCase<Q>>}`
  : S;

/**
 * 객체 전체를 재귀적으로 snake_case -> camelCase로 변환하는 타입
 * 배열과 중첩 객체도 처리합니다.
 */
type DeepCamelCase<T> =
  T extends Array<infer U>
    ? Array<DeepCamelCase<U>>
    : T extends object
      ? { [K in keyof T as CamelCase<string & K>]: DeepCamelCase<T[K]> }
      : T;

/**
 * 단일 문자열을 snake_case에서 camelCase로 변환합니다.
 * 예: "user_name" -> "userName"
 *
 * @param str 변환할 문자열
 * @returns camelCase로 변환된 문자열
 */
const toCamelCase = (str: string): string =>
  str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

/**
 * 객체를 재귀적으로 snake_case -> camelCase로 변환합니다.
 * - 객체의 모든 키를 변환
 * - 중첩된 객체도 변환
 * - 배열 요소도 변환
 * - null/undefined는 그대로 유지
 * - Date, Map, Set, RegExp 등 특수 객체는 그대로 유지
 *
 * @param obj 변환할 객체, 배열, 또는 원시 값
 * @returns camelCase로 변환된 객체
 *
 * @example
 * deepCamelCase({ user_name: 'John', user_email: 'john@example.com' })
 * // -> { userName: 'John', userEmail: 'john@example.com' }
 *
 * @example
 * deepCamelCase({
 *   users: [{ user_id: 1, user_name: 'Alice' }]
 * })
 * // -> { users: [{ userId: 1, userName: 'Alice' }] }
 */
export const deepCamelCase = <T>(obj: T): DeepCamelCase<T> => {
  if (Array.isArray(obj)) {
    return obj.map(deepCamelCase) as DeepCamelCase<T>;
  }

  // 특수 객체들은 변환하지 않음
  if (
    obj instanceof Date ||
    obj instanceof Map ||
    obj instanceof Set ||
    obj instanceof RegExp ||
    obj instanceof Error
  ) {
    return obj as DeepCamelCase<T>;
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [toCamelCase(key), deepCamelCase(value)]),
    ) as DeepCamelCase<T>;
  }

  return obj as DeepCamelCase<T>;
};
