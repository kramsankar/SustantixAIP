/** Thin Dataverse Web API client: auth-agnostic, retry-aware, solution-scoped. */

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface WebApiOptions {
  envUrl: string;
  token: () => Promise<string>;
  solution?: string;
  fetcher?: Fetcher;
  log?: (msg: string) => void;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class DataverseError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly method: string,
    readonly path: string,
  ) {
    super(`${method} ${path} → ${status} ${code}: ${message}`);
  }
}

export class WebApi {
  readonly base: string;
  private readonly fetcher: Fetcher;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly o: WebApiOptions) {
    const u = new URL(o.envUrl);
    if (u.protocol !== "https:") throw new Error("environment URL must be https");
    this.base = `${u.origin}/api/data/v9.2/`;
    this.fetcher = o.fetcher ?? ((url, init) => fetch(url, init));
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async request<T = unknown>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}, inSolution = false): Promise<T | undefined> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.o.token()}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      ...extra,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json; charset=utf-8";
    if (inSolution && this.o.solution) headers["MSCRM.SolutionUniqueName"] = this.o.solution;
    const max = this.o.maxRetries ?? 6;
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetcher(this.base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (res.status === 429 || res.status === 503 || (res.status >= 500 && attempt < 2)) {
        if (attempt >= max) throw await this.error(res, method, path);
        const retryAfter = Number(res.headers.get("Retry-After"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 1000 * 2 ** attempt);
        this.o.log?.(`  ↻ ${res.status} on ${method} ${path} — retrying in ${wait} ms`);
        await this.sleep(wait);
        continue;
      }
      if (!res.ok) throw await this.error(res, method, path);
      if (res.status === 204) {
        const id = res.headers.get("OData-EntityId");
        return (id ? { id: /\(([0-9a-f-]{36})\)$/i.exec(id)?.[1] } : undefined) as T | undefined;
      }
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T | undefined;
    }
  }

  private async error(res: Response, method: string, path: string): Promise<DataverseError> {
    let code = "";
    let message = res.statusText;
    try {
      const j = (await res.json()) as { error?: { code?: string; message?: string } };
      code = j.error?.code ?? "";
      message = j.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    return new DataverseError(res.status, code, message, method, path);
  }

  /**
   * Upserts records by alternate key through $batch (independent requests, continue-on-error).
   * Returns per-record failures; the caller decides whether they are fatal.
   */
  async batchUpsert(entitySet: string, keyAttribute: string, records: Array<Record<string, unknown>>): Promise<Array<{ key: string; status: number; message: string }>> {
    const boundary = `batch_${Math.random().toString(36).slice(2)}`;
    const parts = records.map((r) => {
      const key = String(r[keyAttribute]);
      const url = `${this.base}${entitySet}(${keyAttribute}=${encodeURIComponent(odataString(key))})`;
      return [
        `--${boundary}`,
        "Content-Type: application/http",
        "Content-Transfer-Encoding: binary",
        "",
        `PATCH ${url} HTTP/1.1`,
        "Content-Type: application/json; charset=utf-8",
        "",
        JSON.stringify(r),
      ].join("\r\n");
    });
    const body = parts.join("\r\n") + `\r\n--${boundary}--\r\n`;
    const max = this.o.maxRetries ?? 6;
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetcher(this.base + "$batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await this.o.token()}`,
          Accept: "application/json",
          "OData-MaxVersion": "4.0",
          "OData-Version": "4.0",
          "Content-Type": `multipart/mixed; boundary=${boundary}`,
          Prefer: "odata.continue-on-error",
        },
        body,
      });
      if ((res.status === 429 || res.status === 503) && attempt < max) {
        const retryAfter = Number(res.headers.get("Retry-After"));
        await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(30000, 1000 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw await this.error(res, "POST", "$batch");
      const text = await res.text();
      const statuses = [...text.matchAll(/HTTP\/1\.1 (\d{3})[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([^\r\n]*)/g)];
      const failures: Array<{ key: string; status: number; message: string }> = [];
      statuses.forEach((m, i) => {
        const status = Number(m[1]);
        if (status >= 400) {
          let message = m[2] ?? "";
          try {
            message = (JSON.parse(message) as { error?: { message?: string } }).error?.message ?? message;
          } catch {
            /* keep raw */
          }
          failures.push({ key: String(records[i]?.[keyAttribute]), status, message });
        }
      });
      return failures;
    }
  }

  get<T>(path: string) {
    return this.request<T>("GET", path);
  }

  /** GET that maps 404 to undefined. */
  async find<T>(path: string): Promise<T | undefined> {
    try {
      return await this.get<T>(path);
    } catch (e) {
      if (e instanceof DataverseError && e.status === 404) return undefined;
      throw e;
    }
  }

  async first<T>(entitySet: string, filter: string, select: string[]): Promise<T | undefined> {
    const r = await this.get<{ value: T[] }>(`${entitySet}?$select=${select.join(",")}&$filter=${encodeURIComponent(filter)}&$top=1`);
    return r?.value[0];
  }

  /** Create inside the configured solution; returns the new record id when Dataverse reports it. */
  async create(path: string, body: unknown): Promise<string | undefined> {
    const r = await this.request<{ id?: string }>("POST", path, body, {}, true);
    return r?.id;
  }

  update(path: string, body: unknown) {
    return this.request("PATCH", path, body, { "If-Match": "*" }, true);
  }

  action<T>(name: string, body: unknown) {
    return this.request<T>("POST", name, body, {}, true);
  }
}

export const odataString = (s: string) => `'${s.replace(/'/g, "''")}'`;
