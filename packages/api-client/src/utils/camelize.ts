type CamelCase<S extends string> = S extends `${infer P}_${infer Q}`
  ? `${P}${Capitalize<CamelCase<Q>>}`
  : S;

type DeepCamelize<T> =
  T extends Array<infer U>
    ? Array<DeepCamelize<U>>
    : T extends object
      ? { [K in keyof T as CamelCase<string & K>]: DeepCamelize<T[K]> }
      : T;

const toCamelCase = (str: string): string =>
  str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

export const deepCamelize = <T>(obj: T): DeepCamelize<T> => {
  if (Array.isArray(obj)) {
    return obj.map(deepCamelize) as DeepCamelize<T>;
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [toCamelCase(key), deepCamelize(value)]),
    ) as DeepCamelize<T>;
  }
  return obj as DeepCamelize<T>;
};
