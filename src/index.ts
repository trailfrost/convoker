import { convert, Option, Positional, type Input } from "./input";

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

export type ActionFn<T extends Input> = (input: T) => void | Promise<void>;

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
    // eslint-disable-next-line
    let command: Command<any> = this;
    const opts: Record<string, unknown> = {};
    const args: Record<string, unknown> = {};

    const positionalArgs = Object.entries(command.extractPositional());
    let position = 0;

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (arg.startsWith("--")) {
        const [key, value] = arg.slice(2).split("=");
        const option = command.$input[key];
        if (!option || !(option instanceof Option)) {
          if (command.$allowUnknownOptions) continue;
          else {
            throw new LucidCLIError("unknown_option", { command, key });
          }
        }

        if (option.$kind === "boolean") {
          opts[key] = true;
        } else {
          if (value) opts[key] = convert(option.$kind, value);
          else {
            const value = argv[++i];
            opts[key] = convert(option.$kind, value);
          }
        }
      } else if (arg.startsWith("-")) {
        const split = arg.slice(1).split("=");
        const key = split[0];
        let value = split[1];
        let nonBooleanFound = true;

        const keys = key.split("");

        for (const key of keys) {
          const option = command.$input[key];
          if (!option || !(option instanceof Option)) {
            if (command.$allowUnknownOptions) continue;
            else {
              throw new LucidCLIError("unknown_option", { command, key });
            }
          }

          if (option.$kind !== "boolean" && !nonBooleanFound) {
            value = argv[++i];
            nonBooleanFound = true;
          }

          opts[key] = !value || convert(option.$kind, value);
        }
      } else {
        const [key, entry] = positionalArgs[position];
        args[key] = convert(entry.$kind, arg);
        position++;
      }
    }

    for (const key in command.$input) {
      const entry = command.$input[key];
      if (entry instanceof Option) {
        if (!opts[key] && entry.$required) {
          if (entry.$default) opts[key] = entry.$default;
          else {
            throw new LucidCLIError("missing_required_option", {
              command,
              entry,
            });
          }
        }
      } else if (entry instanceof Positional) {
        if (!args[key] && entry.$required) {
          if (entry.$default) args[key] = entry.$default;
          else {
            throw new LucidCLIError("missing_required_argument", {
              command,
              entry,
            });
          }
        }
      }
    }

    return {
      command,
      opts,
      args,
    };
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

      command.$fn({ ...opts, ...args });
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
