import { describe, it, expect } from "vitest";
import {
  c,
  Option,
  Positional,
  type InferEntry,
  type InferInput,
} from "../src/input";

// --- Runtime tests ---
describe("Option", () => {
  it("strips leading dashes from names", () => {
    const opt = new Option("string", ["--foo", "-f", "bar"]);
    expect(opt.$names).toEqual(["foo", "f", "bar"]);
  });

  it("marks as list when .list() is called", () => {
    const opt = c.option("string", "--foo").list();
    expect(opt.$list).toBe(true);
  });

  it("marks as optional when .optional() is called", () => {
    const opt = c.option("string", "--foo").optional();
    expect(opt.$required).toBe(false);
  });

  it("marks as required when .required() is called", () => {
    const opt = c.option("string", "--foo").optional().required();
    expect(opt.$required).toBe(true);
  });

  it("assigns a default value when .default() is called", () => {
    const opt = c.option("string", "--foo").default("bar");
    expect(opt.$default).toBe("bar");
  });
});

describe("Positional", () => {
  it("marks as list when .list() is called", () => {
    const pos = c.positional("string").list();
    expect(pos.$list).toBe(true);
  });

  it("marks as optional when .optional() is called", () => {
    const pos = c.positional("string").optional();
    expect(pos.$required).toBe(false);
  });

  it("marks as required when .required() is called", () => {
    const pos = c.positional("string").optional().required();
    expect(pos.$required).toBe(true);
  });

  it("assigns a default value when .default() is called", () => {
    const pos = c.positional("string").default("foo");
    expect(pos.$default).toBe("foo");
  });
});

// --- Type-level tests ---
describe("Type inference", () => {
  it("infers Option types correctly", () => {
    type A = InferEntry<Option<"string", true, false>>;
    type B = InferEntry<Option<"number", false, false>>;
    type C = InferEntry<Option<"boolean", true, true>>;

    // compile-time checks:
    const a: A = "hello"; // required string
    const b: B = undefined as number | undefined; // optional number
    const c: C = [true, false]; // required array of booleans

    expect(a).toBe("hello");
    expect(b).toBeUndefined();
    expect(c).toEqual([true, false]);
  });

  it("infers Positional types correctly", () => {
    type A = InferEntry<Positional<"string", true, false>>;
    type B = InferEntry<Positional<"number", false, false>>;
    type C = InferEntry<Positional<"boolean", true, true>>;

    const a: A = "foo";
    const b: B = undefined as number | undefined;
    const c: C = [true];

    expect(a).toBe("foo");
    expect(b).toBeUndefined();
    expect(c).toEqual([true]);
  });

  it("infers Input object correctly", () => {
    // eslint-disable-next-line
    const input = {
      foo: c.option("string", "--foo").optional(),
      bar: c.positional("string").list(),
    };

    type Inferred = InferInput<typeof input>;
    const value: Inferred = {
      foo: undefined, // string | undefined
      bar: ["a", "b"], // string[]
    };

    expect(value.foo).toBeUndefined();
    expect(value.bar).toEqual(["a", "b"]);
  });
});
