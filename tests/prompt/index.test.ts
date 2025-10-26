import { describe, expect, test, vi, beforeEach } from "vitest";
import * as prompt from "@/prompt";
import * as raw from "@/prompt/raw";
import { DEFAULT_THEME } from "@/color";

vi.mock("@/prompt/raw", () => ({
  readLine: vi.fn(),
  readKey: vi.fn(),
  clearLines: vi.fn(),
  cursorUp: vi.fn(),
}));

describe("@/prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prompt.setTheme(DEFAULT_THEME);
  });

  // --- text() ---
  test("text() returns user input", async () => {
    (raw.readLine as any).mockResolvedValue("hello");
    const res = await prompt.text({ message: "Enter:", default: "" });
    expect(res).toBe("hello");
  });

  test("text() throws if below minLength", async () => {
    (raw.readLine as any).mockResolvedValue("hi");
    await expect(
      prompt.text({ message: "Name", minLength: 3 })
    ).rejects.toThrow("Must be at least 3 characters");
  });

  test("text() throws if above maxLength", async () => {
    (raw.readLine as any).mockResolvedValue("abcdef");
    await expect(
      prompt.text({ message: "Name", maxLength: 5 })
    ).rejects.toThrow("Must be at most 5 characters");
  });

  test("text() throws if validate() returns false", async () => {
    (raw.readLine as any).mockResolvedValue("bad");
    await expect(
      prompt.text({
        message: "Validate",
        validate: () => false,
      })
    ).rejects.toThrow("Validation failed");
  });

  // --- password() ---
  test("password() returns masked input", async () => {
    (raw.readLine as any).mockResolvedValueOnce("secret");
    const result = await prompt.password({ message: "Enter password" });
    expect(result).toBe("secret");
  });

  test("password() confirm mismatch throws", async () => {
    (raw.readLine as any)
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    await expect(
      prompt.password({ message: "Enter", confirm: true })
    ).rejects.toThrow(/Passwords do not match/);
  });

  test("password() confirm match returns", async () => {
    (raw.readLine as any)
      .mockResolvedValueOnce("same")
      .mockResolvedValueOnce("same");
    const result = await prompt.password({ message: "Enter", confirm: true });
    expect(result).toBe("same");
  });

  // --- select() ---
  test("select() navigates and selects option", async () => {
    const options = [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ];

    (raw.readKey as any)
      .mockResolvedValueOnce("down")
      .mockResolvedValueOnce("enter");

    const result = await prompt.select({
      message: "Pick one",
      options,
    });

    expect(result).toBe("b");
    expect(raw.clearLines).toHaveBeenCalled();
  });

  test("select() skips disabled option", async () => {
    const options = [
      { label: "A", value: "a", disabled: true },
      { label: "B", value: "b" },
    ];

    (raw.readKey as any)
      .mockResolvedValueOnce("enter") // tries disabled
      .mockResolvedValueOnce("down")
      .mockResolvedValueOnce("enter");

    const result = await prompt.select({ message: "Pick", options });
    expect(result).toBe("b");
  });

  // --- multiselect() ---
  test("multiselect() selects multiple options", async () => {
    const options = [
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ];

    (raw.readKey as any)
      .mockResolvedValueOnce("space") // select first
      .mockResolvedValueOnce("down")
      .mockResolvedValueOnce("space") // select second
      .mockResolvedValueOnce("return");

    const result = await prompt.multiselect({
      message: "Pick many",
      options,
    });

    expect(result).toEqual(["a", "b"]);
  });

  // --- confirm() ---
  test("confirm() returns true when user types y", async () => {
    (raw.readLine as any).mockResolvedValue("y");
    const result = await prompt.confirm({ message: "Proceed?" });
    expect(result).toBe(true);
  });

  test("confirm() returns false when user types n", async () => {
    (raw.readLine as any).mockResolvedValue("n");
    const result = await prompt.confirm({ message: "Proceed?" });
    expect(result).toBe(false);
  });

  test("confirm() uses default when input empty", async () => {
    (raw.readLine as any).mockResolvedValue("");
    const result = await prompt.confirm({ message: "Proceed?", default: true });
    expect(result).toBe(true);
  });

  // --- editor() ---
  test("editor() returns entered text", async () => {
    (raw.readLine as any).mockResolvedValue("hello world");
    const res = await prompt.editor({ message: "Edit" });
    expect(res).toBe("hello world");
  });

  test("editor() throws if required and empty", async () => {
    (raw.readLine as any).mockResolvedValue("   ");
    await expect(
      prompt.editor({ message: "Edit", required: true })
    ).rejects.toThrow("Input required.");
  });

  // --- search() ---
  test("search() returns first match when only one remains", async () => {
    const options = [
      { label: "apple", value: 1 },
      { label: "banana", value: 2 },
    ];

    (raw.readLine as any)
      .mockResolvedValueOnce("app")
      .mockResolvedValueOnce(""); // triggers loop continuation

    // To resolve the infinite loop, we'll break early
    const p = prompt.search({ message: "Search", options });
    // let it run a bit, then stop the loop
    setTimeout(() => {
      (raw.readLine as any).mockResolvedValueOnce("apple");
    }, 0);

    const result = await p;
    expect(result).toBe(1);
  });
});
