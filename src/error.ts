import type { Command } from "./command";
import type { Option, Positional } from "./input";

/**
 * Thrown when the command fails to validate an input.
 */
export class InputValidationError extends Error {
  /**
   * A list of messages.
   */
  messages: string[];

  /**
   * Creates a new input validation error.
   * @param messages The messages.
   */
  constructor(messages: string[]) {
    super(`Validation failed: ${messages.join(", ")}`);
    this.messages = messages;
  }
}

/**
 * A LunarCLI-related error. These are usually handled by default.
 */
export class LunarCLIError extends Error {
  /**
   * The command this error happened on.
   */
  command: Command<any>;

  /**
   * Creates a new LunarCLI error.
   * @param message The message.
   * @param command The command.
   */
  constructor(message: string, command: Command<any>) {
    super(message);
    this.command = command;
  }

  /**
   * Prints the error's message.
   */
  print() {
    console.error(this.message);
  }
}

/**
 * When the user asks for help.
 */
export class HelpAskedError extends LunarCLIError {
  /**
   * Creates a new help asked error.
   * @param command The command.
   */
  constructor(command: Command<any>) {
    super("user asked for help!", command);
  }
}

/**
 * When you pass too many arguments.
 */
// TODO this isn't thrown at all
export class TooManyArgumentsError extends LunarCLIError {
  /**
   * Creates a new too many arguments error.
   * @param command The command.
   */
  constructor(command: Command<any>) {
    super("too many arguments!", command);
  }
}

/**
 * When you pass an unknown option, when unknown options aren't allowed.
 */
export class UnknownOptionError extends LunarCLIError {
  /**
   * The option key.
   */
  key: string;

  /**
   * Creates a new unknown option error.
   * @param command The command.
   * @param key The key.
   */
  constructor(command: Command<any>, key: string) {
    super(`unknown option: ${key}!`, command);
    this.key = key;
  }
}

/**
 * When a required option is missing.
 */
export class MissingRequiredOptionError extends LunarCLIError {
  /**
   * The option key.
   */
  key: string;
  /**
   * The option entry.
   */
  entry: Option<any, any, any>;

  /**
   * Creates a new missing required option error.
   * @param command The command.
   * @param key The key.
   * @param entry The entry.
   */
  constructor(
    command: Command<any>,
    key: string,
    entry: Option<any, any, any>,
  ) {
    super(`missing required option: ${key}!`, command);
    this.key = key;
    this.entry = entry;
  }
}

export class MissingRequiredArgumentError extends LunarCLIError {
  /**
   * The argument key.
   */
  key: string;
  /**
   * The argument entry.
   */
  entry: Positional<any, any, any>;

  /**
   * Creates a new missing required argument error.
   * @param command The command.
   * @param key The key.
   * @param entry The entry.
   */
  constructor(
    command: Command<any>,
    key: string,
    entry: Positional<any, any, any>,
  ) {
    super(`missing required positional argument: ${key}!`, command);
    this.key = key;
    this.entry = entry;
  }
}
