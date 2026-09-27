"use client";

import {AnimatePresence, motion, useReducedMotion} from "motion/react";
import {useEffect, useRef} from "react";
import type {projects} from "@/lib/content";

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
        initial={reduceMotion?false:{x:"105%"}}
        animate={{x:0}}
        exit={reduceMotion?{opacity:0}:{x:"105%"}}
        transition={reduceMotion?{duration:0}:{type:"spring",stiffness:210,damping:28,mass:.85}}
      >
        <div className="dossier-topline">
          <span>SYSTEM DOSSIER // {project.domain}</span>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close project dossier">CLOSE ×</button>
        </div>

        <div className="dossier-orbit" aria-hidden="true"><i/><i/><i/></div>
        <p className="eyebrow">LIVE ENGINEERING FILE</p>
        <h2 id={titleId}>{project.name}</h2>
        <p id={summaryId} className="dossier-summary">{project.summary}</p>

        <div className="dossier-grid">
          <section>
            <span className="dossier-label">MISSION / PROBLEM</span>
            <p>{project.challenge}</p>
          </section>
          <section>
            <span className="dossier-label">IMPLEMENTED NOW</span>
            <ul>{project.implemented.map(item=><li key={item}>{item}</li>)}</ul>
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
