"use client";

import {useEffect} from "react";

export function AmbientSound({enabled}:{enabled:boolean}){
  useEffect(()=>{
    if(!enabled)return;
    const ctx=new AudioContext();
    const master=ctx.createGain();
    master.gain.setValueAtTime(.0001,ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(.022,ctx.currentTime+.7);
    master.connect(ctx.destination);

    const low=ctx.createOscillator();
    const lowGain=ctx.createGain();
    low.type="sine";
    low.frequency.value=46;
    lowGain.gain.value=.34;
    low.connect(lowGain).connect(master);

    const harmonic=ctx.createOscillator();
    const harmonicGain=ctx.createGain();
    harmonic.type="triangle";
    harmonic.frequency.value=92;
    harmonic.detune.value=-8;
    harmonicGain.gain.value=.075;
    harmonic.connect(harmonicGain).connect(master);

    const filter=ctx.createBiquadFilter();
    filter.type="lowpass";
    filter.frequency.value=520;
    filter.Q.value=.7;
    const noiseGain=ctx.createGain();
    noiseGain.gain.value=.028;
    const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.18;
    const noise=ctx.createBufferSource();
    noise.buffer=buffer;
    noise.loop=true;
    noise.connect(filter).connect(noiseGain).connect(master);

    const lfo=ctx.createOscillator();
    const lfoGain=ctx.createGain();
    lfo.frequency.value=.085;
    lfoGain.gain.value=.006;
    lfo.connect(lfoGain).connect(master.gain);

    low.start(); harmonic.start(); noise.start(); lfo.start();
    void ctx.resume();

    return ()=>{
      const now=ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(.0001,now,.08);
      window.setTimeout(()=>{void ctx.close();},260);
    };
  },[enabled]);
  return null;
}
