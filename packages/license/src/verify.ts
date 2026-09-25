import { b64urlDecode, fromUtf8, sha256Hex, utf8 } from "./codec.js";
import {
  CLOCK_ROLLBACK_TOLERANCE_SEC,
  MAX_TRIAL_DAYS,
  MIN_RSA_BITS,
  REVOCATION_PREFIX,
  TOKEN_PREFIX,
  type ClockState,
  type LicensePayload,
  type LicenseStatus,
  type RevocationList,
  type RuntimeEnvironment,
  type TrustedKey,
} from "./types.js";

const ALG = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" } as const;
const DAY = 86400;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface VerifyOptions {
  trustedKeys: TrustedKey[];
  environment: RuntimeEnvironment;
  /** Authoritative current time (epoch seconds). Servers pass their own clock. */
  now: number;
  clock?: ClockState | null;
  revocation?: RevocationList | null;
}

export interface VerifyResult {
  status: LicenseStatus;
  /** Clock memory to persist after a successful evaluation. */
  nextClock?: ClockState;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function modulusBits(n: string): number {
  const bytes = b64urlDecode(n);
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  if (i === bytes.length) return 0;
  return (bytes.length - i - 1) * 8 + Math.floor(Math.log2(bytes[i]!)) + 1;
}

async function importKey(k: TrustedKey): Promise<CryptoKey> {
  const cacheKey = k.kid + ":" + k.n.slice(0, 32);
  let p = keyCache.get(cacheKey);
  if (!p) {
    if (k.kty !== "RSA" || modulusBits(k.n) < MIN_RSA_BITS) {
      throw new Error(`trusted key ${k.kid} is not an RSA key of at least ${MIN_RSA_BITS} bits`);
    }
    p = crypto.subtle.importKey("jwk", { kty: "RSA", n: k.n, e: k.e, alg: "RS512", ext: true }, ALG, false, ["verify"]);
    keyCache.set(cacheKey, p);
  }
  return p;
}

interface ParsedToken {
  prefix: string;
  kid: string;
  payload: unknown;
  signed: Uint8Array<ArrayBuffer>;
  signature: Uint8Array<ArrayBuffer>;
}

function parse(token: string, prefix: string): ParsedToken | null {
  const parts = token.trim().split(".");
  if (parts.length !== 4 || parts[0] !== prefix) return null;
  const [p, kid, body, sig] = parts as [string, string, string, string];
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(kid)) return null;
  try {
    return {
      prefix: p,
      kid,
      payload: JSON.parse(fromUtf8(b64urlDecode(body))),
      signed: utf8(`${p}.${kid}.${body}`),
      signature: b64urlDecode(sig),
    };
  } catch {
    return null;
  }
}

async function checkSignature(t: ParsedToken, keys: TrustedKey[]): Promise<"ok" | "unknown_key" | "invalid_signature"> {
  const key = keys.find((k) => k.kid === t.kid);
  if (!key) return "unknown_key";
  const ck = await importKey(key);
  return (await crypto.subtle.verify(ALG, ck, t.signature, t.signed)) ? "ok" : "invalid_signature";
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 256;

/** Structural validation — rejects anything that is not exactly an SXL1 v1 payload. */
export function validatePayload(p: unknown): p is LicensePayload {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  const c = o.customer as Record<string, unknown> | undefined;
  const b = o.bind as Record<string, unknown> | undefined;
  if (o.v !== 1 || !isStr(o.lid) || !c || !isStr(c.id) || !isStr(c.name)) return false;
  if (!["trial", "standard", "enterprise"].includes(o.edition as string)) return false;
  if (!["powerplatform", "vercel", "any"].includes(o.platform as string)) return false;
  if (!isInt(o.iat) || !isInt(o.nbf) || !isInt(o.exp) || o.exp <= o.nbf) return false;
  if (!Array.isArray(o.modules) || !o.modules.every(isStr)) return false;
  if (!b || typeof b !== "object") return false;
  for (const f of ["orgId", "environmentId", "tenantId"] as const) {
    if (b[f] !== undefined && !(typeof b[f] === "string" && GUID.test((b[f] as string).toLowerCase()))) return false;
  }
  if (b.domains !== undefined && !(Array.isArray(b.domains) && b.domains.every(isStr))) return false;
  for (const f of ["trialDays", "graceDays", "seats"] as const) {
    if (o[f] !== undefined && !(isInt(o[f]) && (o[f] as number) >= 0)) return false;
  }
  return true;
}

/** A license must carry at least one binding the runtime can prove. */
function bindingCheck(p: LicensePayload, env: RuntimeEnvironment): string | null {
  const b = p.bind;
  const pinned = [b.orgId, b.environmentId, b.tenantId, b.domains?.length ? "d" : undefined].filter(Boolean);
  if (pinned.length === 0) return "license carries no environment binding";
  const eq = (a?: string, c?: string) => !!a && !!c && a.toLowerCase() === c.toLowerCase();
  if (b.orgId && env.orgId !== undefined && !eq(b.orgId, env.orgId)) return "Dataverse organisation does not match";
  if (b.environmentId && env.environmentId !== undefined && !eq(b.environmentId, env.environmentId))
    return "Power Platform environment does not match";
  if (b.tenantId && env.tenantId !== undefined && !eq(b.tenantId, env.tenantId)) return "Entra tenant does not match";
  if (b.domains?.length && env.hostname !== undefined) {
    const host = env.hostname.toLowerCase();
    if (!b.domains.some((d) => d.toLowerCase() === host)) return `host ${host} is not licensed`;
  }
  // At least one binding must have been actually verified against the runtime.
  const proven =
    (b.orgId && env.orgId !== undefined) ||
    (b.environmentId && env.environmentId !== undefined) ||
    (b.tenantId && env.tenantId !== undefined) ||
    (b.domains?.length && env.hostname !== undefined);
  return proven ? null : "runtime could not prove any licensed binding";
}

function trialCheck(p: LicensePayload): string | null {
  if (p.edition !== "trial") return null;
  if (!isInt(p.trialDays) || p.trialDays < 1 || p.trialDays > MAX_TRIAL_DAYS) return "trial length outside policy";
  if (p.exp - p.nbf > p.trialDays * DAY + 300) return "trial window exceeds granted days";
  if (p.graceDays) return "trials carry no grace period";
  return null;
}

async function fingerprint(token: string): Promise<string> {
  return (await sha256Hex(utf8(token.trim()))).slice(0, 16).toUpperCase();
}

function status(state: LicenseStatus["state"], reason: string, extra: Partial<LicenseStatus> = {}): LicenseStatus {
  const access = state === "valid" ? "full" : state === "grace" ? "read_only" : "none";
  return { state, access, reason, ...extra };
}

/** Verify a signed revocation list; returns null when absent or untrusted. */
export async function verifyRevocationList(token: string | null | undefined, keys: TrustedKey[]): Promise<RevocationList | null> {
  if (!token) return null;
  const t = parse(token, REVOCATION_PREFIX);
  if (!t || (await checkSignature(t, keys)) !== "ok") return null;
  const o = t.payload as Record<string, unknown>;
  if (o.v !== 1 || !isInt(o.iat) || !Array.isArray(o.revoked) || !o.revoked.every(isStr)) return null;
  return o as unknown as RevocationList;
}

export async function verifyLicense(token: string | null | undefined, opts: VerifyOptions): Promise<VerifyResult> {
  if (!opts.trustedKeys.length) return { status: status("no_trusted_keys", "this build has no trusted license keys configured") };
  if (!token || !token.trim()) return { status: status("no_license", "no license key installed") };
  const t = parse(token, TOKEN_PREFIX);
  if (!t) return { status: status("malformed", "license key is not a valid SXL1 token") };
  const fp = await fingerprint(token);
  const sig = await checkSignature(t, opts.trustedKeys).catch(() => "invalid_signature" as const);
  if (sig !== "ok") {
    return { status: status(sig, sig === "unknown_key" ? `signing key ${t.kid} is not trusted` : "signature verification failed", { fingerprint: fp, kid: t.kid }) };
  }
  if (!validatePayload(t.payload)) return { status: status("malformed", "license payload failed validation", { fingerprint: fp }) };
  const p = t.payload;
  const base = { license: p, kid: t.kid, fingerprint: fp, expiresAt: new Date(p.exp * 1000).toISOString() };

  if (p.platform !== "any" && p.platform !== opts.environment.platform)
    return { status: status("platform_mismatch", `license is for ${p.platform}`, base) };
  const bind = bindingCheck(p, opts.environment);
  if (bind) return { status: status("binding_mismatch", bind, base) };
  const trial = trialCheck(p);
  if (trial) return { status: status("trial_policy_violation", trial, base) };
  if (opts.revocation?.revoked.includes(p.lid)) return { status: status("revoked", "license has been revoked", base) };

  const now = opts.now;
  if (opts.clock && opts.clock.lid === p.lid && now + CLOCK_ROLLBACK_TOLERANCE_SEC < opts.clock.lastSeen) {
    return { status: status("clock_tamper", "system clock moved backwards since last validation", base) };
  }
  const nextClock: ClockState = {
    lid: p.lid,
    firstSeen: opts.clock?.lid === p.lid ? opts.clock.firstSeen : now,
    lastSeen: Math.max(now, opts.clock?.lid === p.lid ? opts.clock.lastSeen : 0),
  };
  const daysRemaining = Math.floor((p.exp - now) / DAY);
  if (now < p.nbf) return { status: status("not_yet_valid", "license is not yet active", { ...base, daysRemaining }), nextClock };
  if (now >= p.exp) {
    const grace = p.edition === "trial" ? 0 : p.graceDays ?? 0;
    if (now < p.exp + grace * DAY)
      return { status: status("grace", "license expired — read-only grace period", { ...base, daysRemaining }), nextClock };
    return { status: status("expired", p.edition === "trial" ? "trial has ended" : "license has expired", { ...base, daysRemaining }), nextClock };
  }
  return { status: status("valid", p.edition === "trial" ? "trial active" : "license active", { ...base, daysRemaining }), nextClock };
}
