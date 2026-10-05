"use client";

import {PerformanceMonitor,Sparkles,Stars,useGLTF,useTexture} from "@react-three/drei";
import {Canvas,useFrame,useThree} from "@react-three/fiber";
import {Bloom,EffectComposer,SMAA,Vignette} from "@react-three/postprocessing";
import {Suspense,useEffect,useMemo,useRef,useState} from "react";
import * as THREE from "three";

const WEBB="https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2022/10/STScI-01GFRYYRTCTMX197BY86MBFCR9.png?crop=faces%2Cfocalpoint&fit=clip&h=2304&w=4096";
const EUROPA="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/jupiter---europa/preview.webp?w=4096";
const JUPITER="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/jupiter/preview.webp?w=4096";
const MARS="https://assets.science.nasa.gov/dynamicimage/assets/science/cds/3d/resources/image/mars/preview.webp?w=4096";
const SURVEYOR="https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Mars%20Global%20Surveyor/Mars%20Global%20Surveyor.glb";

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


function CameraRig({progress,reducedMotion,focusSystem}:{progress:number;reducedMotion:boolean;focusSystem:"knowledge"|"agency"|"reliability"|null}){
  const curve=useMemo(()=>new THREE.CatmullRomCurve3(cameraPoints,false,"catmullrom",.36),[]);
  const targetCurve=useMemo(()=>new THREE.CatmullRomCurve3(targetPoints,false,"catmullrom",.32),[]);
  const target=useMemo(()=>new THREE.Vector3(),[]);
  useFrame((state,delta)=>{
    const t=THREE.MathUtils.clamp(progress,0,1);
    const wanted=curve.getPointAt(t);
    const look=targetCurve.getPointAt(t);
    if(focusSystem==="knowledge"){
      wanted.set(.65,.45,-17.4);
      look.set(4.9,-.45,-23);
    }else if(focusSystem==="agency"){
      wanted.set(1.8,1.7,-28.3);
      look.set(.2,1.25,-34);
    }else if(focusSystem==="reliability"){
      wanted.set(-.45,1.0,-33.1);
      look.set(-4.2,.55,-39);
    }
    if(!reducedMotion&&!focusSystem){wanted.x+=state.pointer.x*.18;wanted.y+=state.pointer.y*.1;}
    state.camera.position.lerp(wanted,1-Math.exp(-delta*(reducedMotion?10:2.85)));
    target.lerp(look,1-Math.exp(-delta*3.15));
    state.camera.lookAt(target);
    if(!reducedMotion)state.camera.rotation.z=THREE.MathUtils.lerp(state.camera.rotation.z,(state.pointer.x*.005)+(Math.sin(t*Math.PI*2)*.004),.032);
    if(state.camera instanceof THREE.PerspectiveCamera){
      const fovStops=[37,34,39,31,43,33,38,46,36];
      const scaled=t*(fovStops.length-1);
      const index=Math.min(fovStops.length-2,Math.floor(scaled));
      const local=scaled-index;
      const fov=THREE.MathUtils.lerp(fovStops[index],fovStops[index+1],local);
      if(Math.abs(state.camera.fov-fov)>.02){
        state.camera.fov=THREE.MathUtils.damp(state.camera.fov,fov,2.45,delta);
        state.camera.updateProjectionMatrix();
      }
    }
  });
  return null;
}

function CinematicGrade({
  progress,reducedMotion,focusSystem
}:{
  progress:number;
  reducedMotion:boolean;
  focusSystem:"knowledge"|"agency"|"reliability"|null;
}){
  const {gl,scene}=useThree();
  const palette=useMemo(()=>[
    new THREE.Color("#040608"),
    new THREE.Color("#05080b"),
    new THREE.Color("#061016"),
    new THREE.Color("#07131a"),
    new THREE.Color("#140d09"),
    new THREE.Color("#0c1510"),
    new THREE.Color("#120b0a"),
    new THREE.Color("#0b0a0d"),
    new THREE.Color("#120d09")
  ],[]);
  const targetColor=useMemo(()=>new THREE.Color(),[]);

  useFrame((_,delta)=>{
    const scaled=THREE.MathUtils.clamp(progress,0,1)*(palette.length-1);
    const index=Math.min(palette.length-2,Math.floor(scaled));
    const local=scaled-index;
    targetColor.copy(palette[index]).lerp(palette[index+1],local);

    const focusBoost=focusSystem ? .045 : 0;
    const desiredExposure=1.045+Math.sin(progress*Math.PI)*.035+focusBoost;
    gl.toneMappingExposure=THREE.MathUtils.damp(gl.toneMappingExposure,desiredExposure,reducedMotion?8:2.4,delta);

    if(scene.fog instanceof THREE.Fog){
      scene.fog.color.lerp(targetColor,1-Math.exp(-delta*(reducedMotion?8:1.15)));
      const focusDepth=focusSystem?7:0;
      const chapterBreath=Math.sin(progress*Math.PI*4)*1.2;
      scene.fog.near=THREE.MathUtils.damp(scene.fog.near,40+chapterBreath,2.1,delta);
      scene.fog.far=THREE.MathUtils.damp(scene.fog.far,112-focusDepth,2.1,delta);
    }
  });

  useEffect(()=>()=>{gl.toneMappingExposure=1.06;},[gl]);
  return null;
}

function makeFlareTexture(size=1024){
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

function DistantStar({quality}:{quality:"high"|"medium"|"low"}){
  const flare=useMemo(()=>makeFlareTexture(quality==="high"?1024:quality==="medium"?768:512),[quality]);
  useEffect(()=>()=>flare.dispose(),[flare]);
  const scale=quality==="high"?4.8:quality==="medium"?3.8:3;
  return <group position={[13,8,-14]}>
    <sprite scale={[scale,scale,1]}>
      <spriteMaterial map={flare} color="#fff0d8" transparent opacity={quality==="low"?.38:.62} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
    </sprite>
    <mesh><sphereGeometry args={[.065,16,16]}/><meshBasicMaterial color="#fff7e8" toneMapped={false}/></mesh>
  </group>;
}

function Moonlet({orbit,size,speed,phase,color,tilt=0}:{orbit:number;size:number;speed:number;phase:number;color:string;tilt?:number}){
  const ref=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!ref.current)return;
    const a=clock.elapsedTime*speed+phase;
    ref.current.position.set(Math.cos(a)*orbit,Math.sin(a*.73)*orbit*.12,Math.sin(a)*orbit);
  });
  return <group ref={ref} rotation={[0,0,tilt]}>
    <mesh>
      <sphereGeometry args={[size,24,24]}/>
      <meshStandardMaterial color={color} roughness={.95} metalness={0}/>
    </mesh>
  </group>;
}

function MoonSystem({kind}:{kind:"jupiter"|"mars"}){
  if(kind==="jupiter")return <group position={[4.9,-.45,-23]}>
    <Moonlet orbit={6.1} size={.11} speed={.065} phase={.4} color="#c8b99d"/>
    <Moonlet orbit={6.8} size={.085} speed={-.052} phase={2.3} color="#b7aaa0"/>
    <Moonlet orbit={7.45} size={.095} speed={.042} phase={4.2} color="#d0c8b8"/>
  </group>;
  return <group position={[-4.2,.55,-39]}>
    <Moonlet orbit={4.0} size={.072} speed={.09} phase={1.2} color="#8e776b"/>
    <Moonlet orbit={4.65} size={.055} speed={-.068} phase={3.8} color="#a58d7c"/>
  </group>;
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

function AtmosphereGlow({radius,color,intensity=.55,quality}:{radius:number;color:string;intensity?:number;quality:RenderQuality}){
  const outerMaterial=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color(color)},uIntensity:{value:intensity}},
    vertexShader:"varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mvPosition=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mvPosition.xyz); gl_Position=projectionMatrix*mvPosition; }",
    fragmentShader:"uniform vec3 uColor; uniform float uIntensity; varying vec3 vNormal; varying vec3 vView; void main(){ float facing=abs(dot(normalize(vNormal),normalize(vView))); float rim=pow(1.0-facing,2.8); float halo=smoothstep(.03,.96,rim); gl_FragColor=vec4(uColor,halo*uIntensity); }",
    transparent:true,
    side:THREE.BackSide,
    blending:THREE.AdditiveBlending,
    depthWrite:false,
    toneMapped:false
  }),[color,intensity]);
  const edgeMaterial=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{uColor:{value:new THREE.Color(color)},uIntensity:{value:intensity*.42}},
    vertexShader:"varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mvPosition=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mvPosition.xyz); gl_Position=projectionMatrix*mvPosition; }",
    fragmentShader:"uniform vec3 uColor; uniform float uIntensity; varying vec3 vNormal; varying vec3 vView; void main(){ float facing=max(0.0,dot(normalize(vNormal),normalize(vView))); float rim=pow(1.0-facing,5.2); gl_FragColor=vec4(uColor,rim*uIntensity); }",
    transparent:true,
    side:THREE.FrontSide,
    blending:THREE.AdditiveBlending,
    depthWrite:false,
    toneMapped:false
  }),[color,intensity]);
  useEffect(()=>()=>{outerMaterial.dispose();edgeMaterial.dispose();},[outerMaterial,edgeMaterial]);
  const segments=quality==="high"?144:quality==="medium"?96:64;
  return <group>
    <mesh scale={1.09}>
      <sphereGeometry args={[radius,segments,segments]}/>
      <primitive object={outerMaterial} attach="material"/>
    </mesh>
    {quality!=="low"&&<mesh scale={1.018}>
      <sphereGeometry args={[radius,segments,segments]}/>
      <primitive object={edgeMaterial} attach="material"/>
    </mesh>}
  </group>;
}

function JovianRing({radius,quality}:{radius:number;quality:"high"|"medium"|"low"}){
  const material=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{uOpacity:{value:quality==="high"?.115:quality==="medium"?.085:.055}},
    vertexShader:`
      varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      varying vec2 vUv;
      uniform float uOpacity;
      float hash(float n){return fract(sin(n)*43758.5453123);}
      void main(){
        vec2 p=vUv-.5;
        float r=length(p)*2.0;
        float angle=atan(p.y,p.x);
        float mask=smoothstep(.735,.775,r)*(1.0-smoothstep(.985,1.0,r));
        float bandA=.50+.50*sin((r-.74)*220.0);
        float bandB=.50+.50*sin((r-.74)*417.0+1.3);
        float grain=.72+.28*hash(floor((angle+3.14159)*92.0)+floor(r*340.0));
        float density=mix(.18,1.0,pow(bandA*bandB,.72))*grain;
        float alpha=mask*density*uOpacity;
        vec3 dust=mix(vec3(.43,.36,.30),vec3(.72,.61,.49),clamp((r-.74)*2.4,0.0,1.0));
        gl_FragColor=vec4(dust,alpha);
      }
    `,
    transparent:true,
    side:THREE.DoubleSide,
    depthWrite:false,
    blending:THREE.NormalBlending,
    toneMapped:false
  }),[quality]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <mesh rotation={[Math.PI/2+.035,0,.025]} renderOrder={1}>
    <ringGeometry args={[radius*1.40,radius*1.86,quality==="high"?768:quality==="medium"?480:256,quality==="high"?20:12]}/>
    <primitive object={material} attach="material"/>
  </mesh>;
}


type RenderQuality="high"|"medium"|"low";

function seededRandom(seed:number){
  let value=seed>>>0;
  return ()=>{
    value=(value+0x6D2B79F5)>>>0;
    let t=value;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

function smoothWindow(edge0:number,edge1:number,value:number){
  const t=THREE.MathUtils.clamp((value-edge0)/(edge1-edge0),0,1);
  return t*t*(3-2*t);
}

function knowledgeProjectMode(slug:string|null){
  if(slug==="agentic-rag-engine")return 1;
  if(slug==="knowledge-twin")return 2;
  if(slug==="clinical-document-intelligence")return 3;
  return 0;
}

function makeKnowledgeField(count:number){
  const random=seededRandom(84621+count);
  const positions=new Float32Array(count*3);
  const seeds=new Float32Array(count);
  const tones=new Float32Array(count);
  for(let i=0;i<count;i++){
    const angle=random()*Math.PI*2;
    const radial=Math.pow(random(),1.42);
    const radius=3.05+radial*2.55;
    const thickness=.34-radial*.17;
    const y=(random()+random()+random()-1.5)*thickness;
    positions[i*3]=Math.cos(angle)*radius;
    positions[i*3+1]=y;
    positions[i*3+2]=Math.sin(angle)*radius;
    seeds[i]=random();
    tones[i]=random();
  }
  return {positions,seeds,tones};
}

function KnowledgeParticleField({
  progress,quality,reducedMotion,focusProject
}:{
  progress:number;
  quality:RenderQuality;
  reducedMotion:boolean;
  focusProject:string|null;
}){
  const count=quality==="high"?70000:quality==="medium"?32000:10000;
  const data=useMemo(()=>makeKnowledgeField(count),[count]);
  const points=useRef<THREE.Points>(null);
  const material=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{
      uReveal:{value:0},
      uVisibility:{value:0},
      uTime:{value:0},
      uProject:{value:0},
      uAgency:{value:0},
      uPointSize:{value:quality==="high"?2.2:quality==="medium"?2.0:1.7}
    },
    vertexShader:`
      attribute float aSeed;
      attribute float aTone;
      uniform float uReveal;
      uniform float uVisibility;
      uniform float uTime;
      uniform float uProject;
      uniform float uAgency;
      uniform float uPointSize;
      varying float vAlpha;
      varying float vTone;
      varying float vProject;

      float ease(float x){
        x=clamp(x,0.0,1.0);
        return x*x*(3.0-2.0*x);
      }

      void main(){
        vec3 ring=position;
        float angle=atan(ring.z,ring.x);
        float angular=(angle+3.14159265)/6.2831853;
        float localReveal=ease((uReveal-angular*.24-aSeed*.08)/.68);

        vec3 moonSurface=normalize(vec3(ring.x,ring.y*.72,ring.z))*2.80;
        float swirl=(1.0-localReveal)*(4.2+aSeed*2.4);
        float cs=cos(swirl);
        float sn=sin(swirl);
        vec3 swirled=ring;
        swirled.xz=mat2(cs,-sn,sn,cs)*swirled.xz;
        swirled.y+=(1.0-localReveal)*(aSeed-.5)*1.9;
        vec3 transformed=mix(moonSurface,swirled,localReveal);

        transformed.y+=sin(angle*9.0+uTime*.58+aSeed*8.0)*.035*(.35+.65*aSeed)*localReveal;

        if(uProject>.5){
          vec3 attractor;
          if(uProject<1.5){
            attractor=vec3(4.25,.18,.45);
          }else if(uProject<2.5){
            attractor=vec3(-3.55,.08,2.65);
          }else{
            attractor=vec3(.55,-.18,-4.25);
          }
          vec3 delta=attractor-transformed;
          float dist=max(.08,length(delta));
          float pull=exp(-dist*.72)*(.26+.20*sin(uTime*1.25+aSeed*6.0));
          transformed+=normalize(delta)*pull;
        }

        if(uAgency>.001){
          float wakeAngle=mix(-2.4,2.2,uAgency);
          vec3 wake=vec3(cos(wakeAngle)*4.15,.12+sin(uAgency*6.2831)*.22,sin(wakeAngle)*4.15);
          vec3 wakeDelta=transformed-wake;
          float wakeDist=max(.06,length(wakeDelta));
          float wakeForce=exp(-wakeDist*wakeDist*.82)*.72*sin(uAgency*3.14159);
          transformed+=normalize(wakeDelta)*wakeForce;
          transformed.y+=wakeForce*(aSeed-.5)*.46;
        }

        vec4 mvPosition=modelViewMatrix*vec4(transformed,1.0);
        gl_Position=projectionMatrix*mvPosition;
        gl_PointSize=clamp(uPointSize*(165.0/max(1.0,-mvPosition.z)),1.15,4.6);
        vAlpha=localReveal*uVisibility*(.38+.62*aSeed);
        vTone=aTone;
        vProject=uProject;
      }
    `,
    fragmentShader:`
      varying float vAlpha;
      varying float vTone;
      varying float vProject;
      void main(){
        vec2 p=gl_PointCoord-.5;
        float d=length(p);
        if(d>.5)discard;
        float soft=1.0-smoothstep(.16,.5,d);
        vec3 ice=mix(vec3(.28,.38,.44),vec3(.47,.83,.98),smoothstep(.72,.98,vTone));
        vec3 violet=vec3(.52,.39,.88);
        vec3 warm=vec3(.96,.51,.28);
        if(vProject>1.5&&vProject<2.5) ice=mix(ice,violet,.28);
        if(vProject>2.5) ice=mix(ice,warm,.20);
        gl_FragColor=vec4(ice,vAlpha*soft*.88);
      }
    `,
    transparent:true,
    blending:THREE.AdditiveBlending,
    depthWrite:false,
    toneMapped:false
  }),[quality]);
  useEffect(()=>()=>material.dispose(),[material]);

  useFrame(({clock},delta)=>{
    if(!points.current)return;
    const reveal=smoothWindow(.275,.365,progress);
    const fadeOut=1-smoothWindow(.625,.70,progress);
    const visibility=reveal*fadeOut;
    const agency=smoothWindow(.43,.50,progress)*(1-smoothWindow(.58,.64,progress));
    material.uniforms.uReveal.value=THREE.MathUtils.damp(material.uniforms.uReveal.value,reducedMotion?1:reveal,4.2,delta);
    material.uniforms.uVisibility.value=THREE.MathUtils.damp(material.uniforms.uVisibility.value,visibility,3.8,delta);
    points.current.visible=material.uniforms.uVisibility.value>.006;
    if(!points.current.visible)return;
    material.uniforms.uProject.value=THREE.MathUtils.damp(material.uniforms.uProject.value,knowledgeProjectMode(focusProject),5.1,delta);
    material.uniforms.uAgency.value=THREE.MathUtils.damp(material.uniforms.uAgency.value,agency,4.1,delta);
    material.uniforms.uTime.value=clock.elapsedTime;
    if(!reducedMotion)points.current.rotation.y-=delta*.025;
  });

  return <points ref={points} position={[-4.6,.55,-8]} rotation={[0,0,-.18]} frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[data.positions,3]}/>
      <bufferAttribute attach="attributes-aSeed" args={[data.seeds,1]}/>
      <bufferAttribute attach="attributes-aTone" args={[data.tones,1]}/>
    </bufferGeometry>
    <primitive object={material} attach="material"/>
  </points>;
}

type KnowledgeFragment={
  angle:number;
  radius:number;
  radialAmplitude:number;
  radialSpeed:number;
  phase:number;
  y:number;
  speed:number;
  scale:number;
  rx:number;
  ry:number;
  rz:number;
  rsx:number;
  rsy:number;
  rsz:number;
};

function makeKnowledgeFragments(count:number){
  const random=seededRandom(31177+count);
  const fragments:KnowledgeFragment[]=[];
  for(let i=0;i<count;i++){
    fragments.push({
      angle:random()*Math.PI*2,
      radius:3.15+random()*2.2,
      radialAmplitude:.18+random()*.62,
      radialSpeed:.11+random()*.22,
      phase:random()*Math.PI*2,
      y:(random()-.5)*.58,
      speed:(.035+random()*.065)*(random()>.5?1:-1),
      scale:.035+Math.pow(random(),3.4)*.17,
      rx:random()*Math.PI,ry:random()*Math.PI,rz:random()*Math.PI,
      rsx:(random()-.5)*.7,rsy:(random()-.5)*.7,rsz:(random()-.5)*.7
    });
  }
  return fragments.sort((a,b)=>b.scale-a.scale);
}

function KnowledgeFragments({
  progress,quality,reducedMotion,focusProject
}:{
  progress:number;
  quality:RenderQuality;
  reducedMotion:boolean;
  focusProject:string|null;
}){
  const count=quality==="high"?58:quality==="medium"?34:16;
  const mesh=useRef<THREE.InstancedMesh>(null);
  const fragments=useMemo(()=>makeKnowledgeFragments(count),[count]);
  const dummy=useMemo(()=>new THREE.Object3D(),[]);
  const iceMap=useTexture(EUROPA);
  const scaleRef=useRef(0);

  useMemo(()=>{
    iceMap.colorSpace=THREE.SRGBColorSpace;
    iceMap.anisotropy=quality==="high"?16:quality==="medium"?10:5;
  },[iceMap,quality]);

  useFrame(({clock},delta)=>{
    if(!mesh.current)return;
    const reveal=smoothWindow(.31,.39,progress)*(1-smoothWindow(.625,.70,progress));
    scaleRef.current=THREE.MathUtils.damp(scaleRef.current,reveal,3.4,delta);
    const project=knowledgeProjectMode(focusProject);
    mesh.current.visible=scaleRef.current>.008;
    if(!mesh.current.visible)return;

    fragments.forEach((fragment,index)=>{
      if(!reducedMotion){
        fragment.angle+=fragment.speed*delta;
        fragment.phase+=fragment.radialSpeed*delta;
        fragment.rx+=fragment.rsx*delta;
        fragment.ry+=fragment.rsy*delta;
        fragment.rz+=fragment.rsz*delta;
      }
      let radius=fragment.radius+Math.sin(fragment.phase)*fragment.radialAmplitude;
      if(project===1)radius+=Math.sin(clock.elapsedTime*1.7+index)*.12;
      if(project===2)radius+=Math.sin(fragment.angle*3.0)*.16;
      if(project===3)radius+=index%3===0?.20:-.05;
      dummy.position.set(
        -4.6+Math.cos(fragment.angle)*radius,
        .55+fragment.y+Math.sin(fragment.phase*.7)*.08,
        -8+Math.sin(fragment.angle)*radius
      );
      dummy.rotation.set(fragment.rx,fragment.ry,fragment.rz);
      dummy.scale.setScalar(fragment.scale*scaleRef.current*(project?1.12:1));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index,dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate=true;
  });

  return <instancedMesh ref={mesh} args={[undefined,undefined,count]} frustumCulled={false}>
    <icosahedronGeometry args={[1,1]}/>
    <meshStandardMaterial map={iceMap} bumpMap={iceMap} bumpScale={.09} color="#d7e5e9" roughness={.78} metalness={.04}/>
  </instancedMesh>;
}

function KnowledgeGravitySystem(props:{
  progress:number;
  quality:RenderQuality;
  reducedMotion:boolean;
  focusProject:string|null;
}){
  return <>
    <KnowledgeParticleField {...props}/>
    <KnowledgeFragments {...props}/>
  </>;
}

function World({textureUrl,position,radius,tilt=0,speed=.035,atmosphere,bumpScale=.025,roughness=.76,quality,ring="none"}:{textureUrl:string;position:[number,number,number];radius:number;tilt?:number;speed?:number;atmosphere:string;bumpScale?:number;roughness?:number;quality:"high"|"medium"|"low";ring?:"none"|"jupiter"}){
  const map=useTexture(textureUrl);
  const planet=useRef<THREE.Mesh>(null);
  const halo=useRef<THREE.PointLight>(null);
  const segments=quality==="high"?224:quality==="medium"?144:88;
  useMemo(()=>{
    map.colorSpace=THREE.SRGBColorSpace;
    map.anisotropy=quality==="high"?16:quality==="medium"?12:6;
    map.minFilter=THREE.LinearMipmapLinearFilter;
    map.magFilter=THREE.LinearFilter;
    map.generateMipmaps=true;
  },[map,quality]);
  useFrame(({clock},delta)=>{
    if(planet.current)planet.current.rotation.y+=delta*speed;
    if(halo.current)halo.current.intensity=.14+Math.sin(clock.elapsedTime*.42+radius)*.025;
  });
  return <group position={position} rotation={[0,0,tilt]}>
    {ring==="jupiter"&&<JovianRing radius={radius} quality={quality}/>} 
    <mesh ref={planet}>
      <sphereGeometry args={[radius,segments,segments]}/>
      <meshPhysicalMaterial
        map={map}
        bumpMap={map}
        bumpScale={bumpScale}
        roughness={roughness}
        metalness={0}
        clearcoat={quality==="high"?.055:.03}
        clearcoatRoughness={.84}
        sheen={quality==="low"?0:.06}
        sheenColor={new THREE.Color(atmosphere)}
        envMapIntensity={quality==="high"?.82:.68}
      />
    </mesh>
    <AtmosphereGlow radius={radius} color={atmosphere} intensity={quality==="low"?.3:.56} quality={quality}/>
    {quality!=="low"&&<pointLight ref={halo} position={[radius*.48,radius*.22,radius*.84]} intensity={.15} distance={radius*3.2} color={atmosphere}/>}
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

function SpacecraftBeacon({quality}:{quality:RenderQuality}){
  const warm=useRef<THREE.Sprite>(null);
  const cool=useRef<THREE.Sprite>(null);
  const flare=useMemo(()=>makeFlareTexture(quality==="high"?512:256),[quality]);
  useEffect(()=>()=>flare.dispose(),[flare]);
  useFrame(({clock})=>{
    const pulse=.22+Math.pow(Math.max(0,Math.sin(clock.elapsedTime*2.2)),10)*.72;
    if(warm.current&&warm.current.material instanceof THREE.SpriteMaterial)warm.current.material.opacity=pulse;
    if(cool.current&&cool.current.material instanceof THREE.SpriteMaterial)cool.current.material.opacity=.16+Math.pow(Math.max(0,Math.sin(clock.elapsedTime*1.7+1.9)),12)*.58;
  });
  return <>
    <sprite ref={warm} position={[.92,.42,.18]} scale={[.34,.34,1]}>
      <spriteMaterial map={flare} color="#ff8c62" transparent opacity={.25} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
    </sprite>
    <sprite ref={cool} position={[-.82,.28,-.05]} scale={[.3,.3,1]}>
      <spriteMaterial map={flare} color="#88cfff" transparent opacity={.2} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
    </sprite>
  </>;
}

function Surveyor({progress,reducedMotion,quality}:{progress:number;reducedMotion:boolean;quality:"high"|"medium"|"low"}){
  const {scene}=useGLTF(SURVEYOR);
  const flareTexture=useMemo(()=>makeFlareTexture(quality==="high"?1024:quality==="medium"?768:512),[quality]);
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
          if(material.map){material.map.anisotropy=quality==="high"?16:quality==="medium"?12:8;material.map.minFilter=THREE.LinearMipmapLinearFilter;material.map.magFilter=THREE.LinearFilter;}
        }
      });
    });
    return clone;
  },[scene,quality]);
  const group=useRef<THREE.Group>(null);
  const wanted=useMemo(()=>new THREE.Vector3(),[]);
  useFrame(({clock},delta)=>{
    if(!group.current)return;
    const travel=Math.min(1,Math.max(0,(progress-.12)/.76));
    const arc=Math.sin(travel*Math.PI);
    wanted.set(
      THREE.MathUtils.lerp(3.8,-1.75,travel)+arc*1.25,
      THREE.MathUtils.lerp(2.45,1.15,travel)+Math.sin(travel*Math.PI*1.7)*.42,
      THREE.MathUtils.lerp(-8.2,-43.5,travel)
    );
    group.current.position.lerp(wanted,1-Math.exp(-delta*3.25));
    if(!reducedMotion){
      const targetYaw=-.32+travel*1.18;
      const targetRoll=-.11+Math.sin(travel*Math.PI*2.1)*.075;
      group.current.rotation.y=THREE.MathUtils.damp(group.current.rotation.y,targetYaw,3.2,delta);
      group.current.rotation.z=THREE.MathUtils.damp(group.current.rotation.z,targetRoll,3.4,delta);
      group.current.rotation.x=Math.sin(clock.elapsedTime*.17)*.018;
    }
  });
  useEffect(()=>()=>flareTexture.dispose(),[flareTexture]);
  return <group ref={group} position={[3.25,2.15,-9]} scale={.92}>
    <primitive object={craft}/>
    <ThrusterPlume/>
    {quality!=="low"&&<SpacecraftBeacon quality={quality}/>}
    {quality!=="low"&&<sprite position={[.75,.6,.25]} scale={[1.18,1.18,1]}>
      <spriteMaterial map={flareTexture} color="#ffe0b6" transparent opacity={.42} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
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
    <ambientLight intensity={.12}/>
    <hemisphereLight args={["#b9c7cf","#080503",.23]}/>
    <directionalLight ref={key} position={[10,7,11]} intensity={2.42} color="#fff1dc"/>
    <directionalLight ref={rim} position={[-7,-2,1]} intensity={.58} color="#7898ab"/>
    <directionalLight ref={fill} position={[1,-6,-5]} intensity={.2} color="#a95736"/>
  </>;
}

function SignalRelay({
  center,radius,color,progress,start,end,phase=0,tilt=.08
}:{
  center:[number,number,number];
  radius:number;
  color:string;
  progress:number;
  start:number;
  end:number;
  phase?:number;
  tilt?:number;
}){
  const group=useRef<THREE.Group>(null);
  const bead=useRef<THREE.Mesh>(null);
  const ringMaterial=useRef<THREE.MeshBasicMaterial>(null);
  const beadMaterial=useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({clock},delta)=>{
    const reveal=smoothWindow(start,start+.045,progress)*(1-smoothWindow(end-.045,end,progress));
    if(group.current)group.current.visible=reveal>.004;
    if(ringMaterial.current)ringMaterial.current.opacity=THREE.MathUtils.damp(ringMaterial.current.opacity,reveal*.16,4.2,delta);
    if(beadMaterial.current)beadMaterial.current.opacity=THREE.MathUtils.damp(beadMaterial.current.opacity,reveal*.9,4.6,delta);
    if(bead.current){
      const a=clock.elapsedTime*.24+phase+progress*Math.PI*.8;
      bead.current.position.set(Math.cos(a)*radius,Math.sin(a*1.4)*.10,Math.sin(a)*radius);
      const pulse=.72+Math.sin(clock.elapsedTime*3.2+phase)*.14;
      bead.current.scale.setScalar(pulse);
    }
  });

  return <group ref={group} position={center} rotation={[tilt,.12,-.05]}>
    <mesh rotation={[Math.PI/2,0,0]}>
      <torusGeometry args={[radius,.008,6,192]}/>
      <meshBasicMaterial ref={ringMaterial} color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
    </mesh>
    <mesh ref={bead}>
      <sphereGeometry args={[.055,16,16]}/>
      <meshBasicMaterial ref={beadMaterial} color={color} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}/>
    </mesh>
    <pointLight intensity={.4} distance={1.8} color={color}/>
  </group>;
}

function CosmicScene({progress,reducedMotion,quality,focusProject}:{progress:number;reducedMotion:boolean;quality:RenderQuality;focusProject:string|null}){
  const starCount=quality==="low"?700:quality==="medium"?1350:2200;
  const dustCount=quality==="low"?26:quality==="medium"?58:96;
  return <>
    <DeepField reducedMotion={reducedMotion}/>
    <Stars radius={82} depth={42} count={starCount} factor={quality==="high"?2.45:2.05} saturation={0} fade speed={.12}/>
    <Sparkles count={dustCount} scale={[30,17,86]} size={quality==="high"?.9:.72} speed={.045} opacity={.095} color="#d8e3e7"/>
    <ReactiveLighting progress={progress}/>
    <DistantStar quality={quality}/>
    {quality!=="low"&&<>
      <SignalRelay center={[-4.6,.55,-8]} radius={3.45} color="#8fd8f4" progress={progress} start={.22} end={.48} phase={.4}/>
      <SignalRelay center={[4.9,-.45,-23]} radius={5.75} color="#f3a06c" progress={progress} start={.38} end={.66} phase={2.1} tilt={-.04}/>
      <SignalRelay center={[-4.2,.55,-39]} radius={4.15} color="#a9c9b0" progress={progress} start={.56} end={.80} phase={4.4} tilt={.12}/>
    </>}
    <World textureUrl={EUROPA} position={[-4.6,.55,-8]} radius={2.65} tilt={-.18} speed={.022} atmosphere="#b7d7e1" bumpScale={.065} roughness={.7} quality={quality}/>
    <KnowledgeGravitySystem progress={progress} quality={quality} reducedMotion={reducedMotion} focusProject={focusProject}/>
    <World textureUrl={JUPITER} position={[4.9,-.45,-23]} radius={4.3} tilt={.05} speed={.014} atmosphere="#e0ad79" bumpScale={.009} roughness={.82} quality={quality} ring="jupiter"/>
    <World textureUrl={MARS} position={[-4.2,.55,-39]} radius={3.05} tilt={-.1} speed={.019} atmosphere="#d0724a" bumpScale={.045} roughness={.88} quality={quality}/>
    {quality!=="low"&&<><MoonSystem kind="jupiter"/><MoonSystem kind="mars"/></>}
    <Surveyor progress={progress} reducedMotion={reducedMotion} quality={quality}/>
  </>;
}

export function WorldCanvas({progress,reducedMotion,focusSystem=null,focusProject=null}:{progress:number;reducedMotion:boolean;focusSystem?:"knowledge"|"agency"|"reliability"|null;focusProject?:string|null}){
  const [quality,setQuality]=useState<RenderQuality>("medium");
  const [allowHigh,setAllowHigh]=useState(true);

  useEffect(()=>{
    const coarse=window.matchMedia("(pointer: coarse)");
    const sync=()=>{
      const capableForHigh=window.innerWidth>=980&&!coarse.matches;
      setAllowHigh(capableForHigh);
      if(!capableForHigh)setQuality(value=>value==="high"?"medium":value);
    };
    sync();
    coarse.addEventListener("change",sync);
    window.addEventListener("resize",sync);
    return ()=>{
      coarse.removeEventListener("change",sync);
      window.removeEventListener("resize",sync);
    };
  },[]);
  return <div className="world-canvas" aria-hidden="true">
    <Canvas dpr={quality==="high"?[1,1.75]:quality==="medium"?[1,1.35]:1} camera={{position:[0,1.2,13],fov:39,near:.08,far:140}} gl={{antialias:true,alpha:false,powerPreference:"high-performance",toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.06,preserveDrawingBuffer:false}}>
      <color attach="background" args={["#010203"]}/>
      <fog attach="fog" args={["#040608",42,114]}/>
      <PerformanceMonitor flipflops={3} onDecline={()=>setQuality(value=>value==="high"?"medium":"low")} onIncline={()=>setQuality(value=>value==="low"?"medium":allowHigh?"high":"medium")} onFallback={()=>setQuality("low")}/>
      <Suspense fallback={null}>
        <CameraRig progress={progress} reducedMotion={reducedMotion} focusSystem={focusSystem}/>
        <CinematicGrade progress={progress} reducedMotion={reducedMotion} focusSystem={focusSystem}/>
        <CosmicScene progress={progress} reducedMotion={reducedMotion} quality={quality} focusProject={focusProject}/>
        {!reducedMotion&&quality!=="low"&&<EffectComposer multisampling={quality==="high"?4:0}>
          <Bloom intensity={quality==="high"?.31:.20} luminanceThreshold={1.06} luminanceSmoothing={.22} mipmapBlur/>
          <SMAA/>
          <Vignette eskil={false} offset={.17} darkness={.38}/>
        </EffectComposer>}
      </Suspense>
    </Canvas>
  </div>;
}

useTexture.preload(WEBB);
useTexture.preload(EUROPA);
useTexture.preload(JUPITER);
useTexture.preload(MARS);
useGLTF.preload(SURVEYOR);
