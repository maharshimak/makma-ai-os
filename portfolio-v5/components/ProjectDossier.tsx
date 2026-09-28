"use client";

import {AnimatePresence, motion, useReducedMotion} from "motion/react";
import {useEffect, useRef} from "react";
import type {CSSProperties} from "react";
import type {projects} from "@/lib/content";
import {ProjectGlyph} from "./ProjectGlyph";

type Project = (typeof projects)[number];

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function ProjectDossier({project,onClose}:{project:Project|null;onClose:()=>void}){
  const reduceMotion = useReducedMotion() ?? false;
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    if(!project) return;

    const previousOverflow = document.body.style.overflow;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow="hidden";

    const focusClose = window.requestAnimationFrame(()=>closeRef.current?.focus());

    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        event.preventDefault();
        onClose();
        return;
      }
      if(event.key!=="Tab" || !panelRef.current) return;

      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(node=>!node.hasAttribute("disabled") && node.getAttribute("aria-hidden")!=="true");
      if(nodes.length===0){
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length-1];
      const active = document.activeElement;
      if(event.shiftKey && (active===first || !panelRef.current.contains(active))){
        event.preventDefault();
        last.focus();
      }else if(!event.shiftKey && active===last){
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown",onKey);
    return ()=>{
      window.cancelAnimationFrame(focusClose);
      document.body.style.overflow=previousOverflow;
      window.removeEventListener("keydown",onKey);
      opener?.focus();
    };
  },[project,onClose]);

  const titleId = project ? `dossier-${project.slug}-title` : undefined;
  const summaryId = project ? `dossier-${project.slug}-summary` : undefined;

  return <AnimatePresence>
    {project && <motion.div
      className="dossier-backdrop"
      initial={reduceMotion?false:{opacity:0}}
      animate={{opacity:1}}
      exit={reduceMotion?{opacity:0}:{opacity:0}}
      transition={reduceMotion?{duration:0}:{duration:.2}}
      onMouseDown={(event)=>{if(event.currentTarget===event.target) onClose();}}
    >
      <motion.aside
        ref={panelRef}
        className="dossier-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={summaryId}
        tabIndex={-1}
        style={{"--accent":project.accent} as CSSProperties}
        initial={reduceMotion?false:{clipPath:"polygon(100% 0,100% 0,100% 100%,82% 100%)",opacity:.72}}
        animate={{clipPath:"polygon(0 0,100% 0,100% 100%,0 100%)",opacity:1}}
        exit={reduceMotion?{opacity:0}:{clipPath:"polygon(100% 0,100% 0,100% 100%,82% 100%)",opacity:.4}}
        transition={reduceMotion?{duration:0}:{duration:.72,ease:[.16,1,.3,1]}}
      >
        <div className="dossier-topline">
          <span>SYSTEM DOSSIER // {project.domain}</span>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close project dossier">CLOSE ×</button>
        </div>

        <div className="dossier-scan" aria-hidden="true"/>
        <div className="dossier-orbit" aria-hidden="true"><i/><i/><i/></div>
        <div className="dossier-visual" aria-hidden="true">
          <ProjectGlyph slug={project.slug} layoutId={`system-glyph-${project.slug}`}/>
          <span>SYSTEM TRACE // {project.domain}</span>
        </div>
        <p className="eyebrow">LIVE ENGINEERING FILE</p>
        <h2 id={titleId}>{project.name}</h2>
        <p id={summaryId} className="dossier-summary">{project.summary}</p>
        <div className="dossier-status" aria-label="Project status">
          <span><i/> LIVE PRODUCT</span>
          <span><i/> SOURCE AVAILABLE</span>
          <span><i/> BOUNDARIES DECLARED</span>
        </div>

        <div className="dossier-architecture" aria-label="System architecture">
          <span className="dossier-label">SYSTEM ROUTE</span>
          <div className="architecture-route">
            {project.architecture.map((item,index)=><motion.div
              key={item}
              className="architecture-node"
              initial={reduceMotion?false:{opacity:0,y:12}}
              animate={{opacity:1,y:0}}
              transition={reduceMotion?{duration:0}:{delay:.14+index*.055,duration:.38}}
            >
              <i>{String(index+1).padStart(2,"0")}</i><b>{item}</b>{index<project.architecture.length-1&&<span aria-hidden="true">→</span>}
            </motion.div>)}
          </div>
        </div>

        <div className="dossier-grid">
          <section>
            <span className="dossier-label">MISSION / PROBLEM</span>
            <p>{project.challenge}</p>
          </section>
          <section>
            <span className="dossier-label">IMPLEMENTED NOW</span>
            <ul>{project.implemented.map((item,index)=><motion.li
              key={item}
              initial={reduceMotion?false:{opacity:0,x:12}}
              animate={{opacity:1,x:0}}
              transition={reduceMotion?{duration:0}:{delay:.18+index*.05,duration:.35}}
            >{item}</motion.li>)}</ul>
          </section>
          <section>
            <span className="dossier-label">ENGINEERING BOUNDARY</span>
            <p>{project.boundary}</p>
          </section>
        </div>

        <div className="dossier-stack">{project.stack.map(item=><span key={item}>{item}</span>)}</div>

        <div className="dossier-actions">
          <a href={project.liveUrl} target="_blank" rel="noreferrer">LAUNCH LIVE PRODUCT <span>↗</span></a>
          <a href={project.repoUrl} target="_blank" rel="noreferrer">INSPECT SOURCE <span>↗</span></a>
        </div>
      </motion.aside>
    </motion.div>}
  </AnimatePresence>;
}
