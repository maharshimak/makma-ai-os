"use client";

import {useEffect,useMemo,useState} from "react";
import {WorldCanvas} from "./WorldCanvas";
import {RecruiterMode} from "./RecruiterMode";
import {SystemLoader} from "./SystemLoader";
import {AmbientSound} from "./AmbientSound";
import {experience,profile,projects,skillSystems,type Project} from "@/lib/content";

const chapters=[
  {id:"arrival",label:"Arrival"},
  {id:"identity",label:"Identity"},
  {id:"foundation",label:"Foundation"},
  {id:"knowledge",label:"Knowledge"},
  {id:"agency",label:"Agency"},
  {id:"reliability",label:"Reliability"},
  {id:"revision",label:"Experience"},
  {id:"synthesis",label:"Synthesis"},
  {id:"continuation",label:"Continue"}
];

function useJourney(){
  const [progress,setProgress]=useState(0);
  const [reducedMotion,setReducedMotion]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const readMotion=()=>setReducedMotion(media.matches);
    const update=()=>{
      const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      setProgress(Math.min(1,Math.max(0,window.scrollY/max)));
    };
    readMotion();
    update();
    media.addEventListener("change",readMotion);
    window.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    return ()=>{
      media.removeEventListener("change",readMotion);
      window.removeEventListener("scroll",update);
      window.removeEventListener("resize",update);
    };
  },[]);
  return {progress,reducedMotion};
}

function ProjectInspector({project,onClose}:{project:Project;onClose:()=>void}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  return <div className="inspector-backdrop" onMouseDown={onClose}>
    <article className="inspector" onMouseDown={event=>event.stopPropagation()} role="dialog" aria-modal="true" aria-label={project.name}>
      <button className="close-button" onClick={onClose} aria-label="Close project">Close</button>
      <div className="inspector-kicker">{project.family}</div>
      <h2>{project.name}</h2>
      <p className="inspector-lead">{project.summary}</p>
      <div className="inspector-grid">
        <section>
          <span>Why it exists</span>
          <p>{project.purpose}</p>
        </section>
        <section>
          <span>System flow</span>
          <ol>{project.architecture.map((stage,index)=><li key={stage}><b>{String(index+1).padStart(2,"0")}</b>{stage}</li>)}</ol>
        </section>
      </div>
      <div className="stack-line">{project.stack.map(item=><span key={item}>{item}</span>)}</div>
      <div className="action-row">
        <a href={base+"/projects/"+project.slug}>Technical dossier</a>
        <a href={project.repoUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
        {project.liveUrl&&<a href={project.liveUrl} target="_blank" rel="noreferrer">Live ↗</a>}
      </div>
    </article>
  </div>;
}

function Chapter({id,index,eyebrow,children,className=""}:{id:string;index:string;eyebrow:string;children:React.ReactNode;className?:string}){
  return <section id={id} className={"chapter "+className}>
    <div className="chapter-inner">
      <div className="chapter-marker"><span>{index}</span><i/><b>{eyebrow}</b></div>
      {children}
    </div>
  </section>;
}

export function SynthesisPortfolio(){
  const {progress,reducedMotion}=useJourney();
  const [recruiter,setRecruiter]=useState(false);
  const [selected,setSelected]=useState<Project|null>(null);
  const [sound,setSound]=useState(false);
  const active=Math.min(chapters.length-1,Math.floor(progress*chapters.length));

  const families=useMemo(()=>[
    {
      id:"knowledge",
      title:"Knowledge becomes evidence.",
      note:"Retrieval, document intelligence and graph structure turn raw information into something a system can reason over.",
      projects:projects.filter(project=>project.family.startsWith("Knowledge"))
    },
    {
      id:"agency",
      title:"Evidence becomes action.",
      note:"Memory, planning, tools and permission boundaries turn intelligence into controlled behaviour.",
      projects:projects.filter(project=>project.family.startsWith("Agency"))
    },
    {
      id:"reliability",
      title:"Action earns trust.",
      note:"Evaluation, promotion gates and monitoring decide whether a system is ready to leave the lab.",
      projects:projects.filter(project=>project.family.startsWith("Reliability"))
    }
  ],[]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key.toLowerCase()==="r"&&!selected)setRecruiter(value=>!value);
      if(event.key==="Escape"){setRecruiter(false);setSelected(null);}
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[selected]);

  useEffect(()=>{
    if(!recruiter&&!selected)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=previous;};
  },[recruiter,selected]);

  return <main className="portfolio">
    <SystemLoader/>
    <AmbientSound enabled={sound} progress={progress}/>
    <WorldCanvas progress={progress} reducedMotion={reducedMotion}/>

    <header className="site-header">
      <a href="#arrival" className="wordmark">MP</a>
      <div className="header-role"><span>Maharshi Patel</span><b>AI Engineer · Paris</b></div>
      <div className="header-actions">
        <button onClick={()=>setSound(value=>!value)} aria-pressed={sound}>{sound?"Sound on":"Sound"}</button>
        <button onClick={()=>setRecruiter(true)}>Quick view <kbd>R</kbd></button>
      </div>
    </header>

    <aside className="chapter-nav" aria-label="Portfolio chapters">
      {chapters.map((chapter,index)=><a key={chapter.id} href={"#"+chapter.id} className={active===index?"active":""}>
        <i/><span>{chapter.label}</span>
      </a>)}
    </aside>

    <div className="journey-progress" aria-hidden="true"><i style={{transform:`scaleX(${progress})`}}/></div>

    <Chapter id="arrival" index="00" eyebrow="The Synthesis Engine" className="hero-chapter">
      <div className="hero-layout">
        <div className="hero-copy">
          <span className="overline">AI ENGINEER · INTELLIGENT SYSTEMS</span>
          <h1>Maharshi<br/>Patel</h1>
          <p>I design systems that turn knowledge into controlled, measurable action.</p>
        </div>
        <div className="hero-note">
          <span>01</span>
          <p>This portfolio is one machine. Each chapter reveals a different subsystem.</p>
        </div>
      </div>
      <div className="scroll-prompt"><i/> Scroll to enter the system</div>
    </Chapter>

    <Chapter id="identity" index="01" eyebrow="Operating principle" className="statement-chapter">
      <div className="statement-layout">
        <h2>Intelligence is useful only when it can <em>remember, act and be trusted.</em></h2>
        <div className="statement-aside">
          <p>My work sits between LLM engineering, knowledge systems, agentic workflows and production ML.</p>
          <div className="principles"><span>Knowledge</span><span>Agency</span><span>Reliability</span></div>
        </div>
      </div>
    </Chapter>

    <Chapter id="foundation" index="02" eyebrow="Foundation" className="foundation-chapter">
      <div className="section-heading">
        <span className="overline">LOAD-BEARING LAYER</span>
        <h2>Built on engineering, not prompts.</h2>
      </div>
      <div className="foundation-list">
        <div><b>Computing</b><p>Software engineering · algorithms · systems</p><span>01</span></div>
        <div><b>Data</b><p>Analytics · pipelines · SQL · experimentation</p><span>02</span></div>
        <div><b>Intelligence</b><p>ML · NLP · LLMs · deep learning</p><span>03</span></div>
        <div><b>Education</b><p>{profile.school}</p><span>04</span></div>
        <div><b>Credential</b><p>{profile.certification}</p><span>05</span></div>
      </div>
    </Chapter>

    {families.map((family,index)=><Chapter key={family.id} id={family.id} index={String(index+3).padStart(2,"0")} eyebrow={family.id} className={"projects-chapter "+family.id}>
      <div className="projects-layout">
        <div className="section-heading">
          <span className="overline">SUBSYSTEM {String(index+1).padStart(2,"0")}</span>
          <h2>{family.title}</h2>
          <p>{family.note}</p>
        </div>
        <div className="project-list">
          {family.projects.map((project,projectIndex)=><button key={project.slug} onClick={()=>setSelected(project)} className="project-row">
            <span className="project-index">{String(projectIndex+1).padStart(2,"0")}</span>
            <span className="project-copy"><b>{project.name}</b><small>{project.summary}</small></span>
            <span className="project-stack">{project.stack.slice(0,3).join(" · ")}</span>
            <span className="project-arrow">↗</span>
          </button>)}
        </div>
      </div>
    </Chapter>)}

    <Chapter id="revision" index="06" eyebrow="Revision history" className="experience-chapter">
      <div className="section-heading">
        <span className="overline">EXPERIENCE</span>
        <h2>The machine changed with every role.</h2>
      </div>
      <div className="experience-list">
        {experience.slice().reverse().map((item,index)=><div key={item.company+item.period}>
          <span>{String(index+1).padStart(2,"0")}</span>
          <b>{item.company}</b>
          <p>{item.role}</p>
          <small>{item.period}</small>
          <em>{item.signal}</em>
        </div>)}
      </div>
    </Chapter>

    <Chapter id="synthesis" index="07" eyebrow="Synthesis" className="synthesis-chapter">
      <div className="synthesis-layout">
        <div className="section-heading">
          <span className="overline">ALL SUBSYSTEMS CONNECTED</span>
          <h2>One engineering direction.</h2>
          <p>Retrieval, reasoning, tools, evaluation and infrastructure are strongest when they are designed as one system.</p>
        </div>
        <div className="skills-map">{skillSystems.map((system,index)=><div key={system.name}>
          <span>{String(index+1).padStart(2,"0")}</span><b>{system.name}</b><p>{system.items.join(" · ")}</p>
        </div>)}</div>
      </div>
    </Chapter>

    <Chapter id="continuation" index="08" eyebrow="Unfinished interface" className="contact-chapter">
      <div className="contact-layout">
        <span className="overline">THE NEXT SYSTEM DOES NOT EXIST YET</span>
        <h2>What should we build next?</h2>
        <div className="contact-links">
          <a href={profile.email}>Email</a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
          <a href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
        <small>© 2026 Maharshi Patel</small>
      </div>
    </Chapter>

    <RecruiterMode open={recruiter} onClose={()=>setRecruiter(false)}/>
    {selected&&<ProjectInspector project={selected} onClose={()=>setSelected(null)}/>}
  </main>;
}
