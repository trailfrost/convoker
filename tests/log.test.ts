import { beforeEach, describe, expect, test, vi } from "vitest";
import { setTheme, setConfig, trace, info, warn, error, fatal } from "@/log";
import { DEFAULT_THEME } from "@/color";

describe("logging module", () => {
  let stdout: WritableStream<string>;
  let stderr: WritableStream<string>;
  let stdoutChunks: string[];
  let stderrChunks: string[];

  beforeEach(async () => {
    stdoutChunks = [];
    stderrChunks = [];

    stdout = new WritableStream({
      write(chunk) {
        stdoutChunks.push(chunk);
      },
    });

    stderr = new WritableStream({
      write(chunk) {
        stderrChunks.push(chunk);
      },
    });

    await setConfig({
      stdout,
      stderr,
      stdin: new ReadableStream(),
      format: "text",
    });

    setTheme(DEFAULT_THEME);
  });

  test("trace writes to stdout", async () => {
    await trace("hello", "world");
    expect(stdoutChunks.length).toBe(1);
    expect(stdoutChunks[0]).toContain("hello world");
  });

  test("info writes to stdout", async () => {
    await info("info message");
    expect(stdoutChunks.length).toBe(1);
    expect(stdoutChunks[0]).toContain("INFO");
    expect(stdoutChunks[0]).toContain("info message");
  });

  test("warn writes to stdout", async () => {
    await warn("warning message");
    expect(stdoutChunks.length).toBe(1);
    expect(stdoutChunks[0]).toContain("WARN");
    expect(stdoutChunks[0]).toContain("warning message");
  });

  test("error writes to stderr", async () => {
    await error("error message");
    expect(stderrChunks.length).toBe(1);
    expect(stderrChunks[0]).toContain("ERROR");
    expect(stderrChunks[0]).toContain("error message");
  });

  test("fatal writes to stderr", async () => {
    // @ts-expect-error `process` is a global in Node.js and Bun
    const exitMock = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    await expect(fatal("fatal error")).rejects.toThrow("process.exit called");
    expect(stderrChunks.length).toBe(1);
    expect(stderrChunks[0]).toContain("FATAL");
    expect(stderrChunks[0]).toContain("fatal error");

    exitMock.mockRestore();
  });

  test("supports JSON format", async () => {
    await setConfig({ stdout, stderr, format: "json" });

    await info({ key: "value" });
    const msg = JSON.parse(stdoutChunks[0]);
    expect(msg).toHaveProperty("timestamp");
    expect(msg.level).toBe("info");
    expect(msg.message).toContain('"key": "value"');
  });

  test("supports XML format", async () => {
    await setConfig({ stdout, stderr, format: "xml" });

    await info("xml test");
    expect(stdoutChunks[0]).toContain("<log>");
    expect(stdoutChunks[0]).toContain("<level>info</level>");
    expect(stdoutChunks[0]).toContain("xml test");
  });

  test("supports YAML format", async () => {
    await setConfig({ stdout, stderr, format: "yaml" });

    await info("yaml test");
    expect(stdoutChunks[0]).toContain("level: info");
    expect(stdoutChunks[0]).toContain("yaml test");
  });

  test("supports CSV format", async () => {
    await setConfig({ stdout, stderr, format: "csv" });

    await info("csv test");
    expect(stdoutChunks[0]).toMatch(/"info","csv test"/);
  });
});
