import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const entrance=read("../components/ThresholdScene.tsx");
const chambers=read("../components/ObservatoryChapters.tsx");
const world=read("../components/WorldCanvas.tsx");
const portfolio=read("../components/SynthesisPortfolio.tsx");
const french=read("../app/fr/page.tsx");
const content=read("../lib/content.ts");
const layout=read("../app/layout.tsx");
const stylesheet=read("../app/observatory.css");
const tests=[
  ["Original authored sky is deterministic",()=>assert.match(entrance,/function makePaintedSky/)],
  ["No third-party runtime URLs in WebGL scenes",()=>{assert.doesNotMatch(entrance,/https?:\/\//);assert.doesNotMatch(chambers,/https?:\/\//);} ],
  ["One shared camera for the 0–100% journey",()=>{
    assert.match(chambers,/<ThresholdCamera progressRef/);
    assert.equal((chambers.match(/<ThresholdCamera\b/g)||[]).length,1);
    assert.match(entrance,/p:1,position/);
  }],
  ["Portal opening and physical mechanism present",()=>assert.match(entrance,/function Aperture\(/)],
  ["Nine project installations mapped into three pillars",()=>{
    assert.match(chambers,/agentic-rag-engine/);
    assert.match(chambers,/makma-ai-os/);
    assert.match(chambers,/mlops-production-pipeline/);
    assert.equal((chambers.match(/slugs:\[/g)||[]).length,3);
  }],
  ["Six authored environments exist",()=>{
    for(const name of ["ThresholdScene","SystemRoom","FlightLogGallery","ObservatoryCore","OpenHorizon","GalleryScheduler"])
      assert.match(chambers,new RegExp(name));
  }],
  ["Seven professional exhibits are represented",()=>assert.match(chambers,/length:7/)],
  ["One Canvas and no legacy Galactic scene",()=>{
    assert.equal((world.match(/<Canvas\b/g)||[]).length,1);
    assert.doesNotMatch(world,/CosmicScene|LEGACY_HANDOFF|PrototypeSceneSwitch/);
  }],
  ["Demand-driven rendering and tab suspension",()=>{
    assert.match(world,/frameloop=\{visible\?"demand":"never"\}/);
    assert.match(world,/v5:journey-frame/);
    assert.match(world,/visibilitychange/);
  }],
  ["Static reduced-motion fallback",()=>assert.match(world,/threshold-static-fallback/)],
  ["Nine original HTML chapters preserved",()=>{
    for(const id of ["departure","profile","foundation","knowledge","agency","reliability","flight-log","principle","comms"])
      assert.match(portfolio,new RegExp('id:"'+id+'"'));
  }],
  ["Story progress anchored to HTML sections",()=>assert.match(portfolio,/const anchors=\[/)],
  ["Existing technical dossiers, recruiter and atlas preserved",()=>{
    for(const name of ["ProjectInspector","RecruiterMode","SystemsAtlas"])assert.match(portfolio,new RegExp(name));
  }],
  ["Nine project records retained",()=>assert.equal((content.match(/\n    slug:"/g)||[]).length,9)],
  ["Seven company roles retained",()=>assert.equal((content.match(/company:"/g)||[]).length,7)],
  ["French route and school rhythm retained",()=>{
    assert.match(french,/function FrenchPage/);
    assert.match(content,/1 week school \/ 3 weeks company/);
    assert.match(french,/disponible immédiatement/);
  }],
  ["Theme imported in final CSS order",()=>{
    assert.match(layout,/import "\.\/refinement\.css";\s*import "\.\/observatory\.css";/);
    assert.match(stylesheet,/\.observatory-theme/);
  }],
  ["All original professional links remain in content",()=>{
    for(const url of ["github.com/maharshimak","linkedin.com/in/maharshi-patel","maharshipatel-portfolio.vercel.app"])
      assert.match(content,new RegExp(url.replaceAll(".","\\.")));
  }]
];
let failures=0;
for(const [label,check] of tests){
  try{check();console.log("PASS",label);}
  catch(e){failures++;console.error("FAIL",label,e.message);}
}
console.log(tests.length-failures+"/"+tests.length+" Observatory preservation checks passed");
if(failures)process.exitCode=1;
