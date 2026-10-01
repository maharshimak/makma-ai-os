"use client";

import {useEffect,useMemo,useState} from "react";
import {WorldCanvas} from "./WorldCanvas";
import {RecruiterMode} from "./RecruiterMode";
import {SystemLoader} from "./SystemLoader";
import {AmbientSound} from "./AmbientSound";
import {experience,profile,projects,skillSystems,type Project} from "@/lib/content";

const chapters=[
  {id:"departure",label:"Departure"},
  {id:"profile",label:"Mission profile"},
  {id:"foundation",label:"Capability core"},
  {id:"knowledge",label:"Knowledge systems"},
  {id:"agency",label:"Agentic systems"},
  {id:"reliability",label:"Reliability systems"},
  {id:"flight-log",label:"Flight log"},
  {id:"principle",label:"Operating principle"},
  {id:"comms",label:"Open comms"}
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
      <span className="eyebrow">{project.family}</span>
      <h2>{project.name}</h2>
      <p className="inspector-lead">{project.summary}</p>
      <div className="inspector-grid">
        <section><span>Purpose</span><p>{project.purpose}</p></section>
        <section>
          <span>Architecture</span>
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

function StorySection({
  id,index,label,children,className=""
}:{
  id:string;
  index:string;
  label:string;
  children:React.ReactNode;
  className?:string;
}){
  return <section id={id} className={"story-section "+className}>
    <div className="story-sticky">
      <div className="scene-label"><span>{index}</span><i/><b>{label}</b></div>
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
  const focusSystem=selected?.family.startsWith("Knowledge")?"knowledge":selected?.family.startsWith("Agency")?"agency":selected?.family.startsWith("Reliability")?"reliability":null;

  const families=useMemo(()=>[
    {
      id:"knowledge",
      kicker:"SYSTEM 01 / KNOWLEDGE",
      title:"Turn information into evidence.",
      note:"Retrieval, document intelligence and graph structure make knowledge traceable instead of merely plausible.",
      projects:projects.filter(project=>project.family.startsWith("Knowledge"))
    },
    {
      id:"agency",
      kicker:"SYSTEM 02 / AGENCY",
      title:"Turn evidence into action.",
      note:"Memory, planning, tools and explicit permission boundaries move AI beyond chat while keeping behaviour inspectable.",
      projects:projects.filter(project=>project.family.startsWith("Agency"))
    },
    {
      id:"reliability",
      kicker:"SYSTEM 03 / RELIABILITY",
      title:"Make action earn trust.",
      note:"Evaluation, release gates, observability and monitoring decide whether an intelligent system is ready for reality.",
      projects:projects.filter(project=>project.family.startsWith("Reliability"))
    }
  ],[]);

  useEffect(()=>{
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key.toLowerCase()==="r"&&!selected)setRecruiter(value=>!value);
      if(event.key==="Escape"){setRecruiter(false);setSelected(null);}
    };
    window.addEventListener("keydown",handleKey);
    return ()=>window.removeEventListener("keydown",handleKey);
  },[selected]);

  useEffect(()=>{
    if(!recruiter&&!selected)return;
    const before=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=before;};
  },[recruiter,selected]);

  return <main className="cosmic-portfolio" data-chapter={chapters[active].id} style={{"--journey":progress} as React.CSSProperties}>
    <SystemLoader/>
    <AmbientSound enabled={sound} progress={progress}/>
    <WorldCanvas progress={progress} reducedMotion={reducedMotion} focusSystem={focusSystem}/>

    <header className="topbar">
      <a className="brand" href="#departure"><span>MP</span><b>AI SYSTEMS / 2026</b></a>
      <div className="topbar-center"><span>{String(active+1).padStart(2,"0")} / {String(chapters.length).padStart(2,"0")}</span><b>{chapters[active].label}</b></div>
      <div className="topbar-actions">
        <button onClick={()=>setSound(value=>!value)} aria-pressed={sound}>{sound?"Sound on":"Sound"}</button>
        <button onClick={()=>setRecruiter(true)}>Quick view <kbd>R</kbd></button>
      </div>
    </header>

    <nav className="chapter-rail" aria-label="Portfolio chapters">
      {chapters.map((chapter,index)=><a key={chapter.id} href={"#"+chapter.id} className={active===index?"active":""}>
        <i/><span>{chapter.label}</span>
      </a>)}
    </nav>

    <div className="progress-line" aria-hidden="true"><span style={{transform:`scaleX(${progress})`}}/></div>

    <StorySection id="departure" index="00" label="Departure" className="hero-scene">
      <div className="hero-copy">
        <span className="eyebrow">AI ENGINEER · PARIS / FRANCE</span>
        <h1>MAHARSHI<br/>PATEL</h1>
        <p>I build intelligent systems that retrieve evidence, reason over it, take controlled action and prove what happened.</p>
        <div className="hero-links">
          <a href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
        </div>
      </div>
      <div className="mission-caption">
        <span>PORTFOLIO / 2026</span>
        <p>Career and projects are the story. Space is the cinematic language.</p>
      </div>
      <div className="scroll-cue"><i/>SCROLL TO DEPART</div>
    </StorySection>

    <StorySection id="profile" index="01" label="Mission profile" className="profile-scene">
      <div className="profile-layout">
        <div>
          <span className="eyebrow">MISSION PROFILE</span>
          <h2>Engineering intelligence into systems that can remember, reason and act.</h2>
        </div>
        <div className="profile-facts">
          <div><span>ROLE</span><b>{profile.role}</b></div>
          <div><span>BASE</span><b>{profile.location}</b></div>
          <div><span>EDUCATION</span><b>{profile.school}</b></div>
          <div><span>CREDENTIAL</span><b>{profile.certification}</b></div>
        </div>
      </div>
    </StorySection>

    <StorySection id="foundation" index="02" label="Capability core" className="foundation-scene">
      <div className="foundation-layout">
        <div className="scene-heading">
          <span className="eyebrow">CAPABILITY CORE</span>
          <h2>The systems underneath the systems.</h2>
          <p>Software, data, models, retrieval, infrastructure and evaluation are treated as one engineering surface.</p>
        </div>
        <div className="capability-grid">
          {skillSystems.map((system,index)=><div key={system.name}>
            <span>{String(index+1).padStart(2,"0")}</span>
            <b>{system.name}</b>
            <p>{system.items.join(" · ")}</p>
          </div>)}
        </div>
      </div>
    </StorySection>

    {families.map((family,index)=><StorySection
      key={family.id}
      id={family.id}
      index={String(index+3).padStart(2,"0")}
      label={family.id+" systems"}
      className={"system-scene system-"+family.id}
    >
      <div className={"system-layout "+(index%2===0?"align-right":"align-left")}>
        <div className="system-copy">
          <span className="eyebrow">{family.kicker}</span>
          <h2>{family.title}</h2>
          <p>{family.note}</p>
        </div>
        <div className="project-constellation">
          {family.projects.map((project,projectIndex)=><button key={project.slug} className="project-orbit" onClick={()=>setSelected(project)}>
            <span className="project-no"><i/>{String(projectIndex+1).padStart(2,"0")}</span>
            <span className="project-info">
              <b>{project.name}</b>
              <small>{project.summary}</small>
              <em>{project.stack.slice(0,3).join(" · ")}</em>
            </span>
            <span className="project-open">Explore ↗</span>
          </button>)}
        </div>
      </div>
    </StorySection>)}

    <StorySection id="flight-log" index="06" label="Flight log" className="flight-scene">
      <div className="flight-layout">
        <div className="scene-heading">
          <span className="eyebrow">FLIGHT LOG / EXPERIENCE</span>
          <h2>Every mission changed what I could build next.</h2>
        </div>
        <div className="flight-log">
          {experience.slice().reverse().map((item,index)=><div key={item.company+item.period}>
            <span>{String(index+1).padStart(2,"0")}</span>
            <b>{item.company}</b>
            <p>{item.role}</p>
            <small>{item.period}</small>
            <em>{item.signal}</em>
          </div>)}
        </div>
      </div>
    </StorySection>

    <StorySection id="principle" index="07" label="Operating principle" className="principle-scene">
      <div className="principle-copy">
        <span className="eyebrow">OPERATING PRINCIPLE</span>
        <h2>Knowledge.<br/>Agency.<br/>Reliability.</h2>
        <p>Not three themes. Three conditions for building AI systems that deserve to be used.</p>
      </div>
    </StorySection>

    <StorySection id="comms" index="08" label="Open comms" className="contact-scene">
      <div className="contact-copy">
        <span className="eyebrow">OPEN COMMS</span>
        <h2>The next mission has not launched yet.</h2>
        <p>What should exist next?</p>
        <div className="contact-links">
          <a href={profile.email}>Email</a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
          <a href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
        <small>© 2026 Maharshi Patel · Imagery & textures: NASA/JPL-Caltech · NASA/ESA/CSA/STScI</small>
      </div>
    </StorySection>

    <RecruiterMode open={recruiter} onClose={()=>setRecruiter(false)}/>
    {selected&&<ProjectInspector project={selected} onClose={()=>setSelected(null)}/>}
  </main>;
}
