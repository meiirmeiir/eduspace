import React, { useState, useEffect, useRef } from "react";
import { addDoc, collection, db, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "../firestore-rest.js";
import { compressImage, parseGradeNumber, computeSkillC, getM_c, computeKAdj, computeS_diag, computeM_g_final } from "../lib/mathUtils.js";
import { runDiagnosticSimulation } from "../lib/diagnosticUtils.js";
import { REG_GOALS, DIFFICULTY_COLORS, EXAMS_LIST, GRADES_LIST, STUDENT_STATUSES, QUESTION_TYPES, THEME } from "../lib/appConstants.js";
import Logo from "../components/ui/Logo.jsx";
import LatexText from "../components/ui/LatexText.jsx";
import RadarChart from "../components/ui/RadarChart.jsx";
import ChartEditor from "../components/admin/ChartEditor.jsx";
import QuestionPreview from "../components/admin/QuestionPreview.jsx";
import SkillMapCanvas from "../components/admin/SkillMapCanvas.jsx";
import InteractiveSkillTree from "../components/skillTree/InteractiveSkillTree.jsx";
import ModuleTreeModal from "../components/moduleTree/ModuleTreeModal.jsx";

export default function AdminScreen({ onBack, firebaseUser }) {
  const [tab,setTab]=useState("sections");
  const [sections,setSections]=useState([]);
  const [questions,setQuestions]=useState([]);
  const [students,setStudents]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showModuleTree,setShowModuleTree]=useState(false);
  // Skill Tasks tab state
  const [sktSkillId,setSktSkillId]=useState('');
  const [sktSkillName,setSktSkillName]=useState('');
  const [sktLevel,setSktLevel]=useState('a');
  const [sktJsonText,setSktJsonText]=useState('');
  const [sktSaving,setSktSaving]=useState(false);
  const [sktEntries,setSktEntries]=useState([]);
  const [sktLoaded,setSktLoaded]=useState(false);
  const [showSktPrompt,setShowSktPrompt]=useState(false);

  // Section form
  const emptySecForm = {name:"",description:"",goalKeys:[],specificTarget:"",sectionType:"regular",isPublic:false};
  const [secForm,setSecForm]=useState(emptySecForm);
  const [showSecForm,setShowSecForm]=useState(false);
  const [editingSection,setEditingSection]=useState(null); // id of section being edited

  // Question form
  const emptyQForm = {sectionId:"",sectionName:"",_target:"",topic:"",text:"",image:"",conditionChart:null,type:"mcq",difficulty:"A",options:["","","",""],optionImages:["","","",""],optionCharts:[null,null,null,null],correct:0,correctAnswers:[],pairs:[{left:"",right:"",leftImage:"",rightImage:""},{left:"",right:"",leftImage:"",rightImage:""}],goals:[],variables:[],derivedVars:[],answerFormula:"",wrongFormulas:["","",""],answerDisplay:{type:"integer",decimals:2},subQuestions:[{text:"",image:"",options:["","","",""],optionImages:["","","",""],correct:0,skillNames:[],difficulty:"A"}],skillNames:[]};
  const [qForm,setQForm]=useState(emptyQForm);
  const [showQForm,setShowQForm]=useState(false);
  const [editingQuestion,setEditingQuestion]=useState(null); // id of question being edited
  const [editingInlineId,setEditingInlineId]=useState(null); // id rendered inline
  const [filterGoalQ,setFilterGoalQ]=useState("all");
  const [filterTargetQ,setFilterTargetQ]=useState("all");
  const [filterSec,setFilterSec]=useState("all");

  // Topics (sub-topics within a section/chapter)
  const [topics,setTopics]=useState([]);
  const emptyTopicForm={sectionId:"",name:"",description:"",order:0};
  const [topicForm,setTopicForm]=useState(emptyTopicForm);
  const [showTopicForm,setShowTopicForm]=useState(null); // sectionId where form is open
  const [editingTopic,setEditingTopic]=useState(null);
  const [expandedSec,setExpandedSec]=useState(null); // sectionId whose topics are visible

  // Theory  (block-based content: [{type:"text",value:"",skills:[]} | {type:"image",src:"",caption:"",skills:[]}])
  const emptyThForm={sectionId:"",sectionName:"",topicId:"",topicName:"",title:"",blocks:[{type:"text",value:"",skills:[]}],cards:[{front:"",back:""}]};
  // formula block: {type:"formula",value:"",skills:[]}
  const [theories,setTheories]=useState([]);
  const [thForm,setThForm]=useState(emptyThForm);
  const [showThForm,setShowThForm]=useState(false);
  const [editingTheory,setEditingTheory]=useState(null);
  const [filterThSec,setFilterThSec]=useState("all");
  const [filterThGrade,setFilterThGrade]=useState("all");
  const [newSkillInput,setNewSkillInput]=useState({}); // blockIdx → string
  const [showThAiImport,setShowThAiImport]=useState(false);
  const [thAiText,setThAiText]=useState("");
  const [thImportKey,setThImportKey]=useState(0);
  const [showBulkThImport,setShowBulkThImport]=useState(false);
  const [bulkThText,setBulkThText]=useState("");
  const [bulkThSectionId,setBulkThSectionId]=useState("");
  const [bulkThImporting,setBulkThImporting]=useState(false);
  const [bulkThParsed,setBulkThParsed]=useState(null); // null | [{topicName,tp,newBlocks,newCards,newTitle}]
  const [showTopicBulkImport,setShowTopicBulkImport]=useState(false);
  const [topicBulkText,setTopicBulkText]=useState("");
  const [topicBulkImporting,setTopicBulkImporting]=useState(false);

  // CSV import
  const [showCsvImport,setShowCsvImport]=useState(false);
  const [showQMatrix,setShowQMatrix]=useState(false);
  const [showCsvInstruction,setShowCsvInstruction]=useState(false);
  const [csvGoal,setCsvGoal]=useState("");
  const [csvTarget,setCsvTarget]=useState("");
  const [csvSectionId,setCsvSectionId]=useState("");
  const [csvText,setCsvText]=useState("");
  const [csvImporting,setCsvImporting]=useState(false);
  const [aiGenerating,setAiGenerating]=useState(false);
  const [aiGenError,setAiGenError]=useState('');
  const [aiGenModel,setAiGenModel]=useState('');
  const [geminiKey,setGeminiKey]=useState(()=>localStorage.getItem('eduspace_gemini_key')||'');
  const [geminiKeySaving,setGeminiKeySaving]=useState(false);
  const [geminiKeyEditing,setGeminiKeyEditing]=useState(false);
  const [geminiKeyDraft,setGeminiKeyDraft]=useState('');
  useEffect(()=>{
    getDoc(doc(db,'settings','admin')).then(d=>{
      const k=d.data()?.geminiKey||'';
      if(k){setGeminiKey(k);localStorage.setItem('eduspace_gemini_key',k);}
    }).catch(()=>{});
  },[]);

  const [allDbSkills,setAllDbSkills]=useState([]);
  const [skillsDb,setSkillsDb]=useState([]); // new micro-skills collection
  const [skillHierarchies,setSkillHierarchies]=useState([]);
  const [cdmSectionId,setCdmSectionId]=useState('');
  const [cdmJsonDraft,setCdmJsonDraft]=useState('');
  const [cdmSaving,setCdmSaving]=useState(false);
  const [crossGradeLinks,setCrossGradeLinks]=useState([]);
  const [cgmPair,setCgmPair]=useState('');
  const [cgmChain,setCgmChain]=useState([]);
  const [cgmJsonDraft,setCgmJsonDraft]=useState('');
  const [cgmSaving,setCgmSaving]=useState(false);
  const [vlJsonDraft,setVlJsonDraft]=useState('');
  const [vlSaving,setVlSaving]=useState(false);
  const [vlGenerating,setVlGenerating]=useState(false);
  const [prereqLinking,setPrereqLinking]=useState(false);
  const [prereqLinkResult,setPrereqLinkResult]=useState(null);
  const [masterMap,setMasterMap]=useState(null);
  const [masterMapBuilding,setMasterMapBuilding]=useState(false);
  const [tbGrade,setTbGrade]=useState('');
  const [tbSkillId,setTbSkillId]=useState('');
  const [tbJsonDraft,setTbJsonDraft]=useState('');
  const [tbSaving,setTbSaving]=useState(false);
  const [tbGenerating,setTbGenerating]=useState(false);
  const [taskBankEntries,setTaskBankEntries]=useState([]);
  const [tbBulkRunning,setTbBulkRunning]=useState(false);
  const [tbBulkResults,setTbBulkResults]=useState([]);
  // Simulator
  const [simGrade,setSimGrade]=useState("11 класс");
  const [simStrategy,setSimStrategy]=useState("ALWAYS_WRONG");
  const [simMaxSteps,setSimMaxSteps]=useState(200);
  const [simRunning,setSimRunning]=useState(false);
  const [simResult,setSimResult]=useState(null);
  const [simView,setSimView]=useState("chart");
  const [simHoverStep,setSimHoverStep]=useState(null);
  const [tbBulkSummary,setTbBulkSummary]=useState(null);
  const [skillTheoryEntries,setSkillTheoryEntries]=useState([]);
  const [stDraft,setStDraft]=useState('');
  const [stParsed,setStParsed]=useState(null);
  const [stSaving,setStSaving]=useState(false);
  const [stResult,setStResult]=useState(null);
  const [stSelectedId,setStSelectedId]=useState('');
  const [stShowPrompt,setStShowPrompt]=useState(false);
  const [stPromptGrade,setStPromptGrade]=useState('');
  const [stChunkIndex,setStChunkIndex]=useState(null);
  const [filterSkillSec,setFilterSkillSec]=useState("all");
  const [showSkillForm,setShowSkillForm]=useState(false);
  const [skillForm,setSkillForm]=useState({sectionId:"",sectionName:"",grade:"",name:"",errorScenario:"",quarter:"",goalCode:"",W_exam:0,W_dep:0,A:3,W_mem:3,T_depth:3,I_score:3,T_base:60,exercises:[""],homework:[""]});
  const [skillCsvText,setSkillCsvText]=useState("");
  const [showSkillCsv,setShowSkillCsv]=useState(false);
  const [skillCsvMode,setSkillCsvMode]=useState("grade"); // "grade" | "exam"
  const [editingSkillId,setEditingSkillId]=useState(null);

  // Skill Map (prerequisite graph)
  const [prereqMapData,setPrereqMapData]=useState([]);
  const [showPrereqCsv,setShowPrereqCsv]=useState(false);
  const [prereqCsvText,setPrereqCsvText]=useState("");
  const [skillMapFilter,setSkillMapFilter]=useState("all");

  // Daily Tasks admin
  const [dtGrade,setDtGrade]=useState("");
  const [dtSkill,setDtSkill]=useState(null); // {skill_id, skill_name, ...}
  const [dtJsonText,setDtJsonText]=useState("");
  const [dtSaving,setDtSaving]=useState(false);
  const [dtEntries,setDtEntries]=useState([]);
  const [dtLoaded,setDtLoaded]=useState(false);
  const [dtViewEntry,setDtViewEntry]=useState(null);
  const [dtEditTask,setDtEditTask]=useState(null);
  const [dtPreviewTask,setDtPreviewTask]=useState(null);
  const [dtPreviewAnswer,setDtPreviewAnswer]=useState(null);
  const [dtFilterGrade,setDtFilterGrade]=useState('');

  useEffect(()=>{
    if(!firebaseUser) return;
    const load=async()=>{
      try{
        const [sS,qS,uS,thS,tpS,skS,skDbS,pmS,shS]=await Promise.all([getDocs(collection(db,"sections")),getDocs(collection(db,"questions")),getDocs(collection(db,"users")),getDocs(collection(db,"theories")),getDocs(collection(db,"topics")),getDocs(collection(db,"skills")),getDocs(collection(db,"skillsDb")),getDocs(collection(db,"prereqMap")),getDocs(collection(db,"skillHierarchies"))]);
        setSections(sS.docs.map(d=>({id:d.id,...d.data()})));
        setQuestions(qS.docs.map(d=>({id:d.id,...d.data()})));
        setStudents(uS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.lastName||"").localeCompare(b.lastName||"")));
        setTheories(thS.docs.map(d=>({id:d.id,...d.data()})));
        setTopics(tpS.docs.map(d=>({id:d.id,...d.data()})));
        setAllDbSkills(skS.docs.map(d=>({id:d.id,...d.data()})));
        setSkillsDb(skDbS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name)));
        setPrereqMapData(pmS.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name)));
        setSkillHierarchies(shS.docs.map(d=>({id:d.id,...d.data()})));
        const cgS=await getDocs(collection(db,'crossGradeLinks'));
        setCrossGradeLinks(cgS.docs.map(d=>({id:d.id,...d.data()})));
        const mmS=await getDoc(doc(db,'globalSkillMap','master'));
        if(mmS.exists())setMasterMap(mmS.data());
        const tbS=await getDocs(collection(db,'taskBank'));
        setTaskBankEntries(tbS.docs.map(d=>({id:d.id,...d.data()})));
        const stS=await getDocs(collection(db,'skillTheory'));
        setSkillTheoryEntries(stS.docs.map(d=>({id:d.id,...d.data()})));
      }catch(e){console.error(e);}
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[firebaseUser?.uid]);

  // ─ Sections ─
  const openAddSection=()=>{setSecForm(emptySecForm);setEditingSection(null);setShowSecForm(true);};
  const openEditSection=s=>{setSecForm({name:s.name,description:s.description||"",goalKeys:s.goalKeys||(s.goalKey?[s.goalKey]:[]),specificTarget:s.specificTarget||"",sectionType:s.sectionType||"regular",isPublic:!!s.isPublic});setEditingSection(s.id);setShowSecForm(true);};
  const closeSecForm=()=>{setShowSecForm(false);setEditingSection(null);setSecForm(emptySecForm);};

  const toggleSecGoal=k=>setSecForm(p=>({...p,goalKeys:p.goalKeys.includes(k)?p.goalKeys.filter(g=>g!==k):[...p.goalKeys,k],specificTarget:""}));
  const secHasExam=secForm.goalKeys.includes("exam");
  const secHasGrade=secForm.goalKeys.some(k=>k==="gaps"||k==="future");
  const secSpecificLabel=secHasExam&&!secHasGrade?"Экзамен *":!secHasExam&&secHasGrade?"Класс *":"Экзамен / Класс *";
  const secSpecificList=secHasExam&&!secHasGrade?EXAMS_LIST:secHasExam&&secHasGrade?[...EXAMS_LIST,...GRADES_LIST]:GRADES_LIST;

  const addSection=async e=>{
    e.preventDefault();
    if(!secForm.name.trim()||!secForm.goalKeys.length||!secForm.specificTarget){alert("Заполните все поля: название, цель и экзамен/класс.");return;}
    try{
      const data={name:secForm.name.trim(),description:secForm.description||"",goalKeys:secForm.goalKeys,goalKey:secForm.goalKeys[0],specificTarget:secForm.specificTarget,sectionType:secForm.sectionType||"regular",isPublic:!!secForm.isPublic,createdAt:new Date().toISOString()};
      const ref=await addDoc(collection(db,"sections"),data);
      setSections(p=>[...p,{id:ref.id,...data}]);
      closeSecForm();
    }catch(e){alert("Ошибка при добавлении раздела: "+e.message+"\n\nПроверьте правила безопасности Firebase (Firestore → Rules).");}
  };
  const saveSection=async e=>{
    e.preventDefault();
    if(!secForm.name.trim()||!secForm.goalKeys.length||!secForm.specificTarget){alert("Заполните все поля: название, цель и экзамен/класс.");return;}
    try{
      const data={name:secForm.name.trim(),description:secForm.description||"",goalKeys:secForm.goalKeys,goalKey:secForm.goalKeys[0],specificTarget:secForm.specificTarget,sectionType:secForm.sectionType||"regular",isPublic:!!secForm.isPublic};
      await updateDoc(doc(db,"sections",editingSection),data);
      setSections(p=>p.map(s=>s.id===editingSection?{...s,...data}:s));
      closeSecForm();
    }catch(e){alert("Ошибка при сохранении: "+e.message);}
  };
  const delSection=async id=>{
    if(!confirm("Удалить раздел?"))return;
    try{await deleteDoc(doc(db,"sections",id)); setSections(p=>p.filter(s=>s.id!==id));}catch{alert("Ошибка.");}
  };
  const delSectionQuestions=async(secId,secName)=>{
    const qs=questions.filter(q=>q.sectionId===secId);
    if(qs.length===0){alert("В этом разделе нет вопросов.");return;}
    if(!confirm(`Удалить все ${qs.length} вопросов раздела "${secName}"? Это действие нельзя отменить.`))return;
    try{
      await Promise.all(qs.map(q=>deleteDoc(doc(db,"questions",q.id))));
      setQuestions(p=>p.filter(q=>q.sectionId!==secId));
    }catch(e){alert("Ошибка при удалении вопросов: "+e.message);}
  };

  // ─ Topics CRUD ─
  const openAddTopic=(secId)=>{
    const sec=sections.find(s=>s.id===secId);
    const secTopics=topics.filter(t=>t.sectionId===secId);
    setTopicForm({sectionId:secId,name:"",description:"",order:secTopics.length});
    setEditingTopic(null);
    setShowTopicForm(secId);
  };
  const openEditTopic=(tp)=>{
    setTopicForm({sectionId:tp.sectionId,name:tp.name,description:tp.description||"",order:tp.order??0});
    setEditingTopic(tp.id);
    setShowTopicForm(tp.sectionId);
  };
  const closeTopicForm=()=>{setShowTopicForm(null);setEditingTopic(null);setTopicForm(emptyTopicForm);};
  const saveTopic=async e=>{
    e.preventDefault();
    if(!topicForm.name.trim())return;
    const sec=sections.find(s=>s.id===topicForm.sectionId);
    const data={sectionId:topicForm.sectionId,sectionName:sec?.name||"",grade:sec?.specificTarget||"",name:topicForm.name.trim(),description:topicForm.description||"",order:topicForm.order??0};
    try{
      if(editingTopic){
        await updateDoc(doc(db,"topics",editingTopic),data);
        setTopics(p=>p.map(t=>t.id===editingTopic?{...t,...data}:t));
      } else {
        data.createdAt=new Date().toISOString();
        const ref=await addDoc(collection(db,"topics"),data);
        setTopics(p=>[...p,{id:ref.id,...data}]);
      }
      closeTopicForm();
    }catch(e){alert("Ошибка: "+e.message);}
  };
  const delTopic=async id=>{
    if(!confirm("Удалить тему?"))return;
    try{await deleteDoc(doc(db,"topics",id));setTopics(p=>p.filter(t=>t.id!==id));}catch{alert("Ошибка.");}
  };

  const bulkImportTopics=async()=>{
    if(!topicBulkText.trim()){alert("Вставьте текст с темами.");return;}
    const norm=s=>s.trim().toLowerCase().replace(/\s+/g," ").replace(/[«»""''„]/g,'"');
    const findSec=name=>{
      const n=norm(name);
      return sections.find(s=>norm(s.name)===n)
        ||sections.find(s=>norm(s.name).includes(n)||n.includes(norm(s.name)))
        ||null;
    };
    const lines=topicBulkText.split(/\r?\n/);
    const toCreate=[];
    const notFound=new Set();
    let currentSec=null;
    for(const line of lines){
      const trimmed=line.trim();
      if(!trimmed)continue;
      const secMatch=trimmed.match(/^\[(.+)\]$/);
      if(secMatch){
        currentSec=findSec(secMatch[1]);
        if(!currentSec)notFound.add(secMatch[1]);
        continue;
      }
      if(!currentSec)continue;
      const parts=trimmed.split(";");
      const name=parts[0].trim();
      const description=(parts[1]||"").trim();
      if(name) toCreate.push({sec:currentSec,name,description});
    }
    if(notFound.size>0&&toCreate.length===0){
      alert("Разделы не найдены:\n"+[...notFound].join("\n")+"\n\nПроверьте что названия в скобках точно совпадают с разделами на сайте.");
      return;
    }
    if(toCreate.length===0){alert("Не найдено тем для импорта. Проверьте формат: [Раздел] и строки с темами.");return;}
    const warnText=notFound.size>0?`\n\nНе найдены разделы (их темы пропущены):\n${[...notFound].join("\n")}`:"";
    if(!confirm(`Добавить ${toCreate.length} тем?${warnText}`))return;
    setTopicBulkImporting(true);
    try{
      const added=[];
      // Group by section to set correct order
      const bySec={};
      for(const item of toCreate){
        if(!bySec[item.sec.id])bySec[item.sec.id]=[];
        bySec[item.sec.id].push(item);
      }
      for(const[secId,items] of Object.entries(bySec)){
        const existingCount=topics.filter(t=>t.sectionId===secId).length;
        for(let i=0;i<items.length;i++){
          const{sec,name,description}=items[i];
          const data={sectionId:sec.id,sectionName:sec.name,grade:sec.specificTarget||"",name,description,order:existingCount+i,createdAt:new Date().toISOString()};
          const ref=await addDoc(collection(db,"topics"),data);
          added.push({id:ref.id,...data});
        }
      }
      setTopics(p=>[...p,...added]);
      setTopicBulkText("");
      setShowTopicBulkImport(false);
      alert(`✅ Добавлено ${added.length} тем`);
    }catch(e){alert("Ошибка при импорте: "+e.message);}
    setTopicBulkImporting(false);
  };
  const reorderTopics=async(secId,fromIdx,toIdx)=>{
    if(fromIdx===toIdx)return;
    const secTopics=[...topics].filter(t=>t.sectionId===secId).sort((a,b)=>(a.order??999)-(b.order??999));
    const reordered=[...secTopics];
    const[moved]=reordered.splice(fromIdx,1);
    reordered.splice(toIdx,0,moved);
    setTopics(prev=>prev.map(t=>{const idx=reordered.findIndex(r=>r.id===t.id);return idx!==-1?{...t,order:idx}:t;}));
    await Promise.all(reordered.map((t,i)=>updateDoc(doc(db,"topics",t.id),{order:i})));
  };
  const topicDragRef=useRef({});
  const [topicDragOver,setTopicDragOver]=useState(null);

  // ─ Section drag-and-drop reordering ─
  const dragRef=useRef({});
  const [dragOver,setDragOver]=useState(null); // {chapter, idx}

  const reorderSections=async(chapter,fromIdx,toIdx)=>{
    if(fromIdx===toIdx)return;
    const chapterSecs=[...sections]
      .filter(s=>(s.specificTarget||"Без категории")===chapter)
      .sort((a,b)=>(a.order??999)-(b.order??999));
    const reordered=[...chapterSecs];
    const [moved]=reordered.splice(fromIdx,1);
    reordered.splice(toIdx,0,moved);
    const updates={};
    reordered.forEach((s,i)=>{updates[s.id]=i;});
    setSections(prev=>prev.map(s=>updates[s.id]!==undefined?{...s,order:updates[s.id]}:s));
    try{
      await Promise.all(reordered.map((s,i)=>updateDoc(doc(db,"sections",s.id),{order:i})));
    }catch(e){alert("Ошибка сохранения порядка: "+e.message);}
  };

  // ─ Questions ─
  const addOpt=()=>setQForm(p=>({...p,options:[...p.options,""],optionImages:[...(p.optionImages||[]),""],optionCharts:[...(p.optionCharts||[]),null]}));
  const remOpt=i=>{
    if(qForm.options.length<=2)return;
    setQForm(p=>{
      const opts=p.options.filter((_,j)=>j!==i);
      const correct=p.correct>=i&&p.correct>0?p.correct-1:p.correct;
      const correctAnswers=p.correctAnswers.filter(x=>x!==i).map(x=>x>i?x-1:x);
      const optionImages=(p.optionImages||[]).filter((_,j)=>j!==i);
      const optionCharts=(p.optionCharts||[]).filter((_,j)=>j!==i);
      return{...p,options:opts,correct,correctAnswers,optionImages,optionCharts};
    });
  };
  const addPair=()=>setQForm(p=>({...p,pairs:[...p.pairs,{left:"",right:"",leftImage:"",rightImage:""}]}));
  const remPair=i=>{if(qForm.pairs.length<=2)return; setQForm(p=>({...p,pairs:p.pairs.filter((_,j)=>j!==i)}))};
  const toggleCorrectAnswer=i=>setQForm(p=>({...p,correctAnswers:p.correctAnswers.includes(i)?p.correctAnswers.filter(x=>x!==i):[...p.correctAnswers,i]}));
  const toggleGoalQ=k=>setQForm(p=>({...p,goals:p.goals.includes(k)?p.goals.filter(g=>g!==k):[...p.goals,k]}));

  const buildQData=()=>{
    const data={sectionId:qForm.sectionId,sectionName:qForm.sectionName,topic:qForm.topic,text:qForm.text,image:qForm.image||"",conditionChart:qForm.conditionChart||null,type:qForm.type,difficulty:qForm.difficulty||"A",goals:qForm.goals,skillNames:(qForm.skillNames||[]).filter(s=>s.trim())};
    if(qForm.type==="mcq"){data.options=qForm.options.map(o=>o.trim());data.optionImages=qForm.optionImages||[];data.optionCharts=qForm.optionCharts||[];data.correct=qForm.correct;}
    else if(qForm.type==="multiple"){data.options=qForm.options.map(o=>o.trim());data.optionImages=qForm.optionImages||[];data.optionCharts=qForm.optionCharts||[];data.correctAnswers=qForm.correctAnswers;}
    else if(qForm.type==="matching"){data.pairs=qForm.pairs;}
    else if(qForm.type==="generated"){
      data.variables=qForm.variables;
      data.derivedVars=qForm.derivedVars;
      data.answerFormula=qForm.answerFormula;
      data.wrongFormulas=qForm.wrongFormulas.filter(f=>f.trim());
      data.answerDisplay=qForm.answerDisplay||{type:"integer",decimals:2};
    }
    else if(qForm.type==="model"){
      data.variables=qForm.variables;
      data.derivedVars=qForm.derivedVars;
      data.answerFormula=qForm.answerFormula;
      data.wrongFormulas=qForm.wrongFormulas.filter(f=>f.trim());
    }
    else if(qForm.type==="compound"){
      data.subQuestions=qForm.subQuestions.map(sq=>({text:sq.text.trim(),image:sq.image||"",options:sq.options.map(o=>o.trim()),optionImages:sq.optionImages||[],correct:sq.correct,difficulty:sq.difficulty||"A",...((sq.skillNames||[]).length?{skillNames:sq.skillNames}:{})}));
    }
    return data;
  };
  const validateQForm=()=>{
    if(!qForm.sectionId||!qForm.topic.trim()||!qForm.text.trim()||!qForm.goals.length){alert("Заполните все обязательные поля.");return false;}
    if(qForm.type==="mcq"&&qForm.options.some(o=>!o.trim())){alert("Заполните все варианты ответа.");return false;}
    if(qForm.type==="multiple"&&(qForm.options.some(o=>!o.trim())||qForm.correctAnswers.length===0)){alert("Заполните варианты и отметьте правильные.");return false;}
    if(qForm.type==="generated"){
      if(!qForm.variables.length){alert("Добавьте хотя бы одну переменную.");return false;}
      if(!qForm.answerFormula.trim()){alert("Введите формулу правильного ответа.");return false;}
      if(!qForm.wrongFormulas.filter(f=>f.trim()).length){alert("Введите хотя бы одну формулу неверного ответа.");return false;}
    }
    if(qForm.type==="model"){
      if(!qForm.variables.length){alert("Добавьте хотя бы одну переменную.");return false;}
      if(!qForm.answerFormula.trim()){alert("Введите правильную модель (выражение).");return false;}
      if(!qForm.wrongFormulas.filter(f=>f.trim()).length){alert("Введите хотя бы одну неверную модель.");return false;}
    }
    if(qForm.type==="matching"&&qForm.pairs.some(p=>!p.left.trim()||!p.right.trim())){alert("Заполните все пары соответствия.");return false;}
    if(qForm.type==="compound"){
      if(!qForm.subQuestions.length){alert("Добавьте хотя бы один под-вопрос.");return false;}
      if(qForm.subQuestions.some(sq=>!sq.text.trim())){alert("Заполните текст всех под-вопросов.");return false;}
      if(qForm.subQuestions.some(sq=>sq.options.some(o=>!o.trim()))){alert("Заполните все варианты ответов под-вопросов.");return false;}
    }
    return true;
  };

  const openAddQuestion=()=>{setQForm(emptyQForm);setEditingQuestion(null);setShowQForm(true);};
  const openEditQuestion=q=>{
    const sec=sections.find(s=>s.id===q.sectionId);
    setQForm({
      sectionId:q.sectionId||"",sectionName:q.sectionName||"",_target:sec?.specificTarget||"",topic:q.topic||"",text:q.text||"",image:q.image||"",conditionChart:q.conditionChart||null,
      type:q.type||"mcq",difficulty:q.difficulty||"A",goals:q.goals||[],
      options:q.options?.length?q.options:["","","",""],
      optionImages:q.optionImages?.length?q.optionImages:["","","",""],
      optionCharts:q.optionCharts?.length?q.optionCharts:[null,null,null,null],
      correct:q.correct||0,
      correctAnswers:q.correctAnswers||[],
      pairs:q.pairs?.length?q.pairs.map(p=>({...p,leftImage:p.leftImage||"",rightImage:p.rightImage||""})): [{left:"",right:"",leftImage:"",rightImage:""},{left:"",right:"",leftImage:"",rightImage:""}],
      variables:q.variables||[],
      derivedVars:q.derivedVars||[],
      answerFormula:q.answerFormula||"",
      wrongFormulas:q.wrongFormulas?.length?q.wrongFormulas:["","",""],
      answerDisplay:q.answerDisplay||{type:"integer",decimals:2},
      subQuestions:q.subQuestions?.length?q.subQuestions.map(sq=>({...sq,image:sq.image||"",optionImages:sq.optionImages||[],skillNames:sq.skillNames||[],difficulty:sq.difficulty||"A"})):[{text:"",image:"",options:["","","",""],optionImages:["","","",""],correct:0,skillNames:[],difficulty:"A"}],
      skillNames:q.skillNames||[]
    });
    setEditingQuestion(q.id);
    setEditingInlineId(q.id);
    setShowQForm(false);
  };
  const closeQForm=()=>{setShowQForm(false);setEditingQuestion(null);setQForm(emptyQForm);setEditingInlineId(null);};
  const handleQImage=async(file,cb)=>{if(!file)return;try{const src=await compressImage(file,900,0.75);cb(src);}catch{alert("Ошибка загрузки изображения.");}};
  const handleQOptionImage=async(i,file)=>{if(!file)return;try{const src=await compressImage(file,600,0.75);setQForm(p=>{const imgs=[...(p.optionImages||["","","","","","","",""])];imgs[i]=src;return{...p,optionImages:imgs};});}catch{alert("Ошибка.");}};

  const addQuestion=async e=>{
    e.preventDefault();
    if(!validateQForm())return;
    try{
      const data={...buildQData(),createdAt:new Date().toISOString()};
      const ref=await addDoc(collection(db,"questions"),data);
      setQuestions(p=>[...p,{id:ref.id,...data}]);
      closeQForm();
    }catch{alert("Ошибка.");}
  };
  const saveQuestion=async e=>{
    e.preventDefault();
    if(!validateQForm())return;
    try{
      const data=buildQData();
      // Clear fields that don't belong to new type
      const clearFields={};
      if(data.type!=="mcq"&&data.type!=="multiple"){clearFields.options=null;clearFields.correct=null;clearFields.correctAnswers=null;}
      if(data.type!=="matching"){clearFields.pairs=null;}
      if(data.type!=="generated"&&data.type!=="model"){clearFields.variables=null;clearFields.derivedVars=null;clearFields.answerFormula=null;clearFields.wrongFormulas=null;}
      await updateDoc(doc(db,"questions",editingQuestion),{...data,...clearFields});
      setQuestions(p=>p.map(q=>q.id===editingQuestion?{...q,...data}:q));
      closeQForm();
    }catch(e){alert("Ошибка при сохранении: "+e.message);}
  };
  const delQuestion=async id=>{
    if(!confirm("Удалить вопрос?"))return;
    try{await deleteDoc(doc(db,"questions",id)); setQuestions(p=>p.filter(q=>q.id!==id));}catch{alert("Ошибка.");}
  };

  // ─ Theory CRUD ─
  const openAddTheory=(secId,topicId)=>{
    const sec=sections.find(s=>s.id===secId);
    const tp=topics.find(t=>t.id===topicId);
    setThForm({...emptyThForm,sectionId:secId||"",sectionName:sec?.name||"",topicId:topicId||"",topicName:tp?.name||""});
    setEditingTheory(null);setShowThForm(true);
  };
  const openEditTheory=t=>{
    const blocks = t.blocks?.length ? t.blocks.map(b=>({...b,skills:b.skills||[]})) : (t.content ? [{type:"text",value:t.content,skills:[]}] : [{type:"text",value:"",skills:[]}]);
    setThForm({sectionId:t.sectionId||"",sectionName:t.sectionName||"",topicId:t.topicId||"",topicName:t.topicName||"",topic:t.topic||"",title:t.title||"",blocks,cards:t.cards?.length?t.cards:[{front:"",back:""}]});
    setEditingTheory(t.id);setShowThForm(true);
  };
  const closeThForm=()=>{setShowThForm(false);setEditingTheory(null);setThForm(emptyThForm);setNewSkillInput({});setShowThAiImport(false);setThAiText("");};
  const addThBlock=(type)=>setThForm(p=>({...p,blocks:[...p.blocks,type==="image"?{type:"image",src:"",caption:"",skills:[]}:type==="formula"?{type:"formula",value:"",skills:[]}:{type:"text",value:"",skills:[]}]}));

  // Shared parser: converts #text/#formula/#skills/#card marked text → {newBlocks,newCards,newTitle}
  const parseTheoryContent=(text)=>{
    const lines=text.split(/\r?\n/);
    const newBlocks=[];const newCards=[];
    let mode=null;let blockType=null;let blockBuf=[];let skillsBuf=[];let newTitle="";
    const flushBlock=()=>{
      if(!blockType)return;
      const val=blockBuf.join("\n").trim();
      const skills=skillsBuf.filter(Boolean);
      if(blockType==="text"&&val)newBlocks.push({type:"text",value:val,skills});
      else if(blockType==="formula")val.split(/\n/).forEach((f,idx)=>{if(f.trim())newBlocks.push({type:"formula",value:f.trim(),skills:idx===0?skills:[]});});
      else if(blockType==="card")val.split(/\n/).forEach(ln=>{const parts=ln.split("|");if(parts.length>=2)newCards.push({front:parts[0].trim(),back:parts.slice(1).join("|").trim()});});
      blockType=null;blockBuf=[];skillsBuf=[];
    };
    for(const line of lines){
      const trimmed=line.trim();
      if(/^#title$/i.test(trimmed)){flushBlock();mode="title";}
      else if(/^#text$/i.test(trimmed)){flushBlock();blockType="text";mode="text";blockBuf=[];skillsBuf=[];}
      else if(/^#formula$/i.test(trimmed)){flushBlock();blockType="formula";mode="formula";blockBuf=[];skillsBuf=[];}
      else if(/^#card$/i.test(trimmed)){flushBlock();blockType="card";mode="card";blockBuf=[];skillsBuf=[];}
      else if(/^#skills$/i.test(trimmed)){mode="skills";}
      else if(mode==="title"){newTitle+=trimmed;}
      else if(mode==="skills"){trimmed.split(",").map(s=>s.trim()).filter(Boolean).forEach(s=>skillsBuf.push(s));}
      else if(mode==="text"||mode==="formula"||mode==="card"){blockBuf.push(line);}
    }
    flushBlock();
    return{newBlocks,newCards,newTitle};
  };

  const parseBulkThPreview=()=>{
    if(!bulkThText.trim()){alert("Вставьте текст от ИИ.");return;}
    if(!bulkThSectionId){alert("Выберите раздел.");return;}
    const secTopics=topics.filter(t=>t.sectionId===bulkThSectionId);
    const norm=s=>s.trim().toLowerCase().replace(/\s+/g," ").replace(/[.,:;]+$/,"");
    const stripNum=s=>s.replace(/^[\d§]+[.):\s-]+/,"").trim();
    const findTopic=name=>{
      const n=norm(name);
      const nStripped=norm(stripNum(name));
      // Only exact match (with/without AI numbering stripped) — no aggressive includes to avoid wrong assignments
      return secTopics.find(t=>norm(t.name)===n)
        ||secTopics.find(t=>norm(t.name)===nStripped)
        ||null;
    };
    // Parse line-by-line to reliably detect ##topic markers
    const allLines=bulkThText.split(/\r?\n/);
    const rawParts=[];
    let cur=null;
    for(const line of allLines){
      const m=line.match(/^##topic\s+(.+)/i);
      if(m){
        if(cur)rawParts.push(cur);
        cur={topicName:m[1].trim(),contentLines:[]};
      } else if(cur){
        cur.contentLines.push(line);
      }
    }
    if(cur)rawParts.push(cur);
    if(rawParts.length===0){alert("Не найдено блоков ##topic. Убедитесь что каждая тема начинается с:\n##topic Название темы");return;}
    const parsed=rawParts.map(({topicName,contentLines})=>{
      const content=contentLines.join("\n");
      const tp=findTopic(topicName);
      const{newBlocks,newCards,newTitle}=parseTheoryContent(content);
      return{topicName,tp,newBlocks,newCards,newTitle};
    });
    setBulkThParsed(parsed);
  };

  const bulkImportSectionTheory=async()=>{
    if(!bulkThParsed||!bulkThSectionId)return;
    const sec=sections.find(s=>s.id===bulkThSectionId);
    const valid=bulkThParsed.filter(b=>b.tp&&(b.newBlocks.length>0||b.newCards.length>0));
    if(valid.length===0){alert("Нет данных для импорта. Убедитесь что темы найдены и блоки не пустые.");return;}
    setBulkThImporting(true);
    try{
      const added=[];
      for(const{tp,newBlocks,newCards,newTitle}of valid){
        const data={sectionId:sec.id,sectionName:sec.name,topicId:tp.id,topicName:tp.name,topic:tp.name,title:newTitle||tp.name,blocks:newBlocks,cards:newCards.length>0?newCards:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
        const ref=await addDoc(collection(db,"theories"),data);
        added.push({id:ref.id,...data});
      }
      // Single state update after all docs saved — avoids React 18 async batching issues
      setTheories(p=>[...p,...added]);
      setFilterThSec("all"); // switch to "all" so user sees the new theories immediately
      alert(`✅ Создано теорий: ${added.length}`);
      setBulkThText("");setBulkThParsed(null);setShowBulkThImport(false);
    }catch(e){alert("Ошибка: "+e.message);}
    setBulkThImporting(false);
  };

  const applyThAiImport=()=>{
    if(!thAiText.trim()){alert("Вставьте текст от ИИ.");return;}
    const{newBlocks,newCards,newTitle}=parseTheoryContent(thAiText);
    if(newBlocks.length===0&&newCards.length===0){alert("Не удалось распознать блоки. Убедитесь что текст содержит маркеры #text, #formula, #card.");return;}
    setThForm(p=>({...p,title:newTitle||p.title,blocks:newBlocks.length>0?newBlocks:p.blocks,cards:newCards.length>0?newCards:p.cards}));
    setThImportKey(k=>k+1);
    setShowThAiImport(false);
    setThAiText("");
  };
  const delThBlock=(i)=>setThForm(p=>({...p,blocks:p.blocks.filter((_,j)=>j!==i)}));
  const moveThBlock=(i,dir)=>setThForm(p=>{const b=[...p.blocks]; const t=b[i]; b[i]=b[i+dir]; b[i+dir]=t; return{...p,blocks:b};});
  const updateThBlock=(i,patch)=>setThForm(p=>({...p,blocks:p.blocks.map((b,j)=>j===i?{...b,...patch}:b)}));
  const handleThImage=async(i,file)=>{
    if(!file)return;
    try{
      const src=await compressImage(file,900,0.72);
      updateThBlock(i,{src,caption:thForm.blocks[i]?.caption||""});
    }catch{alert("Ошибка загрузки изображения.");}
  };

  const saveTheory=async e=>{
    e.preventDefault();
    if(!thForm.sectionId||!thForm.title.trim()){alert("Заполните раздел и заголовок.");return;}
    const blocks=thForm.blocks.filter(b=>b.type==="image"?b.src:b.value?.trim())
      .map(b=>b.type==="text"?{...b}:b);
    const totalSize=JSON.stringify(blocks).length;
    if(totalSize>900000){alert("Содержимое слишком большое (>900 KB). Удалите или уменьшите изображения.");return;}
    const tp=topics.find(t=>t.id===thForm.topicId);
    const sec=sections.find(s=>s.id===thForm.sectionId);
    const data={
      sectionId:thForm.sectionId,sectionName:thForm.sectionName,
      topicId:thForm.topicId||"",topicName:tp?.name||thForm.topicName||"",
      topic:tp?.name||thForm.topic||thForm.topicName||"",
      title:thForm.title.trim(),blocks,
      cards:thForm.cards.filter(c=>c.front.trim()||c.back.trim()),
      updatedAt:new Date().toISOString()
    };
    try{
      if(editingTheory){
        await updateDoc(doc(db,"theories",editingTheory),data);
        setTheories(p=>p.map(t=>t.id===editingTheory?{...t,...data}:t));
      } else {
        data.createdAt=new Date().toISOString();
        const ref=await addDoc(collection(db,"theories"),data);
        setTheories(p=>[...p,{id:ref.id,...data}]);
      }
      // Save skills to skills collection (per grade+section+topic)
      const allSkills=[...new Set(blocks.flatMap(b=>b.skills||[]).filter(Boolean))];
      if(allSkills.length>0&&thForm.topicId){
        const skillDocId=`${sec?.specificTarget||"unknown"}_${thForm.sectionId}_${thForm.topicId}`.replace(/\s+/g,"_");
        await setDoc(doc(db,"skills",skillDocId),{
          grade:sec?.specificTarget||"",sectionId:thForm.sectionId,sectionName:thForm.sectionName,
          topicId:thForm.topicId,topicName:tp?.name||"",skills:allSkills,updatedAt:new Date().toISOString()
        },{merge:true});
      }
      closeThForm();
    }catch(e){alert("Ошибка: "+e.message);}
  };
  const delTheory=async id=>{if(!confirm("Удалить теорию?"))return;try{await deleteDoc(doc(db,"theories",id));setTheories(p=>p.filter(t=>t.id!==id));}catch{alert("Ошибка.");}};

  // ─ Skills DB ─
  const saveSkill=async e=>{
    e.preventDefault();
    if(!skillForm.sectionId||!skillForm.name.trim()){alert("Заполните раздел и навык.");return;}
    const sec=sections.find(s=>s.id===skillForm.sectionId);
    const data={sectionId:skillForm.sectionId,sectionName:sec?.name||"",grade:sec?.specificTarget||"",name:skillForm.name.trim(),errorScenario:skillForm.errorScenario.trim(),quarter:skillForm.quarter||"",goalCode:skillForm.goalCode||"",W_exam:Number(skillForm.W_exam)||0,W_dep:Number(skillForm.W_dep)||0,A:Number(skillForm.A)||3,W_mem:Number(skillForm.W_mem)||3,T_depth:Number(skillForm.T_depth)||3,I_score:Number(skillForm.I_score)||3,T_base:Number(skillForm.T_base)||60,exercises:(skillForm.exercises||[]).filter(e=>e.trim()),homework:(skillForm.homework||[]).filter(h=>h.trim()),updatedAt:new Date().toISOString()};
    try{
      if(editingSkillId){
        await updateDoc(doc(db,"skillsDb",editingSkillId),data);
        setSkillsDb(p=>p.map(s=>s.id===editingSkillId?{...s,...data}:s).sort((a,b)=>a.name.localeCompare(b.name)));
      } else {
        data.createdAt=new Date().toISOString();
        const ref=await addDoc(collection(db,"skillsDb"),data);
        setSkillsDb(p=>[...p,{id:ref.id,...data}].sort((a,b)=>a.name.localeCompare(b.name)));
      }
      setSkillForm({sectionId:"",sectionName:"",grade:"",name:"",errorScenario:"",quarter:"",goalCode:"",W_exam:0,W_dep:0,A:3,W_mem:3,T_depth:3,I_score:3,T_base:60,exercises:[""],homework:[""]});
      setShowSkillForm(false);
      setEditingSkillId(null);
    }catch(e){alert("Ошибка: "+e.message);}
  };
  const delSkill=async id=>{if(!confirm("Удалить навык?"))return;try{await deleteDoc(doc(db,"skillsDb",id));setSkillsDb(p=>p.filter(s=>s.id!==id));}catch{alert("Ошибка.");}};
  const importSkillsCsv=async()=>{
    const lines=skillCsvText.split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith("#"));
    const toAdd=[];
    const errors=[];
    const createdSecs={};
    let localSections=[...sections];

    for(const line of lines){
      const parts=line.split(";").map(s=>s.trim());

      let grade,quarter,goalCode,sectionName,skillName,errorSign="",examPart="";

      if(skillCsvMode==="exam"){
        // Format: Экзамен;Часть;Раздел;Название навыка;Признак несформированности
        if(parts.length<4){errors.push(`Недостаточно полей (нужно ≥4): ${line.slice(0,60)}`);continue;}
        [grade,examPart,sectionName,skillName,errorSign=""]=parts;
        // Normalize exam name
        if(grade&&!EXAMS_LIST.includes(grade)){
          const normalized=EXAMS_LIST.find(g=>g.toLowerCase()===grade.toLowerCase());
          if(normalized)grade=normalized;
        }
        quarter=examPart||"";
        goalCode="";
      } else {
        // Format: Класс;Четверть;Код цели обучения;Раздел;Название навыка;Признак несформированности
        if(parts.length<5){errors.push(`Недостаточно полей (нужно ≥5): ${line.slice(0,60)}`);continue;}
        [grade,quarter,goalCode,sectionName,skillName,errorSign=""]=parts;
        // Normalize grade: "5" → "5 класс"
        if(grade&&!GRADES_LIST.includes(grade)&&!EXAMS_LIST.includes(grade)){
          const normalized=GRADES_LIST.find(g=>g===grade+' класс')||GRADES_LIST.find(g=>g.startsWith(grade+' '))||EXAMS_LIST.find(g=>g.toLowerCase()===grade.toLowerCase());
          if(normalized)grade=normalized;
        }
      }

      if(!grade||!sectionName||!skillName){errors.push(`Пустые обязательные поля: ${line.slice(0,60)}`);continue;}

      // Parse optional parameter columns at the end
      // Grade format: [...base fields, W_exam, W_dep, T_base, A, W, T, I]  (7 extra cols)
      // Exam format:  [...base fields, W_exam, W_dep, T_base, A, W, T, I]  (7 extra cols)
      const pNum=(v,def)=>{ const n=parseFloat(v); return isNaN(n)?def:n; };
      let paramCols=[];
      if(skillCsvMode==="exam"&&parts.length>5) paramCols=parts.slice(5);
      else if(skillCsvMode==="grade"&&parts.length>6) paramCols=parts.slice(6);
      const [pW_exam,pW_dep,pT_base,pA,pW_mem,pT_depth,pI_score]=paramCols;

      // Find or auto-create section
      let sec=localSections.find(s=>s.specificTarget===grade&&s.name.toLowerCase().trim()===sectionName.toLowerCase().trim());
      if(!sec){
        const key=`${grade}||${sectionName}`;
        if(createdSecs[key]){
          sec=localSections.find(s=>s.id===createdSecs[key]);
        } else {
          const isExam=EXAMS_LIST.includes(grade);
          const goalKeys=isExam?["exam"]:["gaps","future"];
          try{
            const newSecData={name:sectionName,description:"",goalKeys,goalKey:goalKeys[0],specificTarget:grade,sectionType:"regular",isPublic:false,createdAt:new Date().toISOString()};
            const ref=await addDoc(collection(db,"sections"),newSecData);
            sec={id:ref.id,...newSecData};
            createdSecs[key]=ref.id;
            localSections=[...localSections,sec];
            setSections(p=>[...p,sec]);
          }catch(e){errors.push(`Не удалось создать раздел "${sectionName}": ${e.message}`);continue;}
        }
      }

      toAdd.push({
        sectionId:sec.id,sectionName:sec.name,grade:sec.specificTarget,
        quarter:quarter||"",goalCode:goalCode||"",
        ...(skillCsvMode==="exam"?{examPart:examPart||""}:{}),
        name:skillName,errorScenario:errorSign||"",
        W_exam:pNum(pW_exam,0),W_dep:pNum(pW_dep,0),T_base:pNum(pT_base,60),
        A:pNum(pA,3),W_mem:pNum(pW_mem,3),T_depth:pNum(pT_depth,3),I_score:pNum(pI_score,3),
        createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
      });
    }
    if(errors.length>0&&toAdd.length===0){alert("Ошибки:\n"+errors.slice(0,10).join("\n"));return;}
    const newSecs=Object.keys(createdSecs).length;
    if(!confirm(`Добавить ${toAdd.length} навыков?${newSecs>0?`\n\nАвтоматически создано разделов: ${newSecs}`:""}`+`${errors.length>0?"\n⚠️ Пропущено строк: "+errors.length:""}`))return;
    try{
      const added=[];
      for(const d of toAdd){const ref=await addDoc(collection(db,"skillsDb"),d);added.push({id:ref.id,...d});}
      setSkillsDb(p=>[...p,...added].sort((a,b)=>a.name.localeCompare(b.name)));
      setShowSkillCsv(false);setSkillCsvText("");
      alert(`✅ Добавлено ${added.length} навыков!${newSecs>0?`\n📁 Новых разделов: ${newSecs}`:""}${errors.length>0?"\n⚠️ Пропущено: "+errors.length:""}`);
    }catch(e){alert("Ошибка: "+e.message);}
  };

  // ─ Prereq Map CSV Import ─
  const importPrereqCsv=async()=>{
    const lines=prereqCsvText.split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith("#"));
    const toAdd=[],errors=[],updated=[];
    for(const line of lines){
      const[rawName,...rest]=line.split(";");
      const name=rawName.trim();
      if(!name){errors.push(`Пустое имя: ${line.slice(0,60)}`);continue;}
      const prereqRaw=rest.join(";").trim();
      const prerequisites=prereqRaw?prereqRaw.split(",").map(s=>s.trim()).filter(Boolean):[];
      toAdd.push({name,prerequisites});
    }
    if(!toAdd.length){alert("Нет данных для импорта.");return;}
    if(errors.length>0&&toAdd.length===0){alert("Ошибки:\n"+errors.slice(0,10).join("\n"));return;}
    if(!confirm(`Добавить/обновить ${toAdd.length} навыков в карте пререквизитов?${errors.length>0?"\n⚠️ Пропущено: "+errors.length:""}`))return;
    try{
      const added=[];
      for(const d of toAdd){
        // Check if already exists by name
        const existing=prereqMapData.find(n=>n.name.toLowerCase()===d.name.toLowerCase());
        if(existing){
          await updateDoc(doc(db,"prereqMap",existing.id),{prerequisites:d.prerequisites,updatedAt:new Date().toISOString()});
          updated.push({...existing,...d,updatedAt:new Date().toISOString()});
        } else {
          const ref=await addDoc(collection(db,"prereqMap"),{...d,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
          added.push({id:ref.id,...d,createdAt:new Date().toISOString()});
        }
      }
      setPrereqMapData(prev=>{
        const next=[...prev.filter(n=>!updated.find(u=>u.id===n.id)),...updated,...added];
        return next.sort((a,b)=>a.name.localeCompare(b.name));
      });
      setShowPrereqCsv(false);setPrereqCsvText("");
      alert(`✅ Добавлено: ${added.length}, обновлено: ${updated.length}${errors.length>0?"\n⚠️ Пропущено: "+errors.length:""}`);
    }catch(e){alert("Ошибка: "+e.message);}
  };

  // ─ CSV Bulk Import ─
  // Format (tab or semicolon separated):
  // mcq:   mcq ; topic ; question text ; opt1 ; opt2 ; opt3 ; opt4 ; correct_index(0-based) ; goals(exam,gaps,future)
  // multiple: multiple ; topic ; question text ; opt1 ; opt2 ; opt3 ; opt4 ; correct_indices(0,1) ; goals
  // matching: matching ; topic ; question text ; left1=right1 ; left2=right2 ; ... ; goals
  // CSV parser with quote support: fields can be wrapped in "..." to include ; inside
  const splitCsvRow=(row,sep)=>{
    const fields=[]; let f='', inQ=false;
    for(let i=0;i<row.length;i++){
      const ch=row[i];
      if(ch==='"'){
        if(inQ){
          if(row[i+1]==='"'){f+='"';i++;} // escaped "" → literal "
          else inQ=false;                  // closing quote
        } else if(f===''){
          inQ=true;  // opening quote only at field start
        } else {
          f+=ch;     // " in the middle of a field → keep as literal
        }
      }
      else if(ch===sep&&!inQ){fields.push(f.trim());f='';}
      else f+=ch;
    }
    fields.push(f.trim());
    return fields;
  };

  const isGoalsStr=s=>s.split(",").every(g=>["exam","gaps","future"].includes(g.trim()))&&s.split(",").some(g=>["exam","gaps","future"].includes(g.trim()));
  // § is the primary skills separator (avoids conflict with | used in math: |x|=b)
  // | is kept as fallback for backward compatibility
  const splitSkillsField=s=>(s.includes("§")?s.split("§"):s.split("|")).map(x=>x.trim()).filter(Boolean);
  const isSkillsField=s=>s.includes("§")||(s.includes("|")&&!isGoalsStr(s));

  const parseCsvRow=(row,sep)=>{
    let c=splitCsvRow(row,sep);
    if(c.length<3)return null;
    const type=c[0].toLowerCase();
    const topic=c[1];
    if(!type||!topic)return null;

    // Extract optional trailing difficulty column (A, B, or C)
    const _diffRe=/^[ABC]$/;
    const _lastIsDiff=_diffRe.test((c[c.length-1]||"").trim());
    const _rowDifficulty=_lastIsDiff?c[c.length-1].trim():"A";
    if(_lastIsDiff)c=c.slice(0,-1);

    // New pipe format: формат;тема;условие(может содержать ;);цель[;навыки]
    // Detected by: last or second-to-last column matches goals pattern AND condition contains ¦ or |
    // Primary delimiter: ¦ (broken bar, U+00A6). Legacy fallback: | (may conflict with |x| in math)
    // Skills are §-separated; sub-questions use ~ as separator (: as fallback)
    const _pipeWithSkills=c.length>=5&&isGoalsStr(c[c.length-2]);
    const _pipeNoSkills=!_pipeWithSkills&&c.length>=4&&isGoalsStr(c[c.length-1]);
    if(_pipeWithSkills||_pipeNoSkills){
      const goals=(_pipeWithSkills?c[c.length-2]:c[c.length-1]).split(",").map(g=>g.trim()).filter(g=>["exam","gaps","future"].includes(g));
      const skillNames=_pipeWithSkills?splitSkillsField(c[c.length-1]):[];
      // Rejoin middle columns — condition may have contained ; which split it
      const condition=c.slice(2,_pipeWithSkills?c.length-2:c.length-1).join(";");
      // Detect delimiter: prefer ¦ (safe), fallback to | (legacy)
      const _pipeDel=condition.includes("¦")?"¦":"|";
      if(goals.length>0&&condition.includes(_pipeDel)){
        if(type==="mcq"){
          const parts=condition.split(_pipeDel);
          if(parts.length>=4){
            const text=parts[0].trim();
            const correctIdx=parseInt(parts[parts.length-1]);
            const opts=parts.slice(1,parts.length-1).map(o=>o.trim());
            if(text&&opts.length>=2&&!isNaN(correctIdx))
              return{type:"mcq",topic,text,goals,difficulty:_rowDifficulty,options:opts,correct:correctIdx,...(skillNames.length?{skillNames}:{})};
          }
        }
        if(type==="matching"){
          const parts=condition.split(_pipeDel);
          const text=parts[0].trim();
          const pairs=parts.slice(1).map(p=>{const[l,...r]=p.split("=");return{left:l.trim(),right:r.join("=").trim()};}).filter(p=>p.left&&p.right);
          if(text&&pairs.length>=2)
            return{type:"matching",topic,text,goals,difficulty:_rowDifficulty,pairs,...(skillNames.length?{skillNames}:{})};
        }
        if(type==="generated"){
          const parts=condition.split(_pipeDel);
          if(parts.length>=5){
            const text=parts[0].trim();
            const variables=parts[1].split(",").map(v=>{const[name,...rest]=v.trim().split(":");return{name:name.trim(),min:Number(rest[0]||1),max:Number(rest[1]||10)};}).filter(v=>v.name);
            const derivedRaw=parts[2];
            const derivedVars=derivedRaw==="-"||!derivedRaw.trim()?[]:derivedRaw.split(",").map(v=>{const idx=v.indexOf(":");return{name:v.slice(0,idx).trim(),formula:v.slice(idx+1).trim()};}).filter(v=>v.name&&v.formula);
            const answerFormula=parts[3].trim();
            const wrongFormulas=parts.slice(4).map(f=>f.trim()).filter(Boolean);
            if(text&&variables.length&&answerFormula)
              return{type:"generated",topic,text,goals,difficulty:_rowDifficulty,variables,derivedVars,answerFormula,wrongFormulas,...(skillNames.length?{skillNames}:{})};
          }
        }
        if(type==="compound"){
          // Sub-question separator: ~ (preferred, allows : in text/options) or : (legacy fallback)
          const parts=condition.split(_pipeDel);
          if(parts.length>=2){
            const text=parts[0].trim();
            const subQuestions=parts.slice(1).map(p=>{
              // Use ~ if present (new format), else fall back to : (old format)
              const sqSep=p.includes("~")?"~":":";
              const segs=p.split(sqSep);
              if(segs.length<3)return null;
              // Check if last seg is difficulty (A/B/C)
              const rawLast=segs[segs.length-1].trim();
              const sqHasDiff=_diffRe.test(rawLast);
              const sqDifficulty=sqHasDiff?rawLast:"A";
              const workSegs=sqHasDiff?segs.slice(0,-1):segs;
              const lastSeg=workSegs[workSegs.length-1].trim();
              let correctIdx, sqSkillNames, opts;
              if(isNaN(parseInt(lastSeg))){
                correctIdx=parseInt(workSegs[workSegs.length-2]);
                sqSkillNames=lastSeg.split("§").map(s=>s.trim()).filter(Boolean);
                opts=workSegs.slice(1,workSegs.length-2).map(o=>o.trim()).filter(Boolean);
              } else {
                correctIdx=parseInt(lastSeg);
                sqSkillNames=[];
                opts=workSegs.slice(1,workSegs.length-1).map(o=>o.trim()).filter(Boolean);
              }
              const sqText=workSegs[0].trim();
              if(!sqText||opts.length<2||isNaN(correctIdx))return null;
              return{text:sqText,options:opts,correct:correctIdx,difficulty:sqDifficulty,...(sqSkillNames.length?{skillNames:sqSkillNames}:{})};
            }).filter(Boolean);
            if(text&&subQuestions.length>=1)
              return{type:"compound",topic,text,goals,subQuestions,...(skillNames.length?{skillNames}:{})};
          }
        }
      }
    }

    if(type==="mcq"){
      const lastIsSkills=isSkillsField(c[c.length-1]);
      const skillNames=lastIsSkills?splitSkillsField(c[c.length-1]):[];
      const offset=lastIsSkills?1:0;
      const goalsRaw=c[c.length-1-offset];
      const goals=goalsRaw.split(",").map(g=>g.trim()).filter(g=>["exam","gaps","future"].includes(g));
      const correctIdx=parseInt(c[c.length-2-offset]);
      const opts=c.slice(3,c.length-2-offset);
      const text=c[2];
      if(!text||opts.length<2||isNaN(correctIdx)||!goals.length)return null;
      return{type:"mcq",topic,text,goals,difficulty:_rowDifficulty,options:opts,correct:correctIdx,...(skillNames.length?{skillNames}:{})};
    }
    if(type==="multiple"){
      const lastIsSkills=isSkillsField(c[c.length-1]);
      const skillNames=lastIsSkills?splitSkillsField(c[c.length-1]):[];
      const offset=lastIsSkills?1:0;
      const goalsRaw=c[c.length-1-offset];
      const goals=goalsRaw.split(",").map(g=>g.trim()).filter(g=>["exam","gaps","future"].includes(g));
      const correctAnswers=(c[c.length-2-offset]||"").split(",").map(x=>parseInt(x.trim())).filter(x=>!isNaN(x));
      const opts=c.slice(3,c.length-2-offset);
      const text=c[2];
      if(!text||opts.length<2||!correctAnswers.length||!goals.length)return null;
      return{type:"multiple",topic,text,goals,difficulty:_rowDifficulty,options:opts,correctAnswers,...(skillNames.length?{skillNames}:{})};
    }
    if(type==="matching"){
      const lastIsSkills=isSkillsField(c[c.length-1]);
      const skillNames=lastIsSkills?splitSkillsField(c[c.length-1]):[];
      const offset=lastIsSkills?1:0;
      const goalsRaw=c[c.length-1-offset];
      const goals=goalsRaw.split(",").map(g=>g.trim()).filter(g=>["exam","gaps","future"].includes(g));
      const pairs=c.slice(3,c.length-1-offset).map(p=>{const[l,...r]=p.split("=");return{left:l.trim(),right:r.join("=").trim()};}).filter(p=>p.left&&p.right);
      const text=c[2];
      if(!text||pairs.length<2||!goals.length)return null;
      return{type:"matching",topic,text,goals,difficulty:_rowDifficulty,pairs,...(skillNames.length?{skillNames}:{})};
    }
    // generated ; topic ; TEMPLATE_TEXT... ; vars ; derived ; answer ; wrongs ; goals
    // Parse from both ends so template text can safely contain semicolons
    if(type==="generated"){
      if(c.length<8)return null;
      const lastIsSkillsG=isSkillsField(c[c.length-1]);
      const skillNamesG=lastIsSkillsG?splitSkillsField(c[c.length-1]):[];
      const offsetG=lastIsSkillsG?1:0;
      const goalsRaw2=c[c.length-1-offsetG];
      const goals2=goalsRaw2.split(",").map(g=>g.trim()).filter(g=>["exam","gaps","future"].includes(g));
      const wrongsRaw=c[c.length-2-offsetG];
      const answerFormula=c[c.length-3-offsetG];
      const derivedRaw=c[c.length-4-offsetG];
      const varsRaw=c[c.length-5-offsetG];
      // Everything between index 2 and c.length-5-offsetG is the template text (rejoin with sep)
      const text=c.slice(2,c.length-5-offsetG).join(sep);
      if(!text||!answerFormula||!goals2.length)return null;
      const variables=varsRaw.split(",").map(v=>{const[name,...rest]=v.trim().split(":");return{name:name.trim(),min:Number(rest[0]||1),max:Number(rest[1]||10)};}).filter(v=>v.name);
      if(!variables.length)return null;
      const derivedVars=derivedRaw==="-"||!derivedRaw.trim()?[]:derivedRaw.split(",").map(v=>{const idx=v.indexOf(":");return{name:v.slice(0,idx).trim(),formula:v.slice(idx+1).trim()};}).filter(v=>v.name&&v.formula);
      const wrongFormulas=wrongsRaw.split("|").map(f=>f.trim()).filter(Boolean);
      return{type:"generated",topic,text,goals:goals2,difficulty:_rowDifficulty,variables,derivedVars,answerFormula,wrongFormulas,...(skillNamesG.length?{skillNames:skillNamesG}:{})};
    }
    return null;
  };

  const handleCsvImport=async()=>{
    if(!csvSectionId){alert("Выберите раздел для импорта.");return;}
    const sec=sections.find(s=>s.id===csvSectionId);
    if(!sec)return;
    const lines=csvText.split("\n").map(l=>l.trim()).filter(l=>l&&!l.startsWith("#"));
    if(!lines.length){alert("Нет данных для импорта.");return;}
    // Auto-detect separator: semicolon or tab
    const sep=lines[0].includes("\t")?"\t":";";
    const parsed=lines.map(l=>parseCsvRow(l,sep)).filter(Boolean);
    if(!parsed.length){alert("Не удалось распознать ни одной строки. Проверьте формат.");return;}
    if(!confirm(`Импортировать ${parsed.length} вопросов в раздел «${sec.name}»?`))return;
    setCsvImporting(true);
    try{
      const added=[];
      for(const q of parsed){
        const data={...q,sectionId:sec.id,sectionName:sec.name,createdAt:new Date().toISOString()};
        const ref=await addDoc(collection(db,"questions"),data);
        added.push({id:ref.id,...data});
      }
      setQuestions(p=>[...p,...added]);
      setShowCsvImport(false);
      setCsvText("");
      setCsvSectionId("");
      alert(`Успешно импортировано ${added.length} вопросов!`);
    }catch(e){alert("Ошибка при импорте: "+e.message);}
    setCsvImporting(false);
  };

  const generateWithGemini=async(prompt,sectionName,sectionId)=>{
    if(!geminiKey.trim()){setAiGenError('Введите Gemini API ключ выше');return;}
    setAiGenerating(true);setAiGenError('');setAiGenModel('Запрос к gemini-flash-latest...');
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.7,maxOutputTokens:8192}}),
      });
      if(!res.ok){
        const errData=await res.json().catch(()=>({}));
        const errMsg=errData?.error?.message||`HTTP ${res.status}`;
        const statusLabel={400:'Неверный запрос',401:'Неверный API ключ',429:'Превышен лимит запросов',503:'Сервис недоступен'}[res.status]||`Ошибка ${res.status}`;
        throw new Error(`gemini-flash-latest: ${statusLabel} — ${errMsg}`);
      }
      setAiGenModel('Используется: gemini-flash-latest');
      const data=await res.json();
      let text=(data.candidates?.[0]?.content?.parts?.[0]?.text||'').trim();
      if(!text)throw new Error('Gemini вернул пустой ответ');
      // Strip markdown code blocks
      text=text.replace(/^```[a-z]*\n?/im,'').replace(/```\s*$/m,'').trim();
      // Extract JSON array even if surrounded by extra text
      const arrMatch=text.match(/\[[\s\S]*\]/);
      if(arrMatch)text=arrMatch[0];

      const fixJson=s=>{
        return s
          .replace(/[\u201C\u201D\u00AB\u00BB]/g,'"')   // curly/angle quotes → "
          .replace(/[\u2018\u2019]/g,"'")                // curly apostrophes
          .replace(/,\s*([}\]])/g,'$1')                  // trailing commas: [1,] → [1]
          .replace(/}\s*{/g,'},{')                        // missing comma between objects: }{  → },{
          .replace(/]\s*\[/g,'],[')                       // missing comma between arrays
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,'$1"$2":') // unquoted keys
          .replace(/:\s*'([^'\\]*(\\.[^'\\]*)*)'/g,':"$1"'); // single-quoted strings
      };

      // Attempt to recover truncated JSON by closing open brackets
      const closeTruncated=s=>{
        let depth=0,inStr=false,esc=false;
        for(const ch of s){
          if(esc){esc=false;continue;}
          if(ch==='\\'){esc=true;continue;}
          if(ch==='"'){inStr=!inStr;continue;}
          if(inStr)continue;
          if(ch==='['||ch==='{')depth++;
          if(ch===']'||ch==='}')depth--;
        }
        // Close any open braces/brackets
        let fixed=s.replace(/,\s*$/,''); // remove trailing comma before close
        while(depth>0){
          fixed+= depth%2===0?']':'}';
          depth--;
        }
        return fixed;
      };

      let parsed=[];
      const attempts=[
        ()=>JSON.parse(text),
        ()=>JSON.parse(fixJson(text)),
        ()=>JSON.parse(fixJson(closeTruncated(text))),
      ];
      let lastErr='';
      for(const attempt of attempts){
        try{
          const arr=attempt();
          parsed=(Array.isArray(arr)?arr:[arr]).filter(q=>q&&q.type&&q.topic);
          if(parsed.length)break;
        }catch(e){lastErr=e.message;}
      }
      // Last resort: extract individual objects by regex
      if(!parsed.length){
        const objMatches=[...text.matchAll(/\{(?:[^{}]|\{[^{}]*\})*"type"(?:[^{}]|\{[^{}]*\})*\}/g)];
        parsed=objMatches.map(m=>{try{return JSON.parse(fixJson(m[0]));}catch{return null;}}).filter(q=>q&&q.type&&q.topic);
      }
      if(!parsed.length)throw new Error(`Не удалось разобрать ответ Gemini. Попробуйте ещё раз.\n${lastErr}`);
      if(!parsed.length)throw new Error('Gemini вернул пустой массив вопросов');
      if(!confirm(`Gemini сгенерировал ${parsed.length} вопросов для раздела «${sectionName}». Добавить?`)){setAiGenerating(false);return;}
      setCsvImporting(true);
      const added=[];
      for(const q of parsed){
        const ref=await addDoc(collection(db,'questions'),{...q,sectionId,sectionName,createdAt:new Date().toISOString()});
        added.push({id:ref.id,...q,sectionId,sectionName});
      }
      setQuestions(p=>[...p,...added]);
      setShowCsvImport(false);setCsvText('');setCsvSectionId('');
      alert(`✓ Добавлено ${added.length} вопросов в раздел «${sectionName}»`);
    }catch(e){setAiGenError(e.message);setAiGenModel('');}
    setAiGenerating(false);setCsvImporting(false);
  };

  const downloadCsvTemplate=()=>{
    const header=
      "# Формат: разделитель — точка с запятой (;)\n"+
      "# type: mcq | multiple | matching | generated\n"+
      "# goals: через запятую из exam,gaps,future\n"+
      "#\n"+
      "# ══ СТЕПЕНИ И НАДСТРОЧНЫЙ ТЕКСТ ══\n"+
      "# Используйте символ ^ для обозначения степени — цифра/переменная станет надстрочной:\n"+
      "#   x^2        → x²   (основание x, показатель 2)\n"+
      "#   a^n        → aⁿ   (переменная в степени)\n"+
      "#   x^{n+1}    → x^(n+1) — для сложного выражения в показателе используйте {}\n"+
      "#   x^{-1}     → x⁻¹  (отрицательная степень)\n"+
      "#   2^{10}     → 2¹⁰  (число в степени)\n"+
      "#   (a+b)^{n}  → (a+b)ⁿ\n"+
      "# ВАЖНО: после подстановки {a}^2 превращается в, например, 5^2 → отображается как 5²\n"+
      "#\n"+
      "# MCQ — один правильный ответ:\n"+
      "# mcq ; тема ; текст вопроса ; вар1 ; вар2 ; вар3 ; вар4 ; индекс_верного(0-3) ; цели\n"+
      "mcq;Линейные уравнения;Решите: 3x+7=22;x=5;x=3;x=7;x=4;0;exam,gaps\n"+
      "mcq;Степени;Вычислите: 2^{10};1024;512;2048;256;0;exam,gaps\n"+
      "#\n"+
      "# Multiple — несколько верных ответов:\n"+
      "# multiple ; тема ; текст ; вар1 ; вар2 ; вар3 ; вар4 ; верные_индексы(0,2) ; цели\n"+
      "multiple;Свойства степеней;Что верно для степеней?;a^n*a^m=a^{n+m};a^n*a^m=a^{2n};a^0=1;(a^n)^m=a^{nm};0,2,3;exam\n"+
      "#\n"+
      "# Matching — соответствие:\n"+
      "# matching ; тема ; текст ; левое1=правое1 ; левое2=правое2 ; ... ; цели\n"+
      "matching;Геометрия;Сопоставьте формулу и фигуру;S=a^2=Квадрат;S=πr^2=Круг;S=bh/2=Треугольник;exam,gaps,future\n"+
      "#\n"+
      "# Generated — случайные числа:\n"+
      "# generated ; тема ; шаблон({a},{b}...) ; переменные(a:мин:макс,b:мин:макс) ; производные(имя:формула или -) ; формула_ответа ; неверные(f1|f2|f3) ; цели\n"+
      "# Шаблон поддерживает ^ для степеней: {a}^2 после подстановки → 5^2 → отображается как 5²\n"+
      "generated;Линейные уравнения;Найди x: {a}x + {b} = {c};a:2:9,x:1:10;c:a*x+b;x;x+1|x-1|a+b;exam,gaps\n"+
      "generated;Площадь прямоугольника;Длина {a} см, ширина {b} см. Найди площадь.;a:3:20,b:2:15;-;a*b;a+b|2*(a+b)|a*b+a;exam,gaps,future\n"+
      "generated;Степени;Вычислите: {a}^{n} * {a}^{m};a:2:5,n:1:4,m:1:4;-;Math.pow(a,n+m);Math.pow(a,n*m)|Math.pow(a,n-m)|Math.pow(a,n)+Math.pow(a,m);exam\n";
    const blob=new Blob([header],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="questions_template.csv";a.click();URL.revokeObjectURL(url);
  };

  // Cascading filter: goal → target → section
  const filteredTargets=filterGoalQ==="all"
    ? [...new Set(sections.map(s=>s.specificTarget).filter(Boolean))]
    : [...new Set(sections.filter(s=>(s.goalKeys||[]).includes(filterGoalQ)).map(s=>s.specificTarget).filter(Boolean))];
  const filteredSecsByTarget=filterTargetQ==="all"
    ? sections
    : sections.filter(s=>s.specificTarget===filterTargetQ);
  const filteredSecsByGoal=filterGoalQ==="all"
    ? filteredSecsByTarget
    : filteredSecsByTarget.filter(s=>(s.goalKeys||[]).includes(filterGoalQ));
  const filteredSecOptions=[...filteredSecsByGoal].sort((a,b)=>(a.order??999)-(b.order??999));
  const filteredQ=questions.filter(q=>{
    const secObj=sections.find(s=>s.id===q.sectionId);
    if(filterGoalQ!=="all"&&!(q.goals||[]).includes(filterGoalQ)) return false;
    if(filterTargetQ!=="all"&&secObj?.specificTarget!==filterTargetQ) return false;
    if(filterSec!=="all"&&q.sectionId!==filterSec) return false;
    return true;
  });

  // ─ Students ─
  const [editingPwdFor,setEditingPwdFor]=useState(null);
  const [newPwd,setNewPwd]=useState("");
  const [studentSearch,setStudentSearch]=useState("");
  const [studentStatusFilter,setStudentStatusFilter]=useState("all");
  const [selectedStudent,setSelectedStudent]=useState(null);
  const [showStudentModal,setShowStudentModal]=useState(false);
  const [modalDailyLimit,setModalDailyLimit]=useState(10);
  const [modalPeriodStart,setModalPeriodStart]=useState("");
  const [modalPeriodMonths,setModalPeriodMonths]=useState(3);
  const [modalStatus,setModalStatus]=useState("");
  const [modalPwd,setModalPwd]=useState("");
  const [modalSaving,setModalSaving]=useState(false);

  const updateStatus=async(phone,status)=>{
    try{await updateDoc(doc(db,"users",phone),{status}); setStudents(p=>p.map(s=>s.id===phone?{...s,status}:s));}
    catch{alert("Ошибка.");}
  };
  const savePassword=async(phone)=>{
    if(!newPwd.trim()){alert("Введите пароль.");return;}
    try{
      await updateDoc(doc(db,"users",phone),{password:newPwd.trim()});
      setStudents(p=>p.map(s=>s.id===phone?{...s,password:newPwd.trim()}:s));
      setEditingPwdFor(null);setNewPwd("");
    }catch{alert("Ошибка.");}
  };
  const removePassword=async(phone)=>{
    if(!confirm("Убрать пароль? Ученик сможет войти без него."))return;
    try{
      await updateDoc(doc(db,"users",phone),{password:null});
      setStudents(p=>p.map(s=>s.id===phone?{...s,password:null}:s));
    }catch{alert("Ошибка.");}
  };
  const openStudentModal=(s)=>{
    setSelectedStudent(s);
    setModalDailyLimit(s.dailyTasksLimit||10);
    setModalPeriodStart(s.learningPeriodStart||"");
    setModalPeriodMonths(s.learningPeriodMonths||3);
    setModalStatus(s.status||"trial");
    setModalPwd("");
    setShowStudentModal(true);
  };
  const closeStudentModal=()=>{setShowStudentModal(false);setSelectedStudent(null);};
  const saveStudentModal=async()=>{
    if(!selectedStudent)return;
    setModalSaving(true);
    try{
      const updates={status:modalStatus,dailyTasksLimit:Number(modalDailyLimit),learningPeriodStart:modalPeriodStart||null,learningPeriodMonths:Number(modalPeriodMonths)};
      if(modalPeriodStart){
        const end=new Date(modalPeriodStart);
        end.setMonth(end.getMonth()+Number(modalPeriodMonths));
        updates.learningPeriodEnd=end.toISOString().slice(0,10);
      } else {
        updates.learningPeriodEnd=null;
      }
      if(modalPwd.trim()) updates.password=modalPwd.trim();
      await updateDoc(doc(db,"users",selectedStudent.id),updates);
      setStudents(p=>p.map(s=>s.id===selectedStudent.id?{...s,...updates}:s));
      closeStudentModal();
    }catch{alert("Ошибка при сохранении.");}
    setModalSaving(false);
  };

  // ─ Expert Reports ─
  const [rStudentId,setRStudentId]=useState(null);     // selected student phone
  const [rResults,setRResults]=useState([]);            // their diagnosticResults
  const [rResultId,setRResultId]=useState(null);        // selected result id
  const [rResultData,setRResultData]=useState(null);    // selected result data
  const [rReports,setRReports]=useState({});            // map resultId→report
  const [rLoading,setRLoading]=useState(false);
  const emptyZonedPlan={red:[],yellow:[],green:[]};
  const emptyReport={generalParams:{score:"",accuracy:"",avgPace:""},competencyMap:[],taskTable:[],viscosityZones:"",cognitiveEndurance:"",recommendations:"",zonedPlan:emptyZonedPlan,expertAssessment:"",parentSummary:""};
  const [rForm,setRForm]=useState(emptyReport);
  const [rCsvText,setRCsvText]=useState("");
  const [rSaving,setRSaving]=useState(false);
  const [rSkillProgress,setRSkillProgress]=useState({});
  const [rExamDate,setRExamDate]=useState("");
  const [rHoursPerWeek,setRHoursPerWeek]=useState("");
  const [rAdminPrompt,setRAdminPrompt]=useState("");
  const [rAdminPromptCopied,setRAdminPromptCopied]=useState(false);

  // ─ Plans tab ─
  const [planStudentId,setPlanStudentId]=useState(null);
  const [planZonedPlan,setPlanZonedPlan]=useState({red:[],yellow:[],green:[]});
  const [planManualRepId,setPlanManualRepId]=useState(null);
  const [planAllReps,setPlanAllReps]=useState([]);
  const [planLoading,setPlanLoading]=useState(false);
  const [planSaving,setPlanSaving]=useState(false);
  const [planAddSkill,setPlanAddSkill]=useState("");
  const [planAddZone,setPlanAddZone]=useState("red");
  const [planSearch,setPlanSearch]=useState("");
  const [planTab,setPlanTab]=useState("zones");
  const [planSelectedSkill,setPlanSelectedSkill]=useState(null);
  const [planLessonLogs,setPlanLessonLogs]=useState([]);
  const [planDiagResults,setPlanDiagResults]=useState([]);
  const [planLogForm,setPlanLogForm]=useState({date:new Date().toISOString().slice(0,10),timeSpent:"",percentCovered:"",notes:""});
  const [planLogSaving,setPlanLogSaving]=useState(false);

  const loadPlanSkills=async phone=>{
    setPlanStudentId(phone);setPlanZonedPlan({red:[],yellow:[],green:[]});setPlanManualRepId(null);setPlanAllReps([]);
    setPlanLoading(true);setPlanAddSkill("");setPlanSearch("");setPlanTab("zones");setPlanSelectedSkill(null);setPlanLessonLogs([]);setPlanDiagResults([]);
    try{
      const [repSnap,logSnap,diagSnap]=await Promise.all([
        getDocs(collection(db,"expertReports")),
        getDocs(collection(db,"lessonLogs")),
        getDocs(collection(db,"diagnosticResults"))
      ]);
      const allReps=repSnap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.userId===phone&&r.zonedPlan);
      setPlanAllReps(allReps);
      const manualRep=allReps.find(r=>r.isManual===true);
      setPlanManualRepId(manualRep?.id||null);
      const merged={red:[],yellow:[],green:[]};
      const seen=new Set();
      allReps.forEach(rep=>{
        ["red","yellow","green"].forEach(zone=>{
          (rep.zonedPlan?.[zone]||[]).forEach(item=>{
            const key=(item.skill||item.topic||"").trim();
            if(key&&!seen.has(key)){seen.add(key);merged[zone].push({...item,_manual:!!rep.isManual});}
          });
        });
      });
      setPlanZonedPlan(merged);
      setPlanLessonLogs(logSnap.docs.map(d=>({id:d.id,...d.data()})).filter(l=>l.studentId===phone));
      setPlanDiagResults(diagSnap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.userId===phone));
    }catch(e){alert("Ошибка: "+e.message);}
    setPlanLoading(false);
  };

  const addPlanLessonLog=async()=>{
    if(!planLogForm.timeSpent||!planLogForm.percentCovered){alert("Введите время и процент.");return;}
    if(!planSelectedSkill){return;}
    setPlanLogSaving(true);
    try{
      const data={studentId:planStudentId,skillName:planSelectedSkill,date:planLogForm.date||new Date().toISOString().slice(0,10),timeSpent:Number(planLogForm.timeSpent),percentCovered:Number(planLogForm.percentCovered),notes:planLogForm.notes||"",createdAt:new Date().toISOString()};
      const ref=await addDoc(collection(db,"lessonLogs"),data);
      setPlanLessonLogs(p=>[...p,{id:ref.id,...data}]);
      setPlanLogForm({date:new Date().toISOString().slice(0,10),timeSpent:"",percentCovered:"",notes:""});
    }catch(e){alert("Ошибка: "+e.message);}
    setPlanLogSaving(false);
  };

  const deletePlanLessonLog=async logId=>{
    if(!confirm("Удалить запись о занятии?"))return;
    try{await deleteDoc(doc(db,"lessonLogs",logId));setPlanLessonLogs(p=>p.filter(l=>l.id!==logId));}
    catch(e){alert("Ошибка: "+e.message);}
  };
  const savePlanZonedPlan=async(newZonedPlan)=>{
    if(!planStudentId)return;
    setPlanSaving(true);
    try{
      // Compute deleted skills (were in old state, absent in new)
      const oldSkillSet=new Set();
      ["red","yellow","green"].forEach(z=>(planZonedPlan[z]||[]).forEach(item=>{const k=item.skill||item.topic||"";if(k)oldSkillSet.add(k);}));
      const newSkillSet=new Set();
      ["red","yellow","green"].forEach(z=>(newZonedPlan[z]||[]).forEach(item=>{const k=item.skill||item.topic||"";if(k)newSkillSet.add(k);}));
      const deletedSkills=new Set([...oldSkillSet].filter(s=>!newSkillSet.has(s)));
      // New zone map
      const newZoneMap={};
      ["red","yellow","green"].forEach(z=>(newZonedPlan[z]||[]).forEach(item=>{const k=item.skill||item.topic||"";if(k)newZoneMap[k]=z;}));

      // Update non-manual reports: remove deleted skills, move changed zones
      const updatedAllReps=[...planAllReps];
      for(const rep of planAllReps.filter(r=>!r.isManual&&r.zonedPlan)){
        let changed=false;
        const newZp={red:[],yellow:[],green:[]};
        ["red","yellow","green"].forEach(srcZone=>{
          (rep.zonedPlan[srcZone]||[]).forEach(t=>{
            const key=(t.skills?.[0]||t.topic||t.skill||"").trim();
            if(!key){newZp[srcZone].push(t);return;}
            if(deletedSkills.has(key)){changed=true;return;} // deleted
            const tgtZone=newZoneMap[key]||srcZone;
            if(tgtZone!==srcZone)changed=true;
            newZp[tgtZone].push(t);
          });
        });
        if(changed){
          await updateDoc(doc(db,"expertReports",rep.id),{zonedPlan:newZp});
          const idx=updatedAllReps.findIndex(r=>r.id===rep.id);
          if(idx>=0)updatedAllReps[idx]={...updatedAllReps[idx],zonedPlan:newZp};
        }
      }
      setPlanAllReps(updatedAllReps);

      // Save manual report with full new plan
      const clean={};
      ["red","yellow","green"].forEach(z=>{clean[z]=(newZonedPlan[z]||[]).map(({_manual,...rest})=>rest);});
      const data={userId:planStudentId,isManual:true,zonedPlan:clean,updatedAt:new Date().toISOString()};
      let newId=planManualRepId;
      if(newId){await updateDoc(doc(db,"expertReports",newId),data);}
      else{const ref=await addDoc(collection(db,"expertReports"),data);newId=ref.id;setPlanManualRepId(newId);}

      setPlanZonedPlan(newZonedPlan);
    }catch(e){alert("Ошибка: "+e.message);}
    setPlanSaving(false);
  };
  const planAddEntry=async()=>{
    const name=planAddSkill.trim();
    if(!name)return;
    const sk=skillsDb.find(s=>s.name===name);
    const item={skill:name,skills:[name],topic:name,section:sk?.sectionName||"",grade:sk?.grade||"",description:""};
    const updated={...planZonedPlan,[planAddZone]:[...(planZonedPlan[planAddZone]||[]),item]};
    await savePlanZonedPlan(updated);
    setPlanAddSkill("");
  };
  const planRemoveEntry=async(zone,idx)=>{
    const name=planZonedPlan[zone]?.[idx]?.skill||"";
    if(!confirm(`Удалить навык «${name}» из плана ученика?`))return;
    const updated={...planZonedPlan,[zone]:planZonedPlan[zone].filter((_,i)=>i!==idx)};
    await savePlanZonedPlan(updated);
  };
  const planChangeZone=async(fromZone,idx,toZone)=>{
    if(fromZone===toZone)return;
    const item={...planZonedPlan[fromZone][idx]};
    const updated={
      ...planZonedPlan,
      [fromZone]:planZonedPlan[fromZone].filter((_,i)=>i!==idx),
      [toZone]:[...(planZonedPlan[toZone]||[]),item],
    };
    await savePlanZonedPlan(updated);
  };

  const loadStudentResults=async phone=>{
    setRStudentId(phone);setRResultId(null);setRResultData(null);setRLoading(true);
    setRAdminPrompt("");setRAdminPromptCopied(false);setRExamDate("");setRHoursPerWeek("");
    try{
      const snap=await getDocs(collection(db,"diagnosticResults"));
      const res=snap.docs.map(d=>({id:d.id,...d.data()})).filter(r=>r.userId===phone).sort((a,b)=>b.completedAt?.localeCompare(a.completedAt));
      setRResults(res);
      const repSnap=await getDocs(collection(db,"expertReports"));
      const repMap={};
      repSnap.docs.forEach(d=>{const r={id:d.id,...d.data()};repMap[r.resultId]=r;});
      setRReports(repMap);
      const spSnap=await getDoc(doc(db,"skillProgress",phone));
      setRSkillProgress(spSnap.exists()?spSnap.data().skills||{}:{});
    }catch(e){alert("Ошибка: "+e.message);}
    setRLoading(false);
  };

  const openReportEditor=result=>{
    setRResultId(result.id);setRResultData(result);
    const existing=rReports[result.id];
    if(existing){
      setRForm({
        generalParams:existing.generalParams||{score:"",accuracy:"",avgPace:""},
        competencyMap:existing.competencyMap||[],
        taskTable:existing.taskTable||[],
        viscosityZones:existing.viscosityZones||"",
        cognitiveEndurance:existing.cognitiveEndurance||"",
        recommendations:existing.recommendations||"",
        zonedPlan:existing.zonedPlan||emptyZonedPlan,
        expertAssessment:existing.expertAssessment||"",
        parentSummary:existing.parentSummary||"",
      });
    } else {
      // Auto-build competency map from result answers
      const topicMap={};
      (result.answers||[]).forEach(a=>{
        if(!topicMap[a.topic])topicMap[a.topic]={correct:0,total:0};
        topicMap[a.topic].total++;
        if(a.correct)topicMap[a.topic].correct++;
      });
      const competencyMap=Object.entries(topicMap).map(([topic,v])=>({topic,percent:Math.round((v.correct/v.total)*100)}));
      setRForm({...emptyReport,
        generalParams:{score:result.score||"",accuracy:result.score||"",avgPace:result.totalTime&&result.totalQuestions?Math.round(result.totalTime/result.totalQuestions):""},
        competencyMap,
      });
    }
  };

  const saveReport=async()=>{
    setRSaving(true);
    try{
      const stu=students.find(s=>s.id===rStudentId);
      const data={
        resultId:rResultId,
        userId:rStudentId,
        userName:stu?`${stu.firstName} ${stu.lastName}`:"",
        sectionName:rResultData?.sectionName||"",
        sectionId:rResultData?.sectionId||"",
        generalParams:{score:Number(rForm.generalParams.score)||0,accuracy:Number(rForm.generalParams.accuracy)||0,avgPace:Number(rForm.generalParams.avgPace)||0},
        competencyMap:rForm.competencyMap,
        taskTable:rForm.taskTable,
        viscosityZones:rForm.viscosityZones||"",
        cognitiveEndurance:rForm.cognitiveEndurance||"",
        recommendations:rForm.recommendations,
        zonedPlan:rForm.zonedPlan,
        expertAssessment:rForm.expertAssessment,
        parentSummary:rForm.parentSummary,
        createdAt:rReports[rResultId]?.createdAt||new Date().toISOString(),
        updatedAt:new Date().toISOString(),
      };
      if(rReports[rResultId]){
        await updateDoc(doc(db,"expertReports",rReports[rResultId].id),data);
        setRReports(p=>({...p,[rResultId]:{...p[rResultId],...data}}));
      } else {
        const ref=await addDoc(collection(db,"expertReports"),data);
        setRReports(p=>({...p,[rResultId]:{id:ref.id,...data}}));
      }
      // Write zones from zonedPlan to userProgress (topics) and skillProgress (skills)
      // Merges with existing data: new report zones overwrite same keys, old keys are preserved
      if(rStudentId&&data.zonedPlan){
        try{
          const now=new Date().toISOString();
          // Load existing to preserve previous zones (for prevZone tracking) and old skills
          const [upSnap,spSnap]=await Promise.all([
            getDoc(doc(db,"userProgress",rStudentId)),
            getDoc(doc(db,"skillProgress",rStudentId)),
          ]);
          const existingTopics=upSnap.exists()?(upSnap.data().topics||{}):{};
          const existingSkills=spSnap.exists()?(spSnap.data().skills||{}):{};

          // Build new entries from this report's zonedPlan
          const newTopics={};
          ["red","yellow","green"].forEach(zone=>{
            (data.zonedPlan[zone]||[]).forEach(t=>{
              const key=t.topic||t.skill||"";
              if(!key) return;
              const prev=existingTopics[key];
              newTopics[key]={zone,section:t.section||"",lastScore:null,prevZone:prev?.zone&&prev.zone!==zone?prev.zone:prev?.prevZone||null,updatedAt:now};
            });
          });
          const newSkills={};
          ["red","yellow","green"].forEach(zone=>{
            (data.zonedPlan[zone]||[]).forEach(t=>{
              const key=t.skill||t.topic||"";
              if(!key) return;
              const prev=existingSkills[key];
              newSkills[key]={zone,topic:t.topic||"",section:t.section||"",lastScore:null,prevZone:prev?.zone&&prev.zone!==zone?prev.zone:prev?.prevZone||null,updatedAt:now,description:t.description||""};
            });
          });

          // Merge: existing first, then overwrite with new (preserves skills from older reports)
          await setDoc(doc(db,"userProgress",rStudentId),{topics:{...existingTopics,...newTopics}});
          await setDoc(doc(db,"skillProgress",rStudentId),{skills:{...existingSkills,...newSkills}});
        }catch(e){console.error("Write progress from report error:",e);}
      }
      alert("Отчёт сохранён!");
    }catch(e){alert("Ошибка: "+e.message);}
    setRSaving(false);
  };

  const importTaskCsv=()=>{
    const lines=rCsvText.split("\n").map(l=>l.trim()).filter(l=>l&&!l.startsWith("#"));
    if(!lines.length){alert("Нет данных.");return;}
    const sep=lines[0].includes("\t")?"\t":";";
    const rows=lines.map((l,i)=>{
      const c=l.split(sep).map(s=>s.trim());
      return{num:c[0]||String(i+1),section:c[1]||"",status:c[2]||"",draftAnalysis:c[3]||"",expertVerdict:c[4]||""};
    });
    setRForm(p=>({...p,taskTable:rows}));
    setRCsvText("");
    alert(`Импортировано ${rows.length} строк`);
  };

  const TABS=[{id:"sections",label:"📂 Разделы"},{id:"questions",label:"❓ Вопросы"},{id:"theory",label:"📖 Теория"},{id:"skills",label:"🎯 Навыки"},{id:"skillmap",label:"🗺️ Карта навыков"},{id:"students",label:"👥 Ученики"},{id:"reports",label:"📋 Отчёты"},{id:"plans",label:"📋 Планы"},{id:"cdm",label:"🧠 CDM"},{id:"simulator",label:"🧪 Симулятор"},{id:"dailytasks",label:"📝 Ежедневные задачи"},{id:"skilltasks",label:"🎮 Задачи навыков"}];

  const getPivotSkillsForGrade=(grade)=>{
    const result=[];
    sections.filter(s=>s.specificTarget===grade).forEach(sec=>{
      const hier=skillHierarchies.find(h=>h.id===sec.id);
      if(!hier)return;
      (hier.clusters||[]).forEach(cl=>{
        (cl.pivot_skills||[]).forEach(ps=>{
          result.push({skill_id:ps.skill_id,skill_name:ps.skill_name,section:sec.name,cluster:cl.cluster_name,level:ps.level});
        });
      });
    });
    return result;
  };

  const saveCrossGradeLinks=async()=>{
    if(!cgmPair||!cgmJsonDraft.trim())return;
    setCgmSaving(true);
    try{
      const parsed=JSON.parse(cgmJsonDraft.trim());
      // Поддерживаем новый формат grade_modules
      if(!parsed.grade_modules&&!Array.isArray(parsed.diagnostic_modules))
        throw new Error('JSON должен содержать поле "grade_modules"');
      await setDoc(doc(db,'crossGradeLinks',cgmPair),{...parsed,chain:cgmPair,updatedAt:new Date().toISOString()});
      setCrossGradeLinks(p=>{
        const exists=p.find(h=>h.id===cgmPair);
        const updated={id:cgmPair,...parsed,chain:cgmPair,updatedAt:new Date().toISOString()};
        return exists?p.map(h=>h.id===cgmPair?updated:h):[...p,updated];
      });
      setCgmJsonDraft('');
      alert('✓ Межклассовые связи сохранены!');
    }catch(e){alert('Ошибка: '+e.message);}
    setCgmSaving(false);
  };

  const deleteCrossGradeLinks=async(pairId)=>{
    if(!confirm('Удалить межклассовые связи для этой пары?'))return;
    try{
      await deleteDoc(doc(db,'crossGradeLinks',pairId));
      setCrossGradeLinks(p=>p.filter(h=>h.id!==pairId));
    }catch(e){alert('Ошибка: '+e.message);}
  };

  const deleteAllCrossGradeLinks=async()=>{
    if(!confirm(`Удалить ВСЕ межклассовые связи (${crossGradeLinks.length} записей)? Это действие необратимо.`))return;
    try{
      await Promise.all(crossGradeLinks.map(h=>deleteDoc(doc(db,'crossGradeLinks',h.id))));
      setCrossGradeLinks([]);
      setCgmPair('');
      setCgmChain([]);
      alert('✓ Все межклассовые связи удалены.');
    }catch(e){alert('Ошибка: '+e.message);}
  };

  const deleteCdmCluster=async(sectionId,clusterIndex)=>{
    const hier=skillHierarchies.find(h=>h.id===sectionId);
    if(!hier)return;
    if(!confirm(`Удалить кластер «${hier.clusters[clusterIndex]?.cluster_name}»?`))return;
    const newClusters=hier.clusters.filter((_,i)=>i!==clusterIndex);
    try{
      await setDoc(doc(db,'skillHierarchies',sectionId),{...hier,clusters:newClusters,updatedAt:new Date().toISOString()});
      setSkillHierarchies(p=>p.map(h=>h.id===sectionId?{...h,clusters:newClusters,updatedAt:new Date().toISOString()}:h));
    }catch(e){alert('Ошибка: '+e.message);}
  };

  const deleteCdmHierarchy=async(sectionId)=>{
    if(!confirm('Удалить всю иерархию CDM для этого раздела?'))return;
    try{
      await deleteDoc(doc(db,'skillHierarchies',sectionId));
      setSkillHierarchies(p=>p.filter(h=>h.id!==sectionId));
    }catch(e){alert('Ошибка: '+e.message);}
  };

  const saveTaskBankEntry=async()=>{
    if(!tbSkillId||!tbJsonDraft.trim())return;
    setTbSaving(true);
    try{
      const parsed=JSON.parse(tbJsonDraft.trim());
      if(!parsed.skill_id||!Array.isArray(parsed.tasks))throw new Error('JSON должен содержать skill_id и массив tasks');
      await setDoc(doc(db,'taskBank',tbSkillId),{...parsed,savedAt:new Date().toISOString()});
      setTaskBankEntries(p=>{
        const exists=p.find(e=>e.id===tbSkillId);
        const updated={id:tbSkillId,...parsed,savedAt:new Date().toISOString()};
        return exists?p.map(e=>e.id===tbSkillId?updated:e):[...p,updated];
      });
      setTbJsonDraft('');
      alert(`✓ ${parsed.tasks?.length||0} задач сохранено для ${tbSkillId}`);
    }catch(e){alert('Ошибка: '+e.message);}
    setTbSaving(false);
  };

  const autoGenerateTaskBank=async(skill,gradeNum)=>{
    if(!geminiKey.trim()){alert('Введите Gemini API ключ в настройках');return;}
    setTbGenerating(true);
    try{
      const inputJson={
        skill_id:skill.skill_id,
        vertical_line_id:skill.vertical_line_id||'',
        grade:gradeNum,
        skill_name:skill.skill_name,
        included_skills:skill.impacted_skills||[],
        description:`Ученик должен применять все навыки из included_skills в комплексе при решении задач уровня ЕНТ.`,
        typical_error:`Механическое применение отдельных навыков без учёта их взаимодействия в составной задаче.`,
      };
      const prompt=`Role: Ты — Ведущий Методист-Разработчик AAPA. Твоя специализация — создание диагностических задач, которые проверяют комплексные узлы навыков.

Входные данные:
Я буду передавать тебе JSON-объекты навыков. Ключевые поля:

skill_id: Уникальный идентификатор узла.

included_skills: МАССИВ конкретных микро-навыков, которые входят в этот узел.

description: Общее описание цели обучения.

typical_error: Самая частая точка отказа.

Твой Методический Алгоритм (Строгое исполнение):

Протокол Покрытия (Inclusion Check): При создании задачи ты ОБЯЗАН сконструировать условие так, чтобы ученик не мог получить верный ответ, не применив КАЖДЫЙ пункт из массива included_skills.

Диагностическая Структура: Для каждого skill_id генерируй 3 варианта задач:

Task 1 (Standard): Прямая проверка всех included_skills.

Task 2 (Contextual): Прикладная задача (Word Problem), требующая перевода текста в модель с использованием всех included_skills.

Task 3 (Compound/Hard): Многошаговая задача, где ошибка в одном из микро-навыков ведет к конкретному дистрактору.

Технический формат (JSON):

{
  "skill_id": "string",
  "vertical_line_id": "string",
  "grade": number,
  "tasks": [
    {
      "task_id": "string_id",
      "type": "mcq | compound",
      "question_text": "Текст (LaTeX: $...$)",
      "options": ["A", "B", "C", "D"],
      "correct_index": number,
      "explanation": "Пошаговый разбор: как был применен каждый навык из included_skills.",
      "skills_tested": ["Список реально задействованных навыков из входящего массива"]
    }
  ]
}

Требования к качеству:

Используй typical_error для формирования Option A или Option B.

Текст задач должен быть на русском языке.

Математическая нотация — строго в LaTeX.

Никаких вводных слов. На выходе должен быть только валидный JSON. Первый символ {, последний }.

Входной JSON навыка:
${JSON.stringify(inputJson,null,2)}`;

      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.4,maxOutputTokens:8192}}),
      });
      if(!res.ok){
        const err=await res.json().catch(()=>({}));
        throw new Error(err?.error?.message||`HTTP ${res.status}`);
      }
      const data=await res.json();
      let text=(data.candidates?.[0]?.content?.parts?.[0]?.text||'').trim();
      text=text.replace(/^```[a-z]*\n?/im,'').replace(/```\s*$/m,'').trim();
      const m=text.match(/\{[\s\S]*\}/);
      if(m)text=m[0];
      const fixJson=s=>s.replace(/[\u201C\u201D\u00AB\u00BB]/g,'"').replace(/,\s*([}\]])/g,'$1').replace(/}\s*{/g,'},{').replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,'$1"$2":');
      let parsed=null;
      for(const fn of [()=>JSON.parse(text),()=>JSON.parse(fixJson(text))]){try{parsed=fn();if(parsed)break;}catch(e){}}
      if(!parsed||!parsed.tasks)throw new Error('Не удалось распарсить ответ Gemini');
      await setDoc(doc(db,'taskBank',skill.skill_id),{...parsed,savedAt:new Date().toISOString()});
      setTaskBankEntries(p=>{
        const exists=p.find(e=>e.id===skill.skill_id);
        const updated={id:skill.skill_id,...parsed,savedAt:new Date().toISOString()};
        return exists?p.map(e=>e.id===skill.skill_id?updated:e):[...p,updated];
      });
      alert(`✓ ${parsed.tasks?.length||0} задач сгенерировано для ${skill.skill_id}`);
    }catch(e){alert('Ошибка: '+e.message);}
    setTbGenerating(false);
  };

  const bulkGenerateTaskBank=async(skills,gradeNum)=>{
    if(!geminiKey.trim()){alert('Введите Gemini API ключ в настройках');return;}
    if(!skills.length){alert('Нет навыков для выбранного класса');return;}
    setTbBulkRunning(true);
    // Сразу помечаем skill_id у которых уже есть задачи в taskBank
    setTbBulkResults(skills.map(sk=>{
      const alreadyHas=taskBankEntries.some(e=>e.id===sk.skill_id);
      return {skillId:sk.skill_id,skillName:sk.skill_name,status:alreadyHas?'exists':'pending'};
    }));
    setTbBulkSummary(null);

    const updateR=(skillId,patch)=>setTbBulkResults(p=>p.map(r=>r.skillId===skillId?{...r,...patch}:r));
    const isParseErr=(msg)=>{const m=(msg||'').toLowerCase();return m.includes('parse')||m.includes('json')||m.includes('syntax')||m.includes('распарсить');};

    const attemptOne=async(skill,isRetry)=>{
      try{
        const inputJson={skill_id:skill.skill_id,vertical_line_id:skill.vertical_line_id||'',grade:gradeNum,skill_name:skill.skill_name,included_skills:skill.impacted_skills||[],description:`Ученик должен применять все навыки из included_skills в комплексе при решении задач уровня ЕНТ.`,typical_error:`Механическое применение отдельных навыков без учёта их взаимодействия в составной задаче.`};
        const prompt=`Role: Ты — Ведущий Методист-Разработчик AAPA. Твоя специализация — создание диагностических задач, которые проверяют комплексные узлы навыков.\n\nВходные данные:\nЯ буду передавать тебе JSON-объекты навыков. Ключевые поля:\n\nskill_id: Уникальный идентификатор узла.\n\nincluded_skills: МАССИВ конкретных микро-навыков, которые входят в этот узел.\n\ndescription: Общее описание цели обучения.\n\ntypical_error: Самая частая точка отказа.\n\nТвой Методический Алгоритм (Строгое исполнение):\n\nПротокол Покрытия (Inclusion Check): При создании задачи ты ОБЯЗАН сконструировать условие так, чтобы ученик не мог получить верный ответ, не применив КАЖДЫЙ пункт из массива included_skills.\n\nДиагностическая Структура: Для каждого skill_id генерируй 3 варианта задач:\n\nTask 1 (Standard): Прямая проверка всех included_skills.\n\nTask 2 (Contextual): Прикладная задача (Word Problem), требующая перевода текста в модель с использованием всех included_skills.\n\nTask 3 (Compound/Hard): Многошаговая задача, где ошибка в одном из микро-навыков ведет к конкретному дистрактору.\n\nТехнический формат (JSON):\n\n{\n  "skill_id": "string",\n  "vertical_line_id": "string",\n  "grade": number,\n  "tasks": [\n    {\n      "task_id": "string_id",\n      "type": "mcq | compound",\n      "question_text": "Текст (LaTeX: $...$)",\n      "options": ["A", "B", "C", "D"],\n      "correct_index": number,\n      "explanation": "Пошаговый разбор: как был применен каждый навык из included_skills.",\n      "skills_tested": ["Список реально задействованных навыков из входящего массива"]\n    }\n  ]\n}\n\nТребования к качеству:\n\nИспользуй typical_error для формирования Option A или Option B.\n\nТекст задач должен быть на русском языке.\n\nМатематическая нотация — строго в LaTeX.\n\nНикаких вводных слов. На выходе должен быть только валидный JSON. Первый символ {, последний }.\n\nВходной JSON навыка:\n${JSON.stringify(inputJson,null,2)}`;
        const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.4,maxOutputTokens:8192}})});
        if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err?.error?.message||`HTTP ${res.status}`);}
        const data=await res.json();
        let text=(data.candidates?.[0]?.content?.parts?.[0]?.text||'').trim();
        text=text.replace(/^```[a-z]*\n?/im,'').replace(/```\s*$/m,'').trim();
        const m=text.match(/\{[\s\S]*\}/);if(m)text=m[0];
        const fixJson=s=>s.replace(/[\u201C\u201D\u00AB\u00BB]/g,'"').replace(/,\s*([}\]])/g,'$1').replace(/}\s*{/g,'},{').replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,'$1"$2":');
        let parsed=null;
        for(const fn of[()=>JSON.parse(text),()=>JSON.parse(fixJson(text))]){try{parsed=fn();if(parsed)break;}catch(e){}}
        if(!parsed||!parsed.tasks)throw new Error('Не удалось распарсить ответ Gemini');
        await setDoc(doc(db,'taskBank',skill.skill_id),{...parsed,savedAt:new Date().toISOString()});
        setTaskBankEntries(p=>{const exists=p.find(e=>e.id===skill.skill_id);const updated={id:skill.skill_id,...parsed,savedAt:new Date().toISOString()};return exists?p.map(e=>e.id===skill.skill_id?updated:e):[...p,updated];});
        return {ok:true,taskCount:parsed.tasks?.length||0};
      }catch(e){
        return {ok:false,parseErr:isParseErr(e.message),error:e.message};
      }
    };

    let successCount=0,skippedCount=0,existsCount=0;
    for(const skill of skills){
      // Пропускаем skill_id у которых уже есть задачи
      if(taskBankEntries.some(e=>e.id===skill.skill_id)){existsCount++;continue;}
      updateR(skill.skill_id,{status:'loading'});
      let res=await attemptOne(skill,false);
      if(!res.ok&&res.parseErr){
        updateR(skill.skill_id,{status:'retrying',retried:true});
        await new Promise(r=>setTimeout(r,4500));
        res=await attemptOne(skill,true);
      }
      if(res.ok){updateR(skill.skill_id,{status:'success',taskCount:res.taskCount});successCount++;}
      else{updateR(skill.skill_id,{status:'skipped',error:res.error});skippedCount++;}
    }
    setTbBulkSummary({success:successCount,skipped:skippedCount,exists:existsCount,total:skills.length});
    setTbBulkRunning(false);
  };

  const buildMasterMap=async()=>{
    setMasterMapBuilding(true);
    try{
      const skills={};
      // 1. Collect all pivot skills from all hierarchies
      for(const hier of skillHierarchies){
        const sec=sections.find(s=>s.id===hier.id);
        if(!sec)continue;
        const grade=sec.specificTarget||'';
        const sectionName=sec.name||'';
        for(const cl of(hier.clusters||[])){
          const vlId=cl.vertical_line_id||null;
          for(const ps of(cl.pivot_skills||[])){
            if(!ps.skill_id)continue;
            skills[ps.skill_id]={
              skill_id:ps.skill_id,
              skill_name:ps.skill_name||'',
              level:ps.level||1,
              grade,
              section:sectionName,
              cluster_name:cl.cluster_name||'',
              vertical_line_id:vlId,
              prerequisites:ps.prerequisites||[],
              impacted_skills:ps.impacted_skills||[],
              downstream_skill_ids:[],
              upstream_skill_ids:[],
            };
          }
        }
      }
      // 2. Wire cross-grade connections from crossGradeLinks
      for(const link of crossGradeLinks){
        for(const mod of(link.diagnostic_modules||[])){
          for(const pw of(mod.pathways||[])){
            const entryId=pw.entry_skill_id;
            const drillIds=pw.drill_down_to||[];
            if(skills[entryId]){
              for(const dId of drillIds){
                if(dId&&!skills[entryId].downstream_skill_ids.includes(dId))
                  skills[entryId].downstream_skill_ids.push(dId);
              }
            }
            for(const dId of drillIds){
              if(dId&&skills[dId]){
                if(!skills[dId].upstream_skill_ids.includes(entryId))
                  skills[dId].upstream_skill_ids.push(entryId);
              }
            }
          }
        }
      }
      // 3. Compute stats
      const totalSkills=Object.keys(skills).length;
      const gradesList=[...new Set(Object.values(skills).map(s=>s.grade).filter(Boolean))].sort((a,b)=>GRADES_LIST.indexOf(a)-GRADES_LIST.indexOf(b));
      const vlDist={ARITHMETIC:0,ALGEBRA:0,GEOMETRY:0,WORD_PROBLEMS:0};
      for(const s of Object.values(skills))if(s.vertical_line_id&&vlDist[s.vertical_line_id]!==undefined)vlDist[s.vertical_line_id]++;
      const connectedSkills=Object.values(skills).filter(s=>s.downstream_skill_ids.length||s.upstream_skill_ids.length).length;
      const mapDoc={skills,builtAt:new Date().toISOString(),stats:{totalSkills,grades:gradesList,verticalLines:vlDist,connectedSkills}};
      await setDoc(doc(db,'globalSkillMap','master'),mapDoc);
      setMasterMap(mapDoc);
      alert(`✓ Мастер-Карта построена!\n${totalSkills} навыков · ${connectedSkills} межклассовых связей`);
    }catch(e){alert('Ошибка: '+e.message);}
    setMasterMapBuilding(false);
  };

  const linkPrerequisites=async()=>{
    setPrereqLinking(true);
    setPrereqLinkResult(null);
    try{
      // ── Источник 1: внутриклассовые пререквизиты из skillHierarchies ──────
      // CDM определяет зависимости между pivot-навыками внутри одного раздела
      const prereqMap={};
      skillHierarchies.forEach(hier=>{
        (hier.clusters||[]).forEach(cl=>{
          (cl.pivot_skills||[]).forEach(ps=>{
            if(ps.skill_id){
              if(!prereqMap[ps.skill_id]) prereqMap[ps.skill_id]=[];
              for(const p of(Array.isArray(ps.prerequisites)?ps.prerequisites:[])){
                if(p&&!prereqMap[ps.skill_id].includes(p)) prereqMap[ps.skill_id].push(p);
              }
            }
          });
        });
      });

      // ── Источник 2: межклассовые пререквизиты из crossGradeLinks ──────────
      // CGM определяет drill-down связи между классами (11→10→9...)
      // entry_skill_id (старший класс) drill_down_to → [навыки младшего класса]
      crossGradeLinks.forEach(link=>{
        (link.diagnostic_modules||[]).forEach(mod=>{
          (mod.pathways||[]).forEach(pw=>{
            const entryId=pw.entry_skill_id;
            const drillIds=pw.drill_down_to||[];
            if(!entryId||drillIds.length===0)return;
            if(!prereqMap[entryId]) prereqMap[entryId]=[];
            for(const dId of drillIds){
              if(dId&&!prereqMap[entryId].includes(dId)) prereqMap[entryId].push(dId);
            }
          });
        });
      });

      const matchCount=Object.keys(prereqMap).length;
      if(matchCount===0){alert('Нет навыков в CDM/CGM. Сначала добавьте иерархии и межклассовые связи.');setPrereqLinking(false);return;}

      // ── Загружаем все taskBank-документы и пишем prerequisites[] ──────────
      const tbSnap=await getDocs(collection(db,'taskBank'));
      const tbSids=tbSnap.docs.map(d=>d.data().skill_id||d.id);
      const updates=[];
      tbSnap.docs.forEach(d=>{
        const sid=d.data().skill_id||d.id;
        if(prereqMap[sid]!==undefined){
          updates.push({ref:doc(db,'taskBank',d.id),prereqs:prereqMap[sid]});
        }
      });

      // Диагностика: какие CGM entry_skill_id не нашли совпадения в taskBank
      const cgmEntryIds=[...new Set(crossGradeLinks.flatMap(l=>(l.diagnostic_modules||[]).flatMap(m=>(m.pathways||[]).map(p=>p.entry_skill_id).filter(Boolean))))];
      const cgmMissed=cgmEntryIds.filter(id=>!tbSids.includes(id));
      const cdmIds=Object.keys(prereqMap);

      const cgmCount=crossGradeLinks.reduce((acc,l)=>(l.diagnostic_modules||[]).reduce((a,m)=>a+(m.pathways||[]).length,acc),0);

      if(updates.length===0){
        setPrereqLinkResult({updated:0,total:tbSnap.docs.length,mapSize:matchCount,cgmPaths:cgmCount,cgmMissed:cgmMissed.length,cgmTotal:cgmEntryIds.length});
        setPrereqLinking(false);return;
      }

      await Promise.all(updates.map(u=>updateDoc(u.ref,{
        prerequisites:    u.prereqs,
        prerequisite_id:  u.prereqs[0]||null,
      })));
      setPrereqLinkResult({updated:updates.length,total:tbSnap.docs.length,mapSize:matchCount,cgmPaths:cgmCount,cgmMissed:cgmMissed.length,cgmTotal:cgmEntryIds.length});
    }catch(e){alert('Ошибка: '+e.message);}
    setPrereqLinking(false);
  };

  const autoAssignVerticalLines=async()=>{
    if(!cdmSectionId)return;
    const hier=skillHierarchies.find(h=>h.id===cdmSectionId);
    if(!hier)return;
    if(!geminiKey.trim()){alert('Введите Gemini API ключ в настройках');return;}
    setVlGenerating(true);
    try{
      const clusters=hier.clusters||[];
      const prompt=`Ты — Data Engineer и методолог математической платформы AAPA. Твоя задача — обогатить существующую JSON-иерархию учебных навыков, распределив кластеры по 4 глобальным вертикальным линиям (Vertical Pathways).

Task:
Я передам тебе готовый JSON с математическими кластерами и Pivot-навыками. Тебе нужно проанализировать смысловую нагрузку каждого кластера и добавить на уровень кластера новое поле: "vertical_line_id".

Категории для распределения (ИСПОЛЬЗОВАТЬ ТОЛЬКО ИХ):

"ARITHMETIC" — Числа, дроби, степени, корни, вычисления, пропорции.

"ALGEBRA" — Выражения, формулы сокращенного умножения, уравнения всех типов, неравенства, функции, графики.

"GEOMETRY" — Углы, фигуры, площади, периметры, теорема Пифагора, тригонометрия (синус/косинус), векторы, координаты.

"WORD_PROBLEMS" — Текстовые задачи на движение, работу, проценты, сплавы, логику и моделирование.

КРИТИЧЕСКИЕ ТРЕБОВАНИЯ:

Сохрани оригинальную структуру моего JSON буква в букву. Не меняй названия навыков, не трогай массивы prerequisites и impacted_skills.

Добавь поле "vertical_line_id" в каждый объект массива clusters (сразу после cluster_name).

Если кластер пограничный (например, геометрическая задача с применением уравнения), приоритет отдается изначальной теме — "GEOMETRY".

Формат вывода:
Выдай ответ СТРОГО в формате валидного JSON. Не используй Markdown-разметку (без \`\`\`json). Первый символ {, последний }.

Вот мой JSON для обновления:
${JSON.stringify({section:hier.section,clusters},null,2)}`;

      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.2,maxOutputTokens:8192}}),
      });
      if(!res.ok){
        const errData=await res.json().catch(()=>({}));
        const errMsg=errData?.error?.message||`HTTP ${res.status}`;
        throw new Error(`Gemini: ${errMsg}`);
      }
      const data=await res.json();
      let text=(data.candidates?.[0]?.content?.parts?.[0]?.text||'').trim();
      if(!text)throw new Error('Gemini вернул пустой ответ');
      text=text.replace(/^```[a-z]*\n?/im,'').replace(/```\s*$/m,'').trim();
      // Extract JSON object
      const objMatch=text.match(/\{[\s\S]*\}/);
      if(objMatch)text=objMatch[0];

      const fixJson=s=>s
        .replace(/[\u201C\u201D\u00AB\u00BB]/g,'"')
        .replace(/,\s*([}\]])/g,'$1')
        .replace(/}\s*{/g,'},{')
        .replace(/]\s*\[/g,'],[')
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,'$1"$2":')
        .replace(/:\s*'([^'\\]*(\\.[^'\\]*)*)'/g,':"$1"');

      let parsed=null;
      for(const attempt of [()=>JSON.parse(text),()=>JSON.parse(fixJson(text))]){
        try{parsed=attempt();if(parsed)break;}catch(e){}
      }
      if(!parsed||!parsed.clusters)throw new Error('Не удалось распарсить JSON от Gemini');

      const VALID_VL=['ARITHMETIC','ALGEBRA','GEOMETRY','WORD_PROBLEMS'];
      const invalid=parsed.clusters.find(c=>!c.vertical_line_id||!VALID_VL.includes(c.vertical_line_id));
      if(invalid)throw new Error(`Кластер "${invalid.cluster_name}" имеет недопустимый vertical_line_id`);

      await setDoc(doc(db,'skillHierarchies',cdmSectionId),{...parsed,sectionId:cdmSectionId,updatedAt:new Date().toISOString()});
      setSkillHierarchies(p=>{
        const exists=p.find(h=>h.id===cdmSectionId);
        const updated={id:cdmSectionId,...parsed,sectionId:cdmSectionId};
        return exists?p.map(h=>h.id===cdmSectionId?updated:h):[...p,updated];
      });
      alert('✓ Вертикальные линии назначены автоматически!');
    }catch(e){alert('Ошибка: '+e.message);}
    setVlGenerating(false);
  };

  const saveVerticalLines=async()=>{
    if(!cdmSectionId||!vlJsonDraft.trim())return;
    setVlSaving(true);
    try{
      const parsed=JSON.parse(vlJsonDraft.trim());
      if(!parsed.clusters||!Array.isArray(parsed.clusters))throw new Error('Нет поля "clusters" в JSON');
      const VALID_VL=['ARITHMETIC','ALGEBRA','GEOMETRY','WORD_PROBLEMS'];
      const invalid=parsed.clusters.find(c=>!c.vertical_line_id||!VALID_VL.includes(c.vertical_line_id));
      if(invalid)throw new Error(`Кластер "${invalid.cluster_name}" имеет недопустимый vertical_line_id. Допустимые значения: ${VALID_VL.join(', ')}`);
      await setDoc(doc(db,'skillHierarchies',cdmSectionId),{...parsed,sectionId:cdmSectionId,updatedAt:new Date().toISOString()});
      setSkillHierarchies(p=>{
        const exists=p.find(h=>h.id===cdmSectionId);
        const updated={id:cdmSectionId,...parsed,sectionId:cdmSectionId};
        return exists?p.map(h=>h.id===cdmSectionId?updated:h):[...p,updated];
      });
      setVlJsonDraft('');
      alert('✓ Вертикальные линии сохранены!');
    }catch(e){alert('Ошибка: '+e.message);}
    setVlSaving(false);
  };

  const saveCdmHierarchy=async()=>{
    if(!cdmSectionId||!cdmJsonDraft.trim())return;
    setCdmSaving(true);
    try{
      const parsed=JSON.parse(cdmJsonDraft.trim());
      if(!parsed.clusters||!Array.isArray(parsed.clusters))throw new Error('Нет поля "clusters" в JSON');
      await setDoc(doc(db,'skillHierarchies',cdmSectionId),{...parsed,sectionId:cdmSectionId,updatedAt:new Date().toISOString()});
      setSkillHierarchies(p=>{
        const exists=p.find(h=>h.id===cdmSectionId);
        const updated={id:cdmSectionId,...parsed,sectionId:cdmSectionId};
        return exists?p.map(h=>h.id===cdmSectionId?updated:h):[...p,updated];
      });
      setCdmJsonDraft('');
      alert('✓ Иерархия CDM сохранена!');
    }catch(e){alert('Ошибка: '+e.message);}
    setCdmSaving(false);
  };

  return(
    <div style={{minHeight:"100vh",background:THEME.bg}}>
      <div style={{background:THEME.primary,padding:"0 40px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
        <Logo size={32} light/>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <span style={{color:THEME.accent,fontWeight:700,fontSize:13,background:"rgba(212,175,55,0.15)",padding:"4px 12px",borderRadius:99}}>Администратор</span>
          <button onClick={onBack} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.7)",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontSize:13,fontFamily:"'Inter',sans-serif"}}>← Выйти</button>
        </div>
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"36px 24px"}}>
        <h1 style={{fontFamily:"'Montserrat',sans-serif",fontSize:26,fontWeight:800,color:THEME.primary,marginBottom:24}}>Панель администратора</h1>
        <div style={{display:"flex",gap:4,background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:12,padding:6,marginBottom:32,width:"fit-content"}}>
          {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"10px 20px",borderRadius:8,border:"none",background:tab===t.id?THEME.primary:"transparent",color:tab===t.id?"#fff":THEME.textLight,fontFamily:"'Inter',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer",transition:"all 0.2s"}}>{t.label}</button>)}
        </div>

        {loading&&<div style={{textAlign:"center",padding:60,color:THEME.textLight}}>Загрузка...</div>}

        {/* ── SECTIONS ── */}
        {!loading&&tab==="sections"&&(
          <div>
            <div className="admin-section-header">
              <div><h2 className="admin-section-title">Разделы диагностики</h2><p style={{color:THEME.textLight,fontSize:14}}>Каждый раздел привязан к цели и экзамену/классу</p></div>
              <div style={{display:"flex",gap:8}}>
                <button className="add-btn" style={{background:showTopicBulkImport?"rgba(99,102,241,0.12)":"#fff",border:"1px solid rgba(99,102,241,0.5)",color:"#4338ca"}} onClick={()=>{setShowTopicBulkImport(v=>!v);setShowSecForm(false);}}>📚 Импорт тем</button>
                <button className="add-btn" onClick={openAddSection}>+ Новый раздел</button>
              </div>
            </div>
            {showTopicBulkImport&&(()=>{
              const TOPIC_PROMPT=`У меня есть учебник. Я загружу оглавление (содержание) ниже.
Твоя задача — извлечь все темы и распределить их по разделам в строгом формате.

=== МОИ РАЗДЕЛЫ ===
${sections.length>0?sections.map(s=>`• ${s.name} (${s.specificTarget||s.goalKeys?.join(",")||""})`).join("\n"):"(разделы ещё не созданы)"}

=== ФОРМАТ ВЫВОДА ===
[Точное название раздела]
Название темы 1
Название темы 2 ; Краткое описание (необязательно)
Название темы 3

[Другой раздел]
Тема 4
Тема 5

=== ПРАВИЛА ===
- Название раздела в квадратных скобках [] — должно совпадать с моим разделом ТОЧНО
- Каждая тема — на отдельной строке
- Описание через ; (необязательно, только если важно)
- Пустая строка между разделами
- Не добавляй нумерацию, маркеры списка, лишние символы
- Если тема не подходит ни к одному разделу — пропусти

=== ОГЛАВЛЕНИЕ УЧЕБНИКА ===
[ВСТАВЬ СЮДА ОГЛАВЛЕНИЕ]`;
              return(
              <div className="admin-form-card" style={{marginBottom:20,borderLeft:"4px solid #6366f1"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,margin:0,marginBottom:4}}>📚 Массовый импорт тем по разделам</h3>
                    <p style={{color:THEME.textLight,fontSize:13,margin:0}}>Скопируйте промпт → вставьте в ChatGPT/Claude с оглавлением учебника → вставьте результат сюда</p>
                  </div>
                  <button onClick={()=>setShowTopicBulkImport(false)} style={{background:"transparent",border:"none",fontSize:22,cursor:"pointer",color:THEME.textLight}}>×</button>
                </div>
                {/* Step 1: Prompt */}
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:12,fontWeight:700,color:"#4338ca"}}>Шаг 1 — Промпт для ИИ (уже содержит ваши разделы)</span>
                    <button onClick={()=>navigator.clipboard.writeText(TOPIC_PROMPT).then(()=>alert("Промпт скопирован!")).catch(()=>alert("Скопируйте вручную"))} style={{background:"#4338ca",color:"#fff",border:"none",borderRadius:6,padding:"4px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>📋 Копировать</button>
                  </div>
                  <textarea readOnly value={TOPIC_PROMPT} rows={10} style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,border:"1px solid rgba(99,102,241,0.3)",fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.6,background:"#f8fafc",color:THEME.text,resize:"vertical"}}/>
                </div>
                {/* Step 2: Paste result */}
                <div style={{marginBottom:14}}>
                  <label style={{display:"block",fontSize:12,fontWeight:700,color:"#4338ca",marginBottom:6}}>Шаг 2 — Вставьте ответ от ИИ</label>
                  <textarea value={topicBulkText} onChange={e=>setTopicBulkText(e.target.value)} rows={12} placeholder={"[Алгебра]\nЛинейные уравнения\nКвадратные уравнения ; ax²+bx+c=0\nСистемы уравнений\n\n[Геометрия]\nТреугольники\nЧетырёхугольники"} style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,border:"1px solid rgba(99,102,241,0.3)",fontFamily:"'Courier New',monospace",fontSize:12,lineHeight:1.7,background:"#fff",color:THEME.text,resize:"vertical"}}/>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <button onClick={bulkImportTopics} disabled={topicBulkImporting} style={{background:"#4338ca",color:"#fff",border:"none",borderRadius:8,padding:"9px 22px",fontSize:13,fontWeight:700,cursor:topicBulkImporting?"not-allowed":"pointer",opacity:topicBulkImporting?0.7:1}}>{topicBulkImporting?"⏳ Загружаю...":"✅ Импортировать темы"}</button>
                  <button onClick={()=>{setTopicBulkText("");}} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:"9px 16px",fontSize:12,cursor:"pointer"}}>Очистить</button>
                  <span style={{fontSize:12,color:THEME.textLight}}>Формат: <code>[Раздел]</code> на первой строке, потом темы</span>
                </div>
              </div>
              );
            })()}
            {showSecForm&&(
              <div className="admin-form-card">
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:20}}>{editingSection?"Редактировать раздел":"Новый раздел"}</h3>
                <form onSubmit={editingSection?saveSection:addSection}>
                  <div className="input-group" style={{marginBottom:16}}>
                    <label className="input-label">Название раздела *</label>
                    <input type="text" className="input-field" value={secForm.name} onChange={e=>setSecForm(p=>({...p,name:e.target.value}))} placeholder="Алгебра, Физика..." required/>
                  </div>
                  <div className="input-group" style={{marginBottom:16}}>
                    <label className="input-label">Цели раздела * (можно несколько)</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:4}}>
                      {Object.entries(REG_GOALS).map(([k,v])=>(
                        <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"10px 16px",borderRadius:10,border:`2px solid ${secForm.goalKeys.includes(k)?THEME.primary:THEME.border}`,background:secForm.goalKeys.includes(k)?"#f1f5f9":"#fff",fontSize:14,fontWeight:600,transition:"all 0.15s",userSelect:"none"}}>
                          <input type="checkbox" checked={secForm.goalKeys.includes(k)} onChange={()=>toggleSecGoal(k)} style={{accentColor:THEME.primary,width:16,height:16}}/>
                          {v}
                        </label>
                      ))}
                    </div>
                  </div>
                  {secForm.goalKeys.length>0&&(
                    <div className="input-group" style={{marginBottom:16}}>
                      <label className="input-label">{secSpecificLabel}</label>
                      <select className="input-field" value={secForm.specificTarget} onChange={e=>setSecForm(p=>({...p,specificTarget:e.target.value}))} required>
                        <option value="" disabled>Выберите...</option>
                        {secHasExam&&!secHasGrade&&<optgroup label="Экзамены">{EXAMS_LIST.map(x=><option key={x} value={x}>{x}</option>)}</optgroup>}
                        {!secHasExam&&secHasGrade&&<optgroup label="Классы">{GRADES_LIST.map(x=><option key={x} value={x}>{x}</option>)}</optgroup>}
                        {secHasExam&&secHasGrade&&<><optgroup label="Экзамены">{EXAMS_LIST.map(x=><option key={x} value={x}>{x}</option>)}</optgroup><optgroup label="Классы">{GRADES_LIST.map(x=><option key={x} value={x}>{x}</option>)}</optgroup></>}
                      </select>
                    </div>
                  )}
                  <div className="input-group" style={{marginBottom:16}}>
                    <label className="input-label">Тип раздела *</label>
                    <select className="input-field" value={secForm.sectionType} onChange={e=>setSecForm(p=>({...p,sectionType:e.target.value}))}>
                      <option value="regular">Обычная диагностика</option>
                      <option value="topic">Промежуточный — по теме/навыку (средний босс)</option>
                      <option value="chapter">Промежуточный — по главе (сильный босс + медаль)</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Описание (необязательно)</label>
                    <input type="text" className="input-field" value={secForm.description} onChange={e=>setSecForm(p=>({...p,description:e.target.value}))} placeholder="Краткое описание раздела..."/>
                  </div>
                  <div className="input-group" style={{marginBottom:16}}>
                    <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"12px 16px",borderRadius:10,border:`2px solid ${secForm.isPublic?"#10B981":THEME.border}`,background:secForm.isPublic?"#f0fdf4":"#fff",transition:"all 0.15s",userSelect:"none"}}>
                      <input type="checkbox" checked={!!secForm.isPublic} onChange={e=>setSecForm(p=>({...p,isPublic:e.target.checked}))} style={{accentColor:"#10B981",width:18,height:18}}/>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,color:secForm.isPublic?"#065f46":THEME.text}}>🌐 Общедоступная диагностика</div>
                        <div style={{fontSize:12,color:THEME.textLight,marginTop:2}}>Пробные аккаунты смогут видеть и проходить этот раздел</div>
                      </div>
                    </label>
                  </div>
                  <div style={{display:"flex",gap:12}}>
                    <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={closeSecForm}>Отмена</button>
                    <button type="submit" className="cta-button active">{editingSection?"Сохранить":"Добавить"}</button>
                  </div>
                </form>
              </div>
            )}
            {sections.length===0?<div className="empty-state">Разделов пока нет.</div>:(()=>{
              // Build ordered chapter list: exams first, then grades
              const chapterOrder=[...EXAMS_LIST,...GRADES_LIST];
              const grouped={};
              sections.forEach(s=>{
                const ch=s.specificTarget||"Без категории";
                if(!grouped[ch]) grouped[ch]=[];
                grouped[ch].push(s);
              });
              const chapterKeys=chapterOrder.filter(c=>grouped[c]).concat(Object.keys(grouped).filter(c=>!chapterOrder.includes(c)));
              return(
                <div style={{display:"flex",flexDirection:"column",gap:32}}>
                  {chapterKeys.map(chapter=>{
                    const chSecs=[...grouped[chapter]].sort((a,b)=>(a.order??999)-(b.order??999));
                    const isExam=EXAMS_LIST.includes(chapter);
                    const isGrade=GRADES_LIST.includes(chapter);
                    const chIcon=isExam?"🎓":isGrade?"📚":"📂";
                    const totalQ=chSecs.reduce((s,sec)=>s+questions.filter(q=>q.sectionId===sec.id).length,0);
                    return(
                      <div key={chapter}>
                        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,paddingBottom:10,borderBottom:`2px solid ${THEME.border}`}}>
                          <span style={{fontSize:20}}>{chIcon}</span>
                          <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary,margin:0}}>{chapter}</h3>
                          <span style={{background:"rgba(212,175,55,0.12)",color:"#92680e",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{isExam?"Экзамен":isGrade?"Класс":"Прочее"}</span>
                          <span style={{fontSize:12,color:THEME.textLight,marginLeft:"auto"}}>{chSecs.length} {chSecs.length===1?"раздел":"разделов"} · {totalQ} вопросов</span>
                          <span style={{fontSize:11,color:THEME.textLight,opacity:0.6}}>⠿ перетащи для сортировки</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
                          {chSecs.map((s,idx)=>(
                            <div key={s.id}
                              draggable
                              onDragStart={()=>{dragRef.current={chapter,fromIdx:idx,secId:s.id};}}
                              onDragOver={e=>{e.preventDefault();setDragOver({chapter,idx});}}
                              onDragLeave={()=>setDragOver(null)}
                              onDrop={e=>{e.preventDefault();if(dragRef.current.chapter===chapter){reorderSections(chapter,dragRef.current.fromIdx,idx);}setDragOver(null);}}
                              onDragEnd={()=>setDragOver(null)}
                              className="admin-card"
                              style={{display:"flex",alignItems:"center",gap:12,cursor:"grab",outline:dragOver&&dragOver.chapter===chapter&&dragOver.idx===idx?`2px dashed ${THEME.primary}`:"none",transition:"outline 0.15s"}}>
                              <span style={{fontSize:18,color:THEME.textLight,cursor:"grab",userSelect:"none",flexShrink:0}}>⠿</span>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flex:1}}>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                                    <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,color:THEME.primary}}>{s.name}</span>
                                    {s.isPublic&&<span style={{background:"#dcfce7",color:"#15803d",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99}}>🌐 Общедоступная</span>}
                                  </div>
                                  {s.description&&<div style={{color:THEME.textLight,fontSize:12,marginBottom:6}}>{s.description}</div>}
                                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>{(s.goalKeys||(s.goalKey?[s.goalKey]:[])).map(g=><span key={g} style={{background:"rgba(212,175,55,0.12)",color:"#92680e",fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:99}}>{REG_GOALS[g]||g}</span>)}</div>
                                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6,flexWrap:"wrap"}}>
                                    <span style={{fontSize:12,color:THEME.textLight}}>{questions.filter(q=>q.sectionId===s.id).length} вопросов</span>
                                    <span style={{fontSize:12,color:"#4338ca"}}>· {topics.filter(t=>t.sectionId===s.id).length} тем</span>
                                  </div>
                                </div>
                                <div style={{display:"flex",gap:4,marginLeft:8,flexShrink:0}}>
                                  <button onClick={()=>setExpandedSec(expandedSec===s.id?null:s.id)} style={{background:expandedSec===s.id?THEME.primary:"transparent",border:`1px solid ${THEME.primary}`,color:expandedSec===s.id?"#fff":THEME.primary,cursor:"pointer",fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:6}}>📌 Темы</button>
                                  <button onClick={()=>openEditSection(s)} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:13,padding:"4px 10px",borderRadius:6}}>✏️</button>
                                  <button onClick={()=>delSectionQuestions(s.id,s.name)} style={{background:"transparent",border:`1px solid #fca5a5`,color:"#ef4444",cursor:"pointer",fontSize:11,fontWeight:700,padding:"4px 8px",borderRadius:6}} title="Удалить все вопросы раздела">🗑 вопросы</button>
                                  <button onClick={()=>delSection(s.id)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}}>×</button>
                                </div>
                              </div>
                              {/* ── Topics panel ── */}
                              {expandedSec===s.id&&(
                                <div style={{marginTop:12,paddingTop:12,borderTop:`1px dashed ${THEME.border}`}}>
                                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                                    <span style={{fontSize:12,fontWeight:700,color:"#4338ca"}}>📌 Темы раздела</span>
                                    <button type="button" onClick={()=>openAddTopic(s.id)} style={{background:"#4338ca",color:"#fff",border:"none",borderRadius:6,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Тема</button>
                                  </div>
                                  {/* Topic form */}
                                  {showTopicForm===s.id&&(
                                    <form onSubmit={saveTopic} style={{background:"#f8fafc",border:`1px solid ${THEME.border}`,borderRadius:10,padding:"12px",marginBottom:10}}>
                                      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"end"}}>
                                        <div>
                                          <input type="text" className="input-field" style={{marginBottom:6,fontSize:13}} value={topicForm.name} onChange={e=>setTopicForm(p=>({...p,name:e.target.value}))} placeholder="Название темы *" required autoFocus/>
                                          <input type="text" className="input-field" style={{marginBottom:0,fontSize:12}} value={topicForm.description} onChange={e=>setTopicForm(p=>({...p,description:e.target.value}))} placeholder="Описание (необязательно)"/>
                                        </div>
                                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                                          <button type="submit" style={{background:"#4338ca",color:"#fff",border:"none",borderRadius:6,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{editingTopic?"💾":"+ Добавить"}</button>
                                          <button type="button" onClick={closeTopicForm} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:6,padding:"7px 12px",fontSize:12,cursor:"pointer"}}>Отмена</button>
                                        </div>
                                      </div>
                                    </form>
                                  )}
                                  {/* Topics list */}
                                  {[...topics].filter(t=>t.sectionId===s.id).sort((a,b)=>(a.order??999)-(b.order??999)).length===0
                                    ?<div style={{color:THEME.textLight,fontSize:12,padding:"8px 0"}}>Тем пока нет. Нажмите «+ Тема».</div>
                                    :<div style={{display:"flex",flexDirection:"column",gap:6}}>
                                      {[...topics].filter(t=>t.sectionId===s.id).sort((a,b)=>(a.order??999)-(b.order??999)).map((tp,tIdx)=>(
                                        <div key={tp.id}
                                          draggable
                                          onDragStart={()=>{topicDragRef.current={secId:s.id,fromIdx:tIdx};}}
                                          onDragOver={e=>{e.preventDefault();setTopicDragOver({secId:s.id,idx:tIdx});}}
                                          onDragLeave={()=>setTopicDragOver(null)}
                                          onDrop={e=>{e.preventDefault();if(topicDragRef.current.secId===s.id)reorderTopics(s.id,topicDragRef.current.fromIdx,tIdx);setTopicDragOver(null);}}
                                          onDragEnd={()=>setTopicDragOver(null)}
                                          style={{display:"flex",alignItems:"center",gap:8,background:"#fff",border:`1px solid ${topicDragOver?.secId===s.id&&topicDragOver?.idx===tIdx?THEME.primary:THEME.border}`,borderRadius:8,padding:"8px 10px",cursor:"grab"}}>
                                          <span style={{color:THEME.textLight,fontSize:14,flexShrink:0}}>⠿</span>
                                          <div style={{flex:1}}>
                                            <div style={{fontWeight:700,fontSize:13,color:THEME.primary}}>{tp.name}</div>
                                            {tp.description&&<div style={{fontSize:11,color:THEME.textLight,marginTop:1}}>{tp.description}</div>}
                                          </div>
                                          <button onClick={()=>{tab==="theory"?openAddTheory(s.id,tp.id):setTab("theory");openAddTheory(s.id,tp.id);}} style={{background:"rgba(99,102,241,0.1)",border:"none",color:"#4338ca",cursor:"pointer",fontSize:11,fontWeight:700,padding:"4px 8px",borderRadius:6}} title="Добавить теорию">📖 Теория</button>
                                          <button onClick={()=>openEditTopic(tp)} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:12,padding:"4px 8px",borderRadius:6}}>✏️</button>
                                          <button onClick={()=>delTopic(tp.id)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18,padding:"0 2px",lineHeight:1}}>×</button>
                                        </div>
                                      ))}
                                    </div>
                                  }
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── QUESTIONS ── */}
        {!loading&&tab==="questions"&&(
          <div>
            <div className="admin-section-header">
              <div><h2 className="admin-section-title">Вопросы для диагностики</h2><p style={{color:THEME.textLight,fontSize:14}}>Показано {filteredQ.length} из {questions.length}</p></div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button className="add-btn" style={{background:showQMatrix?"rgba(99,102,241,0.12)":"#fff",border:"1px solid #6366F1",color:"#6366F1"}} onClick={()=>{setShowQMatrix(v=>!v);setShowCsvImport(false);setShowQForm(false);}}>📊 Q-Матрица</button>
                <button className="add-btn" style={{background:showCsvImport?"rgba(212,175,55,0.12)":"#fff",border:`1px solid ${THEME.accent}`,color:THEME.accent}} onClick={()=>{setShowCsvImport(v=>!v);setShowQForm(false);setShowQMatrix(false);}} disabled={sections.length===0}>📋 Импорт CSV</button>
                <button className="add-btn" onClick={()=>{openAddQuestion();setShowCsvImport(false);setShowQMatrix(false);}} disabled={sections.length===0} title={sections.length===0?"Сначала создайте раздел":""}>+ Новый вопрос</button>
              </div>
            </div>
            {showCsvImport&&(()=>{
              const csvSec=sections.find(s=>s.id===csvSectionId);
              const csvSecTopics=[...topics].filter(t=>t.sectionId===csvSectionId).sort((a,b)=>(a.order??999)-(b.order??999));
              const csvSecSkills=allDbSkills.filter(sk=>sk.sectionId===csvSectionId);
              const csvSecDbSkills=skillsDb.filter(sk=>sk.sectionId===csvSectionId);
              const skillsText=(()=>{
                const parts=[];
                if(csvSecSkills.length>0)parts.push(...csvSecSkills.map(sk=>`Тема: ${sk.topicName||"—"}\nНавыки: ${(sk.skills||[]).join(", ")}`));
                if(csvSecDbSkills.length>0)parts.push(`Микро-навыки раздела:\n${csvSecDbSkills.map(sk=>`- ${sk.name}${sk.errorScenario?" (ошибка: "+sk.errorScenario+")":""}`).join("\n")}`);
                return parts.length>0?parts.join("\n\n"):"(навыки не найдены в базе)";
              })();
              const topicsText=csvSecTopics.length>0?csvSecTopics.map((t,i)=>`${i+1}. ${t.name}`).join("\n"):"(темы не добавлены)";
              const goalLabel=csvGoal?REG_GOALS[csvGoal]||csvGoal:"(цель не выбрана)";
              const AI_PROMPT_FULL=`Ты эксперт по психометрике (CDM, Q-матрицы, тестлеты). Создай диагностические вопросы по математике для платформы AAPA Math.

=== РАЗДЕЛ: ${csvSec?csvSec.name:"(не выбран)"} ===

=== ТЕМЫ ===
${topicsText}

=== МИКРО-НАВЫКИ И ПРИЗНАКИ НЕСФОРМИРОВАННОСТИ ===
${skillsText}

=== ГЛАВНОЕ ПРАВИЛО: ИСПОЛЬЗУЙ COMPOUND КАК ОСНОВНОЙ ФОРМАТ ===
Большинство вопросов ДОЛЖНЫ быть типа compound. Одиночные mcq/generated — только если навык невозможно объединить.

Две стратегии группировки в compound — используй ОБЕ:

1. ГРУППИРОВКА ПО НАВЫКУ (один навык → все три уровня A→B→C):
   - под-вопрос A: прямое применение (базовый случай)
   - под-вопрос B: усложнённый вариант (2–3 шага)
   - под-вопрос C: нестандартная ситуация или ловушка

2. ГРУППИРОВКА ПО ОБЩЕМУ УСЛОВИЮ (несколько навыков одной темы → один тестлет):
   - одно общее условие (конкретный пример, задача)
   - каждый под-вопрос = отдельный навык, свой уровень A/B/C

Одиночных вопросов (mcq/generated) — не более 20–30%.

=== УРОВНИ СЛОЖНОСТИ ===
Каждому вопросу и каждому под-вопросу compound ОБЯЗАТЕЛЬНО присваивай уровень:
  A — базовый (вес 20%), B — средний (вес 30%), C — сложный (вес 50%)
Распределение: ~40% A, ~35% B, ~25% C

=== РАЗДЕЛИТЕЛИ (СТРОГО СОБЛЮДАЙ) ===
; — между колонками строки CSV
¦ — между частями условия задачи (варианты, пары, под-вопросы)  ← НЕ | (обычная черта)
~ — между частями под-вопроса compound
§ — между навыками

Символ ¦ (U+00A6) выбран специально — не конфликтует с |x| в математике.

=== ФОРМАТ КАЖДОЙ СТРОКИ ===
формат;тема;условие задачи;${csvGoal||"exam,gaps"};[навыки§...];уровень

=== ФОРМАТЫ УСЛОВИЯ ЗАДАЧИ ===

mcq:
  текст¦вар А¦вар Б¦вар В¦вар Г¦индекс(0-3)
  ВАЖНО: индекс правильного ответа должен РАВНОМЕРНО варьироваться: 0, 1, 2, 3 — не всегда 0!
  Примеры с разными позициями:
  mcq;Линейные уравнения;Реши: 2x+3=7¦x=2¦x=3¦x=5¦x=1¦0;${csvGoal||"exam,gaps"};Перенос слагаемых;A
  mcq;Степени;2^3=?¦6¦8¦4¦16¦1;${csvGoal||"exam,gaps"};Вычисление степени;A
  mcq;Проценты;20% от 150 = ?¦25¦35¦30¦40¦2;${csvGoal||"exam,gaps"};Нахождение процента;B

matching:
  инструкция¦лев1=прав1¦лев2=прав2¦лев3=прав3
  Пример: matching;Функции;Сопоставь¦f(x)=x^2=Квадратичная¦f(x)=x=Линейная¦f(x)=1/x=Обратная пропорц;${csvGoal||"exam,gaps"};Виды функций;B

generated:
  шаблон{a}¦переменные(a:мин:макс)¦производные(имя:формула или -)¦правильный ответ¦неверный1¦неверный2¦неверный3
  Пример: generated;Линейные уравнения;Реши: {a}*x+{b}={c}¦a:2:9,b:1:10,x:1:8¦c:a*x+b¦x¦x+1¦x-1¦a+b;${csvGoal||"exam,gaps"};Решение;A

compound (ОСНОВНОЙ формат):
  общее условие¦вопрос1~вар1~вар2~вар3~вар4~индекс~навык~A¦вопрос2~...~навык~B¦вопрос3~...~навык~C
  - разделитель между под-вопросами: ¦
  - разделитель внутри под-вопроса: ~
  - уровень (A/B/C) — последний сегмент каждого под-вопроса
  Пример: compound;Модуль числа;Реши уравнения с модулем¦|x| если x=−5?~5~−5~0~25~0~Вычисление модуля~A¦|x|=3~x=±3~x=3~x=−3~нет решений~0~Раскрытие |x|=b~B¦|x|=−2~нет решений~x=2~x=−2~x=±2~0~Случай b<0~C;${csvGoal||"exam,gaps"}

=== МАТЕМАТИКА ===
- Умножение: a*b (НЕ ab или a·b)
- Степени: x^2, x^{n+1}
- Корень: sqrt(x)
- Модуль: |x| безопасен внутри текста (делитель теперь ¦, а не |)

=== ПОЗИЦИЯ ПРАВИЛЬНОГО ОТВЕТА ===
КРИТИЧЕСКИ ВАЖНО: никогда не ставь правильный ответ всегда на одну позицию!
- Для mcq и под-вопросов compound: чередуй индексы 0, 1, 2, 3 равномерно по всему набору
- Примерное распределение по всем вопросам: ~25% индекс 0, ~25% индекс 1, ~25% индекс 2, ~25% индекс 3
- Неверные варианты размещай вперемешку с правильным — не группируй их в конце

=== ВЫВОД ===
Только CSV строки, без заголовков, без нумерации, без пустых строк, без комментариев.
Один вопрос = одна строка.`;

              return(
              <div className="admin-form-card" style={{marginBottom:24,borderLeft:`4px solid ${THEME.accent}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <div>
                    <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,margin:0,marginBottom:4}}>📋 Импорт вопросов через ИИ</h3>
                    <p style={{color:THEME.textLight,fontSize:13,margin:0}}>Выберите раздел → скопируйте промпт → вставьте ответ ИИ</p>
                  </div>
                  <button onClick={()=>{setShowCsvImport(false);setCsvText("");setCsvSectionId("");setCsvGoal("");setCsvTarget("");}} style={{background:"transparent",border:"none",fontSize:22,cursor:"pointer",color:THEME.textLight,lineHeight:1}}>×</button>
                </div>

                {/* Gemini API Key */}
                {geminiKey.trim()&&!geminiKeyEditing?(
                  <div style={{marginBottom:16,padding:'8px 14px',background:'rgba(22,163,74,0.06)',borderRadius:8,border:'1px solid rgba(22,163,74,0.25)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <span style={{fontSize:13,color:'#16a34a',fontWeight:700}}>✓ Gemini API ключ сохранён</span>
                    <button onClick={()=>{setGeminiKeyDraft('');setGeminiKeyEditing(true);}} style={{background:'none',border:'none',fontSize:12,color:'#94a3b8',cursor:'pointer',textDecoration:'underline'}}>изменить</button>
                  </div>
                ):(
                  <div style={{marginBottom:16,padding:'10px 14px',background:'rgba(99,102,241,0.05)',borderRadius:8,border:'1px solid rgba(99,102,241,0.2)'}}>
                    <label style={{fontSize:12,fontWeight:700,color:'#4338ca',display:'block',marginBottom:6}}>🤖 Gemini API ключ</label>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input type="password" className="input-field" style={{flex:1,marginBottom:0,fontSize:13}} value={geminiKeyDraft} onChange={e=>{setGeminiKeyDraft(e.target.value);setAiGenError('');}} placeholder="AIzaSy..." autoFocus/>
                      {geminiKeyEditing&&<button type="button" onClick={()=>setGeminiKeyEditing(false)} style={{background:'none',border:'1px solid #e2e8f0',borderRadius:6,padding:'5px 10px',fontSize:12,color:'#64748b',cursor:'pointer',whiteSpace:'nowrap'}}>Отмена</button>}
                      <button disabled={geminiKeySaving||!geminiKeyDraft.trim()} onClick={async()=>{const k=geminiKeyDraft.trim();setGeminiKeySaving(true);try{await setDoc(doc(db,'settings','admin'),{geminiKey:k},{merge:true});setGeminiKey(k);localStorage.setItem('eduspace_gemini_key',k);setGeminiKeyEditing(false);setGeminiKeyDraft('');}catch(e){alert('Ошибка: '+e.message);}setGeminiKeySaving(false);}} style={{background:geminiKeyDraft.trim()?'#4338ca':'#94a3b8',color:'#fff',border:'none',borderRadius:6,padding:'5px 14px',fontSize:12,fontWeight:700,cursor:geminiKeyDraft.trim()?'pointer':'not-allowed',whiteSpace:'nowrap'}}>{geminiKeySaving?'..':'💾 Сохранить'}</button>
                    </div>
                  </div>
                )}

                {/* Step 1: Select section */}
                <div style={{marginBottom:16}}>
                  <label style={{display:"block",fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Шаг 1 — Выберите раздел</label>
                  <select className="input-field" style={{marginBottom:0}} value={csvSectionId} onChange={e=>{
                    const sid=e.target.value;
                    const sec=sections.find(s=>s.id===sid);
                    setCsvSectionId(sid);
                    if(sec){
                      const gk=(sec.goalKeys||[sec.goalKey]).filter(Boolean);
                      if(gk.length>0){setCsvGoal(gk[0]);}
                      setCsvTarget(sec.specificTarget||"");
                    }
                  }}>
                    <option value="" disabled>Выберите раздел...</option>
                    {[...EXAMS_LIST,...GRADES_LIST].filter(g=>sections.some(s=>s.specificTarget===g)).map(g=>(
                      <optgroup key={g} label={g}>
                        {[...sections].filter(s=>s.specificTarget===g).sort((a,b)=>a.name.localeCompare(b.name)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {csvSectionId&&csvGoal&&<div style={{marginTop:6,fontSize:12,color:"#16a34a",fontWeight:600}}>✓ Цель: {REG_GOALS[csvGoal]||csvGoal} · Класс/Экзамен: {csvTarget}</div>}
                  {csvSectionId&&csvSecTopics.length===0&&<div style={{marginTop:6,fontSize:12,color:"#ef4444"}}>⚠️ В разделе нет тем. Сначала добавьте темы в разделе «Разделы».</div>}
                </div>

                {/* Step 2: Micro-skills CSV */}
                {csvSectionId&&(
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <label style={{fontSize:12,fontWeight:700,color:"#4338ca",margin:0}}>Шаг 2 — Микро-навыки раздела ({csvSecDbSkills.length})</label>
                      {csvSecDbSkills.length>0&&<button onClick={()=>navigator.clipboard.writeText("Навык;Признак несформированности\n"+csvSecDbSkills.map(sk=>`${sk.name};${sk.errorScenario||""}`).join("\n")).then(()=>alert("Скопировано!")).catch(()=>alert("Скопируйте вручную"))} style={{background:"#4338ca",color:"#fff",border:"none",borderRadius:6,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>📋 Копировать</button>}
                    </div>
                    {csvSecDbSkills.length===0
                      ?<div style={{fontSize:12,color:"#b45309",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:6,padding:"8px 12px"}}>⚠️ Микро-навыки не найдены. Добавьте их в разделе «🎯 Навыки».</div>
                      :<textarea readOnly value={"Навык;Признак несформированности\n"+csvSecDbSkills.map(sk=>`${sk.name};${sk.errorScenario||""}`).join("\n")} rows={Math.min(csvSecDbSkills.length+2,12)} style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,border:"1px solid rgba(99,102,241,0.3)",fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.6,background:"#f8fafc",color:THEME.text,resize:"vertical"}}/>
                    }
                  </div>
                )}

                {/* Step 3: Copy AI Prompt */}
                {csvSectionId&&(()=>{
                  const skillsList=csvSecDbSkills.length>0
                    ?"Навык;Признак несформированности\n"+csvSecDbSkills.map(sk=>`${sk.name};${sk.errorScenario||""}`).join("\n")
                    :"(навыки не добавлены)";
                  const topicsList=csvSecTopics.length>0?csvSecTopics.map((t,i)=>`${i+1}. ${t.name}`).join("\n"):"(темы не добавлены)";
                  const FULL_PROMPT=`Ты эксперт по психометрике. Создай диагностические вопросы по математике для раздела "${csvSec?csvSec.name:"(не выбран)"}".

=== ТЕМЫ ===
${topicsList}

=== МИКРО-НАВЫКИ И ПРИЗНАКИ НЕСФОРМИРОВАННОСТИ ===
${skillsList}

=== ЗАДАЧА ===
Создай вопросы, покрывающие ВСЕ навыки выше. Основной формат — compound (тестлет из 2–4 под-вопросов по одной теме). Одиночные mcq/generated — не более 20–30%.

=== УРОВНИ СЛОЖНОСТИ ===
A — базовый (одно действие), B — средний (2–3 шага), C — сложный (нестандарт).
Распределение: ~40% A, ~35% B, ~25% C.

=== ПОЗИЦИЯ ПРАВИЛЬНОГО ОТВЕТА ===
Чередуй "correct" равномерно: 0, 1, 2, 3 — не всегда 0!

=== ФОРМАТ ВЫВОДА: СТРОГО ВАЛИДНЫЙ JSON-массив ===
КРИТИЧЕСКИЕ ТРЕБОВАНИЯ К JSON (несоблюдение = ошибка парсинга):
- Начинай СТРОГО с символа [ и заканчивай СТРОГО символом ]
- Между каждыми двумя объектами ОБЯЗАТЕЛЬНА запятая: {...},{...}
- Никаких trailing commas: последний элемент без запятой
- Все строки в двойных кавычках, спецсимволы экранируй: \", \\, \n
- Никакого текста, пояснений или markdown до или после массива

Типы вопросов и их поля:

1. mcq — вопрос с 4 вариантами:
{"type":"mcq","topic":"...","text":"текст вопроса","options":["А","Б","В","Г"],"correct":0,"goals":["gaps","exam"],"difficulty":"A","skillNames":["Навык"]}

2. matching — сопоставление:
{"type":"matching","topic":"...","text":"инструкция","pairs":[{"left":"...","right":"..."}],"goals":["gaps","exam"],"difficulty":"B","skillNames":["Навык"]}

3. generated — задача с переменными:
{"type":"generated","topic":"...","text":"Реши: {a}*x+{b}={c}","variables":[{"name":"a","min":2,"max":9},{"name":"x","min":1,"max":8}],"derivedVars":[{"name":"c","formula":"a*x+b"}],"answerFormula":"x","wrongFormulas":["x+1","x-1","a+b"],"goals":["gaps","exam"],"difficulty":"A","skillNames":["Навык"]}

4. compound — тестлет (общее условие + 2–4 под-вопроса):
{"type":"compound","topic":"...","text":"общее условие","subQuestions":[{"text":"вопрос","options":["А","Б","В","Г"],"correct":2,"difficulty":"A","skillNames":["Навык А"]},{"text":"вопрос2","options":["А","Б","В","Г"],"correct":1,"difficulty":"B","skillNames":["Навык Б"]}],"goals":["gaps","exam"]}

Математика: умножение a*b, степени x^2, корень sqrt(x), модуль |x|.

Верни ТОЛЬКО JSON-массив. Первый символ [, последний символ ]. Никакого текста снаружи.`;
                  return(
                  <div style={{marginBottom:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
                      <label style={{fontSize:12,fontWeight:700,color:"#4338ca",margin:0}}>Шаг 3 — Промпт для ИИ</label>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <button onClick={()=>navigator.clipboard.writeText(FULL_PROMPT).then(()=>alert("Промпт скопирован!")).catch(()=>alert("Скопируйте вручную"))} style={{background:"#fff",color:"#4338ca",border:"1px solid #4338ca",borderRadius:6,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📋 Копировать</button>
                        <button onClick={()=>generateWithGemini(FULL_PROMPT,csvSec?.name,csvSectionId)} disabled={aiGenerating||csvImporting} style={{background:aiGenerating?"#94a3b8":"#4338ca",color:"#fff",border:"none",borderRadius:6,padding:"5px 16px",fontSize:12,fontWeight:700,cursor:aiGenerating?"not-allowed":"pointer"}}>
                          {aiGenerating?"⏳ Генерирую...":"🤖 Сгенерировать и добавить"}
                        </button>
                      </div>
                    </div>
                    {aiGenerating&&aiGenModel&&<div style={{marginBottom:6,fontSize:12,color:"#4338ca",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"6px 10px"}}>🔄 {aiGenModel}</div>}
                    {aiGenError&&<div style={{marginBottom:8,fontSize:12,color:aiGenerating?"#b45309":"#dc2626",background:aiGenerating?"#fffbeb":"#fef2f2",border:`1px solid ${aiGenerating?"#fcd34d":"#fca5a5"}`,borderRadius:6,padding:"6px 10px"}}>{aiGenError}</div>}
                    <textarea readOnly value={FULL_PROMPT} rows={8} style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,border:"1px solid rgba(99,102,241,0.3)",fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.6,background:"#f8fafc",color:THEME.text,resize:"vertical"}}/>
                  </div>
                  );
                })()}

                {/* Step 4: Paste CSV */}
                {csvSectionId&&(
                  <>
                    <div className="input-group">
                      <label style={{fontSize:12,fontWeight:700,color:"#4338ca",display:"block",marginBottom:6}}>Шаг 4 — Вставьте CSV от ИИ</label>
                      <textarea className="input-field" rows={10} style={{fontFamily:"'Courier New',monospace",fontSize:12}} value={csvText} onChange={e=>setCsvText(e.target.value)} placeholder={"generated;Линейные уравнения;Найди x: {a}*x + {b} = {c};a:2:9,x:1:10;c:a*x+b;x;x+1|x-1|a+b;exam,gaps\nmcq;Степени;2^3 = ?;8;6;4;16;0;exam,gaps"}/>
                    </div>
                    <div style={{display:"flex",gap:12,alignItems:"center"}}>
                      <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>{setShowCsvImport(false);setCsvText("");setCsvSectionId("");setCsvGoal("");setCsvTarget("");}}>Отмена</button>
                      <button type="button" className="cta-button active" onClick={handleCsvImport} disabled={csvImporting}>{csvImporting?"Импортирую...":"Импортировать"}</button>
                      <button onClick={downloadCsvTemplate} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:12,padding:"8px 12px",borderRadius:8}}>⬇ Шаблон CSV</button>
                      {csvText&&<span style={{fontSize:12,color:THEME.textLight}}>{csvText.split("\n").filter(l=>l.trim()&&!l.startsWith("#")).length} строк</span>}
                    </div>
                  </>
                )}
              </div>
              );
            })()}
            {/* Cascading Filters: Goal → Target → Section */}
            <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap",alignItems:"center"}}>
              <select className="input-field" style={{width:"auto",minWidth:180}} value={filterGoalQ} onChange={e=>{setFilterGoalQ(e.target.value);setFilterTargetQ("all");setFilterSec("all");}}>
                <option value="all">Все цели</option>
                {Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
              <span style={{color:THEME.textLight,fontSize:16}}>›</span>
              <select className="input-field" style={{width:"auto",minWidth:180}} value={filterTargetQ} onChange={e=>{setFilterTargetQ(e.target.value);setFilterSec("all");}}>
                <option value="all">Все классы / экзамены</option>
                {[...EXAMS_LIST,...GRADES_LIST].filter(t=>filteredTargets.includes(t)).map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{color:THEME.textLight,fontSize:16}}>›</span>
              <select className="input-field" style={{width:"auto",minWidth:200}} value={filterSec} onChange={e=>setFilterSec(e.target.value)}>
                <option value="all">Все разделы</option>
                {filteredSecOptions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {(filterGoalQ!=="all"||filterTargetQ!=="all"||filterSec!=="all")&&(
                <button onClick={()=>{setFilterGoalQ("all");setFilterTargetQ("all");setFilterSec("all");}} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:"8px 14px",fontSize:13,cursor:"pointer"}}>✕ Сбросить</button>
              )}
            </div>
            {/* ── Skill coverage indicator (shown when a single section is selected) ── */}
            {filterSec!=="all"&&(()=>{
              const secSkills=skillsDb.filter(sk=>sk.sectionId===filterSec);
              if(secSkills.length===0)return null;
              const secQuestions=questions.filter(q=>q.sectionId===filterSec);
              const coveredNames=new Set(secQuestions.flatMap(q=>[...(q.skillNames||[]),...(q.subQuestions||[]).flatMap(sq=>sq.skillNames||[])]));
              const covered=secSkills.filter(sk=>coveredNames.has(sk.name));
              const uncovered=secSkills.filter(sk=>!coveredNames.has(sk.name));
              const pct=Math.round((covered.length/secSkills.length)*100);
              const color=pct>=80?"#16a34a":pct>=50?"#d97706":"#dc2626";
              const bg=pct>=80?"rgba(22,163,74,0.07)":pct>=50?"rgba(217,119,6,0.07)":"rgba(220,38,38,0.07)";
              const border=pct>=80?"rgba(22,163,74,0.25)":pct>=50?"rgba(217,119,6,0.25)":"rgba(220,38,38,0.25)";
              return(
                <div style={{background:bg,border:`1px solid ${border}`,borderRadius:12,padding:"14px 18px",marginBottom:20}}>
                  <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:uncovered.length>0?12:0}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:THEME.text,marginBottom:6}}>
                        Покрытие навыков раздела
                        <span style={{marginLeft:10,fontSize:20,fontWeight:800,color}}>{pct}%</span>
                        <span style={{marginLeft:6,fontSize:12,fontWeight:400,color:THEME.textLight}}>({covered.length} из {secSkills.length})</span>
                      </div>
                      <div style={{height:8,background:"rgba(0,0,0,0.08)",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:4,transition:"width 0.4s"}}/>
                      </div>
                    </div>
                  </div>
                  {uncovered.length>0&&(
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:"#dc2626",marginBottom:6}}>Не покрыты ({uncovered.length}):</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {uncovered.map((sk,i)=>(
                          <span key={i} style={{fontSize:11,background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.2)",color:"#dc2626",borderRadius:20,padding:"3px 10px",lineHeight:1.4}}>{sk.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {/* ── Q-MATRIX ── */}
            {showQMatrix&&(()=>{
              // Build item rows — compound expands into sub-question rows
              const items=[];
              filteredQ.forEach((q,qi)=>{
                const qLabel=`Q${qi+1}`;
                if(q.type==="compound"&&(q.subQuestions||[]).length>0){
                  (q.subQuestions||[]).forEach((sq,si)=>{
                    items.push({label:`${qLabel}.${si+1}`,parentLabel:qLabel,parentText:q.text,itemText:sq.text,skillNames:sq.skillNames||[],topic:q.topic,type:"sub"});
                  });
                } else {
                  items.push({label:qLabel,parentLabel:null,itemText:q.text,skillNames:q.skillNames||[],topic:q.topic,type:q.type||"mcq"});
                }
              });

              // Collect all skills with frequency
              const skillFreq={};
              items.forEach(it=>(it.skillNames||[]).forEach(sk=>{ skillFreq[sk]=(skillFreq[sk]||0)+1; }));
              const allSkills=Object.keys(skillFreq).sort((a,b)=>skillFreq[b]-skillFreq[a]);
              const uncoveredItems=items.filter(it=>!(it.skillNames||[]).length).length;
              const avgCov=allSkills.length>0?(Object.values(skillFreq).reduce((s,n)=>s+n,0)/allSkills.length).toFixed(1):0;

              if(allSkills.length===0) return(
                <div className="admin-form-card" style={{marginBottom:24,textAlign:"center",padding:"40px 24px"}}>
                  <div style={{fontSize:36,marginBottom:12}}>📊</div>
                  <div style={{fontWeight:700,color:THEME.primary,marginBottom:8}}>Q-Матрица пуста</div>
                  <p style={{color:THEME.textLight,fontSize:14,maxWidth:400,margin:"0 auto"}}>
                    Ни один из отфильтрованных вопросов не содержит привязанных навыков. Добавьте навыки к вопросам или выберите конкретный раздел.
                  </p>
                </div>
              );

              const copyCSV=()=>{
                const header=["Вопрос","Тема","Тип",...allSkills].join(";");
                const rows=items.map(it=>[it.label,it.topic||"",it.type,...allSkills.map(sk=>(it.skillNames||[]).includes(sk)?"1":"0")].join(";"));
                const total=["ИТОГО","","", ...allSkills.map(sk=>skillFreq[sk])].join(";");
                navigator.clipboard?.writeText([header,...rows,total].join("\n")).then(()=>alert("Скопировано в буфер обмена")).catch(()=>alert("Не удалось скопировать"));
              };

              const TYPE_LABEL={mcq:"MCQ",multiple:"Мульти",matching:"Соотв.",generated:"Ген.",compound:"Составн.",sub:"подвоп.",open:"Откр."};

              return(
                <div className="admin-form-card" style={{marginBottom:24,padding:"24px 20px",borderLeft:"4px solid #6366F1"}}>
                  {/* Header */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,gap:16,flexWrap:"wrap"}}>
                    <div>
                      <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,margin:"0 0 6px"}}>📊 Q-Матрица навыков</h3>
                      <p style={{color:THEME.textLight,fontSize:13,margin:0}}>
                        {items.length} пунктов · {allSkills.length} навыков · среднее покрытие {avgCov}×
                        {uncoveredItems>0&&<span style={{color:"#dc2626",fontWeight:700}}> · {uncoveredItems} без навыка</span>}
                      </p>
                    </div>
                    <button onClick={copyCSV} style={{background:"#fff",border:"1px solid #6366F1",color:"#6366F1",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0}}>⬇ Копировать CSV</button>
                  </div>

                  {/* Summary skill frequency bar */}
                  <div style={{marginBottom:20,display:"flex",gap:6,flexWrap:"wrap"}}>
                    {allSkills.map(sk=>{
                      const n=skillFreq[sk];
                      const pct=Math.round((n/items.length)*100);
                      const col=n>=3?"#10B981":n===2?"#F59E0B":"#EF4444";
                      return(
                        <div key={sk} title={`${sk}: ${n} раз`} style={{display:"flex",alignItems:"center",gap:5,background:"#f8fafc",border:`1px solid ${col}44`,borderRadius:8,padding:"4px 10px",cursor:"default"}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:col,flexShrink:0}}/>
                          <span style={{fontSize:11,fontWeight:600,color:THEME.text,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sk}</span>
                          <span style={{fontSize:11,fontWeight:800,color:col}}>{n}×</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Matrix table */}
                  <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${THEME.border}`}}>
                    <table style={{borderCollapse:"collapse",fontSize:12,width:"100%",minWidth:600}}>
                      <thead>
                        <tr style={{background:"#0f172a"}}>
                          <th style={{padding:"10px 12px",textAlign:"left",color:"rgba(255,255,255,0.5)",fontWeight:600,fontSize:11,whiteSpace:"nowrap",position:"sticky",left:0,background:"#0f172a",zIndex:2,minWidth:80}}>№</th>
                          <th style={{padding:"10px 12px",textAlign:"left",color:"rgba(255,255,255,0.5)",fontWeight:600,fontSize:11,minWidth:200,maxWidth:280,position:"sticky",left:80,background:"#0f172a",zIndex:2}}>Вопрос</th>
                          <th style={{padding:"10px 8px",textAlign:"left",color:"rgba(255,255,255,0.5)",fontWeight:600,fontSize:11,whiteSpace:"nowrap",minWidth:90}}>Тема</th>
                          <th style={{padding:"10px 8px",textAlign:"center",color:"rgba(255,255,255,0.5)",fontWeight:600,fontSize:11,whiteSpace:"nowrap",minWidth:60}}>Тип</th>
                          {allSkills.map((sk,si)=>(
                            <th key={si} style={{padding:"8px 6px",textAlign:"center",color:"rgba(255,255,255,0.7)",fontWeight:600,fontSize:10,minWidth:44,maxWidth:80,writingMode:"vertical-rl",transform:"rotate(180deg)",height:100,verticalAlign:"bottom"}}>
                              <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90,display:"inline-block"}}>{sk}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it,ri)=>{
                          const isEven=ri%2===0;
                          const isSub=it.type==="sub";
                          return(
                            <tr key={ri} style={{background:isSub?"rgba(99,102,241,0.03)":isEven?"#fff":"#f8fafc",borderBottom:`1px solid ${THEME.border}`}}>
                              <td style={{padding:"8px 12px",fontFamily:"'Montserrat',sans-serif",fontWeight:700,color:isSub?"#6366F1":THEME.primary,fontSize:12,whiteSpace:"nowrap",position:"sticky",left:0,background:isSub?"rgba(99,102,241,0.05)":isEven?"#fff":"#f8fafc",zIndex:1}}>
                                {it.label}
                              </td>
                              <td style={{padding:"8px 12px",maxWidth:280,position:"sticky",left:80,background:isSub?"rgba(99,102,241,0.03)":isEven?"#fff":"#f8fafc",zIndex:1}}>
                                {isSub&&<div style={{fontSize:10,color:"#6366F1",fontWeight:700,marginBottom:2}}>↳ {it.parentLabel}: {it.parentText?.slice(0,40)}{it.parentText?.length>40?"…":""}</div>}
                                <div style={{color:THEME.text,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",lineHeight:1.4}}>{it.itemText||"—"}</div>
                              </td>
                              <td style={{padding:"8px 8px",color:THEME.textLight,fontSize:11,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:100}}>{it.topic||"—"}</td>
                              <td style={{padding:"8px 8px",textAlign:"center"}}>
                                <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:6,background:it.type==="sub"?"rgba(99,102,241,0.1)":"rgba(15,23,42,0.07)",color:it.type==="sub"?"#6366F1":THEME.textLight}}>{TYPE_LABEL[it.type]||it.type}</span>
                              </td>
                              {allSkills.map((sk,si)=>{
                                const has=(it.skillNames||[]).includes(sk);
                                return(
                                  <td key={si} style={{padding:"6px",textAlign:"center",background:has?"rgba(16,185,129,0.08)":undefined,borderLeft:`1px solid ${THEME.border}`}}>
                                    {has?<span style={{color:"#10B981",fontSize:15,fontWeight:900}}>✓</span>:<span style={{color:THEME.border,fontSize:12}}>·</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Footer: totals */}
                      <tfoot>
                        <tr style={{background:"#f1f5f9",borderTop:`2px solid ${THEME.border}`}}>
                          <td colSpan={4} style={{padding:"8px 12px",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:12,color:THEME.primary,position:"sticky",left:0,background:"#f1f5f9",zIndex:1}}>ВСЕГО ↓</td>
                          {allSkills.map((sk,si)=>{
                            const n=skillFreq[sk];
                            const col=n>=3?"#10B981":n===2?"#F59E0B":"#EF4444";
                            return(
                              <td key={si} style={{padding:"8px 6px",textAlign:"center",borderLeft:`1px solid ${THEME.border}`}}>
                                <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:13,color:col}}>{n}</div>
                              </td>
                            );
                          })}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Legend */}
                  <div style={{marginTop:14,display:"flex",gap:20,flexWrap:"wrap",fontSize:12,color:THEME.textLight}}>
                    <span><b style={{color:"#10B981"}}>✓</b> — навык оценивается</span>
                    <span><b style={{color:"#10B981"}}>3+×</b> зелёный · <b style={{color:"#F59E0B"}}>2×</b> жёлтый · <b style={{color:"#EF4444"}}>1×</b> красный</span>
                    <span>Тип <b style={{color:"#6366F1"}}>подвоп.</b> — под-вопрос составного задания</span>
                  </div>
                </div>
              );
            })()}

            {/* Add Question Form (top — only for new questions) */}
            {showQForm&&editingInlineId===null&&(
              <div className="admin-form-card">
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:20}}>Новый вопрос</h3>
                <form onSubmit={editingQuestion?saveQuestion:addQuestion}>
                  {/* Cascading: Цель → Класс/Экзамен → Раздел */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Цель *</label>
                      <select className="input-field" value={qForm.goals[0]||""} onChange={e=>{const g=e.target.value;setQForm(p=>({...p,goals:g?[g]:[],sectionId:"",sectionName:""}));}} required>
                        <option value="" disabled>Выберите цель...</option>
                        {Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Класс / Экзамен *</label>
                      <select className="input-field" value={qForm._target||""} onChange={e=>setQForm(p=>({...p,_target:e.target.value,sectionId:"",sectionName:""}))} required>
                        <option value="" disabled>Сначала выберите цель...</option>
                        {(qForm.goals[0]
                          ? [...EXAMS_LIST,...GRADES_LIST].filter(t=>sections.some(s=>(s.goalKeys||[]).includes(qForm.goals[0])&&s.specificTarget===t))
                          : []
                        ).map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Раздел *</label>
                      <select className="input-field" value={qForm.sectionId} onChange={e=>{const s=sections.find(x=>x.id===e.target.value); setQForm(p=>({...p,sectionId:e.target.value,sectionName:s?.name||""}));}} required>
                        <option value="" disabled>Сначала выберите класс...</option>
                        {[...sections].filter(s=>qForm._target&&s.specificTarget===qForm._target&&(qForm.goals[0]?(s.goalKeys||[]).includes(qForm.goals[0]):true)).sort((a,b)=>(a.order??999)-(b.order??999)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:0,marginTop:16}}>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Тип вопроса *</label>
                      <select className="input-field" value={qForm.type} onChange={e=>setQForm(p=>({...p,type:e.target.value,options:["","","",""],correct:0,correctAnswers:[],pairs:[{left:"",right:""},{left:"",right:""}]}))}>
                        {QUESTION_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Тема *</label>
                      <input type="text" className="input-field" value={qForm.topic} onChange={e=>setQForm(p=>({...p,topic:e.target.value}))} placeholder="Линейные уравнения" required/>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Уровень сложности *</label>
                      <div style={{display:"flex",gap:8,marginTop:4}}>
                        {["A","B","C"].map(lvl=>{const dc=DIFFICULTY_COLORS[lvl];return(<button key={lvl} type="button" onClick={()=>setQForm(p=>({...p,difficulty:lvl}))} style={{flex:1,padding:"8px 0",borderRadius:8,border:`2px solid ${qForm.difficulty===lvl?dc.border:"#e2e8f0"}`,background:qForm.difficulty===lvl?dc.bg:"#fff",color:qForm.difficulty===lvl?dc.color:THEME.textLight,fontWeight:qForm.difficulty===lvl?800:500,fontSize:14,cursor:"pointer",transition:"all 0.15s"}}>{lvl}</button>);})}
                      </div>
                      <div style={{fontSize:11,color:THEME.textLight,marginTop:4}}>A=20% · B=30% · C=50%</div>
                    </div>
                  </div>
                  <div className="input-group" style={{marginTop:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><label className="input-label" style={{margin:0}}>Текст вопроса *</label><label style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{qForm.image?"🖼 Сменить":"🖼 Добавить фото"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,image:src})))}/></label></div>
                    <textarea className="input-field" value={qForm.text} onChange={e=>setQForm(p=>({...p,text:e.target.value}))} rows={3} style={{resize:"vertical"}} placeholder="Введите вопрос..." required/>
                    {qForm.image&&<div style={{marginTop:8,position:"relative",display:"inline-block"}}><img src={qForm.image} alt="Q" style={{maxWidth:"100%",maxHeight:200,borderRadius:8,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,image:""}))} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:22,height:22,cursor:"pointer",fontSize:14,lineHeight:1}}>×</button></div>}
                    {!qForm.conditionChart&&<button type="button" onClick={()=>setQForm(p=>({...p,conditionChart:{type:"bar",title:"",items:[{label:"",value:""},{label:"",value:""}]}}))} style={{marginTop:8,background:"transparent",border:`1px dashed rgba(99,102,241,0.4)`,color:"#4338ca",cursor:"pointer",borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:600,display:"block"}}>📊 Добавить диаграмму в условие</button>}
                    {qForm.conditionChart&&<ChartEditor chart={qForm.conditionChart} onChange={c=>setQForm(p=>({...p,conditionChart:c}))} isGenerated={qForm.type==="generated"}/>}
                  </div>

                  {/* MCQ options */}
                  {(qForm.type==="mcq"||qForm.type==="multiple")&&(
                    <div className="input-group">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <label className="input-label" style={{margin:0}}>Варианты ответов *</label>
                        <button type="button" onClick={addOpt} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить вариант</button>
                      </div>
                      {qForm.options.map((opt,i)=>(
                        <div key={i} style={{marginBottom:10}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            {qForm.type==="mcq"
                              ? <input type="radio" name="correct" checked={qForm.correct===i} onChange={()=>setQForm(p=>({...p,correct:i}))} style={{accentColor:THEME.primary,width:18,height:18,flexShrink:0}}/>
                              : <input type="checkbox" checked={qForm.correctAnswers.includes(i)} onChange={()=>toggleCorrectAnswer(i)} style={{accentColor:THEME.primary,width:18,height:18,flexShrink:0}}/>
                            }
                            <div style={{width:28,height:28,borderRadius:6,background:qForm.type==="mcq"?(qForm.correct===i?THEME.primary:THEME.bg):(qForm.correctAnswers.includes(i)?THEME.success:THEME.bg),border:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:qForm.type==="mcq"?(qForm.correct===i?THEME.accent:THEME.textLight):(qForm.correctAnswers.includes(i)?"#fff":THEME.textLight),flexShrink:0}}>{String.fromCharCode(65+i)}</div>
                            <input type="text" className="input-field" style={{marginBottom:0,flex:1}} value={opt} onChange={e=>setQForm(p=>({...p,options:p.options.map((o,j)=>j===i?e.target.value:o)}))} placeholder={`Вариант ${String.fromCharCode(65+i)}`}/>
                            <label style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",border:"none",borderRadius:6,padding:"4px 8px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>{(qForm.optionImages||[])[i]?"🖼":"🖼+"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQOptionImage(i,e.target.files[0])}/></label>
                            {!(qForm.optionCharts||[])[i]&&<button type="button" onClick={()=>setQForm(p=>({...p,optionCharts:(p.optionCharts||[]).map((c,j)=>j===i?{type:"bar",title:"",items:[{label:"",value:""},{label:"",value:""}]}:c)}))} style={{background:"transparent",border:"none",color:"#4338ca",cursor:"pointer",fontSize:16,padding:"0 2px",flexShrink:0,title:"Добавить диаграмму"}} title="Добавить диаграмму">📊</button>}
                            {qForm.options.length>2&&<button type="button" onClick={()=>remOpt(i)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px",flexShrink:0}}>×</button>}
                          </div>
                          {(qForm.optionImages||[])[i]&&<div style={{marginTop:6,marginLeft:56,position:"relative",display:"inline-block"}}><img src={qForm.optionImages[i]} alt={`opt${i}`} style={{maxHeight:80,borderRadius:6,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>{const imgs=[...(qForm.optionImages||[])];imgs[i]="";setQForm(p=>({...p,optionImages:imgs}));}} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:18,height:18,cursor:"pointer",fontSize:12,lineHeight:1}}>×</button></div>}
                          {(qForm.optionCharts||[])[i]&&<div style={{marginLeft:36,marginTop:4}}><ChartEditor chart={(qForm.optionCharts||[])[i]} onChange={c=>setQForm(p=>({...p,optionCharts:(p.optionCharts||[]).map((x,j)=>j===i?c:x)}))}/></div>}
                        </div>
                      ))}
                      <p style={{fontSize:12,color:THEME.textLight,marginTop:4}}>{qForm.type==="mcq"?"● = правильный ответ":"☑ = правильные ответы (можно несколько)"}</p>
                    </div>
                  )}

                  {/* Matching pairs */}
                  {qForm.type==="matching"&&(
                    <div className="input-group">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <label className="input-label" style={{margin:0}}>Пары соответствия *</label>
                        <button type="button" onClick={addPair} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить пару</button>
                      </div>
                      {qForm.pairs.map((pair,i)=>(
                        <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr auto",gap:8,alignItems:"flex-start",marginBottom:10}}>
                          <div>
                            <input type="text" className="input-field" style={{marginBottom:4}} value={pair.left} onChange={e=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,left:e.target.value}:x)}))} placeholder={`Левый ${i+1}`}/>
                            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                              <label style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{pair.leftImage?"🖼":"🖼+"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,leftImage:src}:x)})))}/></label>
                              {pair.leftImage&&<div style={{position:"relative",display:"inline-block"}}><img src={pair.leftImage} alt="" style={{maxHeight:60,borderRadius:6,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,leftImage:""}:x)}))} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:16,height:16,cursor:"pointer",fontSize:11,lineHeight:1}}>×</button></div>}
                            </div>
                          </div>
                          <div style={{color:THEME.textLight,fontWeight:700,textAlign:"center",paddingTop:10}}>→</div>
                          <div>
                            <input type="text" className="input-field" style={{marginBottom:4}} value={pair.right} onChange={e=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,right:e.target.value}:x)}))} placeholder={`Правый ${i+1}`}/>
                            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                              <label style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{pair.rightImage?"🖼":"🖼+"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,rightImage:src}:x)})))}/></label>
                              {pair.rightImage&&<div style={{position:"relative",display:"inline-block"}}><img src={pair.rightImage} alt="" style={{maxHeight:60,borderRadius:6,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,rightImage:""}:x)}))} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:16,height:16,cursor:"pointer",fontSize:11,lineHeight:1}}>×</button></div>}
                            </div>
                          </div>
                          {qForm.pairs.length>2?<button type="button" onClick={()=>remPair(i)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0",paddingTop:8}}>×</button>:<div/>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Compound question fields */}
                  {qForm.type==="compound"&&(
                    <div className="input-group">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <label className="input-label" style={{margin:0}}>Под-вопросы *</label>
                        <button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:[...p.subQuestions,{text:"",image:"",options:["","","",""],optionImages:["","","",""],correct:0,skillNames:[],difficulty:"A"}]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Под-вопрос</button>
                      </div>
                      {qForm.subQuestions.map((sq,sqi)=>(
                        <div key={sqi} style={{background:"#f8fafc",borderRadius:10,border:`1px solid ${THEME.border}`,padding:"14px 16px",marginBottom:12}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontSize:12,fontWeight:700,color:THEME.textLight}}>Под-вопрос {sqi+1}</span>
                              <div style={{display:"flex",gap:4}}>{["A","B","C"].map(lvl=>{const dc=DIFFICULTY_COLORS[lvl];return(<button key={lvl} type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,difficulty:lvl}:x)}))} style={{padding:"2px 10px",borderRadius:6,border:`2px solid ${sq.difficulty===lvl?dc.border:"#e2e8f0"}`,background:sq.difficulty===lvl?dc.bg:"#fff",color:sq.difficulty===lvl?dc.color:THEME.textLight,fontWeight:sq.difficulty===lvl?800:500,fontSize:12,cursor:"pointer"}}>{lvl}</button>);})}</div>
                            </div>
                            {qForm.subQuestions.length>1&&<button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.filter((_,j)=>j!==sqi)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>}
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                            <label style={{fontSize:12,fontWeight:600,color:THEME.textLight}}>Текст под-вопроса</label>
                            <label style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{sq.image?"🖼":"🖼+"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,image:src}:x)})))}/></label>
                          </div>
                          <input type="text" className="input-field" style={{marginBottom:4}} value={sq.text} onChange={e=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,text:e.target.value}:x)}))} placeholder={`Текст под-вопроса ${sqi+1}`}/>
                          {sq.image&&<div style={{marginBottom:8,position:"relative",display:"inline-block"}}><img src={sq.image} alt="" style={{maxHeight:100,borderRadius:6,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,image:""}:x)}))} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:18,height:18,cursor:"pointer",fontSize:12,lineHeight:1}}>×</button></div>}
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {sq.options.map((opt,oi)=>(
                              <div key={oi} style={{marginBottom:2}}>
                                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                  <input type="radio" name={`sq_correct_${sqi}`} checked={sq.correct===oi} onChange={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,correct:oi}:x)}))} style={{cursor:"pointer",flexShrink:0,accentColor:THEME.primary}}/>
                                  <input type="text" className="input-field" style={{marginBottom:0,flex:1}} value={opt} onChange={e=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,options:x.options.map((o,k)=>k===oi?e.target.value:o)}:x)}))} placeholder={`Вариант ${String.fromCharCode(65+oi)}`}/>
                                  <label style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>{(sq.optionImages||[])[oi]?"🖼":"🖼+"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,optionImages:(x.optionImages||[]).map((img,k)=>k===oi?src:img)}:x)})))}/></label>
                                  {sq.options.length>2&&<button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,options:x.options.filter((_,k)=>k!==oi),optionImages:(x.optionImages||[]).filter((_,k)=>k!==oi),correct:x.correct>=oi&&x.correct>0?x.correct-1:x.correct}:x)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18,padding:"0"}}>×</button>}
                                </div>
                                {(sq.optionImages||[])[oi]&&<div style={{marginTop:4,marginLeft:28,position:"relative",display:"inline-block"}}><img src={sq.optionImages[oi]} alt="" style={{maxHeight:70,borderRadius:6,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,optionImages:(x.optionImages||[]).map((img,k)=>k===oi?"":img)}:x)}))} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:16,height:16,cursor:"pointer",fontSize:11,lineHeight:1}}>×</button></div>}
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,options:[...x.options,""],optionImages:[...(x.optionImages||[]),""]}:x)}))} style={{marginTop:8,background:"transparent",border:`1px dashed ${THEME.border}`,color:THEME.textLight,cursor:"pointer",borderRadius:6,padding:"4px 12px",fontSize:12,width:"100%"}}>+ Вариант ответа</button>
                          <div style={{marginTop:10}}>
                            <label style={{fontSize:12,fontWeight:700,color:THEME.textLight,display:"block",marginBottom:4}}>🎯 Навыки под-вопроса</label>
                            <input list={`sq_skills_list_${sqi}`} className="input-field" style={{marginBottom:4}} value={(sq.skillNames||[]).join(", ")} onChange={e=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,skillNames:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)}:x)}))} placeholder="Навыки через запятую..."/>
                            <datalist id={`sq_skills_list_${sqi}`}>{skillsDb.map(s=><option key={s.id} value={s.name}/>)}</datalist>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Generated question fields */}
                  {qForm.type==="generated"&&(
                    <>
                      <div className="input-group">
                        <div style={{padding:"12px 16px",borderRadius:10,background:"rgba(212,175,55,0.08)",border:"1px solid rgba(212,175,55,0.3)",marginBottom:16,fontSize:13,color:THEME.text,lineHeight:1.6}}>
                          <b>Как работает генерация:</b> Напишите текст вопроса с заполнителями вида <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>{"{a}"}</code>, <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>{"{b}"}</code>. Каждый раз при показе вопроса числа генерируются случайно. Формулы используют JS-синтаксис: <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>a*2+b</code>, <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>Math.round(a/b)</code>.
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <label className="input-label" style={{margin:0}}>Переменные * <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>(случайные целые числа)</span></label>
                          <button type="button" onClick={()=>setQForm(p=>({...p,variables:[...p.variables,{name:"",min:1,max:10}]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Переменная</button>
                        </div>
                        {qForm.variables.map((v,i)=>(
                          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px auto",gap:8,alignItems:"center",marginBottom:8}}>
                            <input type="text" className="input-field" style={{marginBottom:0}} value={v.name} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))} placeholder="Имя (a, b, x...)"/>
                            <input type="number" className="input-field" style={{marginBottom:0}} value={v.min} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,min:Number(e.target.value)}:x)}))} placeholder="от"/>
                            <input type="number" className="input-field" style={{marginBottom:0}} value={v.max} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,max:Number(e.target.value)}:x)}))} placeholder="до"/>
                            <button type="button" onClick={()=>setQForm(p=>({...p,variables:p.variables.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}}>×</button>
                          </div>
                        ))}
                        {!qForm.variables.length&&<div style={{color:THEME.textLight,fontSize:13,padding:"8px 0"}}>Нет переменных — нажмите «+ Переменная»</div>}
                      </div>

                      <div className="input-group">
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <label className="input-label" style={{margin:0}}>Производные переменные <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>(вычисляются по формуле)</span></label>
                          <button type="button" onClick={()=>setQForm(p=>({...p,derivedVars:[...p.derivedVars,{name:"",formula:""}]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Вычисляемая</button>
                        </div>
                        {qForm.derivedVars.map((v,i)=>(
                          <div key={i} style={{display:"grid",gridTemplateColumns:"100px 1fr auto",gap:8,alignItems:"center",marginBottom:8}}>
                            <input type="text" className="input-field" style={{marginBottom:0}} value={v.name} onChange={e=>setQForm(p=>({...p,derivedVars:p.derivedVars.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))} placeholder="Имя (c)"/>
                            <input type="text" className="input-field" style={{marginBottom:0}} value={v.formula} onChange={e=>setQForm(p=>({...p,derivedVars:p.derivedVars.map((x,j)=>j===i?{...x,formula:e.target.value}:x)}))} placeholder="Формула: gcd(a,b) или a*b"/>
                            <button type="button" onClick={()=>setQForm(p=>({...p,derivedVars:p.derivedVars.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}}>×</button>
                          </div>
                        ))}
                        {!qForm.derivedVars.length&&<div style={{color:THEME.textLight,fontSize:12,padding:"4px 0"}}>Пример: имя <code style={{background:"#f1f5f9",padding:"1px 5px",borderRadius:4}}>c</code>, формула <code style={{background:"#f1f5f9",padding:"1px 5px",borderRadius:4}}>gcd(a,b)</code> — затем используйте <code style={{background:"#f1f5f9",padding:"1px 5px",borderRadius:4}}>{"{c}"}</code> в тексте и <code style={{background:"#f1f5f9",padding:"1px 5px",borderRadius:4}}>c</code> в формулах ответов</div>}
                      </div>

                      <div className="input-group">
                        <label className="input-label">Формула правильного ответа * <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>JS-выражение</span></label>
                        <input type="text" className="input-field" value={qForm.answerFormula} onChange={e=>setQForm(p=>({...p,answerFormula:e.target.value}))} placeholder="Например: (c-b)/a"/>
                      </div>

                      <div className="input-group">
                        <label className="input-label">Формулы неверных ответов * <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>(минимум 1)</span></label>
                        {qForm.wrongFormulas.map((f,i)=>(
                          <input key={i} type="text" className="input-field" value={f} onChange={e=>setQForm(p=>({...p,wrongFormulas:p.wrongFormulas.map((x,j)=>j===i?e.target.value:x)}))} placeholder={`Неверный вариант ${i+1}: напр. a+b`}/>
                        ))}
                      </div>

                      <div className="input-group">
                        <label className="input-label">Формат отображения ответов</label>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                          {[{v:"integer",label:"Целое число",hint:"42"},{v:"decimal",label:"Десятичная дробь",hint:"0,09"},{v:"fraction",label:"Обычная дробь",hint:"1/11"},{v:"mixed",label:"Смешанное число",hint:"1 2/3"}].map(opt=>(
                            <button key={opt.v} type="button" onClick={()=>setQForm(p=>({...p,answerDisplay:{...(p.answerDisplay||{}),type:opt.v}}))}
                              style={{padding:"7px 14px",borderRadius:8,border:`2px solid ${(qForm.answerDisplay?.type||"integer")===opt.v?THEME.primary:THEME.border}`,background:(qForm.answerDisplay?.type||"integer")===opt.v?"#f1f5f9":"#fff",color:THEME.text,cursor:"pointer",fontSize:13,fontWeight:(qForm.answerDisplay?.type||"integer")===opt.v?700:400}}>
                              {opt.label} <span style={{color:THEME.textLight,fontSize:11}}>({opt.hint})</span>
                            </button>
                          ))}
                        </div>
                        {(qForm.answerDisplay?.type||"integer")==="decimal"&&(
                          <div style={{display:"flex",alignItems:"center",gap:10,marginTop:4}}>
                            <label style={{fontSize:13,color:THEME.text}}>Знаков после запятой:</label>
                            {[0,1,2,3,4].map(n=>(
                              <button key={n} type="button" onClick={()=>setQForm(p=>({...p,answerDisplay:{...p.answerDisplay,decimals:n}}))}
                                style={{width:34,height:34,borderRadius:8,border:`2px solid ${(qForm.answerDisplay?.decimals??2)===n?THEME.primary:THEME.border}`,background:(qForm.answerDisplay?.decimals??2)===n?"#f1f5f9":"#fff",cursor:"pointer",fontWeight:(qForm.answerDisplay?.decimals??2)===n?700:400,fontSize:14}}>
                                {n}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                    </>
                  )}

                  {qForm.type==="model"&&(
                    <>
                      <div className="input-group">
                        <div style={{padding:"12px 16px",borderRadius:10,background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.25)",marginBottom:16,fontSize:13,color:THEME.text,lineHeight:1.6}}>
                          <b>Как работает «Составь модель»:</b> Напишите задачу с заполнителями <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>{"{a}"}</code>, <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>{"{b}"}</code> — они заменяются случайными числами. Ответы — это <b>выражения с переменными</b> (не вычисляются). Пример: правильный ответ <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>a+b-c</code>, неверный <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>a-b+c</code>.
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                          <label className="input-label" style={{margin:0}}>Переменные * <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>(случайные целые числа)</span></label>
                          <button type="button" onClick={()=>setQForm(p=>({...p,variables:[...p.variables,{name:"",min:1,max:10}]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Переменная</button>
                        </div>
                        {qForm.variables.map((v,i)=>(
                          <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px auto",gap:8,alignItems:"center",marginBottom:8}}>
                            <input type="text" className="input-field" style={{marginBottom:0}} value={v.name} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))} placeholder="Имя (a, b, x...)"/>
                            <input type="number" className="input-field" style={{marginBottom:0}} value={v.min} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,min:Number(e.target.value)}:x)}))} placeholder="от"/>
                            <input type="number" className="input-field" style={{marginBottom:0}} value={v.max} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,max:Number(e.target.value)}:x)}))} placeholder="до"/>
                            <button type="button" onClick={()=>setQForm(p=>({...p,variables:p.variables.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}}>×</button>
                          </div>
                        ))}
                        {!qForm.variables.length&&<div style={{color:THEME.textLight,fontSize:13,padding:"8px 0"}}>Нет переменных — нажмите «+ Переменная»</div>}
                      </div>
                      <div className="input-group">
                        <label className="input-label">Правильная модель * <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>выражение с переменными (не вычисляется)</span></label>
                        <input type="text" className="input-field" value={qForm.answerFormula} onChange={e=>setQForm(p=>({...p,answerFormula:e.target.value}))} placeholder="Например: a+b-c"/>
                      </div>
                      <div className="input-group">
                        <label className="input-label">Неверные модели * <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>(минимум 1)</span></label>
                        {qForm.wrongFormulas.map((f,i)=>(
                          <input key={i} type="text" className="input-field" value={f} onChange={e=>setQForm(p=>({...p,wrongFormulas:p.wrongFormulas.map((x,j)=>j===i?e.target.value:x)}))} placeholder={`Неверный вариант ${i+1}: напр. a-b+c`}/>
                        ))}
                      </div>
                    </>
                  )}

                  <QuestionPreview qForm={qForm}/>

                  {/* Goals checkboxes */}
                  <div className="input-group">
                    <label className="input-label">Для каких целей *</label>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>
                      {Object.entries(REG_GOALS).map(([k,v])=>(
                        <label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 16px",borderRadius:8,border:`1px solid ${qForm.goals.includes(k)?THEME.primary:THEME.border}`,background:qForm.goals.includes(k)?"#f1f5f9":"#fff",fontSize:14,fontWeight:500}}>
                          <input type="checkbox" checked={qForm.goals.includes(k)} onChange={()=>toggleGoalQ(k)} style={{accentColor:THEME.primary}}/>{v}
                        </label>
                      ))}
                    </div>
                  </div>
                  {/* Skills */}
                  <div className="input-group" style={{marginBottom:16}}>
                    <label className="input-label">🎯 Навыки, которые оценивает вопрос</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                      {(qForm.skillNames||[]).map((s,i)=>(
                        <span key={i} style={{display:"flex",alignItems:"center",gap:4,background:"rgba(99,102,241,0.1)",color:"#4338ca",fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:20,border:"1px solid rgba(99,102,241,0.25)"}}>
                          {s}
                          <button type="button" onClick={()=>setQForm(p=>({...p,skillNames:p.skillNames.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:"#4338ca",cursor:"pointer",fontSize:14,padding:"0 0 0 2px",lineHeight:1}}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <input list="skills-datalist" className="input-field" style={{marginBottom:0,flex:1}} placeholder="Начните вводить навык..." onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){e.preventDefault();const v=e.target.value.trim();setQForm(p=>({...p,skillNames:[...(p.skillNames||[]),v]}));e.target.value="";}}} onBlur={e=>{if(e.target.value.trim()){const v=e.target.value.trim();setQForm(p=>({...p,skillNames:[...(p.skillNames||[]),v]}));e.target.value="";}}}/>
                      <datalist id="skills-datalist">{skillsDb.filter(sk=>!qForm.sectionId||sk.sectionId===qForm.sectionId).map(sk=><option key={sk.id} value={sk.name}/>)}</datalist>
                    </div>
                    <div style={{fontSize:11,color:THEME.textLight,marginTop:4}}>Нажмите Enter или кликните в другое поле чтобы добавить. Начните вводить — появятся подсказки из базы навыков.</div>
                  </div>

                  <div style={{display:"flex",gap:12}}>
                    <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={closeQForm}>Отмена</button>
                    <button type="submit" className="cta-button active">{editingQuestion?"Сохранить вопрос":"Добавить вопрос"}</button>
                  </div>
                </form>
              </div>
            )}
            {/* Question list */}
            {filteredQ.length===0?<div className="empty-state">{questions.length===0?"Вопросов пока нет.":"Нет вопросов по фильтрам."}</div>:(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {filteredQ.map((q,qi)=>(
                  editingInlineId===q.id?(
                    <div key={q.id} className="admin-form-card" style={{border:"2px solid #6366f1",borderRadius:16}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                        <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,margin:0}}>✏️ Редактировать вопрос #{qi+1}</h3>
                        <button type="button" onClick={closeQForm} style={{background:"transparent",border:`1px solid ${THEME.border}`,borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:13,color:THEME.textLight}}>✕ Отмена</button>
                      </div>
                      <form onSubmit={saveQuestion}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
                          <div className="input-group" style={{marginBottom:0}}><label className="input-label">Цель *</label><select className="input-field" value={qForm.goals[0]||""} onChange={e=>{const g=e.target.value;setQForm(p=>({...p,goals:g?[g]:[],sectionId:"",sectionName:""}));}} required><option value="" disabled>Выберите цель...</option>{Object.entries(REG_GOALS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
                          <div className="input-group" style={{marginBottom:0}}><label className="input-label">Класс / Экзамен *</label><select className="input-field" value={qForm._target||""} onChange={e=>setQForm(p=>({...p,_target:e.target.value,sectionId:"",sectionName:""}))} required><option value="" disabled>Сначала выберите цель...</option>{(qForm.goals[0]?[...EXAMS_LIST,...GRADES_LIST].filter(t=>sections.some(s=>(s.goalKeys||[]).includes(qForm.goals[0])&&s.specificTarget===t)):[]).map(t=><option key={t} value={t}>{t}</option>)}</select></div>
                          <div className="input-group" style={{marginBottom:0}}><label className="input-label">Раздел *</label><select className="input-field" value={qForm.sectionId} onChange={e=>{const s=sections.find(x=>x.id===e.target.value);setQForm(p=>({...p,sectionId:e.target.value,sectionName:s?.name||""}));}} required><option value="" disabled>Сначала выберите класс...</option>{[...sections].filter(s=>qForm._target&&s.specificTarget===qForm._target&&(qForm.goals[0]?(s.goalKeys||[]).includes(qForm.goals[0]):true)).sort((a,b)=>(a.order??999)-(b.order??999)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:0}}>
                          <div className="input-group" style={{marginBottom:0}}><label className="input-label">Тип вопроса *</label><select className="input-field" value={qForm.type} onChange={e=>setQForm(p=>({...p,type:e.target.value,options:["","","",""],correct:0,correctAnswers:[],pairs:[{left:"",right:"",leftImage:"",rightImage:""},{left:"",right:"",leftImage:"",rightImage:""}]}))}>  {QUESTION_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                          <div className="input-group" style={{marginBottom:0}}><label className="input-label">Тема *</label><input type="text" className="input-field" value={qForm.topic} onChange={e=>setQForm(p=>({...p,topic:e.target.value}))} placeholder="Линейные уравнения" required/></div>
                          <div className="input-group" style={{marginBottom:0}}><label className="input-label">Уровень сложности *</label><div style={{display:"flex",gap:6,marginTop:4}}>{["A","B","C"].map(lvl=>{const dc=DIFFICULTY_COLORS[lvl];return(<button key={lvl} type="button" onClick={()=>setQForm(p=>({...p,difficulty:lvl}))} style={{flex:1,padding:"7px 0",borderRadius:8,border:`2px solid ${qForm.difficulty===lvl?dc.border:"#e2e8f0"}`,background:qForm.difficulty===lvl?dc.bg:"#fff",color:qForm.difficulty===lvl?dc.color:THEME.textLight,fontWeight:qForm.difficulty===lvl?800:500,fontSize:13,cursor:"pointer"}}>{lvl}</button>);})}</div><div style={{fontSize:11,color:THEME.textLight,marginTop:2}}>A=20% · B=30% · C=50%</div></div>
                        </div>
                        <div className="input-group" style={{marginTop:16}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><label className="input-label" style={{margin:0}}>Текст вопроса *</label><label style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{qForm.image?"🖼 Сменить":"🖼 Добавить фото"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,image:src})))}/></label></div>
                          <textarea className="input-field" value={qForm.text} onChange={e=>setQForm(p=>({...p,text:e.target.value}))} rows={3} style={{resize:"vertical"}} placeholder="Введите вопрос..." required/>
                          {qForm.image&&<div style={{marginTop:8,position:"relative",display:"inline-block"}}><img src={qForm.image} alt="Q" style={{maxWidth:"100%",maxHeight:200,borderRadius:8,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,image:""}))} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:22,height:22,cursor:"pointer",fontSize:14,lineHeight:1}}>×</button></div>}
                          {!qForm.conditionChart&&<button type="button" onClick={()=>setQForm(p=>({...p,conditionChart:{type:"bar",title:"",items:[{label:"",value:""},{label:"",value:""}]}}))} style={{marginTop:6,background:"transparent",border:`1px dashed rgba(99,102,241,0.4)`,color:"#4338ca",cursor:"pointer",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:600,display:"block"}}>📊 Добавить диаграмму в условие</button>}
                          {qForm.conditionChart&&<ChartEditor chart={qForm.conditionChart} onChange={c=>setQForm(p=>({...p,conditionChart:c}))} isGenerated={qForm.type==="generated"}/>}
                        </div>
                        {(qForm.type==="mcq"||qForm.type==="multiple")&&(<div className="input-group"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><label className="input-label" style={{margin:0}}>Варианты ответов *</label><button type="button" onClick={addOpt} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить вариант</button></div>{qForm.options.map((opt,i)=>(<div key={i} style={{marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:0}}>{qForm.type==="mcq"?<input type="radio" name="correct_inline" checked={qForm.correct===i} onChange={()=>setQForm(p=>({...p,correct:i}))} style={{accentColor:THEME.primary,width:18,height:18,flexShrink:0}}/>:<input type="checkbox" checked={qForm.correctAnswers.includes(i)} onChange={()=>toggleCorrectAnswer(i)} style={{accentColor:THEME.primary,width:18,height:18,flexShrink:0}}/>}<div style={{width:28,height:28,borderRadius:6,background:qForm.type==="mcq"?(qForm.correct===i?THEME.primary:THEME.bg):(qForm.correctAnswers.includes(i)?THEME.success:THEME.bg),border:`1px solid ${THEME.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:qForm.type==="mcq"?(qForm.correct===i?THEME.accent:THEME.textLight):(qForm.correctAnswers.includes(i)?"#fff":THEME.textLight),flexShrink:0}}>{String.fromCharCode(65+i)}</div><input type="text" className="input-field" style={{marginBottom:0,flex:1}} value={opt} onChange={e=>setQForm(p=>({...p,options:p.options.map((o,j)=>j===i?e.target.value:o)}))} placeholder={`Вариант ${String.fromCharCode(65+i)}`}/>{ !(qForm.optionCharts||[])[i]&&<button type="button" onClick={()=>setQForm(p=>({...p,optionCharts:(p.optionCharts||[]).map((c,j)=>j===i?{type:"bar",title:"",items:[{label:"",value:""},{label:"",value:""}]}:c)}))} style={{background:"transparent",border:"none",color:"#4338ca",cursor:"pointer",fontSize:16,padding:"0 2px",flexShrink:0}} title="Добавить диаграмму">📊</button>}{qForm.options.length>2&&<button type="button" onClick={()=>remOpt(i)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px",flexShrink:0}}>×</button>}</div>{(qForm.optionCharts||[])[i]&&<div style={{marginLeft:56,marginTop:4}}><ChartEditor chart={(qForm.optionCharts||[])[i]} onChange={c=>setQForm(p=>({...p,optionCharts:(p.optionCharts||[]).map((x,j)=>j===i?c:x)}))}/></div>}</div>))}<p style={{fontSize:12,color:THEME.textLight,marginTop:4}}>{qForm.type==="mcq"?"● = правильный ответ":"☑ = правильные ответы (можно несколько)"}</p></div>)}
                        {qForm.type==="matching"&&(<div className="input-group"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><label className="input-label" style={{margin:0}}>Пары соответствия *</label><button type="button" onClick={addPair} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить пару</button></div>{qForm.pairs.map((pair,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr auto",gap:8,alignItems:"flex-start",marginBottom:10}}><div><input type="text" className="input-field" style={{marginBottom:4}} value={pair.left} onChange={e=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,left:e.target.value}:x)}))} placeholder={`Левый ${i+1}`}/><div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}><label style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{pair.leftImage?"🖼":"🖼+"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,leftImage:src}:x)})))}/></label>{pair.leftImage&&<div style={{position:"relative",display:"inline-block"}}><img src={pair.leftImage} alt="" style={{maxHeight:60,borderRadius:6,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,leftImage:""}:x)}))} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:16,height:16,cursor:"pointer",fontSize:11,lineHeight:1}}>×</button></div>}</div></div><div style={{color:THEME.textLight,fontWeight:700,textAlign:"center",paddingTop:10}}>→</div><div><input type="text" className="input-field" style={{marginBottom:4}} value={pair.right} onChange={e=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,right:e.target.value}:x)}))} placeholder={`Правый ${i+1}`}/><div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}><label style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{pair.rightImage?"🖼":"🖼+"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,rightImage:src}:x)})))}/></label>{pair.rightImage&&<div style={{position:"relative",display:"inline-block"}}><img src={pair.rightImage} alt="" style={{maxHeight:60,borderRadius:6,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,pairs:p.pairs.map((x,j)=>j===i?{...x,rightImage:""}:x)}))} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:16,height:16,cursor:"pointer",fontSize:11,lineHeight:1}}>×</button></div>}</div></div>{qForm.pairs.length>2?<button type="button" onClick={()=>remPair(i)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0",paddingTop:8}}>×</button>:<div/>}</div>))}</div>)}
                        {qForm.type==="generated"&&(<><div className="input-group"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><label className="input-label" style={{margin:0}}>Переменные *</label><button type="button" onClick={()=>setQForm(p=>({...p,variables:[...p.variables,{name:"",min:1,max:10}]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Переменная</button></div>{qForm.variables.map((v,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px auto",gap:8,alignItems:"center",marginBottom:8}}><input type="text" className="input-field" style={{marginBottom:0}} value={v.name} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))} placeholder="Имя (a, b...)"/><input type="number" className="input-field" style={{marginBottom:0}} value={v.min} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,min:Number(e.target.value)}:x)}))} placeholder="от"/><input type="number" className="input-field" style={{marginBottom:0}} value={v.max} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,max:Number(e.target.value)}:x)}))} placeholder="до"/><button type="button" onClick={()=>setQForm(p=>({...p,variables:p.variables.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}}>×</button></div>))}</div>
                        <div className="input-group"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><label className="input-label" style={{margin:0}}>Вычисляемые переменные <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>(по формуле из переменных выше)</span></label><button type="button" onClick={()=>setQForm(p=>({...p,derivedVars:[...(p.derivedVars||[]),{name:"",formula:""}]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Вычисляемая</button></div>{(qForm.derivedVars||[]).map((v,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"100px 1fr auto",gap:8,alignItems:"center",marginBottom:8}}><input type="text" className="input-field" style={{marginBottom:0}} value={v.name} onChange={e=>setQForm(p=>({...p,derivedVars:p.derivedVars.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))} placeholder="Имя (c)"/><input type="text" className="input-field" style={{marginBottom:0}} value={v.formula} onChange={e=>setQForm(p=>({...p,derivedVars:p.derivedVars.map((x,j)=>j===i?{...x,formula:e.target.value}:x)}))} placeholder="Формула: gcd(a,b) или a*b"/><button type="button" onClick={()=>setQForm(p=>({...p,derivedVars:p.derivedVars.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}}>×</button></div>))}{!(qForm.derivedVars||[]).length&&<div style={{color:THEME.textLight,fontSize:12,padding:"4px 0"}}>Пример: имя <code style={{background:"#f1f5f9",padding:"1px 5px",borderRadius:4}}>c</code>, формула <code style={{background:"#f1f5f9",padding:"1px 5px",borderRadius:4}}>gcd(a,b)</code> — затем используйте <code style={{background:"#f1f5f9",padding:"1px 5px",borderRadius:4}}>{"{c}"}</code> в тексте и <code style={{background:"#f1f5f9",padding:"1px 5px",borderRadius:4}}>c</code> в формулах ответов</div>}</div>
                        <div className="input-group"><label className="input-label">Формула правильного ответа *</label><input type="text" className="input-field" value={qForm.answerFormula} onChange={e=>setQForm(p=>({...p,answerFormula:e.target.value}))} placeholder="Например: (c-b)/a"/></div><div className="input-group"><label className="input-label">Формулы неверных ответов *</label>{qForm.wrongFormulas.map((wf,i)=>(<input key={i} type="text" className="input-field" value={wf} onChange={e=>setQForm(p=>({...p,wrongFormulas:p.wrongFormulas.map((x,j)=>j===i?e.target.value:x)}))} placeholder={`Неверный вариант ${i+1}`}/>))}</div>
                        <div className="input-group"><label className="input-label">Формат отображения ответов</label><div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>{[{v:"integer",label:"Целое число",hint:"42"},{v:"decimal",label:"Десятичная дробь",hint:"0,09"},{v:"fraction",label:"Обычная дробь",hint:"1/11"},{v:"mixed",label:"Смешанное число",hint:"1 2/3"}].map(opt=>(<button key={opt.v} type="button" onClick={()=>setQForm(p=>({...p,answerDisplay:{...(p.answerDisplay||{}),type:opt.v}}))} style={{padding:"7px 14px",borderRadius:8,border:`2px solid ${(qForm.answerDisplay?.type||"integer")===opt.v?THEME.primary:THEME.border}`,background:(qForm.answerDisplay?.type||"integer")===opt.v?"#f1f5f9":"#fff",color:THEME.text,cursor:"pointer",fontSize:13,fontWeight:(qForm.answerDisplay?.type||"integer")===opt.v?700:400}}>{opt.label} <span style={{color:THEME.textLight,fontSize:11}}>({opt.hint})</span></button>))}</div>{(qForm.answerDisplay?.type||"integer")==="decimal"&&(<div style={{display:"flex",alignItems:"center",gap:10,marginTop:4}}><label style={{fontSize:13,color:THEME.text}}>Знаков после запятой:</label>{[0,1,2,3,4].map(n=>(<button key={n} type="button" onClick={()=>setQForm(p=>({...p,answerDisplay:{...p.answerDisplay,decimals:n}}))} style={{width:34,height:34,borderRadius:8,border:`2px solid ${(qForm.answerDisplay?.decimals??2)===n?THEME.primary:THEME.border}`,background:(qForm.answerDisplay?.decimals??2)===n?"#f1f5f9":"#fff",cursor:"pointer",fontWeight:(qForm.answerDisplay?.decimals??2)===n?700:400,fontSize:14}}>{n}</button>))}</div>)}</div>
                        </>)}
                        {qForm.type==="model"&&(<><div className="input-group"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><label className="input-label" style={{margin:0}}>Переменные *</label><button type="button" onClick={()=>setQForm(p=>({...p,variables:[...p.variables,{name:"",min:1,max:10}]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Переменная</button></div>{qForm.variables.map((v,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px auto",gap:8,alignItems:"center",marginBottom:8}}><input type="text" className="input-field" style={{marginBottom:0}} value={v.name} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,name:e.target.value}:x)}))} placeholder="Имя (a, b...)"/><input type="number" className="input-field" style={{marginBottom:0}} value={v.min} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,min:Number(e.target.value)}:x)}))} placeholder="от"/><input type="number" className="input-field" style={{marginBottom:0}} value={v.max} onChange={e=>setQForm(p=>({...p,variables:p.variables.map((x,j)=>j===i?{...x,max:Number(e.target.value)}:x)}))} placeholder="до"/><button type="button" onClick={()=>setQForm(p=>({...p,variables:p.variables.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}}>×</button></div>))}{!qForm.variables.length&&<div style={{color:THEME.textLight,fontSize:13,padding:"8px 0"}}>Нет переменных — нажмите «+ Переменная»</div>}</div>
                        <div className="input-group"><label className="input-label">Правильная модель * <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>выражение с переменными (не вычисляется)</span></label><input type="text" className="input-field" value={qForm.answerFormula} onChange={e=>setQForm(p=>({...p,answerFormula:e.target.value}))} placeholder="Например: a+b-c"/></div>
                        <div className="input-group"><label className="input-label">Неверные модели * <span style={{color:THEME.textLight,fontWeight:400,fontSize:12}}>(минимум 1)</span></label>{qForm.wrongFormulas.map((wf,i)=>(<input key={i} type="text" className="input-field" value={wf} onChange={e=>setQForm(p=>({...p,wrongFormulas:p.wrongFormulas.map((x,j)=>j===i?e.target.value:x)}))} placeholder={`Неверный вариант ${i+1}: напр. a-b+c`}/>))}</div>
                        </>)}
                        {qForm.type==="compound"&&(
                          <div className="input-group">
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                              <label className="input-label" style={{margin:0}}>Под-вопросы *</label>
                              <button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:[...(p.subQuestions||[]),{text:"",image:"",options:["","","",""],optionImages:["","","",""],correct:0,skillNames:[],difficulty:"A"}]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Под-вопрос</button>
                            </div>
                            {(qForm.subQuestions||[]).map((sq,sqi)=>(
                              <div key={sqi} style={{background:"#f8fafc",borderRadius:10,border:`1px solid ${THEME.border}`,padding:"14px 16px",marginBottom:12}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                                    <span style={{fontSize:12,fontWeight:700,color:THEME.textLight}}>Под-вопрос {sqi+1}</span>
                                    <div style={{display:"flex",gap:3}}>{["A","B","C"].map(lvl=>{const dc=DIFFICULTY_COLORS[lvl];return(<button key={lvl} type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,difficulty:lvl}:x)}))} style={{padding:"2px 9px",borderRadius:6,border:`2px solid ${sq.difficulty===lvl?dc.border:"#e2e8f0"}`,background:sq.difficulty===lvl?dc.bg:"#fff",color:sq.difficulty===lvl?dc.color:THEME.textLight,fontWeight:sq.difficulty===lvl?800:500,fontSize:11,cursor:"pointer"}}>{lvl}</button>);})}</div>
                                    <label style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{sq.image?"🖼":"🖼+"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,image:src}:x)})))}/></label>
                                    {sq.image&&<div style={{position:"relative",display:"inline-block"}}><img src={sq.image} alt="" style={{maxHeight:50,borderRadius:6,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,image:""}:x)}))} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:16,height:16,cursor:"pointer",fontSize:11,lineHeight:1}}>×</button></div>}
                                  </div>
                                  {(qForm.subQuestions||[]).length>1&&<button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.filter((_,j)=>j!==sqi)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>}
                                </div>
                                <input type="text" className="input-field" style={{marginBottom:10}} value={sq.text} onChange={e=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,text:e.target.value}:x)}))} placeholder={`Текст под-вопроса ${sqi+1}`}/>
                                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                  {sq.options.map((opt,oi)=>(
                                    <div key={oi} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                                      <input type="radio" name={`sq_correct_inline_${sqi}`} checked={sq.correct===oi} onChange={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,correct:oi}:x)}))} style={{cursor:"pointer",flexShrink:0,accentColor:THEME.primary,marginTop:10}}/>
                                      <div style={{flex:1}}>
                                        <input type="text" className="input-field" style={{marginBottom:4}} value={opt} onChange={e=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,options:x.options.map((o,k)=>k===oi?e.target.value:o)}:x)}))} placeholder={`Вариант ${String.fromCharCode(65+oi)}`}/>
                                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                                          <label style={{background:"rgba(99,102,241,0.1)",color:"#4338ca",border:"none",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{(sq.optionImages||[])[oi]?"🖼":"🖼+"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleQImage(e.target.files[0],src=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,optionImages:(x.optionImages||[]).map((im,k)=>k===oi?src:im)}:x)})))}/></label>
                                          {(sq.optionImages||[])[oi]&&<div style={{position:"relative",display:"inline-block"}}><img src={(sq.optionImages||[])[oi]} alt="" style={{maxHeight:50,borderRadius:6,border:`1px solid ${THEME.border}`}}/><button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,optionImages:(x.optionImages||[]).map((im,k)=>k===oi?"":im)}:x)}))} style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:4,width:16,height:16,cursor:"pointer",fontSize:11,lineHeight:1}}>×</button></div>}
                                        </div>
                                      </div>
                                      {sq.options.length>2&&<button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,options:x.options.filter((_,k)=>k!==oi),optionImages:(x.optionImages||[]).filter((_,k)=>k!==oi),correct:x.correct>=oi&&x.correct>0?x.correct-1:x.correct}:x)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18,padding:"0",paddingTop:8,flexShrink:0}}>×</button>}
                                    </div>
                                  ))}
                                </div>
                                <button type="button" onClick={()=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,options:[...x.options,""],optionImages:[...(x.optionImages||[]),""],}:x)}))} style={{marginTop:8,background:"transparent",border:`1px dashed ${THEME.border}`,color:THEME.textLight,cursor:"pointer",borderRadius:6,padding:"4px 12px",fontSize:12,width:"100%"}}>+ Вариант ответа</button>
                                <div style={{marginTop:10}}>
                                  <label style={{fontSize:12,fontWeight:700,color:THEME.textLight,display:"block",marginBottom:4}}>🎯 Навыки под-вопроса</label>
                                  <input list={`sq_skills_list_inline_${sqi}`} className="input-field" style={{marginBottom:4}} value={(sq.skillNames||[]).join(", ")} onChange={e=>setQForm(p=>({...p,subQuestions:p.subQuestions.map((x,j)=>j===sqi?{...x,skillNames:e.target.value.split(",").map(s=>s.trim()).filter(Boolean)}:x)}))} placeholder="Навыки через запятую..."/>
                                  <datalist id={`sq_skills_list_inline_${sqi}`}>{skillsDb.map(s=><option key={s.id} value={s.name}/>)}</datalist>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {qForm.type==="open"&&<div style={{padding:"10px 14px",borderRadius:8,background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.2)",fontSize:13,color:THEME.textLight,marginBottom:16}}>✏️ Ученик напишет свободный ответ. Автопроверка не применяется.</div>}
                        <QuestionPreview qForm={qForm}/>
                        <div className="input-group"><label className="input-label">Для каких целей *</label><div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8}}>{Object.entries(REG_GOALS).map(([k,v])=>(<label key={k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 16px",borderRadius:8,border:`1px solid ${qForm.goals.includes(k)?THEME.primary:THEME.border}`,background:qForm.goals.includes(k)?"#f1f5f9":"#fff",fontSize:14,fontWeight:500}}><input type="checkbox" checked={qForm.goals.includes(k)} onChange={()=>toggleGoalQ(k)} style={{accentColor:THEME.primary}}/>{v}</label>))}</div></div>
                        <div style={{display:"flex",gap:12}}><button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={closeQForm}>Отмена</button><button type="submit" className="cta-button active">Сохранить вопрос</button></div>
                      </form>
                    </div>
                  ):(
                  <div key={q.id} className="admin-card">
                    <div style={{display:"flex",justifyContent:"space-between",gap:16}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
                          <span style={{background:"#e0e7ff",color:"#4338ca",fontSize:11,fontWeight:800,padding:"3px 10px",borderRadius:6,flexShrink:0}}>#{qi+1}</span>
                          <span style={{background:THEME.primary,color:THEME.accent,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6}}>{q.sectionName}</span>
                          <span className={`type-badge type-${q.type||"mcq"}`}>{QUESTION_TYPES.find(t=>t.value===q.type)?.label||"MCQ"}</span>
                          {q.difficulty&&<span style={{...DIFFICULTY_COLORS[q.difficulty]&&{background:DIFFICULTY_COLORS[q.difficulty].bg,color:DIFFICULTY_COLORS[q.difficulty].color,border:`1px solid ${DIFFICULTY_COLORS[q.difficulty].border}`},fontSize:11,fontWeight:800,padding:"3px 10px",borderRadius:6}}>Уровень {q.difficulty||"A"}</span>}
                          <span style={{background:THEME.bg,color:THEME.textLight,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6,border:`1px solid ${THEME.border}`}}>{q.topic}</span>
                          {(q.goals||[]).map(g=><span key={g} style={{background:"rgba(16,185,129,0.1)",color:"#065f46",fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:6}}>{REG_GOALS[g]||g}</span>)}
                        </div>
                        <div style={{fontWeight:600,color:THEME.primary,fontSize:15,marginBottom:10}}>{q.text}</div>
                        {(q.type==="mcq"||q.type==="multiple"||!q.type)&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>{(q.options||[]).map((o,oi)=>{const isCorr=q.type==="multiple"?(q.correctAnswers||[]).includes(oi):oi===q.correct;return<div key={oi} style={{fontSize:13,padding:"5px 10px",borderRadius:6,background:isCorr?"#ecfdf5":THEME.bg,border:`1px solid ${isCorr?THEME.success:THEME.border}`,color:isCorr?"#065f46":THEME.text,fontWeight:isCorr?700:400}}>{String.fromCharCode(65+oi)}. {o} {isCorr&&"✓"}</div>;})} </div>)}
                        {q.type==="matching"&&(<div style={{display:"flex",flexDirection:"column",gap:4}}>{(q.pairs||[]).map((p,i)=><div key={i} style={{fontSize:13,padding:"5px 10px",borderRadius:6,background:THEME.bg,border:`1px solid ${THEME.border}`}}>{p.left} → {p.right}</div>)}</div>)}
                        {q.type==="generated"&&(<div style={{fontSize:13,padding:"8px 12px",borderRadius:8,background:"rgba(212,175,55,0.06)",border:"1px solid rgba(212,175,55,0.25)"}}><div style={{fontWeight:700,color:THEME.accent,marginBottom:4}}>🎲 Генерируемый вопрос</div><div style={{color:THEME.textLight}}>Переменные: {(q.variables||[]).map(v=>`${v.name} ∈ [${v.min}, ${v.max}]`).join(", ")||"—"}</div>{(q.derivedVars||[]).length>0&&<div style={{color:THEME.textLight}}>Производные: {q.derivedVars.map(v=>`${v.name}=${v.formula}`).join(", ")}</div>}<div style={{color:THEME.textLight}}>Ответ: <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>{q.answerFormula}</code></div></div>)}
                        {q.type==="model"&&(<div style={{fontSize:13,padding:"8px 12px",borderRadius:8,background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)"}}><div style={{fontWeight:700,color:"#4338ca",marginBottom:4}}>🧮 Составь модель</div><div style={{color:THEME.textLight}}>Переменные: {(q.variables||[]).map(v=>`${v.name} ∈ [${v.min}, ${v.max}]`).join(", ")||"—"}</div><div style={{color:THEME.textLight}}>Правильная модель: <code style={{background:"rgba(0,0,0,0.06)",padding:"1px 5px",borderRadius:4}}>{q.answerFormula}</code></div></div>)}
                        {q.type==="compound"&&<div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>{(q.subQuestions||[]).map((sq,sqi)=><div key={sqi} style={{fontSize:13,padding:"8px 12px",borderRadius:8,background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.15)"}}><span style={{fontWeight:700,color:"#4338ca"}}>Вопрос {sqi+1}:</span> {sq.text} → <span style={{fontWeight:600}}>{sq.options[sq.correct]}</span> ✓</div>)}</div>}
                        {q.type==="open"&&<div style={{fontSize:13,padding:"8px 12px",borderRadius:8,background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.2)",color:THEME.textLight,marginTop:6}}>✏️ Свободный текстовый ответ (не автопроверяется)</div>}
                        {(q.skillNames||[]).length>0&&<div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><span style={{fontSize:11,color:THEME.textLight,fontWeight:600}}>🎯 Навыки:</span>{q.skillNames.map((s,i)=><span key={i} style={{background:"rgba(99,102,241,0.08)",color:"#4338ca",fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:5,border:"1px solid rgba(99,102,241,0.2)"}}>{s}</span>)}</div>}
                      </div>
                      <div style={{display:"flex",gap:4,flexShrink:0}}>
                        <button onClick={()=>openEditQuestion(q)} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:13,padding:"4px 10px",borderRadius:6}} title="Редактировать">✏️</button>
                        <button onClick={()=>delQuestion(q.id)} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}} title="Удалить">×</button>
                      </div>
                    </div>
                  </div>
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── THEORY ── */}
        {!loading&&tab==="theory"&&(
          <div>
            {/* ─── HEADER ─────────────────────────────────────────── */}
            <div className="admin-section-header" style={{marginBottom:24}}>
              <div>
                <h2 className="admin-section-title">📖 Skill Nodes — Теория + Задачи</h2>
                <p style={{color:THEME.textLight,fontSize:14}}>Хранилище: <code style={{background:'rgba(99,102,241,0.08)',padding:'1px 6px',borderRadius:4,fontSize:12}}>skillTheory</code> · {skillTheoryEntries.length} узлов сохранено</p>
              </div>
              <button onClick={()=>setStShowPrompt(v=>!v)}
                style={{background:stShowPrompt?'rgba(99,102,241,0.12)':'#fff',border:'1px solid rgba(99,102,241,0.4)',color:'#4338ca',borderRadius:8,padding:'9px 18px',fontWeight:700,fontSize:13,cursor:'pointer'}}>
                {stShowPrompt?'Скрыть промпт':'📋 Промпт для AI Studio'}
              </button>
            </div>

            {/* ─── PROMPT BOX ──────────────────────────────────────── */}
            {stShowPrompt&&(()=>{
              // Собираем pivot-навыки для выбранного класса
              const stGradeSkills=stPromptGrade?(()=>{
                const gradeNum=parseInt(stPromptGrade); // "5 класс" → 5
                const result=[];
                sections.filter(s=>s.specificTarget===stPromptGrade).forEach(sec=>{
                  const hier=skillHierarchies.find(h=>h.id===sec.id);
                  if(!hier)return;
                  (hier.clusters||[]).forEach(cl=>{
                    (cl.pivot_skills||[]).forEach(ps=>{
                      result.push({
                        skill_id:ps.skill_id,
                        skill_name:ps.skill_name,
                        vertical_line_id:cl.vertical_line_id||'',
                        grade:gradeNum,
                        included_skills:ps.impacted_skills||[],
                        description:`Ученик должен применять все навыки из included_skills в комплексе при решении задач уровня ЕНТ.`,
                        typical_error:`Механическое применение отдельных навыков без учёта их взаимодействия в составной задаче.`
                      });
                    });
                  });
                });
                return result;
              })():[];

              // Нарезаем навыки на чанки по 3
              const stChunks=[];
              for(let _ci=0;_ci<stGradeSkills.length;_ci+=3) stChunks.push(stGradeSkills.slice(_ci,_ci+3));
              const stActiveChunk=(stChunkIndex!==null&&stChunks[stChunkIndex])?stChunks[stChunkIndex]:null;

              const skillsJson=stActiveChunk?JSON.stringify(stActiveChunk,null,2):stGradeSkills.length>0?JSON.stringify(stGradeSkills,null,2):'[ /* Выберите класс выше, чтобы данные подставились автоматически */ ]';

              const PROMPT=`Role: Ты — Ведущий Методист-Разработчик EdTech-платформы AAPA. Твоя задача — создавать комплексные узлы знаний (Skill Nodes), включающие микро-теорию и диагностические задачи по математике (5-9 классы).

Входные данные:
Я передаю тебе JSON-массив объектов. Ключевые поля каждого объекта:

skill_id: ID узла.
included_skills: МАССИВ микро-навыков, входящих в узел.
description: Суть навыка.
typical_error: Частая ошибка учеников.

Твоя задача — сгенерировать JSON с двумя блоками (theory и tasks):

Блок 1. Теория (Microlearning)
Создай объект theory:

concept: Краткая выжимка (2-3 предложения) + основная формула. Тон: поддерживающий и ясный.

micro_hints: Массив подсказок. Для КАЖДОГО элемента из входящего массива included_skills напиши:
  skill_name: Название микро-навыка.
  rule: Короткое правило-инструкция (1 предложение).
  example: Иллюстрация правила (максимально просто и наглядно).

Блок 2. Задачи (Diagnostic Tasks)
Создай массив tasks (ровно 3 варианта разной сложности):

Инклюзивность: Каждая задача должна требовать применения ВСЕХ included_skills.
Дистракторы: Один из неверных ответов ОБЯЗАН быть результатом typical_error.

Математический синтаксис (КРИТИЧЕСКИ ВАЖНО):
Никаких стандартных кареток LaTeX для степеней. Все математические выражения должны использовать синтаксис JavaScript:
- Умножение строго через астериск * (например, 2 * A, а не 2A).
- Степени строго через Math.pow (например, Math.pow(x, 2), а не x^2).
- Формулы по-прежнему оборачиваются в $ (например, $2 * Math.pow(x, 2)$).
- Строгий однострочный формат: запрещены неэкранированные переносы строк внутри кавычек.

Технический формат вывода (Strict JSON):

[
  {
    "skill_id": "string",
    "vertical_line_id": "string",
    "grade": number,
    "theory": {
      "concept": "Текст + $формула$",
      "micro_hints": [
        {
          "skill_name": "Название из included_skills",
          "rule": "Правило",
          "example": "$2 * Math.pow(x, 2)$"
        }
      ]
    },
    "tasks": [
      {
        "task_id": "string",
        "type": "mcq",
        "question_text": "Условие задачи...",
        "options": ["A", "B", "C", "D"],
        "correct_index": 0,
        "explanation": "Пошаговое решение...",
        "skills_tested": ["Список примененных навыков"]
      }
    ]
  }
]

Ограничения:
Никаких приветствий и лишнего текста. На выходе должен быть только валидный JSON-массив.

Входной JSON навыков:
${skillsJson}`;

              return(
                <div style={{background:'rgba(99,102,241,0.04)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:14,padding:20,marginBottom:20}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:700,color:'#4338ca'}}>Промпт для AI Studio / Gemini</div>
                    <div style={{fontSize:11,color:THEME.textLight}}>Выберите класс и чанк ниже, затем нажмите «Скопировать промпт»</div>
                  </div>

                  {/* Выбор класса — значения должны совпадать с specificTarget в sections ("5 класс", "6 класс"…) */}
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'10px 14px',background:'rgba(99,102,241,0.07)',borderRadius:10}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#4338ca',whiteSpace:'nowrap'}}>Класс для данных:</span>
                    {['5 класс','6 класс','7 класс','8 класс','9 класс','10 класс','11 класс'].map(g=>(
                      <button key={g} onClick={()=>{setStPromptGrade(stPromptGrade===g?'':g);setStChunkIndex(null);}}
                        style={{padding:'4px 12px',borderRadius:20,border:'1px solid rgba(99,102,241,0.4)',fontWeight:700,fontSize:12,cursor:'pointer',
                          background:stPromptGrade===g?'#4338ca':'#fff',color:stPromptGrade===g?'#fff':'#4338ca'}}>
                        {g.replace(' класс','')}
                      </button>
                    ))}
                    {stGradeSkills.length>0&&(
                      <span style={{fontSize:11,color:'#6366f1',marginLeft:4}}>✓ {stGradeSkills.length} навыков</span>
                    )}
                    {stPromptGrade&&stGradeSkills.length===0&&(
                      <span style={{fontSize:11,color:'#ef4444',marginLeft:4}}>нет данных для {stPromptGrade}</span>
                    )}
                  </div>

                  {/* Блок 2: Выбор чанка */}
                  {stChunks.length>0&&(
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,padding:'10px 14px',background:'rgba(99,102,241,0.05)',borderRadius:10,flexWrap:'wrap'}}>
                      <span style={{fontSize:12,fontWeight:700,color:'#4338ca',whiteSpace:'nowrap'}}>Чанк:</span>
                      {stChunks.map((ch,ci)=>(
                        <button key={ci} onClick={()=>setStChunkIndex(stChunkIndex===ci?null:ci)}
                          style={{padding:'4px 14px',borderRadius:20,border:'1px solid rgba(99,102,241,0.5)',fontWeight:700,fontSize:12,cursor:'pointer',
                            background:stChunkIndex===ci?'#042698':'#fff',color:stChunkIndex===ci?'#fff':'#4338ca'}}>
                          Чанк {ci+1} · {ch.length} узла
                        </button>
                      ))}
                      {stChunkIndex!==null&&(
                        <span style={{fontSize:11,color:'#6366f1',marginLeft:4}}>✓ выбран чанк {stChunkIndex+1}</span>
                      )}
                    </div>
                  )}

                  {/* Блок 3: JSON чанка + кнопка копирования промпта */}
                  {stActiveChunk&&(
                    <div style={{marginBottom:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                        <span style={{fontSize:12,fontWeight:700,color:'#4338ca'}}>JSON чанка {stChunkIndex+1} ({stActiveChunk.length} навыков)</span>
                        <div style={{display:'flex',gap:8}}>
                          <button onClick={()=>navigator.clipboard.writeText(JSON.stringify(stActiveChunk,null,2)).then(()=>alert('JSON скопирован!')).catch(()=>alert('Скопируйте вручную'))}
                            style={{background:'#042698',color:'#fff',border:'none',borderRadius:7,padding:'5px 14px',fontWeight:700,fontSize:12,cursor:'pointer'}}>
                            📋 JSON
                          </button>
                          <button onClick={()=>navigator.clipboard.writeText(PROMPT).then(()=>alert('Промпт скопирован! Вставьте в AI Studio.')).catch(()=>alert('Скопируйте вручную из поля ниже'))}
                            style={{background:'#4338ca',color:'#fff',border:'none',borderRadius:7,padding:'5px 14px',fontWeight:700,fontSize:12,cursor:'pointer'}}>
                            📋 Скопировать промпт
                          </button>
                        </div>
                      </div>
                      <textarea readOnly value={JSON.stringify(stActiveChunk,null,2)} rows={8}
                        style={{width:'100%',boxSizing:'border-box',padding:'10px 14px',borderRadius:8,border:'1px solid rgba(4,38,152,0.3)',fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.6,background:'#f8f9ff',color:THEME.text,resize:'vertical'}}/>
                    </div>
                  )}

                  <details style={{marginTop:4}}>
                    <summary style={{fontSize:12,color:THEME.textLight,cursor:'pointer',fontWeight:600,marginBottom:6}}>Показать полный промпт</summary>
                    <textarea readOnly value={PROMPT} rows={18}
                      style={{width:'100%',boxSizing:'border-box',padding:'10px 14px',borderRadius:8,border:'1px solid rgba(99,102,241,0.2)',fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.6,background:'#fff',color:THEME.text,resize:'vertical'}}/>
                  </details>
                </div>
              );
            })()}

            {/* ─── IMPORT PANEL ─────────────────────────────────────── */}
            <div style={{background:'#fff',border:'1px solid rgba(99,102,241,0.3)',borderRadius:14,padding:20,marginBottom:24,borderLeft:'4px solid #6366f1'}}>
              <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:4}}>📥 Импорт JSON от AI Studio</div>
              <p style={{color:THEME.textLight,fontSize:13,margin:'0 0 14px'}}>Вставьте JSON-массив из ответа — каждый элемент сохранится в skillTheory по skill_id</p>
              <textarea value={stDraft} onChange={e=>{setStDraft(e.target.value);setStParsed(null);setStResult(null);}}
                rows={10}
                placeholder={'[\n  {\n    "skill_id": "ALG_7_01",\n    "vertical_line_id": "ALGEBRA",\n    "grade": 7,\n    "theory": { "concept": "...", "micro_hints": [...] },\n    "tasks": [...]\n  }\n]'}
                style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:10,border:`1px solid ${THEME.border}`,fontFamily:"'Courier New',monospace",fontSize:12,lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical',marginBottom:12}}/>

              {!stParsed&&(
                <button onClick={()=>{
                  try{
                    let txt=stDraft.trim();
                    // Strip markdown code fences
                    txt=txt.replace(/^```[a-z]*\n?/im,'').replace(/```\s*$/m,'').trim();
                    // Extract JSON array even if surrounded by extra text
                    const arrMatch=txt.match(/\[[\s\S]*\]/);
                    if(arrMatch)txt=arrMatch[0];

                    const fixJsonSt=s=>s
                      .replace(/[\u201C\u201D\u00AB\u00BB]/g,'"')
                      .replace(/[\u2018\u2019]/g,"'")
                      .replace(/,\s*([}\]])/g,'$1')
                      .replace(/}\s*{/g,'},{')
                      .replace(/]\s*\[/g,'],[')
                      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,'$1"$2":')
                      .replace(/:\s*'([^'\\]*(\\.[^'\\]*)*)'/g,':"$1"')
                      // Fix bare backslashes before non-JSON-escape letters (e.g. \frac → \\frac)
                      .replace(/\\([^"\\\/bfnrtu\d\s])/g,'\\\\$1');

                    const closeTruncatedSt=s=>{
                      let depth=0,inStr=false,esc=false;
                      for(const ch of s){
                        if(esc){esc=false;continue;}
                        if(ch==='\\'){esc=true;continue;}
                        if(ch==='"'){inStr=!inStr;continue;}
                        if(inStr)continue;
                        if(ch==='['||ch==='{')depth++;
                        if(ch===']'||ch==='}')depth--;
                      }
                      let fixed=s.replace(/,\s*$/,'');
                      while(depth>0){fixed+=depth%2===0?']':'}';depth--;}
                      return fixed;
                    };

                    let arr=null;
                    const attempts=[
                      ()=>JSON.parse(txt),
                      ()=>JSON.parse(fixJsonSt(txt)),
                      ()=>JSON.parse(fixJsonSt(closeTruncatedSt(txt))),
                    ];
                    let lastErr='';
                    for(const attempt of attempts){
                      try{const r=attempt();arr=r;break;}catch(e){lastErr=e.message;}
                    }
                    if(!arr)throw new Error(lastErr);
                    if(!Array.isArray(arr))throw new Error('Ожидается JSON-массив [...], а не объект');
                    const valid=arr.filter(it=>it.skill_id&&it.theory&&it.tasks);
                    if(!valid.length)throw new Error('Ни один элемент не содержит skill_id + theory + tasks');
                    setStParsed(valid);
                  }catch(e){alert('Ошибка парсинга: '+e.message);}
                }}
                  disabled={!stDraft.trim()}
                  style={{background:stDraft.trim()?'#6366f1':'#94a3b8',color:'#fff',border:'none',borderRadius:8,padding:'9px 22px',fontWeight:700,fontSize:13,cursor:stDraft.trim()?'pointer':'not-allowed'}}>
                  🔍 Разобрать JSON
                </button>
              )}

              {stParsed&&(
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'#4338ca',marginBottom:8}}>Предпросмотр — {stParsed.length} узлов:</div>
                  <div style={{border:'1px solid rgba(99,102,241,0.2)',borderRadius:10,overflow:'hidden',marginBottom:12}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr auto auto',background:'rgba(99,102,241,0.07)',padding:'7px 14px',fontSize:11,fontWeight:700,color:THEME.textLight,textTransform:'uppercase',letterSpacing:'0.5px',gap:12}}>
                      <div>skill_id</div><div>Концепт (начало)</div><div>Hints</div><div>Tasks</div>
                    </div>
                    {stParsed.map((it,i)=>(
                      <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto auto',padding:'9px 14px',fontSize:12,gap:12,borderTop:'1px solid rgba(99,102,241,0.1)',alignItems:'center'}}>
                        <code style={{fontFamily:"'Courier New',monospace",fontSize:11,color:'#4338ca',background:'rgba(99,102,241,0.07)',padding:'2px 7px',borderRadius:4}}>{it.skill_id}</code>
                        <span style={{color:THEME.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(it.theory?.concept||'—').slice(0,60)}{(it.theory?.concept||'').length>60?'…':''}</span>
                        <span style={{textAlign:'right',color:THEME.textLight}}>{(it.theory?.micro_hints||[]).length}</span>
                        <span style={{textAlign:'right',color:THEME.textLight}}>{(it.tasks||[]).length}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={async()=>{
                      setStSaving(true);
                      let saved=0;
                      for(const item of stParsed){
                        try{
                          await setDoc(doc(db,'skillTheory',item.skill_id),{...item,savedAt:new Date().toISOString()});
                          setSkillTheoryEntries(p=>{const exists=p.find(e=>e.id===item.skill_id);const upd={id:item.skill_id,...item,savedAt:new Date().toISOString()};return exists?p.map(e=>e.id===item.skill_id?upd:e):[...p,upd];});
                          saved++;
                        }catch(e){console.error(e);}
                      }
                      setStResult({saved,total:stParsed.length});
                      setStParsed(null);setStDraft('');setStSaving(false);
                    }} disabled={stSaving}
                      style={{background:stSaving?'#94a3b8':'#059669',color:'#fff',border:'none',borderRadius:8,padding:'9px 22px',fontWeight:700,fontSize:13,cursor:stSaving?'not-allowed':'pointer'}}>
                      {stSaving?'Сохраняю...':'Сохранить в Firestore'}
                    </button>
                    <button onClick={()=>{setStParsed(null);}}
                      style={{background:'transparent',border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:'9px 16px',fontSize:12,cursor:'pointer'}}>Изменить</button>
                  </div>
                </div>
              )}

              {stResult&&(
                <div style={{background:stResult.saved===stResult.total?'rgba(5,150,105,0.08)':'rgba(245,158,11,0.08)',border:`1px solid ${stResult.saved===stResult.total?'rgba(5,150,105,0.3)':'rgba(245,158,11,0.3)'}`,borderRadius:8,padding:'10px 16px',marginTop:12,fontWeight:700,fontSize:13,color:stResult.saved===stResult.total?'#059669':'#b45309'}}>
                  Сохранено: {stResult.saved} / {stResult.total} узлов
                </div>
              )}
            </div>

            {/* ─── LIBRARY ─────────────────────────────────────────── */}
            {skillTheoryEntries.length>0&&(
              <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:20,alignItems:'start'}}>
                <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,overflow:'hidden',maxHeight:700,overflowY:'auto'}}>
                  <div style={{padding:'12px 16px',borderBottom:`1px solid ${THEME.border}`,position:'sticky',top:0,background:'#fff',zIndex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:THEME.primary}}>Сохранённые узлы</div>
                    <div style={{fontSize:12,color:THEME.textLight,marginTop:2}}>{skillTheoryEntries.length} skill nodes</div>
                  </div>
                  {(()=>{
                    const byGrade={};
                    for(const e of skillTheoryEntries){const g=e.grade||'—';if(!byGrade[g])byGrade[g]=[];byGrade[g].push(e);}
                    return Object.entries(byGrade).sort(([a],[b])=>Number(a)-Number(b)).map(([grade,items])=>(
                      <div key={grade}>
                        <div style={{padding:'6px 16px',background:'#f8fafc',borderBottom:`1px solid ${THEME.border}`,fontSize:11,fontWeight:700,color:THEME.textLight,textTransform:'uppercase',letterSpacing:'0.5px'}}>{grade} класс</div>
                        {items.map(e=>{
                          const isActive=stSelectedId===e.id;
                          return(
                            <button key={e.id} onClick={()=>setStSelectedId(e.id===stSelectedId?'':e.id)}
                              style={{width:'100%',textAlign:'left',padding:'10px 16px',border:'none',borderBottom:`1px solid ${THEME.border}`,background:isActive?'rgba(99,102,241,0.08)':'#fff',cursor:'pointer',transition:'background 0.1s'}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                                <code style={{fontFamily:"'Courier New',monospace",fontSize:10,color:'#6366f1',background:'rgba(99,102,241,0.08)',padding:'1px 5px',borderRadius:3}}>{e.id}</code>
                                {e.vertical_line_id&&<span style={{fontSize:10,color:'#94a3b8'}}>{e.vertical_line_id}</span>}
                              </div>
                              <div style={{fontSize:12,fontWeight:isActive?700:500,color:THEME.text,lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{(e.theory?.concept||'—').slice(0,55)}</div>
                              <div style={{fontSize:11,color:THEME.textLight,marginTop:2}}>{(e.theory?.micro_hints||[]).length} hints · {(e.tasks||[]).length} задач</div>
                            </button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>

                {stSelectedId?(()=>{
                  const entry=skillTheoryEntries.find(e=>e.id===stSelectedId);
                  if(!entry)return null;
                  return(
                    <div style={{display:'flex',flexDirection:'column',gap:16}}>
                      <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:20}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                          <div>
                            <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>
                              <code style={{fontFamily:"'Courier New',monospace",fontSize:13,color:'#6366f1',background:'rgba(99,102,241,0.08)',padding:'3px 10px',borderRadius:5,fontWeight:700}}>{entry.id}</code>
                              {entry.vertical_line_id&&<span style={{background:'rgba(99,102,241,0.07)',color:'#4338ca',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:5}}>{entry.vertical_line_id}</span>}
                              {entry.grade&&<span style={{background:THEME.bg,color:THEME.textLight,fontSize:11,padding:'3px 9px',borderRadius:5,border:`1px solid ${THEME.border}`}}>{entry.grade} класс</span>}
                            </div>
                            {entry.savedAt&&<div style={{fontSize:11,color:THEME.textLight}}>Сохранено: {new Date(entry.savedAt).toLocaleString('ru-RU')}</div>}
                          </div>
                          <button onClick={async()=>{if(!confirm('Удалить этот Skill Node?'))return;await deleteDoc(doc(db,'skillTheory',entry.id));setSkillTheoryEntries(p=>p.filter(e=>e.id!==entry.id));setStSelectedId('');}}
                            style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:6,padding:'5px 14px',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>
                            Удалить
                          </button>
                        </div>
                      </div>

                      <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:20}}>
                        <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:14}}>Теория</div>
                        {entry.theory?.concept&&(
                          <div style={{background:'rgba(99,102,241,0.05)',borderRadius:10,padding:'12px 16px',marginBottom:14,fontSize:14,lineHeight:1.8,color:THEME.text}}>
                            <LatexText text={entry.theory.concept}/>
                          </div>
                        )}
                        {(entry.theory?.micro_hints||[]).length>0&&(
                          <div>
                            <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>Микро-подсказки</div>
                            <div style={{display:'flex',flexDirection:'column',gap:10}}>
                              {entry.theory.micro_hints.map((hint,hi)=>(
                                <div key={hi} style={{background:THEME.bg,borderRadius:10,border:`1px solid ${THEME.border}`,padding:'12px 16px'}}>
                                  <div style={{fontWeight:700,fontSize:13,color:THEME.primary,marginBottom:4}}>{hint.skill_name}</div>
                                  <div style={{fontSize:13,color:THEME.text,marginBottom:6,lineHeight:1.6}}>{hint.rule}</div>
                                  <div style={{background:'rgba(99,102,241,0.06)',borderRadius:7,padding:'6px 12px',fontSize:13,color:'#4338ca'}}>
                                    <LatexText text={hint.example}/>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {(entry.tasks||[]).length>0&&(
                        <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:20}}>
                          <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:14}}>Диагностические задачи ({entry.tasks.length})</div>
                          <div style={{display:'flex',flexDirection:'column',gap:12}}>
                            {entry.tasks.map((task,ti)=>(
                              <div key={ti} style={{background:THEME.bg,borderRadius:10,border:`1px solid ${THEME.border}`,padding:'14px 16px'}}>
                                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
                                  <span style={{background:task.type==='compound'?'rgba(220,38,38,0.1)':'rgba(99,102,241,0.1)',color:task.type==='compound'?'#dc2626':'#4338ca',fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4}}>{(task.type||'mcq').toUpperCase()}</span>
                                  <code style={{fontFamily:"'Courier New',monospace",fontSize:11,color:THEME.textLight,background:'rgba(0,0,0,0.04)',padding:'1px 6px',borderRadius:3}}>{task.task_id}</code>
                                </div>
                                <div style={{fontSize:13,color:THEME.text,lineHeight:1.7,marginBottom:10}}><LatexText text={task.question_text}/></div>
                                {task.options&&(
                                  <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:10}}>
                                    {task.options.map((opt,oi)=>(
                                      <div key={oi} style={{fontSize:12,padding:'6px 12px',borderRadius:7,background:oi===task.correct_index?'rgba(5,150,105,0.1)':'rgba(0,0,0,0.03)',color:oi===task.correct_index?'#059669':THEME.text,fontWeight:oi===task.correct_index?700:400,border:`1px solid ${oi===task.correct_index?'rgba(5,150,105,0.3)':THEME.border}`,display:'flex',alignItems:'baseline',gap:6}}>
                                        <span style={{flexShrink:0,fontWeight:700}}>{String.fromCharCode(65+oi)})</span>
                                        <LatexText text={opt}/>
                                        {oi===task.correct_index&&<span style={{marginLeft:'auto',fontSize:10,flexShrink:0,color:'#059669'}}>верно</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {task.explanation&&(
                                  <details>
                                    <summary style={{fontSize:11,color:THEME.textLight,cursor:'pointer',fontWeight:600}}>Разбор решения</summary>
                                    <div style={{fontSize:12,color:THEME.text,marginTop:8,lineHeight:1.7,paddingLeft:8}}><LatexText text={task.explanation}/></div>
                                  </details>
                                )}
                                {(task.skills_tested||[]).length>0&&(
                                  <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:8}}>
                                    {task.skills_tested.map((sk,si)=><span key={si} style={{background:'rgba(99,102,241,0.07)',color:'#4338ca',fontSize:10,padding:'2px 7px',borderRadius:4,border:'1px solid rgba(99,102,241,0.2)'}}>{sk}</span>)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })():(
                  <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:40,textAlign:'center'}}>
                    <div style={{fontSize:32,marginBottom:12}}>👈</div>
                    <div style={{fontSize:14,color:THEME.textLight}}>Выберите узел из списка слева</div>
                  </div>
                )}
              </div>
            )}
            {skillTheoryEntries.length===0&&!stResult&&(
              <div style={{textAlign:'center',padding:60,color:THEME.textLight}}>
                <div style={{fontSize:40,marginBottom:12}}>📭</div>
                <div style={{fontSize:15,fontWeight:600}}>Нет сохранённых Skill Nodes</div>
                <div style={{fontSize:13,marginTop:4}}>Вставьте JSON от AI Studio выше и нажмите Сохранить</div>
              </div>
            )}
          </div>
        )}

        {/* ── SKILLS ── */}
        {!loading&&tab==="skills"&&(()=>{
          // Compute orphan skills (in skillsDb but name not in any theory block)
          const theorySkillNames=new Set(theories.flatMap(t=>(t.blocks||[]).flatMap(b=>b.skills||[])).map(s=>s.trim().toLowerCase()));
          const filteredSkills=filterSkillSec==="all"?skillsDb:skillsDb.filter(s=>s.sectionId===filterSkillSec);
          const orphans=filteredSkills.filter(s=>!theorySkillNames.has(s.name.trim().toLowerCase()));
          return(
          <div>
            <div className="admin-section-header">
              <div><h2 className="admin-section-title">Микро-навыки</h2><p style={{color:THEME.textLight,fontSize:14}}>Всего: {skillsDb.length} навыков · {orphans.length} не упоминаются в теории</p></div>
              <div style={{display:"flex",gap:8}}>
                <button className="cta-button" style={{width:"auto",padding:"10px 20px",background:showSkillCsv?"rgba(212,175,55,0.12)":"#fff",border:`1px solid ${THEME.accent}`,color:THEME.accent}} onClick={()=>{setShowSkillCsv(v=>!v);setShowSkillForm(false);}}>📋 Импорт CSV</button>
                <button className="cta-button active" style={{width:"auto",padding:"10px 20px"}} onClick={()=>{setSkillForm({sectionId:filterSkillSec!=="all"?filterSkillSec:"",sectionName:"",grade:"",name:"",errorScenario:"",quarter:"",goalCode:"",W_exam:0,W_dep:0,A:3,W_mem:3,T_depth:3,I_score:3,T_base:60,exercises:[""],homework:[""]});setEditingSkillId(null);setShowSkillForm(true);setShowSkillCsv(false);}}>+ Добавить навык</button>
              </div>
            </div>

            {/* CSV Import */}
            {showSkillCsv&&(
              <div className="admin-form-card" style={{marginBottom:24,borderLeft:`4px solid ${THEME.accent}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,margin:0}}>📋 Импорт навыков из CSV</h3>
                  <button onClick={()=>{setShowSkillCsv(false);setSkillCsvText("");}} style={{background:"transparent",border:"none",fontSize:22,cursor:"pointer",color:THEME.textLight}}>×</button>
                </div>
                {/* Mode tabs */}
                <div style={{display:"flex",gap:0,marginBottom:14,border:`1px solid ${THEME.border}`,borderRadius:8,overflow:"hidden",width:"fit-content"}}>
                  {[{key:"grade",label:"🏫 Классы"},{key:"exam",label:"🎓 Экзамены"}].map(({key,label})=>(
                    <button key={key} type="button" onClick={()=>{setSkillCsvMode(key);setSkillCsvText("");}} style={{padding:"7px 20px",fontSize:13,fontWeight:skillCsvMode===key?700:500,background:skillCsvMode===key?THEME.primary:"#fff",color:skillCsvMode===key?"#fff":THEME.text,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                  ))}
                </div>
                {skillCsvMode==="grade"?(
                  <div style={{background:"#f8fafc",border:`1px solid ${THEME.border}`,borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:THEME.textLight,lineHeight:1.9}}>
                    <strong style={{color:THEME.text}}>Обязательные столбцы:</strong> Класс · Четверть · Код цели · Раздел · Название навыка · Признак несформированности<br/>
                    <strong style={{color:THEME.text}}>Необязательные столбцы (после признака):</strong> <span style={{color:"#4338ca",fontWeight:600}}>W_exam · W_dep · T_base · A · W · T · I</span><br/>
                    <strong style={{color:THEME.text}}>Пример без параметров:</strong><br/>
                    <code>7 класс;1;7.2.1.1;Алгебра 7: Многочлены;Вынесение общего множителя;Ученик не видит общий множитель</code><br/>
                    <strong style={{color:THEME.text}}>Пример с параметрами:</strong><br/>
                    <code>7 класс;1;7.2.1.1;Алгебра 7: Многочлены;Вынесение общего множителя;Ученик не видит общий множитель;2;1;45;4;3;2;3</code><br/>
                    <span style={{color:"#16a34a",fontWeight:600}}>✓ Раздел создаётся автоматически · Параметры опциональны — без них ставятся значения по умолчанию</span>
                  </div>
                ):(
                  <div style={{background:"#f8fafc",border:`1px solid ${THEME.border}`,borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:THEME.textLight,lineHeight:1.9}}>
                    <strong style={{color:THEME.text}}>Обязательные столбцы:</strong> Экзамен · Часть · Раздел · Название навыка · Признак несформированности<br/>
                    <strong style={{color:THEME.text}}>Необязательные столбцы (после признака):</strong> <span style={{color:"#4338ca",fontWeight:600}}>W_exam · W_dep · T_base · A · W · T · I</span><br/>
                    <strong style={{color:THEME.text}}>Доступные экзамены:</strong> {EXAMS_LIST.join(", ")}<br/>
                    <strong style={{color:THEME.text}}>Пример без параметров:</strong><br/>
                    <code>Calculus;Calculus I;Пределы и непрерывность;Вычисление предела функции;Путает предел и значение функции в точке</code><br/>
                    <strong style={{color:THEME.text}}>Пример с параметрами:</strong><br/>
                    <code>Calculus;Calculus I;Пределы и непрерывность;Вычисление предела функции;Путает предел и значение;3;2;60;4;4;3;4</code><br/>
                    <span style={{color:"#16a34a",fontWeight:600}}>✓ Раздел создаётся автоматически · Параметры опциональны — без них ставятся значения по умолчанию</span>
                  </div>
                )}
                {(()=>{
                  const PARAM_LEGEND=`
=== ПАРАМЕТРЫ (7 необязательных столбцов в конце) ===
W_exam  — экзаменационный вес (0–5): насколько часто этот навык встречается на экзамене
W_dep   — топологический вес (0–5): сколько других навыков зависит от этого
T_base  — базовое время изучения в минутах (15–120)
A       — уровень абстракции (1–5): 1=конкретные числа, 5=переменные/функции/доказательства
W       — многошаговость (1–5): 1=1-2 действия, 5=5+ взаимосвязанных шагов
T       — топологическая глубина (1–5): 1=нет пререквизитов, 5=глубокая цепочка зависимостей
I       — контринтуитивность (1–5): 1=очевидно из условия, 5=ломает бытовую логику`;

                  const SKILL_PROMPT_GRADE=`Ты эксперт по педагогике и когнитивной диагностике. Составь список микро-навыков по математике для школьной программы.

=== ЗАДАЧА ===
Для каждого класса и раздела создай список микро-навыков — конкретных умений, которые проверяются в диагностике. Каждый навык должен сопровождаться признаком несформированности и параметрами сложности.

=== ФОРМАТ CSV (разделитель ; без пробелов вокруг) ===
Класс;Четверть;Код цели обучения;Раздел;Название навыка;Признак несформированности;W_exam;W_dep;T_base;A;W;T;I
${PARAM_LEGEND}

=== ПРАВИЛА ОСНОВНЫХ ПОЛЕЙ ===
- Класс: "5 класс", "6 класс", ..., "11 класс" (с пробелом)
- Четверть: 1, 2, 3 или 4
- Код цели: по формату казахстанской программы (например 7.2.1.1) или пусто
- Раздел: "Алгебра 7: Многочлены", "Геометрия 8: Теорема Пифагора" — конкретный, не общий
- Навык: действие ("Вычислить", "Разложить", "Применить"), 3–7 слов
- Признак несформированности: конкретная ошибка ("Ученик ...", 1 предложение)

=== ТРЕБОВАНИЯ К НАВЫКАМ ===
- Каждый навык — атомарное умение (одно действие)
- Признак несформированности — конкретная ошибка, не "не знает"
- Для каждой темы — 3–6 навыков, охватывающих разные аспекты
- Параметры должны отражать реальную когнитивную нагрузку навыка

=== ПРИМЕР ===
7 класс;1;7.2.1.1;Алгебра 7: Многочлены;Вынесение общего множителя за скобку;Ученик перемножает все члены вместо вынесения;2;1;40;3;2;2;2
7 класс;1;7.2.1.2;Алгебра 7: Многочлены;Разложение методом группировки;Ученик группирует неправильно и теряет знак минус;2;2;45;4;3;3;3
8 класс;2;8.2.2.1;Алгебра 8: Квадратные уравнения;Вычисление дискриминанта;Пишет b²+4ac вместо b²−4ac;3;2;50;3;2;2;2
8 класс;2;8.2.2.2;Алгебра 8: Квадратные уравнения;Применение формулы корней;Делит только числитель на 2a;3;3;55;4;3;3;3

=== ВЫВОД ===
Только CSV строки, без заголовков, без нумерации, без пустых строк, без комментариев.`;

                  const SKILL_PROMPT_EXAM=`Ты эксперт по педагогике и международным экзаменам по математике. Составь список микро-навыков для подготовки к экзамену.

=== ЗАДАЧА ===
Для указанного экзамена и его частей создай список микро-навыков с параметрами сложности.

=== ФОРМАТ CSV (разделитель ; без пробелов вокруг) ===
Экзамен;Часть;Раздел;Название навыка;Признак несформированности;W_exam;W_dep;T_base;A;W;T;I
${PARAM_LEGEND}

=== ПОЛЯ ===
- Экзамен: точное название из списка (${EXAMS_LIST.join(", ")})
- Часть: раздел/модуль экзамена (Calculus I, Calculus II, Section A, Math No-Calc, Pure Math и т.д.)
- Раздел: тематический блок ("Пределы и непрерывность", "Производные", "Интегралы")
- Навык: конкретное умение ("Вычислить", "Применить", "Определить"), 3–7 слов
- Признак несформированности: конкретная ошибка ученика ("Ученик ...", 1 предложение)

=== ТРЕБОВАНИЯ ===
- Навык — атомарное умение, проверяемое одним заданием
- Навыки охватывают весь спецификатор экзамена
- Для каждого раздела — 3–6 навыков разной сложности
- Параметры W_exam должны быть выше для навыков, чаще встречающихся на экзамене

=== ПРИМЕР ДЛЯ CALCULUS ===
Calculus;Calculus I;Пределы и непрерывность;Вычисление предела функции в точке;Путает предел и значение функции в точке;3;2;50;4;3;3;4
Calculus;Calculus I;Пределы и непрерывность;Применение правила Лопиталя;Применяет когда предел не является неопределённостью;4;3;60;5;4;4;5
Calculus;Calculus I;Производные;Применение правила произведения;Дифференцирует как (uv)'=u'v' вместо u'v+uv';4;3;55;4;3;3;4
Calculus;Calculus II;Интегралы;Интегрирование по частям;Неправильно выбирает u и dv;4;4;65;5;4;4;5
Calculus;Calculus II;Ряды;Применение признака сходимости;Путает признак Даламбера и Коши;3;2;60;5;3;4;4

=== ПРИМЕР ДЛЯ SAT ===
SAT;Math No-Calc;Алгебра;Решение линейных уравнений;Переносит слагаемые без смены знака;5;2;30;2;2;2;2
SAT;Math No-Calc;Алгебра;Работа с неравенствами;Не меняет знак при умножении на отрицательное;4;2;35;3;2;2;3
SAT;Math Calculator;Статистика и вероятность;Интерпретация диаграмм;Путает относительную и абсолютную частоту;3;1;40;3;2;2;3

=== ВЫВОД ===
Только CSV строки, без заголовков, без нумерации, без пустых строк, без комментариев.`;

                  const prompt=skillCsvMode==="exam"?SKILL_PROMPT_EXAM:SKILL_PROMPT_GRADE;
                  return(
                    <div style={{marginBottom:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <label style={{fontSize:12,fontWeight:700,color:"#4338ca",margin:0}}>Промпт для ИИ</label>
                        <button type="button" onClick={()=>navigator.clipboard.writeText(prompt).then(()=>alert("Промпт скопирован!")).catch(()=>alert("Скопируйте вручную из поля ниже"))} style={{background:"#4338ca",color:"#fff",border:"none",borderRadius:6,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📋 Копировать промпт</button>
                      </div>
                      <textarea readOnly value={prompt} rows={6} style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,border:"1px solid rgba(99,102,241,0.3)",fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.6,background:"#f8fafc",color:THEME.text,resize:"vertical"}}/>
                    </div>
                  );
                })()}
                <textarea className="input-field" rows={10} style={{fontFamily:"'Courier New',monospace",fontSize:12}} value={skillCsvText} onChange={e=>setSkillCsvText(e.target.value)}
                  placeholder={skillCsvMode==="exam"
                    ?"# Без параметров:\nCalculus;Calculus I;Пределы;Вычисление предела;Путает предел и значение функции\n# С параметрами (W_exam;W_dep;T_base;A;W;T;I):\nCalculus;Calculus I;Производные;Правило произведения;Дифференцирует как (uv)'=u'v';4;3;55;4;3;3;4\nSAT;Math No-Calc;Алгебра;Линейные уравнения;Переносит слагаемые без смены знака;5;2;30;2;2;2;2"
                    :"# Без параметров:\n7 класс;1;7.2.1.1;Алгебра 7: Многочлены;Вынесение общего множителя;Ученик не видит общий множитель\n# С параметрами (W_exam;W_dep;T_base;A;W;T;I):\n7 класс;1;7.2.1.1;Алгебра 7: Многочлены;Вынесение общего множителя;Ученик не видит общий множитель;2;1;40;3;2;2;2\n8 класс;2;8.2.2.3;Алгебра 8: Квадратные уравнения;Вычисление дискриминанта;Путает формулу b^2-4ac;3;2;50;3;2;2;2"}/>
                <div style={{display:"flex",gap:12,marginTop:12,alignItems:"center"}}>
                  <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>{setShowSkillCsv(false);setSkillCsvText("");}}>Отмена</button>
                  <button type="button" className="cta-button active" onClick={importSkillsCsv} disabled={!skillCsvText.trim()}>Импортировать</button>
                  {skillCsvText&&<span style={{fontSize:12,color:THEME.textLight}}>{skillCsvText.split("\n").filter(l=>l.trim()&&!l.startsWith("#")).length} строк</span>}
                </div>
              </div>
            )}

            {/* Add/Edit Form */}
            {showSkillForm&&(
              <div className="admin-form-card" style={{marginBottom:24}}>
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:20}}>{editingSkillId?"Редактировать навык":"Новый навык"}</h3>
                <form onSubmit={saveSkill}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Раздел *</label>
                      <select className="input-field" value={skillForm.sectionId} onChange={e=>{const s=sections.find(x=>x.id===e.target.value);setSkillForm(p=>({...p,sectionId:e.target.value,sectionName:s?.name||"",grade:s?.specificTarget||""}));}} required>
                        <option value="" disabled>Выберите раздел...</option>
                        {[...EXAMS_LIST,...GRADES_LIST].filter(g=>sections.some(s=>s.specificTarget===g)).map(g=>(
                          <optgroup key={g} label={g}>
                            {[...sections].filter(s=>s.specificTarget===g).sort((a,b)=>a.name.localeCompare(b.name)).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Название навыка *</label>
                      <input type="text" className="input-field" value={skillForm.name} onChange={e=>setSkillForm(p=>({...p,name:e.target.value}))} placeholder="Вынесение общего множителя" required/>
                    </div>
                  </div>
                  <div className="input-group">
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Четверть</label>
                      <input type="text" className="input-field" value={skillForm.quarter||""} onChange={e=>setSkillForm(p=>({...p,quarter:e.target.value}))} placeholder="1"/>
                    </div>
                    <div className="input-group" style={{marginBottom:0}}>
                      <label className="input-label">Код цели обучения</label>
                      <input type="text" className="input-field" value={skillForm.goalCode||""} onChange={e=>setSkillForm(p=>({...p,goalCode:e.target.value}))} placeholder="7.2.1.1"/>
                    </div>
                  </div>
                    <label className="input-label">Признак несформированности <span style={{fontWeight:400,color:THEME.textLight}}>(что делает ученик с ошибкой)</span></label>
                    <textarea className="input-field" rows={2} value={skillForm.errorScenario} onChange={e=>setSkillForm(p=>({...p,errorScenario:e.target.value}))} placeholder="Ученик не видит общий множитель и раскрывает скобки неверно..." style={{resize:"vertical"}}/>
                  </div>

                  {/* Priority & Difficulty Parameters */}
                  <div style={{padding:"14px 16px",borderRadius:10,background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.2)",marginBottom:16}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#4338ca",marginBottom:12}}>📊 Параметры приоритизации и сложности</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
                      <div className="input-group" style={{marginBottom:0}}>
                        <label className="input-label">W_exam <span style={{fontWeight:400,fontSize:11}}>(экзаменационный вес)</span></label>
                        <input type="number" min={0} className="input-field" value={skillForm.W_exam} onChange={e=>setSkillForm(p=>({...p,W_exam:e.target.value}))} placeholder="0"/>
                      </div>
                      <div className="input-group" style={{marginBottom:0}}>
                        <label className="input-label">W_dep <span style={{fontWeight:400,fontSize:11}}>(топологический вес)</span></label>
                        <input type="number" min={0} className="input-field" value={skillForm.W_dep} onChange={e=>setSkillForm(p=>({...p,W_dep:e.target.value}))} placeholder="0"/>
                      </div>
                      <div className="input-group" style={{marginBottom:0}}>
                        <label className="input-label">T_base <span style={{fontWeight:400,fontSize:11}}>(базовое время, мин)</span></label>
                        <input type="number" min={1} className="input-field" value={skillForm.T_base} onChange={e=>setSkillForm(p=>({...p,T_base:e.target.value}))} placeholder="60"/>
                      </div>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:THEME.text,marginBottom:8}}>Параметры сложности (1–5):</div>
                    {[{key:"A",label:"Уровень абстракции (A)",hint:"1=числа, 5=переменные/функции"},{key:"W_mem",label:"Многошаговость (W)",hint:"1=1-2 действия, 5=5+ шагов"},{key:"T_depth",label:"Топологическая глубина (T)",hint:"1=нет пререквизитов, 5=много"},{key:"I_score",label:"Контринтуитивность (I)",hint:"1=очевидно, 5=ломает логику"}].map(({key,label,hint})=>(
                      <div key={key} style={{marginBottom:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <label style={{fontSize:12,fontWeight:600,color:THEME.text}}>{label}</label>
                          <span style={{fontSize:11,color:THEME.textLight}}>{hint}</span>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          {[1,2,3,4,5].map(v=>(
                            <button key={v} type="button" onClick={()=>setSkillForm(p=>({...p,[key]:v}))}
                              style={{flex:1,padding:"6px 0",borderRadius:8,border:`2px solid ${Number(skillForm[key])===v?"#4338ca":THEME.border}`,background:Number(skillForm[key])===v?"rgba(99,102,241,0.12)":"#fff",color:Number(skillForm[key])===v?"#4338ca":THEME.textLight,fontWeight:Number(skillForm[key])===v?800:400,fontSize:13,cursor:"pointer"}}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {(()=>{const C=computeSkillC(skillForm);const Mc=getM_c(C);return(
                      <div style={{marginTop:10,padding:"8px 12px",background:"rgba(99,102,241,0.08)",borderRadius:8,fontSize:12,display:"flex",gap:16}}>
                        <span><b>C (итог):</b> {C}/5</span>
                        <span><b>M_c:</b> {Mc}</span>
                        <span><b>P_index (база):</b> {Number(skillForm.W_exam)||0}+{Number(skillForm.W_dep)||0} = {(Number(skillForm.W_exam)||0)+(Number(skillForm.W_dep)||0)}</span>
                      </div>
                    );})()}
                  </div>

                  {/* Exercises */}
                  <div className="input-group">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <label className="input-label" style={{margin:0}}>Упражнения для занятий</label>
                      <button type="button" onClick={()=>setSkillForm(p=>({...p,exercises:[...p.exercises,""]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить</button>
                    </div>
                    {(skillForm.exercises||[""]).map((ex,i)=>(
                      <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
                        <input type="text" className="input-field" style={{marginBottom:0,flex:1}} value={ex} onChange={e=>setSkillForm(p=>({...p,exercises:p.exercises.map((x,j)=>j===i?e.target.value:x)}))} placeholder={`Упражнение ${i+1}`}/>
                        {(skillForm.exercises||[]).length>1&&<button type="button" onClick={()=>setSkillForm(p=>({...p,exercises:p.exercises.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>}
                      </div>
                    ))}
                  </div>

                  {/* Homework */}
                  <div className="input-group">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <label className="input-label" style={{margin:0}}>Домашние задания</label>
                      <button type="button" onClick={()=>setSkillForm(p=>({...p,homework:[...p.homework,""]}))} style={{background:THEME.primary,color:THEME.accent,border:"none",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Добавить</button>
                    </div>
                    {(skillForm.homework||[""]).map((hw,i)=>(
                      <div key={i} style={{display:"flex",gap:8,marginBottom:6}}>
                        <input type="text" className="input-field" style={{marginBottom:0,flex:1}} value={hw} onChange={e=>setSkillForm(p=>({...p,homework:p.homework.map((x,j)=>j===i?e.target.value:x)}))} placeholder={`ДЗ ${i+1}`}/>
                        {(skillForm.homework||[]).length>1&&<button type="button" onClick={()=>setSkillForm(p=>({...p,homework:p.homework.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18,padding:"0 4px"}}>×</button>}
                      </div>
                    ))}
                  </div>

                  <div style={{display:"flex",gap:12}}>
                    <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>{setShowSkillForm(false);setEditingSkillId(null);setSkillForm({sectionId:"",sectionName:"",grade:"",name:"",errorScenario:"",quarter:"",goalCode:"",W_exam:0,W_dep:0,A:3,W_mem:3,T_depth:3,I_score:3,T_base:60,exercises:[""],homework:[""]});}}>Отмена</button>
                    <button type="submit" className="cta-button active">{editingSkillId?"Сохранить":"Добавить навык"}</button>
                  </div>
                </form>
              </div>
            )}

            {/* Filter */}
            <div style={{display:"flex",gap:12,marginBottom:20,alignItems:"center",flexWrap:"wrap"}}>
              <select className="input-field" style={{width:"auto",minWidth:220}} value={filterSkillSec} onChange={e=>setFilterSkillSec(e.target.value)}>
                <option value="all">Все разделы</option>
                {[...EXAMS_LIST,...GRADES_LIST].filter(g=>sections.some(s=>s.specificTarget===g)).map(g=>(
                  <optgroup key={g} label={g}>
                    {[...sections].filter(s=>s.specificTarget===g).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>{const cnt=skillsDb.filter(sk=>sk.sectionId===s.id).length;return <option key={s.id} value={s.id}>{s.name}{cnt>0?` (${cnt})`:""}</option>;})}
                  </optgroup>
                ))}
              </select>
              {orphans.length>0&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"6px 12px",fontSize:12,color:"#dc2626",fontWeight:600}}>🔴 {orphans.length} навыков не упоминаются в теории</div>}
              {filterSkillSec!=="all"&&<button onClick={()=>setFilterSkillSec("all")} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer"}}>✕ Сбросить</button>}
              <button onClick={async()=>{const toDelete=filterSkillSec==="all"?skillsDb:skillsDb.filter(s=>s.sectionId===filterSkillSec);if(!toDelete.length){alert("Нет навыков для удаления.");return;}const label=filterSkillSec==="all"?"все навыки ("+toDelete.length+")":`все ${toDelete.length} навыков раздела "${sections.find(s=>s.id===filterSkillSec)?.name||filterSkillSec}"`;if(!confirm(`Удалить ${label}?`))return;try{for(const s of toDelete)await deleteDoc(doc(db,"skillsDb",s.id));setSkillsDb(p=>filterSkillSec==="all"?[]:p.filter(s=>s.sectionId!==filterSkillSec));alert(`Удалено ${toDelete.length} навыков.`);}catch(e){alert("Ошибка: "+e.message);}}} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",color:"#dc2626",borderRadius:8,padding:"7px 14px",fontSize:13,cursor:"pointer",fontWeight:600}}>🗑 Удалить все{filterSkillSec==="all"?"":" навыки раздела"}</button>
            </div>

            {/* Skills list */}
            {filteredSkills.length===0?(
              <div className="empty-state">Навыков пока нет. Добавьте навыки или импортируйте CSV.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {filteredSkills.map((sk,i)=>{
                  const isOrphan=!theorySkillNames.has(sk.name.trim().toLowerCase());
                  return(
                  <div key={sk.id} style={{background:"#fff",borderRadius:12,border:`1px solid ${isOrphan?"rgba(239,68,68,0.3)":THEME.border}`,padding:"14px 18px",display:"flex",gap:16,alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
                        <span style={{background:THEME.primary,color:THEME.accent,fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:5}}>{sk.grade||sk.sectionName}</span>
                        <span style={{fontWeight:700,color:THEME.primary,fontSize:15}}>{sk.name}</span>
                        {isOrphan&&<span style={{background:"rgba(239,68,68,0.1)",color:"#dc2626",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:5}}>не в теории</span>}
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:sk.errorScenario?4:0}}>
                        {sk.sectionName&&<span style={{fontSize:12,color:THEME.textLight}}>{sk.sectionName}</span>}
                        {sk.quarter&&<span style={{fontSize:11,color:THEME.textLight,background:"#f1f5f9",padding:"1px 7px",borderRadius:4}}>Четверть {sk.quarter}</span>}
                        {sk.goalCode&&<span style={{fontSize:11,color:"#4338ca",background:"rgba(99,102,241,0.08)",padding:"1px 7px",borderRadius:4,fontWeight:600}}>{sk.goalCode}</span>}
                      </div>
                      {sk.errorScenario&&<div style={{fontSize:13,color:THEME.textLight,background:"rgba(245,158,11,0.06)",borderRadius:6,padding:"5px 10px",borderLeft:"3px solid rgba(245,158,11,0.4)"}}>⚠️ {sk.errorScenario}</div>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>{setSkillForm({sectionId:sk.sectionId||"",sectionName:sk.sectionName||"",grade:sk.grade||"",name:sk.name,errorScenario:sk.errorScenario||"",quarter:sk.quarter||"",goalCode:sk.goalCode||"",W_exam:sk.W_exam||0,W_dep:sk.W_dep||0,A:sk.A||3,W_mem:sk.W_mem||3,T_depth:sk.T_depth||3,I_score:sk.I_score||3,T_base:sk.T_base||60,exercises:sk.exercises?.length?sk.exercises:[""],homework:sk.homework?.length?sk.homework:[""]});setEditingSkillId(sk.id);setShowSkillForm(true);setShowSkillCsv(false);}} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:13,padding:"4px 10px",borderRadius:6}}>✏️</button>
                      <button onClick={()=>delSkill(sk.id)} style={{background:"transparent",border:"1px solid rgba(239,68,68,0.3)",color:"#dc2626",cursor:"pointer",fontSize:13,padding:"4px 10px",borderRadius:6}}>🗑</button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
          );
        })()}

        {/* ── SKILL MAP ── */}
        {!loading&&tab==="skillmap"&&(()=>{
          const allGrades=[...new Set(prereqMapData.map(n=>n.grade||"").filter(Boolean))].sort();
          const filtered=skillMapFilter==="all"?prereqMapData:prereqMapData.filter(n=>(n.grade||"")=== skillMapFilter);
          return(
          <div>
            <div className="admin-section-header">
              <div>
                <h2 className="admin-section-title">Карта навыков</h2>
                <p style={{color:THEME.textLight,fontSize:14}}>Всего узлов: {prereqMapData.length} · Показано: {filtered.length}</p>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="cta-button" style={{width:"auto",padding:"10px 20px",background:showPrereqCsv?"rgba(212,175,55,0.12)":"#fff",border:`1px solid ${THEME.accent}`,color:THEME.accent}} onClick={()=>setShowPrereqCsv(v=>!v)}>📋 Импорт CSV</button>
                {prereqMapData.length>0&&<button onClick={async()=>{if(!confirm(`Удалить все ${prereqMapData.length} узлов карты?`))return;try{for(const n of prereqMapData)await deleteDoc(doc(db,"prereqMap",n.id));setPrereqMapData([]);}catch(e){alert("Ошибка: "+e.message);}}} style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",color:"#dc2626",borderRadius:8,padding:"10px 20px",fontSize:14,cursor:"pointer",fontWeight:600}}>🗑 Очистить карту</button>}
              </div>
            </div>

            {/* CSV Import */}
            {showPrereqCsv&&(
              <div className="admin-form-card" style={{marginBottom:24,borderLeft:`4px solid ${THEME.accent}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,margin:0}}>📋 Импорт пререквизитов из CSV</h3>
                  <button onClick={()=>{setShowPrereqCsv(false);setPrereqCsvText("");}} style={{background:"transparent",border:"none",fontSize:22,cursor:"pointer",color:THEME.textLight}}>×</button>
                </div>
                <div style={{background:"#f8fafc",border:`1px solid ${THEME.border}`,borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:THEME.textLight,lineHeight:1.8}}>
                  <strong style={{color:THEME.text}}>Формат:</strong> <code>Название навыка;Пререквизит 1, Пременит 2, ...</code><br/>
                  <strong style={{color:THEME.text}}>Правила:</strong> Второй столбец — список пререквизитов через запятую. Если пусто — навык корневой (без пререквизитов).<br/>
                  <strong style={{color:THEME.text}}>Пример:</strong><br/>
                  <code>Умножение натуральных чисел;</code><br/>
                  <code>Раскрытие скобок;Умножение натуральных чисел</code><br/>
                  <code>Вынесение общего множителя;Раскрытие скобок, Умножение натуральных чисел</code><br/>
                  <code>Разложение на множители;Вынесение общего множителя, Раскрытие скобок</code><br/>
                  <span style={{color:"#16a34a",fontWeight:600}}>✓ Если навык уже существует — пререквизиты обновляются. Новые — добавляются.</span>
                </div>
                <textarea className="input-field" rows={10} style={{fontFamily:"'Courier New',monospace",fontSize:12}} value={prereqCsvText} onChange={e=>setPrereqCsvText(e.target.value)}
                  placeholder={"Умножение натуральных чисел;\nРаскрытие скобок;Умножение натуральных чисел\nВынесение общего множителя;Раскрытие скобок, Умножение натуральных чисел\nРазложение на множители;Вынесение общего множителя, Раскрытие скобок"}/>
                <div style={{display:"flex",gap:12,marginTop:12,alignItems:"center"}}>
                  <button type="button" className="cta-button" style={{background:"#fff",border:`1px solid ${THEME.border}`,color:THEME.text}} onClick={()=>{setShowPrereqCsv(false);setPrereqCsvText("");}}>Отмена</button>
                  <button type="button" className="cta-button active" onClick={importPrereqCsv} disabled={!prereqCsvText.trim()}>Импортировать</button>
                  {prereqCsvText&&<span style={{fontSize:12,color:THEME.textLight}}>{prereqCsvText.split("\n").filter(l=>l.trim()&&!l.startsWith("#")).length} строк</span>}
                </div>
              </div>
            )}

            {/* Filter */}
            {allGrades.length>0&&(
              <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
                <select className="input-field" style={{width:"auto",minWidth:180}} value={skillMapFilter} onChange={e=>setSkillMapFilter(e.target.value)}>
                  <option value="all">Все ({prereqMapData.length})</option>
                  {allGrades.map(g=><option key={g} value={g}>{g} ({prereqMapData.filter(n=>(n.grade||"")===g).length})</option>)}
                </select>
              </div>
            )}

            {/* Map */}
            <SkillMapCanvas nodes={filtered}/>

            {/* Node list */}
            {filtered.length>0&&(
              <div style={{marginTop:24}}>
                <h3 style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:700,color:THEME.primary,marginBottom:12}}>Список узлов</h3>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {filtered.map(node=>(
                    <div key={node.id} style={{background:"#fff",borderRadius:10,border:`1px solid ${THEME.border}`,padding:"10px 16px",display:"flex",gap:12,alignItems:"center"}}>
                      <div style={{flex:1}}>
                        <span style={{fontWeight:700,color:THEME.primary,fontSize:14}}>{node.name}</span>
                        {node.prerequisites?.length>0&&(
                          <div style={{fontSize:12,color:THEME.textLight,marginTop:3}}>
                            Пререквизиты: {node.prerequisites.join(", ")}
                          </div>
                        )}
                        {(!node.prerequisites||!node.prerequisites.length)&&<span style={{fontSize:11,color:"#16a34a",fontWeight:600,marginLeft:8}}>Корневой</span>}
                      </div>
                      <button onClick={async()=>{if(!confirm(`Удалить «${node.name}»?`))return;try{await deleteDoc(doc(db,"prereqMap",node.id));setPrereqMapData(p=>p.filter(n=>n.id!==node.id));}catch(e){alert("Ошибка: "+e.message);}}} style={{background:"transparent",border:"1px solid rgba(239,68,68,0.3)",color:"#dc2626",cursor:"pointer",fontSize:13,padding:"4px 10px",borderRadius:6,flexShrink:0}}>🗑</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ── STUDENTS ── */}
        {!loading&&tab==="students"&&(()=>{
          const filteredStudents=students.filter(s=>{
            const matchSearch=!studentSearch||(s.firstName+" "+s.lastName).toLowerCase().includes(studentSearch.toLowerCase())||s.phone?.includes(studentSearch);
            const matchStatus=studentStatusFilter==="all"||s.status===studentStatusFilter||(studentStatusFilter==="trial"&&!s.status);
            return matchSearch&&matchStatus;
          });
          const statusCounts={all:students.length};
          STUDENT_STATUSES.forEach(st=>{ statusCounts[st.value]=students.filter(s=>s.status===st.value||(st.value==="trial"&&!s.status)).length; });
          return(
          <div>
            <div className="admin-section-header"><div><h2 className="admin-section-title">Ученики</h2><p style={{color:THEME.textLight,fontSize:14}}>Всего: {students.length}</p></div></div>
            <div style={{marginBottom:16}}>
              <input value={studentSearch} onChange={e=>setStudentSearch(e.target.value)} placeholder="🔍 Поиск по имени или телефону..." className="input-field" style={{maxWidth:380,margin:0,padding:"10px 14px",fontSize:14}}/>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
              <button onClick={()=>setStudentStatusFilter("all")} style={{padding:"6px 14px",borderRadius:20,border:"none",background:studentStatusFilter==="all"?THEME.primary:"#e2e8f0",color:studentStatusFilter==="all"?"#fff":THEME.textLight,fontWeight:700,fontSize:13,cursor:"pointer"}}>Все ({statusCounts.all})</button>
              {STUDENT_STATUSES.map(st=>(
                <button key={st.value} onClick={()=>setStudentStatusFilter(st.value)} style={{padding:"6px 14px",borderRadius:20,border:"none",background:studentStatusFilter===st.value?st.color:"#e2e8f0",color:studentStatusFilter===st.value?"#fff":THEME.textLight,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  {st.label} ({statusCounts[st.value]||0})
                </button>
              ))}
            </div>
            {filteredStudents.length===0?<div className="empty-state">Учеников не найдено.</div>:(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
                {filteredStudents.map(s=>{
                  const st=STUDENT_STATUSES.find(x=>x.value===s.status)||STUDENT_STATUSES[1];
                  const periodEnd=s.learningPeriodEnd;
                  const today=new Date().toISOString().slice(0,10);
                  const daysLeft=periodEnd?Math.ceil((new Date(periodEnd)-new Date(today))/(1000*60*60*24)):null;
                  return(
                    <div key={s.id} onClick={()=>openStudentModal(s)} style={{background:"#fff",borderRadius:14,border:`1px solid ${THEME.border}`,padding:"18px 20px",cursor:"pointer",transition:"all 0.2s",position:"relative"}}
                      onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.10)";e.currentTarget.style.borderColor=st.color;}}
                      onMouseLeave={e=>{e.currentTarget.style.boxShadow="";e.currentTarget.style.borderColor=THEME.border;}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                        <div style={{width:40,height:40,borderRadius:"50%",background:THEME.primary,color:THEME.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14,flexShrink:0}}>{s.firstName?.[0]}{s.lastName?.[0]}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,color:THEME.primary,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.firstName} {s.lastName}</div>
                          <div style={{fontSize:11,color:THEME.textLight}}>{s.phone}</div>
                        </div>
                        <span style={{background:st.color+"18",color:st.color,fontWeight:700,fontSize:11,padding:"3px 10px",borderRadius:99,border:`1px solid ${st.color}30`,flexShrink:0}}>{st.label}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:THEME.textLight,gap:8,flexWrap:"wrap"}}>
                        <span>{s.goal||"—"} · {s.details||"—"}</span>
                        {s.dailyTasksLimit&&<span style={{color:THEME.accent,fontWeight:600}}>📝 {s.dailyTasksLimit} задач/день</span>}
                      </div>
                      {periodEnd&&(
                        <div style={{marginTop:8,fontSize:11,color:daysLeft!==null&&daysLeft<=7?"#ef4444":THEME.textLight}}>
                          {daysLeft!==null&&daysLeft>0?`⏳ Осталось ${daysLeft} дн. (до ${new Date(periodEnd).toLocaleDateString("ru-RU")})`:daysLeft!==null&&daysLeft<=0?`⛔ Период истёк ${new Date(periodEnd).toLocaleDateString("ru-RU")}`:""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {showStudentModal&&selectedStudent&&(
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}} onClick={e=>{if(e.target===e.currentTarget)closeStudentModal();}}>
                <div style={{background:"#fff",borderRadius:20,padding:32,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
                    <div style={{width:48,height:48,borderRadius:"50%",background:THEME.primary,color:THEME.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:16,flexShrink:0}}>{selectedStudent.firstName?.[0]}{selectedStudent.lastName?.[0]}</div>
                    <div><div style={{fontWeight:800,fontSize:18,color:THEME.primary}}>{selectedStudent.firstName} {selectedStudent.lastName}</div><div style={{fontSize:13,color:THEME.textLight}}>{selectedStudent.phone}</div></div>
                  </div>
                  <div style={{marginBottom:20}}>
                    <label style={{display:"block",fontWeight:700,fontSize:13,color:THEME.primary,marginBottom:6}}>Статус</label>
                    <select value={modalStatus} onChange={e=>setModalStatus(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${THEME.border}`,fontFamily:"'Inter',sans-serif",fontSize:14,outline:"none",background:"#f8fafc"}}>
                      {STUDENT_STATUSES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
                    </select>
                  </div>
                  <div style={{marginBottom:20}}>
                    <label style={{display:"block",fontWeight:700,fontSize:13,color:THEME.primary,marginBottom:6}}>Лимит ежедневных задач: <span style={{color:THEME.accent,fontWeight:800}}>{modalDailyLimit}</span></label>
                    <input type="range" min={5} max={50} step={1} value={modalDailyLimit} onChange={e=>setModalDailyLimit(Number(e.target.value))} style={{width:"100%",accentColor:THEME.accent}}/>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:THEME.textLight,marginTop:2}}><span>5</span><span>50</span></div>
                  </div>
                  <div style={{marginBottom:20,padding:16,background:THEME.bg,borderRadius:12,border:`1px solid ${THEME.border}`}}>
                    <div style={{fontWeight:700,fontSize:13,color:THEME.primary,marginBottom:12}}>Период обучения</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                      <div>
                        <label style={{display:"block",fontSize:12,color:THEME.textLight,marginBottom:4}}>Дата начала</label>
                        <input type="date" value={modalPeriodStart} onChange={e=>setModalPeriodStart(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${THEME.border}`,fontFamily:"'Inter',sans-serif",fontSize:13,outline:"none",background:"#fff",boxSizing:"border-box"}}/>
                      </div>
                      <div>
                        <label style={{display:"block",fontSize:12,color:THEME.textLight,marginBottom:4}}>Продолжительность (мес.)</label>
                        <input type="number" min={1} max={24} value={modalPeriodMonths} onChange={e=>setModalPeriodMonths(Number(e.target.value))} style={{width:"100%",padding:"8px 10px",borderRadius:8,border:`1px solid ${THEME.border}`,fontFamily:"'Inter',sans-serif",fontSize:13,outline:"none",background:"#fff",boxSizing:"border-box"}}/>
                      </div>
                    </div>
                    {modalPeriodStart&&(()=>{
                      const end=new Date(modalPeriodStart);
                      end.setMonth(end.getMonth()+Number(modalPeriodMonths));
                      const endStr=end.toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});
                      const today2=new Date().toISOString().slice(0,10);
                      const isExpired=end.toISOString().slice(0,10)<today2;
                      return <div style={{marginTop:10,fontSize:12,color:isExpired?"#ef4444":"#10b981",fontWeight:600}}>{isExpired?"⛔ Период истёк":"✅ Действует до"} {endStr}</div>;
                    })()}
                    <div style={{marginTop:8,fontSize:11,color:THEME.textLight}}>После истечения периода ученик автоматически получит статус «Неактивный» и будет иметь доступ только к разделу «Индивидуальный план обучения».</div>
                  </div>
                  <div style={{marginBottom:24}}>
                    <label style={{display:"block",fontWeight:700,fontSize:13,color:THEME.primary,marginBottom:6}}>Новый пароль <span style={{fontWeight:400,color:THEME.textLight}}>(оставьте пустым, чтобы не менять)</span></label>
                    <input type="text" value={modalPwd} onChange={e=>setModalPwd(e.target.value)} placeholder="Введите новый пароль..." className="input-field" style={{margin:0,padding:"10px 14px",fontSize:14}}/>
                    {selectedStudent.password&&<div style={{fontSize:11,color:THEME.success,marginTop:4,fontWeight:600}}>🔒 Пароль уже задан</div>}
                  </div>
                  <div style={{display:"flex",gap:12}}>
                    <button onClick={saveStudentModal} disabled={modalSaving} className="cta-button active" style={{flex:1,padding:"12px",fontSize:15}}>{modalSaving?"Сохранение...":"💾 Сохранить"}</button>
                    <button onClick={closeStudentModal} style={{padding:"12px 20px",borderRadius:12,border:`1px solid ${THEME.border}`,background:"transparent",color:THEME.textLight,cursor:"pointer",fontSize:14,fontWeight:600}}>Отмена</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ── REPORTS ── */}
        {!loading&&tab==="reports"&&(
          <div>
            {!rStudentId&&(
              <>
                <div className="admin-section-header"><div><h2 className="admin-section-title">Экспертные отчёты</h2><p style={{color:THEME.textLight,fontSize:14}}>Выберите ученика для составления отчёта</p></div></div>
                {students.length===0?<div className="empty-state">Учеников нет.</div>:(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>
                    {students.map(s=>{
                      const st=STUDENT_STATUSES.find(x=>x.value===s.status)||STUDENT_STATUSES[1];
                      return(
                        <div key={s.id} onClick={()=>loadStudentResults(s.id)} style={{background:"#fff",borderRadius:14,border:`1px solid ${THEME.border}`,padding:"20px",cursor:"pointer",transition:"all 0.2s"}}
                          onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)"}
                          onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
                          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                            <div style={{width:40,height:40,borderRadius:"50%",background:THEME.primary,color:THEME.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14,flexShrink:0}}>{s.firstName?.[0]}{s.lastName?.[0]}</div>
                            <div><div style={{fontWeight:700,color:THEME.primary,fontSize:14}}>{s.firstName} {s.lastName}</div><div style={{fontSize:11,color:st.color,fontWeight:700}}>{st.label}</div></div>
                          </div>
                          <div style={{fontSize:12,color:THEME.textLight}}>{s.goal} · {s.details}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {rStudentId&&!rResultId&&(
              <>
                <div className="admin-section-header">
                  <div>
                    <button onClick={()=>{setRStudentId(null);setRResults([]);}} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:13,padding:"6px 14px",borderRadius:8,marginBottom:12}}>← Все ученики</button>
                    <h2 className="admin-section-title">{students.find(s=>s.id===rStudentId)?.firstName} {students.find(s=>s.id===rStudentId)?.lastName}</h2>
                    <p style={{color:THEME.textLight,fontSize:14}}>Пройденные диагностики: {rResults.length}</p>
                  </div>
                </div>
                {rLoading&&<div className="empty-state">Загрузка...</div>}
                {!rLoading&&rResults.length===0&&<div className="empty-state">Диагностик не найдено.</div>}
                {!rLoading&&rResults.length>0&&(()=>{
                  const st=students.find(s=>s.id===rStudentId)||{};
                  const spSkills=rSkillProgress;
                  const autoGroupedAdmin={red:[],yellow:[],green:[]};
                  Object.entries(spSkills).forEach(([skill,d])=>{ autoGroupedAdmin[d.zone||"red"].push({skill,...d}); });
                  const adminZoneSkills={red:[],yellow:[],green:[]};
                  Object.values(rReports).forEach(rep=>{ if(rep.zonedPlan){ ["red","yellow","green"].forEach(z=>{ (rep.zonedPlan[z]||[]).forEach(t=>{ const lst=t.skills||[]; if(lst.length) lst.forEach(sk=>{ if(!spSkills[sk]) adminZoneSkills[z].push({skill:sk,topic:t.topic,section:t.section}); }); else if(t.topic&&!spSkills[t.topic]) adminZoneSkills[z].push({skill:t.topic,topic:t.topic,section:t.section}); }); }); } });
                  const allG={red:[...autoGroupedAdmin.red,...adminZoneSkills.red],yellow:[...autoGroupedAdmin.yellow,...adminZoneSkills.yellow],green:[...autoGroupedAdmin.green,...adminZoneSkills.green]};
                  const goal=st.goal||"";
                  const grade=goal==="ЕНТ"?"11 класс (готовится к ЕНТ)":(st.details||goal);
                  // For non-ENT: filter skills to only those from sections matching student's grade
                  const isENT=goal==="ЕНТ"||goal==="exam";
                  const studentGrade=st.details||"";
                  let promptG=allG;
                  if(!isENT&&studentGrade&&skillsDb.length>0){
                    const gradeSectionIds=new Set(sections.filter(s=>s.specificTarget===studentGrade).map(s=>s.id));
                    const gradeSkillNames=new Set(skillsDb.filter(sk=>gradeSectionIds.has(sk.sectionId)).map(sk=>sk.name));
                    if(gradeSkillNames.size>0){
                      promptG={
                        red:allG.red.filter(item=>gradeSkillNames.has(item.skill)),
                        yellow:allG.yellow.filter(item=>gradeSkillNames.has(item.skill)),
                        green:allG.green.filter(item=>gradeSkillNames.has(item.skill)),
                      };
                    }
                  }
                  const totalSk=promptG.red.length+promptG.yellow.length+promptG.green.length;
                  const fmtSk=arr=>arr.length===0?"  (нет навыков в этой зоне)":arr.map(t=>{let l=`  • ${t.skill}`;if(t.topic&&t.topic!==t.skill)l+=` [тема: ${t.topic}]`;if(t.section)l+=` [раздел: ${t.section}]`;if(t.lastScore!=null)l+=` [результат: ${t.lastScore}%]`;return l;}).join("\n");
                  // Skills from skillsDb for the sections covered in this student's diagnostics
                  // Results store sectionId (may be null) + sectionName, answers store section name not ID
                  const diagSectionIds=new Set();
                  rResults.forEach(r=>{
                    if(r.sectionId) diagSectionIds.add(r.sectionId);
                    const names=new Set([r.sectionName,...(r.answers||[]).map(a=>a.section)].filter(Boolean));
                    sections.forEach(s=>{ if(names.has(s.name)) diagSectionIds.add(s.id); });
                  });
                  const alreadyInZones=new Set([...allG.red,...allG.yellow,...allG.green].map(x=>x.skill));
                  const secSkillsAll=skillsDb.filter(sk=>diagSectionIds.has(sk.sectionId));
                  const secSkillsUnzoned=secSkillsAll.filter(sk=>!alreadyInZones.has(sk.name));

                  const buildPrompt=()=>{
                    let daysLeft="";
                    if(rExamDate){const diff=Math.ceil((new Date(rExamDate)-new Date())/(1000*60*60*24));daysLeft=diff>0?`${diff} дней (до ${new Date(rExamDate).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})})` :"экзамен скоро/прошёл";}
                    const skillsNote=!isENT&&studentGrade?`\n(Показаны только навыки из разделов для ${studentGrade})`:"";
                    const secBlock=secSkillsAll.length>0
                      ? `\n\n═══════════════════════════════════════\nНАВЫКИ ДИАГНОСТИРОВАННЫХ РАЗДЕЛОВ (${secSkillsAll.length} навыков из базы)\n═══════════════════════════════════════\n${secSkillsAll.map(sk=>{let l=`  • ${sk.name}`;if(sk.errorScenario)l+=` — типичная ошибка: ${sk.errorScenario}`;return l;}).join("\n")}${secSkillsUnzoned.length>0?`\n\n⚠️ Из них ещё не распределены по зонам (${secSkillsUnzoned.length}): ${secSkillsUnzoned.map(sk=>sk.name).join(", ")}`:""}` : "";
                    return `Ты — опытный репетитор по математике. Составь подробный индивидуальный план обучения для ученика.\n\n═══════════════════════════════════════\nИНФОРМАЦИЯ ОБ УЧЕНИКЕ\n═══════════════════════════════════════\nИмя: ${st.firstName||""} ${st.lastName||""}\nКласс / уровень: ${grade}\nЦель: ${goal}\n${rExamDate?`Дата экзамена: ${new Date(rExamDate).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}\nДо экзамена осталось: ${daysLeft}`:"Дата экзамена: не указана"}\n${rHoursPerWeek?`Занятий с преподавателем: ${rHoursPerWeek} ч/нед`:"Занятий с преподавателем: не указано"}${secBlock}\n\n═══════════════════════════════════════\nТЕКУЩИЙ УРОВЕНЬ НАВЫКОВ (${totalSk} навыков)${skillsNote}\n═══════════════════════════════════════\n\n🔴 КРИТИЧЕСКАЯ ЗОНА — ${promptG.red.length} навыков:\n${fmtSk(promptG.red)}\n\n🟡 ТРЕБУЕТ ВНИМАНИЯ — ${promptG.yellow.length} навыков:\n${fmtSk(promptG.yellow)}\n\n🟢 ХОРОШАЯ ЗОНА — ${promptG.green.length} навыков:\n${fmtSk(promptG.green)}\n\n═══════════════════════════════════════\nЗАДАЧА: СОСТАВИТЬ ПОЛНЫЙ ПЛАН ДЛЯ ПРЕПОДАВАТЕЛЯ\n═══════════════════════════════════════\n\n1. ОПТИМАЛЬНЫЙ ПОРЯДОК ИЗУЧЕНИЯ НАВЫКОВ\n   • Учти зависимости между темами (какой навык нужен как фундамент)\n   • Критическая зона — в первую очередь, внутри зоны — логическая последовательность\n   ${goal==="ЕНТ"?"• Формат ЕНТ: акцент на типовые задачи":""}\n\n2. РАСПРЕДЕЛЕНИЕ ВРЕМЕНИ НА КАЖДЫЙ НАВЫК\n   • Таблица: Навык | Занятий (ч) | Самостоят. (ч) | Неделя\n   ${rHoursPerWeek?`• Бюджет: ${rHoursPerWeek} ч/нед с преподавателем`:""}\n   ${daysLeft?`• До экзамена: ${daysLeft}`:""}\n\n3. ЕЖЕНЕДЕЛЬНЫЙ ПЛАН (от сегодня до экзамена)\n   • Формат: Неделя N (даты) → навыки + описание занятий\n\n4. ДОМАШНИЕ ЗАДАНИЯ\n   • Типы задач для каждого навыка, количество в день, время\n\n5. ПРОМЕЖУТОЧНЫЕ ТЕСТИРОВАНИЯ\n   • Когда, какие навыки, критерии готовности (порог %)\n\n6. ПЛАН САМОСТОЯТЕЛЬНОЙ РАБОТЫ\n   • Часов в неделю самостоятельно + конкретные задания по темам\n\n═══════════════════════════════════════\nВАЖНО: конкретные даты/недели, реальные числа, рабочий документ для преподавателя.\n═══════════════════════════════════════`;
                  };
                  return(<>
                  {secSkillsAll.length===0&&skillsDb.length>0&&<div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:8,padding:"10px 14px",fontSize:12,marginBottom:8}}>
                    <strong>Диагностика навыков:</strong> навыки из базы не найдены для этого ученика.<br/>
                    Разделы из диагностик: {rResults.map(r=>r.sectionName||"—").join(", ")}<br/>
                    Найденные section IDs: [{[...diagSectionIds].join(", ")||"пусто"}]<br/>
                    Всего разделов в базе: {sections.length}, навыков: {skillsDb.length}
                  </div>}
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {(()=>{
                      // Если есть финальный объединённый результат умной диагностики (score != null),
                      // скрываем промежуточные разделы (smartDiag_section*) — они дублируют данные
                      const hasFinalSmartDiag=rResults.some(r=>(r.sectionId||'').startsWith('smartDiag_')?false:(r.sectionName||'').includes('Умная Диагностика')&&r.score!=null);
                      return rResults.filter(r=>hasFinalSmartDiag?(r.sectionId||'').startsWith('smartDiag_')?false:true:true);
                    })().map((r,idx,arr)=>{
                      const hasReport=!!rReports[r.id];
                      const num=arr.length-idx;
                      const sections=[...new Set((r.answers||[]).map(a=>a.section).filter(Boolean))];
                      const topics=[...new Set((r.answers||[]).map(a=>a.topic).filter(Boolean))];
                      const displayScore=r.score!=null?r.score:(r.totalQuestions>0?Math.round((r.correctAnswers||0)/r.totalQuestions*100):null);
                      const title=r.sectionName||(sections.length?sections.join(", "):"Общая диагностика");
                      const scoreColor=displayScore>=80?THEME.success:displayScore>=60?THEME.warning:THEME.error;
                      return(
                        <div key={r.id} style={{background:"#fff",borderRadius:14,border:`1px solid ${hasReport?THEME.accent:THEME.border}`,padding:"20px 24px",transition:"all 0.2s"}}
                          onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.07)"}
                          onMouseLeave={e=>e.currentTarget.style.boxShadow=""}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                            <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>openReportEditor(r)}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                                <span style={{fontSize:11,fontWeight:700,color:THEME.textLight,background:THEME.bg,border:`1px solid ${THEME.border}`,borderRadius:99,padding:"2px 10px"}}>#{num}</span>
                                <span style={{fontWeight:700,color:THEME.primary,fontSize:15}}>{title}</span>
                                {hasReport&&<span style={{background:"rgba(212,175,55,0.15)",color:"#92680e",fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:99}}>✅ Отчёт готов</span>}
                              </div>
                              {topics.length>0&&<div style={{fontSize:12,color:THEME.textLight,marginBottom:6}}>{topics.slice(0,5).join(" · ")}{topics.length>5?` +${topics.length-5} тем`:""}</div>}
                              <div style={{fontSize:12,color:THEME.textLight}}>{r.completedAt?new Date(r.completedAt).toLocaleString("ru-RU",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}):""} · {r.totalQuestions} вопросов</div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}} onClick={()=>openReportEditor(r)}>
                                <div style={{width:52,height:52,borderRadius:12,background:scoreColor,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15}}>{displayScore!=null?`${displayScore}%`:"—"}</div>
                                <span style={{fontSize:11,color:THEME.accent,fontWeight:700}}>Открыть →</span>
                              </div>
                              <button onClick={async e=>{
                                e.stopPropagation();
                                if(!confirm(`Удалить результат диагностики «${title}»?${hasReport?" Экспертный отчёт также будет удалён.":""}`))return;
                                try{
                                  await deleteDoc(doc(db,"diagnosticResults",r.id));
                                  if(hasReport)await deleteDoc(doc(db,"expertReports",r.id));
                                  const remaining=rResults.filter(x=>x.id!==r.id);
                                  setRResults(remaining);
                                  // Если у ученика не осталось ни одного результата — сбрасываем smartDiagDone
                                  if(remaining.length===0&&rStudentId){
                                    try{await updateDoc(doc(db,"users",rStudentId),{smartDiagDone:false});}catch(_){}
                                  }
                                }catch(err){alert("Ошибка: "+err.message);}
                              }} style={{background:"transparent",border:"1px solid rgba(220,38,38,0.3)",color:"#dc2626",borderRadius:8,padding:"6px 10px",fontSize:13,cursor:"pointer",lineHeight:1,flexShrink:0}} title="Удалить результат">🗑</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* AI Prompt Generator */}
                  <div style={{marginTop:32,borderTop:`2px solid ${THEME.border}`,paddingTop:28}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <h3 style={{fontFamily:"'Montserrat',sans-serif",fontSize:17,fontWeight:800,color:THEME.primary,margin:0}}>🤖 Промпт для ИИ-планирования</h3>
                    </div>
                    <p style={{color:THEME.textLight,fontSize:13,marginBottom:16,lineHeight:1.6}}>Сгенерируй промпт для ChatGPT / Claude — получишь полный план обучения с расписанием, д/з и промежуточными тестами.</p>
                    <div style={{background:"#fff",borderRadius:14,border:`1px solid ${THEME.border}`,padding:"20px 24px",marginBottom:16}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                        <div>
                          <label style={{display:"block",fontSize:12,fontWeight:600,color:THEME.textLight,marginBottom:6}}>Дата экзамена</label>
                          <input type="date" value={rExamDate} onChange={e=>setRExamDate(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:9,border:`1px solid ${THEME.border}`,fontSize:14,color:THEME.primary,background:THEME.bg,outline:"none",boxSizing:"border-box"}}/>
                        </div>
                        <div>
                          <label style={{display:"block",fontSize:12,fontWeight:600,color:THEME.textLight,marginBottom:6}}>Часов занятий в неделю (с вами)</label>
                          <input type="number" min="1" max="40" value={rHoursPerWeek} onChange={e=>setRHoursPerWeek(e.target.value)} placeholder="например, 4" style={{width:"100%",padding:"10px 14px",borderRadius:9,border:`1px solid ${THEME.border}`,fontSize:14,color:THEME.primary,background:THEME.bg,outline:"none",boxSizing:"border-box"}}/>
                        </div>
                      </div>
                      {totalSk===0&&secSkillsAll.length===0&&<p style={{color:THEME.error,fontSize:13,marginBottom:12}}>⚠️ У ученика нет данных о навыках. Убедитесь что навыки добавлены в разделе «Навыки» для диагностированных разделов.</p>}
                      {totalSk===0&&secSkillsAll.length>0&&<p style={{color:"#92400e",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:8,padding:"8px 12px",fontSize:13,marginBottom:12}}>ℹ️ Зоны ещё не назначены — в промпт включены {secSkillsAll.length} навыков из базы для диагностированных разделов.</p>}
                      <button onClick={()=>{setRAdminPrompt(buildPrompt());setRAdminPromptCopied(false);}} className="cta-button active" style={{width:"auto",padding:"12px 28px",fontSize:14,fontWeight:700}}>Сгенерировать промпт →</button>
                    </div>
                    {rAdminPrompt&&(
                      <div style={{background:"#fff",borderRadius:14,border:`1px solid ${THEME.accent}`,padding:"20px 24px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                          <span style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:14,color:THEME.primary}}>Готовый промпт</span>
                          <button onClick={()=>{navigator.clipboard.writeText(rAdminPrompt).then(()=>{setRAdminPromptCopied(true);setTimeout(()=>setRAdminPromptCopied(false),2500);});}} style={{background:rAdminPromptCopied?"rgba(16,185,129,0.1)":"rgba(99,102,241,0.08)",border:`1px solid ${rAdminPromptCopied?THEME.success:THEME.accent}`,color:rAdminPromptCopied?THEME.success:THEME.accent,borderRadius:9,padding:"7px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>{rAdminPromptCopied?"✅ Скопировано!":"📋 Копировать"}</button>
                        </div>
                        <textarea readOnly value={rAdminPrompt} rows={18} style={{width:"100%",padding:"14px",borderRadius:9,border:`1px solid ${THEME.border}`,fontSize:12,color:THEME.primary,background:THEME.bg,fontFamily:"monospace",lineHeight:1.6,resize:"vertical",boxSizing:"border-box",outline:"none"}}/>
                      </div>
                    )}
                  </div>
                  </>);
                })()}
              </>
            )}
            {rStudentId&&rResultId&&rResultData&&(
              <>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
                  <button onClick={()=>{setRResultId(null);setRResultData(null);}} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:13,padding:"6px 14px",borderRadius:8}}>← Назад</button>
                  <div><div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary}}>Отчёт: {rResultData.sectionName||"Диагностика"}</div>
                  <div style={{fontSize:12,color:THEME.textLight}}>{students.find(s=>s.id===rStudentId)?.firstName} {students.find(s=>s.id===rStudentId)?.lastName} · {rResultData.completedAt?new Date(rResultData.completedAt).toLocaleString("ru-RU"):""}</div></div>
                </div>

                {/* Section 1: General params */}
                <div className="admin-form-card">
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:20}}>1. Общие параметры</h3>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
                    {[{key:"score",label:"Общий балл (%)"},{key:"accuracy",label:"Точность решений (%)"},{key:"avgPace",label:"Средний темп (сек/задача)"}].map(f=>(
                      <div key={f.key} className="input-group" style={{marginBottom:0}}>
                        <label className="input-label">{f.label}</label>
                        <input type="number" className="input-field" value={rForm.generalParams[f.key]} onChange={e=>setRForm(p=>({...p,generalParams:{...p.generalParams,[f.key]:e.target.value}}))} placeholder="0"/>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Competency map */}
                <div className="admin-form-card">
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:4}}>2. Карта компетенций</h3>
                  <p style={{color:THEME.textLight,fontSize:13,marginBottom:16}}>Автозаполнено из результатов диагностики. Можно скорректировать.</p>
                  {rForm.competencyMap.length>0&&<div style={{marginBottom:20}}><RadarChart data={rForm.competencyMap.map(t=>({label:t.topic,value:t.percent}))} size={280}/></div>}
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {rForm.competencyMap.map((t,i)=>(
                      <div key={i} style={{display:"flex",gap:10,alignItems:"center"}}>
                        <input type="text" className="input-field" style={{flex:2,padding:"8px 12px"}} value={t.topic} onChange={e=>setRForm(p=>({...p,competencyMap:p.competencyMap.map((x,j)=>j===i?{...x,topic:e.target.value}:x)}))} placeholder="Тема"/>
                        <input type="number" className="input-field" style={{width:90,padding:"8px 12px"}} value={t.percent} onChange={e=>setRForm(p=>({...p,competencyMap:p.competencyMap.map((x,j)=>j===i?{...x,percent:Number(e.target.value)}:x)}))} placeholder="%" min="0" max="100"/>
                        <button onClick={()=>setRForm(p=>({...p,competencyMap:p.competencyMap.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:20,padding:"0 4px"}}>×</button>
                      </div>
                    ))}
                    <button onClick={()=>setRForm(p=>({...p,competencyMap:[...p.competencyMap,{topic:"",percent:0}]}))} style={{background:"transparent",border:`1px dashed ${THEME.border}`,color:THEME.textLight,cursor:"pointer",borderRadius:8,padding:"8px",fontSize:13,marginTop:4}}>+ Добавить тему</button>
                  </div>
                </div>

                {/* Section 2b: AI Prompt */}
                {(()=>{
                  const stu=students.find(s=>s.id===rStudentId);
                  const answers=rResultData?.answers||[];
                  const avgTime=answers.length?Math.round((rResultData?.totalTime||0)/answers.length):0;
                  const answerLines=answers.map((a,i)=>{
                    const skills=(a.skillNames||[]).length>0?` | Навыки: ${a.skillNames.join(", ")}`:"";
                    return `${i+1}. ${a.correct?"✅":"❌"} ${a.topic||"—"} [${a.section||"—"}] — ${a.timeSpent||0}сек${skills}`;
                  }).join("\n");
                  const topicStats={};
                  answers.forEach(a=>{if(!topicStats[a.topic])topicStats[a.topic]={c:0,t:0,sec:0};topicStats[a.topic].t++;if(a.correct)topicStats[a.topic].c++;topicStats[a.topic].sec+=(a.timeSpent||0);});
                  const topicLines=Object.entries(topicStats).map(([tp,v])=>`• ${tp}: ${Math.round(v.c/v.t*100)}% верно, avg ${Math.round(v.sec/v.t)}сек/задача`).join("\n");

                  // Get section grade (specificTarget of the diagnostic section)
                  const diagSection=sections.find(s=>s.id===rResultData?.sectionId);
                  const sectionGrade=diagSection?.specificTarget||"";
                  const sectionGradeIdx=GRADES_LIST.indexOf(sectionGrade);

                  const studentGoalKey=stu?.goalKey||"";
                  const isGapsOrFuture=studentGoalKey==="gaps"||studentGoalKey==="future";

                  // Filter DB skills:
                  // gaps/future → только навыки из конкретного раздела диагностики
                  // exam → все навыки для этого класса и ниже (прежнее поведение)
                  const relevantDbSkills=isGapsOrFuture
                    ? allDbSkills.filter(sk=>sk.sectionId===rResultData?.sectionId)
                    : allDbSkills.filter(sk=>{
                        if(!sk.grade) return true;
                        const gIdx=GRADES_LIST.indexOf(sk.grade);
                        if(sectionGradeIdx===-1) return true;
                        return gIdx!==-1&&gIdx<=sectionGradeIdx;
                      });

                  // Group filtered skills by topic for the prompt
                  const skillsByTopic={};
                  relevantDbSkills.forEach(sk=>{
                    if(sk.topicName&&(sk.skills||[]).length){
                      skillsByTopic[sk.topicName]=(sk.skills||[]);
                    }
                  });

                  // Find skills relevant to the answered topics
                  const answeredTopics=[...new Set(answers.map(a=>a.topic).filter(Boolean))];
                  const relevantSkillLines=answeredTopics
                    .filter(tp=>skillsByTopic[tp])
                    .map(tp=>`  • ${tp}: ${skillsByTopic[tp].join(", ")}`)
                    .join("\n");

                  // Для gaps/future — не показываем "прочие навыки класса", только раздел
                  const otherSkillLines=isGapsOrFuture
                    ? ""
                    : relevantDbSkills
                        .filter(sk=>sk.topicName&&!answeredTopics.includes(sk.topicName)&&(sk.skills||[]).length)
                        .slice(0,30)
                        .map(sk=>`  • ${sk.topicName} (${sk.grade}): ${(sk.skills||[]).join(", ")}`)
                        .join("\n");

                  const hasDbSkills=relevantSkillLines||otherSkillLines;
                  const skillsScopeLabel=isGapsOrFuture
                    ? `раздел "${rResultData?.sectionName||""}"`
                    : `${sectionGrade||"все классы"} и ниже`;

                  // Also pull micro-skills from skillsDb for this section
                  const microSkillsForSection=skillsDb.filter(sk=>{
                    if(rResultData?.sectionId&&sk.sectionId===rResultData.sectionId) return true;
                    if(rResultData?.sectionName&&sk.sectionName===rResultData.sectionName) return true;
                    // fallback: match by answer section names
                    const answerSections=[...new Set((answers||[]).map(a=>a.section).filter(Boolean))];
                    return answerSections.includes(sk.sectionName);
                  });
                  const microSkillsBlock=microSkillsForSection.length>0
                    ? `\n=== НАВЫКИ ИЗ БАЗЫ (${microSkillsForSection.length} навыков для раздела "${rResultData?.sectionName||""}") ===\nВАЖНО: При зонировании используй эти навыки. Не придумывай новые.\n${microSkillsForSection.map(sk=>{let l=`  • ${sk.name}`;if(sk.errorScenario)l+=` — типичная ошибка: ${sk.errorScenario}`;return l;}).join("\n")}\n`
                    : "";

                  const skillsSection=hasDbSkills
                    ? `=== НАВЫКИ ИЗ БАЗЫ ДАННЫХ (${skillsScopeLabel}) ===
ВАЖНО: При зонировании используй ТОЛЬКО эти навыки из нашей БД, не придумывай новые.

Навыки по темам диагностики:
${relevantSkillLines||"  (навыки для этих тем не найдены в БД)"}
${!isGapsOrFuture&&otherSkillLines?`\nДополнительные навыки в этом диапазоне классов:\n${otherSkillLines}\n`:""}
`
                    : `(навыки в БД пока не добавлены — используй математические навыки исходя из тем диагностики)`;

                  const AI_REPORT_PROMPT=`Ты эксперт-преподаватель математики AAPA. Составь полный экспертный отчёт по диагностике ученика.

=== УЧЕНИК ===
Имя: ${stu?.firstName||""} ${stu?.lastName||""}
Цель: ${stu?.goal||""} · ${stu?.details||""}
Диагностика: ${rResultData?.sectionName||""} ${sectionGrade?`(${sectionGrade})`:""}
Результат: ${rResultData?.score||0}% (${rResultData?.correctAnswers||0}/${rResultData?.totalQuestions||0} верно)
Общее время: ${Math.floor((rResultData?.totalTime||0)/60)} мин ${(rResultData?.totalTime||0)%60} сек
Среднее время на задачу: ${avgTime} сек

=== ОТВЕТЫ ПО ЗАДАЧАМ (хронологически) ===
${answerLines}

=== СТАТИСТИКА ПО ТЕМАМ ===
${topicLines}

${skillsSection}
${microSkillsBlock}
=== ЧТО НУЖНО СДЕЛАТЬ ===

**1. ТАБЛИЦА ЗАДАЧ (CSV формат)**
Верни строки в формате: номер;раздел;статус;анализ черновика;вердикт эксперта
Статус: correct (верно), partial (частично), incorrect (неверно)

**2. ЗОНЫ ВЯЗКОСТИ**
Определи темы/задачи, где время > среднего в 1.5 раза (среднее: ${avgTime} сек).
Формат (plain text, каждый пункт с новой строки):
- Задача №X · Тема: [тема] · Время: Xсек · Интерпретация: [почему долго]

**3. КОГНИТИВНАЯ ВЫНОСЛИВОСТЬ**
Проанализируй, с какой задачи начинает снижаться правильность ответов и/или растёт время.
Формат (plain text):
- Падение после задачи №X
- Паттерн: [описание]
- Рекомендация: [что делать]

**4. ЗОНИРОВАНИЕ ПО НАВЫКАМ**
КРИТИЧЕСКИ ВАЖНО:
- В разделе "ОТВЕТЫ ПО ЗАДАЧАМ" выше каждая задача уже содержит поле "Навыки:" — это точные навыки, которые оценивает данная задача.
- Используй ТОЛЬКО эти навыки из задач. Не придумывай новые навыки.
- Зонируй навык основываясь на результате задачи (✅/❌), которая его оценивает.
- Если один навык встречается в нескольких задачах — усредни результат.
- Навык без задачи не может быть красной/жёлтой/зелёной зоной — помести в "Не проверялись".

КРАСНАЯ ЗОНА (< 60% верных задач по этому навыку):
- Навык: [точное название из задачи] · Задачи: №№X,Y · Результат: X%

ЖЁЛТАЯ ЗОНА (60–80%):
- Навык: [точное название из задачи] · Задачи: №№X,Y · Результат: X%

ЗЕЛЁНАЯ ЗОНА (> 80%):
- Навык: [точное название из задачи] · Задачи: №№X,Y · Результат: X%

НЕ ПРОВЕРЯЛИСЬ (навыки не встречались ни в одной задаче):
- Навык: [название] — требуется отдельная диагностика

**5. РЕКОМЕНДАЦИИ** — 3–4 конкретных действия для улучшения
**6. ИТОГОВАЯ ОЦЕНКА** — 2–3 предложения для учителя
**7. РЕЗЮМЕ ДЛЯ РОДИТЕЛЯ** — простым языком, 4–5 предложений, без терминов`;
                  return(
                  <div className="admin-form-card" style={{borderTop:"4px solid #6366f1",marginBottom:24}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div>
                        <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,margin:0,marginBottom:4}}>🤖 Промпт для ИИ</h3>
                        <p style={{color:THEME.textLight,fontSize:12,margin:0}}>Скопируйте → вставьте в ChatGPT или Claude → вставьте результат в поля ниже</p>
                      </div>
                      <button onClick={()=>navigator.clipboard.writeText(AI_REPORT_PROMPT).then(()=>alert("Промпт скопирован!")).catch(()=>alert("Скопируйте вручную"))} style={{background:"#4338ca",color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontWeight:700,fontSize:13,cursor:"pointer",flexShrink:0}}>📋 Копировать промпт</button>
                    </div>
                    {(hasDbSkills||microSkillsForSection.length>0)&&<div style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:12,color:"#4338ca",fontWeight:600}}>✅ {hasDbSkills?`Найдено ${relevantDbSkills.length} записей навыков для ${skillsScopeLabel}`:""}{ hasDbSkills&&microSkillsForSection.length>0?" · ":""}{microSkillsForSection.length>0?`${microSkillsForSection.length} микронавыков для раздела "${rResultData?.sectionName||""}" из skillsDb`:""} — включены в промпт</div>}
                    {!hasDbSkills&&microSkillsForSection.length===0&&<div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:12,color:"#b45309",fontWeight:600}}>⚠️ Навыки для этого раздела не найдены в БД. Добавьте навыки через раздел "Навыки" в админке.</div>}
                    <textarea readOnly value={AI_REPORT_PROMPT} rows={10} style={{width:"100%",boxSizing:"border-box",padding:"10px 12px",borderRadius:8,border:"1px solid rgba(99,102,241,0.3)",fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.5,background:"#f8fafc",color:THEME.text,resize:"vertical"}}/>
                  </div>
                  );
                })()}

                {/* Section 3: Task table */}
                <div className="admin-form-card">
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:4}}>3. Таблица задач</h3>
                  <p style={{color:THEME.textLight,fontSize:13,marginBottom:16}}>Формат CSV: <code style={{fontSize:11}}>номер;раздел;статус(correct/partial/incorrect);анализ черновика;вердикт эксперта</code></p>
                  <textarea className="input-field" rows={5} style={{fontFamily:"'Courier New',monospace",fontSize:12,marginBottom:8}} value={rCsvText} onChange={e=>setRCsvText(e.target.value)} placeholder={"1;Алгебра;correct;Решение верное, все шаги выполнены;Задача выполнена отлично\n2;Геометрия;partial;Верный подход, арифметическая ошибка;Нужно проверять вычисления\n3;Алгебра;incorrect;Неверная формула;Повторить тему степеней"}/>
                  <button onClick={importTaskCsv} disabled={!rCsvText.trim()} className={`cta-button ${rCsvText.trim()?"active":""}`} style={{width:"auto",padding:"8px 20px",fontSize:13,marginBottom:16}}>Загрузить из CSV</button>
                  {rForm.taskTable.length>0&&(
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{background:THEME.bg}}>{["#","Раздел","Статус","Анализ черновика","Вердикт эксперта",""].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:700,color:THEME.textLight,fontSize:10,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                        <tbody>
                          {rForm.taskTable.map((row,i)=>(
                            <tr key={i} style={{borderBottom:`1px solid ${THEME.border}`}}>
                              <td style={{padding:"8px 12px",fontWeight:700}}>{row.num||i+1}</td>
                              <td style={{padding:"8px 12px"}}><input type="text" value={row.section} onChange={e=>setRForm(p=>({...p,taskTable:p.taskTable.map((x,j)=>j===i?{...x,section:e.target.value}:x)}))} style={{border:`1px solid ${THEME.border}`,borderRadius:6,padding:"4px 8px",width:"100%",fontSize:12}}/></td>
                              <td style={{padding:"8px 12px"}}>
                                <select value={row.status} onChange={e=>setRForm(p=>({...p,taskTable:p.taskTable.map((x,j)=>j===i?{...x,status:e.target.value}:x)}))} style={{border:`1px solid ${THEME.border}`,borderRadius:6,padding:"4px 8px",fontSize:12}}>
                                  <option value="correct">Верно</option><option value="partial">Частично</option><option value="incorrect">Неверно</option>
                                </select>
                              </td>
                              <td style={{padding:"8px 12px"}}><input type="text" value={row.draftAnalysis} onChange={e=>setRForm(p=>({...p,taskTable:p.taskTable.map((x,j)=>j===i?{...x,draftAnalysis:e.target.value}:x)}))} style={{border:`1px solid ${THEME.border}`,borderRadius:6,padding:"4px 8px",width:"100%",fontSize:12}}/></td>
                              <td style={{padding:"8px 12px"}}><input type="text" value={row.expertVerdict} onChange={e=>setRForm(p=>({...p,taskTable:p.taskTable.map((x,j)=>j===i?{...x,expertVerdict:e.target.value}:x)}))} style={{border:`1px solid ${THEME.border}`,borderRadius:6,padding:"4px 8px",width:"100%",fontSize:12}}/></td>
                              <td style={{padding:"8px 4px"}}><button onClick={()=>setRForm(p=>({...p,taskTable:p.taskTable.filter((_,j)=>j!==i)}))} style={{background:"transparent",border:"none",color:THEME.textLight,cursor:"pointer",fontSize:18}}>×</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button onClick={()=>setRForm(p=>({...p,taskTable:[...p.taskTable,{num:p.taskTable.length+1,section:"",status:"correct",draftAnalysis:"",expertVerdict:""}]}))} style={{background:"transparent",border:`1px dashed ${THEME.border}`,color:THEME.textLight,cursor:"pointer",borderRadius:8,padding:"8px 16px",fontSize:12,marginTop:8}}>+ Строка</button>
                    </div>
                  )}
                </div>

                {/* Section 3b: Viscosity zones */}
                <div className="admin-form-card" style={{borderTop:"4px solid #f59e0b"}}>
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:4}}>3б. Зоны вязкости</h3>
                  <p style={{color:THEME.textLight,fontSize:13,marginBottom:12}}>Темы/задачи, где ученик тратил больше всего времени (из ответа ИИ)</p>
                  <textarea className="input-field" rows={4} value={rForm.viscosityZones||""} onChange={e=>setRForm(p=>({...p,viscosityZones:e.target.value}))} placeholder={"- Задача №3 · Тема: Квадратные уравнения · Время: 180сек · Интерпретация: Долго подбирал метод решения\n- Задача №7 · Тема: Системы уравнений · Время: 210сек · Интерпретация: Перерешивал несколько раз"}/>
                </div>

                {/* Section 3c: Cognitive endurance */}
                <div className="admin-form-card" style={{borderTop:"4px solid #8b5cf6"}}>
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:4}}>3в. Когнитивная выносливость</h3>
                  <p style={{color:THEME.textLight,fontSize:13,marginBottom:12}}>Когда и как падает эффективность ученика (из ответа ИИ)</p>
                  <textarea className="input-field" rows={3} value={rForm.cognitiveEndurance||""} onChange={e=>setRForm(p=>({...p,cognitiveEndurance:e.target.value}))} placeholder={"- Падение после задачи №8\n- Паттерн: первые 8 задач 75%, последние 7 задач 28%\n- Рекомендация: разбивать сессии на блоки по 8–10 задач с перерывом"}/>
                </div>

                {/* Section 4: Recommendations */}
                <div className="admin-form-card" style={{borderTop:`4px solid ${THEME.primary}`}}>
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:12}}>Рекомендации</h3>
                  <textarea className="input-field" rows={4} value={rForm.recommendations} onChange={e=>setRForm(p=>({...p,recommendations:e.target.value}))} placeholder="Введите рекомендации..."/>
                </div>

                {/* Section 4b: Zoned plan */}
                <div className="admin-form-card" style={{borderTop:`4px solid ${THEME.primary}`}}>
                  <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:6}}>Глобальный план подготовки</h3>
                  <p style={{color:THEME.textLight,fontSize:13,marginBottom:20}}>Выберите навыки из базы — класс и раздел заполнятся автоматически</p>
                  {(()=>{
                    const pickSkill=(zone,i,skillName)=>{
                      const sk=skillsDb.find(s=>s.name===skillName);
                      setRForm(p=>({...p,zonedPlan:{...p.zonedPlan,[zone]:p.zonedPlan[zone].map((x,j)=>j===i?{
                        ...x,
                        skill:skillName,
                        skills:skillName?[skillName]:[],
                        topic:skillName,
                        section:sk?.sectionName||(skillName?x.section:""),
                        grade:sk?.grade||(skillName?x.grade:""),
                      }:x)}}));
                    };
                    const updateDesc=(zone,i,val)=>setRForm(p=>({...p,zonedPlan:{...p.zonedPlan,[zone]:p.zonedPlan[zone].map((x,j)=>j===i?{...x,description:val}:x)}}));
                    const removeItem=(zone,i)=>setRForm(p=>({...p,zonedPlan:{...p.zonedPlan,[zone]:p.zonedPlan[zone].filter((_,j)=>j!==i)}}));
                    const addItem=zone=>setRForm(p=>({...p,zonedPlan:{...p.zonedPlan,[zone]:[...(p.zonedPlan?.[zone]||[]),{skill:"",skills:[],section:"",grade:"",topic:"",description:""}]}}));
                    return [
                      {zone:"red",label:"🔴 Красная зона",color:THEME.error,bg:"rgba(239,68,68,0.06)"},
                      {zone:"yellow",label:"🟡 Жёлтая зона",color:"#b45309",bg:"rgba(245,158,11,0.06)"},
                      {zone:"green",label:"🟢 Зелёная зона",color:"#065f46",bg:"rgba(16,185,129,0.06)"},
                    ].map(({zone,label,color,bg})=>(
                      <div key={zone} style={{marginBottom:20,background:bg,borderRadius:12,padding:"16px"}}>
                        <div style={{fontWeight:700,color,fontSize:14,marginBottom:12}}>{label} <span style={{fontWeight:400,fontSize:12,color:THEME.textLight}}>— {(rForm.zonedPlan?.[zone]||[]).length} навыков</span></div>
                        <datalist id={`zdl-${zone}`}>{skillsDb.map(s=><option key={s.id||s.name} value={s.name}/>)}</datalist>
                        {(rForm.zonedPlan?.[zone]||[]).map((t,i)=>{
                          const skillVal=t.skill||(t.skills&&t.skills[0])||t.topic||"";
                          const hasSkill=skillVal&&skillsDb.some(s=>s.name===skillVal);
                          return(
                            <div key={i} style={{background:"#fff",borderRadius:10,padding:"14px",marginBottom:8,border:`1px solid ${color}40`,display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                              <div style={{flex:"2 1 200px",minWidth:160}}>
                                <div style={{fontSize:11,fontWeight:600,color:THEME.textLight,marginBottom:4}}>Навык</div>
                                <input list={`zdl-${zone}`} className="input-field" style={{padding:"8px 10px",fontSize:13,borderColor:hasSkill?color:"",boxSizing:"border-box"}}
                                  value={skillVal}
                                  onChange={e=>pickSkill(zone,i,e.target.value)}
                                  placeholder="Начните вводить навык..."/>
                              </div>
                              <div style={{flex:"0 0 90px"}}>
                                <div style={{fontSize:11,fontWeight:600,color:THEME.textLight,marginBottom:4}}>Класс</div>
                                <input readOnly className="input-field" style={{padding:"8px 10px",fontSize:12,background:"#f1f5f9",color:THEME.textLight,boxSizing:"border-box"}} value={t.grade||""} placeholder="—"/>
                              </div>
                              <div style={{flex:"1 1 140px",minWidth:120}}>
                                <div style={{fontSize:11,fontWeight:600,color:THEME.textLight,marginBottom:4}}>Раздел</div>
                                <input readOnly className="input-field" style={{padding:"8px 10px",fontSize:12,background:"#f1f5f9",color:THEME.textLight,boxSizing:"border-box"}} value={t.section||""} placeholder="—"/>
                              </div>
                              <div style={{flex:"1 1 140px",minWidth:120}}>
                                <div style={{fontSize:11,fontWeight:600,color:THEME.textLight,marginBottom:4}}>Описание</div>
                                <input type="text" className="input-field" style={{padding:"8px 10px",fontSize:12,boxSizing:"border-box"}} value={t.description||""} onChange={e=>updateDesc(zone,i,e.target.value)} placeholder="Комментарий..."/>
                              </div>
                              <button onClick={()=>removeItem(zone,i)} style={{background:"transparent",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:20,padding:"0 4px",lineHeight:1,flexShrink:0,marginBottom:2}}>×</button>
                            </div>
                          );
                        })}
                        <button onClick={()=>addItem(zone)} style={{background:"transparent",border:`1px dashed ${color}`,color,cursor:"pointer",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:600,marginTop:4}}>+ Добавить навык</button>
                      </div>
                    ));
                  })()}
                </div>

                {[{key:"expertAssessment",label:"Итоговая экспертная оценка"},{key:"parentSummary",label:"Резюме для родителя"}].map(f=>(
                  <div key={f.key} className="admin-form-card" style={{borderTop:`4px solid ${THEME.primary}`}}>
                    <h3 style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,color:THEME.primary,marginBottom:12}}>{f.label}</h3>
                    <textarea className="input-field" rows={4} value={rForm[f.key]} onChange={e=>setRForm(p=>({...p,[f.key]:e.target.value}))} placeholder={`Введите ${f.label.toLowerCase()}...`}/>
                  </div>
                ))}

                <button onClick={saveReport} disabled={rSaving} className="cta-button active" style={{marginTop:8}}>{rSaving?"Сохраняю...":"💾 Сохранить отчёт"}</button>
              </>
            )}
          </div>
        )}

        {/* ── PLANS ── */}
        {!loading&&tab==="plans"&&(
          <div>
            <div className="admin-section-header" style={{marginBottom:24}}>
              <div>
                <h2 className="admin-section-title">🗺️ Индивидуальные планы</h2>
                <p style={{color:THEME.textLight,fontSize:14}}>Добавляйте или удаляйте навыки в плане каждого ученика вручную</p>
              </div>
            </div>

            {!planStudentId&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {students.length===0&&<div className="empty-state">Нет учеников</div>}
                {students.map(s=>(
                  <div key={s.id} onClick={()=>loadPlanSkills(s.id)}
                    style={{background:"#fff",borderRadius:12,border:`1px solid ${THEME.border}`,padding:"16px 20px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,0.07)";e.currentTarget.style.borderColor=THEME.accent;}}
                    onMouseLeave={e=>{e.currentTarget.style.boxShadow="";e.currentTarget.style.borderColor=THEME.border;}}>
                    <div>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:15,color:THEME.primary}}>{s.firstName} {s.lastName}</div>
                      <div style={{fontSize:12,color:THEME.textLight,marginTop:2}}>{s.goal} · {s.details} · {s.phone}</div>
                    </div>
                    <span style={{fontSize:13,color:THEME.accent,fontWeight:600}}>Открыть →</span>
                  </div>
                ))}
              </div>
            )}

            {planStudentId&&(()=>{
              const st=students.find(s=>s.id===planStudentId)||{};
              const zonesMeta={red:{label:"🔴 Критическая зона",color:THEME.error,bg:"rgba(239,68,68,0.08)"},yellow:{label:"🟡 Требует внимания",color:"#b45309",bg:"rgba(245,158,11,0.08)"},green:{label:"🟢 Хорошая зона",color:"#065f46",bg:"rgba(16,185,129,0.08)"}};
              const totalItems=(planZonedPlan.red?.length||0)+(planZonedPlan.yellow?.length||0)+(planZonedPlan.green?.length||0);
              const filterItem=item=>!planSearch.trim()||item.skill?.toLowerCase().includes(planSearch.toLowerCase())||item.section?.toLowerCase().includes(planSearch.toLowerCase());
              const G_u=parseGradeNumber(st.details||st.goal||"");

              // ── Priority computation ──────────────────────────────────────────
              const allPlanSkills=[
                ...(planZonedPlan.red||[]).map(it=>({...it,zone:"red"})),
                ...(planZonedPlan.yellow||[]).map(it=>({...it,zone:"yellow"})),
                ...(planZonedPlan.green||[]).map(it=>({...it,zone:"green"}))
              ];
              const priorityList=allPlanSkills.map(item=>{
                const sn=(item.skill||item.topic||"").trim();
                const skMeta=skillsDb.find(s=>s.name===sn)||{};
                const zone=item.zone;
                const K_zone=zone==="yellow"?1.2:zone==="red"?1.0:0.0;
                const W_exam=Number(skMeta.W_exam)||0;
                const W_dep=Number(skMeta.W_dep)||0;
                const P_index=Math.round((W_exam+W_dep)*K_zone*100)/100;
                const G_s=parseGradeNumber(skMeta.grade||"");
                const S_diag=computeS_diag(skMeta,zone,planDiagResults);
                const M_g=computeM_g_final(G_u,G_s,S_diag);
                const K_adj=computeKAdj(sn,skMeta,planLessonLogs);
                const T_next=skMeta.T_base?Math.round(Number(skMeta.T_base)*M_g*K_adj):null;
                const logs=planLessonLogs.filter(l=>l.skillName===sn);
                const cumPct=Math.min(100,logs.reduce((s,l)=>s+Number(l.percentCovered||0),0));
                return{...item,skillName:sn,skMeta,zone,K_zone,P_index,W_exam,W_dep,G_s,S_diag,M_g,K_adj,T_next,cumPct,logs};
              }).filter(it=>it.K_zone>0).sort((a,b)=>b.P_index-a.P_index);

              // ── Selected skill detail ─────────────────────────────────────────
              const selItem=planSelectedSkill?priorityList.find(it=>it.skillName===planSelectedSkill)||allPlanSkills.find(it=>(it.skill||it.topic||"").trim()===planSelectedSkill):null;
              const selSkMeta=selItem?.skMeta||skillsDb.find(s=>s.name===planSelectedSkill)||{};
              const selLogs=(planLessonLogs.filter(l=>l.skillName===planSelectedSkill)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
              const selCumPct=Math.min(100,selLogs.reduce((s,l)=>s+Number(l.percentCovered||0),0));

              return(
                <>
                  {/* Header */}
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                    <button onClick={()=>{setPlanStudentId(null);setPlanZonedPlan({red:[],yellow:[],green:[]});setPlanLessonLogs([]);setPlanDiagResults([]);setPlanSelectedSkill(null);}} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",fontSize:13,padding:"6px 14px",borderRadius:8}}>← Все ученики</button>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary}}>{st.firstName} {st.lastName}</div>
                      <div style={{fontSize:12,color:THEME.textLight}}>{st.goal} · {st.details} · {totalItems} навыков · G_u={G_u||"?"}</div>
                    </div>
                    {planManualRepId&&<span style={{fontSize:11,background:"rgba(99,102,241,0.08)",color:THEME.accent,border:`1px solid ${THEME.accent}40`,borderRadius:99,padding:"2px 10px",fontWeight:600}}>✓ Сохранено</span>}
                  </div>

                  {/* Tabs */}
                  <div style={{display:"flex",gap:4,marginBottom:24,borderBottom:`2px solid ${THEME.border}`,paddingBottom:0}}>
                    {[{k:"zones",label:"🗂 Зоны"},{k:"priority",label:"📊 Приоритеты"}].map(t=>(
                      <button key={t.k} onClick={()=>{setPlanTab(t.k);setPlanSelectedSkill(null);}}
                        style={{padding:"10px 20px",border:"none",background:"transparent",cursor:"pointer",fontSize:14,fontWeight:planTab===t.k?700:400,color:planTab===t.k?THEME.primary:THEME.textLight,borderBottom:planTab===t.k?`2px solid ${THEME.primary}`:"2px solid transparent",marginBottom:-2}}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* ── ZONES TAB ── */}
                  {planTab==="zones"&&(<>
                    <div style={{background:"#fff",borderRadius:14,border:`1px solid ${THEME.border}`,padding:"20px 24px",marginBottom:24}}>
                      <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:14}}>➕ Добавить навык в план</div>
                      <datalist id="plan-skills-dl">{skillsDb.map(s=><option key={s.id||s.name} value={s.name}/>)}</datalist>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                        <div style={{flex:"2 1 240px"}}>
                          <div style={{fontSize:12,fontWeight:600,color:THEME.textLight,marginBottom:4}}>Навык</div>
                          <input list="plan-skills-dl" className="input-field" style={{padding:"10px 14px",fontSize:14,boxSizing:"border-box"}} value={planAddSkill} onChange={e=>setPlanAddSkill(e.target.value)} placeholder="Начните вводить навык из базы..." onKeyDown={e=>{if(e.key==="Enter")planAddEntry();}}/>
                        </div>
                        <div style={{flex:"0 0 180px"}}>
                          <div style={{fontSize:12,fontWeight:600,color:THEME.textLight,marginBottom:4}}>Зона</div>
                          <select className="input-field" style={{padding:"10px 14px",fontSize:14,boxSizing:"border-box"}} value={planAddZone} onChange={e=>setPlanAddZone(e.target.value)}>
                            <option value="red">🔴 Критическая</option>
                            <option value="yellow">🟡 Требует внимания</option>
                            <option value="green">🟢 Хорошая</option>
                          </select>
                        </div>
                        <button onClick={planAddEntry} disabled={!planAddSkill.trim()||planSaving} className="cta-button active" style={{width:"auto",padding:"10px 24px",fontSize:14,flexShrink:0}}>{planSaving?"Сохраняю...":"Добавить"}</button>
                      </div>
                      {planAddSkill.trim()&&(()=>{const sk=skillsDb.find(s=>s.name===planAddSkill.trim());if(!sk)return<p style={{fontSize:12,color:THEME.warning,marginTop:8}}>⚠️ Навык не найден в базе.</p>;return<p style={{fontSize:12,color:THEME.success,marginTop:8}}>✓ {sk.grade} · {sk.sectionName}</p>;})()}
                    </div>
                    {totalItems>0&&<input className="input-field" style={{marginBottom:20,padding:"10px 14px",fontSize:14,boxSizing:"border-box",maxWidth:360}} value={planSearch} onChange={e=>setPlanSearch(e.target.value)} placeholder="🔍 Поиск по навыкам..."/>}
                    {planLoading&&<div className="empty-state">Загрузка...</div>}
                    {!planLoading&&totalItems===0&&<div className="empty-state" style={{padding:"40px 0"}}><div style={{fontSize:40,marginBottom:12}}>🗺️</div><div>У ученика пока нет навыков в плане.</div></div>}
                    {!planLoading&&["red","yellow","green"].map(z=>{
                      const zItems=(planZonedPlan[z]||[]).filter(filterItem);
                      if(zItems.length===0&&planSearch.trim())return null;
                      if((planZonedPlan[z]||[]).length===0)return null;
                      const zn=zonesMeta[z];
                      return(
                        <div key={z} style={{marginBottom:24}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                            <span style={{fontWeight:700,color:zn.color,fontSize:14}}>{zn.label}</span>
                            <span style={{fontSize:12,color:THEME.textLight,background:zn.bg,border:`1px solid ${zn.color}30`,borderRadius:99,padding:"1px 10px"}}>{(planZonedPlan[z]||[]).length}</span>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {zItems.map((item,idx)=>{
                              const realIdx=(planZonedPlan[z]||[]).indexOf(item);
                              const skMeta=skillsDb.find(s=>s.name===item.skill);
                              return(
                                <div key={idx} style={{background:"#fff",borderRadius:10,border:`1px solid ${zn.color}30`,borderLeft:`4px solid ${zn.color}`,padding:"12px 16px",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                                  <div style={{flex:1,minWidth:160}}>
                                    <div style={{fontWeight:600,fontSize:14,color:THEME.primary}}>{item.skill}</div>
                                    <div style={{fontSize:11,color:THEME.textLight,marginTop:2}}>{item.grade||skMeta?.grade||""}{(item.grade||skMeta?.grade)&&(item.section||skMeta?.sectionName)?" · ":""}{item.section||skMeta?.sectionName||""}</div>
                                  </div>
                                  <select value={z} onChange={e=>planChangeZone(z,realIdx,e.target.value)} disabled={planSaving} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${zn.color}40`,background:zn.bg,color:zn.color,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                                    <option value="red">🔴 Критическая</option>
                                    <option value="yellow">🟡 Внимание</option>
                                    <option value="green">🟢 Хорошая</option>
                                  </select>
                                  <button onClick={()=>planRemoveEntry(z,realIdx)} disabled={planSaving} style={{background:"transparent",border:"1px solid rgba(220,38,38,0.3)",color:"#dc2626",borderRadius:8,padding:"6px 10px",fontSize:13,cursor:"pointer",flexShrink:0}}>🗑</button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </>)}

                  {/* ── PRIORITY TAB ── */}
                  {planTab==="priority"&&(<>
                    {planLoading&&<div className="empty-state">Загрузка...</div>}
                    {!planLoading&&priorityList.length===0&&<div className="empty-state" style={{padding:"40px 0"}}><div style={{fontSize:32,marginBottom:8}}>📊</div><div>Добавьте навыки в зоны «Критическая» или «Внимание», чтобы увидеть приоритеты.</div></div>}
                    {!planLoading&&priorityList.length>0&&(
                      <div style={{overflowX:"auto",marginBottom:24}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                          <thead>
                            <tr style={{background:"#f1f5f9"}}>
                              {["#","Навык","Зона","P_index","T_next (мин)","Изучено",""].map(h=>(
                                <th key={h} style={{padding:"10px 12px",textAlign:"left",fontWeight:700,color:THEME.primary,borderBottom:`2px solid ${THEME.border}`,whiteSpace:"nowrap"}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {priorityList.map((it,idx)=>{
                              const zn=zonesMeta[it.zone];
                              const isSel=planSelectedSkill===it.skillName;
                              return(
                                <tr key={it.skillName} onClick={()=>setPlanSelectedSkill(isSel?null:it.skillName)}
                                  style={{background:isSel?"rgba(99,102,241,0.06)":"#fff",borderBottom:`1px solid ${THEME.border}`,cursor:"pointer",transition:"background 0.1s"}}
                                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="#f8fafc";}}
                                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="#fff";}}>
                                  <td style={{padding:"10px 12px",fontWeight:700,color:THEME.textLight}}>{idx+1}</td>
                                  <td style={{padding:"10px 12px"}}>
                                    <div style={{fontWeight:600,color:THEME.primary}}>{it.skillName}</div>
                                    <div style={{fontSize:11,color:THEME.textLight}}>{it.skMeta?.sectionName||""}{it.skMeta?.grade?" · "+it.skMeta.grade:""}</div>
                                  </td>
                                  <td style={{padding:"10px 12px"}}><span style={{background:zn.bg,color:zn.color,fontWeight:700,fontSize:11,padding:"3px 8px",borderRadius:6,border:`1px solid ${zn.color}30`}}>{it.zone==="red"?"🔴 Красная":"🟡 Жёлтая"}</span></td>
                                  <td style={{padding:"10px 12px",fontWeight:700,color:it.P_index>0?"#4338ca":THEME.textLight}}>{it.P_index}</td>
                                  <td style={{padding:"10px 12px",fontWeight:600}}>{it.T_next!=null?`${it.T_next} мин`:<span style={{color:THEME.textLight,fontSize:11}}>нет данных</span>}</td>
                                  <td style={{padding:"10px 12px"}}>
                                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                                      <div style={{flex:1,minWidth:60,height:6,background:"#e2e8f0",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",background:it.cumPct>=100?"#10B981":"#6366f1",width:`${it.cumPct}%`,borderRadius:3}}/></div>
                                      <span style={{fontSize:11,color:THEME.textLight,whiteSpace:"nowrap"}}>{it.cumPct}%</span>
                                    </div>
                                  </td>
                                  <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:"#4338ca"}}>{isSel?"▲ Скрыть":"▼ Детали"}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* ── SKILL DETAIL PANEL ── */}
                    {planSelectedSkill&&(
                      <div style={{background:"#fff",borderRadius:16,border:`2px solid #6366f1`,padding:"24px",marginBottom:24}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                          <div>
                            <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:17,color:THEME.primary}}>{planSelectedSkill}</div>
                            <div style={{fontSize:12,color:THEME.textLight,marginTop:2}}>{selSkMeta?.sectionName||""}{selSkMeta?.grade?" · "+selSkMeta.grade:""}</div>
                          </div>
                          <button onClick={()=>setPlanSelectedSkill(null)} style={{background:"transparent",border:`1px solid ${THEME.border}`,color:THEME.textLight,cursor:"pointer",borderRadius:8,padding:"6px 12px",fontSize:13}}>× Закрыть</button>
                        </div>

                        {/* Coefficients grid */}
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:20}}>
                          {[
                            {label:"P_index",val:selItem?.P_index??"-",color:"#4338ca"},
                            {label:"T_next",val:selItem?.T_next!=null?selItem.T_next+" мин":"-",color:THEME.primary},
                            {label:"K_adj",val:selItem?.K_adj??"-",color:"#059669"},
                            {label:"M_g_final",val:selItem?.M_g??"-",color:"#b45309"},
                            {label:"S_diag",val:selItem?.S_diag!=null?(selItem.S_diag*100).toFixed(0)+"%":"-",color:"#6366f1"},
                            {label:"T_base",val:selSkMeta?.T_base?selSkMeta.T_base+" мин":"-",color:THEME.textLight},
                            {label:"C (слож.)",val:selSkMeta&&Object.keys(selSkMeta).length?computeSkillC(selSkMeta)+"/5":"-",color:THEME.textLight},
                            {label:"Изучено",val:(selItem?.cumPct??selCumPct)+"%",color:selCumPct>=100?"#10B981":"#6366f1"},
                          ].map(({label,val,color})=>(
                            <div key={label} style={{background:"#f8fafc",borderRadius:10,padding:"10px 14px",border:`1px solid ${THEME.border}`}}>
                              <div style={{fontSize:11,color:THEME.textLight,marginBottom:2}}>{label}</div>
                              <div style={{fontWeight:700,fontSize:16,color}}>{String(val)}</div>
                            </div>
                          ))}
                        </div>

                        {/* Add lesson log form */}
                        <div style={{background:"rgba(99,102,241,0.04)",borderRadius:10,border:"1px solid rgba(99,102,241,0.2)",padding:"16px",marginBottom:20}}>
                          <div style={{fontWeight:700,fontSize:13,color:"#4338ca",marginBottom:12}}>📅 Добавить запись о занятии</div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
                            <div><label style={{fontSize:11,fontWeight:600,color:THEME.textLight,display:"block",marginBottom:4}}>Дата</label><input type="date" className="input-field" style={{padding:"8px 10px"}} value={planLogForm.date} onChange={e=>setPlanLogForm(p=>({...p,date:e.target.value}))}/></div>
                            <div><label style={{fontSize:11,fontWeight:600,color:THEME.textLight,display:"block",marginBottom:4}}>Время (мин)</label><input type="number" min={1} className="input-field" style={{padding:"8px 10px"}} value={planLogForm.timeSpent} onChange={e=>setPlanLogForm(p=>({...p,timeSpent:e.target.value}))} placeholder="45"/></div>
                            <div><label style={{fontSize:11,fontWeight:600,color:THEME.textLight,display:"block",marginBottom:4}}>Изучено (%)</label><input type="number" min={1} max={100} className="input-field" style={{padding:"8px 10px"}} value={planLogForm.percentCovered} onChange={e=>setPlanLogForm(p=>({...p,percentCovered:e.target.value}))} placeholder="30"/></div>
                          </div>
                          <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:600,color:THEME.textLight,display:"block",marginBottom:4}}>Заметки</label><input type="text" className="input-field" style={{padding:"8px 10px"}} value={planLogForm.notes} onChange={e=>setPlanLogForm(p=>({...p,notes:e.target.value}))} placeholder="Что прорешали, что вызвало затруднение..."/></div>
                          <button onClick={addPlanLessonLog} disabled={planLogSaving||!planLogForm.timeSpent||!planLogForm.percentCovered} className="cta-button active" style={{width:"auto",padding:"8px 20px",fontSize:13}}>{planLogSaving?"Сохраняю...":"Сохранить занятие"}</button>
                          {selCumPct>=100&&<span style={{marginLeft:12,fontSize:12,color:"#10B981",fontWeight:600}}>✓ Навык пройден полностью (T_a зафиксирован)</span>}
                        </div>

                        {/* Lesson log history */}
                        {selLogs.length>0&&(
                          <div style={{marginBottom:20}}>
                            <div style={{fontWeight:700,fontSize:13,color:THEME.text,marginBottom:10}}>История занятий ({selLogs.length})</div>
                            <div style={{overflowX:"auto"}}>
                              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                                <thead><tr style={{background:"#f1f5f9"}}>{["Дата","Время (мин)","Изучено (%)","Итого %","Заметки",""].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",fontWeight:600,color:THEME.textLight,borderBottom:`1px solid ${THEME.border}`}}>{h}</th>)}</tr></thead>
                                <tbody>{(()=>{let cum=0;return selLogs.map((l,i)=>{cum+=Number(l.percentCovered||0);const done=cum>=100;return(<tr key={l.id} style={{background:done&&i===selLogs.findIndex((_,j)=>{let c=0;selLogs.slice(0,j+1).forEach(x=>c+=Number(x.percentCovered||0));return c>=100;})?"rgba(16,185,129,0.06)":"#fff",borderBottom:`1px solid ${THEME.border}`}}><td style={{padding:"7px 10px"}}>{l.date||"—"}</td><td style={{padding:"7px 10px",fontWeight:600}}>{l.timeSpent}</td><td style={{padding:"7px 10px"}}>{l.percentCovered}%</td><td style={{padding:"7px 10px",color:Math.min(cum,100)>=100?"#10B981":"#6366f1",fontWeight:700}}>{Math.min(cum,100)}%</td><td style={{padding:"7px 10px",color:THEME.textLight,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.notes||"—"}</td><td style={{padding:"7px 10px"}}><button onClick={()=>deletePlanLessonLog(l.id)} style={{background:"transparent",border:"none",color:"#dc2626",cursor:"pointer",fontSize:14}}>🗑</button></td></tr>);});})()}</tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Exercises */}
                        {(selSkMeta?.exercises||[]).filter(e=>e).length>0&&(
                          <div style={{marginBottom:20}}>
                            <div style={{fontWeight:700,fontSize:13,color:THEME.text,marginBottom:8}}>📝 Упражнения для занятия</div>
                            <ol style={{margin:0,paddingLeft:20}}>
                              {selSkMeta.exercises.filter(e=>e).map((ex,i)=><li key={i} style={{fontSize:13,color:THEME.text,marginBottom:6,lineHeight:1.5}}>{ex}</li>)}
                            </ol>
                          </div>
                        )}

                        {/* Homework */}
                        {(selSkMeta?.homework||[]).filter(h=>h).length>0&&(
                          <div>
                            <div style={{fontWeight:700,fontSize:13,color:THEME.text,marginBottom:8}}>📚 Домашние задания</div>
                            <ol style={{margin:0,paddingLeft:20}}>
                              {selSkMeta.homework.filter(h=>h).map((hw,i)=><li key={i} style={{fontSize:13,color:THEME.text,marginBottom:6,lineHeight:1.5}}>{hw}</li>)}
                            </ol>
                          </div>
                        )}

                        {!(selSkMeta?.exercises||[]).filter(e=>e).length&&!(selSkMeta?.homework||[]).filter(h=>h).length&&(
                          <div style={{fontSize:12,color:THEME.textLight,fontStyle:"italic"}}>Упражнения и ДЗ не заполнены. Отредактируйте навык в разделе «Навыки».</div>
                        )}
                      </div>
                    )}
                  </>)}
                </>
              );
            })()}
          </div>
        )}

        {/* ── CDM TAB ── */}
        {!loading&&tab==="cdm"&&(()=>{
          const cdmSec=sections.find(s=>s.id===cdmSectionId);
          const cdmSkills=skillsDb.filter(sk=>sk.sectionId===cdmSectionId).sort((a,b)=>a.name.localeCompare(b.name));
          const cdmHierarchy=skillHierarchies.find(h=>h.id===cdmSectionId);
          const GROUPS=[...new Set(sections.map(s=>s.specificTarget).filter(Boolean))].sort();

          const cdmPrompt=cdmSkills.length>0?`Ты — главный методолог и эксперт по педагогическому дизайну (Instructional Design) для платформы подготовки к ЕНТ по математике. Твоя задача — внедрить Cognitive Diagnostic Modeling (CDM).

Task:
Я предоставлю тебе неструктурированный список математических микро-навыков одного из разделов. Тебе нужно проанализировать их и построить строгую иерархию зависимостей.

Логика построения (КРИТИЧЕСКИ ВАЖНО - АДАПТИВНЫЙ МАСШТАБ И ЗДРАВЫЙ СМЫСЛ):

1. Анализ объема: Подсчитай общее количество переданных тебе навыков (N = ${cdmSkills.length}).

2. Правило логической изоляции (Safety Valve): НИКОГДА не объединяй навыки искусственно. Если навыки математически независимы и их невозможно естественно объединить в одну задачу формата ЕНТ, выделяй их в отдельный кластер, даже если это нарушает лимиты ниже. Математическая логика ВАЖНЕЕ количества кластеров.

3. Адаптивная кластеризация (Ориентир):
- Если N <= 10 (Малый раздел): Ориентируйся на 1-2 кластера. Но если навыки не связаны — делай столько кластеров, сколько нужно для сохранения логики.
- Если N от 11 до 30 (Средний раздел): Создай 2-4 кластера. Выдели по 1-2 Pivot Skill внутри каждого.
- Если N > 30 (Крупный раздел): Создай 4-6 кластеров. Выдели по 2-3 Pivot Skill внутри каждого.

4. Pivot Skills (Ключевые узлы): Это сложные задачи. Для их решения ученик уже должен владеть более мелкими навыками кластера. НИКОГДА не делай базовый, неделимый навык Pivot-узлом. Если навык изолирован и у него нет дочерних (prerequisites), он формирует свой собственный микро-кластер, где он сам является Pivot Skill (уровень 1).

5. Дерево зависимостей: Для каждого Pivot Skill укажи prerequisites (skill_id других Pivot Skills, которые нужно освоить ДО него) и impacted_skills (конкретные навыки из переданного списка, которые автоматически считаются освоенными при решении этого Pivot Skill).

6. АБСОЛЮТНЫЙ ЗАПРЕТ: Названия навыков в поле impacted_skills должны быть скопированы ДОСЛОВНО из переданного списка — без каких-либо изменений, сокращений, перефразирований или исправлений. Любое отклонение от оригинального текста недопустимо.

Формат вывода:
Выдай ответ СТРОГО в формате валидного JSON. Не используй Markdown-разметку (без \`\`\`json). Не используй LaTeX. Синтаксис формул: умножение *, степень ^.

Схема JSON:
{
  "section": "Название раздела",
  "clusters": [
    {
      "cluster_name": "Название кластера",
      "pivot_skills": [
        {
          "skill_id": "короткий_id_на_английском",
          "skill_name": "Текстовое название Pivot-навыка",
          "level": 1,
          "prerequisites": ["skill_id_другого_pivot"],
          "impacted_skills": ["Точное название навыка из списка 1", "Точное название навыка из списка 2"]
        }
      ]
    }
  ]
}

Где level: 1 = базовый/изолированный, 2 = средний, 3 = сложный интегративный.

Список навыков раздела «${cdmSec?.name||''}» (всего: ${cdmSkills.length}):

${cdmSkills.map((sk,i)=>`${i+1}. ${sk.name}`).join('\n')}

Пример корректного JSON для раздела с 5 навыками:
{
  "section": "Линейные уравнения",
  "clusters": [
    {
      "cluster_name": "Базовые операции",
      "pivot_skills": [
        {
          "skill_id": "linear_eq_solve",
          "skill_name": "Решение линейного уравнения ax+b=c",
          "level": 2,
          "prerequisites": [],
          "impacted_skills": ["Перенос слагаемых с изменением знака", "Деление обеих частей уравнения на коэффициент"]
        }
      ]
    },
    {
      "cluster_name": "Изолированный навык",
      "pivot_skills": [
        {
          "skill_id": "check_solution",
          "skill_name": "Проверка корня подстановкой",
          "level": 1,
          "prerequisites": [],
          "impacted_skills": ["Проверка корня подстановкой в исходное уравнение"]
        }
      ]
    }
  ]
}

Теперь построй иерархию для переданного раздела. Выдай ТОЛЬКО валидный JSON без пояснений.`:'';

          return(
            <div>
              <div className="admin-section-header" style={{marginBottom:24}}>
                <div>
                  <h2 className="admin-section-title">🧠 CDM — Иерархия навыков</h2>
                  <p style={{color:THEME.textLight,fontSize:14}}>Cognitive Diagnostic Modeling: кластеры и pivot-навыки для каждого раздела</p>
                </div>
              </div>

              {/* Section selector */}
              <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                <label style={{fontSize:12,fontWeight:700,color:THEME.textLight,display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>Выберите раздел</label>
                <select className="input-field" style={{marginBottom:0,maxWidth:480}} value={cdmSectionId} onChange={e=>setCdmSectionId(e.target.value)}>
                  <option value="">— Выберите раздел —</option>
                  {GROUPS.map(g=>(
                    <optgroup key={g} label={g}>
                      {sections.filter(s=>s.specificTarget===g).sort((a,b)=>a.name.localeCompare(b.name)).map(s=>{
                        const cnt=skillsDb.filter(sk=>sk.sectionId===s.id).length;
                        const hasH=skillHierarchies.some(h=>h.id===s.id);
                        return <option key={s.id} value={s.id}>{s.name} ({cnt} навыков){hasH?' ✓':''}</option>;
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>

              {cdmSectionId&&(
                <>
                  {/* Skills list + copy prompt */}
                  <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:12,flexWrap:'wrap'}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:15,color:THEME.text}}>{cdmSec?.name}</div>
                        <div style={{fontSize:13,color:THEME.textLight,marginTop:2}}>{cdmSkills.length} микро-навыков</div>
                      </div>
                      <button
                        disabled={cdmSkills.length===0}
                        onClick={()=>{
                          if(!cdmPrompt)return;
                          navigator.clipboard.writeText(cdmPrompt)
                            .then(()=>alert('✓ Промпт скопирован! Вставьте его в AI Studio.'))
                            .catch(()=>alert('Не удалось скопировать. Скопируйте вручную из текстового поля ниже.'));
                        }}
                        style={{background:cdmSkills.length>0?'#4338ca':'#94a3b8',color:'#fff',border:'none',borderRadius:8,padding:'10px 20px',fontWeight:700,fontSize:13,cursor:cdmSkills.length>0?'pointer':'not-allowed',whiteSpace:'nowrap'}}
                      >
                        📋 Скопировать промпт для AI Studio
                      </button>
                    </div>

                    {cdmSkills.length===0?(
                      <div style={{padding:'20px',textAlign:'center',color:THEME.textLight,fontSize:13,background:THEME.bg,borderRadius:10}}>
                        ⚠️ В разделе нет микро-навыков. Добавьте их во вкладке «🎯 Навыки».
                      </div>
                    ):(
                      <>
                        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16}}>
                          {cdmSkills.map((sk,i)=>(
                            <span key={sk.id} style={{background:'rgba(99,102,241,0.07)',color:'#4338ca',fontSize:12,padding:'4px 10px',borderRadius:6,border:'1px solid rgba(99,102,241,0.2)'}}>
                              {i+1}. {sk.name}
                            </span>
                          ))}
                        </div>
                        <details style={{marginTop:8}}>
                          <summary style={{fontSize:12,color:THEME.textLight,cursor:'pointer',fontWeight:600}}>Показать полный промпт</summary>
                          <textarea readOnly value={cdmPrompt} rows={12}
                            style={{width:'100%',boxSizing:'border-box',marginTop:8,padding:'10px 14px',borderRadius:8,border:`1px solid ${THEME.border}`,fontSize:11,fontFamily:"'Courier New',monospace",lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical'}}
                          />
                        </details>
                      </>
                    )}
                  </div>

                  {/* Upload JSON */}
                  <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                    <h3 style={{margin:'0 0 4px',fontSize:15,fontWeight:700,color:THEME.text}}>Загрузить результат из AI Studio</h3>
                    <p style={{margin:'0 0 14px',fontSize:13,color:THEME.textLight}}>Вставьте JSON который вернул AI Studio в поле ниже и нажмите «Сохранить»</p>
                    <textarea
                      value={cdmJsonDraft}
                      onChange={e=>setCdmJsonDraft(e.target.value)}
                      placeholder={'{\n  "section": "...",\n  "clusters": [...]\n}'}
                      rows={10}
                      style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:10,border:`1px solid ${THEME.border}`,fontSize:12,fontFamily:"'Courier New',monospace",lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical',marginBottom:12}}
                    />
                    <button
                      onClick={saveCdmHierarchy}
                      disabled={cdmSaving||!cdmJsonDraft.trim()}
                      style={{background:cdmJsonDraft.trim()&&!cdmSaving?'#059669':'#94a3b8',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontWeight:700,fontSize:13,cursor:cdmJsonDraft.trim()&&!cdmSaving?'pointer':'not-allowed'}}
                    >
                      {cdmSaving?'Сохранение...':'💾 Сохранить иерархию'}
                    </button>
                  </div>

                  {/* Display saved hierarchy */}
                  {cdmHierarchy&&(()=>{
                    const VL_CONFIG={
                      ARITHMETIC:   {label:'Числа и вычисления', icon:'🔢', color:'#2563eb', bg:'rgba(37,99,235,0.06)', border:'rgba(37,99,235,0.2)'},
                      ALGEBRA:      {label:'Алгебра и функции',  icon:'📐', color:'#7c3aed', bg:'rgba(124,58,237,0.06)', border:'rgba(124,58,237,0.2)'},
                      GEOMETRY:     {label:'Геометрия',           icon:'📏', color:'#059669', bg:'rgba(5,150,105,0.06)', border:'rgba(5,150,105,0.2)'},
                      WORD_PROBLEMS:{label:'Текстовые задачи',    icon:'📝', color:'#d97706', bg:'rgba(217,119,6,0.06)', border:'rgba(217,119,6,0.2)'},
                    };
                    const clusters=cdmHierarchy.clusters||[];
                    const hasVL=clusters.some(c=>c.vertical_line_id);
                    const vlClusters=hasVL?Object.fromEntries(Object.keys(VL_CONFIG).map(k=>[k,clusters.filter(c=>c.vertical_line_id===k)])):{};
                    const unassigned=hasVL?clusters.filter(c=>!VL_CONFIG[c.vertical_line_id]):[];
                    const vlPrompt=`Ты — Data Engineer и методолог математической платформы AAPA. Твоя задача — обогатить существующую JSON-иерархию учебных навыков, распределив кластеры по 4 глобальным вертикальным линиям (Vertical Pathways).

Task:
Я передам тебе готовый JSON с математическими кластерами и Pivot-навыками. Тебе нужно проанализировать смысловую нагрузку каждого кластера и добавить на уровень кластера новое поле: "vertical_line_id".

Категории для распределения (ИСПОЛЬЗОВАТЬ ТОЛЬКО ИХ):

"ARITHMETIC" — Числа, дроби, степени, корни, вычисления, пропорции.

"ALGEBRA" — Выражения, формулы сокращенного умножения, уравнения всех типов, неравенства, функции, графики.

"GEOMETRY" — Углы, фигуры, площади, периметры, теорема Пифагора, тригонометрия (синус/косинус), векторы, координаты.

"WORD_PROBLEMS" — Текстовые задачи на движение, работу, проценты, сплавы, логику и моделирование.

КРИТИЧЕСКИЕ ТРЕБОВАНИЯ:

Сохрани оригинальную структуру моего JSON буква в букву. Не меняй названия навыков, не трогай массивы prerequisites и impacted_skills.

Добавь поле "vertical_line_id" в каждый объект массива clusters (сразу после cluster_name).

Если кластер пограничный (например, геометрическая задача с применением уравнения), приоритет отдается изначальной теме — "GEOMETRY".

Формат вывода:
Выдай ответ СТРОГО в формате валидного JSON. Не используй Markdown-разметку (без \`\`\`json).

Пример ожидаемого изменения (До / После):
Было: > {"cluster_name": "Квадратные уравнения", "pivot_skills": [...]}
Стало: > {"cluster_name": "Квадратные уравнения", "vertical_line_id": "ALGEBRA", "pivot_skills": [...]}

Вот мой JSON для обновления:
${JSON.stringify({section:cdmHierarchy.section,clusters:clusters},null,2)}`;
                    return(
                      <>
                        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,gap:12,flexWrap:'wrap'}}>
                            <div>
                              <h3 style={{margin:0,fontSize:15,fontWeight:700,color:THEME.text}}>✓ Сохранённая иерархия CDM</h3>
                              <div style={{fontSize:12,color:THEME.textLight,marginTop:4}}>Обновлено: {cdmHierarchy.updatedAt?new Date(cdmHierarchy.updatedAt).toLocaleString('ru-RU'):'-'}</div>
                            </div>
                            <div style={{display:'flex',gap:8,alignItems:'center'}}>
                              <span style={{background:'rgba(5,150,105,0.1)',color:'#059669',fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:6,border:'1px solid rgba(5,150,105,0.3)'}}>
                                {clusters.length} кластеров
                              </span>
                              {hasVL&&<span style={{background:'rgba(124,58,237,0.1)',color:'#7c3aed',fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:6,border:'1px solid rgba(124,58,237,0.3)'}}>🗂 VL назначены</span>}
                              <button onClick={()=>deleteCdmHierarchy(cdmSectionId)} style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:6,padding:'4px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                                🗑 Удалить всё
                              </button>
                            </div>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:16}}>
                            {clusters.map((cl,ci)=>{
                              const vl=VL_CONFIG[cl.vertical_line_id];
                              return(
                                <div key={ci} style={{borderRadius:12,border:`1px solid ${vl?vl.border:THEME.border}`,overflow:'hidden'}}>
                                  <div style={{background:vl?vl.bg:'#f1f5f9',padding:'10px 16px',fontWeight:700,fontSize:14,color:THEME.primary,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                                      <span>{ci+1}. {cl.cluster_name}</span>
                                      {vl&&<span style={{background:vl.bg,color:vl.color,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,border:`1px solid ${vl.border}`,flexShrink:0}}>{vl.icon} {cl.vertical_line_id}</span>}
                                    </div>
                                    <button onClick={()=>deleteCdmCluster(cdmSectionId,ci)} style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:6,padding:'2px 10px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                                      🗑 Удалить кластер
                                    </button>
                                  </div>
                                  <div style={{padding:16,display:'flex',flexDirection:'column',gap:12}}>
                                    {(cl.pivot_skills||[]).map((ps,pi)=>(
                                      <div key={pi} style={{background:THEME.bg,borderRadius:10,padding:'14px 16px',border:`1px solid ${THEME.border}`}}>
                                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                                          <span style={{background:ps.level===3?'#dc2626':ps.level===2?'#d97706':'#059669',color:'#fff',fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4,flexShrink:0}}>
                                            L{ps.level}
                                          </span>
                                          <span style={{fontWeight:700,fontSize:13,color:THEME.text}}>{ps.skill_name}</span>
                                          <span style={{fontSize:11,color:THEME.textLight,fontFamily:"'Courier New',monospace",background:'rgba(99,102,241,0.07)',padding:'2px 6px',borderRadius:4,flexShrink:0}}>{ps.skill_id}</span>
                                        </div>
                                        {(ps.prerequisites||[]).length>0&&(
                                          <div style={{fontSize:12,marginBottom:6}}>
                                            <span style={{color:THEME.textLight,fontWeight:600}}>Требует: </span>
                                            {ps.prerequisites.map((p,i)=><span key={i} style={{background:'rgba(245,158,11,0.1)',color:'#b45309',fontSize:11,padding:'2px 7px',borderRadius:4,marginRight:4,border:'1px solid rgba(245,158,11,0.3)'}}>{p}</span>)}
                                          </div>
                                        )}
                                        {(ps.impacted_skills||[]).length>0&&(
                                          <div style={{fontSize:12}}>
                                            <span style={{color:THEME.textLight,fontWeight:600}}>Покрывает навыки: </span>
                                            <span style={{color:THEME.textLight}}>{ps.impacted_skills.join(', ')}</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* ── Vertical Lines ── */}
                        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                          <div style={{borderBottom:`1px solid ${THEME.border}`,paddingBottom:16,marginBottom:20}}>
                            <h3 style={{margin:'0 0 4px',fontSize:15,fontWeight:700,color:THEME.text}}>🗂️ Вертикальные линии</h3>
                            <p style={{margin:0,fontSize:13,color:THEME.textLight}}>Распределение кластеров по 4 глобальным линиям (ARITHMETIC / ALGEBRA / GEOMETRY / WORD_PROBLEMS)</p>
                          </div>

                          {/* Auto-assign via Gemini */}
                          <div style={{background:'linear-gradient(135deg,rgba(124,58,237,0.06),rgba(67,56,202,0.06))',borderRadius:12,border:'1px solid rgba(124,58,237,0.2)',padding:'16px 20px',marginBottom:20}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                              <div>
                                <div style={{fontWeight:700,fontSize:14,color:'#4c1d95'}}>🤖 Автоназначение через Gemini</div>
                                <div style={{fontSize:12,color:'#6d28d9',marginTop:2}}>Gemini проанализирует кластеры и назначит vertical_line_id автоматически</div>
                              </div>
                              <button
                                onClick={autoAssignVerticalLines}
                                disabled={vlGenerating}
                                style={{background:vlGenerating?'#94a3b8':'#7c3aed',color:'#fff',border:'none',borderRadius:8,padding:'10px 22px',fontWeight:700,fontSize:13,cursor:vlGenerating?'not-allowed':'pointer',whiteSpace:'nowrap',flexShrink:0}}
                              >
                                {vlGenerating?'⏳ Gemini думает...':'✨ Назначить автоматически'}
                              </button>
                            </div>
                          </div>

                          {/* Prompt copy */}
                          <div style={{marginBottom:20}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,gap:12,flexWrap:'wrap'}}>
                              <div style={{fontSize:13,fontWeight:600,color:THEME.text}}>Или вручную — скопируйте промпт и вставьте в AI Studio</div>
                              <button
                                onClick={()=>navigator.clipboard.writeText(vlPrompt).then(()=>alert('✓ Промпт скопирован!')).catch(()=>alert('Скопируйте вручную ниже'))}
                                style={{background:'#4338ca',color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontWeight:700,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}
                              >
                                📋 Скопировать промпт
                              </button>
                            </div>
                            <details>
                              <summary style={{fontSize:12,color:THEME.textLight,cursor:'pointer',fontWeight:600}}>Показать промпт</summary>
                              <textarea readOnly value={vlPrompt} rows={10}
                                style={{width:'100%',boxSizing:'border-box',marginTop:8,padding:'10px 14px',borderRadius:8,border:`1px solid ${THEME.border}`,fontSize:11,fontFamily:"'Courier New',monospace",lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical'}}
                              />
                            </details>
                          </div>

                          {/* Upload result */}
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:THEME.text,marginBottom:8}}>Вставьте JSON от AI Studio с добавленными vertical_line_id</div>
                            <textarea
                              value={vlJsonDraft}
                              onChange={e=>setVlJsonDraft(e.target.value)}
                              placeholder={'{\n  "section": "...",\n  "clusters": [\n    {"cluster_name": "...", "vertical_line_id": "ALGEBRA", "pivot_skills": [...]}\n  ]\n}'}
                              rows={8}
                              style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:10,border:`1px solid ${THEME.border}`,fontSize:12,fontFamily:"'Courier New',monospace",lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical',marginBottom:12}}
                            />
                            <button
                              onClick={saveVerticalLines}
                              disabled={vlSaving||!vlJsonDraft.trim()}
                              style={{background:vlJsonDraft.trim()&&!vlSaving?'#7c3aed':'#94a3b8',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontWeight:700,fontSize:13,cursor:vlJsonDraft.trim()&&!vlSaving?'pointer':'not-allowed'}}
                            >
                              {vlSaving?'Сохранение...':'💾 Сохранить вертикальные линии'}
                            </button>
                          </div>

                          {/* Visual grouping */}
                          {hasVL&&(
                            <div style={{marginTop:24,borderTop:`1px solid ${THEME.border}`,paddingTop:20}}>
                              <div style={{fontSize:13,fontWeight:700,color:THEME.text,marginBottom:16}}>Распределение кластеров по вертикальным линиям</div>
                              {unassigned.length>0&&(
                                <div style={{background:'#fef9c3',border:'1px solid #fde68a',borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#92400e'}}>
                                  ⚠️ {unassigned.length} кластер(ов) без vertical_line_id: {unassigned.map(c=>c.cluster_name).join(', ')}
                                </div>
                              )}
                              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:16}}>
                                {Object.entries(VL_CONFIG).map(([vlId,cfg])=>{
                                  const list=vlClusters[vlId]||[];
                                  return(
                                    <div key={vlId} style={{borderRadius:12,border:`1px solid ${cfg.border}`,overflow:'hidden'}}>
                                      <div style={{background:cfg.bg,padding:'10px 14px',display:'flex',alignItems:'center',gap:8}}>
                                        <span style={{fontSize:18}}>{cfg.icon}</span>
                                        <div>
                                          <div style={{fontWeight:700,fontSize:13,color:cfg.color}}>{vlId}</div>
                                          <div style={{fontSize:11,color:THEME.textLight}}>{cfg.label}</div>
                                        </div>
                                        <span style={{marginLeft:'auto',background:cfg.bg,color:cfg.color,fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:4,border:`1px solid ${cfg.border}`}}>{list.length}</span>
                                      </div>
                                      <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:6}}>
                                        {list.length===0?(
                                          <div style={{fontSize:12,color:THEME.textLight,fontStyle:'italic',textAlign:'center',padding:'8px 0'}}>нет кластеров</div>
                                        ):list.map((cl,ci)=>(
                                          <div key={ci} style={{fontSize:12,color:THEME.text,padding:'6px 10px',background:THEME.bg,borderRadius:6,border:`1px solid ${THEME.border}`,lineHeight:1.4}}>
                                            <div style={{fontWeight:600}}>{cl.cluster_name}</div>
                                            <div style={{color:THEME.textLight,fontSize:11,marginTop:2}}>{(cl.pivot_skills||[]).length} pivot-навыков</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}

              {/* ── Link Prerequisites to taskBank ── */}
              <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <div>
                    <h3 style={{margin:'0 0 4px',fontSize:15,fontWeight:700,color:THEME.text}}>🔗 Связать пререквизиты в TaskBank</h3>
                    <p style={{margin:0,fontSize:13,color:THEME.textLight}}>Читает все CDM-иерархии и записывает <code style={{background:THEME.bg,padding:'1px 5px',borderRadius:4}}>prerequisite_id</code> в документы taskBank — чтобы алгоритм SKT мог спускаться по графу навыков</p>
                  </div>
                  <button
                    onClick={linkPrerequisites}
                    disabled={prereqLinking||skillHierarchies.length===0}
                    style={{background:prereqLinking||skillHierarchies.length===0?'#94a3b8':'#0f766e',color:'#fff',border:'none',borderRadius:8,padding:'10px 22px',fontWeight:700,fontSize:13,cursor:prereqLinking||skillHierarchies.length===0?'not-allowed':'pointer',whiteSpace:'nowrap',flexShrink:0}}
                  >
                    {prereqLinking?'⏳ Обновляем...':'🔗 Связать пререквизиты'}
                  </button>
                </div>
                {prereqLinkResult&&(
                  <div style={{marginTop:14,padding:'12px 16px',borderRadius:10,background:prereqLinkResult.updated>0?'rgba(5,150,105,0.08)':'rgba(245,158,11,0.08)',border:`1px solid ${prereqLinkResult.updated>0?'rgba(5,150,105,0.3)':'rgba(245,158,11,0.3)'}`,fontSize:13,color:prereqLinkResult.updated>0?'#065f46':'#92400e'}}>
                    {prereqLinkResult.updated>0
                      ?`✓ Обновлено ${prereqLinkResult.updated} / ${prereqLinkResult.total} · CDM: ${prereqLinkResult.mapSize} навыков · CGM: ${prereqLinkResult.cgmPaths||0} путей (${prereqLinkResult.cgmTotal||0} entry_skill_id, не найдено в taskBank: ${prereqLinkResult.cgmMissed||0})`
                      :`⚠️ 0 совпадений · CDM: ${prereqLinkResult.mapSize} навыков · CGM: ${prereqLinkResult.cgmPaths||0} путей · CGM entry_id не найдено в taskBank: ${prereqLinkResult.cgmMissed||0} из ${prereqLinkResult.cgmTotal||0} — смотри консоль браузера (F12) для деталей`
                    }
                  </div>
                )}
              </div>

              {/* ── Cross-Grade Mapping ── */}
              {(()=>{
                const gradesWithHier=[...new Set(
                  skillHierarchies.map(h=>sections.find(s=>s.id===h.id)?.specificTarget).filter(g=>GRADES_LIST.includes(g))
                )].sort((a,b)=>GRADES_LIST.indexOf(a)-GRADES_LIST.indexOf(b));

                // Build consecutive grade runs
                const runs=[];
                let cur=[gradesWithHier[0]];
                for(let i=1;i<gradesWithHier.length;i++){
                  if(GRADES_LIST.indexOf(gradesWithHier[i])-GRADES_LIST.indexOf(gradesWithHier[i-1])===1){cur.push(gradesWithHier[i]);}
                  else{runs.push(cur);cur=[gradesWithHier[i]];}
                }
                if(gradesWithHier.length>0)runs.push(cur);

                // All chains of length >= 2 from consecutive runs
                const allChains=[];
                for(const run of runs){
                  for(let s=0;s<run.length-1;s++){
                    for(let e=s+1;e<run.length;e++){
                      allChains.push(run.slice(s,e+1));
                    }
                  }
                }
                if(allChains.length===0)return null;

                const chainId=grades=>grades.map(g=>g.replace(/\s/g,'_')).join('__');

                // Get existing saved modules for a grade from any saved chain
                const getExistingModulesForGrade=grade=>{
                  for(const link of crossGradeLinks){
                    const mods=(link.grade_modules||{})[grade];
                    if(mods&&mods.length>0)return mods;
                  }
                  return[];
                };

                const selChain=allChains.find(c=>chainId(c)===cgmPair)||null;
                const topGrade=selChain?selChain[selChain.length-1]:null;
                const lowerGrades=selChain?selChain.slice(0,-1):[];
                const topSkills=topGrade?getPivotSkillsForGrade(topGrade):[];
                const savedLink=crossGradeLinks.find(h=>h.id===cgmPair)||null;

                // Lower grade modules info
                const lowerModsInfo=lowerGrades.map(g=>({grade:g,modules:getExistingModulesForGrade(g)}));
                const isBasePair=selChain?.length===2;
                const lowerHasModules=lowerModsInfo.every(gm=>gm.modules.length>0);

                // Prompt generation
                let cgmPrompt='';
                if(selChain&&topSkills.length){
                  const topSkillLines=topSkills.map(s=>`- skill_id: "${s.skill_id}" | название: "${s.skill_name}" | раздел: ${s.section} | кластер: ${s.cluster}`).join('\n');

                  if(isBasePair&&!lowerHasModules){
                    // Base case: no existing modules — AI groups BOTH grades
                    const lowerGrade=lowerGrades[0];
                    const lowerSkills=getPivotSkillsForGrade(lowerGrade);
                    const lowerSkillLines=lowerSkills.map(s=>`- skill_id: "${s.skill_id}" | название: "${s.skill_name}" | раздел: ${s.section} | кластер: ${s.cluster}`).join('\n');
                    cgmPrompt=
`Ты — главный методолог образовательной платформы AAPA. Настраиваем Cross-Grade Mapping между ${lowerGrade} и ${topGrade}.

ЗАДАЧА:
1. Сгруппируй pivot-навыки ${lowerGrade} в тематические модули (3–8 навыков в модуль). Модули ${lowerGrade} НЕ имеют пресреквизитов — это базовый класс.
2. Сгруппируй pivot-навыки ${topGrade} в тематические модули.
3. Для каждого модуля ${topGrade} укажи prerequisite_modules — ТОЛЬКО прямые пресреквизиты из модулей ${lowerGrade}.

ПРАВИЛО ТРАНЗИТИВНОСТИ: не указывай лишних связей — если A→B и B→C, то A не должен быть прямым пресреквизитом C.

ФОРМАТ (строгий валидный JSON, первый символ {, последний }):
{
  "grade_modules": {
    "${lowerGrade}": [
      { "module_name": "Название модуля", "pivot_skills": ["skill_id_1", "skill_id_2"] }
    ],
    "${topGrade}": [
      { "module_name": "Название модуля", "pivot_skills": ["skill_id_3"], "prerequisite_modules": ["Название модуля из ${lowerGrade}"] }
    ]
  }
}

=== PIVOT SKILLS ${lowerGrade.toUpperCase()} (базовый класс) ===
${lowerSkillLines}

=== PIVOT SKILLS ${topGrade.toUpperCase()} (старший класс) ===
${topSkillLines}

Выдай ТОЛЬКО валидный JSON без пояснений.`;
                  } else {
                    // Multi-grade chain or base pair with existing lower modules
                    const lowerModsSection=lowerModsInfo.map(gm=>{
                      if(gm.modules.length===0)return`--- ${gm.grade} ---\n(модули не найдены, добавьте сначала цепочку без этого класса)`;
                      const lines=gm.modules.map(m=>{
                        const prereqs=(m.prerequisite_modules||[]);
                        return`  - "${m.module_name}"${prereqs.length?' (пресреквизиты: '+prereqs.join(', ')+')':''}`;
                      }).join('\n');
                      return`--- ${gm.grade} ---\n${lines}`;
                    }).join('\n\n');

                    cgmPrompt=
`Ты — главный методолог образовательной платформы AAPA. Настраиваем Cross-Grade Mapping для цепочки ${selChain.join(' → ')}.

ЗАДАЧА:
1. Сгруппируй pivot-навыки ${topGrade} в тематические модули (3–8 навыков в модуль).
2. Для каждого модуля ${topGrade} укажи prerequisite_modules — ПРЯМЫЕ пресреквизиты из списка уже существующих модулей нижних классов (${lowerGrades.join(', ')}).

ПРАВИЛО ТРАНЗИТИВНОСТИ:
Если модуль M из ${lowerGrades[lowerGrades.length-1]} уже является пресреквизитом (прямым или транзитивным) через другой модуль — НЕ указывай его снова как прямую связь. Например: если есть цепочка "Умножение (${lowerGrades[0]})" → "Степени (${lowerGrades[lowerGrades.length-1]})" → "Квадратные уравнения (${topGrade})", то "Умножение" НЕ должен быть прямым пресреквизитом "Квадратных уравнений" — он уже достижим транзитивно.

СУЩЕСТВУЮЩИЕ МОДУЛИ НИЖНИХ КЛАССОВ (не менять их названия):
${lowerModsSection}

ФОРМАТ (строгий валидный JSON, первый символ {, последний }):
{
  "grade_modules": {
    "${topGrade}": [
      { "module_name": "Название модуля", "pivot_skills": ["skill_id_1", "skill_id_2"], "prerequisite_modules": ["Точное название модуля из нижних классов"] }
    ]
  }
}

=== PIVOT SKILLS ${topGrade.toUpperCase()} (нужно сгруппировать) ===
${topSkillLines}

Выдай ТОЛЬКО валидный JSON без пояснений.`;
                  }
                }

                const canGenerate=selChain&&topSkills.length&&(isBasePair||lowerHasModules);

                return(
                  <div style={{marginTop:32}}>
                    <div style={{borderTop:`2px solid ${THEME.border}`,paddingTop:28,marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                      <div>
                        <h2 className="admin-section-title" style={{marginBottom:4}}>🔗 Межклассовые связи (Cross-Grade Mapping)</h2>
                        <p style={{color:THEME.textLight,fontSize:14,margin:0}}>Группировка навыков в модули и связывание модулей между классами · {crossGradeLinks.length} записей</p>
                      </div>
                      <div style={{display:'flex',gap:8,flexShrink:0,flexWrap:'wrap'}}>
                        {crossGradeLinks.length>0&&(
                          <button onClick={()=>setShowModuleTree(true)}
                            style={{background:'#eff6ff',color:'#4338ca',border:'1px solid #c7d2fe',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                            🌳 Дерево модулей
                          </button>
                        )}
                        {crossGradeLinks.length>0&&(
                          <button onClick={deleteAllCrossGradeLinks}
                            style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                            🗑 Удалить все ({crossGradeLinks.length})
                          </button>
                        )}
                      </div>
                    </div>
                    {showModuleTree&&<ModuleTreeModal crossGradeLinks={crossGradeLinks} onClose={()=>setShowModuleTree(false)}/>}

                    {/* Chain selector */}
                    <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                      <label style={{fontSize:12,fontWeight:700,color:THEME.textLight,display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>Выберите цепочку классов</label>
                      <select className="input-field" style={{marginBottom:0,maxWidth:520}} value={cgmPair}
                        onChange={e=>{
                          const id=e.target.value;
                          const chain=allChains.find(c=>chainId(c)===id)||[];
                          setCgmPair(id);
                          setCgmChain(chain);
                          setCgmJsonDraft('');
                        }}>
                        <option value="">— Выберите цепочку —</option>
                        {allChains.map(ch=>{
                          const id=chainId(ch);
                          const has=crossGradeLinks.some(h=>h.id===id);
                          const top=ch[ch.length-1];
                          const cnt=getPivotSkillsForGrade(top).length;
                          return <option key={id} value={id}>{ch.join(' → ')} ({cnt} pivot в {top}){has?' ✓':''}</option>;
                        })}
                      </select>
                      {selChain&&(
                        <div style={{marginTop:10,fontSize:12,color:THEME.textLight}}>
                          Верхний класс: <b>{topGrade}</b> · Нижние: <b>{lowerGrades.join(', ')||'—'}</b>
                          {isBasePair&&!lowerHasModules&&<span style={{marginLeft:8,color:'#92400e',fontWeight:600}}>→ Промпт сгруппирует оба класса (базовая пара)</span>}
                          {!isBasePair&&!lowerHasModules&&<span style={{marginLeft:8,color:'#dc2626',fontWeight:600}}>⚠️ Сначала заполните цепочки для нижних классов</span>}
                        </div>
                      )}
                    </div>

                    {selChain&&(
                      <>
                        {/* Prompt */}
                        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,gap:12,flexWrap:'wrap'}}>
                            <div style={{fontWeight:700,fontSize:14,color:THEME.text}}>{selChain.join(' → ')}: промпт для AI Studio</div>
                            <button disabled={!canGenerate}
                              onClick={()=>navigator.clipboard.writeText(cgmPrompt).then(()=>alert('✓ Промпт скопирован!')).catch(()=>alert('Скопируйте вручную'))}
                              style={{background:canGenerate?'#4338ca':'#94a3b8',color:'#fff',border:'none',borderRadius:8,padding:'9px 18px',fontWeight:700,fontSize:13,cursor:canGenerate?'pointer':'not-allowed',whiteSpace:'nowrap'}}>
                              📋 Скопировать промпт
                            </button>
                          </div>
                          {!topSkills.length&&<div style={{fontSize:13,color:'#dc2626'}}>⚠️ Для {topGrade} нет сохранённых иерархий CDM.</div>}
                          {!isBasePair&&!lowerHasModules&&topSkills.length>0&&(
                            <div style={{fontSize:13,color:'#dc2626'}}>⚠️ Нет сохранённых модулей для нижних классов. Сначала создайте цепочки:
                              {lowerModsInfo.filter(gm=>gm.modules.length===0).map(gm=>(
                                <span key={gm.grade} style={{marginLeft:6,fontWeight:700}}>{gm.grade}</span>
                              ))}
                            </div>
                          )}
                          {canGenerate&&(
                            <details>
                              <summary style={{fontSize:12,color:THEME.textLight,cursor:'pointer',fontWeight:600}}>Показать полный промпт</summary>
                              <textarea readOnly value={cgmPrompt} rows={16}
                                style={{width:'100%',boxSizing:'border-box',marginTop:8,padding:'10px 14px',borderRadius:8,border:`1px solid ${THEME.border}`,fontSize:11,fontFamily:"'Courier New',monospace",lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical'}}/>
                            </details>
                          )}
                        </div>

                        {/* Upload JSON */}
                        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                          <h3 style={{margin:'0 0 4px',fontSize:15,fontWeight:700,color:THEME.text}}>Загрузить результат из AI Studio</h3>
                          <p style={{margin:'0 0 14px',fontSize:13,color:THEME.textLight}}>Вставьте JSON с grade_modules и нажмите «Сохранить»</p>
                          <textarea value={cgmJsonDraft} onChange={e=>setCgmJsonDraft(e.target.value)}
                            placeholder={'{\n  "grade_modules": {\n    "'+topGrade+'": [\n      { "module_name": "...", "pivot_skills": [...], "prerequisite_modules": [...] }\n    ]\n  }\n}'}
                            rows={8}
                            style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:10,border:`1px solid ${THEME.border}`,fontSize:12,fontFamily:"'Courier New',monospace",lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical',marginBottom:12}}/>
                          <button onClick={saveCrossGradeLinks} disabled={cgmSaving||!cgmJsonDraft.trim()}
                            style={{background:cgmJsonDraft.trim()&&!cgmSaving?'#059669':'#94a3b8',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontWeight:700,fontSize:13,cursor:cgmJsonDraft.trim()&&!cgmSaving?'pointer':'not-allowed'}}>
                            {cgmSaving?'Сохранение...':'💾 Сохранить модули'}
                          </button>
                        </div>

                        {/* Saved modules display */}
                        {savedLink&&savedLink.grade_modules&&(
                          <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                              <div>
                                <h3 style={{margin:0,fontSize:15,fontWeight:700,color:THEME.text}}>✓ Сохранённые модули: {selChain.join(' → ')}</h3>
                                <div style={{fontSize:12,color:THEME.textLight,marginTop:4}}>
                                  {Object.values(savedLink.grade_modules).flat().length} модулей · Обновлено: {savedLink.updatedAt?new Date(savedLink.updatedAt).toLocaleString('ru-RU'):'-'}
                                </div>
                              </div>
                              <button onClick={()=>deleteCrossGradeLinks(cgmPair)} style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:6,padding:'4px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                                🗑 Удалить
                              </button>
                            </div>
                            {Object.entries(savedLink.grade_modules).map(([grade,mods])=>(
                              <div key={grade} style={{marginBottom:20}}>
                                <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8}}>{grade}</div>
                                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                                  {(mods||[]).map((mod,mi)=>(
                                    <div key={mi} style={{borderRadius:12,border:`1px solid ${THEME.border}`,overflow:'hidden'}}>
                                      <div style={{background:'#f1f5f9',padding:'10px 16px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                                        <span style={{fontWeight:700,fontSize:14,color:THEME.primary}}>{mod.module_name}</span>
                                        <span style={{background:'rgba(99,102,241,0.1)',color:'#4338ca',fontSize:11,padding:'2px 8px',borderRadius:4,fontWeight:600}}>{(mod.pivot_skills||[]).length} навыков</span>
                                      </div>
                                      <div style={{padding:'10px 16px',display:'flex',flexDirection:'column',gap:6}}>
                                        <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                                          {(mod.pivot_skills||[]).map((sid,si)=>(
                                            <span key={si} style={{background:THEME.bg,color:THEME.text,fontSize:11,padding:'2px 8px',borderRadius:4,border:`1px solid ${THEME.border}`}}>{sid}</span>
                                          ))}
                                        </div>
                                        {(mod.prerequisite_modules||[]).length>0&&(
                                          <div style={{display:'flex',alignItems:'flex-start',gap:6,flexWrap:'wrap',marginTop:4}}>
                                            <span style={{color:THEME.textLight,fontSize:12,flexShrink:0,marginTop:2}}>↳ пресреквизиты:</span>
                                            <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                                              {(mod.prerequisite_modules||[]).map((pm,pi)=>(
                                                <span key={pi} style={{background:'rgba(5,150,105,0.08)',color:'#059669',fontSize:11,padding:'2px 8px',borderRadius:4,border:'1px solid rgba(5,150,105,0.2)',fontWeight:600}}>{pm}</span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── Global CrossGradeMap (Master Map) ── */}
              {(()=>{
                const VL_CFG={ARITHMETIC:{label:'Числа',color:'#2563eb'},ALGEBRA:{label:'Алгебра',color:'#7c3aed'},GEOMETRY:{label:'Геометрия',color:'#059669'},WORD_PROBLEMS:{label:'Текст. задачи',color:'#d97706'}};
                const totalHier=skillHierarchies.length;
                const hierarchiesWithVL=skillHierarchies.filter(h=>(h.clusters||[]).every(c=>c.vertical_line_id)).length;
                const totalPivots=skillHierarchies.reduce((s,h)=>(h.clusters||[]).reduce((cs,c)=>cs+(c.pivot_skills||[]).length,s),0);
                const readyToBuild=totalHier>0;
                return(
                  <div style={{marginTop:32}}>
                    <div style={{borderTop:`2px solid ${THEME.border}`,paddingTop:28,marginBottom:24}}>
                      <h2 className="admin-section-title" style={{marginBottom:4}}>🌐 Мастер-Карта (GlobalSkillMap)</h2>
                      <p style={{color:THEME.textLight,fontSize:14,margin:0}}>Единый граф всех pivot-навыков с межклассовыми связями upstream/downstream</p>
                    </div>

                    {/* Status row */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:24}}>
                      {[
                        {label:'Иерархий CDM',value:totalHier,sub:'разделов загружено',color:'#4338ca'},
                        {label:'С Vertical Lines',value:hierarchiesWithVL,sub:`из ${totalHier} разделов`,color:'#7c3aed'},
                        {label:'Pivot-навыков',value:totalPivots,sub:'во всех разделах',color:'#059669'},
                        {label:'Межкл. связей',value:crossGradeLinks.length,sub:'пар классов',color:'#d97706'},
                      ].map((stat,i)=>(
                        <div key={i} style={{background:'#fff',borderRadius:12,border:`1px solid ${THEME.border}`,padding:'14px 18px'}}>
                          <div style={{fontSize:11,color:THEME.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{stat.label}</div>
                          <div style={{fontWeight:800,fontSize:26,color:stat.color,lineHeight:1}}>{stat.value}</div>
                          <div style={{fontSize:11,color:THEME.textLight,marginTop:4}}>{stat.sub}</div>
                        </div>
                      ))}
                    </div>

                    {/* Build button */}
                    <div style={{background:'linear-gradient(135deg,rgba(15,23,42,0.04),rgba(67,56,202,0.06))',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:4}}>Построить / обновить Мастер-Карту</div>
                          <div style={{fontSize:13,color:THEME.textLight}}>
                            Компилирует все CDM иерархии + Cross-Grade Links в единый граф навыков.<br/>
                            Каждый skill_id получит поля <code style={{background:'rgba(99,102,241,0.1)',padding:'1px 5px',borderRadius:3,fontSize:12}}>vertical_line_id</code>, <code style={{background:'rgba(99,102,241,0.1)',padding:'1px 5px',borderRadius:3,fontSize:12}}>grade</code>, <code style={{background:'rgba(16,185,129,0.1)',padding:'1px 5px',borderRadius:3,fontSize:12,color:'#059669'}}>downstream_skill_ids</code>, <code style={{background:'rgba(217,119,6,0.1)',padding:'1px 5px',borderRadius:3,fontSize:12,color:'#d97706'}}>upstream_skill_ids</code>
                          </div>
                        </div>
                        <button
                          onClick={buildMasterMap}
                          disabled={masterMapBuilding||!readyToBuild}
                          style={{background:readyToBuild&&!masterMapBuilding?THEME.primary:'#94a3b8',color:'#fff',border:'none',borderRadius:10,padding:'12px 28px',fontWeight:700,fontSize:14,cursor:readyToBuild&&!masterMapBuilding?'pointer':'not-allowed',whiteSpace:'nowrap',flexShrink:0}}
                        >
                          {masterMapBuilding?'⏳ Строю...':'🔨 Построить Мастер-Карту'}
                        </button>
                      </div>
                    </div>

                    {/* Master map result */}
                    {masterMap&&(
                      <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,gap:12,flexWrap:'wrap'}}>
                          <div>
                            <h3 style={{margin:'0 0 4px',fontSize:15,fontWeight:700,color:THEME.text}}>✓ Мастер-Карта сохранена</h3>
                            <div style={{fontSize:12,color:THEME.textLight}}>Обновлено: {masterMap.builtAt?new Date(masterMap.builtAt).toLocaleString('ru-RU'):'-'} · Firestore: <code style={{fontSize:11}}>globalSkillMap/master</code></div>
                          </div>
                          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                            <span style={{background:'rgba(15,23,42,0.07)',color:THEME.primary,fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:6}}>{masterMap.stats?.totalSkills||0} навыков</span>
                            <span style={{background:'rgba(5,150,105,0.1)',color:'#059669',fontSize:12,fontWeight:700,padding:'4px 12px',borderRadius:6}}>{masterMap.stats?.connectedSkills||0} связей</span>
                          </div>
                        </div>

                        {/* Grade breakdown */}
                        <div style={{marginBottom:20}}>
                          <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Классы в карте</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                            {(masterMap.stats?.grades||[]).map(g=>{
                              const cnt=Object.values(masterMap.skills||{}).filter(s=>s.grade===g).length;
                              const withDown=Object.values(masterMap.skills||{}).filter(s=>s.grade===g&&s.downstream_skill_ids?.length).length;
                              const withUp=Object.values(masterMap.skills||{}).filter(s=>s.grade===g&&s.upstream_skill_ids?.length).length;
                              return(
                                <div key={g} style={{background:THEME.bg,borderRadius:10,border:`1px solid ${THEME.border}`,padding:'10px 16px',minWidth:140}}>
                                  <div style={{fontWeight:700,fontSize:13,color:THEME.primary,marginBottom:6}}>{g}</div>
                                  <div style={{fontSize:11,color:THEME.textLight,lineHeight:1.6}}>
                                    <div>{cnt} pivot-навыков</div>
                                    {withDown>0&&<div style={{color:'#059669'}}>↓ {withDown} downstream</div>}
                                    {withUp>0&&<div style={{color:'#d97706'}}>↑ {withUp} upstream</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Vertical lines breakdown */}
                        <div style={{marginBottom:20}}>
                          <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Распределение по вертикальным линиям</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                            {Object.entries(VL_CFG).map(([vlId,cfg])=>(
                              <div key={vlId} style={{background:THEME.bg,borderRadius:8,border:`1px solid ${THEME.border}`,padding:'8px 14px',display:'flex',alignItems:'center',gap:8}}>
                                <span style={{width:10,height:10,borderRadius:'50%',background:cfg.color,flexShrink:0,display:'inline-block'}}/>
                                <span style={{fontSize:12,fontWeight:600,color:THEME.text}}>{vlId}</span>
                                <span style={{fontSize:13,fontWeight:800,color:cfg.color}}>{masterMap.stats?.verticalLines?.[vlId]||0}</span>
                              </div>
                            ))}
                            {(()=>{
                              const noVL=Object.values(masterMap.skills||{}).filter(s=>!s.vertical_line_id).length;
                              return noVL>0?<div style={{background:'#fef9c3',borderRadius:8,border:'1px solid #fde68a',padding:'8px 14px',fontSize:12,color:'#92400e',fontWeight:600}}>⚠️ Без VL: {noVL}</div>:null;
                            })()}
                          </div>
                        </div>

                        {/* Sample skill viewer */}
                        {(()=>{
                          const connected=Object.values(masterMap.skills||{}).filter(s=>s.downstream_skill_ids?.length||s.upstream_skill_ids?.length).slice(0,6);
                          if(!connected.length)return null;
                          return(
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>Примеры межклассовых связей</div>
                              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                                {connected.map((sk,i)=>{
                                  const vlCfg=VL_CFG[sk.vertical_line_id];
                                  return(
                                    <div key={i} style={{background:THEME.bg,borderRadius:10,border:`1px solid ${THEME.border}`,padding:'12px 16px'}}>
                                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                                        {vlCfg&&<span style={{background:`${vlCfg.color}18`,color:vlCfg.color,fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:4,flexShrink:0}}>{sk.vertical_line_id}</span>}
                                        <span style={{fontWeight:700,fontSize:13,color:THEME.text}}>{sk.skill_name}</span>
                                        <span style={{fontSize:11,color:THEME.textLight,fontFamily:"'Courier New',monospace",background:'rgba(99,102,241,0.07)',padding:'2px 6px',borderRadius:4,flexShrink:0}}>{sk.skill_id}</span>
                                        <span style={{fontSize:11,color:THEME.textLight,marginLeft:'auto',flexShrink:0}}>{sk.grade}</span>
                                      </div>
                                      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                                        {sk.downstream_skill_ids?.length>0&&(
                                          <div style={{fontSize:11,display:'flex',alignItems:'center',gap:6}}>
                                            <span style={{color:'#059669',fontWeight:700}}>↓ drill-down:</span>
                                            {sk.downstream_skill_ids.map((id,j)=>{
                                              const target=masterMap.skills?.[id];
                                              return <span key={j} style={{background:'rgba(5,150,105,0.08)',color:'#059669',padding:'2px 7px',borderRadius:4,border:'1px solid rgba(5,150,105,0.2)'}}>{target?.skill_name||id}</span>;
                                            })}
                                          </div>
                                        )}
                                        {sk.upstream_skill_ids?.length>0&&(
                                          <div style={{fontSize:11,display:'flex',alignItems:'center',gap:6}}>
                                            <span style={{color:'#d97706',fontWeight:700}}>↑ путь выше:</span>
                                            {sk.upstream_skill_ids.map((id,j)=>{
                                              const target=masterMap.skills?.[id];
                                              return <span key={j} style={{background:'rgba(217,119,6,0.08)',color:'#d97706',padding:'2px 7px',borderRadius:4,border:'1px solid rgba(217,119,6,0.2)'}}>{target?.skill_name||id}</span>;
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Task Bank ── */}
              {(()=>{
                const VL_CFG={ARITHMETIC:{label:'Числа',color:'#2563eb',bg:'rgba(37,99,235,0.07)'},ALGEBRA:{label:'Алгебра',color:'#7c3aed',bg:'rgba(124,58,237,0.07)'},GEOMETRY:{label:'Геометрия',color:'#059669',bg:'rgba(5,150,105,0.07)'},WORD_PROBLEMS:{label:'Текст. задачи',color:'#d97706',bg:'rgba(217,119,6,0.07)'}};
                const gradeNum=parseInt(tbGrade)||0;

                // Все pivot-навыки выбранного класса из всех иерархий
                const tbSkills=tbGrade?(()=>{
                  const result=[];
                  for(const hier of skillHierarchies){
                    const sec=sections.find(s=>s.id===hier.id);
                    if(!sec||sec.specificTarget!==tbGrade)continue;
                    for(const cl of(hier.clusters||[])){
                      for(const ps of(cl.pivot_skills||[])){
                        if(!ps.skill_id)continue;
                        result.push({...ps,cluster_name:cl.cluster_name,vertical_line_id:cl.vertical_line_id||null,section:sec.name});
                      }
                    }
                  }
                  return result;
                })():[];

                const tbSelected=tbSkillId?tbSkills.find(s=>s.skill_id===tbSkillId):null;
                const gradesWithHier=[...new Set(skillHierarchies.map(h=>sections.find(s=>s.id===h.id)?.specificTarget).filter(g=>GRADES_LIST.includes(g)))].sort((a,b)=>GRADES_LIST.indexOf(a)-GRADES_LIST.indexOf(b));

                const tbInputJson=tbSelected?{
                  skill_id:tbSelected.skill_id,
                  vertical_line_id:tbSelected.vertical_line_id||'',
                  grade:gradeNum,
                  skill_name:tbSelected.skill_name,
                  included_skills:tbSelected.impacted_skills||[],
                  description:`Ученик должен применять все навыки из included_skills в комплексе при решении задач уровня ЕНТ.`,
                  typical_error:`Механическое применение отдельных навыков без учёта их взаимодействия в составной задаче.`,
                }:null;

                const tbPromptFull=tbInputJson?`Role: Ты — Ведущий Методист-Разработчик AAPA. Твоя специализация — создание диагностических задач, которые проверяют комплексные узлы навыков.

Входные данные:
Я буду передавать тебе JSON-объекты навыков. Ключевые поля:

skill_id: Уникальный идентификатор узла.

included_skills: МАССИВ конкретных микро-навыков, которые входят в этот узел.

description: Общее описание цели обучения.

typical_error: Самая частая точка отказа.

Твой Методический Алгоритм (Строгое исполнение):

Протокол Покрытия (Inclusion Check): При создании задачи ты ОБЯЗАН сконструировать условие так, чтобы ученик не мог получить верный ответ, не применив КАЖДЫЙ пункт из массива included_skills.

Диагностическая Структура: Для каждого skill_id генерируй 3 варианта задач:

Task 1 (Standard): Прямая проверка всех included_skills.

Task 2 (Contextual): Прикладная задача (Word Problem), требующая перевода текста в модель с использованием всех included_skills.

Task 3 (Compound/Hard): Многошаговая задача, где ошибка в одном из микро-навыков ведет к конкретному дистрактору.

Технический формат (JSON):

{
  "skill_id": "string",
  "vertical_line_id": "string",
  "grade": number,
  "tasks": [
    {
      "task_id": "string_id",
      "type": "mcq | compound",
      "question_text": "Текст (LaTeX: $...$)",
      "options": ["A", "B", "C", "D"],
      "correct_index": number,
      "explanation": "Пошаговый разбор: как был применен каждый навык из included_skills.",
      "skills_tested": ["Список реально задействованных навыков из входящего массива"]
    }
  ]
}

Требования к качеству:

Используй typical_error для формирования Option A или Option B.

Текст задач должен быть на русском языке.

Математическая нотация — строго в LaTeX.

Никаких вводных слов. На выходе должен быть только валидный JSON. Первый символ {, последний }.

Входной JSON навыка:
${JSON.stringify(tbInputJson,null,2)}`:'';

                return(
                  <div style={{marginTop:32}}>
                    <div style={{borderTop:`2px solid ${THEME.border}`,paddingTop:28,marginBottom:24}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap',marginBottom:tbBulkRunning||tbBulkResults.length>0?16:0}}>
                        <div>
                          <h2 className="admin-section-title" style={{marginBottom:4}}>🧩 Банк диагностических задач</h2>
                          <p style={{color:THEME.textLight,fontSize:14,margin:0}}>Генерация задач по каждому skill_id через AI Studio или Gemini</p>
                        </div>
                        {tbGrade&&tbSkills.length>0&&(
                          <button onClick={()=>bulkGenerateTaskBank(tbSkills,gradeNum)} disabled={tbBulkRunning}
                            style={{background:tbBulkRunning?'#94a3b8':'#7c3aed',color:'#fff',border:'none',borderRadius:8,padding:'10px 22px',fontWeight:700,fontSize:13,cursor:tbBulkRunning?'not-allowed':'pointer',whiteSpace:'nowrap',flexShrink:0}}>
                            {tbBulkRunning?'⏳ Генерирую...':'⚡ Сгенерировать весь класс'}
                          </button>
                        )}
                      </div>

                      {/* Bulk progress */}
                      {(tbBulkRunning||tbBulkResults.length>0)&&(()=>{
                        const done=tbBulkResults.filter(r=>r.status==='success'||r.status==='skipped'||r.status==='exists').length;
                        const total=tbBulkResults.length;
                        const pct=total>0?Math.round((done/total)*100):0;
                        const STATUS_LABEL={pending:'ожидает',loading:'генерация…',retrying:'повтор…',success:'✓',skipped:'пропущен',exists:'уже есть'};
                        const STATUS_COLOR={pending:'#94a3b8',loading:'#3b82f6',retrying:'#f59e0b',success:'#059669',skipped:'#dc2626',exists:'#6366f1'};
                        return(
                          <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:16,marginBottom:0}}>
                            {/* Progress bar */}
                            {tbBulkRunning&&(
                              <div style={{marginBottom:12}}>
                                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:THEME.textLight,marginBottom:4}}>
                                  <span>{done} / {total} навыков</span><span>{pct}%</span>
                                </div>
                                <div style={{background:'#e2e8f0',borderRadius:99,height:6,overflow:'hidden'}}>
                                  <div style={{width:`${pct}%`,height:'100%',background:'#7c3aed',borderRadius:99,transition:'width .3s ease'}}/>
                                </div>
                              </div>
                            )}
                            {/* Summary */}
                            {tbBulkSummary&&!tbBulkRunning&&(
                              <div style={{background:tbBulkSummary.skipped===0?'rgba(5,150,105,0.08)':'rgba(245,158,11,0.08)',borderRadius:8,padding:'8px 14px',marginBottom:10,fontSize:13,fontWeight:700,color:tbBulkSummary.skipped===0?'#059669':'#b45309',textAlign:'center'}}>
                                {tbBulkSummary.total===0?`Нет навыков для класса`:[
                                  `✓ Сгенерировано: ${tbBulkSummary.success}`,
                                  tbBulkSummary.exists>0?`Пропущено (уже есть): ${tbBulkSummary.exists}`:null,
                                  tbBulkSummary.skipped>0?`Ошибка: ${tbBulkSummary.skipped}`:null,
                                  `/ ${tbBulkSummary.total} всего`,
                                ].filter(Boolean).join(' · ')}
                              </div>
                            )}
                            {/* Per-skill list */}
                            <div style={{maxHeight:220,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
                              {tbBulkResults.map(r=>(
                                <div key={r.skillId} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',borderRadius:7,background:r.status==='success'?'rgba(5,150,105,0.05)':r.status==='skipped'?'rgba(220,38,38,0.05)':'transparent'}}>
                                  <span style={{fontFamily:"'Courier New',monospace",fontSize:11,color:'#6366f1',background:'rgba(99,102,241,0.08)',padding:'1px 6px',borderRadius:3,flexShrink:0}}>{r.skillId}</span>
                                  <span style={{fontSize:12,color:THEME.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.skillName}</span>
                                  {r.retried&&r.status!=='skipped'&&<span style={{fontSize:10,color:'#f59e0b',background:'rgba(245,158,11,0.1)',padding:'1px 5px',borderRadius:3,flexShrink:0}}>retry</span>}
                                  {r.status==='success'&&r.taskCount&&<span style={{fontSize:11,color:THEME.textLight,flexShrink:0}}>{r.taskCount} задач</span>}
                                  {r.status==='skipped'&&r.error&&<span style={{fontSize:10,color:'#dc2626',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',flexShrink:0}} title={r.error}>{r.error}</span>}
                                  <span style={{fontSize:11,fontWeight:700,color:STATUS_COLOR[r.status]||'#94a3b8',flexShrink:0}}>{STATUS_LABEL[r.status]||r.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Grade selector */}
                    <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                      <label style={{fontSize:12,fontWeight:700,color:THEME.textLight,display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.5px'}}>Выберите класс</label>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {gradesWithHier.map(g=>{
                          const cnt=skillHierarchies.filter(h=>sections.find(s=>s.id===h.id)?.specificTarget===g).reduce((s,h)=>(h.clusters||[]).reduce((cs,c)=>cs+(c.pivot_skills||[]).length,s),0);
                          const saved=taskBankEntries.filter(e=>tbGrade===g||tbSkills.some(sk=>sk.skill_id===e.id)).length;
                          return(
                            <button key={g} onClick={()=>{setTbGrade(g);setTbSkillId('');setTbJsonDraft('');}}
                              style={{padding:'8px 18px',borderRadius:8,border:`2px solid ${tbGrade===g?THEME.primary:THEME.border}`,background:tbGrade===g?THEME.primary:'#fff',color:tbGrade===g?'#fff':THEME.text,fontWeight:700,fontSize:13,cursor:'pointer',transition:'all 0.15s'}}>
                              {g} <span style={{fontSize:11,opacity:0.75}}>({cnt} навыков)</span>
                            </button>
                          );
                        })}
                        {gradesWithHier.length===0&&<div style={{fontSize:13,color:THEME.textLight}}>⚠️ Нет разделов с сохранёнными CDM иерархиями</div>}
                      </div>
                    </div>

                    {tbGrade&&tbSkills.length>0&&(
                      <div style={{display:'grid',gridTemplateColumns:'minmax(280px,1fr) 2fr',gap:20,alignItems:'start'}}>

                        {/* Left: skill list */}
                        <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,overflow:'hidden',maxHeight:620,overflowY:'auto'}}>
                          <div style={{padding:'14px 18px',borderBottom:`1px solid ${THEME.border}`,position:'sticky',top:0,background:'#fff',zIndex:1}}>
                            <div style={{fontWeight:700,fontSize:14,color:THEME.primary}}>{tbGrade}</div>
                            <div style={{fontSize:12,color:THEME.textLight,marginTop:2}}>{tbSkills.length} pivot-навыков</div>
                          </div>
                          {(()=>{
                            const byVl={};
                            for(const sk of tbSkills){
                              const vl=sk.vertical_line_id||'OTHER';
                              if(!byVl[vl])byVl[vl]=[];
                              byVl[vl].push(sk);
                            }
                            return Object.entries(byVl).map(([vl,skills])=>{
                              const cfg=VL_CFG[vl];
                              return(
                                <div key={vl}>
                                  <div style={{padding:'8px 18px',background:cfg?cfg.bg:'#f8fafc',borderBottom:`1px solid ${THEME.border}`,fontSize:11,fontWeight:700,color:cfg?cfg.color:THEME.textLight,textTransform:'uppercase',letterSpacing:'0.5px'}}>{vl}</div>
                                  {skills.map(sk=>{
                                    const hasTasks=taskBankEntries.some(e=>e.id===sk.skill_id);
                                    const isActive=tbSkillId===sk.skill_id;
                                    return(
                                      <button key={sk.skill_id} onClick={()=>{setTbSkillId(sk.skill_id);setTbJsonDraft('');}}
                                        style={{width:'100%',textAlign:'left',padding:'10px 18px',border:'none',borderBottom:`1px solid ${THEME.border}`,background:isActive?`${cfg?.bg||'#f1f5f9'}`:'#fff',cursor:'pointer',transition:'background 0.1s'}}>
                                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                                          <span style={{fontFamily:"'Courier New',monospace",fontSize:11,color:cfg?.color||THEME.textLight,background:cfg?cfg.bg:'#f1f5f9',padding:'1px 6px',borderRadius:3,fontWeight:700,flexShrink:0}}>{sk.skill_id}</span>
                                          {hasTasks&&<span style={{background:'rgba(5,150,105,0.1)',color:'#059669',fontSize:10,fontWeight:700,padding:'1px 5px',borderRadius:3,flexShrink:0}}>✓ задачи</span>}
                                        </div>
                                        <div style={{fontSize:12,fontWeight:isActive?700:500,color:THEME.text,lineHeight:1.4}}>{sk.skill_name}</div>
                                        <div style={{fontSize:11,color:THEME.textLight,marginTop:2}}>{(sk.impacted_skills||[]).length} навыков · {sk.cluster_name}</div>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* Right: prompt + upload panel */}
                        <div>
                          {!tbSelected&&(
                            <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:40,textAlign:'center'}}>
                              <div style={{fontSize:32,marginBottom:12}}>👈</div>
                              <div style={{fontSize:14,color:THEME.textLight}}>Выберите навык из списка слева</div>
                            </div>
                          )}
                          {tbSelected&&(()=>{
                            const cfg=VL_CFG[tbSelected.vertical_line_id];
                            const savedEntry=taskBankEntries.find(e=>e.id===tbSelected.skill_id);
                            return(
                              <>
                                {/* Skill header */}
                                <div style={{background:'#fff',borderRadius:16,border:`1px solid ${cfg?cfg.color+33:THEME.border}`,padding:20,marginBottom:16}}>
                                  <div style={{display:'flex',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                                    <div style={{flex:1}}>
                                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                                        {cfg&&<span style={{background:cfg.bg,color:cfg.color,fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:4}}>{tbSelected.vertical_line_id}</span>}
                                        <span style={{fontFamily:"'Courier New',monospace",fontSize:12,color:cfg?.color||THEME.text,fontWeight:700}}>{tbSelected.skill_id}</span>
                                        <span style={{fontSize:12,color:THEME.textLight}}>{tbGrade} · {tbSelected.section}</span>
                                      </div>
                                      <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:8}}>{tbSelected.skill_name}</div>
                                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                                        {(tbSelected.impacted_skills||[]).map((sk,i)=>(
                                          <span key={i} style={{background:'rgba(99,102,241,0.07)',color:'#4338ca',fontSize:11,padding:'3px 8px',borderRadius:5,border:'1px solid rgba(99,102,241,0.2)'}}>{sk}</span>
                                        ))}
                                        {(tbSelected.impacted_skills||[]).length===0&&<span style={{fontSize:12,color:THEME.textLight,fontStyle:'italic'}}>нет навыков в impacted_skills</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Auto-generate */}
                                <div style={{background:'linear-gradient(135deg,rgba(124,58,237,0.06),rgba(67,56,202,0.06))',borderRadius:12,border:'1px solid rgba(124,58,237,0.2)',padding:'16px 20px',marginBottom:16}}>
                                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                                    <div>
                                      <div style={{fontWeight:700,fontSize:14,color:'#4c1d95'}}>🤖 Генерировать через Gemini</div>
                                      <div style={{fontSize:12,color:'#6d28d9',marginTop:2}}>3 задачи (Standard + Contextual + Compound) — сразу сохранит</div>
                                    </div>
                                    <button onClick={()=>autoGenerateTaskBank(tbSelected,gradeNum)} disabled={tbGenerating}
                                      style={{background:tbGenerating?'#94a3b8':'#7c3aed',color:'#fff',border:'none',borderRadius:8,padding:'10px 22px',fontWeight:700,fontSize:13,cursor:tbGenerating?'not-allowed':'pointer',whiteSpace:'nowrap',flexShrink:0}}>
                                      {tbGenerating?'⏳ Генерирую...':'✨ Генерировать'}
                                    </button>
                                  </div>
                                </div>

                                {/* Manual prompt */}
                                <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:20,marginBottom:16}}>
                                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,gap:12,flexWrap:'wrap'}}>
                                    <div style={{fontSize:13,fontWeight:600,color:THEME.text}}>Или вручную — промпт для AI Studio</div>
                                    <button onClick={()=>navigator.clipboard.writeText(tbPromptFull).then(()=>alert('✓ Промпт скопирован!')).catch(()=>alert('Скопируйте вручную'))}
                                      style={{background:'#4338ca',color:'#fff',border:'none',borderRadius:8,padding:'7px 16px',fontWeight:700,fontSize:12,cursor:'pointer',whiteSpace:'nowrap'}}>
                                      📋 Скопировать промпт
                                    </button>
                                  </div>
                                  <details>
                                    <summary style={{fontSize:12,color:THEME.textLight,cursor:'pointer',fontWeight:600}}>Показать промпт</summary>
                                    <textarea readOnly value={tbPromptFull} rows={10}
                                      style={{width:'100%',boxSizing:'border-box',marginTop:8,padding:'10px 14px',borderRadius:8,border:`1px solid ${THEME.border}`,fontSize:11,fontFamily:"'Courier New',monospace",lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical'}}/>
                                  </details>
                                  <div style={{marginTop:14}}>
                                    <div style={{fontSize:12,fontWeight:600,color:THEME.text,marginBottom:6}}>Вставьте JSON от AI Studio:</div>
                                    <textarea value={tbJsonDraft} onChange={e=>setTbJsonDraft(e.target.value)}
                                      placeholder={'{\n  "skill_id": "...",\n  "tasks": [...]\n}'}
                                      rows={7}
                                      style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:10,border:`1px solid ${THEME.border}`,fontSize:12,fontFamily:"'Courier New',monospace",lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical',marginBottom:10}}/>
                                    <button onClick={saveTaskBankEntry} disabled={tbSaving||!tbJsonDraft.trim()}
                                      style={{background:tbJsonDraft.trim()&&!tbSaving?'#059669':'#94a3b8',color:'#fff',border:'none',borderRadius:8,padding:'10px 24px',fontWeight:700,fontSize:13,cursor:tbJsonDraft.trim()&&!tbSaving?'pointer':'not-allowed'}}>
                                      {tbSaving?'Сохранение...':'💾 Сохранить задачи'}
                                    </button>
                                  </div>
                                </div>

                                {/* Saved tasks */}
                                {savedEntry&&(
                                  <div style={{background:'#fff',borderRadius:16,border:`1px solid rgba(5,150,105,0.3)`,padding:20}}>
                                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                                      <div>
                                        <div style={{fontWeight:700,fontSize:14,color:THEME.text}}>✓ Сохранённые задачи</div>
                                        <div style={{fontSize:12,color:THEME.textLight,marginTop:2}}>{(savedEntry.tasks||[]).length} задач · {savedEntry.savedAt?new Date(savedEntry.savedAt).toLocaleString('ru-RU'):'-'}</div>
                                      </div>
                                      <button onClick={async()=>{if(!confirm('Удалить задачи для '+tbSkillId+'?'))return;await deleteDoc(doc(db,'taskBank',tbSkillId));setTaskBankEntries(p=>p.filter(e=>e.id!==tbSkillId));}}
                                        style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:6,padding:'4px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                                        🗑 Удалить
                                      </button>
                                    </div>
                                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                                      {(savedEntry.tasks||[]).map((t,ti)=>(
                                        <div key={ti} style={{background:THEME.bg,borderRadius:10,border:`1px solid ${THEME.border}`,padding:'12px 16px'}}>
                                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                                            <span style={{background:t.type==='compound'?'rgba(220,38,38,0.1)':'rgba(99,102,241,0.1)',color:t.type==='compound'?'#dc2626':'#4338ca',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,flexShrink:0}}>{t.type?.toUpperCase()}</span>
                                            <span style={{fontFamily:"'Courier New',monospace",fontSize:11,color:THEME.textLight,background:'rgba(0,0,0,0.04)',padding:'1px 6px',borderRadius:3}}>{t.task_id}</span>
                                          </div>
                                          <div style={{fontSize:13,color:THEME.text,lineHeight:1.6,marginBottom:8}}><LatexText text={t.question_text}/></div>
                                          {t.options&&(
                                            <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:8}}>
                                              {t.options.map((opt,oi)=>(
                                                <div key={oi} style={{fontSize:12,padding:'6px 12px',borderRadius:7,background:oi===t.correct_index?'rgba(5,150,105,0.1)':'rgba(0,0,0,0.03)',color:oi===t.correct_index?'#059669':THEME.text,fontWeight:oi===t.correct_index?700:400,border:`1px solid ${oi===t.correct_index?'rgba(5,150,105,0.3)':THEME.border}`,display:'flex',alignItems:'baseline',gap:6}}>
                                                  <span style={{flexShrink:0,fontWeight:700}}>{String.fromCharCode(65+oi)})</span>
                                                  <LatexText text={opt}/>
                                                  {oi===t.correct_index&&<span style={{marginLeft:'auto',fontSize:10,flexShrink:0}}>✓ верно</span>}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {t.explanation&&(
                                            <details style={{marginTop:4}}>
                                              <summary style={{fontSize:11,color:THEME.textLight,cursor:'pointer',fontWeight:600}}>Разбор решения</summary>
                                              <div style={{fontSize:12,color:THEME.text,marginTop:8,lineHeight:1.7}}><LatexText text={t.explanation}/></div>
                                            </details>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                    {tbGrade&&tbSkills.length===0&&(
                      <div style={{background:'#fff',borderRadius:16,border:`1px solid ${THEME.border}`,padding:32,textAlign:'center',color:THEME.textLight,fontSize:13}}>
                        ⚠️ Для {tbGrade} нет сохранённых CDM иерархий. Сначала создайте иерархию в блоке выше.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ── SIMULATOR TAB ── */}
        {tab==="simulator"&&(()=>{
          const SIM_STRATEGIES=[
            {id:"ALWAYS_WRONG",    label:"Всегда неверно",                desc:"Максимальный DFS-спуск — тест экстремального пути вглубь"},
            {id:"ALWAYS_CORRECT",  label:"Всегда верно",                  desc:"Идеальный ученик — тест быстрого MASTERED-прохода"},
            {id:"RANDOM",          label:"Случайно (50/50)",              desc:"Реалистичный микс верных/неверных ответов"},
            {id:"WRONG_ON_TARGET", label:"Верно ниже, неверно на цели",   desc:"Знает фундамент, но не целевой класс — тест поднятия вверх"},
            {id:"CORRECT_ON_TARGET",label:"Верно на цели, неверно ниже", desc:"Знает целевой класс, но не фундамент — тест deep-drill"},
          ];

          const runSim = () => {
            setSimRunning(true); setSimResult(null);
            // setTimeout чтобы React успел перерисовать кнопку в "Выполняется..."
            setTimeout(() => {
              const result = runDiagnosticSimulation({
                taskBankEntries,
                targetGrade: simGrade,
                strategy: simStrategy,
                maxSteps: Math.min(Math.max(simMaxSteps, 10), 500),
              });
              setSimResult(result);
              setSimView("chart");
              setSimHoverStep(null);
              setSimRunning(false);
            }, 40);
          };

          // ── SVG Flowchart ────────────────────────────────────────────────
          const SimChart = ({ logs, sectionBreaks }) => {
            if (!logs?.length) return null;
            const LPAD = 52, RPAD = 16, TPAD = 28, BPAD = 36;
            const STEP_W = Math.max(4, Math.min(16, Math.floor(900 / logs.length)));
            const chartW = LPAD + logs.length * STEP_W + RPAD;
            const chartH = 320;
            const plotH  = chartH - TPAD - BPAD;

            const grades   = logs.map(l => l.skillGrade).filter(g => g > 0);
            const minG     = Math.max(4, Math.min(...grades) - 1);
            const maxG     = Math.min(13, Math.max(...grades) + 1);
            const gRange   = maxG - minG || 1;
            const yG       = g => TPAD + (maxG - g) / gRange * plotH;
            const xS       = s => LPAD + (s - 1) * STEP_W + STEP_W / 2;

            // Phase color — узел
            const nodeColor = log => {
              if (log.isCorrect) return "#22c55e";
              if (log.skillStatus === 'BLOCKED') return "#ef4444";
              return "#f97316";
            };

            return (
              <div style={{overflowX:"auto",background:"#0f172a",borderRadius:14,border:"1px solid rgba(255,255,255,0.08)",padding:"0 0 4px"}}>
                <svg width={chartW} height={chartH} style={{display:"block"}}>
                  {/* Grade grid lines */}
                  {Array.from({length: maxG - minG + 1}, (_,i) => minG + i).map(g => (
                    <g key={g}>
                      <line x1={LPAD} y1={yG(g)} x2={chartW - RPAD} y2={yG(g)} stroke="rgba(255,255,255,0.07)" strokeWidth={1}/>
                      <text x={LPAD - 6} y={yG(g) + 4} textAnchor="end" fontSize={10} fill="#64748b" fontFamily="Inter">{g}кл</text>
                    </g>
                  ))}

                  {/* Section break vertical lines */}
                  {sectionBreaks.map((s, si) => (
                    <g key={si}>
                      <line x1={xS(s) + STEP_W/2} y1={TPAD - 10} x2={xS(s) + STEP_W/2} y2={chartH - BPAD + 4}
                        stroke="#D4AF37" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7}/>
                      <text x={xS(s) + STEP_W/2 + 3} y={TPAD - 2} fontSize={9} fill="#D4AF37" fontFamily="Inter" fontWeight="700">§{si + 1}</text>
                    </g>
                  ))}

                  {/* Path lines between steps */}
                  {logs.slice(1).map((log, i) => {
                    const prev = logs[i];
                    const g1 = prev.skillGrade, g2 = log.skillGrade;
                    if (!g1 || !g2) return null;
                    const isSec = sectionBreaks.includes(i + 1); // section break between i and i+1
                    return (
                      <line key={i}
                        x1={xS(i + 1)} y1={yG(g1)}
                        x2={xS(i + 2)} y2={yG(g2)}
                        stroke={isSec ? "rgba(212,175,55,0.25)" : "rgba(148,163,184,0.3)"}
                        strokeWidth={1}
                      />
                    );
                  })}

                  {/* Step nodes */}
                  {logs.map((log, i) => {
                    const g = log.skillGrade;
                    if (!g) return null;
                    const x = xS(i + 1), y = yG(g);
                    const isHover = simHoverStep === i;
                    const r = isHover ? 5 : (STEP_W >= 8 ? 3.5 : 2.5);
                    return (
                      <circle key={i}
                        cx={x} cy={y} r={r}
                        fill={nodeColor(log)}
                        opacity={isHover ? 1 : 0.85}
                        style={{cursor:"pointer"}}
                        onMouseEnter={() => setSimHoverStep(i)}
                        onMouseLeave={() => setSimHoverStep(null)}
                      >
                        <title>Шаг {log.step} · {log.skillId} · {log.skillGrade}кл · {log.isCorrect?"✓":"✗"} · {log.phase}</title>
                      </circle>
                    );
                  })}

                  {/* X axis tick labels every ~20 steps */}
                  {logs.filter((_,i) => i % Math.max(1, Math.floor(logs.length / 15)) === 0).map((log, i) => (
                    <text key={i} x={xS(log.step)} y={chartH - BPAD + 16} textAnchor="middle" fontSize={9} fill="#475569" fontFamily="Inter">{log.step}</text>
                  ))}

                  {/* Chart title */}
                  <text x={LPAD} y={14} fontSize={10} fill="#94a3b8" fontFamily="Inter">Класс навыка</text>
                  <text x={chartW - RPAD} y={chartH - 4} textAnchor="end" fontSize={10} fill="#94a3b8" fontFamily="Inter">Шаг →</text>
                </svg>

                {/* Legend */}
                <div style={{display:"flex",gap:16,padding:"8px 16px",fontSize:11,color:"#94a3b8",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                  {[["#22c55e","Верный ответ"],["#f97316","Неверный (ACTIVE)"],["#ef4444","BLOCKED"],["#D4AF37","Граница раздела"]].map(([c,l])=>(
                    <span key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:c,flexShrink:0}}/>
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            );
          };

          // ── Hover detail card ────────────────────────────────────────────
          const hLog = simHoverStep != null && simResult?.logs?.[simHoverStep];

          return (
            <div>
              <div className="admin-section-header">
                <div>
                  <h2 className="admin-section-title">🧪 Diagnostic Headless Simulator</h2>
                  <p style={{color:THEME.textLight,fontSize:14,margin:0}}>Прогон алгоритма диагностики без записи в БД — тест корректности DFS-маршрутизатора</p>
                </div>
              </div>

              {/* ── Config Panel ── */}
              <div style={{background:"#fff",borderRadius:16,border:`1px solid ${THEME.border}`,padding:24,marginBottom:24}}>
                <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:16}}>⚙️ Параметры симуляции</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16,marginBottom:20}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:THEME.textLight,marginBottom:6}}>Целевой класс ученика</div>
                    <select value={simGrade} onChange={e=>setSimGrade(e.target.value)}
                      style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,fontSize:14,background:"#fff",color:THEME.text,cursor:"pointer"}}>
                      {GRADES_LIST.map(g=><option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:THEME.textLight,marginBottom:6}}>Макс. шагов (предохранитель)</div>
                    <input type="number" min={10} max={500} value={simMaxSteps} onChange={e=>setSimMaxSteps(Number(e.target.value))}
                      style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:8,border:`1px solid ${THEME.border}`,fontSize:14,color:THEME.text}}/>
                  </div>
                </div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:600,color:THEME.textLight,marginBottom:8}}>Стратегия ответов</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {SIM_STRATEGIES.map(s=>(
                      <button key={s.id} onClick={()=>setSimStrategy(s.id)}
                        style={{padding:"8px 14px",borderRadius:10,border:`1px solid ${simStrategy===s.id?THEME.primary:THEME.border}`,
                          background:simStrategy===s.id?THEME.primary:"#fff",
                          color:simStrategy===s.id?"#fff":THEME.text,
                          fontWeight:simStrategy===s.id?700:500,fontSize:13,cursor:"pointer",textAlign:"left"}}>
                        <div style={{fontWeight:600}}>{s.label}</div>
                        <div style={{fontSize:11,opacity:0.7,marginTop:2}}>{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <button onClick={runSim} disabled={simRunning||taskBankEntries.length===0}
                    style={{background:simRunning||taskBankEntries.length===0?"#94a3b8":`linear-gradient(135deg,#0f172a,#1e3a5f)`,
                      color:"#D4AF37",border:"none",borderRadius:12,padding:"12px 32px",
                      fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:15,
                      cursor:simRunning||taskBankEntries.length===0?"not-allowed":"pointer",
                      boxShadow:"0 4px 14px rgba(15,23,42,0.3)"}}>
                    {simRunning?"⏳ Симуляция...":"▶ Запустить симуляцию"}
                  </button>
                  {taskBankEntries.length===0&&(
                    <div style={{fontSize:13,color:THEME.error}}>⚠️ TaskBank пуст — сначала добавьте задачи в CDM</div>
                  )}
                  {simResult&&!simResult.error&&(
                    <div style={{fontSize:13,color:THEME.success}}>✓ Симуляция завершена · {simResult.totalSteps} шагов · {simResult.totalSections} разделов</div>
                  )}
                </div>
                {simResult?.error&&(
                  <div style={{marginTop:14,padding:"12px 16px",borderRadius:10,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",fontSize:13,color:THEME.error}}>
                    ⚠️ {simResult.error}
                  </div>
                )}
              </div>

              {/* ── Results ── */}
              {simResult&&!simResult.error&&(()=>{
                const { totalSteps, totalSections, sectionBreaks, logs, roadmapData, finalStats } = simResult;

                return (
                  <>
                    {/* Summary cards */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12,marginBottom:20}}>
                      {[
                        {label:"Всего шагов",  value:totalSteps,                     color:"#2563eb"},
                        {label:"Разделов",      value:totalSections,                  color:"#D4AF37"},
                        {label:"MASTERED",      value:finalStats.mastered,            color:"#10B981"},
                        {label:"BLOCKED",       value:finalStats.blocked,             color:"#ef4444"},
                        {label:"Навыков в банке",value:finalStats.taskBankSize,       color:"#7c3aed"},
                        {label:"Пробелов найдено",value:roadmapData?.total_gap_skills||0,color:"#f97316"},
                      ].map(card=>(
                        <div key={card.label} style={{background:"#fff",borderRadius:12,border:`1px solid ${THEME.border}`,padding:"14px 16px",textAlign:"center"}}>
                          <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:24,fontWeight:800,color:card.color}}>{card.value}</div>
                          <div style={{fontSize:11,color:THEME.textLight,marginTop:4}}>{card.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* View tabs */}
                    <div style={{display:"flex",gap:4,background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:10,padding:4,width:"fit-content",marginBottom:16,flexWrap:"wrap"}}>
                      {[{id:"chart",label:"📊 Граф навигации"},{id:"log",label:"📋 Лог"},{id:"roadmap",label:"🗺️ Дорожная карта"},{id:"skilltree",label:"🌳 Дерево навыков"}].map(v=>(
                        <button key={v.id} onClick={()=>setSimView(v.id)}
                          style={{padding:"8px 16px",borderRadius:7,border:"none",
                            background:simView===v.id?THEME.primary:"transparent",
                            color:simView===v.id?"#fff":THEME.textLight,
                            fontWeight:600,fontSize:13,cursor:"pointer"}}>
                          {v.label}
                        </button>
                      ))}
                    </div>

                    {/* ── Chart view ── */}
                    {simView==="chart"&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:16,alignItems:"start"}}>
                        <div>
                          <div style={{fontSize:12,color:THEME.textLight,marginBottom:8}}>
                            Навигация DFS-маршрутизатора · Y = класс навыка · X = номер шага
                            {sectionBreaks.length > 0 && ` · ${sectionBreaks.length} раздел(а) (§1–§${sectionBreaks.length})`}
                          </div>
                          <SimChart logs={logs} sectionBreaks={sectionBreaks}/>
                        </div>

                        {/* Hover detail panel */}
                        <div style={{width:240,background:"#fff",borderRadius:12,border:`1px solid ${THEME.border}`,padding:16,minHeight:200,flexShrink:0}}>
                          {hLog?(
                            <>
                              <div style={{fontSize:11,fontWeight:700,color:THEME.textLight,marginBottom:10}}>ШАГ {hLog.step} / РАЗДЕЛ {hLog.section}</div>
                              {[
                                ["Навык",     hLog.skillId],
                                ["Класс",     `${hLog.skillGrade} класс`],
                                ["Вертикаль", hLog.vertical],
                                ["Ответ",     hLog.isCorrect?"✅ Верно":"❌ Неверно"],
                                ["Фаза",      hLog.phase],
                                ["Статус навыка", hLog.skillStatus],
                                ["Стек (после)", hLog.stackSize],
                                ["MASTERED",  hLog.masteredCount],
                                ["BLOCKED",   hLog.blockedCount],
                                ["Сессия",    hLog.sessionStatus],
                              ].map(([k,v])=>(
                                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${THEME.border}`,gap:8}}>
                                  <span style={{fontSize:11,color:THEME.textLight,flexShrink:0}}>{k}</span>
                                  <span style={{fontSize:11,fontWeight:600,color:THEME.text,textAlign:"right",wordBreak:"break-all"}}>{v}</span>
                                </div>
                              ))}
                            </>
                          ):(
                            <div style={{textAlign:"center",padding:"40px 0",color:THEME.textLight,fontSize:13}}>
                              Наведите на<br/>узел графа
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Log view ── */}
                    {simView==="log"&&(
                      <div style={{background:"#fff",borderRadius:14,border:`1px solid ${THEME.border}`,overflow:"hidden"}}>
                        <div style={{overflowX:"auto",maxHeight:520,overflowY:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead>
                              <tr style={{background:THEME.bg,position:"sticky",top:0}}>
                                {["#","Раздел","Навык ID","Класс","Вертикаль","Ответ","Стек","Фаза","Статус навыка","Сессия"].map(h=>(
                                  <th key={h} style={{padding:"9px 12px",textAlign:"left",fontWeight:700,color:THEME.textLight,borderBottom:`1px solid ${THEME.border}`,whiteSpace:"nowrap"}}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {logs.map((log, i) => {
                                const isSectionEnd = sectionBreaks.includes(log.step);
                                return (
                                  <tr key={i}
                                    style={{background:isSectionEnd?"rgba(212,175,55,0.07)":log.isCorrect?"rgba(16,185,129,0.04)":"rgba(239,68,68,0.04)",
                                      borderBottom:`1px solid ${THEME.border}`}}
                                    onMouseEnter={()=>setSimHoverStep(i)}
                                    onMouseLeave={()=>setSimHoverStep(null)}>
                                    <td style={{padding:"7px 12px",fontWeight:600,color:THEME.textLight}}>{log.step}</td>
                                    <td style={{padding:"7px 12px"}}>{log.section}</td>
                                    <td style={{padding:"7px 12px",fontFamily:"'Courier New',monospace",fontSize:11,color:THEME.primary,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={log.skillId}>{log.skillId}</td>
                                    <td style={{padding:"7px 12px",textAlign:"center"}}>{log.skillGrade}</td>
                                    <td style={{padding:"7px 12px",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={log.vertical}>{log.vertical}</td>
                                    <td style={{padding:"7px 12px",textAlign:"center",fontWeight:700,color:log.isCorrect?"#10B981":"#ef4444"}}>{log.isCorrect?"✓":"✗"}</td>
                                    <td style={{padding:"7px 12px",textAlign:"center"}}>{log.stackSize}</td>
                                    <td style={{padding:"7px 12px"}}>
                                      <span style={{background:log.phase==="DFS_PUSH"?"rgba(239,68,68,0.1)":log.phase==="DFS_POP"?"rgba(37,99,235,0.1)":log.phase==="VERTICAL_SWITCH"?"rgba(124,58,237,0.1)":"rgba(0,0,0,0.04)",
                                        color:log.phase==="DFS_PUSH"?"#dc2626":log.phase==="DFS_POP"?"#1d4ed8":log.phase==="VERTICAL_SWITCH"?"#7c3aed":THEME.textLight,
                                        padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>
                                        {log.phase}
                                      </span>
                                    </td>
                                    <td style={{padding:"7px 12px"}}>
                                      <span style={{background:log.skillStatus==="BLOCKED"?"rgba(239,68,68,0.1)":log.skillStatus==="MASTERED"?"rgba(16,185,129,0.1)":"rgba(0,0,0,0.04)",
                                        color:log.skillStatus==="BLOCKED"?"#dc2626":log.skillStatus==="MASTERED"?"#059669":THEME.textLight,
                                        padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:600}}>
                                        {log.skillStatus}
                                      </span>
                                    </td>
                                    <td style={{padding:"7px 12px"}}>
                                      {isSectionEnd&&<span style={{background:"rgba(212,175,55,0.15)",color:"#92400e",padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>§END</span>}
                                      {!isSectionEnd&&log.sessionStatus!=="CONTINUE"&&<span style={{fontSize:10,color:THEME.textLight}}>{log.sessionStatus}</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div style={{padding:"10px 16px",background:THEME.bg,borderTop:`1px solid ${THEME.border}`,fontSize:12,color:THEME.textLight}}>
                          {logs.length} шагов · {logs.filter(l=>l.isCorrect).length} верных ({Math.round(logs.filter(l=>l.isCorrect).length/logs.length*100)}%)
                        </div>
                      </div>
                    )}

                    {/* ── Roadmap view ── */}
                    {simView==="roadmap"&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,alignItems:"start"}}>
                        {/* Module cards */}
                        <div>
                          <div style={{fontWeight:700,fontSize:14,color:THEME.primary,marginBottom:12}}>Сгенерированная дорожная карта</div>
                          {roadmapData?.isPerfectStudent&&(
                            <div style={{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:12,padding:"14px 18px",marginBottom:12,fontSize:13,color:"#065f46",fontWeight:600}}>
                              🏆 Идеальный ученик — нет критических пробелов
                            </div>
                          )}
                          <div style={{display:"flex",flexDirection:"column",gap:10}}>
                            {(roadmapData?.roadmap||[]).map((mod,mi)=>(
                              <div key={mi} style={{background:"#fff",borderRadius:12,border:`1px solid ${THEME.border}`,borderLeft:`4px solid ${mi===0?"#D4AF37":THEME.border}`,padding:"14px 18px"}}>
                                <div style={{fontWeight:700,fontSize:14,color:THEME.primary,marginBottom:6}}>{mod.title}</div>
                                <div style={{fontSize:12,color:THEME.textLight,marginBottom:8}}>{mod.skills_count} тем · класс {mod.gradeRange}</div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                  {(mod.skills_list||[]).slice(0,8).map((sk,si)=>(
                                    <span key={si} style={{background:THEME.bg,border:`1px solid ${THEME.border}`,borderRadius:99,padding:"2px 8px",fontSize:11,color:THEME.textLight}}>{sk}</span>
                                  ))}
                                  {(mod.skills_list||[]).length>8&&<span style={{fontSize:11,color:THEME.textLight,padding:"2px 6px"}}>+{mod.skills_list.length-8}</span>}
                                </div>
                              </div>
                            ))}
                            {(!roadmapData?.roadmap?.length)&&<div style={{color:THEME.textLight,fontSize:13,fontStyle:"italic"}}>Модули не сформированы</div>}
                          </div>
                        </div>
                        {/* Raw JSON */}
                        <div>
                          <div style={{fontWeight:700,fontSize:14,color:THEME.primary,marginBottom:12}}>JSON дорожной карты</div>
                          <textarea readOnly value={JSON.stringify(roadmapData,null,2)} rows={24}
                            style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",borderRadius:12,border:`1px solid ${THEME.border}`,fontSize:11,fontFamily:"'Courier New',monospace",lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:"vertical"}}/>
                        </div>
                      </div>
                    )}

                    {/* ── Skill Tree view ── */}
                    {simView==="skilltree"&&(()=>{
                      const { skillStatuses } = simResult;
                      if (!skillStatuses || Object.keys(skillStatuses).length === 0) {
                        return <div style={{textAlign:"center",padding:60,color:THEME.textLight,fontSize:14}}>Нет данных о навыках</div>;
                      }

                      // Собираем плоский массив навыков из skillStatuses
                      const rawNodes = Object.values(skillStatuses);

                      // Статистика по статусам
                      const stCounts = rawNodes.reduce((acc, s) => {
                        acc[s.status] = (acc[s.status] || 0) + 1;
                        return acc;
                      }, {});

                      return (
                        <div>
                          {/* Легенда + статистика */}
                          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
                            {[
                              {st:"MASTERED", icon:"✅", label:"Освоено",      color:"#10B981"},
                              {st:"ACTIVE",   icon:"⚡", label:"В процессе",   color:"#D4AF37"},
                              {st:"BLOCKED",  icon:"🚫", label:"Заблокировано",color:"#ef4444"},
                              {st:"LOCKED",   icon:"🔒", label:"Не достигнуто",color:"#475569"},
                            ].map(({st,icon,label,color})=>(
                              <div key={st} style={{display:"flex",alignItems:"center",gap:6,
                                background:"#fff",border:`1px solid ${THEME.border}`,borderRadius:8,padding:"6px 12px"}}>
                                <span style={{fontSize:14}}>{icon}</span>
                                <span style={{fontSize:12,fontWeight:700,color}}>{stCounts[st]||0}</span>
                                <span style={{fontSize:11,color:THEME.textLight}}>{label}</span>
                              </div>
                            ))}
                            <span style={{fontSize:11,color:THEME.textLight,marginLeft:"auto"}}>
                              🖱 Перетащи · Колёсико для зума · Всего: {rawNodes.length} навыков
                            </span>
                          </div>

                          {/* Дерево навыков на тёмном фоне */}
                          <div style={{borderRadius:16,overflow:"hidden",border:`1px solid ${THEME.border}`}}>
                            <InteractiveSkillTree
                              skills={rawNodes}
                              onStartTraining={null}
                            />
                          </div>

                          {/* Подсказка под деревом */}
                          <div style={{marginTop:10,fontSize:12,color:THEME.textLight,textAlign:"center"}}>
                            Стратегия: <strong>{simStrategy}</strong> · Класс: <strong>{simGrade}</strong> ·
                            Движок прошёл <strong>{totalSteps}</strong> шагов
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          );
        })()}

        {tab==="dailytasks"&&(()=>{
          const dtGradeSkills = dtGrade ? getPivotSkillsForGrade(dtGrade) : [];

          if(!dtLoaded){getDocs(collection(db,'dailyTasks')).then(snap=>{setDtEntries(snap.docs.map(d=>({id:d.id,...d.data()})));setDtLoaded(true);});}

          const saveDtEditTask=async()=>{
            if(!dtEditTask)return;
            const{entryId,taskIdx,question,options,correct,explanation,difficulty}=dtEditTask;
            const newQuestions=(dtEntries.find(e=>e.id===entryId)?.questions||[]).map((q,i)=>i===taskIdx?{...q,question,options:[...options],correct,explanation,difficulty}:q);
            await setDoc(doc(db,'dailyTasks',entryId),{questions:newQuestions,updatedAt:new Date().toISOString()},{merge:true});
            setDtEntries(p=>p.map(e=>e.id===entryId?{...e,questions:newQuestions}:e));
            setDtEditTask(null);
          };

          const deleteDtTask=async(entryId,taskIdx)=>{
            if(!confirm('Удалить задачу #'+(taskIdx+1)+'?'))return;
            const newQuestions=(dtEntries.find(e=>e.id===entryId)?.questions||[]).filter((_,i)=>i!==taskIdx);
            await setDoc(doc(db,'dailyTasks',entryId),{questions:newQuestions,updatedAt:new Date().toISOString()},{merge:true});
            setDtEntries(p=>p.map(e=>e.id===entryId?{...e,questions:newQuestions}:e));
            if(dtEditTask?.entryId===entryId&&dtEditTask?.taskIdx===taskIdx)setDtEditTask(null);
            if(dtPreviewTask?.entryId===entryId&&dtPreviewTask?.taskIdx===taskIdx){setDtPreviewTask(null);setDtPreviewAnswer(null);}
          };

          const buildDtPrompt = (skill) => {
            if (!skill) return '';
            // Find cluster info for this skill
            let clusterName = '';
            let relatedSkills = [];
            const sec = sections.find(s=>s.specificTarget===dtGrade);
            if (sec) {
              const hier = skillHierarchies.find(h=>h.id===sec.id);
              if (hier) {
                for (const cl of (hier.clusters||[])) {
                  const found = (cl.pivot_skills||[]).find(ps=>ps.skill_id===skill.skill_id);
                  if (found) {
                    clusterName = cl.cluster_name || '';
                    relatedSkills = (cl.pivot_skills||[]).filter(ps=>ps.skill_id!==skill.skill_id).map(ps=>({skill_id:ps.skill_id,skill_name:ps.skill_name}));
                    break;
                  }
                }
              }
            }
            return `Ты — генератор математических задач для ежедневной практики. Создай 40 задач уровня сложности C для ученика ${dtGrade} по навыку.

ПРАВИЛА ЗАПИСИ:
- Числа: используй обычные цифры (1, 2, 3...)
- Дроби: записывай через / или словами (1/2 или «половина»)
- Степени: используй ^ (x^2 означает x²)
- Корни: используй sqrt() (sqrt(4) = 2)
- Умножение: используй * или ×
- Уравнения: записывай в одну строку (2x + 3 = 7)
- LaTeX в тексте вопроса: оборачивай в $...$ (например: $\\frac{1}{2}$)

ЦЕЛЕВОЙ НАВЫК:
skill_id: ${skill.skill_id}
Название: ${skill.skill_name}
Класс: ${dtGrade}
Раздел: ${skill.section || ''}
${clusterName ? `Кластер: ${clusterName}` : ''}

${relatedSkills.length>0?`СВЯЗАННЫЕ НАВЫКИ В КЛАСТЕРЕ:
${relatedSkills.map(s=>`- ${s.skill_id}: ${s.skill_name}`).join('\n')}

`:''}ТРЕБУЕМЫЙ ФОРМАТ ОТВЕТА (строго JSON-массив из 40 элементов, без лишнего текста):
[
  {
    "skill_id": "${skill.skill_id}",
    "question": "Текст задачи",
    "options": ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"],
    "correct": 0,
    "explanation": "Объяснение решения",
    "difficulty": "C"
  }
]

Все 40 задач должны быть уровня C (повышенный — комплексные задачи, несколько шагов, нестандартные формулировки).

ВАЖНО — РАСПРЕДЕЛЕНИЕ ПРАВИЛЬНЫХ ОТВЕТОВ:
Поле "correct" должно быть равномерно распределено от 0 до 3 по всем 40 задачам.
Примерно 10 задач — correct: 0, 10 задач — correct: 1, 10 задач — correct: 2, 10 задач — correct: 3.
НЕ ставь правильный ответ всегда на позицию 0. Чередуй позиции равномерно.
Никаких приветствий. Только JSON-массив из ровно 40 задач.`;
          };

          const dtPrompt = buildDtPrompt(dtSkill);

          const saveDtTasks = async () => {
            if (!dtSkill || !dtJsonText.trim()) return;
            setDtSaving(true);
            try {
              let txt = dtJsonText.trim()
                .replace(/^```[a-z]*\n?/im,'').replace(/```\s*$/m,'').trim();
              const fixJ = s => s
                .replace(/[\u201C\u201D\u00AB\u00BB]/g,'"')
                .replace(/[\u2018\u2019]/g,"'")
                .replace(/,\s*([}\]])/g,'$1')
                .replace(/}\s*{/g,'},{')
                .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,'$1"$2":')
                .replace(/:\\([^"\\\/bfnrtu\d\s])/g,':\\\\$1');
              let arr = null;
              for (const fn of [()=>JSON.parse(txt), ()=>JSON.parse(fixJ(txt))]) {
                try { arr = fn(); break; } catch {}
              }
              if (!arr || !Array.isArray(arr)) { alert('Ошибка парсинга JSON. Убедитесь что вставлен корректный массив.'); setDtSaving(false); return; }
              // Sanitize: fix // → \ for LaTeX, strip CJK characters
              const sanitizeStr = s => typeof s==='string'
                ? s.replace(/\/\/([a-zA-Z]+)/g,'\\$1').replace(/[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF]+/g,'').trim()
                : s;
              arr = arr.map(q=>({...q,
                question: sanitizeStr(q.question||''),
                options: (q.options||[]).map(sanitizeStr),
                explanation: sanitizeStr(q.explanation||''),
              }));
              const existing = await getDoc(doc(db,'dailyTasks',dtSkill.skill_id));
              const prev = existing.exists() ? (existing.data().questions || []) : [];
              await setDoc(doc(db,'dailyTasks',dtSkill.skill_id),{
                skill_id: dtSkill.skill_id,
                skill_name: dtSkill.skill_name,
                grade: dtGrade,
                section: dtSkill.section || '',
                questions: [...prev, ...arr],
                updatedAt: new Date().toISOString(),
              }, {merge:true});
              alert(`✅ Сохранено ${arr.length} задач для навыка ${dtSkill.skill_name}. Всего задач: ${prev.length + arr.length}`);
              setDtJsonText('');
              setDtEntries(p=>{const idx=p.findIndex(e=>e.id===dtSkill.skill_id);const ne={id:dtSkill.skill_id,skill_name:dtSkill.skill_name,questions:[...prev,...arr]};return idx>=0?p.map((e,i)=>i===idx?ne:e):[...p,ne];});
            } catch(e) { alert('Ошибка: '+e.message); }
            setDtSaving(false);
          };

          return (
            <div style={{padding:'0 4px'}}>
              <div style={{fontWeight:800,fontSize:22,color:THEME.primary,marginBottom:6}}>📝 Ежедневные задачи</div>
              <p style={{color:THEME.textLight,fontSize:14,marginBottom:20}}>Создавайте банки задач для ежедневной практики по pivot-навыкам. Задачи сохраняются в коллекцию <code>dailyTasks</code>.</p>

              {/* Step 1: Grade */}
              <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:20,marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:12}}>Шаг 1: Выберите класс</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {['5 класс','6 класс','7 класс','8 класс','9 класс','10 класс','11 класс'].map(g=>(
                    <button key={g} onClick={()=>{setDtGrade(g);setDtSkill(null);}}
                      style={{padding:'8px 16px',borderRadius:20,border:`2px solid ${dtGrade===g?THEME.primary:THEME.border}`,fontWeight:700,fontSize:13,cursor:'pointer',
                        background:dtGrade===g?THEME.primary:'#fff',color:dtGrade===g?'#fff':THEME.text}}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Skill */}
              {dtGrade && (
                <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:20,marginBottom:16}}>
                  <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:4}}>Шаг 2: Выберите pivot-навык</div>
                  {dtGradeSkills.length===0 && <div style={{color:THEME.textLight,fontSize:13}}>Нет навыков для {dtGrade}. Убедитесь что добавлены skillHierarchies.</div>}
                  <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:10,maxHeight:280,overflowY:'auto'}}>
                    {dtGradeSkills.map(sk=>(
                      <button key={sk.skill_id} onClick={()=>setDtSkill(dtSkill?.skill_id===sk.skill_id?null:sk)}
                        style={{textAlign:'left',padding:'10px 14px',borderRadius:8,border:`2px solid ${dtSkill?.skill_id===sk.skill_id?THEME.primary:THEME.border}`,
                          background:dtSkill?.skill_id===sk.skill_id?'#f0f4ff':'#fff',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13,color:THEME.primary}}>{sk.skill_name}</div>
                          <div style={{fontSize:11,color:THEME.textLight,marginTop:2}}>{sk.skill_id} · {sk.section}</div>
                        </div>
                        {dtSkill?.skill_id===sk.skill_id && <span style={{fontSize:16,color:THEME.primary}}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Copy prompt */}
              {dtSkill && (
                <div style={{background:'rgba(99,102,241,0.04)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:14,padding:20,marginBottom:16}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                    <div style={{fontWeight:700,fontSize:15,color:'#4338ca'}}>Шаг 3: Скопируйте промпт для AI</div>
                    <button onClick={()=>navigator.clipboard.writeText(dtPrompt).then(()=>alert('Промпт скопирован!')).catch(()=>alert('Скопируйте вручную'))}
                      style={{background:'#4338ca',color:'#fff',border:'none',borderRadius:8,padding:'8px 20px',fontWeight:700,fontSize:13,cursor:'pointer'}}>
                      📋 Скопировать промпт
                    </button>
                  </div>
                  <textarea readOnly value={dtPrompt} rows={14}
                    style={{width:'100%',boxSizing:'border-box',padding:'10px 14px',borderRadius:8,border:'1px solid rgba(99,102,241,0.2)',fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.6,background:'#f8f9ff',color:THEME.text,resize:'vertical'}}/>
                </div>
              )}

              {/* Step 4: Upload JSON */}
              {dtSkill && (
                <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:20,marginBottom:16}}>
                  <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:4}}>Шаг 4: Вставьте JSON от AI и сохраните</div>
                  <p style={{color:THEME.textLight,fontSize:13,margin:'0 0 12px'}}>Навык: <strong>{dtSkill.skill_name}</strong> ({dtSkill.skill_id})</p>
                  <textarea value={dtJsonText} onChange={e=>setDtJsonText(e.target.value)} rows={12}
                    placeholder={'[\n  {\n    "skill_id": "...",\n    "question": "...",\n    "options": ["А","Б","В","Г"],\n    "correct": 0,\n    "explanation": "...",\n    "difficulty": "A"\n  }\n]'}
                    style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:10,border:`1px solid ${THEME.border}`,fontFamily:"'Courier New',monospace",fontSize:12,lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical',marginBottom:12}}/>
                  <button onClick={saveDtTasks} disabled={!dtJsonText.trim()||dtSaving}
                    style={{background:!dtJsonText.trim()||dtSaving?'#94a3b8':THEME.primary,color:THEME.accent,border:'none',borderRadius:8,padding:'10px 28px',fontWeight:700,fontSize:14,cursor:!dtJsonText.trim()||dtSaving?'not-allowed':'pointer'}}>
                    {dtSaving?'Сохранение...':'💾 Сохранить задачи'}
                  </button>
                </div>
              )}

              {/* All task banks */}
              <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:20,marginTop:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontWeight:700,fontSize:15,color:THEME.primary}}>
                    Банки задач {dtLoaded?(()=>{const vis=dtFilterGrade?dtEntries.filter(e=>e.grade===dtFilterGrade):dtEntries;return`(${vis.length} навыков · ${vis.reduce((s,e)=>s+(e.questions||[]).length,0)} задач)`;})():'...'}
                  </div>
                  <button onClick={()=>{setDtLoaded(false);setDtEntries([]);setDtViewEntry(null);setDtEditTask(null);setDtPreviewTask(null);}}
                    style={{background:THEME.bg,color:THEME.primary,border:`1px solid ${THEME.border}`,borderRadius:6,padding:'5px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                    🔄 Обновить
                  </button>
                </div>
                {/* Grade filter */}
                {dtLoaded&&dtEntries.length>0&&(
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
                    <button onClick={()=>setDtFilterGrade('')}
                      style={{padding:'5px 14px',borderRadius:20,border:`1.5px solid ${!dtFilterGrade?THEME.primary:THEME.border}`,fontWeight:700,fontSize:12,cursor:'pointer',background:!dtFilterGrade?THEME.primary:'#fff',color:!dtFilterGrade?'#fff':THEME.text}}>
                      Все классы
                    </button>
                    {['5 класс','6 класс','7 класс','8 класс','9 класс','10 класс','11 класс'].filter(g=>dtEntries.some(e=>e.grade===g)).map(g=>(
                      <button key={g} onClick={()=>setDtFilterGrade(dtFilterGrade===g?'':g)}
                        style={{padding:'5px 14px',borderRadius:20,border:`1.5px solid ${dtFilterGrade===g?THEME.primary:THEME.border}`,fontWeight:700,fontSize:12,cursor:'pointer',background:dtFilterGrade===g?THEME.primary:'#fff',color:dtFilterGrade===g?'#fff':THEME.text}}>
                        {g} <span style={{fontWeight:400,opacity:.7}}>({dtEntries.filter(e=>e.grade===g).reduce((s,e)=>s+(e.questions||[]).length,0)})</span>
                      </button>
                    ))}
                  </div>
                )}
                {!dtLoaded&&<div style={{color:THEME.textLight,fontSize:13,padding:'8px 0'}}>Загрузка...</div>}
                {dtLoaded&&dtEntries.length===0&&<div style={{color:THEME.textLight,fontSize:13,padding:'8px 0'}}>Нет сохранённых банков задач</div>}
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(dtFilterGrade?dtEntries.filter(e=>e.grade===dtFilterGrade):dtEntries).map(e=>{
                    const isViewing=dtViewEntry===e.id;
                    const qs=e.questions||[];
                    return(
                      <div key={e.id} style={{borderRadius:10,border:`1.5px solid ${isViewing?THEME.primary:THEME.border}`,overflow:'hidden'}}>
                        {/* Entry header */}
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:isViewing?'#f0f4ff':THEME.bg}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:13,color:THEME.primary}}>{e.skill_name||e.id}</div>
                            <div style={{fontSize:11,color:THEME.textLight,marginTop:2}}>{e.id} · {qs.length} задач{e.grade?` · ${e.grade}`:''}{e.section?` · ${e.section}`:''}</div>
                          </div>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>{setDtViewEntry(isViewing?null:e.id);setDtEditTask(null);setDtPreviewTask(null);setDtPreviewAnswer(null);}}
                              style={{background:isViewing?THEME.primary:'#fff',color:isViewing?'#fff':THEME.primary,border:`1.5px solid ${THEME.primary}`,borderRadius:6,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                              {isViewing?'▲ Скрыть':'👁 Просмотр'}
                            </button>
                            <button onClick={async()=>{if(!confirm('Удалить весь банк задач для навыка '+(e.skill_name||e.id)+'?'))return;await deleteDoc(doc(db,'dailyTasks',e.id));setDtEntries(p=>p.filter(x=>x.id!==e.id));if(dtViewEntry===e.id)setDtViewEntry(null);}}
                              style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:6,padding:'5px 10px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                              🗑
                            </button>
                          </div>
                        </div>

                        {/* Expanded tasks list */}
                        {isViewing&&(
                          <div style={{padding:'12px 14px',borderTop:`1px solid ${THEME.border}`,display:'flex',flexDirection:'column',gap:10}}>
                            {qs.length===0&&<div style={{color:THEME.textLight,fontSize:13}}>Нет задач в этом банке</div>}
                            {qs.map((q,qi)=>{
                              const isEditing=dtEditTask?.entryId===e.id&&dtEditTask?.taskIdx===qi;
                              const isPreviewing=dtPreviewTask?.entryId===e.id&&dtPreviewTask?.taskIdx===qi;
                              return(
                                <div key={qi} style={{borderRadius:8,border:`1.5px solid ${isEditing?'#6366f1':isPreviewing?'#10b981':THEME.border}`,padding:'10px 12px',background:isEditing?'#fafaff':isPreviewing?'#f0fdf4':'#fff'}}>
                                  {/* Task header row */}
                                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                                    <div style={{display:'flex',gap:6,alignItems:'center'}}>
                                      <span style={{fontWeight:700,fontSize:12,color:THEME.textLight}}>#{qi+1}</span>
                                      {q.difficulty&&<span style={{fontSize:10,fontWeight:700,background:'#e0e7ff',color:'#4338ca',borderRadius:4,padding:'1px 6px'}}>{q.difficulty}</span>}
                                    </div>
                                    <div style={{display:'flex',gap:4}}>
                                      <button onClick={()=>{if(isPreviewing){setDtPreviewTask(null);setDtPreviewAnswer(null);}else{setDtPreviewTask({entryId:e.id,taskIdx:qi});setDtPreviewAnswer(null);setDtEditTask(null);}}}
                                        style={{background:isPreviewing?'#10b981':'#f0fdf4',color:isPreviewing?'#fff':'#065f46',border:`1px solid ${isPreviewing?'#10b981':'#6ee7b7'}`,borderRadius:5,padding:'3px 8px',fontSize:11,cursor:'pointer',fontWeight:700}}>
                                        {isPreviewing?'✕':'👁 Предпросмотр'}
                                      </button>
                                      <button onClick={()=>{if(isEditing){setDtEditTask(null);}else{setDtEditTask({entryId:e.id,taskIdx:qi,question:q.question||'',options:[...(q.options||['','','',''])],correct:q.correct??0,explanation:q.explanation||'',difficulty:q.difficulty||'C'});setDtPreviewTask(null);setDtPreviewAnswer(null);}}}
                                        style={{background:isEditing?'#6366f1':'#f0f4ff',color:isEditing?'#fff':'#4338ca',border:`1px solid ${isEditing?'#6366f1':'#c7d2fe'}`,borderRadius:5,padding:'3px 8px',fontSize:11,cursor:'pointer',fontWeight:700}}>
                                        {isEditing?'✕':'✏️ Ред.'}
                                      </button>
                                      <button onClick={()=>deleteDtTask(e.id,qi)}
                                        style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:5,padding:'3px 8px',fontSize:11,cursor:'pointer',fontWeight:700}}>
                                        🗑
                                      </button>
                                    </div>
                                  </div>

                                  {/* STUDENT PREVIEW MODE */}
                                  {isPreviewing&&(
                                    <div>
                                      <div style={{fontWeight:600,fontSize:14,color:THEME.text,marginBottom:12,lineHeight:1.6}}><LatexText text={q.question}/></div>
                                      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:10}}>
                                        {(q.options||[]).map((opt,oi)=>{
                                          const answered=dtPreviewAnswer!==null;
                                          const isCorrect=oi===q.correct;
                                          const isSelected=oi===dtPreviewAnswer;
                                          let bg='#fff',border_=`1px solid ${THEME.border}`,color_=THEME.text;
                                          if(answered){if(isCorrect){bg='#d1fae5';border_='1.5px solid #10b981';color_='#065f46';}else if(isSelected){bg='#fee2e2';border_='1.5px solid #ef4444';color_='#991b1b';}}
                                          return(
                                            <button key={oi} disabled={answered} onClick={()=>setDtPreviewAnswer(oi)}
                                              style={{textAlign:'left',padding:'10px 14px',borderRadius:8,border:border_,background:bg,color:color_,fontWeight:(isCorrect&&answered)?700:400,cursor:answered?'default':'pointer',fontSize:13,transition:'all 0.15s'}}>
                                              <span style={{fontWeight:700,marginRight:8}}>{['А','Б','В','Г'][oi]}.</span><LatexText text={opt}/>
                                              {answered&&isCorrect&&<span style={{marginLeft:6}}>✓</span>}
                                              {answered&&isSelected&&!isCorrect&&<span style={{marginLeft:6}}>✗</span>}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {dtPreviewAnswer!==null&&q.explanation&&(
                                        <div style={{background:'#f0fdf4',border:'1px solid #6ee7b7',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#065f46',marginBottom:8}}>
                                          💡 <LatexText text={q.explanation}/>
                                        </div>
                                      )}
                                      {dtPreviewAnswer!==null?(
                                        <div style={{textAlign:'center',marginTop:6}}>
                                          <span style={{fontSize:13,fontWeight:700,color:dtPreviewAnswer===q.correct?'#10b981':'#ef4444',marginRight:12}}>
                                            {dtPreviewAnswer===q.correct?'✅ Правильно!':'❌ Неправильно'}
                                          </span>
                                          <button onClick={()=>{setDtPreviewTask(null);setDtPreviewAnswer(null);}} style={{background:'#f1f5f9',color:THEME.text,border:`1px solid ${THEME.border}`,borderRadius:6,padding:'5px 14px',fontSize:12,cursor:'pointer',fontWeight:700}}>Закрыть</button>
                                        </div>
                                      ):(
                                        <div style={{fontSize:11,color:THEME.textLight,textAlign:'center',marginTop:4}}>Выберите ответ чтобы увидеть результат</div>
                                      )}
                                    </div>
                                  )}

                                  {/* EDIT MODE */}
                                  {isEditing&&(
                                    <div>
                                      <div style={{marginBottom:10}}>
                                        <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Вопрос:</div>
                                        <textarea value={dtEditTask.question} onChange={ev=>setDtEditTask(p=>({...p,question:ev.target.value}))} rows={3}
                                          style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:6,border:`1px solid ${THEME.border}`,fontSize:13,resize:'vertical'}}/>
                                      </div>
                                      <div style={{marginBottom:10}}>
                                        <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:6}}>Варианты ответов (нажмите «верный» рядом с правильным):</div>
                                        {dtEditTask.options.map((opt,oi)=>(
                                          <div key={oi} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                                            <span style={{fontWeight:700,fontSize:12,minWidth:18,color:dtEditTask.correct===oi?'#10b981':THEME.textLight}}>{['А','Б','В','Г'][oi]}.</span>
                                            <input value={opt} onChange={ev=>{const o=[...dtEditTask.options];o[oi]=ev.target.value;setDtEditTask(p=>({...p,options:o}));}}
                                              style={{flex:1,padding:'6px 10px',borderRadius:6,border:`1.5px solid ${dtEditTask.correct===oi?'#10b981':THEME.border}`,fontSize:13}}/>
                                            <button onClick={()=>setDtEditTask(p=>({...p,correct:oi}))}
                                              style={{background:dtEditTask.correct===oi?'#d1fae5':'#f8fafc',color:dtEditTask.correct===oi?'#065f46':'#94a3b8',border:`1px solid ${dtEditTask.correct===oi?'#6ee7b7':THEME.border}`,borderRadius:5,padding:'5px 10px',fontSize:11,cursor:'pointer',fontWeight:700,whiteSpace:'nowrap'}}>
                                              {dtEditTask.correct===oi?'✓ верный':'верный?'}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <div style={{marginBottom:10}}>
                                        <div style={{fontSize:12,fontWeight:700,color:THEME.textLight,marginBottom:4}}>Объяснение:</div>
                                        <textarea value={dtEditTask.explanation} onChange={ev=>setDtEditTask(p=>({...p,explanation:ev.target.value}))} rows={2}
                                          style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:6,border:`1px solid ${THEME.border}`,fontSize:12,resize:'vertical'}}/>
                                      </div>
                                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                                        <div style={{fontSize:12,fontWeight:700,color:THEME.textLight}}>Сложность:</div>
                                        {['A','B','C'].map(d=>(
                                          <button key={d} onClick={()=>setDtEditTask(p=>({...p,difficulty:d}))}
                                            style={{padding:'4px 12px',borderRadius:6,border:`1.5px solid ${dtEditTask.difficulty===d?THEME.primary:THEME.border}`,background:dtEditTask.difficulty===d?THEME.primary:'#fff',color:dtEditTask.difficulty===d?'#fff':THEME.text,fontWeight:700,fontSize:12,cursor:'pointer'}}>
                                            {d}
                                          </button>
                                        ))}
                                      </div>
                                      <div style={{display:'flex',gap:8}}>
                                        <button onClick={()=>saveDtEditTask()} style={{background:THEME.primary,color:'#fff',border:'none',borderRadius:6,padding:'7px 20px',fontWeight:700,fontSize:13,cursor:'pointer'}}>💾 Сохранить</button>
                                        <button onClick={()=>setDtEditTask(null)} style={{background:'#f1f5f9',color:THEME.text,border:`1px solid ${THEME.border}`,borderRadius:6,padding:'7px 16px',fontWeight:700,fontSize:13,cursor:'pointer'}}>Отмена</button>
                                      </div>
                                    </div>
                                  )}

                                  {/* DEFAULT TASK VIEW */}
                                  {!isPreviewing&&!isEditing&&(
                                    <div>
                                      <div style={{fontSize:13,color:THEME.text,marginBottom:8,lineHeight:1.6}}><LatexText text={q.question}/></div>
                                      <div style={{display:'flex',flexDirection:'column',gap:4}}>
                                        {(q.options||[]).map((opt,oi)=>(
                                          <div key={oi} style={{fontSize:13,padding:'6px 10px',borderRadius:6,display:'flex',alignItems:'center',gap:6,background:oi===q.correct?'#d1fae5':'#f8fafc',color:oi===q.correct?'#065f46':THEME.text,border:`1px solid ${oi===q.correct?'#6ee7b7':THEME.border}`}}>
                                            <span style={{fontWeight:700,minWidth:20}}>{['А','Б','В','Г'][oi]}.</span>
                                            <span style={{flex:1}}><LatexText text={opt}/></span>
                                            {oi===q.correct&&<span style={{fontWeight:700,color:'#10b981'}}>✓</span>}
                                          </div>
                                        ))}
                                      </div>
                                      {q.explanation&&<div style={{fontSize:12,color:THEME.textLight,marginTop:8,padding:'6px 10px',background:'#f8fafc',borderRadius:6,borderLeft:'3px solid #6ee7b7'}}>💡 <LatexText text={q.explanation}/></div>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── SKILL TASKS ── */}
        {tab==="skilltasks"&&(()=>{
          if(!sktLoaded){
            getDocs(collection(db,'skillTasks')).then(snap=>{
              setSktEntries(snap.docs.map(d=>({id:d.id,...d.data()})));
              setSktLoaded(true);
            });
          }
          const allPivotSkills=[];
          skillHierarchies.forEach(h=>{
            (h.clusters||[]).forEach(cl=>{
              (cl.pivot_skills||[]).forEach(ps=>{
                if(ps.skill_id&&ps.skill_name) allPivotSkills.push({id:ps.skill_id,name:ps.skill_name,grade:h.grade||''});
              });
            });
          });
          allPivotSkills.sort((a,b)=>a.name.localeCompare(b.name,'ru'));

          const aiPrompt=`Ты — генератор задач для образовательной платформы EduSpace. Создай задачи по навыку:

Навык: "${sktSkillName||'[укажи название навыка]'}"
ID навыка: "${sktSkillId||'[укажи skill_id]'}"

ТРЕБОВАНИЯ ПО УРОВНЯМ:
- Уровень A: 20 задач (базовый — прямое применение правила/формулы)
- Уровень B: 25 задач (средний — нестандартная ситуация, применение в контексте)
- Уровень C: 40 задач (повышенный — комплексные задачи, несколько шагов)

ФОРМАТ КАЖДОЙ ЗАДАЧИ:
{
  "id": "a1",  // уровень + номер, например a1..a20, b1..b25, c1..c30
  "text": "Текст задачи (можно использовать LaTeX в $...$)",
  "options": ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"],
  "correct": 0,  // индекс правильного ответа (0-3)
  "explanation": "Краткое объяснение правильного ответа"
}

ВАЖНО — РАСПРЕДЕЛЕНИЕ ПРАВИЛЬНЫХ ОТВЕТОВ:
Поле "correct" должно быть равномерно распределено от 0 до 3 по всем задачам.
Примерно 25% задач — correct: 0 (вариант А), 25% — correct: 1 (вариант Б), 25% — correct: 2 (вариант В), 25% — correct: 3 (вариант Г).
НЕ ставь правильный ответ всегда на позицию 0. Чередуй позиции равномерно.

ОТВЕТ — строгий JSON без пояснений до/после:
{
  "skill_id": "${sktSkillId||'skill_id'}",
  "skill_name": "${sktSkillName||'Название навыка'}",
  "a": [ ...20 задач уровня A... ],
  "b": [ ...25 задач уровня B... ],
  "c": [ ...40 задач уровня C... ]
}`;

          const saveSktTasks=async()=>{
            if(!sktSkillId||!sktJsonText.trim())return;
            setSktSaving(true);
            try{
              const parsed=JSON.parse(sktJsonText.trim());
              let data={};
              if(Array.isArray(parsed)) data={[sktLevel]:parsed};
              else data=parsed;
              if(!data.skill_id) data.skill_id=sktSkillId;
              if(!data.skill_name) data.skill_name=sktSkillName;
              await setDoc(doc(db,'skillTasks',sktSkillId),data,{merge:true});
              const existing=sktEntries.find(e=>e.id===sktSkillId);
              const updated={id:sktSkillId,...data};
              setSktEntries(existing?sktEntries.map(e=>e.id===sktSkillId?updated:e):[...sktEntries,updated]);
              setSktJsonText('');
              alert('✓ Задачи сохранены!');
            }catch(e){alert('Ошибка: '+e.message);}
            setSktSaving(false);
          };

          return(
            <div style={{display:'flex',flexDirection:'column',gap:20}}>
              <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:24}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontWeight:800,fontSize:18,color:THEME.primary,marginBottom:4}}>Задачи по навыкам</div>
                <div style={{fontSize:13,color:THEME.textLight,marginBottom:20}}>Добавляй задачи уровней A, B, C для каждого навыка. Система рандомно выбирает 10 из пула при каждом запуске.</div>
                <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:240}}>
                    <label style={{fontSize:12,fontWeight:600,color:THEME.textLight,display:'block',marginBottom:6}}>Навык</label>
                    <select value={sktSkillId} onChange={e=>{
                      const sk=allPivotSkills.find(s=>s.id===e.target.value);
                      setSktSkillId(e.target.value);
                      setSktSkillName(sk?.name||'');
                    }} style={{width:'100%',padding:'10px 12px',borderRadius:8,border:`1px solid ${THEME.border}`,fontFamily:"'Inter',sans-serif",fontSize:13}}>
                      <option value="">— выбери навык —</option>
                      {allPivotSkills.map(sk=><option key={sk.id} value={sk.id}>{sk.name} ({sk.id})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:THEME.textLight,display:'block',marginBottom:6}}>Уровень (для импорта только одного уровня)</label>
                    <div style={{display:'flex',gap:4}}>
                      {['a','b','c'].map(lv=>(
                        <button key={lv} onClick={()=>setSktLevel(lv)} style={{padding:'10px 18px',borderRadius:8,border:`1px solid ${sktLevel===lv?THEME.accent:THEME.border}`,background:sktLevel===lv?THEME.primary:'#fff',color:sktLevel===lv?THEME.accent:THEME.textLight,fontWeight:700,fontSize:13,cursor:'pointer'}}>
                          {lv.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {sktSkillId&&(
                  <div style={{marginBottom:16}}>
                    <button onClick={()=>setShowSktPrompt(v=>!v)} style={{background:'rgba(212,175,55,0.1)',border:'1px solid rgba(212,175,55,0.4)',color:'#b45309',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,cursor:'pointer',marginBottom:showSktPrompt?12:0}}>
                      {showSktPrompt?'▲ Скрыть промпт':'✨ Промпт для AI Studio'}
                    </button>
                    {showSktPrompt&&(
                      <div>
                        <textarea readOnly value={aiPrompt} rows={20}
                          style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:10,border:`1px solid ${THEME.border}`,fontFamily:"'Courier New',monospace",fontSize:11,lineHeight:1.6,background:'#fafaf8',color:THEME.text,resize:'vertical'}}/>
                        <button onClick={()=>{navigator.clipboard.writeText(aiPrompt);alert('Промпт скопирован!');}}
                          style={{background:THEME.primary,color:THEME.accent,border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer',marginTop:8}}>
                          📋 Копировать промпт
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:THEME.textLight,display:'block',marginBottom:6}}>
                    Вставь JSON-ответ от AI (полный объект с a/b/c или только массив задач для уровня {sktLevel.toUpperCase()})
                  </label>
                  <textarea value={sktJsonText} onChange={e=>setSktJsonText(e.target.value)} rows={12}
                    placeholder={'{\n  "a": [...],\n  "b": [...],\n  "c": [...]\n}'}
                    style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:10,border:`1px solid ${THEME.border}`,fontFamily:"'Courier New',monospace",fontSize:12,lineHeight:1.6,background:THEME.bg,color:THEME.text,resize:'vertical',marginBottom:12}}/>
                  <button onClick={saveSktTasks} disabled={!sktSkillId||!sktJsonText.trim()||sktSaving}
                    style={{background:!sktSkillId||!sktJsonText.trim()||sktSaving?'#94a3b8':THEME.primary,color:THEME.accent,border:'none',borderRadius:8,padding:'10px 28px',fontWeight:700,fontSize:14,cursor:!sktSkillId||!sktJsonText.trim()||sktSaving?'not-allowed':'pointer'}}>
                    {sktSaving?'Сохранение...':'💾 Сохранить задачи'}
                  </button>
                </div>
              </div>
              {sktEntries.length>0&&(
                <div style={{background:'#fff',borderRadius:14,border:`1px solid ${THEME.border}`,padding:20}}>
                  <div style={{fontWeight:700,fontSize:15,color:THEME.primary,marginBottom:12}}>Сохранённые банки задач ({sktEntries.length})</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {sktEntries.map(e=>(
                      <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderRadius:8,border:`1px solid ${THEME.border}`,background:THEME.bg,flexWrap:'wrap',gap:8}}>
                        <div>
                          <div style={{fontWeight:700,fontSize:13,color:THEME.primary}}>{e.skill_name||e.id}</div>
                          <div style={{fontSize:11,color:THEME.textLight,marginTop:2}}>
                            {e.id} · A:{(e.a||[]).length} / B:{(e.b||[]).length} / C:{(e.c||[]).length}
                          </div>
                        </div>
                        <button onClick={async()=>{if(!confirm('Удалить задачи для этого навыка?'))return;await deleteDoc(doc(db,'skillTasks',e.id));setSktEntries(p=>p.filter(x=>x.id!==e.id));}}
                          style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:6,padding:'5px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
