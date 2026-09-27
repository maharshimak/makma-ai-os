import type {Metadata, Viewport} from "next";
import "./globals.css";
import "./cinematic.css";
import "./polish.css";

export const metadata:Metadata={
  title:"Maharshi Patel — Galactic Systems",
  description:"AI, data and software systems by Maharshi Patel: agent runtimes, retrieval, document intelligence, knowledge systems and LLM evaluation.",
  keywords:["AI Engineer","Data Engineer","RAG","LLM","Agents","MLOps","Paris","Maharshi Patel"],
  authors:[{name:"Maharshi Patel"}],
  creator:"Maharshi Patel",
  openGraph:{
    title:"Maharshi Patel — Galactic Systems",
    description:"A cinematic engineering portfolio for production-minded AI, data and software systems.",
    type:"website"
  },
  twitter:{
    card:"summary_large_image",
    title:"Maharshi Patel — Galactic Systems",
    description:"A cinematic engineering portfolio for production-minded AI, data and software systems."
  }
};

export const viewport:Viewport={
  themeColor:"#030408",
  colorScheme:"dark"
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en">
    <head>
      <link rel="preconnect" href="https://assets.science.nasa.gov" crossOrigin="anonymous"/>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
    </head>
    <body>{children}</body>
  </html>;
}
