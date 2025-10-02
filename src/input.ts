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

export function convert<TKind extends Kind>(
  kind: TKind,
  value: string
): TypeOf<TKind> {
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

export class Option<
  TKind extends Kind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  $kind: TKind;
  $names: string[];
  $default: TypeOf<TKind> | undefined = undefined;
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
}

export class Positional<
  TKind extends Kind,
  TRequired extends boolean = true,
  TList extends boolean = false,
> {
  $kind: TKind;
  $default: TypeOf<TKind> | undefined = undefined;
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
}

export const c = {
  option: <T extends Kind>(kind: T, ...names: string[]) =>
    new Option(kind, names),
  positional: <T extends Kind>(kind: T) => new Positional(kind),
  argument: <T extends Kind>(kind: T) => new Positional(kind),
};
