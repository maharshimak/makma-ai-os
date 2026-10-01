"use client";

import {useEffect,useMemo,useState} from "react";
import type {CSSProperties,PointerEvent as ReactPointerEvent} from "react";
import {WorldCanvas} from "./WorldCanvas";
import {RecruiterMode} from "./RecruiterMode";
import {SystemLoader} from "./SystemLoader";
import {AmbientSound} from "./AmbientSound";
import {experience,profile,projects,skillSystems,type Project} from "@/lib/content";

const chapters=[
  {id:"departure",label:"Departure",word:"ORIGIN"},
  {id:"profile",label:"Mission profile",word:"IDENTITY"},
  {id:"foundation",label:"Capability core",word:"STACK"},
  {id:"knowledge",label:"Knowledge systems",word:"KNOW"},
  {id:"agency",label:"Agentic systems",word:"ACT"},
  {id:"reliability",label:"Reliability systems",word:"PROVE"},
  {id:"flight-log",label:"Flight log",word:"TRACE"},
  {id:"principle",label:"Operating principle",word:"THESIS"},
  {id:"comms",label:"Open comms",word:"NEXT"}
] as const;

type ChapterId=(typeof chapters)[number]["id"];

function useJourney(){
  const [progress,setProgress]=useState(0);
  const [active,setActive]=useState(0);
  const [reducedMotion,setReducedMotion]=useState(false);

  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const readMotion=()=>setReducedMotion(media.matches);
    let frame=0;

    const update=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
        setProgress(Math.min(1,Math.max(0,window.scrollY/max)));
        const center=window.innerHeight*.5;
        let bestIndex=0;
        let bestDistance=Infinity;
        chapters.forEach((chapter,index)=>{
          const node=document.getElementById(chapter.id);
          if(!node)return;
          const rect=node.getBoundingClientRect();
          const sectionCenter=rect.top+Math.min(rect.height,window.innerHeight)*.5;
          const distance=Math.abs(sectionCenter-center);
          if(distance<bestDistance){bestDistance=distance;bestIndex=index;}
        });
        setActive(bestIndex);
      });
    };

    readMotion();
    update();
    media.addEventListener("change",readMotion);
    window.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    return ()=>{
      cancelAnimationFrame(frame);
      media.removeEventListener("change",readMotion);
      window.removeEventListener("scroll",update);
      window.removeEventListener("resize",update);
    };
  },[]);

  return {progress,active,reducedMotion};
}

function accentFor(project:Project){
  if(project.family.startsWith("Knowledge"))return "#9fdcff";
  if(project.family.startsWith("Agency"))return "#ffad73";
  return "#b8d5bd";
}

function ProjectCard({project,index,onOpen}:{project:Project;index:number;onOpen:()=>void}){
  const onPointerMove=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    const x=((event.clientX-rect.left)/rect.width)*100;
    const y=((event.clientY-rect.top)/rect.height)*100;
    event.currentTarget.style.setProperty("--px",x.toFixed(1)+"%");
    event.currentTarget.style.setProperty("--py",y.toFixed(1)+"%");
    event.currentTarget.style.setProperty("--rx",(((event.clientY-rect.top)/rect.height)-.5)*-5+"deg");
    event.currentTarget.style.setProperty("--ry",(((event.clientX-rect.left)/rect.width)-.5)*7+"deg");
  };
  const reset=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    event.currentTarget.style.setProperty("--rx","0deg");
    event.currentTarget.style.setProperty("--ry","0deg");
  };

  return <button
    className="director-project"
    onClick={onOpen}
    onPointerMove={onPointerMove}
    onPointerLeave={reset}
    style={{"--card-accent":accentFor(project),"--card-index":index} as CSSProperties}
  >
    <span className="director-project-glow" aria-hidden="true"/>
    <span className="director-project-top">
      <b>{String(index+1).padStart(2,"0")}</b>
      <em>{project.family}</em>
    </span>
    <span className="director-project-title">{project.name}</span>
    <span className="director-project-summary">{project.summary}</span>
    <span className="director-project-route">
      <i>{project.architecture[0]}</i><b>→</b><i>{project.architecture[project.architecture.length-1]}</i>
    </span>
    <span className="director-project-bottom">
      <small>{project.stack.slice(0,3).join(" · ")}</small>
      <strong>Open system ↗</strong>
    </span>
  </button>;
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
  id,index,label,word,active,children,className=""
}:{
  id:ChapterId;
  index:string;
  label:string;
  word:string;
  active:boolean;
  children:React.ReactNode;
  className?:string;
}){
  return <section id={id} data-story-section="true" className={"story-section director-section "+className+(active?" is-active":"")}>
    <div className="story-sticky">
      <div className="scene-curtain" aria-hidden="true"/>
      <div className="scene-word" aria-hidden="true">{word}</div>
      <div className="scene-index" aria-hidden="true">{index}</div>
      <div className="scene-label"><span>{index}</span><i/><b>{label}</b></div>
      {children}
    </div>
  </section>;
}

export function SynthesisPortfolio(){
  const {progress,active,reducedMotion}=useJourney();
  const [recruiter,setRecruiter]=useState(false);
  const [selected,setSelected]=useState<Project|null>(null);
  const [sound,setSound]=useState(false);
  const focusSystem=selected?.family.startsWith("Knowledge")?"knowledge":selected?.family.startsWith("Agency")?"agency":selected?.family.startsWith("Reliability")?"reliability":null;

  const families=useMemo(()=>[
    {
      id:"knowledge" as ChapterId,
      number:"03",
      kicker:"SYSTEM 01 / KNOWLEDGE",
      title:"Turn information into evidence.",
      note:"Retrieval, document intelligence and graph structure make knowledge traceable instead of merely plausible.",
      projects:projects.filter(project=>project.family.startsWith("Knowledge"))
    },
    {
      id:"agency" as ChapterId,
      number:"04",
      kicker:"SYSTEM 02 / AGENCY",
      title:"Turn evidence into action.",
      note:"Memory, planning, tools and explicit permission boundaries move AI beyond chat while keeping behaviour inspectable.",
      projects:projects.filter(project=>project.family.startsWith("Agency"))
    },
    {
      id:"reliability" as ChapterId,
      number:"05",
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

  const current=chapters[active]??chapters[0];

  return <main className="cosmic-portfolio director-cut" data-chapter={current.id} style={{"--journey":progress} as CSSProperties}>
    <SystemLoader/>
    <AmbientSound enabled={sound} progress={progress}/>
    <WorldCanvas progress={progress} reducedMotion={reducedMotion} focusSystem={focusSystem}/>
    <div className="film-grain" aria-hidden="true"/>
    <div className="lens-letterbox" aria-hidden="true"><i/><i/></div>

    <header className="topbar director-topbar">
      <a className="brand" href="#departure"><span>MP</span><b>MAHARSHI PATEL / AI SYSTEMS</b></a>
      <div className="topbar-center"><span>{String(active+1).padStart(2,"0")} / {String(chapters.length).padStart(2,"0")}</span><b>{current.label}</b></div>
      <div className="topbar-actions">
        <button onClick={()=>setSound(value=>!value)} aria-pressed={sound}>{sound?"Sound on":"Sound"}</button>
        <button onClick={()=>setRecruiter(true)}>Recruiter cut <kbd>R</kbd></button>
      </div>
    </header>

    <nav className="chapter-rail director-rail" aria-label="Portfolio chapters">
      {chapters.map((chapter,index)=><a key={chapter.id} href={"#"+chapter.id} className={active===index?"active":""}>
        <i/><span>{chapter.label}</span>
      </a>)}
    </nav>

    <div className="progress-line" aria-hidden="true"><span style={{transform:`scaleX(${progress})`}}/></div>

    <StorySection id="departure" index="00" label="Departure" word="ORIGIN" active={active===0} className="hero-scene director-hero-scene">
      <div className="director-hero">
        <div className="director-hero-kicker"><span>PARIS · 2026</span><i/><b>AI SYSTEMS ENGINEER</b></div>
        <h1 className="director-name" aria-label="Maharshi Patel"><span>MAHARSHI</span><span>PATEL</span></h1>
        <div className="director-manifesto" aria-label="Know. Act. Prove.">
          <span>KNOW.</span><span>ACT.</span><span>PROVE.</span>
        </div>
        <p>I build intelligent systems that retrieve evidence, reason over it, take controlled action and prove what happened.</p>
        <div className="director-actions">
          <a className="director-primary-link" href="#knowledge">Enter the systems <span>↗</span></a>
          <a href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
        </div>
      </div>
      <aside className="director-hero-aside">
        <span>MISSION / 2026</span>
        <b>9</b><small>ENGINEERING SYSTEMS</small>
        <p>Agents · Retrieval · Document AI · MLOps · Evaluation</p>
      </aside>
      <div className="director-scroll"><i/><span>SCROLL / CAMERA LIVE</span></div>
    </StorySection>

    <StorySection id="profile" index="01" label="Mission profile" word="IDENTITY" active={active===1} className="profile-scene director-profile-scene">
      <div className="director-profile">
        <div className="director-profile-head">
          <span className="eyebrow">MISSION PROFILE</span>
          <h2>Engineering intelligence into systems that can <em>remember</em>, <em>reason</em> and <em>act</em>.</h2>
        </div>
        <div className="director-profile-facts">
          <article><span>01</span><small>ROLE</small><b>{profile.role}</b></article>
          <article><span>02</span><small>BASE</small><b>{profile.location}</b></article>
          <article><span>03</span><small>EDUCATION</small><b>{profile.school}</b></article>
          <article><span>04</span><small>CREDENTIAL</small><b>{profile.certification}</b></article>
        </div>
      </div>
    </StorySection>

    <StorySection id="foundation" index="02" label="Capability core" word="STACK" active={active===2} className="foundation-scene director-foundation-scene">
      <div className="director-foundation">
        <div className="director-section-intro">
          <span className="eyebrow">CAPABILITY CORE</span>
          <h2>One stack.<br/>No fake boundaries.</h2>
          <p>Models, retrieval, agents, APIs, infrastructure and evaluation are one engineering surface when the goal is production.</p>
        </div>
        <div className="director-capability-stack">
          {skillSystems.map((system,index)=><article key={system.name}>
            <span>{String(index+1).padStart(2,"0")}</span>
            <b>{system.name}</b>
            <p>{system.items.join(" · ")}</p>
            <i aria-hidden="true"/>
          </article>)}
        </div>
      </div>
    </StorySection>

    {families.map((family,familyIndex)=>{
      const chapterIndex=chapters.findIndex(chapter=>chapter.id===family.id);
      return <StorySection
        key={family.id}
        id={family.id}
        index={family.number}
        label={family.id+" systems"}
        word={family.id==="knowledge"?"KNOW":family.id==="agency"?"ACT":"PROVE"}
        active={active===chapterIndex}
        className={"system-scene director-system-scene director-system-"+family.id}
      >
        <div className="director-system">
          <div className="director-system-copy">
            <span className="eyebrow">{family.kicker}</span>
            <h2>{family.title}</h2>
            <p>{family.note}</p>
            <div className="director-system-count"><b>{String(family.projects.length).padStart(2,"0")}</b><span>LIVE SYSTEMS / SELECT TO INSPECT</span></div>
          </div>
          <div className="director-project-grid">
            {family.projects.map((project,index)=><ProjectCard key={project.slug} project={project} index={familyIndex*3+index} onOpen={()=>setSelected(project)}/>)}
          </div>
        </div>
      </StorySection>;
    })}

    <StorySection id="flight-log" index="06" label="Flight log" word="TRACE" active={active===6} className="flight-scene director-flight-scene">
      <div className="director-flight">
        <div className="director-section-intro">
          <span className="eyebrow">FLIGHT LOG / EXPERIENCE</span>
          <h2>Seven missions.<br/>One trajectory.</h2>
          <p>Each role added a new layer: analytics, responsible AI, retrieval, agents, and production document intelligence.</p>
        </div>
        <div className="director-flight-list">
          {experience.slice().reverse().map((item,index)=><article key={item.company+item.period}>
            <span>{String(index+1).padStart(2,"0")}</span>
            <div><b>{item.company}</b><p>{item.role}</p></div>
            <small>{item.period}</small>
            <em>{item.signal}</em>
          </article>)}
        </div>
      </div>
    </StorySection>

    <StorySection id="principle" index="07" label="Operating principle" word="THESIS" active={active===7} className="principle-scene director-principle-scene">
      <div className="director-principle">
        <span className="eyebrow">OPERATING PRINCIPLE</span>
        <div className="director-thesis" aria-label="Knowledge. Agency. Reliability.">
          <span><i>01</i>KNOWLEDGE.</span>
          <span><i>02</i>AGENCY.</span>
          <span><i>03</i>RELIABILITY.</span>
        </div>
        <p>Not three themes. Three conditions for building AI systems that deserve to be used.</p>
      </div>
    </StorySection>

    <StorySection id="comms" index="08" label="Open comms" word="NEXT" active={active===8} className="contact-scene director-contact-scene">
      <div className="director-contact">
        <span className="eyebrow">OPEN COMMS</span>
        <h2>Build something<br/><em>that has to work.</em></h2>
        <p>The next mission has not launched yet.</p>
        <div className="director-contact-links">
          <a href={profile.email}><span>01</span><b>Email</b><i>↗</i></a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer"><span>02</span><b>LinkedIn</b><i>↗</i></a>
          <a href={profile.github} target="_blank" rel="noreferrer"><span>03</span><b>GitHub</b><i>↗</i></a>
        </div>
        <small>© 2026 Maharshi Patel · NASA/JPL-Caltech · NASA/ESA/CSA/STScI</small>
      </div>
    </StorySection>

    <RecruiterMode open={recruiter} onClose={()=>setRecruiter(false)}/>
    {selected&&<ProjectInspector project={selected} onClose={()=>setSelected(null)}/>}
  </main>;
}
