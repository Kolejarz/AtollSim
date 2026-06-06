import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from "recharts";

/* ============================================================================
   ATOLL NAVIGATOR — economy-driven sliding-maze game (PL/EN)
   Ocean moves and atoll completions draw rewards from a configurable economy
   table (tiers). Winds fuel atolls; solving atolls yields more rewards.
   ========================================================================== */

const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
const DIR_LIST = ["U", "D", "L", "R"];
const ARROW = { U: "↑", D: "↓", L: "←", R: "→", J: "✦" };
const TYPE_ORDER = { U: 0, D: 1, L: 2, R: 3, J: 4 };
const TIER_LABELS = ["I", "II", "III"];

/* ---------- ENGINE (unit-tested) ---------- */
function slide(grid, pos, dir, shallows) {
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
const key = (p) => p[0] + "," + p[1];
function solve(grid, start, target, shallows) {
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
function coverable(req, bank) { let d = 0; for (const x of DIR_LIST) d += Math.max(0, req[x] - (bank[x] || 0)); return d <= (bank.J || 0); }

/* ---------- GENERATION ---------- */
let SEED = 12345;
function rng() { SEED = (SEED * 1103515245 + 12345) & 0x7fffffff; return SEED / 0x7fffffff; }
function setSeed(s) { SEED = s >>> 0; }
const randint = (a, b) => a + Math.floor(rng() * (b - a + 1));
const ISLAND_DENSITY = 0.14, SHALLOW_DENSITY = 0.08, JOKER_WEIGHT = 0.5;
const lenBand = (size) => [Math.max(2, size - 3), size + 2];
function generatePuzzle(size, shallows) {
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
function buildPool(sizes, shallows, K) {
  const pool = {};
  sizes.forEach((sz) => { pool[sz] = []; let g = 0; while (pool[sz].length < K && g < K * 25) { const p = generatePuzzle(sz, shallows); if (p) pool[sz].push(p); g++; } });
  return pool;
}

/* ---------- ECONOMY ---------- */
const DEFAULT_TABLE = [
  { winds: 1, maps: 0, vp: 0 }, { winds: 1, maps: 0, vp: 0 }, { winds: 2, maps: 0, vp: 0 },
  { winds: 2, maps: 1, vp: 0 }, { winds: 2, maps: 0, vp: 1 }, { winds: 3, maps: 1, vp: 1 },
  { winds: 3, maps: 0, vp: 2 }, { winds: 4, maps: 1, vp: 3 }, { winds: 4, maps: 0, vp: 3 },
  { winds: 5, maps: 1, vp: 4 }, { winds: 5, maps: 0, vp: 5 }, { winds: 6, maps: 1, vp: 6 },
  { winds: 6, maps: 1, vp: 7 },
];
function lookupRow(table, row) { return table[Math.min(Math.max(row - 1, 0), table.length - 1)]; }
function getDayBonus(schedule, turn) {
  for (const { upToDay, bonus } of schedule) if (turn <= upToDay) return bonus;
  return schedule[schedule.length - 1]?.bonus ?? 0;
}
function randType(jokers) {
  const pool = ["U", "D", "L", "R", ...(jokers ? ["J"] : [])];
  const w = pool.map((t) => (t === "J" ? JOKER_WEIGHT : 1)); const tot = w.reduce((a, b) => a + b, 0);
  let x = rng() * tot; for (let k = 0; k < pool.length; k++) { x -= w[k]; if (x <= 0) return pool[k]; } return "U";
}

/* ---------- TEAM SIMULATION (for stats) ---------- */
function simulateTeam(eco, pool, settings) {
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

/* ============================================================================
   I18N
   ========================================================================== */
const STR = {
  en: {
    sub: "sliding-maze game · economy simulator",
    tabs: { rules: "Rules", economy: "Economy", play: "Play", stats: "Statistics" },
    // rules
    rSailTitle: "How an atoll is sailed",
    rSail: "Your ship floats on a grid of open water studded with islands. You never move one tile at a time — you call a wind, and the ship runs in that direction until something halts it:",
    rEdge: "the edge of the map — the ship stops on the last tile;",
    rIsland: "an island — the ship stops on the tile just before it, since it can't sail onto land;",
    rShallow: "shallows — the ship glides onto the shallow tile and stops there, its momentum lost.",
    rTarget: (sh) => `The target ✕ is just open water to the ship — it glides straight over it. To win, the ship must come to rest exactly on ✕, using an edge, an island${sh ? ", or a shallow" : ""} as the brake. Arranging that stop is the whole puzzle.`,
    rBurn: "Even a wind that shoves the ship into a wall is spent — the ship doesn't move, but the wind is gone. Plan the full route before committing.",
    rFlowTitle: "The flow of a game",
    rFlow1: "Each turn a crew makes a few Ocean moves. Every Ocean move draws a reward from the economy table — always at least one wind, and sometimes an atoll map or victory points.",
    rFlow2: "Winds gather in one shared bank. Drag winds onto an atoll to plan its solution; nothing is spent until you press Sail.",
    rFlow3: "Sailing commits the winds. Reach ✕ and the atoll is cleared from play and pays out its own reward (more winds, fresh maps, victory points) — the deeper the atoll, the richer the tier. Miss, and the winds are lost but the atoll stays.",
    rFlow4: "Victory points are the score. Most of them come from solving atolls, so the real game is deciding which maps to chase with your scarce winds.",
    rJokerOn: "A Joker ✦ is a wild wind: drag it onto an atoll, then click it to aim it ↑ ↓ ← →. Returned to the bank it becomes ✦ again.",
    setTitle: "Generation",
    setSizes: "Atoll sizes in play", setShallows: "Enable shallow waters", setJokers: "Enable Joker winds",
    setSizesHint: "Atoll maps of these sizes appear at random. Bigger atolls map to richer reward tiers.",
    // economy
    ecoIntro: "Everything a crew can earn is defined here. Reward draws are grouped into three tiers; Ocean moves and atoll completions each pull from a tier.",
    ecoValTitle: "Resource values",
    ecoValDesc: "Used to rank crews on a single scale. One wind = 1 point by definition; set the rest relative to that.",
    lblWindValue: "Wind value", lblMapValue: "Atoll map value", lblVpValue: "Victory point value",
    ecoTierTitle: "Reward tiers",
    ecoTierDesc: "A draw from a tier gives that many winds (±1, min 1), an atoll map with the listed chance, and the listed victory points.",
    thTier: "tier", thWinds: "winds", thMapChance: "map chance", thVP: "victory pts",
    ecoOceanTitle: "Ocean move draw weights",
    ecoOceanDesc: "Relative chance that a single Ocean move pulls from each tier. Weight the early tiers higher for a gentle ramp.",
    ecoCompTitle: "Atoll completion tier (by size)",
    ecoCompDesc: "Which tier a solved atoll pays out from. Bigger atolls should sit in richer tiers.",
    ecoTurnTitle: "Turn structure",
    lblMoves: "Ocean moves per turn", lblTurns: "Turns per game", lblTeams: "Teams (for simulation)",
    // play
    pTurn: "Turn", pOf: "of", pMovesLeft: "moves left", pVP: "VP", pWinds: "winds", pMaps: "maps in play",
    pOcean: "Sail the Ocean", pEndTurn: "End turn", pReset: "New game", pOver: "Game over — press New game.",
    pBankTitle: "Wind bank", pBankDesc: "Drag a wind onto an atoll to plan; drag it back to free it. Click a wind to send it to the selected atoll.",
    pAtolls: "Atolls in play", pEmpty: "No atoll maps yet — make Ocean moves until one is drawn.",
    pOpt: "opt", pTier: "tier", pAssignHint: "drag winds here", pSail: "Sail", pPress: "Press ▷ Sail to commit.",
    pWin: (m, o) => `✓ Reached X in ${m} (opt ${o}).`, pMiss: (m) => `✗ Missed after ${m}. Winds lost; atoll stays.`,
    pLogTitle: "Decision log", pLogEmpty: "Actions and rewards will appear here.",
    logOcean: "Ocean move", logSolve: (s) => `Solved ${s}×${s}`, logFail: (s) => `Failed ${s}×${s} — winds lost`,
    tWind: (n) => `+${n} wind`, tMap: "+map", tVP: (n) => `+${n} VP`,
    legWater: "water", legIsland: "island", legShallow: "shallow", legX: "✕ target",
    // stats
    sTitle: "Multi-team simulation",
    sDesc: (n, t, m) => `${n} teams play ${t} turns of ${m} Ocean moves each, then greedily solve every atoll their bank can afford. Re-run to resample the luck.`,
    sRun: "↻ Re-run",
    kAvgVP: "Avg victory points", kAvgSolved: "Avg atolls solved", kAvgValue: "Avg total value", kFair: "Fairness (luck spread)",
    sTeamsTitle: "Final victory points per team", sTeamsDesc: "Sorted low → high. A steep slope means luck decides the winner; a flat one means crews finish close together.",
    sProgTitle: "Average victory points per turn", sProgDesc: "How fast the average crew accumulates points across the game.",
    sFairOk: (x) => `✓ Spread is moderate (top/bottom ≈ ${x}×) — luck matters but skill can close the gap.`,
    sFairWarn: (x) => `⚠ Top crew scores ≈ ${x}× the bottom. Outcomes are luck-dominated — widen row gaps or raise tiles per turn.`,
    sProgX: "turn", sProgY: "avg VP",
    sCascade: "Avg cascade maps", sWindScarcity: "Wind scarcity",
    sWindStuckDesc: (p) => `${p}% of turns a team cannot attempt any atoll — winds don't match any held puzzle.`,
    sEcoSummaryTitle: "Economy summary (per team avg)",
    kOceanWinds: "Ocean winds", kOceanMaps: "Ocean maps", kOceanVP: "Ocean VP",
    kPuzzleWinds: "Puzzle winds", kPuzzleVP: "Puzzle VP", kLeftover: "Leftover winds",
    sMapBacklogTitle: "Map backlog over time", sMapBacklogDesc: "Average unsolved maps held per turn. High values mean teams are drowning; low means maps are scarce.",
    sMapBacklogX: "turn", sMapBacklogY: "avg maps held",
    ecoTableTitle: "Reward table", ecoTableDesc: "One universal lookup. Every ocean tile and every solved atoll maps to a row; the row determines the reward.",
    ecoDayTitle: "Day bonus schedule", ecoDayDesc: "Bonus added to each tile's base roll (1–6) based on the current day (turn). Ramps rewards as camp progresses.",
    ecoPuzzleTitle: "Puzzle base rows (by size)", ecoPuzzleDesc: "Which row a solved atoll draws from before promotion is added.",
    ecoMapSplitTitle: "Map stack split (%)", ecoMapSplitDesc: "Relative weight of each size in the shuffled map stack. Active sizes only.",
    lblTiles: "Tiles per turn", lblSubmitCap: "Submissions per visit",
    lblPromotion: "Promotion (global)", lblOceanBase: "Ocean base range",
    lblAddRow: "Add row", lblResetTable: "Reset to defaults",
    thRow: "row", thMaps: "maps",
    pDayBonus: (n) => `day bonus +${n}`, pSubmitsLeft: (n) => `${n} submit${n === 1 ? "" : "s"} left`,
    upToDay: "Up to day", bonusLabel: "Bonus",
  },
  pl: {
    sub: "gra ślizgającej się łamigłówki · symulator ekonomii",
    tabs: { rules: "Zasady", economy: "Ekonomia", play: "Gra", stats: "Statystyki" },
    rSailTitle: "Jak żegluje się po atolu",
    rSail: "Statek unosi się na siatce otwartej wody usianej wyspami. Nigdy nie poruszasz się o jedno pole — przyzywasz wiatr, a statek płynie w danym kierunku, dopóki coś go nie zatrzyma:",
    rEdge: "krawędź mapy — statek staje na ostatnim polu;",
    rIsland: "wyspa — statek staje na polu tuż przed nią, bo nie może wpłynąć na ląd;",
    rShallow: "mielizna — statek wpływa na pole mielizny i staje na nim, tracąc rozpęd.",
    rTarget: (sh) => `Cel ✕ jest dla statku zwykłą wodą — przepływa nad nim. Aby wygrać, statek musi zatrzymać się dokładnie na ✕, używając krawędzi, wyspy${sh ? " lub mielizny" : ""} jako hamulca. Zaaranżowanie tego zatrzymania to cała łamigłówka.`,
    rBurn: "Nawet wiatr wepchnięty w ścianę zostaje zużyty — statek nie rusza, ale wiatr przepada. Zaplanuj całą trasę przed wydaniem.",
    rFlowTitle: "Przebieg gry",
    rFlow1: "W każdej turze drużyna wykonuje kilka ruchów po Oceanie. Każdy ruch losuje nagrodę z tabeli ekonomii — zawsze co najmniej jeden wiatr, a czasem mapę atolu lub punkty zwycięstwa.",
    rFlow2: "Wiatry zbierają się we wspólnym banku. Przeciągnij wiatry na atol, by zaplanować rozwiązanie; nic nie jest wydane, dopóki nie naciśniesz Płyń.",
    rFlow3: "Żegluga zatwierdza wiatry. Dotrzyj do ✕, a atol znika z gry i wypłaca własną nagrodę (więcej wiatrów, nowe mapy, punkty zwycięstwa) — im trudniejszy atol, tym bogatszy poziom. Pudło — wiatry przepadają, ale atol zostaje.",
    rFlow4: "Punkty zwycięstwa to wynik. Większość pochodzi z rozwiązywania atoli, więc prawdziwa gra to decyzja, które mapy ścigać rzadkimi wiatrami.",
    rJokerOn: "Joker ✦ to dziki wiatr: przeciągnij go na atol, a potem klikaj, by ustawić kierunek ↑ ↓ ← →. Po powrocie do banku znów staje się ✦.",
    setTitle: "Generowanie",
    setSizes: "Rozmiary atoli w grze", setShallows: "Włącz mielizny", setJokers: "Włącz jokery",
    setSizesHint: "Mapy atoli o tych rozmiarach pojawiają się losowo. Większe atole należą do bogatszych poziomów nagród.",
    ecoIntro: "Wszystko, co drużyna może zdobyć, definiuje się tutaj. Nagrody są pogrupowane w trzy poziomy; ruchy po Oceanie i ukończenia atoli losują z poziomu.",
    ecoValTitle: "Wartości zasobów",
    ecoValDesc: "Służą do rankingu drużyn na jednej skali. Jeden wiatr = 1 punkt z definicji; resztę ustaw względem niego.",
    lblWindValue: "Wartość wiatru", lblMapValue: "Wartość mapy atolu", lblVpValue: "Wartość punktu zwycięstwa",
    ecoTierTitle: "Poziomy nagród",
    ecoTierDesc: "Losowanie z poziomu daje tyle wiatrów (±1, min 1), mapę atolu z podaną szansą oraz podane punkty zwycięstwa.",
    thTier: "poziom", thWinds: "wiatry", thMapChance: "szansa mapy", thVP: "pkt zwyc.",
    ecoOceanTitle: "Wagi losowania ruchu po Oceanie",
    ecoOceanDesc: "Względna szansa, że pojedynczy ruch po Oceanie losuje z danego poziomu. Wyższe wagi niskich poziomów dają łagodny start.",
    ecoCompTitle: "Poziom nagrody za ukończenie atolu (wg rozmiaru)",
    ecoCompDesc: "Z którego poziomu wypłaca rozwiązany atol. Większe atole powinny należeć do bogatszych poziomów.",
    ecoTurnTitle: "Struktura tury",
    lblMoves: "Ruchy po Oceanie na turę", lblTurns: "Tur na grę", lblTeams: "Drużyny (do symulacji)",
    pTurn: "Tura", pOf: "z", pMovesLeft: "ruchów", pVP: "PZ", pWinds: "wiatry", pMaps: "map w grze",
    pOcean: "Ruch po Oceanie", pEndTurn: "Zakończ turę", pReset: "Nowa gra", pOver: "Koniec gry — naciśnij Nowa gra.",
    pBankTitle: "Bank wiatrów", pBankDesc: "Przeciągnij wiatr na atol, by zaplanować; przeciągnij z powrotem, by uwolnić. Kliknij wiatr, by wysłać go do wybranego atolu.",
    pAtolls: "Atole w grze", pEmpty: "Brak map atoli — wykonuj ruchy po Oceanie, aż jakaś się wylosuje.",
    pOpt: "min", pTier: "poz.", pAssignHint: "przeciągnij tu wiatry", pSail: "Płyń", pPress: "Naciśnij ▷ Płyń, by zatwierdzić.",
    pWin: (m, o) => `✓ Dotarto do X w ${m} (min. ${o}).`, pMiss: (m) => `✗ Pudło po ${m}. Wiatry stracone; atol zostaje.`,
    pLogTitle: "Dziennik decyzji", pLogEmpty: "Akcje i nagrody pojawią się tutaj.",
    logOcean: "Ruch po Oceanie", logSolve: (s) => `Rozwiązano ${s}×${s}`, logFail: (s) => `Nieudane ${s}×${s} — wiatry stracone`,
    tWind: (n) => `+${n} wiatr`, tMap: "+mapa", tVP: (n) => `+${n} PZ`,
    legWater: "woda", legIsland: "wyspa", legShallow: "mielizna", legX: "✕ cel",
    sTitle: "Symulacja wielu drużyn",
    sDesc: (n, t, m) => `${n} drużyn rozgrywa ${t} tur po ${m} ruchów po Oceanie, a potem zachłannie rozwiązuje każdy atol, na który stać ich bank. Uruchom ponownie, by przelosować szczęście.`,
    sRun: "↻ Ponów",
    kAvgVP: "Śr. punkty zwycięstwa", kAvgSolved: "Śr. rozwiązane atole", kAvgValue: "Śr. wartość łączna", kFair: "Sprawiedliwość (rozrzut szczęścia)",
    sTeamsTitle: "Końcowe punkty zwycięstwa wg drużyny", sTeamsDesc: "Sortowane rosnąco. Stromy wykres oznacza, że o zwycięstwie decyduje szczęście; płaski — drużyny kończą blisko siebie.",
    sProgTitle: "Średnie punkty zwycięstwa na turę", sProgDesc: "Jak szybko przeciętna drużyna zdobywa punkty w trakcie gry.",
    sFairOk: (x) => `✓ Rozrzut umiarkowany (góra/dół ≈ ${x}×) — szczęście ma znaczenie, ale umiejętność może nadrobić.`,
    sFairWarn: (x) => `⚠ Najlepsza drużyna zdobywa ≈ ${x}× tego co najsłabsza. O wyniku decyduje szczęście — zmień rozpiętość rzędów lub zwiększ kafelki na turę.`,
    sProgX: "tura", sProgY: "śr. PZ",
    sCascade: "Śr. mapy kaskadowe", sWindScarcity: "Deficyt wiatru",
    sWindStuckDesc: (p) => `${p}% tur drużyna nie może podjąć żadnego atolu — wiatry nie pasują do żadnej trzymanej mapy.`,
    sEcoSummaryTitle: "Podsumowanie ekonomii (śr. na drużynę)",
    kOceanWinds: "Wiatry z Oceanu", kOceanMaps: "Mapy z Oceanu", kOceanVP: "PZ z Oceanu",
    kPuzzleWinds: "Wiatry z atoli", kPuzzleVP: "PZ z atoli", kLeftover: "Wiatry pozostałe",
    sMapBacklogTitle: "Zaleganie map w czasie", sMapBacklogDesc: "Średnia liczba nierozwiązanych map w rękach drużyny na turę. Wysokie wartości = drużyna się dusi; niskie = brak map.",
    sMapBacklogX: "tura", sMapBacklogY: "śr. map w rękach",
    ecoTableTitle: "Tabela nagród", ecoTableDesc: "Jeden wspólny lookup. Każdy kafelek Oceanu i każdy rozwiązany atol mapuje się na wiersz; wiersz określa nagrodę.",
    ecoDayTitle: "Harmonogram bonusów dziennych", ecoDayDesc: "Bonus dodawany do bazowej wartości kafelka (1–6) zależnie od dnia (tury). Rampuje nagrody w trakcie obozu.",
    ecoPuzzleTitle: "Bazowe rzędy atoli (wg rozmiaru)", ecoPuzzleDesc: "Z którego wiersza wypłaca rozwiązany atol (przed dodaniem promocji).",
    ecoMapSplitTitle: "Skład stosu map (%)", ecoMapSplitDesc: "Względna waga każdego rozmiaru w potasowanym stosie map. Tylko aktywne rozmiary.",
    lblTiles: "Kafelki na turę", lblSubmitCap: "Zgłoszenia na wizytę",
    lblPromotion: "Promocja (globalna)", lblOceanBase: "Zakres bazowy Oceanu",
    lblAddRow: "Dodaj wiersz", lblResetTable: "Przywróć domyślne",
    thRow: "wiersz", thMaps: "mapy",
    pDayBonus: (n) => `bonus dzienny +${n}`, pSubmitsLeft: (n) => `${n} zgłoszeni${n === 1 ? "e" : "a"} pozostałe`,
    upToDay: "Do dnia", bonusLabel: "Bonus",
  },
};

/* ============================================================================
   STYLES
   ========================================================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap');
.atoll-root{--abyss:#081820;--deep:#0d2a36;--hull:#123442;--line:#1f4a5a;--sand:#e9dcbf;--sand-dim:#b7ad94;
  --brass:#d4a73c;--brass-dim:#8f7430;--foam:#5fc9d6;--coral:#e8623d;--kelp:#5b9a6b;--ink:#cfe3ea;--shadow:rgba(0,0,0,.45);
  font-family:'Spectral',Georgia,serif;color:var(--ink);
  background:radial-gradient(circle at 18% -10%,#11414f 0%,transparent 45%),radial-gradient(circle at 95% 110%,#0e3340 0%,transparent 40%),var(--abyss);min-height:100%;position:relative;}
.atoll-root::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.05;background-image:linear-gradient(var(--foam) 1px,transparent 1px),linear-gradient(90deg,var(--foam) 1px,transparent 1px);background-size:34px 34px;}
.wrap{max-width:1120px;margin:0 auto;padding:24px 22px 70px;position:relative;}
.masthead{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid var(--brass-dim);padding-bottom:14px;gap:14px;}
.title{font-weight:700;font-size:32px;letter-spacing:.5px;color:var(--sand);line-height:1;}
.title small{display:block;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--brass);font-weight:500;margin-top:7px;}
.langtoggle{display:flex;border:1px solid var(--brass-dim);border-radius:6px;overflow:hidden;font-family:'JetBrains Mono',monospace;font-size:12px;}
.langtoggle button{padding:5px 12px;background:transparent;border:none;color:var(--sand-dim);cursor:pointer;}
.langtoggle button.on{background:var(--brass);color:var(--abyss);font-weight:700;}
.tabs{display:flex;gap:2px;margin:20px 0 22px;border-bottom:1px solid var(--line);flex-wrap:wrap;}
.tab{padding:9px 18px;cursor:pointer;font-size:14px;letter-spacing:.5px;color:var(--sand-dim);text-transform:uppercase;font-weight:500;}
.tab.on{color:var(--abyss);background:var(--brass);border-radius:5px 5px 0 0;}
.tab:hover:not(.on){color:var(--sand);}
.panel{background:linear-gradient(180deg,var(--hull),var(--deep));border:1px solid var(--line);border-radius:8px;padding:18px 20px;box-shadow:0 8px 24px var(--shadow);}
.panel+.panel{margin-top:18px;}
.ph{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.ph h2{font-size:19px;font-weight:600;color:var(--sand);letter-spacing:.3px;}
.ph .num{font-family:'JetBrains Mono',monospace;color:var(--brass);font-size:13px;border:1px solid var(--brass-dim);border-radius:4px;padding:1px 7px;}
.mono{font-family:'JetBrains Mono',monospace;}
.row{display:flex;gap:18px;flex-wrap:wrap;}
.ctrl{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}
.ctrl label{font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:var(--sand-dim);}
.ctrl .val{font-family:'JetBrains Mono',monospace;color:var(--foam);font-size:13px;}
input[type=range]{accent-color:var(--brass);} input[type=checkbox]{accent-color:var(--brass);width:15px;height:15px;}
.numin{width:64px;background:var(--abyss);border:1px solid var(--line);color:var(--foam);font-family:'JetBrains Mono',monospace;font-size:13px;padding:4px 6px;border-radius:4px;}
.sel{background:var(--abyss);border:1px solid var(--line);color:var(--sand);font-family:'JetBrains Mono',monospace;font-size:13px;padding:4px 6px;border-radius:4px;}
.btn{cursor:pointer;border:1px solid var(--brass-dim);background:var(--hull);color:var(--sand);padding:7px 14px;border-radius:5px;font-family:'Spectral';font-size:14px;transition:.15s;}
.btn:hover{background:var(--brass);color:var(--abyss);}
.btn.primary{background:var(--brass);color:var(--abyss);font-weight:600;} .btn.primary:hover{filter:brightness(1.1);}
.btn.ghost{background:transparent;} .btn.danger{border-color:var(--coral);} .btn.danger:hover{background:var(--coral);color:#fff;}
.btn:disabled{opacity:.32;cursor:not-allowed;}
.sizepick{display:flex;gap:8px;flex-wrap:wrap;}
.sizebtn{cursor:pointer;border:1px solid var(--line);background:var(--hull);color:var(--sand-dim);padding:8px 16px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:14px;}
.sizebtn.on{border-color:var(--brass);background:var(--brass);color:var(--abyss);font-weight:700;}
.bankzone{display:flex;flex-wrap:wrap;gap:6px;padding:12px;border:1px dashed var(--line);border-radius:8px;background:rgba(0,0,0,.18);min-height:60px;align-content:flex-start;transition:.12s;}
.bankzone.over{border-color:var(--foam);background:rgba(95,201,214,.07);}
.wt{width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:18px;border:1px solid var(--line);border-radius:6px;background:var(--hull);cursor:grab;user-select:none;transition:transform .1s;}
.wt:active{cursor:grabbing;} .wt:hover{transform:translateY(-2px);border-color:var(--brass);}
.wt.U{color:#9fd4ff} .wt.D{color:#ffcf9f} .wt.L{color:#c9a0ff} .wt.R{color:#9fffc0} .wt.J{color:var(--brass);border-color:var(--brass-dim);}
.wt.sm{width:30px;height:30px;font-size:15px;border-radius:5px;} .wt.sm.jk{border-color:var(--brass-dim);}
.tray{display:flex;gap:4px;flex-wrap:wrap;min-height:40px;padding:6px;border:1px dashed var(--line);border-radius:6px;background:rgba(0,0,0,.2);transition:.12s;}
.tray.over{border-color:var(--foam);background:rgba(95,201,214,.08);}
.maze{display:grid;gap:2px;background:var(--line);padding:2px;border-radius:6px;position:relative;}
.cell{position:relative;background:#0e3a48;display:flex;align-items:center;justify-content:center;}
.cell.isl{background:#7b6a4a;background-image:linear-gradient(135deg,#8a774f,#5f5135);}
.cell.sh{background:#1d6f7a;background-image:repeating-linear-gradient(45deg,#1d6f7a,#1d6f7a 4px,#25869180 4px,#258691 8px);}
.cell.x{color:var(--coral);font-weight:700;}
.ship{position:absolute;filter:drop-shadow(0 1px 2px #000);transition:left .18s ease,top .18s ease;z-index:3;text-align:center;}
.atolls{display:flex;flex-wrap:wrap;gap:12px;}
.puzzle{width:236px;border:1px solid var(--line);border-radius:8px;padding:11px;background:linear-gradient(180deg,#103140,#0c2530);transition:.12s;}
.puzzle.active{border-color:var(--brass);box-shadow:0 0 0 1px var(--brass) inset;} .puzzle.over{border-color:var(--foam);}
.ptag{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-bottom:8px;}
.badge{font-family:'JetBrains Mono',monospace;font-size:10.5px;padding:2px 7px;border-radius:20px;border:1px solid var(--line);color:var(--sand-dim);white-space:nowrap;}
.badge.s5{color:#9fffc0;border-color:#2c6e47} .badge.s6{color:#9fd4ff;border-color:#2c5a7e} .badge.s7{color:var(--brass);border-color:var(--brass-dim)} .badge.s8{color:#ffb38a;border-color:#9c5836}
.result{margin-top:8px;font-family:'JetBrains Mono',monospace;font-size:11.5px;padding:7px 9px;border-radius:6px;line-height:1.4;}
.result.win{background:#143a26;border:1px solid var(--kelp);color:#bff0cf;} .result.miss{background:#3a2018;border:1px solid var(--coral);color:#ffc8b8;} .result.neutral{background:rgba(0,0,0,.2);border:1px solid var(--line);color:var(--sand-dim);}
.scoreboard{display:flex;gap:12px;flex-wrap:wrap;align-items:center;}
.score{background:rgba(0,0,0,.25);border:1px solid var(--line);border-radius:7px;padding:8px 14px;text-align:center;min-width:78px;}
.score .k{font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:var(--sand-dim);}
.score .v{font-family:'JetBrains Mono',monospace;font-size:22px;color:var(--foam);} .score.vp .v{color:var(--brass);}
.log{max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding-right:4px;}
.logitem{display:flex;gap:8px;align-items:baseline;font-size:12.5px;border-bottom:1px solid rgba(31,74,90,.5);padding-bottom:5px;}
.logitem .lt{font-family:'JetBrains Mono',monospace;color:var(--sand-dim);font-size:11px;min-width:34px;}
.logitem.solve .la{color:#bff0cf;} .logitem.fail .la{color:#ffc8b8;} .logitem.ocean .la{color:var(--ink);}
.logitem .lr{font-family:'JetBrains Mono',monospace;color:var(--foam);margin-left:auto;font-size:11.5px;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--line);}
th{color:var(--brass);font-weight:500;letter-spacing:.4px;text-transform:uppercase;font-size:11px;}
td.mono,th.mono{font-family:'JetBrains Mono',monospace;}
.note{font-size:13px;color:var(--sand-dim);line-height:1.7;} .note b{color:var(--sand);}
.warn{border-left:3px solid var(--coral);padding:8px 12px;background:rgba(232,98,61,.08);border-radius:0 5px 5px 0;color:#ffcdbe;font-size:13px;}
.ok{border-left:3px solid var(--kelp);padding:8px 12px;background:rgba(91,154,107,.08);border-radius:0 5px 5px 0;color:#bff0cf;font-size:13px;}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--sand-dim);margin-top:12px;}
.legend span{display:inline-flex;align-items:center;gap:6px;}
.sw{width:14px;height:14px;border-radius:3px;display:inline-block;border:1px solid var(--line);}
.kpi{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 10px;}
.kpibox{flex:1;min-width:140px;background:rgba(0,0,0,.22);border:1px solid var(--line);border-radius:7px;padding:10px 12px;}
.kpibox .k{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--sand-dim);}
.kpibox .v{font-family:'JetBrains Mono',monospace;font-size:22px;color:var(--foam);margin-top:3px;}
.hint{font-size:11.5px;color:var(--sand-dim);font-style:italic;}
ul.r{margin:8px 0 8px 18px;line-height:1.85;} ul.r li{margin-bottom:3px;}
ol.r{margin:8px 0 8px 20px;line-height:1.8;} ol.r li{margin-bottom:6px;}
`;

/* ============================================================================
   UI BITS
   ========================================================================== */
function Slider({ label, value, set, min, max, step = 1, fmt = (v) => v }) {
  return (<div className="ctrl"><label>{label} <span className="val">{fmt(value)}</span></label>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(parseFloat(e.target.value))} /></div>);
}
function NumIn({ value, set, step = 1, min = 0, max = 999 }) {
  return <input className="numin" type="number" value={value} step={step} min={min} max={max}
    onChange={(e) => { const v = parseFloat(e.target.value); set(isNaN(v) ? 0 : Math.max(min, Math.min(max, v))); }} />;
}
function MazeView({ p, shipPos, animPos }) {
  const cellPx = Math.max(22, Math.min(30, 200 / p.size));
  const pos = animPos || shipPos || p.start;
  return (
    <div className="maze" style={{ gridTemplateColumns: `repeat(${p.size},${cellPx}px)`, width: "fit-content" }}>
      {p.grid.map((row, r) => row.map((cell, c) => {
        const isX = r === p.target[0] && c === p.target[1];
        const cls = "cell" + (cell === 1 ? " isl" : cell === 2 && p.shallows ? " sh" : "") + (isX ? " x" : "");
        return <div key={r + "-" + c} className={cls} style={{ width: cellPx, height: cellPx, fontSize: cellPx * 0.5 }}>{isX ? "✕" : ""}</div>;
      }))}
      <div className="ship" style={{ width: cellPx, height: cellPx, lineHeight: cellPx + "px", fontSize: cellPx * 0.6, left: pos[1] * (cellPx + 2) + 2, top: pos[0] * (cellPx + 2) + 2 }}>⛵</div>
    </div>
  );
}
function bundleText(b, L) {
  const parts = [];
  if (b.winds) parts.push(L.tWind(b.winds));
  if (b.maps) parts.push(L.tMap);
  if (b.vp) parts.push(L.tVP(b.vp));
  return parts.join(" · ");
}

/* ============================================================================
   PLAY  (interactive single-team session)
   ========================================================================== */
function PlayTab({ settings, eco, pool, L }) {
  const [bankWinds, setBankWinds] = useState([]);
  const [atolls, setAtolls] = useState([]);
  const [trays, setTrays] = useState({});
  const [results, setResults] = useState({});
  const [active, setActive] = useState(null);
  const [anim, setAnim] = useState({});
  const [over, setOver] = useState(null);
  const [turn, setTurn] = useState(1);
  const [movesLeft, setMovesLeft] = useState(eco.tilesPerTurn);
  const [submitsLeft, setSubmitsLeft] = useState(eco.submissionCap);
  const [vp, setVp] = useState(0);
  const [log, setLog] = useState([]);
  const uid = useRef(1);

  const drawAtollObj = useCallback(() => {
    const sizes = settings.sizes.filter((sz) => (eco.mapStackSplit[sz] ?? 0) > 0);
    const pool2 = sizes.length ? sizes : settings.sizes;
    const sz = pool2[randint(0, pool2.length - 1)];
    const arr = pool[sz]; if (!arr || !arr.length) return null;
    return { ...arr[randint(0, arr.length - 1)], id: "a" + uid.current++ };
  }, [settings, pool, eco.mapStackSplit]);

  const reset = useCallback(() => {
    setBankWinds([]); setTrays({}); setResults({}); setActive(null); setAnim({});
    setTurn(1); setMovesLeft(eco.tilesPerTurn); setSubmitsLeft(eco.submissionCap); setVp(0); setLog([]);
    const first = drawAtollObj();
    if (first) { setAtolls([first]); setTrays({ [first.id]: [] }); setActive(first.id); } else setAtolls([]);
  }, [eco.tilesPerTurn, eco.submissionCap, drawAtollObj]);

  // init once
  const inited = useRef(false);
  if (!inited.current) { inited.current = true; const f = drawAtollObj(); if (f) { atolls.push(f); trays[f.id] = []; } }

  const addReward = (bundle) => {
    const newWinds = []; for (let i = 0; i < bundle.winds; i++) newWinds.push({ id: uid.current++, type: randType(settings.jokers) });
    setBankWinds((bw) => [...bw, ...newWinds]);
    if (bundle.vp) setVp((v) => v + bundle.vp);
    if (bundle.maps) { const a = drawAtollObj(); if (a) { setAtolls((at) => [...at, a]); setTrays((t) => ({ ...t, [a.id]: [] })); } }
  };

  const oceanMove = () => {
    if (movesLeft <= 0 || turn > eco.turnsPerGame) return;
    const dayBonus = getDayBonus(eco.dayBonusSchedule, turn);
    const base = randint(eco.oceanBaseMin, eco.oceanBaseMax);
    const bundle = lookupRow(eco.table, base + dayBonus + eco.promotion);
    addReward(bundle);
    setMovesLeft((m) => m - 1);
    setLog((lg) => [{ id: uid.current++, turn, type: "ocean", text: `${L.logOcean} (${base}+${dayBonus})→r${base + dayBonus + eco.promotion}`, reward: bundleText(bundle, L) }, ...lg]);
  };
  const endTurn = () => {
    if (turn >= eco.turnsPerGame) { setTurn(eco.turnsPerGame + 1); return; }
    setTurn((t) => t + 1); setMovesLeft(eco.tilesPerTurn); setSubmitsLeft(eco.submissionCap);
  };
  const gameOver = turn > eco.turnsPerGame;

  const clearResult = (id) => setResults((r) => { if (!(id in r)) return r; const n = { ...r }; delete n[id]; return n; });

  // bank/tray moves (drag + click)
  const drag = useRef(null);
  const bankToTray = (windId, atollId) => {
    const w = bankWinds.find((x) => x.id === windId); if (!w) return;
    setBankWinds((bw) => bw.filter((x) => x.id !== windId));
    const tw = w.type === "J" ? { id: w.id, type: "J", dir: "U", fromJoker: true } : { id: w.id, type: w.type, dir: w.type, fromJoker: false };
    setTrays((t) => ({ ...t, [atollId]: [...(t[atollId] || []), tw] })); clearResult(atollId);
  };
  const trayToBank = (atollId, windId) => {
    const w = (trays[atollId] || []).find((x) => x.id === windId); if (!w) return;
    setTrays((t) => ({ ...t, [atollId]: t[atollId].filter((x) => x.id !== windId) }));
    setBankWinds((bw) => [...bw, { id: w.id, type: w.fromJoker ? "J" : w.dir }]); clearResult(atollId);
  };
  const trayToTray = (s, d, windId) => { if (s === d) return; const w = (trays[s] || []).find((x) => x.id === windId); if (!w) return; setTrays((t) => ({ ...t, [s]: t[s].filter((x) => x.id !== windId), [d]: [...(t[d] || []), w] })); clearResult(s); clearResult(d); };
  const cycleJoker = (atollId, windId) => { setTrays((t) => ({ ...t, [atollId]: (t[atollId] || []).map((w) => { if (w.id !== windId || !w.fromJoker) return w; const o = ["U", "D", "L", "R"]; return { ...w, dir: o[(o.indexOf(w.dir) + 1) % 4] }; }) })); clearResult(atollId); };
  const onBankDS = (e, w) => { drag.current = { source: "bank", id: w.id }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(w.id)); };
  const onTrayDS = (e, a, w) => { drag.current = { source: "tray", atollId: a, id: w.id }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(w.id)); };
  const onDropAtoll = (e, a) => { e.preventDefault(); setOver(null); const d = drag.current; if (!d) return; if (d.source === "bank") bankToTray(d.id, a); else trayToTray(d.atollId, a, d.id); drag.current = null; };
  const onDropBank = (e) => { e.preventDefault(); setOver(null); const d = drag.current; if (d && d.source === "tray") trayToBank(d.atollId, d.id); drag.current = null; };
  const allow = (e) => e.preventDefault();
  const clickAssign = (w) => { if (active) bankToTray(w.id, active); };

  const sail = (p) => {
    const seq = trays[p.id]; if (!seq.length) return;
    let pos = p.start; const path = [pos];
    seq.forEach((w) => { pos = slide(p.grid, pos, w.dir, p.shallows); path.push(pos); });
    let i = 0;
    const tick = () => {
      setAnim((a) => ({ ...a, [p.id]: path[i] })); i++;
      if (i < path.length) setTimeout(tick, 200);
      else {
        const win = pos[0] === p.target[0] && pos[1] === p.target[1];
        setTrays((t) => ({ ...t, [p.id]: [] }));   // winds committed/spent
        if (win) {
          const bundle = lookupRow(eco.table, (eco.puzzleBaseRows[p.size] ?? 5) + eco.promotion);
          addReward(bundle);
          setSubmitsLeft((sl) => sl - 1);
          setLog((lg) => [{ id: uid.current++, turn, type: "solve", text: L.logSolve(p.size), reward: bundleText(bundle, L) }, ...lg]);
          setResults((r) => ({ ...r, [p.id]: { moves: seq.length, win: true } }));
          setTimeout(() => {
            setAtolls((at) => at.filter((x) => x.id !== p.id));
            setTrays((t) => { const n = { ...t }; delete n[p.id]; return n; });
            setResults((r) => { const n = { ...r }; delete n[p.id]; return n; });
            if (active === p.id) setActive(null);
            setAnim((a) => { const n = { ...a }; delete n[p.id]; return n; });
          }, 800);
        } else {
          setSubmitsLeft((sl) => sl - 1);
          setResults((r) => ({ ...r, [p.id]: { moves: seq.length, win: false } }));
          setLog((lg) => [{ id: uid.current++, turn, type: "fail", text: L.logFail(p.size), reward: "" }, ...lg]);
          setTimeout(() => setAnim((a) => { const n = { ...a }; delete n[p.id]; return n; }), 400);
        }
      }
    };
    tick();
  };

  const sortedBank = [...bankWinds].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.id - b.id);

  return (
    <>
      <div className="panel">
        <div className="ph"><span className="num">▣</span><h2>{L.pTurn} {Math.min(turn, eco.turnsPerGame)} {L.pOf} {eco.turnsPerGame}</h2>
          <div style={{ flex: 1 }} />
          <button className="btn primary" disabled={gameOver || movesLeft <= 0} onClick={oceanMove}>⛵ {L.pOcean} ({movesLeft})</button>
          <button className="btn" disabled={gameOver} onClick={endTurn}>{L.pEndTurn}</button>
          <button className="btn ghost" onClick={reset}>↻ {L.pReset}</button>
        </div>
        <div className="scoreboard">
          <div className="score vp"><div className="k">{L.pVP}</div><div className="v">{vp}</div></div>
          <div className="score"><div className="k">{L.pMovesLeft}</div><div className="v">{gameOver ? "—" : movesLeft}</div></div>
          <div className="score"><div className="k">{L.pWinds}</div><div className="v">{bankWinds.length}</div></div>
          <div className="score"><div className="k">{L.pMaps}</div><div className="v">{atolls.length}</div></div>
          {!gameOver && <div className="score"><div className="k">sub</div><div className="v">{submitsLeft}/{eco.submissionCap}</div></div>}
          {!gameOver && <div className="score"><div className="k">bonus</div><div className="v mono" style={{ fontSize: 16, marginTop: 3, color: "var(--brass)" }}>+{getDayBonus(eco.dayBonusSchedule, Math.min(turn, eco.turnsPerGame))}</div></div>}
          {gameOver && <div className="warn" style={{ flex: 1 }}>{L.pOver}</div>}
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">01</span><h2>{L.pBankTitle}</h2></div>
        <p className="note" style={{ marginBottom: 12 }}>{L.pBankDesc}</p>
        <div className={"bankzone" + (over === "bank" ? " over" : "")} onDragOver={allow} onDragEnter={() => setOver("bank")} onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(null); }} onDrop={onDropBank}>
          {sortedBank.length === 0 && <span className="hint" style={{ alignSelf: "center" }}>⛵ {L.pOcean}</span>}
          {sortedBank.map((w) => (<div key={w.id} className={`wt ${w.type}`} draggable onDragStart={(e) => onBankDS(e, w)} onClick={() => clickAssign(w)}>{ARROW[w.type]}</div>))}
        </div>
      </div>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="panel" style={{ flex: 3, minWidth: 300 }}>
          <div className="ph"><span className="num">02</span><h2>{L.pAtolls}</h2></div>
          {atolls.length === 0 && <p className="hint">{L.pEmpty}</p>}
          <div className="atolls">
            {atolls.map((p) => {
              const res = results[p.id]; const tr = trays[p.id] || []; const baseRow = eco.puzzleBaseRows[p.size] ?? 5;
              return (
                <div key={p.id} className={"puzzle" + (active === p.id ? " active" : "") + (over === p.id ? " over" : "")}
                  onClick={() => setActive(p.id)} onDragOver={allow} onDragEnter={() => setOver(p.id)} onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(null); }} onDrop={(e) => onDropAtoll(e, p.id)}>
                  <div className="ptag">
                    <span className={`badge s${p.size}`}>{p.size}×{p.size}</span>
                    <span className="badge">{L.pOpt} {p.optLen}</span>
                    <span className="badge">{L.pTier} r{baseRow + eco.promotion}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 9px" }}><MazeView p={p} shipPos={res ? p.start : p.start} animPos={anim[p.id]} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span className="hint">{L.pWinds} ({tr.length})</span>
                    <button className="btn" style={{ padding: "3px 10px", fontSize: 13 }} disabled={!tr.length || submitsLeft <= 0} onClick={(e) => { e.stopPropagation(); sail(p); }}>▷ {L.pSail}</button>
                  </div>
                  <div className="tray">
                    {tr.length === 0 && <span className="hint" style={{ alignSelf: "center" }}>{L.pAssignHint}</span>}
                    {tr.map((w) => (<div key={w.id} className={`wt sm ${w.dir} ${w.fromJoker ? "jk" : ""}`} draggable
                      onDragStart={(e) => { e.stopPropagation(); onTrayDS(e, p.id, w); }}
                      onClick={(e) => { e.stopPropagation(); w.fromJoker ? cycleJoker(p.id, w.id) : trayToBank(p.id, w.id); }}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); trayToBank(p.id, w.id); }}>{ARROW[w.dir]}</div>))}
                  </div>
                  {res && res.win  && <div className="result win">{L.pWin(res.moves, p.optLen)}</div>}
                  {res && !res.win && <div className="result miss">{L.pMiss(res.moves)}</div>}
                  {!res && tr.length > 0 && <div className="result neutral">{L.pPress}</div>}
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><i className="sw" style={{ background: "#0e3a48" }} /> {L.legWater}</span>
            <span><i className="sw" style={{ background: "#7b6a4a" }} /> {L.legIsland}</span>
            {settings.shallows && <span><i className="sw" style={{ background: "#1d6f7a" }} /> {L.legShallow}</span>}
            <span><i className="sw" style={{ background: "transparent", borderColor: "var(--coral)" }} /> {L.legX}</span>
          </div>
        </div>

        <div className="panel" style={{ flex: 2, minWidth: 240 }}>
          <div className="ph"><span className="num">✎</span><h2>{L.pLogTitle}</h2></div>
          {log.length === 0 && <p className="hint">{L.pLogEmpty}</p>}
          <div className="log">
            {log.map((e) => (
              <div key={e.id} className={"logitem " + e.type}>
                <span className="lt">T{e.turn}</span>
                <span className="la">{e.text}</span>
                {e.reward && <span className="lr">{e.reward}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================================
   ECONOMY
   ========================================================================== */
function EconomyTab({ eco, setEco, settings, L }) {
  const setTableRow = (i, k, v) => setEco({ ...eco, table: eco.table.map((r, j) => j === i ? { ...r, [k]: v } : r) });
  const addRow = () => setEco({ ...eco, table: [...eco.table, { winds: 1, maps: 0, vp: 0 }] });
  const removeRow = (i) => { if (eco.table.length <= 1) return; setEco({ ...eco, table: eco.table.filter((_, j) => j !== i) }); };
  const resetTable = () => setEco({ ...eco, table: DEFAULT_TABLE });
  const setDayBonus = (i, k, v) => setEco({ ...eco, dayBonusSchedule: eco.dayBonusSchedule.map((e, j) => j === i ? { ...e, [k]: v } : e) });
  const addDayBonus = () => setEco({ ...eco, dayBonusSchedule: [...eco.dayBonusSchedule, { upToDay: eco.turnsPerGame, bonus: 0 }] });
  const removeDayBonus = (i) => { if (eco.dayBonusSchedule.length <= 1) return; setEco({ ...eco, dayBonusSchedule: eco.dayBonusSchedule.filter((_, j) => j !== i) }); };
  return (
    <>
      <div className="panel">
        <div className="ph"><span className="num">€</span><h2>{L.tabs.economy}</h2></div>
        <p className="note">{L.ecoIntro}</p>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">A</span><h2>{L.ecoTableTitle}</h2></div>
        <p className="note" style={{ marginBottom: 10 }}>{L.ecoTableDesc}</p>
        <table>
          <thead><tr><th className="mono">{L.thRow}</th><th>{L.thWinds}</th><th>{L.thMaps}</th><th>{L.thVP}</th><th></th></tr></thead>
          <tbody>
            {eco.table.map((row, i) => (
              <tr key={i}>
                <td className="mono" style={{ color: "var(--brass)", fontWeight: 600 }}>{i + 1}</td>
                <td><NumIn value={row.winds} set={(v) => setTableRow(i, "winds", Math.max(1, v))} min={1} /></td>
                <td>
                  <select className="sel" value={row.maps} onChange={(e) => setTableRow(i, "maps", +e.target.value)}>
                    <option value={0}>0</option><option value={1}>1</option>
                  </select>
                </td>
                <td><NumIn value={row.vp} set={(v) => setTableRow(i, "vp", Math.max(0, v))} min={0} /></td>
                <td><button className="btn ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => removeRow(i)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="btn" onClick={addRow}>+ {L.lblAddRow}</button>
          <button className="btn ghost" onClick={resetTable}>{L.lblResetTable}</button>
        </div>
      </div>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="panel" style={{ flex: 1, minWidth: 260 }}>
          <div className="ph"><span className="num">B</span><h2>{L.ecoDayTitle}</h2></div>
          <p className="note" style={{ marginBottom: 10 }}>{L.ecoDayDesc}</p>
          <table>
            <thead><tr><th>{L.upToDay}</th><th>{L.bonusLabel}</th><th></th></tr></thead>
            <tbody>
              {eco.dayBonusSchedule.map((e, i) => (
                <tr key={i}>
                  <td><NumIn value={e.upToDay} set={(v) => setDayBonus(i, "upToDay", Math.max(1, v))} min={1} max={eco.turnsPerGame} /></td>
                  <td>+ <NumIn value={e.bonus} set={(v) => setDayBonus(i, "bonus", Math.max(0, v))} min={0} max={6} /></td>
                  <td><button className="btn ghost" style={{ padding: "2px 8px", fontSize: 12 }} onClick={() => removeDayBonus(i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn" style={{ marginTop: 8 }} onClick={addDayBonus}>+ {L.lblAddRow}</button>
        </div>

        <div className="panel" style={{ flex: 1, minWidth: 260 }}>
          <div className="ph"><span className="num">C</span><h2>{L.ecoPuzzleTitle}</h2></div>
          <p className="note" style={{ marginBottom: 12 }}>{L.ecoPuzzleDesc}</p>
          <div className="row">
            {settings.sizes.map((sz) => (
              <div className="ctrl" key={sz} style={{ marginRight: 16 }}>
                <label>{sz}×{sz}</label>
                <NumIn value={eco.puzzleBaseRows[sz] ?? 5} set={(v) => setEco({ ...eco, puzzleBaseRows: { ...eco.puzzleBaseRows, [sz]: Math.max(1, v) } })} min={1} max={eco.table.length} />
              </div>
            ))}
            <div className="ctrl" style={{ marginRight: 16 }}>
              <label>{L.lblPromotion}</label>
              <NumIn value={eco.promotion} set={(v) => setEco({ ...eco, promotion: Math.max(0, v) })} min={0} max={4} />
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="panel" style={{ flex: 1, minWidth: 260 }}>
          <div className="ph"><span className="num">D</span><h2>{L.ecoMapSplitTitle}</h2></div>
          <p className="note" style={{ marginBottom: 12 }}>{L.ecoMapSplitDesc}</p>
          <div className="row">
            {settings.sizes.map((sz) => (
              <div className="ctrl" key={sz} style={{ marginRight: 16 }}>
                <label>{sz}×{sz} %</label>
                <NumIn value={eco.mapStackSplit[sz] ?? 0} set={(v) => setEco({ ...eco, mapStackSplit: { ...eco.mapStackSplit, [sz]: Math.max(0, v) } })} min={0} max={100} />
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ flex: 1, minWidth: 260 }}>
          <div className="ph"><span className="num">E</span><h2>{L.ecoTurnTitle}</h2></div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}><Slider label={L.lblTiles} value={eco.tilesPerTurn} set={(v) => setEco({ ...eco, tilesPerTurn: v })} min={1} max={6} /></div>
            <div style={{ flex: 1, minWidth: 180 }}><Slider label={L.lblTurns} value={eco.turnsPerGame} set={(v) => setEco({ ...eco, turnsPerGame: v })} min={4} max={20} /></div>
            <div style={{ flex: 1, minWidth: 180 }}><Slider label={L.lblTeams} value={eco.numTeams} set={(v) => setEco({ ...eco, numTeams: v })} min={2} max={24} /></div>
            <div style={{ flex: 1, minWidth: 180 }}><Slider label={L.lblSubmitCap} value={eco.submissionCap} set={(v) => setEco({ ...eco, submissionCap: v })} min={1} max={8} /></div>
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <div className="ctrl" style={{ marginRight: 16 }}><label>{L.lblOceanBase} min</label><NumIn value={eco.oceanBaseMin} set={(v) => setEco({ ...eco, oceanBaseMin: Math.max(1, v) })} min={1} max={eco.oceanBaseMax} /></div>
            <div className="ctrl"><label>max</label><NumIn value={eco.oceanBaseMax} set={(v) => setEco({ ...eco, oceanBaseMax: Math.max(eco.oceanBaseMin, v) })} min={eco.oceanBaseMin} max={20} /></div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================================
   STATS
   ========================================================================== */
function StatsTab({ settings, eco, pool, L }) {
  const [runSeed, setRunSeed] = useState(1);
  const sim = useMemo(() => {
    setSeed(1000 + runSeed * 31 + eco.numTeams);
    const teams = [];
    for (let i = 0; i < eco.numTeams; i++) teams.push(simulateTeam(eco, pool, settings));
    return teams;
  }, [eco, pool, settings, runSeed]);

  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const vps = sim.map((t) => t.vp);
  const sortedTeams = [...sim].sort((a, b) => a.vp - b.vp).map((t, i) => ({ name: "T" + (i + 1), vp: t.vp }));
  const avgVP = mean(vps), avgSolved = mean(sim.map((t) => t.solved)), avgValue = mean(sim.map((t) => t.totalValue));
  const avgCascade = mean(sim.map((t) => t.cascadeTotal));
  const minVP = Math.min(...vps) || 0, maxVP = Math.max(...vps) || 0;
  const fairness = minVP > 0 ? maxVP / minVP : maxVP > 0 ? Infinity : 1;
  const avgStuck = mean(sim.map((t) => t.turnsStuck));
  const stuckPct = eco.turnsPerGame > 0 ? +(avgStuck / eco.turnsPerGame * 100).toFixed(1) : 0;
  const prog = useMemo(() => {
    const T = eco.turnsPerGame; const out = [];
    for (let i = 0; i < T; i++) out.push({ turn: i + 1, vp: +mean(sim.map((t) => t.perTurn[i] || 0)).toFixed(1) });
    return out;
  }, [sim, eco.turnsPerGame]);
  const backlog = useMemo(() => {
    const T = eco.turnsPerGame; const out = [];
    for (let i = 0; i < T; i++) out.push({ turn: i + 1, held: +mean(sim.map((t) => t.heldOverTime[i] || 0)).toFixed(2) });
    return out;
  }, [sim, eco.turnsPerGame]);

  const ecoSummary = {
    oceanWinds: mean(sim.map((t) => t.oceanWindsTotal)),
    oceanMaps: mean(sim.map((t) => t.oceanMapsTotal)),
    oceanVP: mean(sim.map((t) => t.oceanVPtotal)),
    puzzleWinds: mean(sim.map((t) => t.puzzleWindsTotal)),
    puzzleVP: mean(sim.map((t) => t.puzzleVPtotal)),
    solved: avgSolved,
    leftover: mean(sim.map((t) => t.leftoverWinds)),
  };

  const tt = { contentStyle: { background: "#0d2a36", border: "1px solid #1f4a5a", fontFamily: "JetBrains Mono", fontSize: 12 } };

  return (
    <>
      <div className="panel">
        <div className="ph"><span className="num">Σ</span><h2>{L.sTitle}</h2><div style={{ flex: 1 }} /><button className="btn" onClick={() => setRunSeed((s) => s + 1)}>{L.sRun}</button></div>
        <p className="note" style={{ marginBottom: 14 }}>{L.sDesc(eco.numTeams, eco.turnsPerGame, eco.tilesPerTurn)}</p>
        <div className="kpi">
          <div className="kpibox"><div className="k">{L.kAvgVP}</div><div className="v">{avgVP.toFixed(1)}</div></div>
          <div className="kpibox"><div className="k">{L.kAvgSolved}</div><div className="v">{avgSolved.toFixed(1)}</div></div>
          <div className="kpibox"><div className="k">{L.sCascade}</div><div className="v">{avgCascade.toFixed(1)}</div></div>
          <div className="kpibox"><div className="k">{L.kFair}</div><div className="v">{fairness === Infinity ? "∞" : fairness.toFixed(2) + "×"}</div></div>
        </div>
        {fairness !== Infinity && (fairness > 2
          ? <div className="warn">{L.sFairWarn(fairness.toFixed(2))}</div>
          : <div className="ok">{L.sFairOk(fairness.toFixed(2))}</div>)}
      </div>

      <div className="panel">
        <div className="ph"><span className="num">A</span><h2>{L.sTeamsTitle}</h2></div>
        <p className="note" style={{ marginBottom: 10 }}>{L.sTeamsDesc}</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={sortedTeams} margin={{ top: 8, right: 14, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="#1f4a5a" strokeDasharray="2 4" />
            <XAxis dataKey="name" stroke="#b7ad94" fontSize={11} />
            <YAxis stroke="#b7ad94" fontSize={11} />
            <Tooltip {...tt} />
            <ReferenceLine y={avgVP} stroke="#d4a73c" strokeDasharray="4 4" label={{ value: "avg", fill: "#d4a73c", fontSize: 10, position: "right" }} />
            <Bar dataKey="vp" radius={[4, 4, 0, 0]}>
              {sortedTeams.map((t, i) => <Cell key={i} fill={i === sortedTeams.length - 1 ? "#d4a73c" : "#5fc9d6"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">B</span><h2>{L.sProgTitle}</h2></div>
        <p className="note" style={{ marginBottom: 10 }}>{L.sProgDesc}</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={prog} margin={{ top: 8, right: 18, bottom: 4, left: -14 }}>
            <CartesianGrid stroke="#1f4a5a" strokeDasharray="2 4" />
            <XAxis dataKey="turn" stroke="#b7ad94" fontSize={11} label={{ value: L.sProgX, position: "insideBottom", offset: -2, fill: "#b7ad94", fontSize: 11 }} />
            <YAxis stroke="#b7ad94" fontSize={11} />
            <Tooltip {...tt} />
            <Line type="monotone" dataKey="vp" stroke="#5fc9d6" strokeWidth={2.5} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">C</span><h2>{L.sEcoSummaryTitle}</h2></div>
        <table>
          <thead><tr><th>Source</th><th>{L.thWinds}</th><th>{L.thMaps}</th><th>{L.thVP}</th></tr></thead>
          <tbody>
            <tr><td>Ocean</td><td className="mono">{ecoSummary.oceanWinds.toFixed(1)}</td><td className="mono">{ecoSummary.oceanMaps.toFixed(1)}</td><td className="mono">{ecoSummary.oceanVP.toFixed(1)}</td></tr>
            <tr><td>Puzzles</td><td className="mono">{ecoSummary.puzzleWinds.toFixed(1)}</td><td className="mono">—</td><td className="mono">{ecoSummary.puzzleVP.toFixed(1)}</td></tr>
            <tr style={{ borderTop: "2px solid var(--line)" }}>
              <td style={{ color: "var(--brass)", fontWeight: 600 }}>Total</td>
              <td className="mono" style={{ color: "var(--foam)" }}>{(ecoSummary.oceanWinds + ecoSummary.puzzleWinds).toFixed(1)}</td>
              <td className="mono" style={{ color: "var(--foam)" }}>{ecoSummary.oceanMaps.toFixed(1)}</td>
              <td className="mono" style={{ color: "var(--brass)", fontWeight: 600 }}>{(ecoSummary.oceanVP + ecoSummary.puzzleVP).toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
        <div className="kpi" style={{ marginTop: 12 }}>
          <div className="kpibox"><div className="k">{L.kAvgSolved}</div><div className="v">{ecoSummary.solved.toFixed(1)}</div></div>
          <div className="kpibox"><div className="k">{L.kLeftover}</div><div className="v">{ecoSummary.leftover.toFixed(1)}</div></div>
        </div>
      </div>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="panel" style={{ flex: 1, minWidth: 280 }}>
          <div className="ph"><span className="num">D</span><h2>{L.sWindScarcity}</h2></div>
          <div className="kpi" style={{ marginBottom: 10 }}>
            <div className="kpibox"><div className="k">{L.sWindScarcity}</div><div className="v">{stuckPct}%</div></div>
          </div>
          <p className="note">{L.sWindStuckDesc(stuckPct)}</p>
          {stuckPct > 30 && <div className="warn" style={{ marginTop: 8 }}>⚠ High scarcity — consider more jokers, bigger map-split weights on smaller atolls, or more tiles per turn.</div>}
        </div>

        <div className="panel" style={{ flex: 2, minWidth: 300 }}>
          <div className="ph"><span className="num">E</span><h2>{L.sMapBacklogTitle}</h2></div>
          <p className="note" style={{ marginBottom: 10 }}>{L.sMapBacklogDesc}</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={backlog} margin={{ top: 8, right: 18, bottom: 16, left: -14 }}>
              <CartesianGrid stroke="#1f4a5a" strokeDasharray="2 4" />
              <XAxis dataKey="turn" stroke="#b7ad94" fontSize={11} label={{ value: L.sMapBacklogX, position: "insideBottom", offset: -4, fill: "#b7ad94", fontSize: 11 }} />
              <YAxis stroke="#b7ad94" fontSize={11} label={{ value: L.sMapBacklogY, angle: -90, position: "insideLeft", offset: 14, fill: "#b7ad94", fontSize: 10 }} />
              <Tooltip {...tt} />
              <Line type="monotone" dataKey="held" stroke="#e8623d" strokeWidth={2.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

/* ============================================================================
   RULES
   ========================================================================== */
function RulesTab({ settings, setSettings, L }) {
  const toggleSize = (sz) => setSettings((s) => { const has = s.sizes.includes(sz); const next = has ? s.sizes.filter((x) => x !== sz) : [...s.sizes, sz].sort(); return { ...s, sizes: next.length ? next : s.sizes }; });
  return (
    <>
      <div className="panel">
        <div className="ph"><span className="num">§</span><h2>{L.rSailTitle}</h2></div>
        <div className="note">
          <p>{L.rSail}</p>
          <ul className="r"><li>{L.rEdge}</li><li>{L.rIsland}</li>{settings.shallows && <li>{L.rShallow}</li>}</ul>
          <p>{L.rTarget(settings.shallows)}</p>
          <p style={{ marginTop: 10 }}>{L.rBurn}</p>
        </div>
      </div>
      <div className="panel">
        <div className="ph"><span className="num">§</span><h2>{L.rFlowTitle}</h2></div>
        <div className="note">
          <ol className="r"><li>{L.rFlow1}</li><li>{L.rFlow2}</li><li>{L.rFlow3}</li><li>{L.rFlow4}</li></ol>
          {settings.jokers && <p style={{ marginTop: 6 }}>{L.rJokerOn}</p>}
        </div>
      </div>
      <div className="panel">
        <div className="ph"><span className="num">⚙</span><h2>{L.setTitle}</h2></div>
        <div className="ctrl">
          <label>{L.setSizes}</label>
          <div className="sizepick">{[5, 6, 7, 8].map((sz) => (<div key={sz} className={"sizebtn" + (settings.sizes.includes(sz) ? " on" : "")} onClick={() => toggleSize(sz)}>{sz}×{sz}</div>))}</div>
          <span className="hint" style={{ marginTop: 4 }}>{L.setSizesHint}</span>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <div className="ctrl"><label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
            <input type="checkbox" checked={settings.shallows} onChange={(e) => setSettings({ ...settings, shallows: e.target.checked })} />{L.setShallows}</label></div>
          <div className="ctrl"><label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>
            <input type="checkbox" checked={settings.jokers} onChange={(e) => setSettings({ ...settings, jokers: e.target.checked })} />{L.setJokers}</label></div>
        </div>
      </div>
    </>
  );
}

/* ============================================================================
   ROOT
   ========================================================================== */
export default function App() {
  const [tab, setTab] = useState("rules");
  const [lang, setLang] = useState("pl");
  const [settings, setSettings] = useState({ sizes: [5, 6, 7], shallows: false, jokers: true });
  const [eco, setEco] = useState({
    table: DEFAULT_TABLE,
    tilesPerTurn: 3, turnsPerGame: 10, numTeams: 12,
    oceanBaseMin: 1, oceanBaseMax: 6,
    dayBonusSchedule: [
      { upToDay: 4, bonus: 0 },
      { upToDay: 8, bonus: 2 },
      { upToDay: 10, bonus: 4 },
    ],
    puzzleBaseRows: { 5: 5, 6: 8, 7: 11, 8: 13 },
    mapStackSplit: { 5: 50, 6: 30, 7: 20, 8: 0 },
    submissionCap: 2,
    promotion: 0,
  });
  const pool = useMemo(() => { setSeed(424242); return buildPool(settings.sizes, settings.shallows, 30); }, [settings.sizes, settings.shallows]);
  const L = STR[lang];

  return (
    <div className="atoll-root">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="masthead">
          <div className="title">Atoll Navigator<small>{L.sub}</small></div>
          <div className="langtoggle">
            <button className={lang === "pl" ? "on" : ""} onClick={() => setLang("pl")}>PL</button>
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
        </div>
        <div className="tabs">
          {["rules", "economy", "play", "stats"].map((k) => (<div key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{L.tabs[k]}</div>))}
        </div>
        {tab === "rules" && <RulesTab settings={settings} setSettings={setSettings} L={L} />}
        {tab === "economy" && <EconomyTab eco={eco} setEco={setEco} settings={settings} L={L} />}
        {tab === "play" && <PlayTab key={lang + JSON.stringify(settings.sizes) + settings.shallows + eco.tilesPerTurn + eco.turnsPerGame} settings={settings} eco={eco} pool={pool} L={L} />}
        {tab === "stats" && <StatsTab settings={settings} eco={eco} pool={pool} L={L} />}
      </div>
    </div>
  );
}
