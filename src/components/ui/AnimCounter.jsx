import React from "react";

export default function AnimCounter({ to, suffix="", prefix="" }) {
  const [v, setV] = React.useState(0);
  const ref = React.useRef(null);
  React.useEffect(()=>{
    const el=ref.current; if(!el) return;
    const obs=new IntersectionObserver(entries=>{
      if(entries[0].isIntersecting){
        const dur=1400; const t0=performance.now();
        const tick=now=>{
          const p=Math.min((now-t0)/dur,1);
          setV(Math.round((1-Math.pow(1-p,3))*to));
          if(p<1) requestAnimationFrame(tick); else setV(to);
        };
        requestAnimationFrame(tick);
        obs.disconnect();
      }
    },{threshold:0.5});
    obs.observe(el);
    return ()=>obs.disconnect();
  },[to]);
  return <span ref={ref}>{prefix}{v}{suffix}</span>;
}
