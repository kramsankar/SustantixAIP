import { describe, expect, it } from "vitest";
import { MemoryTokenBucket, takeAll } from "../lib/rate-limit";

describe("MemoryTokenBucket", () => {
  const perMinute = () => new MemoryTokenBucket({ capacity: 5, refillPerSec: 5 / 60 });

  it("allows a burst of five then refuses", async () => {
    const rl = perMinute();
    for (let i = 0; i < 5; i++) expect((await rl.take("ip:1", 0)).allowed).toBe(true);
    const denied = await rl.take("ip:1", 0);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfter).toBe(12);
  });

  it("refills over time", async () => {
    const rl = perMinute();
    for (let i = 0; i < 5; i++) await rl.take("k", 0);
    expect((await rl.take("k", 11_000)).allowed).toBe(false);
    expect((await rl.take("k", 12_500)).allowed).toBe(true);
    expect((await rl.take("k", 12_600)).allowed).toBe(false);
    for (let i = 0; i < 5; i++) expect((await rl.take("k", 200_000)).allowed).toBe(true);
    expect((await rl.take("k", 200_000)).allowed).toBe(false);
  });

  it("isolates keys", async () => {
    const rl = perMinute();
    for (let i = 0; i < 5; i++) await rl.take("a", 0);
    expect((await rl.take("a", 0)).allowed).toBe(false);
    expect((await rl.take("b", 0)).allowed).toBe(true);
  });

  it("bounds memory by evicting buckets", async () => {
    const rl = new MemoryTokenBucket({ capacity: 5, refillPerSec: 1, maxKeys: 100 });
    for (let i = 0; i < 1000; i++) await rl.take(`k${i}`, i);
    expect(rl.size).toBeLessThanOrEqual(100);
  });

  it("takeAll denies when any key is exhausted (per IP and per e-mail)", async () => {
    const rl = perMinute();
    for (let i = 0; i < 5; i++) expect((await takeAll(rl, [`ip:${i}`, "email:a@x.io"], 0)).allowed).toBe(true);
    // New IP, same e-mail: still limited.
    expect((await takeAll(rl, ["ip:99", "email:a@x.io"], 0)).allowed).toBe(false);
  });

  it("rejects invalid configuration", () => {
    expect(() => new MemoryTokenBucket({ capacity: 0, refillPerSec: 1 })).toThrow();
  });
});
