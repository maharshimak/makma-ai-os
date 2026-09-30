"use client";

import {useProgress} from "@react-three/drei";
import {useEffect,useState} from "react";

export function SystemLoader(){
  const {active,progress,total}=useProgress();
  const [seenAssets,setSeenAssets]=useState(false);
  const [visible,setVisible]=useState(true);

  useEffect(()=>{if(total>0)setSeenAssets(true);},[total]);
  useEffect(()=>{
    if(!seenAssets||active||progress<99.9)return;
    const timer=window.setTimeout(()=>setVisible(false),180);
    return ()=>window.clearTimeout(timer);
  },[seenAssets,active,progress]);
  useEffect(()=>{
    const timer=window.setTimeout(()=>setVisible(false),2200);
    return ()=>window.clearTimeout(timer);
  },[]);

  if(!visible)return null;
  const value=Math.max(3,Math.min(100,Math.round(progress||0)));

  return <div className="system-loader" role="status" aria-live="polite">
    <div className="loader-shell">
      <div className="loader-kicker"><span>Maharshi Patel</span><b>Portfolio V5</b></div>
      <div className="loader-title">Loading the environment.</div>
      <div className="loader-track"><i style={{width:value+"%"}}/></div>
      <div className="loader-meta"><span>{String(value).padStart(3,"0")}%</span><span>{total?total+" assets":"Preparing scene"}</span></div>
    </div>
  </div>;
}
