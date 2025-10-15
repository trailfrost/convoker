import { gray, cyan, bold } from "./color";
import {
  LucidCLIError,
  MissingRequiredArgument,
  MissingRequiredOption,
  UnknownOptionError,
} from "./error";
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
  isVersion: boolean;
  isHelp: boolean;
}

export type ActionFn<T extends Input> = (
  input: InferInput<T>
) => void | Promise<void>;

export type HelpFn<T extends Input> = (
  command: Command<T>,
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
  $helpFn: HelpFn<T> | undefined = undefined;

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

  help(fn: HelpFn<T>): this {
    this.$helpFn = fn;
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

  private printHelpScreen(): this {
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

    return this;
  }

  async runHelp(input?: InferInput<T>): Promise<this> {
    // eslint-disable-next-line -- necessary for traversing up the tree
    let command: Command<any> = this;
    while (!command.$helpFn && command.$parent) {
      command = command.$parent;
    }

    if (command.$helpFn) {
      await command.$helpFn(command, input ?? ({} as InferInput<T>));
      return this;
    } else {
      return this.printHelpScreen();
    }
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

    const result = this.parse(argv);
    if (result.isHelp) {
      result.command.printHelpScreen();
      return this;
    } else if (result.isVersion) {
      console.log(
        `${this.fullCommandPath()} version ${result.command.$version}`
      );
      return this;
    }

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        error.print();
      }
      await result.command.runHelp(result.input);
    } else if (!result.command.$fn) {
      await result.command.runHelp(result.input);
    } else {
      await result.command.$fn(result.input);
    }
    return this;
  }
}
