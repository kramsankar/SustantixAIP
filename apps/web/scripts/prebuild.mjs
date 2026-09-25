// Assembles the Vercel runtime bundle into public/aip before `next build`.
//   node scripts/prebuild.mjs [--if-missing]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(web, "../..");
const runtime = join(root, "apps/runtime");
const target = join(web, "public/aip");

if (process.argv.includes("--if-missing") && existsSync(join(target, "index.html"))) {
  console.log("prebuild: public/aip already present — skipping (delete it to rebuild)");
  process.exit(0);
}

const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });

run("pnpm", ["--filter", "@sustantix/license", "run", "build"]);
run("pnpm", ["--filter", "@sustantix/host-bridge", "run", "build"]);
// build.mjs resolves --out relative to apps/runtime.
run(process.execPath, ["build.mjs", "--target", "vercel", "--out", relative(runtime, target)], runtime);

for (const required of ["index.html", "host/aip-host-bridge.js", "vendor/xlsx.full.min.js", "build-info.json"]) {
  if (!existsSync(join(target, required))) throw new Error(`prebuild: runtime bundle is missing ${required}`);
}
const info = JSON.parse(readFileSync(join(target, "build-info.json"), "utf8"));
if (info.target !== "vercel") throw new Error(`prebuild: expected a vercel runtime bundle, got ${info.target}`);
console.log(`prebuild: runtime ${info.release} (${info.datasets} datasets, ${info.dataMB} MB data) → public/aip · index.html ${statSync(join(target, "index.html")).size} bytes`);
