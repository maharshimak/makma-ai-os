"use client";

export function VisualAtmosphere({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  const gate=Math.min(1,Math.max(0,progress/.075));
  const synth=Math.min(1,Math.max(0,(progress-.76)/.14));
  const depth=reducedMotion?0:progress;
  return <div className="visual-atmosphere" aria-hidden="true">
    <div className="nebula-plate" style={{transform:`translate3d(0,${depth*-4}%,0) scale(${1+depth*.06})`,opacity:.26+Math.min(.28,progress*.36)}}>
      <img src={base+"/assets/v5/nebula-field.svg"} alt=""/>
    </div>
    <img className="cloud-layer cloud-layer-a" src={base+"/assets/v5/cloud-wisp.svg"} alt="" style={{transform:`translate3d(${depth*-8}vw,${depth*-3}vh,0) scale(${1.08+depth*.05})`}}/>
    <img className="cloud-layer cloud-layer-b" src={base+"/assets/v5/cloud-storm.svg"} alt="" style={{transform:`translate3d(${depth*7}vw,${depth*4}vh,0) scale(${1.12+depth*.08})`}}/>
    <div className="particle-field"/>
    <div className="scanner-sweep"/>
    <img className="global-hud-frame" src={base+"/assets/v5/hud-frame.svg"} alt="" style={{opacity:.14+Math.sin(progress*Math.PI)*.17}}/>
    <div className="aperture aperture-left" style={{transform:`translate3d(${-gate*105}%,0,0)`}}/>
    <div className="aperture aperture-right" style={{transform:`translate3d(${gate*105}%,0,0)`}}/>
    <div className="aperture-seam" style={{opacity:1-gate}}/>
    <div className="reactor-visual" style={{opacity:synth,transform:`translate3d(-50%,-50%,0) scale(${.72+synth*.28}) rotate(${reducedMotion?0:progress*32}deg)`}}>
      <img src={base+"/assets/v5/reactor-core.svg"} alt=""/>
    </div>
  </div>;
}
