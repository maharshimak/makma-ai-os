"use client";

/**
 * Impossible Observatory — six authored spaces in one R3F world.
 * These environments intentionally contain no project or contact typography:
 * accessible project content, recruitment information and links belong in HTML.
 * Motion is driven solely by the measured chapter journey.
 */
import {useEffect,useMemo,useRef,useState} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import * as THREE from "three";
import {ThresholdCamera,ThresholdScene,type ThresholdQuality,type ThresholdProgress} from "./ThresholdScene";

type Props={progressRef:ThresholdProgress;quality:ThresholdQuality;focusProject:string|null};
type Pillar="knowledge"|"agency"|"reliability";
type RoomSpec={id:Pillar;center:[number,number,number];tint:string;emission:string;slugs:string[];first:number;last:number};
const rooms:RoomSpec[]=[
  {id:"knowledge",center:[-1.7,0,-21],tint:"#91c8d1",emission:"#294e56",
   slugs:["agentic-rag-engine","knowledge-twin","clinical-document-intelligence"],first:.24,last:.44},
  {id:"agency",center:[0,0,-37],tint:"#e6b18a",emission:"#563b29",
   slugs:["makma-ai-os","multimodal-ai-studio","secure-data-copilot"],first:.37,last:.56},
  {id:"reliability",center:[0,0,-54],tint:"#a8c8ad",emission:"#2b4a38",
   slugs:["llm-eval-observability","mlops-control-plane","mlops-production-pipeline"],first:.49,last:.67}
];
const clamp=(x:number)=>THREE.MathUtils.clamp(x,0,1);
const ease=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
const segment=(v:number,a:number,b:number)=>ease((v-a)/(b-a));

function Beam({at,dim,mat}:{at:[number,number,number];dim:[number,number,number];mat:THREE.Material}){
  return <mesh position={at} material={mat}><boxGeometry args={dim}/></mesh>;
}

function RoomArchitecture({tint,quality}:{tint:string;quality:ThresholdQuality}){
  const stone=useMemo(()=>new THREE.MeshStandardMaterial({color:"#293944",roughness:.89,metalness:.1}),[]);
  const brass=useMemo(()=>new THREE.MeshStandardMaterial({color:"#a58c70",roughness:.5,metalness:.55}),[]);
  const ceiling=useMemo(()=>new THREE.MeshStandardMaterial({color:"#192831",roughness:.94}),[]);
  useEffect(()=>()=>{stone.dispose();brass.dispose();ceiling.dispose()},[stone,brass,ceiling]);
  return <group>
    <Beam at={[0,-2.15,0]} dim={[15,.35,13]} mat={stone}/>
    <Beam at={[0,6.2,0]} dim={[15,.4,12]} mat={ceiling}/>
    <Beam at={[-6.9,1.9,-3]} dim={[.75,8.4,6]} mat={stone}/>
    <Beam at={[6.9,1.9,-3]} dim={[.75,8.4,6]} mat={stone}/>
    <Beam at={[0,5.65,-5.7]} dim={[15,.23,.4]} mat={brass}/>
    <Beam at={[0,-1.88,-5.7]} dim={[15,.1,.38]} mat={brass}/>
    {quality!=="low"&&[-5,-2.5,0,2.5,5].map(x=><group key={x}>
      <Beam at={[x,2.2,-5.8]} dim={[.11,6.8,.18]} mat={brass}/>
      <Beam at={[x,5.9,0]} dim={[.1,.11,11.5]} mat={brass}/>
    </group>)}
    <pointLight position={[0,5,1]} intensity={quality==="low"?1.4:2.1} color={tint} distance={14}/>
  </group>;
}

function ProjectInstrument({slug,index,quality,tint,emission,progressRef,first,last,selected}:{
  slug:string;index:number;quality:ThresholdQuality;tint:string;emission:string;
  progressRef:ThresholdProgress;first:number;last:number;selected:boolean;
}){
  const group=useRef<THREE.Group>(null);
  const needle=useRef<THREE.Group>(null);
  const stone=useMemo(()=>new THREE.MeshStandardMaterial({color:"#1c2b35",roughness:.8,metalness:.22}),[]);
  const metal=useMemo(()=>new THREE.MeshStandardMaterial({color:"#ae8965",metalness:.72,roughness:.33}),[]);
  const glass=useMemo(()=>new THREE.MeshStandardMaterial({color:tint,emissive:emission,emissiveIntensity:.35,metalness:.22,roughness:.27}),[tint,emission]);
  useEffect(()=>()=>{stone.dispose();metal.dispose();glass.dispose();},[stone,metal,glass]);
  const x=(index-1)*4.0;
  useFrame((_,delta)=>{
    const local=segment(progressRef.current,first,last);
    if(group.current){
      const hoverLift=selected?.36:0;
      const desiredY=.15+local*.22+hoverLift;
      group.current.position.y=THREE.MathUtils.damp(group.current.position.y,desiredY,7,Math.min(delta,.05));
      group.current.rotation.y=THREE.MathUtils.damp(group.current.rotation.y,(local-.5)*.20,7,Math.min(delta,.05));
    }
    if(needle.current)needle.current.rotation.y=(local-.5)*(index===1?.92:-.72);
    glass.emissiveIntensity=THREE.MathUtils.damp(glass.emissiveIntensity,selected?.95:.18+local*.17,6,Math.min(delta,.05));
  });
  return <group ref={group} position={[x,.15,1.0]} userData={{slug}}>
    <Beam at={[0,-.85,0]} dim={[2.8,.42,2.6]} mat={stone}/>
    <Beam at={[0,-.52,0]} dim={[2.5,.13,2.3]} mat={metal}/>
    <Beam at={[-.98,.45,0]} dim={[.16,1.8,.16]} mat={metal}/>
    <Beam at={[.98,.45,0]} dim={[.16,1.8,.16]} mat={metal}/>
    <Beam at={[0,1.35,0]} dim={[2.12,.14,.17]} mat={metal}/>
    <group ref={needle} position={[0,.45,0]}>
      {index===0?<group>
        {[-.5,0,.5].map((n,k)=><mesh key={k} position={[n,0,k%2===0?.15:-.15]} material={glass}>
          <octahedronGeometry args={[quality==="low"?.24:.35,0]}/>
        </mesh>)}
        <Beam at={[0,0,0]} dim={[1.55,.08,.10]} mat={metal}/>
      </group>:index===1?<group>
        <mesh rotation={[Math.PI/2,0,0]} material={metal}><torusGeometry args={[.78,.085,10,quality==="high"?64:28]}/></mesh>
        <mesh material={glass}><icosahedronGeometry args={[.4,quality==="high"?2:1]}/></mesh>
      </group>:<group>
        {[-.47,0,.47].map((z,k)=><mesh key={k} position={[0,k*.12-.15,z]} material={k===1?glass:metal}>
          <cylinderGeometry args={[.46,.46,.14,quality==="high"?40:16]}/>
        </mesh>)}
        <mesh material={glass} position={[0,.45,0]}><octahedronGeometry args={[.25,0]}/></mesh>
      </group>}
    </group>
    <mesh position={[0,-.14,1.0]} material={glass}>
      <planeGeometry args={[1.4,.08]}/>
    </mesh>
  </group>;
}

function SystemRoom({spec,progressRef,quality,focusProject}:{spec:RoomSpec;progressRef:ThresholdProgress;quality:ThresholdQuality;focusProject:string|null}){
  return <group position={spec.center}>
    <RoomArchitecture tint={spec.tint} quality={quality}/>
    {spec.slugs.map((slug,i)=><ProjectInstrument key={slug} slug={slug} index={i} quality={quality}
       tint={spec.tint} emission={spec.emission} progressRef={progressRef} first={spec.first} last={spec.last}
       selected={focusProject===slug}/>)}
  </group>;
}

function FlightLogGallery({quality,progressRef}:{quality:ThresholdQuality;progressRef:ThresholdProgress}){
  const stone=useMemo(()=>new THREE.MeshStandardMaterial({color:"#28323d",roughness:.9}),[]);
  const metal=useMemo(()=>new THREE.MeshStandardMaterial({color:"#b29274",roughness:.52,metalness:.48}),[]);
  const light=useMemo(()=>new THREE.MeshStandardMaterial({color:"#a1bfc1",emissive:"#406b76",emissiveIntensity:.3}),[]);
  const markers=useRef<THREE.Group>(null);
  useEffect(()=>()=>{stone.dispose();metal.dispose();light.dispose();},[stone,metal,light]);
  useFrame(()=>{if(markers.current)markers.current.rotation.y=(segment(progressRef.current,.63,.77)-.5)*.11;});
  return <group position={[0,0,-70]}>
    <RoomArchitecture tint="#c8a68d" quality={quality}/>
    <group ref={markers}>
      {Array.from({length:7},(_,i)=>{
        // Seven plaques line the corridor walls. The central aisle stays
        // clear as the shared camera travels through this chapter.
        const side=i%2===0?-1:1;
        const depth=3-Math.floor(i/2)*2.65;
        return <group key={i} position={[side*4.8,0,depth]} rotation={[0,side*-.13,0]}>
          <Beam at={[0,.15,0]} dim={[1.32,3.1,.35]} mat={stone}/>
          <Beam at={[0,1.65,.23]} dim={[1.36,.08,.09]} mat={metal}/>
          <Beam at={[0,-1.38,.23]} dim={[1.36,.08,.09]} mat={metal}/>
          <mesh position={[0,.60,.25]} material={light}><boxGeometry args={[.70,.70,.08]}/></mesh>
          <mesh position={[0,-.18,.28]} material={metal}><boxGeometry args={[.86,.04,.04]}/></mesh>
          <mesh position={[0,-.45,.28]} material={metal}><boxGeometry args={[.65,.04,.04]}/></mesh>
          <mesh position={[0,-.72,.28]} material={metal}><boxGeometry args={[.75,.04,.04]}/></mesh>
        </group>;
      })}
    </group>
  </group>;
}

function ObservatoryCore({progressRef,quality}:{progressRef:ThresholdProgress;quality:ThresholdQuality}){
  const core=useRef<THREE.Group>(null);
  const petals=useRef<THREE.Group[]>([]);
  const metal=useMemo(()=>new THREE.MeshStandardMaterial({color:"#af9170",metalness:.75,roughness:.33}),[]);
  const glass=useMemo(()=>new THREE.MeshStandardMaterial({color:"#9fc1c6",emissive:"#376974",emissiveIntensity:.40,roughness:.19,metalness:.3}),[]);
  useEffect(()=>()=>{metal.dispose();glass.dispose()},[metal,glass]);
  useFrame(()=>{
    const p=segment(progressRef.current,.77,.89);
    if(core.current)core.current.rotation.y=(p-.5)*.35;
    petals.current.forEach((g,i)=>{if(g)g.position.y=Math.sin(i*2.1)*.14+(p-.5)*((i%2===0)? .6:-.6);});
  });
  return <group position={[0,1,-89]}>
    <RoomArchitecture tint="#d9c3a4" quality={quality}/>
    <group ref={core}>
      <mesh material={metal}><dodecahedronGeometry args={[2.55,0]}/></mesh>
      <mesh material={glass}><icosahedronGeometry args={[2.15,quality==="high"?2:1]}/></mesh>
      {[0,1,2,3].map(i=><group key={i} ref={node=>{if(node)petals.current[i]=node;}}
         rotation={[0,i*Math.PI/2,0]} position={[0,0,0]}>
        <Beam at={[0,0,2.6]} dim={[.5,2.75,.24]} mat={metal}/>
      </group>)}
    </group>
    <pointLight position={[0,1.5,2]} color="#d6b992" intensity={2.6} distance={9}/>
  </group>;
}

function OpenHorizon({quality}:{quality:ThresholdQuality}){
  const mist=useMemo(()=>new THREE.MeshBasicMaterial({color:"#7898a6",transparent:true,opacity:.23,depthWrite:false}),[]);
  const bronze=useMemo(()=>new THREE.MeshStandardMaterial({color:"#b6997c",metalness:.5,roughness:.55}),[]);
  useEffect(()=>()=>{mist.dispose();bronze.dispose();},[mist,bronze]);
  return <group position={[0,0,-113]}>
    <Beam at={[0,-2,0]} dim={[60,.25,24]} mat={bronze}/>
    {Array.from({length:quality==="low"?4:9},(_,i)=>{
      const x=(i-4)*5;
      return <mesh key={i} position={[x,1.2-i*.10,-8-i*.7]} material={mist} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={[11,6]}/>
      </mesh>;
    })}
    <mesh position={[0,3,-19]}>
      <sphereGeometry args={[quality==="low"?4:5,quality==="high"?64:24,quality==="high"?32:12]}/>
      <meshBasicMaterial color="#eedac2" toneMapped={false}/>
    </mesh>
    <pointLight position={[0,5,-9]} intensity={quality==="low"?.6:1.6} distance={40} color="#dfc3a7"/>
  </group>;
}

/** Active/neighbor scenes only; dormant room resources are released safely. */
function GalleryScheduler({progressRef,quality,focusProject}:{progressRef:ThresholdProgress;quality:ThresholdQuality;focusProject:string|null}){
  const [active,setActive]=useState(0);
  useFrame(()=>{
    const p=progressRef.current;
    const next=p<.31?0:p<.42?1:p<.55?2:p<.67?3:p<.80?4:p<.92?5:6;
    if(next!==active)setActive(next);
  });
  const threshold=active<=1;
  const enabledRooms=rooms.filter((_,i)=>Math.abs(i+1-active)<=1);
  return <>
    {threshold&&<ThresholdScene progressRef={progressRef} quality={quality}/>}
    {enabledRooms.map(spec=><SystemRoom key={spec.id} spec={spec} progressRef={progressRef} quality={quality} focusProject={focusProject}/>)}
    {active>=3&&active<=5&&<FlightLogGallery progressRef={progressRef} quality={quality}/>}
    {active>=4&&active<=6&&<ObservatoryCore progressRef={progressRef} quality={quality}/>}
    {active>=5&&<OpenHorizon quality={quality}/>}
  </>;
}

function AtmosphericDirector({progressRef}:{progressRef:ThresholdProgress}){
  const {scene}=useThree();
  const colors=useMemo(()=>[
    new THREE.Color("#1a2d38"),new THREE.Color("#2e4351"),
    new THREE.Color("#172f39"),new THREE.Color("#2f2622"),
    new THREE.Color("#213229"),new THREE.Color("#352d2c"),
    new THREE.Color("#2e333a"),new THREE.Color("#324454")
  ],[]);
  const tmp=useMemo(()=>new THREE.Color(),[]);
  useFrame(()=>{
    const p=progressRef.current;
    const n=clamp(p)*(colors.length-1);
    const i=Math.min(colors.length-2,Math.floor(n));
    tmp.copy(colors[i]).lerp(colors[i+1],ease(n-i));
    if(scene.background instanceof THREE.Color)scene.background.copy(tmp);
    if(scene.fog instanceof THREE.Fog){scene.fog.color.copy(tmp);scene.fog.near=25;scene.fog.far=77;}
  });
  return null;
}

export function ObservatoryJourney({progressRef,quality,focusProject}:Props){
  return <>
    <ThresholdCamera progressRef={progressRef}/>
    <AtmosphericDirector progressRef={progressRef}/>
    <ambientLight color="#cdd9d6" intensity={.42}/>
    <hemisphereLight args={["#c9d9e2","#111722",.7]}/>
    <GalleryScheduler progressRef={progressRef} quality={quality} focusProject={focusProject}/>
  </>;
}
