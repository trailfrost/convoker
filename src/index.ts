// TODO some tests are failing, figure out why
import { convert, InferInput, Option, Positional, type Input } from "./input";

export class LucidCLIError extends Error {
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

interface MapEntry {
  entry: Option<any, any, any> | Positional<any, any, any>;
  key: string;
}

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

  parse(argv: string[]): { command: Command; input: InferInput<T> } {
    // alias to this is necessary to go through the tree
    // eslint-disable-next-line
    let command: Command<any> = this;
    let found = false;
    const input: Record<string, unknown> = {};

    const args: string[] = [];
    const opts: Record<string, string> = {};

    const map = command.buildInputMap();

    function getOption(key: string) {
      if (!map.has(key)) {
        if (command.$allowUnknownOptions) return null;
        throw new LucidCLIError("unknown_option", { command, key });
      }
      const opt = command.$input[map.get(key)!.key];
      return opt;
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

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (arg.startsWith("--")) {
        // --long[=value] or --long [value]
        const [key, value] = arg.slice(2).split("=");
        const option = getOption(key);
        if (option) {
          if (value === undefined) setOption(key, option, argv[++i]);
          else setOption(key, option, value);
        }
      } else if (arg.startsWith("-")) {
        // -abc or -k[=value] or -k [value]
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
        if (this.$children.get(arg) && !found) {
          command = this.$children.get(arg)!.command;
        } else {
          found = true;
        }

        if (found) args.push(arg);
      }
    }

    // apply arguments and options (with defaults if missing)
    for (const [mapKey, mapEntry] of map.entries()) {
      const { entry, key } = mapEntry;

      if (typeof mapKey === "string") {
        // option
        if (opts[mapKey] !== undefined) {
          input[key] = convert(entry.$kind, opts[mapKey]);
        } else {
          input[key] = entry.$default;
        }
      } else if (typeof mapKey === "number") {
        // positional
        if (args[mapKey] !== undefined) {
          input[key] = convert(entry.$kind, args[mapKey]);
        } else {
          input[key] = entry.$default;
        }
      }
    }

    return { input: input as InferInput<T>, command };
  }

  private buildInputMap(): Map<string | number, MapEntry> {
    const map = new Map<string | number, MapEntry>();

    let i = 0;
    for (const key in this.$input) {
      const entry = this.$input[key];
      if (entry instanceof Positional) {
        map.set(i++, { entry, key });
      } else {
        for (const name of entry.$names) {
          map.set(name, { entry, key });
        }
      }
    }

    const parentMap = this.$parent?.buildInputMap();
    if (!parentMap) return map;

    return new Map([...map, ...parentMap]);
  }

  printHelpScreen(): this {
    // TODO
    return this;
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
      const { command, input } = this.parse(argv);
      if (!command.$fn) {
        return this.printHelpScreen();
      }

      await command.$fn(input);
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
