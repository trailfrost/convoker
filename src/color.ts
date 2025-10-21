function detectColorSupport() {
  // If running in a browser-like environment, return false
  if (typeof window !== "undefined" && typeof window.document !== "undefined") {
    return false;
  }

  // @ts-expect-error `process` is a global in Node and Bun
  const env = typeof process !== "undefined" ? (process.env ?? {}) : {};

  // Force-disable colors if NO_COLOR is set
  if ("NO_COLOR" in env) return false;

  // Force-enable if FORCE_COLOR is set
  if ("FORCE_COLOR" in env) return true;

  // Check for CI systems that support color
  if ("CI" in env) {
    if (
      [
        "TRAVIS",
        "CIRCLECI",
        "APPVEYOR",
        "GITLAB_CI",
        "GITHUB_ACTIONS",
        "BUILDKITE",
        "DRONE",
      ].some((k) => k in env) ||
      env.CI_NAME === "codeship"
    ) {
      return true;
    }
    return false;
  }

  // Deno detection
  // @ts-expect-error `Deno` is a global in Deno
  if (typeof Deno !== "undefined" && Deno.noColor !== undefined) {
    // @ts-expect-error `Deno` is a global in Deno
    return !Deno.noColor;
  }

  // Node.js or Bun detection
  if (
    // @ts-expect-error `process` is a global in Node.js and Bun
    typeof process !== "undefined" &&
    // @ts-expect-error `process` is a global in Node.js and Bun
    process.stdout
  ) {
    const term = env.TERM || "";
    const colorterm = env.COLORTERM || "";

    if (colorterm.length > 0) return true;
    if (term === "dumb") return false;

    return /(color|ansi|cygwin|xterm|vt100)/i.test(term);
  }

  // Other runtimes/Node without TTY
  return false;
}

export const supportsColor = detectColorSupport();

export function createAnsiColor(
  open: number,
  close: number
): (input: any) => string {
  const openCode = `\u001b[${open}m`;
  const closeCode = `\u001b[${close}m`;

  if (!supportsColor) return (input) => input + "";

  return (input) => {
    if (!input) return openCode + closeCode;

    const str = input + "";
    // replace any existing close codes with reopen
    const replaced = str.replace(
      new RegExp(`\u001b\\[${close}m`, "g"),
      closeCode + openCode
    );
    return openCode + replaced + closeCode;
  };
}

export const reset = createAnsiColor(0, 0);
export const bold = createAnsiColor(1, 22);
export const dim = createAnsiColor(2, 22);
export const italic = createAnsiColor(3, 23);
export const underline = createAnsiColor(4, 24);
export const overline = createAnsiColor(53, 55);
export const inverse = createAnsiColor(7, 27);
export const hidden = createAnsiColor(8, 28);
export const strikethrough = createAnsiColor(9, 29);

export const black = createAnsiColor(30, 39);
export const red = createAnsiColor(31, 39);
export const green = createAnsiColor(32, 39);
export const yellow = createAnsiColor(33, 39);
export const blue = createAnsiColor(34, 39);
export const magenta = createAnsiColor(35, 39);
export const cyan = createAnsiColor(36, 39);
export const white = createAnsiColor(37, 39);
export const gray = createAnsiColor(90, 39);

export const bgBlack = createAnsiColor(40, 49);
export const bgRed = createAnsiColor(41, 49);
export const bgGreen = createAnsiColor(42, 49);
export const bgYellow = createAnsiColor(43, 49);
export const bgBlue = createAnsiColor(44, 49);
export const bgMagenta = createAnsiColor(45, 49);
export const bgCyan = createAnsiColor(46, 49);
export const bgWhite = createAnsiColor(47, 49);
export const bgGray = createAnsiColor(100, 49);

export const redBright = createAnsiColor(91, 39);
export const greenBright = createAnsiColor(92, 39);
export const yellowBright = createAnsiColor(93, 39);
export const blueBright = createAnsiColor(94, 39);
export const magentaBright = createAnsiColor(95, 39);
export const cyanBright = createAnsiColor(96, 39);
export const whiteBright = createAnsiColor(97, 39);

export const bgRedBright = createAnsiColor(101, 49);
export const bgGreenBright = createAnsiColor(102, 49);
export const bgYellowBright = createAnsiColor(103, 49);
export const bgBlueBright = createAnsiColor(104, 49);
export const bgMagentaBright = createAnsiColor(105, 49);
export const bgCyanBright = createAnsiColor(106, 49);
export const bgWhiteBright = createAnsiColor(107, 49);

export interface Theme {
  background?(a: string): string;
  foreground?(a: string): string;
  primary(a: string): string;
  secondary(a: string): string;
  accent?(a: string): string;

  success(a: string): string;
  warning(a: string): string;
  error(a: string): string;
  info?(a: string): string;

  symbols?: {
    success: string;
    error: string;
    warning: string;
    info?: string;
  };

  styles?: {
    bold?(a: string): string;
    italic?(a: string): string;
    underline?(a: string): string;
  };
}

export const DEFAULT_THEME: Theme = {
  primary: cyan,
  secondary: gray,

  success: green,
  warning: yellow,
  error: red,

  symbols: {
    success: "✔",
    error: "✖",
    warning: "⚠",
  },

  styles: {
    bold: bold,
    italic: italic,
    underline: underline,
  },
};

export function defineTheme(theme: Partial<Theme>): Theme {
  return merge(DEFAULT_THEME, theme) as Theme;
}

type Primitive = string | number | boolean | symbol | null | undefined | bigint;

export type DeepMerge<T, U> = T extends Primitive
  ? U
  : U extends Primitive
    ? U
    : T extends Array<infer TItem>
      ? U extends Array<infer UItem>
        ? Array<DeepMerge<TItem, UItem>>
        : U
      : T extends object
        ? U extends object
          ? {
              [K in keyof T | keyof U]: K extends keyof U
                ? K extends keyof T
                  ? DeepMerge<T[K], U[K]>
                  : U[K]
                : K extends keyof T
                  ? T[K]
                  : never;
            }
          : U
        : U;

function isPlainObject(value: any): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function merge<T, U>(source: T, target: U): DeepMerge<T, U> {
  if (Array.isArray(source) && Array.isArray(target)) {
    // Replace arrays
    return target as any;
  }

  if (isPlainObject(source) && isPlainObject(target)) {
    const result: any = {};
    const keys = new Set([...Object.keys(source), ...Object.keys(target)]);
    keys.forEach((key) => {
      const sourceVal = (source as any)[key];
      const targetVal = (target as any)[key];

      if (sourceVal !== undefined && targetVal !== undefined) {
        result[key] = merge(sourceVal, targetVal);
      } else if (targetVal !== undefined) {
        result[key] = targetVal;
      } else {
        result[key] = sourceVal;
      }
    });
    return result;
  }

  // For class instances or primitives, always use target
  return target as any;
}
