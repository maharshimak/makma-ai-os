"use client";

import {AnimatePresence,motion,useReducedMotion} from "motion/react";
import type {CSSProperties} from "react";

const palette={
  home:["#ff995b","#6e9cff"],
  systems:["#9f7cff","#78d8ff"],
  observation:["#78d8ff","#ff7655"],
  "flight-log":["#6f98bc","#d78b58"],
  manifesto:["#ff8c4c","#677fa7"],
  comms:["#b878e5","#56c8e8"],
} as const;

export function ChapterPortal({chapter}:{chapter:keyof typeof palette}){
  const reduceMotion=useReducedMotion() ?? false;
  if(reduceMotion) return null;
  const [a,b]=palette[chapter];

  return <div className="chapter-portal-host" aria-hidden="true">
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div
        key={chapter}
        className="chapter-portal-wipe"
        style={{"--portal-a":a,"--portal-b":b} as CSSProperties}
        initial={{
          opacity:0,
          clipPath:"polygon(0 108%,100% 78%,100% 78%,0 108%)",
        }}
        animate={{
          opacity:[0,.68,.5,0],
          clipPath:[
            "polygon(0 108%,100% 78%,100% 78%,0 108%)",
            "polygon(0 70%,100% 40%,100% 47%,0 77%)",
            "polygon(0 24%,100% -6%,100% 1%,0 31%)",
            "polygon(0 -20%,100% -50%,100% -43%,0 -13%)",
          ],
        }}
        transition={{duration:.92,times:[0,.22,.67,1],ease:[.16,1,.3,1]}}
      >
        <i/><i/><i/>
      </motion.div>
    </AnimatePresence>
  </div>;
}
