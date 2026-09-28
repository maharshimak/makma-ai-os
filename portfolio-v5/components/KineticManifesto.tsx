"use client";

import {motion,useScroll,useTransform} from "motion/react";
import {useRef} from "react";

function KineticWord({word,index,total,progress}:{word:string;index:number;total:number;progress:ReturnType<typeof useScroll>["scrollYProgress"]}){
  const start=.02+(index/total)*.50;
  const end=Math.min(.86,start+.18);
  const opacity=useTransform(progress,[start,end],[.56,1]);
  const y=useTransform(progress,[start,end],[12,0]);
  const scale=useTransform(progress,[start,end],[.985,1]);
  const blur=useTransform(progress,[start,end],["blur(1.8px)","blur(0px)"]);
  return <motion.span className="manifesto-word" style={{opacity,y,scale,filter:blur}}>{word}&nbsp;</motion.span>;
}

export function KineticManifesto(){
  const ref=useRef<HTMLElement>(null);
  const {scrollYProgress}=useScroll({target:ref,offset:["start 82%","end 30%"]});
  const text="The interface should feel cinematic. The system underneath should survive contact with reality.";
  const words=text.split(" ");

  return <section ref={ref} id="manifesto" className="manifesto section-pad">
    <div className="manifesto-copy">
      <p className="eyebrow">OPERATING PRINCIPLE // 04</p>
      <blockquote>{words.map((word,index)=><KineticWord key={index} word={word} index={index} total={words.length} progress={scrollYProgress}/>)}</blockquote>
    </div>
    <div className="manifesto-aside">
      <span>THE FULL LOOP</span>
      <p>I care about context → data → model → tool use → evaluation → interface → observability.</p>
      <div className="loop-track" aria-hidden="true">{["CONTEXT","DATA","MODEL","TOOLS","EVAL","UI","TRACE"].map((item,index)=><i key={item}><b>{String(index+1).padStart(2,"0")}</b>{item}</i>)}</div>
    </div>
  </section>;
}
