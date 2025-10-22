import { DEFAULT_THEME, type Theme } from "./color";
import type { StandardSchemaV1 } from "./standard-schema";

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

export interface PasswordOpts extends TextOpts {
  mask?: string;
  confirm?: boolean;
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
  multiple?: boolean;
  minSelections?: number;
  maxSelections?: number;
}

export interface SearchOpts<T> extends BaseOpts<T> {
  options: SelectOption<T>[];
  placeholder?: string;
  minQueryLength?: number;
  filter?(query: string, option: SelectOption<T>): boolean;
}

export interface ConfirmOpts extends BaseOpts<boolean> {
  yesLabel?: string;
  noLabel?: string;
  default?: boolean;
}

export interface EditorOpts extends BaseOpts<string> {
  initial?: string;
  language?: string;
  required?: boolean;
}

export async function text(opts: TextOpts): Promise<string> {
  // TODO
  throw new Error("Not implemented");
}

export async function password(opts: PasswordOpts): Promise<string> {
  // TODO
  throw new Error("Not implemented");
}

export async function select<T>(opts: SelectOpts<T>): Promise<T> {
  // TODO
  throw new Error("Not implemented");
}

export async function multiselect<T>(opts: SelectOpts<T>): Promise<T[]> {
  // TODO
  throw new Error("Not implemented");
}

export async function search<T>(opts: SearchOpts<T>): Promise<T> {
  // TODO
  throw new Error("Not implemented");
}

export async function confirm(opts: ConfirmOpts): Promise<boolean> {
  // TODO
  throw new Error("Not implemented");
}

export async function editor(opts: EditorOpts): Promise<string> {
  // TODO
  throw new Error("Not implemented");
}
