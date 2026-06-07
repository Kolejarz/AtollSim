/* ============================================================================
   Unit tests for the Atoll Navigator engine.
   Run with:  npm test   (uses Node's built-in test runner, no deps needed)
   ========================================================================== */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  slide, key, solve, coverable,
  rng, setSeed, randint, lenBand, generatePuzzle, buildPool,
  DEFAULT_TABLE, lookupRow, getDayBonus, randType,
  simulateTeam, DIR_LIST,
} from "../src/engine.js";

/* helper grids: 0 = water, 1 = island, 2 = shallow */
const water = (n) => Array.from({ length: n }, () => Array(n).fill(0));

/* ---------------------------------------------------------------- slide --- */
describe("slide", () => {
  test("runs to the map edge across open water", () => {
    const g = water(5);
    assert.deepEqual(slide(g, [2, 2], "U", false), [0, 2]);
    assert.deepEqual(slide(g, [2, 2], "D", false), [4, 2]);
    assert.deepEqual(slide(g, [2, 2], "L", false), [2, 0]);
    assert.deepEqual(slide(g, [2, 2], "R", false), [2, 4]);
  });

  test("stops on the tile just before an island", () => {
    const g = water(5);
    g[0][2] = 1; // island at top of column 2
    assert.deepEqual(slide(g, [4, 2], "U", false), [1, 2]);
  });

  test("a wind into a wall burns but does not move the ship", () => {
    const g = water(5);
    assert.deepEqual(slide(g, [0, 2], "U", false), [0, 2]);
  });

  test("shallows brake the ship only when the shallows flag is on", () => {
    const g = water(5);
    g[1][2] = 2; // shallow tile mid-column
    // shallows off: glides straight over the shallow to the edge
    assert.deepEqual(slide(g, [4, 2], "U", false), [0, 2]);
    // shallows on: stops on the shallow tile, momentum lost
    assert.deepEqual(slide(g, [4, 2], "U", true), [1, 2]);
  });
});

/* ----------------------------------------------------------------- key ---- */
describe("key", () => {
  test("serialises a position to a stable string", () => {
    assert.equal(key([3, 7]), "3,7");
    assert.equal(key([0, 0]), "0,0");
  });
});

/* --------------------------------------------------------------- solve ---- */
describe("solve", () => {
  test("finds the optimal length and required wind multisets", () => {
    const g = water(3); // open 3x3, start corner, target opposite corner
    const res = solve(g, [0, 0], [2, 2], false);
    assert.equal(res.solvable, true);
    assert.equal(res.optLen, 2); // e.g. Down then Right
    // both optimal routes use one D and one R, so a single deduped multiset
    assert.equal(res.reqMultisets.length, 1);
    assert.deepEqual(res.reqMultisets[0], { U: 0, D: 1, L: 0, R: 1 });
  });

  test("reports unsolvable when the target can never be a resting tile", () => {
    const g = water(3); // centre of an all-water board is always passed over
    const res = solve(g, [0, 0], [1, 1], false);
    assert.equal(res.solvable, false);
    assert.ok(res.reachableRest > 0);
    assert.equal(res.optLen, undefined);
  });

  test("every required multiset sums to the optimal length", () => {
    setSeed(17);
    const p = generatePuzzle(6, false); // a known-solvable generated grid
    const res = solve(p.grid, p.start, p.target, p.shallows);
    assert.equal(res.solvable, true);
    assert.ok(res.reqMultisets.length >= 1);
    for (const req of res.reqMultisets) {
      const total = req.U + req.D + req.L + req.R;
      assert.equal(total, res.optLen);
    }
  });
});

/* ------------------------------------------------------------ coverable --- */
describe("coverable", () => {
  const req = { U: 1, D: 0, L: 2, R: 0 };
  test("true when the bank holds every needed direction", () => {
    assert.equal(coverable(req, { U: 1, D: 0, L: 2, R: 0, J: 0 }), true);
  });
  test("jokers fill the gaps", () => {
    assert.equal(coverable(req, { U: 1, D: 0, L: 0, R: 0, J: 2 }), true);
  });
  test("false when even jokers cannot cover the deficit", () => {
    assert.equal(coverable(req, { U: 0, D: 0, L: 0, R: 0, J: 2 }), false);
  });
});

/* ----------------------------------------------------------------- rng ---- */
describe("rng / setSeed / randint", () => {
  test("the same seed reproduces the same stream", () => {
    setSeed(42);
    const a = [rng(), rng(), rng()];
    setSeed(42);
    const b = [rng(), rng(), rng()];
    assert.deepEqual(a, b);
  });

  test("different seeds diverge", () => {
    setSeed(1); const a = rng();
    setSeed(2); const b = rng();
    assert.notEqual(a, b);
  });

  test("rng stays within [0, 1)", () => {
    setSeed(7);
    for (let i = 0; i < 200; i++) { const x = rng(); assert.ok(x >= 0 && x < 1); }
  });

  test("randint is inclusive on both bounds", () => {
    setSeed(123);
    let lo = false, hi = false;
    for (let i = 0; i < 500; i++) {
      const v = randint(3, 5);
      assert.ok(v >= 3 && v <= 5);
      assert.ok(Number.isInteger(v));
      if (v === 3) lo = true;
      if (v === 5) hi = true;
    }
    assert.ok(lo && hi, "both endpoints should be hit over many draws");
  });

  test("randint(n, n) always returns n", () => {
    setSeed(9);
    for (let i = 0; i < 20; i++) assert.equal(randint(4, 4), 4);
  });
});

/* --------------------------------------------------------------- lenBand -- */
describe("lenBand", () => {
  test("defaults widen with size but never drops below 2", () => {
    assert.deepEqual(lenBand(5), [2, 7]);
    assert.deepEqual(lenBand(6), [3, 8]);
    assert.deepEqual(lenBand(7), [4, 9]);
    assert.deepEqual(lenBand(4), [2, 6]);
  });
  test("uses moveBands config when provided", () => {
    const bands = { 5: [3, 6], 6: [5, 8], 7: [6, 9] };
    assert.deepEqual(lenBand(5, bands), [3, 6]);
    assert.deepEqual(lenBand(6, bands), [5, 8]);
    assert.deepEqual(lenBand(7, bands), [6, 9]);
  });
  test("falls back to formula for unconfigured sizes", () => {
    const bands = { 5: [3, 6] };
    assert.deepEqual(lenBand(7, bands), [4, 9]);
  });
});

/* --------------------------------------------------------- lookupRow ------ */
describe("lookupRow", () => {
  test("maps a 1-based row to the right entry", () => {
    assert.deepEqual(lookupRow(DEFAULT_TABLE, 1), DEFAULT_TABLE[0]);
    assert.deepEqual(lookupRow(DEFAULT_TABLE, 5), DEFAULT_TABLE[4]);
  });
  test("clamps below the first row", () => {
    assert.deepEqual(lookupRow(DEFAULT_TABLE, 0), DEFAULT_TABLE[0]);
    assert.deepEqual(lookupRow(DEFAULT_TABLE, -3), DEFAULT_TABLE[0]);
  });
  test("clamps above the last row", () => {
    const last = DEFAULT_TABLE[DEFAULT_TABLE.length - 1];
    assert.deepEqual(lookupRow(DEFAULT_TABLE, 13), last);
    assert.deepEqual(lookupRow(DEFAULT_TABLE, 99), last);
  });
});

/* -------------------------------------------------------- getDayBonus ----- */
describe("getDayBonus", () => {
  const schedule = [
    { upToDay: 4, bonus: 0 },
    { upToDay: 8, bonus: 2 },
    { upToDay: 10, bonus: 4 },
  ];
  test("slides the window up as days pass", () => {
    assert.equal(getDayBonus(schedule, 1), 0);
    assert.equal(getDayBonus(schedule, 4), 0);
    assert.equal(getDayBonus(schedule, 5), 2);
    assert.equal(getDayBonus(schedule, 8), 2);
    assert.equal(getDayBonus(schedule, 9), 4);
    assert.equal(getDayBonus(schedule, 10), 4);
  });
  test("days past the last threshold keep the final bonus", () => {
    assert.equal(getDayBonus(schedule, 11), 4);
    assert.equal(getDayBonus(schedule, 999), 4);
  });
});

/* ---------------------------------------------------------- randType ------ */
describe("randType", () => {
  test("never yields a Joker when jokers are disabled", () => {
    setSeed(55);
    for (let i = 0; i < 500; i++) {
      const t = randType(false);
      assert.ok(["U", "D", "L", "R"].includes(t));
    }
  });
  test("can yield a Joker when jokers are enabled", () => {
    setSeed(55);
    let sawJoker = false;
    for (let i = 0; i < 1000; i++) if (randType(true) === "J") { sawJoker = true; break; }
    assert.ok(sawJoker);
  });
  test("is deterministic for a fixed seed", () => {
    setSeed(2024);
    const a = Array.from({ length: 10 }, () => randType(true));
    setSeed(2024);
    const b = Array.from({ length: 10 }, () => randType(true));
    assert.deepEqual(a, b);
  });
});

/* ------------------------------------------------------ generatePuzzle ---- */
describe("generatePuzzle", () => {
  test("produces a solvable puzzle inside its length band", () => {
    setSeed(1);
    const p = generatePuzzle(5, false);
    assert.ok(p, "a puzzle should be generated");
    assert.equal(p.size, 5);
    assert.equal(p.solvable, true);
    const [lo, hi] = lenBand(5);
    assert.ok(p.optLen >= lo && p.optLen <= hi);
    assert.notDeepEqual(p.start, p.target);
    assert.ok(p.reqMultisets.length >= 1);
    // the grid is square and only holds known cell codes
    assert.equal(p.grid.length, 5);
    for (const row of p.grid) {
      assert.equal(row.length, 5);
      for (const cell of row) assert.ok([0, 1, 2].includes(cell));
    }
  });

  test("re-solving the generated grid confirms the reported optimum", () => {
    setSeed(3);
    const p = generatePuzzle(6, false);
    assert.ok(p);
    const res = solve(p.grid, p.start, p.target, p.shallows);
    assert.equal(res.solvable, true);
    assert.equal(res.optLen, p.optLen);
  });

  test("is deterministic for a fixed seed", () => {
    setSeed(99);
    const a = generatePuzzle(5, false);
    setSeed(99);
    const b = generatePuzzle(5, false);
    assert.deepEqual(a.start, b.start);
    assert.deepEqual(a.target, b.target);
    assert.equal(a.optLen, b.optLen);
  });
});

/* ---------------------------------------------------------- buildPool ----- */
describe("buildPool", () => {
  test("fills a pool per requested size with solvable puzzles", () => {
    setSeed(10);
    const pool = buildPool([5, 6], false, 4);
    for (const sz of [5, 6]) {
      assert.ok(Array.isArray(pool[sz]));
      assert.ok(pool[sz].length > 0 && pool[sz].length <= 4);
      for (const p of pool[sz]) {
        assert.equal(p.size, sz);
        assert.equal(p.solvable, true);
      }
    }
  });
});

/* -------------------------------------------------------- simulateTeam ---- */
describe("simulateTeam", () => {
  const settings = { sizes: [5], shallows: false, jokers: true };
  const eco = {
    table: DEFAULT_TABLE,
    tilesPerTurn: 3, turnsPerGame: 10, numTeams: 12,
    oceanBaseMin: 1, oceanBaseMax: 6,
    dayBonusSchedule: [
      { upToDay: 4, bonus: 0 },
      { upToDay: 8, bonus: 2 },
      { upToDay: 10, bonus: 4 },
    ],
    puzzleBaseRows: { 5: 5 },
    mapStackSplit: { 5: 100 },
    submissionCap: 2,
    promotion: 0,
  };

  const makePool = () => { setSeed(2222); return buildPool([5], false, 20); };

  test("returns the full result shape with correctly sized time series", () => {
    const pool = makePool();
    setSeed(500);
    const r = simulateTeam(eco, pool, settings);
    for (const k of ["vp", "solved", "leftoverWinds", "heldLeft", "totalValue",
      "perTurn", "heldOverTime", "turnsStuck", "cascadeTotal",
      "oceanWindsTotal", "oceanMapsTotal", "oceanVPtotal",
      "puzzleWindsTotal", "puzzleVPtotal"]) {
      assert.ok(k in r, `result is missing key ${k}`);
    }
    assert.equal(r.perTurn.length, eco.turnsPerGame);
    assert.equal(r.heldOverTime.length, eco.turnsPerGame);
    assert.ok(r.vp >= 0 && r.solved >= 0 && r.leftoverWinds >= 0);
    // perTurn VP is monotonically non-decreasing (points are never lost)
    for (let i = 1; i < r.perTurn.length; i++) {
      assert.ok(r.perTurn[i] >= r.perTurn[i - 1]);
    }
    // totalValue is defined as vp*10 + leftover winds
    assert.equal(r.totalValue, r.vp * 10 + r.leftoverWinds);
  });

  test("is deterministic for a fixed seed and pool", () => {
    const pool = makePool();
    setSeed(777);
    const a = simulateTeam(eco, pool, settings);
    setSeed(777);
    const b = simulateTeam(eco, pool, settings);
    assert.equal(a.vp, b.vp);
    assert.equal(a.solved, b.solved);
    assert.deepEqual(a.perTurn, b.perTurn);
  });

  test("respects the submission cap per turn", () => {
    const pool = makePool();
    setSeed(13);
    // solved across the whole game can never exceed cap * turns
    const r = simulateTeam(eco, pool, settings);
    assert.ok(r.solved <= eco.submissionCap * eco.turnsPerGame);
  });
});

/* ------------------------------------------------------------- exports ---- */
describe("module surface", () => {
  test("DIR_LIST holds the four cardinal winds", () => {
    assert.deepEqual([...DIR_LIST].sort(), ["D", "L", "R", "U"]);
  });
  test("DEFAULT_TABLE is the documented 13-row table", () => {
    assert.equal(DEFAULT_TABLE.length, 13);
    assert.deepEqual(DEFAULT_TABLE[0], { winds: 1, maps: 0, vp: 0 });
    assert.deepEqual(DEFAULT_TABLE[12], { winds: 6, maps: 1, vp: 7 });
    for (const row of DEFAULT_TABLE) {
      assert.ok(row.winds >= 1);
      assert.ok(row.maps === 0 || row.maps === 1);
      assert.ok(row.vp >= 0);
    }
  });
});
