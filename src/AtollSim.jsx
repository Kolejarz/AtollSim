import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from "recharts";
import {
  slide, randint, randType, getDayBonus, lookupRow,
  buildPool, setSeed, simulateTeam, DEFAULT_TABLE,
} from "./engine.js";
import { STR } from "./i18n.js";

/* ============================================================================
   ATOLL NAVIGATOR — economy-driven sliding-maze game (PL/EN)
   Ocean moves and atoll completions draw rewards from a configurable economy
   table (tiers). Winds fuel atolls; solving atolls yields more rewards.
   ========================================================================== */

const ARROW = { U: "↑", D: "↓", L: "←", R: "→", J: "✦" };
const TYPE_ORDER = { U: 0, D: 1, L: 2, R: 3, J: 4 };
const TIER_LABELS = ["I", "II", "III"];

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
