"use client";

import {useProgress} from "@react-three/drei";
import {useEffect,useState} from "react";

export function SystemLoader(){
  const {active,progress,total}=useProgress();
  const [armed,setArmed]=useState(false);
  const [visible,setVisible]=useState(true);

  useEffect(()=>{if(total>0)setArmed(true);},[total]);
  useEffect(()=>{
    if(!armed||active||progress<99.9)return;
    const id=window.setTimeout(()=>setVisible(false),180);
    return ()=>window.clearTimeout(id);
  },[armed,active,progress]);
  useEffect(()=>{
    const id=window.setTimeout(()=>setVisible(false),2200);
    return ()=>window.clearTimeout(id);
  },[]);

  if(!visible)return null;
  const p=Math.max(3,Math.min(100,Math.round(progress||0)));
  return <div className={"system-loader"+(!active&&armed?" ready":"")} role="status" aria-live="polite">
    <div className="loader-shell">
      <div className="loader-kicker"><span>THE SYNTHESIS ENGINE</span><b>BOOT / V5</b></div>
      <div className="loader-title">SYSTEM INTEGRITY CHECK</div>
      <div className="loader-track"><i style={{width:p+"%"}}/></div>
      <div className="loader-meta"><span>{String(p).padStart(3,"0")}%</span><span>{total?total+" ASSETS":"INITIALIZING"}</span></div>
      <div className="loader-stages"><span>STRUCTURE</span><span>MATERIALS</span><span>SIGNAL NETWORK</span><span>INTERFACE</span></div>
    </div>
  </div>;
}
