/**
 * Same-origin enforcement for state-changing requests. Session cookies are SameSite=Lax,
 * which already blocks most cross-site POSTs; this check closes the remaining gaps
 * (same-site sibling subdomains, older browsers) by requiring the Origin to be this host.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

interface HeaderSource {
  get(name: string): string | null;
}

export function isStateChanging(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

export function isSameOrigin(method: string, headers: HeaderSource, host: string | null): boolean {
  if (!isStateChanging(method)) return true;
  if (!host) return false;
  const origin = headers.get("origin");
  if (origin && origin !== "null") {
    try {
      const u = new URL(origin);
      if (u.protocol !== "https:" && u.protocol !== "http:") return false;
      return u.host.toLowerCase() === host.toLowerCase();
    } catch {
      return false;
    }
  }
  if (origin === "null") return false;
  // Browsers send Origin on every non-GET fetch; fall back to Fetch Metadata if a proxy stripped it.
  return headers.get("sec-fetch-site") === "same-origin";
}
