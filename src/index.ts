import { Option, type Input } from "./input";

class LucidCLIError extends Error {
  constructor(
    public type: "unknown_option" | "too_many_arguments" | "error_thrown"
  ) {
    super(`[LUCID_CLI_ERROR] ${type}`);
  }
}

export interface CommandAlias<T extends Input = Input> {
  command: Command<T>;
  alias?: string;
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

  parse(argv: string[]) {
    // TODO make sure all required arguments/options are there

    // eslint-disable-next-line
    let command: Command<any> = this;
    const opts: Record<string, unknown> = {};
    const args: Record<string, unknown> = {};

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (arg.startsWith("--")) {
        const [key, value] = arg.slice(2).split("=");
        const option = command.$input[key];
        if (!option || !(option instanceof Option)) {
          if (command.$allowUnknownOptions) continue;
          else {
            throw new LucidCLIError("unknown_option");
          }
        }

        if (option.$kind === "boolean") {
          args[key] = true;
        } else {
          if (value) args[key] = option.$convert(value);
          else {
            const value = argv[++i];
            args[key] = option.$convert(value);
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
              throw new LucidCLIError("unknown_option");
            }
          }

          if (option.$kind !== "boolean" && !nonBooleanFound) {
            value = argv[++i];
            nonBooleanFound = true;
          }

          args[key] = !value || option.$convert(value);
        }
      } else {
        // TODO
      }
    }

    return {
      command,
      opts,
      args,
    };
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
        throw new Error("Show help screen"); // TODO
      }

      command.$fn({ ...opts, ...args });
    } catch (e) {
      throw new Error(`Catch not implemented: ${e}`); // TODO
    }

    return this;
  }
}

export * from "./input";
