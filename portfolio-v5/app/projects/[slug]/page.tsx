import {notFound} from "next/navigation";
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
    <nav><a href={base+"/"}>← THE SYNTHESIS ENGINE</a><span>{profile.name}</span></nav>
    <article>
      <span className="micro">{project.family.toUpperCase()}</span>
      <h1>{project.name}</h1>
      <p className="project-summary">{project.summary}</p>
      <div className="project-grid">
        <section><span className="micro">WHY IT EXISTS</span><p>{project.purpose}</p></section>
        <section><span className="micro">STACK</span><p>{project.stack.join(" · ")}</p></section>
      </div>
      <section className="architecture">
        <span className="micro">SYSTEM ARCHITECTURE</span>
        <div>{project.architecture.map((a,i)=><div key={a}><span>{String(i+1).padStart(2,"0")}</span><b>{a}</b>{i<project.architecture.length-1&&<i>→</i>}</div>)}</div>
      </section>
      <div className="action-row">
        <a href={project.repoUrl} target="_blank" rel="noreferrer">OPEN GITHUB ↗</a>
        {project.liveUrl&&<a href={project.liveUrl} target="_blank" rel="noreferrer">OPEN LIVE SYSTEM ↗</a>}
      </div>
    </article>
  </main>;
}
