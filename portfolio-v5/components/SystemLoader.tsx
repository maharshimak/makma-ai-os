"use client";

import {useProgress} from "@react-three/drei";
import {useEffect,useMemo,useRef,useState} from "react";

export function SystemLoader(){
  const {active,progress,total,loaded}=useProgress();
  const [seenAssets,setSeenAssets]=useState(false);
  const [visible,setVisible]=useState(true);
  const [exiting,setExiting]=useState(false);
  const mountedAt=useRef(0);

  useEffect(()=>{mountedAt.current=performance.now();},[]);
  useEffect(()=>{if(total>0)setSeenAssets(true);},[total]);

  const value=Math.max(3,Math.min(100,Math.round(progress||0)));
  const stage=useMemo(()=>{
    if(value<18)return {index:"01",title:"Opening the observatory",detail:"Booting interface + scene graph"};
    if(value<42)return {index:"02",title:"Resolving deep-space assets",detail:"Loading planetary textures + field imagery"};
    if(value<68)return {index:"03",title:"Assembling the systems",detail:"Binding projects, evidence + mission data"};
    if(value<91)return {index:"04",title:"Calibrating the camera",detail:"Preparing materials, lighting + motion"};
    return {index:"05",title:"Environment ready",detail:"Finalizing the engineering universe"};
  },[value]);

  useEffect(()=>{
    const ready=seenAssets&&!active&&progress>=99.9;
    if(!ready)return;
    const elapsed=performance.now()-mountedAt.current;
    const delay=Math.max(0,760-elapsed);
    const exitTimer=window.setTimeout(()=>setExiting(true),delay);
    const removeTimer=window.setTimeout(()=>setVisible(false),delay+520);
    return ()=>{
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
    };
  },[seenAssets,active,progress]);

  useEffect(()=>{
    const failsafe=window.setTimeout(()=>{
      setExiting(true);
      window.setTimeout(()=>setVisible(false),500);
    },4200);
    return ()=>window.clearTimeout(failsafe);
  },[]);

  if(!visible)return null;

  return <div className={"system-loader"+(exiting?" is-exiting":"")} role="status" aria-live="polite">
    <div className="loader-ambient" aria-hidden="true"><i/><i/><i/></div>
    <div className="loader-shell">
      <div className="loader-kicker"><span>Maharshi Patel</span><b>Portfolio V5 / Mission build</b></div>
      <div className="loader-stage"><span>{stage.index}</span><b>{stage.title}</b></div>
      <div className="loader-title">Loading the<br/><em>engineering universe.</em></div>
      <p className="loader-detail">{stage.detail}</p>
      <div className="loader-track"><i style={{transform:"scaleX("+(value/100)+")"}}/></div>
      <div className="loader-meta">
        <span>{String(value).padStart(3,"0")}%</span>
        <span>{total?Math.min(loaded,total)+" / "+total+" assets":"Preparing scene"}</span>
      </div>
      <div className="loader-signals" aria-hidden="true">
        <span className={value>=20?"ready":""}>INTERFACE</span>
        <span className={value>=45?"ready":""}>TEXTURES</span>
        <span className={value>=70?"ready":""}>SYSTEMS</span>
        <span className={value>=92?"ready":""}>RENDER</span>
      </div>
    </div>
  </div>;
}
