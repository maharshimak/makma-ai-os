"use client";

import {motion,useReducedMotion,useScroll,useTransform} from "motion/react";
import {useRef,useState} from "react";
import {profile} from "@/lib/content";
import {MagneticLink} from "./MagneticLink";
import {SignalText} from "./SignalText";

const channels=[
  {id:"email",index:"01",label:"Email",href:profile.email,meta:"DIRECT TRANSMISSION",external:false},
  {id:"linkedin",index:"02",label:"LinkedIn",href:profile.linkedin,meta:"PROFESSIONAL CHANNEL",external:true},
  {id:"github",index:"03",label:"GitHub",href:profile.github,meta:"SOURCE CHANNEL",external:true},
] as const;

export function TransmissionSection(){
  const ref=useRef<HTMLElement>(null);
  const [active,setActive]=useState(0);
  const [copied,setCopied]=useState(false);
  const reduceMotion=useReducedMotion() ?? false;
  const {scrollYProgress}=useScroll({target:ref,offset:["start end","end start"]});
  const galaxyY=useTransform(scrollYProgress,[0,1],reduceMotion?[0,0]:[60,-80]);
  const galaxyScale=useTransform(scrollYProgress,[0,.5,1],reduceMotion?[1,1,1]:[1.07,1,1.08]);
  const email=profile.email.replace(/^mailto:/,"");

  const copyEmail=async()=>{
    try{
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1600);
    }catch{
      window.location.href=profile.email;
    }
  };

  return <section ref={ref} id="comms" className="comms section-pad" style={{scrollMarginTop:88}}>
    <motion.div className="comms-galaxy" style={{y:galaxyY,scale:galaxyScale,rotate:-8}} aria-hidden="true"/>
    <div className="chapter-kicker"><span>05</span><SignalText text="TRANSMISSION READY"/></div>

    <div className="signal-core" aria-hidden="true">
      <i/><i/><i/><span>{String(active+1).padStart(2,"0")}</span><b/>
      <em>{channels[active].id.toUpperCase()}</em>
    </div>

    <p className="eyebrow">OPEN COMMS // 05</p>
    <h2>Transmit a mission.<br/><em>I’ll build the system.</em></h2>
    <p className="comms-lede">Paris · AI / Data / ML · Available now. If the problem needs engineering depth and product sense, open a channel.</p>

    <div className="transmission-status" aria-live="polite">
      <span>CHANNEL {channels[active].index}</span>
      <b>{channels[active].label}</b>
      <i/>
      <em>{channels[active].meta}</em>
    </div>

    <div className="comms-links">
      {channels.map((channel,index)=><MagneticLink
        key={channel.id}
        href={channel.href}
        target={channel.external?"_blank":undefined}
        rel={channel.external?"noreferrer":undefined}
        className={index===active?"is-active":""}
        onPointerEnter={()=>setActive(index)}
        onFocus={()=>setActive(index)}
      >
        <b>{channel.index}</b>
        <span className="channel-label">{channel.label}</span>
        <em>{channel.meta}</em>
        <strong>↗</strong>
      </MagneticLink>)}
    </div>

    <div className="transmission-actions">
      <button type="button" onClick={copyEmail} className={copied?"is-copied":undefined}>
        <span>{copied?"ADDRESS COPIED":"COPY EMAIL ADDRESS"}</span>
        <b>{copied?"✓":"⌘"}</b>
      </button>
      <span>{email}</span>
    </div>

    <footer>
      <span>MAHARSHI PATEL · GALACTIC SYSTEMS · TRANSMISSION READY</span>
      <span>Space imagery: NASA / ESA / CSA / STScI · 3D spacecraft + planet assets: NASA</span>
    </footer>
  </section>;
}
