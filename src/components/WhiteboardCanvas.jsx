import React, { useState, useEffect, useRef } from "react";

const WB_COLORS=["#0f172a","#2563eb","#dc2626","#16a34a","#d97706","#7c3aed","#db2777","#0891b2","#ffffff"];
const WB_WIDTHS=[{v:3,label:"Тонкая"},{v:7,label:"Средняя"},{v:14,label:"Толстая"},{v:28,label:"Широкая"}];
const WORLD_W=5000, WORLD_H=3500; // virtual canvas size in world pixels

export default function WhiteboardCanvas({ initData, onSave, readOnly }) {
  const canvasRef  = useRef(null);
  const wrapRef    = useRef(null);

  // All mutable state in refs → no stale closure bugs
  const isDrawing  = useRef(false);
  const isPanning  = useRef(false);
  const curPts     = useRef([]);
  const lastPan    = useRef({x:0,y:0});
  const pinchDist  = useRef(null);
  const toolRef    = useRef("pen");
  const colorRef   = useRef("#0f172a");
  const lwRef      = useRef(7);
  const strokesRef = useRef([]);
  const imagesRef  = useRef([]);
  const imgCacheRef  = useRef({});
  const selectedIdRef = useRef(null);
  const imgDragRef = useRef(null);
  // View transform: screenX = worldX*scale + ox
  const vt         = useRef({scale:1, ox:0, oy:0});

  // UI state (toolbar re-renders only)
  const [toolUI,   setToolUI]   = useState("pen");
  const [colorUI,  setColorUI]  = useState("#0f172a");
  const [lwUI,     setLwUI]     = useState(7);
  const [zoomPct,  setZoomPct]  = useState(100);
  const [strokeCount, setStrokeCount] = useState(0);
  const [imageCount,  setImageCount]  = useState(0);
  const [selectedImgId, setSelectedImgId] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [savedOk,  setSavedOk]  = useState(false);

  const setTool  = v => { toolRef.current=v;  setToolUI(v); };
  const setColor = v => { colorRef.current=v; setColorUI(v); };
  const setLw    = v => { lwRef.current=v;    setLwUI(v); };

  // ── helpers ──────────────────────────────────────────────────────────────
  const cvSize = () => {
    const cv = canvasRef.current;
    return cv ? {W: cv.width, H: cv.height} : {W:1,H:1};
  };

  // Convert legacy normalised coords (0-1) → world coords
  const upgradeStrokes = raw => raw.map(s => {
    if (!s.points || !s.points.length) return s;
    // If all x,y <= 1 treat as legacy normalised
    const isLegacy = s.points.every(p => p.x <= 1.0 && p.y <= 1.0);
    if (!isLegacy) return s;
    return { ...s, points: s.points.map(p=>({x: p.x*WORLD_W, y: p.y*WORLD_H})) };
  });

  // Minimum scale: board must cover the full canvas (no gray borders)
  const minScale = () => {
    const cv = canvasRef.current;
    if (!cv) return 0.08;
    return Math.max(cv.width / WORLD_W, cv.height / WORLD_H);
  };

  // Clamp offset so board always fills the canvas
  const clampOffset = (scale, ox, oy) => {
    const cv = canvasRef.current;
    if (!cv) return {ox, oy};
    const W = cv.width, H = cv.height;
    const bw = WORLD_W * scale, bh = WORLD_H * scale;
    const cx = bw >= W ? Math.min(0, Math.max(ox, W - bw)) : (W - bw) / 2;
    const cy = bh >= H ? Math.min(0, Math.max(oy, H - bh)) : (H - bh) / 2;
    return { ox: cx, oy: cy };
  };

  // Initial transform: fill viewport with board (no gray gaps)
  const fitView = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const scale = minScale();
    const {ox, oy} = clampOffset(scale, (cv.width - WORLD_W*scale)/2, (cv.height - WORLD_H*scale)/2);
    vt.current = {scale, ox, oy};
    setZoomPct(Math.round(scale*100));
  };

  // Convert screen px → world coords
  const s2w = (sx, sy) => {
    const {scale,ox,oy} = vt.current;
    return { x:(sx-ox)/scale, y:(sy-oy)/scale };
  };

  // Get canvas-pixel position from event
  const evPos = e => {
    const cv = canvasRef.current;
    if (!cv) return {x:0,y:0};
    const r  = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio||1;
    const src = e.touches ? e.touches[0] : e;
    return { x:(src.clientX-r.left)*dpr, y:(src.clientY-r.top)*dpr };
  };

  // ── Image element cache ───────────────────────────────────────────────────
  const getImgEl = img => {
    if (!imgCacheRef.current[img.id]) {
      const el = new Image();
      el.onload = () => redrawAll();
      el.src = img.src;
      imgCacheRef.current[img.id] = el;
    }
    return imgCacheRef.current[img.id];
  };

  // ── Rendering ─────────────────────────────────────────────────────────────
  const redrawAll = (extraStroke) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const {scale,ox,oy} = vt.current;

    ctx.save();
    ctx.setTransform(scale,0,0,scale,ox,oy);

    // White board surface
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,WORLD_W,WORLD_H);

    // Dot grid — dot size inversely proportional to scale so dots stay ~1px on screen
    const dotR = 1.5/scale;
    const step = 50;
    ctx.fillStyle = "#dde3ec";
    for (let x=step; x<WORLD_W; x+=step)
      for (let y=step; y<WORLD_H; y+=step) {
        ctx.beginPath(); ctx.arc(x,y,dotR,0,Math.PI*2); ctx.fill();
      }

    // Draw images (below strokes)
    imagesRef.current.forEach(img => {
      const el = getImgEl(img);
      if (!el.complete || !el.naturalWidth) return;
      ctx.save();
      ctx.translate(img.x + img.w/2, img.y + img.h/2);
      ctx.rotate(img.angle);
      ctx.drawImage(el, -img.w/2, -img.h/2, img.w, img.h);
      ctx.restore();
    });

    // Saved strokes
    strokesRef.current.forEach(s => paintStroke(ctx,s));
    // Live preview stroke (while drawing)
    if (extraStroke) paintStroke(ctx, extraStroke);

    ctx.restore();

    // Board border
    ctx.save();
    ctx.setTransform(scale,0,0,scale,ox,oy);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1/scale;
    ctx.strokeRect(0,0,WORLD_W,WORLD_H);
    ctx.restore();

    // Selection handles on top (only for selected image)
    if (selectedIdRef.current) {
      const img = imagesRef.current.find(i => i.id === selectedIdRef.current);
      if (img) drawImgHandles(ctx, img, scale, ox, oy);
    }
  };

  const drawImgHandles = (ctx, img, scale, ox, oy) => {
    const HS = 9/scale;      // handle half-size in world units (~9px on screen)
    const RD = 38/scale;     // rotation handle dist from top edge in world units

    ctx.save();
    ctx.setTransform(scale,0,0,scale,ox,oy);
    ctx.translate(img.x + img.w/2, img.y + img.h/2);
    ctx.rotate(img.angle);

    // Dashed selection border
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2/scale;
    ctx.setLineDash([8/scale, 4/scale]);
    ctx.strokeRect(-img.w/2, -img.h/2, img.w, img.h);
    ctx.setLineDash([]);

    // 4 corner resize handles
    for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
      const hx = sx * img.w/2, hy = sy * img.h/2;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2/scale;
      ctx.beginPath();
      ctx.rect(hx - HS, hy - HS, HS*2, HS*2);
      ctx.fill(); ctx.stroke();
    }

    // Rotation handle stem + circle
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5/scale;
    ctx.beginPath();
    ctx.moveTo(0, -img.h/2);
    ctx.lineTo(0, -img.h/2 - RD);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -img.h/2 - RD, HS*1.3, 0, Math.PI*2);
    ctx.fillStyle = "#2563eb";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${HS*2}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("↻", 0, -img.h/2 - RD);
    ctx.restore();
  };

  // ── Image hit testing (world coords) ─────────────────────────────────────
  const hitTestImage = (wx, wy) => {
    const {scale} = vt.current;
    const HS = 14/scale;   // hit radius in world units
    const RD = 38/scale;
    for (let i = imagesRef.current.length-1; i >= 0; i--) {
      const img = imagesRef.current[i];
      const cx = img.x + img.w/2, cy = img.y + img.h/2;
      const cos = Math.cos(-img.angle), sin = Math.sin(-img.angle);
      const dx = wx-cx, dy = wy-cy;
      const lx = dx*cos - dy*sin, ly = dx*sin + dy*cos;
      // Rotation handle
      if (Math.hypot(lx, ly+img.h/2+RD) < HS*1.5) return {idx:i, part:"rotate"};
      // Corner handles (only when selected)
      if (selectedIdRef.current === img.id) {
        if (Math.hypot(lx+img.w/2, ly+img.h/2) < HS) return {idx:i, part:"tl"};
        if (Math.hypot(lx-img.w/2, ly+img.h/2) < HS) return {idx:i, part:"tr"};
        if (Math.hypot(lx+img.w/2, ly-img.h/2) < HS) return {idx:i, part:"bl"};
        if (Math.hypot(lx-img.w/2, ly-img.h/2) < HS) return {idx:i, part:"br"};
      }
      // Body
      if (Math.abs(lx) <= img.w/2 && Math.abs(ly) <= img.h/2) return {idx:i, part:"body"};
    }
    return null;
  };

  const paintStroke = (ctx, s) => {
    const pts = s.points;
    if (!pts || pts.length<2) return;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = s.eraser ? "#ffffff" : (s.color||"#000");
    ctx.lineWidth   = s.lw;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
    ctx.stroke();
    ctx.restore();
  };

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const applyZoom = (factor, cxScreen, cyScreen) => {
    const {scale,ox,oy} = vt.current;
    const newScale = Math.max(minScale(), Math.min(8, scale*factor));
    const wx = (cxScreen-ox)/scale;
    const wy = (cyScreen-oy)/scale;
    const raw = { ox: cxScreen-wx*newScale, oy: cyScreen-wy*newScale };
    const clamped = clampOffset(newScale, raw.ox, raw.oy);
    vt.current = { scale:newScale, ...clamped };
    setZoomPct(Math.round(newScale*100));
    redrawAll();
  };

  const zoomIn  = () => { const cv=canvasRef.current; if(!cv)return; applyZoom(1.25, cv.width/2, cv.height/2); };
  const zoomOut = () => { const cv=canvasRef.current; if(!cv)return; applyZoom(0.8,  cv.width/2, cv.height/2); };
  const resetZoom = () => { fitView(); redrawAll(); };

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const r   = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio||1;
      const W   = Math.round(r.width*dpr);
      const H   = Math.round(r.height*dpr);
      if (cv.width!==W || cv.height!==H) {
        cv.width=W; cv.height=H;
        fitView();
        redrawAll();
      }
    };
    // Delay so the DOM has settled
    const t = setTimeout(resize, 50);
    const obs = new ResizeObserver(resize);
    if (canvasRef.current) obs.observe(canvasRef.current);
    return () => { clearTimeout(t); obs.disconnect(); };
  }, []);

  // Load strokes + images
  useEffect(() => {
    strokesRef.current  = upgradeStrokes(initData?.strokes||[]);
    imagesRef.current   = initData?.images||[];
    imgCacheRef.current = {};
    setStrokeCount(strokesRef.current.length);
    setImageCount(imagesRef.current.length);
    setTimeout(()=>{ fitView(); redrawAll(); }, 80);
  }, [initData]);

  // Wheel zoom (must be non-passive)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const handler = e => {
      e.preventDefault();
      const r   = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio||1;
      const cx  = (e.clientX-r.left)*dpr;
      const cy  = (e.clientY-r.top)*dpr;
      applyZoom(e.deltaY<0?1.1:0.91, cx, cy);
    };
    cv.addEventListener("wheel", handler, {passive:false});
    return () => cv.removeEventListener("wheel", handler);
  }, []);

  useEffect(() => { redrawAll(); }, [strokeCount, imageCount]);

  // ── Pointer events ────────────────────────────────────────────────────────
  const onDown = e => {
    e.preventDefault();
    const sp = evPos(e);
    const wp = s2w(sp.x, sp.y);
    // Middle-click OR pan tool → pan
    if (e.button===1 || toolRef.current==="pan") {
      isPanning.current = true;
      lastPan.current   = sp;
      return;
    }
    // Select tool: hit-test images
    if (toolRef.current==="select") {
      const hit = hitTestImage(wp.x, wp.y);
      if (hit) {
        const img = imagesRef.current[hit.idx];
        selectedIdRef.current = img.id;
        setSelectedImgId(img.id);
        imgDragRef.current = { type:hit.part, idx:hit.idx, origImg:{...img}, startWX:wp.x, startWY:wp.y };
      } else {
        selectedIdRef.current = null;
        setSelectedImgId(null);
        imgDragRef.current = null;
      }
      redrawAll();
      return;
    }
    if (readOnly) return;
    isDrawing.current = true;
    curPts.current    = [wp];
  };

  const onMove = e => {
    e.preventDefault();
    const sp = evPos(e);

    if (isPanning.current) {
      const dx = sp.x-lastPan.current.x;
      const dy = sp.y-lastPan.current.y;
      const {scale, ox, oy} = vt.current;
      const clamped = clampOffset(scale, ox+dx, oy+dy);
      vt.current = {...vt.current, ...clamped};
      lastPan.current = sp;
      redrawAll();
      return;
    }

    // Image drag (move / resize / rotate)
    if (imgDragRef.current) {
      const wp = s2w(sp.x, sp.y);
      const drag = imgDragRef.current;
      const orig = drag.origImg;
      const imgs = [...imagesRef.current];
      const img  = {...imgs[drag.idx]};
      const cx = orig.x + orig.w/2, cy = orig.y + orig.h/2;

      if (drag.type === "body") {
        img.x = orig.x + (wp.x - drag.startWX);
        img.y = orig.y + (wp.y - drag.startWY);
      } else if (drag.type === "rotate") {
        const a0 = Math.atan2(drag.startWY - cy, drag.startWX - cx);
        const a1 = Math.atan2(wp.y - cy, wp.x - cx);
        img.angle = orig.angle + (a1 - a0);
      } else {
        // Corner resize: uniform scale from center, maintain aspect ratio
        const cos = Math.cos(-orig.angle), sin = Math.sin(-orig.angle);
        const dxC = wp.x-cx, dyC = wp.y-cy;
        const lxC = dxC*cos - dyC*sin, lyC = dxC*sin + dyC*cos;
        const sx = (drag.type==="tl"||drag.type==="bl") ? -1 : 1;
        const sy = (drag.type==="tl"||drag.type==="tr") ? -1 : 1;
        const hw = orig.w/2, hh = orig.h/2;
        const factor = Math.max(0.05, (lxC*sx*hw + lyC*sy*hh) / (hw*hw + hh*hh));
        img.w = Math.max(50, orig.w * factor);
        img.h = Math.max(50, orig.h * factor);
        img.x = cx - img.w/2;
        img.y = cy - img.h/2;
      }
      imgs[drag.idx] = img;
      imagesRef.current = imgs;
      setImageCount(c => c+1);
      return;
    }

    if (!isDrawing.current || readOnly) return;
    curPts.current.push(s2w(sp.x,sp.y));
    redrawAll({ eraser:toolRef.current==="eraser", color:colorRef.current, lw:lwRef.current, points:curPts.current });
  };

  const onUp = e => {
    e.preventDefault();
    if (isPanning.current) { isPanning.current=false; return; }
    if (imgDragRef.current) { imgDragRef.current=null; return; }
    if (!isDrawing.current || readOnly) return;
    isDrawing.current = false;
    const pts = curPts.current.slice(); // snapshot BEFORE clearing
    curPts.current    = [];
    if (pts.length<2) return;
    strokesRef.current = [...strokesRef.current, { eraser:toolRef.current==="eraser", color:colorRef.current, lw:lwRef.current, points:pts }];
    setStrokeCount(strokesRef.current.length);
  };

  // Touch pinch zoom
  const onTouchStart = e => {
    e.preventDefault();
    if (e.touches.length===2) {
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      pinchDist.current = Math.hypot(dx,dy);
      isPanning.current = false;
      isDrawing.current = false;
    } else { onDown(e); }
  };
  const onTouchMove = e => {
    e.preventDefault();
    if (e.touches.length===2 && pinchDist.current!==null) {
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.hypot(dx,dy);
      const factor=dist/pinchDist.current;
      const cx=(e.touches[0].clientX+e.touches[1].clientX)/2;
      const cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
      const r=canvasRef.current.getBoundingClientRect();
      const dpr=window.devicePixelRatio||1;
      applyZoom(factor,(cx-r.left)*dpr,(cy-r.top)*dpr);
      pinchDist.current=dist;
    } else { onMove(e); }
  };
  const onTouchEnd = e => { e.preventDefault(); pinchDist.current=null; onUp(e); };

  // ── Paste image from clipboard ────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (readOnly) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (!item.type.startsWith("image/")) continue;
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.onload = ev => {
          const imgEl = new Image();
          imgEl.onload = () => {
            // Compress to JPEG, max 1200px wide
            const maxW = 1200;
            const ratio = Math.min(1, maxW / imgEl.width);
            const cw = Math.round(imgEl.width * ratio);
            const ch = Math.round(imgEl.height * ratio);
            const tmp = document.createElement("canvas");
            tmp.width = cw; tmp.height = ch;
            tmp.getContext("2d").drawImage(imgEl, 0, 0, cw, ch);
            const src = tmp.toDataURL("image/jpeg", 0.85);

            const cv = canvasRef.current;
            const {scale: sc, ox: ox0, oy: oy0} = vt.current;
            const vcx = (cv.width/2  - ox0) / sc;
            const vcy = (cv.height/2 - oy0) / sc;
            const maxWW = WORLD_W * 0.45;
            const fit   = Math.min(1, maxWW / cw);
            const ww = cw * fit, wh = ch * fit;

            const newImg = { id:`img_${Date.now()}`, src, x:vcx-ww/2, y:vcy-wh/2, w:ww, h:wh, angle:0 };
            imagesRef.current = [...imagesRef.current, newImg];
            selectedIdRef.current = newImg.id;
            setSelectedImgId(newImg.id);
            setTool("select");
            setImageCount(c => c+1);
          };
          imgEl.src = ev.target.result;
        };
        reader.readAsDataURL(blob);
        break;
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [readOnly]);

  // ── Keyboard: Delete selected image, Escape to deselect ──────────────────
  useEffect(() => {
    const handler = e => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIdRef.current) {
          e.preventDefault();
          imagesRef.current = imagesRef.current.filter(i => i.id !== selectedIdRef.current);
          selectedIdRef.current = null;
          setSelectedImgId(null);
          setImageCount(c => c+1);
        }
      }
      if (e.key === "Escape") {
        selectedIdRef.current = null;
        setSelectedImgId(null);
        redrawAll();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const deleteSelectedImage = () => {
    if (!selectedIdRef.current) return;
    imagesRef.current = imagesRef.current.filter(i => i.id !== selectedIdRef.current);
    selectedIdRef.current = null;
    setSelectedImgId(null);
    setImageCount(c => c+1);
  };

  const undo = () => { strokesRef.current=strokesRef.current.slice(0,-1); setStrokeCount(strokesRef.current.length); };
  const clear = () => {
    if(!confirm("Очистить всю доску?"))return;
    strokesRef.current=[]; imagesRef.current=[];
    selectedIdRef.current=null; setSelectedImgId(null);
    setStrokeCount(0); setImageCount(0);
  };
  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ strokes: strokesRef.current, images: imagesRef.current }); setSavedOk(true); setTimeout(()=>setSavedOk(false),2500); }
    catch(err) { alert("Ошибка сохранения: "+err.message); }
    setSaving(false);
  };

  // ── Cursor ────────────────────────────────────────────────────────────────
  const cursor = readOnly ? "default" : toolUI==="pan" ? "grab" : toolUI==="eraser" ? "cell" : toolUI==="select" ? (selectedImgId?"move":"default") : "crosshair";

  return (
    <div ref={wrapRef} style={{display:"flex",flexDirection:"column",height:"100%",width:"100%",overflow:"hidden",background:"#e8ecf0"}}>
      {/* ── Toolbar ── */}
      <div style={{display:"flex",gap:8,padding:"8px 14px",background:"#1e293b",flexWrap:"wrap",alignItems:"center",flexShrink:0,userSelect:"none"}}>
        {!readOnly && (<>
          {/* Tools */}
          {[{id:"pen",icon:"✏️",tip:"Ручка"},{id:"eraser",icon:"◻",tip:"Ластик"},{id:"select",icon:"↖",tip:"Выбрать/двигать изображение (Ctrl+V чтобы вставить)"},{id:"pan",icon:"✋",tip:"Панорама (или зажми колесо мыши)"}].map(t=>(
            <button key={t.id} onClick={()=>setTool(t.id)} title={t.tip}
              style={{padding:"6px 12px",borderRadius:7,border:`2px solid ${toolUI===t.id?"#60a5fa":"rgba(255,255,255,0.15)"}`,background:toolUI===t.id?"#1d4ed8":"rgba(255,255,255,0.07)",color:"#fff",cursor:"pointer",fontSize:15,fontWeight:600,transition:"all 0.15s"}}>
              {t.icon}
            </button>
          ))}
          {/* Delete selected image */}
          {selectedImgId && (
            <button onClick={deleteSelectedImage} title="Удалить выбранное изображение (Delete)"
              style={{padding:"6px 11px",borderRadius:7,border:"1px solid rgba(239,68,68,0.5)",background:"rgba(239,68,68,0.15)",color:"#fca5a5",cursor:"pointer",fontSize:13,fontWeight:600}}>
              🗑 Удалить фото
            </button>
          )}
          <div style={{width:1,height:26,background:"rgba(255,255,255,0.15)"}}/>
          {/* Colors */}
          {WB_COLORS.map(c=>(
            <button key={c} onClick={()=>{setColor(c);setTool("pen");}}
              style={{width:24,height:24,borderRadius:"50%",background:c,border:`3px solid ${colorUI===c&&toolUI==="pen"?"#60a5fa":"rgba(255,255,255,0.2)"}`,cursor:"pointer",padding:0,flexShrink:0,boxShadow:c==="#ffffff"?"inset 0 0 0 1px rgba(255,255,255,0.4)":"none",transition:"border-color 0.1s"}}/>
          ))}
          <div style={{width:1,height:26,background:"rgba(255,255,255,0.15)"}}/>
          {/* Widths */}
          {WB_WIDTHS.map(w=>(
            <button key={w.v} onClick={()=>setLw(w.v)} title={w.label}
              style={{width:32,height:32,borderRadius:7,border:`2px solid ${lwUI===w.v?"#60a5fa":"rgba(255,255,255,0.15)"}`,background:lwUI===w.v?"#1d4ed8":"rgba(255,255,255,0.07)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{borderRadius:"50%",background:"#fff",width:Math.min(w.v/1.5+3,20),height:Math.min(w.v/1.5+3,20)}}/>
            </button>
          ))}
          <div style={{width:1,height:26,background:"rgba(255,255,255,0.15)"}}/>
        </>)}
        {/* Zoom controls */}
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={zoomOut} title="Уменьшить (−)" style={{width:30,height:30,borderRadius:7,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.07)",color:"#fff",cursor:"pointer",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
          <span style={{color:"#94a3b8",fontSize:12,fontWeight:700,minWidth:44,textAlign:"center"}}>{zoomPct}%</span>
          <button onClick={zoomIn}  title="Увеличить (+)" style={{width:30,height:30,borderRadius:7,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.07)",color:"#fff",cursor:"pointer",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
          <button onClick={resetZoom} title="Сбросить вид" style={{padding:"4px 10px",borderRadius:7,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.07)",color:"#94a3b8",cursor:"pointer",fontSize:11,fontWeight:700}}>⊡ Fit</button>
        </div>
        {/* Right actions */}
        <div style={{display:"flex",gap:8,marginLeft:"auto",alignItems:"center"}}>
          {savedOk && <span style={{color:"#4ade80",fontSize:13,fontWeight:700}}>✓ Сохранено!</span>}
          {!readOnly && (<>
            <button onClick={undo} title="Отменить последний штрих" style={{padding:"5px 10px",borderRadius:7,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.07)",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700}}>↩</button>
            <button onClick={clear} style={{padding:"5px 12px",borderRadius:7,border:"1px solid rgba(239,68,68,0.5)",background:"rgba(239,68,68,0.12)",color:"#fca5a5",cursor:"pointer",fontSize:12,fontWeight:600}}>Очистить</button>
            <button onClick={handleSave} disabled={saving} style={{padding:"5px 18px",borderRadius:7,border:"none",background:saving?"#475569":"#d4af37",color:saving?"#94a3b8":"#0f172a",cursor:saving?"default":"pointer",fontSize:13,fontWeight:700}}>
              {saving?"Сохраняю...":"💾 Сохранить"}
            </button>
          </>)}
        </div>
      </div>
      {/* ── Canvas ── */}
      <div style={{flex:1,position:"relative",overflow:"hidden",minHeight:0}}>
        <canvas ref={canvasRef}
          style={{display:"block",width:"100%",height:"100%",cursor,touchAction:"none"}}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        />
        {strokeCount===0 && imageCount===0 && readOnly && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
            <div style={{textAlign:"center",color:"#94a3b8",background:"rgba(255,255,255,0.9)",padding:"32px 48px",borderRadius:16,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:52,marginBottom:12}}>🖊️</div>
              <div style={{fontSize:16,fontWeight:700,marginBottom:4,color:"#64748b"}}>Доска пока пуста</div>
              <div style={{fontSize:13,color:"#94a3b8"}}>Записи появятся после занятия</div>
            </div>
          </div>
        )}
        {/* Hint */}
        {!readOnly && (
          <div style={{position:"absolute",bottom:12,right:16,fontSize:11,color:"rgba(255,255,255,0.45)",background:"rgba(0,0,0,0.45)",padding:"4px 10px",borderRadius:99,pointerEvents:"none"}}>
            Ctrl+V — вставить скрин · ↖ выбрать/двигать · Колесо — зум
          </div>
        )}
      </div>
    </div>
  );
}
