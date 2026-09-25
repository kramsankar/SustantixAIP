import type { Access, LicenseStatus } from "@sustantix/license";
import { isSameOrigin } from "./csrf";
import { hostnameOf } from "./host";
import { json } from "./http";

/** License and origin gate applied to every /api request (middleware + route handlers). */

export const API_PREFIX = "/api/aip/";

/**
 * - open:     reachable without a license (the runtime needs these to render its gate).
 * - readable: needs access `full` or `read_only`.
 * - writable: needs access `full` (grace periods are read-only).
 */
export type Requirement = "open" | "readable" | "writable";

const OPEN_ENDPOINTS = new Set(["license", "time", "session", "sign-out"]);

export function requirementFor(pathname: string, method: string): Requirement {
  if (!pathname.startsWith(API_PREFIX)) return "open";
  const endpoint = pathname.slice(API_PREFIX.length).replace(/\/+$/, "");
  if (OPEN_ENDPOINTS.has(endpoint)) return "open";
  const m = method.toUpperCase();
  if (endpoint === "state" && (m === "PUT" || m === "DELETE" || m === "POST" || m === "PATCH")) return "writable";
  return "readable";
}

export function permits(requirement: Requirement, access: Access): boolean {
  if (requirement === "open") return true;
  if (requirement === "readable") return access === "full" || access === "read_only";
  return access === "full";
}

export interface GuardInput {
  pathname: string;
  method: string;
  headers: { get(name: string): string | null };
  /** Resolved request host (with port), or null when the Host header is unusable. */
  host: string | null;
}

export interface GuardDeps {
  verdict(hostname: string): Promise<LicenseStatus>;
}

/** Returns a rejection Response, or null when the request may proceed. */
export async function guardRequest(input: GuardInput, deps: GuardDeps): Promise<Response | null> {
  if (!input.host) return json({ error: "bad_host", message: "request host is missing or invalid" }, 400);
  if (!isSameOrigin(input.method, input.headers, input.host)) {
    return json({ error: "cross_origin", message: "cross-origin state-changing request refused" }, 403);
  }
  const requirement = requirementFor(input.pathname, input.method);
  if (requirement === "open") return null;
  let status: LicenseStatus;
  try {
    status = await deps.verdict(hostnameOf(input.host));
  } catch {
    return json({ error: "license_unavailable", message: "license verdict could not be computed" }, 503);
  }
  if (permits(requirement, status.access)) return null;
  return json(
    {
      error: "license_required",
      state: status.state,
      access: status.access,
      reason: requirement === "writable" && status.access === "read_only" ? "license is read-only (grace period)" : status.reason,
    },
    402,
  );
}
