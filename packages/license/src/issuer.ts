/**
 * License issuance — Node only. Runs exclusively on the Sustantix issuing
 * workstation / vault-backed pipeline. Private keys never enter a product build.
 */
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign, type KeyObject } from "node:crypto";
import { b64urlEncode, utf8 } from "./codec.js";
import {
  MAX_TRIAL_DAYS,
  MIN_RSA_BITS,
  REVOCATION_PREFIX,
  TOKEN_PREFIX,
  type Edition,
  type LicenseBinding,
  type LicensePayload,
  type Platform,
  type RevocationList,
  type TrustedKey,
} from "./types.js";
import { validatePayload } from "./verify.js";

const DAY = 86400;

export interface SigningKey {
  kid: string;
  privateKeyPem: string;
}

export function generateSigningKey(kid: string): { signing: SigningKey; publicJwk: TrustedKey } {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid)) throw new Error("kid must be 1-64 chars of [A-Za-z0-9_-]");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: MIN_RSA_BITS, publicExponent: 0x10001 });
  return {
    signing: { kid, privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString() },
    publicJwk: publicJwkOf(kid, publicKey),
  };
}

export function publicJwkOf(kid: string, key: KeyObject): TrustedKey {
  const jwk = key.export({ format: "jwk" }) as { n: string; e: string };
  return { kid, kty: "RSA", n: jwk.n, e: jwk.e };
}

export function publicJwkFromPrivatePem(kid: string, pem: string): TrustedKey {
  return publicJwkOf(kid, createPublicKey(createPrivateKey(pem)));
}

function signToken(prefix: string, key: SigningKey, payload: object): string {
  const pk = createPrivateKey(key.privateKeyPem);
  const details = pk.asymmetricKeyDetails;
  if (pk.asymmetricKeyType !== "rsa" || !details?.modulusLength || details.modulusLength < MIN_RSA_BITS) {
    throw new Error(`signing key must be RSA >= ${MIN_RSA_BITS} bits`);
  }
  const body = b64urlEncode(utf8(JSON.stringify(payload)));
  const signed = `${prefix}.${key.kid}.${body}`;
  const signature = sign("sha512", Buffer.from(signed, "utf8"), pk);
  return `${signed}.${b64urlEncode(new Uint8Array(signature))}`;
}

export interface IssueRequest {
  customer: { id: string; name: string };
  edition: Edition;
  platform: Platform;
  bind: LicenseBinding;
  /** Paid editions: validity in days from start. Trials: use trialDays. */
  validDays?: number;
  trialDays?: number;
  graceDays?: number;
  seats?: number;
  modules?: string[];
  /** Start of validity (epoch seconds); defaults to now. */
  startsAt?: number;
  lid?: string;
}

export function buildPayload(req: IssueRequest, now = Math.floor(Date.now() / 1000)): LicensePayload {
  const nbf = req.startsAt ?? now;
  let exp: number;
  if (req.edition === "trial") {
    const days = req.trialDays ?? 0;
    if (!Number.isInteger(days) || days < 1 || days > MAX_TRIAL_DAYS) throw new Error(`trialDays must be 1..${MAX_TRIAL_DAYS}`);
    if (req.graceDays) throw new Error("trials cannot carry a grace period");
    exp = nbf + days * DAY;
  } else {
    const days = req.validDays ?? 0;
    if (!Number.isInteger(days) || days < 1 || days > 3660) throw new Error("validDays must be 1..3660");
    exp = nbf + days * DAY;
  }
  const bind: LicenseBinding = {};
  if (req.bind.orgId) bind.orgId = req.bind.orgId.toLowerCase();
  if (req.bind.environmentId) bind.environmentId = req.bind.environmentId.toLowerCase();
  if (req.bind.tenantId) bind.tenantId = req.bind.tenantId.toLowerCase();
  if (req.bind.domains?.length) bind.domains = req.bind.domains.map((d) => d.toLowerCase());
  if (!Object.keys(bind).length) throw new Error("a license must be bound to at least one org, environment, tenant or domain");

  const payload: LicensePayload = {
    v: 1,
    lid: req.lid ?? randomUUID(),
    customer: req.customer,
    edition: req.edition,
    platform: req.platform,
    bind,
    iat: now,
    nbf,
    exp,
    modules: req.modules?.length ? req.modules : ["*"],
  };
  if (req.edition === "trial") payload.trialDays = req.trialDays;
  if (req.graceDays) payload.graceDays = req.graceDays;
  if (req.seats) payload.seats = req.seats;
  if (!validatePayload(payload)) throw new Error("payload failed validation");
  return payload;
}

export function issueLicense(key: SigningKey, req: IssueRequest, now?: number): { token: string; payload: LicensePayload } {
  const payload = buildPayload(req, now);
  return { token: signToken(TOKEN_PREFIX, key, payload), payload };
}

export function issueRevocationList(key: SigningKey, revoked: string[], now = Math.floor(Date.now() / 1000)): string {
  const list: RevocationList = { v: 1, iat: now, revoked: [...new Set(revoked)].sort() };
  return signToken(REVOCATION_PREFIX, key, list);
}
