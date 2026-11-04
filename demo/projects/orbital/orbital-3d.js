"use strict";
/*
 * MAK'MA Orbital — original dependency-free WebGL scene renderer.
 * The cinematic stills remain visible if WebGL is unavailable.
 * All geometry, camera paths and shaders are authored for this project.
 */
(() => {
  const canvas = document.getElementById("world-canvas");
  if (!canvas) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(max-width: 700px)").matches;
  const chapters = Array.from(document.querySelectorAll(".chapter"));
  const body = document.body;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  let gl, meshProgram, lineProgram, cube, sphere, lineBuffer;
  let viewProjection = new Float32Array(16);
  let eye = [0, 0, 8];
  let frame = 0, width = 1, height = 1, dpr = 1, lastFrame = 0;
  let mouseX = 0, mouseY = 0, started = false, ready = false;
  let sceneIndex = 0, sceneLocal = 0, sceneAlpha = 0.78;

  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error("MAK'MA shader: " + error);
    }
    return s;
  }
  function createProgram(vertex, fragment) {
    const program = gl.createProgram();
    const vs = createShader(gl.VERTEX_SHADER, vertex);
    const fs = createShader(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error("MAK'MA program: " + error);
    }
    return program;
  }
  function buildMesh(vertices) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    return { buffer, count: vertices.length / 6 };
  }
  function makeCube() {
    const faces = [
      [[0,0,1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
      [[0,0,-1],[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]],
      [[1,0,0],[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]],
      [[-1,0,0],[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]],
      [[0,1,0],[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]],
      [[0,-1,0],[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]
    ];
    const output = [];
    for (const [normal, a, b, c, d] of faces) {
      for (const point of [a,b,c,a,c,d]) output.push(...point.map(v => v * 0.5), ...normal);
    }
    return buildMesh(output);
  }
  function makeSphere(latitude = 22, longitude = 32) {
    const output = [];
    const point = (u, v) => {
      const theta = v * Math.PI, phi = u * TAU;
      return [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)];
    };
    for (let row = 0; row < latitude; row++) {
      for (let col = 0; col < longitude; col++) {
        const a = point(col / longitude, row / latitude);
        const b = point((col + 1) / longitude, row / latitude);
        const c = point((col + 1) / longitude, (row + 1) / latitude);
        const d = point(col / longitude, (row + 1) / latitude);
        for (const vertex of [a,b,c,a,c,d]) output.push(...vertex, ...vertex);
      }
    }
    return buildMesh(output);
  }
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
  }
  function lookAt(position, target) {
    const up = [0,1,0];
    const normalize = v => { const l = Math.hypot(...v) || 1; return v.map(n => n/l); };
    const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const z = normalize(position.map((n,i) => n-target[i]));
    const x = normalize(cross(up,z));
    const y = cross(z,x);
    const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    return new Float32Array([
      x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -dot(x,position),-dot(y,position),-dot(z,position),1
    ]);
  }
  function multiply(a,b) {
    const out = new Float32Array(16);
    for (let c=0;c<4;c++) for (let r=0;r<4;r++)
      out[c*4+r] = a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return out;
  }
  function compose(x,y,z,sx,sy,sz,rx=0,ry=0) {
    const cy=Math.cos(ry), ny=Math.sin(ry), cx=Math.cos(rx), nx=Math.sin(rx);
    return new Float32Array([
      cy*sx,0,-ny*sx,0,
      ny*nx*sy,cx*sy,cy*nx*sy,0,
      ny*cx*sz,-nx*sz,cy*cx*sz,0,
      x,y,z,1
    ]);
  }
  function setCamera(position, target, field=47) {
    eye = position;
    const aspect = Math.max(.5, width / height);
    viewProjection = multiply(perspective(field*Math.PI/180, aspect, .08, 130), lookAt(position,target));
  }
  function useMesh(mesh, model, color, opacity=1, emissive=0) {
    if (opacity <= 0.002) return;
    gl.useProgram(meshProgram.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
    gl.enableVertexAttribArray(meshProgram.position);
    gl.enableVertexAttribArray(meshProgram.normal);
    gl.vertexAttribPointer(meshProgram.position,3,gl.FLOAT,false,24,0);
    gl.vertexAttribPointer(meshProgram.normal,3,gl.FLOAT,false,24,12);
    gl.uniformMatrix4fv(meshProgram.viewProjection,false,viewProjection);
    gl.uniformMatrix4fv(meshProgram.model,false,model);
    gl.uniform3fv(meshProgram.color,color);
    gl.uniform3fv(meshProgram.eye,eye);
    gl.uniform1f(meshProgram.opacity,opacity*sceneAlpha);
    gl.uniform1f(meshProgram.emissive,emissive);
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }
  const COLORS = {
    steel:[.24,.34,.43], silver:[.57,.69,.75], white:[.84,.93,.98],
    blue:[.08,.35,.67], cyan:[.28,.84,.94], lime:[.69,.99,.28],
    gold:[.97,.68,.19], black:[.025,.042,.07], dark:[.08,.11,.16],
    copper:[.56,.29,.1]
  };
  function box(x,y,z,w,h,d,color=COLORS.steel,rx=0,ry=0,glow=0,alpha=.95) {
    useMesh(cube,compose(x,y,z,w,h,d,rx,ry),color,alpha,glow);
  }
  function ball(x,y,z,r,color=COLORS.blue,alpha=.5,glow=0) {
    useMesh(sphere,compose(x,y,z,r,r,r),color,alpha,glow);
  }
  function lines(coords,color,alpha=.7) {
    if (!coords.length) return;
    gl.useProgram(lineProgram.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coords),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(lineProgram.position);
    gl.vertexAttribPointer(lineProgram.position,3,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(lineProgram.viewProjection,false,viewProjection);
    gl.uniform3fv(lineProgram.color,color);
    gl.uniform1f(lineProgram.opacity,alpha*sceneAlpha);
    gl.uniform1f(lineProgram.size,1);
    gl.uniform1f(lineProgram.isPoint,0);
    gl.drawArrays(gl.LINES,0,coords.length/3);
  }
  function points(coords,color,alpha=.8,size=4) {
    if (!coords.length) return;
    gl.useProgram(lineProgram.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coords),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(lineProgram.position);
    gl.vertexAttribPointer(lineProgram.position,3,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(lineProgram.viewProjection,false,viewProjection);
    gl.uniform3fv(lineProgram.color,color);
    gl.uniform1f(lineProgram.opacity,alpha*sceneAlpha);
    gl.uniform1f(lineProgram.size,size*dpr);
    gl.uniform1f(lineProgram.isPoint,1);
    gl.drawArrays(gl.POINTS,0,coords.length/3);
  }
  function ring(x,y,z,r,color,alpha=.4,tilt=.3) {
    const coords=[];
    const count=mobile?42:84;
    for(let i=0;i<count;i++){
      const a=i/count*TAU,b=(i+1)/count*TAU;
      coords.push(x+Math.cos(a)*r,y+Math.sin(a)*r*tilt,z+Math.sin(a)*r*.23,
                  x+Math.cos(b)*r,y+Math.sin(b)*r*tilt,z+Math.sin(b)*r*.23);
    }
    lines(coords,color,alpha);
  }
  // Deterministic coordinates: stable scene across visits and screenshots.
  function makeNodes(count,scale=1) {
    let seed=57043;
    const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    return Array.from({length:count},(_,i)=>{
      const a=random()*TAU,z=random()*2-1,r=Math.sqrt(1-z*z);
      return [Math.cos(a)*r*scale, z*scale, Math.sin(a)*r*scale];
    });
  }
  const graphNodes=makeNodes(mobile?24:42,4.7);
  const dustNodes=makeNodes(mobile?70:180,5.3);
  function satellite(time,progress) {
    const bob=Math.sin(time*.4)*.07;
    const yaw=-.28+progress*.34+Math.sin(time*.12)*.08;
    const cx=2.6-progress*.5+mouseX*.11,cy=.9+bob,cz=-1.8-progress*1.2;
    box(cx,cy,cz,1.25,.72,1.55,COLORS.silver,0,yaw,.05);
    box(cx,cy,cz+.84,.66,.58,.26,COLORS.dark,0,yaw,.1);
    box(cx,cy,cz-.86,.33,.3,.5,COLORS.gold,0,yaw,.27);
    box(cx,cy+.48,cz,.28,.32,.4,COLORS.lime,0,yaw,.3);
    for(const side of [-1,1]) {
      box(cx+side*1.1,cy,cz,.82,.11,.16,COLORS.steel,0,yaw);
      box(cx+side*3.0,cy,cz,3.15,.07,1.4,COLORS.blue,0,yaw,.12);
      for(let k=-2;k<=2;k++) box(cx+side*(1.8+Math.abs(k)*.45),cy+.045,cz+k*.24,.035,.06,1.34,COLORS.silver,0,yaw,.04,.65);
      box(cx+side*3.0,cy,cz,3.17,.045,.032,COLORS.cyan,0,yaw,.3,.9);
    }
    const beam=[];
    for(let i=0;i<9;i++){
      const a=i/9*TAU;
      beam.push(cx+.4,cy+.2,cz+1.1,cx+.4+Math.cos(a)*.6,cy+.2+Math.sin(a)*.6,cz+1.8);
    }
    lines(beam,COLORS.cyan,.42);
  }
  function orbital(time,p) {
    setCamera([mouseX*.18,1.0+mouseY*.09,9.5-p*2.0],[0,-.9,-6],mobile?58:47);
    ball(-1.9,-7.9,-13.5,9.9,COLORS.blue,.26,.1);
    ball(-1.9,-7.9,-13.5,10.2,COLORS.cyan,.042,.35);
    ring(-1.9,-7.9,-13.5,10.5,COLORS.cyan,.19,.22);
    satellite(time,p);
    const stars=dustNodes.slice(0,mobile?50:125).flatMap(v=>[v[0]*5,v[1]*3,v[2]*5-22]);
    points(stars,COLORS.white,.32,2.1);
  }
  function knowledge(time,p) {
    setCamera([p*.7+mouseX*.12,.8+mouseY*.1,9.4-p*2],[0,-.4,-7],mobile?56:46);
    ball(-1,-1.8,-10,6.6,COLORS.blue,.15,.1);
    ball(-1,-1.8,-10,6.9,COLORS.cyan,.032,.28);
    const nodePoints=[],edges=[];
    graphNodes.forEach((v,i)=>{
      const wave=Math.sin(time*.23+i)*.07;
      const point=[v[0]-1,v[1]-1.8+wave,v[2]-10];
      nodePoints.push(...point);
      if(i%3===0) {
        const other=graphNodes[(i+7)%graphNodes.length];
        edges.push(...point,other[0]-1,other[1]-1.8,other[2]-10);
      }
    });
    lines(edges,COLORS.cyan,.36);
    points(nodePoints,COLORS.lime,.9,mobile?3.5:4.9);
    ring(-1,-1.8,-10,6.7,COLORS.cyan,.3,.7);
  }
  function dataHall(time,p) {
    setCamera([mouseX*.08,1.2+mouseY*.04,10-p*6.3],[0,.15,-9],mobile?62:55);
    const floor=[];
    for(let x=-11;x<=11;x+=1.4) floor.push(x,-2,5,x,-2,-26);
    for(let z=5;z>=-26;z-=2) floor.push(-11,-2,z,11,-2,z);
    lines(floor,COLORS.cyan,.12);
    const serverLines=[];
    const count=mobile?4:7;
    for(let depth=0;depth<count;depth++) {
      const z=3-depth*3.3;
      for(const side of [-1,1]) {
        const x=side*3.35;
        box(x,-.05,z,2.15,3.8,1.45,COLORS.black,0,0,.05,.85);
        box(x,-.05,z+side*.03,2.02,3.55,1.51,COLORS.steel,0,0,.03,.55);
        for(let slot=-3;slot<=3;slot++) {
          const y=slot*.46;
          serverLines.push(x-1.03,y,z+ .8,x+1.03,y,z+.8);
        }
        for(let slot=-2;slot<=2;slot++) {
          const yy=slot*.59;
          serverLines.push(x+side*.56,yy,z+.83,x+side*.7,yy,z+.83);
        }
      }
    }
    lines(serverLines,COLORS.lime,.24);
    ring(0,-1.4,-13,3.6,COLORS.cyan,.15,.17);
    points(dustNodes.slice(0,45).flatMap(v=>[v[0]*1.2,v[1]*.4-1,v[2]*2-9]),COLORS.cyan,.28,2.8);
  }
  function computeCore(time,p) {
    const a=.3+p*.6;
    setCamera([4.8-p*2.6+mouseX*.12,5.5-p*1.6,10-p*3],[0,-.8,-5],mobile?58:49);
    box(0,-1.7,-5,7.8,.38,7.8,COLORS.dark,.08,a,.1,.85);
    box(0,-1.35,-5,4.8,.34,4.8,COLORS.steel,.08,a,.06,.85);
    box(0,-1.02,-5,2.25,.24,2.25,COLORS.gold,.08,a,.52,.95);
    box(0,-.8,-5,1.52,.22,1.52,COLORS.black,.08,a,.22,.98);
    const traces=[],nodes=[];
    for(let i=0;i<40;i++){
      const angle=i/40*TAU;
      const radii=[1.15,2.1,3.35];
      for(let k=0;k<2;k++) {
        const r1=radii[k],r2=radii[k+1];
        traces.push(Math.cos(angle)*r1,-.84,-5+Math.sin(angle)*r1,
                    Math.cos(angle)*r2,-1.37,-5+Math.sin(angle)*r2);
      }
      nodes.push(Math.cos(angle)*3.35,-1.37,-5+Math.sin(angle)*3.35);
    }
    lines(traces,COLORS.gold,.5);
    points(nodes,COLORS.lime,.64,3.5);
    ball(0,-.58,-5,.22,COLORS.gold,.74,.9);
    ring(0,-.6,-5,2.7,COLORS.gold,.28,.53);
  }
  function intelligenceField(time,p,quiet=false) {
    setCamera([mouseX*.2,mouseY*.15,9.7-p*.8],[0,0,-5],mobile?60:48);
    ball(0,0,-9,2.0,COLORS.gold,quiet?.04:.13,.55);
    const cloud=[],edges=[];
    const count=quiet?Math.min(42,dustNodes.length):dustNodes.length;
    for(let i=0;i<count;i++) {
      const v=dustNodes[i];
      const angle=time*(quiet?.007:.055)+i*.045;
      const cos=Math.cos(angle),sin=Math.sin(angle);
      const x=v[0]*cos-v[2]*sin,y=v[1]*.8,z=v[0]*sin+v[2]*cos-8;
      cloud.push(x,y,z);
      if(!quiet&&i%7===0&&i+2<count){
        const next=dustNodes[i+2];
        edges.push(x,y,z,next[0],next[1],next[2]-8);
      }
    }
    if(!quiet) lines(edges,COLORS.gold,.2);
    points(cloud,quiet?COLORS.cyan:COLORS.gold,quiet?.37:.8,quiet?2.6:4.4);
    ring(0,0,-8,4.3,COLORS.gold,quiet?.1:.3,.68);
    ring(0,0,-8,3.25,COLORS.cyan,quiet?.07:.19,-.42);
  }
  function findScene() {
    const y=window.scrollY+height*.48;
    let index=0;
    for(let i=0;i<chapters.length;i++) if(chapters[i].offsetTop<=y)index=i;
    const chapter=chapters[index];
    const local=clamp((y-chapter.offsetTop)/Math.max(1,chapter.offsetHeight),0,1);
    return {index,local};
  }
  function resize() {
    if(!gl)return;
    dpr=Math.min(mobile?1.2:1.6,window.devicePixelRatio||1);
    width=Math.max(1,canvas.clientWidth);
    height=Math.max(1,canvas.clientHeight);
    canvas.width=Math.round(width*dpr);
    canvas.height=Math.round(height*dpr);
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  function draw(timestamp=0) {
    if(!gl||!ready||!started||document.hidden)return;
    const fps=mobile?28:58;
    if(!reduced&&timestamp-lastFrame<1000/fps) {frame=requestAnimationFrame(draw);return;}
    lastFrame=timestamp;
    resizeIfNeeded();
    const scene=findScene();
    sceneIndex=scene.index;
    sceneLocal=scene.local;
    const edge=Math.min(sceneLocal,1-sceneLocal);
    sceneAlpha=lerp(.45,.86,clamp(edge*7,0,1));
    canvas.style.opacity=String(sceneAlpha);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const time=reduced?0:timestamp*.001;
    try{
      if(sceneIndex===0) orbital(time,sceneLocal);
      else if(sceneIndex===1) knowledge(time,sceneLocal);
      else if(sceneIndex===2) dataHall(time,sceneLocal);
      else if(sceneIndex===3) computeCore(time,sceneLocal);
      else if(sceneIndex===4) intelligenceField(time,sceneLocal,false);
      else intelligenceField(time,sceneLocal,true);
    }catch(error){fail("render");return;}
    if(!reduced)frame=requestAnimationFrame(draw);
  }
  function resizeIfNeeded() {
    const targetWidth=Math.round(Math.max(1,canvas.clientWidth)*Math.min(mobile?1.2:1.6,window.devicePixelRatio||1));
    const targetHeight=Math.round(Math.max(1,canvas.clientHeight)*Math.min(mobile?1.2:1.6,window.devicePixelRatio||1));
    if(canvas.width!==targetWidth||canvas.height!==targetHeight)resize();
  }
  function fail(reason) {
    ready=false;
    cancelAnimationFrame(frame);
    canvas.hidden=true;
    body.dataset.renderer="fallback";
    body.dataset.rendererReason=reason;
  }
  function initialize() {
    try {
      gl=canvas.getContext("webgl",{alpha:true,antialias:!mobile,depth:true,premultipliedAlpha:false,powerPreference:mobile?"low-power":"high-performance",preserveDrawingBuffer:false});
      if(!gl){fail("unsupported");return;}
      const mv = "attribute vec3 a_pos;attribute vec3 a_norm;uniform mat4 u_vp;uniform mat4 u_model;varying vec3 v_normal;varying vec3 v_world;void main(){vec4 p=u_model*vec4(a_pos,1.0);v_world=p.xyz;v_normal=mat3(u_model)*a_norm;gl_Position=u_vp*p;}";
      const mf = "precision mediump float;varying vec3 v_normal;varying vec3 v_world;uniform vec3 u_color;uniform vec3 u_eye;uniform float u_alpha;uniform float u_emissive;void main(){vec3 n=normalize(v_normal);vec3 light=normalize(vec3(-0.55,0.9,0.45));float d=max(dot(n,light),0.0);vec3 view=normalize(u_eye-v_world);float rim=pow(1.0-abs(dot(view,n)),2.0);vec3 c=u_color*(0.18+0.84*d+0.75*rim+u_emissive);gl_FragColor=vec4(c,min(1.0,u_alpha));}";
      const lv = "attribute vec3 a_pos;uniform mat4 u_vp;uniform float u_size;void main(){gl_Position=u_vp*vec4(a_pos,1.0);gl_PointSize=u_size;}";
      const lf = "precision mediump float;uniform vec3 u_color;uniform float u_alpha;uniform float u_point;void main(){float a=u_alpha;if(u_point>0.5){a*=1.0-smoothstep(0.12,0.5,length(gl_PointCoord-vec2(0.5)));}gl_FragColor=vec4(u_color,a);}";
      const mp=createProgram(mv,mf),lp=createProgram(lv,lf);
      meshProgram={program:mp,position:gl.getAttribLocation(mp,"a_pos"),normal:gl.getAttribLocation(mp,"a_norm"),viewProjection:gl.getUniformLocation(mp,"u_vp"),model:gl.getUniformLocation(mp,"u_model"),color:gl.getUniformLocation(mp,"u_color"),eye:gl.getUniformLocation(mp,"u_eye"),opacity:gl.getUniformLocation(mp,"u_alpha"),emissive:gl.getUniformLocation(mp,"u_emissive")};
      lineProgram={program:lp,position:gl.getAttribLocation(lp,"a_pos"),viewProjection:gl.getUniformLocation(lp,"u_vp"),color:gl.getUniformLocation(lp,"u_color"),opacity:gl.getUniformLocation(lp,"u_alpha"),size:gl.getUniformLocation(lp,"u_size"),isPoint:gl.getUniformLocation(lp,"u_point")};
      cube=makeCube();sphere=makeSphere();lineBuffer=gl.createBuffer();
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE);
      resize();
      ready=true;
      body.dataset.renderer="webgl";
      if(started)start();
    }catch(error){fail("initialization");}
  }
  function start() {
    started=true;
    if(!ready)return;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(draw);
  }
  canvas.addEventListener("webglcontextlost",(event)=>{event.preventDefault();fail("context-lost");});
  canvas.addEventListener("webglcontextrestored",()=>{canvas.hidden=false;initialize();});
  window.addEventListener("resize",()=>{if(ready){resize();if(reduced&&started)requestAnimationFrame(draw);}}, {passive:true});
  window.addEventListener("scroll",()=>{if(reduced&&started)requestAnimationFrame(draw);}, {passive:true});
  window.addEventListener("pointermove",(event)=>{
    mouseX=(event.clientX/Math.max(1,width)-.5)*2;
    mouseY=(event.clientY/Math.max(1,height)-.5)*2;
  }, {passive:true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&started&&ready)start();});
  if(body.classList.contains("started"))started=true;
  else new MutationObserver((_list,observer)=>{
    if(body.classList.contains("started")){observer.disconnect();start();}
  }).observe(body,{attributes:true,attributeFilter:["class"]});
  initialize();
})();