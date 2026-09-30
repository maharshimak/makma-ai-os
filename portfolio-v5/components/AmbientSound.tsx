"use client";

import {useEffect,useRef} from "react";

export function AmbientSound({enabled,progress}:{enabled:boolean;progress:number}){
  const progressRef=useRef(progress);
  useEffect(()=>{progressRef.current=progress;},[progress]);

  useEffect(()=>{
    if(!enabled)return;
    const ctx=new AudioContext();
    const master=ctx.createGain();
    master.gain.setValueAtTime(.0001,ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(.02,ctx.currentTime+.7);
    master.connect(ctx.destination);

    const low=ctx.createOscillator();
    const lowGain=ctx.createGain();
    low.type="sine";
    low.frequency.value=44;
    lowGain.gain.value=.34;
    low.connect(lowGain).connect(master);

    const harmonic=ctx.createOscillator();
    const harmonicGain=ctx.createGain();
    harmonic.type="triangle";
    harmonic.frequency.value=88;
    harmonic.detune.value=-8;
    harmonicGain.gain.value=.065;
    harmonic.connect(harmonicGain).connect(master);

    const filter=ctx.createBiquadFilter();
    filter.type="lowpass";
    filter.frequency.value=430;
    filter.Q.value=.72;
    const noiseGain=ctx.createGain();
    noiseGain.gain.value=.024;
    const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.17;
    const noise=ctx.createBufferSource();
    noise.buffer=buffer;
    noise.loop=true;
    noise.connect(filter).connect(noiseGain).connect(master);

    const lfo=ctx.createOscillator();
    const lfoGain=ctx.createGain();
    lfo.frequency.value=.075;
    lfoGain.gain.value=.0045;
    lfo.connect(lfoGain).connect(master.gain);

    let lastScene=Math.floor(progressRef.current*9);
    let raf=0;
    const relay=(scene:number)=>{
      const now=ctx.currentTime;
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type="triangle";
      osc.frequency.setValueAtTime(118+scene*15,now);
      osc.frequency.exponentialRampToValueAtTime(72+scene*5,now+.085);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.exponentialRampToValueAtTime(.018,now+.006);
      gain.gain.exponentialRampToValueAtTime(.0001,now+.11);
      osc.connect(gain).connect(master);
      osc.start(now); osc.stop(now+.12);
    };
    const animate=()=>{
      const p=progressRef.current;
      const now=ctx.currentTime;
      const scene=Math.min(8,Math.floor(p*9));
      const synthesis=Math.max(0,1-Math.abs(p-.88)/.16);
      low.frequency.setTargetAtTime(43+p*7+synthesis*2.5,now,.28);
      harmonic.frequency.setTargetAtTime(86+p*16+synthesis*13,now,.3);
      filter.frequency.setTargetAtTime(390+p*420+synthesis*520,now,.35);
      noiseGain.gain.setTargetAtTime(.018+p*.008+synthesis*.008,now,.4);
      harmonicGain.gain.setTargetAtTime(.052+synthesis*.028,now,.4);
      if(scene!==lastScene){lastScene=scene;relay(scene);}
      raf=requestAnimationFrame(animate);
    };

    low.start(); harmonic.start(); noise.start(); lfo.start();
    void ctx.resume();
    raf=requestAnimationFrame(animate);

    return ()=>{
      cancelAnimationFrame(raf);
      const now=ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(.0001,now,.08);
      window.setTimeout(()=>{void ctx.close();},260);
    };
  },[enabled]);

  return null;
}
