import { error } from "../src";
import { validate } from "../src/standard-schema";
import { describe, expect, test } from "vitest";
import * as v from "valibot";

describe("validate()", () => {
  test("validate() returns parsed input", async () => {
    expect(await validate(v.string(), "hello world")).toBe("hello world");
  });

  test("validate() throws on wrong input", () => {
    expect(() => validate(v.string(), 53)).rejects.toThrow(
      error.InputValidationError
    );
  });
});
