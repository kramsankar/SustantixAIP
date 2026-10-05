/**
 * Isolation Forest (Liu, Ting & Zhou, 2008): anomalies are isolated by fewer random splits than normal points.
 * Score s(x) = 2^(−E[h(x)] / c(n)); s → 1 is anomalous, s ≤ 0.5 is normal.
 */
import { Rng } from "../math/rng.ts";

interface INode {
  size: number;
  feature?: number;
  split?: number;
  left?: INode;
  right?: INode;
}

export interface IsolationForest {
  trees: INode[];
  sampleSize: number;
  features: string[];
}

const EULER = 0.5772156649;
/** Average path length of an unsuccessful binary-search-tree lookup among n points. */
export const cFactor = (n: number) => (n > 2 ? 2 * (Math.log(n - 1) + EULER) - (2 * (n - 1)) / n : n === 2 ? 1 : 0);

function grow(x: number[][], idx: number[], depth: number, limit: number, rng: Rng): INode {
  if (depth >= limit || idx.length <= 1) return { size: idx.length };
  const k = x[0]!.length;
  // Pick a feature that still varies among these points.
  for (let attempt = 0; attempt < k * 2; attempt++) {
    const f = rng.int(k);
    let lo = Infinity;
    let hi = -Infinity;
    for (const i of idx) {
      const v = x[i]![f]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (hi <= lo) continue;
    const split = lo + rng.next() * (hi - lo);
    const left = idx.filter((i) => x[i]![f]! < split);
    const right = idx.filter((i) => x[i]![f]! >= split);
    return { size: idx.length, feature: f, split, left: grow(x, left, depth + 1, limit, rng), right: grow(x, right, depth + 1, limit, rng) };
  }
  return { size: idx.length };
}

export function fitIsolationForest(x: number[][], features: string[], opts: { trees?: number; sampleSize?: number; seed?: number } = {}): IsolationForest {
  if (!x.length) throw new Error("isolation forest: no data");
  const rng = new Rng(opts.seed ?? 101);
  const psi = Math.min(opts.sampleSize ?? 256, x.length);
  const limit = Math.ceil(Math.log2(psi));
  const trees: INode[] = [];
  for (let t = 0; t < (opts.trees ?? 200); t++) {
    const idx = Array.from({ length: psi }, () => rng.int(x.length));
    trees.push(grow(x, idx, 0, limit, rng));
  }
  return { trees, sampleSize: psi, features };
}

function pathLength(n: INode, p: number[], depth: number): number {
  if (n.feature === undefined) return depth + cFactor(n.size);
  return pathLength(p[n.feature]! < n.split! ? n.left! : n.right!, p, depth + 1);
}

export function isolationScore(m: IsolationForest, p: number[]): number {
  const e = m.trees.reduce((a, t) => a + pathLength(t, p, 0), 0) / m.trees.length;
  return 2 ** (-e / cFactor(m.sampleSize));
}
