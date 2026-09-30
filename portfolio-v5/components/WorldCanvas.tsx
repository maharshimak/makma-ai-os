"use client";

import {Canvas,useFrame} from "@react-three/fiber";
import {Line} from "@react-three/drei";
import {useMemo,useRef} from "react";
import * as THREE from "three";

const CAMERA_POINTS=[
  new THREE.Vector3(0,1.7,15),new THREE.Vector3(0,1.6,8),new THREE.Vector3(2.8,2,3),
  new THREE.Vector3(1,-5,-4),new THREE.Vector3(-5,-1,-16),new THREE.Vector3(4,2,-30),
  new THREE.Vector3(0,1,-44),new THREE.Vector3(-7,4,-56),new THREE.Vector3(0,5,-70),new THREE.Vector3(0,1.7,-78)
];
const TARGET_POINTS=[
  new THREE.Vector3(0,1,4),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,-5),
  new THREE.Vector3(0,-3,-10),new THREE.Vector3(0,0,-22),new THREE.Vector3(0,1,-36),
  new THREE.Vector3(0,1,-50),new THREE.Vector3(0,2,-62),new THREE.Vector3(0,3,-75),new THREE.Vector3(0,1,-86)
];

function CameraRig({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(CAMERA_POINTS,false,"catmullrom",.32),[]);
  const targetCurve=useMemo(()=>new THREE.CatmullRomCurve3(TARGET_POINTS,false,"catmullrom",.28),[]);
  const target=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((state,delta)=>{
    const t=THREE.MathUtils.clamp(progress,0,1);
    const wanted=curve.getPointAt(t);
    const wantedTarget=targetCurve.getPointAt(t);
    const px=reducedMotion?0:state.pointer.x*.15;
    const py=reducedMotion?0:state.pointer.y*.08;
    wanted.x+=px; wanted.y+=py;
    state.camera.position.lerp(wanted,1-Math.exp(-delta*(reducedMotion?12:4.3)));
    target.lerp(wantedTarget,1-Math.exp(-delta*5));
    state.camera.lookAt(target);
  });
  return null;
}

function AccessGate({progress}:{progress:number}){
  const left=useRef<THREE.Group>(null);
  const right=useRef<THREE.Group>(null);
  useFrame((_,delta)=>{
    const open=THREE.MathUtils.smoothstep(progress,0,.085);
    if(left.current) left.current.position.x=THREE.MathUtils.damp(left.current.position.x,-3.15-open*5.4,5,delta);
    if(right.current) right.current.position.x=THREE.MathUtils.damp(right.current.position.x,3.15+open*5.4,5,delta);
  });
  const panel=(side:number)=><group>
    <mesh><boxGeometry args={[5.8,9.4,.48]}/><meshStandardMaterial color="#1c2124" metalness={.92} roughness={.31}/></mesh>
    <mesh position={[side*2.55,0,.28]}><boxGeometry args={[.12,8.1,.08]}/><meshBasicMaterial color="#ffb457" toneMapped={false}/></mesh>
    {[-2.7,-.9,.9,2.7].map(y=><mesh key={y} position={[0,y,.265]}><boxGeometry args={[4.6,.045,.04]}/><meshBasicMaterial color="#6a7479" transparent opacity={.42}/></mesh>)}
    <mesh position={[side*2.25,3.75,.31]}><boxGeometry args={[.5,.1,.05]}/><meshBasicMaterial color="#93afbd" toneMapped={false}/></mesh>
  </group>;
  return <group position={[0,0,5.8]}>
    <group ref={left}>{panel(1)}</group>
    <group ref={right}>{panel(-1)}</group>
    <pointLight position={[0,0,.7]} color="#ffb457" intensity={10} distance={8}/>
  </group>;
}

function Frame({z,scale=1,index}:{z:number;scale?:number;index:number}){
  const mat=index%3===0?"#30383c":"#262c30";
  return <group position={[0,0,z]} scale={scale}>
    <mesh position={[-6,0,0]}><boxGeometry args={[.24,10,.32]}/><meshStandardMaterial color={mat} metalness={.86} roughness={.34}/></mesh>
    <mesh position={[6,0,0]}><boxGeometry args={[.24,10,.32]}/><meshStandardMaterial color={mat} metalness={.86} roughness={.34}/></mesh>
    <mesh position={[0,5,0]}><boxGeometry args={[12,.24,.32]}/><meshStandardMaterial color={mat} metalness={.86} roughness={.34}/></mesh>
    <mesh position={[0,-5,0]}><boxGeometry args={[12,.24,.32]}/><meshStandardMaterial color={mat} metalness={.86} roughness={.34}/></mesh>
    <mesh position={[-5.76,3.75,.21]}><boxGeometry args={[.06,1.1,.04]}/><meshBasicMaterial color={index%4===0?"#ffb457":"#93afbd"} transparent opacity={.7}/></mesh>
    <mesh position={[5.76,-3.75,.21]}><boxGeometry args={[.06,1.1,.04]}/><meshBasicMaterial color={index%4===0?"#ffb457":"#93afbd"} transparent opacity={.55}/></mesh>
  </group>;
}

function FloorRails(){
  return <group>
    <mesh position={[-3.2,-4.62,-38]} rotation={[-Math.PI/2,0,0]}><boxGeometry args={[.15,90,.08]}/><meshStandardMaterial color="#566168" metalness={.9} roughness={.28}/></mesh>
    <mesh position={[3.2,-4.62,-38]} rotation={[-Math.PI/2,0,0]}><boxGeometry args={[.15,90,.08]}/><meshStandardMaterial color="#566168" metalness={.9} roughness={.28}/></mesh>
    {Array.from({length:22}).map((_,i)=><mesh key={i} position={[0,-4.55,8-i*4]}><boxGeometry args={[6.6,.055,.12]}/><meshBasicMaterial color={i%5===0?"#ffb457":"#4d565b"} transparent opacity={i%5===0?.7:.35}/></mesh>)}
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
    if(!group.current)return;
    group.current.children.forEach((child,i)=>{
      const t=(state.clock.elapsedTime*.032+i/group.current!.children.length)%1;
      child.position.copy(curve.getPointAt(t));
    });
  });
  return <group>
    <Line points={linePoints} color="#ffb457" transparent opacity={.34} lineWidth={1}/>
    <group ref={group}>{Array.from({length:10}).map((_,i)=><mesh key={i}><sphereGeometry args={[.06,10,10]}/><meshBasicMaterial color={i%3===0?"#93afbd":"#ffd09a"} toneMapped={false}/></mesh>)}</group>
  </group>;
}

function MemoryAssembly(){
  return <group position={[0,0,-20]}>
    {Array.from({length:18}).map((_,i)=>{
      const a=i/18*Math.PI*2; const r=2.3+(i%4)*.46;
      return <mesh key={i} position={[Math.cos(a)*r,Math.sin(a)*1.55,Math.sin(a)*r*.25]} rotation={[a*.15,a,0]}>
        <boxGeometry args={[.22,.72,.15]}/><meshPhysicalMaterial color="#d7d4c8" transparent opacity={.3} roughness={.2} transmission={.48} thickness={.4}/>
      </mesh>;
    })}
    <mesh><torusGeometry args={[3.8,.08,10,72]}/><meshStandardMaterial color="#59636a" metalness={.9} roughness={.3}/></mesh>
    <mesh rotation={[0,0,Math.PI/2]}><torusGeometry args={[2.7,.035,8,64]}/><meshBasicMaterial color="#93afbd" transparent opacity={.35}/></mesh>
  </group>;
}

function AgentHall(){
  return <group position={[0,0,-34]}>
    {[-3,0,3].map((x,i)=><group key={x} position={[x,0,0]}>
      <mesh><boxGeometry args={[2.1,4.2,1.4]}/><meshStandardMaterial color={i===1?"#dedbd0":"#31383d"} metalness={.76} roughness={.31}/></mesh>
      <mesh position={[0,0,.72]}><boxGeometry args={[1.25,2.2,.06]}/><meshBasicMaterial color={i===1?"#ffb457":"#93afbd"} transparent opacity={.42}/></mesh>
      <mesh position={[0,-1.65,.76]}><boxGeometry args={[1.3,.08,.03]}/><meshBasicMaterial color="#ffb457" transparent opacity={i===1?.85:.32}/></mesh>
    </group>)}
    <Line points={[[-4,-2,1],[-1,-1,1],[1,1,1],[4,2,1]]} color="#ffb457" lineWidth={1}/>
  </group>;
}

function ReliabilityCore(){
  return <group position={[0,0,-49]}>
    {[-3.6,-1.8,0,1.8,3.6].map((x,i)=><group key={x} position={[x,0,0]}>
      <mesh><boxGeometry args={[1.2,5.2,.55]}/><meshStandardMaterial color="#242b2f" metalness={.8} roughness={.34}/></mesh>
      <mesh position={[0,1.55,.31]}><boxGeometry args={[.78,.12,.04]}/><meshBasicMaterial color={i<4?"#87a88b":"#b65a42"} toneMapped={false}/></mesh>
      {Array.from({length:4}).map((_,j)=><mesh key={j} position={[0,-1.5+j*.65,.31]}><boxGeometry args={[.58,.035,.02]}/><meshBasicMaterial color="#6f7a7f" transparent opacity={.45}/></mesh>)}
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

function SynthesisCore({progress}:{progress:number}){
  const outer=useRef<THREE.Mesh>(null); const middle=useRef<THREE.Mesh>(null); const inner=useRef<THREE.Mesh>(null);
  useFrame((state,d)=>{
    const active=THREE.MathUtils.smoothstep(progress,.76,.96);
    if(outer.current)outer.current.rotation.z+=d*(.05+active*.16);
    if(middle.current)middle.current.rotation.z-=d*(.07+active*.2);
    if(inner.current){inner.current.rotation.x+=d*(.025+active*.08);inner.current.rotation.y+=d*(.04+active*.1);const s=1+Math.sin(state.clock.elapsedTime*1.4)*.025*active;inner.current.scale.setScalar(s);}
  });
  return <group position={[0,1,-74]}>
    <mesh ref={outer} rotation={[Math.PI/2,0,0]}><torusGeometry args={[4.1,.18,16,96]}/><meshStandardMaterial color="#d8d4c8" metalness={.9} roughness={.18}/></mesh>
    <mesh ref={middle} rotation={[Math.PI/2,0,0]}><torusGeometry args={[3.35,.085,12,96]}/><meshBasicMaterial color="#93afbd" transparent opacity={.34}/></mesh>
    <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[2.6,.06,10,96]}/><meshBasicMaterial color="#ffb457" transparent opacity={.82} toneMapped={false}/></mesh>
    <mesh ref={inner}><icosahedronGeometry args={[1.25,1]}/><meshPhysicalMaterial color="#e8e5db" metalness={.28} roughness={.16} transmission={.18}/></mesh>
    <pointLight color="#ffb457" intensity={18} distance={13}/>
  </group>;
}

function MachineWorld({progress}:{progress:number}){
  return <group>
    <ambientLight intensity={.3}/>
    <directionalLight position={[5,8,10]} intensity={1.3} color="#f2eee3"/>
    <pointLight position={[0,2,-34]} intensity={16} distance={18} color="#ffb457"/>
    <pointLight position={[-2,3,-68]} intensity={12} distance={20} color="#93afbd"/>
    <AccessGate progress={progress}/>
    {Array.from({length:18}).map((_,i)=><Frame key={i} index={i} z={8-i*5.2} scale={1-(i*.006)}/>)}
    <mesh position={[0,-4.8,-38]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[13,92]}/><meshStandardMaterial color="#171b1e" roughness={.7} metalness={.38}/></mesh>
    <FloorRails/><MemoryAssembly/><AgentHall/><ReliabilityCore/><RevisionRail/><SynthesisCore progress={progress}/><SignalFlow/>
  </group>;
}

export function WorldCanvas({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  return <div className="world-canvas" aria-hidden="true">
    <Canvas dpr={[1,1.55]} camera={{position:[0,1.7,15],fov:40,near:.1,far:150}} gl={{antialias:true,powerPreference:"high-performance"}}>
      <color attach="background" args={["#0e1012"]}/>
      <fog attach="fog" args={["#111315",12,48]}/>
      <CameraRig progress={progress} reducedMotion={reducedMotion}/>
      <MachineWorld progress={progress}/>
    </Canvas>
  </div>;
}
