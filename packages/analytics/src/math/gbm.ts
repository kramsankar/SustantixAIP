/**
 * Gradient-boosted regression trees (squared or pinball loss), written for the forecast residual model:
 * shallow CART trees on numeric features, shrinkage and row subsampling with a seeded generator.
 */
import { Rng } from "./rng.ts";
import { mean, quantile } from "./stats.ts";

interface Leaf {
  value: number;
}
interface Split {
  feature: number;
  threshold: number;
  left: Node;
  right: Node;
}
type Node = Leaf | Split;
const isLeaf = (n: Node): n is Leaf => (n as Split).feature === undefined;

export interface GbmOptions {
  trees: number;
  depth: number;
  learningRate: number;
  minLeaf: number;
  subsample: number;
  /** Candidate split points per feature (quantiles of the training values). */
  bins: number;
  /** "squared" fits the conditional mean; a number in (0,1) fits that conditional quantile (pinball loss). */
  loss: "squared" | number;
  seed: number;
}

export const GBM_DEFAULTS: GbmOptions = { trees: 120, depth: 3, learningRate: 0.08, minLeaf: 40, subsample: 0.7, bins: 24, loss: "squared", seed: 7 };

export interface GbmModel {
  base: number;
  learningRate: number;
  trees: Node[];
  features: string[];
  loss: GbmOptions["loss"];
}

function predictTree(n: Node, x: number[]): number {
  while (!isLeaf(n)) n = x[n.feature]! <= n.threshold ? n.left : n.right;
  return n.value;
}

export function gbmPredict(m: GbmModel, x: number[]): number {
  let y = m.base;
  for (const t of m.trees) y += m.learningRate * predictTree(t, x);
  return y;
}

function buildTree(x: number[][], g: number[], idx: number[], depth: number, o: GbmOptions, cuts: number[][], leafValue: (rows: number[]) => number): Node {
  if (depth === 0 || idx.length < 2 * o.minLeaf) return { value: leafValue(idx) };
  let best: { gain: number; feature: number; threshold: number; left: number[]; right: number[] } | null = null;
  const total = idx.reduce((a, i) => a + g[i]!, 0);
  const n = idx.length;
  for (let f = 0; f < cuts.length; f++) {
    for (const thr of cuts[f]!) {
      let sl = 0;
      let nl = 0;
      for (const i of idx) if (x[i]![f]! <= thr) { sl += g[i]!; nl++; }
      const nr = n - nl;
      if (nl < o.minLeaf || nr < o.minLeaf) continue;
      const sr = total - sl;
      const gain = (sl * sl) / nl + (sr * sr) / nr - (total * total) / n;
      if (!best || gain > best.gain) best = { gain, feature: f, threshold: thr, left: [], right: [] };
    }
  }
  if (!best || best.gain <= 1e-12) return { value: leafValue(idx) };
  for (const i of idx) (x[i]![best.feature]! <= best.threshold ? best.left : best.right).push(i);
  return {
    feature: best.feature,
    threshold: best.threshold,
    left: buildTree(x, g, best.left, depth - 1, o, cuts, leafValue),
    right: buildTree(x, g, best.right, depth - 1, o, cuts, leafValue),
  };
}

export function gbmFit(x: number[][], y: number[], features: string[], options: Partial<GbmOptions> = {}): GbmModel {
  const o = { ...GBM_DEFAULTS, ...options };
  if (!x.length || x.length !== y.length) throw new Error("gbm: empty or mismatched training data");
  const rng = new Rng(o.seed);
  const k = x[0]!.length;
  const cuts = Array.from({ length: k }, (_, f) => {
    const col = x.map((r) => r[f]!);
    return [...new Set(Array.from({ length: o.bins - 1 }, (_, b) => quantile(col, (b + 1) / o.bins)))];
  });
  const tau = o.loss === "squared" ? null : o.loss;
  const base = tau === null ? mean(y) : quantile(y, tau);
  const pred = new Array<number>(y.length).fill(base);
  const trees: Node[] = [];
  for (let t = 0; t < o.trees; t++) {
    // Negative gradient: residual (squared) or the pinball subgradient.
    const g = y.map((v, i) => (tau === null ? v - pred[i]! : v > pred[i]! ? tau : tau - 1));
    const idx = y.map((_, i) => i).filter(() => rng.next() < o.subsample);
    // Leaves: mean residual (squared) or the τ-quantile of the residuals in the leaf (pinball line search).
    const leafValue = (rows: number[]) => (tau === null ? mean(rows.map((i) => g[i]!)) : quantile(rows.map((i) => y[i]! - pred[i]!), tau));
    const tree = buildTree(x, g, idx, o.depth, o, cuts, leafValue);
    trees.push(tree);
    for (let i = 0; i < y.length; i++) pred[i]! += o.learningRate * predictTree(tree, x[i]!);
  }
  return { base, learningRate: o.learningRate, trees, features, loss: o.loss };
}

/** Relative split-gain importance per feature (how much each feature drives the model). */
export function gbmImportance(m: GbmModel): Record<string, number> {
  const counts = new Array<number>(m.features.length).fill(0);
  const walk = (n: Node, w: number) => {
    if (isLeaf(n)) return;
    counts[n.feature]! += w;
    walk(n.left, w / 2);
    walk(n.right, w / 2);
  };
  m.trees.forEach((t) => walk(t, 1));
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(m.features.map((f, i) => [f, Math.round((counts[i]! / total) * 1000) / 1000]));
}
