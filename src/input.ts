export interface Input {
  [x: string]: Option<any, any, any> | Positional<any, any, any>;
}

export type Kind = "boolean" | "string" | "number" | "bigint";

export type TypeOf<T extends Kind> = T extends "boolean"
  ? boolean
  : T extends "string"
    ? string
    : T extends "number"
      ? number
      : T extends "bigint"
        ? bigint
        : never;

export type InferInput<T extends Input> = {
  [K in keyof T]: T[K] extends Option<any, any, any>
    ? InferOption<T[K]>
    : InferPositional<T[K]>;
};

export type InferOption<T> =
  T extends Option<infer Kind, infer Required, infer List>
    ? List extends true
      ? Required extends true
        ? TypeOf<Kind>[]
        : TypeOf<Kind>[] | undefined
      : Required extends true
        ? TypeOf<Kind>
        : TypeOf<Kind> | undefined
    : never;

export type InferPositional<T> =
  T extends Positional<infer Kind, infer Required, infer List>
    ? List extends true
      ? Required extends true
        ? TypeOf<Kind>[]
        : TypeOf<Kind>[] | undefined
      : Required extends true
        ? TypeOf<Kind>
        : TypeOf<Kind> | undefined
    : never;

export class Option<
  TKind extends Kind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  $names: string[];
  $default: TypeOf<TKind> | undefined = undefined;
  $required: TRequired = true as TRequired;
  $list: TList = false as TList;

  constructor(names: string[]) {
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
}

export class Positional<
  TKind extends Kind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  $default: TypeOf<TKind> | undefined = undefined;
  $required: TRequired = true as TRequired;
  $list: TList = false as TList;

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
}

export const c = {
  option: <T extends Kind>(...names: string[]) => new Option<T>(names),
  positional: <T extends Kind>() => new Positional<T>(),
  argument: <T extends Kind>() => new Positional<T>(),
};
