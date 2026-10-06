/**
 * Minimal Claude Messages API client (fetch, no SDK). The key stays on the server; requests time out and retry
 * on rate limits and overload with backoff.
 */
import type { LlmClient, LlmRequest, LlmResponse } from "./runtime.ts";

export interface AnthropicOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class AnthropicClient implements LlmClient {
  constructor(private readonly o: AnthropicOptions) {
    if (!o.apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  async create(req: LlmRequest): Promise<LlmResponse> {
    const f = this.o.fetcher ?? fetch;
    const sleep = this.o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const max = this.o.maxRetries ?? 2;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.o.timeoutMs ?? 120_000);
      let res: Response;
      try {
        res = await f(`${this.o.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": this.o.apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify(req),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < max) {
        const after = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) {
        // The body may echo the request; report status and error type only.
        let type = "error";
        try {
          type = ((await res.json()) as { error?: { type?: string } }).error?.type ?? type;
        } catch {
          // non-JSON error body
        }
        throw new Error(`model API returned ${res.status} (${type})`);
      }
      return (await res.json()) as LlmResponse;
    }
  }
}
