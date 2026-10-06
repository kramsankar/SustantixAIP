import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "./env";
import { ApiError } from "./http";
import { serverLicenseVerdict } from "./server";

/** Scheduled routes answer only the platform scheduler, which sends the deployment's CRON_SECRET. */
export function requireCron(req: Request): void {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) throw new ApiError(503, "cron_not_configured", "CRON_SECRET is not set for this deployment");
  const got = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(secret);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new ApiError(401, "unauthorized", "not the scheduler");
}

/**
 * The scheduler calls the deployment's own platform URL, not the customer's licensed domain, so a scheduled run is
 * licensed against the first domain the deployment's key binds (the key is still verified in full: signature,
 * expiry, revocation). A key bound to no domain is evaluated as is.
 */
export function licensedHost(token: string | undefined): string {
  try {
    const body = token?.trim().split(".")[2];
    if (!body) return "localhost";
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { bind?: { domains?: unknown } };
    const d = Array.isArray(payload.bind?.domains) ? payload.bind!.domains[0] : undefined;
    return typeof d === "string" && /^[a-z0-9.-]{1,253}$/i.test(d) ? d.toLowerCase() : "localhost";
  } catch {
    return "localhost";
  }
}

/** Scheduled work runs only while the deployment's license grants writes. */
export async function requireCronLicense(): Promise<void> {
  const status = await serverLicenseVerdict(licensedHost(serverEnv().AIP_LICENSE_KEY));
  if (status.access !== "full") throw new ApiError(402, "license_required", `scheduled work paused: ${status.reason}`);
}
