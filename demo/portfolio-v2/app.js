import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer:fine)').matches;
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

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
  antialias: !reducedMotion,
  alpha: false,
  powerPreference: 'high-performance'
});
const maxDpr = innerWidth < 800 ? 1.15 : 1.6;
renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !reducedMotion;
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
moon.shadow.mapSize.set(1024, 1024);
scene.add(moon);

const warm = new THREE.DirectionalLight(0xffc68f, 1.45);
warm.position.set(8, 6, -20);
scene.add(warm);

const world = new THREE.Group();
scene.add(world);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const pointerTarget = new THREE.Vector2();
const clock = new THREE.Clock();

const interactive = [];
const kineticScreens = [];
const doors = [];
const dust = [];
let heroDoor;
let windowPanel = null;
let scrollProgress = 0;
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

const MAT = {
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x171816, roughness: .54, metalness: .65 }),
  black: new THREE.MeshStandardMaterial({ color: 0x10110f, roughness: .78, metalness: .12 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x37352f, roughness: .92, metalness: .03 }),
  plaster: new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: .95 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xa88451, roughness: .28, metalness: .9 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xcac2b4, roughness: .82 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe9e5db, roughness: .62 })
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
  const group = new THREE.Group();
  const frame = new THREE.Group();
  const pillarGeom = new THREE.BoxGeometry(.28, 4.85, .28);
  const leftPillar = new THREE.Mesh(pillarGeom, MAT.stone);
  const rightPillar = leftPillar.clone();
  leftPillar.position.z = -1.42;
  rightPillar.position.z = 1.42;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(.28, .32, 3.15), MAT.stone);
  lintel.position.y = 2.43;
  frame.add(leftPillar, rightPillar, lintel);
  group.add(frame);

  const pivot = new THREE.Group();
  pivot.position.z = -1.22;
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(.16, 4.35, 2.42),
    new THREE.MeshStandardMaterial({
      color: side > 0 ? 0x24231f : 0x1c201e,
      roughness: .54,
      metalness: .18
    })
  );
  panel.position.set(0, 0, 1.21);
  panel.castShadow = !reducedMotion;
  panel.receiveShadow = true;
  pivot.add(panel);

  for (let i = 0; i < 4; i++) {
    const inset = new THREE.Mesh(new THREE.BoxGeometry(.175, .055, 1.85), MAT.brass);
    inset.position.set(side * .02, 1.2 - i * .8, 1.2);
    pivot.add(inset);
  }
  const handle = new THREE.Mesh(new THREE.SphereGeometry(.095, 18, 18), MAT.brass);
  handle.position.set(side * .13, -.1, 2.0);
  pivot.add(handle);
  group.add(pivot);

  const plaqueTex = textTexture(label, subtitle, { bg: '#151612', fg: '#ece7dc', accent: '#957d59' });
  const plaque = framedPlane(plaqueTex, 1.65, 1.05, MAT.brass);
  plaque.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  plaque.position.set(side > 0 ? -.22 : .22, .55, -2.35);
  group.add(plaque);

  group.userData.pivot = pivot;
  group.userData.side = side;
  group.userData.label = label;
  doors.push(group);
  return group;
}

function buildThreshold() {
  const stage = new THREE.Group();
  world.add(stage);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 40, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x151612, roughness: .9, metalness: .05 })
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
function cloudField(zCenter, count, width, yBase, depth, opacity = .2) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({
      map: cloudTexture,
      color: i % 4 === 0 ? 0xffe9d1 : 0xe6edf0,
      transparent: true,
      opacity: opacity * (.55 + Math.random() * .65),
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const sprite = new THREE.Sprite(material);
    const sc = 3.2 + Math.random() * 7.5;
    sprite.scale.set(sc * 1.55, sc, 1);
    sprite.position.set(
      (Math.random() - .5) * width,
      yBase + (Math.random() - .5) * 5.5,
      zCenter + (Math.random() - .5) * depth
    );
    sprite.userData.speed = .025 + Math.random() * .06;
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.phase = Math.random() * Math.PI * 2;
    dust.push(sprite);
    group.add(sprite);
  }
  world.add(group);
  return group;
}
cloudField(0, reducedMotion ? 18 : 42, 30, 1.8, 26, .18);
cloudField(-103, reducedMotion ? 24 : 58, 44, 1.8, 32, .25);

function buildArchitecture() {
  const corridor = new THREE.Group();
  world.add(corridor);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 82),
    new THREE.MeshStandardMaterial({ color: 0x24241f, roughness: .76, metalness: .08 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -.7, -48);
  floor.receiveShadow = true;
  corridor.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(11, 82), MAT.black);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 5.8, -48);
  corridor.add(ceiling);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4b4942, roughness: .92, metalness: .02 });
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
    const art = canvasTexture(() => {}, 768);
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

    const outer = new THREE.Mesh(new THREE.BoxGeometry(.15, 2.35, 3.45), MAT.darkMetal);
    outer.position.copy(screen.position);
    outer.rotation.copy(screen.rotation);
    outer.position.x += side > 0 ? .075 : -.075;
    gallery.add(outer);
    screen.renderOrder = 2;

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

  for (let i = 0; i < 70; i++) {
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

buildThreshold();
buildArchitecture();
buildEducationGallery();
buildWorkDoors();
buildProjectGallery();
buildCredential();
buildHorizon();

function buildOpeningWindow() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3329, roughness: .52, metalness: .24 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xb5d0d1, transparent: true, opacity: .24, roughness: .08, metalness: .04,
    transmission: .25, side: THREE.DoubleSide
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
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.18,3.35),glassMat);
  glass.rotation.y = Math.PI/2;
  glass.position.set(-.085,0,1.26);
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

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  loader.load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    frame.children[0].material.map = texture;
    frame.children[0].material.needsUpdate = true;
  }, undefined, () => {});
}

loadPublicDomainArtwork(
  'https://commons.wikimedia.org/wiki/Special:Redirect/file/Johannes_Vermeer_-_The_Astronomer_-_1668.jpg',
  new THREE.Vector3(-5.04, 2.2, -25.7),
  Math.PI / 2,
  'THE ASTRONOMER',
  '#bda47d'
);
loadPublicDomainArtwork(
  'https://commons.wikimedia.org/wiki/Special:Redirect/file/The_School_of_Athens_by_Raffaello_Sanzio_da_Urbino.jpg',
  new THREE.Vector3(5.04, 2.2, -27.8),
  -Math.PI / 2,
  'THE SCHOOL OF ATHENS',
  '#91aaa8'
);

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
  scrollProgress = max > 0 ? clamp(scrollY/max,0,1) : 0;
  $('#sideProgress').style.height = `${scrollProgress*100}%`;
}
addEventListener('scroll', updateScroll, { passive:true });
updateScroll();

const cursor = $('#cursor');
addEventListener('pointermove', (e) => {
  pointerTarget.x = (e.clientX / innerWidth) * 2 - 1;
  pointerTarget.y = -(e.clientY / innerHeight) * 2 + 1;
  pointer.copy(pointerTarget);
  if (finePointer) cursor.style.transform = `translate(${e.clientX}px,${e.clientY}px) translate(-50%,-50%)`;
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

function animateDoors() {
  doors.forEach((door, i) => {
    const pivot = door.userData.pivot;
    if (!pivot) return;
    const worldZ = door.userData.worldZ ?? 0;
    let opened;
    if (door === heroDoor) opened = camera.position.z < 5.2;
    else opened = camera.position.z < worldZ + 4.3;
    const side = door.userData.side || 1;
    const target = opened ? side * 1.33 : 0;
    pivot.rotation.y = lerp(pivot.rotation.y, target, reducedMotion ? .18 : .055);
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

function animateScene(t) {
  const p = path.getPointAt(scrollProgress);
  const ahead = path.getPointAt(Math.min(scrollProgress + .012, 1));

  const mouseX = pointerTarget.x * .15;
  const mouseY = pointerTarget.y * .08;
  camera.position.x = lerp(camera.position.x, p.x + mouseX, reducedMotion ? .2 : .055);
  camera.position.y = lerp(camera.position.y, p.y + mouseY, reducedMotion ? .2 : .055);
  camera.position.z = lerp(camera.position.z, p.z, reducedMotion ? .2 : .065);

  targetLookX = ahead.x + pointerTarget.x * .22;
  targetLookY = ahead.y + pointerTarget.y * .12;
  const look = new THREE.Vector3(targetLookX, targetLookY, ahead.z - 2.0);
  camera.lookAt(look);

  if (windowPanel) {
    const phase = smoothstep(.16,.27,scrollProgress);
    windowPanel.rotation.y = phase * Math.PI * .44;
  }

  const sculpture = world.children.find(o => o.userData && o.userData.sculpture)?.userData.sculpture;
  if (sculpture && !reducedMotion) {
    sculpture.rotation.y = t*.18;
    sculpture.userData.rings.forEach((ring,i)=>{
      ring.rotation.x += .0012*(i+1);
      ring.rotation.y -= .0008*(i+1);
    });
  }

  doors.forEach((door,i) => {
    if (!reducedMotion && door !== heroDoor) door.position.y = 1.55 + Math.sin(t*.45+i*.9)*.018;
  });

  kineticScreens.forEach((screen,i)=>{
    const hover = screen.userData.hover || 0;
    const side = Math.sign(screen.userData.baseX);
    screen.position.x = lerp(screen.position.x, screen.userData.baseX - side*hover*.18, .08);
    screen.position.y = lerp(screen.position.y, screen.userData.baseY + hover*.09 + Math.sin(t*.45+i)*.018, .08);
    const scale = 1 + hover*.045;
    screen.scale.x = lerp(screen.scale.x,scale,.1);
    screen.scale.y = lerp(screen.scale.y,scale,.1);
    if (!reducedMotion && scrollProgress > .56 && scrollProgress < .9 && frameCount % 24 === 0) drawProjectArt(screen,i,t);
  });

  dust.forEach((o,i)=>{
    if (o.isSprite) {
      o.position.x = o.userData.baseX + Math.sin(t*o.userData.speed + o.userData.phase)*.5;
      o.material.rotation = Math.sin(t*.05 + o.userData.phase)*.08;
    } else if (!reducedMotion) {
      o.position.y += Math.sin(t*.6 + o.userData.phase)*.0006;
    }
  });
}

let loadProgress = 0;
const loadCopy = ['Constructing the first room','Hanging the archive','Opening the corridor','Lighting the project gallery','Ready'];
const preloader = $('#preloader');
const loadingStart = performance.now();
function updateLoader() {
  const elapsed = performance.now() - loadingStart;
  const externalReady = elapsed > (reducedMotion ? 250 : 1400);
  loadProgress = Math.min(100, loadProgress + (externalReady ? 4.2 : 2.1));
  $('#loadNumber').textContent = String(Math.floor(loadProgress)).padStart(2,'0');
  $('#loadRail').style.width = `${loadProgress}%`;
  $('#loadCopy').textContent = loadCopy[Math.min(loadCopy.length-1, Math.floor(loadProgress/24))];
  if (loadProgress < 100) requestAnimationFrame(updateLoader);
  else setTimeout(()=>preloader.classList.add('is-off'), reducedMotion ? 20 : 280);
}
requestAnimationFrame(updateLoader);

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);

  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 800 ? 1.15 : 1.6));
}
addEventListener('resize',resize);

function render() {
  const t = clock.getElapsedTime();
  updateRaycaster();
  animateDoors();
  animateScene(t);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();
