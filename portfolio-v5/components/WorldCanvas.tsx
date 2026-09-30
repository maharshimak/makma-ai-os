"use client";

import {AdaptiveDpr,Line,Sparkles} from "@react-three/drei";
import {Canvas,useFrame} from "@react-three/fiber";
import {Bloom,EffectComposer} from "@react-three/postprocessing";
import {useMemo,useRef} from "react";
import * as THREE from "three";

const CAMERA_POINTS=[
  new THREE.Vector3(0,1.7,15),
  new THREE.Vector3(0,1.55,8),
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

const graphite=new THREE.Color("#20272b");
const ivory=new THREE.Color("#d9d6cb");
const amber=new THREE.Color("#ff9d38");
const cyan=new THREE.Color("#6fb9d1");

function CameraRig({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(CAMERA_POINTS,false,"catmullrom",.32),[]);
  const targetCurve=useMemo(()=>new THREE.CatmullRomCurve3(TARGET_POINTS,false,"catmullrom",.28),[]);
  const target=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((state,delta)=>{
    const t=THREE.MathUtils.clamp(progress,0,1);
    const wanted=curve.getPointAt(t);
    const wantedTarget=targetCurve.getPointAt(t);
    const px=reducedMotion?0:state.pointer.x*.18;
    const py=reducedMotion?0:state.pointer.y*.1;
    wanted.x+=px;
    wanted.y+=py;
    state.camera.position.lerp(wanted,1-Math.exp(-delta*(reducedMotion?12:4.5)));
    target.lerp(wantedTarget,1-Math.exp(-delta*5));
    state.camera.lookAt(target);
    if(!reducedMotion){
      state.camera.rotation.z=THREE.MathUtils.lerp(state.camera.rotation.z,(state.pointer.x*.004)+(Math.sin(t*Math.PI*2)*.003),.04);
    }
  });
  return null;
}

function NebulaBackdrop(){
  const mat=useRef<THREE.ShaderMaterial>(null);
  useFrame(({clock})=>{if(mat.current) mat.current.uniforms.uTime.value=clock.elapsedTime;});
  const uniforms=useMemo(()=>({uTime:{value:0}}),[]);
  return <mesh position={[0,4,-118]} scale={[1.35,1,1]}>
    <planeGeometry args={[190,105,1,1]}/>
    <shaderMaterial ref={mat} uniforms={uniforms} depthWrite={false} toneMapped={false}
      vertexShader={`
        varying vec2 vUv;
        void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
      `}
      fragmentShader={`
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){
          vec2 i=floor(p),f=fract(p);
          f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
        }
        float fbm(vec2 p){
          float v=0.0,a=.5;
          mat2 r=mat2(.86,.5,-.5,.86);
          for(int i=0;i<6;i++){v+=a*noise(p);p=r*p*2.03+2.1;a*=.52;}
          return v;
        }
        void main(){
          vec2 uv=vUv;
          vec2 p=(uv-.5)*vec2(2.05,1.12);
          float drift=uTime*.006;
          float a=fbm(p*2.0+vec2(drift,-drift*.35));
          float b=fbm(p*4.3+vec2(4.2,-1.7)-vec2(drift*.6,0.));
          float c=fbm(p*7.8+vec2(-2.0,3.0));
          float warmMask=smoothstep(.28,.9,a*.8+b*.5)*smoothstep(.28,1.0,uv.x+.12);
          float coolMask=smoothstep(.24,.88,b*.7+c*.42)*smoothstep(.22,.88,1.08-uv.x);
          vec3 base=mix(vec3(.005,.009,.012),vec3(.016,.024,.03),a);
          vec3 warm=vec3(1.15,.27,.035)*pow(warmMask,2.25)*.72;
          vec3 cool=vec3(.025,.24,.39)*pow(coolMask,2.0)*.65;
          float starSeed=hash(floor(uv*vec2(940.,530.)));
          float star=step(.9975,starSeed)*(0.45+hash(uv*1200.)*.8);
          float vignette=smoothstep(1.05,.25,length((uv-.5)*vec2(1.12,.86)));
          vec3 color=(base+warm+cool)*(.45+.75*vignette)+vec3(star);
          gl_FragColor=vec4(color,1.);
        }
      `}
    />
  </mesh>;
}

function Aperture({progress}:{progress:number}){
  const blades=useRef<THREE.Group>(null);
  const ring=useRef<THREE.Group>(null);
  useFrame((_,delta)=>{
    const open=THREE.MathUtils.smoothstep(progress,0.005,.115);
    if(blades.current){
      blades.current.children.forEach((child,i)=>{
        const a=(i/10)*Math.PI*2;
        const r=1.95+open*4.1;
        child.position.x=THREE.MathUtils.lerp(child.position.x,Math.cos(a)*r,1-Math.exp(-delta*6));
        child.position.y=THREE.MathUtils.lerp(child.position.y,Math.sin(a)*r,1-Math.exp(-delta*6));
        child.rotation.z=a+open*.28;
      });
    }
    if(ring.current) ring.current.rotation.z+=delta*.035;
  });
  return <group position={[0,1,7.1]}>
    <group ref={ring}>
      <mesh><torusGeometry args={[4.7,.16,12,96]}/><meshStandardMaterial color="#41494d" metalness={.95} roughness={.23}/></mesh>
      <mesh><torusGeometry args={[4.34,.025,8,96]}/><meshBasicMaterial color="#ff9d38" toneMapped={false}/></mesh>
    </group>
    <group ref={blades}>
      {Array.from({length:10}).map((_,i)=>{
        const a=(i/10)*Math.PI*2;
        return <mesh key={i} position={[Math.cos(a)*1.95,Math.sin(a)*1.95,0]} rotation={[0,0,a]}>
          <boxGeometry args={[3.2,1.05,.36]}/>
          <meshStandardMaterial color={i%2?"#30373b":"#d4d0c5"} metalness={.86} roughness={.28}/>
        </mesh>;
      })}
    </group>
    <pointLight intensity={8} distance={16} color="#ff9d38"/>
  </group>;
}

function Frame({z,scale=1,index=0}:{z:number;scale?:number;index?:number}){
  return <group position={[0,0,z]} scale={scale}>
    {[-6,6].map((x,k)=><group key={x} position={[x,0,0]}>
      <mesh><boxGeometry args={[.26,10,.42]}/><meshStandardMaterial color="#252c30" metalness={.88} roughness={.33}/></mesh>
      {Array.from({length:5}).map((_,i)=><mesh key={i} position={[k===0?.16:-.16,-3.6+i*1.8,.24]}>
        <boxGeometry args={[.045,.62,.045]}/><meshBasicMaterial color={(i+index)%4===0?"#ff9d38":"#6f8490"} transparent opacity={(i+index)%4===0?.95:.24} toneMapped={false}/>
      </mesh>)}
    </group>)}
    {[-5,5].map((y)=><mesh key={y} position={[0,y,0]}><boxGeometry args={[12,.25,.42]}/><meshStandardMaterial color="#252c30" metalness={.88} roughness={.33}/></mesh>)}
    <mesh position={[0,-4.76,.25]}><boxGeometry args={[4,.06,.04]}/><meshBasicMaterial color={index%3===0?"#ff9d38":"#52646c"} transparent opacity={index%3===0?.5:.18} toneMapped={false}/></mesh>
  </group>;
}

function SignalFlow(){
  const group=useRef<THREE.Group>(null);
  const curve=useMemo(()=>new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4,1,5),new THREE.Vector3(2,2,-6),new THREE.Vector3(-3,-2,-17),
    new THREE.Vector3(3,1,-32),new THREE.Vector3(-2,2,-48),new THREE.Vector3(0,3,-67),new THREE.Vector3(0,1,-84)
  ]),[]);
  const linePoints=useMemo(()=>curve.getPoints(220),[curve]);
  useFrame((state)=>{
    if(!group.current) return;
    group.current.children.forEach((child,i)=>{
      const t=(state.clock.elapsedTime*.045+i/group.current!.children.length)%1;
      child.position.copy(curve.getPointAt(t));
      const pulse=.07+Math.sin(state.clock.elapsedTime*4+i)*.018;
      child.scale.setScalar(pulse/.07);
    });
  });
  return <group>
    <Line points={linePoints} color="#ff9d38" transparent opacity={.34} lineWidth={1}/>
    <Line points={linePoints.map(p=>p.clone().add(new THREE.Vector3(.05,.03,.02)))} color="#ffd09a" transparent opacity={.13} lineWidth={.45}/>
    <group ref={group}>{Array.from({length:13}).map((_,i)=><mesh key={i}><sphereGeometry args={[.075,10,10]}/><meshBasicMaterial color={i%4===0?"#8dd8ef":"#ffd09a"} toneMapped={false}/></mesh>)}</group>
  </group>;
}

function InspectionArm({progress}:{progress:number}){
  const ref=useRef<THREE.Group>(null);
  useFrame((state,delta)=>{
    if(!ref.current) return;
    const local=THREE.MathUtils.clamp((progress-.08)/.16,0,1);
    ref.current.position.x=THREE.MathUtils.lerp(ref.current.position.x,-7+local*14,1-Math.exp(-delta*4));
    ref.current.rotation.z=Math.sin(state.clock.elapsedTime*.35)*.025;
  });
  return <group ref={ref} position={[-7,2.8,1.5]}>
    <mesh><boxGeometry args={[.5,4.8,.55]}/><meshStandardMaterial color="#30373b" metalness={.9} roughness={.25}/></mesh>
    <mesh position={[0,-2.35,.35]}><boxGeometry args={[3.6,.16,.15]}/><meshBasicMaterial color="#ffad54" transparent opacity={.85} toneMapped={false}/></mesh>
    <spotLight position={[0,-2.3,.8]} target-position={[0,-5,-3]} angle={.28} penumbra={.78} distance={16} intensity={9} color="#ffb457"/>
  </group>;
}

function MemoryAssembly(){
  const ref=useRef<THREE.Group>(null);
  useFrame((state,delta)=>{
    if(ref.current){
      ref.current.rotation.z+=delta*.035;
      ref.current.children.forEach((c,i)=>{if(c.type==="Mesh"&&i<14)c.position.z=Math.sin(state.clock.elapsedTime*.65+i)*.24;});
    }
  });
  return <group ref={ref} position={[0,0,-20]}>
    {Array.from({length:14}).map((_,i)=>{
      const a=i/14*Math.PI*2;
      const r=2.4+(i%3)*.55;
      return <mesh key={i} position={[Math.cos(a)*r,Math.sin(a)*1.5,0]} rotation={[a*.15,a,0]}>
        <boxGeometry args={[.28,.86,.2]}/>
        <meshPhysicalMaterial color={i%4===0?"#ffd9aa":"#d7d4c8"} transparent opacity={.38} roughness={.16} transmission={.38} thickness={.5} emissive={i%4===0?amber:new THREE.Color("#000000")} emissiveIntensity={i%4===0?.35:0}/>
      </mesh>;
    })}
    <mesh><torusGeometry args={[3.8,.1,10,72]}/><meshStandardMaterial color="#59636a" metalness={.92} roughness={.25}/></mesh>
    <mesh><torusGeometry args={[3.25,.025,8,72]}/><meshBasicMaterial color="#6fb9d1" transparent opacity={.42} toneMapped={false}/></mesh>
    <pointLight intensity={8} distance={13} color="#6fb9d1"/>
  </group>;
}

function AgentHall(){
  const center=useRef<THREE.Group>(null);
  useFrame((state)=>{
    if(center.current){
      const s=1+Math.sin(state.clock.elapsedTime*1.1)*.018;
      center.current.scale.setScalar(s);
    }
  });
  return <group position={[0,0,-34]}>
    {[-3,0,3].map((x,i)=><group key={x} position={[x,0,0]} ref={i===1?center:undefined}>
      <mesh><boxGeometry args={[2.1,4.2,1.4]}/><meshStandardMaterial color={i===1?"#d6d1c6":"#2c3337"} metalness={.8} roughness={.28}/></mesh>
      <mesh position={[0,0,.72]}><boxGeometry args={[1.25,2.2,.065]}/><meshBasicMaterial color={i===1?"#ff9d38":"#6fb9d1"} transparent opacity={i===1?.62:.28} toneMapped={false}/></mesh>
      <mesh position={[0,-1.65,.76]}><boxGeometry args={[.72,.08,.05]}/><meshBasicMaterial color="#e8e5db" transparent opacity={.5}/></mesh>
    </group>)}
    <Line points={[[-4,-2,1],[-1,-1,1],[1,1,1],[4,2,1]]} color="#ff9d38" lineWidth={1.15}/>
    <pointLight position={[0,0,2]} intensity={11} distance={12} color="#ff9d38"/>
  </group>;
}

function ReliabilityCore(){
  const scan=useRef<THREE.Mesh>(null);
  useFrame((state)=>{
    if(scan.current) scan.current.position.x=Math.sin(state.clock.elapsedTime*.7)*4.2;
  });
  return <group position={[0,0,-49]}>
    {[-3.6,-1.8,0,1.8,3.6].map((x,i)=><group key={x} position={[x,0,0]}>
      <mesh><boxGeometry args={[1.2,5.2,.62]}/><meshStandardMaterial color="#22292d" metalness={.82} roughness={.3}/></mesh>
      {Array.from({length:5}).map((_,j)=><mesh key={j} position={[0,1.5-j*.7,.34]}><boxGeometry args={[.78,.055,.035]}/><meshBasicMaterial color={j<4?"#87a88b":"#b65a42"} transparent opacity={j<4?.5:.7} toneMapped={false}/></mesh>)}
    </group>)}
    <mesh ref={scan} position={[0,0,.48]}><boxGeometry args={[.09,5.7,.035]}/><meshBasicMaterial color="#ffca82" transparent opacity={.65} toneMapped={false}/></mesh>
    <pointLight position={[0,0,2]} intensity={6} distance={11} color="#87a88b"/>
  </group>;
}

function RevisionRail(){
  const carriage=useRef<THREE.Group>(null);
  useFrame((state)=>{if(carriage.current) carriage.current.position.x=Math.sin(state.clock.elapsedTime*.22)*3.8;});
  return <group position={[0,0,-61]}>
    <mesh position={[0,-2.3,0]}><boxGeometry args={[11,.18,.35]}/><meshStandardMaterial color="#677177" metalness={.9} roughness={.25}/></mesh>
    {Array.from({length:7}).map((_,i)=><group key={i} position={[-4.5+i*1.5,-1.55,0]}>
      <mesh><boxGeometry args={[.95,1.35,.12]}/><meshStandardMaterial color={i>4?"#e4e1d6":"#343b40"} metalness={.65} roughness={.35}/></mesh>
      <mesh position={[0,.25,.08]}><boxGeometry args={[.55,.04,.02]}/><meshBasicMaterial color="#ff9d38" transparent opacity={.55}/></mesh>
    </group>)}
    <group ref={carriage} position={[0,-2.05,.3]}>
      <mesh><boxGeometry args={[1.3,.46,.5]}/><meshStandardMaterial color="#d8d4c8" metalness={.78} roughness={.23}/></mesh>
      <mesh position={[0,.24,.28]}><boxGeometry args={[.72,.04,.03]}/><meshBasicMaterial color="#ff9d38" toneMapped={false}/></mesh>
    </group>
  </group>;
}

function SynthesisCore(){
  const outer=useRef<THREE.Mesh>(null);
  const inner=useRef<THREE.Mesh>(null);
  const core=useRef<THREE.Mesh>(null);
  useFrame((state,d)=>{
    if(outer.current) outer.current.rotation.z+=d*.12;
    if(inner.current) inner.current.rotation.z-=d*.21;
    if(core.current){
      const s=1+Math.sin(state.clock.elapsedTime*1.5)*.06;
      core.current.scale.setScalar(s);
    }
  });
  return <group position={[0,1,-74]}>
    <mesh ref={outer} rotation={[Math.PI/2,0,0]}><torusGeometry args={[4.15,.22,18,120]}/><meshStandardMaterial color="#c9c6bb" metalness={.95} roughness={.16}/></mesh>
    <mesh ref={inner} rotation={[Math.PI/2,0,0]}><torusGeometry args={[3.35,.105,12,110]}/><meshStandardMaterial color="#424b50" metalness={.92} roughness={.2} emissive={amber} emissiveIntensity={.16}/></mesh>
    <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[2.6,.055,10,100]}/><meshBasicMaterial color="#ff9d38" transparent opacity={.92} toneMapped={false}/></mesh>
    {Array.from({length:8}).map((_,i)=>{
      const a=i/8*Math.PI*2;
      return <mesh key={i} position={[Math.cos(a)*3.75,Math.sin(a)*3.75,0]} rotation={[0,0,a]}><boxGeometry args={[.76,.22,.36]}/><meshStandardMaterial color={i%2?"#3c4448":"#b8b5aa"} metalness={.88} roughness={.24}/></mesh>;
    })}
    <mesh ref={core}><icosahedronGeometry args={[1.32,2]}/><meshPhysicalMaterial color="#ffd6a0" emissive={amber} emissiveIntensity={1.8} roughness={.18} metalness={.1} transmission={.12} toneMapped={false}/></mesh>
    <pointLight intensity={30} distance={22} color="#ff8a23"/>
    <pointLight position={[0,0,4]} intensity={9} distance={16} color="#8dd8ef"/>
  </group>;
}

function MachineWorld({progress}:{progress:number}){
  return <group>
    <NebulaBackdrop/>
    <ambientLight intensity={.24}/>
    <directionalLight position={[5,8,10]} intensity={1.65} color="#f2eee3"/>
    <pointLight position={[0,2,-34]} intensity={14} distance={18} color="#ff9d38"/>
    <pointLight position={[-2,3,-68]} intensity={9} distance={20} color="#6fb9d1"/>
    <Sparkles count={900} scale={[14,10,96]} size={1.25} speed={.12} opacity={.32} color="#d9e7eb"/>
    <Sparkles count={180} scale={[11,8,78]} size={2.1} speed={.2} opacity={.42} color="#ffae55"/>
    <Aperture progress={progress}/>
    <InspectionArm progress={progress}/>
    {Array.from({length:18}).map((_,i)=><Frame key={i} index={i} z={8-i*5.2} scale={1-(i*.006)}/>)}
    <mesh position={[0,-4.8,-38]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[13,92]}/><meshStandardMaterial color="#14191c" roughness={.66} metalness={.42}/></mesh>
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
    <Canvas dpr={[.85,1.55]} camera={{position:[0,1.7,15],fov:40,near:.1,far:170}} gl={{antialias:true,powerPreference:"high-performance",toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.02}}>
      <color attach="background" args={["#080b0d"]}/>
      <fog attach="fog" args={["#11171a",15,58]}/>
      <AdaptiveDpr pixelated/>
      <CameraRig progress={progress} reducedMotion={reducedMotion}/>
      <MachineWorld progress={progress}/>
      {!reducedMotion&&<EffectComposer multisampling={0}><Bloom intensity={.72} luminanceThreshold={.62} luminanceSmoothing={.28} mipmapBlur/></EffectComposer>}
    </Canvas>
  </div>;
}
