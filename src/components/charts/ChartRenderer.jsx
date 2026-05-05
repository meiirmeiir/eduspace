import React from "react";
import { preprocessFormula } from "../../lib/mathUtils.js";

export default function ChartRenderer({ chart, vars = {} }) {
  if (!chart || !chart.items?.length) return null;
  const COLORS = ["#4338ca","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#F97316","#84CC16"];
  const vals = chart.items.map(item => {
    if (item.value === "" || item.value === undefined) return 0;
    try {
      const vKeys = Object.keys(vars);
      if (vKeys.length) {
        const f = preprocessFormula(String(item.value), vKeys);
        const v = new Function(...vKeys, `"use strict"; return (${f});`)(...Object.values(vars));
        return typeof v === 'number' && isFinite(v) ? v : 0;
      }
      return Number(item.value) || 0;
    } catch { return 0; }
  });
  const labels = chart.items.map(it => it.label || "");
  const title = chart.title || "";
  const type = chart.type || "bar";

  if (type === "bar") {
    const max = Math.max(...vals, 1);
    const W=320,H=200,ML=44,MR=12,MT=title?26:12,MB=36;
    const iW=W-ML-MR,iH=H-MT-MB;
    const bW=iW/vals.length*0.65, bG=iW/vals.length*0.175;
    return (
      <svg width={W} height={H} style={{fontFamily:"'Inter',sans-serif",overflow:"visible",display:"block"}}>
        {title&&<text x={W/2} y={16} textAnchor="middle" fontSize={12} fontWeight="700" fill="#334155">{title}</text>}
        <g transform={`translate(${ML},${MT})`}>
          {[0,0.25,0.5,0.75,1].map(t=>(
            <g key={t}>
              <line x1={0} y1={iH*(1-t)} x2={iW} y2={iH*(1-t)} stroke={t===0?"#94a3b8":"#e2e8f0"} strokeWidth={t===0?1.5:1}/>
              <text x={-4} y={iH*(1-t)+4} textAnchor="end" fontSize={9} fill="#94a3b8">{(max*t)%1===0?(max*t).toFixed(0):(max*t).toFixed(1)}</text>
            </g>
          ))}
          {vals.map((v,i)=>{
            const bh=Math.max((v/max)*iH,0);
            const x=i*(iW/vals.length)+bG;
            return(
              <g key={i}>
                <rect x={x} y={iH-bh} width={bW} height={bh} fill={COLORS[i%COLORS.length]} rx={3} opacity={0.88}/>
                <text x={x+bW/2} y={iH-bh-5} textAnchor="middle" fontSize={9} fill={COLORS[i%COLORS.length]} fontWeight="700">{v%1===0?v:v.toFixed(1)}</text>
                <text x={x+bW/2} y={iH+16} textAnchor="middle" fontSize={10} fill="#475569">{labels[i]}</text>
              </g>
            );
          })}
        </g>
      </svg>
    );
  }

  if (type === "pie") {
    const total = vals.reduce((a,b)=>a+b,0)||1;
    const CX=110,CY=110,R=88,W=290,H=225;
    let a0=-Math.PI/2;
    const slices=vals.map((v,i)=>{
      const da=(v/total)*2*Math.PI;
      const a1=a0+da;
      const x0=CX+R*Math.cos(a0),y0=CY+R*Math.sin(a0);
      const x1=CX+R*Math.cos(a1),y1=CY+R*Math.sin(a1);
      const mx=CX+R*0.63*Math.cos(a0+da/2),my=CY+R*0.63*Math.sin(a0+da/2);
      const d=`M${CX},${CY} L${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 ${da>Math.PI?1:0},1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
      a0=a1;
      return{d,color:COLORS[i%COLORS.length],mx,my,pct:Math.round(v/total*100)};
    });
    return(
      <svg width={W} height={H} style={{fontFamily:"'Inter',sans-serif",display:"block"}}>
        {title&&<text x={CX} y={14} textAnchor="middle" fontSize={12} fontWeight="700" fill="#334155">{title}</text>}
        {slices.map((s,i)=>(
          <g key={i}>
            <path d={s.d} fill={s.color} stroke="#fff" strokeWidth={2}/>
            {s.pct>5&&<text x={s.mx} y={s.my+4} textAnchor="middle" fontSize={10} fill="#fff" fontWeight="700">{s.pct}%</text>}
          </g>
        ))}
        {labels.map((l,i)=>(
          <g key={i} transform={`translate(220,${(title?24:12)+i*22})`}>
            <rect width={11} height={11} fill={COLORS[i%COLORS.length]} rx={2}/>
            <text x={15} y={10} fontSize={11} fill="#475569">{l}: {vals[i]%1===0?vals[i]:vals[i].toFixed(1)}</text>
          </g>
        ))}
      </svg>
    );
  }

  if (type === "line") {
    const max=Math.max(...vals,1),min=Math.min(...vals,0);
    const W=320,H=200,ML=44,MR=12,MT=title?26:12,MB=36;
    const iW=W-ML-MR,iH=H-MT-MB;
    const range=max-min||1;
    const pts=vals.map((v,i)=>({
      x:ML+(vals.length>1?i/(vals.length-1)*iW:iW/2),
      y:MT+(1-(v-min)/range)*iH
    }));
    const poly=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return(
      <svg width={W} height={H} style={{fontFamily:"'Inter',sans-serif",overflow:"visible",display:"block"}}>
        {title&&<text x={W/2} y={16} textAnchor="middle" fontSize={12} fontWeight="700" fill="#334155">{title}</text>}
        {[0,0.25,0.5,0.75,1].map(t=>(
          <g key={t}>
            <line x1={ML} y1={MT+t*iH} x2={ML+iW} y2={MT+t*iH} stroke={t===1?"#94a3b8":"#e2e8f0"} strokeWidth={t===1?1.5:1}/>
            <text x={ML-4} y={MT+t*iH+4} textAnchor="end" fontSize={9} fill="#94a3b8">{(max-t*(max-min))%1===0?(max-t*(max-min)).toFixed(0):(max-t*(max-min)).toFixed(1)}</text>
          </g>
        ))}
        <polyline points={poly} fill="none" stroke="#4338ca" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p,i)=>(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#4338ca" stroke="#fff" strokeWidth={2}/>
            <text x={p.x} y={p.y-8} textAnchor="middle" fontSize={9} fill="#4338ca" fontWeight="700">{vals[i]%1===0?vals[i]:vals[i].toFixed(1)}</text>
            <text x={p.x} y={MT+iH+16} textAnchor="middle" fontSize={10} fill="#475569">{labels[i]}</text>
          </g>
        ))}
      </svg>
    );
  }
  return null;
}
