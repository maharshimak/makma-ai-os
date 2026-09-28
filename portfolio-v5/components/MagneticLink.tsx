"use client";

import {motion,useMotionValue,useReducedMotion,useSpring} from "motion/react";
import {useRef} from "react";

type Props={
  href:string;
  className?:string;
  children:React.ReactNode;
  target?:string;
  rel?:string;
  onPointerEnter?:()=>void;
  onFocus?:()=>void;
};

export function MagneticLink({href,className="",children,target,rel,onPointerEnter,onFocus}:Props){
  const ref=useRef<HTMLAnchorElement>(null);
  const reduceMotion=useReducedMotion() ?? false;
  const mx=useMotionValue(0);
  const my=useMotionValue(0);
  const x=useSpring(mx,{stiffness:240,damping:20,mass:.32});
  const y=useSpring(my,{stiffness:240,damping:20,mass:.32});

  const move=(event:React.PointerEvent<HTMLAnchorElement>)=>{
    if(reduceMotion || event.pointerType==="touch") return;
    const node=ref.current;
    if(!node) return;
    const rect=node.getBoundingClientRect();
    const dx=(event.clientX-(rect.left+rect.width/2))/rect.width;
    const dy=(event.clientY-(rect.top+rect.height/2))/rect.height;
    mx.set(dx*10);
    my.set(dy*8);
    node.style.setProperty("--gravity-x",`${((event.clientX-rect.left)/rect.width)*100}%`);
    node.style.setProperty("--gravity-y",`${((event.clientY-rect.top)/rect.height)*100}%`);
  };

  const reset=()=>{
    mx.set(0);
    my.set(0);
  };

  return <motion.a
    ref={ref}
    href={href}
    className={`magnetic-action ${className}`}
    target={target}
    rel={rel}
    style={{x,y}}
    onPointerMove={move}
    onPointerEnter={onPointerEnter}
    onPointerLeave={reset}
    onFocus={onFocus}
    onBlur={reset}
  >{children}<i className="gravity-particle" aria-hidden="true"/></motion.a>;
}
