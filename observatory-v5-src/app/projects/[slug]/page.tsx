import {notFound} from "next/navigation";
import type {CSSProperties} from "react";
import type {Metadata} from "next";
import {profile,projects} from "@/lib/content";

export function generateStaticParams(){
  return projects.map(project=>({slug:project.slug}));
}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const project=projects.find(p=>p.slug===slug);
  if(!project)return {};
  const path=`/makma-ai-os/observatory-v5/projects/${project.slug}/`;
  return {
    title:project.name+" — Maharshi Patel",
    description:project.summary,
    alternates:{canonical:path},
    openGraph:{
      title:project.name+" — Maharshi Patel",
      description:project.summary,
      type:"article",
      url:path
    },
    twitter:{
      card:"summary_large_image",
      title:project.name+" — Maharshi Patel",
      description:project.summary
    }
  };
}

export default async function ProjectPage({params}:{params:Promise<{slug:string}>}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  const {slug}=await params;
  const projectIndex=projects.findIndex(p=>p.slug===slug);
  const project=projects[projectIndex];
  if(!project)notFound();

  const previous=projects[(projectIndex-1+projects.length)%projects.length];
  const next=projects[(projectIndex+1)%projects.length];
  const related=projects.filter(item=>item.slug!==project.slug&&item.family.split("/")[0]===project.family.split("/")[0]).slice(0,2);
  const accent=project.family.startsWith("Knowledge")?"#73bfd8":project.family.startsWith("Agency")?"#ffad50":"#87a88b";
  const softwareJsonLd={
    "@context":"https://schema.org",
    "@type":"SoftwareSourceCode",
    name:project.name,
    description:project.summary,
    codeRepository:project.repoUrl,
    url:`https://maharshimak.github.io/makma-ai-os/observatory-v5/projects/${project.slug}/`,
    programmingLanguage:project.stack,
    author:{"@type":"Person",name:profile.name,url:"https://maharshimak.github.io/makma-ai-os/observatory-v5/"}
  };

  return <main className="project-page" style={{"--project-accent":accent} as CSSProperties}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(softwareJsonLd)}}/>
    <div className="project-art project-art-observatory" aria-hidden="true"><div className="project-nebula project-nebula-authored"/></div>

    <nav className="project-global-nav" aria-label="Project navigation">
      <a href={base+"/"}>← V5 / SYSTEMS</a>
      <span>{String(projectIndex+1).padStart(2,"0")} / {String(projects.length).padStart(2,"0")}</span>
      <a href={profile.github} target="_blank" rel="noreferrer">{profile.name} ↗</a>
    </nav>

    <article>
      <div className="project-kicker">
        <span className="micro">SYSTEM / {project.family.toUpperCase()}</span>
        <b><i/>TECHNICAL DOSSIER</b>
      </div>
      <h1>{project.name}</h1>
      <p className="project-summary">{project.summary}</p>

      <nav className="project-local-nav" aria-label="Dossier sections">
        <a href="#overview">Overview</a>
        <a href="#evidence">Evidence</a>
        <a href="#architecture">Architecture</a>
        <a href="#boundary">Boundaries</a>
      </nav>

      <section id="overview" className="project-snapshot" aria-label="Engineering snapshot">
        <article>
          <small>RUNTIME</small>
          <b>{project.liveUrl?"LIVE PATH":"SOURCE PATH"}</b>
          <p>{project.liveUrl?"A runnable public experience is linked alongside the source.":"Source is linked for direct inspection."}</p>
        </article>
        <article>
          <small>SOURCE</small>
          <b>INSPECTABLE</b>
          <p>Repository and implementation surface are exposed for review.</p>
        </article>
        <article>
          <small>TRUST</small>
          <b>BOUNDARY DISCLOSED</b>
          <p>Known limitations and non-production assumptions are stated explicitly.</p>
        </article>
        <article>
          <small>FLOW</small>
          <b>{project.architecture.length} TRACEABLE STAGES</b>
          <p>{project.architecture[0]} → {project.architecture[project.architecture.length-1]}</p>
        </article>
      </section>

      <div className="project-grid">
        <section><span className="micro">MISSION PURPOSE</span><p>{project.purpose}</p></section>
        <section><span className="micro">ENGINEERING CHALLENGE</span><p>{project.challenge}</p></section>
      </div>

      <section id="evidence" className="project-deep-dive">
        <div>
          <span className="micro">IMPLEMENTED / REAL SURFACE</span>
          <ul>{project.implemented.map(item=><li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <span className="micro">ENGINEERING PROOF</span>
          <ul>{project.proof.map(item=><li key={item}>{item}</li>)}</ul>
        </div>
      </section>

      <section id="architecture" className="architecture">
        <div className="architecture-head">
          <span className="micro">SYSTEM FLIGHT PATH</span>
          <b>{project.architecture.length} STAGES / TRACEABLE SYSTEM FLOW</b>
        </div>
        <div className="architecture-map" tabIndex={0} aria-label="Scrollable system architecture">
          <div className="architecture-signal" aria-hidden="true"/>
          {project.architecture.map((stage,index)=><div className="architecture-node" key={stage}>
            <span>{String(index+1).padStart(2,"0")}</span>
            <b>{stage}</b>
            <small>{index===0?"INPUT":index===project.architecture.length-1?"OUTPUT":"PROCESS"}</small>
            {index<project.architecture.length-1&&<i>→</i>}
          </div>)}
        </div>
      </section>

      <div id="boundary" className="project-boundaries">
        <section><span className="micro">TRUST BOUNDARY</span><p>{project.boundary}</p></section>
        <section><span className="micro">NEXT ENGINEERING VECTOR</span><p>{project.next}</p></section>
      </div>

      <div className="project-stack-block">
        <span className="micro">TECHNICAL SURFACE</span>
        <div className="stack-line project-stack">{project.stack.map(item=><span key={item}>{item}</span>)}</div>
      </div>

      <div className="project-proof">
        <span>SOURCE LINKED</span><span>ARCHITECTURE EXPOSED</span><span>LIMITS DISCLOSED</span><span>EVIDENCE IDENTIFIED</span>
      </div>

      <div className="action-row project-actions">
        <a className="project-action-primary" href={project.repoUrl} target="_blank" rel="noreferrer">INSPECT SOURCE ↗</a>
        {project.liveUrl&&<a href={project.liveUrl} target="_blank" rel="noreferrer">OPEN LIVE SYSTEM ↗</a>}
      </div>

      {related.length>0&&<section className="related-systems">
        <span className="micro">RELATED SYSTEMS / SAME PILLAR</span>
        <div>{related.map(item=><a key={item.slug} href={base+"/projects/"+item.slug}>
          <small>{item.family}</small><b>{item.name}</b><span>{item.summary}</span><i>↗</i>
        </a>)}</div>
      </section>}

      <nav className="project-pagination" aria-label="Previous and next project">
        <a href={base+"/projects/"+previous.slug}><small>PREVIOUS SYSTEM</small><b>← {previous.name}</b></a>
        <a href={base+"/projects/"+next.slug}><small>NEXT SYSTEM</small><b>{next.name} →</b></a>
      </nav>
    </article>
  </main>;
}
