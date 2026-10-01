"use client";

import {AdaptiveDpr,Line,PerformanceMonitor,Sparkles,Stars,useGLTF,useTexture} from "@react-three/drei";
import {Canvas,useFrame} from "@react-three/fiber";
import {Bloom,EffectComposer,SMAA,Vignette} from "@react-three/postprocessing";
import {Suspense,useEffect,useMemo,useRef,useState} from "react";
import * as THREE from "three";

const WEBB="https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2022/10/STScI-01GFRYYRTCTMX197BY86MBFCR9.png?crop=faces%2Cfocalpoint&fit=clip&h=2160&w=3840";
const EUROPA="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/jupiter---europa/preview.webp?w=4096";
const JUPITER="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/jupiter/preview.webp?w=4096";
const MARS="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/mars/preview.webp?w=4096";
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
    if(!reducedMotion){wanted.x+=state.pointer.x*.18;wanted.y+=state.pointer.y*.1;}
    state.camera.position.lerp(wanted,1-Math.exp(-delta*(reducedMotion?10:3.8)));
    target.lerp(look,1-Math.exp(-delta*4.2));
    state.camera.lookAt(target);
    if(!reducedMotion)state.camera.rotation.z=THREE.MathUtils.lerp(state.camera.rotation.z,(state.pointer.x*.0035)+(Math.sin(t*Math.PI*2)*.0028),.035);
  });
  return null;
}

function makeFlareTexture(){
  const size=256;
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const dx=(x+.5-size/2)/(size/2);
      const dy=(y+.5-size/2)/(size/2);
      const d=Math.min(1,Math.sqrt(dx*dx+dy*dy));
      const core=Math.exp(-d*d*52);
      const halo=Math.exp(-d*d*8.5);
      const blue=Math.exp(-d*d*3.2);
      const i=(y*size+x)*4;
      data[i]=Math.min(255,Math.round(255*core+235*halo));
      data[i+1]=Math.min(255,Math.round(244*core+190*halo+120*blue));
      data[i+2]=Math.min(255,Math.round(218*core+150*halo+220*blue));
      data[i+3]=Math.min(255,Math.round(255*(core*.95+halo*.34+blue*.08)));
    }
  }
  const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  tex.needsUpdate=true;
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.minFilter=THREE.LinearFilter;
  tex.magFilter=THREE.LinearFilter;
  return tex;
}

function DeepField({reducedMotion}:{reducedMotion:boolean}){
  const texture=useTexture(WEBB);
  const group=useRef<THREE.Group>(null);
  useMemo(()=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=8;
    texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.magFilter=THREE.LinearFilter;
  },[texture]);
  useFrame(({clock})=>{
    if(!group.current||reducedMotion)return;
    group.current.rotation.z=Math.sin(clock.elapsedTime*.025)*.0025;
    group.current.position.x=Math.sin(clock.elapsedTime*.018)*.18;
  });
  return <group ref={group}>
    <mesh position={[0,3,-75]} scale={[1.34,1,1]}>
      <planeGeometry args={[98,84]}/>
      <meshBasicMaterial map={texture} toneMapped={false}/>
    </mesh>
    <mesh position={[0,3,-74.7]}>
      <planeGeometry args={[100,86]}/>
      <meshBasicMaterial color="#0b151d" transparent opacity={.1} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
    </mesh>
  </group>;
}

function AtmosphereGlow({radius,color,intensity=.55}:{radius:number;color:string;intensity?:number}){
  const material=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color(color)},uIntensity:{value:intensity}},
    vertexShader:"varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mvPosition=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mvPosition.xyz); gl_Position=projectionMatrix*mvPosition; }",
    fragmentShader:"uniform vec3 uColor; uniform float uIntensity; varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),3.1); float outer=smoothstep(.05,.82,rim); gl_FragColor=vec4(uColor,outer*uIntensity); }",
    transparent:true,
    side:THREE.BackSide,
    blending:THREE.AdditiveBlending,
    depthWrite:false,
    toneMapped:false
  }),[color,intensity]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <mesh scale={1.075}>
    <sphereGeometry args={[radius,96,96]}/>
    <primitive object={material} attach="material"/>
  </mesh>;
}

function OrbitMarker({radius,speed,offset,color}:{radius:number;speed:number;offset:number;color:string}){
  const ref=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!ref.current)return;
    const a=clock.elapsedTime*speed+offset;
    ref.current.position.set(Math.cos(a)*radius,0,Math.sin(a)*radius);
  });
  return <group ref={ref}>
    <mesh><sphereGeometry args={[.035,10,10]}/><meshBasicMaterial color={color} toneMapped={false}/></mesh>
    <mesh scale={2.8}><sphereGeometry args={[.035,8,8]}/><meshBasicMaterial color={color} transparent opacity={.12} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
  </group>;
}

function OrbitalSystem({radius,color,quality}:{radius:number;color:string;quality:"high"|"medium"|"low"}){
  const rings=useMemo(()=>[
    {r:radius*1.42,rotation:[Math.PI/2,0,0] as [number,number,number],opacity:.22},
    {r:radius*1.68,rotation:[Math.PI/2+.23,.12,.16] as [number,number,number],opacity:.13},
    {r:radius*1.92,rotation:[Math.PI/2-.18,-.2,.08] as [number,number,number],opacity:.085}
  ],[radius]);
  return <group>
    {rings.map((ring,index)=>{
      const pts=Array.from({length:129},(_,i)=>{const a=(i/128)*Math.PI*2;return new THREE.Vector3(Math.cos(a)*ring.r,0,Math.sin(a)*ring.r);});
      return <group key={index} rotation={ring.rotation}>
        <Line points={pts} color={color} transparent opacity={ring.opacity} lineWidth={index===0?.72:.42} dashed={index>0} dashSize={.16} gapSize={.13}/>
        {quality!=="low"&&index<2&&<>
          <OrbitMarker radius={ring.r} speed={index?-.12:.16} offset={index*2.15} color={color}/>
          <OrbitMarker radius={ring.r} speed={index?-.095:.12} offset={2.9+index} color="#f6e6d3"/>
        </>}
      </group>;
    })}
    {quality==="high"&&<Sparkles count={32} scale={[radius*4.3,.28,radius*4.3]} size={.65} speed={.06} opacity={.18} color={color}/>}
  </group>;
}

function World({textureUrl,position,radius,tilt=0,speed=.035,atmosphere,guideColor,bumpScale=.025,roughness=.76,quality}:{textureUrl:string;position:[number,number,number];radius:number;tilt?:number;speed?:number;atmosphere:string;guideColor:string;bumpScale?:number;roughness?:number;quality:"high"|"medium"|"low"}){
  const map=useTexture(textureUrl);
  const planet=useRef<THREE.Mesh>(null);
  const segments=quality==="high"?128:quality==="medium"?96:64;
  useMemo(()=>{
    map.colorSpace=THREE.SRGBColorSpace;
    map.anisotropy=quality==="high"?12:quality==="medium"?8:4;
    map.minFilter=THREE.LinearMipmapLinearFilter;
    map.magFilter=THREE.LinearFilter;
    map.generateMipmaps=true;
  },[map,quality]);
  useFrame((_,delta)=>{if(planet.current)planet.current.rotation.y+=delta*speed;});
  return <group position={position} rotation={[0,0,tilt]}>
    <OrbitalSystem radius={radius} color={guideColor} quality={quality}/>
    <mesh ref={planet}>
      <sphereGeometry args={[radius,segments,segments]}/>
      <meshPhysicalMaterial map={map} bumpMap={map} bumpScale={bumpScale} roughness={roughness} metalness={0} clearcoat={.06} clearcoatRoughness={.72}/>
    </mesh>
    <AtmosphereGlow radius={radius} color={atmosphere} intensity={quality==="low"?.32:.52}/>
  </group>;
}

function FlightPath({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(trajectoryPoints,false,"catmullrom",.42),[]);
  const points=useMemo(()=>curve.getPoints(220),[curve]);
  const beacon=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!beacon.current)return;
    const drift=reducedMotion?0:(clock.elapsedTime*.018)%1;
    const t=THREE.MathUtils.clamp(progress*.78+drift*.22,0,1);
    beacon.current.position.copy(curve.getPointAt(t));
  });
  return <group>
    <Line points={points} color="#a8c5cf" transparent opacity={.19} lineWidth={.68}/>
    <Line points={points.map(point=>point.clone().add(new THREE.Vector3(.02,.02,.02)))} color="#d7a16e" transparent opacity={.1} lineWidth={.34} dashed dashSize={.2} gapSize={.14}/>
    <group ref={beacon}>
      <mesh><sphereGeometry args={[.07,16,16]}/><meshBasicMaterial color="#fff0d8" toneMapped={false}/></mesh>
      <mesh scale={3.6}><sphereGeometry args={[.07,12,12]}/><meshBasicMaterial color="#d8a77d" transparent opacity={.11} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/></mesh>
      <pointLight intensity={3.4} distance={3.2} color="#e1b07f"/>
    </group>
  </group>;
}

function ThrusterPlume(){
  const plume=useRef<THREE.Group>(null);
  useFrame(({clock})=>{if(plume.current)plume.current.scale.y=.9+Math.sin(clock.elapsedTime*11)*.06;});
  return <group ref={plume} position={[0,-1.25,0]}>
    <mesh position={[0,-.52,0]} rotation={[0,0,Math.PI]}>
      <coneGeometry args={[.12,1.25,20,1,true]}/>
      <meshBasicMaterial color="#8ed4ff" transparent opacity={.22} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false}/>
    </mesh>
    <mesh position={[0,-.82,0]} rotation={[0,0,Math.PI]}>
      <coneGeometry args={[.2,1.85,20,1,true]}/>
      <meshBasicMaterial color="#397dcc" transparent opacity={.065} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false}/>
    </mesh>
    <pointLight position={[0,-.2,0]} intensity={4} distance={3.2} color="#75bcff"/>
  </group>;
}

function Surveyor({progress,reducedMotion,quality}:{progress:number;reducedMotion:boolean;quality:"high"|"medium"|"low"}){
  const {scene}=useGLTF(SURVEYOR);
  const flareTexture=useMemo(()=>makeFlareTexture(),[]);
  const craft=useMemo(()=>{
    const clone=scene.clone(true);
    const initial=new THREE.Box3().setFromObject(clone);
    const size=initial.getSize(new THREE.Vector3());
    const largest=Math.max(size.x,size.y,size.z)||1;
    clone.scale.multiplyScalar(2.55/largest);
    const box=new THREE.Box3().setFromObject(clone);
    const center=box.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    clone.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;
      object.castShadow=false;object.receiveShadow=false;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      materials.forEach(material=>{
        if(material instanceof THREE.MeshStandardMaterial){
          material.envMapIntensity=.72;
          material.roughness=Math.max(.28,material.roughness*.82);
          material.metalness=Math.min(1,material.metalness+.08);
          if(material.map){material.map.anisotropy=quality==="high"?12:6;material.map.minFilter=THREE.LinearMipmapLinearFilter;}
        }
      });
    });
    return clone;
  },[scene,quality]);
  const group=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!group.current)return;
    const t=clock.elapsedTime;
    const travel=Math.min(1,Math.max(0,(progress-.18)/.66));
    group.current.position.set(THREE.MathUtils.lerp(3.25,-1.5,travel),2.15+Math.sin(t*.22)*.16,THREE.MathUtils.lerp(-9,-43,travel));
    if(!reducedMotion){group.current.rotation.y=t*.11+travel*1.8;group.current.rotation.z=-.16+Math.sin(t*.18)*.05;}
  });
  useEffect(()=>()=>flareTexture.dispose(),[flareTexture]);
  return <group ref={group} position={[3.25,2.15,-9]} scale={.92}>
    <primitive object={craft}/>
    <ThrusterPlume/>
    {quality!=="low"&&<sprite position={[.75,.6,.25]} scale={[1.05,1.05,1]}>
      <spriteMaterial map={flareTexture} color="#ffd3a0" transparent opacity={.34} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
    </sprite>}
    <pointLight position={[.5,.6,1]} intensity={2.2} distance={3.2} color="#d9a16c"/>
  </group>;
}

function ReactiveLighting({progress}:{progress:number}){
  const key=useRef<THREE.DirectionalLight>(null);
  const rim=useRef<THREE.DirectionalLight>(null);
  const fill=useRef<THREE.DirectionalLight>(null);
  const warm=useMemo(()=>new THREE.Color("#fff0db"),[]);
  const cool=useMemo(()=>new THREE.Color("#a8c2ca"),[]);
  useFrame((_,delta)=>{
    const p=THREE.MathUtils.clamp(progress,0,1);
    if(key.current){
      key.current.intensity=THREE.MathUtils.damp(key.current.intensity,2.15+Math.sin(p*Math.PI)*.8,2.5,delta);
      key.current.color.lerp(p>.62?cool:warm,1-Math.exp(-delta*1.8));
    }
    if(rim.current)rim.current.intensity=THREE.MathUtils.damp(rim.current.intensity,.62+p*.48,2.2,delta);
    if(fill.current)fill.current.intensity=THREE.MathUtils.damp(fill.current.intensity,.22+(1-p)*.18,2.2,delta);
  });
  return <>
    <ambientLight intensity={.2}/>
    <hemisphereLight args={["#c7d1d8","#100905",.32]}/>
    <directionalLight ref={key} position={[6,5,9]} intensity={2.55} color="#fff0db"/>
    <directionalLight ref={rim} position={[-6,-1,2]} intensity={.74} color="#7c9aab"/>
    <directionalLight ref={fill} position={[0,-5,-4]} intensity={.3} color="#b15f39"/>
  </>;
}

function CosmicScene({progress,reducedMotion,quality}:{progress:number;reducedMotion:boolean;quality:"high"|"medium"|"low"}){
  const starCount=quality==="low"?1100:quality==="medium"?2200:3600;
  const dustCount=quality==="low"?55:quality==="medium"?110:190;
  return <>
    <DeepField reducedMotion={reducedMotion}/>
    <Stars radius={82} depth={42} count={starCount} factor={quality==="high"?2.45:2.05} saturation={0} fade speed={.12}/>
    <Sparkles count={dustCount} scale={[30,17,86]} size={quality==="high"?1.35:1} speed={.095} opacity={.19} color="#d8e3e7"/>
    <ReactiveLighting progress={progress}/>
    <FlightPath progress={progress} reducedMotion={reducedMotion}/>
    <World textureUrl={EUROPA} position={[-4.6,.55,-8]} radius={2.65} tilt={-.18} speed={.022} atmosphere="#b7d7e1" guideColor="#9fc0cc" bumpScale={.065} roughness={.7} quality={quality}/>
    <World textureUrl={JUPITER} position={[4.9,-.45,-23]} radius={4.3} tilt={.05} speed={.014} atmosphere="#e0ad79" guideColor="#d6a272" bumpScale={.009} roughness={.82} quality={quality}/>
    <World textureUrl={MARS} position={[-4.2,.55,-39]} radius={3.05} tilt={-.1} speed={.019} atmosphere="#d0724a" guideColor="#c58b70" bumpScale={.045} roughness={.88} quality={quality}/>
    <Surveyor progress={progress} reducedMotion={reducedMotion} quality={quality}/>
  </>;
}

export function WorldCanvas({progress,reducedMotion}:{progress:number;reducedMotion:boolean}){
  const [quality,setQuality]=useState<"high"|"medium"|"low">("high");
  return <div className="world-canvas" aria-hidden="true">
    <Canvas dpr={[1,1.9]} camera={{position:[0,1.2,13],fov:39,near:.08,far:140}} gl={{antialias:true,alpha:false,powerPreference:"high-performance",toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.02}}>
      <color attach="background" args={["#010203"]}/>
      <fog attach="fog" args={["#040608",42,114]}/>
      <AdaptiveDpr pixelated/>
      <PerformanceMonitor flipflops={3} onDecline={()=>setQuality(value=>value==="high"?"medium":"low")} onIncline={()=>setQuality(value=>value==="low"?"medium":"high")}/>
      <Suspense fallback={null}>
        <CameraRig progress={progress} reducedMotion={reducedMotion}/>
        <CosmicScene progress={progress} reducedMotion={reducedMotion} quality={quality}/>
        {!reducedMotion&&quality!=="low"&&<EffectComposer multisampling={quality==="high"?4:0}>
          <Bloom intensity={quality==="high"?.46:.29} luminanceThreshold={.93} luminanceSmoothing={.17} mipmapBlur/>
          <SMAA/>
          <Vignette eskil={false} offset={.17} darkness={.38}/>
        </EffectComposer>}
      </Suspense>
    </Canvas>
  </div>;
}

useGLTF.preload(SURVEYOR);
