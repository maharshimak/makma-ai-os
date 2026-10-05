"use client";

import {useEffect,useMemo,useRef,useState} from "react";
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
  const targetProgress=useRef(0);
  const easedProgress=useRef(0);

  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const readMotion=()=>setReducedMotion(media.matches);
    let animationFrame=0;

    const measure=()=>{
      const max=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      targetProgress.current=Math.min(1,Math.max(0,window.scrollY/max));

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
    };

    const animate=()=>{
      const target=targetProgress.current;
      if(media.matches){
        easedProgress.current=target;
      }else{
        easedProgress.current+=(target-easedProgress.current)*.075;
        if(Math.abs(target-easedProgress.current)<.00005)easedProgress.current=target;
      }
      const value=easedProgress.current;
      setProgress(previous=>Math.abs(previous-value)>.00008?value:previous);
      animationFrame=requestAnimationFrame(animate);
    };

    readMotion();
    measure();
    animate();
    media.addEventListener("change",readMotion);
    window.addEventListener("scroll",measure,{passive:true});
    window.addEventListener("resize",measure);
    return ()=>{
      cancelAnimationFrame(animationFrame);
      media.removeEventListener("change",readMotion);
      window.removeEventListener("scroll",measure);
      window.removeEventListener("resize",measure);
    };
  },[]);

  return {progress,active,reducedMotion};
}

function accentFor(project:Project){
  if(project.family.startsWith("Knowledge"))return "#9fdcff";
  if(project.family.startsWith("Agency"))return "#ffad73";
  return "#b8d5bd";
}

function DirectorCursor({reducedMotion}:{reducedMotion:boolean}){
  const cursor=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(reducedMotion||window.matchMedia("(pointer: coarse)").matches)return;
    const node=cursor.current;
    if(!node)return;
    let frame=0;
    let x=-100,y=-100;
    const render=()=>{
      node.style.transform=`translate3d(${x}px,${y}px,0)`;
      frame=0;
    };
    const onMove=(event:PointerEvent)=>{
      x=event.clientX;y=event.clientY;
      if(!frame)frame=requestAnimationFrame(render);
    };
    const onOver=(event:PointerEvent)=>{
      const target=event.target instanceof Element?event.target.closest("a,button"):null;
      node.classList.toggle("is-interactive",Boolean(target));
    };
    const onLeave=()=>node.classList.remove("is-visible");
    const onEnter=()=>node.classList.add("is-visible");
    window.addEventListener("pointermove",onMove,{passive:true});
    window.addEventListener("pointerover",onOver,{passive:true});
    document.documentElement.addEventListener("mouseleave",onLeave);
    document.documentElement.addEventListener("mouseenter",onEnter);
    node.classList.add("is-visible");
    return ()=>{
      if(frame)cancelAnimationFrame(frame);
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerover",onOver);
      document.documentElement.removeEventListener("mouseleave",onLeave);
      document.documentElement.removeEventListener("mouseenter",onEnter);
    };
  },[reducedMotion]);
  return <div ref={cursor} className="director-cursor" aria-hidden="true"><i/><span/></div>;
}

function ProjectCard({project,index,onOpen,onHover}:{project:Project;index:number;onOpen:(opener:HTMLButtonElement)=>void;onHover:(project:Project|null)=>void}){
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
    onClick={event=>onOpen(event.currentTarget)}
    onPointerEnter={()=>onHover(project)}
    onFocus={()=>onHover(project)}
    onPointerMove={onPointerMove}
    onPointerLeave={event=>{reset(event);onHover(null);}}
    onBlur={()=>onHover(null)}
    style={{"--card-accent":accentFor(project),"--card-index":index} as CSSProperties}
  >
    <span className="director-project-glow" aria-hidden="true"/>
    <span className="director-project-top">
      <b>{String(index+1).padStart(2,"0")}</b>
      <em>{project.family}</em>
    </span>
    <span className="director-project-title">{project.name}</span>
    <span className="director-project-summary">{project.summary}</span>
    <span className="director-project-proof"><b>PROOF</b>{project.proof[0]}</span>
    <span className="director-project-metrics" aria-hidden="true">
      <i><b>{String(project.architecture.length).padStart(2,"0")}</b>STAGES</i>
      <i><b>{String(project.implemented.length).padStart(2,"0")}</b>CAPABILITIES</i>
      <i><b>{String(project.proof.length).padStart(2,"0")}</b>PROOF SIGNALS</i>
    </span>
    <span className="director-project-route">
      <i>{project.architecture[0]}</i><b>→</b><i>{project.architecture[project.architecture.length-1]}</i>
    </span>
    <span className="director-project-bottom">
      <small>{project.stack.slice(0,3).join(" · ")}</small>
      <strong>Open system ↗</strong>
    </span>
  </button>;
}

function ProjectInspector({project,onClose,opener}:{project:Project;onClose:()=>void;opener:HTMLButtonElement|null}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  const dialogRef=useRef<HTMLElement>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;

  useEffect(()=>{
    const dialog=dialogRef.current;
    if(!dialog)return;
    const selector='a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables=()=>Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(node=>!node.hasAttribute("disabled"));
    const first=focusables()[0]??dialog;
    const frame=requestAnimationFrame(()=>first.focus({preventScroll:true}));

    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        event.preventDefault();
        closeRef.current();
        return;
      }
      if(event.key!=="Tab")return;
      const nodes=focusables();
      if(!nodes.length){
        event.preventDefault();
        dialog.focus();
        return;
      }
      const firstNode=nodes[0];
      const lastNode=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===firstNode){
        event.preventDefault();
        lastNode.focus();
      }else if(!event.shiftKey&&document.activeElement===lastNode){
        event.preventDefault();
        firstNode.focus();
      }
    };

    dialog.addEventListener("keydown",handleKey);
    return ()=>{
      cancelAnimationFrame(frame);
      dialog.removeEventListener("keydown",handleKey);
      requestAnimationFrame(()=>opener?.focus({preventScroll:true}));
    };
  },[project.slug,opener]);

  return <div className="inspector-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)closeRef.current();}}>
    <article ref={dialogRef} tabIndex={-1} className="inspector" role="dialog" aria-modal="true" aria-labelledby={"project-title-"+project.slug}>
      <button className="close-button" onClick={()=>closeRef.current()} aria-label="Close project">Close</button>
      <span className="eyebrow">{project.family}</span>
      <h2 id={"project-title-"+project.slug}>{project.name}</h2>
      <p className="inspector-lead">{project.summary}</p>
      <div className="inspector-signal-rail">
        <span><b>{project.architecture.length}</b>ARCHITECTURE STAGES</span>
        <span><b>{project.implemented.length}</b>IMPLEMENTED CAPABILITIES</span>
        <span><b>{project.proof.length}</b>PROOF SIGNALS</span>
        <span><b>{project.stack.length}</b>STACK LAYERS</span>
      </div>
      <div className="inspector-grid inspector-grid-primary">
        <section><span>Mission purpose</span><p>{project.purpose}</p></section>
        <section><span>Engineering challenge</span><p>{project.challenge}</p></section>
      </div>
      <section className="inspector-architecture">
        <span>Architecture</span>
        <ol>{project.architecture.map((stage,index)=><li key={stage}><b>{String(index+1).padStart(2,"0")}</b>{stage}</li>)}</ol>
      </section>
      <div className="inspector-evidence-grid">
        <section>
          <span>What is implemented</span>
          <ul>{project.implemented.map(item=><li key={item}>{item}</li>)}</ul>
        </section>
        <section>
          <span>Engineering proof</span>
          <ul>{project.proof.map(item=><li key={item}>{item}</li>)}</ul>
        </section>
      </div>
      <div className="inspector-boundary">
        <section><span>Trust boundary</span><p>{project.boundary}</p></section>
        <section><span>Next engineering vector</span><p>{project.next}</p></section>
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

function SystemsAtlas({open,onClose}:{open:boolean;onClose:()=>void}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  const dialogRef=useRef<HTMLElement>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;

  const groups=[
    {name:"KNOWLEDGE",note:"Evidence, retrieval and structured memory.",items:projects.filter(project=>project.family.startsWith("Knowledge"))},
    {name:"AGENCY",note:"Planning, tools, media and controlled action.",items:projects.filter(project=>project.family.startsWith("Agency"))},
    {name:"RELIABILITY",note:"Evaluation, governance and lifecycle proof.",items:projects.filter(project=>project.family.startsWith("Reliability"))}
  ];
  const totals={
    stages:projects.reduce((sum,project)=>sum+project.architecture.length,0),
    capabilities:projects.reduce((sum,project)=>sum+project.implemented.length,0),
    proofs:projects.reduce((sum,project)=>sum+project.proof.length,0),
    live:projects.filter(project=>project.liveUrl).length
  };

  useEffect(()=>{
    if(!open)return;
    const dialog=dialogRef.current;
    if(!dialog)return;
    const selector='a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables=()=>Array.from(dialog.querySelectorAll<HTMLElement>(selector));
    const frame=requestAnimationFrame(()=>(focusables()[0]??dialog).focus({preventScroll:true}));
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        event.preventDefault();
        closeRef.current();
        return;
      }
      if(event.key!=="Tab")return;
      const nodes=focusables();
      if(!nodes.length)return;
      const first=nodes[0],last=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    dialog.addEventListener("keydown",handleKey);
    return ()=>{cancelAnimationFrame(frame);dialog.removeEventListener("keydown",handleKey);};
  },[open]);

  if(!open)return null;
  return <div className="atlas-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)closeRef.current();}}>
    <article ref={dialogRef} tabIndex={-1} className="systems-atlas" role="dialog" aria-modal="true" aria-label="Systems atlas">
      <header className="atlas-head">
        <div>
          <span className="eyebrow">SYSTEMS ATLAS / ENGINEERING UNIVERSE</span>
          <h2 id="systems-atlas-title">Nine systems.<br/><em>One engineering philosophy.</em></h2>
          <p>Inspect the architecture behind the portfolio: what each system does, what is implemented, and where the evidence lives.</p>
        </div>
        <button className="atlas-close" onClick={()=>closeRef.current()} aria-label="Close systems atlas">Close</button>
      </header>
      <div className="atlas-signal-rail" aria-label="Portfolio engineering totals">
        <span><b>09</b>SYSTEMS</span>
        <span><b>{String(totals.stages).padStart(2,"0")}</b>ARCHITECTURE STAGES</span>
        <span><b>{String(totals.capabilities).padStart(2,"0")}</b>IMPLEMENTED CAPABILITIES</span>
        <span><b>{String(totals.proofs).padStart(2,"0")}</b>PROOF SIGNALS</span>
        <span><b>{String(totals.live).padStart(2,"0")}</b>LIVE EXPERIENCES</span>
      </div>
      <div className="atlas-groups">
        {groups.map((group,groupIndex)=><section key={group.name} className={"atlas-group atlas-group-"+group.name.toLowerCase()}>
          <header><span>0{groupIndex+1}</span><div><b>{group.name}</b><p>{group.note}</p></div></header>
          <div className="atlas-projects">
            {group.items.map(project=><a key={project.slug} href={base+"/projects/"+project.slug}>
              <span className="atlas-project-index">{String(projects.indexOf(project)+1).padStart(2,"0")}</span>
              <div><b>{project.name}</b><p>{project.summary}</p></div>
              <div className="atlas-project-evidence">
                <span>{project.architecture.length} stages</span>
                <span>{project.implemented.length} built</span>
                <span>{project.proof.length} proofs</span>
              </div>
              <i>↗</i>
            </a>)}
          </div>
        </section>)}
      </div>
      <footer className="atlas-footer">
        <span>KNOW → ACT → PROVE</span>
        <p>Evidence over plausibility · Permission before action · Evaluation before release.</p>
      </footer>
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
  const [atlas,setAtlas]=useState(false);
  const [selected,setSelected]=useState<Project|null>(null);
  const [hoveredProject,setHoveredProject]=useState<Project|null>(null);
  const [sound,setSound]=useState(false);
  const lastProjectOpener=useRef<HTMLButtonElement|null>(null);
  const focusSystem=selected?.family.startsWith("Knowledge")?"knowledge":selected?.family.startsWith("Agency")?"agency":selected?.family.startsWith("Reliability")?"reliability":null;
  const focusProject=(selected??hoveredProject)?.slug??null;

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
      if(event.key.toLowerCase()==="r"&&!selected&&!atlas)setRecruiter(value=>!value);
      if(event.key.toLowerCase()==="a"&&!selected&&!recruiter)setAtlas(value=>!value);
      if(event.key==="Escape"){setRecruiter(false);setAtlas(false);setSelected(null);}
    };
    window.addEventListener("keydown",handleKey);
    return ()=>window.removeEventListener("keydown",handleKey);
  },[selected,recruiter,atlas]);

  useEffect(()=>{
    if(!recruiter&&!atlas&&!selected)return;
    const before=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{document.body.style.overflow=before;};
  },[recruiter,atlas,selected]);

  const current=chapters[active]??chapters[0];
  const chapterAccent=
    current.id==="knowledge"?"#8fd8f4":
    current.id==="agency"?"#f3a06c":
    current.id==="reliability"?"#a9c9b0":
    current.id==="flight-log"?"#c88d78":
    current.id==="principle"?"#d6c9b6":
    current.id==="comms"?"#f0b27f":
    "#b5cbd4";

  return <main className="cosmic-portfolio director-cut" data-chapter={current.id} style={{"--journey":progress,"--chapter-accent":chapterAccent} as CSSProperties}>
    <SystemLoader/>
    <DirectorCursor reducedMotion={reducedMotion}/>
    <AmbientSound enabled={sound} progress={progress}/>
    <WorldCanvas progress={progress} reducedMotion={reducedMotion} focusSystem={focusSystem} focusProject={focusProject}/>
    <div className="cinematic-grade" aria-hidden="true"><i/><i/><i/></div>
    <div className="film-grain" aria-hidden="true"/>
    <div className="lens-letterbox" aria-hidden="true"><i/><i/></div>

    <header className="topbar director-topbar">
      <a className="brand" href="#departure"><span>MP</span><b>MAHARSHI PATEL / AI SYSTEMS</b></a>
      <div className="topbar-center"><span>{String(active+1).padStart(2,"0")} / {String(chapters.length).padStart(2,"0")}</span><b>{current.label}</b></div>
      <div className="topbar-actions">
        <button onClick={()=>setSound(value=>!value)} aria-pressed={sound}>{sound?"Sound on":"Sound"}</button>
        <button onClick={()=>setAtlas(true)}>Systems atlas <kbd>A</kbd></button>
        <button onClick={()=>setRecruiter(true)}>Recruiter cut <kbd>R</kbd></button>
      </div>
    </header>

    <nav className="chapter-rail director-rail" aria-label="Portfolio chapters">
      {chapters.map((chapter,index)=><a key={chapter.id} href={"#"+chapter.id} className={active===index?"active":""}>
        <i/><span>{chapter.label}</span>
      </a>)}
    </nav>

    <div className="progress-line" aria-hidden="true"><span style={{transform:`scaleX(${progress})`}}/></div>
    <div className="mission-telemetry" aria-hidden="true">
      <span><i/>CHAPTER <b>{String(active+1).padStart(2,"0")}</b></span>
      <span>MODE <b>{current.word}</b></span>
      <span>SYSTEMS <b>09</b></span>
      <span>PROGRESS <b>{Math.round(progress*100).toString().padStart(2,"0")}%</b></span>
    </div>

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
          <button className="director-atlas-link" onClick={()=>setAtlas(true)}>Systems atlas <span>09 ↗</span></button>
          <a href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
        </div>
      </div>
      <aside className="director-hero-aside">
        <span>MISSION / 2026</span>
        <b>9</b><small>ENGINEERING SYSTEMS</small>
        <p>Agents · Retrieval · Document AI · MLOps · Evaluation</p>
        <div className="hero-signal-grid">
          <span><b>07</b>MISSIONS</span>
          <span><b>04</b>LANGUAGES</span>
          <span><b>03</b>SYSTEM PILLARS</span>
          <span><b>01</b>AWS ML CERT</span>
        </div>
      </aside>
      <div className="director-scroll"><i/><span>SCROLL / CAMERA LIVE</span></div>
    </StorySection>

    <StorySection id="profile" index="01" label="Mission profile" word="IDENTITY" active={active===1} className="profile-scene director-profile-scene">
      <div className="director-profile">
        <div className="director-profile-head">
          <span className="eyebrow">MISSION PROFILE</span>
          <h2>Engineering intelligence into systems that can <em>remember</em>, <em>reason</em> and <em>act</em>.</h2>
          <div className="profile-about">{profile.about.map((line,index)=><p key={line}><b>0{index+1}</b>{line}</p>)}</div>
        </div>
        <div className="director-profile-facts">
          <article><span>01</span><small>ROLE</small><b>{profile.role}</b></article>
          <article><span>02</span><small>BASE</small><b>{profile.location}</b></article>
          <article><span>03</span><small>PROGRAM</small><b>{profile.program}</b></article>
          <article><span>04</span><small>CREDENTIAL</small><b>{profile.certification}</b></article>
        </div>
        <div className="identity-archive">
          <section className="identity-stats" aria-label="Profile statistics">
            {profile.stats.map((stat,index)=><article key={stat.label}><span>{String(index+1).padStart(2,"0")}</span><b>{stat.value}</b><small>{stat.label}</small></article>)}
          </section>
          <section className="identity-panel">
            <span className="identity-label">FORMATION / TRAJECTORY</span>
            <p><b>NOW</b>{profile.school}</p>
            <p><b>FORMAT</b>{profile.rhythm}</p>
            <p><b>FOUNDATION</b>{profile.priorEducation}</p>
          </section>
          <section className="identity-panel">
            <span className="identity-label">LANGUAGE CHANNELS</span>
            <div className="identity-tags">{profile.languages.map(item=><span key={item}>{item}</span>)}</div>
          </section>
          <section className="identity-panel identity-panel-wide">
            <span className="identity-label">ENGINEERING FOCUS</span>
            <div className="identity-tags">{profile.focus.map(item=><span key={item}>{item}</span>)}</div>
          </section>
          <section className="identity-panel identity-panel-wide identity-code">
            <span className="identity-label">OPERATING CODE</span>
            <ol>{profile.principles.map((item,index)=><li key={item}><b>{String(index+1).padStart(2,"0")}</b>{item}</li>)}</ol>
          </section>
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
            {family.projects.map((project,index)=><ProjectCard key={project.slug} project={project} index={familyIndex*3+index} onOpen={opener=>{lastProjectOpener.current=opener;setSelected(project);}} onHover={setHoveredProject}/>)}
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
            <div><b>{item.company}</b><p>{item.role}</p><p className="flight-detail">{item.detail}</p></div>
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
    <SystemsAtlas open={atlas} onClose={()=>setAtlas(false)}/>
    {selected&&<ProjectInspector project={selected} opener={lastProjectOpener.current} onClose={()=>setSelected(null)}/>}
  </main>;
}
