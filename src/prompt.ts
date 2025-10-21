import type { Theme } from "./color";
import type { StandardSchemaV1 } from "./standard-schema";

// TODO add global themes

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

export function text(opts: TextOpts): string {
  // TODO
  throw new Error("Not implemented");
}

export function password(opts: PasswordOpts): string {
  // TODO
  throw new Error("Not implemented");
}

export function select<T>(opts: SelectOpts<T>): T {
  // TODO
  throw new Error("Not implemented");
}

export function multiselect<T>(opts: SelectOpts<T>): T[] {
  // TODO
  throw new Error("Not implemented");
}

export function search<T>(opts: SearchOpts<T>): T {
  // TODO
  throw new Error("Not implemented");
}

export function confirm(opts: ConfirmOpts): boolean {
  // TODO
  throw new Error("Not implemented");
}

export function editor(opts: EditorOpts): string {
  // TODO
  throw new Error("Not implemented");
}
