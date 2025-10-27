export const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

export const isDeno =
  typeof Deno !== "undefined" && typeof Deno.version?.deno === "string";

export const isBun =
  typeof Bun !== "undefined" && typeof Bun.version === "string";

type Primitive = string | number | boolean | symbol | null | undefined | bigint;

export type DeepMerge<T, U> = T extends Primitive
  ? U
  : U extends Primitive
    ? U
    : T extends Array<infer TItem>
      ? U extends Array<infer UItem>
        ? Array<DeepMerge<TItem, UItem>>
        : U
      : T extends object
        ? U extends object
          ? {
              [K in keyof T | keyof U]: K extends keyof U
                ? K extends keyof T
                  ? DeepMerge<T[K], U[K]>
                  : U[K]
                : K extends keyof T
                  ? T[K]
                  : never;
            }
          : U
        : U;

function isPlainObject(value: any): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function merge<T, U>(source: T, target: U): DeepMerge<T, U> {
  if (Array.isArray(source) && Array.isArray(target)) {
    // Replace arrays
    return target as any;
  }

  if (isPlainObject(source) && isPlainObject(target)) {
    const result: any = {};
    const keys = new Set([...Object.keys(source), ...Object.keys(target)]);
    keys.forEach((key) => {
      const sourceVal = (source as any)[key];
      const targetVal = (target as any)[key];

      if (sourceVal !== undefined && targetVal !== undefined) {
        result[key] = merge(sourceVal, targetVal);
      } else if (targetVal !== undefined) {
        result[key] = targetVal;
      } else {
        result[key] = sourceVal;
      }
    });
    return result;
  }

  // For class instances or primitives, always use target
  return target as any;
}
