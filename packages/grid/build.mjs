// Builds the Enterprise Grid browser bundle and its workspace page (shipped inside the runtime bundle under grid/).
import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["src/entry.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
  sourcemap: false,
  outfile: "dist/aip-grid.js",
  logLevel: "warning",
});
copyFileSync("src/workspace.html", "dist/index.html");
console.log("grid: built dist/aip-grid.js and dist/index.html");
