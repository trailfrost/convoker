import { DEFAULT_THEME, type Theme } from "./color";
import { merge, isNode, isDeno, isBun } from "./utils";

/**
 * The logger configuration.
 */
export interface LogConfig {
  /**
   * The format to print as.
   */
  format: "text" | "json" | "xml" | "yaml" | "csv";
  /**
   * Standard output.
   */
  stdout: WritableStream<string>;
  /**
   * Standard error.
   */
  stderr: WritableStream<string>;
  /**
   * Standard input.
   */
  stdin: ReadableStream<string>;
}

/**
 * Gets the default stdout, in a cross-runtime way.
 * @returns The default stdout.
 */
async function getDefaultStdout() {
  if (isNode && process.stdout?.writable) {
    const { Writable } = await import("node:stream");

    return Writable.toWeb(process.stdout);
  }

  if (isDeno && Deno.stdout?.writable) {
    return Deno.stdout.writable;
  }

  if (isBun && Bun.stdout) {
    return Bun.stdout;
  }
  // Workers: emulate with console.log
  return new WritableStream({
    write(chunk) {
      console.log(String(chunk));
    },
  });
}

/**
 * Gets the default stderr, in a cross-runtime way.
 * @returns The default stderr.
 */
async function getDefaultStderr() {
  if (isNode && process.stderr?.writable) {
    const { Writable } = await import("node:stream");

    return Writable.toWeb(process.stderr);
  }

  if (isDeno && Deno.stderr?.writable) {
    return Deno.stderr.writable;
  }

  if (isBun && Bun.stderr) {
    return Bun.stderr;
  }
  // Workers: emulate with console.error
  return new WritableStream({
    write(chunk) {
      console.error(String(chunk));
    },
  });
}

/**
 * Gets the default stdin, in a cross-runtime way.
 * @returns The default stdin.
 */
async function getDefaultStdin() {
  if (isNode && process.stdin?.readable) {
    const { Readable } = await import("node:stream");
    return Readable.toWeb(process.stdin);
  }

  if (isDeno && Deno.stdin?.readable) {
    return Deno.stdin.readable;
  }
  if (isBun) {
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

/**
 * Sets a new theme.
 * @param t The theme.
 */
export function setTheme(t: Theme) {
  theme = t;
}

/**
 * Sets new configuration.
 * @param c The config.
 */
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

/**
 * Sets default configuration.
 */
export async function setup() {
  await setConfig({});
}

/**
 * Formats a message to the correct format.
 * @param level The level of mesage.
 * @param msgs The messages to format.
 * @returns The formatted message.
 */
function formatMessages(level: string, ...msgs: any[]): string {
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

/**
 * Colorizes text.
 * @param level The log level.
 * @param text The text to colorize.
 * @returns The colorized text.
 */
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

/**
 * Writes to a stream.
 * @param stream The stream to write to.
 * @param msg The message to write.
 */
async function writeToStream(stream: WritableStream<string>, msg: string) {
  const writer = stream.getWriter();
  try {
    await writer.write(msg);
  } finally {
    writer.releaseLock();
  }
}

/**
 * Prints debug information.
 * @param msgs The messages to write.
 */
export async function trace(...msgs: any[]) {
  const formatted = formatMessages("trace", ...msgs);
  const colored = colorize("trace", formatted);
  await writeToStream(config.stdout, colored);
}

/**
 * Prints information.
 * @param msgs The messages to write.
 */
export async function info(...msgs: any[]) {
  const formatted = formatMessages("info", ...msgs);
  const colored = colorize("info", formatted);
  await writeToStream(config.stdout, colored);
}

/**
 * Prints warnings.
 * @param msgs The messages to write.
 */
export async function warn(...msgs: any[]) {
  const formatted = formatMessages("warn", ...msgs);
  const colored = colorize("warn", formatted);
  await writeToStream(config.stdout, colored);
}

/**
 * Prints errors.
 * @param msgs The messages to write.
 */
export async function error(...msgs: any[]) {
  const formatted = formatMessages("error", ...msgs);
  const colored = colorize("error", formatted);
  await writeToStream(config.stderr, colored);
}

/**
 * Prints errors and exits.
 * @param msgs The messages to write.
 */
export async function fatal(...msgs: any[]) {
  const formatted = formatMessages("fatal", ...msgs);
  const colored = colorize("fatal", formatted);
  await writeToStream(config.stderr, colored);

  // Exit depending on runtime
  if (isDeno) {
    Deno.exit(-1);
  } else if (isNode || isBun) {
    process.exit(-1);
  }
}
