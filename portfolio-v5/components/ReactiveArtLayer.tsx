"use client";

import {motion,useReducedMotion,useScroll,useSpring,useTransform,useVelocity} from "motion/react";
import {useEffect,useRef} from "react";
import type {CSSProperties} from "react";

type ArtChapter="home"|"systems"|"observation"|"flight-log"|"manifesto"|"comms";

const palettes:Record<ArtChapter,[string,string]>={
  home:["#ff8d49","#78a5ff"],
  systems:["#7ddfff","#b890ff"],
  observation:["#ffad73","#7ea8ff"],
  "flight-log":["#8af0c7","#79a8ff"],
  manifesto:["#ffd08d","#d874ff"],
  comms:["#ff9154","#65e8d2"],
};

export function ReactiveArtLayer({chapter,accent}:{chapter:ArtChapter;accent?:string}){
  const surfaceRef=useRef<HTMLDivElement>(null);
  const reduceMotion=useReducedMotion() ?? false;
  const {scrollY}=useScroll();
  const rawVelocity=useVelocity(scrollY);
  const velocity=useSpring(rawVelocity,{stiffness:105,damping:30,mass:.28});
  const intensity=useTransform(velocity,[-1900,-420,0,420,1900],[1,.82,.63,.82,1]);
  const drift=useTransform(scrollY,[0,8000],[0,-180]);
  const [baseA,baseB]=palettes[chapter];

  useEffect(()=>{
    if(reduceMotion) return;
    let frame=0;
    const onPointer=(event:PointerEvent)=>{
      window.cancelAnimationFrame(frame);
      frame=window.requestAnimationFrame(()=>{
        const surface=surfaceRef.current;
        if(!surface) return;
        const x=(event.clientX/window.innerWidth)*100;
        const y=(event.clientY/window.innerHeight)*100;
        const mx=((event.clientX/window.innerWidth)-.5)*2;
        const my=((event.clientY/window.innerHeight)-.5)*2;
        surface.style.setProperty("--px",`${x.toFixed(2)}%`);
        surface.style.setProperty("--py",`${y.toFixed(2)}%`);
        surface.style.setProperty("--mx",mx.toFixed(3));
        surface.style.setProperty("--my",my.toFixed(3));
      });
    };
    window.addEventListener("pointermove",onPointer,{passive:true});
    return ()=>{
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove",onPointer);
    };
  },[reduceMotion]);

  return <motion.div
    className="reactive-art-layer"
    style={{opacity:intensity,y:reduceMotion?0:drift}}
    aria-hidden="true"
  >
    <div
      ref={surfaceRef}
      className="reactive-art-surface"
      style={{
        "--art-a":accent ?? baseA,
        "--art-b":baseB,
      } as CSSProperties}
    >
      <span className="art-lens"/>
      <span className="art-prism art-prism-a"/>
      <span className="art-prism art-prism-b"/>
      <span className="art-prism art-prism-c"/>
      <span className="art-orbit art-orbit-a"/>
      <span className="art-orbit art-orbit-b"/>
      <svg className="art-vector" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path className="vector-primary" d="M-8 72 C12 54 19 90 38 62 S67 31 108 48"/>
        <path className="vector-secondary" d="M-8 28 C18 44 27 7 51 31 S78 72 108 54"/>
      </svg>
      <span className="art-horizon"/>
    </div>
  </motion.div>;
}
