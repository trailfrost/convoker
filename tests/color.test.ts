import { describe, test, expect, vi } from "vitest";

// Helper: safely load module with specific mocked environment
async function loadModuleWithEnv({
  env = {},
  isBrowser = false,
  denoNoColor,
}: {
  env?: Record<string, string>;
  isBrowser?: boolean;
  denoNoColor?: boolean;
} = {}) {
  vi.resetModules();

  // Clean globals
  vi.unstubAllGlobals();

  // Mock browser globals
  if (isBrowser) {
    vi.stubGlobal("window", { document: {} });
  }

  // Mock process (safe version)
  vi.stubGlobal("process", {
    env,
    stdout: {},
  });

  // Mock Deno if requested
  if (denoNoColor !== undefined) {
    vi.stubGlobal("Deno", { noColor: denoNoColor });
  }

  const mod = await import("@/color");
  return mod;
}

describe("detectColorSupport / supportsColor", () => {
  test("returns false in browser-like environment", async () => {
    const { supportsColor } = await loadModuleWithEnv({ isBrowser: true });
    expect(supportsColor).toBe(false);
  });

  test("returns false when NO_COLOR is set", async () => {
    const { supportsColor } = await loadModuleWithEnv({
      env: { NO_COLOR: "1" },
    });
    expect(supportsColor).toBe(false);
  });

  test("returns true when FORCE_COLOR is set", async () => {
    const { supportsColor } = await loadModuleWithEnv({
      env: { FORCE_COLOR: "1" },
    });
    expect(supportsColor).toBe(true);
  });

  test("returns true for known CI envs", async () => {
    const { supportsColor } = await loadModuleWithEnv({
      env: { CI: "true", GITHUB_ACTIONS: "true" },
    });
    expect(supportsColor).toBe(true);
  });

  test("returns false for generic CI", async () => {
    const { supportsColor } = await loadModuleWithEnv({
      env: { CI: "true" },
    });
    expect(supportsColor).toBe(false);
  });

  test("returns true if TERM includes 'xterm'", async () => {
    const { supportsColor } = await loadModuleWithEnv({
      env: { TERM: "xterm-256color" },
    });
    expect(supportsColor).toBe(true);
  });

  test("returns false if TERM is 'dumb'", async () => {
    const { supportsColor } = await loadModuleWithEnv({
      env: { TERM: "dumb" },
    });
    expect(supportsColor).toBe(false);
  });

  test("returns true if COLORTERM is set", async () => {
    const { supportsColor } = await loadModuleWithEnv({
      env: { COLORTERM: "truecolor" },
    });
    expect(supportsColor).toBe(true);
  });

  test("handles Deno.noColor correctly", async () => {
    const mod1 = await loadModuleWithEnv({ denoNoColor: true });
    expect(mod1.supportsColor).toBe(false);

    const mod2 = await loadModuleWithEnv({ denoNoColor: false });
    expect(mod2.supportsColor).toBe(true);
  });
});

describe("createAnsiColor", () => {
  test("returns plain text if supportsColor is false", async () => {
    const { createAnsiColor } = await loadModuleWithEnv({
      env: { NO_COLOR: "1" },
    });
    const fn = createAnsiColor(31, 39);
    expect(fn("Hello")).toBe("Hello");
  });

  test("wraps text in ANSI codes if supportsColor is true", async () => {
    const { createAnsiColor } = await loadModuleWithEnv({
      env: { FORCE_COLOR: "1" },
    });
    const fn = createAnsiColor(31, 39);
    const result = fn("Hello");
    expect(result).toContain("\u001b[31m");
    expect(result).toContain("\u001b[39m");
  });
});

describe("exported color functions", () => {
  test("apply correct ANSI codes", async () => {
    const mod = await loadModuleWithEnv({ env: { FORCE_COLOR: "1" } });

    const pairs: [string, string, string][] = [
      ["red", "\u001b[31m", "\u001b[39m"],
      ["bold", "\u001b[1m", "\u001b[22m"],
      ["bgBlue", "\u001b[44m", "\u001b[49m"],
      ["greenBright", "\u001b[92m", "\u001b[39m"],
    ];

    for (const [name, open, close] of pairs) {
      const fn = (mod as any)[name];
      const out = fn("Hi");
      expect(out.startsWith(open)).toBe(true);
      expect(out.endsWith(close)).toBe(true);
    }
  });
});
