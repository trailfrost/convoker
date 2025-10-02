import { convert, InferInput, Option, Positional, type Input } from "./input";

class LucidCLIError extends Error {
  constructor(
    public type:
      | "unknown_option"
      | "too_many_arguments"
      | "missing_required_option"
      | "missing_required_argument",
    public data: { command: Command<any> } & Record<string, unknown>
  ) {
    super(`[LUCID_CLI_ERROR] ${type}`);
  }
}

export interface CommandAlias<T extends Input = Input> {
  command: Command<T>;
  alias?: string;
}

export interface ParseReturn {
  command: Command<any>;
  opts: Record<string, unknown>;
  args: Record<string, unknown>;
}

export type ActionFn<T extends Input> = (
  input: InferInput<T>
) => void | Promise<void>;

export class Command<T extends Input = Input> {
  $names: string[];
  $description: string | undefined;
  $version: string | undefined;
  $children: Map<string, CommandAlias> = new Map();
  $parent: Command<any> | undefined;
  $allowUnknownOptions: boolean = false;

  $input: T = {} as T;
  $fn: ActionFn<T> | undefined = undefined;

  constructor(names: string | string[], desc?: string, version?: string) {
    this.$names = Array.isArray(names) ? names : [names];
    this.$description = desc;
    this.$version = version;
  }

  alias(...aliases: string[]) {
    this.$names.concat(aliases);
    this.$parent?.add(this);
  }

  description(desc: string): this {
    this.$description = desc;
    return this;
  }

  version(version: string): this {
    this.$version = version;
    return this;
  }

  input<TInput extends Input>(input: TInput): Command<TInput> {
    this.$input = input as any;
    return this as any;
  }

  action(fn: ActionFn<T>): this {
    this.$fn = fn;
    return this;
  }

  add(command: Command<any>): this {
    command.$parent = this;
    const alias = { command, alias: command.$names[0] };
    for (let i = 0; i < command.$names.length; i++) {
      if (i === 0)
        this.$children.set(command.$names[i], { command, alias: undefined });
      this.$children.set(command.$names[i], alias);
    }
    return this;
  }

  subCommand(
    names: string | string[],
    desc?: string,
    version?: string
  ): Command {
    const command = new Command(names, desc, version);
    this.add(command);
    return command;
  }

  allowUnknownOptions(): this {
    this.$allowUnknownOptions = true;
    return this;
  }

  parse(argv: string[]): ParseReturn {
    // alias to `this` is necessary to go through the tree
    // eslint-disable-next-line
    let command: Command<any> = this;
    const opts: Record<string, unknown> = {};
    const args: Record<string, unknown> = {};
    const seen = new Set<string>(); // track seen keys

    const positionalArgs = Object.entries(command.extractPositional());
    let position = 0;

    const getOption = (key: string) => {
      const opt = command.$input[key];
      if (!opt || !(opt instanceof Option)) {
        if (command.$allowUnknownOptions) return null;
        throw new LucidCLIError("unknown_option", { command, key });
      }
      return opt;
    };

    const setOption = (
      key: string,
      option: Option<any, any, any>,
      value?: string
    ) => {
      seen.add(key);
      if (option.$kind === "boolean") {
        opts[key] = true;
      } else {
        if (value === undefined) value = argv[++position];
        opts[key] = convert(option.$kind, value);
      }
    };

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];

      if (arg.startsWith("--")) {
        // --long[=value]
        const [key, value] = arg.slice(2).split("=");
        const option = getOption(key);
        if (option) setOption(key, option, value);
      } else if (arg.startsWith("-")) {
        // -abc or -k=value
        const [shortKeys, value] = arg.slice(1).split("=");
        const chars = shortKeys.split("");
        let usedValue: string | undefined = value;

        for (const char of chars) {
          const option = getOption(char);
          if (!option) continue;

          if (option.$kind !== "boolean" && usedValue === undefined) {
            usedValue = argv[++i];
          }
          setOption(char, option, usedValue);
          usedValue = undefined; // only first consumes
        }
      } else {
        // positional
        const [key, entry] = positionalArgs[position++] ?? [];
        if (!key) continue;
        seen.add(key);
        args[key] = convert(entry.$kind, arg);
      }
    }

    // fill defaults / check required
    for (const [key, entry] of Object.entries(command.$input) as [
      string,
      Option<any, any, any> | Positional<any, any, any>,
    ][]) {
      if (seen.has(key)) continue; // already handled
      const target = entry instanceof Option ? opts : args;

      if (entry.$default !== undefined) {
        target[key] = entry.$default;
      } else if (entry.$required) {
        throw new LucidCLIError(
          entry instanceof Option
            ? "missing_required_option"
            : "missing_required_argument",
          { command, entry }
        );
      }
    }

    return { command, opts, args };
  }

  printHelpScreen(): this {
    // TODO
    return this;
  }

  extractPositional(): Record<string, Positional<any, any, any>> {
    const positional: Record<string, unknown> = {};
    for (const key in this.$input) {
      if (this.$input[key] instanceof Positional) {
        positional[key] = this.$input[key];
      }
    }

    return positional as any;
  }

  async run(argv?: string[]): Promise<this> {
    if (!argv) {
      argv =
        // @ts-expect-error `Deno` is a global in Deno
        typeof Deno === "undefined"
          ? // @ts-expect-error `process` is a global in Node and Bun
            (process.argv.slice(2) as string[])
          : // @ts-expect-error `Deno` is a global in Deno
            (Deno.args as string[]);
    }

    try {
      const { command, opts, args } = this.parse(argv);
      if (!command.$fn) {
        return this.printHelpScreen();
      }

      command.$fn({ ...opts, ...args } as any);
      return this;
    } catch (e) {
      if (e instanceof LucidCLIError) {
        switch (e.type) {
          case "missing_required_argument":
            console.error(
              `missing required argument '${(e.data.entry as { names: string[] }).names[0]}'!`
            );
            break;
          case "missing_required_option":
            console.error(
              `missing required option '${(e.data.entry as { names: string[] }).names[0]}'!`
            );
            break;
          case "too_many_arguments":
            console.error("too many arguments!");
            break;
          case "unknown_option":
            console.error(`unknown option '${e.data.key}'!`);
            break;
        }
        return this.printHelpScreen();
      }

      throw e;
    }
  }
}

export * from "./input";
