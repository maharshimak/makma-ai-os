import type {Metadata, Viewport} from "next";
import {IBM_Plex_Mono,Manrope,Space_Grotesk} from "next/font/google";
import "./globals.css";
import "./director.css";
import "./power.css";
import "./refinement.css";
import "./observatory.css";
import {profile} from "@/lib/content";

const bodyFont=Manrope({subsets:["latin"],display:"swap",variable:"--font-manrope"});
const displayFont=Space_Grotesk({subsets:["latin"],display:"swap",variable:"--font-space"});
const monoFont=IBM_Plex_Mono({subsets:["latin"],weight:["400","500","600"],display:"swap",variable:"--font-plex"});

const personJsonLd={
  "@context":"https://schema.org",
  "@type":"Person",
  name:profile.name,
  jobTitle:"AI Engineer",
  url:"https://maharshimak.github.io/makma-ai-os/observatory-v5/",
  email:profile.email.replace("mailto:",""),
  address:{"@type":"PostalAddress",addressLocality:"Paris",addressCountry:"FR"},
  alumniOf:[
    {"@type":"CollegeOrUniversity",name:"aivancity School for Technology, Business & Society"},
    {"@type":"CollegeOrUniversity",name:"Ganpat University"}
  ],
  hasCredential:{"@type":"EducationalOccupationalCredential",name:profile.certification},
  knowsAbout:["Retrieval-Augmented Generation","LLM agents","Document AI","Knowledge graphs","LLM evaluation","MLOps","Python","FastAPI"],
  sameAs:[profile.github,profile.linkedin]
};

export const metadata:Metadata={
  metadataBase:new URL("https://maharshimak.github.io"),
  title:"Maharshi Patel — AI Systems Engineer",
  description:"An interactive portfolio about intelligent systems: agents, RAG, knowledge, evaluation, MLOps and production AI by Maharshi Patel.",
  keywords:["Maharshi Patel","AI Engineer","Agentic AI","RAG","LLM","Knowledge Systems","MLOps","Paris"],
  authors:[{name:"Maharshi Patel"}],
  creator:"Maharshi Patel",
  alternates:{canonical:"/makma-ai-os/observatory-v5/",languages:{"en":"/makma-ai-os/observatory-v5/","fr":"/makma-ai-os/observatory-v5/fr/"}},
  category:"technology",
  openGraph:{
    title:"Maharshi Patel — AI Systems Engineer",
    description:"Inspect the systems behind Maharshi Patel's work in agentic AI, retrieval, knowledge, evaluation and production ML.",
    type:"website",
    url:"/makma-ai-os/observatory-v5/",
    siteName:"Maharshi Patel — AI Systems Engineer"
  },
  twitter:{
    card:"summary_large_image",
    title:"Maharshi Patel — AI Systems Engineer",
    description:"Inspect the systems behind Maharshi Patel's work in agentic AI, retrieval, knowledge, evaluation and production ML."
  },
  robots:{index:true,follow:true,googleBot:{index:true,follow:true,"max-image-preview":"large","max-snippet":-1,"max-video-preview":-1}}
};

export const viewport:Viewport={
  themeColor:"#111315",
  colorScheme:"dark"
};

export default function RootLayout({children}:{children:React.ReactNode}){
  const fonts=`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`;
  return <html lang="en" className={fonts}><head><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(personJsonLd)}}/></head><body>{children}</body></html>;
}
