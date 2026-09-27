"use client";

import {motion, useScroll, useTransform} from "motion/react";
import {useCallback, useEffect, useState} from "react";
import {projects, flightLog, profile} from "@/lib/content";
import {GalaxyScene} from "./GalaxyScene";
import {ProjectDossier} from "./ProjectDossier";

type SectionId = "home" | "systems" | "flight-log" | "comms";

export function GalacticPortfolio(){
  const [selectedProject,setSelectedProject] = useState<(typeof projects)[number] | null>(null);
  const [activeSection,setActiveSection] = useState<SectionId>("home");
  const closeDossier = useCallback(()=>setSelectedProject(null),[]);
  const {scrollYProgress} = useScroll();
  const nebulaY = useTransform(scrollYProgress,[0,1],[0,150]);
  const nebulaScale = useTransform(scrollYProgress,[0,1],[1.03,1.13]);
  const observationY = useTransform(scrollYProgress,[.23,.58],[34,-30]);
  const observationScale = useTransform(scrollYProgress,[.23,.58],[1.04,1]);

  useEffect(()=>{
    const ids:SectionId[] = ["home","systems","flight-log","comms"];
    const elements = ids.map(id=>document.getElementById(id)).filter((node):node is HTMLElement=>Boolean(node));
    if(elements.length===0) return;

    const observer = new IntersectionObserver(entries=>{
      const visible = entries
        .filter(entry=>entry.isIntersecting)
        .sort((a,b)=>Math.abs(a.boundingClientRect.top)-Math.abs(b.boundingClientRect.top));
      const id = visible[0]?.target.id as SectionId | undefined;
      if(id) setActiveSection(id);
    },{rootMargin:"-28% 0px -58% 0px",threshold:[0,.01,.15]});

    elements.forEach(element=>observer.observe(element));
    return ()=>observer.disconnect();
  },[]);

  return <main className="site-shell">
    <motion.div className="nebula" style={{y:nebulaY,scale:nebulaScale}}/>
    <div className="space-wash"/>
    <div className="screen-patina"/>
    <GalaxyScene progress={scrollYProgress}/>

    <header className="nav-shell">
      <motion.div className="journey-progress" style={{scaleX:scrollYProgress}}/>
      <a className="mark" href="#home" aria-label="Return to mission profile"><span>MP</span><b>GALACTIC SYSTEMS</b></a>
      <div className="nav-signal"><i/> SIGNAL LIVE</div>
      <nav aria-label="Primary navigation">
        <a className={activeSection==="systems"?"is-active":undefined} aria-current={activeSection==="systems"?"location":undefined} href="#systems"><em>01</em> Systems</a>
        <a className={activeSection==="flight-log"?"is-active":undefined} aria-current={activeSection==="flight-log"?"location":undefined} href="#flight-log"><em>02</em> Flight log</a>
        <a className={activeSection==="comms"?"is-active":undefined} aria-current={activeSection==="comms"?"location":undefined} href="#comms"><em>03</em> Comms</a>
      </nav>
    </header>

    <section id="home" className="hero section-pad">
      <div className="hero-copy">
        <motion.p className="eyebrow" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:.15}}>MISSION PROFILE // PARIS // 2026</motion.p>
        <motion.h1 initial={{opacity:0,y:32}} animate={{opacity:1,y:0}} transition={{delay:.22,duration:.85,ease:[.16,1,.3,1]}}>
          I build AI systems<br/><em>for the real universe.</em>
        </motion.h1>
        <motion.p className="hero-lede" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{delay:.34,duration:.7}}>
          {profile.name} · {profile.role}. Retrieval, agents, document intelligence, data pipelines and production ML—designed as systems, not demos.
        </motion.p>
        <motion.div className="hero-actions" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.48}}>
          <a className="primary-cta" href="#systems">Enter mission map <span>↗</span></a>
          <a className="text-link" href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
        </motion.div>
        <motion.div className="mission-facts" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.58,duration:.6}}>
          <span>AI / Data Engineer</span>
          <span>Paris</span>
          <span>Alternance · Available now</span>
          <span>AWS ML Engineer Associate</span>
        </motion.div>
      </div>
      <div className="mission-card">
        <div className="card-code">REC // MP-26</div>
        <span>ACTIVE SIGNAL</span>
        <strong>Available for AI / Data alternance</strong>
        <p>{profile.school}</p>
        <div className="signal-line"><i/><i/><i/><i/><i/></div>
      </div>
      <div className="telemetry-strip"><span>AGENTS</span><span>RAG</span><span>DOCUMENT AI</span><span>MLOPS</span><span>OBSERVABILITY</span></div>
      <div className="scroll-cue"><span>SCROLL TO NAVIGATE</span><i/></div>
    </section>

    <section id="systems" className="systems section-pad" style={{scrollMarginTop:88}}>
      <div className="section-head">
        <p className="eyebrow">PROJECT CONSTELLATION // 01</p>
        <h2>Five systems.<br/>One engineering trajectory.</h2>
        <p>These are working products, not concept cards. Launch the live demos, then inspect the source and engineering boundaries.</p>
      </div>
      <div className="mission-map">
        <div className="map-spine"><span>ORIGIN</span><i/><span>ACTIVE SYSTEMS</span><i/><span>LIVE PRODUCTS</span></div>
        {projects.map((project,index)=><motion.article
          key={project.slug}
          className={`mission-node mission-node-${index+1}`}
          style={{display:"block","--accent":project.accent} as React.CSSProperties}
          initial={{opacity:0,y:24}}
          whileInView={{opacity:1,y:0}}
          viewport={{once:true,amount:.18}}
          transition={{delay:index*.055,duration:.55}}
        >
          <div className="mission-node-head">
            <span>0{index+1} // {project.domain}</span>
            <span className="live-pulse"><i/> LIVE</span>
          </div>
          <h3>{project.name}</h3>
          <p className="mission-summary">{project.summary}</p>
          <div className="mission-proof"><span>PROOF</span><strong>{project.proof}</strong></div>
          <div className="mission-stack">{project.stack.map(item=><span key={item}>{item}</span>)}</div>
          <div className="mission-node-actions">
            <button type="button" onClick={()=>setSelectedProject(project)}>OPEN DOSSIER <span>↗</span></button>
            <a href={project.liveUrl} target="_blank" rel="noreferrer">DEMO <span>↗</span></a>
            <a href={project.repoUrl} target="_blank" rel="noreferrer">SOURCE <span>↗</span></a>
          </div>
        </motion.article>)}
      </div>
    </section>

    <section className="observation section-pad" aria-label="Cosmic observation interlude">
      <div className="observation-frame">
        <motion.div className="observation-image" style={{y:observationY,scale:observationScale}}/>
        <div className="observation-index"><span>OBSERVATION // WEBB 02</span><i/><span>CALIBRATED</span></div>
        <div className="observation-copy">
          <p>Visual systems should reveal structure, not bury it.</p>
          <h2>Build the machine.<br/><em>Then make it unforgettable.</em></h2>
        </div>
        <div className="observation-meta">
          <b>COSMIC CLIFFS · NGC 3324</b>
          <span>NASA · ESA · CSA · STScI</span>
        </div>
      </div>
    </section>

    <section id="flight-log" className="flight-log section-pad" style={{scrollMarginTop:88}}>
      <div className="section-head compact">
        <p className="eyebrow">FLIGHT LOG // 02</p>
        <h2>Experience, logged as capability.</h2>
      </div>
      <div className="log-table">
        {flightLog.map(([year,company,capability],index)=><motion.div
          className="log-row" key={company}
          initial={{opacity:0,x:-18}}
          whileInView={{opacity:1,x:0}}
          viewport={{once:true,amount:.6}}
          transition={{delay:index*.04}}
        >
          <span>{year}</span><strong>{company}</strong><em>{capability}</em><i>0{index+1}</i>
        </motion.div>)}
      </div>
    </section>

    <section className="manifesto section-pad">
      <div>
        <p className="eyebrow">OPERATING PRINCIPLE</p>
        <blockquote>“The interface should feel cinematic. The system underneath should survive contact with reality.”</blockquote>
      </div>
      <p>I care about the entire loop: context → data → model → tool use → evaluation → interface → observability. The visual layer earns attention; the engineering earns trust.</p>
    </section>

    <section id="comms" className="comms section-pad" style={{scrollMarginTop:88}}>
      <p className="eyebrow">OPEN COMMS // 03</p>
      <h2>Need someone who can move between product, data and AI?</h2>
      <div className="comms-links">
        <a href={profile.email}>Email <span>↗</span></a>
        <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn <span>↗</span></a>
        <a href={profile.github} target="_blank" rel="noreferrer">GitHub <span>↗</span></a>
      </div>
      <footer>
        <span>MAHARSHI PATEL · GALACTIC SYSTEMS</span>
        <span>Space imagery: NASA / ESA / CSA / STScI · 3D spacecraft + planet assets: NASA</span>
      </footer>
    </section>
    <ProjectDossier project={selectedProject} onClose={closeDossier}/>
  </main>;
}
