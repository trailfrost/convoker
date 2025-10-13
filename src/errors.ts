import type { Command } from "./command";
import type { Option, Positional } from "./input";

export class LucidCLIError extends Error {
  command: Command<any>;

  constructor(message: string, command: Command<any>) {
    super(`[LUCID_CLI_ERROR] ${message}`);
    this.command = command;
  }
}

export class TooManyArguments extends LucidCLIError {
  constructor(command: Command<any>) {
    super(`too_many_arguments`, command);
  }
}

export class UnknownOptionError extends LucidCLIError {
  key: string;

  constructor(command: Command<any>, key: string) {
    super(`unknown_option ${key}`, command);
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
    super(`missing_required_option ${key}`, command);
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
    super(`missing_required_positional ${key}`, command);
    this.key = key;
    this.entry = entry;
  }
}
