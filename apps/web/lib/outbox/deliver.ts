import { createHmac } from "node:crypto";
import { isIP } from "node:net";

/**
 * The outbox worker. Each due event is claimed under a lease, sent to its destination as signed JSON, and its outcome
 * recorded (delivered, or failed with back-off, or set aside after the last attempt). Receivers verify
 *   X-Sustantix-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>" with the destination secret>
 * and de-duplicate on Idempotency-Key (the event id), so a retried delivery is never applied twice.
 */

export interface OutboxEvent {
  id: number;
  event_id: string;
  destination_id: string;
  kind: string;
  event: string;
  entity: string;
  code: string;
  payload: unknown;
  attempts: number;
  created_at: string;
}

export interface Destination {
  url: string;
  secret: string;
  enabled: boolean;
}

export interface OutboxDeps {
  claim(limit: number): Promise<OutboxEvent[]>;
  complete(id: number, ok: boolean, error: string | null): Promise<void>;
  destination(id: string): Promise<Destination | null>;
  /** Addresses a hostname resolves to (DNS); refused when any is private. */
  resolve(host: string): Promise<string[]>;
  fetch: typeof fetch;
  now: () => number;
}

export function sign(secret: string, body: string, unixSeconds: number): string {
  return `t=${unixSeconds},v1=${createHmac("sha256", secret).update(`${unixSeconds}.${body}`).digest("hex")}`;
}

/** Addresses no outbound delivery may reach: loopback, private, link-local (cloud metadata), CGNAT, unspecified. */
export function privateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return privateAddress(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

/** A destination URL the worker may call: https, a public host name, no credentials or odd ports. */
export function allowedUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return null;
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIP(bare) && privateAddress(bare)) return null;
  return u;
}

export async function deliverDue(deps: OutboxDeps, limit = 50): Promise<{ delivered: number; failed: number }> {
  const events = await deps.claim(limit);
  let delivered = 0;
  let failed = 0;
  const cache = new Map<string, Destination | null>();
  for (const e of events) {
    let error: string | null = null;
    try {
      if (!cache.has(e.destination_id)) cache.set(e.destination_id, await deps.destination(e.destination_id));
      const d = cache.get(e.destination_id);
      if (!d || !d.enabled) throw new Error("destination disabled or removed");
      const url = allowedUrl(d.url);
      if (!url) throw new Error("destination URL is not an allowed https address");
      const addresses = await deps.resolve(url.hostname.replace(/^\[|\]$/g, ""));
      if (!addresses.length || addresses.some(privateAddress)) throw new Error("destination resolves to a private address");
      const body = JSON.stringify({ id: e.event_id, event: e.event, kind: e.kind, entity: e.entity, code: e.code, occurredAt: e.created_at, attempt: e.attempts, data: e.payload });
      const ts = Math.floor(deps.now() / 1000);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const res = await deps.fetch(url, {
          method: "POST",
          body,
          redirect: "manual",
          signal: ctrl.signal,
          headers: {
            "content-type": "application/json",
            "user-agent": "Sustantix-AIP-Outbox/1",
            "idempotency-key": e.event_id,
            "x-sustantix-event": e.event,
            "x-sustantix-event-id": e.event_id,
            "x-sustantix-signature": sign(d.secret, body, ts),
          },
        });
        if (res.status < 200 || res.status >= 300) error = `HTTP ${res.status}`;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      error = err instanceof Error ? (err.name === "AbortError" ? "timed out after 10 s" : err.message) : "delivery failed";
    }
    await deps.complete(e.id, error === null, error);
    if (error === null) delivered++;
    else failed++;
  }
  return { delivered, failed };
}
