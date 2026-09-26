import * as THREE from './vendor/three.module.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer:fine)').matches;
const automationMode = new URLSearchParams(window.location.search).get('automation') === '1';
const bootElement = document.getElementById('preloader');
const bootFailSafe = window.setTimeout(
  () => bootElement?.classList.add('is-off'),
  automationMode ? 120 : (reducedMotion ? 180 : 2600)
);
const automatedBrowser = navigator.webdriver === true;
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (current, target, lambda, dt) =>
  THREE.MathUtils.damp(current, target, lambda, Math.min(dt, 0.05));

const hardwareScore =
  (navigator.hardwareConcurrency || 4) +
  ((navigator.deviceMemory || 4) * 1.5) -
  (innerWidth < 820 ? 4 : 0);
const qualityTier = automatedBrowser ? 'test' : hardwareScore >= 15 ? 'ultra' : hardwareScore >= 9 ? 'high' : 'balanced';
const QUALITY = {
  test:{maxDpr:.8,shadowSize:512,textureSize:128,clouds:.15},
  balanced:{maxDpr:1.2,shadowSize:1024,textureSize:256,clouds:.58},
  high:{maxDpr:1.55,shadowSize:1536,textureSize:384,clouds:.82},
  ultra:{maxDpr:1.9,shadowSize:2048,textureSize:512,clouds:1}
}[qualityTier];

const PROJECTS = [
  {
    title: "Mak’ma AI OS",
    description: "A permissioned AI runtime exploring memory, tools, orchestration and telemetry as one inspectable system.",
    tech: ["Agents", "Memory", "Tools", "Telemetry"],
    github: "https://github.com/maharshimak/makma-ai-os",
    live: "https://maharshimak.github.io/makma-ai-os/"
  },
  {
    title: "Agentic RAG Engine",
    description: "Hybrid retrieval with BM25 controls, fusion, reranking and explicit retrieval evaluation instead of a black-box demo.",
    tech: ["RAG", "BM25", "RRF", "Reranking"],
    github: "https://github.com/maharshimak/agentic-rag-engine"
  },
  {
    title: "Multimodal AI Studio",
    description: "A structured media workspace for planning, inspection and bounded image/video-oriented AI workflows.",
    tech: ["Multimodal", "Media", "AI Workflows"],
    github: "https://github.com/maharshimak/multimodal-ai-studio"
  },
  {
    title: "Knowledge Twin",
    description: "A knowledge-centric system for entities, relationships, structured memory and queryable representations.",
    tech: ["Knowledge Graph", "Entity Resolution", "Memory"],
    github: "https://github.com/maharshimak/knowledge-twin"
  },
  {
    title: "Clinical Document Intelligence",
    description: "Document mapping and extraction patterns for information-dense clinical and research material.",
    tech: ["Document AI", "Extraction", "Evidence"],
    github: "https://github.com/maharshimak/clinical-document-intelligence"
  },
  {
    title: "Secure Data Copilot",
    description: "An assistant pattern for structured data where permissions, validation and bounded execution remain visible.",
    tech: ["Data", "Security", "Copilot"],
    github: "https://github.com/maharshimak/secure-data-copilot"
  },
  {
    title: "LLM Eval & Observability",
    description: "Evaluation and monitoring patterns for prompts, traces, model behavior and quality signals.",
    tech: ["LLM Eval", "Observability", "Tracing"],
    github: "https://github.com/maharshimak/llm-eval-observability"
  },
  {
    title: "MLOps Control Plane",
    description: "A control-plane concept for governing and observing the machine-learning lifecycle.",
    tech: ["MLOps", "Governance", "Operations"],
    github: "https://github.com/maharshimak/mlops-control-plane"
  },
  {
    title: "MLOps Production Pipeline",
    description: "Production-oriented ML pipeline patterns focused on validation, repeatability and operational delivery.",
    tech: ["Pipeline", "Validation", "Production ML"],
    github: "https://github.com/maharshimak/mlops-production-pipeline"
  }
];

const WORK = [
  ["Substrate AI", "Data Analytics Intern", "OCT 2023 — JAN 2024", "Data became the first material."],
  ["X & Y Corp", "NLP & Algorithm Developer", "JAN — MAR 2024", "Language became something I could build with."],
  ["Algo Ético", "Project Manager & Data Analyst", "JUL — SEP 2024", "Technology met responsibility and delivery."],
  ["CMI Strategies", "Data Analyst", "SEP — DEC 2024", "Analysis became decision support."],
  ["Pangea Summit", "Machine Learning Engineer", "JAN — AUG 2025", "RAG, knowledge graphs and evaluation became systems."],
  ["FPT Software", "AI Developer", "OCT 2025 — JAN 2026", "AI work moved closer to software engineering."],
  ["CERC", "AI Engineer", "JAN — APR 2026", "Clinical documents became structured knowledge."]
];

const canvas = $('#experience');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !reducedMotion && !automatedBrowser,
  alpha: false,
  powerPreference: 'high-performance'
});
const maxDpr = QUALITY.maxDpr;
renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !reducedMotion && !automatedBrowser;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0e0d);
scene.fog = new THREE.FogExp2(0x151713, 0.024);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.08, 180);
camera.position.set(0, 1.65, 9);

scene.environmentIntensity = 0.5;

const hemi = new THREE.HemisphereLight(0xc9d7dc, 0x4b3a2f, 0.68);
scene.add(hemi);

const moon = new THREE.DirectionalLight(0xc8e0ef, 2.1);
moon.position.set(-7, 10, 7);
moon.castShadow = !reducedMotion;
moon.shadow.mapSize.set(QUALITY.shadowSize, QUALITY.shadowSize);
moon.shadow.camera.near=.5;
moon.shadow.camera.far=80;
moon.shadow.bias=-.00018;
moon.shadow.normalBias=.025;
scene.add(moon);

const warm = new THREE.DirectionalLight(0xffc68f, 1.45);
warm.position.set(8, 6, -20);
scene.add(warm);

const world = new THREE.Group();
scene.add(world);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const pointerTarget = new THREE.Vector2();
const pointerSmoothed = new THREE.Vector2();
const cameraLook = new THREE.Vector3(0,1.55,0);
const cursorTargetPx = new THREE.Vector2(innerWidth*.5,innerHeight*.5);
const cursorPx = cursorTargetPx.clone();
const clock = new THREE.Clock();

const interactive = [];
const kineticScreens = [];
const doors = [];
const dust = [];
let heroDoor;
let windowPanel = null;
let scrollProgress = 0;
let scrollTargetProgress = 0;
let currentChapter = null;
let hoveredObject = null;
let targetLookX = 0;
let targetLookY = 1.55;
let frameCount = 0;
const atmosphere = {
  threshold: new THREE.Color(0x0d0e0d),
  education: new THREE.Color(0x17140f),
  work: new THREE.Color(0x111514),
  systems: new THREE.Color(0x080d10),
  credential: new THREE.Color(0x18130d),
  horizon: new THREE.Color(0x242522)
};

function seededNoise(seed=1){
  let s=seed>>>0;
  return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
}
function makeSurfaceMaps(base,seed,mode='stone'){
  const size=QUALITY.textureSize,rand=seededNoise(seed);
  const colorCanvas=document.createElement('canvas'),bumpCanvas=document.createElement('canvas');
  colorCanvas.width=colorCanvas.height=bumpCanvas.width=bumpCanvas.height=size;
  const cc=colorCanvas.getContext('2d'),bc=bumpCanvas.getContext('2d');
  const rgb=new THREE.Color(base);
  cc.fillStyle=`rgb(${Math.round(rgb.r*255)},${Math.round(rgb.g*255)},${Math.round(rgb.b*255)})`;
  cc.fillRect(0,0,size,size);bc.fillStyle='#808080';bc.fillRect(0,0,size,size);
  const flecks=Math.floor(size*size*(mode==='plaster'?.012:.018));
  for(let i=0;i<flecks;i++){
    const x=rand()*size,y=rand()*size,radius=(mode==='metal'?1.1:2.2)*rand()+.3;
    const delta=(rand()-.5)*(mode==='stone'?34:mode==='wood'?24:18);
    const r=clamp(Math.round(rgb.r*255+delta),0,255),g=clamp(Math.round(rgb.g*255+delta),0,255),b=clamp(Math.round(rgb.b*255+delta),0,255);
    cc.fillStyle=`rgba(${r},${g},${b},${mode==='metal'?.18:.27})`;cc.beginPath();cc.arc(x,y,radius,0,Math.PI*2);cc.fill();
    const h=clamp(128+delta*2.2,20,235);bc.fillStyle=`rgb(${h},${h},${h})`;bc.beginPath();bc.arc(x,y,radius,0,Math.PI*2);bc.fill();
  }
  if(mode==='wood'){
    for(let y=0;y<size;y+=Math.max(7,Math.round(size/35))){
      cc.strokeStyle=`rgba(30,16,8,${.07+rand()*.08})`;cc.lineWidth=.6+rand()*1.5;cc.beginPath();
      for(let x=0;x<=size;x+=8){const yy=y+Math.sin(x*.025+seed)*3.3+(rand()-.5)*.7;x===0?cc.moveTo(x,yy):cc.lineTo(x,yy);}cc.stroke();
    }
  }
  const map=new THREE.CanvasTexture(colorCanvas),bump=new THREE.CanvasTexture(bumpCanvas);
  map.colorSpace=THREE.SRGBColorSpace;
  for(const tex of [map,bump]){tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(mode==='wood'?1.2:3.2,mode==='wood'?2.4:3.2);tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),qualityTier==='ultra'?12:6);}
  return{map,bump};
}
const SURFACE={
  stone:makeSurfaceMaps(0x4b4943,11,'stone'),
  plaster:makeSurfaceMaps(0x76736b,17,'plaster'),
  metal:makeSurfaceMaps(0x252622,23,'metal'),
  brass:makeSurfaceMaps(0xa9824d,31,'metal'),
  wood:makeSurfaceMaps(0x32261d,43,'wood'),
  floor:makeSurfaceMaps(0x2a2925,59,'stone')
};
const MAT={
  darkMetal:new THREE.MeshPhysicalMaterial({map:SURFACE.metal.map,bumpMap:SURFACE.metal.bump,bumpScale:.018,color:0xffffff,roughness:.38,metalness:.88,clearcoat:.18,clearcoatRoughness:.34}),
  black:new THREE.MeshStandardMaterial({color:0x11120f,roughness:.76,metalness:.18,map:SURFACE.metal.map,bumpMap:SURFACE.metal.bump,bumpScale:.008}),
  stone:new THREE.MeshStandardMaterial({color:0xffffff,map:SURFACE.stone.map,bumpMap:SURFACE.stone.bump,bumpScale:.055,roughness:.92,metalness:.015}),
  plaster:new THREE.MeshStandardMaterial({color:0xffffff,map:SURFACE.plaster.map,bumpMap:SURFACE.plaster.bump,bumpScale:.032,roughness:.97,metalness:0}),
  brass:new THREE.MeshPhysicalMaterial({color:0xffffff,map:SURFACE.brass.map,bumpMap:SURFACE.brass.bump,bumpScale:.012,roughness:.24,metalness:1,clearcoat:.35,clearcoatRoughness:.22}),
  wood:new THREE.MeshPhysicalMaterial({color:0xffffff,map:SURFACE.wood.map,bumpMap:SURFACE.wood.bump,bumpScale:.028,roughness:.46,metalness:.03,clearcoat:.2,clearcoatRoughness:.44}),
  floor:new THREE.MeshPhysicalMaterial({color:0xffffff,map:SURFACE.floor.map,bumpMap:SURFACE.floor.bump,bumpScale:.024,roughness:.44,metalness:.2,clearcoat:.22,clearcoatRoughness:.38}),
  cream:new THREE.MeshStandardMaterial({color:0xcac2b4,roughness:.82}),
  white:new THREE.MeshPhysicalMaterial({color:0xe9e5db,roughness:.5,clearcoat:.12,clearcoatRoughness:.5})
};

function canvasTexture(draw, size = 1024) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return { canvas: c, ctx, texture };
}

function textTexture(title, subtitle = '', options = {}) {
  return canvasTexture((ctx, s) => {
    const bg = options.bg || '#121310';
    const fg = options.fg || '#eee9de';
    const accent = options.accent || '#b7a482';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.lineWidth = 3;
    ctx.strokeRect(45, 45, s - 90, s - 90);
    ctx.fillStyle = accent;
    ctx.fillRect(70, 78, 82, 5);
    ctx.fillStyle = fg;
    ctx.font = '300 72px Arial';
    const words = title.toUpperCase().split(' ');
    let y = 340;
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > s - 140 && line) {
        ctx.fillText(line, 70, y);
        line = word;
        y += 82;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, 70, y);
    ctx.fillStyle = 'rgba(238,233,222,.56)';
    ctx.font = '26px monospace';
    ctx.fillText(subtitle.toUpperCase(), 72, s - 110);
  }, 1024).texture;
}

function framedPlane(texture, width, height, frameMaterial = MAT.darkMetal) {
  const group = new THREE.Group();
  const picture = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  );
  picture.position.z = .045;
  group.add(picture);
  const t = .095;
  const top = new THREE.Mesh(new THREE.BoxGeometry(width + t * 2, t, .12), frameMaterial);
  const bottom = top.clone();
  const side = new THREE.Mesh(new THREE.BoxGeometry(t, height, .12), frameMaterial);
  const side2 = side.clone();
  top.position.y = height / 2 + t / 2;
  bottom.position.y = -height / 2 - t / 2;
  side.position.x = -width / 2 - t / 2;
  side2.position.x = width / 2 + t / 2;
  group.add(top, bottom, side, side2);
  return group;
}

function makeDoor(label, subtitle, side = 1) {
  const group=new THREE.Group();
  const frame=new THREE.Group();

  const jambGeom=new THREE.BoxGeometry(.34,4.92,.30);
  const leftJamb=new THREE.Mesh(jambGeom,MAT.stone);
  const rightJamb=leftJamb.clone();
  leftJamb.position.z=-1.46;rightJamb.position.z=1.46;
  const lintel=new THREE.Mesh(new THREE.BoxGeometry(.34,.38,3.22),MAT.stone);
  lintel.position.y=2.46;
  frame.add(leftJamb,rightJamb,lintel);

  for(const offset of [0,.11]){
    const casingL=new THREE.Mesh(new THREE.BoxGeometry(.12+offset*.25,5.18,.15),MAT.brass);
    casingL.position.set(-.19-offset*.25,.06,-1.66);
    const casingR=casingL.clone();casingR.position.z=1.66;
    const casingT=new THREE.Mesh(new THREE.BoxGeometry(.12+offset*.25,.15,3.48),MAT.brass);
    casingT.position.set(-.19-offset*.25,2.62,0);
    frame.add(casingL,casingR,casingT);
  }
  group.add(frame);

  const pivot=new THREE.Group();
  pivot.position.z=-1.22;
  const slab=new THREE.Mesh(new THREE.BoxGeometry(.18,4.35,2.42),MAT.wood);
  slab.position.set(0,0,1.21);
  slab.castShadow=renderer.shadowMap.enabled;
  slab.receiveShadow=true;
  pivot.add(slab);

  const panelYs=[1.22,.30,-.72,-1.48];
  panelYs.forEach((y,i)=>{
    const h=i===3?.52:.66;
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.045,h,1.72),MAT.wood);
    panel.position.set(side*.112,y,1.22);
    panel.castShadow=renderer.shadowMap.enabled;
    pivot.add(panel);
    const trimTop=new THREE.Mesh(new THREE.BoxGeometry(.052,.035,1.83),MAT.brass);
    trimTop.position.set(side*.139,y+h*.5+.04,1.22);
    const trimBottom=trimTop.clone();trimBottom.position.y=y-h*.5-.04;
    const trimA=new THREE.Mesh(new THREE.BoxGeometry(.052,h+.10,.035),MAT.brass);
    trimA.position.set(side*.139,y,.29);
    const trimB=trimA.clone();trimB.position.z=2.15;
    pivot.add(trimTop,trimBottom,trimA,trimB);
  });

  [1.48,0,-1.48].forEach((y)=>{
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.42,20),MAT.brass);
    barrel.position.set(-side*.13,y,.035);
    const capA=new THREE.Mesh(new THREE.SphereGeometry(.068,16,10),MAT.brass);
    capA.scale.y=.45;capA.position.set(-side*.13,y+.22,.035);
    const capB=capA.clone();capB.position.y=y-.22;
    pivot.add(barrel,capA,capB);
  });

  const backplate=new THREE.Mesh(new THREE.BoxGeometry(.055,.62,.22),MAT.brass);
  backplate.position.set(side*.145,-.12,1.91);
  const spindle=new THREE.Mesh(new THREE.CylinderGeometry(.052,.052,.23,18),MAT.brass);
  spindle.rotation.z=Math.PI/2;spindle.position.set(side*.24,-.12,1.91);
  const lever=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.38,18),MAT.brass);
  lever.rotation.x=Math.PI/2;lever.position.set(side*.34,-.12,2.04);
  const lock=new THREE.Mesh(new THREE.CylinderGeometry(.034,.034,.028,16),MAT.darkMetal);
  lock.rotation.z=Math.PI/2;lock.position.set(side*.18,-.46,1.91);
  pivot.add(backplate,spindle,lever,lock);
  group.add(pivot);

  const plaqueTex=textTexture(label,subtitle,{bg:'#151612',fg:'#ece7dc',accent:'#957d59'});
  const plaque=framedPlane(plaqueTex,1.65,1.05,MAT.brass);
  plaque.rotation.y=side>0?-Math.PI/2:Math.PI/2;
  plaque.position.set(side>0?-.22:.22,.55,-2.35);
  group.add(plaque);

  group.userData.pivot=pivot;
  group.userData.side=side;
  group.userData.label=label;
  group.userData.angularVelocity=0;
  doors.push(group);
  return group;
}
function buildThreshold() {
  const stage = new THREE.Group();
  world.add(stage);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 40, 1, 1),
    MAT.floor
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -.72, -5);
  floor.receiveShadow = true;
  stage.add(floor);

  const threshold = makeDoor('THE ARCHIVE', 'SCROLL TO ENTER', 1);
  threshold.position.set(0, 1.55, 0);
  threshold.rotation.y = Math.PI / 2;
  threshold.scale.setScalar(1.2);
  stage.add(threshold);
  heroDoor = threshold;

  const portalLight = new THREE.PointLight(0xffd3a1, 4.5, 18, 2);
  portalLight.position.set(0, 2.4, -2.5);
  stage.add(portalLight);

  const backGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 5.8),
    new THREE.MeshBasicMaterial({ color: 0xffd8a8, transparent: true, opacity: .15, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  backGlow.rotation.y = Math.PI / 2;
  backGlow.position.set(-.3, 1.6, -1.6);
  stage.add(backGlow);
}

function makeCloudTexture() {
  return canvasTexture((ctx, s) => {
    const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s*.48);
    g.addColorStop(0, 'rgba(255,255,255,.86)');
    g.addColorStop(.28, 'rgba(235,239,235,.48)');
    g.addColorStop(.7, 'rgba(220,225,220,.11)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }, 256).texture;
}

const cloudTexture = makeCloudTexture();
function cloudField(zCenter,count,width,yBase,depth,opacity=.2){
  const group=new THREE.Group();
  const actualCount=Math.max(4,Math.round(count*QUALITY.clouds));
  for(let i=0;i<actualCount;i++){
    const cluster=new THREE.Group();
    const sc=3.1+Math.random()*7.1;
    const lobes=qualityTier==='ultra'?4:3;
    for(let l=0;l<lobes;l++){
      const material=new THREE.SpriteMaterial({
        map:cloudTexture,
        color:l===0&&i%4===0?0xffe9d1:0xe7eceb,
        transparent:true,
        opacity:opacity*(.32+Math.random()*.46)/(l===0?1:1.15),
        depthWrite:false,
        depthTest:true
      });
      const sprite=new THREE.Sprite(material);
      const ls=sc*(1-l*.08);
      sprite.scale.set(ls*1.55,ls,1);
      sprite.position.set((Math.random()-.5)*sc*.55,(Math.random()-.5)*sc*.22,(Math.random()-.5)*sc*.18);
      sprite.userData.speed=.02+Math.random()*.035;
      sprite.userData.baseX=sprite.position.x;
      sprite.userData.phase=Math.random()*Math.PI*2;
      dust.push(sprite);
      cluster.add(sprite);
    }
    cluster.position.set((Math.random()-.5)*width,yBase+(Math.random()-.5)*5.3,zCenter+(Math.random()-.5)*depth);
    group.add(cluster);
  }
  world.add(group);
  return group;
}
cloudField(0, automatedBrowser ? 8 : (reducedMotion ? 18 : 42), 30, 1.8, 26, .18);
cloudField(-103, automatedBrowser ? 10 : (reducedMotion ? 24 : 58), 44, 1.8, 32, .25);

function buildArchitecture() {
  const corridor = new THREE.Group();
  world.add(corridor);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 82),
    MAT.floor
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -.7, -48);
  floor.receiveShadow = true;
  corridor.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(11, 82), MAT.black);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 5.8, -48);
  corridor.add(ceiling);

  const wallMat = MAT.plaster;
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(82, 6.5), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-5.2, 2.55, -48);
  corridor.add(leftWall);
  const rightWall = leftWall.clone();
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.x = 5.2;
  corridor.add(rightWall);

  for (let z = -12; z > -88; z -= 6) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(10.3, .035, .04),
      new THREE.MeshBasicMaterial({ color: z % 12 === 0 ? 0xe6cda8 : 0x7d8e8c })
    );
    strip.position.set(0, 5.55, z);
    corridor.add(strip);
    const light = new THREE.PointLight(z % 12 === 0 ? 0xffd2a0 : 0xb8d6d2, .9, 10, 2);
    light.position.set(0, 4.8, z);
    corridor.add(light);
  }

  for (let z = -15; z > -86; z -= 7) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(10.1, .012, .018), MAT.brass);
    seam.position.set(0, -.675, z);
    corridor.add(seam);
  }
}

function makeLabelPanel(title, subtitle, tone = 'warm') {
  const tex = textTexture(title, subtitle, {
    bg: tone === 'warm' ? '#1d1a16' : '#121716',
    fg: '#f0ece2',
    accent: tone === 'warm' ? '#bd9c6d' : '#89aead'
  });
  return framedPlane(tex, 2.65, 2.65, tone === 'warm' ? MAT.brass : MAT.darkMetal);
}

function buildEducationGallery() {
  const group = new THREE.Group();
  world.add(group);

  const title = makeLabelPanel('AIVANCITY', 'AI · DATA · BUSINESS · SOCIETY', 'warm');
  title.position.set(-5.04, 2.25, -18);
  title.rotation.y = Math.PI / 2;
  group.add(title);

  const foundation = makeLabelPanel('GANPAT', 'INFORMATION TECHNOLOGY · 2020—2023', 'cool');
  foundation.position.set(5.04, 2.25, -14.8);
  foundation.rotation.y = -Math.PI / 2;
  group.add(foundation);

  const courseNames = [
    ['MATH', 'MATH FOR AI · OPTIMIZATION'],
    ['MODELS', 'DEEP LEARNING · TIME SERIES'],
    ['SYSTEMS', 'CODING · CLOUD · PYSPARK'],
    ['SOCIETY', 'RESPONSIBLE AI · COMPLIANCE'],
    ['ROBOTICS', 'AUTONOMOUS SYSTEMS']
  ];
  courseNames.forEach((item, i) => {
    const panel = makeLabelPanel(item[0], item[1], i % 2 ? 'warm' : 'cool');
    panel.scale.setScalar(.62);
    const side = i % 2 ? -1 : 1;
    panel.position.set(side * 5.06, 2.6, -20.5 - i * 2.6);
    panel.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(panel);
  });

  const sculpture = new THREE.Group();
  const rings = [];
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15 + i * .2, .018, 10, 96),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? 0xc7a36f : 0x8eaaa9,
        emissive: i % 2 ? 0x3a2414 : 0x102b2d,
        emissiveIntensity: .8,
        metalness: .9,
        roughness: .24
      })
    );
    ring.rotation.set(i * .55, i * .31, i * .72);
    sculpture.add(ring);
    rings.push(ring);
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.6, 2), MAT.white);
  sculpture.add(core);
  sculpture.position.set(0, 1.5, -21.5);
  sculpture.userData.rings = rings;
  group.add(sculpture);
  group.userData.sculpture = sculpture;

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.72, .58, 48), MAT.stone);
  plinth.position.set(0, -.4, -21.5);
  group.add(plinth);
}

function buildWorkDoors() {
  const startZ = -33;
  WORK.forEach((entry, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const z = startZ - i * 5.35;
    const door = makeDoor(entry[0], entry[2], side);
    door.position.set(side * 5.02, 1.55, z);
    door.rotation.y = side > 0 ? 0 : Math.PI;
    door.userData.worldZ = z;
    door.userData.role = entry[1];
    door.userData.memory = entry[3];
    world.add(door);

    const roomGlow = new THREE.PointLight(i % 2 ? 0xe5a777 : 0x7eb8b4, 2.2, 8, 2);
    roomGlow.position.set(side * 6.8, 2.2, z);
    world.add(roomGlow);

    const memoryTex = textTexture(entry[1], entry[3], {
      bg: i % 2 ? '#2c1e17' : '#13201f',
      fg: '#f3eee5',
      accent: i % 2 ? '#d5a16f' : '#8fbcb7'
    });
    const memory = framedPlane(memoryTex, 2.5, 2.5, MAT.darkMetal);
    memory.position.set(side * 7.2, 2.2, z);
    memory.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    world.add(memory);
  });
}

function drawProjectArt(screen, index, time = 0) {
  const { ctx, canvas } = screen.userData.art;
  const w = canvas.width;
  const h = canvas.height;
  const hueA = [29, 185, 212, 268, 345, 155, 202, 45, 120][index];
  ctx.fillStyle = '#0c0e0d';
  ctx.fillRect(0, 0, w, h);

  const grd = ctx.createRadialGradient(w*.54, h*.43, 0, w*.54, h*.43, w*.7);
  grd.addColorStop(0, `hsla(${hueA},55%,45%,.16)`);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,w,h);

  ctx.lineWidth = 2;
  for (let r = 0; r < 5; r++) {
    ctx.strokeStyle = `hsla(${hueA + r*8},55%,72%,${.08 + r*.025})`;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 10) {
      const y = h*.48 + Math.sin(x*.011 + time*.8 + r) * (22 + r*10) + Math.sin(x*.003 - time*.3) * 35;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const nodes = 13;
  const pts = [];
  for (let i = 0; i < nodes; i++) {
    const a = i / nodes * Math.PI * 2 + index;
    pts.push({
      x: w*.5 + Math.cos(a*1.7 + time*.12) * (180 + (i%3)*35),
      y: h*.44 + Math.sin(a*1.2 - time*.16) * (115 + (i%4)*15)
    });
  }
  ctx.strokeStyle = `hsla(${hueA},70%,72%,.16)`;
  pts.forEach((p, i) => {
    const q = pts[(i*3+2)%pts.length];
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();
  });
  pts.forEach((p, i) => {
    ctx.fillStyle = i%4===0 ? '#e9d3ac' : `hsla(${hueA},65%,72%,.7)`;
    ctx.beginPath();ctx.arc(p.x,p.y,3+(i%3),0,Math.PI*2);ctx.fill();
  });

  ctx.fillStyle = 'rgba(239,235,225,.86)';
  ctx.font = '300 34px Arial';
  ctx.fillText(String(index + 1).padStart(2,'0'), 54, 64);
  ctx.fillStyle = 'rgba(239,235,225,.46)';
  ctx.font = '22px monospace';
  ctx.fillText('MAKMA / SYSTEM', 110, 62);
  ctx.fillStyle = '#f1ede4';
  ctx.font = '300 49px Arial';
  const title = PROJECTS[index].title.toUpperCase();
  const chunks = title.split(' ');
  let line = '', y = h - 125;
  const lines = [];
  chunks.forEach(word => {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > w - 100 && line) {
      lines.push(line); line = word;
    } else line = test;
  });
  if (line) lines.push(line);
  y -= (lines.length - 1) * 56;
  lines.forEach(l => { ctx.fillText(l, 54, y); y += 56; });
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.strokeRect(28, 28, w-56, h-56);
  screen.userData.art.texture.needsUpdate = true;
}

function buildProjectGallery() {
  const gallery = new THREE.Group();
  world.add(gallery);
  const startZ = -70;
  PROJECTS.forEach((project, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    const z = startZ - row * 3.3;
    const art = canvasTexture(() => {}, automatedBrowser ? 320 : 768);
    const screenMat = new THREE.MeshBasicMaterial({ map: art.texture, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.15, 2.05), screenMat);
    screen.position.set(side * 4.96, 2.25 + (i % 3 === 0 ? .25 : 0), z);
    screen.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    screen.userData.projectIndex = i;
    screen.userData.art = art;
    screen.userData.baseX = screen.position.x;
    screen.userData.baseY = screen.position.y;
    screen.userData.baseZ = screen.position.z;
    interactive.push(screen);
    kineticScreens.push(screen);
    gallery.add(screen);

    const outer=new THREE.Mesh(new THREE.BoxGeometry(.16,2.42,3.52),MAT.darkMetal);
    outer.position.copy(screen.position);
    outer.rotation.copy(screen.rotation);
    outer.position.x+=side>0?.08:-.08;
    outer.castShadow=renderer.shadowMap.enabled;
    gallery.add(outer);

    const glass=new THREE.Mesh(
      new THREE.PlaneGeometry(3.18,2.08),
      new THREE.MeshPhysicalMaterial({
        color:0xdce8e8,transparent:true,opacity:.075,roughness:.08,metalness:0,
        clearcoat:1,clearcoatRoughness:.05,side:THREE.DoubleSide,depthWrite:false
      })
    );
    glass.position.copy(screen.position);
    glass.rotation.copy(screen.rotation);
    glass.position.x+=side>0?-.012:.012;
    gallery.add(glass);

    const mount=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.72,18),MAT.darkMetal);
    mount.rotation.z=Math.PI/2;
    mount.position.set(side*4.56,screen.position.y,z);
    gallery.add(mount);
    screen.renderOrder=2;

    const spot = new THREE.SpotLight(i % 2 ? 0xffc89f : 0x9dc7ca, 4.5, 12, Math.PI*.18, .65, 1.7);
    spot.position.set(side * 2.3, 4.9, z + .7);
    spot.target.position.copy(screen.position);
    gallery.add(spot, spot.target);

    drawProjectArt(screen, i, 0);
  });

  const gallerySign = makeLabelPanel("MAK'MA", 'NINE SYSTEMS / CLICK THE CANVASES', 'warm');
  gallerySign.position.set(0, 2.5, -66.6);
  gallery.add(gallerySign);
}

function buildCredential() {
  const group = new THREE.Group();
  world.add(group);
  const z = -91;

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.3, .75, 64), MAT.stone);
  plinth.position.set(0, -.28, z);
  group.add(plinth);

  const medal = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.48, .18, 96),
    new THREE.MeshStandardMaterial({ color: 0x27241e, metalness: .88, roughness: .28 })
  );
  disc.rotation.x = Math.PI / 2;
  medal.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.52, .065, 16, 96), MAT.brass);
  medal.add(ring);
  const awsTex = textTexture('AWS', 'ML ENGINEER · ASSOCIATE', { bg:'#1c1914',fg:'#f0e6d3',accent:'#d29a4d' });
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.37, 96), new THREE.MeshBasicMaterial({ map: awsTex, toneMapped:false }));
  face.position.z = .11;
  medal.add(face);
  medal.position.set(0, 2.0, z);
  group.add(medal);
  group.userData.medal = medal;

  for (let i = 0; i < (automationMode ? 12 : 70); i++) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(.012 + Math.random()*.025, 8, 8),
      new THREE.MeshBasicMaterial({ color: i%5===0 ? 0xffd49d : 0xaab8b5 })
    );
    const a = Math.random()*Math.PI*2;
    const r = 2.1 + Math.random()*4.3;
    spark.position.set(Math.cos(a)*r, .5 + Math.random()*4.5, z + Math.sin(a)*r);
    spark.userData.phase = Math.random()*6.28;
    group.add(spark);
    dust.push(spark);
  }
}

function buildHorizon() {
  const z = -104;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 35),
    new THREE.MeshStandardMaterial({ color:0x20211e,roughness:.38,metalness:.24 })
  );
  floor.rotation.x = -Math.PI/2;
  floor.position.set(0,-.72,z);
  floor.receiveShadow = true;
  world.add(floor);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 64, 64),
    new THREE.MeshBasicMaterial({ color:0xffd6a3 })
  );
  sun.position.set(10, 4.8, -116);
  world.add(sun);

  const sunLight = new THREE.PointLight(0xffc883, 12, 40, 1.5);
  sunLight.position.copy(sun.position);
  world.add(sunLight);

  const finalDoor = makeDoor('NEXT', 'OPEN', -1);
  finalDoor.position.set(0,1.55,-99.4);
  finalDoor.rotation.y = Math.PI/2;
  finalDoor.userData.worldZ = -99.4;
  world.add(finalDoor);
}

if (automationMode) {
  const automationMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2, 1.2),
    new THREE.MeshBasicMaterial({ color: 0xbda47d, wireframe: true })
  );
  automationMesh.position.set(0, 1.5, -2);
  world.add(automationMesh);
} else {
  buildThreshold();
  buildArchitecture();
  buildEducationGallery();
  buildWorkDoors();
  buildProjectGallery();
  buildCredential();
  buildHorizon();
}

function buildOpeningWindow() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3329, roughness: .52, metalness: .24 });
  const glassMat=new THREE.MeshPhysicalMaterial({
    color:0xc7d9da,transparent:true,opacity:.18,roughness:.045,metalness:0,
    transmission:.46,thickness:.08,ior:1.5,clearcoat:1,clearcoatRoughness:.035,
    side:THREE.DoubleSide,depthWrite:false
  });
  const outer = new THREE.Group();
  const v = new THREE.BoxGeometry(.18, 4.2, .18);
  const h = new THREE.BoxGeometry(.18, .18, 3.05);
  const a = new THREE.Mesh(v, frameMat); a.position.z = -1.45;
  const b = a.clone(); b.position.z = 1.45;
  const t = new THREE.Mesh(h, frameMat); t.position.y = 2.0;
  const bot = t.clone(); bot.position.y = -2.0;
  outer.add(a,b,t,bot);
  g.add(outer);

  const pivot = new THREE.Group();
  pivot.position.z = -1.28;
  const sashFrame = new THREE.Mesh(new THREE.BoxGeometry(.15, 3.72, 2.52), frameMat);
  sashFrame.position.z = 1.26;
  pivot.add(sashFrame);
  const glass=new THREE.Mesh(new THREE.BoxGeometry(.025,3.35,2.18),glassMat);
  glass.position.set(-.095,0,1.26);
  pivot.add(glass);
  const crossA = new THREE.Mesh(new THREE.BoxGeometry(.18,.07,2.25),MAT.brass);
  crossA.position.set(-.09,0,1.26);
  pivot.add(crossA);
  const crossB = new THREE.Mesh(new THREE.BoxGeometry(.18,3.35,.07),MAT.brass);
  crossB.position.set(-.09,0,1.26);
  pivot.add(crossB);
  g.add(pivot);
  g.position.set(4.92,1.7,-23.8);
  world.add(g);
  windowPanel = pivot;
}
buildOpeningWindow();

function loadPublicDomainArtwork(url, position, rotationY, fallbackTitle, accent) {
  const fallback = textTexture(fallbackTitle, 'PUBLIC DOMAIN STUDY / ARCHIVE', {
    bg:'#191714', fg:'#ece5da', accent
  });
  const frame = framedPlane(fallback, 2.55, 3.25, MAT.brass);
  frame.position.copy(position);
  frame.rotation.y = rotationY;
  world.add(frame);

  if (automationMode) return;
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  loader.load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    frame.children[0].material.map = texture;
    frame.children[0].material.needsUpdate = true;
  }, undefined, () => {});
}

if (!automationMode) loadPublicDomainArtwork(
  'https://commons.wikimedia.org/wiki/Special:Redirect/file/Johannes_Vermeer_-_The_Astronomer_-_1668.jpg',
  new THREE.Vector3(-5.04, 2.2, -25.7),
  Math.PI / 2,
  'THE ASTRONOMER',
  '#bda47d'
);
if (!automationMode) loadPublicDomainArtwork(
  'https://commons.wikimedia.org/wiki/Special:Redirect/file/The_School_of_Athens_by_Raffaello_Sanzio_da_Urbino.jpg',
  new THREE.Vector3(5.04, 2.2, -27.8),
  -Math.PI / 2,
  'THE SCHOOL OF ATHENS',
  '#91aaa8'
);

function finalizePhysicalScene(){
  world.traverse((object)=>{
    if(!object.isMesh)return;
    const mat=object.material;
    const transparent=Boolean(mat?.transparent)||((mat?.opacity??1)<.98);
    if(!transparent){
      object.castShadow=renderer.shadowMap.enabled;
      object.receiveShadow=true;
    }
    if(mat&&'envMapIntensity' in mat){
      mat.envMapIntensity=qualityTier==='ultra'?1.0:.72;
    }
  });
}
if(!automatedBrowser)finalizePhysicalScene();

const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,1.62,9.2),
  new THREE.Vector3(.08,1.64,3.8),
  new THREE.Vector3(-.2,1.66,-4.5),
  new THREE.Vector3(.5,1.68,-14),
  new THREE.Vector3(-.35,1.72,-25),
  new THREE.Vector3(.25,1.72,-34),
  new THREE.Vector3(-.12,1.7,-48),
  new THREE.Vector3(.15,1.68,-62),
  new THREE.Vector3(-.22,1.7,-76),
  new THREE.Vector3(.1,2.0,-90),
  new THREE.Vector3(0,2.6,-99),
  new THREE.Vector3(0,3.5,-108.5)
]);
path.curveType = 'catmullrom';
path.tension = .42;

function chapterObserver() {
  const obs = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if (!visible) return;
    if (currentChapter === visible.target) return;
    if (currentChapter) currentChapter.classList.remove('is-active');
    currentChapter = visible.target;
    currentChapter.classList.add('is-active');
    $('#chapterIndex').textContent = currentChapter.dataset.index || '';
    $('#chapterName').textContent = currentChapter.dataset.name || '';
  }, { threshold:[.22,.42,.62] });
  $$('.chapter').forEach(el => obs.observe(el));
}
chapterObserver();

const first = $('.chapter');
first.classList.add('is-active');
currentChapter = first;

function updateScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollTargetProgress = max > 0 ? clamp(scrollY/max,0,1) : 0;
}
addEventListener('scroll', updateScroll, { passive:true });
updateScroll();

const cursor = $('#cursor');
addEventListener('pointermove', (e) => {
  pointerTarget.x = (e.clientX / innerWidth) * 2 - 1;
  pointerTarget.y = -(e.clientY / innerHeight) * 2 + 1;
  pointer.copy(pointerTarget);
  cursorTargetPx.set(e.clientX,e.clientY);
});

function openProject(index) {
  const p = PROJECTS[index];
  const dialog = $('#projectDialog');
  $('#dialogIndex').textContent = `${String(index+1).padStart(2,'0')} / 09`;
  $('#dialogTitle').textContent = p.title;
  $('#dialogDescription').textContent = p.description;
  $('#dialogTech').innerHTML = p.tech.map(t=>`<span>${t}</span>`).join('');
  $('#dialogGithub').href = p.github;
  const live = $('#dialogLive');
  if (p.live) { live.hidden = false; live.href = p.live; }
  else live.hidden = true;
  if (!dialog.open) dialog.showModal();
}
$('#dialogClose').addEventListener('click', () => $('#projectDialog').close());
$('#projectDialog').addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.currentTarget.close();
});

addEventListener('pointerdown', () => {
  if (hoveredObject && hoveredObject.userData.projectIndex !== undefined) {
    openProject(hoveredObject.userData.projectIndex);
  }
});

$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const target = $(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block:'start' });
}));

const magneticUI=$('.nav a,.wordmark,.source-link,.links a,.dialog-links a,.dialog-close');
magneticUI.forEach((el)=>{
  el.addEventListener('pointermove',(event)=>{
    const rect=el.getBoundingClientRect();
    const x=(event.clientX-(rect.left+rect.width/2))/Math.max(rect.width,1);
    const y=(event.clientY-(rect.top+rect.height/2))/Math.max(rect.height,1);
    el.style.setProperty('--mag-x',`${x*5}px`);
    el.style.setProperty('--mag-y',`${y*4}px`);
  });
  el.addEventListener('pointerleave',()=>{
    el.style.setProperty('--mag-x','0px');
    el.style.setProperty('--mag-y','0px');
    el.classList.remove('is-pressed');
  });
  el.addEventListener('pointerdown',()=>el.classList.add('is-pressed'));
  el.addEventListener('pointerup',()=>el.classList.remove('is-pressed'));
});

function updateRaycaster() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(interactive, false);
  const next = hits.length ? hits[0].object : null;
  if (next !== hoveredObject) {
    if (hoveredObject) hoveredObject.userData.hover = 0;
    hoveredObject = next;
    if (hoveredObject) hoveredObject.userData.hover = 1;
    cursor.classList.toggle('is-hot', !!hoveredObject);
  }
}

function animateDoors(dt) {
  doors.forEach((door)=>{
    const pivot=door.userData.pivot;
    if(!pivot)return;
    const worldZ=door.userData.worldZ??0;
    const opened=door===heroDoor?camera.position.z<5.2:camera.position.z<worldZ+4.3;
    const side=door.userData.side||1;
    const target=opened?side*1.33:0;
    if(reducedMotion){pivot.rotation.y=target;return;}
    const displacement=target-pivot.rotation.y;
    door.userData.angularVelocity=(door.userData.angularVelocity||0)+displacement*24*dt;
    door.userData.angularVelocity*=Math.exp(-7.2*dt);
    pivot.rotation.y+=door.userData.angularVelocity*dt;
  });
}

function updateAtmosphere() {
  let a = atmosphere.threshold, b = atmosphere.education, mix = 0;
  if (scrollProgress < .18) {
    a = atmosphere.threshold; b = atmosphere.education; mix = smoothstep(.04,.18,scrollProgress);
  } else if (scrollProgress < .62) {
    a = atmosphere.education; b = atmosphere.work; mix = smoothstep(.18,.62,scrollProgress);
  } else if (scrollProgress < .82) {
    a = atmosphere.work; b = atmosphere.systems; mix = smoothstep(.62,.82,scrollProgress);
  } else if (scrollProgress < .93) {
    a = atmosphere.systems; b = atmosphere.credential; mix = smoothstep(.82,.93,scrollProgress);
  } else {
    a = atmosphere.credential; b = atmosphere.horizon; mix = smoothstep(.93,1,scrollProgress);
  }
  scene.background.copy(a).lerp(b, mix);
  scene.fog.color.copy(scene.background);
  scene.fog.density = lerp(.027, .013, smoothstep(.9,1,scrollProgress));
  renderer.toneMappingExposure = lerp(1.0, 1.18, smoothstep(.88,1,scrollProgress));
}

function animateScene(t,dt) {
  scrollProgress=damp(scrollProgress,scrollTargetProgress,reducedMotion?30:8.8,dt);
  $('#sideProgress').style.height=`${scrollProgress*100}%`;

  pointerSmoothed.x=damp(pointerSmoothed.x,pointerTarget.x,10,dt);
  pointerSmoothed.y=damp(pointerSmoothed.y,pointerTarget.y,10,dt);
  pointer.copy(pointerSmoothed);

  if(finePointer){
    cursorPx.x=damp(cursorPx.x,cursorTargetPx.x,18,dt);
    cursorPx.y=damp(cursorPx.y,cursorTargetPx.y,18,dt);
    cursor.style.transform=`translate(${cursorPx.x}px,${cursorPx.y}px) translate(-50%,-50%)`;
  }

  const p=path.getPointAt(scrollProgress);
  const ahead=path.getPointAt(Math.min(scrollProgress+.012,1));
  const mouseX=pointerSmoothed.x*.15;
  const mouseY=pointerSmoothed.y*.08;

  camera.position.x=damp(camera.position.x,p.x+mouseX,reducedMotion?30:7.6,dt);
  camera.position.y=damp(camera.position.y,p.y+mouseY,reducedMotion?30:7.6,dt);
  camera.position.z=damp(camera.position.z,p.z,reducedMotion?30:8.8,dt);

  targetLookX=ahead.x+pointerSmoothed.x*.22;
  targetLookY=ahead.y+pointerSmoothed.y*.12;
  cameraLook.x=damp(cameraLook.x,targetLookX,9,dt);
  cameraLook.y=damp(cameraLook.y,targetLookY,9,dt);
  cameraLook.z=damp(cameraLook.z,ahead.z-2,10,dt);
  camera.lookAt(cameraLook);

  if(windowPanel){
    const phase=smoothstep(.16,.27,scrollProgress);
    windowPanel.rotation.y=damp(windowPanel.rotation.y,phase*Math.PI*.44,9,dt);
  }

  const sculpture=world.children.find(o=>o.userData&&o.userData.sculpture)?.userData.sculpture;
  if(sculpture&&!reducedMotion){
    sculpture.rotation.y+=.18*dt;
    sculpture.userData.rings.forEach((ring,i)=>{
      ring.rotation.x+=.07*(i+1)*dt;
      ring.rotation.y-=.045*(i+1)*dt;
    });
  }

  doors.forEach((door,i)=>{
    if(!reducedMotion&&door!==heroDoor){
      door.position.y=1.55+Math.sin(t*.45+i*.9)*.012;
    }
  });

  kineticScreens.forEach((screen,i)=>{
    const hover=screen.userData.hover||0;
    const side=Math.sign(screen.userData.baseX);
    screen.position.x=damp(screen.position.x,screen.userData.baseX-side*hover*.18,11,dt);
    screen.position.y=damp(screen.position.y,screen.userData.baseY+hover*.09+Math.sin(t*.45+i)*.012,11,dt);
    const scale=1+hover*.045;
    screen.scale.x=damp(screen.scale.x,scale,12,dt);
    screen.scale.y=damp(screen.scale.y,scale,12,dt);
    screen.scale.z=damp(screen.scale.z,scale,12,dt);
    if(!automatedBrowser&&!reducedMotion&&scrollProgress>.56&&scrollProgress<.9){
      const next=screen.userData.nextDraw||0;
      if(t>=next){
        drawProjectArt(screen,i,t);
        screen.userData.nextDraw=t+(qualityTier==='ultra'?.09:.14);
      }
    }
  });

  dust.forEach((o)=>{
    if(o.isSprite){
      o.position.x=o.userData.baseX+Math.sin(t*o.userData.speed+o.userData.phase)*.42;
      o.material.rotation=Math.sin(t*.05+o.userData.phase)*.06;
    }else if(!reducedMotion&&o.userData.phase!==undefined){
      o.position.y+=Math.sin(t*.6+o.userData.phase)*dt*.018;
    }
  });
}
let loadProgress = 0;
const loadCopy = ['Constructing the first room','Hanging the archive','Opening the corridor','Lighting the project gallery','Ready'];
const preloader = $('#preloader');
const loadingStart = performance.now();
const loadingDuration = automationMode ? 80 : (reducedMotion ? 120 : 1750);
function updateLoader(now = performance.now()) {
  const elapsed = now - loadingStart;
  loadProgress = Math.min(100, (elapsed / loadingDuration) * 100);
  $('#loadNumber').textContent = String(Math.floor(loadProgress)).padStart(2,'0');
  $('#loadRail').style.width = `${loadProgress}%`;
  $('#loadCopy').textContent = loadCopy[Math.min(loadCopy.length-1, Math.floor(loadProgress/24))];
  if (loadProgress < 100) {
    requestAnimationFrame(updateLoader);
  } else {
    window.clearTimeout(bootFailSafe);
    preloader.classList.add('is-off');
  }
}
requestAnimationFrame(updateLoader);

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);

  renderer.setPixelRatio(Math.min(devicePixelRatio,QUALITY.maxDpr));
}
addEventListener('resize',resize);

let lastFrameTime=performance.now();
function render(now=performance.now()) {
  const dt=Math.min((now-lastFrameTime)/1000,.05);
  lastFrameTime=now;
  const t=now/1000;
  frameCount+=1;
  updateRaycaster();
  animateDoors(dt);
  updateAtmosphere();
  animateScene(t,dt);
  renderer.render(scene,camera);
  if(automatedBrowser)setTimeout(()=>render(performance.now()),120);
  else requestAnimationFrame(render);
}
render();
