import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { gunzip as gunzipCb, gzip as gzipCb } from "node:zlib";

const gzipAsync = promisify(gzipCb);
const gunzipAsync = promisify(gunzipCb);

/** Postgres bytea as PostgREST exchanges it: `\x` followed by lower-case hex. */
export function toByteaHex(bytes: Uint8Array): string {
  return "\\x" + Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("hex");
}

const HEX_BODY = /^[0-9a-fA-F]*$/;

export function fromByteaHex(text: string): Buffer {
  if (typeof text !== "string" || !text.startsWith("\\x")) throw new Error("bytea value is not in hex format");
  const body = text.slice(2);
  if (body.length % 2 !== 0 || !HEX_BODY.test(body)) throw new Error("bytea hex is malformed");
  return Buffer.from(body, "hex");
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function gzip(bytes: Uint8Array): Promise<Buffer> {
  return gzipAsync(bytes, { level: 6 });
}

export class InflateLimitError extends Error {
  constructor(readonly limit: number) {
    super(`decompressed payload exceeds ${limit} bytes`);
    this.name = "InflateLimitError";
  }
}

/** Gunzip with a hard output ceiling so a small bomb cannot exhaust memory. */
export async function gunzip(bytes: Uint8Array, maxOutputBytes: number): Promise<Buffer> {
  try {
    return await gunzipAsync(bytes, { maxOutputLength: maxOutputBytes });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE" || err instanceof RangeError) throw new InflateLimitError(maxOutputBytes);
    throw err;
  }
}
