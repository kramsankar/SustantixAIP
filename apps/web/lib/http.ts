import { gunzip, InflateLimitError } from "./state/codec";

/** Small HTTP helpers shared by the API route handlers. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const NO_STORE = { "cache-control": "no-store, max-age=0" } as const;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...NO_STORE, ...headers },
  });
}

export function noContent(headers: Record<string, string> = {}): Response {
  return new Response(null, { status: 204, headers: { ...NO_STORE, ...headers } });
}

export function errorResponse(err: unknown, log: (msg: string, detail?: unknown) => void = defaultLog): Response {
  if (err instanceof ApiError) return json({ error: err.code, message: err.message, ...err.extra }, err.status, err.headers);
  if (err instanceof Error && err.name === "EnvError") {
    log("server misconfigured", err.message);
    return json({ error: "server_misconfigured", message: "server is not configured" }, 503);
  }
  log("unhandled API error", err instanceof Error ? { name: err.name, message: err.message } : String(err));
  return json({ error: "internal_error", message: "unexpected server error" }, 500);
}

function defaultLog(msg: string, detail?: unknown): void {
  console.error(`[aip-web] ${msg}`, detail ?? "");
}

/**
 * Reads a request body with a hard byte ceiling: rejected up-front on Content-Length and
 * again while streaming, so a missing or lying header cannot bypass the limit.
 * `Content-Encoding: gzip` bodies are accepted and inflated under the same ceiling.
 */
export async function readBody(req: Request, limit: number): Promise<Buffer> {
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (!Number.isFinite(n) || n < 0) throw new ApiError(400, "bad_request", "invalid content-length");
    if (n > limit) throw tooLarge(limit);
  }
  const encoding = (req.headers.get("content-encoding") ?? "identity").trim().toLowerCase();
  if (encoding !== "identity" && encoding !== "gzip") throw new ApiError(415, "unsupported_encoding", `content-encoding ${encoding} is not supported`);

  const chunks: Buffer[] = [];
  let total = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw tooLarge(limit);
      }
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    }
  }
  const raw = Buffer.concat(chunks, total);
  if (encoding === "identity") return raw;
  try {
    return await gunzip(raw, limit);
  } catch (err) {
    if (err instanceof InflateLimitError) throw tooLarge(limit);
    throw new ApiError(400, "bad_request", "request body is not valid gzip");
  }
}

function tooLarge(limit: number): ApiError {
  return new ApiError(413, "payload_too_large", `request body exceeds ${limit} bytes`, { limit });
}

export function parseJson(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new ApiError(400, "invalid_json", "request body is not valid JSON");
  }
}

export function acceptsGzip(req: Request): boolean {
  const header = req.headers.get("accept-encoding") ?? "";
  return header.split(",").some((part) => {
    const [token, ...params] = part.trim().toLowerCase().split(";");
    if (token !== "gzip") return false;
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    return !q || Number(q.slice(2)) > 0;
  });
}
