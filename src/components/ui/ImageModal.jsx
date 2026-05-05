import React from "react";

export default function ImageModal({ src, onClose }) {
  if (!src) return null;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,cursor:"zoom-out",padding:20}}>
      <img src={src} alt="" style={{maxWidth:"95vw",maxHeight:"92vh",borderRadius:12,objectFit:"contain",boxShadow:"0 20px 60px rgba(0,0,0,0.5)",cursor:"default"}} onClick={e=>e.stopPropagation()}/>
      <button onClick={onClose} style={{position:"fixed",top:16,right:16,background:"rgba(255,255,255,0.15)",color:"#fff",border:"none",borderRadius:8,width:40,height:40,cursor:"pointer",fontSize:22,fontWeight:700,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
    </div>
  );
}
