import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine,
} from "recharts";
import {
  slide, randint, randType, getDayBonus, lookupRow,
  buildPool, setSeed, simulateTeam, simulateTeamDetailed,
  analyzeBalance, STRATEGIES, DEFAULT_TABLE,
} from "./engine.js";
import { STR } from "./i18n.js";
import { storage } from "./storage.js";

const ARROW = { U: "↑", D: "↓", L: "←", R: "→", J: "✦" };
const TYPE_ORDER = { U: 0, D: 1, L: 2, R: 3, J: 4 };

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
.tab{padding:9px 18px;cursor:pointer;font-size:13px;letter-spacing:.5px;color:var(--sand-dim);text-transform:uppercase;font-weight:500;}
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
.btn.sm{padding:4px 10px;font-size:12px;}
.sizebtn{cursor:pointer;border:1px solid var(--line);background:var(--hull);color:var(--sand-dim);padding:7px 14px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:13px;transition:.12s;}
.sizebtn.on{border-color:var(--brass);background:var(--brass);color:var(--abyss);font-weight:700;}
.sizebtn:hover:not(.on){border-color:var(--sand-dim);color:var(--sand);}
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
/* Mode toggle */
.mode-toggle{display:flex;background:rgba(0,0,0,.2);border:1px solid var(--line);border-radius:6px;overflow:hidden;width:fit-content;margin-bottom:20px;}
.mode-toggle button{padding:7px 20px;font-size:13px;border:none;background:transparent;color:var(--sand-dim);cursor:pointer;letter-spacing:.4px;text-transform:uppercase;font-family:'Spectral';}
.mode-toggle button.on{background:var(--brass);color:var(--abyss);font-weight:600;}
/* Preset button rows */
.preset-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;}
.preset-card{background:rgba(0,0,0,.18);border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin-bottom:14px;}
.preset-card h3{font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--sand-dim);margin:0 0 10px;}
/* Strategy cards */
.strategy-grid{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 14px;}
.sc{border:1px solid var(--line);border-radius:7px;padding:10px 14px;background:rgba(0,0,0,.18);min-width:160px;flex:1;cursor:pointer;transition:.12s;}
.sc.on{border-color:var(--brass);background:rgba(212,167,60,.08);}
.sc:hover:not(.on){border-color:var(--sand-dim);}
.sc-dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;}
.sc-name{font-size:13px;font-weight:600;color:var(--sand);}
.sc-desc{font-size:11.5px;color:var(--sand-dim);margin-top:4px;line-height:1.5;}
/* Balance cards */
.bc{padding:10px 14px;border-radius:0 6px 6px 0;border-left:3px solid;margin-bottom:8px;}
.bc.ok{border-color:var(--kelp);background:rgba(91,154,107,.07);}
.bc.warn{border-color:var(--brass);background:rgba(212,167,60,.07);}
.bc.bad{border-color:var(--coral);background:rgba(232,98,61,.07);}
.bc-title{font-size:13px;font-weight:600;color:var(--sand);}
.bc-detail{font-size:12px;color:var(--sand-dim);margin-top:3px;line-height:1.5;}
.bc-suggest{font-size:12px;color:var(--foam);margin-top:5px;font-style:italic;}
/* Leaderboard */
.lb-list{display:flex;flex-direction:column;gap:5px;}
.lb-row{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:5px;font-size:12.5px;border:1px solid transparent;}
.lb-row.player{background:rgba(212,167,60,.08);border-color:rgba(212,167,60,.3);}
.lb-rank{font-family:'JetBrains Mono',monospace;color:var(--sand-dim);font-size:11px;min-width:22px;}
.lb-name{color:var(--sand);min-width:70px;}
.lb-bar-wrap{flex:1;height:6px;background:var(--line);border-radius:3px;overflow:hidden;}
.lb-bar-fill{height:100%;border-radius:3px;transition:width .4s;}
.lb-vp{font-family:'JetBrains Mono',monospace;color:var(--foam);font-size:12px;min-width:32px;text-align:right;}
.lb-strat{font-size:10px;color:var(--sand-dim);font-style:italic;margin-left:4px;}
/* Logs */
.logs-layout{display:flex;gap:16px;align-items:flex-start;}
.logs-list{width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:6px;max-height:700px;overflow-y:auto;}
.log-entry{border:1px solid var(--line);border-radius:7px;padding:10px 14px;cursor:pointer;transition:.12s;}
.log-entry:hover{border-color:var(--brass-dim);}
.log-entry.selected{border-color:var(--foam);background:rgba(95,201,214,.05);}
.log-tag{font-family:'JetBrains Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.8px;padding:2px 7px;border-radius:20px;display:inline-block;margin-bottom:5px;}
.log-tag.sim{background:rgba(95,201,214,.12);color:var(--foam);border:1px solid rgba(95,201,214,.25);}
.log-tag.play{background:rgba(212,167,60,.12);color:var(--brass);border:1px solid rgba(212,167,60,.25);}
.log-date{font-size:11px;color:var(--sand-dim);font-family:'JetBrains Mono',monospace;}
.log-label{font-size:13px;color:var(--sand);margin:3px 0;}
.log-meta{font-size:11.5px;color:var(--sand-dim);}
.logs-detail{flex:1;min-width:0;}
.turn-nav{display:flex;align-items:center;gap:10px;margin:0 0 14px;}
.turn-counter{font-family:'JetBrains Mono',monospace;font-size:14px;color:var(--sand);flex:1;text-align:center;}
.team-turn-row{border:1px solid var(--line);border-radius:7px;margin-bottom:8px;overflow:hidden;}
.ttr-header{display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(0,0,0,.2);cursor:pointer;}
.ttr-name{font-size:13px;color:var(--sand);font-weight:500;}
.ttr-vp{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--brass);margin-left:auto;}
.ttr-body{padding:10px 14px;font-size:12.5px;color:var(--sand-dim);display:flex;gap:20px;flex-wrap:wrap;}
.ttr-section{}
.ttr-section .label{font-size:10.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--sand-dim);margin-bottom:3px;}
.ttr-section .value{font-family:'JetBrains Mono',monospace;color:var(--foam);font-size:13px;}
.ttr-section .extra{font-size:11px;color:var(--sand-dim);margin-top:2px;}
.ttr-player{border-color:rgba(212,167,60,.4);}
.ttr-player .ttr-header{background:rgba(212,167,60,.06);}
.stuck-badge{font-family:'JetBrains Mono',monospace;font-size:10px;padding:2px 7px;border-radius:20px;background:rgba(232,98,61,.15);border:1px solid rgba(232,98,61,.3);color:#ffc8b8;}
/* Rules */
.rules-stat-row{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0;}
.rules-stat{background:rgba(0,0,0,.2);border:1px solid var(--line);border-radius:7px;padding:12px 18px;text-align:center;flex:1;min-width:100px;}
.rules-stat .rs-v{font-family:'JetBrains Mono',monospace;font-size:28px;color:var(--brass);}
.rules-stat .rs-k{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--sand-dim);margin-top:3px;}
.day-bonus-table{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0 14px;}
.dbt-cell{background:rgba(0,0,0,.18);border:1px solid var(--line);border-radius:6px;padding:8px 12px;text-align:center;}
.dbt-cell .dv{font-family:'JetBrains Mono',monospace;font-size:18px;color:var(--foam);}
.dbt-cell .dk{font-size:11px;color:var(--sand-dim);margin-top:2px;}
.eco-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;}
.eco-pill{background:rgba(0,0,0,.18);border:1px solid var(--line);border-radius:6px;padding:6px 12px;font-size:12.5px;color:var(--sand-dim);}
.eco-pill b{color:var(--foam);}
/* Save flash */
.save-flash{font-size:12px;color:var(--kelp);font-style:italic;margin-left:10px;opacity:1;transition:opacity .5s;}
.save-flash.fade{opacity:0;}
`;

/* ============================================================================
   SHARED UI BITS
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
function stratName(id, L) {
  return { balanced: L.simStrategyBalanced, bigGame: L.simStrategyBigGame, patient: L.simStrategyPatient, windSaver: L.simStrategyWindSaver }[id] || id;
}

/* ============================================================================
   RULES TAB
   ========================================================================== */
function RulesTab({ L }) {
  return (
    <>
      <div className="panel">
        <div className="ph"><span className="num">⚓</span><h2>{L.rHeroTitle}</h2></div>
        <p className="note">{L.rHeroText}</p>
        <div className="rules-stat-row">
          <div className="rules-stat"><div className="rs-v">12</div><div className="rs-k">{L.rStatGroups}</div></div>
          <div className="rules-stat"><div className="rs-v">10</div><div className="rs-k">{L.rStatDays}</div></div>
          <div className="rules-stat"><div className="rs-v">729</div><div className="rs-k">{L.rStatTiles}</div></div>
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">1</span><h2>{L.rOceanTitle}</h2></div>
        <div className="note">
          <p>{L.rOceanText}</p>
          <p style={{ marginTop: 10, fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,0,0,.2)", padding: "8px 12px", borderRadius: 6, color: "var(--foam)", fontSize: 13 }}>
            {L.rOceanFormula}
          </p>
          <ul className="r">
            <li>{L.rOceanBase}</li>
            <li>{L.rOceanBonus}</li>
            <li>{L.rOceanPromo}</li>
          </ul>
          <p>{L.rOceanResult}</p>
          <p style={{ marginTop: 12, fontWeight: 600, color: "var(--sand)", fontSize: 12, letterSpacing: ".5px", textTransform: "uppercase" }}>{L.rDayBonusTitle}</p>
          <div className="day-bonus-table">
            <div className="dbt-cell"><div className="dv">+0</div><div className="dk">{L.rDayB1}</div></div>
            <div className="dbt-cell"><div className="dv">+2</div><div className="dk">{L.rDayB2}</div></div>
            <div className="dbt-cell"><div className="dv">+4</div><div className="dk">{L.rDayB3}</div></div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">2</span><h2>{L.rAtollTitle}</h2></div>
        <div className="note">
          <p>{L.rAtollText}</p>
          <ul className="r">
            <li>{L.rAtollSail}</li>
            <li>{L.rAtollSizes}</li>
            <li>{L.rAtollSolve}</li>
            <li>{L.rAtollCap}</li>
          </ul>
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">3</span><h2>{L.rWindTitle}</h2></div>
        <div className="note">
          <p>{L.rWindText}</p>
          <p style={{ marginTop: 8 }}>{L.rWindJoker}</p>
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">4</span><h2>{L.rTableTitle}</h2></div>
        <div className="note">
          <p>{L.rTableText}</p>
          <ul className="r">{L.rTableRows.map((row, i) => <li key={i}>{row}</li>)}</ul>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", background: "rgba(0,0,0,.2)", padding: "8px 12px", borderRadius: 6, color: "var(--foam)", fontSize: 12, marginTop: 8 }}>{L.rTableFormula}</p>
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">5</span><h2>{L.rGMTitle}</h2></div>
        <div className="note">
          <p>{L.rGMText}</p>
          <ol className="r">
            <li>{L.rGM1}</li>
            <li>{L.rGM2}</li>
          </ol>
          <p>{L.rGMBetween}</p>
          <p style={{ marginTop: 8 }}>{L.rGMPromo}</p>
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">∑</span><h2>{L.rEcoTitle}</h2></div>
        <div className="eco-row">
          <div className="eco-pill">{L.rEcoRow1}</div>
          <div className="eco-pill">{L.rEcoRow2}</div>
          <div className="eco-pill">{L.rEcoRow3}</div>
          <div className="eco-pill"><b>{L.rEcoRow4}</b></div>
        </div>
        <p className="note" style={{ marginTop: 10 }}>{L.rEcoNote}</p>
      </div>
    </>
  );
}

/* ============================================================================
   SETTINGS TAB
   ========================================================================== */
function SettingsTab({ settings, setSettings, eco, setEco, L }) {
  const [mode, setMode] = useState("basic");
  const [savedFlash, setSavedFlash] = useState(false);

  const flash = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500); };

  const applyEco = (fn) => { setEco(fn(eco)); flash(); };
  const applySettings = (fn) => { setSettings(fn(settings)); flash(); };

  const setTableRow = (i, k, v) => setEco({ ...eco, table: eco.table.map((r, j) => j === i ? { ...r, [k]: v } : r) });
  const addRow = () => setEco({ ...eco, table: [...eco.table, { winds: 1, maps: 0, vp: 0 }] });
  const removeRow = (i) => { if (eco.table.length <= 1) return; setEco({ ...eco, table: eco.table.filter((_, j) => j !== i) }); };
  const resetTable = () => { setEco({ ...eco, table: DEFAULT_TABLE }); flash(); };
  const setDayBonus = (i, k, v) => setEco({ ...eco, dayBonusSchedule: eco.dayBonusSchedule.map((e, j) => j === i ? { ...e, [k]: v } : e) });
  const addDayBonus = () => setEco({ ...eco, dayBonusSchedule: [...eco.dayBonusSchedule, { upToDay: eco.turnsPerGame, bonus: 0 }] });
  const removeDayBonus = (i) => { if (eco.dayBonusSchedule.length <= 1) return; setEco({ ...eco, dayBonusSchedule: eco.dayBonusSchedule.filter((_, j) => j !== i) }); };
  const toggleSize = (sz) => applySettings((s) => { const has = s.sizes.includes(sz); const next = has ? s.sizes.filter((x) => x !== sz) : [...s.sizes, sz].sort(); return { ...s, sizes: next.length ? next : s.sizes }; });

  function PresetRow({ label, options }) {
    return (
      <div className="preset-card">
        <h3>{label}</h3>
        <div className="preset-row">
          {options.map(({ label: l, action }) => (
            <button key={l} className="btn" onClick={action}>{l}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="ph">
          <span className="num">⚙</span>
          <h2>{L.tabs.settings}</h2>
          <div style={{ flex: 1 }} />
          <span className={"save-flash" + (savedFlash ? "" : " fade")}>{L.sSaved}</span>
        </div>
        <div className="mode-toggle">
          <button className={mode === "basic" ? "on" : ""} onClick={() => setMode("basic")}>{L.sBasicMode}</button>
          <button className={mode === "advanced" ? "on" : ""} onClick={() => setMode("advanced")}>{L.sAdvancedMode}</button>
        </div>

        {mode === "basic" && (
          <>
            <p className="note" style={{ marginBottom: 18 }}>{L.sBasicDesc}</p>
            <PresetRow label={L.sGameLength} options={[
              { label: L.s7days,  action: () => applyEco((e) => ({ ...e, turnsPerGame: 7 })) },
              { label: L.s10days, action: () => applyEco((e) => ({ ...e, turnsPerGame: 10 })) },
              { label: L.s14days, action: () => applyEco((e) => ({ ...e, turnsPerGame: 14 })) },
            ]} />
            <PresetRow label={L.sTeamCount} options={[4, 8, 12, 16, 20].map((n) => ({
              label: String(n), action: () => applyEco((e) => ({ ...e, numTeams: n })),
            }))} />
            <PresetRow label={L.sWindSupply} options={[
              { label: L.sWindLess,    action: () => applyEco((e) => ({ ...e, table: DEFAULT_TABLE.map((r) => ({ ...r, winds: Math.max(1, r.winds - 1) })) })) },
              { label: L.sWindDefault, action: () => applyEco((e) => ({ ...e, table: DEFAULT_TABLE })) },
              { label: L.sWindMore,    action: () => applyEco((e) => ({ ...e, table: DEFAULT_TABLE.map((r) => ({ ...r, winds: r.winds + 1 })) })) },
            ]} />
            <PresetRow label={L.sVPRewards} options={[
              { label: L.sVPLower,   action: () => applyEco((e) => ({ ...e, table: DEFAULT_TABLE.map((r) => ({ ...r, vp: Math.max(0, r.vp - 1) })) })) },
              { label: L.sVPDefault, action: () => applyEco((e) => ({ ...e, table: DEFAULT_TABLE })) },
              { label: L.sVPHigher,  action: () => applyEco((e) => ({ ...e, table: DEFAULT_TABLE.map((r) => ({ ...r, vp: r.vp + 1 })) })) },
            ]} />
            <PresetRow label={L.sPuzzleMix} options={[
              { label: L.sPuzzleEasy,     action: () => applyEco((e) => ({ ...e, promotion: 2 })) },
              { label: L.sPuzzleBalanced, action: () => applyEco((e) => ({ ...e, promotion: 0 })) },
              { label: L.sPuzzleHard,     action: () => applyEco((e) => ({ ...e, promotion: 0, puzzleBaseRows: { 5: 4, 6: 7, 7: 10, 8: 12 } })) },
            ]} />

            <div className="preset-card">
              <h3>{L.sPuzzleGenTitle}</h3>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div className="ctrl">
                  <label>{L.setSizes}</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[5, 6, 7, 8].map((sz) => (
                      <div key={sz} className={"sizebtn" + (settings.sizes.includes(sz) ? " on" : "")} onClick={() => toggleSize(sz)}>{sz}×{sz}</div>
                    ))}
                  </div>
                </div>
                <div className="ctrl">
                  <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0, cursor: "pointer" }}>
                    <input type="checkbox" checked={settings.jokers} onChange={(e) => applySettings((s) => ({ ...s, jokers: e.target.checked }))} />
                    {L.setJokers}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0, cursor: "pointer" }}>
                    <input type="checkbox" checked={settings.shallows} onChange={(e) => applySettings((s) => ({ ...s, shallows: e.target.checked }))} />
                    {L.setShallows}
                  </label>
                </div>
              </div>
            </div>
          </>
        )}

        {mode === "advanced" && (
          <p className="note">{L.sAdvancedIntro}</p>
        )}
      </div>

      {mode === "advanced" && (
        <>
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
                    <td><select className="sel" value={row.maps} onChange={(e) => setTableRow(i, "maps", +e.target.value)}><option value={0}>0</option><option value={1}>1</option></select></td>
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

          <div className="panel">
            <div className="ph"><span className="num">F</span><h2>{L.sPuzzleGenTitle}</h2></div>
            <div className="ctrl">
              <label>{L.setSizes}</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[5, 6, 7, 8].map((sz) => (
                  <div key={sz} className={"sizebtn" + (settings.sizes.includes(sz) ? " on" : "")} onClick={() => toggleSize(sz)}>{sz}×{sz}</div>
                ))}
              </div>
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
      )}
    </>
  );
}

/* ============================================================================
   SIMULATION TAB
   ========================================================================== */
function SimulationTab({ settings, eco, pool, lang, L }) {
  const [runSeed, setRunSeed] = useState(1);
  const [enabledStrategies, setEnabledStrategies] = useState(STRATEGIES.map((s) => s.id));
  const [savedFlash, setSavedFlash] = useState(false);

  const sim = useMemo(() => {
    setSeed(1000 + runSeed * 31 + eco.numTeams);
    const active = enabledStrategies.length ? enabledStrategies : [STRATEGIES[0].id];
    return Array.from({ length: eco.numTeams }, (_, i) => {
      const strategy = active[i % active.length];
      return { ...simulateTeamDetailed(eco, pool, settings, strategy), strategy };
    });
  }, [eco, pool, settings, runSeed, enabledStrategies]);

  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  const vps = sim.map((t) => t.vp);
  const sortedTeams = [...sim].sort((a, b) => a.vp - b.vp).map((t, i) => ({ name: "T" + (i + 1), vp: t.vp, strategy: t.strategy }));
  const avgVP = mean(vps);
  const avgSolved = mean(sim.map((t) => t.solved));
  const avgCascade = mean(sim.map((t) => t.cascadeTotal));
  const minVP = Math.min(...vps) || 0, maxVP = Math.max(...vps) || 0;
  const fairness = minVP > 0 ? maxVP / minVP : maxVP > 0 ? Infinity : 1;
  const avgStuck = mean(sim.map((t) => t.turnsStuck));
  const stuckPct = eco.turnsPerGame > 0 ? +(avgStuck / eco.turnsPerGame * 100).toFixed(1) : 0;

  const prog = useMemo(() => {
    const out = [];
    for (let i = 0; i < eco.turnsPerGame; i++) {
      const pt = { turn: i + 1 };
      const active = enabledStrategies.length ? enabledStrategies : [STRATEGIES[0].id];
      active.forEach((sid) => {
        const group = sim.filter((t) => t.strategy === sid);
        pt[sid] = group.length ? +mean(group.map((t) => t.perTurn[i] || 0)).toFixed(1) : 0;
      });
      out.push(pt);
    }
    return out;
  }, [sim, eco.turnsPerGame, enabledStrategies]);

  const backlog = useMemo(() => {
    const out = [];
    for (let i = 0; i < eco.turnsPerGame; i++) {
      out.push({ turn: i + 1, held: +mean(sim.map((t) => t.heldOverTime[i] || 0)).toFixed(2) });
    }
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

  const balance = useMemo(() => analyzeBalance(sim, eco), [sim, eco]);

  const stratColors = Object.fromEntries(STRATEGIES.map((s) => [s.id, s.color]));

  function renderBalanceIssue(issue) {
    const fnMap = {
      windScarcityHigh: () => L.bWindScarcityHigh(issue.val),
      windScarcityMid:  () => L.bWindScarcityMid(issue.val),
      windSurplus:      () => L.bWindSurplus(issue.val),
      windTight:        () => L.bWindTight(issue.val),
      fairHigh:         () => L.bFairHigh(issue.val),
      fairMid:          () => L.bFairMid(issue.val),
      fairOk:           () => L.bFairOk(issue.val),
      backlogHigh:      () => L.bBacklogHigh(issue.val),
      cascadeDeep:      () => L.bCascadeDeep(issue.val),
      oceanDominates:   () => L.bOceanDominates(issue.val),
      puzzleDominates:  () => L.bPuzzleDominates(issue.val),
      stratImbalance:   () => L.bStratImbalance(stratName(issue.topS, L), stratName(issue.botS, L), issue.val),
    };
    const msg = fnMap[issue.key]?.();
    if (!msg) return null;
    return (
      <div key={issue.key} className={"bc " + issue.sev}>
        <div className="bc-title">{msg.title}</div>
        <div className="bc-detail">{msg.detail}</div>
        {msg.suggest && <div className="bc-suggest">→ {msg.suggest}</div>}
      </div>
    );
  }

  const saveLog = () => {
    const entry = {
      id: Date.now().toString(),
      type: "simulation",
      date: new Date().toISOString(),
      label: new Date().toLocaleDateString(lang === "pl" ? "pl-PL" : "en-GB"),
      teamCount: eco.numTeams,
      turnCount: eco.turnsPerGame,
      strategies: [...new Set(sim.map((t) => t.strategy))],
      teams: sim.map((t, i) => ({
        id: i + 1, strategy: t.strategy, finalVP: t.vp, solved: t.solved,
        perTurn: t.perTurn, heldOverTime: t.heldOverTime,
        turnLog: t.turnLog || [],
      })),
      summary: { avgVP: +avgVP.toFixed(1), minVP, maxVP, fairness: +fairness.toFixed(2), avgSolved: +avgSolved.toFixed(1), stuckPct, avgCascade: +avgCascade.toFixed(1) },
    };
    storage.appendLog(entry);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const tt = { contentStyle: { background: "#0d2a36", border: "1px solid #1f4a5a", fontFamily: "JetBrains Mono", fontSize: 12 } };

  return (
    <>
      <div className="panel">
        <div className="ph">
          <span className="num">Σ</span><h2>{L.simTitle}</h2>
          <div style={{ flex: 1 }} />
          <span className={"save-flash" + (savedFlash ? "" : " fade")}>{L.simSaved}</span>
          <button className="btn ghost" onClick={saveLog}>{L.simSaveLog}</button>
          <button className="btn primary" onClick={() => setRunSeed((s) => s + 1)}>{L.simRerunBtn}</button>
        </div>
        <p className="note" style={{ marginBottom: 14 }}>{L.simDesc(eco.numTeams, eco.turnsPerGame, eco.tilesPerTurn)}</p>

        <p style={{ fontSize: 12, letterSpacing: ".5px", textTransform: "uppercase", color: "var(--sand-dim)", marginBottom: 8 }}>{L.simStrategiesTitle}</p>
        <p className="hint" style={{ marginBottom: 10 }}>{L.simStrategiesDesc}</p>
        <div className="strategy-grid">
          {STRATEGIES.map((s) => {
            const on = enabledStrategies.includes(s.id);
            const nameKey = "simStrategy" + s.id.charAt(0).toUpperCase() + s.id.slice(1);
            const descKey = nameKey + "Desc";
            return (
              <div key={s.id} className={"sc" + (on ? " on" : "")} onClick={() => {
                setEnabledStrategies((prev) => {
                  const next = on ? prev.filter((x) => x !== s.id) : [...prev, s.id];
                  return next.length ? next : prev;
                });
              }}>
                <div className="sc-name"><span className="sc-dot" style={{ background: s.color }} />{L[nameKey]}</div>
                <div className="sc-desc">{L[descKey]}</div>
              </div>
            );
          })}
        </div>

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
              {sortedTeams.map((t, i) => <Cell key={i} fill={stratColors[t.strategy] || "#5fc9d6"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="legend" style={{ marginTop: 8 }}>
          {STRATEGIES.filter((s) => enabledStrategies.includes(s.id)).map((s) => (
            <span key={s.id}><i className="sw" style={{ background: s.color, border: "none" }} />{stratName(s.id, L)}</span>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="ph"><span className="num">B</span><h2>{L.sProgTitle}</h2></div>
        <p className="note" style={{ marginBottom: 10 }}>{L.sProgDesc}</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={prog} margin={{ top: 8, right: 18, bottom: 4, left: -14 }}>
            <CartesianGrid stroke="#1f4a5a" strokeDasharray="2 4" />
            <XAxis dataKey="turn" stroke="#b7ad94" fontSize={11} />
            <YAxis stroke="#b7ad94" fontSize={11} />
            <Tooltip {...tt} />
            {STRATEGIES.filter((s) => enabledStrategies.includes(s.id)).map((s) => (
              <Line key={s.id} type="monotone" dataKey={s.id} name={stratName(s.id, L)} stroke={s.color} strokeWidth={2.5} dot={{ r: 2 }} />
            ))}
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
          <div className="kpibox"><div className="k">{L.sWindScarcity}</div><div className="v">{stuckPct}%</div></div>
        </div>
      </div>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="panel" style={{ flex: 2, minWidth: 300 }}>
          <div className="ph"><span className="num">D</span><h2>{L.sMapBacklogTitle}</h2></div>
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

        <div className="panel" style={{ flex: 1, minWidth: 260 }}>
          <div className="ph"><span className="num">E</span><h2>{L.simBalanceTitle}</h2></div>
          <p className="note" style={{ marginBottom: 12 }}>{L.simBalanceIntro}</p>
          {balance.issues.map((issue) => renderBalanceIssue(issue))}
        </div>
      </div>
    </>
  );
}

/* ============================================================================
   PLAY TAB
   ========================================================================== */
function PlayTab({ settings, eco, pool, lang, L }) {
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
  const [perTurnVP, setPerTurnVP] = useState([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const uid = useRef(1);

  const otherTeams = useMemo(() => {
    const count = Math.max(0, eco.numTeams - 1);
    return Array.from({ length: count }, (_, i) => {
      setSeed(7777 + i * 43);
      const strategy = STRATEGIES[i % STRATEGIES.length].id;
      const res = simulateTeamDetailed(eco, pool, settings, strategy);
      return { id: i + 2, strategy, ...res };
    });
  }, [eco, pool, settings]);

  const drawAtollObj = useCallback(() => {
    const sizes = settings.sizes.filter((sz) => (eco.mapStackSplit[sz] ?? 0) > 0);
    const pool2 = sizes.length ? sizes : settings.sizes;
    const sz = pool2[randint(0, pool2.length - 1)];
    const arr = pool[sz]; if (!arr || !arr.length) return null;
    return { ...arr[randint(0, arr.length - 1)], id: "a" + uid.current++ };
  }, [settings, pool, eco.mapStackSplit]);

  const reset = useCallback(() => {
    setBankWinds([]); setTrays({}); setResults({}); setActive(null); setAnim({});
    setTurn(1); setMovesLeft(eco.tilesPerTurn); setSubmitsLeft(eco.submissionCap); setVp(0); setLog([]); setPerTurnVP([]);
    const first = drawAtollObj();
    if (first) { setAtolls([first]); setTrays({ [first.id]: [] }); setActive(first.id); } else setAtolls([]);
  }, [eco.tilesPerTurn, eco.submissionCap, drawAtollObj]);

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
    setPerTurnVP((prev) => {
      const next = [...prev]; next[turn - 1] = vp; return next;
    });
    if (turn >= eco.turnsPerGame) { setTurn(eco.turnsPerGame + 1); return; }
    setTurn((t) => t + 1); setMovesLeft(eco.tilesPerTurn); setSubmitsLeft(eco.submissionCap);
  };
  const gameOver = turn > eco.turnsPerGame;

  const saveLog = () => {
    const finalPerTurn = [...perTurnVP]; finalPerTurn[turn - 1] = vp;
    const allTeams = [
      { id: 1, isPlayer: true, strategy: "player", finalVP: vp, perTurn: finalPerTurn, turnLog: [] },
      ...otherTeams.map((t) => ({ id: t.id, isPlayer: false, strategy: t.strategy, finalVP: t.vp, perTurn: t.perTurn, turnLog: t.turnLog || [] })),
    ];
    const allVPs = allTeams.map((t) => t.finalVP);
    const sortedVPs = [...allVPs].sort((a, b) => b - a);
    const rank = sortedVPs.indexOf(vp) + 1;
    const entry = {
      id: Date.now().toString(),
      type: "play",
      date: new Date().toISOString(),
      label: new Date().toLocaleDateString(lang === "pl" ? "pl-PL" : "en-GB"),
      turnCount: eco.turnsPerGame,
      playerFinalVP: vp,
      playerRank: rank,
      teamCount: eco.numTeams,
      teams: allTeams,
    };
    storage.appendLog(entry);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const clearResult = (id) => setResults((r) => { if (!(id in r)) return r; const n = { ...r }; delete n[id]; return n; });
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
        setTrays((t) => ({ ...t, [p.id]: [] }));
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

  const curTurn = Math.min(turn, eco.turnsPerGame);
  const allTeamsVP = [
    { id: 1, name: L.pYou, vp, isPlayer: true },
    ...otherTeams.map((t) => ({ id: t.id, name: `T${t.id}`, vp: t.perTurn[Math.min(curTurn - 1, t.perTurn.length - 1)] || 0, isPlayer: false, strategy: t.strategy })),
  ].sort((a, b) => b.vp - a.vp);
  const maxVPAll = Math.max(...allTeamsVP.map((t) => t.vp), 1);
  const myRank = allTeamsVP.findIndex((t) => t.isPlayer) + 1;

  return (
    <>
      <div className="panel">
        <div className="ph">
          <span className="num">▣</span><h2>{L.pTurn} {curTurn} {L.pOf} {eco.turnsPerGame}</h2>
          <div style={{ flex: 1 }} />
          <span className={"save-flash" + (savedFlash ? "" : " fade")}>{L.pGameSaved}</span>
          {gameOver && <button className="btn ghost" onClick={saveLog}>{L.pSaveLog}</button>}
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
          {!gameOver && <div className="score"><div className="k">bonus</div><div className="v mono" style={{ fontSize: 16, marginTop: 3, color: "var(--brass)" }}>+{getDayBonus(eco.dayBonusSchedule, curTurn)}</div></div>}
          {!gameOver && eco.numTeams > 1 && <div className="score"><div className="k">rank</div><div className="v mono" style={{ fontSize: 16, marginTop: 3 }}>{myRank}/{eco.numTeams}</div></div>}
          {gameOver && <div className="warn" style={{ flex: 1 }}>{L.pOver} {eco.numTeams > 1 ? L.pRank(myRank, eco.numTeams) : ""}</div>}
        </div>
      </div>

      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 3, display: "flex", flexDirection: "column", gap: 18, minWidth: 280 }}>
          <div className="panel">
            <div className="ph"><span className="num">01</span><h2>{L.pBankTitle}</h2></div>
            <p className="note" style={{ marginBottom: 12 }}>{L.pBankDesc}</p>
            <div className={"bankzone" + (over === "bank" ? " over" : "")} onDragOver={allow} onDragEnter={() => setOver("bank")} onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(null); }} onDrop={onDropBank}>
              {sortedBank.length === 0 && <span className="hint" style={{ alignSelf: "center" }}>⛵ {L.pOcean}</span>}
              {sortedBank.map((w) => (<div key={w.id} className={`wt ${w.type}`} draggable onDragStart={(e) => onBankDS(e, w)} onClick={() => clickAssign(w)}>{ARROW[w.type]}</div>))}
            </div>
          </div>

          <div className="panel">
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
                    <div style={{ display: "flex", justifyContent: "center", margin: "4px 0 9px" }}><MazeView p={p} shipPos={p.start} animPos={anim[p.id]} /></div>
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
        </div>

        <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 18 }}>
          {eco.numTeams > 1 && (
            <div className="panel">
              <div className="ph"><span className="num">🏆</span><h2>{L.pLeaderboard}</h2></div>
              <div className="lb-list">
                {allTeamsVP.map((t, rank) => (
                  <div key={t.id} className={"lb-row" + (t.isPlayer ? " player" : "")}>
                    <span className="lb-rank">#{rank + 1}</span>
                    <span className="lb-name">{t.name}{!t.isPlayer && t.strategy && <span className="lb-strat">{stratName(t.strategy, L)}</span>}</span>
                    <div className="lb-bar-wrap"><div className="lb-bar-fill" style={{ width: `${(t.vp / maxVPAll) * 100}%`, background: t.isPlayer ? "var(--brass)" : "var(--foam)" }} /></div>
                    <span className="lb-vp">{t.vp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="panel">
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
      </div>
    </>
  );
}

/* ============================================================================
   LOGS TAB
   ========================================================================== */
function LogsTab({ lang, L }) {
  const [logs, setLogs] = useState(() => storage.loadLogs());
  const [selected, setSelected] = useState(null);
  const [viewTurn, setViewTurn] = useState(1);
  const [expanded, setExpanded] = useState({});

  const refresh = () => { const l = storage.loadLogs(); setLogs(l); };
  const clearAll = () => { if (window.confirm(L.logsClearConfirm)) { storage.clearLogs(); setLogs([]); setSelected(null); } };

  useEffect(() => {
    if (selected !== null && !logs.find((l) => l.id === selected)) setSelected(null);
  }, [logs, selected]);

  const selectedLog = logs.find((l) => l.id === selected);

  const formatDate = (iso) => {
    try { return new Date(iso).toLocaleString(lang === "pl" ? "pl-PL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }); }
    catch { return iso; }
  };

  return (
    <>
      <div className="panel">
        <div className="ph">
          <span className="num">📋</span><h2>{L.logsTitle}</h2>
          <div style={{ flex: 1 }} />
          <button className="btn sm ghost" onClick={refresh}>↻</button>
          {logs.length > 0 && <button className="btn sm danger" onClick={clearAll}>{L.logsClearAll}</button>}
        </div>

        {logs.length === 0 && <p className="hint" style={{ padding: "20px 0" }}>{L.logsEmpty}</p>}

        {logs.length > 0 && (
          <div className="logs-layout">
            <div className="logs-list">
              {logs.map((entry) => (
                <div key={entry.id} className={"log-entry" + (selected === entry.id ? " selected" : "")}
                  onClick={() => { setSelected(entry.id); setViewTurn(1); setExpanded({}); }}>
                  <div>
                    <span className={"log-tag " + entry.type}>{entry.type === "simulation" ? L.logsTypeSim : L.logsTypePlay}</span>
                  </div>
                  <div className="log-date">{formatDate(entry.date)}</div>
                  <div className="log-meta">
                    {entry.type === "simulation"
                      ? `${L.logsGroups(entry.teamCount)} · ${L.logsTurns(entry.turnCount)} · ${L.logsAvgVP(entry.summary?.avgVP ?? "?")}`
                      : `${L.logsTurns(entry.turnCount)} · ${L.logsPlayerVP(entry.playerFinalVP)} · ${L.logsPlayerRank(entry.playerRank, entry.teamCount)}`
                    }
                  </div>
                </div>
              ))}
            </div>

            <div className="logs-detail">
              {!selectedLog && (
                <div className="panel"><p className="hint">{L.logsSelectHint}</p></div>
              )}
              {selectedLog && (() => {
                const maxTurn = selectedLog.turnCount || 10;
                const teams = selectedLog.teams || [];
                const teamAtTurn = (team) => (team.turnLog || [])[viewTurn - 1] || null;

                return (
                  <div className="panel">
                    <div className="ph">
                      <span className="num">{selectedLog.type === "simulation" ? "Σ" : "▣"}</span>
                      <h2>{formatDate(selectedLog.date)}</h2>
                    </div>

                    <div className="turn-nav">
                      <button className="btn sm" disabled={viewTurn <= 1} onClick={() => setViewTurn((t) => Math.max(1, t - 1))}>{L.logsPrev}</button>
                      <span className="turn-counter">{L.logsTurnTitle(viewTurn, maxTurn)}</span>
                      <button className="btn sm" disabled={viewTurn >= maxTurn} onClick={() => setViewTurn((t) => Math.min(maxTurn, t + 1))}>{L.logsNext}</button>
                    </div>

                    {teams.map((team) => {
                      const td = teamAtTurn(team);
                      const isPlayer = team.isPlayer;
                      const vpAtTurn = team.perTurn ? team.perTurn[viewTurn - 1] ?? 0 : 0;
                      const isExp = expanded[team.id];
                      return (
                        <div key={team.id} className={"team-turn-row" + (isPlayer ? " ttr-player" : "")}>
                          <div className="ttr-header" onClick={() => setExpanded((e) => ({ ...e, [team.id]: !e[team.id] }))}>
                            <span className="ttr-name">
                              {isPlayer ? L.logsYouLabel : L.logsTeamLabel(team.id, stratName(team.strategy, L))}
                            </span>
                            {td?.stuck && <span className="stuck-badge">{L.logsStuck}</span>}
                            <span className="ttr-vp">{vpAtTurn} VP</span>
                            <span style={{ marginLeft: 6, color: "var(--sand-dim)", fontSize: 12 }}>{isExp ? "▲" : "▼"}</span>
                          </div>
                          {isExp && td && (
                            <div className="ttr-body">
                              <div className="ttr-section">
                                <div className="label">{L.logsOceanPhase}</div>
                                <div className="value">+{td.oceanWinds}w · {td.oceanMaps > 0 ? "+1 map · " : ""} +{td.oceanVP}vp</div>
                                <div className="extra">{td.windsBefore} → {td.windsAfter} winds</div>
                              </div>
                              <div className="ttr-section">
                                <div className="label">{L.logsPuzzlePhase}</div>
                                {td.solveCount > 0
                                  ? <div className="value">{td.solveCount}× solved · +{td.solveWinds}w · +{td.solveVP}vp</div>
                                  : <div className="value" style={{ color: "var(--sand-dim)", fontStyle: "italic" }}>{L.logsNoEvents}</div>
                                }
                              </div>
                              <div className="ttr-section">
                                <div className="label">{L.pMaps}</div>
                                <div className="value">{td.mapsHeld}</div>
                              </div>
                            </div>
                          )}
                          {isExp && !td && (
                            <div className="ttr-body"><span className="hint">{L.logsNoEvents}</span></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================================
   ROOT APP
   ========================================================================== */
const DEFAULT_SETTINGS = { sizes: [5, 6, 7], shallows: false, jokers: true };
const DEFAULT_ECO = {
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
};

export default function App() {
  const [tab, setTab] = useState("rules");
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("atollsim_lang") || "pl"; } catch { return "pl"; } });
  const [settings, setSettingsState] = useState(() => storage.loadSettings(DEFAULT_SETTINGS));
  const [eco, setEcoState] = useState(() => storage.loadEco(DEFAULT_ECO));

  const setSettings = useCallback((s) => { setSettingsState(s); storage.saveSettings(s); }, []);
  const setEco = useCallback((e) => { setEcoState(e); storage.saveEco(e); }, []);
  const setLang2 = (l) => { setLang(l); try { localStorage.setItem("atollsim_lang", l); } catch {} };

  const pool = useMemo(() => { setSeed(424242); return buildPool(settings.sizes, settings.shallows, 30); }, [settings.sizes, settings.shallows]);
  const L = STR[lang];

  const TABS = ["rules", "settings", "simulation", "play", "logs"];

  return (
    <div className="atoll-root">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="masthead">
          <div className="title">Atoll Navigator<small>{L.sub}</small></div>
          <div className="langtoggle">
            <button className={lang === "pl" ? "on" : ""} onClick={() => setLang2("pl")}>PL</button>
            <button className={lang === "en" ? "on" : ""} onClick={() => setLang2("en")}>EN</button>
          </div>
        </div>
        <div className="tabs">
          {TABS.map((k) => (<div key={k} className={"tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{L.tabs[k]}</div>))}
        </div>
        {tab === "rules"      && <RulesTab L={L} />}
        {tab === "settings"   && <SettingsTab settings={settings} setSettings={setSettings} eco={eco} setEco={setEco} L={L} />}
        {tab === "simulation" && <SimulationTab key={lang} settings={settings} eco={eco} pool={pool} lang={lang} L={L} />}
        {tab === "play"       && <PlayTab key={lang + JSON.stringify(settings.sizes) + settings.shallows + eco.tilesPerTurn + eco.turnsPerGame} settings={settings} eco={eco} pool={pool} lang={lang} L={L} />}
        {tab === "logs"       && <LogsTab key={tab} lang={lang} L={L} />}
      </div>
    </div>
  );
}
