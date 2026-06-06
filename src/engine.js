/* ============================================================================
   ATOLL NAVIGATOR — game engine (pure, framework-free, unit-tested)
   Sliding-maze solver, puzzle generation, the reward economy and the
   multi-team Monte-Carlo simulation all live here. No React, no DOM — this
   module is deliberately importable from both the UI and the test suite.
   ========================================================================== */

export const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
export const DIR_LIST = ["U", "D", "L", "R"];

/* ---------- SLIDING-MAZE SOLVER ---------- */
export function slide(grid, pos, dir, shallows) {
  const N = grid.length, M = grid[0].length;
  const [dr, dc] = DIRS[dir];
  let [r, c] = pos;
  while (true) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= N || nc < 0 || nc >= M) break;
    if (grid[nr][nc] === 1) break;
    r = nr; c = nc;
    if (shallows && grid[nr][nc] === 2) break;
  }
  return [r, c];
}
export const key = (p) => p[0] + "," + p[1];
export function solve(grid, start, target, shallows) {
  const tk = key(target), startK = key(start);
  const dist = { [startK]: 0 }, parents = { [startK]: [] };
  const q = [start]; let edgeCount = 0;
  while (q.length) {
    const cur = q.shift(); const ck = key(cur);
    for (const d of DIR_LIST) {
      const np = slide(grid, cur, d, shallows);
      if (np[0] === cur[0] && np[1] === cur[1]) continue;
      edgeCount++; const nk = key(np);
      if (dist[nk] === undefined) { dist[nk] = dist[ck] + 1; parents[nk] = [{ from: ck, dir: d }]; q.push(np); }
      else if (dist[nk] === dist[ck] + 1) parents[nk].push({ from: ck, dir: d });
    }
  }
  const reachableRest = Object.keys(dist).length;
  const branchingAvg = reachableRest ? edgeCount / reachableRest : 0;
  if (dist[tk] === undefined) return { solvable: false, reachableRest, branchingAvg };
  const seqs = [];
  (function build(n, acc) {
    if (seqs.length > 120) return;
    if (n === startK) { seqs.push([...acc].reverse()); return; }
    for (const p of parents[n]) build(p.from, [...acc, p.dir]);
  })(tk, []);
  const seen = new Set(); const reqMultisets = [];
  seqs.forEach((sq) => { const r = { U: 0, D: 0, L: 0, R: 0 }; sq.forEach((d) => r[d]++); const s = `${r.U}-${r.D}-${r.L}-${r.R}`; if (!seen.has(s)) { seen.add(s); reqMultisets.push(r); } });
  return { solvable: true, optLen: dist[tk], reqMultisets, reachableRest, branchingAvg };
}
export function coverable(req, bank) { let d = 0; for (const x of DIR_LIST) d += Math.max(0, req[x] - (bank[x] || 0)); return d <= (bank.J || 0); }

/* ---------- GENERATION ---------- */
let SEED = 12345;
export function rng() { SEED = (SEED * 1103515245 + 12345) & 0x7fffffff; return SEED / 0x7fffffff; }
export function setSeed(s) { SEED = s >>> 0; }
export const randint = (a, b) => a + Math.floor(rng() * (b - a + 1));
export const ISLAND_DENSITY = 0.14, SHALLOW_DENSITY = 0.08, JOKER_WEIGHT = 0.5;
export const lenBand = (size) => [Math.max(2, size - 3), size + 2];
export function generatePuzzle(size, shallows) {
  const [minLen, maxLen] = lenBand(size);
  for (let a = 0; a < 400; a++) {
    const grid = Array.from({ length: size }, () => Array(size).fill(0));
    const cells = []; for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells.push([r, c]);
    for (let i = 0; i < Math.round(size * size * ISLAND_DENSITY); i++) { const [r, c] = cells[randint(0, cells.length - 1)]; grid[r][c] = 1; }
    if (shallows) for (let i = 0; i < Math.round(size * size * SHALLOW_DENSITY); i++) { const [r, c] = cells[randint(0, cells.length - 1)]; if (grid[r][c] === 0) grid[r][c] = 2; }
    const water = cells.filter(([r, c]) => grid[r][c] === 0);
    if (water.length < 4) continue;
    const start = water[randint(0, water.length - 1)], target = water[randint(0, water.length - 1)];
    if (start[0] === target[0] && start[1] === target[1]) continue;
    const res = solve(grid, start, target, shallows);
    if (!res.solvable || res.optLen < minLen || res.optLen > maxLen) continue;
    return { grid, start, target, ...res, size, shallows };
  }
  return null;
}
export function buildPool(sizes, shallows, K) {
  const pool = {};
  sizes.forEach((sz) => { pool[sz] = []; let g = 0; while (pool[sz].length < K && g < K * 25) { const p = generatePuzzle(sz, shallows); if (p) pool[sz].push(p); g++; } });
  return pool;
}

/* ---------- ECONOMY ---------- */
export const DEFAULT_TABLE = [
  { winds: 1, maps: 0, vp: 0 }, { winds: 1, maps: 0, vp: 0 }, { winds: 2, maps: 0, vp: 0 },
  { winds: 2, maps: 1, vp: 0 }, { winds: 2, maps: 0, vp: 1 }, { winds: 3, maps: 1, vp: 1 },
  { winds: 3, maps: 0, vp: 2 }, { winds: 4, maps: 1, vp: 3 }, { winds: 4, maps: 0, vp: 3 },
  { winds: 5, maps: 1, vp: 4 }, { winds: 5, maps: 0, vp: 5 }, { winds: 6, maps: 1, vp: 6 },
  { winds: 6, maps: 1, vp: 7 },
];
export function lookupRow(table, row) { return table[Math.min(Math.max(row - 1, 0), table.length - 1)]; }
export function getDayBonus(schedule, turn) {
  for (const { upToDay, bonus } of schedule) if (turn <= upToDay) return bonus;
  return schedule[schedule.length - 1]?.bonus ?? 0;
}
export function randType(jokers) {
  const pool = ["U", "D", "L", "R", ...(jokers ? ["J"] : [])];
  const w = pool.map((t) => (t === "J" ? JOKER_WEIGHT : 1)); const tot = w.reduce((a, b) => a + b, 0);
  let x = rng() * tot; for (let k = 0; k < pool.length; k++) { x -= w[k]; if (x <= 0) return pool[k]; } return "U";
}

/* ---------- TEAM SIMULATION (for stats) ---------- */
export function simulateTeam(eco, pool, settings) {
  const bank = { U: 0, D: 0, L: 0, R: 0, J: 0 }; let held = [], vp = 0, solved = 0;
  const perTurn = [], heldOverTime = [];
  let turnsStuck = 0, cascadeTotal = 0, oceanWindsTotal = 0, oceanMapsTotal = 0, oceanVPtotal = 0, puzzleWindsTotal = 0, puzzleVPtotal = 0;

  function pickSize() {
    const sizes = settings.sizes.filter((sz) => (eco.mapStackSplit[sz] ?? 0) > 0);
    if (!sizes.length) return settings.sizes[0] ?? 5;
    const ws = sizes.map((sz) => eco.mapStackSplit[sz]); const tot = ws.reduce((a, b) => a + b, 0);
    let x = rng() * tot; for (let i = 0; i < sizes.length; i++) { x -= ws[i]; if (x <= 0) return sizes[i]; } return sizes[0];
  }
  function drawAtoll() { const sz = pickSize(); const arr = pool[sz]; return arr?.length ? arr[randint(0, arr.length - 1)] : null; }

  function grant(row, isOcean) {
    const r = lookupRow(eco.table, row);
    for (let i = 0; i < r.winds; i++) bank[randType(settings.jokers)]++;
    vp += r.vp;
    if (isOcean) { oceanWindsTotal += r.winds; oceanMapsTotal += r.maps; oceanVPtotal += r.vp; }
    else { puzzleWindsTotal += r.winds; puzzleVPtotal += r.vp; }
    if (r.maps) { const a = drawAtoll(); if (a) held.push(a); }
    return r;
  }

  for (let turn = 1; turn <= eco.turnsPerGame; turn++) {
    const dayBonus = getDayBonus(eco.dayBonusSchedule, turn);
    for (let t = 0; t < eco.tilesPerTurn; t++) {
      const base = randint(eco.oceanBaseMin, eco.oceanBaseMax);
      grant(base + dayBonus + eco.promotion, true);
    }
    let submitted = 0, prog = true;
    while (prog && submitted < eco.submissionCap) {
      prog = false; held.sort((a, b) => a.optLen - b.optLen);
      for (let i = 0; i < held.length; i++) {
        const p = held[i]; const f = p.reqMultisets.find((r) => coverable(r, bank));
        if (f) {
          let jU = 0; for (const d of DIR_LIST) { const pay = Math.min(f[d], bank[d]); bank[d] -= pay; jU += f[d] - pay; } bank.J -= jU;
          held.splice(i, 1); solved++; submitted++;
          const r = grant((eco.puzzleBaseRows[p.size] ?? 5) + eco.promotion, false);
          if (r.maps) cascadeTotal++;
          prog = true; break;
        }
      }
    }
    if (held.length > 0 && !held.some((p) => p.reqMultisets.some((r) => coverable(r, bank)))) turnsStuck++;
    heldOverTime.push(held.length);
    perTurn.push(vp);
  }
  const lw = bank.U + bank.D + bank.L + bank.R + bank.J;
  return { vp, solved, leftoverWinds: lw, heldLeft: held.length, totalValue: vp * 10 + lw,
    perTurn, heldOverTime, turnsStuck, cascadeTotal,
    oceanWindsTotal, oceanMapsTotal, oceanVPtotal, puzzleWindsTotal, puzzleVPtotal };
}
