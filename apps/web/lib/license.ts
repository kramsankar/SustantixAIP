import {
  b64urlDecode,
  verifyLicense,
  verifyRevocationList,
  type ClockState,
  type LicenseStatus,
  type TrustedKey,
} from "@sustantix/license";

/** Server-side SXL1 verdict for the Vercel host. */

export const VERDICT_TTL_SEC = 300;
export const CLOCK_WRITE_INTERVAL_SEC = 3600;

export interface ClockRecord extends ClockState {
  verdict: string;
}

/** Anti-rollback memory, persisted in aip.license_clock (service role only). */
export interface ClockStore {
  read(lid: string): Promise<ClockRecord | null>;
  write(record: ClockRecord): Promise<void>;
}

export interface LicenseDeps {
  token: string | undefined;
  revocationToken: string | undefined;
  trustedKeys: readonly TrustedKey[];
  clockStore: ClockStore;
  /** Server clock, epoch seconds. */
  now: () => number;
  warn?: (message: string) => void;
}

/**
 * License id from an (unverified) token, used only to look up clock memory before
 * verification. The verifier ignores clock memory whose lid differs from the
 * signed payload, so a forged lid cannot influence the verdict.
 */
export function peekLicenseId(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.trim().split(".");
  if (parts.length !== 4) return null;
  try {
    const body = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[2]!))) as { lid?: unknown };
    return typeof body.lid === "string" && body.lid.length > 0 && body.lid.length <= 256 ? body.lid : null;
  } catch {
    return null;
  }
}

/** Mirrors the Dataverse plug-in: create once, then write at most hourly unless the verdict changed. */
export function shouldPersistClock(previous: ClockRecord | null, next: ClockRecord): boolean {
  if (!previous) return true;
  if (previous.lid !== next.lid || previous.verdict !== next.verdict) return true;
  if (previous.firstSeen !== next.firstSeen) return true;
  return next.lastSeen - previous.lastSeen >= CLOCK_WRITE_INTERVAL_SEC;
}

export async function computeVerdict(hostname: string, deps: LicenseDeps): Promise<LicenseStatus> {
  const trustedKeys = [...deps.trustedKeys];
  const now = deps.now();
  const lid = peekLicenseId(deps.token);

  let previous: ClockRecord | null = null;
  if (lid) {
    try {
      previous = await deps.clockStore.read(lid);
    } catch (err) {
      // The server clock is authoritative on this host, so a missing clock memory only
      // weakens the rollback check; it does not let a client move time. Continue.
      deps.warn?.(`license clock read failed: ${(err as Error).message}`);
    }
  }

  const revocation = await verifyRevocationList(deps.revocationToken, trustedKeys);
  const { status, nextClock } = await verifyLicense(deps.token, {
    trustedKeys,
    environment: { platform: "vercel", hostname },
    now,
    clock: previous,
    revocation,
  });

  if (nextClock) {
    const next: ClockRecord = { ...nextClock, verdict: status.state };
    if (shouldPersistClock(previous, next)) {
      try {
        await deps.clockStore.write(next);
      } catch (err) {
        deps.warn?.(`license clock write failed: ${(err as Error).message}`);
      }
    }
  }
  return status;
}

interface CacheEntry {
  expires: number;
  computedAt: number;
  status: LicenseStatus;
}

/** Per-hostname verdict cache (verdicts depend on the domain binding). */
export class VerdictCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<LicenseStatus>>();

  /**
   * @param minRefreshSec an unauthenticated `?refresh=1` cannot force recomputation more
   *   often than this, so the endpoint cannot be used to hammer the database.
   */
  constructor(
    private readonly ttlSec = VERDICT_TTL_SEC,
    private readonly minRefreshSec = 10,
  ) {}

  async get(hostname: string, now: number, refresh: boolean, compute: () => Promise<LicenseStatus>): Promise<LicenseStatus> {
    const hit = this.entries.get(hostname);
    const pending = this.inflight.get(hostname);
    if (pending) return pending;
    if (hit && hit.expires > now && (!refresh || now - hit.computedAt < this.minRefreshSec)) return hit.status;
    const p = compute()
      .then((status) => {
        if (this.entries.size > 256) this.entries.clear();
        this.entries.set(hostname, { expires: now + this.ttlSec, computedAt: now, status });
        return status;
      })
      .finally(() => this.inflight.delete(hostname));
    this.inflight.set(hostname, p);
    return p;
  }

  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }
}

// Shared through globalThis so that middleware and route handlers running in the same
// Node.js process see one cache (and a ?refresh=1 is visible to both).
const CACHE_KEY = Symbol.for("sustantix.aip.verdictCache");
type GlobalWithCache = typeof globalThis & { [CACHE_KEY]?: VerdictCache };

export function verdictCache(): VerdictCache {
  const g = globalThis as GlobalWithCache;
  return (g[CACHE_KEY] ??= new VerdictCache());
}

export const epochSeconds = (): number => Math.floor(Date.now() / 1000);
