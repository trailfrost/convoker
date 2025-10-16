import { InputValidationError } from "./error";
import type { StandardSchemaV1 } from "./standard-schema";

export interface Input {
  [x: string]: Option<any, any, any> | Positional<any, any, any>;
}

export type BasicKind = "boolean" | "string" | "number" | "bigint";
export type Kind = BasicKind | StandardSchemaV1<any, any>;

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

export type InferInput<T extends Input> = {
  [K in keyof T]: InferEntry<T[K]>;
};

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

export async function convert<TKind extends Kind>(
  kind: TKind,
  value: string
): Promise<TypeOf<TKind>> {
  // Basic kinds
  if (typeof kind === "string") {
    switch (kind) {
      case "boolean":
        return (value === "true") as any;
      case "bigint":
        return BigInt(value) as any;
      case "number":
        return parseFloat(value) as any;
      case "string":
        return value as any;
    }
  }

  // Otherwise, Standard Schema
  const result = await kind["~standard"].validate(value);
  if (result.issues) {
    const msgs = result.issues.map((i) => i.message);
    throw new InputValidationError(msgs);
  }

  return result.value;
}

export class Option<
  TKind extends Kind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  $kind: TKind;
  $names: string[];
  $description: string | undefined;
  $default: TypeOf<TKind> | undefined;
  $required: TRequired = true as TRequired;
  $list: TList = false as TList;

  constructor(kind: TKind, names: string[]) {
    this.$kind = kind;
    this.$names = names.map((name) => name.replace(/^-+/, ""));
  }

  list(): Option<TKind, TRequired, true> {
    this.$list = true as TList;
    return this as any;
  }

  required(): Option<TKind, true, TList> {
    this.$required = true as TRequired;
    return this as any;
  }

  optional(): Option<TKind, false, TList> {
    this.$required = false as TRequired;
    return this as any;
  }

  default(value: TypeOf<TKind>): this {
    this.$default = value;
    return this;
  }

  description(desc: string): this {
    this.$description = desc;
    return this;
  }
}

export class Positional<
  TKind extends Kind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  $kind: TKind;
  $default: TypeOf<TKind> | undefined;
  $description: string | undefined;
  $required: TRequired = true as TRequired;
  $list: TList = false as TList;

  constructor(kind: TKind) {
    this.$kind = kind;
  }

  list(): Positional<TKind, TRequired, true> {
    this.$list = true as TList;
    return this as any;
  }

  required(): Positional<TKind, true, TList> {
    this.$required = true as TRequired;
    return this as any;
  }

  optional(): Positional<TKind, false, TList> {
    this.$required = false as TRequired;
    return this as any;
  }

  default(value: TypeOf<TKind>): this {
    this.$default = value;
    return this;
  }

  description(desc: string): this {
    this.$description = desc;
    return this;
  }
}

export function option<T extends Kind>(kind: T, ...names: string[]): Option<T> {
  return new Option(kind, names);
}

export function positional<T extends Kind>(kind: T): Positional<T> {
  return new Positional(kind);
}

export function argument<T extends Kind>(kind: T): Positional<T> {
  return new Positional(kind);
}
