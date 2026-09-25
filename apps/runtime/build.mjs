// Assembles a deployable AIP runtime for one hosting target.
//   node build.mjs --target standalone|vercel|powerapps --out <dir>
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const target = arg("target", "standalone");
const out = join(here, arg("out", `dist/${target}`));
if (!["standalone", "vercel", "powerapps"].includes(target)) throw new Error("unknown target " + target);

const src = join(here, "src");
const bridge = join(here, "../../packages/host-bridge/dist", target, "aip-host-bridge.js");
if (!existsSync(bridge)) throw new Error("host bridge not built — run `pnpm --filter @sustantix/host-bridge build`");

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "data"), { recursive: true });
for (const dir of ["assets"]) cpSync(join(src, dir), join(out, dir), { recursive: true });
cpSync(join(here, "static"), out, { recursive: true });
cpSync(bridge, join(out, "host", "aip-host-bridge.js"));
mkdirSync(join(out, "vendor"), { recursive: true });
const require = createRequire(import.meta.url);
cpSync(join(dirname(require.resolve("xlsx/package.json")), "dist", "xlsx.full.min.js"), join(out, "vendor", "xlsx.full.min.js"));

let dataBytes = 0;
for (const f of readdirSync(join(src, "data"))) {
  if (!f.endsWith(".json")) continue;
  const text = readFileSync(join(src, "data", f), "utf8");
  JSON.parse(text); // integrity: every dataset must be valid JSON
  const js = `__AIP_REG(${JSON.stringify(f.slice(0, -5))},${JSON.stringify(text)});\n`;
  writeFileSync(join(out, "data", f.slice(0, -5) + ".js"), js);
  dataBytes += js.length;
}
// Scripts are maintained as separate files but shipped inline at their original
// positions: the reference build ran every block synchronously in one parser pass,
// and external loading would let timers interleave between blocks (see docs/runtime.md).
const inline = (file) => {
  const body = readFileSync(join(src, file), "utf8");
  if (/<\/script/i.test(body)) throw new Error(`${file} contains a closing script tag`);
  return body;
};
let html = readFileSync(join(src, "index.html"), "utf8");
let inlined = 0;
html = html.replace(/<script( id="[^"]*")? src="(js\/[^"]+)"><\/script>/g, (_, id = "", file) => (inlined++, `<script${id}>${inline(file)}</script>`));
html = html.replace(/<script type="application\/x-aip-deferred"( id="[^"]*")? data-aip-src="(js\/[^"]+)"><\/script>/g, (_, id = "", file) => (inlined++, `<script type="application/x-aip-deferred"${id}>${inline(file)}</script>`));
writeFileSync(join(out, "index.html"), html);
rmSync(join(out, "js"), { recursive: true, force: true });

const manifest = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8"));
const info = {
  product: "Sustantix Asset Intelligence Platform",
  release: "7.32.0",
  target,
  referenceSha256: manifest.sourceSha256,
  bridgeSha256: createHash("sha256").update(readFileSync(bridge)).digest("hex"),
  builtAt: new Date().toISOString(),
  scripts: inlined,
  datasets: Object.keys(manifest.datasets).length,
  dataMB: +(dataBytes / 1e6).toFixed(1),
};
writeFileSync(join(out, "build-info.json"), JSON.stringify(info, null, 2));
console.log(`runtime(${target}) → ${out} · ${info.scripts} scripts · ${info.datasets} datasets · ${info.dataMB} MB data`);
