"use client";

import {motion,useReducedMotion,useScroll,useSpring,useTransform,useVelocity} from "motion/react";

const streaks=[
  [8,18,62],[17,72,42],[26,34,78],[37,86,54],[46,15,36],[55,58,72],[64,28,48],
  [72,79,68],[81,42,38],[89,12,58],[94,67,46],[31,61,44],[68,92,32],[12,48,38],
];

export function VelocityStreaks(){
  const reduceMotion=useReducedMotion() ?? false;
  const {scrollY}=useScroll();
  const rawVelocity=useVelocity(scrollY);
  const velocity=useSpring(rawVelocity,{stiffness:110,damping:28,mass:.22});
  const opacity=useTransform(velocity,[-2200,-850,-180,0,180,850,2200],[.42,.24,.035,0,.035,.24,.42]);
  const stretch=useTransform(velocity,[-2200,0,2200],[1.85,.58,1.85]);
  const rotate=useTransform(velocity,[-2200,0,2200],[-8,0,8]);

  if(reduceMotion) return null;
  return <motion.div className="velocity-streaks" style={{opacity,scaleY:stretch,rotate}} aria-hidden="true">
    {streaks.map(([left,top,length],index)=><i
      key={index}
      style={{left:`${left}%`,top:`${top}%`,height:`${length}px`,animationDelay:`${(index%5)*-0.18}s`}}
    />)}
  </motion.div>;
}
