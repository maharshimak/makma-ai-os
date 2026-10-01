"use client";

import {AdaptiveDpr,PerformanceMonitor,useGLTF,useTexture} from "@react-three/drei";
import {Canvas,useFrame} from "@react-three/fiber";
import {Bloom,EffectComposer} from "@react-three/postprocessing";
import {Suspense,useMemo,useRef,useState} from "react";
import * as THREE from "three";

const WEBB="https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2022/10/STScI-01GFRYYRTCTMX197BY86MBFCR9.png?crop=faces%2Cfocalpoint&fit=clip&h=1817&w=1987";
const EUROPA="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/jupiter---europa/preview.webp?w=2048";
const JUPITER="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/jupiter/preview.webp?w=2048";
const MARS="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/mars/preview.webp?w=2048";
const SURVEYOR="https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Mars%20Global%20Surveyor/Mars%20Global%20Surveyor%20(mapping).glb";

const cameraPoints=[
  new THREE.Vector3(0,1.2,13),
  new THREE.Vector3(-1.6,1.8,7),
  new THREE.Vector3(-2.7,1.5,1.2),
  new THREE.Vector3(-1.1,.7,-5.8),
  new THREE.Vector3(1.2,.3,-16.2),
  new THREE.Vector3(.8,.9,-27.5),
  new THREE.Vector3(-1.4,1.4,-36.2),
  new THREE.Vector3(.2,1.9,-47.5),
  new THREE.Vector3(0,1.2,-56)
];

const targetPoints=[
  new THREE.Vector3(-3.6,.5,-5.5),
  new THREE.Vector3(-4.4,.6,-7.5),
  new THREE.Vector3(-4.6,.6,-8),
  new THREE.Vector3(-4.6,.5,-8),
  new THREE.Vector3(4.9,-.4,-23),
  new THREE.Vector3(4.9,-.4,-23),
  new THREE.Vector3(-4.2,.6,-39),
  new THREE.Vector3(0,1,-58),
  new THREE.Vector3(0,1,-69)
];

function CameraRig({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(cameraPoints,false,"catmullrom",.36),[]);
  const targetCurve=useMemo(()=>new THREE.CatmullRomCurve3(targetPoints,false,"catmullrom",.32),[]);
  const target=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((state,delta)=>{
    const t=THREE.MathUtils.clamp(progress,0,1);
    const wanted=curve.getPointAt(t);
    const look=targetCurve.getPointAt(t);
    if(!reducedMotion){
      wanted.x+=state.pointer.x*.16;
      wanted.y+=state.pointer.y*.09;
    }
    state.camera.position.lerp(wanted,1-Math.exp(-delta*(reducedMotion?10:3.8)));
    target.lerp(look,1-Math.exp(-delta*4.2));
    state.camera.lookAt(target);
  });
  return null;
}

function DeepField(){
  const texture=useTexture(WEBB);
  useMemo(()=>{texture.colorSpace=THREE.SRGBColorSpace;},[texture]);
  return <mesh position={[0,3,-71]} scale={[1.28,1,1]}>
    <planeGeometry args={[90,82]}/>
    <meshBasicMaterial map={texture} toneMapped={false}/>
  </mesh>;
}

function World({
  textureUrl,
  position,
  radius,
  tilt=0,
  speed=.035,
  atmosphere
}:{
  textureUrl:string;
  position:[number,number,number];
  radius:number;
  tilt?:number;
  speed?:number;
  atmosphere:string;
}){
  const map=useTexture(textureUrl);
  const planet=useRef<THREE.Mesh>(null);
  useMemo(()=>{map.colorSpace=THREE.SRGBColorSpace;},[map]);
  useFrame((_,delta)=>{
    if(planet.current)planet.current.rotation.y+=delta*speed;
  });
  return <group position={position} rotation={[0,0,tilt]}>
    <mesh ref={planet}>
      <sphereGeometry args={[radius,72,72]}/>
      <meshStandardMaterial map={map} roughness={.82} metalness={0}/>
    </mesh>
    <mesh scale={1.018}>
      <sphereGeometry args={[radius,64,64]}/>
      <meshBasicMaterial color={atmosphere} transparent opacity={.045} side={THREE.BackSide} toneMapped={false}/>
    </mesh>
  </group>;
}

function Surveyor({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const {scene}=useGLTF(SURVEYOR);
  const craft=useMemo(()=>{
    const clone=scene.clone(true);
    const initial=new THREE.Box3().setFromObject(clone);
    const size=initial.getSize(new THREE.Vector3());
    const largest=Math.max(size.x,size.y,size.z)||1;
    clone.scale.multiplyScalar(2.25/largest);
    const box=new THREE.Box3().setFromObject(clone);
    const center=box.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    return clone;
  },[scene]);
  const group=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!group.current)return;
    const t=clock.elapsedTime;
    const travel=Math.min(1,Math.max(0,(progress-.18)/.66));
    group.current.position.set(
      THREE.MathUtils.lerp(3.2,-1.5,travel),
      2.1+Math.sin(t*.22)*.16,
      THREE.MathUtils.lerp(-9,-43,travel)
    );
    if(!reducedMotion){
      group.current.rotation.y=t*.11+travel*1.8;
      group.current.rotation.z=-.16+Math.sin(t*.18)*.05;
    }
  });
  return <group ref={group} position={[3.2,2.1,-9]} scale={.88}>
    <primitive object={craft}/>
  </group>;
}

function CosmicScene({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  return <>
    <DeepField/>
    <ambientLight intensity={.34}/>
    <hemisphereLight args={["#c7d1d8","#160e09",.42]}/>
    <directionalLight position={[5,4,8]} intensity={2.3} color="#fff0db"/>
    <directionalLight position={[-5,-1,1]} intensity={.65} color="#7c9aab"/>

    <World textureUrl={EUROPA} position={[-4.6,.55,-8]} radius={2.65} tilt={-.18} speed={.025} atmosphere="#b9d0d7"/>
    <World textureUrl={JUPITER} position={[4.9,-.45,-23]} radius={4.3} tilt={.05} speed={.018} atmosphere="#d9b38e"/>
    <World textureUrl={MARS} position={[-4.2,.55,-39]} radius={3.05} tilt={-.1} speed={.022} atmosphere="#c56e45"/>
    <Surveyor progress={progress} reducedMotion={reducedMotion}/>
  </>;
}

export function WorldCanvas({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const [quality,setQuality]=useState<"high"|"medium"|"low">("high");
  return <div className="world-canvas" aria-hidden="true">
    <Canvas
      dpr={[.8,1.55]}
      camera={{position:[0,1.2,13],fov:40,near:.1,far:130}}
      gl={{antialias:true,powerPreference:"high-performance",toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:.92}}
    >
      <color attach="background" args={["#020304"]}/>
      <fog attach="fog" args={["#050608",36,104]}/>
      <AdaptiveDpr pixelated/>
      <PerformanceMonitor
        flipflops={3}
        onDecline={()=>setQuality(value=>value==="high"?"medium":"low")}
        onIncline={()=>setQuality(value=>value==="low"?"medium":"high")}
      />
      <Suspense fallback={null}>
        <CameraRig progress={progress} reducedMotion={reducedMotion}/>
        <CosmicScene progress={progress} reducedMotion={reducedMotion}/>
        {!reducedMotion&&quality==="high"&&<EffectComposer multisampling={0}>
          <Bloom intensity={.32} luminanceThreshold={1.05} luminanceSmoothing={.18} mipmapBlur/>
        </EffectComposer>}
      </Suspense>
    </Canvas>
  </div>;
}

useGLTF.preload(SURVEYOR);
