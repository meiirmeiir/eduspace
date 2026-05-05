import React, { useState } from "react";
import { THEME } from "../../lib/appConstants.js";
import { generateQuestion } from "../../lib/mathUtils.js";
import MathText from "../ui/MathText.jsx";

export default function QuestionPreview({ qForm }) {
  const [preview, setPreview] = useState(null);
  const [visible, setVisible] = useState(false);

  const showPreview = () => {
    try {
      if (qForm.type === 'generated' || qForm.type === 'model') {
        const q = {
          text: qForm.text,
          type: qForm.type,
          variables: qForm.variables,
          derivedVars: qForm.derivedVars,
          answerFormula: qForm.answerFormula,
          wrongFormulas: qForm.wrongFormulas,
          answerDisplay: qForm.answerDisplay || {type:'integer', decimals:2},
        };
        setPreview(generateQuestion(q));
      } else {
        setPreview({...qForm, _static: true});
      }
      setVisible(true);
    } catch(e) { alert('Ошибка предпросмотра: ' + e.message); }
  };

  const type = qForm.type;
  const pv = preview;

  return (
    <div className="input-group">
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:visible&&pv?12:0}}>
        <label className="input-label" style={{margin:0}}>Предпросмотр</label>
        <button type="button" onClick={showPreview} style={{background:THEME.primary,color:THEME.accent,border:'none',borderRadius:6,padding:'4px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
          {(type==='generated'||type==='model')?'🎲 Сгенерировать':'👁 Показать'}
        </button>
        {visible&&pv&&<button type="button" onClick={()=>setVisible(false)} style={{background:'transparent',border:`1px solid ${THEME.border}`,borderRadius:6,padding:'4px 10px',fontSize:12,cursor:'pointer',color:THEME.textLight}}>Скрыть</button>}
      </div>
      {visible&&pv&&(
        <div style={{padding:'16px',borderRadius:10,background:'#f8fafc',border:`1px solid ${THEME.border}`}}>
          <div style={{fontWeight:700,color:THEME.text,marginBottom:14,fontSize:15,lineHeight:1.5}}>
            <MathText text={type==='generated'?pv.text:(qForm.text||'')}/>
          </div>
          {qForm.image&&<img src={qForm.image} alt="q" style={{maxWidth:'100%',maxHeight:200,borderRadius:8,marginBottom:12,display:'block'}}/>}
          {(type==='mcq'||type==='generated'||type==='model')&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {(pv.options||[]).map((opt,i)=>(
                <div key={i} style={{padding:'8px 12px',borderRadius:8,fontSize:13,background:i===(pv.correct??0)?'rgba(16,185,129,0.1)':'#fff',border:`1px solid ${i===(pv.correct??0)?THEME.success:THEME.border}`,fontWeight:i===(pv.correct??0)?700:400,color:i===(pv.correct??0)?'#065f46':THEME.text}}>
                  {String.fromCharCode(65+i)}. <MathText text={String(opt)}/> {i===(pv.correct??0)&&'✓'}
                </div>
              ))}
            </div>
          )}
          {type==='multiple'&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {qForm.options.map((opt,i)=>(
                <div key={i} style={{padding:'8px 12px',borderRadius:8,fontSize:13,background:(qForm.correctAnswers||[]).includes(i)?'rgba(16,185,129,0.1)':'#fff',border:`1px solid ${(qForm.correctAnswers||[]).includes(i)?THEME.success:THEME.border}`,fontWeight:(qForm.correctAnswers||[]).includes(i)?700:400,color:(qForm.correctAnswers||[]).includes(i)?'#065f46':THEME.text}}>
                  {String.fromCharCode(65+i)}. <MathText text={opt}/> {(qForm.correctAnswers||[]).includes(i)&&'✓'}
                </div>
              ))}
            </div>
          )}
          {type==='matching'&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {qForm.pairs.map((pair,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:10,alignItems:'center'}}>
                  <div style={{padding:'7px 12px',borderRadius:7,background:'#fff',border:`1px solid ${THEME.border}`,fontSize:13}}><MathText text={pair.left}/></div>
                  <span style={{color:THEME.textLight,fontWeight:700}}>→</span>
                  <div style={{padding:'7px 12px',borderRadius:7,background:'rgba(16,185,129,0.08)',border:`1px solid ${THEME.success}`,fontSize:13,color:'#065f46',fontWeight:600}}><MathText text={pair.right}/></div>
                </div>
              ))}
            </div>
          )}
          {type==='compound'&&(
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {(qForm.subQuestions||[]).map((sq,sqi)=>(
                <div key={sqi} style={{padding:'12px 14px',borderRadius:8,background:'#fff',border:`1px solid ${THEME.border}`}}>
                  <div style={{fontWeight:600,fontSize:13,marginBottom:8,color:THEME.text}}><MathText text={sq.text}/></div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    {sq.options.map((opt,oi)=>(
                      <div key={oi} style={{padding:'6px 10px',borderRadius:6,fontSize:12,background:oi===sq.correct?'rgba(16,185,129,0.1)':'#f8fafc',border:`1px solid ${oi===sq.correct?THEME.success:THEME.border}`,fontWeight:oi===sq.correct?700:400,color:oi===sq.correct?'#065f46':THEME.text}}>
                        {String.fromCharCode(65+oi)}. <MathText text={opt}/> {oi===sq.correct&&'✓'}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {type==='open'&&(
            <div style={{padding:'10px 14px',borderRadius:8,background:'#fff',border:`1px dashed ${THEME.border}`,color:THEME.textLight,fontSize:13}}>
              ✏️ Поле для свободного ответа ученика
            </div>
          )}
          {type==='generated'&&pv._vars&&(
            <div style={{marginTop:10,fontSize:11,color:THEME.textLight}}>
              Переменные: {Object.entries(pv._vars).map(([k,v])=>`${k}=${typeof v==='number'?+v.toFixed(6):v}`).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
