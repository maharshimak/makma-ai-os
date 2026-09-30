"use client";

import {useEffect,useMemo,useState} from "react";
import {WorldCanvas} from "./WorldCanvas";
import {RecruiterMode} from "./RecruiterMode";
import {experience,profile,projects,skillSystems,type Project} from "@/lib/content";

const sceneNames=["ACCESS","IDENTITY","FOUNDATION","KNOWLEDGE","AGENCY","RELIABILITY","REVISION","SYNTHESIS","CONTINUATION"];

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
      <button className="icon-button inspector-close" onClick={onClose} aria-label="Close project">×</button>
      <span className="micro">{project.family.toUpperCase()}</span>
      <h2>{project.name}</h2>
      <p className="inspector-lead">{project.summary}</p>
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
  const {progress,reducedMotion}=useJourney();
  const [recruiter,setRecruiter]=useState(false);
  const [selected,setSelected]=useState<Project|null>(null);
  const scene=Math.min(sceneNames.length-1,Math.floor(progress*sceneNames.length));
  const projectFamilies=useMemo(()=>[
    {name:"KNOWLEDGE & MEMORY",items:projects.filter(p=>p.family.startsWith("Knowledge"))},
    {name:"AUTONOMOUS SYSTEMS",items:projects.filter(p=>p.family.startsWith("Agency"))},
    {name:"RELIABILITY CORE",items:projects.filter(p=>p.family.startsWith("Reliability"))}
  ],[]);

  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key.toLowerCase()==="r"&&!selected)setRecruiter(v=>!v);if(e.key==="Escape"){setRecruiter(false);setSelected(null);}};
    window.addEventListener("keydown",key);
    return ()=>window.removeEventListener("keydown",key);
  },[selected]);

  return <main className="synthesis">
    <WorldCanvas progress={progress} reducedMotion={reducedMotion}/>
    <div className="grain" aria-hidden="true"/>
    <header className="hud">
      <a className="brand" href="#access"><span>MP</span><b>THE SYNTHESIS ENGINE</b></a>
      <div className="hud-center"><span>{String(scene+1).padStart(2,"0")}/{String(sceneNames.length).padStart(2,"0")}</span><b>{sceneNames[scene]}</b></div>
      <button className="recruiter-trigger" onClick={()=>setRecruiter(true)}>QUICK ACCESS <kbd>R</kbd></button>
    </header>
    <div className="progress-rail" aria-hidden="true"><span style={{transform:"scaleX("+progress+")"}}/></div>

    <SectionShell id="access" index="00" label="ACCESS APERTURE" className="opening">
      <div className="opening-copy">
        <span className="micro">AUTHORIZED SYSTEMS INSPECTION / PARIS / 2026</span>
        <div className="identity-lockup">
          <small>IDENTIFICATION FRAME</small>
          <h1>MAHARSHI<br/>PATEL</h1>
          <p>AI ENGINEER / INTELLIGENT SYSTEMS</p>
        </div>
        <div className="scroll-cue"><i/>SCROLL TO INSPECT</div>
      </div>
    </SectionShell>

    <SectionShell id="identity" index="01" label="IDENTIFICATION">
      <div className="split-copy">
        <div><span className="micro">SYSTEM OWNER</span><h2>I build systems where knowledge becomes action.</h2></div>
        <div className="identity-facts">
          <p>Agentic AI</p><p>RAG & knowledge systems</p><p>LLM engineering</p><p>AI infrastructure</p><p>ML systems & MLOps</p>
        </div>
      </div>
    </SectionShell>

    <SectionShell id="foundation" index="02" label="FOUNDATION">
      <div className="foundation-copy">
        <span className="micro">LOAD-BEARING SYSTEMS</span>
        <h2>The machine is only as strong as what it rests on.</h2>
        <div className="foundation-grid">
          <div><b>COMPUTING</b><span>Software engineering · algorithms · systems</span></div>
          <div><b>DATA</b><span>Analytics · pipelines · SQL · experimentation</span></div>
          <div><b>INTELLIGENCE</b><span>ML · NLP · LLMs · deep learning</span></div>
          <div><b>EDUCATION</b><span>{profile.school}</span></div>
          <div><b>VERIFIED</b><span>{profile.certification}</span></div>
        </div>
      </div>
    </SectionShell>

    {projectFamilies.map((family,fi)=><SectionShell key={family.name} id={"family-"+fi} index={String(fi+3).padStart(2,"0")} label={family.name}>
      <div className="systems-layout">
        <div className="systems-intro"><span className="micro">MACHINE SUBSYSTEM</span><h2>{family.name}</h2><p>{fi===0?"Raw information is parsed, connected, retrieved and returned with evidence.":fi===1?"Knowledge becomes planning, tools and controlled action.":"Intelligence is measured, gated, promoted and monitored before it earns trust."}</p></div>
        <div className="module-list">
          {family.items.map((p,i)=><button key={p.slug} className="module-terminal" onClick={()=>setSelected(p)}>
            <span className="module-no">{String(i+1).padStart(2,"0")}</span>
            <span className="module-main"><b>{p.name}</b><small>{p.summary}</small></span>
            <span className="module-open">INSPECT ↗</span>
          </button>)}
        </div>
      </div>
    </SectionShell>)}

    <SectionShell id="revision" index="06" label="REVISION RAIL">
      <div className="revision-layout">
        <div className="revision-heading"><span className="micro">SYSTEM REVISION HISTORY</span><h2>Each role changed what the machine could do next.</h2></div>
        <div className="revision-list">{experience.map((e,i)=><div className="revision-row" key={e.company+e.period}>
          <span>{String(i+1).padStart(2,"0")}</span><b>{e.company}</b><p>{e.role}</p><small>{e.period}</small><em>{e.signal}</em>
        </div>)}</div>
      </div>
    </SectionShell>

    <SectionShell id="synthesis" index="07" label="SYNTHESIS CHAMBER">
      <div className="synthesis-copy">
        <span className="micro">ALL SUBSYSTEMS / CONNECTED</span>
        <h2>Knowledge. Agency. Reliability.<br/><i>One engineering direction.</i></h2>
        <p>Building intelligent systems where retrieval, reasoning, tools, evaluation and infrastructure work together.</p>
        <div className="skill-system">{skillSystems.map(s=><div key={s.name}><b>{s.name}</b><span>{s.items.join(" / ")}</span></div>)}</div>
      </div>
    </SectionShell>

    <SectionShell id="continuation" index="08" label="UNFINISHED INTERFACE" className="final-scene">
      <div className="final-copy">
        <span className="micro">FINAL CONNECTOR / AVAILABLE</span>
        <h2>The system is still being built.</h2>
        <p>What should exist next?</p>
        <div className="contact-actions">
          <a href={profile.email}>EMAIL</a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">LINKEDIN ↗</a>
          <a href={profile.github} target="_blank" rel="noreferrer">GITHUB ↗</a>
        </div>
        <small>© 2026 MAHARSHI PATEL / THE SYNTHESIS ENGINE</small>
      </div>
    </SectionShell>

    <RecruiterMode open={recruiter} onClose={()=>setRecruiter(false)}/>
    {selected&&<ProjectInspector project={selected} onClose={()=>setSelected(null)}/>}
  </main>;
}
