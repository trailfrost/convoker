import { validate, type StandardSchemaV1 } from "./standard-schema";

/**
 * An input object.
 */
export interface Input {
  [x: string]: Option<any, any, any> | Positional<any, any, any>;
}

/**
 * A basic input type.
 */
export type BasicKind = "boolean" | "string" | "number" | "bigint";
/**
 * An input type.
 */
export type Kind = BasicKind | StandardSchemaV1<any, any>;

/**
 * Converts a Kind to a TypeScript type.
 */
export type TypeOf<T extends Kind> =
  T extends StandardSchemaV1<any, infer Out>
    ? Out
    : T extends "boolean"
      ? boolean
      : T extends "string"
        ? string
        : T extends "number"
          ? number
          : T extends "bigint"
            ? bigint
            : never;

/**
 * Infers TypeScript types from an input object.
 */
export type InferInput<T extends Input> = {
  [K in keyof T]: InferEntry<T[K]>;
};

/**
 * Infers a TypeScript type from an option or positional.
 */
export type InferEntry<T> = T extends {
  $kind: infer TKind extends Kind;
  $required: infer Required;
  $list: infer List;
}
  ? List extends true
    ? Required extends true
      ? TypeOf<TKind>[]
      : TypeOf<TKind>[] | undefined
    : Required extends true
      ? TypeOf<TKind>
      : TypeOf<TKind> | undefined
  : never;

/**
 * Converts a value from a Kind to a TypeScript type.
 * @param kind The kind to convert to.
 * @param value The value to convert.
 * @returns The converted value.
 */
export async function convert<TKind extends Kind>(
  kind: TKind,
  value: string | string[],
): Promise<TypeOf<TKind> | TypeOf<TKind>[]> {
  // Helper for single value conversion
  async function convertOne(val: string): Promise<TypeOf<TKind>> {
    if (typeof kind === "string") {
      switch (kind) {
        case "boolean":
          return (val === "true") as any;
        case "bigint":
          return BigInt(val) as any;
        case "number":
          return parseFloat(val) as any;
        case "string":
          return val as any;
      }
    }
    // Otherwise, Standard Schema
    return validate(kind, val);
  }

  // If list → map each item
  if (Array.isArray(value)) {
    const results = await Promise.all(value.map((v) => convertOne(v)));
    return results as any;
  }

  // Single value case
  return convertOne(value);
}

/**
 * An option.
 */
export class Option<
  TKind extends Kind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  /**
   * The kind of this option.
   */
  $kind: TKind;
  /**
   * The aliases of this option.
   */
  $names: string[];
  /**
   * The description of this option.
   */
  $description: string | undefined;
  /**
   * The default value of this option.
   */
  $default: TypeOf<TKind> | undefined;
  /**
   * If this option is required.
   */
  $required: TRequired = true as TRequired;
  /**
   * If this option is a list.
   */
  $list: TList = false as TList;
  /**
   * A separator if this option is a list.
   */
  $separator: string | undefined;

  /**
   * Creates a new option.
   * @param kind The type of this option.
   * @param names The names of this option.
   */
  constructor(kind: TKind, names: string[]) {
    this.$kind = kind;
    this.$names = names.map((name) => name.replace(/^-+/, ""));
  }

  /**
   * Makes this option a list.
   * @returns this
   */
  list(separator?: string): Option<TKind, TRequired, true> {
    this.$list = true as TList;
    this.$separator = separator ?? this.$separator;
    return this as any;
  }

  /**
   * Makes this option required.
   * @returns this
   */
  required(): Option<TKind, true, TList> {
    this.$required = true as TRequired;
    return this as any;
  }

  /**
   * Makes this option optional.
   * @returns this
   */
  optional(): Option<TKind, false, TList> {
    this.$required = false as TRequired;
    return this as any;
  }

  /**
   * Sets a default value.
   * @param value The default value.
   * @returns this
   */
  default(value: TypeOf<TKind>): this {
    this.$default = value;
    return this;
  }

  /**
   * Sets a description.
   * @param desc The description.
   * @returns this
   */
  description(desc: string): this {
    this.$description = desc;
    return this;
  }
}

/**
 * A positional argument.
 */
export class Positional<
  TKind extends Kind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  /**
   * The type of this argument.
   */
  $kind: TKind;
  /**
   * The default value of this argument.
   */
  $default: TypeOf<TKind> | undefined;
  /**
   * The description of this argument.
   */
  $description: string | undefined;
  /**
   * If this argument is required.
   */
  $required: TRequired = true as TRequired;
  /**
   * If this argument is a list.
   */
  $list: TList = false as TList;

  /**
   * Creates a new positional argument.
   * @param kind The positional argument.
   */
  constructor(kind: TKind) {
    this.$kind = kind;
  }

  /**
   * Makes this argument a list.
   * @returns this
   */
  list(): Positional<TKind, TRequired, true> {
    this.$list = true as TList;
    return this as any;
  }

  /**
   * Makes this argument required.
   * @returns this
   */
  required(): Positional<TKind, true, TList> {
    this.$required = true as TRequired;
    return this as any;
  }

  /**
   * Makes this argument optional.
   * @returns this
   */
  optional(): Positional<TKind, false, TList> {
    this.$required = false as TRequired;
    return this as any;
  }

  /**
   * Sets a default value.
   * @param value The default value.
   * @returns this
   */
  default(value: TypeOf<TKind>): this {
    this.$default = value;
    return this;
  }

  /**
   * Sets a description.
   * @param desc The description.
   * @returns this
   */
  description(desc: string): this {
    this.$description = desc;
    return this;
  }
}

/**
 * Creates a new option.
 * @param kind The kind of option.
 * @param names The names of the option.
 * @returns A new option.
 */
export function option<T extends Kind>(kind: T, ...names: string[]): Option<T> {
  return new Option(kind, names);
}

/**
 * Creates a new positional argument.
 * @param kind The kind of positional argument.
 * @returns A new positional argument.
 */
export function positional<T extends Kind>(kind: T): Positional<T> {
  return new Positional(kind);
}

/**
 * Creates a new positional argument.
 * @param kind The kind of positional argument.
 * @returns A new positional argument.
 */
export function argument<T extends Kind>(kind: T): Positional<T> {
  return new Positional(kind);
}
