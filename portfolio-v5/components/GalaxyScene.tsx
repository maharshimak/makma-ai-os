"use client";

import {Canvas, useFrame, useThree} from "@react-three/fiber";
import {Preload, useGLTF, useProgress, useTexture} from "@react-three/drei";
import {Component, Suspense, useMemo, useRef} from "react";
import type {ReactNode} from "react";
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BackSide,
  Group,
  MathUtils,
  Mesh,
  SRGBColorSpace,
  Vector3,
} from "three";
import {useReducedMotion} from "motion/react";
import type {MotionValue} from "motion/react";

const JUPITER = "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/jupiter/preview.webp?w=2048";
const MARS = "https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/mars/preview.webp?w=2048";
const DEEP_SPACE_1 = "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/deep-space-1/Deep%20Space%201.glb";
const lookTarget = new Vector3();

class SceneErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){ return {failed:true}; }
  render(){ return this.state.failed ? null : this.props.children; }
}

function Scene({progress,reduceMotion}:{progress:MotionValue<number>;reduceMotion:boolean}){
  const [jupiterMap,marsMap] = useTexture([JUPITER,MARS]);
  const gltf = useGLTF(DEEP_SPACE_1);
  const spacecraft = useMemo(()=>gltf.scene.clone(true),[gltf.scene]);
  const jupiterRig = useRef<Group>(null);
  const jupiterSurface = useRef<Mesh>(null);
  const marsRig = useRef<Group>(null);
  const marsSurface = useRef<Mesh>(null);
  const craft = useRef<Group>(null);
  const {size} = useThree();
  const compact = size.width < 720;

  useMemo(()=>{
    jupiterMap.colorSpace = SRGBColorSpace;
    marsMap.colorSpace = SRGBColorSpace;
    jupiterMap.anisotropy = 8;
    marsMap.anisotropy = 8;
    jupiterMap.needsUpdate = true;
    marsMap.needsUpdate = true;
  },[jupiterMap,marsMap]);

  useFrame(({camera},delta)=>{
    const p = reduceMotion ? 0 : progress.get();

    // The spacecraft is a transition beat, not a persistent foreground prop.
    // It appears after the first scroll gesture and clears before project content.
    const jOut = compact
      ? MathUtils.smoothstep(p,.10,.31)
      : MathUtils.smoothstep(p,.055,.205);
    const marsIn = MathUtils.smoothstep(p,.28,.47);
    const marsOut = MathUtils.smoothstep(p,.57,.72);
    const craftIn = MathUtils.smoothstep(p,.010,.045);
    const craftOut = compact
      ? MathUtils.smoothstep(p,.090,.145)
      : MathUtils.smoothstep(p,.115,.195);
    const craftPresence = craftIn*(1-craftOut);

    if(jupiterSurface.current && !reduceMotion){
      jupiterSurface.current.rotation.y += delta*.031;
    }
    if(jupiterRig.current){
      const startX = compact ? 1.65 : 2.7;
      const startY = compact ? -1.04 : .10;
      jupiterRig.current.position.x = startX + jOut*(compact ? 3.9 : 5.9);
      jupiterRig.current.position.y = startY - jOut*(compact ? .46 : .82);
      jupiterRig.current.position.z = -1.8 - jOut*(compact ? .65 : 1.25);
      const s = 1 - jOut*.38;
      jupiterRig.current.scale.setScalar(s);
    }

    if(marsSurface.current && !reduceMotion){
      marsSurface.current.rotation.y += delta*.045;
    }
    if(marsRig.current){
      const presence = marsIn*(1-marsOut);
      marsRig.current.position.x = (compact ? -2.85 : -4.85) + presence*(compact ? 1.05 : 1.55);
      // Keep the secondary planet low in frame so it reads as depth rather than
      // covering timeline copy.
      marsRig.current.position.y = (compact ? -1.78 : -2.48) + presence*(compact ? .28 : .36);
      marsRig.current.position.z = -4.25 + presence*.34;
      marsRig.current.scale.setScalar((compact ? .48 : .58) + presence*(compact ? .12 : .16));
    }

    if(craft.current){
      const targetX = compact ? 1.55 - p*3.1 : 4.25 - p*8.05;
      const targetY = compact
        ? -1.6 + Math.sin(p*Math.PI*1.75)*.72
        : -1.35 + Math.sin(p*Math.PI*1.75)*1.85;
      const targetZ = (compact ? -.16 : .78) + Math.sin(p*Math.PI)*(compact ? .34 : 1.02);
      craft.current.position.x = MathUtils.damp(craft.current.position.x,targetX,3.1,delta);
      craft.current.position.y = MathUtils.damp(craft.current.position.y,targetY,3.1,delta);
      craft.current.position.z = MathUtils.damp(craft.current.position.z,targetZ,2.7,delta);
      craft.current.rotation.y = -.98 + p*1.44;
      craft.current.rotation.x = .08 + Math.sin(p*Math.PI*2)*.08;
      craft.current.rotation.z = -.16 + Math.sin(p*Math.PI*2.6)*.09;
      const baseScale = compact ? .22 : .44;
      const travelScale = Math.sin(p*Math.PI)*(compact ? .04 : .10);
      const presenceScale = .18 + craftPresence*.82;
      craft.current.scale.setScalar((baseScale + travelScale)*presenceScale);
      craft.current.visible = !reduceMotion && craftPresence > .025;
    }

    const cameraX = Math.sin(p*Math.PI*1.1)*(compact ? .16 : .44) - p*(compact ? .05 : .18);
    const cameraY = (compact ? .02 : .10) + Math.sin(p*Math.PI*1.65)*(compact ? .10 : .24);
    const cameraZ = 8 - Math.sin(p*Math.PI)*(compact ? .34 : .78) + p*(compact ? .16 : .38);
    camera.position.x = MathUtils.damp(camera.position.x,cameraX,2.4,delta);
    camera.position.y = MathUtils.damp(camera.position.y,cameraY,2.4,delta);
    camera.position.z = MathUtils.damp(camera.position.z,cameraZ,2.2,delta);
    lookTarget.set(-.18 + p*.24,-.06 + Math.sin(p*Math.PI)*.08,-1.7-p*.55);
    camera.lookAt(lookTarget);
  });

  const jRadius = compact ? 1.08 : 1.62;
  const mRadius = compact ? .48 : .64;

  return <>
    <fog attach="fog" args={["#020306",8.8,18.5]}/>
    <ambientLight intensity={.21}/>
    <hemisphereLight args={["#6f8fd8","#170a07",.40]}/>
    <directionalLight position={[-5.5,4.2,8]} intensity={3.65} color="#ffc394"/>
    <pointLight position={[5.2,-2.1,3]} intensity={4.4} color="#6caaff" distance={18}/>

    <group ref={jupiterRig} position={[compact?1.65:2.7,compact?-1.04:.10,-1.8]}>
      <mesh ref={jupiterSurface}>
        <sphereGeometry args={[jRadius,compact?80:112,compact?80:112]}/>
        <meshStandardMaterial map={jupiterMap} roughness={.91} metalness={0}/>
      </mesh>
      <mesh scale={1.025}>
        <sphereGeometry args={[jRadius,compact?56:80,compact?56:80]}/>
        <meshBasicMaterial color="#d9e7ff" side={BackSide} transparent opacity={.075} blending={AdditiveBlending} depthWrite={false}/>
      </mesh>
    </group>

    <group ref={marsRig} position={[compact?-2.85:-4.85,compact?-1.78:-2.48,-4.25]}>
      <mesh ref={marsSurface}>
        <sphereGeometry args={[mRadius,compact?64:96,compact?64:96]}/>
        <meshStandardMaterial map={marsMap} roughness={.95} metalness={0}/>
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[mRadius,compact?48:72,compact?48:72]}/>
        <meshBasicMaterial color="#f29c76" side={BackSide} transparent opacity={.09} blending={AdditiveBlending} depthWrite={false}/>
      </mesh>
    </group>

    <group ref={craft} position={[compact?1.55:4.25,compact?-1.6:-1.35,compact?-.16:.78]} rotation={[.08,-.98,-.16]} scale={compact?.22:.44}>
      <primitive object={spacecraft}/>
      <pointLight position={[0,-.2,-.8]} color="#ff7f42" intensity={2.1} distance={3}/>
    </group>
  </>;
}

function SceneLoadStatus(){
  const {active,progress} = useProgress();
  const visible = active && progress < 100;
  return <div className={`scene-load-status ${visible?"is-visible":""}`} aria-hidden={!visible}>
    <span>SCENE LINK</span>
    <i><b style={{transform:`scaleX(${Math.max(.04,progress/100)})`}}/></i>
    <em>{Math.round(progress)}%</em>
  </div>;
}

export function GalaxyScene({progress}:{progress:MotionValue<number>}){
  const reduceMotion = useReducedMotion() ?? false;
  return <SceneErrorBoundary>
    <SceneLoadStatus/>
    <div className="galaxy-canvas" aria-hidden="true">
      <Canvas
        camera={{position:[0,.1,8],fov:42}}
        dpr={[1,1.65]}
        gl={{antialias:true,alpha:true,powerPreference:"high-performance"}}
        performance={{min:.55}}
        onCreated={({gl})=>{
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.06;
          gl.outputColorSpace = SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          <Scene progress={progress} reduceMotion={reduceMotion}/>
          <Preload all/>
        </Suspense>
      </Canvas>
    </div>
  </SceneErrorBoundary>;
}

useGLTF.preload(DEEP_SPACE_1);
