"use client";

import {Canvas,useFrame} from "@react-three/fiber";
import {Line} from "@react-three/drei";
import {useMemo,useRef} from "react";
import * as THREE from "three";

const CAMERA_POINTS=[
  new THREE.Vector3(0,1.7,15),
  new THREE.Vector3(0,1.6,8),
  new THREE.Vector3(2.8,2,3),
  new THREE.Vector3(1,-5,-4),
  new THREE.Vector3(-5,-1,-16),
  new THREE.Vector3(4,2,-30),
  new THREE.Vector3(0,1,-44),
  new THREE.Vector3(-7,4,-56),
  new THREE.Vector3(0,5,-70),
  new THREE.Vector3(0,1.7,-78)
];

const TARGET_POINTS=[
  new THREE.Vector3(0,1,4),
  new THREE.Vector3(0,1,0),
  new THREE.Vector3(0,0,-5),
  new THREE.Vector3(0,-3,-10),
  new THREE.Vector3(0,0,-22),
  new THREE.Vector3(0,1,-36),
  new THREE.Vector3(0,1,-50),
  new THREE.Vector3(0,2,-62),
  new THREE.Vector3(0,3,-75),
  new THREE.Vector3(0,1,-86)
];

function CameraRig({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(CAMERA_POINTS,false,"catmullrom",.32),[]);
  const targetCurve=useMemo(()=>new THREE.CatmullRomCurve3(TARGET_POINTS,false,"catmullrom",.28),[]);
  const target=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((state,delta)=>{
    const t=THREE.MathUtils.clamp(progress,0,1);
    const wanted=curve.getPointAt(t);
    const wantedTarget=targetCurve.getPointAt(t);
    const px=reducedMotion?0:state.pointer.x*.16;
    const py=reducedMotion?0:state.pointer.y*.09;
    wanted.x+=px;
    wanted.y+=py;
    state.camera.position.lerp(wanted,1-Math.exp(-delta*(reducedMotion?12:4.5)));
    target.lerp(wantedTarget,1-Math.exp(-delta*5));
    state.camera.lookAt(target);
  });
  return null;
}

function Frame({z,scale=1}:{z:number;scale?:number}){
  const mat="#262c30";
  return <group position={[0,0,z]} scale={scale}>
    <mesh position={[-6,0,0]}><boxGeometry args={[.24,10,.32]}/><meshStandardMaterial color={mat} metalness={.82} roughness={.38}/></mesh>
    <mesh position={[6,0,0]}><boxGeometry args={[.24,10,.32]}/><meshStandardMaterial color={mat} metalness={.82} roughness={.38}/></mesh>
    <mesh position={[0,5,0]}><boxGeometry args={[12,.24,.32]}/><meshStandardMaterial color={mat} metalness={.82} roughness={.38}/></mesh>
    <mesh position={[0,-5,0]}><boxGeometry args={[12,.24,.32]}/><meshStandardMaterial color={mat} metalness={.82} roughness={.38}/></mesh>
  </group>;
}

function SignalFlow(){
  const group=useRef<THREE.Group>(null);
  const curve=useMemo(()=>new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4,1,5),new THREE.Vector3(2,2,-6),new THREE.Vector3(-3,-2,-17),
    new THREE.Vector3(3,1,-32),new THREE.Vector3(-2,2,-48),new THREE.Vector3(0,3,-67),new THREE.Vector3(0,1,-84)
  ]),[]);
  const linePoints=useMemo(()=>curve.getPoints(180),[curve]);
  useFrame((state)=>{
    if(!group.current) return;
    group.current.children.forEach((child,i)=>{
      const t=(state.clock.elapsedTime*.035+i/group.current!.children.length)%1;
      child.position.copy(curve.getPointAt(t));
    });
  });
  return <group>
    <Line points={linePoints} color="#ffb457" transparent opacity={.32} lineWidth={1}/>
    <group ref={group}>{Array.from({length:8}).map((_,i)=><mesh key={i}><sphereGeometry args={[.065,10,10]}/><meshBasicMaterial color="#ffd09a" toneMapped={false}/></mesh>)}</group>
  </group>;
}

function MemoryAssembly(){
  return <group position={[0,0,-20]}>
    {Array.from({length:14}).map((_,i)=>{
      const a=i/14*Math.PI*2;
      const r=2.4+(i%3)*.55;
      return <mesh key={i} position={[Math.cos(a)*r,Math.sin(a)*1.5,Math.sin(a)*r*.25]} rotation={[a*.15,a,0]}>
        <boxGeometry args={[.26,.8,.18]}/>
        <meshPhysicalMaterial color="#d7d4c8" transparent opacity={.34} roughness={.2} transmission={.45} thickness={.4}/>
      </mesh>;
    })}
    <mesh><torusGeometry args={[3.8,.08,10,72]}/><meshStandardMaterial color="#59636a" metalness={.9} roughness={.3}/></mesh>
  </group>;
}

function AgentHall(){
  return <group position={[0,0,-34]}>
    {[-3,0,3].map((x,i)=><group key={x} position={[x,0,0]}>
      <mesh><boxGeometry args={[2.1,4.2,1.4]}/><meshStandardMaterial color={i===1?"#e1ded3":"#31383d"} metalness={.74} roughness={.33}/></mesh>
      <mesh position={[0,0,.72]}><boxGeometry args={[1.25,2.2,.06]}/><meshBasicMaterial color={i===1?"#ffb457":"#93afbd"} transparent opacity={.42}/></mesh>
    </group>)}
    <Line points={[[-4,-2,1],[-1,-1,1],[1,1,1],[4,2,1]]} color="#ffb457" lineWidth={1}/>
  </group>;
}

function ReliabilityCore(){
  return <group position={[0,0,-49]}>
    {[-3.6,-1.8,0,1.8,3.6].map((x,i)=><group key={x} position={[x,0,0]}>
      <mesh><boxGeometry args={[1.2,5.2,.55]}/><meshStandardMaterial color="#242b2f" metalness={.78} roughness={.36}/></mesh>
      <mesh position={[0,1.55,.31]}><boxGeometry args={[.78,.12,.04]}/><meshBasicMaterial color={i<4?"#87a88b":"#b65a42"} toneMapped={false}/></mesh>
    </group>)}
  </group>;
}

function RevisionRail(){
  return <group position={[0,0,-61]}>
    <mesh position={[0,-2.3,0]}><boxGeometry args={[11,.18,.35]}/><meshStandardMaterial color="#677177" metalness={.9} roughness={.25}/></mesh>
    {Array.from({length:7}).map((_,i)=><group key={i} position={[-4.5+i*1.5,-1.55,0]}>
      <mesh><boxGeometry args={[.95,1.35,.12]}/><meshStandardMaterial color={i>4?"#e4e1d6":"#343b40"} metalness={.65} roughness={.35}/></mesh>
      <mesh position={[0,.25,.08]}><boxGeometry args={[.55,.04,.02]}/><meshBasicMaterial color="#ffb457" transparent opacity={.55}/></mesh>
    </group>)}
  </group>;
}

function SynthesisCore(){
  const ring=useRef<THREE.Mesh>(null);
  useFrame((_,d)=>{if(ring.current) ring.current.rotation.z+=d*.08;});
  return <group position={[0,1,-74]}>
    <mesh ref={ring} rotation={[Math.PI/2,0,0]}><torusGeometry args={[4.1,.18,16,96]}/><meshStandardMaterial color="#d8d4c8" metalness={.88} roughness={.2}/></mesh>
    <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[2.6,.06,10,96]}/><meshBasicMaterial color="#ffb457" transparent opacity={.7}/></mesh>
    <mesh><icosahedronGeometry args={[1.25,1]}/><meshPhysicalMaterial color="#e8e5db" metalness={.2} roughness={.2} transmission={.18}/></mesh>
  </group>;
}

function MachineWorld(){
  return <group>
    <ambientLight intensity={.33}/>
    <directionalLight position={[5,8,10]} intensity={1.4} color="#f2eee3"/>
    <pointLight position={[0,2,-34]} intensity={16} distance={18} color="#ffb457"/>
    <pointLight position={[-2,3,-68]} intensity={12} distance={20} color="#93afbd"/>
    {Array.from({length:18}).map((_,i)=><Frame key={i} z={8-i*5.2} scale={1-(i*.006)}/>)}
    <mesh position={[0,-4.8,-38]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[13,92]}/><meshStandardMaterial color="#171b1e" roughness={.72} metalness={.35}/></mesh>
    <MemoryAssembly/>
    <AgentHall/>
    <ReliabilityCore/>
    <RevisionRail/>
    <SynthesisCore/>
    <SignalFlow/>
  </group>;
}

export function WorldCanvas({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  return <div className="world-canvas" aria-hidden="true">
    <Canvas dpr={[1,1.6]} camera={{position:[0,1.7,15],fov:40,near:.1,far:150}} gl={{antialias:true,powerPreference:"high-performance"}}>
      <color attach="background" args={["#111315"]}/>
      <fog attach="fog" args={["#111315",13,48]}/>
      <CameraRig progress={progress} reducedMotion={reducedMotion}/>
      <MachineWorld/>
    </Canvas>
  </div>;
}
