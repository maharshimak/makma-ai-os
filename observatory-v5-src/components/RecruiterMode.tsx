"use client";

import {useEffect,useRef} from "react";
import {experience,profile,projects,skillSystems} from "@/lib/content";

const featuredSlugs=["agentic-rag-engine","secure-data-copilot","llm-eval-observability","clinical-document-intelligence"];
const featuredProjects=featuredSlugs.map(slug=>projects.find(project=>project.slug===slug)).filter((project):project is (typeof projects)[number]=>Boolean(project));

export function RecruiterMode({open,onClose}:{open:boolean;onClose:()=>void}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  const dialogRef=useRef<HTMLDivElement>(null);
  const openerRef=useRef<HTMLElement|null>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;

  useEffect(()=>{
    if(!open)return;
    openerRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const dialog=dialogRef.current;
    if(!dialog)return;
    const selector='a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables=()=>Array.from(dialog.querySelectorAll<HTMLElement>(selector));
    const frame=requestAnimationFrame(()=>(focusables()[0]??dialog).focus({preventScroll:true}));
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){
        event.preventDefault();
        closeRef.current();
        return;
      }
      if(event.key!=="Tab")return;
      const nodes=focusables();
      if(!nodes.length){event.preventDefault();dialog.focus();return;}
      const first=nodes[0],last=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    dialog.addEventListener("keydown",onKey);
    return ()=>{
      cancelAnimationFrame(frame);
      dialog.removeEventListener("keydown",onKey);
      requestAnimationFrame(()=>openerRef.current?.focus({preventScroll:true}));
    };
  },[open]);

  if(!open)return null;

  return <div className="recruiter-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)closeRef.current();}}>
    <div ref={dialogRef} tabIndex={-1} className="recruiter-panel" role="dialog" aria-modal="true" aria-labelledby="recruiter-title">
      <div className="recruiter-top">
        <div>
          <span className="micro">RECRUITER BRIEF / FAST PATH</span>
          <h2 id="recruiter-title">{profile.name}</h2>
          <p>{profile.role} · {profile.location}</p>
          <div className="recruiter-availability">
            <b>{profile.availability}</b>
            <span>{profile.alternance}</span>
          </div>
          <div className="recruiter-statline">{profile.stats.map(stat=><span key={stat.label}><b>{stat.value}</b>{stat.label}</span>)}</div>
        </div>
        <button className="icon-button" onClick={()=>closeRef.current()} aria-label="Close recruiter mode">×</button>
      </div>
      <div className="recruiter-grid">
        <section>
          <span className="micro">PROFILE / FORMATION</span>
          <p>{profile.about[0]}</p>
          <div className="recruiter-facts">
            <p><b>PROGRAM</b>{profile.program}</p>
            <p><b>RHYTHM</b>{profile.rhythm}</p>
            <p><b>SCHOOL</b>{profile.school}</p>
            <p><b>FOUNDATION</b>{profile.priorEducation}</p>
            <p><b>CREDENTIAL</b>{profile.certification}</p>
          </div>
          <div className="action-row">
            <a href={profile.cvUrl} target="_blank" rel="noreferrer">CV / Resume ↗</a>
            <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
            <a href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
            <a href={profile.email}>Email ↗</a>
          </div>
        </section>
        <section>
          <span className="micro">LANGUAGES / FOCUS</span>
          <div className="recruiter-tag-group">
            <b>LANGUAGES</b>
            <div>{profile.languages.map(item=><span key={item}>{item}</span>)}</div>
          </div>
          <div className="recruiter-tag-group">
            <b>FOCUS</b>
            <div>{profile.focus.map(item=><span key={item}>{item}</span>)}</div>
          </div>
          <div className="recruiter-code">
            <b>OPERATING CODE</b>
            {profile.principles.map((item,index)=><p key={item}><span>{String(index+1).padStart(2,"0")}</span>{item}</p>)}
          </div>
        </section>
        <section className="recruiter-project-section">
          <span className="micro">FLAGSHIP SYSTEMS / START HERE</span>
          <div className="quick-projects">{featuredProjects.map(p=><a key={p.slug} href={base+"/projects/"+p.slug}>
            <b>{p.name}</b>
            <span>{p.family}</span>
            <p>{p.proof[0]}</p>
          </a>)}</div>
          <a className="recruiter-all-systems" href="#knowledge" onClick={()=>closeRef.current()}>Explore all {projects.length} systems →</a>
        </section>
        <section className="recruiter-experience-section">
          <span className="micro">EXPERIENCE / RECENT TRAJECTORY</span>
          <div className="quick-experience">{experience.slice(-4).reverse().map(e=><div key={e.company+e.period}>
            <b>{e.company}</b><span>{e.role}</span><small>{e.period}</small><p>{e.detail}</p>
          </div>)}</div>
        </section>
        <section className="recruiter-skills-section">
          <span className="micro">CAPABILITY MAP</span>
          <div className="quick-skills">{skillSystems.map(s=><div key={s.name}><b>{s.name}</b><span>{s.items.join(" · ")}</span></div>)}</div>
        </section>
        <section className="recruiter-philosophy">
          <span className="micro">HOW I BUILD</span>
          {profile.about.slice(1).map(line=><p key={line}>{line}</p>)}
          <p className="muted">Independent portfolio examples use synthetic data and disclose implementation limits rather than presenting simulated behaviour as production inference.</p>
        </section>
      </div>
    </div>
  </div>;
}