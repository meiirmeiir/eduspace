import React from "react";
import { THEME } from "../../lib/appConstants.js";

export default function Logo({ size=48, light=false }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:14}}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{flexShrink:0}}>
        <circle cx="50" cy="50" r="50" fill="#0A2463"/>
        <path d="M45 35 L85 15 L78 28 L95 35 L78 40 L85 55 L65 40 Z" fill="#FBBF24"/>
        <path d="M50 75 Q35 60 15 65 L15 75 Q35 70 50 85 Q65 70 85 75 L85 65 Q65 60 50 75Z" fill="#E2E8F0"/>
        <path d="M50 65 Q35 50 15 55 L15 65 Q35 60 50 75 Q65 60 85 65 L85 55 Q65 50 50 65Z" fill="#FFF"/>
        <path d="M50 30 L15 45 L50 60 L85 45Z" fill="#1E3A8A"/>
        <path d="M50 35 L22 47 L50 55 L78 47Z" fill="#2563EB"/>
        <path d="M50 45 L70 50 L72 65" stroke="#FBBF24" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <circle cx="72" cy="68" r="3.5" fill="#FBBF24"/>
      </svg>
      <div>
        <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:size*0.6,color:light?"#fff":THEME.primary,lineHeight:1,letterSpacing:"1px"}}>AAPA</div>
        <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:Math.max(size*0.2,9),color:THEME.accent,letterSpacing:"1px",marginTop:4,textTransform:"uppercase"}}>Ad Astra Per Aspera</div>
      </div>
    </div>
  );
}
