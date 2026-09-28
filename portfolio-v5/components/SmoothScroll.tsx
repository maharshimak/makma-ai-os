"use client";

import Lenis from "lenis";
import {useEffect} from "react";

export function SmoothScroll({children}:{children:React.ReactNode}){
  useEffect(()=>{
    const lenis = new Lenis({
      autoRaf:true,
      anchors:{offset:-76,duration:1.15},
      lerp:.085,
      smoothWheel:true,
      wheelMultiplier:.88,
      stopInertiaOnNavigate:true,
      respectReducedMotion:true,
    });

    return ()=>lenis.destroy();
  },[]);

  return children;
}
