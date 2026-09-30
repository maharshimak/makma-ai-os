"use client";

import {AdaptiveDpr,PerformanceMonitor,Sparkles,useTexture} from "@react-three/drei";
import {Canvas,useFrame} from "@react-three/fiber";
import {Bloom,EffectComposer} from "@react-three/postprocessing";
import {Suspense,useMemo,useRef,useState} from "react";
import * as THREE from "three";

const cameraPoints=[
  new THREE.Vector3(.3,1.5,10.5),
  new THREE.Vector3(3.9,2.5,8.1),
  new THREE.Vector3(5.6,-1.8,6.8),
  new THREE.Vector3(4.2,1.1,5.7),
  new THREE.Vector3(-2.8,2.4,5.8),
  new THREE.Vector3(-5.1,.8,6.9),
  new THREE.Vector3(-4.1,-2.2,7.8),
  new THREE.Vector3(.2,2.6,6.4),
  new THREE.Vector3(.1,1.4,10.8)
];

const targetPoints=[
  new THREE.Vector3(0,.25,0),
  new THREE.Vector3(0,.2,0),
  new THREE.Vector3(0,-.25,0),
  new THREE.Vector3(0,.1,0),
  new THREE.Vector3(0,.2,0),
  new THREE.Vector3(0,.1,0),
  new THREE.Vector3(0,-.15,0),
  new THREE.Vector3(0,.3,0),
  new THREE.Vector3(0,.25,0)
];

function ease(value:number){
  const x=Math.min(1,Math.max(0,value));
  return x*x*(3-2*x);
}

function band(progress:number,start:number,end:number){
  return ease((progress-start)/(end-start));
}

function CameraRig({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(cameraPoints,false,"catmullrom",.34),[]);
  const targetCurve=useMemo(()=>new THREE.CatmullRomCurve3(targetPoints,false,"catmullrom",.3),[]);
  const target=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((state,delta)=>{
    const t=THREE.MathUtils.clamp(progress,0,1);
    const wanted=curve.getPointAt(t);
    const wantedTarget=targetCurve.getPointAt(t);
    if(!reducedMotion){
      wanted.x+=state.pointer.x*.16;
      wanted.y+=state.pointer.y*.09;
    }
    state.camera.position.lerp(wanted,1-Math.exp(-delta*(reducedMotion?10:3.5)));
    target.lerp(wantedTarget,1-Math.exp(-delta*4));
    state.camera.lookAt(target);
  });
  return null;
}

function EnvironmentArt({reducedMotion}:{reducedMotion:boolean}){
  const base=process.env.NEXT_PUBLIC_BASE_PATH??"";
  const [nebula,cloud]=useTexture([
    base+"/assets/v5/nebula-generated.webp",
    base+"/assets/v5/cloud-generated.webp"
  ]);
  const left=useRef<THREE.Mesh>(null);
  const right=useRef<THREE.Mesh>(null);

  useMemo(()=>{
    nebula.colorSpace=THREE.SRGBColorSpace;
    cloud.colorSpace=THREE.SRGBColorSpace;
  },[nebula,cloud]);

  useFrame(({clock})=>{
    if(reducedMotion)return;
    const t=clock.elapsedTime;
    if(left.current){
      left.current.position.x=-7+Math.sin(t*.045)*.8;
      left.current.position.y=3.2+Math.cos(t*.038)*.35;
    }
    if(right.current){
      right.current.position.x=7+Math.cos(t*.035)*1.1;
      right.current.position.y=-2.5+Math.sin(t*.04)*.45;
    }
  });

  return <group>
    <mesh position={[0,1,-18]} scale={[1.35,1,1]}>
      <planeGeometry args={[38,22]}/>
      <meshBasicMaterial map={nebula} transparent opacity={.38} depthWrite={false} toneMapped={false}/>
    </mesh>
    <mesh ref={left} position={[-7,3.2,-8]} scale={[12,4.2,1]}>
      <planeGeometry args={[1,1]}/>
      <meshBasicMaterial map={cloud} transparent opacity={.065} depthWrite={false} toneMapped={false}/>
    </mesh>
    <mesh ref={right} position={[7,-2.5,-10]} scale={[-14,4.8,1]}>
      <planeGeometry args={[1,1]}/>
      <meshBasicMaterial map={cloud} transparent opacity={.055} depthWrite={false} toneMapped={false}/>
    </mesh>
  </group>;
}

function Core(){
  const outer=useRef<THREE.Mesh>(null);
  const middle=useRef<THREE.Mesh>(null);
  const heart=useRef<THREE.Mesh>(null);

  useFrame(({clock},delta)=>{
    if(outer.current)outer.current.rotation.z+=delta*.055;
    if(middle.current)middle.current.rotation.z-=delta*.035;
    if(heart.current){
      const scale=1+Math.sin(clock.elapsedTime*.8)*.025;
      heart.current.scale.setScalar(scale);
    }
  });

  return <group>
    <mesh ref={outer} rotation={[Math.PI/2,.12,0]}>
      <torusGeometry args={[2.4,.12,18,120]}/>
      <meshStandardMaterial color="#8b8981" metalness={.82} roughness={.3}/>
    </mesh>
    <mesh ref={middle} rotation={[Math.PI/2,-.18,.5]}>
      <torusGeometry args={[1.88,.055,12,110]}/>
      <meshStandardMaterial color="#4c565b" metalness={.88} roughness={.28}/>
    </mesh>
    <mesh rotation={[Math.PI/2,.25,-.4]}>
      <torusGeometry args={[1.35,.025,10,96]}/>
      <meshStandardMaterial color="#9c7959" metalness={.75} roughness={.31}/>
    </mesh>
    <mesh ref={heart}>
      <icosahedronGeometry args={[.78,3]}/>
      <meshPhysicalMaterial color="#d9c5ab" roughness={.28} metalness={.15} emissive="#7b4529" emissiveIntensity={.22}/>
    </mesh>
    <pointLight intensity={4.5} distance={8} color="#c98658"/>
  </group>;
}

function MemoryLayer({progress}:{progress:number}){
  const group=useRef<THREE.Group>(null);
  const strength=band(progress,.24,.38);
  useFrame(({clock},delta)=>{
    if(!group.current)return;
    group.current.rotation.z+=delta*.018;
    group.current.scale.setScalar(.82+strength*.18);
    group.current.children.forEach((child,index)=>{
      child.position.z=Math.sin(clock.elapsedTime*.35+index*.7)*.08*strength;
    });
  });

  return <group ref={group}>
    {Array.from({length:14}).map((_,index)=>{
      const angle=index/14*Math.PI*2;
      const radius=3.05+(index%2)*.18;
      return <mesh key={index} position={[Math.cos(angle)*radius,Math.sin(angle)*radius*.72,0]} rotation={[0,0,angle]}>
        <boxGeometry args={[.18,.72,.1]}/>
        <meshStandardMaterial color={index%4===0?"#b8b2a5":"#656c6e"} metalness={.66} roughness={.42} transparent opacity={.16+strength*.58}/>
      </mesh>;
    })}
  </group>;
}

function AgencyLayer({progress}:{progress:number}){
  const group=useRef<THREE.Group>(null);
  const strength=band(progress,.40,.56);
  useFrame(({clock},delta)=>{
    if(!group.current)return;
    group.current.rotation.y+=delta*.024;
    group.current.rotation.z=Math.sin(clock.elapsedTime*.16)*.08;
  });
  return <group ref={group}>
    {Array.from({length:6}).map((_,index)=>{
      const angle=index/6*Math.PI*2;
      return <group key={index} position={[Math.cos(angle)*3.9,Math.sin(angle)*2.4,Math.sin(angle)*.7]}>
        <mesh rotation={[0,angle,0]}>
          <boxGeometry args={[.58,1.05,.48]}/>
          <meshStandardMaterial color={index%2===0?"#b4afa2":"#3d474c"} metalness={.74} roughness={.35} transparent opacity={.12+strength*.72}/>
        </mesh>
        <mesh position={[0,0,.26]}>
          <boxGeometry args={[.18,.32,.02]}/>
          <meshBasicMaterial color={index%2===0?"#8ca7ad":"#a27b58"} transparent opacity={.05+strength*.32} toneMapped={false}/>
        </mesh>
      </group>;
    })}
  </group>;
}

function ReliabilityLayer({progress}:{progress:number}){
  const strength=band(progress,.56,.72);
  return <group>
    {Array.from({length:8}).map((_,index)=>{
      const angle=index/8*Math.PI*2;
      return <group key={index} rotation={[0,0,angle]}>
        <mesh position={[0,3.7,0]} rotation={[0,0,0]}>
          <boxGeometry args={[.08,1.1,.22]}/>
          <meshStandardMaterial color="#7a7e7b" metalness={.78} roughness={.34} transparent opacity={.08+strength*.58}/>
        </mesh>
        <mesh position={[0,4.2,0]}>
          <boxGeometry args={[.48,.07,.24]}/>
          <meshStandardMaterial color="#aca99f" metalness={.72} roughness={.38} transparent opacity={.06+strength*.52}/>
        </mesh>
      </group>;
    })}
    <mesh rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[4.2,.025,8,120]}/>
      <meshStandardMaterial color="#879092" metalness={.7} roughness={.4} transparent opacity={.04+strength*.32}/>
    </mesh>
  </group>;
}

function RevisionLayer({progress}:{progress:number}){
  const group=useRef<THREE.Group>(null);
  const strength=band(progress,.66,.82);
  useFrame(({clock})=>{
    if(!group.current)return;
    group.current.position.x=Math.sin(clock.elapsedTime*.12)*.35;
  });
  return <group ref={group} position={[0,-3.65,-.6]}>
    <mesh><boxGeometry args={[8.2,.08,.22]}/><meshStandardMaterial color="#585f60" metalness={.78} roughness={.4} transparent opacity={.06+strength*.48}/></mesh>
    {Array.from({length:7}).map((_,index)=><mesh key={index} position={[-3.35+index*1.12,.28,0]}>
      <boxGeometry args={[.72,.52,.16]}/>
      <meshStandardMaterial color={index>4?"#a8a398":"#4b5254"} metalness={.58} roughness={.46} transparent opacity={.06+strength*.6}/>
    </mesh>)}
  </group>;
}

function SignalFilament({progress}:{progress:number}){
  const points=useMemo(()=>[
    new THREE.Vector3(-4.8,-2.2,.3),
    new THREE.Vector3(-2.9,-.8,.7),
    new THREE.Vector3(-1.3,.9,.25),
    new THREE.Vector3(.1,.1,.9),
    new THREE.Vector3(1.7,-.6,.25),
    new THREE.Vector3(3.1,1.2,.65),
    new THREE.Vector3(4.8,2.1,.15)
  ],[]);
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(points),[points]);
  const particles=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!particles.current)return;
    particles.current.children.forEach((child,index)=>{
      const t=(clock.elapsedTime*.028+index/particles.current!.children.length+progress*.12)%1;
      child.position.copy(curve.getPointAt(t));
    });
  });
  return <group ref={particles}>
    {Array.from({length:7}).map((_,index)=><mesh key={index}>
      <sphereGeometry args={[.045,10,10]}/>
      <meshBasicMaterial color={index%2===0?"#c8a17d":"#9ab0b4"} transparent opacity={.46} toneMapped={false}/>
    </mesh>)}
  </group>;
}

function SynthesisArtifact({progress}:{progress:number}){
  const root=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!root.current)return;
    root.current.rotation.y=Math.sin(clock.elapsedTime*.07)*.12;
    root.current.rotation.x=Math.sin(clock.elapsedTime*.045)*.025;
  });

  return <group ref={root}>
    <Core/>
    <MemoryLayer progress={progress}/>
    <AgencyLayer progress={progress}/>
    <ReliabilityLayer progress={progress}/>
    <RevisionLayer progress={progress}/>
    <SignalFilament progress={progress}/>
  </group>;
}

function Scene({progress,reducedMotion,quality}:{progress:number;reducedMotion:boolean;quality:"high"|"medium"|"low"}){
  const sparkles=quality==="low"?90:quality==="medium"?160:240;
  return <>
    <EnvironmentArt reducedMotion={reducedMotion}/>
    <ambientLight intensity={.42}/>
    <directionalLight position={[5,7,8]} intensity={1.8} color="#e6e0d5"/>
    <directionalLight position={[-6,-2,5]} intensity={.75} color="#76909a"/>
    <SynthesisArtifact progress={progress}/>
    <Sparkles count={sparkles} scale={[18,12,20]} size={quality==="high"?.7:.55} speed={.035} opacity={.2} color="#d9ddd9"/>
  </>;
}

export function WorldCanvas({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const [quality,setQuality]=useState<"high"|"medium"|"low">("high");
  return <div className="world-canvas" aria-hidden="true">
    <Canvas dpr={[.8,1.5]} camera={{position:[.3,1.5,10.5],fov:42,near:.1,far:80}} gl={{antialias:true,powerPreference:"high-performance",toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:.92}}>
      <color attach="background" args={["#080a0b"]}/>
      <fog attach="fog" args={["#0b0e10",11,27]}/>
      <AdaptiveDpr pixelated/>
      <PerformanceMonitor
        flipflops={3}
        onDecline={()=>setQuality(value=>value==="high"?"medium":"low")}
        onIncline={()=>setQuality(value=>value==="low"?"medium":"high")}
      />
      <Suspense fallback={null}>
        <CameraRig progress={progress} reducedMotion={reducedMotion}/>
        <Scene progress={progress} reducedMotion={reducedMotion} quality={quality}/>
        {!reducedMotion&&quality==="high"&&<EffectComposer multisampling={0}>
          <Bloom intensity={.18} luminanceThreshold={1.02} luminanceSmoothing={.18} mipmapBlur/>
        </EffectComposer>}
      </Suspense>
    </Canvas>
  </div>;
}
