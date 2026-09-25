/**
 * Rate limiting behind a store-agnostic interface. The in-memory token bucket is per
 * process (per serverless instance on Vercel); swap in a durable implementation
 * (e.g. Redis / Upstash, or a Postgres function) by implementing RateLimiter.
 */

export interface RateDecision {
  allowed: boolean;
  /** Seconds until at least one token is available (0 when allowed). */
  retryAfter: number;
  remaining: number;
}

export interface RateLimiter {
  take(key: string, nowMs?: number): Promise<RateDecision>;
}

export interface BucketOptions {
  /** Maximum burst. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
  /** Upper bound on tracked keys before idle buckets are evicted. */
  maxKeys?: number;
}

interface Bucket {
  tokens: number;
  updated: number;
}

export class MemoryTokenBucket implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly opts: BucketOptions) {
    if (opts.capacity < 1 || opts.refillPerSec <= 0) throw new Error("invalid rate limit options");
  }

  async take(key: string, nowMs = Date.now()): Promise<RateDecision> {
    const { capacity, refillPerSec } = this.opts;
    let b = this.buckets.get(key);
    if (!b) {
      this.evictIfFull(nowMs);
      b = { tokens: capacity, updated: nowMs };
      this.buckets.set(key, b);
    } else {
      const elapsed = Math.max(0, nowMs - b.updated) / 1000;
      b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
      b.updated = nowMs;
    }
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return { allowed: true, retryAfter: 0, remaining: Math.floor(b.tokens) };
    }
    return { allowed: false, retryAfter: Math.ceil((1 - b.tokens) / refillPerSec), remaining: 0 };
  }

  get size(): number {
    return this.buckets.size;
  }

  private evictIfFull(nowMs: number): void {
    const max = this.opts.maxKeys ?? 50_000;
    if (this.buckets.size < max) return;
    const fullAfterMs = (this.opts.capacity / this.opts.refillPerSec) * 1000;
    for (const [k, v] of this.buckets) if (nowMs - v.updated >= fullAfterMs) this.buckets.delete(k);
    // Still full: drop the oldest entries (Map iterates in insertion order).
    for (const k of this.buckets.keys()) {
      if (this.buckets.size < max) break;
      this.buckets.delete(k);
    }
  }
}

/** Takes one token from every key; denies if any is exhausted. */
export async function takeAll(limiter: RateLimiter, keys: string[], nowMs?: number): Promise<RateDecision> {
  let worst: RateDecision = { allowed: true, retryAfter: 0, remaining: Number.MAX_SAFE_INTEGER };
  for (const key of keys) {
    const d = await limiter.take(key, nowMs);
    if (!d.allowed) return d;
    if (d.remaining < worst.remaining) worst = d;
  }
  return worst;
}

const LIMITER_KEY = Symbol.for("sustantix.aip.signInLimiter");
type GlobalWithLimiter = typeof globalThis & { [LIMITER_KEY]?: RateLimiter };

/** 5 attempts per minute per key (IP and e-mail are tracked independently). */
export function signInLimiter(): RateLimiter {
  const g = globalThis as GlobalWithLimiter;
  return (g[LIMITER_KEY] ??= new MemoryTokenBucket({ capacity: 5, refillPerSec: 5 / 60 }));
}
