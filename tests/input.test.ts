import * as v from "valibot";
import { describe, test, expect } from "vitest";
import { i } from "@/index";

// --- Runtime tests ---
describe("Option", () => {
  test("strips leading dashes from names", () => {
    const opt = new i.Option("string", ["--foo", "-f", "bar"]);
    expect(opt.$names).toEqual(["foo", "f", "bar"]);
  });

  test("marks as list when .list() is called", () => {
    const opt = i.option("string", "--foo").list();
    expect(opt.$list).toBe(true);
  });

  test("marks as optional when .optional() is called", () => {
    const opt = i.option("string", "--foo").optional();
    expect(opt.$required).toBe(false);
  });

  test("marks as required when .required() is called", () => {
    const opt = i.option("string", "--foo").optional().required();
    expect(opt.$required).toBe(true);
  });

  test("assigns a default value when .default() is called", () => {
    const opt = i.option("string", "--foo").default("bar");
    expect(opt.$default).toBe("bar");
  });
});

describe("Positional", () => {
  test("marks as list when .list() is called", () => {
    const pos = i.positional("string").list();
    expect(pos.$list).toBe(true);
  });

  test("marks as optional when .optional() is called", () => {
    const pos = i.positional("string").optional();
    expect(pos.$required).toBe(false);
  });

  test("marks as required when .required() is called", () => {
    const pos = i.positional("string").optional().required();
    expect(pos.$required).toBe(true);
  });

  test("assigns a default value when .default() is called", () => {
    const pos = i.positional("string").default("foo");
    expect(pos.$default).toBe("foo");
  });
});

// --- Type-level tests ---
describe("Type inference", () => {
  test("infers Option types correctly", () => {
    type A = i.InferEntry<i.Option<"string", true, false>>;
    type B = i.InferEntry<i.Option<"number", false, false>>;
    type C = i.InferEntry<i.Option<"boolean", true, true>>;

    // compile-time checks:
    const a: A = "hello"; // required string
    const b: B = undefined as number | undefined; // optional number
    const c: C = [true, false]; // required array of booleans

    expect(a).toBe("hello");
    expect(b).toBeUndefined();
    expect(c).toEqual([true, false]);
  });

  test("infers Positional types correctly", () => {
    type A = i.InferEntry<i.Positional<"string", true, false>>;
    type B = i.InferEntry<i.Positional<"number", false, false>>;
    type C = i.InferEntry<i.Positional<"boolean", true, true>>;

    const a: A = "foo";
    const b: B = undefined as number | undefined;
    const c: C = [true];

    expect(a).toBe("foo");
    expect(b).toBeUndefined();
    expect(c).toEqual([true]);
  });

  test("infers Valibot types correctly", () => {
    // eslint-disable-next-line -- you can't inline this
    const valibotString = v.string();
    type A = i.InferEntry<i.Positional<typeof valibotString, true, false>>;

    const a: A = "foo";
    expect(a).toBe("foo");
  });

  test("infers Input object correctly", () => {
    // eslint-disable-next-line -- you can't just inline this
    const input = {
      foo: i.option("string", "--foo").optional(),
      bar: i.positional("string").list(),
    };

    type Inferred = i.InferInput<typeof input>;
    const value: Inferred = {
      foo: undefined, // string | undefined
      bar: ["a", "b"], // string[]
    };

    expect(value.foo).toBeUndefined();
    expect(value.bar).toEqual(["a", "b"]);
  });
});
