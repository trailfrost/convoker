import { gray, cyan, bold } from "./colors";
import {
  LucidCLIError,
  MissingRequiredArgument,
  MissingRequiredOption,
  UnknownOptionError,
} from "./errors";
import {
  convert,
  Option,
  Positional,
  type InferInput,
  type Input,
} from "./input";

export interface CommandAlias<T extends Input = Input> {
  command: Command<T>;
  alias?: string;
}

export interface ParseResult<T extends Input> {
  command: Command<T>;
  input: InferInput<T>;
  errors: LucidCLIError[];
}

export type ActionFn<T extends Input> = (
  input: InferInput<T>
) => void | Promise<void>;

interface MapEntry {
  key: string;
  value: Option<any, any, any> | Positional<any, any, any>;
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
      if (i === 0) this.$children.set(command.$names[i], { command });
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

  parse(argv: string[]): ParseResult<T> {
    // eslint-disable-next-line -- alias to this is necessary to go through the tree
    let command: Command<any> = this;
    let found = false;
    const input: Record<string, unknown> = {};

    const args: string[] = [];
    const opts: Record<string, string> = {};

    const errors: LucidCLIError[] = [];
    const map = command.buildInputMap();
    // TODO right now, children's options are not included until they are encountered, causing a false `UnknownOptionError` if you pass a child's option before it's reached.

    function getOption(key: string) {
      const entry = map.get(key);
      if (!entry) {
        if (!command.$allowUnknownOptions)
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

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (arg.startsWith("--")) {
        // --long[=value] or --long [value]
        const [key, value] = arg.slice(2).split("=");
        const option = getOption(key);
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
        if (command.$children.has(arg) && !found) {
          command = command.$children.get(arg)!.command;
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
      let rawValue: string | undefined;

      if (entry instanceof Positional) {
        rawValue = args[index++];
      } else {
        for (const name of entry.$names) {
          if (opts[name] !== undefined) {
            rawValue = opts[name];
            break;
          }
        }
      }

      if (rawValue !== undefined) {
        input[key] = convert(entry.$kind, rawValue);
      } else if (entry.$default !== undefined) {
        input[key] = entry.$default;
      } else if (entry.$required) {
        if (entry instanceof Option) {
          errors.push(new MissingRequiredOption(command, key, entry));
        } else {
          errors.push(new MissingRequiredArgument(command, key, entry));
        }
      }
    }

    return { input: input as InferInput<T>, command, errors };
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

  printHelpScreen(): this {
    const pad = (s: string, len: number) => s.padEnd(len, " ");

    const fullCommandPath = (): string => {
      const names: string[] = [];
      // eslint-disable-next-line -- necessary for
      let cmd: Command<any> | undefined = this;
      while (cmd) {
        names.unshift(cmd.$names[0]);
        cmd = cmd.$parent;
      }
      return names.join(" ");
    };

    console.log();
    console.log(
      `${bold("Usage:")} ${cyan(fullCommandPath())} ${gray("[options] [arguments]")}`
    );
    console.log();

    if (this.$description) {
      console.log(`${this.$description}`);
      console.log();
    }

    if (this.$version) {
      console.log(`${bold("Version:")} ${this.$version}`);
      console.log();
    }

    // OPTIONS
    const opts = Object.entries(this.$input)
      .filter(([, entry]) => entry instanceof Option)
      .map(([key, entry]) => ({ key, entry: entry as Option<any, any, any> }));

    if (opts.length > 0) {
      console.log(bold("Options:"));
      const longest = Math.max(
        ...opts.map(({ entry }) => entry.$names.join(", ").length)
      );
      for (const { entry } of opts) {
        const names = entry.$names
          .map((n) => (n.length === 1 ? `-${n}` : `--${n}`))
          .join(", ");
        const line = `  ${pad(names, longest + 4)}${entry.$description ?? ""}`;
        console.log(line);
      }
      console.log();
    }

    // POSITIONALS
    const positionals = Object.entries(this.$input)
      .filter(([, entry]) => entry instanceof Positional)
      .map(([key, entry]) => ({
        key,
        entry: entry as Positional<any, any, any>,
      }));

    if (positionals.length > 0) {
      console.log(bold("Arguments:"));
      const longest = Math.max(...positionals.map(({ key }) => key.length));
      for (const { key, entry } of positionals) {
        const name = entry.$required ? `<${key}>` : `[${key}]`;
        const line = `  ${pad(name, longest + 4)}${entry.$description ?? ""}`;
        console.log(line);
      }
      console.log();
    }

    // SUBCOMMANDS
    if (this.$children.size > 0) {
      console.log(bold("Commands:"));
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
        const line = `  ${pad(cmd.$names[0], longest + 4)}${cmd.$description ?? ""}`;
        console.log(line);
      }
      console.log();
      console.log(
        `Run '${cyan(`${fullCommandPath()} <command> --help`)}' for more info on a command.`
      );
      console.log();
    }

    return this;
  }

  async run(argv?: string[]): Promise<this> {
    if (!argv) {
      argv =
        // @ts-expect-error `Bun` is a global in Bun
        typeof Bun !== "undefined"
          ? // @ts-expect-error `Bun` is a global in Bun
            (Bun.argv.slice(2) as string[])
          : // @ts-expect-error `Deno` is a global in Deno
            typeof Deno !== "undefined"
            ? // @ts-expect-error `Deno` is a global in Deno
              (Deno.args as string[])
            : // @ts-expect-error `process` is a global in Node
              (process.argv.slice(2) as string[]);
    }

    const { errors, command, input } = this.parse(argv);
    if (errors.length > 0) {
      for (const error of errors) {
        error.print();
      }
      command.printHelpScreen();
    } else if (!command.$fn) {
      command.printHelpScreen();
    } else {
      await command.$fn(input);
    }
    return this;
  }
}
