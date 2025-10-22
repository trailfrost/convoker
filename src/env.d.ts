declare const process: any;
declare const Bun: any;
declare const Deno: any;

const anything: any;

declare module "bun" {
  export = anything;
}

declare module "node:*" {
  export = anything;
}

declare module "deno:*" {
  export = anything;
}
