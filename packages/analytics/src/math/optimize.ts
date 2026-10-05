/** Nelder–Mead simplex minimisation: derivative-free, robust for the small likelihoods the engines fit. */
export interface NelderMeadResult {
  x: number[];
  f: number;
  iterations: number;
  converged: boolean;
}

export function nelderMead(f: (x: number[]) => number, x0: number[], opts: { step?: number[]; tol?: number; maxIter?: number } = {}): NelderMeadResult {
  const n = x0.length;
  const tol = opts.tol ?? 1e-9;
  const maxIter = opts.maxIter ?? 2000 * n;
  const step = opts.step ?? x0.map((v) => (v !== 0 ? 0.1 * Math.abs(v) : 0.1));
  const val = (x: number[]) => {
    const v = f(x);
    return Number.isFinite(v) ? v : Infinity;
  };
  let simplex = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + step[i]! : v)))].map((x) => ({ x, f: val(x) }));
  let it = 0;
  for (; it < maxIter; it++) {
    simplex.sort((a, b) => a.f - b.f);
    const best = simplex[0]!;
    const worst = simplex[n]!;
    if (Math.abs(worst.f - best.f) <= tol * (Math.abs(best.f) + tol)) return { x: best.x, f: best.f, iterations: it, converged: true };
    const centroid = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j]! += simplex[i]!.x[j]! / n;
    const at = (t: number) => centroid.map((c, j) => c + t * (worst.x[j]! - c));
    const r = { x: at(-1), f: 0 };
    r.f = val(r.x);
    if (r.f < best.f) {
      const e = { x: at(-2), f: 0 };
      e.f = val(e.x);
      simplex[n] = e.f < r.f ? e : r;
    } else if (r.f < simplex[n - 1]!.f) simplex[n] = r;
    else {
      const c = { x: at(r.f < worst.f ? -0.5 : 0.5), f: 0 };
      c.f = val(c.x);
      if (c.f < Math.min(r.f, worst.f)) simplex[n] = c;
      else simplex = simplex.map((p, i) => (i === 0 ? p : { x: p.x.map((v, j) => best.x[j]! + 0.5 * (v - best.x[j]!)), f: 0 })).map((p, i) => (i === 0 ? p : { ...p, f: val(p.x) }));
    }
  }
  simplex.sort((a, b) => a.f - b.f);
  return { x: simplex[0]!.x, f: simplex[0]!.f, iterations: it, converged: false };
}
