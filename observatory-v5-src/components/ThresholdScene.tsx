"use client";

/**
 * The Threshold — original, procedural 0–27% visual prototype.
 *
 * One scene, one camera, no runtime third-party media or fonts.
 * Motion is derived exclusively from the existing journey progress ref.
 * All essential content and interactions remain in the HTML portfolio.
 */
import {useEffect,useMemo,useRef} from "react";
import type {MutableRefObject} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import * as THREE from "three";

export type ThresholdQuality="high"|"medium"|"low";
export type ThresholdProgress=MutableRefObject<number>;

export const THRESHOLD_END=.27;

const clamp01=(n:number)=>THREE.MathUtils.clamp(n,0,1);
const ease=(n:number)=>{const t=clamp01(n);return t*t*(3-2*t);};
const phase=(p:number,a:number,b:number)=>ease((p-a)/(b-a));

type Keyframe={p:number;position:[number,number,number];look:[number,number,number];fov:number};
const keyframes:Keyframe[]=[
  {p:0,position:[0,1.8,15],look:[0,1.7,0],fov:38},
  {p:.10,position:[.75,1.8,11],look:[0,1.7,0],fov:36},
  {p:.18,position:[0,1.8,7.6],look:[0,1.75,-1.5],fov:37},
  {p:.22,position:[0,1.8,2.4],look:[0,1.75,-2],fov:32},
  {p:.27,position:[0,1.85,-8],look:[-1.7,1.9,-21],fov:44},
  {p:.39,position:[-2.4,1.9,-22],look:[0,1.8,-37],fov:40},
  {p:.51,position:[2.3,1.9,-37],look:[0,1.8,-54],fov:42},
  {p:.63,position:[-1.7,1.85,-52],look:[0,1.8,-70],fov:39},
  {p:.77,position:[0,1.8,-69],look:[0,1.8,-89],fov:39},
  {p:.89,position:[0,2.25,-83],look:[0,2,-108],fov:34},
  {p:1,position:[0,2.3,-108],look:[0,1.6,-135],fov:46}
];
const position=new THREE.Vector3();
const look=new THREE.Vector3();
const from=new THREE.Vector3();
const to=new THREE.Vector3();

export function ThresholdCamera({progressRef}:{progressRef:ThresholdProgress}){
  const {camera,size}=useThree();
  const currentLook=useRef(new THREE.Vector3());
  useFrame((_,delta)=>{
    const p=clamp01(progressRef.current);
    let i=0;
    while(i<keyframes.length-2&&p>keyframes[i+1].p)i++;
    const first=keyframes[i],second=keyframes[i+1];
    const t=ease((p-first.p)/(second.p-first.p));
    from.fromArray(first.position);to.fromArray(second.position);
    position.copy(from).lerp(to,t);
    from.fromArray(first.look);to.fromArray(second.look);
    look.copy(from).lerp(to,t);
    const a=1-Math.exp(-Math.min(delta,.05)*5.5);
    camera.position.lerp(position,a);
    currentLook.current.lerp(look,a);
    camera.lookAt(currentLook.current);
    if(camera instanceof THREE.PerspectiveCamera){
      const desired=THREE.MathUtils.lerp(first.fov,second.fov,t)+(size.width<760?8:0);
      if(Math.abs(camera.fov-desired)>.025){
        camera.fov=THREE.MathUtils.damp(camera.fov,desired,5.5,delta);
        camera.updateProjectionMatrix();
      }
    }
  });
  return null;
}

/** Local deterministic cloud painting, rendered once per quality change. */
function makePaintedSky(quality:ThresholdQuality){
  const size=quality==="low"?512:1024;
  const canvas=document.createElement("canvas");
  canvas.width=size;canvas.height=Math.round(size*.70);
  const ctx=canvas.getContext("2d");
  if(!ctx)return new THREE.Texture();
  const w=canvas.width,h=canvas.height;
  const backdrop=ctx.createLinearGradient(0,0,0,h);
  backdrop.addColorStop(0,"#142938");
  backdrop.addColorStop(.38,"#567b91");
  backdrop.addColorStop(.72,"#c4a8a0");
  backdrop.addColorStop(1,"#eee0c4");
  ctx.fillStyle=backdrop;ctx.fillRect(0,0,w,h);
  const light=ctx.createRadialGradient(w*.68,h*.36,0,w*.68,h*.36,w*.58);
  light.addColorStop(0,"rgba(255,244,215,.68)");
  light.addColorStop(.35,"rgba(255,210,177,.20)");
  light.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
  let seed=24851;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const bands=quality==="low"?44:82;
  for(let i=0;i<bands;i++){
    const x=(rand()*1.4-.2)*w;
    const y=(.34+rand()*.8)*h;
    const radius=(.08+rand()*.18)*w;
    const cloud=ctx.createRadialGradient(x,y,0,x,y,radius);
    const alpha=.04+rand()*.16;
    cloud.addColorStop(0,"rgba(245,245,229,"+alpha.toFixed(3)+")");
    cloud.addColorStop(.6,"rgba(227,229,224,"+(alpha*.48).toFixed(3)+")");
    cloud.addColorStop(1,"rgba(245,245,239,0)");
    ctx.save();ctx.translate(x,y);ctx.scale(1,.20+rand()*.15);ctx.translate(-x,-y);
    ctx.fillStyle=cloud;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=quality==="high"?8:2;
  return texture;
}

function Stone({position,scale,material}:{position:[number,number,number];scale:[number,number,number];material:THREE.Material}){
  return <mesh position={position} material={material} castShadow={false} receiveShadow={false}>
    <boxGeometry args={scale}/>
  </mesh>;
}

function ObservatoryArchitecture({quality}:{quality:ThresholdQuality}){
  const stone=useMemo(()=>new THREE.MeshStandardMaterial({color:"#33424a",roughness:.93,metalness:.04}),[]);
  const edge=useMemo(()=>new THREE.MeshStandardMaterial({color:"#ad9277",roughness:.49,metalness:.42}),[]);
  useEffect(()=>()=>{stone.dispose();edge.dispose();},[stone,edge]);
  return <group>
    <Stone position={[-3.3,1.8,0]} scale={[1.05,8.0,1.22]} material={stone}/>
    <Stone position={[3.3,1.8,0]} scale={[1.05,8.0,1.22]} material={stone}/>
    <Stone position={[0,5.35,0]} scale={[7.8,.94,1.28]} material={stone}/>
    <Stone position={[0,-1.45,0]} scale={[7.8,.72,1.38]} material={stone}/>
    <Stone position={[-2.53,1.7,.73]} scale={[.085,6.15,.085]} material={edge}/>
    <Stone position={[2.53,1.7,.73]} scale={[.085,6.15,.085]} material={edge}/>
    <Stone position={[0,4.75,.73]} scale={[5.15,.07,.09]} material={edge}/>
    <Stone position={[0,-1.34,.73]} scale={[5.15,.07,.09]} material={edge}/>
    <Stone position={[-6,0,-3]} scale={[5.4,9,8]} material={stone}/>
    <Stone position={[6,0,-3]} scale={[5.4,9,8]} material={stone}/>
    <Stone position={[0,-2.35,-7]} scale={[20,.4,27]} material={stone}/>
    {quality!=="low"&&<group>
      <Stone position={[-4.2,2.45,3]} scale={[.12,5.8,.12]} material={edge}/>
      <Stone position={[4.2,2.45,3]} scale={[.12,5.8,.12]} material={edge}/>
      <Stone position={[-4.2,5.3,3]} scale={[.12,.12,9]} material={edge}/>
      <Stone position={[4.2,5.3,3]} scale={[.12,.12,9]} material={edge}/>
    </group>}
  </group>;
}

function Aperture({progressRef,sky}:{progressRef:ThresholdProgress;sky:THREE.Texture}){
  const left=useRef<THREE.Group>(null);
  const right=useRef<THREE.Group>(null);
  const painting=useRef<THREE.MeshBasicMaterial>(null);
  const brass=useMemo(()=>new THREE.MeshStandardMaterial({color:"#a5815e",metalness:.76,roughness:.34}),[]);
  const panel=useMemo(()=>new THREE.MeshStandardMaterial({color:"#293840",metalness:.30,roughness:.65}),[]);
  useEffect(()=>()=>{brass.dispose();panel.dispose();},[brass,panel]);
  useFrame(()=>{
    const p=progressRef.current;
    const open=phase(p,.20,.245);
    if(left.current)left.current.rotation.y=-open*1.36;
    if(right.current)right.current.rotation.y=open*1.36;
    if(painting.current)painting.current.opacity=1-phase(p,.205,.238);
  });
  return <group>
    <group ref={left} position={[-2.45,1.75,.35]}>
      <Stone position={[1.22,0,0]} scale={[2.44,5.95,.22]} material={panel}/>
      <Stone position={[1.2,0,.16]} scale={[2.16,5.70,.065]} material={brass}/>
      <Stone position={[1.2,0,.23]} scale={[2.01,5.55,.05]} material={panel}/>
    </group>
    <group ref={right} position={[2.45,1.75,.35]}>
      <Stone position={[-1.22,0,0]} scale={[2.44,5.95,.22]} material={panel}/>
      <Stone position={[-1.2,0,.16]} scale={[2.16,5.70,.065]} material={brass}/>
      <Stone position={[-1.2,0,.23]} scale={[2.01,5.55,.05]} material={panel}/>
    </group>
    <mesh position={[0,1.75,.65]} renderOrder={4}>
      <planeGeometry args={[4.75,5.75]}/>
      <meshBasicMaterial ref={painting} map={sky} transparent depthWrite={false} opacity={1} toneMapped={false}/>
    </mesh>
  </group>;
}

function Chamber({quality}:{quality:ThresholdQuality}){
  const stone=useMemo(()=>new THREE.MeshStandardMaterial({color:"#1e3039",roughness:.91}),[]);
  const bronze=useMemo(()=>new THREE.MeshStandardMaterial({color:"#ae875f",metalness:.73,roughness:.31}),[]);
  const glass=useMemo(()=>new THREE.MeshStandardMaterial({color:"#8bb7bc",roughness:.22,metalness:.12,emissive:"#23414a",emissiveIntensity:.22}),[]);
  useEffect(()=>()=>{stone.dispose();bronze.dispose();glass.dispose();},[stone,bronze,glass]);
  const stations=[
    {x:-3.2,label:0},{x:-1.6,label:1},{x:0,label:2},{x:1.6,label:3},{x:3.2,label:4}
  ];
  return <group position={[-1.7,0,-21]}>
    <Stone position={[0,-2,0]} scale={[13,.4,9]} material={stone}/>
    <Stone position={[0,5,-3]} scale={[12,.65,2]} material={stone}/>
    <Stone position={[-5,1,-3]} scale={[.8,9,5]} material={stone}/>
    <Stone position={[5,1,-3]} scale={[.8,9,5]} material={stone}/>
    {stations.map(s=><group key={s.label} position={[s.x,.85,0]}>
      <Stone position={[0,-.3,0]} scale={[1.2,.4,1.2]} material={stone}/>
      <mesh material={bronze} position={[0,.12,0]} rotation={[-Math.PI/2,0,0]}>
        <torusGeometry args={[.45,.07,8,quality==="low"?18:36]}/>
      </mesh>
      <mesh material={glass} position={[0,.18,0]}>
        <icosahedronGeometry args={[quality==="low"?.21:.27,quality==="high"?1:0]}/>
      </mesh>
    </group>)}
    <Stone position={[0,1.3,-1.5]} scale={[8.2,.11,.11]} material={bronze}/>
    <pointLight position={[0,4,2]} intensity={2.2} color="#bfd9df" distance={15}/>
  </group>;
}

/**
 * Three visual states share one persistent scene:
 * - authored painted cloudscape,
 * - physically opened architectural aperture,
 * - first inspectable evidence instrument (actual links remain in HTML).
 */
export function ThresholdScene({progressRef,quality}:{progressRef:ThresholdProgress;quality:ThresholdQuality}){
  const sky=useMemo(()=>makePaintedSky(quality),[quality]);
  useEffect(()=>()=>sky.dispose(),[sky]);
  const skyPlane=useRef<THREE.Mesh>(null);
  const skyMaterial=useRef<THREE.MeshBasicMaterial>(null);
  useFrame(()=>{
    if(skyPlane.current){
      // Revealed atmosphere remains spatial as the visitor travels forward.
      skyPlane.current.position.z=-11-phase(progressRef.current,.18,.27)*2;
    }
    // The painted layer must become transparent before the camera sees the
    // first engineering instrument, otherwise it masks the Knowledge room.
    if(skyMaterial.current)skyMaterial.current.opacity=1-phase(progressRef.current,.237,.267);
  });
  return <group>
    <hemisphereLight args={["#d5e7ec","#152029",1.4]}/>
    <ambientLight intensity={.55} color="#c1cfcd"/>
    <directionalLight position={[8,12,8]} color="#fff0d8" intensity={2.4}/>
    <pointLight position={[-3.5,3.5,3]} color="#f2c395" intensity={1.5} distance={12}/>
    <mesh ref={skyPlane} position={[0,2,-11]}>
      <planeGeometry args={[38,23]}/>
      <meshBasicMaterial ref={skyMaterial} map={sky} transparent opacity={1} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}/>
    </mesh>
    <ObservatoryArchitecture quality={quality}/>
    <Aperture progressRef={progressRef} sky={sky}/>
   </group>;
}
