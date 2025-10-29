// Node.js/Bun globals
declare const process: any;
declare const Buffer: any;
declare type Buffer = any;

declare module "node:*" {
  const anything: any;
  export = anything;
}

// Bun globals
declare const Bun: any;

declare module "bun" {
  const anything: any;
  export = anything;
}

// Deno globals
declare const Deno: any;

declare module "deno:*" {
  const anything: any;
  export = anything;
}
