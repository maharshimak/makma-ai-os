"use client";

import type {CSSProperties} from "react";

function clamp01(v:number){return Math.min(1,Math.max(0,v));}
function smooth01(v:number){const x=clamp01(v);return x*x*(3-2*x);}

export function VisualAtmosphere({progress,reducedMotion,base}:{progress:number;reducedMotion:boolean;base:string}){
  const aperture=smooth01(progress/.115);
  const synthesisIn=smooth01((progress-.73)/.12);
  const synthesisOut=1-smooth01((progress-.95)/.045);
  const reactor=synthesisIn*synthesisOut;
  const journey=reducedMotion?0:progress;

  return <div className="visual-atmosphere" aria-hidden="true">
    <div className="nebula-plate" style={{
      opacity:.12+(progress*.06),
      transform:reducedMotion?"scale(1.04)":`translate3d(${-journey*1.9}%,${journey*1.1}%,0) scale(${1.04+journey*.035})`
    }}>
      <img src={base+"/assets/v5/nebula-generated.webp"} alt=""/>
    </div>

    <img className="cloud-layer cloud-layer-a" src={base+"/assets/v5/cloud-generated.webp"} alt="" style={{
      transform:reducedMotion?"none":`translate3d(${journey*-5.5}vw,${journey*2.2}vh,0) scale(${1.03+journey*.04})`
    }}/>

    <img className="cloud-layer cloud-layer-b" src={base+"/assets/v5/cloud-generated.webp"} alt="" style={{
      transform:reducedMotion?"scaleX(-1)":`translate3d(${journey*6.5}vw,${journey*-3.4}vh,0) scaleX(-1) scale(${1.08+journey*.05})`
    }}/>

    <div className="particle-field"/>
    <div className="scanner-sweep"/>
    <img className="global-hud-frame" src={base+"/assets/v5/hud-frame.svg"} alt=""/>

    <div className="aperture aperture-left" style={{transform:`translate3d(${-aperture*101}%,0,0)`}}/>
    <div className="aperture aperture-right" style={{transform:`translate3d(${aperture*101}%,0,0)`}}/>
    <div className="aperture-seam" style={{opacity:1-aperture}}/>

    <div className="reactor-visual" style={{
      opacity:reactor*.32,
      transform:`translate(-50%,-50%) scale(${.78+reactor*.26}) rotate(${reducedMotion?0:progress*38}deg)`
    } as CSSProperties}>
      <img src={base+"/assets/v5/reactor-core.svg"} alt=""/>
    </div>
  </div>;
}
