"use client";

import {AdaptiveDpr,Line,PerformanceMonitor,Sparkles,Stars,useGLTF,useTexture} from "@react-three/drei";
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
  new THREE.Vector3(0,1.2,13),new THREE.Vector3(-1.6,1.8,7),new THREE.Vector3(-2.7,1.5,1.2),
  new THREE.Vector3(-1.1,.7,-5.8),new THREE.Vector3(1.2,.3,-16.2),new THREE.Vector3(.8,.9,-27.5),
  new THREE.Vector3(-1.4,1.4,-36.2),new THREE.Vector3(.2,1.9,-47.5),new THREE.Vector3(0,1.2,-56)
];

const targetPoints=[
  new THREE.Vector3(-3.6,.5,-5.5),new THREE.Vector3(-4.4,.6,-7.5),new THREE.Vector3(-4.6,.6,-8),
  new THREE.Vector3(-4.6,.5,-8),new THREE.Vector3(4.9,-.4,-23),new THREE.Vector3(4.9,-.4,-23),
  new THREE.Vector3(-4.2,.6,-39),new THREE.Vector3(0,1,-58),new THREE.Vector3(0,1,-69)
];

const trajectoryPoints=[
  new THREE.Vector3(3.5,2.1,-8),new THREE.Vector3(-2.4,1.1,-12),new THREE.Vector3(1.8,.5,-19),
  new THREE.Vector3(5.5,-.2,-24),new THREE.Vector3(1.3,.8,-31),new THREE.Vector3(-4.8,.8,-39),
  new THREE.Vector3(-1.2,1.5,-47),new THREE.Vector3(0,1.4,-60)
];

function CameraRig({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(cameraPoints,false,"catmullrom",.36),[]);
  const targetCurve=useMemo(()=>new THREE.CatmullRomCurve3(targetPoints,false,"catmullrom",.32),[]);
  const target=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((state,delta)=>{
    const t=THREE.MathUtils.clamp(progress,0,1);
    const wanted=curve.getPointAt(t);
    const look=targetCurve.getPointAt(t);
    if(!reducedMotion){wanted.x+=state.pointer.x*.16;wanted.y+=state.pointer.y*.09;}
    state.camera.position.lerp(wanted,1-Math.exp(-delta*(reducedMotion?10:3.8)));
    target.lerp(look,1-Math.exp(-delta*4.2));
    state.camera.lookAt(target);
    if(!reducedMotion)state.camera.rotation.z=THREE.MathUtils.lerp(state.camera.rotation.z,(state.pointer.x*.003)+(Math.sin(t*Math.PI*2)*.0025),.035);
  });
  return null;
}

function DeepField(){
  const texture=useTexture(WEBB);
  useMemo(()=>{texture.colorSpace=THREE.SRGBColorSpace;},[texture]);
  return <group>
    <mesh position={[0,3,-72]} scale={[1.28,1,1]}>
      <planeGeometry args={[90,82]}/>
      <meshBasicMaterial map={texture} toneMapped={false}/>
    </mesh>
    <mesh position={[0,3,-71.5]}>
      <planeGeometry args={[92,84]}/>
      <meshBasicMaterial color="#111c23" transparent opacity={.12} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
    </mesh>
  </group>;
}

function OrbitalGuide({radius,color="#d09a6a",rotation=[Math.PI/2,0,0]}:{radius:number;color?:string;rotation?:[number,number,number]}){
  return <mesh rotation={rotation}>
    <torusGeometry args={[radius,.008,6,128]}/>
    <meshBasicMaterial color={color} transparent opacity={.18} depthWrite={false} toneMapped={false}/>
  </mesh>;
}

function World({textureUrl,position,radius,tilt=0,speed=.035,atmosphere,guideColor}:{textureUrl:string;position:[number,number,number];radius:number;tilt?:number;speed?:number;atmosphere:string;guideColor:string}){
  const map=useTexture(textureUrl);
  const planet=useRef<THREE.Mesh>(null);
  useMemo(()=>{map.colorSpace=THREE.SRGBColorSpace;},[map]);
  useFrame((_,delta)=>{if(planet.current)planet.current.rotation.y+=delta*speed;});
  return <group position={position} rotation={[0,0,tilt]}>
    <OrbitalGuide radius={radius*1.42} color={guideColor}/>
    <OrbitalGuide radius={radius*1.72} color={guideColor} rotation={[Math.PI/2+.24,.12,.16]}/>
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

function FlightPath({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(trajectoryPoints,false,"catmullrom",.42),[]);
  const points=useMemo(()=>curve.getPoints(180),[curve]);
  const beacon=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!beacon.current)return;
    const drift=reducedMotion?0:(clock.elapsedTime*.018)%1;
    const t=THREE.MathUtils.clamp(progress*.78+drift*.22,0,1);
    beacon.current.position.copy(curve.getPointAt(t));
  });
  return <group>
    <Line points={points} color="#9fb8c0" transparent opacity={.17} lineWidth={.62}/>
    <Line points={points.map(point=>point.clone().add(new THREE.Vector3(.02,.02,.02)))} color="#d09a6a" transparent opacity={.09} lineWidth={.3}/>
    <group ref={beacon}>
      <mesh><sphereGeometry args={[.065,12,12]}/><meshBasicMaterial color="#f7dfc8" toneMapped={false}/></mesh>
      <pointLight intensity={2.8} distance={2.5} color="#d8a77d"/>
    </group>
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
    group.current.position.set(THREE.MathUtils.lerp(3.2,-1.5,travel),2.1+Math.sin(t*.22)*.16,THREE.MathUtils.lerp(-9,-43,travel));
    if(!reducedMotion){group.current.rotation.y=t*.11+travel*1.8;group.current.rotation.z=-.16+Math.sin(t*.18)*.05;}
  });
  return <group ref={group} position={[3.2,2.1,-9]} scale={.88}>
    <primitive object={craft}/>
    <pointLight position={[0,0,.8]} intensity={1.8} distance={2.5} color="#d09a6a"/>
  </group>;
}

function ReactiveLighting({progress}:{progress:number}){
  const key=useRef<THREE.DirectionalLight>(null);
  const rim=useRef<THREE.DirectionalLight>(null);
  const warm=useMemo(()=>new THREE.Color("#fff0db"),[]);
  const cool=useMemo(()=>new THREE.Color("#a8c2ca"),[]);
  useFrame((_,delta)=>{
    const p=THREE.MathUtils.clamp(progress,0,1);
    if(key.current){
      key.current.intensity=THREE.MathUtils.damp(key.current.intensity,1.9+Math.sin(p*Math.PI)*.72,2.5,delta);
      key.current.color.lerp(p>.62?cool:warm,1-Math.exp(-delta*1.8));
    }
    if(rim.current)rim.current.intensity=THREE.MathUtils.damp(rim.current.intensity,.45+p*.42,2.2,delta);
  });
  return <>
    <ambientLight intensity={.3}/>
    <hemisphereLight args={["#c7d1d8","#160e09",.38]}/>
    <directionalLight ref={key} position={[5,4,8]} intensity={2.2} color="#fff0db"/>
    <directionalLight ref={rim} position={[-5,-1,1]} intensity={.62} color="#7c9aab"/>
  </>;
}

function CosmicScene({progress,reducedMotion,quality}:{progress:number;reducedMotion:boolean;quality:"high"|"medium"|"low"}){
  const starCount=quality==="low"?900:quality==="medium"?1700:2700;
  const dustCount=quality==="low"?45:quality==="medium"?85:145;
  return <>
    <DeepField/>
    <Stars radius={76} depth={36} count={starCount} factor={2.2} saturation={0} fade speed={.16}/>
    <Sparkles count={dustCount} scale={[26,14,78]} size={quality==="high"?1.25:.9} speed={.12} opacity={.22} color="#d8e3e7"/>
    <ReactiveLighting progress={progress}/>
    <FlightPath progress={progress} reducedMotion={reducedMotion}/>
    <World textureUrl={EUROPA} position={[-4.6,.55,-8]} radius={2.65} tilt={-.18} speed={.025} atmosphere="#b9d0d7" guideColor="#9fb8c0"/>
    <World textureUrl={JUPITER} position={[4.9,-.45,-23]} radius={4.3} tilt={.05} speed={.018} atmosphere="#d9b38e" guideColor="#d09a6a"/>
    <World textureUrl={MARS} position={[-4.2,.55,-39]} radius={3.05} tilt={-.1} speed={.022} atmosphere="#c56e45" guideColor="#c28a6f"/>
    <Surveyor progress={progress} reducedMotion={reducedMotion}/>
  </>;
}

export function WorldCanvas({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const [quality,setQuality]=useState<"high"|"medium"|"low">("high");
  return <div className="world-canvas" aria-hidden="true">
    <Canvas dpr={[.78,1.5]} camera={{position:[0,1.2,13],fov:40,near:.1,far:130}} gl={{antialias:true,powerPreference:"high-performance",toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:.94}}>
      <color attach="background" args={["#020304"]}/>
      <fog attach="fog" args={["#050608",38,106]}/>
      <AdaptiveDpr pixelated/>
      <PerformanceMonitor flipflops={3} onDecline={()=>setQuality(value=>value==="high"?"medium":"low")} onIncline={()=>setQuality(value=>value==="low"?"medium":"high")}/>
      <Suspense fallback={null}>
        <CameraRig progress={progress} reducedMotion={reducedMotion}/>
        <CosmicScene progress={progress} reducedMotion={reducedMotion} quality={quality}/>
        {!reducedMotion&&quality!=="low"&&<EffectComposer multisampling={0}><Bloom intensity={quality==="high"?.38:.24} luminanceThreshold={.96} luminanceSmoothing={.2} mipmapBlur/></EffectComposer>}
      </Suspense>
    </Canvas>
  </div>;
}

useGLTF.preload(SURVEYOR);
