"use client";

import {useEffect,useMemo,useState} from "react";
import {useReducedMotion} from "motion/react";

const GLYPHS="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/*+<>[]{}";

export function SignalText({text,className=""}:{text:string;className?:string}){
  const reduceMotion=useReducedMotion() ?? false;
  const [tick,setTick]=useState(reduceMotion?text.length:0);
  const chars=useMemo(()=>text.split(""),[text]);

  useEffect(()=>{
    if(reduceMotion){
      setTick(text.length);
      return;
    }

    const started=performance.now();
    const duration=640;
    let raf=0;

    const frame=(now:number)=>{
      const progress=Math.min(1,(now-started)/duration);
      // Ease aggressively toward legibility so the transmission is a beat,
      // never a persistent readability penalty.
      const eased=1-Math.pow(1-progress,3);
      setTick(Math.min(text.length,Math.floor(eased*(text.length+1))));
      if(progress<1) raf=requestAnimationFrame(frame);
      else setTick(text.length);
    };

    setTick(0);
    raf=requestAnimationFrame(frame);
    return ()=>cancelAnimationFrame(raf);
  },[text,reduceMotion]);

  const output=chars.map((char,index)=>{
    if(char===" ") return " ";
    if(index<tick) return char;
    const seed=(index*11+tick*7)%GLYPHS.length;
    return GLYPHS[seed];
  }).join("");

  return <span className={className} aria-label={text}>{output}</span>;
}
