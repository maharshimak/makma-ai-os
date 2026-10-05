import type {Metadata, Viewport} from "next";
import "./globals.css";
import "./director.css";
import "./polish.css";
import "./power.css";

export const metadata:Metadata={
  metadataBase:new URL("https://maharshimak.github.io/makma-ai-os/portfolio-v5/"),
  title:"Maharshi Patel — AI Systems Engineer",
  description:"An interactive portfolio about intelligent systems: agents, RAG, knowledge, evaluation, MLOps and production AI by Maharshi Patel.",
  keywords:["Maharshi Patel","AI Engineer","Agentic AI","RAG","LLM","Knowledge Systems","MLOps","Paris"],
  authors:[{name:"Maharshi Patel"}],
  creator:"Maharshi Patel",
  openGraph:{
    title:"Maharshi Patel — AI Systems Engineer",
    description:"Inspect the systems behind Maharshi Patel's work in agentic AI, retrieval, knowledge, evaluation and production ML.",
    type:"website"
  },
  twitter:{
    card:"summary_large_image",
    title:"Maharshi Patel — The Synthesis Engine",
    description:"An interactive world for intelligent systems."
  },
  robots:{index:true,follow:true}
};

export const viewport:Viewport={
  themeColor:"#111315",
  colorScheme:"dark"
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"/><link rel="preconnect" href="https://assets.science.nasa.gov" crossOrigin="anonymous"/><link rel="preconnect" href="https://raw.githubusercontent.com" crossOrigin="anonymous"/></head><body>{children}</body></html>;
}
