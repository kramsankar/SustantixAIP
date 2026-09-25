#!/usr/bin/env tsx
/**
 * sx-license — Sustantix license issuing console.
 *
 *   keygen  --kid <id> --out <dir-outside-repo> [--keyset <trusted-keys.json>]
 *   issue   --key <private.pem> --kid <id> --customer-id <id> --customer-name <name>
 *           --edition standard|enterprise --platform powerplatform|vercel|any --days <n>
 *           [--grace <n>] [--seats <n>] [--modules a,b] [--org <guid>] [--env <guid>]
 *           [--tenant <guid>] [--domain <host> ...] [--ledger <file.jsonl>]
 *   trial   (same binding flags as issue) --trial-days <1..90>
 *   revoke  --key <private.pem> --kid <id> --lid <license-id> [--lid ...]
 *   inspect <token>
 *   verify  <token> --keyset <trusted-keys.json> --platform <p> [--org|--env|--tenant|--host] [--now <epoch>]
 */
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { b64urlDecode, verifyLicense, type RuntimeEnvironment, type TrustedKey } from "@sustantix/license";
import { generateSigningKey, issueLicense, issueRevocationList, type IssueRequest, type SigningKey } from "@sustantix/license/issuer";

type Flags = Record<string, string[]>;

function parseArgs(argv: string[]): { cmd: string; positional: string[]; flags: Flags } {
  const [cmd = "help", ...rest] = argv;
  const flags: Flags = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = rest[i + 1] && !rest[i + 1]!.startsWith("--") ? rest[++i]! : "true";
      (flags[k] ??= []).push(v);
    } else positional.push(a);
  }
  return { cmd, positional, flags };
}

const one = (f: Flags, k: string, required = false): string | undefined => {
  const v = f[k]?.[f[k]!.length - 1];
  if (required && !v) throw new Error(`--${k} is required`);
  return v;
};
const int = (f: Flags, k: string) => (one(f, k) ? Number.parseInt(one(f, k)!, 10) : undefined);

/** Private keys must never be written inside a git working tree. */
function assertOutsideRepo(dir: string) {
  let d = resolve(dir);
  for (;;) {
    if (existsSync(join(d, ".git"))) throw new Error(`refusing to write a private key inside a git repository (${d})`);
    const parent = dirname(d);
    if (parent === d) return;
    d = parent;
  }
}

function loadKey(f: Flags): SigningKey {
  return { kid: one(f, "kid", true)!, privateKeyPem: readFileSync(one(f, "key", true)!, "utf8") };
}

function request(f: Flags, edition: IssueRequest["edition"]): IssueRequest {
  return {
    customer: { id: one(f, "customer-id", true)!, name: one(f, "customer-name", true)! },
    edition,
    platform: (one(f, "platform") ?? "powerplatform") as IssueRequest["platform"],
    bind: { orgId: one(f, "org"), environmentId: one(f, "env"), tenantId: one(f, "tenant"), domains: f.domain },
    validDays: int(f, "days"),
    trialDays: int(f, "trial-days"),
    graceDays: int(f, "grace"),
    seats: int(f, "seats"),
    modules: one(f, "modules")?.split(",").map((s) => s.trim()).filter(Boolean),
    startsAt: int(f, "starts-at"),
  };
}

function ledger(f: Flags, entry: object) {
  const file = one(f, "ledger");
  if (file) appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...entry }) + "\n");
}

async function main() {
  const { cmd, positional, flags } = parseArgs(process.argv.slice(2));
  switch (cmd) {
    case "keygen": {
      const kid = one(flags, "kid", true)!;
      const out = one(flags, "out", true)!;
      assertOutsideRepo(out);
      mkdirSync(out, { recursive: true });
      const { signing, publicJwk } = generateSigningKey(kid);
      const pemPath = join(out, `${kid}.private.pem`);
      if (existsSync(pemPath)) throw new Error(`${pemPath} already exists — refusing to overwrite a signing key`);
      writeFileSync(pemPath, signing.privateKeyPem, { mode: 0o600 });
      chmodSync(pemPath, 0o600);
      const keyset = one(flags, "keyset");
      if (keyset) {
        const keys: TrustedKey[] = existsSync(keyset) ? JSON.parse(readFileSync(keyset, "utf8")) : [];
        if (keys.some((k) => k.kid === kid)) throw new Error(`kid ${kid} already present in ${keyset}`);
        keys.push(publicJwk);
        writeFileSync(keyset, JSON.stringify(keys, null, 2) + "\n");
      }
      console.log(`private key → ${pemPath} (0600, keep offline / in vault)`);
      console.log(JSON.stringify(publicJwk, null, 2));
      return;
    }
    case "issue":
    case "trial": {
      const key = loadKey(flags);
      const { token, payload } = issueLicense(key, request(flags, cmd === "trial" ? "trial" : ((one(flags, "edition") ?? "standard") as IssueRequest["edition"])));
      ledger(flags, { action: cmd, lid: payload.lid, customer: payload.customer, edition: payload.edition, exp: payload.exp, bind: payload.bind, kid: key.kid });
      console.error(`license ${payload.lid} · ${payload.edition} · expires ${new Date(payload.exp * 1000).toISOString()}`);
      console.log(token);
      return;
    }
    case "revoke": {
      const key = loadKey(flags);
      const lids = flags.lid ?? [];
      if (!lids.length) throw new Error("--lid is required");
      ledger(flags, { action: "revoke", lids, kid: key.kid });
      console.log(issueRevocationList(key, lids));
      return;
    }
    case "inspect": {
      const token = positional[0] ?? "";
      const [prefix, kid, body] = token.split(".");
      console.log(JSON.stringify({ prefix, kid, payload: JSON.parse(new TextDecoder().decode(b64urlDecode(body ?? ""))) }, null, 2));
      return;
    }
    case "verify": {
      const keys: TrustedKey[] = JSON.parse(readFileSync(one(flags, "keyset", true)!, "utf8"));
      const env: RuntimeEnvironment = {
        platform: (one(flags, "platform") ?? "powerplatform") as RuntimeEnvironment["platform"],
        orgId: one(flags, "org"),
        environmentId: one(flags, "env"),
        tenantId: one(flags, "tenant"),
        hostname: one(flags, "host"),
      };
      const r = await verifyLicense(positional[0], { trustedKeys: keys, environment: env, now: int(flags, "now") ?? Math.floor(Date.now() / 1000) });
      console.log(JSON.stringify(r.status, null, 2));
      process.exitCode = r.status.access === "none" ? 2 : 0;
      return;
    }
    default:
      console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]);
  }
}

main().catch((e) => {
  console.error("sx-license: " + (e instanceof Error ? e.message : String(e)));
  process.exitCode = 1;
});
