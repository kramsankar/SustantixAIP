
/**
 * LPEngine — a dependency-free Linear & Mixed-Integer Programming engine.
 *
 * Implements, from first principles (no external solver, no numerical
 * libraries):
 *   - The two-phase Simplex method (tableau form), with Bland's rule as an
 *     anti-cycling fallback to Dantzig's rule.
 *   - Support for <=, >=, and = constraints, and for variables with
 *     arbitrary bounds (including free / unbounded-below variables),
 *     via variable shifting/splitting rather than a bounded-variable
 *     simplex (see "DESIGN NOTES" below for why, and what that trades off).
 *   - Branch & Bound for integer and binary decision variables (MIP),
 *     built on top of the LP relaxation.
 *   - Sensitivity analysis: shadow prices (dual values), reduced costs,
 *     and RHS ranging, read directly off the optimal tableau — for pure
 *     LP models only (see DESIGN NOTES on why this is withheld for MIP).
 *   - A small set of domain templates (cost / route / schedule
 *     optimization) built entirely on top of the general engine.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DESIGN NOTES (read this before treating the engine as a black box)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. Upper bounds on variables are implemented as explicit extra
 *    constraint rows (x <= ub), not via a bounded-variable simplex
 *    tableau. A production solver avoids this to keep the tableau small
 *    and fast on large problems. This engine trades a bit of performance
 *    for a much smaller, easier-to-verify implementation: a model with V
 *    upper-bounded variables gets V extra rows on top of your actual
 *    constraints. For the sizes this file targets (tens to a few hundred
 *    variables/constraints — cost mixes, shift schedules, assignment
 *    problems) this is not a practical bottleneck. If you outgrow that,
 *    you want a dedicated solver (HiGHS/CBC/GLPK), not this file.
 *
 * 2. Branch & Bound for MIP is a depth-first, bound-pruned search over an
 *    LP relaxation solved from scratch at every node. It is NOT a
 *    specialized routing/scheduling solver. It reliably solves assignment
 *    problems, small-to-medium scheduling/shift-coverage problems, and
 *    knapsack-style problems. It will NOT solve genuinely large
 *    combinatorial routing problems (e.g. vehicle routing with 100+ stops)
 *    in reasonable time — that needs metaheuristics or a commercial MIP
 *    solver. This engine enforces a node/time limit and reports
 *    `optimal: false` honestly when it hits that limit, rather than
 *    silently returning a possibly-suboptimal answer as if it were proven.
 *
 * 3. Sensitivity analysis (shadow prices / reduced costs / RHS ranges) is
 *    only produced for pure LP models (no integer/binary variables). Dual
 *    values read off the final LP relaxation at a MIP's incumbent are NOT
 *    valid shadow prices for the original integer problem — a common
 *    modeling mistake — so this engine declines to report them there
 *    rather than hand back numbers that look authoritative but aren't.
 *
 * 4. RHS ranging is only reported for constraints whose internal
 *    representation did not require a sign flip during standard-form
 *    normalization (internally: `rowMeta[i].flipped`). This is the common
 *    case for ordinary constraints with variables at their natural bounds.
 *    Where it isn't available, `rhsRanges[name] = { available: false, ... }`
 *    says so explicitly instead of guessing.
 *
 * 5. Numerical tolerance: IEEE-754 doubles, epsilon 1e-9 for
 *    feasibility/optimality. Fine for the sizes above; not appropriate
 *    for ill-conditioned or extreme-magnitude coefficient problems.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUICK START
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   const { LPModel } = require('./lp-engine.js');
 *
 *   const m = new LPModel({ sense: 'maximize' });
 *   m.addVariable('x');                 // continuous, x >= 0 by default
 *   m.addVariable('y');
 *   m.setObjective({ x: 3, y: 5 });
 *   m.addConstraint({ x: 1 }, '<=', 4, 'c1');
 *   m.addConstraint({ y: 2 }, '<=', 12, 'c2');
 *   m.addConstraint({ x: 3, y: 2 }, '<=', 18, 'c3');
 *   const result = m.solve();
 *   // result.status === 'optimal'
 *   // result.objective === 36
 *   // result.variables === { x: 2, y: 6 }
 *   // result.shadowPrices === { c1: 0, c2: 1.5, c3: 1 }
 *
 * See `templates` (LPEngine.templates) for ready-made cost / route /
 * schedule models — `templates.blend`, `templates.transportation`,
 * `templates.assignment`, `templates.shiftScheduling`.
 */

'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LPEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const EPS = 1e-9;
  const INT_TOL = 1e-6;
  const BLAND_MULTIPLIER = 8;

  // ───────────────────────────────────────────────────────────────────────
  // Small numeric helpers
  // ───────────────────────────────────────────────────────────────────────

  function isZero(v) { return Math.abs(v) < EPS; }
  function isInt(v) { return Math.abs(v - Math.round(v)) < INT_TOL; }
  function clampTiny(v) { return Math.abs(v) < 1e-9 ? 0 : v; }
  function round(v, dp) { const f = Math.pow(10, dp); return Math.round(v * f) / f; }

  // ───────────────────────────────────────────────────────────────────────
  // Standard-form construction: map an LPModel (arbitrary bounds, <=/>=/=
  // constraints) down to { variables >= 0 only, rows with identity slots }
  // ready for the simplex tableau.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Expand every original variable into 1-2 nonnegative internal
   * variables, depending on its (possibly branch-and-bound-tightened)
   * bounds:
   *   - finite lb, any ub          -> shift: x = lb + z            (z>=0)
   *                                    (+ explicit z <= ub-lb row if ub finite)
   *   - -Infinity lb, finite ub     -> flip:  x = ub - z            (z>=0)
   *   - -Infinity lb, +Infinity ub  -> split: x = zPos - zNeg       (both >=0)
   */
  function buildVariableSubstitution(vars, boundOverrides) {
    const varSub = [];
    let internalCount = 0;
    for (let i = 0; i < vars.length; i++) {
      let lb = vars[i].lb, ub = vars[i].ub;
      const o = boundOverrides && boundOverrides.get(i);
      if (o) {
        if (o.lb !== undefined) lb = Math.max(lb, o.lb);
        if (o.ub !== undefined) ub = Math.min(ub, o.ub);
      }
      if (lb > ub + 1e-9) return { infeasibleByBounds: true };

      if (lb === -Infinity && ub === Infinity) {
        const p = internalCount++, q = internalCount++;
        varSub.push({ kind: 'free', offset: 0, terms: [{ idx: p, mult: 1 }, { idx: q, mult: -1 }] });
      } else if (lb === -Infinity) {
        const p = internalCount++;
        varSub.push({ kind: 'flip', offset: ub, terms: [{ idx: p, mult: -1 }] });
      } else {
        const p = internalCount++;
        varSub.push({
          kind: 'shift', offset: lb, terms: [{ idx: p, mult: 1 }],
          upperBound: (ub === Infinity ? null : ub - lb),
        });
      }
    }
    return { varSub, internalCount };
  }

  function expandLinearExpr(coeffMap, varSub) {
    // coeffMap: Map(varIndex -> coef). Returns { coefMap: Map(internalIdx->coef), constant }
    const out = new Map();
    let constant = 0;
    for (const [varIdx, coef] of coeffMap) {
      const sub = varSub[varIdx];
      constant += coef * sub.offset;
      for (const t of sub.terms) {
        out.set(t.idx, (out.get(t.idx) || 0) + coef * t.mult);
      }
    }
    return { coefMap: out, constant };
  }

  /**
   * Build the full standard-form tableau inputs for a model, optionally
   * with tightened variable bounds (used by branch & bound).
   */
  function buildStandardForm(model, boundOverrides) {
    const sub = buildVariableSubstitution(model.variables, boundOverrides);
    if (sub.infeasibleByBounds) return { infeasibleByBounds: true };
    const { varSub, internalCount } = sub;

    // Rows: user constraints, then explicit upper-bound rows.
    const rawRows = [];
    for (const c of model.constraints) {
      const ex = expandLinearExpr(c.coeffs, varSub);
      rawRows.push({ coefMap: ex.coefMap, sense: c.sense, rhs: c.rhs - ex.constant, tag: c.name, origIndex: rawRows.length });
    }
    const firstUbRow = rawRows.length;
    for (let i = 0; i < model.variables.length; i++) {
      const s = varSub[i];
      if (s.kind === 'shift' && s.upperBound !== null) {
        rawRows.push({
          coefMap: new Map([[s.terms[0].idx, 1]]), sense: '<=', rhs: s.upperBound,
          tag: '__ub__' + model.variables[i].name, origIndex: -1,
        });
      }
    }

    // Normalize RHS >= 0 (flip sign+sense where needed) and assign slack /
    // surplus / artificial (identity-slot) columns.
    let totalCols = internalCount;
    const rows = rawRows.map((r) => {
      let { coefMap, sense, rhs } = r;
      let flipped = false;
      if (rhs < -1e-12) {
        const neg = new Map();
        for (const [k, v] of coefMap) neg.set(k, -v);
        coefMap = neg; rhs = -rhs; flipped = true;
        if (sense === '<=') sense = '>=';
        else if (sense === '>=') sense = '<=';
      }
      return { coefMap, sense, rhs, tag: r.tag, origIndex: r.origIndex, flipped };
    });

    const m = rows.length;
    const identityCol = new Array(m);
    const kind = new Array(m);
    for (let i = 0; i < m; i++) {
      kind[i] = rows[i].sense === '<=' ? 'le' : rows[i].sense === '>=' ? 'ge' : 'eq';
    }
    // slack/surplus columns first (le & ge), then artificial columns (ge & eq)
    const slackCol = new Array(m).fill(-1);
    for (let i = 0; i < m; i++) if (kind[i] === 'le' || kind[i] === 'ge') slackCol[i] = totalCols++;
    const artCol = new Array(m).fill(-1);
    const artificialCols = [];
    for (let i = 0; i < m; i++) {
      if (kind[i] === 'ge' || kind[i] === 'eq') { artCol[i] = totalCols++; artificialCols.push(artCol[i]); }
    }
    for (let i = 0; i < m; i++) identityCol[i] = kind[i] === 'le' ? slackCol[i] : artCol[i];

    const n = totalCols;
    const rowsMat = new Array(m);
    const basis = new Array(m);
    for (let i = 0; i < m; i++) {
      const arr = new Float64Array(n + 1);
      for (const [k, v] of rows[i].coefMap) arr[k] = v;
      if (kind[i] === 'le') { arr[slackCol[i]] = 1; basis[i] = slackCol[i]; }
      else if (kind[i] === 'ge') { arr[slackCol[i]] = -1; arr[artCol[i]] = 1; basis[i] = artCol[i]; }
      else { arr[artCol[i]] = 1; basis[i] = artCol[i]; }
      arr[n] = rows[i].rhs;
      rowsMat[i] = arr;
    }
    const colAllowed = new Array(n).fill(true);

    // Objective, expanded the same way.
    const objEx = expandLinearExpr(model.objective, varSub);
    const maximizing = model.sense === 'maximize';
    const objVec = new Float64Array(n);
    for (const [k, v] of objEx.coefMap) objVec[k] = maximizing ? v : -v;
    const objConstant = maximizing ? (objEx.constant + (model.objectiveConstant || 0))
                                    : -(objEx.constant + (model.objectiveConstant || 0));

    return {
      rowsMat, n, m, basis, colAllowed, artificialCols, objVec, objConstant,
      varSub, rowMeta: rows.map((r, i) => ({ ...r, identityCol: identityCol[i], kind: kind[i] })),
      firstUbRow, maximizing,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Simplex core (operates on a plain tableau: rowsMat, n, m, basis,
  // colAllowed). Always maximizes objVec · z; caller has already flipped
  // sign for 'minimize' problems.
  // ───────────────────────────────────────────────────────────────────────

  function initZRow(rowsMat, basis, objVec, m, n) {
    const z = new Float64Array(n + 1);
    for (let j = 0; j < n; j++) z[j] = objVec[j] || 0;
    for (let i = 0; i < m; i++) {
      const cB = objVec[basis[i]] || 0;
      if (cB === 0) continue;
      const row = rowsMat[i];
      for (let j = 0; j <= n; j++) z[j] -= cB * row[j];
    }
    return z;
  }

  function pivot(rowsMat, z, basis, r, c, n) {
    const prow = rowsMat[r];
    const pv = prow[c];
    for (let j = 0; j <= n; j++) prow[j] /= pv;
    for (let i = 0; i < rowsMat.length; i++) {
      if (i === r) continue;
      const f = rowsMat[i][c];
      if (f !== 0) { const row = rowsMat[i]; for (let j = 0; j <= n; j++) row[j] -= f * prow[j]; }
    }
    if (z) { const fz = z[c]; if (fz !== 0) for (let j = 0; j <= n; j++) z[j] -= fz * prow[j]; }
    basis[r] = c;
  }

  function runSimplex(tab, objVec) {
    const { rowsMat, n, m, basis, colAllowed } = tab;
    const z = initZRow(rowsMat, basis, objVec, m, n);
    const maxIter = 500 + 40 * (m + n);
    const blandAfter = BLAND_MULTIPLIER * (m + n) + 50;
    let iter = 0;
    while (true) {
      iter++;
      if (iter > maxIter) return { status: 'iteration_limit', z };
      const useBland = iter > blandAfter;
      let enter = -1;
      if (useBland) {
        for (let j = 0; j < n; j++) if (colAllowed[j] && z[j] > EPS) { enter = j; break; }
      } else {
        let best = EPS;
        for (let j = 0; j < n; j++) if (colAllowed[j] && z[j] > best) { best = z[j]; enter = j; }
      }
      if (enter === -1) return { status: 'optimal', z };

      let leaveRow = -1, bestRatio = Infinity;
      for (let i = 0; i < m; i++) {
        const a = rowsMat[i][enter];
        if (a > EPS) {
          const ratio = rowsMat[i][n] / a;
          if (ratio < bestRatio - 1e-10) { bestRatio = ratio; leaveRow = i; }
          else if (Math.abs(ratio - bestRatio) <= 1e-10 && useBland) {
            if (leaveRow === -1 || basis[i] < basis[leaveRow]) leaveRow = i;
          }
        }
      }
      if (leaveRow === -1) return { status: 'unbounded' };
      pivot(rowsMat, z, basis, leaveRow, enter, n);
    }
  }

  function solveStandardForm(std) {
    const { rowsMat, n, m, basis, colAllowed, artificialCols, objVec, objConstant } = std;
    const tab = { rowsMat, n, m, basis, colAllowed };
    const artSet = new Set(artificialCols);

    if (artificialCols.length > 0) {
      const p1Obj = new Float64Array(n);
      for (const c of artificialCols) p1Obj[c] = -1;
      const r1 = runSimplex(tab, p1Obj);
      if (r1.status === 'iteration_limit') return { status: 'iteration_limit' };

      let artSum = 0;
      for (const c of artificialCols) {
        const rowIdx = basis.indexOf(c);
        if (rowIdx !== -1) artSum += rowsMat[rowIdx][n];
      }
      if (artSum > 1e-6) return { status: 'infeasible' };

      // Pivot out any artificials still basic at ~0, where possible.
      for (let i = 0; i < m; i++) {
        if (artSet.has(basis[i])) {
          let pivotCol = -1;
          for (let j = 0; j < n; j++) {
            if (!artSet.has(j) && Math.abs(rowsMat[i][j]) > 1e-7) { pivotCol = j; break; }
          }
          if (pivotCol !== -1) pivot(rowsMat, null, basis, i, pivotCol, n);
          // else: redundant row, artificial stuck at 0 — harmless, it's barred from re-entering below.
        }
      }
      for (const c of artificialCols) colAllowed[c] = false;
    }

    const r2 = runSimplex(tab, objVec);
    if (r2.status === 'unbounded') return { status: 'unbounded' };
    if (r2.status === 'iteration_limit') return { status: 'iteration_limit' };

    let objValue = objConstant || 0;
    for (let i = 0; i < m; i++) objValue += (objVec[basis[i]] || 0) * rowsMat[i][n];

    return { status: 'optimal', rowsMat, basis, z: r2.z, objValue, n, m };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Solution extraction & sensitivity
  // ───────────────────────────────────────────────────────────────────────

  function extractSolution(model, std, solved, roundIntegers) {
    // roundIntegers defaults to true (safe for reporting a genuinely
    // integer-feasible solution). Branch & bound must see the RAW,
    // possibly-fractional relaxation values to decide whether/what to
    // branch on — passing roundIntegers=false there is what makes that
    // decision correct instead of silently always seeing "0 fraction".
    if (roundIntegers === undefined) roundIntegers = true;
    const { rowsMat, basis, m } = solved;
    const internalVal = new Array(std.n).fill(0);
    for (let i = 0; i < m; i++) internalVal[basis[i]] = rowsMat[i][std.n];

    const variables = {};
    model.variables.forEach((v, i) => {
      const s = std.varSub[i];
      let val = s.offset;
      for (const t of s.terms) val += t.mult * internalVal[t.idx];
      if (roundIntegers && v.type !== 'continuous') val = Math.round(val);
      variables[v.name] = clampTiny(round(val, 9));
    });

    const objective = std.maximizing ? round(solved.objValue, 9) : round(-solved.objValue, 9);
    return { variables, objective, internalVal };
  }

  function extractSensitivity(model, std, solved) {
    const shadowPrices = {}, reducedCosts = {}, rhsRanges = {}, basisStatus = {};
    const { rowsMat, z, m, n } = solved;
    const signFix = std.maximizing ? 1 : -1;

    // Shadow prices + RHS ranges, one per user constraint (skip synthetic upper-bound rows).
    std.rowMeta.forEach((rm) => {
      if (rm.origIndex < 0) return; // synthetic upper-bound row, not a user constraint
      const col = rm.identityCol;
      const flipSign = rm.flipped ? -1 : 1;
      // z[col] for an identity-slot column (slack/artificial, cost 0) equals
      // (0 - cB·B^-1·e_i) = -y_i under this tableau's "c_j - z_j" reduced-cost
      // convention, so the shadow price is the negation of the raw z entry.
      const dual = clampTiny(round(-signFix * flipSign * z[col], 9));
      shadowPrices[rm.tag || ('constraint_' + rm.origIndex)] = dual;

      if (rm.flipped) {
        rhsRanges[rm.tag || ('constraint_' + rm.origIndex)] = { available: false, reason: 'internal sign normalization applied to this row' };
        return;
      }
      let lo = -Infinity, hi = Infinity;
      for (let i = 0; i < m; i++) {
        const coef = rowsMat[i][col];
        const rhsVal = rowsMat[i][n];
        if (coef > EPS) lo = Math.max(lo, -rhsVal / coef);
        else if (coef < -EPS) hi = Math.min(hi, -rhsVal / coef);
      }
      rhsRanges[rm.tag || ('constraint_' + rm.origIndex)] = {
        available: true,
        from: lo === -Infinity ? -Infinity : round(rm.rhs + lo, 9),
        to: hi === Infinity ? Infinity : round(rm.rhs + hi, 9),
      };
    });

    // Reduced costs + basis status, one per original decision variable.
    // A variable is "basic" if any of its internal component(s) is currently basic and nonzero-column-wise;
    // report the reduced cost of its primary internal column (first term).
    const basicCols = new Set();
    for (let i = 0; i < m; i++) basicCols.add(solved.basis[i]);
    model.variables.forEach((v, i) => {
      const s = std.varSub[i];
      const primary = s.terms[0].idx;
      const isBasic = basicCols.has(primary);
      basisStatus[v.name] = isBasic ? 'basic' : 'nonbasic';
      const rc = clampTiny(round(signFix * s.terms[0].mult * z[primary], 9));
      reducedCosts[v.name] = isBasic ? 0 : rc;
    });

    return { shadowPrices, reducedCosts, rhsRanges, basisStatus };
  }

  // ───────────────────────────────────────────────────────────────────────
  // LP-only solve
  // ───────────────────────────────────────────────────────────────────────

  function solveLPOnly(model, boundOverrides, roundIntegers) {
    const std = buildStandardForm(model, boundOverrides);
    if (std.infeasibleByBounds) return { status: 'infeasible' };
    const solved = solveStandardForm(std);
    if (solved.status !== 'optimal') return { status: solved.status };
    const sol = extractSolution(model, std, solved, roundIntegers);
    return { status: 'optimal', std, solved, sol };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Branch & bound (MIP)
  // ───────────────────────────────────────────────────────────────────────

  function solveMIP(model, options) {
    const nodeLimit = (options && options.nodeLimit !== undefined) ? options.nodeLimit : 20000;
    const timeLimitMs = (options && options.timeLimitMs !== undefined) ? options.timeLimitMs : 8000;
    const start = Date.now();

    const intVars = [];
    model.variables.forEach((v, i) => { if (v.type !== 'continuous') intVars.push(i); });

    let incumbent = null;
    let incumbentObj = null;
    let rootRelaxationBound = null;
    let rootStatus = null;
    const better = (obj) => incumbentObj === null ||
      (model.sense === 'maximize' ? obj > incumbentObj + EPS : obj < incumbentObj - EPS);

    const stack = [new Map()];
    let nodes = 0, hitLimit = false;

    while (stack.length > 0) {
      if (nodes >= nodeLimit || Date.now() - start > timeLimitMs) { hitLimit = true; break; }
      nodes++;
      const overrides = stack.pop();
      const r = solveLPOnly(model, overrides, false);
      if (nodes === 1) rootStatus = r.status;

      if (r.status === 'unbounded') {
        // An unbounded LP relaxation must never be mislabeled as infeasible.
        // Without an integer unbounded-ray proof, report the relaxation status explicitly.
        if (nodes === 1) return { status: 'unbounded_relaxation', nodesExplored: nodes };
        continue;
      }
      if (r.status !== 'optimal') continue;

      const relaxObj = r.sol.objective;
      if (nodes === 1) rootRelaxationBound = relaxObj;
      if (incumbentObj !== null) {
        const worseOrEqual = model.sense === 'maximize' ? relaxObj <= incumbentObj + EPS : relaxObj >= incumbentObj - EPS;
        if (worseOrEqual) continue;
      }

      let branchVar = -1, bestDist = Infinity;
      for (const vi of intVars) {
        const val = r.sol.variables[model.variables[vi].name];
        const frac = val - Math.floor(val);
        if (Math.abs(frac) > INT_TOL && Math.abs(frac - 1) > INT_TOL) {
          const dist = Math.abs(frac - 0.5);
          if (dist < bestDist) { bestDist = dist; branchVar = vi; }
        }
      }

      if (branchVar === -1) {
        if (better(relaxObj)) {
          const cleanVars = Object.assign({}, r.sol.variables);
          model.variables.forEach((v) => { if (v.type !== 'continuous') cleanVars[v.name] = Math.round(cleanVars[v.name]); });
          incumbent = { sol: { variables: cleanVars, objective: relaxObj } };
          incumbentObj = relaxObj;
        }
        continue;
      }

      const val = r.sol.variables[model.variables[branchVar].name];
      const floorOv = new Map(overrides); {
        const prev = floorOv.get(branchVar) || {};
        floorOv.set(branchVar, { lb: prev.lb, ub: Math.min(prev.ub === undefined ? Infinity : prev.ub, Math.floor(val)) });
      }
      const ceilOv = new Map(overrides); {
        const prev = ceilOv.get(branchVar) || {};
        ceilOv.set(branchVar, { lb: Math.max(prev.lb === undefined ? -Infinity : prev.lb, Math.ceil(val)), ub: prev.ub });
      }
      stack.push(floorOv, ceilOv);
    }

    if (!incumbent) {
      return {
        status: hitLimit ? 'no_feasible_found_within_limits' : (rootStatus === 'unbounded' ? 'unbounded_relaxation' : 'infeasible'),
        nodesExplored: nodes,
        bestBound: rootRelaxationBound,
      };
    }
    const gapAbs = rootRelaxationBound === null ? null : Math.abs(rootRelaxationBound - incumbentObj);
    const denom = Math.max(1, Math.abs(incumbentObj));
    const gapRel = gapAbs === null ? null : gapAbs / denom;
    return {
      status: 'optimal', optimal: !hitLimit, nodesExplored: nodes,
      variables: incumbent.sol.variables, objective: incumbent.sol.objective,
      bestBound: !hitLimit ? incumbent.sol.objective : rootRelaxationBound,
      mipGapAbsolute: !hitLimit ? 0 : gapAbs,
      mipGapRelative: !hitLimit ? 0 : gapRel,
      termination: hitLimit ? 'limit' : 'proven_optimal',
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Public model API
  // ───────────────────────────────────────────────────────────────────────

  class LPModel {
    constructor(opts) {
      opts = opts || {};
      this.sense = opts.sense === 'minimize' ? 'minimize' : (opts.sense === 'maximize' ? 'maximize' : 'minimize');
      this.variables = [];        // [{name, lb, ub, type}]
      this._varIndex = new Map(); // name -> index
      this.constraints = [];      // [{coeffs: Map(idx->coef), sense, rhs, name}]
      this.objective = new Map(); // idx -> coef
      this.objectiveConstant = 0;
    }

    addVariable(name, opts) {
      if (this._varIndex.has(name)) throw new Error(`Variable "${name}" already exists`);
      opts = opts || {};
      let lb = opts.lb === undefined ? 0 : opts.lb;
      let ub = opts.ub === undefined ? Infinity : opts.ub;
      let type = opts.type || 'continuous';
      if (type === 'binary') { lb = 0; ub = 1; type = 'binary'; }
      if (!['continuous', 'integer', 'binary'].includes(type)) throw new Error(`Unknown variable type "${type}"`);
      const idx = this.variables.length;
      this.variables.push({ name, lb, ub, type });
      this._varIndex.set(name, idx);
      return name;
    }

    _resolve(coeffsObj) {
      const m = new Map();
      for (const key of Object.keys(coeffsObj)) {
        if (!this._varIndex.has(key)) throw new Error(`Unknown variable "${key}" — add it with addVariable() first`);
        const v = coeffsObj[key];
        if (v !== 0) m.set(this._varIndex.get(key), (m.get(this._varIndex.get(key)) || 0) + v);
      }
      return m;
    }

    addConstraint(coeffsObj, sense, rhs, name) {
      if (!['<=', '>=', '='].includes(sense)) throw new Error(`Constraint sense must be '<=', '>=' or '=', got "${sense}"`);
      const coeffs = this._resolve(coeffsObj);
      const idx = this.constraints.length;
      this.constraints.push({ coeffs, sense, rhs, name: name || ('c' + (idx + 1)) });
      return this.constraints[idx].name;
    }

    setObjective(coeffsObj, constant) {
      this.objective = this._resolve(coeffsObj);
      this.objectiveConstant = constant || 0;
    }

    setSense(sense) {
      if (sense !== 'minimize' && sense !== 'maximize') throw new Error("sense must be 'minimize' or 'maximize'");
      this.sense = sense;
    }

    /**
     * Semi-continuous variable: forces x to be EITHER exactly 0, OR
     * somewhere in [lb, ub] (lb must be > 0 — that's what makes it
     * semi-continuous rather than an ordinary bounded variable). Common
     * uses: a machine/line that's either off or must run above some
     * minimum batch/rate; a supplier that's either unused or must be
     * ordered from above a minimum order quantity.
     *
     * Implemented as: a continuous (or integer, if type:'integer' is
     * passed) variable `x` in [0, ub], plus an auxiliary binary indicator
     * `x__active`, plus two constraints (x <= ub*y, x >= lb*y). This
     * necessarily makes the model a MIP (adds one binary variable per
     * semi-continuous variable), solved via branch & bound like any other
     * integer model — there is no way around that; semi-continuity is not
     * expressible in pure LP.
     *
     *   m.addSemiContinuousVariable('batch', { lb: 10, ub: 50 });
     *   // 'batch' is now either 0, or between 10 and 50.
     *
     * Returns { variable, indicator } — the indicator variable's name, in
     * case you want to reference it (e.g. to add a fixed setup cost:
     * obj[indicator] = setupCost).
     */
    addSemiContinuousVariable(name, opts) {
      opts = opts || {};
      const lb = opts.lb === undefined ? 0 : opts.lb;
      const ub = opts.ub === undefined ? Infinity : opts.ub;
      if (!(lb > 0)) throw new Error(`addSemiContinuousVariable("${name}"): lb must be > 0 — with lb <= 0 this is just an ordinary bounded variable, use addVariable() instead`);
      if (ub === Infinity) throw new Error(`addSemiContinuousVariable("${name}"): ub must be finite — semi-continuity needs a finite "on" range [lb, ub]`);
      if (!(ub >= lb)) throw new Error(`addSemiContinuousVariable("${name}"): ub (${ub}) must be >= lb (${lb})`);
      const type = opts.type === 'integer' ? 'integer' : 'continuous';

      this.addVariable(name, { lb: 0, ub, type });
      const indicatorName = name + '__active';
      this.addVariable(indicatorName, { type: 'binary' });
      // x <= ub*y  =>  x - ub*y <= 0   (y=0 forces x<=0; y=1 allows up to ub)
      this.addConstraint({ [name]: 1, [indicatorName]: -ub }, '<=', 0, name + '__sc_upper');
      // x >= lb*y  =>  x - lb*y >= 0   (y=0 forces x>=0, combined with the row above pins x=0;
      //                                  y=1 requires x>=lb)
      this.addConstraint({ [name]: 1, [indicatorName]: -lb }, '>=', 0, name + '__sc_lower');
      return { variable: name, indicator: indicatorName };
    }

    /**
     * Indicator (conditional / if-then) constraint via Big-M
     * reformulation: "IF binaryVar == binaryValue THEN coeffsObj (sense)
     * rhs must hold." When the binary variable is at the OTHER value, the
     * constraint is relaxed (effectively removed) rather than enforced.
     *
     *   // if 'openWarehouse' == 1, throughput must be >= 500
     *   m.addIndicatorConstraint('openWarehouse', 1, { throughput: 1 }, '>=', 500, 'min_throughput_if_open', 100000);
     *
     * `bigM` MUST be large enough that, when the constraint is meant to be
     * relaxed, it never becomes the binding limit on coeffsObj's value —
     * too small silently over-constrains the "off" case; too large causes
     * numerical looseness in the simplex tableau. This engine does NOT
     * infer a safe bigM from your variable bounds (that inference is
     * itself easy to get subtly wrong); you must size it from your own
     * model's realistic ranges. Defaults to 1e6 if omitted — treat that
     * default as a placeholder to double-check, not a safe universal value.
     */
    addIndicatorConstraint(binaryVarName, binaryValue, coeffsObj, sense, rhs, name, bigM) {
      if (!this._varIndex.has(binaryVarName)) throw new Error(`addIndicatorConstraint: unknown variable "${binaryVarName}"`);
      const v = this.variables[this._varIndex.get(binaryVarName)];
      if (v.type !== 'binary') throw new Error(`addIndicatorConstraint: "${binaryVarName}" must be a binary variable (got type "${v.type}")`);
      if (binaryValue !== 0 && binaryValue !== 1) throw new Error('addIndicatorConstraint: binaryValue must be 0 or 1');
      if (!['<=', '>=', '='].includes(sense)) throw new Error(`addIndicatorConstraint: sense must be '<=', '>=' or '=', got "${sense}"`);
      const M = bigM === undefined ? 1e6 : bigM;
      const baseName = name || (binaryVarName + '_eq' + binaryValue + '_indicator_' + (this.constraints.length + 1));

      // Derivation: with y the indicator, "active" is (y===binaryValue).
      //   binaryValue=1: active multiplier is y itself; relax term is M*(1-y) = M - M*y.
      //   binaryValue=0: active multiplier is (1-y); relax term is M*y.
      // <=  row <= rhs + relax   =>   row - (M - M*y) <= rhs  [bv=1]  ->  row + M*y <= rhs + M
      //                               row - M*y <= rhs         [bv=0]
      // >=  row >= rhs - relax   =>   row + (M - M*y) >= rhs  [bv=1]  ->  row - M*y >= rhs - M
      //                               row + M*y >= rhs         [bv=0]
      const withIndicator = (delta) => {
        const out = Object.assign({}, coeffsObj);
        out[binaryVarName] = (Number(out[binaryVarName]) || 0) + delta;
        return out;
      };
      if (sense === '<=') {
        if (binaryValue === 1) this.addConstraint(withIndicator(M), '<=', rhs + M, baseName);
        else this.addConstraint(withIndicator(-M), '<=', rhs, baseName);
      } else if (sense === '>=') {
        if (binaryValue === 1) this.addConstraint(withIndicator(-M), '>=', rhs - M, baseName);
        else this.addConstraint(withIndicator(M), '>=', rhs, baseName);
      } else {
        if (binaryValue === 1) {
          this.addConstraint(withIndicator(M), '<=', rhs + M, baseName + '_le');
          this.addConstraint(withIndicator(-M), '>=', rhs - M, baseName + '_ge');
        } else {
          this.addConstraint(withIndicator(-M), '<=', rhs, baseName + '_le');
          this.addConstraint(withIndicator(M), '>=', rhs, baseName + '_ge');
        }
      }
      return baseName;
    }

    /**
     * Solve the model. Returns a plain object:
     *   { status, objective, variables, nodesExplored?, optimal?,
     *     shadowPrices?, reducedCosts?, rhsRanges?, basisStatus? }
     * status is one of: 'optimal' | 'infeasible' | 'unbounded' |
     *   'iteration_limit' | 'no_feasible_found_within_limits'
     */
    solve(options) {
      const hasIntVars = this.variables.some((v) => v.type !== 'continuous');
      if (!hasIntVars) {
        const r = solveLPOnly(this);
        if (r.status !== 'optimal') return { status: r.status };
        const sens = extractSensitivity(this, r.std, r.solved);
        return {
          status: 'optimal', objective: r.sol.objective, variables: r.sol.variables,
          shadowPrices: sens.shadowPrices, reducedCosts: sens.reducedCosts,
          rhsRanges: sens.rhsRanges, basisStatus: sens.basisStatus,
        };
      }
      const r = solveMIP(this, options);
      if (r.status !== 'optimal') return { status: r.status, nodesExplored: r.nodesExplored };
      return {
        status: 'optimal', objective: r.objective, variables: r.variables,
        optimal: r.optimal, nodesExplored: r.nodesExplored, bestBound: r.bestBound,
        mipGapAbsolute: r.mipGapAbsolute, mipGapRelative: r.mipGapRelative, termination: r.termination,
        sensitivityNote: 'Shadow prices/reduced costs are not reported for MIP models — duals from the final relaxation are not valid marginal values for an integer-constrained problem.',
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Domain templates — cost / route / schedule optimization
  //
  // Each of these builds and returns a ready-to-`.solve()` LPModel from a
  // plain-object description of the problem, so the three use cases you
  // asked for don't require hand-building the model each time. They are
  // ordinary LPModel instances underneath — feel free to add further
  // constraints to the returned model before solving it.
  // ───────────────────────────────────────────────────────────────────────

  const templates = {};

  /**
   * COST OPTIMIZATION — blending / product-mix problems.
   * "How much of each ingredient/input, at what cost, to hit requirements
   * at minimum (or maximum) total cost." Classic diet-problem / feed-mix /
   * production-mix formulation.
   *
   *   templates.blend({
   *     sense: 'minimize',                 // or 'maximize'
   *     items: [
   *       { name: 'corn',    cost: 0.30, lb: 0, ub: Infinity, attributes: { protein: 9,  fiber: 2 } },
   *       { name: 'soymeal', cost: 0.90, lb: 0, ub: Infinity, attributes: { protein: 44, fiber: 7 } },
   *     ],
   *     requirements: {                    // per attribute, either bound optional
   *       protein: { min: 20 },
   *       fiber:   { max: 5 },
   *     },
   *     totalAmount: { min: 100, max: 100 } // optional: sum of all item quantities
   *   })
   */
  templates.blend = function blend(spec) {
    const m = new LPModel({ sense: spec.sense || 'minimize' });
    for (const item of spec.items) {
      m.addVariable(item.name, { lb: item.lb, ub: item.ub, type: item.type });
    }
    const obj = {};
    for (const item of spec.items) obj[item.name] = item.cost;
    m.setObjective(obj);

    const attrKeys = Object.keys(spec.requirements || {});
    for (const key of attrKeys) {
      const bound = spec.requirements[key];
      const row = {};
      for (const item of spec.items) {
        const c = (item.attributes || {})[key] || 0;
        if (c !== 0) row[item.name] = c;
      }
      if (bound.min !== undefined) m.addConstraint(row, '>=', bound.min, key + '_min');
      if (bound.max !== undefined) m.addConstraint(row, '<=', bound.max, key + '_max');
      if (bound.equal !== undefined) m.addConstraint(row, '=', bound.equal, key + '_eq');
    }
    if (spec.totalAmount) {
      const row = {};
      for (const item of spec.items) row[item.name] = 1;
      if (spec.totalAmount.min !== undefined) m.addConstraint(row, '>=', spec.totalAmount.min, 'total_min');
      if (spec.totalAmount.max !== undefined) m.addConstraint(row, '<=', spec.totalAmount.max, 'total_max');
      if (spec.totalAmount.equal !== undefined) m.addConstraint(row, '=', spec.totalAmount.equal, 'total_eq');
    }
    return m;
  };

  /**
   * COST / ROUTE OPTIMIZATION — transportation problem.
   * "How much to ship from each supply node to each demand node, at
   * minimum total cost, respecting capacities and requirements." This is
   * the classic multi-origin/multi-destination shipping-cost LP; also a
   * natural first cut at load/route allocation between fixed sites.
   *
   *   templates.transportation({
   *     supply: [{ name: 'PlantA', capacity: 100 }, { name: 'PlantB', capacity: 80 }],
   *     demand: [{ name: 'SiteX', requirement: 60 }, { name: 'SiteY', requirement: 90 }],
   *     cost: [[4, 6], [8, 3]],   // cost[i][j] = supply[i] -> demand[j]
   *     integer: false,           // set true to force integer shipments
   *   })
   *
   * Note: if total supply < total demand, demand constraints (>=) make the
   * model infeasible by design — that's the engine correctly telling you
   * the requirements can't be met, not a bug.
   */
  templates.transportation = function transportation(spec) {
    const m = new LPModel({ sense: 'minimize' });
    const varType = spec.integer ? 'integer' : 'continuous';
    const varName = (i, j) => `ship_${spec.supply[i].name}_${spec.demand[j].name}`;
    for (let i = 0; i < spec.supply.length; i++) {
      for (let j = 0; j < spec.demand.length; j++) {
        m.addVariable(varName(i, j), { lb: 0, type: varType });
      }
    }
    const obj = {};
    for (let i = 0; i < spec.supply.length; i++)
      for (let j = 0; j < spec.demand.length; j++)
        obj[varName(i, j)] = spec.cost[i][j];
    m.setObjective(obj);

    for (let i = 0; i < spec.supply.length; i++) {
      const row = {};
      for (let j = 0; j < spec.demand.length; j++) row[varName(i, j)] = 1;
      m.addConstraint(row, '<=', spec.supply[i].capacity, 'supply_' + spec.supply[i].name);
    }
    for (let j = 0; j < spec.demand.length; j++) {
      const row = {};
      for (let i = 0; i < spec.supply.length; i++) row[varName(i, j)] = 1;
      m.addConstraint(row, '>=', spec.demand[j].requirement, 'demand_' + spec.demand[j].name);
    }
    return m;
  };

  /**
   * ROUTE / TASK OPTIMIZATION — assignment problem.
   * "Match N agents (vehicles, crews, machines) to M tasks (stops, jobs,
   * orders) one-to-one at minimum (or maximum) total cost." This is the
   * classic assignment LP — genuinely optimal for one-to-one matching, but
   * NOT a vehicle-routing solver: it tells you *who goes where*, not in
   * what *sequence* to visit multiple stops (that's a much harder,
   * NP-hard routing problem outside this engine's scope — see the
   * "DESIGN NOTES" at the top of this file).
   *
   *   templates.assignment({
   *     agents: ['Truck1', 'Truck2', 'Truck3'],
   *     tasks:  ['StopA', 'StopB', 'StopC'],
   *     cost: [[4,1,3],[2,0,5],[3,2,2]],   // cost[i][j] = agents[i] -> tasks[j]
   *     sense: 'minimize',
   *     agentCapacity: 1,      // max tasks per agent (use Infinity to relax)
   *     requireEveryTask: true // every task must be covered by exactly one agent
   *   })
   */
  templates.assignment = function assignment(spec) {
    const sense = spec.sense || 'minimize';
    const m = new LPModel({ sense });
    const varName = (i, j) => `assign_${spec.agents[i]}_${spec.tasks[j]}`;
    for (let i = 0; i < spec.agents.length; i++)
      for (let j = 0; j < spec.tasks.length; j++)
        if (spec.cost[i][j] !== null && spec.cost[i][j] !== undefined)
          m.addVariable(varName(i, j), { type: 'binary' });

    const obj = {};
    for (let i = 0; i < spec.agents.length; i++)
      for (let j = 0; j < spec.tasks.length; j++)
        if (spec.cost[i][j] !== null && spec.cost[i][j] !== undefined)
          obj[varName(i, j)] = spec.cost[i][j];
    m.setObjective(obj);

    const agentCap = spec.agentCapacity === undefined ? 1 : spec.agentCapacity;
    for (let i = 0; i < spec.agents.length; i++) {
      const row = {};
      for (let j = 0; j < spec.tasks.length; j++)
        if (spec.cost[i][j] !== null && spec.cost[i][j] !== undefined) row[varName(i, j)] = 1;
      if (Object.keys(row).length > 0 && agentCap !== Infinity) m.addConstraint(row, '<=', agentCap, 'agent_' + spec.agents[i]);
    }
    const requireEvery = spec.requireEveryTask !== false;
    for (let j = 0; j < spec.tasks.length; j++) {
      const row = {};
      for (let i = 0; i < spec.agents.length; i++)
        if (spec.cost[i][j] !== null && spec.cost[i][j] !== undefined) row[varName(i, j)] = 1;
      if (Object.keys(row).length === 0 && requireEvery) {
        throw new Error(`Assignment task "${spec.tasks[j]}" has no eligible agent/cost entry; a required task cannot be silently omitted.`);
      }
      if (Object.keys(row).length > 0) m.addConstraint(row, requireEvery ? '=' : '<=', 1, 'task_' + spec.tasks[j]);
    }
    return m;
  };

  /**
   * SCHEDULE OPTIMIZATION — shift / crew coverage.
   * "How many workers (or how much of each shift pattern) to schedule so
   * every time period's minimum staffing is met, at minimum total cost."
   * This is the classic staffing-coverage LP/IP at the core of crew and
   * shift scheduling tools. It does NOT model rest-time rules, shift
   * preferences, or multi-day rosters — it's the textbook coverage
   * formulation, meant as a building block you extend with more
   * constraints (via the returned LPModel) for your specific rules.
   *
   *   templates.shiftScheduling({
   *     shifts: [
   *       { name: 'Morning',   cost: 100, covers: ['P1', 'P2'] },
   *       { name: 'Afternoon', cost: 110, covers: ['P2', 'P3'] },
   *       { name: 'Night',     cost: 130, covers: ['P3', 'P4'] },
   *     ],
   *     periods: { P1: 3, P2: 5, P3: 4, P4: 2 },  // minimum staff required per period
   *     integer: true,     // whole workers per shift (recommended)
   *     maxPerShift: Infinity,
   *   })
   */
  templates.shiftScheduling = function shiftScheduling(spec) {
    const m = new LPModel({ sense: 'minimize' });
    const varType = spec.integer === false ? 'continuous' : 'integer';
    for (const shift of spec.shifts) m.addVariable(shift.name, { lb: 0, ub: spec.maxPerShift, type: varType });

    const obj = {};
    for (const shift of spec.shifts) obj[shift.name] = shift.cost;
    m.setObjective(obj);

    const periodKeys = Object.keys(spec.periods);
    for (const p of periodKeys) {
      const row = {};
      for (const shift of spec.shifts) if (shift.covers.includes(p)) row[shift.name] = 1;
      m.addConstraint(row, '>=', spec.periods[p], 'period_' + p);
    }
    return m;
  };

  /**
   * MULTI-PERIOD PRODUCTION / INVENTORY PLANNING — classic lot-sizing LP.
   * "How much to produce each period, given capacity and demand, at
   * minimum total cost of production + holding inventory (+ optionally
   * backlog)." One inventory-balance constraint per period:
   *   inventory[t] = inventory[t-1] + produced[t] - demand[t]  (+ backlog terms if enabled)
   *
   *   templates.productionPlanning({
   *     periods: ['Jan','Feb','Mar'],
   *     demand:       { Jan: 100, Feb: 140, Mar: 90 },
   *     capacity:     { Jan: 120, Feb: 120, Mar: 120 },     // max produced per period (optional, default Infinity)
   *     productionCost: { Jan: 10, Feb: 10, Mar: 11 },      // cost per unit produced (optional per-period; or a single number for all)
   *     holdingCost: 1.5,                                    // cost per unit of ending inventory, per period (number or per-period object)
   *     initialInventory: 20,
   *     finalInventory: { min: 0 },                          // optional floor/ceiling on ending inventory of the last period
   *     allowBacklog: false,                                 // if true, demand can be met late at backlogCost per unit per period short
   *     backlogCost: 5,
   *     integer: false,
   *   })
   *
   * Returns a model with variables `produce_<period>`, `inventory_<period>`
   * (and `backlog_<period>` if allowBacklog), and one `balance_<period>`
   * constraint per period.
   */
  templates.productionPlanning = function productionPlanning(spec) {
    const periods = spec.periods;
    const varType = spec.integer ? 'integer' : 'continuous';
    const m = new LPModel({ sense: 'minimize' });

    // Cost/demand fields default a missing period to 0 (sensible: no cost, no demand).
    const perPeriod = (v, p) => (typeof v === 'object' && v !== null ? (v[p] === undefined ? 0 : v[p]) : (v || 0));
    // Capacity defaults a missing period (or an entirely omitted spec.capacity) to
    // Infinity (uncapped) — 0 would silently forbid production, which is never what's meant.
    const perPeriodCap = (v, p) => {
      if (v === undefined) return Infinity;
      if (typeof v === 'object' && v !== null) return v[p] === undefined ? Infinity : v[p];
      return v;
    };

    for (const p of periods) {
      m.addVariable('produce_' + p, { lb: 0, ub: perPeriodCap(spec.capacity, p), type: varType });
      m.addVariable('inventory_' + p, { lb: 0, type: varType });
      if (spec.allowBacklog) m.addVariable('backlog_' + p, { lb: 0, type: varType });
    }

    const obj = {};
    periods.forEach((p) => {
      const pc = spec.productionCost === undefined ? 0 : perPeriod(spec.productionCost, p);
      const hc = spec.holdingCost === undefined ? 0 : perPeriod(spec.holdingCost, p);
      if (pc) obj['produce_' + p] = pc;
      if (hc) obj['inventory_' + p] = hc;
      if (spec.allowBacklog) {
        const bc = spec.backlogCost === undefined ? 0 : perPeriod(spec.backlogCost, p);
        if (bc) obj['backlog_' + p] = bc;
      }
    });
    m.setObjective(obj);

    let prevInvVar = null;
    const initialInventory = spec.initialInventory || 0;
    periods.forEach((p, idx) => {
      // inventory[t] - inventory[t-1] - produce[t] (+ backlog[t] - backlog[t-1]) = -demand[t] + initial(if t=0)
      const row = { ['inventory_' + p]: 1, ['produce_' + p]: -1 };
      if (prevInvVar) row[prevInvVar] = -1;
      if (spec.allowBacklog) {
        row['backlog_' + p] = -1;
        if (idx > 0) row['backlog_' + periods[idx - 1]] = 1;
      }
      const demand = perPeriod(spec.demand, p);
      const rhs = idx === 0 ? (-demand + initialInventory) : -demand;
      m.addConstraint(row, '=', rhs, 'balance_' + p);
      prevInvVar = 'inventory_' + p;
    });

    if (spec.finalInventory) {
      const lastInv = 'inventory_' + periods[periods.length - 1];
      if (spec.finalInventory.min !== undefined) m.addConstraint({ [lastInv]: 1 }, '>=', spec.finalInventory.min, 'final_inventory_min');
      if (spec.finalInventory.max !== undefined) m.addConstraint({ [lastInv]: 1 }, '<=', spec.finalInventory.max, 'final_inventory_max');
      if (spec.finalInventory.equal !== undefined) m.addConstraint({ [lastInv]: 1 }, '=', spec.finalInventory.equal, 'final_inventory_eq');
    }

    return m;
  };

  // ───────────────────────────────────────────────────────────────────────
  // Lexicographic multi-objective optimization
  //
  // Solves a priority-ordered list of objectives on the SAME model: solve
  // for priority 1, lock its optimal value in as a constraint (within
  // `tolerance`), solve for priority 2 subject to that lock, and so on.
  // This is the standard "goal programming" / lexicographic approach —
  // there is no single-pass way to do this that isn't a specific weighted
  // combination the modeler would have to guess at, so this sequential
  // re-solve is what real MIP tools (including ILOG) do for this feature.
  //
  // NOTE: this MUTATES the model you pass in (adds one lock constraint per
  // priority level beyond the first, and leaves .sense/.objective set to
  // the last priority solved). Pass a model you don't need pristine
  // afterward, or rebuild it if you need to solve it again from scratch.
  // ───────────────────────────────────────────────────────────────────────

  function solveLexicographic(model, objectives, options) {
    options = options || {};
    const tol = options.tolerance !== undefined ? options.tolerance : 1e-6;
    const achieved = [];
    const lockNames = [];
    let lastResult = null;

    for (let i = 0; i < objectives.length; i++) {
      const ob = objectives[i];
      if (ob.sense !== 'minimize' && ob.sense !== 'maximize') {
        throw new Error(`solveLexicographic: objectives[${i}].sense must be 'minimize' or 'maximize'`);
      }
      model.setSense(ob.sense);
      model.setObjective(ob.coeffs, ob.constant || 0);
      const result = model.solve(options.solveOptions);
      if (result.status !== 'optimal') {
        return { status: result.status, failedAtPriority: i, failedObjective: ob.name || ('priority_' + (i + 1)), objectivesAchieved: achieved };
      }
      if (result.optimal === false) {
        return { status: 'not_proven_optimal', failedAtPriority: i, failedObjective: ob.name || ('priority_' + (i + 1)), objectivesAchieved: achieved, incumbentObjective: result.objective, bestBound: result.bestBound, mipGapRelative: result.mipGapRelative, message: 'A higher-priority MIP objective was not proven optimal, so it was not locked for the next lexicographic priority.' };
      }
      achieved.push({ name: ob.name || ('priority_' + (i + 1)), sense: ob.sense, objective: result.objective });
      lastResult = result;

      if (i < objectives.length - 1) {
        const lockName = '__lex_lock_p' + (i + 1) + (ob.name ? '_' + ob.name : '');
        const boundVal = result.objective - (ob.constant || 0);
        if (ob.sense === 'minimize') {
          model.addConstraint(ob.coeffs, '<=', boundVal + tol, lockName);
        } else {
          model.addConstraint(ob.coeffs, '>=', boundVal - tol, lockName);
        }
        lockNames.push(lockName);
      }
    }

    return {
      status: 'optimal',
      objectivesAchieved: achieved,
      variables: lastResult.variables,
      finalObjective: lastResult.objective,
      lockConstraintsAdded: lockNames,
      note: 'Each higher-priority objective\'s optimal value was locked in (within tolerance) as a constraint before optimizing the next. The model passed in has been mutated with these lock constraints; rebuild it if you need to solve it again from scratch.',
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Infeasibility diagnosis — deletion-filter Irreducible Infeasible
  // Subset (IIS): given an infeasible model, find a minimal set of
  // constraints such that (a) together they are infeasible, and (b)
  // removing ANY single one of them makes the rest feasible. That minimal
  // set is exactly "the constraints causing the conflict" — everything
  // else in the model is provably not part of why it's infeasible.
  //
  // Algorithm: standard deletion filter. Walk the constraints in order;
  // for each one, test whether the model is still infeasible with it
  // removed. If yes, that constraint wasn't needed for the infeasibility —
  // drop it for good. If no (removing it fixes things), it's essential —
  // keep it. What survives the full pass is an IIS. Cost: one solve per
  // constraint (feasibility-only, zero objective), so this is intended for
  // the sizes this engine already targets (tens to low hundreds of
  // constraints), not enormous models.
  //
  // Variable bounds (lb/ub) are NOT part of the returned conflict set even
  // though they can also be a root cause — if the working set empties out
  // and the model is still reported infeasible, the message says to check
  // variable bounds directly.
  // ───────────────────────────────────────────────────────────────────────

  function diagnoseInfeasibility(model, options) {
    options = options || {};
    const solveOpts = {
      nodeLimit: options.nodeLimit !== undefined ? options.nodeLimit : 5000,
      timeLimitMs: options.timeLimitMs !== undefined ? options.timeLimitMs : 3000,
    };

    function infeasibleWith(consList) {
      const tmp = new LPModel({ sense: 'minimize' });
      model.variables.forEach((v) => tmp.addVariable(v.name, { lb: v.lb, ub: v.ub, type: v.type }));
      consList.forEach((c) => {
        const obj = {};
        for (const [idx, coef] of c.coeffs) obj[model.variables[idx].name] = coef;
        tmp.addConstraint(obj, c.sense, c.rhs, c.name);
      });
      tmp.setObjective({});
      const r = tmp.solve(solveOpts);
      if (r.status === 'infeasible') return true;
      if (r.status === 'no_feasible_found_within_limits' || r.status === 'unbounded_relaxation' || r.status === 'iteration_limit') return null;
      return false;
    }

    const all = model.constraints.slice();
    const initialState = infeasibleWith(all);
    if (initialState === null) {
      return { infeasible: null, status: 'undetermined', message: 'Feasibility could not be proven within the diagnostic limits; no IIS claim has been made.' };
    }
    if (!initialState) {
      return { infeasible: false, message: 'Model is feasible as given — no conflicting constraints to diagnose.' };
    }

    let working = all.slice();
    for (const c of all) {
      const idx = working.indexOf(c);
      if (idx === -1) continue;
      const trial = working.slice(0, idx).concat(working.slice(idx + 1));
      const state = infeasibleWith(trial);
      if (state === null) {
        return { infeasible: true, status: 'undetermined_during_filter', conflictingConstraints: working.map((x) => x.name), message: 'The model is proven infeasible, but the deletion filter hit a solve limit; the returned set is a conflict superset, not a proven IIS.' };
      }
      if (state) working = trial;
    }

    if (working.length === 0) {
      return {
        infeasible: true,
        conflictingConstraints: [],
        message: 'The model is infeasible from variable bounds alone (no combination of named constraints is needed) — check addVariable lb/ub values.',
      };
    }
    return {
      infeasible: true,
      conflictingConstraints: working.map((c) => c.name),
      message: 'These constraints cannot all be satisfied at once — removing any single one of them (with the rest unchanged) would make the model feasible.',
    };
  }

  return {
    LPModel, templates, solveLexicographic, diagnoseInfeasibility,
    VERSION: '2.0.0-aip', _internal: { buildStandardForm, solveStandardForm },
  };
});

