"use client";

import {useEffect,useRef,useState} from "react";
import type {MutableRefObject} from "react";
import {Canvas,useThree} from "@react-three/fiber";
import {PerformanceMonitor} from "@react-three/drei";
import * as THREE from "three";
import {ObservatoryJourney} from "./ObservatoryChapters";
import type {ThresholdQuality} from "./ThresholdScene";

type ProgressRef=MutableRefObject<number>;
type Quality=ThresholdQuality;

/**
 * The HTML document remains the authoritative input.
 * Render only when motion or the scene needs it; avoid perpetual GPU work.
 */
function JourneyFrameScheduler(){
  const {invalidate}=useThree();
  const requestRef=useRef(0);
  const frames=useRef(0);
  useEffect(()=>{
    const frame=()=>{
      requestRef.current=0;
      if(document.visibilityState==="hidden")return;
      invalidate();
      if(frames.current-->0)requestRef.current=requestAnimationFrame(frame);
    };
    const request=()=>{
      frames.current=30;
      if(!requestRef.current)requestRef.current=requestAnimationFrame(frame);
    };
    window.addEventListener("v5:journey-frame",request);
    window.addEventListener("resize",request);
    window.addEventListener("pageshow",request);
    document.addEventListener("visibilitychange",request);
    request();
    return ()=>{
      cancelAnimationFrame(requestRef.current);
      window.removeEventListener("v5:journey-frame",request);
      window.removeEventListener("resize",request);
      window.removeEventListener("pageshow",request);
      document.removeEventListener("visibilitychange",request);
    };
  },[invalidate]);
  return null;
}

function initialQuality():Quality{
  if(typeof window==="undefined")return "medium";
  const mobile=window.matchMedia("(pointer: coarse)").matches||window.innerWidth<780;
  const nav=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean}};
  if(mobile||nav.connection?.saveData||((nav.deviceMemory??8)<=4))return "low";
  if(window.innerWidth>=1280&&(navigator.hardwareConcurrency??8)>=8)return "high";
  return "medium";
}

/** Single WebGL canvas shared by all six Observatory environments. */
export function WorldCanvas({
  progressRef,reducedMotion,chapter:_chapter,focusSystem:_focusSystem,focusProject=null
}:{
  progressRef:ProgressRef;
  reducedMotion:boolean;
  chapter:string;
  focusSystem?:"knowledge"|"agency"|"reliability"|null;
  focusProject?:string|null;
}){
  const [quality,setQuality]=useState<Quality>("medium");
  const [visible,setVisible]=useState(true);
  useEffect(()=>{
    const update=()=>setQuality(initialQuality());
    update();
    window.addEventListener("resize",update);
    return ()=>window.removeEventListener("resize",update);
  },[]);
  useEffect(()=>{
    const sync=()=>setVisible(document.visibilityState!=="hidden");
    sync();
    document.addEventListener("visibilitychange",sync);
    return ()=>document.removeEventListener("visibilitychange",sync);
  },[]);

  // The static view deliberately removes all GPU requirements for reduced
  // motion. Its semantic content is already rendered in SynthesisPortfolio.
  if(reducedMotion)return <div className="world-canvas threshold-static-fallback" aria-hidden="true"/>;

  return <div className="world-canvas observatory-world" aria-hidden="true">
    <Canvas
      frameloop={visible?"demand":"never"}
      dpr={quality==="high"?[1,1.5]:quality==="medium"?[1,1.25]:1}
      camera={{position:[0,1.8,15],fov:38,near:.08,far:165}}
      performance={{min:.55,max:1,debounce:550}}
      gl={{antialias:quality!=="low",alpha:false,powerPreference:"high-performance",
        toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.08,preserveDrawingBuffer:false}}
    >
      <color attach="background" args={["#172a36"]}/>
      <fog attach="fog" args={["#233744",25,77]}/>
      <PerformanceMonitor flipflops={3}
        onDecline={()=>setQuality(q=>q==="high"?"medium":"low")}
        onIncline={()=>setQuality(q=>q==="low"?"medium":q==="medium"&&initialQuality()==="high"?"high":q)}
        onFallback={()=>setQuality("low")}/>
      <JourneyFrameScheduler/>
      <ObservatoryJourney progressRef={progressRef} quality={quality} focusProject={focusProject}/>
    </Canvas>
  </div>;
}
