import React from "react";
import { THEME } from "../../lib/appConstants.js";
import ChartRenderer from "../charts/ChartRenderer.jsx";

export default function ChartEditor({ chart, onChange, isGenerated = false }) {
  const empty = {type:"bar",title:"",items:[{label:"",value:""},{label:"",value:""}]};
  const c = chart || empty;
  return(
    <div style={{background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:10,padding:"14px 16px",marginTop:8}}>
      <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:13,fontWeight:700,color:"#4338ca",whiteSpace:"nowrap"}}>📊 Диаграмма</span>
        {[{v:"bar",l:"Столбчатая"},{v:"pie",l:"Круговая"},{v:"line",l:"Линейная"}].map(t=>(
          <button key={t.v} type="button" onClick={()=>onChange({...c,type:t.v})} style={{padding:"4px 10px",borderRadius:6,border:`2px solid ${c.type===t.v?"#4338ca":THEME.border}`,background:c.type===t.v?"#e0e7ff":"#fff",color:c.type===t.v?"#4338ca":THEME.text,fontSize:12,fontWeight:c.type===t.v?700:400,cursor:"pointer"}}>{t.l}</button>
        ))}
        <input type="text" className="input-field" style={{marginBottom:0,flex:1,minWidth:80,fontSize:12}} value={c.title} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Заголовок (необязательно)"/>
        <button type="button" onClick={()=>onChange(null)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px",flexShrink:0}} title="Удалить диаграмму">×</button>
      </div>
      {isGenerated&&<p style={{fontSize:11,color:"#7c3aed",margin:"0 0 8px",background:"rgba(124,58,237,0.06)",padding:"4px 8px",borderRadius:6}}>💡 Значения поддерживают формулы с переменными: a, b+c, a*2...</p>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:6,marginBottom:4}}>
        <span style={{fontSize:11,fontWeight:600,color:THEME.textLight}}>Метка</span>
        <span style={{fontSize:11,fontWeight:600,color:THEME.textLight}}>Значение{isGenerated?" / формула":""}</span>
        <span/>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
        {c.items.map((item,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:6,alignItems:"center"}}>
            <input type="text" className="input-field" style={{marginBottom:0}} value={item.label} onChange={e=>onChange({...c,items:c.items.map((x,j)=>j===i?{...x,label:e.target.value}:x)})} placeholder={`Метка ${i+1}`}/>
            <input type="text" className="input-field" style={{marginBottom:0}} value={item.value} onChange={e=>onChange({...c,items:c.items.map((x,j)=>j===i?{...x,value:e.target.value}:x)})} placeholder={isGenerated?"a*2, b+c...":"Число"}/>
            {c.items.length>2?<button type="button" onClick={()=>onChange({...c,items:c.items.filter((_,j)=>j!==i)})} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18,padding:"0 2px"}}>×</button>:<div/>}
          </div>
        ))}
      </div>
      <button type="button" onClick={()=>onChange({...c,items:[...c.items,{label:"",value:""}]})} style={{background:"transparent",border:`1px dashed ${THEME.border}`,color:THEME.textLight,cursor:"pointer",borderRadius:6,padding:"4px 12px",fontSize:12,width:"100%",marginBottom:10}}>+ Добавить значение</button>
      <div style={{display:"flex",justifyContent:"center",background:"#fff",borderRadius:8,padding:12,border:`1px solid ${THEME.border}`}}>
        <ChartRenderer chart={c} vars={{}}/>
      </div>
    </div>
  );
}
