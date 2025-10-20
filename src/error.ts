import type { Command } from "./command";
import type { Option, Positional } from "./input";

export class InputValidationError extends Error {
  messages: string[];

  constructor(messages: string[]) {
    super(`Validation failed: ${messages.join(", ")}`);
    this.messages = messages;
  }
}

export class LucidCLIError extends Error {
  command: Command<any>;

  constructor(message: string, command: Command<any>) {
    super(message);
    this.command = command;
  }

  print() {
    console.error(this.message);
  }
}

export class HelpAskedError extends LucidCLIError {
  constructor(command: Command<any>) {
    super("user asked for help!", command);
  }

  print() {}
}

export class TooManyArgumentsError extends LucidCLIError {
  constructor(command: Command<any>) {
    super("too many arguments!", command);
  }
}

export class UnknownOptionError extends LucidCLIError {
  key: string;

  constructor(command: Command<any>, key: string) {
    super(`unknown option: ${key}!`, command);
    this.key = key;
  }
}

export class MissingRequiredOptionError extends LucidCLIError {
  key: string;
  entry: Option<any, any, any>;

  constructor(
    command: Command<any>,
    key: string,
    entry: Option<any, any, any>
  ) {
    super(`missing required option: ${key}!`, command);
    this.key = key;
    this.entry = entry;
  }
}

export class MissingRequiredArgumentError extends LucidCLIError {
  key: string;
  entry: Positional<any, any, any>;

  constructor(
    command: Command<any>,
    key: string,
    entry: Positional<any, any, any>
  ) {
    super(`missing required positional argument: ${key}!`, command);
    this.key = key;
    this.entry = entry;
  }
}
