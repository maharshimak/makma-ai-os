import type {MetadataRoute} from "next";
export const dynamic="force-static";

export default function manifest():MetadataRoute.Manifest{
  return {
    name:"Maharshi Patel — AI Systems Engineer",
    short_name:"Maharshi Patel",
    description:"Interactive AI engineering portfolio: agentic systems, RAG, document intelligence, evaluation and MLOps.",
    start_url:"/makma-ai-os/observatory-v5/",
    display:"standalone",
    background_color:"#050708",
    theme_color:"#111315",
    categories:["portfolio","technology","engineering"]
  };
}
