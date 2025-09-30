export interface Input {
  [x: string]: Option<any, any, any> | Positional<any, any, any>;
}

export type InferInput<T extends Input> = {
  [K in keyof T]: T[K] extends Option<any, any, any>
    ? InferOption<T[K]>
    : InferPositional<T[K]>;
};

export type InferOption<T> =
  T extends Option<infer Kind, infer Required, infer List>
    ? List extends true
      ? Required extends true
        ? Kind[]
        : Kind[] | undefined
      : Required extends true
        ? Kind
        : Kind | undefined
    : never;

export type InferPositional<T> =
  T extends Positional<infer Kind, infer Required, infer List>
    ? List extends true
      ? Required extends true
        ? Kind[]
        : Kind[] | undefined
      : Required extends true
        ? Kind
        : Kind | undefined
    : never;

export class Option<
  TKind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  $names: string[];
  $default: TKind | undefined = undefined;
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

  default(value: TKind): this {
    this.$default = value;
    return this;
  }
}

export class Positional<
  TKind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  $default: TKind | undefined = undefined;
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

  default(value: TKind): this {
    this.$default = value;
    return this;
  }
}

export const c = {
  option: <T>(...names: string[]) => new Option<T>(names),
  positional: <T>() => new Positional<T>(),
  argument: <T>() => new Positional<T>(),
};
