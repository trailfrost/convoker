import { describe, test, expect, vi, beforeEach } from "vitest";
import { Command, error, i } from "@/index";

describe("Command", () => {
  let root: Command;

  beforeEach(() => {
    root = new Command("root", "Root command");
  });

  test("creates command with name, description, version", () => {
    const cmd = new Command(["foo", "bar"], "desc", "1.0.0");
    expect(cmd.$names).toEqual(["foo", "bar"]);
    expect(cmd.$description).toBe("desc");
    expect(cmd.$version).toBe("1.0.0");
  });

  test("adds and resolves subcommands", () => {
    const sub = new Command("sub").description("test");
    root.add(sub);
    expect(root.$children.get("sub")?.command).toBe(sub);
    expect(sub.$parent).toBe(root);
  });

  test("alias() re-adds to parent", () => {
    const sub = new Command(["sub", "s"]);
    root.add(sub);
    sub.alias("ss");
    expect(root.$children.get("sub")?.command).toBe(sub);
    expect(root.$children.get("s")?.command).toBe(sub);
  });

  test("parse() parses boolean option", async () => {
    root.input({
      v: i.option("boolean", "-v", "--verbose"),
    });
    const { input } = await root.parse(["-v"]);
    expect(input.v).toBe(true);
  });

  test("parse() parses string option with value", async () => {
    root.input({
      o: i.option("string", "-o", "--output"),
    });
    const { input } = await root.parse(["--output", "file.txt"]);
    expect(input.o).toBe("file.txt");
  });

  test("parse() supports --key=value syntax", async () => {
    root.input({
      o: i.option("string", "-o", "--output"),
    });
    const { input } = await root.parse(["--output=file.txt"]);
    expect(input.o).toBe("file.txt");
  });

  test("parse() supports short option chaining", async () => {
    root.input({
      a: i.option("boolean", "-a"),
      b: i.option("boolean", "-b"),
    });
    const { input } = await root.parse(["-ab"]);
    expect(input).toEqual({ a: true, b: true });
  });

  test("parse() parses positional args", async () => {
    root.input({
      file: i.positional("string").required(),
    });
    const { input } = await root.parse(["main.ts"]);
    expect(input.file).toBe("main.ts");
  });

  test("parse() fills defaults", async () => {
    root.input({
      port: i.option("number", "-p").default(3000),
    });
    const { input } = await root.parse([]);
    expect(input.port).toBe(3000);
  });

  test("parse() throws on missing required option", async () => {
    root.input({
      port: i.option("number", "-p").required(),
    });
    expect((await root.parse([])).errors[0]).toBeInstanceOf(
      error.MissingRequiredOptionError,
    );
  });

  test("parse() throws on missing required positional", async () => {
    root.input({
      file: i.positional("string").required(),
    });
    expect((await root.parse([])).errors[0]).toBeInstanceOf(
      error.MissingRequiredArgumentError,
    );
  });

  test("parse() throws on unknown option if not allowed", async () => {
    root.input({});
    expect((await root.parse(["--bad"])).errors[0]).toBeInstanceOf(
      error.UnknownOptionError,
    );
  });

  test("parse() ignores unknown option if allowed", async () => {
    root.allowUnknownOptions();
    root.input({});
    const { input } = await root.parse(["--bad"]);
    expect(input).toEqual({});
  });

  test("run() executes help", async () => {
    const fn = vi.fn();
    root.help(fn);
    await root.run();

    expect(fn).toHaveBeenCalled();
  });

  test("run() executes action", async () => {
    const fn = vi.fn();
    root.input({
      name: i.positional("string").required(),
    });
    root.action(fn);
    await root.run(["Alice"]);
    expect(fn).toHaveBeenCalledWith({ name: "Alice" });
  });

  test("run() prints help screen if no action is set", async () => {
    const spy = vi.spyOn(root, "handleError");
    await root.run([]);
    expect(spy).toHaveBeenCalled();
  });

  test("run() catches CLI errors and prints message", async () => {
    root.input({
      required: i.option("string", "-r").required().description("Example"),
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const helpSpy = vi.spyOn(root, "handleError");
    await root.run([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing required option"),
    );
    expect(helpSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("Nested subcommands", () => {
  let root: Command;

  beforeEach(() => {
    root = new Command("root");
  });

  test("subCommand() supports callback API", async () => {
    let a: Command<any> | null = null;
    root.subCommand(
      "sub",
      (c) =>
        (a = c
          .description("testing")
          .version("1.0.0")
          .action(() => {
            console.log("it works!");
          })),
    );

    const { command } = await root.parse(["sub"]);
    expect(command).toBe(a);
  });

  test("parse() navigates into subcommand", async () => {
    const sub = root.subCommand("sub");

    const { command } = await root.parse(["sub"]);
    expect(command).toBe(sub);
  });

  test("parse() handles options in subcommand", async () => {
    const sub = root.subCommand("sub");
    sub.input({
      flag: i.option("boolean", "-f", "--flag"),
    });

    const { command, input } = await root.parse(["--flag", "sub"]);
    expect(command).toBe(sub);
    expect(input.flag).toBe(true);
  });

  test("parse() handles positional in subcommand", async () => {
    const sub = root.subCommand("sub");
    sub.input({
      file: i.positional("string").required(),
    });

    const { command, input } = await root.parse(["sub", "main.ts"]);
    expect(command).toBe(sub);
    expect(input.file).toBe("main.ts");
  });

  test("parse() throws if subcommand is missing required option", async () => {
    const sub = root.subCommand("sub");
    sub.input({
      required: i.option("string", "-r").required(),
    });

    expect((await root.parse(["sub"])).errors[0]).toBeInstanceOf(
      error.MissingRequiredOptionError,
    );
  });

  test("parse() throws if subcommand is missing required positional", async () => {
    const sub = root.subCommand("sub");
    sub.input({
      required: i.positional("string").required(),
    });

    expect((await root.parse(["sub"])).errors[0]).toBeInstanceOf(
      error.MissingRequiredArgumentError,
    );
  });

  test("run() executes nested subcommand action", async () => {
    const fn = vi.fn();
    const sub = root.subCommand("sub");
    sub.input({
      name: i.positional("string").required(),
    });
    sub.action(fn);

    await root.run(["sub", "Alice"]);
    expect(fn).toHaveBeenCalledWith({ name: "Alice" });
  });

  test("run() prints help screen if subcommand has no action", async () => {
    const sub = root.subCommand("sub");
    const helpSpy = vi.spyOn(sub, "handleError");

    await root.run(["sub"]);
    expect(helpSpy).toHaveBeenCalled();
  });
});
