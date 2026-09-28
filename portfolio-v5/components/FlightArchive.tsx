"use client";

import {AnimatePresence,motion,useReducedMotion} from "motion/react";
import {useState} from "react";
import {flightLog} from "@/lib/content";

export function FlightArchive(){
  const [active,setActive]=useState(flightLog.length-1);
  const reduceMotion=useReducedMotion() ?? false;
  const current=flightLog[active];

  return <div className="flight-archive">
    <div className="log-table" role="list" aria-label="Professional experience">
      <div className="trajectory-line" aria-hidden="true"><i/></div>
      {flightLog.map((entry,index)=><motion.button
        type="button"
        role="listitem"
        className={`log-row ${index===active?"is-active":""}`}
        key={entry.company}
        onMouseEnter={()=>setActive(index)}
        onFocus={()=>setActive(index)}
        onClick={()=>setActive(index)}
        initial={reduceMotion?false:{opacity:.22,x:index%2===0?-28:28,filter:"blur(3px)"}}
        whileInView={{opacity:1,x:0,filter:"blur(0px)"}}
        viewport={{once:true,amount:.58}}
        transition={reduceMotion?{duration:0}:{duration:.62,ease:[.16,1,.3,1]}}
        aria-pressed={index===active}
      >
        <span>{entry.year}</span>
        <strong>{entry.company}<small>{entry.role}</small></strong>
        <em>{entry.capability}</em>
        <i>0{index+1}</i>
        <b className="trajectory-node" aria-hidden="true"/>
      </motion.button>)}
    </div>

    <aside className="archive-console" aria-live="polite">
      <div className="archive-topline"><span>ACTIVE RECORD</span><i>{String(active+1).padStart(2,"0")} / {String(flightLog.length).padStart(2,"0")}</i></div>
      <AnimatePresence mode="wait">
        <motion.div
          key={current.company}
          className="archive-record"
          initial={reduceMotion?false:{opacity:0,y:18,filter:"blur(5px)"}}
          animate={{opacity:1,y:0,filter:"blur(0px)"}}
          exit={reduceMotion?{opacity:0}:{opacity:0,y:-10,filter:"blur(3px)"}}
          transition={reduceMotion?{duration:0}:{duration:.38,ease:[.16,1,.3,1]}}
        >
          <span className="archive-date">{current.span}</span>
          <h3>{current.company}</h3>
          <h4>{current.role}</h4>
          <p>{current.note}</p>
          <div className="archive-tags">{current.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
        </motion.div>
      </AnimatePresence>
      <div className="archive-orbit" aria-label="Experience orbit navigator">
        <i className="archive-ring ring-outer" aria-hidden="true"/>
        <i className="archive-ring ring-inner" aria-hidden="true"/>
        <span className="archive-core" aria-hidden="true">MP</span>
        {flightLog.map((entry,index)=><button
          type="button"
          key={entry.company}
          className={index===active?"is-active":undefined}
          style={{"--angle":`${-90+index*(360/flightLog.length)}deg`} as React.CSSProperties}
          onClick={()=>setActive(index)}
          aria-label={`Open ${entry.company} experience`}
          aria-pressed={index===active}
        ><b>{String(index+1).padStart(2,"0")}</b></button>)}
      </div>
      <div className="archive-coordinates" aria-hidden="true">
        <span>LOG {String(active+1).padStart(2,"0")}</span>
        <span>SIGNAL VERIFIED</span>
        <span>PARIS / REMOTE</span>
      </div>
    </aside>
  </div>;
}
