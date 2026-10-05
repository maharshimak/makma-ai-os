"use client";

import {experience,profile,projects,skillSystems} from "@/lib/content";

export function RecruiterMode({open,onClose}:{open:boolean;onClose:()=>void}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  if(!open) return null;
  return <div className="recruiter-backdrop" role="dialog" aria-modal="true" aria-label="Recruiter mode">
    <div className="recruiter-panel">
      <div className="recruiter-top">
        <div>
          <span className="micro">RECRUITER BRIEF / FAST PATH</span>
          <h2>{profile.name}</h2>
          <p>{profile.role} · {profile.location}</p>
          <div className="recruiter-statline">{profile.stats.map(stat=><span key={stat.label}><b>{stat.value}</b>{stat.label}</span>)}</div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close recruiter mode">×</button>
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
            <a href={profile.github} target="_blank" rel="noreferrer">GitHub ↗</a>
            <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
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
          <span className="micro">ALL 9 ENGINEERING SYSTEMS</span>
          <div className="quick-projects">{projects.map(p=><a key={p.slug} href={base+"/projects/"+p.slug}>
            <b>{p.name}</b>
            <span>{p.family}</span>
            <p>{p.proof[0]}</p>
          </a>)}</div>
        </section>
        <section className="recruiter-experience-section">
          <span className="micro">EXPERIENCE / TRAJECTORY</span>
          <div className="quick-experience">{experience.slice().reverse().map(e=><div key={e.company+e.period}>
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
          <p className="muted">Independent portfolio examples use synthetic data and disclose their implementation limits rather than presenting simulated behaviour as production inference.</p>
        </section>
      </div>
    </div>
  </div>;
}
