import React, { useState, useEffect, useMemo } from "react";
import { ReactFlow, Controls, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "../../CustomNode.jsx";
import MagicEdge from "../../MagicEdge.jsx";
import MapBackground from "./MapBackground.jsx";
import SkillPlanet3D from "../SkillPlanet3D.jsx";
import { GRADES_LIST } from "../../lib/appConstants.js";
import { useTheme } from "../../ThemeContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { fmtCountdown, getAlmatyNextMidnightAfter } from "../../lib/srsUtils.js";

// ── ИНДИВИДУАЛЬНЫЙ ПЛАН ОБУЧЕНИЯ ──────────────────────────────────────────────
// ── DIAGNOSTIC MODULE TREE ────────────────────────────────────────────────────

/**
 * Maps gap skills from the individual plan to modules via crossGradeLinks,
 * computes mastery per module, and determines locked/unlocked state.
 */
// Человекочитаемое имя навыка из его id (фолбэк, если нет в skillHierarchies).
function _fmtSkillId(id, vertical) {
  if (!id) return '???';
  let s = String(id);
  const vpfx = (vertical || '').toLowerCase();
  if (s.toLowerCase().startsWith(vpfx + '_')) s = s.slice(vpfx.length + 1);
  else if (s.toLowerCase().startsWith(vpfx)) s = s.slice(vpfx.length);
  s = s.replace(/^[_-]*(g\d+|grade_?\d+|\d{1,2})[_-]?/gi, '');
  s = s.replace(/[_-]*(g\d+|grade_?\d+|\d{1,2}кл?)[_-]*/gi, ' ');
  s = s.replace(/[_-]+/g, ' ').trim();
  if (!s || s.length < 2) {
    const parts = String(id).split(/[_-]/);
    s = parts.slice(-2).join(' ');
  }
  return s.split(' ').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

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

  // Детерминированный порядок — одинаковая раскладка при каждом входе
  // (порядок map-полей by_vertical/grade_modules из Firestore не гарантирован).
  allModules.sort((a, b) => a.gradeNum - b.gradeNum || a.id.localeCompare(b.id, 'ru'));
  for (const m of allModules) m.skills.sort((a, b) => a.id.localeCompare(b.id, 'ru'));

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

  edges.sort((a, b) => (a.src + '→' + a.tgt).localeCompare(b.src + '→' + b.tgt, 'ru'));

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
  // Стабильный порядок модулей в ряду (детерминированная раскладка).
  for (const g in gradeMap) gradeMap[g].sort((a, b) => a.id.localeCompare(b.id, 'ru'));
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
  // Для тултипа «что нужно, чтобы пробудить»: пререквизиты модуля с mastery < 100.
  const modById = Object.fromEntries((diagModules || []).map(m => [m.id, m]));
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
          // незакрытые пререквизиты — для hover-тултипа заблокированной планеты
          prereqsLeft: (mod.prerequisiteModuleIds || [])
            .map(pid => modById[pid])
            .filter(p => p && p.mastery < 100)
            .map(p => ({ name: p.moduleName, mastery: p.mastery })),
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

const DIAG_MOD_NODE_TYPES = { diagModuleNode: CustomNode, diagFloorLabel: DiagFloorLabelNode };
const DIAG_MOD_EDGE_TYPES = { diagModuleEdge: MagicEdge };

// ── DiagModulePopup ────────────────────────────────────────────────────────────
function DiagModulePopup({ module: mod, onClose, onStartTraining, skillMastery = {} }) {
  const { theme: THEME } = useTheme();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || 'anon';
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

  // Выбранный навык → планета. life: заблокирован=-1, иначе по этапам 0/0.4/0.8/1.
  const [selectedSkillId, setSelectedSkillId] = useState(mod.skills?.[0]?.id || null);
  const selSkill = mod.skills?.find(s => s.id === selectedSkillId) || mod.skills?.[0] || null;
  const selStages = Math.min(skillMastery[selSkill?.id]?.stagesCompleted || 0, 3);
  const planetLife = mod.isLocked ? -1 : [0, 0.4, 0.8, 1.0][selStages];
  const lifeLabel = mod.isLocked ? '🔒 Заблокирован'
    : ['🌑 Спящий мир', '🌱 Пробуждается', '🌊 Расцветает', '🌍 Цветущий мир'][selStages];

  // Оживление: from = последняя виденная стадия (localStorage по uid+skill), to = текущая.
  // Играет один раз — после прохождения этапа; persist в effect обновляет baseline.
  const planetTransition = useMemo(() => {
    if (!selSkill || mod.isLocked) return { from: planetLife, to: planetLife };
    let stored = null;
    try { const v = localStorage.getItem(`aapa_planet_seen_${uid}_${selSkill.id}`); stored = v == null ? null : Number(v); } catch {}
    const from = (stored != null && stored < selStages) ? [0, 0.4, 0.8, 1.0][Math.min(stored, 3)] : planetLife;
    return { from, to: planetLife };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSkillId, selStages, mod.isLocked, uid]);
  useEffect(() => {
    if (!selSkill) return;
    try { localStorage.setItem(`aapa_planet_seen_${uid}_${selSkill.id}`, String(selStages)); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSkillId]);

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
        {selSkill && (
          <div style={{ textAlign:'center', marginBottom:14 }}>
            <SkillPlanet3D key={selSkill.id} fromLife={planetTransition.from} toLife={planetTransition.to} size={200} />
            <div style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:THEME.text, fontWeight:600, marginTop:8, lineHeight:1.4 }}>{selSkill.name}</div>
            <div style={{ fontFamily:"'Montserrat',sans-serif", fontSize:12, fontWeight:700, color: selSkill.mastery>=100?'#22c55e':'#f59e0b', marginTop:2 }}>{lifeLabel} · {selSkill.mastery}%</div>
          </div>
        )}
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
          <div style={{ background:'rgba(234,179,8,0.10)', border:'1px solid rgba(234,179,8,0.35)', borderRadius:8, padding:'10px 12px', marginBottom:12, fontFamily:"'Inter',sans-serif", fontSize:12, color:'#a16207' }}>
            🎯 Сейчас в фокусе 3 навыка — это максимум, чтобы не распыляться. Заверши один, и откроется следующий.
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
              <div key={sk.id} onClick={() => setSelectedSkillId(sk.id)} style={{ background:THEME.bg, border:`1px solid ${sk.id===selectedSkillId?THEME.primary:THEME.border}`, borderRadius:8, padding:'10px 12px', cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:THEME.text, flex:1, lineHeight:1.5, paddingRight:8 }}>{sk.name}</div>
                  <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:13, color: sk.mastery>=100?'#22c55e':'#f59e0b', flexShrink:0 }}>{sk.mastery}%</div>
                </div>
                <div style={{ height:4, background:'#e2e8f0', borderRadius:2, overflow:'hidden', marginBottom:8 }}>
                  <div style={{ height:'100%', width:`${sk.mastery}%`, background: sk.mastery>=100?'#22c55e':'#f59e0b' }}/>
                </div>
                {skillSrsLocked && (
                  <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:6, padding:'6px 10px', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:14 }}>🚀</span>
                    <div>
                      <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:THEME.textLight }}>Корабль готовится к Этапу {stages+1}</div>
                      <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:800, fontSize:16, color:'#6366f1' }}>{fmtCountdown(msLeft)}</div>
                    </div>
                  </div>
                )}
                {sk.mastery < 100 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if(!anyDisabled) { onClose(); if(onStartTraining) onStartTraining(sk.id, sk.name); } }}
                    disabled={anyDisabled}
                    style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:13,
                      background: mod.isLocked ? '#94a3b8' : limitReached ? '#94a3b8' : skillSrsLocked ? '#6366f1' : '#22c55e',
                      border:'none', color:'#fff', padding:'8px 12px', borderRadius:7,
                      cursor: anyDisabled ? 'not-allowed' : 'pointer', width:'100%',
                      opacity: anyDisabled ? 0.6 : 1 }}>
                    {mod.isLocked ? '🔒 Модуль заблокирован' : limitReached ? '🎯 Сначала заверши один из 3 активных' : skillSrsLocked ? `🚀 Экспедиция через ${fmtCountdown(msLeft)}` : stages > 0 ? `🚀 Продолжить экспедицию (Этап ${stages+1})` : '🚀 Начать экспедицию'}
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
// focusRequest: { id, n } — внешняя просьба отцентрировать карту на модуле
// (n — счётчик, чтобы повторный клик по тому же модулю снова срабатывал).
function DiagnosticModuleTree({ diagData, onStartTraining, skillMastery = {}, focusRequest = null }) {
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState([]);
  const [popup, setPopup] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [rfInstance, setRfInstance] = useState(null);

  // Прогресс (доля освоенных модулей) — для тёплого подсвета фона.
  const progress = useMemo(() => {
    const mods = diagData?.modules || [];
    return mods.length ? mods.filter(m => m.mastery >= 100).length / mods.length : 0;
  }, [diagData]);

  useEffect(() => {
    if (!diagData?.modules?.length) return;
    const { nodes, edges } = buildDiagModuleLayout(diagData.modules, diagData.edges);
    // appearDelay — stagger появления снизу вверх (по этажу-классу); позиции НЕ меняем.
    const gradesAsc = [...new Set(nodes.filter(n => n.type === 'diagModuleNode').map(n => n.data.grade))]
      .sort((a, b) => GRADES_LIST.indexOf(a) - GRADES_LIST.indexOf(b));
    const perFloor = {};
    const enriched = nodes.map(n => {
      if (n.type !== 'diagModuleNode') return n;
      const fi = gradesAsc.indexOf(n.data.grade);
      const within = (perFloor[n.data.grade] = (perFloor[n.data.grade] || 0) + 1) - 1;
      return { ...n, data: { ...n.data, skillMastery, appearDelay: fi * 0.14 + within * 0.05 } };
    });
    setRFNodes(enriched);
    setRFEdges(edges);
  }, [diagData, skillMastery]);

  // Hover: подсветка входящих/исходящих рёбер (обновление только по событию).
  useEffect(() => {
    setRFEdges(prev => prev.map(e => {
      const conn = hoveredId && (e.source === hoveredId || e.target === hoveredId);
      return { ...e, data: { ...e.data, highlight: !!conn, dim: !!hoveredId && !conn } };
    }));
  }, [hoveredId, setRFEdges]);

  // Внешний фокус: плавно центрируем карту на запрошенном модуле и коротко
  // подсвечиваем его рёбра (тот же механизм, что hover).
  useEffect(() => {
    if (!focusRequest?.id || !rfInstance) return;
    const node = rfNodes.find(n => n.id === focusRequest.id);
    if (!node) return;
    rfInstance.setCenter(node.position.x + DM_NODE_W / 2, node.position.y + DM_NODE_H / 2, { zoom: 0.85, duration: 800 });
    setHoveredId(focusRequest.id);
    const t = setTimeout(() => setHoveredId(prev => prev === focusRequest.id ? null : prev), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, rfInstance]);

  return (
    <div className="diag-map-wrap" style={{ position:'relative', width:'100%', height:'76vh', borderRadius:12, overflow:'hidden', border:'1px solid #1a1a2e', boxShadow:'0 2px 16px rgba(0,0,0,0.08)' }}>
      <MapBackground progress={progress} />
      <div style={{ position:'absolute', inset:0, zIndex:1 }}>
        <ReactFlow
          nodes={rfNodes} edges={rfEdges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={DIAG_MOD_NODE_TYPES} edgeTypes={DIAG_MOD_EDGE_TYPES}
          onNodeClick={(_, node) => { if(node.type==='diagModuleNode'&&node.data?.skills?.length) setPopup(node.data); }}
          onNodeMouseEnter={(_, node) => { if(node.type==='diagModuleNode') setHoveredId(node.id); }}
          onNodeMouseLeave={() => setHoveredId(null)}
          fitView fitViewOptions={{ padding:0.20 }}
          nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
          proOptions={{ hideAttribution:true }}
          onInit={setRfInstance}
        >
          <Controls style={{ background:'rgba(255,255,255,0.10)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, overflow:'hidden', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)' }}/>
        </ReactFlow>
      </div>
      {/* Контролы карты (зум/fit/замок): карта всегда тёмная (MapBackground),
          поэтому кнопки — «стекло» light-on-dark в ОБЕИХ темах приложения.
          Явный color обязателен: дефолт xyflow — color:inherit, и в dark-теме
          body даёт #e6edf3 → светлые иконки на дефолтной белой кнопке were
          невидимы. Селектор scoped к .diag-map-wrap, чтобы не задеть другие
          ReactFlow-инстансы (admin SkillMapCanvas, ModuleTreeModal). */}
      <style>{`
        .diag-map-wrap .react-flow__controls { box-shadow:0 2px 12px rgba(0,0,0,0.35); }
        .diag-map-wrap .react-flow__controls-button {
          background:rgba(255,255,255,0.10);
          border-bottom:1px solid rgba(255,255,255,0.18);
          color:#fff;
        }
        .diag-map-wrap .react-flow__controls-button:last-child { border-bottom:none; }
        .diag-map-wrap .react-flow__controls-button svg { fill:#fff; }
        .diag-map-wrap .react-flow__controls-button:hover { background:rgba(255,255,255,0.22); }
      `}</style>
      {popup && <DiagModulePopup module={popup} onClose={() => setPopup(null)} onStartTraining={onStartTraining} skillMastery={skillMastery}/>}
    </div>
  );
}

export { buildDiagModuleTree };
export default DiagnosticModuleTree;
