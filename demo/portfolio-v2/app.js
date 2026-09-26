import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;\nconst gsap = window.gsap;\nconst ScrollTrigger = window.ScrollTrigger;
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];

const state = {
  mouse: { x: 0, y: 0, nx: 0, ny: 0 },
  scroll: 0,
  section: 'home',
  sceneTarget: new THREE.Vector3(0, 0, 0),
  targetScale: 1,
  targetEnergy: 1
};

// ---------- Boot sequence ----------
const boot = $('#boot');
const bootText = $('#bootText');
const bootMessages = [
  'Loading intelligence layer…',
  'Linking education + experience…',
  'Mounting MAK’MA systems…',
  'Telemetry online.'
];
let bootStep = 0;
const bootTimer = setInterval(() => {
  bootStep += 1;
  if (bootStep < bootMessages.length) bootText.textContent = bootMessages[bootStep];
  if (bootStep === bootMessages.length - 1) {
    clearInterval(bootTimer);
    setTimeout(() => boot.classList.add('is-off'), reducedMotion ? 50 : 420);
  }
}, reducedMotion ? 60 : 300);

// ---------- Pointer layer ----------
const glow = $('#cursorGlow');
window.addEventListener('pointermove', (e) => {
  state.mouse.x = e.clientX;
  state.mouse.y = e.clientY;
  state.mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
  state.mouse.ny = -((e.clientY / window.innerHeight) * 2 - 1);
  glow.style.transform = `translate(${e.clientX - 180}px,${e.clientY - 180}px)`;
});

// ---------- Spotlight + magnetic interactions ----------
$$('.spotlight-card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

if (!reducedMotion) {
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${x * 0.12}px,${y * 0.12}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

// ---------- Scramble text ----------
function scramble(el, finalText) {
  if (reducedMotion) return;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/_';
  let frame = 0;
  const total = finalText.length * 2.2;
  const tick = () => {
    frame += 1;
    el.textContent = finalText
      .split('')
      .map((c, i) => {
        if (c === ' ') return ' ';
        if (i < frame / 2.2) return finalText[i];
        return chars[Math.floor(Math.random() * chars.length)];
      })
      .join('');
    if (frame < total) requestAnimationFrame(tick);
    else el.textContent = finalText;
  };
  setTimeout(tick, 1200);
}
$$('.scramble').forEach((el) => scramble(el, el.dataset.text || el.textContent));

// ---------- GSAP motion ----------
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);

  gsap.utils.toArray('.reveal').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: reducedMotion ? 0.01 : 0.85,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 86%',
        once: true
      }
    });
  });

  gsap.to('.hero__copy', {
    yPercent: reducedMotion ? 0 : 14,
    opacity: reducedMotion ? 1 : 0.34,
    ease: 'none',
    scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: true }
  });

  gsap.to('.hero__telemetry', {
    yPercent: reducedMotion ? 0 : -10,
    ease: 'none',
    scrollTrigger: { trigger: '#home', start: 'top top', end: 'bottom top', scrub: true }
  });

  gsap.utils.toArray('.timeline-item').forEach((item) => {
    gsap.fromTo(item.querySelector('.timeline-node'),
      { scale: .65, boxShadow: '0 0 0 rgba(0,0,0,0)' },
      {
        scale: 1.12,
        boxShadow: '0 0 0 7px rgba(78,144,202,.07),0 0 28px rgba(90,169,236,.28)',
        scrollTrigger: { trigger: item, start: 'top 62%', end: 'bottom 45%', scrub: true }
      }
    );
  });
}

// ---------- Counters ----------
const counterObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const end = Number(el.dataset.counter);
    const start = performance.now();
    const duration = reducedMotion ? 1 : 900;
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = String(Math.floor(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = String(end);
    };
    requestAnimationFrame(step);
    observer.unobserve(el);
  });
}, { threshold: .7 });
$$('[data-counter]').forEach((el) => counterObserver.observe(el));

// ---------- Active section / scene state ----------
const scenePresets = {
  core:      { x: 1.75, y: .15, z: 0, scale: 1.12, energy: 1.0 },
  identity:  { x: 2.25, y: -.2, z: 0, scale: .9, energy: .82 },
  network:   { x: -2.1, y: .2, z: 0, scale: 1.02, energy: 1.22 },
  path:      { x: 2.45, y: .3, z: 0, scale: .72, energy: .7 },
  systems:   { x: -2.4, y: -.25, z: 0, scale: 1.16, energy: 1.35 },
  signal:    { x: 1.85, y: .1, z: 0, scale: .84, energy: .95 },
  lab:       { x: 0, y: .05, z: 0, scale: 1.25, energy: 1.5 },
  contact:   { x: 0, y: .6, z: 0, scale: .68, energy: .55 }
};

const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((e) => e.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  const id = visible.target.id;
  const presetName = visible.target.dataset.scene || 'core';
  const p = scenePresets[presetName];
  state.section = id;
  state.sceneTarget.set(p.x, p.y, p.z);
  state.targetScale = p.scale;
  state.targetEnergy = p.energy;
  $$('.rail__dot').forEach((dot) => dot.classList.toggle('is-active', dot.dataset.section === id));
}, { threshold: [.28, .5, .72] });

$$('.section').forEach((section) => sectionObserver.observe(section));

window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  state.scroll = max > 0 ? scrollY / max : 0;
  $('#progress').style.width = `${state.scroll * 100}%`;
}, { passive: true });

// ---------- Education orbit reaction ----------
const skillButtons = $$('#skillOrbit button');
skillButtons.forEach((button) => {
  const activate = () => {
    skillButtons.forEach((b) => b.classList.remove('is-hot'));
    button.classList.add('is-hot');
    const core = $('.orbit-core');
    core.animate(
      [
        { transform: 'scale(1)', boxShadow: '0 0 70px rgba(83,157,222,.12)' },
        { transform: 'scale(1.06)', boxShadow: '0 0 90px rgba(83,157,222,.26)' },
        { transform: 'scale(1)', boxShadow: '0 0 70px rgba(83,157,222,.12)' }
      ],
      { duration: 650, easing: 'ease-out' }
    );
  };
  button.addEventListener('pointerenter', activate);
  button.addEventListener('focus', activate);
});

// ---------- Project filters ----------
$$('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    $$('[data-filter]').forEach((b) => b.classList.remove('is-active'));
    button.classList.add('is-active');
    const filter = button.dataset.filter;
    $$('.project[data-category]').forEach((project) => {
      const categories = project.dataset.category.split(' ');
      project.classList.toggle('is-hidden', filter !== 'all' && !categories.includes(filter));
    });
  });
});

// ---------- Agent system map ----------
const mapCopy = $('#mapCopy');
$$('.map-node').forEach((node) => {
  const activate = () => {
    $$('.map-node').forEach((n) => n.classList.remove('is-active'));
    node.classList.add('is-active');
    mapCopy.textContent = node.dataset.copy;
  };
  node.addEventListener('pointerenter', activate);
  node.addEventListener('focus', activate);
});

// ---------- Three.js: living AI core ----------
const canvas = $('#world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !reducedMotion, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 100);
camera.position.set(0, 0, 8.2);

const root = new THREE.Group();
scene.add(root);

const coreGroup = new THREE.Group();
root.add(coreGroup);

// Particle globe using Fibonacci distribution
const particleCount = reducedMotion ? 520 : 1450;
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  const y = 1 - (i / (particleCount - 1)) * 2;
  const radius = Math.sqrt(1 - y * y);
  const theta = Math.PI * (3 - Math.sqrt(5)) * i;
  const r = 1.36 + (Math.sin(i * 12.9898) * .028);
  positions[i * 3] = Math.cos(theta) * radius * r;
  positions[i * 3 + 1] = y * r;
  positions[i * 3 + 2] = Math.sin(theta) * radius * r;
}
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particleMaterial = new THREE.PointsMaterial({
  color: 0x9fd4ff,
  size: reducedMotion ? .018 : .022,
  transparent: true,
  opacity: .76,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});
const globe = new THREE.Points(particleGeometry, particleMaterial);
coreGroup.add(globe);

// Inner energy
const inner = new THREE.Mesh(
  new THREE.IcosahedronGeometry(.72, 3),
  new THREE.MeshBasicMaterial({ color: 0x8ac8ff, wireframe: true, transparent: true, opacity: .09 })
);
coreGroup.add(inner);

// Orbital rings
const ringMaterial = new THREE.LineBasicMaterial({ color: 0x78bdf4, transparent: true, opacity: .17, blending: THREE.AdditiveBlending });
const rings = [];
[
  [1.88, .18, .35],
  [2.06, 1.25, -.22],
  [1.72, -.8, 1.15]
].forEach(([radius, rx, ry]) => {
  const pts = [];
  for (let i = 0; i <= 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * .53, 0));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const ring = new THREE.Line(geo, ringMaterial.clone());
  ring.rotation.x = rx;
  ring.rotation.y = ry;
  coreGroup.add(ring);
  rings.push(ring);
});

// Orbit nodes
const nodeGeo = new THREE.SphereGeometry(.035, 10, 10);
const nodeMatBlue = new THREE.MeshBasicMaterial({ color: 0xbfe4ff });
const nodeMatAmber = new THREE.MeshBasicMaterial({ color: 0xffbd78 });
const orbitNodes = [];
for (let i = 0; i < 12; i++) {
  const node = new THREE.Mesh(nodeGeo, i % 4 === 0 ? nodeMatAmber : nodeMatBlue);
  const a = (i / 12) * Math.PI * 2;
  const rr = 1.75 + (i % 3) * .16;
  node.position.set(Math.cos(a) * rr, Math.sin(a * 1.3) * .8, Math.sin(a) * rr * .32);
  coreGroup.add(node);
  orbitNodes.push(node);
}

// Star field
const starCount = reducedMotion ? 220 : 750;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const radius = 7 + Math.random() * 14;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
  starPos[i * 3 + 2] = radius * Math.cos(phi);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0xbfdcff, size: .012, transparent: true, opacity: .5, depthWrite: false
}));
scene.add(stars);

// Decorative grid plane
const grid = new THREE.GridHelper(18, 34, 0x245278, 0x11283a);
grid.position.y = -3.1;
grid.material.transparent = true;
grid.material.opacity = .11;
scene.add(grid);

let currentScale = 1;
let energy = 1;
const clock = new THREE.Clock();

function animate3D() {
  const t = clock.getElapsedTime();
  const lerp = THREE.MathUtils.lerp;

  root.position.x = lerp(root.position.x, state.sceneTarget.x + state.mouse.nx * .16, .035);
  root.position.y = lerp(root.position.y, state.sceneTarget.y + state.mouse.ny * .1, .035);
  currentScale = lerp(currentScale, state.targetScale, .035);
  energy = lerp(energy, state.targetEnergy, .025);
  root.scale.setScalar(currentScale);

  if (!reducedMotion) {
    coreGroup.rotation.y += .0018 * energy;
    coreGroup.rotation.x = lerp(coreGroup.rotation.x, state.mouse.ny * .08 + Math.sin(t * .22) * .025, .03);
    globe.rotation.y += .0009 * energy;
    inner.rotation.x += .0025;
    inner.rotation.y -= .0035;
    rings.forEach((ring, i) => {
      ring.rotation.z += (.0007 + i * .00035) * (i % 2 ? -1 : 1) * energy;
      ring.material.opacity = .11 + energy * .055 + Math.sin(t * 1.1 + i) * .018;
    });
    orbitNodes.forEach((node, i) => {
      node.scale.setScalar(1 + Math.sin(t * 2 + i) * .2);
    });
    stars.rotation.y += .000035;
    grid.position.z = (state.scroll * 2.5) % .5;
  }

  camera.position.x = lerp(camera.position.x, state.mouse.nx * .16, .025);
  camera.position.y = lerp(camera.position.y, state.mouse.ny * .11, .025);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(animate3D);
}
animate3D();

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// ---------- Small terminal pulse ----------
const terminal = $('#terminalText');
setInterval(() => {
  if (document.hidden) return;
  terminal.textContent = terminal.textContent.endsWith('_')
    ? terminal.textContent.slice(0, -1)
    : terminal.textContent + '_';
}, 620);

// ---------- Keyboard-friendly top navigation ----------
$$('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const target = $(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  });
});
