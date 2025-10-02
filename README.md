# LucidCLI

A simple, type safe CLI framework for TypeScript.

```ts
import { c, Command } from "lucidcli";

const program = new Command("calc").description("A basic calculator.");

program
  .subCommand("add")
  .description("Adds two numbers.")
  .input({
    x: c.option("number", "-x", "--x"),
    y: c.option("number", "-y", "--y"),
  })
  .action(({ x, y }) => {
    console.log(`${x} + ${y} = ${x + y}`);
  });

program
  .subCommand("sub")
  .description("Subtracts any amount of numbers.")
  .input({
    numbers: c.option("number", "--numbers", "-n").list(),
  })
  .action(({ numbers }) => {
    const sub = numbers.reduce((a, b) => a - b, 0);
    console.log(`${numbers.join(" + ")} = ${sub}`);
  });

program.run();
```
