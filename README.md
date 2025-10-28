# Convoker

A simple, type safe CLI library for TypeScript.

```ts
import { i, Command } from "convoker";

const program = new Command("calc").description("A basic calculator.");

program
  .subCommand("add", (c) =>
    c
      .description("Adds two numbers.")
      .input({
        x: i.option("number", "-x", "--x"),
        y: i.option("number", "-y", "--y"),
      })
      .action(({ x, y }) => {
        console.log(`${x} + ${y} = ${x + y}`);
      }),
  )
  .subCommand("sub", (c) =>
    c
      .description("Subtracts any amount of numbers.")
      .input({
        numbers: i.option("number", "--numbers", "-n").list(),
      })
      .action(({ numbers }) => {
        const sub = numbers.reduce((a, b) => a - b, 0);
        console.log(`${numbers.join(" + ")} = ${sub}`);
      }),
  )
  .run();
```
