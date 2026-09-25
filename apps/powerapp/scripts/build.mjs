// Builds the code-app bundle into ./dist from the shared AIP runtime.
//   node scripts/build.mjs [--release]
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readGeneratedDataSources } from "./datasources.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
const root = join(app, "../..");
const release = process.argv.includes("--release");

const generated = readGeneratedDataSources(join(app, ".power/schemas/appschemas/dataSourcesInfo.ts"));
const env = { ...process.env };
if (release) {
  env.AIP_RELEASE = "1";
  delete env.AIP_EXTRA_TRUSTED_KEYS;
  if (!generated) throw new Error("release build requires `pac code add-data-source -a dataverse -t sus_runtimestate` first");
}
if (generated) {
  const tmp = join(app, ".power/aip-datasources.json");
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, JSON.stringify(generated));
  env.AIP_PA_DATASOURCES = tmp;
}
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, env, stdio: "inherit" });
run("node", ["build.mjs"], join(root, "packages/host-bridge"));
run("node", ["build.mjs", "--target", "powerapps", "--out", join(app, "dist")], join(root, "apps/runtime"));
if (!existsSync(join(app, "dist/index.html"))) throw new Error("runtime build produced no index.html");
console.log(`code app bundle ready → ${join(app, "dist")}${release ? " (release)" : ""}`);
