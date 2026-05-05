import React, { useEffect } from "react";
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "../../CustomNode.jsx";
import { GRADES_LIST } from "../../lib/appConstants.js";

// ── ADMIN ─────────────────────────────────────────────────────────────────────
// ── Module Tree (Cross-Grade visualisation) ────────────────────────────────────
const MOD_GRADE_BG  = { '5 класс':'#dbeafe','6 класс':'#dcfce7','7 класс':'#fef9c3','8 класс':'#fee2e2','9 класс':'#ede9fe','10 класс':'#fce7f3','11 класс':'#ffedd5','12 класс':'#f1f5f9' };
const MOD_GRADE_BDR = { '5 класс':'#93c5fd','6 класс':'#86efac','7 класс':'#fde047','8 класс':'#fca5a5','9 класс':'#c4b5fd','10 класс':'#f9a8d4','11 класс':'#fdba74','12 класс':'#cbd5e1' };


function ModuleFloorLabelNode({ data }){
  const { grade, bg, border } = data;
  return (
    <div style={{ width:130, height:76, background:bg, border:`2px solid ${border}`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
      <Handle type="target" position={Position.Bottom} style={{ opacity:0 }}/>
      <Handle type="source" position={Position.Top}    style={{ opacity:0 }}/>
      <div style={{ fontWeight:800, fontSize:13, color:'#334155', textAlign:'center', lineHeight:1.5, whiteSpace:'pre-line' }}>{grade.replace(' ','\n')}</div>
    </div>
  );
}

// Custom edge: orthogonal path through pre-computed waypoints (no node overlap, no crossings)
function CustomModuleEdge({ id, data }){
  const { waypoints=[] } = data||{};
  if(waypoints.length<2) return null;
  const d = waypoints.map((p,i)=>`${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const markerId = `cme-${id}`;
  return(
    <g>
      <defs>
        <marker id={markerId} markerWidth={8} markerHeight={6} refX={7} refY={3} orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#6366f1"/>
        </marker>
      </defs>
      {/* Shadow */}
      <path d={d} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={5} strokeLinejoin="miter"/>
      {/* Main line */}
      <path d={d} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinejoin="miter" markerEnd={`url(#${markerId})`}/>
    </g>
  );
}

const MOD_TREE_NODE_TYPES = { moduleNode: CustomNode, floorLabel: ModuleFloorLabelNode };
const MOD_TREE_EDGE_TYPES = { customModuleEdge: CustomModuleEdge };

// Layout constants shared between useEffect and component
const MT_NODE_W = 312, MT_NODE_H = 260, MT_H_GAP = 50, MT_V_GAP = 150;
const MT_LABEL_W = 130, MT_LEFT_MARGIN = -320;

function buildModuleTreeLayout(crossGradeLinks){
  const gradeMap = {};
  for(const link of crossGradeLinks){
    for(const [grade, mods] of Object.entries(link.grade_modules||{})){
      if(!gradeMap[grade]) gradeMap[grade]=[];
      for(const mod of mods)
        if(!gradeMap[grade].find(m=>m.module_name===mod.module_name))
          gradeMap[grade].push(mod);
    }
  }
  const sortedGrades = Object.keys(gradeMap)
    .sort((a,b)=>GRADES_LIST.indexOf(a)-GRADES_LIST.indexOf(b));
  if(!sortedGrades.length) return { nodes:[], edges:[] };

  const numFloors = sortedGrades.length;
  const floorY = idx => (numFloors-1-idx)*(MT_NODE_H+MT_V_GAP);

  // Pre-compute each node's center X and floor index
  const nodeCX={}, nodeFloor={};
  sortedGrades.forEach((grade,fi)=>{
    const mods=gradeMap[grade];
    const totalW=mods.length*MT_NODE_W+(mods.length-1)*MT_H_GAP;
    const startX=-totalW/2;
    mods.forEach((mod,i)=>{
      const id=`${grade}::${mod.module_name}`;
      nodeCX[id]=startX+i*(MT_NODE_W+MT_H_GAP)+MT_NODE_W/2;
      nodeFloor[id]=fi;
    });
  });

  // Collect edge defs
  const edgeDefs=[];
  for(const grade of sortedGrades)
    for(const mod of gradeMap[grade]){
      const tgt=`${grade}::${mod.module_name}`;
      for(const prereqName of (mod.prerequisite_modules||[])){
        const sg=sortedGrades.find(gr=>(gradeMap[gr]||[]).some(m=>m.module_name===prereqName));
        if(sg) edgeDefs.push({ src:`${sg}::${prereqName}`, tgt });
      }
    }
  const connected=new Set(edgeDefs.flatMap(e=>[e.src,e.tgt]));

  // ── Corridor-based orthogonal routing ──────────────────────────────────────
  // Corridor i = the vertical gap between floor i (lower) and floor i+1 (upper)
  // corrTop = floorY(i+1) + MT_NODE_H  (bottom edge of upper floor = top of corridor)
  // corrBot = floorY(i)                 (top edge of lower floor  = bottom of corridor)
  // Each edge is assigned a unique laneY within each corridor it passes through.
  //
  // For adjacent-floor edge (src=floor i, tgt=floor i+1):
  //   path: srcCX→laneY (vertical) → tgtCX (horizontal) → tgt handle (vertical)
  //
  // For cross-floor edge (src=floor i, tgt=floor i+j, j>1):
  //   path: srcCX→laneY in corr i → LEFT_MARGIN (horizontal) →
  //         straight up to corr (tgt-1) laneY on margin → tgtCX (horizontal) → tgt handle
  //
  // Sub-lane assignment per corridor:
  //   • sort edges by signed displacement (tgtCX - srcCX): edges crossing most to the
  //     right get the LOWEST laneY (topmost within corridor), preventing most crossings.

  // Group edges by their "exit corridor" (the corridor at the source floor)
  const byCorr={};
  edgeDefs.forEach(e=>{
    const sf=nodeFloor[e.src], tf=nodeFloor[e.tgt];
    if(sf===undefined||tf===undefined) return;
    const key=String(sf); // bottom corridor = source floor
    if(!byCorr[key]) byCorr[key]=[];
    byCorr[key].push({ ...e, sf, tf });
  });

  // Also group edges by their "entry corridor" (needed for cross-floor edges on the left margin)
  const byEntryCorrLeft={}; // edges entering from left margin into corridor (tgtFloor-1)
  edgeDefs.forEach(e=>{
    const sf=nodeFloor[e.src], tf=nodeFloor[e.tgt];
    if(sf===undefined||tf===undefined||tf-sf<=1) return; // only cross-floor
    const key=String(tf-1);
    if(!byEntryCorrLeft[key]) byEntryCorrLeft[key]=[];
    byEntryCorrLeft[key].push({ ...e, sf, tf });
  });

  const edgeWaypoints={}; // "src→tgt" -> [{x,y},...]

  // Helper: assign evenly-spaced sub-lanes in a corridor
  function corrLanes(corrIdx, edges, sortFn){
    const corrTop=floorY(corrIdx+1)+MT_NODE_H;
    const corrBot=floorY(corrIdx);
    const usable=corrBot-corrTop;
    const PAD=16;
    const n=edges.length;
    if(n===0) return {};
    // Separate adjacent-floor (tf===sf+1) from cross-floor to prevent crossings:
    // adjacent edges → lower laneY (closer to target floor), cross-floor → higher laneY
    const adj=edges.filter(e=>e.tf===e.sf+1);
    const cf =edges.filter(e=>e.tf> e.sf+1);
    const sorted=[...[...adj].sort(sortFn),...[...cf].sort(sortFn)];
    const result={};
    sorted.forEach((e,i)=>{
      const laneY = n===1
        ? corrTop+usable/2
        : corrTop+PAD+(usable-2*PAD)/(n-1)*i;
      result[`${e.src}→${e.tgt}`]=laneY;
    });
    return result;
  }

  // Assign exit-corridor lanes (all edges exiting from floor sf)
  const exitLanes={};
  Object.entries(byCorr).forEach(([sfStr,edges])=>{
    const sf=parseInt(sfStr);
    // Sort: edges going right (positive displacement) get lower laneY (higher up), going left get higher laneY (lower)
    const lanes=corrLanes(sf, edges, (a,b)=>(nodeCX[b.tgt]-nodeCX[b.src])-(nodeCX[a.tgt]-nodeCX[a.src]));
    Object.assign(exitLanes, lanes);
  });

  // Assign entry-from-margin lanes for cross-floor edges entering a corridor from the left
  const entryLanes={};
  Object.entries(byEntryCorrLeft).forEach(([tfm1Str,edges])=>{
    const tfm1=parseInt(tfm1Str);
    const lanes=corrLanes(tfm1, edges, (a,b)=>nodeCX[a.tgt]-nodeCX[b.tgt]);
    Object.assign(entryLanes, lanes);
  });

  // Build waypoints for each edge
  edgeDefs.forEach(e=>{
    const sf=nodeFloor[e.src], tf=nodeFloor[e.tgt];
    if(sf===undefined||tf===undefined) return;
    const key=`${e.src}→${e.tgt}`;
    const srcCX=nodeCX[e.src], tgtCX=nodeCX[e.tgt];
    const srcHandleY=floorY(sf);          // source top handle
    const tgtHandleY=floorY(tf)+MT_NODE_H; // target bottom handle

    const exitY=exitLanes[key]??((floorY(sf)+floorY(sf+1)+MT_NODE_H)/2);

    if(tf===sf+1){
      // Adjacent floor: simple Z-path
      edgeWaypoints[key]=[
        {x:srcCX, y:srcHandleY},
        {x:srcCX, y:exitY},
        {x:tgtCX, y:exitY},
        {x:tgtCX, y:tgtHandleY},
      ];
    } else {
      // Cross-floor: exit corridor → left margin → entry corridor → target
      const entryY=entryLanes[key]??((floorY(tf)+floorY(tf-1)+MT_NODE_H)/2);
      edgeWaypoints[key]=[
        {x:srcCX,    y:srcHandleY},
        {x:srcCX,    y:exitY},
        {x:MT_LEFT_MARGIN, y:exitY},
        {x:MT_LEFT_MARGIN, y:entryY},
        {x:tgtCX,    y:entryY},
        {x:tgtCX,    y:tgtHandleY},
      ];
    }
  });

  // Build React Flow nodes
  const nodes=[];
  sortedGrades.forEach((grade,fi)=>{
    const mods=gradeMap[grade];
    const y=floorY(fi);
    const totalW=mods.length*MT_NODE_W+(mods.length-1)*MT_H_GAP;
    const startX=-totalW/2;

    nodes.push({
      id:`__label__${grade}`, type:'floorLabel',
      position:{ x:startX-(MT_LABEL_W+40), y },
      data:{ grade, bg:MOD_GRADE_BG[grade]||'#f1f5f9', border:MOD_GRADE_BDR[grade]||'#cbd5e1' },
      selectable:false, draggable:false,
    });

    mods.forEach((mod,i)=>{
      const id=`${grade}::${mod.module_name}`;
      nodes.push({
        id, type:'moduleNode',
        position:{ x:startX+i*(MT_NODE_W+MT_H_GAP), y },
        data:{
          title: mod.module_name,
          grade,
          status: 'active',
          micro_skills: (mod.pivot_skills||[]).map((s,idx) => ({
            id: s.id ?? idx,
            phase_status: s.phase_status || 'not_started',
          })),
        },
      });
    });
  });

  // Build React Flow edges
  const edges=edgeDefs.map((e,i)=>({
    id:`e${i}`, source:e.src, target:e.tgt,
    type:'customModuleEdge',
    zIndex:10,
    data:{ waypoints:edgeWaypoints[`${e.src}→${e.tgt}`]||[] },
  }));

  return { nodes, edges };
}

function ModuleTreeModal({ crossGradeLinks, onClose }){
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState([]);

  useEffect(()=>{
    const { nodes, edges } = buildModuleTreeLayout(crossGradeLinks);
    setRFNodes(nodes);
    setRFEdges(edges);
  },[crossGradeLinks]);

  return(
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:'93vw', height:'89vh', background:'#f8fafc', borderRadius:18, overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.45)' }}>

        <div style={{ padding:'14px 24px', background:'#fff', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div style={{ flexShrink:0 }}>
            <div style={{ fontSize:18, fontWeight:800, color:'#1e293b' }}>🌳 Дерево модулей</div>
            <div style={{ fontSize:12, color:'#64748b', marginTop:1 }}>Этажи снизу вверх: 5 кл → 6 кл → … · Стрелки в коридорах между этажами</div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', flex:1, justifyContent:'center' }}>
            {GRADES_LIST.filter(g=>crossGradeLinks.some(l=>(l.grade_modules||{})[g])).map(g=>(
              <span key={g} style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:7, background:MOD_GRADE_BG[g]||'#f1f5f9', border:`1px solid ${MOD_GRADE_BDR[g]||'#cbd5e1'}`, color:'#334155', whiteSpace:'nowrap' }}>{g}</span>
            ))}
          </div>
          <button onClick={onClose} style={{ flexShrink:0, background:'#f1f5f9', border:'none', borderRadius:8, padding:'8px 16px', fontWeight:700, fontSize:13, cursor:'pointer', color:'#475569' }}>✕ Закрыть</button>
        </div>

        <div style={{ flex:1 }}>
          {rfNodes.length>0
            ? <ReactFlow
                nodes={rfNodes} edges={rfEdges}
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                nodeTypes={MOD_TREE_NODE_TYPES}
                edgeTypes={MOD_TREE_EDGE_TYPES}
                fitView fitViewOptions={{ padding:0.14 }}
                nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
              >
                <Background color="#e2e8f0" gap={28}/>
                <Controls/>
              </ReactFlow>
            : <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:12, color:'#94a3b8' }}>
                <div style={{ fontSize:40 }}>🗂️</div>
                <div style={{ fontSize:15, fontWeight:600 }}>Нет сохранённых модулей</div>
                <div style={{ fontSize:13 }}>Сначала создайте межклассовые связи</div>
              </div>
          }
        </div>
      </div>
    </div>
  );
}

export default ModuleTreeModal;
