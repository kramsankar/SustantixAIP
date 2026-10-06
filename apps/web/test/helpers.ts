import type { TrustedKey } from "@sustantix/license";
import { generateSigningKey, issueLicense, issueRevocationList, type IssueRequest, type SigningKey } from "@sustantix/license/issuer";
import type { ClockRecord, ClockStore } from "../lib/license";

export const DAY = 86400;
export const T0 = 1_790_000_000; // fixed server clock for deterministic tests

let keyPair: { signing: SigningKey; publicJwk: TrustedKey } | undefined;

/** Ephemeral 4096-bit issuer key generated once per test file; never persisted. */
export function testKey(): { signing: SigningKey; publicJwk: TrustedKey } {
  keyPair ??= generateSigningKey("test-ephemeral");
  return keyPair;
}

export function issue(overrides: Partial<IssueRequest> = {}, now = T0): string {
  const req: IssueRequest = {
    customer: { id: "cust-001", name: "Test Customer" },
    edition: "standard",
    platform: "vercel",
    bind: { domains: ["aip.example.com"] },
    validDays: 365,
    ...overrides,
  };
  return issueLicense(testKey().signing, req, now).token;
}

export function revocationFor(lids: string[], now = T0): string {
  return issueRevocationList(testKey().signing, lids, now);
}

export class MemoryClockStore implements ClockStore {
  readonly rows = new Map<string, ClockRecord>();
  writes: ClockRecord[] = [];
  reads = 0;
  failReads = false;

  async read(lid: string): Promise<ClockRecord | null> {
    this.reads++;
    if (this.failReads) throw new Error("db unavailable");
    const r = this.rows.get(lid);
    return r ? { ...r } : null;
  }

  async write(record: ClockRecord): Promise<void> {
    this.writes.push({ ...record });
    this.rows.set(record.lid, { ...record });
  }
}

export function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}
