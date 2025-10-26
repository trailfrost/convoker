const isDeno = typeof Deno !== "undefined" && !!Deno.stdin;
// const isBun = typeof Bun !== "undefined";
// const isNode = !isDeno && !isBun;

export async function readLine(
  message = "",
  def?: string,
  opts?: { masked?: boolean; maskChar?: string; multiline?: boolean }
): Promise<string> {
  // Deno
  if (isDeno) {
    await Deno.stdout.write(new TextEncoder().encode(message));
    const decoder = new TextDecoder();
    const buf = new Uint8Array(1024);
    let input = "";
    while (true) {
      const n = await Deno.stdin.read(buf);
      if (!n) break;
      const chunk = decoder.decode(buf.subarray(0, n));
      if (chunk.includes("\n")) {
        input += chunk.split("\n")[0];
        break;
      }
      input += chunk;
    }
    return input.trim() || def || "";
  }

  // Node / Bun
  const readline = await import("node:readline");
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (opts?.masked) {
      const write = rl._writeToOutput.bind(rl);
      rl._writeToOutput = (str: string) => {
        if (str.match(/^\x1b/)) return write(str);
        if (str.endsWith("\n") || str.endsWith("\r")) return write(str);
        const mask = opts.maskChar ?? "*";
        write(mask.repeat(str.length));
      };
    }

    rl.question(message, (answer: string) => {
      rl.close();
      resolve(answer || def || "");
    });
  });
}

export async function readKey(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.once("data", (data: Buffer) => {
      const s = data.toString();
      stdin.setRawMode(false);
      stdin.pause();
      if (s === "\r" || s === "\n") return resolve("enter");
      if (s === " ") return resolve("space");
      if (s === "\u001b[A") return resolve("up");
      if (s === "\u001b[B") return resolve("down");
      if (s === "\u001b[C") return resolve("right");
      if (s === "\u001b[D") return resolve("left");
      return resolve(s);
    });
  });
}

export function clearLines(lines = 1) {
  for (let i = 0; i < lines; i++) process.stdout.write("\x1b[2K\x1b[1A");
  process.stdout.write("\x1b[2K\r");
}

export function cursorUp(n = 1) {
  process.stdout.write(`\x1b[${n}A`);
}

export function cursorDown(n = 1) {
  process.stdout.write(`\x1b[${n}B`);
}
