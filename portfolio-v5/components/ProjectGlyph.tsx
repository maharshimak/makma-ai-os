"use client";

import {motion} from "motion/react";

export function ProjectGlyph({slug,layoutId}:{slug:string;layoutId?:string}){
  const common={
    initial:{pathLength:0,opacity:.18},
    whileInView:{pathLength:1,opacity:1},
    viewport:{once:true,amount:.4},
    transition:{duration:1.15,ease:[.16,1,.3,1] as [number,number,number,number]},
  };

  if(slug==="agentic-rag-engine"){
    return <motion.svg layoutId={layoutId} className="project-glyph glyph-rag" viewBox="0 0 160 92" aria-hidden="true">
      {[18,34,50,66].map((y,index)=><motion.path key={y} {...common} transition={{...common.transition,delay:index*.06}} d={`M10 ${y} H58 C76 ${y} 72 46 92 46 H147`}/>)}
      <circle cx="92" cy="46" r="8"/><circle cx="145" cy="46" r="3"/>
      <text x="11" y="84">LEX + SEM → FUSION → RERANK</text>
    </motion.svg>;
  }

  if(slug==="knowledge-twin"){
    return <motion.svg layoutId={layoutId} className="project-glyph glyph-graph" viewBox="0 0 160 92" aria-hidden="true">
      <motion.path {...common} d="M26 52 L62 21 L93 48 L131 24 M62 21 L73 73 L93 48 L129 70 M26 52 L73 73"/>
      {[[26,52],[62,21],[93,48],[131,24],[73,73],[129,70]].map(([x,y],index)=><circle key={index} cx={x} cy={y} r={index===2?6:4}/>)}
      <text x="11" y="87">ENTITY → RELATION → EVIDENCE</text>
    </motion.svg>;
  }

  if(slug==="clinical-document-intelligence"){
    return <motion.svg layoutId={layoutId} className="project-glyph glyph-doc" viewBox="0 0 160 92" aria-hidden="true">
      <motion.path {...common} d="M38 10 H108 L126 28 V80 H38 Z M108 10 V28 H126"/>
      {[32,43,54,65].map((y,index)=><motion.path key={y} {...common} transition={{...common.transition,delay:.08+index*.05}} d={`M50 ${y} H${index===1?112:102}`}/>)}
      <rect x="49" y="39" width="56" height="9" rx="1"/>
      <circle cx="128" cy="67" r="14"/><path d="M121 67 L126 72 L136 60"/>
    </motion.svg>;
  }

  if(slug==="llm-eval-observability"){
    return <motion.svg layoutId={layoutId} className="project-glyph glyph-eval" viewBox="0 0 160 92" aria-hidden="true">
      <path d="M14 74 H148"/>
      {[["30",52],["55",35],["80",61],["105",24],["130",43]].map(([x,y],index)=><g key={index}><motion.path {...common} transition={{...common.transition,delay:index*.055}} d={`M${x} 74 V${y}`}/><circle cx={x} cy={y} r="4"/></g>)}
      <motion.path {...common} d="M30 52 C48 44 61 31 80 61 S109 23 130 43"/>
      <text x="13" y="88">QUALITY · LATENCY · COST · REGRESSION</text>
    </motion.svg>;
  }

  return <motion.svg layoutId={layoutId} className="project-glyph glyph-core" viewBox="0 0 160 92" aria-hidden="true">
    <circle cx="80" cy="45" r="13"/>
    <motion.path {...common} d="M80 8 C125 8 144 22 144 45 C144 68 125 82 80 82 C35 82 16 68 16 45 C16 22 35 8 80 8 Z"/>
    <motion.path {...common} transition={{...common.transition,delay:.08}} d="M80 13 C103 13 116 25 116 45 C116 65 103 77 80 77 C57 77 44 65 44 45 C44 25 57 13 80 13 Z"/>
    {[[80,8],[144,45],[80,82],[16,45]].map(([x,y],index)=><circle key={index} cx={x} cy={y} r="4"/>)}
    <text x="36" y="49">MEMORY</text><text x="94" y="49">TOOLS</text>
  </motion.svg>;
}
