"use client";

import type {CSSProperties} from "react";

function clamp01(v:number){return Math.min(1,Math.max(0,v));}
function smooth01(v:number){const x=clamp01(v);return x*x*(3-2*x);}

export function VisualAtmosphere({progress,reducedMotion,base}:{progress:number;reducedMotion:boolean;base:string}){
  const aperture=smooth01(progress/.115);
  const knowledge=smooth01((progress-.25)/.12)*(1-smooth01((progress-.50)/.12));
  const agency=smooth01((progress-.43)/.12)*(1-smooth01((progress-.67)/.12));
  const reliability=smooth01((progress-.60)/.10)*(1-smooth01((progress-.80)/.11));
  const synthesisIn=smooth01((progress-.73)/.12);
  const synthesisOut=1-smooth01((progress-.95)/.045);
  const reactor=synthesisIn*synthesisOut;
  const journey=reducedMotion?0:progress;
  const sceneEnergy=Math.max(knowledge*.55,agency*.8,reliability*.55,reactor);

  return <div className="visual-atmosphere" aria-hidden="true">
    <div className="nebula-plate" style={{
      opacity:.10+(progress*.065),
      transform:reducedMotion?"scale(1.04)":`translate3d(${-journey*1.9}%,${journey*1.1}%,0) scale(${1.04+journey*.035})`
    }}>
      <img src={base+"/assets/v5/nebula-generated.webp"} alt=""/>
      <img className="nebula-procedural" src={base+"/assets/v5/nebula-field.svg"} alt=""/>
    </div>

    <img className="cloud-layer cloud-layer-a" src={base+"/assets/v5/cloud-generated.webp"} alt="" style={{
      transform:reducedMotion?"none":`translate3d(${journey*-5.5}vw,${journey*2.2}vh,0) scale(${1.03+journey*.04})`
    }}/>
    <img className="cloud-layer cloud-layer-b" src={base+"/assets/v5/cloud-generated.webp"} alt="" style={{
      transform:reducedMotion?"scaleX(-1)":`translate3d(${journey*6.5}vw,${journey*-3.4}vh,0) scaleX(-1) scale(${1.08+journey*.05})`
    }}/>
    <img className="cloud-layer cloud-authored cloud-authored-a" src={base+"/assets/v5/cloud-wisp.svg"} alt="" style={{
      transform:reducedMotion?"none":`translate3d(${journey*3.2}vw,${journey*-1.6}vh,0) scale(${1.02+journey*.025})`
    }}/>
    <img className="cloud-layer cloud-authored cloud-authored-b" src={base+"/assets/v5/cloud-storm.svg"} alt="" style={{
      transform:reducedMotion?"scaleX(-1)":`translate3d(${journey*-4.4}vw,${journey*2.1}vh,0) scaleX(-1) scale(${1.06+journey*.035})`
    }}/>

    <div className="particle-field"/>
    <div className="micro-stars"/>
    <div className="scanner-sweep"/>
    <img className="signal-lattice" src={base+"/assets/v5/signal-lattice.svg"} alt="" style={{
      opacity:.025+sceneEnergy*.08,
      transform:reducedMotion?"none":`translate3d(0,${(journey-.5)*-3.5}vh,0) scale(${1+sceneEnergy*.035})`
    }}/>
    <div className="spectrum-flare spectrum-warm" style={{opacity:.05+agency*.10+reactor*.13}}/>
    <div className="spectrum-flare spectrum-cool" style={{opacity:.035+knowledge*.10+reliability*.08}}/>
    <img className="global-hud-frame" src={base+"/assets/v5/hud-frame.svg"} alt=""/>

    <div className="aperture aperture-left" style={{transform:`translate3d(${-aperture*101}%,0,0)`}}/>
    <div className="aperture aperture-right" style={{transform:`translate3d(${aperture*101}%,0,0)`}}/>
    <div className="aperture-seam" style={{opacity:1-aperture}}/>

    <div className="reactor-visual" style={{
      opacity:reactor*.38,
      transform:`translate(-50%,-50%) scale(${.76+reactor*.30}) rotate(${reducedMotion?0:progress*38}deg)`
    } as CSSProperties}>
      <div className="reactor-halo"/>
      <img src={base+"/assets/v5/reactor-core.svg"} alt=""/>
      <div className="reactor-orbit orbit-a"/>
      <div className="reactor-orbit orbit-b"/>
    </div>
  </div>;
}
