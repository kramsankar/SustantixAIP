import { generateKeyPairSync } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { generateSigningKey, issueLicense, issueRevocationList, publicJwkOf, type SigningKey } from "../src/issuer.js";
import { grantedModules, isViewLicensed } from "../src/modules.js";
import type { RuntimeEnvironment, TrustedKey } from "../src/types.js";
import { verifyLicense, verifyRevocationList } from "../src/verify.js";

const ORG = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const ENV_ID = "11111111-2222-3333-4444-555555555555";
const NOW = 1_790_000_000;
const DAY = 86400;

let key: SigningKey;
let jwk: TrustedKey;
let other: { signing: SigningKey; publicJwk: TrustedKey };
const pp: RuntimeEnvironment = { platform: "powerplatform", orgId: ORG };

beforeAll(() => {
  const k = generateSigningKey("sx-test-1");
  key = k.signing;
  jwk = k.publicJwk;
  other = generateSigningKey("sx-test-2");
});

const trial = (days = 30, extra = {}) =>
  issueLicense(key, { customer: { id: "C-001", name: "Demo IPP" }, edition: "trial", platform: "powerplatform", bind: { orgId: ORG }, trialDays: days, ...extra }, NOW);

const verify = (token: string, now = NOW, env: RuntimeEnvironment = pp, extra = {}) =>
  verifyLicense(token, { trustedKeys: [jwk], environment: env, now, ...extra });

describe("SXL1 signature and structure", () => {
  it("accepts a freshly issued trial", async () => {
    const { status } = await verify(trial().token);
    expect(status.state).toBe("valid");
    expect(status.access).toBe("full");
    expect(status.daysRemaining).toBe(30);
    expect(status.fingerprint).toMatch(/^[0-9A-F]{16}$/);
  });

  it("fails closed when the build has no trusted keys", async () => {
    const r = await verifyLicense(trial().token, { trustedKeys: [], environment: pp, now: NOW });
    expect(r.status.state).toBe("no_trusted_keys");
    expect(r.status.access).toBe("none");
  });

  it("reports a missing license", async () => {
    expect((await verify("")).status.state).toBe("no_license");
  });

  it("rejects malformed tokens", async () => {
    for (const bad of ["SXL1.a.b", "XXX1.k.e30.AA", "SXL1.k!.e30.AA", "SXL1.sx-test-1.%%%.AA"]) {
      expect((await verify(bad)).status.state).toBe("malformed");
    }
  });

  it("rejects a token whose payload was altered (extended expiry)", async () => {
    const { token } = trial();
    const [p, kid, body, sig] = token.split(".");
    const payload = JSON.parse(Buffer.from(body!, "base64url").toString());
    payload.exp += 365 * DAY;
    const forged = [p, kid, Buffer.from(JSON.stringify(payload)).toString("base64url"), sig].join(".");
    expect((await verify(forged)).status.state).toBe("invalid_signature");
  });

  it("rejects a token signed by an untrusted key presenting a trusted kid", async () => {
    const impostor = { kid: "sx-test-1", privateKeyPem: other.signing.privateKeyPem };
    const { token } = issueLicense(impostor, { customer: { id: "X", name: "X" }, edition: "enterprise", platform: "any", bind: { orgId: ORG }, validDays: 3650 }, NOW);
    expect((await verify(token)).status.state).toBe("invalid_signature");
  });

  it("rejects an unknown key id", async () => {
    const { token } = issueLicense(other.signing, { customer: { id: "X", name: "X" }, edition: "standard", platform: "any", bind: { orgId: ORG }, validDays: 30 }, NOW);
    expect((await verify(token)).status.state).toBe("unknown_key");
  });

  it("refuses to trust RSA keys below 4096 bits", async () => {
    const weak = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const weakJwk = publicJwkOf("sx-test-1", weak.publicKey);
    const r = await verifyLicense(trial().token, { trustedKeys: [weakJwk], environment: pp, now: NOW });
    expect(r.status.state).toBe("invalid_signature");
  });

  it("issuer refuses to sign with a weak key", () => {
    const weak = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = weak.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    expect(() => issueLicense({ kid: "w", privateKeyPem: pem }, { customer: { id: "a", name: "a" }, edition: "standard", platform: "any", bind: { orgId: ORG }, validDays: 1 })).toThrow(/4096/);
  });
});

describe("trial lifecycle", () => {
  it("counts down and expires exactly at the trial boundary", async () => {
    const { token } = trial(14);
    expect((await verify(token, NOW + 13 * DAY)).status).toMatchObject({ state: "valid", daysRemaining: 1 });
    expect((await verify(token, NOW + 14 * DAY)).status).toMatchObject({ state: "expired", access: "none" });
  });

  it("gives trials no grace period", () => {
    expect(() => trial(14, { graceDays: 5 })).toThrow(/grace/);
  });

  it("caps trial length at 90 days at issue time", () => {
    expect(() => trial(91)).toThrow(/trialDays/);
  });

  it("is not valid before its start", async () => {
    const { token } = issueLicense(key, { customer: { id: "C", name: "C" }, edition: "trial", platform: "powerplatform", bind: { orgId: ORG }, trialDays: 7, startsAt: NOW + DAY }, NOW);
    expect((await verify(token)).status.state).toBe("not_yet_valid");
  });
});

describe("paid editions", () => {
  const paid = () => issueLicense(key, { customer: { id: "C", name: "C" }, edition: "enterprise", platform: "any", bind: { orgId: ORG, domains: ["aip.customer.com"] }, validDays: 365, graceDays: 15, modules: ["portfolio", "maintenance"] }, NOW).token;

  it("enters read-only grace after expiry, then locks", async () => {
    expect((await verify(paid(), NOW + 366 * DAY)).status).toMatchObject({ state: "grace", access: "read_only" });
    expect((await verify(paid(), NOW + 381 * DAY)).status).toMatchObject({ state: "expired", access: "none" });
  });

  it("verifies domain binding on the web platform", async () => {
    const web = (hostname: string): RuntimeEnvironment => ({ platform: "vercel", hostname });
    expect((await verify(paid(), NOW, web("aip.customer.com"))).status.state).toBe("valid");
    expect((await verify(paid(), NOW, web("evil.example.net"))).status.state).toBe("binding_mismatch");
  });

  it("gates views by licensed module", () => {
    expect(grantedModules(["portfolio"])).toEqual(expect.arrayContaining(["portfolio", "core"]));
    expect(isViewLicensed("assetexplorer", ["portfolio"])).toBe(true);
    expect(isViewLicensed("sustainabilityintelligence", ["portfolio"])).toBe(false);
    expect(isViewLicensed("datamanagement", [])).toBe(true);
  });
});

describe("binding", () => {
  it("rejects a license installed in another Dataverse org", async () => {
    const r = await verify(trial().token, NOW, { platform: "powerplatform", orgId: "00000000-0000-0000-0000-000000000001" });
    expect(r.status.state).toBe("binding_mismatch");
  });

  it("rejects when the runtime cannot prove any binding", async () => {
    const r = await verify(trial().token, NOW, { platform: "powerplatform", environmentId: ENV_ID });
    expect(r.status.state).toBe("binding_mismatch");
  });

  it("rejects the wrong platform", async () => {
    expect((await verify(trial().token, NOW, { platform: "vercel", orgId: ORG })).status.state).toBe("platform_mismatch");
  });

  it("issuer refuses unbound licenses", () => {
    expect(() => issueLicense(key, { customer: { id: "a", name: "a" }, edition: "standard", platform: "any", bind: {}, validDays: 10 })).toThrow(/bound/);
  });
});

describe("anti-rollback and revocation", () => {
  it("flags a clock moved backwards beyond tolerance", async () => {
    const { token, payload } = trial(30);
    const first = await verify(token, NOW + 10 * DAY);
    expect(first.nextClock).toMatchObject({ lid: payload.lid, lastSeen: NOW + 10 * DAY });
    const rolled = await verify(token, NOW + 2 * DAY, pp, { clock: first.nextClock });
    expect(rolled.status.state).toBe("clock_tamper");
    const jitter = await verify(token, NOW + 10 * DAY - 600, pp, { clock: first.nextClock });
    expect(jitter.status.state).toBe("valid");
  });

  it("honours a signed revocation list and ignores a forged one", async () => {
    const { token, payload } = trial();
    const list = await verifyRevocationList(issueRevocationList(key, [payload.lid], NOW), [jwk]);
    expect((await verify(token, NOW, pp, { revocation: list })).status.state).toBe("revoked");
    const forged = await verifyRevocationList(issueRevocationList(other.signing, [payload.lid], NOW), [jwk]);
    expect(forged).toBeNull();
  });
});
