import React from "react";

export default function PixelBoss({ type, hpPct, shake }) {
  const P = 8;
  // Medium boss (topic): pixel slime — green
  const SC = {0:"transparent",1:"#22c55e",2:"#15803d",3:"#fff",4:"#111",5:"#86efac",6:"#bbf7d0"};
  const SS = [
    [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,6,1,1,6,1,1,0,0,0],
    [0,0,1,1,6,1,1,1,1,6,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,3,3,2,1,1,2,3,3,1,1,1],
    [1,1,1,3,4,2,1,1,2,3,4,1,1,1],
    [1,1,1,1,2,1,1,1,1,2,1,1,1,1],
    [1,1,1,1,1,2,2,2,2,1,1,1,1,1],
    [1,1,1,2,1,1,1,1,1,1,2,1,1,1],
    [0,1,1,1,2,2,2,2,2,2,1,1,1,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,1,1,2,1,1,2,1,1,0,0,0],
    [0,0,0,0,1,1,2,2,1,1,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,0,0,0,0,0],
  ];
  // Hard boss (chapter): pixel demon — red/dark
  const DC = {0:"transparent",1:"#dc2626",2:"#7f1d1d",3:"#fbbf24",4:"#111",5:"#f87171",6:"#f97316",7:"#fef3c7"};
  const DS = [
    [0,2,0,0,0,1,1,1,0,0,0,2,0,0],
    [0,2,2,0,1,1,1,1,1,0,2,2,0,0],
    [0,0,2,1,5,1,1,1,1,5,1,2,0,0],
    [0,2,1,1,1,1,1,1,1,1,1,1,2,0],
    [2,1,1,3,3,2,1,1,2,3,3,1,1,2],
    [2,1,1,3,4,2,1,1,2,3,4,1,1,2],
    [2,1,1,1,2,1,1,1,1,2,1,1,1,2],
    [2,1,1,6,1,2,2,2,2,1,6,1,1,2],
    [2,1,1,1,2,1,1,1,1,2,1,1,1,2],
    [0,2,1,1,1,2,2,2,2,1,1,1,2,0],
    [0,0,2,1,1,1,1,1,1,1,1,2,0,0],
    [0,0,0,2,1,2,1,1,2,1,2,0,0,0],
    [0,0,0,0,2,1,2,2,1,2,0,0,0,0],
    [0,0,0,0,0,2,2,2,2,0,0,0,0,0],
  ];
  const sprite = type === "chapter" ? DS : SS;
  const colors = type === "chapter" ? DC : SC;
  const dim = hpPct < 25 ? "brightness(0.55) saturate(0.6)" : hpPct < 50 ? "brightness(0.8)" : "none";
  return (
    <div style={{display:"inline-block",imageRendering:"pixelated",transform:shake?"translateX(6px) rotate(2deg)":"none",transition:"transform 0.08s",filter:dim}}>
      {sprite.map((row,ri)=>(
        <div key={ri} style={{display:"flex"}}>
          {row.map((cell,ci)=>(
            <div key={ci} style={{width:P,height:P,background:colors[cell]||"transparent"}}/>
          ))}
        </div>
      ))}
    </div>
  );
}
