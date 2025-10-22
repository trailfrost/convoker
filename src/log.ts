import { merge, DEFAULT_THEME, type Theme } from "./color";

export interface LogConfig {
  format: "text" | "json" | "xml" | "yaml" | "csv";
  stdout: WritableStream<string>;
  stderr: WritableStream<string>;
  stdin: ReadableStream<string>;
}

const isNode =
  // @ts-expect-error `process` is a global in Node
  typeof process !== "undefined" &&
  // @ts-expect-error `process` is a global in Node
  process.versions != null &&
  // @ts-expect-error `process` is a global in Node
  process.versions.node != null;

const isDeno =
  // @ts-expect-error `Deno` is a global in Deno
  typeof Deno !== "undefined" && typeof Deno.version?.deno === "string";

// @ts-expect-error `Bun` is a global in Bun
const isBun = typeof Bun !== "undefined" && typeof Bun.version === "string";

async function getDefaultStdout() {
  // @ts-expect-error `process` is a global in Node
  if (isNode && process.stdout?.writable) {
    // @ts-expect-error `node:stream` exists in Node
    const { Writable } = await import("node:stream");
    // @ts-expect-error `process` is a global in Node
    return Writable.toWeb(process.stdout);
  }
  // @ts-expect-error `Deno` is a global in Deno
  if (isDeno && Deno.stdout?.writable) {
    // @ts-expect-error `Deno` is a global in Deno
    return Deno.stdout.writable;
  }
  // @ts-expect-error `Bun` is a global in Bun
  if (isBun && Bun.stdout) {
    // @ts-expect-error `Bun` is a global in Bun
    return Bun.stdout;
  }
  // Workers: emulate with console.log
  return new WritableStream({
    write(chunk) {
      console.log(String(chunk));
    },
  });
}

async function getDefaultStderr() {
  // @ts-expect-error `process` is a global in Node
  if (isNode && process.stderr?.writable) {
    // @ts-expect-error `node:stream` exists in Node
    const { Writable } = await import("node:stream");
    // @ts-expect-error `process` is a global in Node
    return Writable.toWeb(process.stderr);
  }
  // @ts-expect-error `Deno` is a global in Deno
  if (isDeno && Deno.stderr?.writable) {
    // @ts-expect-error `Deno` is a global in Deno
    return Deno.stderr.writable;
  }
  // @ts-expect-error `Bun` is a global in Bun
  if (isBun && Bun.stderr) {
    // @ts-expect-error `Bun` is a global in Bun
    return Bun.stderr;
  }
  // Workers: emulate with console.error
  return new WritableStream({
    write(chunk) {
      console.error(String(chunk));
    },
  });
}

async function getDefaultStdin() {
  // @ts-expect-error `process` is a global in Node
  if (isNode && process.stdin?.readable) {
    // @ts-expect-error `node:stream` exists in Node
    const { Readable } = await import("node:stream"); // @ts-expect-error `process` is a global in Node
    return Readable.toWeb(process.stdin);
  }
  // @ts-expect-error `Deno` is a global in Deno
  if (isDeno && Deno.stdin?.readable) {
    // @ts-expect-error `Deno` is a global in Deno
    return Deno.stdin.readable;
  }
  if (isBun) {
    // @ts-expect-error `Bun` is a global in Bun
    return Bun.stdin.stream();
  }
  // Workers don't support stdin
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

let theme: Theme = DEFAULT_THEME;
let config: LogConfig = undefined!;

export function setTheme(t: Theme) {
  theme = t;
}

export async function setConfig(c: Partial<LogConfig>) {
  config = merge(
    {
      format: "text",
      stdout: await getDefaultStdout(),
      stderr: await getDefaultStderr(),
      stdin: await getDefaultStdin(),
    },
    c,
  ) as LogConfig;
}

export async function setup() {
  await setConfig({});
}

function formatMessage(level: string, ...msgs: any[]): string {
  const timestamp = new Date().toISOString();
  const msg = msgs
    .map((m) => (typeof m === "string" ? m : JSON.stringify(m, null, 2)))
    .join(" ");

  switch (config.format) {
    case "json":
      return JSON.stringify({ timestamp, level, message: msg }) + "\n";
    case "xml":
      return `<log>
  <timestamp>${timestamp}</timestamp>
  <level>${level}</level>
  <message>${msg}</message>
</log>\n`;
    case "yaml":
      return `- timestamp: ${timestamp}
  level: ${level}
  message: "${msg.replace(/"/g, '\\"')}"\n`;
    case "csv":
      return `"${timestamp}","${level}","${msg.replace(/"/g, '""')}"\n`;
    case "text":
    default:
      return `[${timestamp}] [${level.toUpperCase()}] ${msg}\n`;
  }
}

function colorize(level: string, text: string): string {
  switch (level) {
    case "trace":
      return theme.secondary ? theme.secondary(text) : text;
    case "info":
      return theme.info ? theme.info(text) : text;
    case "warn":
      return theme.warning ? theme.warning(text) : text;
    case "error":
      return theme.error ? theme.error(text) : text;
    case "fatal":
      return theme.error
        ? theme.error(theme.styles?.bold?.(text) ?? text)
        : text;
    default:
      return text;
  }
}

async function writeToStream(stream: WritableStream<string>, msg: string) {
  const writer = stream.getWriter();
  try {
    await writer.write(msg);
  } finally {
    writer.releaseLock();
  }
}

export async function trace(...msgs: any[]) {
  const formatted = formatMessage("trace", ...msgs);
  const colored = colorize("trace", formatted);
  await writeToStream(config.stdout, colored);
}

export async function info(...msgs: any[]) {
  const formatted = formatMessage("info", ...msgs);
  const colored = colorize("info", formatted);
  await writeToStream(config.stdout, colored);
}

export async function warn(...msgs: any[]) {
  const formatted = formatMessage("warn", ...msgs);
  const colored = colorize("warn", formatted);
  await writeToStream(config.stdout, colored);
}

export async function error(...msgs: any[]) {
  const formatted = formatMessage("error", ...msgs);
  const colored = colorize("error", formatted);
  await writeToStream(config.stderr, colored);
}

export async function fatal(...msgs: any[]) {
  const formatted = formatMessage("fatal", ...msgs);
  const colored = colorize("fatal", formatted);
  await writeToStream(config.stderr, colored);

  // Exit depending on runtime
  if (isDeno) {
    // @ts-expect-error `Deno` is a global in Deno
    Deno.exit(-1);
  } else if (isNode || isBun) {
    // @ts-expect-error `process` is a global in Node and Bun
    process.exit(-1);
  }
}
