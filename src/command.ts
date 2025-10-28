import { gray, cyan, bold, type Theme } from "./color";
import { setTheme as setPromptTheme } from "./prompt";
import { setTheme as setLogTheme } from "./log";
import {
  ConvokerError,
  HelpAskedError,
  MissingRequiredArgumentError,
  MissingRequiredOptionError,
  TooManyArgumentsError,
  UnknownOptionError,
} from "./error";
import {
  convert,
  Option,
  Positional,
  type InferInput,
  type Input,
} from "./input";

/**
 * What the command is an alias for.
 */
export interface CommandAlias<T extends Input = Input> {
  /**
   * A pointer to the command.
   */
  command: Command<T>;
  /**
   * The name of the command this is an alias for.
   */
  alias?: string;
}

/**
 * The result of the `Command.parse` function.
 */
export interface ParseResult<T extends Input> {
  /**
   * A pointer to the command to run.
   */
  command: Command<T>;
  /**
   * The input to pass into the command.
   */
  input: InferInput<T>;
  /**
   * Errors collected during parsing.
   */
  errors: ConvokerError[];
  /**
   * If this should result in displaying the version of the command.
   */
  isVersion: boolean;
  /**
   * If this should result in displaying a help screen.
   */
  isHelp: boolean;
}

/**
 * Command action function.
 */
export type ActionFn<T extends Input> = (
  input: InferInput<T>
) => any | Promise<any>;

/**
 * Command middleware function.
 */
export type MiddlewareFn<T extends Input = Input> = (
  input: InferInput<T>,
  next: () => Promise<any>
) => any | Promise<any>;

/**
 * Command error handler.
 */
export type ErrorFn<T extends Input> = (
  command: Command<T>,
  errors: Error[],
  input: Partial<InferInput<T>>
) => void | Promise<void>;

/**
 * Builder for commands.
 */
export type Builder = (c: Command<any>) => Command<any> | void;

/**
 * An input map entry.
 */
interface MapEntry {
  /**
   * The key of the map entry.
   */
  key: string;
  /**
   * The value of the map entry.
   */
  value: Option<any, any, any> | Positional<any, any, any>;
}

/**
 * A command.
 */
export class Command<T extends Input = Input> {
  /**
   * The names (aliases) of this command.
   */
  $names: string[];
  /**
   * The description of this command.
   */
  $description: string | undefined;
  /**
   * The theme of this command
   */
  $theme: Theme | undefined;
  /**
   * The version of this command.
   */
  $version: string | undefined;
  /**
   * The children of this command.
   */
  $children: Map<string, CommandAlias> = new Map();
  /**
   * The parent of this command.
   */
  $parent: Command<any> | undefined;
  /**
   * If this command allows unknown options.
   */
  $allowUnknownOptions: boolean = false;
  /**
   * If you should be able to surpass the amount of positional arguments defined in the input.
   */
  $allowSurpassArgLimit: boolean = false;
  /**
   * The input this command takes.
   */
  $input: T = {} as T;
  /**
   * The action function of this command.
   */
  $fn: ActionFn<T> | undefined = undefined;
  /**
   * The middlewares associated with this command.
   */
  $middlewares: MiddlewareFn<T>[] = [];
  /**
   * The error handler of this command.
   */
  $errorFn: ErrorFn<T> | undefined = undefined;

  /**
   * Creates a new command.
   * @param names The names (aliases).
   * @param desc The description.
   * @param version The version.
   */
  constructor(names: string | string[], desc?: string, version?: string) {
    this.$names = Array.isArray(names) ? names : [names];
    this.$description = desc;
    this.$version = version;
  }

  /**
   * Adds a set of aliases to this command.
   * @param aliases The aliases to add.
   * @returns this
   */
  alias(...aliases: string[]): this {
    this.$names.concat(aliases);
    this.$parent?.add(this);
    return this;
  }

  /**
   * Adds a description to this command.
   * @param desc The description.
   * @returns this
   */
  description(desc: string): this {
    this.$description = desc;
    return this;
  }

  /**
   * Adds a version to this command.
   * @param version The version.
   * @returns this
   */
  version(version: string): this {
    this.$version = version;
    return this;
  }

  /**
   * Sets the input for this command.
   * @param version The input.
   * @returns this
   */
  input<TInput extends Input>(input: TInput): Command<TInput> {
    this.$input = input as any;
    return this as any;
  }

  /**
   * Adds a chain of middlewares.
   * @param fns The middlewares to use.
   * @returns this
   */
  use(...fns: MiddlewareFn<T>[]): this {
    this.$middlewares.push(...fns);
    return this;
  }

  /**
   * Sets the action function for this command.
   * @param fn The action.
   * @returns this
   */
  action(fn: ActionFn<T>): this {
    this.$fn = fn;
    return this;
  }

  /**
   * Sets the error function for this command.
   * @param fn The error handler.
   * @returns this
   */
  error(fn: ErrorFn<T>): this {
    this.$errorFn = fn;
    return this;
  }

  /**
   * Adds an existing command to this.
   * @param command The command.
   * @returns this
   */
  add(command: Command<any>): this {
    command.$parent = this;
    const alias = { command, alias: command.$names[0] };
    for (let i = 0; i < command.$names.length; i++) {
      if (i === 0) this.$children.set(command.$names[i], { command });
      this.$children.set(command.$names[i], alias);
    }
    return this;
  }

  /**
   * Creates a new subcommand and adds it.
   * @param names The aliases of the subcommand.
   * @param builder A builder to create the command.
   */
  subCommand(names: string | string[], builder: Builder): this;
  /**
   * Creates a new subcommand and adds it.
   * @param names The aliases of the subcommand.
   * @param desc The description of the subcommand.
   * @param version The version of the subcommand.
   */
  subCommand(
    names: string | string[],
    desc?: string,
    version?: string
  ): Command<any>;

  subCommand(
    names: string | string[],
    descOrBuilder?: Builder | string,
    version?: string
  ): Command<any> {
    if (typeof descOrBuilder === "function") {
      const command = new Command(names);
      descOrBuilder(command);
      this.add(command);
      return this;
    }

    const command = new Command(names, descOrBuilder, version);
    this.add(command);
    return command;
  }

  /**
   * Allows unknown options.
   * @returns this
   */
  allowUnknownOptions(): this {
    this.$allowUnknownOptions = true;
    return this;
  }

  /**
   * Parses a set of command-line arguments.
   * @param argv The arguments to parse.
   * @returns A parse result.
   */
  async parse(argv: string[]): Promise<ParseResult<T>> {
    // eslint-disable-next-line -- alias to this is necessary to go through the tree
    let command: Command<any> = this;
    let found = false;
    const input: Record<string, unknown> = {};

    const args: string[] = [];
    const opts: Record<string, string> = {};

    const errors: ConvokerError[] = [];
    const map = command.buildInputMap();

    function getOption(key: string, isSpecial?: boolean) {
      const entry = map.get(key);
      if (!entry) {
        if (!command.$allowUnknownOptions && !isSpecial)
          errors.push(new UnknownOptionError(command, key));
        return null;
      }
      return entry.value as Option<any, any, any>;
    }

    function setOption(
      key: string,
      option: Option<any, any, any>,
      value?: string
    ) {
      if (option.$kind === "boolean") {
        opts[key] = "true";
      } else if (value !== undefined) {
        opts[key] = value;
      }
    }

    let isVersion = false;
    let isHelp = false;
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (arg.startsWith("--")) {
        // --long[=value] or --long [value]
        const [key, value] = arg.slice(2).split("=");

        let isSpecial = false;
        if (key === "help") {
          isHelp = true;
          isSpecial = true;
        } else if (key === "version") {
          isVersion = true;
          isSpecial = true;
        }

        const option = getOption(key, isSpecial);
        if (option) {
          if (value === undefined)
            setOption(
              key,
              option,
              option.$kind === "boolean" ? undefined : argv[++i]
            );
          else setOption(key, option, value);
        }
      } else if (arg.startsWith("-")) {
        // -abc or -k[=value] or -k [value]
        const [shortKeys, value] = arg.slice(1).split("=");
        const chars = shortKeys.split("");
        let usedValue: string | undefined = value;

        for (const char of chars) {
          let isSpecial = false;
          if (char === "h") {
            isHelp = true;
            isSpecial = true;
          } else if (char === "V") {
            isVersion = true;
            isSpecial = true;
          }

          const option = getOption(char, isSpecial);
          if (!option) continue;

          if (option.$kind !== "boolean" && usedValue === undefined) {
            usedValue = argv[++i];
          }
          setOption(char, option, usedValue);
          usedValue = undefined; // only first consumes
        }
      } else {
        // positional
        if (command.$children.has(arg) && !found) {
          command = command.$children.get(arg)!.command;
          if (command.$theme) {
            setPromptTheme(command.$theme);
            setLogTheme(command.$theme);
          }
        } else {
          found = true;
          args.push(arg);
        }
      }
    }

    // Apply user values, defaults, or enforce required
    let index = 0;
    for (const key in command.$input) {
      const entry = command.$input[key];
      let rawValue: string | string[] | undefined;

      if (entry instanceof Positional) {
        if (entry.$list) {
          rawValue = args.slice(index);
          index = args.length;
          if (
            !command.$allowSurpassArgLimit &&
            rawValue.length === 0 &&
            entry.$required
          ) {
            errors.push(new MissingRequiredArgumentError(command, key, entry));
          }
        } else {
          rawValue = args[index++];
          if (rawValue === undefined && entry.$required) {
            errors.push(new MissingRequiredArgumentError(command, key, entry));
          }
        }
      } else {
        for (const name of entry.$names) {
          if (opts[name] !== undefined) {
            rawValue = entry.$list
              ? opts[name].split(entry.$separator ?? ",")
              : opts[name];
            break;
          }
        }
      }

      if (rawValue !== undefined) {
        input[key] = await convert(entry.$kind, rawValue);
      } else if (entry.$default !== undefined) {
        input[key] = entry.$default;
      } else if (entry.$required) {
        if (entry instanceof Option) {
          errors.push(new MissingRequiredOptionError(command, key, entry));
        } else {
          errors.push(new MissingRequiredArgumentError(command, key, entry));
        }
      }
    }

    // Check for too many arguments
    const remainingArgs = args.slice(index);
    if (!command.$allowSurpassArgLimit && remainingArgs.length > 0) {
      errors.push(new TooManyArgumentsError(command));
    }

    return {
      input: input as InferInput<T>,
      command,
      errors,
      isVersion,
      isHelp,
    };
  }

  private buildInputMap(
    ignoreParentMap?: boolean
  ): Map<string | number, MapEntry> {
    const map = new Map<string | number, MapEntry>();

    let i = 0;
    for (const key in this.$input) {
      const value = this.$input[key];
      if (value instanceof Positional) {
        map.set(i++, { value, key });
      } else {
        for (const name of value.$names) {
          map.set(name, { value, key });
        }
      }
    }

    if (!ignoreParentMap) {
      for (const [key, entry] of this.$parent?.buildInputMap() ?? []) {
        map.set(key, entry);
      }
    }

    for (const [, { command }] of this.$children) {
      for (const [key, entry] of command.buildInputMap(true)) {
        map.set(key, entry);
      }
    }

    return map;
  }

  /**
   * Allows surpassing the amount of arguments specified.
   * @returns this
   */
  allowSurpassArgLimit(): this {
    this.$allowSurpassArgLimit = true;
    return this;
  }

  /**
   * Gets the full command path (name including parents).
   * @returns The full command path.
   */
  fullCommandPath(): string {
    const names: string[] = [];
    // eslint-disable-next-line -- necessary for traversing up the tree
    let cmd: Command<any> | undefined = this;
    while (cmd) {
      names.unshift(cmd.$names[0]);
      cmd = cmd.$parent;
    }
    return names.join(" ");
  }

  /**
   * The default error screen.
   * @param errors The errors.
   */
  defaultErrorScreen(errors: Error[]) {
    let printHelpScreen = false;
    const nonCliErrors: Error[] = [];

    for (const error of errors) {
      if (error instanceof ConvokerError) {
        if (!(error instanceof HelpAskedError)) error.print();
        printHelpScreen = true;
      } else {
        nonCliErrors.push(error);
      }
    }

    if (nonCliErrors.length) throw nonCliErrors[0];

    if (!printHelpScreen) return;
    const pad = (s: string, len: number) => s.padEnd(len, " ");

    console.log(
      `${bold("usage:")} ${cyan(this.fullCommandPath())} ${gray("[options] [arguments]")}`
    );
    if (this.$description) {
      console.log(`${this.$description}`);
    }

    if (this.$version) {
      console.log(`${bold("version")} ${this.$version}`);
    }

    // OPTIONS
    const opts = Object.entries(this.$input)
      .filter(([, entry]) => entry instanceof Option)
      .map(([key, entry]) => ({ key, entry: entry as Option<any, any, any> }));

    if (opts.length > 0) {
      console.log(bold("options:"));
      const longest = Math.max(
        ...opts.map(({ entry }) => entry.$names.join(", ").length)
      );
      for (const { entry } of opts) {
        const names = entry.$names
          .map((n) => (n.length === 1 ? `-${n}` : `--${n}`))
          .join(", ");
        const line = `  ${cyan(pad(names, longest + 4))}${gray(entry.$description ?? "")}`;
        console.log(line);
      }
    }

    // POSITIONALS
    const positionals = Object.entries(this.$input)
      .filter(([, entry]) => entry instanceof Positional)
      .map(([key, entry]) => ({
        key,
        entry: entry as Positional<any, any, any>,
      }));

    if (positionals.length > 0) {
      console.log(bold("arguments:"));
      const longest = Math.max(...positionals.map(({ key }) => key.length));
      for (const { key, entry } of positionals) {
        const name = entry.$required ? `<${key}>` : `[${key}]`;
        const line = `  ${cyan(pad(name, longest + 4))}${gray(entry.$description ?? "")}`;
        console.log(line);
      }
    }

    // SUBCOMMANDS
    if (this.$children.size > 0) {
      console.log(bold("sub commands:"));
      const deduped = Array.from(
        new Map(
          [...this.$children.values()].map((a) => [
            a.command.$names[0],
            a.command,
          ])
        ).values()
      );

      const longest = Math.max(...deduped.map((c) => c.$names[0].length));
      for (const cmd of deduped) {
        const line = `  ${cyan(pad(cmd.$names[0], longest + 4))}${gray(cmd.$description) ?? ""}`;
        console.log(line);
      }
      console.log();
      console.log(
        `run '${cyan(`${this.fullCommandPath()} <command> --help`)}' for more info on a command.`
      );
    }
  }

  /**
   * Handles a set of errors.
   * @param errors The errors to handle.
   * @param input The parsed input, if possible.
   * @returns this
   */
  async handleErrors(
    errors: Error[],
    input?: Partial<InferInput<T>>
  ): Promise<this> {
    // eslint-disable-next-line -- necessary for traversing up the tree
    let command: Command<any> = this;
    while (!command.$errorFn && command.$parent) {
      command = command.$parent;
    }

    if (command.$errorFn) {
      await command.$errorFn(command, errors, input ?? {});
    } else {
      this.defaultErrorScreen(errors);
    }
    return this;
  }

  /**
   * Runs a command.
   * @param argv The arguments to run the command with. Defaults to your runtime's `argv` equivalent.
   * @returns this
   */
  async run(argv?: string[]): Promise<this> {
    if (!argv) {
      argv =
        typeof Bun !== "undefined"
          ? (Bun.argv.slice(2) as string[])
          : typeof Deno !== "undefined"
            ? (Deno.args as string[])
            : (process.argv.slice(2) as string[]);
    }

    const result = await this.parse(argv);
    if (result.isHelp) {
      result.command.handleErrors([new HelpAskedError(result.command)]);
      return this;
    } else if (result.isVersion) {
      console.log(
        `${result.command.fullCommandPath()} version ${result.command.$version}`
      );
      return this;
    }

    try {
      if (result.errors.length > 0) {
        await result.command.handleErrors(result.errors, result.input);
      } else if (!result.command.$fn) {
        await result.command.handleErrors(
          [new HelpAskedError(result.command), ...result.errors],
          result.input
        );
      } else {
        const middlewares = collectMiddlewares(result.command);
        if (middlewares.length > 0) {
          const runner = compose(middlewares);
          // finalNext calls the command action with the same input
          await runner(result.input, async () => {
            await result.command.$fn?.(result.input);
          });
        } else {
          await result.command.$fn(result.input);
        }
      }
    } catch (e) {
      if (!(e instanceof Error)) {
        console.warn(
          "[convoker] an error that is not instance of `Error` was thrown. this may cause undefined behavior."
        );
      }
      await result.command.handleErrors([e as Error]);
    }
    return this;
  }
}

function collectMiddlewares(cmd: Command<any>) {
  const middlewares: MiddlewareFn<any>[] = [];
  let current: Command<any> | undefined = cmd;
  while (current) {
    if (current.$middlewares.length) {
      middlewares.unshift(...current.$middlewares);
    }
    current = current.$parent;
  }
  return middlewares;
}

function compose(mws: MiddlewareFn<any>[]) {
  return (input: InferInput<any>, finalNext?: () => Promise<any>) => {
    let index = -1;
    const dispatch = (i: number): Promise<any> => {
      if (i <= index)
        return Promise.reject(new Error("next() called multiple times"));
      index = i;
      const fn = mws[i];
      if (!fn) {
        // when middlewares exhausted call finalNext if provided
        return finalNext ? finalNext() : Promise.resolve();
      }
      try {
        return Promise.resolve(fn(input, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    };
    return dispatch(0);
  };
}
