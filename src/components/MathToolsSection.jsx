import React from "react";

export default function MathToolsSection() {
  const [gcdA,setGcdA]=React.useState(""); const [gcdB,setGcdB]=React.useState("");
  const [lcmA,setLcmA]=React.useState(""); const [lcmB,setLcmB]=React.useState("");
  const [seqInput,setSeqInput]=React.useState(""); const [seqResult,setSeqResult]=React.useState(null);

  const gcd=(a,b)=>{ a=Math.abs(a); b=Math.abs(b); while(b){[a,b]=[b,a%b];} return a; };
  const lcm=(a,b)=>{ const g=gcd(a,b); return g===0?0:Math.abs(a*b)/g; };

  const gcdSteps=(a,b)=>{
    const steps=[]; a=Math.abs(a); b=Math.abs(b);
    if(a===0||b===0) return steps;
    let x=Math.max(a,b),y=Math.min(a,b);
    while(y){
      const q=Math.floor(x/y); const r=x%y;
      steps.push({x,y,q,r});
      [x,y]=[y,r];
    }
    return steps;
  };

  const parseInts=(s)=>s.split(/[\s,;]+/).map(n=>parseInt(n,10)).filter(n=>!isNaN(n)&&n>0);

  const seqGcd=arr=>arr.reduce((acc,n)=>gcd(acc,n),arr[0]||0);
  const seqLcm=arr=>arr.reduce((acc,n)=>lcm(acc,n),arr[0]||1);

  const gcdAn=parseInt(gcdA,10); const gcdBn=parseInt(gcdB,10);
  const gcdValid=gcdA&&gcdB&&!isNaN(gcdAn)&&!isNaN(gcdBn)&&gcdAn>0&&gcdBn>0;
  const gcdResult=gcdValid?gcd(gcdAn,gcdBn):null;
  const gcdStepsArr=gcdValid?gcdSteps(gcdAn,gcdBn):[];

  const lcmAn=parseInt(lcmA,10); const lcmBn=parseInt(lcmB,10);
  const lcmValid=lcmA&&lcmB&&!isNaN(lcmAn)&&!isNaN(lcmBn)&&lcmAn>0&&lcmBn>0;
  const lcmResult=lcmValid?lcm(lcmAn,lcmBn):null;

  const seqNums=parseInts(seqInput);
  const seqValid=seqNums.length>=2;

  return(
    <div style={{padding:"24px 28px",maxWidth:780}}>
      <h1 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:22,color:"#1e293b",marginBottom:4}}>🧮 Математические инструменты</h1>
      <p style={{color:"#64748b",fontSize:14,marginBottom:28}}>НОД и НОК с пошаговым решением алгоритмом Евклида</p>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:24}}>

        {/* GCD */}
        <div style={{background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",padding:"20px 22px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
          <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:14}}>📐 НОД (GCD)</div>
          <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
            <input value={gcdA} onChange={e=>setGcdA(e.target.value.replace(/\D/,""))} placeholder="a" style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:16,fontWeight:700,textAlign:"center",outline:"none"}}/>
            <span style={{color:"#94a3b8",fontWeight:700,flexShrink:0}}>и</span>
            <input value={gcdB} onChange={e=>setGcdB(e.target.value.replace(/\D/,""))} placeholder="b" style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:16,fontWeight:700,textAlign:"center",outline:"none"}}/>
          </div>
          {gcdValid&&gcdResult!==null&&(
            <div>
              <div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"10px 14px",marginBottom:12,textAlign:"center"}}>
                <span style={{fontSize:13,color:"#4338ca",fontWeight:600}}>НОД({gcdAn}, {gcdBn}) = </span>
                <span style={{fontSize:24,fontWeight:900,color:"#4338ca"}}>{gcdResult}</span>
              </div>
              {gcdStepsArr.length>0&&(
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:"#64748b",marginBottom:6}}>Алгоритм Евклида:</div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {gcdStepsArr.map((s,i)=>(
                      <div key={i} style={{fontSize:12,fontFamily:"'Courier New',monospace",color:"#334155",background:"#f8fafc",borderRadius:6,padding:"4px 8px"}}>
                        {s.x} = {s.q} × {s.y} + <span style={{fontWeight:700,color:s.r===0?"#10b981":"#f59e0b"}}>{s.r}</span>
                      </div>
                    ))}
                    <div style={{fontSize:12,color:"#10b981",fontWeight:700,padding:"4px 8px"}}>→ Остаток 0, НОД = {gcdResult}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {!gcdValid&&<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"8px 0"}}>Введите два натуральных числа</div>}
        </div>

        {/* LCM */}
        <div style={{background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",padding:"20px 22px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
          <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:14}}>🔢 НОК (LCM)</div>
          <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
            <input value={lcmA} onChange={e=>setLcmA(e.target.value.replace(/\D/,""))} placeholder="a" style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:16,fontWeight:700,textAlign:"center",outline:"none"}}/>
            <span style={{color:"#94a3b8",fontWeight:700,flexShrink:0}}>и</span>
            <input value={lcmB} onChange={e=>setLcmB(e.target.value.replace(/\D/,""))} placeholder="b" style={{width:"100%",border:"1px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:16,fontWeight:700,textAlign:"center",outline:"none"}}/>
          </div>
          {lcmValid&&lcmResult!==null&&(
            <div>
              <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:10,padding:"10px 14px",marginBottom:12,textAlign:"center"}}>
                <span style={{fontSize:13,color:"#065f46",fontWeight:600}}>НОК({lcmAn}, {lcmBn}) = </span>
                <span style={{fontSize:24,fontWeight:900,color:"#059669"}}>{lcmResult}</span>
              </div>
              <div style={{fontSize:12,color:"#334155",background:"#f8fafc",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontWeight:700,color:"#64748b",marginBottom:4}}>Формула:</div>
                <span style={{fontFamily:"'Courier New',monospace"}}>НОК({lcmAn}, {lcmBn}) = {lcmAn} × {lcmBn} / НОД({lcmAn}, {lcmBn})</span>
                <br/>
                <span style={{fontFamily:"'Courier New',monospace"}}>= {lcmAn*lcmBn} / {gcd(lcmAn,lcmBn)} = <span style={{fontWeight:700,color:"#059669"}}>{lcmResult}</span></span>
              </div>
            </div>
          )}
          {!lcmValid&&<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"8px 0"}}>Введите два натуральных числа</div>}
        </div>
      </div>

      {/* Multi-number GCD/LCM */}
      <div style={{background:"#fff",borderRadius:16,border:"1px solid #e2e8f0",padding:"20px 22px",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
        <div style={{fontWeight:800,fontSize:15,color:"#1e293b",marginBottom:6}}>📊 НОД и НОК нескольких чисел</div>
        <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>Введите числа через пробел или запятую</div>
        <input value={seqInput} onChange={e=>setSeqInput(e.target.value)} placeholder="Например: 12 18 24 36" style={{width:"100%",boxSizing:"border-box",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 14px",fontSize:15,outline:"none",marginBottom:12}}/>
        {seqValid&&(
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:160,background:"rgba(99,102,241,0.07)",borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#4338ca",marginBottom:4}}>НОД({seqNums.join(", ")})</div>
              <div style={{fontSize:28,fontWeight:900,color:"#4338ca"}}>{seqGcd(seqNums)}</div>
            </div>
            <div style={{flex:1,minWidth:160,background:"rgba(16,185,129,0.07)",borderRadius:10,padding:"12px 16px",textAlign:"center"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#059669",marginBottom:4}}>НОК({seqNums.join(", ")})</div>
              <div style={{fontSize:28,fontWeight:900,color:"#059669"}}>{seqLcm(seqNums)}</div>
            </div>
          </div>
        )}
        {seqInput&&!seqValid&&<div style={{fontSize:13,color:"#f59e0b",fontWeight:600}}>Введите минимум 2 числа</div>}
      </div>
    </div>
  );
}
