// Builds the Enterprise Grid browser bundle and its workspace page (shipped inside the runtime bundle under grid/).
import { build } from "esbuild";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";

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
// The screen census as data: how many tables each screen shows as grids (read by the runtime's grid crawl).
const specs = await build({ entryPoints: ["src/ui/screen-specs.ts"], bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "warning" });
const { SCREEN_GRIDS } = await import(`data:text/javascript;base64,${Buffer.from(specs.outputFiles[0].text).toString("base64")}`);
writeFileSync("dist/screen-grids.json", JSON.stringify(Object.fromEntries(SCREEN_GRIDS.map((s) => [s.view, s.tables.length])), null, 1) + "\n");
console.log("grid: built dist/aip-grid.js and dist/index.html");
