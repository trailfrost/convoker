# LucidCLI

A simple, type safe CLI framework for TypeScript.

```ts
import process from "node:process";
import { Command, c } from "lucidcli";

const program = new Command("calc")
  .description("A basic calculator.");

program
  .command("add")
  .description("Adds two numbers.")
  .input({
    x: c.option("--x", "-x").required(),
    y: c.option("--y", "-y").required(),
  })
  .action(({ x, y }) => {
    console.log(`${x} + ${y} = ${x + y}`);
  })

program
  .command("sub")
  .description("Subtracts any amount of numbers.")
  .input({
    numbers: c.option("--numbers", "-n").list()
  })
  .action(({ numbers }) => {
    const sub = ${numbers.reduce((a, b) => a - b, 0)};
    console.log(`${numbers.join(" + ")} = ${sub}`)
  })

await program.run();
```
