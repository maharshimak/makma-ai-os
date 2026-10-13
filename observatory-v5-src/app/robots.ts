import type {MetadataRoute} from "next";
export const dynamic="force-static";

export default function robots():MetadataRoute.Robots{
  return {
    rules:{userAgent:"*",allow:"/"},
    sitemap:"https://maharshimak.github.io/makma-ai-os/observatory-v5/sitemap.xml"
  };
}
