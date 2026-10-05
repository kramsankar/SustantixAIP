/**
 * Exact decimal arithmetic for grid totals and sorting. Money and decimals arrive as strings and are summed as scaled
 * integers, so a total never picks up floating-point error.
 */

const SCALE = 6;
const FACTOR = 10n ** BigInt(SCALE);
const PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;

/** Parses a decimal string (or a safe integer) into a scaled BigInt; null when it is not a number. */
export function toScaled(v: unknown): bigint | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    if (Number.isInteger(v)) return BigInt(v) * FACTOR;
    v = String(v);
  }
  if (typeof v !== "string") return null;
  const m = PATTERN.exec(v.trim().replace(/,/g, ""));
  if (!m) return null;
  const frac = (m[3] ?? "").slice(0, SCALE).padEnd(SCALE, "0");
  const n = BigInt(m[2]!) * FACTOR + BigInt(frac);
  return m[1] ? -n : n;
}

export function fromScaled(n: bigint, places?: number): string {
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / FACTOR;
  let frac = (abs % FACTOR).toString().padStart(SCALE, "0");
  frac = places === undefined ? frac.replace(/0+$/, "") : frac.slice(0, places).padEnd(places, "0");
  return `${neg && (whole !== 0n || /[1-9]/.test(frac)) ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** Exact sum of decimal strings; values that are not numbers are skipped. */
export function sumDecimals(values: unknown[]): { sum: string; count: number } {
  let total = 0n;
  let count = 0;
  for (const v of values) {
    const n = toScaled(v);
    if (n === null) continue;
    total += n;
    count++;
  }
  return { sum: fromScaled(total), count };
}

export function compareDecimals(a: unknown, b: unknown): number {
  const x = toScaled(a);
  const y = toScaled(b);
  if (x === null || y === null) return x === null ? (y === null ? 0 : -1) : 1;
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Money totals grouped by currency: amounts in different currencies are never added together. Rows without a
 * currency fall back to the given default.
 */
export function moneyTotals(rows: Array<Record<string, unknown>>, field: string, currencyField: string | null, fallback: string): Array<{ currency: string; sum: string }> {
  const by = new Map<string, unknown[]>();
  for (const r of rows) {
    const cur = String((currencyField ? r[currencyField] : null) ?? fallback);
    let list = by.get(cur);
    if (!list) by.set(cur, (list = []));
    list.push(r[field]);
  }
  return [...by.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([currency, vals]) => ({ currency, sum: sumDecimals(vals).sum }));
}
