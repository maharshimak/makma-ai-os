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
  const accent=project.family.startsWith("Knowledge")?"#73bfd8":project.family.startsWith("Agency")?"#ffad50":"#87a88b";
  const nebula4k="https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2022/10/STScI-01GFRYYRTCTMX197BY86MBFCR9.png?crop=faces%2Cfocalpoint&fit=clip&h=4320&w=7680";
  return <main className="project-page" style={{"--project-accent":accent} as CSSProperties}>
    <div className="project-art" aria-hidden="true"><img className="project-nebula" src={nebula4k} alt=""/></div>
    <nav><a href={base+"/"}>← SYSTEMS MISSION / V5</a><span>{profile.name}</span></nav>
    <article>
      <div className="project-kicker"><span className="micro">SYSTEM / {project.family.toUpperCase()}</span><b><i/>MISSION FILE</b></div>
      <h1>{project.name}</h1>
      <p className="project-summary">{project.summary}</p>
      <div className="project-grid">
        <section><span className="micro">MISSION PURPOSE</span><p>{project.purpose}</p></section>
        <section><span className="micro">STACK</span><p>{project.stack.join(" · ")}</p></section>
      </div>
      <section className="architecture">
        <div className="architecture-head"><span className="micro">SYSTEM FLIGHT PATH</span><b>{project.architecture.length} STAGES / TRACEABLE SYSTEM FLOW</b></div>
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
