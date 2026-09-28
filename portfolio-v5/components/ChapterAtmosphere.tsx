"use client";

import {AnimatePresence,motion,useReducedMotion} from "motion/react";

const moods={
  home:{label:"DEPARTURE",className:"mood-home"},
  systems:{label:"SYSTEM CONSTELLATION",className:"mood-systems"},
  observation:{label:"OBSERVATION",className:"mood-observation"},
  "flight-log":{label:"FLIGHT RECORD",className:"mood-flight"},
  manifesto:{label:"OPERATING PRINCIPLE",className:"mood-manifesto"},
  comms:{label:"TRANSMISSION",className:"mood-comms"},
} as const;

export function ChapterAtmosphere({chapter}:{chapter:keyof typeof moods}){
  const reduceMotion=useReducedMotion() ?? false;
  const mood=moods[chapter];
  return <div className="chapter-atmosphere" aria-hidden="true">
    <AnimatePresence mode="sync">
      <motion.div
        key={chapter}
        className={`chapter-mood ${mood.className}`}
        initial={reduceMotion?false:{opacity:0,scale:1.035}}
        animate={{opacity:1,scale:1}}
        exit={reduceMotion?{opacity:0}:{opacity:0,scale:1.025}}
        transition={reduceMotion?{duration:0}:{duration:1.05,ease:[.16,1,.3,1]}}
      >
        <i className="mood-a"/><i className="mood-b"/><i className="mood-c"/>
        <span>{mood.label}</span>
      </motion.div>
    </AnimatePresence>
  </div>;
}
