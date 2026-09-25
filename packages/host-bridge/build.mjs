// Builds one self-contained IIFE bridge per hosting target.
import { build } from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const keys = JSON.parse(readFileSync(root + "config/license/trusted-keys.json", "utf8"));
// Test-only: CI parity runs add an ephemeral key. Never set for release builds.
if (process.env.AIP_EXTRA_TRUSTED_KEYS && existsSync(process.env.AIP_EXTRA_TRUSTED_KEYS)) {
  if (process.env.AIP_RELEASE === "1") throw new Error("AIP_EXTRA_TRUSTED_KEYS is forbidden in release builds");
  keys.push(...JSON.parse(readFileSync(process.env.AIP_EXTRA_TRUSTED_KEYS, "utf8")));
}
for (const target of ["standalone", "vercel", "powerapps"]) {
  await build({
    entryPoints: [`src/entry-${target}.ts`],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    legalComments: "none",
    sourcemap: false,
    outfile: `dist/${target}/aip-host-bridge.js`,
    define: { __AIP_TRUSTED_KEYS__: JSON.stringify(keys) },
    logLevel: "warning",
  });
}
console.log(`host-bridge: built standalone, vercel, powerapps (${keys.length} trusted key(s))`);
