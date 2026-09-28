"use client";

import {AnimatePresence,motion,useReducedMotion} from "motion/react";

const copy={
  home:["00","DEPARTURE"],
  systems:["01","SYSTEM CONSTELLATION"],
  observation:["02","OBSERVATION WINDOW"],
  "flight-log":["03","FLIGHT RECORD"],
  manifesto:["04","OPERATING PRINCIPLE"],
  comms:["05","TRANSMISSION"],
} as const;

export function ChapterPulse({chapter}:{chapter:keyof typeof copy}){
  const reduceMotion=useReducedMotion() ?? false;
  const [number,label]=copy[chapter];

  if(reduceMotion) return null;
  return <div className="chapter-pulse-host" aria-hidden="true">
    <AnimatePresence mode="wait">
      <motion.div
        key={chapter}
        className="chapter-pulse"
        initial={{opacity:0,y:12}}
        animate={{opacity:[0,1,1,0],y:[12,0,0,-5]}}
        exit={{opacity:0}}
        transition={{duration:1.45,times:[0,.16,.72,1],ease:[.16,1,.3,1]}}
      >
        <span>{number}</span>
        <b>{label}</b>
        <i/>
      </motion.div>
    </AnimatePresence>
  </div>;
}
