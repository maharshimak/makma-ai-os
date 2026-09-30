"use client";

import {useEffect,useMemo,useState} from "react";
import {WorldCanvas} from "./WorldCanvas";
import {RecruiterMode} from "./RecruiterMode";
import {VisualAtmosphere} from "./VisualAtmosphere";
import {SystemLoader} from "./SystemLoader";
import {AmbientSound} from "./AmbientSound";
import {experience,profile,projects,skillSystems,type Project} from "@/lib/content";

const sceneNames=["ACCESS","IDENTITY","FOUNDATION","KNOWLEDGE","AGENCY","RELIABILITY","REVISION","SYNTHESIS","CONTINUATION"];
const route=[
  {id:"access",label:"Access"},
  {id:"identity",label:"Identity"},
  {id:"foundation",label:"Foundation"},
  {id:"knowledge",label:"Knowledge"},
  {id:"agency",label:"Agency"},
  {id:"reliability",label:"Reliability"},
  {id:"revision",label:"Experience"},
  {id:"synthesis",label:"Synthesis"},
  {id:"continuation",label:"Connect"}
];

function useJourney(){
  const [progress,setProgress]=useState(0);
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const read=()=>setReducedMotion(media.matches);
    read();
    media.addEventListener("change",read);
    const update=()=>{
      const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      setProgress(Math.min(1,Math.max(0,window.scrollY/max)));
    };
    update();
    window.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    return ()=>{media.removeEventListener("change",read);window.removeEventListener("scroll",update);window.removeEventListener("resize",update);};
  },[]);
  return {progress,reducedMotion};
}

function ProjectInspector({project,onClose}:{project:Project;onClose:()=>void}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  return <div className="inspector-backdrop" onMouseDown={onClose}>
    <article className="inspector" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={project.name}>
      <div className="inspector-corners" aria-hidden="true"><i/><i/><i/><i/></div>
      <button className="icon-button inspector-close" onClick={onClose} aria-label="Close project">×</button>
      <span className="micro">MODULE / {project.family.toUpperCase()}</span>
      <h2>{project.name}</h2>
      <p className="inspector-lead">{project.summary}</p>
      <div className="inspector-status"><span><i/>SOURCE MAPPED</span><span>ARCHITECTURE EXPOSED</span></div>
      <div className="inspector-rule"/>
      <div className="inspector-columns">
        <div><span className="micro">WHY IT EXISTS</span><p>{project.purpose}</p></div>
        <div><span className="micro">SYSTEM ARCHITECTURE</span><ol>{project.architecture.map((a,i)=><li key={a}><span>{String(i+1).padStart(2,"0")}</span>{a}</li>)}</ol></div>
      </div>
      <div className="stack-line">{project.stack.map(s=><span key={s}>{s}</span>)}</div>
      <div className="action-row">
        <a href={base+"/projects/"+project.slug}>Technical dossier →</a>
        <a href={project.repoUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
        {project.liveUrl&&<a href={project.liveUrl} target="_blank" rel="noreferrer">Live ↗</a>}
      </div>
    </article>
  </div>;
}

function SectionShell({id,index,label,children,className=""}:{id:string;index:string;label:string;children:React.ReactNode;className?:string}){
  return <section id={id} className={"journey-section "+className}>
    <div className="section-sticky">
      <div className="section-index"><span>{index}</span><i/><b>{label}</b></div>
      {children}
    </div>
  </section>;
}

export function SynthesisPortfolio(){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  const {progress,reducedMotion}=useJourney();
  const [recruiter,setRecruiter]=useState(false);
  const [selected,setSelected]=useState<Project|null>(null);
  const [sound,setSound]=useState(false);
  const scene=Math.min(sceneNames.length-1,Math.floor(progress*sceneNames.length));
  const projectFamilies=useMemo(()=>[
    {id:"knowledge",name:"KNOWLEDGE & MEMORY",note:"Raw information is parsed, connected, retrieved and returned with evidence.",flow:["SOURCES","RETRIEVE","FUSE","EVIDENCE"],items:projects.filter(p=>p.family.startsWith("Knowledge"))},
    {id:"agency",name:"AUTONOMOUS SYSTEMS",note:"Knowledge becomes planning, tools and controlled action.",flow:["MEMORY","PLAN","TOOLS","OBSERVE"],items:projects.filter(p=>p.family.startsWith("Agency"))},
    {id:"reliability",name:"RELIABILITY CORE",note:"Intelligence is measured, gated, promoted and monitored before it earns trust.",flow:["EVALUATE","GATE","PROMOTE","MONITOR"],items:projects.filter(p=>p.family.startsWith("Reliability"))}
  ],[]);

  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.key.toLowerCase()==="r"&&!selected)setRecruiter(v=>!v);
      if(e.key==="Escape"){setRecruiter(false);setSelected(null);}
    };
    window.addEventListener("keydown",key);
    return ()=>window.removeEventListener("keydown",key);
  },[selected]);

  useEffect(()=>{
    const locked=Boolean(recruiter||selected);
    const previous=document.body.style.overflow;
    if(locked) document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=previous;};
  },[recruiter,selected]);

  return <main className={"synthesis"+((recruiter||selected)?" focus-mode":"")} style={{"--journey":progress,"--hero-art":`url(${base}/assets/v5/nebula-generated.webp)`,"--metal-art":`url(${base}/assets/v5/metal-generated.webp)`,"--cloud-art":`url(${base}/assets/v5/cloud-generated.webp)`} as React.CSSProperties}>
    <SystemLoader/>
    <AmbientSound enabled={sound}/>
    <VisualAtmosphere progress={progress} reducedMotion={reducedMotion} base={base}/>
    <div className="ambient-stage" aria-hidden="true">
      <div className="ambient-glow warm"/>
      <div className="ambient-glow cool"/>
      <div className="scan-field"/>
      <div className="dust-field"/>
    </div>
    <WorldCanvas progress={progress} reducedMotion={reducedMotion}/>
    <div className="grain" aria-hidden="true"/>
    <div className="cinematic-vignette" aria-hidden="true"/>
    <header className="hud">
      <a className="brand" href="#access"><span>MP</span><b>THE SYNTHESIS ENGINE</b></a>
      <div className="hud-center"><span>{String(scene+1).padStart(2,"0")}/{String(sceneNames.length).padStart(2,"0")}</span><b>{sceneNames[scene]}</b></div>
<div className="hud-actions"><button className={"sound-trigger"+(sound?" active":"")} onClick={()=>setSound(v=>!v)} aria-pressed={sound}><i/>{sound?"SOUND ON":"SOUND OFF"}</button><button className="recruiter-trigger" onClick={()=>setRecruiter(true)}>QUICK ACCESS <kbd>R</kbd></button></div>
    </header>
    <div className="progress-rail" aria-hidden="true"><span style={{transform:"scaleX("+progress+")"}}/></div>

    <nav className="journey-nav" aria-label="Portfolio chapters">
      {route.map((item,i)=><a key={item.id} href={"#"+item.id} className={scene===i?"active":""} aria-label={item.label}><i/><span>{item.label}</span></a>)}
    </nav>

    <div className="system-telemetry" aria-hidden="true">
      <span>SYNC {Math.round(progress*100).toString().padStart(3,"0")}%</span>
      <i/>
      <b>{sceneNames[scene]}</b>
    </div>

    <SectionShell id="access" index="00" label="ACCESS APERTURE" className="opening">
      <div className="opening-copy">
        <div className="access-line"><span className="micro">AUTHORIZED SYSTEMS INSPECTION / PARIS / 2026</span><b><i/>LINK ESTABLISHED</b></div>
        <div className="identity-lockup">
          <div className="identity-plate">
            <div className="plate-serial"><span>IDENTIFICATION FRAME</span><b>MP-2026-AI / VERIFIED</b></div>
            <h1>MAHARSHI<br/>PATEL</h1>
            <p>AI ENGINEER / INTELLIGENT SYSTEMS</p>
            <div className="identity-subline"><span>AGENTIC AI</span><span>KNOWLEDGE SYSTEMS</span><span>PRODUCTION ML</span></div>
            <div className="plate-status"><span>PARIS / FR</span><span>AI SYSTEMS</span><span>BUILD 05</span><i>● ACTIVE</i></div>
          </div>
        </div>
        <div className="scroll-cue"><i/>SCROLL TO INSPECT <span>↓</span></div>
      </div>
    </SectionShell>

    <SectionShell id="identity" index="01" label="IDENTIFICATION" className="identity-scene">
      <div className="split-copy">
        <div><span className="micro">SYSTEM OWNER / OPERATING PRINCIPLE</span><h2>I build systems where knowledge becomes action.</h2></div>
        <div className="identity-facts">
          <p><span>01</span>Agentic AI</p><p><span>02</span>RAG & knowledge systems</p><p><span>03</span>LLM engineering</p><p><span>04</span>AI infrastructure</p><p><span>05</span>ML systems & MLOps</p>
        </div>
      </div>
    </SectionShell>

    <SectionShell id="foundation" index="02" label="FOUNDATION" className="foundation-scene">
      <div className="foundation-copy">
        <span className="micro">LOAD-BEARING SYSTEMS</span>
        <h2>The machine is only as strong as what it rests on.</h2>
        <div className="foundation-grid">
          <div><b>COMPUTING</b><span>Software engineering · algorithms · systems</span><i>01</i></div>
          <div><b>DATA</b><span>Analytics · pipelines · SQL · experimentation</span><i>02</i></div>
          <div><b>INTELLIGENCE</b><span>ML · NLP · LLMs · deep learning</span><i>03</i></div>
          <div><b>EDUCATION</b><span>{profile.school}</span><i>04</i></div>
          <div><b>VERIFIED</b><span>{profile.certification}</span><i>05</i></div>
        </div>
      </div>
    </SectionShell>

    {projectFamilies.map((family,fi)=><SectionShell key={family.name} id={family.id} index={String(fi+3).padStart(2,"0")} label={family.name} className={"machine-scene machine-"+family.id}>
      <div className="systems-layout">
        <div className="systems-intro">
          <span className="micro">MACHINE SUBSYSTEM / 0{fi+1}</span>
          <h2>{family.name}</h2>
          <p>{family.note}</p>
          <div className="subsystem-flow" aria-label={family.name+" system flow"}>
            {family.flow.map((step,i)=><span key={step}><b>{String(i+1).padStart(2,"0")}</b>{step}{i<family.flow.length-1&&<i>→</i>}</span>)}
          </div>
          <div className="subsystem-meter"><span/><b>CONNECTED / INSPECTABLE</b></div>
        </div>
        <div className="module-list">
          {family.items.map((p,i)=><button key={p.slug} className="module-terminal" onClick={()=>setSelected(p)}>
            <span className="module-no">{String(i+1).padStart(2,"0")}</span>
            <span className="module-main"><i className="module-signal"/><b>{p.name}</b><small>{p.summary}</small><em>{p.stack.slice(0,3).join(" / ")}</em></span>
            <span className="module-open">INSPECT ↗</span>
          </button>)}
        </div>
      </div>
    </SectionShell>)}

    <SectionShell id="revision" index="06" label="REVISION RAIL" className="revision-scene">
      <div className="revision-layout">
        <div className="revision-heading"><span className="micro">SYSTEM REVISION HISTORY</span><h2>Each role changed what the machine could do next.</h2></div>
        <div className="revision-list">{experience.map((e,i)=><div className="revision-row" key={e.company+e.period}>
          <span>{String(i+1).padStart(2,"0")}</span><b>{e.company}</b><p>{e.role}</p><small>{e.period}</small><em>{e.signal}</em>
        </div>)}</div>
      </div>
    </SectionShell>

    <SectionShell id="synthesis" index="07" label="SYNTHESIS CHAMBER" className="synthesis-scene">
      <div className="synthesis-copy">
        <div className="authored-reactor" aria-hidden="true"><img src={base+"/assets/v5/reactor-core.svg"} alt=""/></div>
        <span className="micro">ALL SUBSYSTEMS / CONNECTED</span>
        <h2>Knowledge. Agency. Reliability.<br/><i>One engineering direction.</i></h2>
        <p>Building intelligent systems where retrieval, reasoning, tools, evaluation and infrastructure work together.</p>
        <div className="skill-system">{skillSystems.map((s,i)=><div key={s.name}><b><span>0{i+1}</span>{s.name}</b><em>{s.items.join(" / ")}</em></div>)}</div>
      </div>
    </SectionShell>

    <SectionShell id="continuation" index="08" label="UNFINISHED INTERFACE" className="final-scene">
      <div className="final-copy">
        <span className="micro">FINAL CONNECTOR / AVAILABLE</span>
        <h2>The system is still being built.</h2>
        <p>What should exist next?</p>
        <div className="contact-actions">
          <a href={profile.email}><span>01</span>EMAIL</a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer"><span>02</span>LINKEDIN ↗</a>
          <a href={profile.github} target="_blank" rel="noreferrer"><span>03</span>GITHUB ↗</a>
        </div>
        <small>© 2026 MAHARSHI PATEL / THE SYNTHESIS ENGINE</small>
      </div>
    </SectionShell>

    <RecruiterMode open={recruiter} onClose={()=>setRecruiter(false)}/>
    {selected&&<ProjectInspector project={selected} onClose={()=>setSelected(null)}/>}
  </main>;
}
