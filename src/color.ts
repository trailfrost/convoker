import { merge } from "./utils";

/**
 * Detects if the runtime supports colored output.
 * @returns If the runtime supports colored output.
 */
function detectColorSupport() {
  // If running in a browser-like environment, return false
  if (typeof window !== "undefined" && typeof window.document !== "undefined") {
    return false;
  }

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
  if (typeof Deno !== "undefined" && Deno.noColor !== undefined) {
    return !Deno.noColor;
  }

  // Node.js or Bun detection
  if (typeof process !== "undefined" && process.stdout) {
    const term = env.TERM || "";
    const colorterm = env.COLORTERM || "";

    if (colorterm.length > 0) return true;
    if (term === "dumb") return false;

    return /(color|ansi|cygwin|xterm|vt100)/i.test(term);
  }

  // Other runtimes/Node without TTY
  return false;
}

/**
 * If the runtime supports color.
 */
export const supportsColor = detectColorSupport();

/**
 * Creates a function that wraps a string in ANSI codes.
 * @param open The opening ANSI code.
 * @param close The closing ANSI code.
 * @returns A function that wraps the string in ANSI codes.
 */
export function createAnsiColor(
  open: number,
  close: number,
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
      closeCode + openCode,
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

/**
 * A theme.
 */
export interface Theme {
  /**
   * Wraps a string in a background ANSI code.
   * @param a The string to wrap.
   */
  background?(a: string): string;
  /**
   * Wraps a string in a foreground ANSI code.
   * @param a The string to wrap.
   */
  foreground?(a: string): string;
  /**
   * Wraps a string in a primary ANSI code.
   * @param a The string to wrap.
   */
  primary(a: string): string;
  /**
   * Wraps a string in a secondary ANSI code.
   * @param a The string to wrap.
   */
  secondary(a: string): string;
  /**
   * Wraps a string in a accent ANSI code.
   * @param a The string to wrap.
   */
  accent?(a: string): string;

  /**
   * Wraps a string in a success ANSI code.
   * @param a The string to wrap.
   */
  success(a: string): string;
  /**
   * Wraps a string in a warning ANSI code.
   * @param a The string to wrap.
   */
  warning(a: string): string;
  /**
   * Wraps a string in a error ANSI code.
   * @param a The string to wrap.
   */
  error(a: string): string;
  /**
   * Wraps a string in a info ANSI code.
   * @param a The string to wrap.
   */
  info?(a: string): string;

  /**
   * Set of symbols for logging.
   */
  symbols?: {
    /**
     * Success message symbol.
     */
    success: string;
    /**
     * Error message symbol.
     */
    error: string;
    /**
     * Warning message symbol.
     */
    warning: string;
    /**
     * Information message symbol.
     */
    info?: string;
  };

  /**
   * Optional styles.
   */
  styles?: {
    /**
     * Wraps a string in a bold ANSI code.
     * @param a The string to wrap.
     */
    bold?(a: string): string;
    /**
     * Wraps a string in an italic ANSI code.
     * @param a The string to wrap.
     */
    italic?(a: string): string;
    /**
     * Wraps a string in an underline ANSI code.
     * @param a The string to wrap.
     */
    underline?(a: string): string;
  };
}

/**
 * The default theme.
 */
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

/**
 * Defines a theme.
 * @param theme The (partial) theme.
 * @returns The theme, merged with the default theme.
 */
export function defineTheme(theme: Partial<Theme>): Theme {
  return merge(DEFAULT_THEME, theme) as Theme;
}
