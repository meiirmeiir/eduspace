import React, { useRef, useEffect } from "react";
import { THEME } from "../../lib/appConstants.js";

export default function RichTextEditor({ value, onChange }) {
  const ref = useRef(null);
  useEffect(()=>{ if(ref.current) ref.current.innerHTML = value||""; },[]);
  const exec=(cmd,val)=>{
    ref.current?.focus();
    document.execCommand(cmd,false,val??null);
    setTimeout(()=>onChange(ref.current?.innerHTML||""),0);
  };
  const insertHR=()=>{
    ref.current?.focus();
    document.execCommand('insertHTML',false,'<hr style="border:none;border-top:2px solid #e2e8f0;margin:16px 0"/>');
    setTimeout(()=>onChange(ref.current?.innerHTML||""),0);
  };
  const btn=(label,title,onClick,extra={})=>(
    <button type="button" title={title} onMouseDown={e=>{e.preventDefault();onClick();}}
      style={{padding:"3px 8px",border:`1px solid ${THEME.border}`,borderRadius:5,background:"#fff",color:THEME.text,cursor:"pointer",fontSize:13,fontWeight:600,lineHeight:1.4,...extra}}>{label}</button>
  );
  const sep=<div style={{width:1,background:THEME.border,margin:"2px 3px",alignSelf:"stretch"}}/>;
  return(
    <div style={{border:`1px solid ${THEME.border}`,borderRadius:8,overflow:"hidden"}}>
      <div style={{display:"flex",gap:3,padding:"5px 8px",background:THEME.bg,borderBottom:`1px solid ${THEME.border}`,flexWrap:"wrap",alignItems:"center"}}>
        {btn(<b>B</b>,"Жирный",()=>exec('bold'),{fontFamily:"serif"})}
        {btn(<i>I</i>,"Курсив",()=>exec('italic'),{fontStyle:"italic",fontFamily:"serif"})}
        {btn(<u>U</u>,"Подчёркнутый",()=>exec('underline'))}
        {sep}
        <select onMouseDown={e=>e.stopPropagation()} style={{border:`1px solid ${THEME.border}`,borderRadius:5,padding:"3px 6px",fontSize:12,cursor:"pointer",background:"#fff",height:26}}
          defaultValue="" onChange={e=>{if(e.target.value){exec('fontSize',e.target.value);e.target.value="";}}}>
          <option value="" disabled>Размер</option>
          <option value="1">Маленький</option>
          <option value="3">Обычный</option>
          <option value="5">Крупный</option>
          <option value="7">Очень крупный</option>
        </select>
        {sep}
        {btn("H2","Заголовок 2",()=>exec('formatBlock','h2'),{fontWeight:800,fontSize:12})}
        {btn("H3","Заголовок 3",()=>exec('formatBlock','h3'),{fontWeight:700,fontSize:11})}
        {btn("¶","Абзац",()=>exec('formatBlock','p'))}
        {sep}
        {btn("• Список","Маркированный список",()=>exec('insertUnorderedList'))}
        {btn("1. Список","Нумерованный список",()=>exec('insertOrderedList'))}
        {sep}
        {btn("─ Разделитель","Горизонтальная линия",insertHR)}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={()=>onChange(ref.current?.innerHTML||"")}
        style={{minHeight:110,padding:"12px 14px",fontSize:14,lineHeight:1.85,fontFamily:"'Inter',sans-serif",outline:"none",color:THEME.text}}/>
    </div>
  );
}
