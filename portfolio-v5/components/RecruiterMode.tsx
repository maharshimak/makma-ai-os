"use client";

import {experience,profile,projects,skillSystems} from "@/lib/content";

export function RecruiterMode({open,onClose}:{open:boolean;onClose:()=>void}){\n  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  if(!open) return null;
  return <div className="recruiter-backdrop" role="dialog" aria-modal="true" aria-label="Recruiter mode">
    <div className="recruiter-panel">
      <div className="recruiter-top">
        <div><span className="micro">QUICK ACCESS / INFORMATION MODE</span><h2>{profile.name}</h2><p>{profile.role} · {profile.location}</p></div>
        <button className="icon-button" onClick={onClose} aria-label="Close recruiter mode">×</button>
      </div>
      <div className="recruiter-grid">
        <section>
          <span className="micro">PROFILE</span>
          <p>{profile.school}</p>
          <p className="muted">{profile.certification}</p>
          <div className="action-row">
            <a href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
            <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
            <a href={profile.email}>Email ↗</a>
          </div>
        </section>
        <section>
          <span className="micro">TOP SYSTEMS</span>
          <div className="quick-projects">{projects.slice(0,5).map(p=><a key={p.slug} href={base+"/projects/"+p.slug}><b>{p.name}</b><span>{p.family}</span></a>)}</div>
        </section>
        <section>
          <span className="micro">EXPERIENCE</span>
          <div className="quick-experience">{experience.slice().reverse().map(e=><div key={e.company+e.period}><b>{e.company}</b><span>{e.role}</span><small>{e.period}</small></div>)}</div>
        </section>
        <section>
          <span className="micro">SYSTEM MAP</span>
          <div className="quick-skills">{skillSystems.map(s=><div key={s.name}><b>{s.name}</b><span>{s.items.join(" · ")}</span></div>)}</div>
        </section>
      </div>
    </div>
  </div>;
}
