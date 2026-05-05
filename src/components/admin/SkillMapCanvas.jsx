import React, { useState, useMemo } from "react";
import { THEME } from "../../lib/appConstants.js";

export default function SkillMapCanvas({ nodes }) {
  const [disabled,setDisabled]=useState(new Set());
  const [zoom,setZoom]=useState(1);

  const nodeMap=useMemo(()=>Object.fromEntries(nodes.map(n=>[n.name,n])),[nodes]);

  const fwd=useMemo(()=>{
    const m={};
    nodes.forEach(n=>(n.prerequisites||[]).forEach(p=>{if(!m[p])m[p]=[];m[p].push(n.name);}));
    return m;
  },[nodes]);

  const levels=useMemo(()=>{
    const cache={};
    const getLevel=(name,path=new Set())=>{
      if(cache[name]!==undefined)return cache[name];
      if(path.has(name)){cache[name]=0;return 0;}
      const node=nodeMap[name];if(!node){cache[name]=0;return 0;}
      const prereqs=(node.prerequisites||[]).filter(p=>nodeMap[p]);
      if(!prereqs.length){cache[name]=0;return 0;}
      const p2=new Set([...path,name]);
      cache[name]=Math.max(...prereqs.map(p=>getLevel(p,p2)))+1;
      return cache[name];
    };
    nodes.forEach(n=>getLevel(n.name));
    return cache;
  },[nodes,nodeMap]);

  const byLevel=useMemo(()=>{
    const bl={};
    nodes.forEach(n=>{const lv=levels[n.name]||0;if(!bl[lv])bl[lv]=[];bl[lv].push(n.name);});
    return bl;
  },[nodes,levels]);

  // Node dimensions: wide enough for long names, tall enough for 2 lines
  const NW=220,NH=68,HG=32,VG=100,PAD=32;

  const positions=useMemo(()=>{
    const maxLv=Math.max(...Object.keys(byLevel).map(Number),0);
    const rowW=lv=>{const n=byLevel[lv]||[];return n.length*NW+(n.length-1)*HG;};
    const canvasW=Math.max(...Array.from({length:maxLv+1},(_,i)=>rowW(i)),NW);
    const pos={};
    for(let lv=0;lv<=maxLv;lv++){
      const names=[...(byLevel[lv]||[])];
      names.sort((a,b)=>{
        const avg=nm=>{const ps=(nodeMap[nm]?.prerequisites||[]).filter(p=>pos[p]);return ps.length?ps.reduce((s,p)=>s+pos[p].cx,0)/ps.length:0;};
        return avg(a)-avg(b);
      });
      const rw=names.length*NW+(names.length-1)*HG;
      const ox=PAD+(canvasW-rw)/2;
      names.forEach((name,i)=>{
        const x=ox+i*(NW+HG),y=PAD+lv*(NH+VG);
        pos[name]={x,y,cx:x+NW/2,top:y,bot:y+NH};
      });
    }
    return pos;
  },[byLevel,nodeMap]);

  const totalW=Math.max(...Object.values(positions).map(p=>p.x+NW),600)+PAD;
  const totalH=Math.max(...Object.values(positions).map(p=>p.bot),300)+PAD;

  const getDownstream=name=>{
    const res=new Set([name]);const q=[name];
    while(q.length){const cur=q.shift();(fwd[cur]||[]).forEach(d=>{if(!res.has(d)){res.add(d);q.push(d);}});}
    return res;
  };

  const handleClick=name=>{
    setDisabled(prev=>{
      const ds=getDownstream(name);
      if(prev.has(name)){const next=new Set(prev);ds.forEach(n=>next.delete(n));return next;}
      const next=new Set(prev);ds.forEach(n=>next.add(n));return next;
    });
  };

  // Build orthogonal (flowchart-style) path: down → horizontal → down
  const orthoPath=(x1,y1,x2,y2)=>{
    if(Math.abs(x1-x2)<1)return`M${x1},${y1} L${x2},${y2}`;
    const ymid=Math.round((y1+y2)/2);
    return`M${x1},${y1} L${x1},${ymid} L${x2},${ymid} L${x2},${y2}`;
  };

  if(!nodes.length)return <div style={{textAlign:"center",padding:48,color:THEME.textLight,fontSize:14}}>Нет данных. Импортируйте навыки с пререквизитами через CSV.</div>;

  return(
    <div style={{borderRadius:16,border:`1px solid ${THEME.border}`,overflow:"hidden",background:"#f1f5f9"}}>
      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"#fff",borderBottom:`1px solid ${THEME.border}`,flexWrap:"wrap"}}>
        <span style={{fontSize:13,fontWeight:700,color:THEME.primary}}>Масштаб:</span>
        <button onClick={()=>setZoom(z=>Math.max(0.4,+(z-0.1).toFixed(1)))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${THEME.border}`,background:"#fff",fontSize:18,cursor:"pointer",lineHeight:1,fontWeight:700,color:THEME.primary}}>−</button>
        <span style={{fontSize:13,fontWeight:700,color:THEME.primary,minWidth:42,textAlign:"center"}}>{Math.round(zoom*100)}%</span>
        <button onClick={()=>setZoom(z=>Math.min(2,+(z+0.1).toFixed(1)))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${THEME.border}`,background:"#fff",fontSize:18,cursor:"pointer",lineHeight:1,fontWeight:700,color:THEME.primary}}>+</button>
        <button onClick={()=>setZoom(1)} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,background:"#fff",fontSize:12,cursor:"pointer",color:THEME.textLight}}>Сбросить</button>
        <div style={{marginLeft:"auto",display:"flex",gap:16,flexWrap:"wrap",fontSize:11,color:THEME.textLight}}>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:14,background:THEME.primary,borderRadius:3,display:"inline-block",flexShrink:0}}></span>Корневой</span>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:14,background:"#fff",border:`2px solid ${THEME.primary}`,borderRadius:3,display:"inline-block",flexShrink:0}}></span>Зависимый</span>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:14,height:14,background:"#f1f5f9",border:"2px solid #e2e8f0",borderRadius:3,display:"inline-block",flexShrink:0}}></span>Деактивирован</span>
          <span style={{fontStyle:"italic"}}>Клик → деактивировать/включить навык и зависимые</span>
        </div>
      </div>
      {/* Scrollable canvas */}
      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:680}}>
        <div style={{width:Math.ceil(totalW*zoom),height:Math.ceil(totalH*zoom),position:"relative",flexShrink:0}}>
          <div style={{position:"absolute",top:0,left:0,transformOrigin:"top left",transform:`scale(${zoom})`}}>
            <div style={{position:"relative",width:totalW,height:totalH}}>
              <svg style={{position:"absolute",inset:0,width:totalW,height:totalH,pointerEvents:"none",overflow:"visible"}}>
                <defs>
                  <marker id="sm-arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,1 L5,3 L0,5 Z" fill="#94a3b8"/>
                  </marker>
                  <marker id="sm-arr-dim" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,1 L5,3 L0,5 Z" fill="#e2e8f0"/>
                  </marker>
                </defs>
                {nodes.flatMap(node=>(node.prerequisites||[]).filter(p=>positions[p]&&positions[node.name]).map(prereq=>{
                  const fr=positions[prereq],to=positions[node.name];
                  const dim=disabled.has(prereq)||disabled.has(node.name);
                  const x1=fr.cx,y1=fr.bot,x2=to.cx,y2=to.top;
                  return(
                    <path key={`${prereq}→${node.name}`}
                      d={orthoPath(x1,y1,x2,y2-7)}
                      stroke={dim?"#e2e8f0":"#94a3b8"}
                      strokeWidth={1}
                      fill="none"
                      strokeDasharray={dim?"5,5":undefined}
                      opacity={dim?0.4:0.6}
                      markerEnd={dim?"url(#sm-arr-dim)":"url(#sm-arr)"}
                    />
                  );
                }))}
              </svg>
              {nodes.map(node=>{
                const pos=positions[node.name];if(!pos)return null;
                const dim=disabled.has(node.name);
                const isRoot=!(node.prerequisites||[]).filter(p=>nodeMap[p]).length;
                return(
                  <div key={node.name} onClick={()=>handleClick(node.name)}
                    title={dim?"Нажмите чтобы включить":"Нажмите чтобы деактивировать"}
                    style={{
                      position:"absolute",left:pos.x,top:pos.top,width:NW,height:NH,
                      background:dim?"#f8fafc":isRoot?THEME.primary:"#fff",
                      border:`2px solid ${dim?"#e2e8f0":isRoot?"transparent":THEME.primary}`,
                      borderRadius:10,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      padding:"8px 14px",
                      cursor:"pointer",userSelect:"none",
                      boxShadow:dim?"none":isRoot?"0 4px 16px rgba(15,23,42,0.2)":"0 2px 8px rgba(15,23,42,0.08)",
                      transition:"background 0.2s,border-color 0.2s,box-shadow 0.2s",
                      color:dim?"#94a3b8":isRoot?"#fff":THEME.primary,
                      fontWeight:600,fontSize:11,
                      textAlign:"center",lineHeight:1.35,
                      wordBreak:"break-word",overflowWrap:"anywhere",
                      zIndex:1
                    }}>
                    {node.name}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
