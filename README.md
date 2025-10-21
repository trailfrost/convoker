# LunarCLI

A simple, type safe CLI library for TypeScript.

```ts
import { i, Command } from "lunarcli";

const program = new Command("calc").description("A basic calculator.");

program
  .subCommand("add")
  .description("Adds two numbers.")
  .input({
    x: i.option("number", "-x", "--x"),
    y: i.option("number", "-y", "--y"),
  })
  .action(({ x, y }) => {
    console.log(`${x} + ${y} = ${x + y}`);
  });

program
  .subCommand("sub")
  .description("Subtracts any amount of numbers.")
  .input({
    numbers: i.option("number", "--numbers", "-n").list(),
  })
  .action(({ numbers }) => {
    const sub = numbers.reduce((a, b) => a - b, 0);
    console.log(`${numbers.join(" + ")} = ${sub}`);
  });

program.run();
```
