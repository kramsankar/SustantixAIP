/**
 * Generates cross-language conformance fixtures with a throw-away key. The private
 * key is discarded; only the public JWK and signed tokens are written.
 */
import { writeFileSync } from "node:fs";
import { generateKeyPairSync } from "node:crypto";
import { generateSigningKey, issueLicense, issueRevocationList, publicJwkOf } from "@sustantix/license/issuer";

const out = process.argv[2];
if (!out) throw new Error("usage: make-fixtures.ts <dir>");
const ORG = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const OTHER = "00000000-0000-0000-0000-000000000001";
const NOW = 1_790_000_000;
const DAY = 86400;
const { signing, publicJwk } = generateSigningKey("sx-fixture");
const rogue = generateSigningKey("sx-fixture").signing;
const cust = { id: "C-001", name: "Conformance IPP" };

const trial = issueLicense(signing, { customer: cust, edition: "trial", platform: "powerplatform", bind: { orgId: ORG }, trialDays: 30 }, NOW);
const paid = issueLicense(signing, { customer: cust, edition: "enterprise", platform: "any", bind: { orgId: ORG }, validDays: 365, graceDays: 15, modules: ["portfolio"] }, NOW);
const web = issueLicense(signing, { customer: cust, edition: "standard", platform: "vercel", bind: { domains: ["aip.example.test"] }, validDays: 30 }, NOW);
const envOnly = issueLicense(signing, { customer: cust, edition: "standard", platform: "powerplatform", bind: { environmentId: "11111111-2222-3333-4444-555555555555" }, validDays: 30 }, NOW);
const forged = issueLicense(rogue, { customer: cust, edition: "enterprise", platform: "any", bind: { orgId: ORG }, validDays: 3650 }, NOW);
const [p, k, body, sig] = trial.token.split(".");
const bodyObj = JSON.parse(Buffer.from(body!, "base64url").toString());
bodyObj.exp += 365 * DAY;
const tampered = [p, k, Buffer.from(JSON.stringify(bodyObj)).toString("base64url"), sig].join(".");
const revocation = issueRevocationList(signing, [paid.payload.lid], NOW);
const weak = generateKeyPairSync("rsa", { modulusLength: 2048 });

const cases = [
  { name: "trial valid", token: trial.token, org: ORG, now: NOW + DAY, expect: "valid", access: "full", days: 29 },
  { name: "trial expired", token: trial.token, org: ORG, now: NOW + 30 * DAY, expect: "expired", access: "none" },
  { name: "trial wrong org", token: trial.token, org: OTHER, now: NOW, expect: "binding_mismatch", access: "none" },
  { name: "paid grace", token: paid.token, org: ORG, now: NOW + 370 * DAY, expect: "grace", access: "read_only" },
  { name: "paid expired after grace", token: paid.token, org: ORG, now: NOW + 381 * DAY, expect: "expired", access: "none" },
  { name: "paid revoked", token: paid.token, org: ORG, now: NOW, revocation, expect: "revoked", access: "none" },
  { name: "web license on dataverse", token: web.token, org: ORG, now: NOW, expect: "platform_mismatch", access: "none" },
  { name: "environment-only binding cannot be proven server-side", token: envOnly.token, org: ORG, now: NOW, expect: "binding_mismatch", access: "none" },
  { name: "forged signature", token: forged.token, org: ORG, now: NOW, expect: "invalid_signature", access: "none" },
  { name: "tampered payload", token: tampered, org: ORG, now: NOW, expect: "invalid_signature", access: "none" },
  { name: "not yet valid", token: trial.token, org: ORG, now: NOW - DAY, expect: "not_yet_valid", access: "none" },
  { name: "clock rollback", token: trial.token, org: ORG, now: NOW + 2 * DAY, clock: { lid: trial.payload.lid, firstSeen: NOW, lastSeen: NOW + 10 * DAY }, expect: "clock_tamper", access: "none" },
  { name: "malformed", token: "SXL1.x.y", org: ORG, now: NOW, expect: "malformed", access: "none" },
  { name: "empty", token: "", org: ORG, now: NOW, expect: "no_license", access: "none" },
];
writeFileSync(`${out}/trusted-keys.json`, JSON.stringify([publicJwk], null, 2) + "\n");
writeFileSync(`${out}/weak-keys.json`, JSON.stringify([publicJwkOf("sx-fixture", weak.publicKey)], null, 2) + "\n");
writeFileSync(`${out}/cases.json`, JSON.stringify(cases, null, 2) + "\n");
console.log(`wrote ${cases.length} conformance cases to ${out}`);
