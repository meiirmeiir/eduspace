import React from "react";
import { THEME } from "../../lib/appConstants.js";

export default function ErrorCard({ message, onRetry }) {
  return (
    <div style={{textAlign:"center",padding:"60px 24px"}}>
      <div style={{fontSize:40,marginBottom:12}}>⚠️</div>
      <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:700,color:THEME.primary,marginBottom:6}}>Ошибка загрузки</div>
      <div style={{color:THEME.textLight,fontSize:14,marginBottom:20}}>{message||"Проверьте соединение с интернетом и попробуйте снова."}</div>
      {onRetry&&<button onClick={onRetry} style={{padding:"10px 24px",borderRadius:8,border:`1px solid ${THEME.border}`,background:"#fff",color:THEME.primary,fontWeight:700,cursor:"pointer",fontSize:14}}>🔄 Попробовать снова</button>}
    </div>
  );
}
