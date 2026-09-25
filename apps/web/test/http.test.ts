import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { acceptsGzip, ApiError, errorResponse, readBody } from "../lib/http";

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    pull(controller) {
      const next = chunks.shift();
      if (next) controller.enqueue(next);
      else controller.close();
    },
  });
}

const put = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("https://aip.example.com/api/aip/state", { method: "PUT", body, headers, duplex: "half" } as RequestInit);

describe("readBody", () => {
  it("reads a body within the limit", async () => {
    expect((await readBody(put("hello"), 10)).toString()).toBe("hello");
  });

  it("rejects an oversized Content-Length up-front", async () => {
    const err = await readBody(put("x", { "content-length": "999999" }), 10).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(413);
  });

  it("rejects an oversized body even without Content-Length", async () => {
    const req = put(streamOf([new Uint8Array(6), new Uint8Array(6)]));
    expect(req.headers.get("content-length")).toBeNull();
    await expect(readBody(req, 10)).rejects.toMatchObject({ status: 413 });
  });

  it("inflates gzip bodies under the same ceiling", async () => {
    const small = gzipSync(Buffer.from('{"a":1}'));
    expect((await readBody(put(small, { "content-encoding": "gzip" }), 100)).toString()).toBe('{"a":1}');
    const bomb = gzipSync(Buffer.alloc(10_000));
    await expect(readBody(put(bomb, { "content-encoding": "gzip" }), 1000)).rejects.toMatchObject({ status: 413 });
  });

  it("rejects unsupported encodings and corrupt gzip", async () => {
    await expect(readBody(put("x", { "content-encoding": "br" }), 100)).rejects.toMatchObject({ status: 415 });
    await expect(readBody(put("not gzip", { "content-encoding": "gzip" }), 100)).rejects.toMatchObject({ status: 400 });
  });
});

describe("acceptsGzip", () => {
  const req = (v?: string) => new Request("https://x.example", v ? { headers: { "accept-encoding": v } } : {});
  it("parses Accept-Encoding", () => {
    expect(acceptsGzip(req("gzip, deflate, br"))).toBe(true);
    expect(acceptsGzip(req("br;q=1, gzip;q=0.5"))).toBe(true);
    expect(acceptsGzip(req("gzip;q=0"))).toBe(false);
    expect(acceptsGzip(req("br"))).toBe(false);
    expect(acceptsGzip(req())).toBe(false);
  });
});

describe("errorResponse", () => {
  it("hides internal error details", async () => {
    const logged: unknown[] = [];
    const res = errorResponse(new Error("password=hunter2 connection string"), (...a) => logged.push(a));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("hunter2");
  });

  it("maps environment errors to 503", async () => {
    const e = new Error("x");
    e.name = "EnvError";
    expect(errorResponse(e, () => undefined).status).toBe(503);
  });
});
