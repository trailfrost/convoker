import { DEFAULT_THEME, type Theme } from "@/color";
import type { StandardSchemaV1 } from "@/standard-schema";
import * as raw from "./raw";

let theme: Theme = DEFAULT_THEME;

export function setTheme(t: Theme) {
  theme = t;
}

export interface BaseOpts<T> {
  message: string;
  signal?: AbortSignal;
  default?: T;
  theme?: Theme;
  validate?: (value: T) => StandardSchemaV1<any, T> | boolean | T;
}

export interface TextOpts extends BaseOpts<string> {
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
}

export async function text(opts: TextOpts): Promise<string> {
  const th = opts.theme ?? theme;
  const message = th.primary(opts.message) + " ";
  const answer = await raw.readLine(message, opts.default);
  if (opts.minLength && answer.length < opts.minLength)
    throw new Error(`Must be at least ${opts.minLength} characters`);
  if (opts.maxLength && answer.length > opts.maxLength)
    throw new Error(`Must be at most ${opts.maxLength} characters`);
  if (opts.validate && !opts.validate(answer))
    throw new Error("Validation failed");
  return answer;
}

export interface PasswordOpts extends TextOpts {
  mask?: string;
  confirm?: boolean;
}

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
      }
    );
    if (first !== second) throw new Error(th.error("Passwords do not match"));
  }
  return first;
}

export interface SelectOption<T> {
  label: string;
  value: T;
  hint?: string;
  disabled?: boolean;
}

export interface SelectOpts<T> extends BaseOpts<T> {
  options: SelectOption<T>[];
  initialIndex?: number;
}

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
    console.log(`${i === index ? "> " : "  "}${o.label}`)
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

export interface SearchOpts<T> extends BaseOpts<T> {
  options: SelectOption<T>[];
  placeholder?: string;
  minQueryLength?: number;
  filter?(query: string, option: SelectOption<T>): boolean;
}

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
      console.log("  " + (th.foreground?.(o.label) ?? o.label))
    );
    const input = await raw.readLine(th.secondary(`Search: ${query}`));
    if (input === "") continue;
    query = input;
    if (matches.length === 1) return matches[0].value;
  }
}

export interface ConfirmOpts extends BaseOpts<boolean> {
  yesLabel?: string;
  noLabel?: string;
}

export async function confirm(opts: ConfirmOpts): Promise<boolean> {
  const th = opts.theme ?? theme;
  const yes = opts.yesLabel ?? "y";
  const no = opts.noLabel ?? "n";
  const def = opts.default ? yes : no;
  const res = await raw.readLine(
    `${th.primary(opts.message)} ${th.secondary(`[${yes}/${no}] (default: ${def})`)} `
  );
  if (!res) return !!opts.default;
  return /^y/i.test(res.trim());
}

export interface EditorOpts extends BaseOpts<string> {
  initial?: string;
  language?: string;
  required?: boolean;
}

export async function editor(opts: EditorOpts): Promise<string> {
  const th = opts.theme ?? theme;
  console.log(th.primary(opts.message));
  console.log(th.secondary("Enter text below, then press Ctrl+D when done."));
  const value = await raw.readLine("", opts.initial, { multiline: true });
  if (opts.required && !value.trim()) throw new Error("Input required.");
  return value;
}

export { raw };
