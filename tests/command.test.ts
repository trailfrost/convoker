import { describe, test, expect, vi, beforeEach } from "vitest";
import { Command, err, i } from "../src";

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
    const sub = new Command("sub");
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

  test("parse() parses boolean option", () => {
    root.input({
      v: i.option("boolean", "-v", "--verbose"),
    });
    const { input } = root.parse(["-v"]);
    expect(input.v).toBe(true);
  });

  test("parse() parses string option with value", () => {
    root.input({
      o: i.option("string", "-o", "--output"),
    });
    const { input } = root.parse(["--output", "file.txt"]);
    expect(input.o).toBe("file.txt");
  });

  test("parse() supports --key=value syntax", () => {
    root.input({
      o: i.option("string", "-o", "--output"),
    });
    const { input } = root.parse(["--output=file.txt"]);
    expect(input.o).toBe("file.txt");
  });

  test("parse() supports short option chaining", () => {
    root.input({
      a: i.option("boolean", "-a"),
      b: i.option("boolean", "-b"),
    });
    const { input } = root.parse(["-ab"]);
    expect(input).toEqual({ a: true, b: true });
  });

  test("parse() parses positional args", () => {
    root.input({
      file: i.positional("string").required(),
    });
    const { input } = root.parse(["main.ts"]);
    expect(input.file).toBe("main.ts");
  });

  test("parse() fills defaults", () => {
    root.input({
      port: i.option("number", "-p").default(3000),
    });
    const { input } = root.parse([]);
    expect(input.port).toBe(3000);
  });

  test("parse() throws on missing required option", () => {
    root.input({
      port: i.option("number", "-p").required(),
    });
    expect(root.parse([]).errors[0]).toBeInstanceOf(err.MissingRequiredOption);
  });

  test("parse() throws on missing required positional", () => {
    root.input({
      file: i.positional("string").required(),
    });
    expect(root.parse([]).errors[0]).toBeInstanceOf(
      err.MissingRequiredArgument
    );
  });

  test("parse() throws on unknown option if not allowed", () => {
    root.input({});
    expect(root.parse(["--bad"]).errors[0]).toBeInstanceOf(
      err.UnknownOptionError
    );
  });

  test("parse() ignores unknown option if allowed", () => {
    root.allowUnknownOptions();
    root.input({});
    const result = root.parse(["--bad"]);
    expect(result.input).toEqual({});
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
    const spy = vi.spyOn(root, "printHelpScreen");
    await root.run([]);
    expect(spy).toHaveBeenCalled();
  });

  test("run() catches CLI errors and prints message", async () => {
    root.input({
      required: i.option("string", "-r").required(),
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const helpSpy = vi.spyOn(root, "printHelpScreen");
    await root.run([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing required option")
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

  test("parse() navigates into subcommand", () => {
    const sub = root.subCommand("sub");
    sub.input({
      flag: i.option("boolean", "-f", "--flag"),
    });

    const { command, input } = root.parse(["sub", "--flag"]);
    expect(command).toBe(sub);
    expect(input.flag).toBe(true);
  });

  test("parse() handles positional in subcommand", () => {
    const sub = root.subCommand("sub");
    sub.input({
      file: i.argument("string").required(),
    });

    const { command, input } = root.parse(["sub", "main.ts"]);
    expect(command).toBe(sub);
    expect(input.file).toBe("main.ts");
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
    const helpSpy = vi.spyOn(sub, "printHelpScreen");

    await root.run(["sub"]);
    expect(helpSpy).toHaveBeenCalled();
  });

  test("throws if subcommand is missing required option", () => {
    const sub = root.subCommand("sub");
    sub.input({
      required: i.option("string", "-r").required(),
    });

    expect(root.parse(["sub"]).errors[0]).toBeInstanceOf(
      err.MissingRequiredOption
    );
  });
});
