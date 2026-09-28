"use client";

import {AnimatePresence,motion,useScroll,useTransform} from "motion/react";
import {useCallback,useEffect,useRef,useState} from "react";
import {projects,profile} from "@/lib/content";
import {GalaxyScene} from "./GalaxyScene";
import {ProjectDossier} from "./ProjectDossier";
import {MissionNode} from "./MissionNode";
import {SignalText} from "./SignalText";
import {KineticManifesto} from "./KineticManifesto";
import {VelocityStreaks} from "./VelocityStreaks";
import {ChapterAtmosphere} from "./ChapterAtmosphere";
import {FlightArchive} from "./FlightArchive";
import {MagneticLink} from "./MagneticLink";
import {ChapterPulse} from "./ChapterPulse";
import {TransmissionSection} from "./TransmissionSection";
import {ChapterPortal} from "./ChapterPortal";
import {ReactiveArtLayer} from "./ReactiveArtLayer";

type SectionId="home"|"systems"|"observation"|"flight-log"|"manifesto"|"comms";

const chapters=[
  ["home","00","DEPARTURE"],
  ["systems","01","SYSTEMS"],
  ["observation","02","OBSERVATION"],
  ["flight-log","03","FLIGHT LOG"],
  ["manifesto","04","PRINCIPLE"],
  ["comms","05","TRANSMISSION"],
] as const;

export function GalacticPortfolio(){
  const [selectedProject,setSelectedProject]=useState<(typeof projects)[number]|null>(null);
  const [activeSection,setActiveSection]=useState<SectionId>("home");
  const [systemSignal,setSystemSignal]=useState(0);
  const closeDossier=useCallback(()=>setSelectedProject(null),[]);
  const activeChapter=chapters.find(([id])=>id===activeSection) ?? chapters[0];
  const heroRef=useRef<HTMLElement>(null);
  const observationRef=useRef<HTMLElement>(null);

  const {scrollYProgress}=useScroll();
  const {scrollYProgress:heroProgress}=useScroll({
    target:heroRef,
    offset:["start start","end start"],
  });
  const {scrollYProgress:observationProgress}=useScroll({
    target:observationRef,
    offset:["start 92%","end 8%"],
  });

  const heroExitY=useTransform(heroProgress,[0,.55,1],[0,-12,-92]);
  const heroExitOpacity=useTransform(heroProgress,[0,.62,1],[1,.94,.18]);
  const heroExitScale=useTransform(heroProgress,[0,.58,1],[1,1,.965]);
  const heroExitBlur=useTransform(heroProgress,[0,.72,1],["blur(0px)","blur(0px)","blur(5px)"]);
  const cardExitX=useTransform(heroProgress,[0,.56,1],[0,0,72]);
  const cardExitOpacity=useTransform(heroProgress,[0,.58,1],[1,.9,0]);
  const nebulaY=useTransform(scrollYProgress,[0,1],[0,150]);
  const nebulaScale=useTransform(scrollYProgress,[0,1],[1.03,1.13]);
  const observationY=useTransform(observationProgress,[0,1],[60,-55]);
  const observationScale=useTransform(observationProgress,[0,1],[1.13,1.01]);
  const observationClip=useTransform(observationProgress,[.02,.28],["inset(0 48% 0 48%)","inset(0 0% 0 0%)"]);
  const spectrumX=useTransform(observationProgress,[0,1],[-18,24]);
  const observationCopyY=useTransform(observationProgress,[.18,.72],[42,-18]);
  const storyGlow=useTransform(scrollYProgress,[0,.18,.45,.72,1],[0,.45,.17,.36,.06]);

  useEffect(()=>{
    const ids:SectionId[]=["home","systems","observation","flight-log","manifesto","comms"];
    const elements=ids.map(id=>document.getElementById(id)).filter((node):node is HTMLElement=>Boolean(node));
    if(elements.length===0) return;

    const observer=new IntersectionObserver(entries=>{
      const visible=entries
        .filter(entry=>entry.isIntersecting)
        .sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top));
      const id=visible[0]?.target.id as SectionId|undefined;
      if(id) setActiveSection(id);
    },{rootMargin:"-28% 0px -58% 0px",threshold:[0,.01,.15]});

    elements.forEach(element=>observer.observe(element));
    return ()=>observer.disconnect();
  },[]);

  return <main className="site-shell">
    <motion.div className="nebula" style={{y:nebulaY,scale:nebulaScale}}/>
    <div className="space-wash"/>
    <motion.div className="story-glow" style={{opacity:storyGlow}}/>
    <ReactiveArtLayer chapter={activeSection} accent={activeSection==="systems"?projects[systemSignal].accent:undefined}/>
    <ChapterAtmosphere chapter={activeSection}/>
    <ChapterPulse chapter={activeSection}/>
    <ChapterPortal chapter={activeSection}/>
    <VelocityStreaks/>
    <div className="screen-patina"/>
    <GalaxyScene progress={scrollYProgress} chapter={activeSection}/>

    <header className="nav-shell">
      <motion.div className="journey-progress" style={{scaleX:scrollYProgress}}/>
      <a className="mark" href="#home" aria-label="Return to mission profile"><span>MP</span><b>GALACTIC SYSTEMS</b></a>
      <div className="nav-signal"><i/> {activeChapter[1]} // {activeChapter[2]}</div>
      <nav aria-label="Primary navigation">
        <a className={activeSection==="systems"?"is-active":undefined} aria-current={activeSection==="systems"?"location":undefined} href="#systems"><em>01</em> Systems</a>
        <a className={activeSection==="flight-log"?"is-active":undefined} aria-current={activeSection==="flight-log"?"location":undefined} href="#flight-log"><em>03</em> Flight log</a>
        <a className={activeSection==="comms"?"is-active":undefined} aria-current={activeSection==="comms"?"location":undefined} href="#comms"><em>05</em> Comms</a>
      </nav>
    </header>

    <nav className="story-rail" aria-label="Story chapters">
      <span className="rail-label">MISSION ROUTE</span>
      <div className="rail-line" aria-hidden="true"><motion.i style={{scaleY:scrollYProgress}}/></div>
      {chapters.map(([id,number,label])=><a
        key={id}
        href={`#${id}`}
        className={activeSection===id?"is-active":undefined}
        aria-current={activeSection===id?"location":undefined}
      ><b>{number}</b><span>{label}</span></a>)}
    </nav>

    <section ref={heroRef} id="home" className="hero section-pad">
      <div className="hero-chapter" aria-hidden="true"><span>CHAPTER 00</span><i/>DEPARTURE</div>
      <div className="hero-art-wordmark" aria-hidden="true"><span>MAHARSHI</span><span>PATEL</span></div>
      <motion.div className="hero-copy" style={{y:heroExitY,opacity:heroExitOpacity,scale:heroExitScale,filter:heroExitBlur}}>
        <p className="eyebrow"><SignalText text="MISSION PROFILE // PARIS // 2026"/></p>
        <h1 className="hero-title" aria-label="I build AI systems for the real universe.">
          <motion.span
            className="hero-title-line"
            initial={{clipPath:"inset(0 0 100% 0)",y:48,filter:"blur(10px)"}}
            animate={{clipPath:"inset(0 0 0% 0)",y:0,filter:"blur(0px)"}}
            transition={{delay:.18,duration:1.05,ease:[.16,1,.3,1]}}
          >I build AI systems</motion.span>
          <motion.span
            className="hero-title-line outline"
            initial={{clipPath:"inset(0 0 100% 0)",y:52,filter:"blur(12px)"}}
            animate={{clipPath:"inset(0 0 0% 0)",y:0,filter:"blur(0px)"}}
            transition={{delay:.34,duration:1.1,ease:[.16,1,.3,1]}}
          >for the real universe.</motion.span>
        </h1>
        <motion.p className="hero-lede" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:.52,duration:.75}}>
          {profile.name} · {profile.role}. Retrieval, agents, document intelligence, data pipelines and production ML—designed as systems, not demos.
        </motion.p>
        <motion.div className="hero-actions" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.65,duration:.62}}>
          <MagneticLink className="primary-cta" href="#systems"><span className="cta-beam" aria-hidden="true"/>Enter mission map <span>↗</span></MagneticLink>
          <a className="text-link" href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
        </motion.div>
        <motion.div className="mission-facts" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.76,duration:.6}}>
          <span>AI / Data Engineer</span>
          <span>Paris</span>
          <span>Alternance · Available now</span>
          <span>AWS ML Engineer Associate</span>
        </motion.div>
      </motion.div>

      <motion.div className="hero-sigil" initial={{opacity:0,scale:.72,rotate:-18}} animate={{opacity:1,scale:1,rotate:0}} transition={{delay:.7,duration:1.4,ease:[.16,1,.3,1]}} aria-hidden="true">
        <span className="sigil-ring ring-a"/><span className="sigil-ring ring-b"/><span className="sigil-ring ring-c"/>
        <i className="sigil-axis axis-a"/><i className="sigil-axis axis-b"/>
        <b>MP</b><em>MAK'MA NAV CORE</em>
      </motion.div>
      <motion.div
        className="planet-lock"
        aria-hidden="true"
        initial={{opacity:0,scale:1.08}}
        animate={{opacity:1,scale:1}}
        transition={{delay:.92,duration:1.2,ease:[.16,1,.3,1]}}
      >
        <i/><i/><i/><i/>
        <span>JUPITER // NAV LOCK</span>
        <b>ORBIT ~5.2 AU</b>
      </motion.div>

      <motion.div className="mission-card" style={{x:cardExitX,opacity:cardExitOpacity}}>
        <div className="card-code">REC // MP-26</div>
        <span>ACTIVE SIGNAL</span>
        <strong>Available for AI / Data alternance</strong>
        <p>{profile.school}</p>
        <div className="signal-line"><i/><i/><i/><i/><i/></div>
      </motion.div>
      <div className="telemetry-strip"><span>AGENTS</span><span>RAG</span><span>DOCUMENT AI</span><span>MLOPS</span><span>OBSERVABILITY</span></div>
      <div className="scroll-cue"><span>SCROLL TO INITIATE</span><i/></div>
    </section>

    <section id="systems" className="systems section-pad" style={{scrollMarginTop:88}}>
      <AnimatePresence mode="wait">
        <motion.div
          key={projects[systemSignal].slug}
          className="systems-aura"
          style={{"--system-accent":projects[systemSignal].accent} as React.CSSProperties}
          initial={{opacity:0,scale:1.08}}
          animate={{opacity:1,scale:1}}
          exit={{opacity:0,scale:1.05}}
          transition={{duration:.65,ease:[.16,1,.3,1]}}
          aria-hidden="true"
        >
          <span>SIGNAL // {projects[systemSignal].name}</span>
        </motion.div>
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.aside
          key={`frequency-${projects[systemSignal].slug}`}
          className="system-frequency-console"
          style={{"--system-accent":projects[systemSignal].accent} as React.CSSProperties}
          initial={{opacity:0,x:24,filter:"blur(8px)"}}
          animate={{opacity:1,x:0,filter:"blur(0px)"}}
          exit={{opacity:0,x:-18,filter:"blur(8px)"}}
          transition={{duration:.48,ease:[.16,1,.3,1]}}
          aria-hidden="true"
        >
          <span>ACTIVE TRANSMISSION // {String(systemSignal+1).padStart(2,"0")}</span>
          <strong>{projects[systemSignal].name}</strong>
          <i/>
          <div>{projects[systemSignal].stack.slice(0,3).map(item=><b key={item}>{item}</b>)}</div>
        </motion.aside>
      </AnimatePresence>
      <div className="chapter-kicker"><span>01</span><SignalText text="SYSTEM CONSTELLATION"/></div>
      <div className="section-head">
        <p className="eyebrow">PROJECT CONSTELLATION // 01</p>
        <h2>Five systems.<br/>One engineering trajectory.</h2>
        <p>These are working products, not concept cards. Follow the route, open a system dossier, then launch the live implementation.</p>
      </div>
      <div className="mission-map">
        <svg className="route-map" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff9b54" stopOpacity=".78"/>
              <stop offset="50%" stopColor="#94baff" stopOpacity=".48"/>
              <stop offset="100%" stopColor="#8af0c7" stopOpacity=".68"/>
            </linearGradient>
            <filter id="routeGlow" x="-200%" y="-200%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <motion.path
            id="mission-route-path"
            d="M20 118 C180 32 252 212 400 170 S660 42 790 188 S885 420 980 520"
            initial={{pathLength:0,opacity:.12}}
            whileInView={{pathLength:1,opacity:.76}}
            viewport={{once:true,amount:.2}}
            transition={{duration:2.4,ease:[.16,1,.3,1]}}
          />
          <circle className="route-probe" r="4" filter="url(#routeGlow)">
            <animateMotion dur="8s" repeatCount="indefinite" path="M20 118 C180 32 252 212 400 170 S660 42 790 188 S885 420 980 520"/>
          </circle>
          {[["19%","18%"],["39%","28%"],["62%","21%"],["78%","43%"],["91%","78%"]].map(([left,top],index)=><circle className="route-node" key={index} cx={left} cy={top} r="3"/>)}
        </svg>
        <div className="map-spine"><span>ORIGIN</span><i/><span>ACTIVE SYSTEMS</span><i/><span>LIVE PRODUCTS</span></div>
        <div className="map-coordinate" aria-hidden="true">ROUTE // 05 SYSTEMS · SOURCE // PUBLIC · STATUS // LIVE</div>
        {projects.map((project,index)=><MissionNode key={project.slug} project={project} index={index} onSignal={()=>setSystemSignal(index)} onOpen={()=>setSelectedProject(project)}/>)}
      </div>
    </section>

    <section ref={observationRef} id="observation" className="observation section-pad" aria-label="Cosmic observation interlude">
      <div className="chapter-kicker"><span>02</span><SignalText text="OBSERVATION WINDOW"/></div>
      <div className="observation-frame">
        <motion.div className="observation-media" style={{clipPath:observationClip}}>
          <motion.div className="observation-image" style={{y:observationY,scale:observationScale}}/>
          <motion.div className="observation-spectrum" style={{x:spectrumX}}/>
        </motion.div>
        <div className="observation-scan" aria-hidden="true"/>
        <div className="observation-index"><span>OBSERVATION // WEBB 02</span><i/><span>CALIBRATED</span></div>
        <motion.div className="observation-copy" style={{y:observationCopyY}}>
          <p>Visual systems should reveal structure, not bury it.</p>
          <h2>Build the machine.<br/><em>Then make it unforgettable.</em></h2>
        </motion.div>
        <div className="observation-spectrum-key" aria-hidden="true">
          {["F090W","F200W","F335M","F444W","MIRI"].map((item,index)=><span key={item}><i style={{height:`${24+index*10}px`}}/>{item}</span>)}
        </div>
        <div className="observation-meta">
          <b>COSMIC CLIFFS · NGC 3324</b>
          <span>NASA · ESA · CSA · STScI</span>
        </div>
      </div>
    </section>

    <section id="flight-log" className="flight-log section-pad" style={{scrollMarginTop:88}}>
      <div className="flight-atlas" aria-hidden="true"/>
      <div className="chapter-kicker"><span>03</span><SignalText text="FLIGHT RECORD"/></div>
      <div className="section-head compact">
        <p className="eyebrow">FLIGHT LOG // 03</p>
        <h2>Experience, logged as capability.</h2>
      </div>
      <FlightArchive/>
    </section>

    <KineticManifesto/>

    <TransmissionSection/>
    <ProjectDossier project={selectedProject} onClose={closeDossier}/>
  </main>;
}
