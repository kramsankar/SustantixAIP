import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fromByteaHex, gunzip, gzip, InflateLimitError, sha256Hex, toByteaHex } from "../lib/state/codec";

describe("bytea hex codec", () => {
  it("round-trips arbitrary bytes", () => {
    for (const size of [0, 1, 255, 4096, 100_000]) {
      const bytes = randomBytes(size);
      const hex = toByteaHex(bytes);
      expect(hex.startsWith("\\x")).toBe(true);
      expect(hex).toHaveLength(2 + size * 2);
      expect(fromByteaHex(hex).equals(bytes)).toBe(true);
    }
  });

  it("encodes a sub-view without leaking the parent buffer", () => {
    const parent = Buffer.from([1, 2, 3, 4, 5]);
    expect(toByteaHex(parent.subarray(1, 3))).toBe("\\x0203");
  });

  it("accepts upper-case hex from the database", () => {
    expect([...fromByteaHex("\\xDEADbeef")]).toEqual([0xde, 0xad, 0xbe, 0xef]);
  });

  it("rejects non-hex and odd-length input", () => {
    expect(() => fromByteaHex("deadbeef")).toThrow();
    expect(() => fromByteaHex("\\xabc")).toThrow();
    expect(() => fromByteaHex("\\xzz")).toThrow();
  });
});

describe("gzip", () => {
  it("round-trips JSON", async () => {
    const json = Buffer.from(JSON.stringify({ data: { Assets: Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `A-${i}` })) } }));
    const gz = await gzip(json);
    expect(gz.byteLength).toBeLessThan(json.byteLength);
    expect(gz[0]).toBe(0x1f);
    expect(gz[1]).toBe(0x8b);
    expect((await gunzip(gz, json.byteLength)).equals(json)).toBe(true);
  });

  it("refuses output beyond the ceiling (gzip bomb)", async () => {
    const gz = await gzip(Buffer.alloc(5_000_000));
    await expect(gunzip(gz, 1_000_000)).rejects.toBeInstanceOf(InflateLimitError);
  });

  it("rejects corrupt streams", async () => {
    const gz = await gzip(Buffer.from("hello world, hello world"));
    await expect(gunzip(gz.subarray(0, gz.length - 6), 1000)).rejects.toThrow();
  });

  it("hashes with SHA-256", () => {
    expect(sha256Hex(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
