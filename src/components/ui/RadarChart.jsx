import React from "react";
import { THEME } from "../../lib/appConstants.js";

export default function RadarChart({ data, size=260 }) {
  if(!data||data.length<3) return <div style={{color:THEME.textLight,fontSize:13,textAlign:"center",padding:20}}>Недостаточно данных для диаграммы (мин. 3 темы)</div>;
  const n=data.length, cx=size/2, cy=size/2, r=size*0.36;
  const ang=i=>-Math.PI/2+i*(2*Math.PI/n);
  const pt=(i,pct)=>({x:cx+r*(pct/100)*Math.cos(ang(i)),y:cy+r*(pct/100)*Math.sin(ang(i))});
  const axPt=i=>({x:cx+r*Math.cos(ang(i)),y:cy+r*Math.sin(ang(i))});
  const poly=pts=>pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const grids=[25,50,75,100];
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible",display:"block",margin:"0 auto"}}>
      {grids.map(g=><polygon key={g} points={poly(data.map((_,i)=>pt(i,g)))} fill="none" stroke="#e2e8f0" strokeWidth="1"/>)}
      {data.map((_,i)=>{const p=axPt(i);return<line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="1"/>;})}
      <polygon points={poly(data.map((d,i)=>pt(i,d.value)))} fill="rgba(212,175,55,0.18)" stroke="#d4af37" strokeWidth="2"/>
      {data.map((d,i)=>{const p=pt(i,d.value);return<circle key={i} cx={p.x} cy={p.y} r={4} fill="#d4af37"/>;})}
      {data.map((d,i)=>{
        const a=ang(i), lx=cx+(r+28)*Math.cos(a), ly=cy+(r+28)*Math.sin(a);
        const anchor=lx<cx-4?"end":lx>cx+4?"start":"middle";
        const shortLabel=d.label.length>14?d.label.slice(0,13)+"…":d.label;
        return<text key={i} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" fontSize="10" fontFamily="Inter,sans-serif" fill="#334155" fontWeight="600">{shortLabel} {d.value}%</text>;
      })}
    </svg>
  );
}
