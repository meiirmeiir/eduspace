import React, { useState, useEffect, useMemo } from "react";
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "../../CustomNode.jsx";
import MagicEdge from "../../MagicEdge.jsx";
import { THEME, GRADES_LIST } from "../../lib/appConstants.js";
import { fmtCountdown } from "../../lib/srsUtils.js";

// ── ИНДИВИДУАЛЬНЫЙ ПЛАН ОБУЧЕНИЯ ──────────────────────────────────────────────
// ── DIAGNOSTIC MODULE TREE ────────────────────────────────────────────────────

/**
 * Maps gap skills from the individual plan to modules via crossGradeLinks,
 * computes mastery per module, and determines locked/unlocked state.
 */
function buildDiagModuleTree(plan, skillProgress, crossGradeLinks, skillNamesMap={}, skillMasteryData={}) {
  const modules = plan?.modules || plan?.roadmap || [];

  // 1. Collect unique gap skills from plan.modules[].by_vertical
  const gapSkills = [];
  const seenSkills = new Set();
  for (const mod of modules) {
    const byV = mod.by_vertical || {};
    for (const [vertId, skills] of Object.entries(byV)) {
      for (const s of skills) {
        if (seenSkills.has(s.id)) continue;
        seenSkills.add(s.id);
        gapSkills.push({ id: s.id, grade: s.grade, vertical: vertId, passRate: s.passRate || 0 });
      }
    }
  }

  // 2. Build grade→modules map from crossGradeLinks (deduplicate by module_name)
  const gradeModulesMap = {};
  for (const link of (crossGradeLinks || [])) {
    for (const [grade, mods] of Object.entries(link.grade_modules || {})) {
      if (!gradeModulesMap[grade]) gradeModulesMap[grade] = [];
      for (const mod of mods) {
        if (!gradeModulesMap[grade].find(m => m.module_name === mod.module_name))
          gradeModulesMap[grade].push(mod);
      }
    }
  }

  // 3. Map each gap skill to a module via pivot_skills; unmatched → virtual module
  const modMap = {}, virtualMap = {};
  const sp = skillProgress || {};

  for (const skill of gapSkills) {
    const gradeStr = `${skill.grade} класс`;
    // Progress from mastery stages (0→0%, 1→40%, 2→80%, 3→100%), not diagnostic score
    const stages = skillMasteryData[skill.id]?.stagesCompleted || 0;
    const masteryPct = [0, 40, 80, 100][Math.min(stages, 3)];
    const skillDisplay = { id: skill.id, name: skillNamesMap[skill.id] || _fmtSkillId(skill.id, skill.vertical), mastery: masteryPct };
    let matched = false;

    if (gradeModulesMap[gradeStr]) {
      for (const modDef of gradeModulesMap[gradeStr]) {
        if ((modDef.pivot_skills || []).includes(skill.id)) {
          const key = `${gradeStr}::${modDef.module_name}`;
          if (!modMap[key]) {
            modMap[key] = {
              id: key, grade: gradeStr, gradeNum: skill.grade,
              moduleName: modDef.module_name, skills: [],
              prerequisiteModuleIds: (modDef.prerequisite_modules || []).map(prereqName => {
                for (const [g, mods] of Object.entries(gradeModulesMap)) {
                  if (mods.find(m => m.module_name === prereqName)) return `${g}::${prereqName}`;
                }
                return null;
              }).filter(Boolean),
            };
          }
          modMap[key].skills.push(skillDisplay);
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      const key = `${gradeStr}::${skill.vertical || 'Общее'}`;
      if (!virtualMap[key]) {
        const vLabel = ({ ALGEBRA:'Алгебра',GEOMETRY:'Геометрия',WORD_PROBLEMS:'Текстовые задачи',STATISTICS:'Статистика',FUNCTIONS:'Функции',EQUATIONS:'Уравнения',TRIGONOMETRY:'Тригонометрия',COMBINATORICS:'Комбинаторика',SEQUENCES:'Последовательности',DERIVATIVES:'Производные' })[skill.vertical] || skill.vertical || 'Общее';
        virtualMap[key] = { id: key, grade: gradeStr, gradeNum: skill.grade, moduleName: vLabel, skills: [], prerequisiteModuleIds: [] };
      }
      virtualMap[key].skills.push(skillDisplay);
    }
  }

  const allModules = [...Object.values(modMap), ...Object.values(virtualMap)];

  // 4. Compute mastery per module (average lastScore of its skills)
  for (const mod of allModules) {
    mod.mastery = mod.skills.length > 0
      ? Math.round(mod.skills.reduce((s, sk) => s + sk.mastery, 0) / mod.skills.length)
      : 0;
  }

  // 5. Build edges (only between modules present in this tree)
  const moduleIds = new Set(allModules.map(m => m.id));
  const edges = [];
  for (const mod of allModules) {
    for (const prereqId of (mod.prerequisiteModuleIds || [])) {
      if (moduleIds.has(prereqId)) edges.push({ src: prereqId, tgt: mod.id });
    }
  }

  // 6. Determine locked state: locked if any prereq module is IN the plan AND < 100% mastery.
  // If a prereq is NOT in the plan — student already mastered it (treat as 100%).
  const masteryById = Object.fromEntries(allModules.map(m => [m.id, m.mastery]));
  for (const mod of allModules) {
    mod.isLocked = (mod.prerequisiteModuleIds || []).some(pid => {
      if (!(pid in masteryById)) return false; // prereq not in plan → already mastered
      return masteryById[pid] < 100;
    });
  }

  return { modules: allModules, edges };
}

// Layout constants for the diagnostic module tree
const DM_NODE_W = 312, DM_NODE_H = 260, DM_H_GAP = 50, DM_V_GAP = 150, DM_LABEL_W = 0, DM_LEFT_MARGIN = -500;
const DM_GRADE_ICONS = { '5 класс':'🏕️','6 класс':'⚔️','7 класс':'🏰','8 класс':'👑','9 класс':'💎','10 класс':'🌟','11 класс':'🔮','12 класс':'🎯' };

function buildDiagModuleLayout(diagModules, diagEdges) {
  const gradeMap = {};
  for (const mod of (diagModules || [])) {
    if (!gradeMap[mod.grade]) gradeMap[mod.grade] = [];
    gradeMap[mod.grade].push(mod);
  }
  const sortedGrades = Object.keys(gradeMap).sort((a,b) => GRADES_LIST.indexOf(a) - GRADES_LIST.indexOf(b));
  if (!sortedGrades.length) return { nodes:[], edges:[] };

  const numFloors = sortedGrades.length;
  const floorY = idx => (numFloors - 1 - idx) * (DM_NODE_H + DM_V_GAP);

  const nodeCX = {}, nodeFloor = {};
  sortedGrades.forEach((grade, fi) => {
    const mods = gradeMap[grade];
    const totalW = mods.length * DM_NODE_W + (mods.length - 1) * DM_H_GAP;
    const startX = -totalW / 2;
    mods.forEach((mod, i) => {
      nodeCX[mod.id] = startX + i * (DM_NODE_W + DM_H_GAP) + DM_NODE_W / 2;
      nodeFloor[mod.id] = fi;
    });
  });

  const edgeDefs = (diagEdges || [])
    .filter(e => nodeFloor[e.src] !== undefined && nodeFloor[e.tgt] !== undefined)
    .map(e => ({ ...e, sf: nodeFloor[e.src], tf: nodeFloor[e.tgt] }));

  // Dynamic left margin: well to the left of all nodes
  const allCX = Object.values(nodeCX);
  const minNodeX = allCX.length ? Math.min(...allCX) - DM_NODE_W / 2 : -400;
  const LEFT_BUS = minNodeX - 80; // bus rail for multi-floor edges

  // Per-corridor lane assignment (y position for horizontal segment)
  function corrLaneY(corrIdx, totalInCorr, idx) {
    const corrTop = floorY(corrIdx + 1) + DM_NODE_H;
    const corrBot = floorY(corrIdx);
    const PAD = 16;
    if (totalInCorr === 1) return (corrTop + corrBot) / 2;
    return corrTop + PAD + (corrBot - corrTop - 2 * PAD) / (totalInCorr - 1) * idx;
  }

  // Group edges by exit corridor (source floor)
  const byExitCorr = {};
  edgeDefs.forEach(e => {
    const k = e.sf;
    if (!byExitCorr[k]) byExitCorr[k] = [];
    byExitCorr[k].push(e);
  });

  // Assign corridor y-lanes sorted left-to-right by src x
  const corrLane = {}; // key → y
  Object.entries(byExitCorr).forEach(([sfStr, edges]) => {
    const sf = parseInt(sfStr);
    const sorted = [...edges].sort((a, b) => nodeCX[a.src] - nodeCX[b.src]);
    sorted.forEach((e, i) => {
      corrLane[`${e.src}→${e.tgt}`] = corrLaneY(sf, sorted.length, i);
    });
  });

  // Per-node: x-offsets for multiple edges sharing same source or target
  const srcEdges = {}, tgtEdges = {};
  edgeDefs.forEach(e => {
    (srcEdges[e.src] = srcEdges[e.src] || []).push(e);
    (tgtEdges[e.tgt] = tgtEdges[e.tgt] || []).push(e);
  });
  const SPREAD = 14; // total horizontal spread for multi-edge nodes
  function xOffset(nodeId, edgeKey, map) {
    const arr = map[nodeId] || [];
    if (arr.length <= 1) return 0;
    const idx = arr.findIndex(e => `${e.src}→${e.tgt}` === edgeKey);
    return -SPREAD / 2 + idx * SPREAD / (arr.length - 1);
  }

  const edgeWaypoints = {};
  edgeDefs.forEach(e => {
    const key = `${e.src}→${e.tgt}`;
    const srcX = nodeCX[e.src] + xOffset(e.src, key, srcEdges);
    const tgtX = nodeCX[e.tgt] + xOffset(e.tgt, key, tgtEdges);
    const srcY = floorY(e.sf);           // top of source node (handle Position.Top)
    const tgtY = floorY(e.tf) + DM_NODE_H; // bottom of target node (handle Position.Bottom)
    const exitY = corrLane[key] ?? (floorY(e.sf) - DM_V_GAP / 2);

    if (e.tf === e.sf + 1) {
      // Adjacent floors: route through single corridor
      edgeWaypoints[key] = [
        { x: srcX, y: srcY },
        { x: srcX, y: exitY },
        { x: tgtX, y: exitY },
        { x: tgtX, y: tgtY },
      ];
    } else {
      // Multi-floor: route along left bus rail to avoid intermediate nodes
      // Assign a unique x-lane on the bus to avoid bus overlaps
      const busIdx = edgeDefs.filter(e2 => e2.tf - e2.sf > 1).indexOf(e);
      const busX = LEFT_BUS - busIdx * 16;
      // Entry y: center of corridor just below target
      const entryY = (floorY(e.tf) + DM_NODE_H + floorY(e.tf - 1)) / 2;
      edgeWaypoints[key] = [
        { x: srcX, y: srcY },
        { x: srcX, y: exitY },
        { x: busX,  y: exitY },
        { x: busX,  y: entryY },
        { x: tgtX, y: entryY },
        { x: tgtX, y: tgtY },
      ];
    }
  });

  const nodes = [];
  sortedGrades.forEach((grade, fi) => {
    const mods = gradeMap[grade];
    const y = floorY(fi);
    const totalW = mods.length * DM_NODE_W + (mods.length - 1) * DM_H_GAP;
    const startX = -totalW / 2;
    nodes.push({
      id:`__dml__${grade}`, type:'diagFloorLabel',
      position:{ x: startX, y: y - 52 },
      data:{ grade, icon: DM_GRADE_ICONS[grade] || '📚', totalW },
      selectable:false, draggable:false,
    });
    mods.forEach((mod, i) => {
      nodes.push({
        id: mod.id, type:'diagModuleNode',
        position:{ x: startX + i * (DM_NODE_W + DM_H_GAP), y },
        data:{
          // ── поля для DiagModulePopup (не удалять) ──
          label:mod.moduleName, grade, gradeNum:mod.gradeNum, skills:mod.skills, mastery:mod.mastery, isLocked:mod.isLocked, icon:DM_GRADE_ICONS[grade]||'📚',
          // ── поля для CustomNode ──
          title: mod.moduleName,
          status: mod.isLocked ? 'locked' : mod.mastery >= 100 ? 'mastered' : 'active',
          micro_skills: (mod.skills||[]).map(sk => ({
            id: sk.id,
            phase_status: sk.mastery >= 100 ? 'mastered' : sk.mastery >= 80 ? 'phase_B_done' : sk.mastery >= 40 ? 'phase_A_done' : 'not_started',
          })),
        },
      });
    });
  });

  const rfEdges = edgeDefs.map((e, i) => {
    const srcMod = (diagModules||[]).find(m => m.id === e.src);
    return {
      id:`de${i}`, source:e.src, target:e.tgt,
      type:'diagModuleEdge', zIndex:0,
      data:{ waypoints:edgeWaypoints[`${e.src}→${e.tgt}`]||[], isUnlocked:(srcMod?.mastery||0)>=100 },
    };
  });

  return { nodes, edges: rfEdges };
}

// ── Pixel game background (grass + trees + rocks + stream) ────────────────────
function StarryNightBackground() {
  const stars = useMemo(() => {
    const s = []; let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 90; i++) s.push({ x: rng()*100, y: rng()*100, r: rng()*1.3+0.4, op: rng()*0.55+0.35 });
    return s;
  }, []);
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', zIndex:0, pointerEvents:'none' }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,#030818 0%,#050d28 40%,#0a1540 75%,#060c20 100%)' }}/>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} aria-hidden="true">
        {stars.map((s,i) => <circle key={i} cx={`${s.x.toFixed(2)}%`} cy={`${s.y.toFixed(2)}%`} r={s.r} fill="#fff" opacity={s.op}/>)}
        <circle cx="86%" cy="11%" r="22" fill="#f8f4e0" opacity="0.9"/>
        <circle cx="86%" cy="11%" r="26" fill="#fffde8" opacity="0.12"/>
        <circle cx="80%" cy="8%" r="4" fill="#eae8cc" opacity="0.4"/>
        <circle cx="91%" cy="16%" r="3" fill="#eae8cc" opacity="0.3"/>
        <ellipse cx="25%" cy="30%" rx="18%" ry="8%" fill="#1a0060" opacity="0.09"/>
        <ellipse cx="65%" cy="55%" rx="14%" ry="6%" fill="#000080" opacity="0.08"/>
      </svg>
    </div>
  );
}

function PixelGameBackground() {
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', zIndex:0, pointerEvents:'none' }}>
      <div style={{ position:'absolute', inset:0, background:'#2d5a1b' }}/>
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.38 }} aria-hidden="true">
        <defs>
          <pattern id="pgGrassPat" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect x="0"  y="0"  width="8" height="8" fill="#3a7a28" opacity="0.6"/>
            <rect x="16" y="16" width="8" height="8" fill="#3a7a28" opacity="0.6"/>
            <rect x="8"  y="0"  width="8" height="8" fill="#4a6b25" opacity="0.3"/>
            <rect x="0"  y="16" width="8" height="8" fill="#4a6b25" opacity="0.3"/>
            <rect x="4"  y="4"  width="4" height="4" fill="#2d5a1b" opacity="0.5"/>
            <rect x="16" y="4"  width="4" height="4" fill="#4a9a34" opacity="0.28"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pgGrassPat)"/>
      </svg>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.48) 100%)' }}/>
      {/* Trees */}
      <svg style={{ position:'absolute', left:'2%', top:'4%' }} width="56" height="76" aria-hidden="true">
        <rect x="20" y="48" width="16" height="28" fill="#3d2a1a"/><rect x="24" y="48" width="8" height="28" fill="#5a3f28"/>
        <rect x="6" y="34" width="44" height="16" fill="#1a3d0a"/><rect x="10" y="20" width="36" height="16" fill="#2d5a1b"/>
        <rect x="16" y="6" width="24" height="16" fill="#3a7a28"/><rect x="20" y="8" width="10" height="4" fill="#5aaa3a" opacity="0.7"/>
      </svg>
      <svg style={{ position:'absolute', right:'3%', top:'6%' }} width="52" height="70" aria-hidden="true">
        <rect x="18" y="44" width="14" height="26" fill="#3d2a1a"/><rect x="22" y="44" width="7" height="26" fill="#5a3f28"/>
        <rect x="5" y="31" width="40" height="15" fill="#1a3d0a"/><rect x="9" y="18" width="32" height="15" fill="#2d5a1b"/>
        <rect x="14" y="5" width="22" height="15" fill="#3a7a28"/><rect x="17" y="7" width="9" height="4" fill="#5aaa3a" opacity="0.6"/>
      </svg>
      <svg style={{ position:'absolute', left:'0.5%', bottom:'7%' }} width="60" height="80" aria-hidden="true">
        <rect x="22" y="50" width="16" height="30" fill="#3d2a1a"/><rect x="26" y="50" width="8" height="30" fill="#5a3f28"/>
        <rect x="8" y="36" width="44" height="16" fill="#1a3d0a"/><rect x="12" y="22" width="36" height="16" fill="#2d5a1b"/>
        <rect x="18" y="6" width="24" height="18" fill="#3a7a28"/><rect x="22" y="8" width="10" height="5" fill="#5aaa3a" opacity="0.65"/>
      </svg>
      <svg style={{ position:'absolute', right:'1.5%', bottom:'5%' }} width="52" height="68" aria-hidden="true">
        <rect x="18" y="42" width="15" height="26" fill="#3d2a1a"/><rect x="22" y="42" width="7" height="26" fill="#5a3f28"/>
        <rect x="4" y="29" width="44" height="15" fill="#1a3d0a"/><rect x="8" y="16" width="36" height="15" fill="#2d5a1b"/>
        <rect x="14" y="4" width="24" height="14" fill="#3a7a28"/>
      </svg>
      <svg style={{ position:'absolute', left:'6%', top:'38%' }} width="44" height="60" aria-hidden="true">
        <rect x="15" y="36" width="13" height="24" fill="#3d2a1a"/><rect x="18" y="36" width="7" height="24" fill="#5a3f28"/>
        <rect x="3" y="24" width="37" height="14" fill="#1a3d0a"/><rect x="6" y="13" width="31" height="13" fill="#2d5a1b"/>
        <rect x="11" y="3" width="21" height="12" fill="#3a7a28"/>
      </svg>
      <svg style={{ position:'absolute', right:'5%', top:'42%' }} width="48" height="64" aria-hidden="true">
        <rect x="17" y="40" width="14" height="24" fill="#3d2a1a"/><rect x="20" y="40" width="7" height="24" fill="#5a3f28"/>
        <rect x="4" y="27" width="40" height="15" fill="#1a3d0a"/><rect x="7" y="14" width="33" height="15" fill="#2d5a1b"/>
        <rect x="12" y="4" width="23" height="12" fill="#3a7a28"/>
      </svg>
      {/* Rocks */}
      <svg style={{ position:'absolute', left:'9%', top:'47%' }} width="46" height="30" aria-hidden="true">
        <rect x="2" y="8" width="38" height="20" fill="#525252" rx="2"/><rect x="0" y="14" width="23" height="16" fill="#666" rx="2"/>
        <rect x="23" y="10" width="23" height="18" fill="#484848" rx="2"/><rect x="2" y="8" width="38" height="5" fill="#7a7a7a" rx="2"/>
      </svg>
      <svg style={{ position:'absolute', right:'8%', top:'52%' }} width="40" height="26" aria-hidden="true">
        <rect x="2" y="6" width="32" height="18" fill="#525252" rx="2"/><rect x="0" y="11" width="20" height="14" fill="#666" rx="2"/>
        <rect x="20" y="8" width="20" height="16" fill="#484848" rx="2"/><rect x="2" y="6" width="32" height="5" fill="#7a7a7a" rx="2"/>
      </svg>
      <svg style={{ position:'absolute', left:'47%', bottom:'13%' }} width="36" height="22" aria-hidden="true">
        <rect x="2" y="4" width="28" height="16" fill="#525252" rx="2"/><rect x="0" y="9" width="17" height="13" fill="#666" rx="2"/>
        <rect x="17" y="6" width="17" height="14" fill="#484848" rx="2"/><rect x="2" y="4" width="28" height="4" fill="#7a7a7a" rx="2"/>
      </svg>
      {/* Pixel stream */}
      <svg style={{ position:'absolute', bottom:'17%', left:0, width:'100%', height:'30px', opacity:0.78 }} aria-hidden="true">
        <defs>
          <pattern id="pgStreamPat" x="0" y="0" width="48" height="30" patternUnits="userSpaceOnUse">
            <rect width="48" height="30" fill="#1a4878"/>
            <rect x="0" y="7"  width="48" height="8" fill="#2468a0"/>
            <rect x="0" y="15" width="48" height="8" fill="#1a5a90"/>
            <rect x="6"  y="3"  width="10" height="4" fill="#4090c8" opacity="0.55"/>
            <rect x="28" y="19" width="10" height="4" fill="#4090c8" opacity="0.55"/>
            <rect x="14" y="11" width="8"  height="3" fill="#6ab0e0" opacity="0.4"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pgStreamPat)"/>
        <rect width="100%" height="3" y="9" fill="#5aaada" opacity="0.5"/>
      </svg>
    </div>
  );
}

// ── CrystalGem ─────────────────────────────────────────────────────────────────
function CrystalGem({ stage }) {
  // stage: 0=gray, 1=dull green, 2=yellow, 3=bright gold
  const cfg = [
    { fill:'#475569', stroke:'#334155', glow:false },
    { fill:'#4ade80', stroke:'#16a34a', glow:false },
    { fill:'#fbbf24', stroke:'#d97706', glow:false },
    { fill:'#f59e0b', stroke:'#b45309', glow:true  },
  ][stage] || { fill:'#475569', stroke:'#334155', glow:false };
  return (
    <svg width="13" height="17" viewBox="0 0 13 17" style={{ filter: cfg.glow ? 'drop-shadow(0 0 4px #f59e0b)' : 'none', flexShrink:0 }}>
      <polygon points="6.5,0 13,5 9.5,17 3.5,17 0,5" fill={cfg.fill} stroke={cfg.stroke} strokeWidth="0.8"/>
      <polygon points="6.5,1 10,5 8.5,5 5.8,1" fill="rgba(255,255,255,0.38)"/>
    </svg>
  );
}

// ── DiagFloorLabelNode — grade banner above each floor ────────────────────
function DiagFloorLabelNode({ data }) {
  const { grade, icon, totalW = 280 } = data;
  return (
    <div style={{ width: Math.max(totalW, 200), pointerEvents:'none' }}>
      <div className="grade-banner">
        <span className="grade-banner-icon">{icon}</span>
        <span className="grade-banner-text">{grade}</span>
        <span className="grade-banner-icon">{icon}</span>
      </div>
    </div>
  );
}

// ── DiagModuleCard ─────────────────────────────────────────────────────────────
function DiagModuleCard({ data }) {
  const { label, mastery, isLocked, grade } = data;

  const statusColor = isLocked ? '#94a3b8' : mastery >= 100 ? '#22c55e' : mastery > 0 ? '#f59e0b' : '#6366f1';
  const statusLabel = isLocked ? '🔒 Заблокировано' : mastery >= 100 ? '✅ Освоен' : mastery > 0 ? '⚡ В процессе' : '▶ Начать';
  const bgColor     = isLocked ? '#f8fafc' : mastery >= 100 ? '#f0fdf4' : mastery > 0 ? '#fffbeb' : '#f5f3ff';
  const borderColor = isLocked ? '#cbd5e1' : mastery >= 100 ? '#86efac' : mastery > 0 ? '#fcd34d' : '#c4b5fd';

  return (
    <div style={{ width: DM_NODE_W, height: DM_NODE_H, position: 'relative', userSelect: 'none', cursor: 'pointer', zIndex: 10 }}>
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }}/>
      <Handle type="source" position={Position.Top}    style={{ opacity: 0 }}/>
      <div style={{
        width: '100%', height: '100%', boxSizing: 'border-box',
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderLeft: `4px solid ${statusColor}`,
        borderRadius: 8,
        padding: '8px 10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily:"'Inter',sans-serif", fontWeight: 700, fontSize: 11, color: '#1e293b', lineHeight: 1.35, marginBottom: 2, wordBreak: 'break-word' }}>{label}</div>
          <div style={{ fontSize: 10, color: '#64748b', fontFamily:"'Inter',sans-serif" }}>{grade}</div>
        </div>
        <div>
          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${mastery}%`, background: statusColor, borderRadius: 2, transition: 'width 0.3s' }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: statusColor, fontFamily:"'Inter',sans-serif", fontWeight: 600 }}>{statusLabel}</span>
            <span style={{ fontSize: 10, color: '#64748b', fontFamily:"'Inter',sans-serif" }}>{mastery}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DiagModuleArrow ─────────────────────────────────────────────────────────────
function DiagModuleArrow({ id, data }) {
  const { waypoints=[], isUnlocked } = data||{};
  if (waypoints.length < 2) return null;

  const color = isUnlocked ? '#4ade80' : '#cbd5e1';
  const mid   = `dma-${id}`;
  const d     = waypoints.map((p,i)=>`${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <g>
      <defs>
        <marker id={mid} markerWidth={6} markerHeight={5} refX={5} refY={2.5} orient="auto">
          <polygon points="0 0, 6 2.5, 0 5" fill={color}/>
        </marker>
      </defs>
      {/* Main line — тонкая, без glow */}
      <path d={d} fill="none" stroke={color} strokeWidth={1.5}
        strokeDasharray={isUnlocked ? 'none' : '5 5'}
        strokeLinecap="round" strokeLinejoin="round"
        markerEnd={`url(#${mid})`}
        opacity={isUnlocked ? 0.7 : 0.35}
      />
    </g>
  );
}

const DIAG_MOD_NODE_TYPES = { diagModuleNode: CustomNode, diagFloorLabel: DiagFloorLabelNode };
const DIAG_MOD_EDGE_TYPES = { diagModuleEdge: MagicEdge };

// ── DiagModulePopup ────────────────────────────────────────────────────────────
function DiagModulePopup({ module: mod, onClose, onStartTraining, skillMastery = {} }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const fn = e => { if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Count active skills (started but not finished)
  const activeCount = Object.values(skillMastery).filter(
    s => (s.stagesCompleted || 0) > 0 && (s.stagesCompleted || 0) < 3
  ).length;

  return (
    <div style={{ position:'absolute', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.5)' }}
         onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:THEME.surface, border:`1px solid ${THEME.border}`, borderRadius:12, padding:'20px 22px', maxWidth:420, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'80vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:15, color:THEME.primary, lineHeight:1.4, marginBottom:4 }}>{mod.label}</div>
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight }}>{mod.grade}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:THEME.textLight, cursor:'pointer', fontSize:20, padding:'0 4px', lineHeight:1 }}>✕</button>
        </div>
        <div style={{ background:THEME.bg, border:`1px solid ${THEME.border}`, borderRadius:8, padding:'10px 12px', marginBottom:14 }}>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:THEME.textLight, marginBottom:6 }}>Освоение модуля</div>
          <div style={{ height:8, background:'#e2e8f0', borderRadius:4, overflow:'hidden', marginBottom:5 }}>
            <div style={{ height:'100%', width:`${mod.mastery}%`, background: mod.mastery>=100?'#22c55e':'#f59e0b' }}/>
          </div>
          <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color: mod.mastery>=100?'#22c55e':'#f59e0b' }}>{mod.mastery}%</div>
        </div>
        {mod.isLocked && (
          <div style={{ background:'rgba(148,163,184,0.12)', border:'1px solid #cbd5e1', borderRadius:8, padding:'10px 12px', marginBottom:12, fontFamily:"'Inter',sans-serif", fontSize:12, color:'#475569', display:'flex', alignItems:'center', gap:8 }}>
            🔒 Модуль заблокирован. Сначала освой предыдущие модули, чтобы открыть этот.
          </div>
        )}
        {!mod.isLocked && activeCount >= 3 && (
          <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'10px 12px', marginBottom:12, fontFamily:"'Inter',sans-serif", fontSize:12, color:'#dc2626' }}>
            ⚠️ У тебя уже 3 активных навыка. Сначала заверши один из них, чтобы начать новый.
          </div>
        )}
        <div style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:THEME.textLight, marginBottom:10 }}>Навыки с пробелами:</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {mod.skills.map(sk => {
            const ms = skillMastery[sk.id] || {};
            const stages = ms.stagesCompleted || 0;
            const lastAt = ms.lastStageCompletedAt || null;
            const unlockAt = lastAt ? getAlmatyNextMidnightAfter(new Date(lastAt)) : null;
            const msLeft = unlockAt ? Math.max(0, unlockAt.getTime() - now) : 0;
            const skillSrsLocked = stages > 0 && stages < 3 && msLeft > 0;
            const isNew = stages === 0;
            const limitReached = isNew && activeCount >= 3;
            const anyDisabled = mod.isLocked || limitReached || skillSrsLocked;
            return (
              <div key={sk.id} style={{ background:THEME.bg, border:`1px solid ${THEME.border}`, borderRadius:8, padding:'10px 12px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:THEME.text, flex:1, lineHeight:1.5, paddingRight:8 }}>{sk.name}</div>
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color: sk.mastery>=100?'#22c55e':'#f59e0b', flexShrink:0 }}>{sk.mastery}%</div>
                </div>
                <div style={{ height:4, background:'#e2e8f0', borderRadius:2, overflow:'hidden', marginBottom:8 }}>
                  <div style={{ height:'100%', width:`${sk.mastery}%`, background: sk.mastery>=100?'#22c55e':'#f59e0b' }}/>
                </div>
                {skillSrsLocked && (
                  <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:6, padding:'6px 10px', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:14 }}>🌙</span>
                    <div>
                      <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:THEME.textLight }}>Этап {stages+1} откроется через</div>
                      <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:16, color:'#6366f1' }}>{fmtCountdown(msLeft)}</div>
                    </div>
                  </div>
                )}
                {sk.mastery < 100 && (
                  <button
                    onClick={() => { if(!anyDisabled) { onClose(); if(onStartTraining) onStartTraining(sk.id, sk.name); } }}
                    disabled={anyDisabled}
                    style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:13,
                      background: mod.isLocked ? '#94a3b8' : limitReached ? '#94a3b8' : skillSrsLocked ? '#6366f1' : '#22c55e',
                      border:'none', color:'#fff', padding:'8px 12px', borderRadius:7,
                      cursor: anyDisabled ? 'not-allowed' : 'pointer', width:'100%',
                      opacity: anyDisabled ? 0.6 : 1 }}>
                    {mod.isLocked ? '🔒 Модуль заблокирован' : limitReached ? '🔒 Лимит: 3 активных навыка' : skillSrsLocked ? `🌙 Продолжить (${fmtCountdown(msLeft)})` : stages > 0 ? `▶ Продолжить (Этап ${stages+1})` : '▶ Начать усвоение'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── DiagnosticModuleTree ───────────────────────────────────────────────────────
function DiagnosticModuleTree({ diagData, onStartTraining, skillMastery = {} }) {
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState([]);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    if (!diagData?.modules?.length) return;
    const { nodes, edges } = buildDiagModuleLayout(diagData.modules, diagData.edges);
    // Enrich nodes with skillMastery data
    const enriched = nodes.map(n =>
      n.type === 'diagModuleNode' ? { ...n, data: { ...n.data, skillMastery } } : n
    );
    setRFNodes(enriched);
    setRFEdges(edges);
  }, [diagData, skillMastery]);

  return (
    <div style={{ position:'relative', width:'100%', height:'76vh', borderRadius:12, overflow:'hidden', border:'1px solid #1a1a2e', boxShadow:'0 2px 16px rgba(0,0,0,0.08)' }}>
      <div style={{ position:'absolute', inset:0 }}>
        <ReactFlow
          nodes={rfNodes} edges={rfEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={DIAG_MOD_NODE_TYPES} edgeTypes={DIAG_MOD_EDGE_TYPES}
          onNodeClick={(_, node) => { if(node.type==='diagModuleNode'&&node.data?.skills?.length) setPopup(node.data); }}
          fitView fitViewOptions={{ padding:0.20 }}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          proOptions={{ hideAttribution:true }}
        >
          <Controls style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8 }}/>
          <Background color="#1e2a4a" gap={24} size={1}/>
        </ReactFlow>
      </div>
      {popup && <DiagModulePopup module={popup} onClose={() => setPopup(null)} onStartTraining={onStartTraining} skillMastery={skillMastery}/>}
    </div>
  );
}

export { buildDiagModuleTree };
export default DiagnosticModuleTree;
