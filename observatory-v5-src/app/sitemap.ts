import type {MetadataRoute} from "next";
export const dynamic="force-static";
import {projects} from "@/lib/content";

const origin="https://maharshimak.github.io/makma-ai-os/observatory-v5";
const updated=new Date("2026-10-06T00:00:00+02:00");

export default function sitemap():MetadataRoute.Sitemap{
  return [
    {url:origin+"/",lastModified:updated,changeFrequency:"monthly",priority:1},
    {url:origin+"/fr/",lastModified:updated,changeFrequency:"monthly",priority:.8},
    ...projects.map(project=>({
      url:`${origin}/projects/${project.slug}/`,
      lastModified:updated,
      changeFrequency:"monthly" as const,
      priority:.75
    }))
  ];
}
