"use client";

import {motion,useReducedMotion} from "motion/react";
import {useRef} from "react";
import {projects} from "@/lib/content";
import {ProjectGlyph} from "./ProjectGlyph";

type Project=(typeof projects)[number];

export function MissionNode({project,index,onOpen,onSignal}:{project:Project;index:number;onOpen:()=>void;onSignal?:()=>void}){
  const cardRef=useRef<HTMLElement>(null);
  const reduceMotion=useReducedMotion() ?? false;

  const reset=()=>{
    const card=cardRef.current;
    if(!card) return;
    card.style.setProperty("--rx","0deg");
    card.style.setProperty("--ry","0deg");
    card.style.setProperty("--mx","50%");
    card.style.setProperty("--my","50%");
  };

  const move=(event:React.PointerEvent<HTMLElement>)=>{
    if(reduceMotion || event.pointerType==="touch") return;
    const card=cardRef.current;
    if(!card) return;
    const rect=card.getBoundingClientRect();
    const px=(event.clientX-rect.left)/rect.width;
    const py=(event.clientY-rect.top)/rect.height;
    card.style.setProperty("--ry",`${(px-.5)*7}deg`);
    card.style.setProperty("--rx",`${(.5-py)*6}deg`);
    card.style.setProperty("--mx",`${px*100}%`);
    card.style.setProperty("--my",`${py*100}%`);
  };

  return <motion.div
    className={`mission-node-wrap mission-node-${index+1}`}
    initial={{opacity:0,y:34,scale:.985}}
    whileInView={{opacity:1,y:0,scale:1}}
    viewport={{once:true,amount:.16}}
    transition={{delay:index*.055,duration:.7,ease:[.16,1,.3,1]}}
  >
    <article
      ref={cardRef}
      className="mission-node"
      style={{"--accent":project.accent} as React.CSSProperties}
      onPointerMove={move}
      onPointerEnter={onSignal}
      onFocusCapture={onSignal}
      onPointerLeave={reset}
    >
      <div className="node-beam" aria-hidden="true"/>
      <div className="mission-node-head">
        <span>0{index+1} // {project.domain}</span>
        <span className="live-pulse"><i/> LIVE</span>
      </div>
      <ProjectGlyph slug={project.slug} layoutId={`system-glyph-${project.slug}`}/>
      <h3>{project.name}</h3>
      <p className="mission-summary">{project.summary}</p>
      <div className="mission-proof"><span>PROOF</span><strong>{project.proof}</strong></div>
      <div className="mission-stack">{project.stack.map(item=><span key={item}>{item}</span>)}</div>
      <div className="mission-node-actions">
        <button type="button" onClick={onOpen}>OPEN DOSSIER <span>↗</span></button>
        <a href={project.liveUrl} target="_blank" rel="noreferrer">DEMO <span>↗</span></a>
        <a href={project.repoUrl} target="_blank" rel="noreferrer">SOURCE <span>↗</span></a>
      </div>
    </article>
  </motion.div>;
}
