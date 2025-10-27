import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

import pkg from "./package.json" with { type: "json" };

const entries = Object.entries(pkg.exports)
  .map(([key, value]) => {
    // Only handle objects with a "default" field (skip types-only)
    if (typeof value !== "object" || !("default" in value)) return null;

    const name = key === "." ? "index" : key.replace("./", "");
    // Use only the "default" field for build input
    const outPath = value.default as string;

    // Convert "./dist/foo.js" -> "./src/foo.ts"
    const srcFile = outPath
      .replace("./dist/", "./src/")
      .replace(/\.js$/, ".ts")
      .replace(/\.mjs$/, ".ts") // maybe remove this?
      .replace(/\.cjs$/, ".ts");

    const fullPath = new URL(srcFile, import.meta.url).pathname;
    return [name, fullPath];
  })
  .filter((v): v is [string, string] => Boolean(v))
  .reduce(
    (acc, [name, path]) => {
      acc[name] = path;
      return acc;
    },
    {} as Record<string, string>
  );

export default defineConfig({
  plugins: [dts({ tsconfigPath: "./tsconfig.app.json", rollupTypes: true })],
  build: {
    lib: {
      entry: entries,
      formats: ["es"],
    },
    rollupOptions: {
      input: entries,
      output: {
        dir: "dist",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },

      external: ["bun", "node:*", "deno:*"],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
      "@test": "/tests",
    },
  },
});
