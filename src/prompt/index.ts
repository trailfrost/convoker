import { DEFAULT_THEME, type Theme } from "@/color";
import { validate, type StandardSchemaV1 } from "@/standard-schema";
import { InputValidationError } from "@/error";
import { isDeno, isNode, isBun } from "@/utils";
import * as raw from "./raw";

let theme: Theme = DEFAULT_THEME;

/**
 * Sets the theme of the prompts.
 * @param t The new theme.
 */
export function setTheme(t: Theme) {
  theme = t;
}

/**
 * Base options for prompts.
 */
export interface BaseOpts<T> {
  /**
   * The message of the prompt.
   */
  message: string;
  /**
   * An `AbortSignal` to cancel the prompt.
   */
  signal?: AbortSignal;
  /**
   * The default value.
   */
  default?: T;
  /**
   * The theme of the prompt.
   */
  theme?: Theme;
  /**
   * A validator function, or a Standard Schema validator.
   */
  validate?: StandardSchemaV1<any, T> | ((value: T) => boolean | T);
}

// -- text -- //

/**
 * Options for text input.
 */
export interface TextOpts extends BaseOpts<string> {
  /**
   * A placeholder, displayed when the user hasn't typed anything yet.
   */
  placeholder?: string;
  /**
   * Minimum length of the input.
   */
  minLength?: number;
  /**
   * Maximum length of the input.
   */
  maxLength?: number;
}

/**
 * Prompts the user for text input.
 * @param opts Options for text input.
 * @returns The text the user typed in, or the default.
 */
export async function text(opts: TextOpts): Promise<string> {
  const th = opts.theme ?? theme;
  const message = th.primary(opts.message) + " ";
  const answer = await raw.readLine(message, opts.default);

  if (opts.minLength && answer.length < opts.minLength)
    throw new InputValidationError([
      `Must be at least ${opts.minLength} characters`,
    ]);
  if (opts.maxLength && answer.length > opts.maxLength)
    throw new InputValidationError([
      `Must be at most ${opts.maxLength} characters`,
    ]);

  if (typeof opts.validate === "function") {
    if (!opts.validate(answer))
      throw new InputValidationError([
        "Validation function returned a falsy value",
      ]);
  } else if (opts.validate) {
    validate(opts.validate, answer);
  }
  return answer;
}

// -- password -- //

/**
 * Options for password input.
 */
export interface PasswordOpts extends TextOpts {
  /**
   * The mask for the password input.
   */
  mask?: string;
  /**
   * If the user should be asked to confirm the password, by typing it again.
   */
  confirm?: boolean;
}

/**
 * Prompts the user for a password.
 * @param opts Options for password input.
 * @returns The password.
 */
export async function password(opts: PasswordOpts): Promise<string> {
  const th = opts.theme ?? theme;
  const first = await raw.readLine(th.primary(opts.message) + " ", undefined, {
    masked: true,
    maskChar: opts.mask ?? "*",
  });
  if (opts.confirm) {
    const second = await raw.readLine(
      th.secondary("Confirm password: "),
      undefined,
      {
        masked: true,
        maskChar: opts.mask ?? "*",
      },
    );
    if (first !== second) throw new Error(th.error("Passwords do not match"));
  }
  return first;
}

// -- select -- //

/**
 * An option for select input.
 */
export interface SelectOption<T> {
  /**
   * The label (what gets displayed) of the select option.
   */
  label: string;
  /**
   * The value (what gets returned) of the select option.
   */
  value: T;
  /**
   * A description of the option.
   */
  hint?: string;
  /**
   * If this option is disabled.
   */
  disabled?: boolean;
}

/**
 * Options for select input.
 */
export interface SelectOpts<T> extends BaseOpts<T> {
  /**
   * Every option the user can pick from.
   */
  options: SelectOption<T>[];
  /**
   * The initial option selected.
   */
  initialIndex?: number;
}

/**
 * Prompts the user to select a single option.
 * @param opts Options for select input.
 * @returns The selected option's value.
 */
export async function select<T>(opts: SelectOpts<T>): Promise<T> {
  const th = opts.theme ?? theme;
  const options = opts.options;
  let index = opts.initialIndex ?? 0;

  const render = () => {
    raw.clearLines(options.length + 1);
    console.log(th.primary(opts.message));
    for (let i = 0; i < options.length; i++) {
      const o = options[i];
      const prefix = i === index ? (th.accent?.("> ") ?? "> ") : "  ";
      const label = o.disabled
        ? th.secondary(o.label)
        : (th.foreground?.(o.label) ?? o.label);
      console.log(prefix + label);
    }
  };

  console.log(th.primary(opts.message));
  options.forEach((o, i) =>
    console.log(`${i === index ? "> " : "  "}${o.label}`),
  );

  while (true) {
    const key = await raw.readKey();
    if (key === "up" && index > 0) index--;
    else if (key === "down" && index < options.length - 1) index++;
    else if (key === "enter") {
      const choice = options[index];
      if (choice.disabled) continue;
      raw.clearLines(options.length + 1);
      console.log(th.success(`${th.symbols?.success ?? "✔"} ${choice.label}`));
      return choice.value;
    }
    render();
  }
}

/**
 * Prompts the user to select multiple options.
 * @param opts Options for select input.
 * @returns The selected options.
 */
export async function multiselect<T>(opts: SelectOpts<T>): Promise<T[]> {
  const th = opts.theme ?? theme;
  const options = opts.options;
  let index = opts.initialIndex ?? 0;
  const selected = new Set<number>();

  const render = () => {
    raw.clearLines();
    console.log(th.primary(opts.message));
    options.forEach((opt, i) => {
      const prefix = i === index ? (th.accent?.("> ") ?? "> ") : "  ";
      const mark = selected.has(i) ? th.success("[x]") : "[ ]";
      console.log(prefix + mark + " " + opt.label);
    });
  };

  render();
  while (true) {
    const key = await raw.readKey();
    if (key === "up" && index > 0) index--;
    else if (key === "down" && index < options.length - 1) index++;
    else if (key === "space") {
      if (selected.has(index)) selected.delete(index);
      else selected.add(index);
    } else if (key === "return") {
      const chosen = Array.from(selected).map((i) => options[i].value);
      raw.clearLines(options.length + 1);
      console.log(th.success(`${opts.message} ${chosen.length} selected`));
      return chosen;
    }
    raw.cursorUp(options.length);
    render();
  }
}

// -- search -- //

/**
 * Options for search input.
 */
export interface SearchOpts<T> extends BaseOpts<T> {
  /**
   * Every option the user can search through.
   */
  options: SelectOption<T>[];
  /**
   * Placeholder for the search input.
   */
  placeholder?: string;
  /**
   * Minimum length for a query string.
   */
  minQueryLength?: number;
  /**
   * Filters a single option.
   * @param query The search query.
   * @param option The option to filter.
   */
  filter?(query: string, option: SelectOption<T>): boolean;
}

/**
 * Prompts the user to search through a list of options.
 * @param opts Options for search input.
 * @returns The selected option.
 */
export async function search<T>(opts: SearchOpts<T>): Promise<T> {
  const th = opts.theme ?? theme;
  let query = "";
  const filter =
    opts.filter ?? ((q, o) => o.label.toLowerCase().includes(q.toLowerCase()));
  while (true) {
    raw.clearLines();
    console.log(th.primary(opts.message));
    const matches = opts.options.filter((o) => filter(query, o));
    matches.forEach((o) =>
      console.log("  " + (th.foreground?.(o.label) ?? o.label)),
    );
    const input = await raw.readLine(th.secondary(`Search: ${query}`));
    if (input === "") continue;
    query = input;
    if (matches.length === 1) return matches[0].value;
  }
}

// -- confirm -- //

/**
 * Options for confirm input.
 */
export interface ConfirmOpts extends BaseOpts<boolean> {
  /**
   * What gets displayed for the Yes option.
   */
  yesLabel?: string;
  /**
   * What gets displayed for the No option.
   */
  noLabel?: string;
}

/**
 * Prompts the user to confirm an action.
 * @param opts Options for confirm input.
 * @returns If the user picked Yes.
 */
export async function confirm(opts: ConfirmOpts): Promise<boolean> {
  const th = opts.theme ?? theme;
  const yes = opts.yesLabel ?? "y";
  const no = opts.noLabel ?? "n";
  const def = opts.default ? yes : no;
  const res = await raw.readLine(
    `${th.primary(opts.message)} ${th.secondary(`[${yes}/${no}] (default: ${def})`)} `,
  );
  if (!res) return !!opts.default;
  return /^y/i.test(res.trim());
}

// -- editor -- //

/**
 * Options for opening the system editor.
 */
export interface EditorOpts extends BaseOpts<string> {
  /**
   * The initial value.
   */
  initial?: string;
  /**
   * The language of the value.
   */
  language?: string;
  /**
   * If the input is required for continuing or not.
   */
  required?: boolean;
}

/**
 * Opens the system editor, or asks for input in the terminal as fallback.
 * @param opts Options for opening the system editor.
 * @returns The result of the system editor.
 */
export async function editor(opts: EditorOpts): Promise<string> {
  const th = opts.theme ?? {
    primary: (s: string) => s,
    secondary: (s: string) => s,
  };

  console.log(th.primary(opts.message ?? "Please enter text:"));
  console.log(th.secondary("Press Ctrl+D (or save & close editor) when done."));

  try {
    const result = await openSystemEditor(opts.initial ?? "");
    if (opts.required && !result.trim()) throw new Error("Input required.");
    return result;
  } catch {
    // fallback: cross-runtime multiline input
    const value = await raw.readLine("", opts.initial, { multiline: true });
    if (opts.required && !value.trim()) throw new Error("Input required.");
    return value;
  }
}

/**
 * Opens the system editor on a temporary file.
 * @param initial Initial contents of the file.
 * @returns The contents of the file after saving.
 */
async function openSystemEditor(initial: string): Promise<string> {
  const tmpFile = `edit-${Date.now()}.txt`;

  if (isDeno) {
    const tmpDir = Deno.env.get("TMPDIR") ?? "/tmp";
    const path = `${tmpDir}/${tmpFile}`;
    await Deno.writeTextFile(path, initial ?? "");

    const editor = Deno.env.get("EDITOR") ?? "vi";
    const p = new Deno.Command(editor, {
      args: [path],
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();

    const status = await p.status;
    if (!status.success)
      throw new Error(`${editor} exited with ${status.code}`);

    const text = await Deno.readTextFile(path);
    await Deno.remove(path).catch(() => {});
    return text;
  }

  if (isBun) {
    const { $ } = await import("bun");
    const path = `/tmp/${tmpFile}`;
    await Bun.write(path, initial ?? "");
    const editor = process.env.EDITOR ?? "vi";
    await $`${editor} ${path}`;
    const text = await Bun.file(path).text();
    await Bun.write(path, ""); // or remove if supported
    return text;
  }

  if (isNode) {
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { promises: fs } = await import("node:fs");
    const { spawn } = await import("node:child_process");

    const path = join(tmpdir(), tmpFile);
    await fs.writeFile(path, initial ?? "", "utf8");

    const editor =
      process.env.EDITOR ||
      process.env.VISUAL ||
      (process.platform === "win32" ? "notepad" : "vi");

    return new Promise((resolve, reject) => {
      const child = spawn(editor, [path], { stdio: "inherit" });
      child.on("exit", async (code: number) => {
        if (code !== 0) {
          reject(new Error(`${editor} exited with code ${code}`));
          return;
        }
        try {
          const data = await fs.readFile(path, "utf8");
          await fs.unlink(path).catch(() => {});
          resolve(data);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  throw new Error("Unsupported runtime for system editor.");
}

export { raw };
