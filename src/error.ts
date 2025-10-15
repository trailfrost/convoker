import type { Command } from "./command";
import type { Option, Positional } from "./input";

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

export class TooManyArguments extends LucidCLIError {
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

export class MissingRequiredOption extends LucidCLIError {
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

export class MissingRequiredArgument extends LucidCLIError {
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
