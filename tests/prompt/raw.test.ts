import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// --------------- GLOBAL SETUP FOR READLINE MOCK ------------------

// mock function placeholders — mutable at runtime
const mockQuestion = vi.fn();
const mockClose = vi.fn();
const mockInterface = {
  question: mockQuestion,
  close: mockClose,
  _writeToOutput: vi.fn(),
};
const mockCreateInterface = vi.fn(() => mockInterface);

// static hoisted mock — Vitest requirement
vi.mock("node:readline", () => ({
  createInterface: mockCreateInterface,
}));

// -----------------------------------------------------------------

describe("readLine", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("should return user input via readline (Node)", async () => {
    mockQuestion.mockImplementation((_msg, cb) => cb("test input"));

    const { readLine } = await import("@/prompt/raw");
    const result = await readLine("Enter value: ");
    expect(mockCreateInterface).toHaveBeenCalled();
    expect(result).toBe("test input");
  });

  test("should use default value if no input is provided", async () => {
    mockQuestion.mockImplementation((_msg, cb) => cb(""));

    const { readLine } = await import("@/prompt/raw");
    const result = await readLine("Prompt: ", "default");
    expect(result).toBe("default");
  });

  test("should mask input when opts.masked is true", async () => {
    const localWrite = vi.fn();
    mockInterface._writeToOutput = localWrite;
    mockQuestion.mockImplementation((_msg, cb) => cb("secret"));

    const { readLine } = await import("@/prompt/raw");
    await readLine("Password: ", undefined, { masked: true, maskChar: "#" });

    // simulate manual write
    mockInterface._writeToOutput("abc");
    expect(localWrite).toHaveBeenCalled();
  });
});

describe("readKey", () => {
  test("should resolve 'enter' when receiving newline", async () => {
    const stdin: any = {
      setRawMode: vi.fn(),
      resume: vi.fn(),
      pause: vi.fn(),
      once: vi.fn(),
    };
    vi.stubGlobal("process", { stdin });

    const { readKey } = await import("@/prompt/raw");

    const promise = readKey();
    const handler = stdin.once.mock.calls[0][1];
    handler(Buffer.from("\n"));
    const result = await promise;
    expect(result).toBe("enter");
  });

  test("should resolve arrow keys", async () => {
    const stdin: any = {
      setRawMode: vi.fn(),
      resume: vi.fn(),
      pause: vi.fn(),
      once: vi.fn(),
    };
    vi.stubGlobal("process", { stdin });

    const { readKey } = await import("@/prompt/raw");

    const promise = readKey();
    const handler = stdin.once.mock.calls[0][1];
    handler(Buffer.from("\u001b[A"));
    const result = await promise;
    expect(result).toBe("up");
  });
});

describe("cursor and clear functions", () => {
  let writeSpy: any;

  beforeEach(() => {
    if (!process.stdout) {
      process.stdout = { write: () => true };
    }
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy?.mockRestore?.();
  });

  test("clearLines should write correct escape sequences", async () => {
    const { clearLines } = await import("@/prompt/raw");
    clearLines(2);
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining("\x1b[2K\x1b[1A"),
    );
    expect(writeSpy).toHaveBeenLastCalledWith("\x1b[2K\r");
  });

  test("cursorUp should move cursor up", async () => {
    const { cursorUp } = await import("@/prompt/raw");
    cursorUp(3);
    expect(writeSpy).toHaveBeenCalledWith("\x1b[3A");
  });

  test("cursorDown should move cursor down", async () => {
    const { cursorDown } = await import("@/prompt/raw");
    cursorDown(2);
    expect(writeSpy).toHaveBeenCalledWith("\x1b[2B");
  });
});
