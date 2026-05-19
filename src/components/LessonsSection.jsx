import React, { useState } from "react";
import { THEME } from "../lib/appConstants.js";

export default function LessonsSection({ user, firebaseUser, isAdmin, isTeacher, students }) {
  const [lessons,setLessons]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showCreate,setShowCreate]=useState(false);
  // Create form state
  const [createStudentId,setCreateStudentId]=useState('');
  const [createMode,setCreateMode]=useState('once'); // 'once' | 'weekly'
  const [createDate,setCreateDate]=useState('');
  const [createTime,setCreateTime]=useState('10:00');
  const [createDuration,setCreateDuration]=useState(60);
  const [createWeekDays,setCreateWeekDays]=useState([]);
  const [createWeeks,setCreateWeeks]=useState(8);
  const [createStartFrom,setCreateStartFrom]=useState(new Date().toISOString().slice(0,10));
  const [creating,setCreating]=useState(false);
  const [createError,setCreateError]=useState('');
  const [createSuccess,setCreateSuccess]=useState('');

  const API = window.location.origin;

  const loadLessons = async ()=>{
    setLoading(true);
    try{
      const token = await firebaseUser.getIdToken();
      const r = await fetch(`${API}/api/lessons`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      // Server already filters by studentId for non-admin/teacher
      setLessons(d.lessons||[]);
    }catch(e){ console.error(e); }
    setLoading(false);
  };

  useState(()=>{ loadLessons(); },[]);
  // Use useEffect to load on mount
  React.useEffect(()=>{ loadLessons(); },[]);

  function buildDates(){
    const dates=[];
    const from=new Date(`${createStartFrom}T${createTime}:00`);
    const until=new Date(from);
    until.setDate(until.getDate()+createWeeks*7);
    const cur=new Date(from);
    while(cur<=until){
      if(createWeekDays.includes(cur.getDay())) dates.push(new Date(cur).toISOString());
      cur.setDate(cur.getDate()+1);
    }
    return dates;
  }

  const handleCreate = async e=>{
    e.preventDefault();
    if(!createStudentId){ setCreateError('Выберите ученика'); return; }
    setCreating(true); setCreateError(''); setCreateSuccess('');
    const student = students.find(s=>s.id===createStudentId);
    const studentName = student?`${student.firstName} ${student.lastName}`:'Ученик';
    try{
      const token = await firebaseUser.getIdToken();
      if(createMode==='once'){
        if(!createDate){ setCreateError('Выберите дату'); setCreating(false); return; }
        const isoDate = new Date(`${createDate}T${createTime}:00`).toISOString();
        const r = await fetch(`${API}/api/lessons`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body:JSON.stringify({studentId:createStudentId,date:isoDate,durationMinutes:createDuration,studentName})});
        const d = await r.json();
        if(!r.ok) throw new Error(d.error||'Ошибка сервера');
        setCreateSuccess('✓ Урок создан');
      } else {
        if(!createWeekDays.length){ setCreateError('Выберите хотя бы один день'); setCreating(false); return; }
        const dates = buildDates();
        if(!dates.length){ setCreateError('Нет дат в выбранном диапазоне'); setCreating(false); return; }
        const r = await fetch(`${API}/api/lessons-batch`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
          body:JSON.stringify({studentId:createStudentId,studentName,dates,durationMinutes:createDuration})});
        const d = await r.json();
        if(!r.ok) throw new Error(d.error||'Ошибка сервера');
        setCreateSuccess(`✓ Создано ${d.count} уроков`);
      }
      setTimeout(()=>{ setShowCreate(false); setCreateSuccess(''); loadLessons(); },1200);
    }catch(err){ setCreateError(err.message); }
    setCreating(false);
  };

  function isJoinable(lesson){
    const start=new Date(lesson.date).getTime();
    const end=start+lesson.durationMinutes*60000;
    const now=Date.now();
    return now>=start-15*60000&&now<=end;
  }
  function fmtTime(iso){ return new Date(iso).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }
  function fmtDay(iso){ return new Date(iso).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}); }

  // Group lessons by day
  const byDay={};
  for(const l of lessons){
    const day=l.date.slice(0,10);
    if(!byDay[day]) byDay[day]=[];
    byDay[day].push(l);
  }

  const DAYS=[{l:'Пн',v:1},{l:'Вт',v:2},{l:'Ср',v:3},{l:'Чт',v:4},{l:'Пт',v:5},{l:'Сб',v:6},{l:'Вс',v:0}];

  return(
    <div style={{padding:'0 0 40px'}}>
      <div className="dashboard-header">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{margin:0}}>Расписание занятий</h1>
            <p style={{color:THEME.textLight,marginTop:6,fontSize:14}}>{isAdmin||isTeacher?'Все предстоящие уроки':'Ваши предстоящие уроки'}</p>
          </div>
          {(isAdmin||isTeacher)&&(
            <button onClick={()=>setShowCreate(true)} style={{background:THEME.accent,color:'#0f172a',fontWeight:700,fontSize:14,padding:'10px 20px',borderRadius:12,border:'none',cursor:'pointer'}}>
              + Урок
            </button>
          )}
        </div>
      </div>

      {loading?(
        <div style={{textAlign:'center',padding:48,color:THEME.textLight}}>Загрузка...</div>
      ):lessons.length===0?(
        <div style={{textAlign:'center',padding:64}}>
          <div style={{fontSize:48,marginBottom:12}}>📅</div>
          <div style={{color:THEME.textLight,fontSize:15}}>Предстоящих уроков нет</div>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:32}}>
          {Object.entries(byDay).map(([day,dayLessons])=>(
            <div key={day}>
              <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10,paddingLeft:4}}>
                {fmtDay(dayLessons[0].date)}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {dayLessons.map(lesson=>{
                  const student=isTeacher?students.find(s=>s.id===lesson.studentId):null;
                  const name=student?`${student.firstName} ${student.lastName}`:lesson.studentId;
                  const joinable=isJoinable(lesson);
                  const url=isAdmin||isTeacher?lesson.zoomStartUrl:lesson.zoomJoinUrl;
                  const hasRecording=lesson.status==='completed'&&lesson.driveVideoUrl;
                  return(
                    <div key={lesson.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:THEME.card,borderRadius:14,border:`1px solid ${THEME.border}`,padding:'14px 20px',gap:12,flexWrap:'wrap'}}>
                      <div style={{display:'flex',alignItems:'center',gap:16}}>
                        <div style={{minWidth:52,textAlign:'center'}}>
                          <div style={{fontSize:18,fontWeight:700,color:THEME.text}}>{fmtTime(lesson.date)}</div>
                          <div style={{fontSize:11,color:THEME.textLight}}>{lesson.durationMinutes} мин</div>
                        </div>
                        <div style={{width:1,height:36,background:THEME.border}}/>
                        <div>
                          {(isAdmin||isTeacher)&&<div style={{fontWeight:600,color:THEME.text,fontSize:15}}>{name}</div>}
                          {hasRecording
                            ? <a href={lesson.driveVideoUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:THEME.accent,textDecoration:'none'}}>📹 Запись занятия</a>
                            : <div style={{fontSize:12,color:THEME.textLight}}>{lesson.status==='completed'?'Запись обрабатывается...':'Запланировано'}</div>
                          }
                        </div>
                      </div>
                      {url&&(
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          style={{background:joinable?THEME.accent:'rgba(212,175,55,0.12)',color:joinable?'#0f172a':THEME.accent,fontWeight:700,fontSize:13,padding:'8px 18px',borderRadius:10,textDecoration:'none',border:`1px solid ${joinable?THEME.accent:THEME.accent+'40'}`,transition:'all 0.15s',whiteSpace:'nowrap'}}>
                          {joinable?'▶ Начать':'🔗 Подключиться'}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create lesson modal */}
      {showCreate&&(
        <div className="modal-overlay" onClick={()=>setShowCreate(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:460,width:'100%'}}>
            <div className="modal-title">Новый урок</div>
            <form onSubmit={handleCreate} style={{display:'flex',flexDirection:'column',gap:16}}>
              {/* Student */}
              <div className="input-group">
                <label className="input-label">Ученик</label>
                <select required value={createStudentId} onChange={e=>setCreateStudentId(e.target.value)} className="input-field">
                  <option value="">Выберите ученика...</option>
                  {students.map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName}{s.grade?` · ${s.grade}`:''}</option>)}
                </select>
              </div>

              {/* Mode toggle */}
              <div style={{display:'flex',borderRadius:10,border:`1px solid ${THEME.border}`,overflow:'hidden'}}>
                {[{v:'once',l:'Разовый'},{v:'weekly',l:'Еженедельно'}].map(m=>(
                  <button key={m.v} type="button" onClick={()=>setCreateMode(m.v)}
                    style={{flex:1,padding:'8px 0',fontWeight:700,fontSize:13,border:'none',cursor:'pointer',
                      background:createMode===m.v?THEME.accent:'transparent',
                      color:createMode===m.v?'#0f172a':THEME.textLight,transition:'all 0.15s'}}>
                    {m.l}
                  </button>
                ))}
              </div>

              {createMode==='once'?(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div className="input-group"><label className="input-label">Дата</label>
                    <input required type="date" value={createDate} min={new Date().toISOString().slice(0,10)}
                      onChange={e=>setCreateDate(e.target.value)} className="input-field"/></div>
                  <div className="input-group"><label className="input-label">Время</label>
                    <input required type="time" value={createTime} onChange={e=>setCreateTime(e.target.value)} className="input-field"/></div>
                </div>
              ):(
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div className="input-group">
                    <label className="input-label">Дни недели</label>
                    <div style={{display:'flex',gap:6}}>
                      {DAYS.map(d=>(
                        <button key={d.v} type="button"
                          onClick={()=>setCreateWeekDays(p=>p.includes(d.v)?p.filter(x=>x!==d.v):[...p,d.v])}
                          style={{flex:1,padding:'6px 0',borderRadius:8,border:'none',cursor:'pointer',fontWeight:700,fontSize:12,
                            background:createWeekDays.includes(d.v)?THEME.accent:'rgba(255,255,255,0.06)',
                            color:createWeekDays.includes(d.v)?'#0f172a':THEME.textLight,transition:'all 0.15s'}}>
                          {d.l}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div className="input-group"><label className="input-label">Время</label>
                      <input type="time" value={createTime} onChange={e=>setCreateTime(e.target.value)} className="input-field"/></div>
                    <div className="input-group"><label className="input-label">Начиная с</label>
                      <input type="date" value={createStartFrom} min={new Date().toISOString().slice(0,10)}
                        onChange={e=>setCreateStartFrom(e.target.value)} className="input-field"/></div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">На {createWeeks} недель вперёд{createWeekDays.length>0?` (~${buildDates().length} уроков)`:''}</label>
                    <input type="range" min={1} max={24} step={1} value={createWeeks} onChange={e=>setCreateWeeks(Number(e.target.value))} style={{width:'100%',accentColor:THEME.accent}}/>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:THEME.textLight,marginTop:2}}>
                      <span>1</span><span>4</span><span>8</span><span>16</span><span>24 нед</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Duration */}
              <div className="input-group">
                <label className="input-label">Продолжительность: {createDuration} мин</label>
                <input type="range" min={30} max={120} step={15} value={createDuration} onChange={e=>setCreateDuration(Number(e.target.value))} style={{width:'100%',accentColor:THEME.accent}}/>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:THEME.textLight,marginTop:2}}>
                  <span>30</span><span>60</span><span>90</span><span>120 мин</span>
                </div>
              </div>

              {createError&&<div style={{background:'rgba(239,68,68,0.1)',color:'#ef4444',borderRadius:10,padding:'10px 14px',fontSize:13}}>{createError}</div>}
              {createSuccess&&<div style={{background:'rgba(34,197,94,0.1)',color:'#22c55e',borderRadius:10,padding:'10px 14px',fontSize:13,textAlign:'center',fontWeight:700}}>{createSuccess}</div>}

              <div style={{display:'flex',gap:10,marginTop:4}}>
                <button type="button" onClick={()=>setShowCreate(false)} className="btn-secondary" style={{flex:1}}>Отмена</button>
                <button type="submit" disabled={creating} className="btn-primary" style={{flex:1}}>
                  {creating?(createMode==='weekly'?'Создаём уроки...':'Создаём...'):(createMode==='weekly'?'📅 Создать расписание':'📹 Создать урок')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
