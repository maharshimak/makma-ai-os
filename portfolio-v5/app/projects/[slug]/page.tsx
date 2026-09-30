import {notFound} from "next/navigation";
import type {CSSProperties} from "react";
import {profile,projects} from "@/lib/content";

export function generateStaticParams(){
  return projects.map(project=>({slug:project.slug}));
}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const project=projects.find(p=>p.slug===slug);
  return project?{title:project.name+" — Maharshi Patel",description:project.summary}:{};
}

export default async function ProjectPage({params}:{params:Promise<{slug:string}>}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  const {slug}=await params;
  const project=projects.find(p=>p.slug===slug);
  if(!project) notFound();
  return <main className="project-page">
    <div className="project-art" aria-hidden="true"><img className="project-nebula" src={base+"/assets/v5/nebula-generated.webp"} alt=""/><img className="project-hud" src={base+"/assets/v5/hud-frame.svg"} alt=""/></div>
    <nav><a href={base+"/"}>← THE SYNTHESIS ENGINE</a><span>{profile.name}</span></nav>
    <article>
      <div className="project-kicker"><span className="micro">MODULE / {project.family.toUpperCase()}</span><b><i/>SYSTEM ONLINE</b></div>
      <h1>{project.name}</h1>
      <p className="project-summary">{project.summary}</p>
      <div className="project-grid">
        <section><span className="micro">WHY IT EXISTS</span><p>{project.purpose}</p></section>
        <section><span className="micro">STACK</span><p>{project.stack.join(" · ")}</p></section>
      </div>
      <section className="architecture">
        <div className="architecture-head"><span className="micro">SYSTEM ARCHITECTURE</span><b>{project.architecture.length} STAGES / TRACEABLE FLOW</b></div>
        <div className="architecture-map">
          <div className="architecture-signal" aria-hidden="true"/>
          {project.architecture.map((a,i)=><div className="architecture-node" key={a}>
            <span>{String(i+1).padStart(2,"0")}</span><b>{a}</b><small>{i===0?"INPUT":i===project.architecture.length-1?"OUTPUT":"PROCESS"}</small>
            {i<project.architecture.length-1&&<i>→</i>}
          </div>)}
        </div>
      </section>
      <div className="project-proof"><span>INSPECTABLE</span><span>ARCHITECTURE EXPOSED</span><span>SOURCE LINKED</span></div>
      <div className="action-row">
        <a href={project.repoUrl} target="_blank" rel="noreferrer">OPEN GITHUB ↗</a>
        {project.liveUrl&&<a href={project.liveUrl} target="_blank" rel="noreferrer">OPEN LIVE SYSTEM ↗</a>}
      </div>
    </article>
  </main>;
}
