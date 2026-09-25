/** Request host handling shared by licensing (domain binding) and CSRF checks. */

const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::\d{1,5})?$/;
const IPV6_HOST_RE = /^\[[0-9a-f:.]+\](?::\d{1,5})?$/;

interface HeaderSource {
  get(name: string): string | null;
}

function normalise(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(",")[0]!.trim().toLowerCase().replace(/\.$/, "").replace(/\.(?=:\d+$)/, "");
  if (!first || first.length > 260) return null;
  return HOST_RE.test(first) || IPV6_HOST_RE.test(first) ? first : null;
}

/**
 * Host (with port, lower-cased) the client addressed. `x-forwarded-host` is honoured only
 * when `trustForwarded` is set (i.e. on Vercel, whose edge overwrites it); elsewhere a
 * client could forge it to satisfy a domain-bound license.
 */
export function requestHost(headers: HeaderSource, trustForwarded: boolean): string | null {
  if (trustForwarded) {
    const fwd = normalise(headers.get("x-forwarded-host"));
    if (fwd) return fwd;
  }
  return normalise(headers.get("host"));
}

/** Hostname without port — the value compared against a license's domain binding. */
export function hostnameOf(host: string): string {
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  const i = host.lastIndexOf(":");
  return i >= 0 ? host.slice(0, i) : host;
}

/** Best-effort client address for rate limiting. */
export function clientIp(headers: HeaderSource, trustForwarded: boolean): string {
  if (!trustForwarded) return "direct";
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd ? fwd.slice(0, 64) : "unknown";
}
