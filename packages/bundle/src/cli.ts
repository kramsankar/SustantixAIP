#!/usr/bin/env -S npx tsx
/**
 * sx-bundle — moves a tenant's governed data between Sustantix AIP editions, keyed on business codes.
 *
 *   sx-bundle export --from vercel --url https://aip.customer.example --out tenant.aipbundle      (SX_INTEGRATION_KEY)
 *   sx-bundle export --from dataverse --env https://org.crm.dynamics.com --out tenant.aipbundle   (PP_* sign-in)
 *   sx-bundle import --to vercel|dataverse … --in tenant.aipbundle [--dry-run]
 *   sx-bundle verify --in tenant.aipbundle
 *
 * Vercel needs an administrator integration key (POST /api/aip/integrations, role admin) in SX_INTEGRATION_KEY.
 * Dataverse signs in as provisioning does (PP_ACCESS_TOKEN, a service principal, or device code) and writes with the
 * signed-in user's security roles. A bundle never carries platform vocabulary, secrets, users or audit history.
 */
import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import type { ChangeModel } from "@sustantix/grid";
import type { QualityRules } from "@sustantix/schema";
import { tokenProvider } from "@sustantix/pp-provision/src/auth.ts";
import { WebApi } from "@sustantix/pp-provision/src/webapi.ts";
import { exportBundle, importBundle, readBundle, type BundleSink, type BundleSource } from "./bundle.ts";
import { dataverseSide } from "./dataverse.ts";
import { webApiGridClient } from "./dataverse-webapi.ts";
import { vercelSink, vercelSource } from "./vercel.ts";

const json = (rel: string) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8")) as unknown;
const MODEL = json("../../../schema/aip-change-model.json") as ChangeModel;
const RULES = json("../../../schema/quality/rules.json") as QualityRules;
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const need = (name: string) => flag(name) ?? fail(`--${name} is required`);
function fail(msg: string): never {
  console.error(`sx-bundle: ${msg}`);
  process.exit(2);
}

async function side(edition: string | undefined): Promise<{ source: BundleSource; sink: BundleSink }> {
  if (edition === "vercel") {
    const key = process.env.SX_INTEGRATION_KEY ?? fail("set SX_INTEGRATION_KEY to an administrator integration key");
    const t = { url: need("url"), key };
    return { source: vercelSource(t), sink: vercelSink(t) };
  }
  if (edition === "dataverse") {
    const env = need("env");
    const client = await webApiGridClient(new WebApi({ envUrl: env, token: tokenProvider(env) }));
    return dataverseSide(client, MODEL, RULES, { tenant: new URL(env).hostname, newId: randomUUID });
  }
  return fail("choose an edition: vercel or dataverse");
}

const lines = (file: string) => createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });

const [command] = args;
if (command === "export") {
  const { source } = await side(flag("from"));
  const out = need("out");
  await pipeline(Readable.from((async function* () {
    for await (const line of exportBundle(source, MODEL)) yield `${line}\n`;
  })()), createGzip(), createWriteStream(out));
  const b = await readBundle(lines(out), MODEL);
  console.log(`exported ${[...b.entities.values()].reduce((n, r) => n + r.length, 0)} records of ${b.entities.size} entities → ${out}`);
} else if (command === "verify" || command === "import") {
  const file = need("in");
  const bundle = await readBundle(lines(file), MODEL);
  console.log(`bundle from ${bundle.header.source.edition} (${bundle.header.source.tenant}), ${bundle.header.exportedAt}: ${bundle.entities.size} entities, checksums verified`);
  if (command === "import") {
    if (args.includes("--dry-run")) {
      for (const [e, r] of bundle.entities) console.log(`  ${e}: ${r.length}`);
    } else {
      const { sink } = await side(flag("to"));
      const report = await importBundle(bundle, MODEL, sink, (m) => console.log(`  ${m}`));
      const q = report.entities.reduce((n, e) => n + e.quarantined, 0);
      for (const x of report.issues.slice(0, 50)) console.log(`  ! ${x.entity} ${x.record ?? ""}: ${x.message}`);
      console.log(q ? `imported with ${q} record(s) quarantined; fix them at the source or in the target and import again` : "imported: every record applied or already present");
      process.exitCode = q ? 1 : 0;
    }
  }
} else {
  fail("usage: sx-bundle export|import|verify (see the header of src/cli.ts)");
}
