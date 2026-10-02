import { verifyLicense, type ClockState, type LicenseStatus, type TrustedKey } from "@sustantix/license";
import type { HostAdapter } from "./types.js";

const CLOCK_KEY = "sx_aip_clock";

function readClock(): ClockState | null {
  try {
    const raw = localStorage.getItem(CLOCK_KEY);
    return raw ? (JSON.parse(raw) as ClockState) : null;
  } catch {
    return null;
  }
}

function writeClock(c: ClockState | undefined) {
  if (!c) return;
  try {
    localStorage.setItem(CLOCK_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable — server-side memory remains authoritative */
  }
}

/**
 * Resolve the license verdict for this session. The server verdict is preferred;
 * the client verifier is a fallback that fails closed.
 */
export async function resolveLicense(adapter: HostAdapter, keys: TrustedKey[], refresh = false): Promise<LicenseStatus> {
  if (adapter.serverVerdict) {
    try {
      const v = await adapter.serverVerdict(refresh);
      if (v) return v;
    } catch (e) {
      return { state: "no_license", access: "none", reason: "license service unreachable: " + (e instanceof Error ? e.message : String(e)) };
    }
  }
  const token = adapter.licenseToken ? await adapter.licenseToken() : null;
  const { status, nextClock } = await verifyLicense(token, {
    trustedKeys: keys,
    environment: await adapter.environment(),
    now: await adapter.trustedNow(),
    clock: readClock(),
  });
  writeClock(nextClock);
  return status;
}
