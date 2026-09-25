/** Sustantix License v1 (SXL1) — shared contract across browser, server and Dataverse plug-in. */

export const TOKEN_PREFIX = "SXL1";
export const REVOCATION_PREFIX = "SXR1";
/** Hard ceiling for any trial, independent of what an issuer requests. */
export const MAX_TRIAL_DAYS = 90;
/** Minimum RSA modulus accepted for a trusted signing key. */
export const MIN_RSA_BITS = 4096;
/** Tolerated backwards clock movement before a tamper is flagged (seconds). */
export const CLOCK_ROLLBACK_TOLERANCE_SEC = 60 * 60;

export type Edition = "trial" | "standard" | "enterprise";
export type Platform = "powerplatform" | "vercel" | "any";

/** Everything a license can be pinned to. Every field present in the license must match. */
export interface LicenseBinding {
  /** Dataverse organisation id (GUID) — verified server-side by the plug-in. */
  orgId?: string;
  /** Power Platform environment id (GUID) — verified by the code-app host. */
  environmentId?: string;
  /** Microsoft Entra tenant id (GUID). */
  tenantId?: string;
  /** Allowed hostnames for web deployments (exact match, lower-case). */
  domains?: string[];
}

export interface LicensePayload {
  v: 1;
  /** Unique license id — used for revocation and audit. */
  lid: string;
  customer: { id: string; name: string };
  edition: Edition;
  platform: Platform;
  bind: LicenseBinding;
  /** Issued-at, not-before, expiry — epoch seconds (UTC). */
  iat: number;
  nbf: number;
  exp: number;
  /** Trial length the issuer granted; required when edition === "trial". */
  trialDays?: number;
  /** Read-only continuation after expiry for paid editions (days). */
  graceDays?: number;
  /** Named-user ceiling; 0 or absent = unlimited. */
  seats?: number;
  /** Licensed module keys (see modules.ts); ["*"] grants all. */
  modules: string[];
}

/** What the running environment actually is — compared against LicensePayload.bind. */
export interface RuntimeEnvironment {
  platform: Exclude<Platform, "any">;
  orgId?: string;
  environmentId?: string;
  tenantId?: string;
  hostname?: string;
}

export type LicenseState =
  | "valid"
  | "grace"
  | "expired"
  | "not_yet_valid"
  | "no_license"
  | "malformed"
  | "unknown_key"
  | "invalid_signature"
  | "binding_mismatch"
  | "platform_mismatch"
  | "trial_policy_violation"
  | "revoked"
  | "clock_tamper"
  | "no_trusted_keys";

export type Access = "full" | "read_only" | "none";

export interface LicenseStatus {
  state: LicenseState;
  access: Access;
  reason: string;
  license?: LicensePayload;
  kid?: string;
  /** Days until expiry, rounded up (≤ 0 once expired). */
  daysRemaining?: number;
  expiresAt?: string;
  fingerprint?: string;
}

/** RSA public key in JWK form with a key id. */
export interface TrustedKey {
  kid: string;
  kty: "RSA";
  n: string;
  e: string;
}

/** Anti-rollback clock memory, persisted server-side per installation. */
export interface ClockState {
  lid: string;
  firstSeen: number;
  lastSeen: number;
}

export interface RevocationList {
  v: 1;
  iat: number;
  revoked: string[];
}
