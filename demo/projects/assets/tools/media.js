'use strict';
(() => {
  const M=window.MAKMA,{ $,num,fmt,fingerprint,metrics,badge,setHTML,trace,error,shell,finish,copyText}=M;
  const OPS=[
    {keys:['remove background','replace background','background segmentation'],operation:'background_segmentation',stage:'vision',parameters:{mode:'subject'},weight:2.5},
    {keys:['slow motion','slow-mo'],operation:'retime',stage:'temporal',parameters:{speed:.5},weight:1.3},
    {keys:['teal','cinematic'],operation:'color_grade',stage:'color',parameters:{preset:'cinematic-teal'},weight:1.1},
    {keys:['noise','denoise'],operation:'audio_denoise',stage:'audio',parameters:{strength:.7},weight:.2},
    {keys:['subtitle','captions'],operation:'subtitles',stage:'overlay',parameters:{mode:'auto'},weight:.3}
  ],ORDER={vision:0,temporal:1,color:2,audio:3,overlay:4};
  function makePlan(prompt){
    const l=prompt.toLowerCase(),seen=new Set();
    return OPS.filter(x=>x.keys.some(k=>l.includes(k))&&!(x.operation==='background_segmentation'&&l.includes('background noise'))).filter(x=>!seen.has(x.operation)&&seen.add(x.operation)).sort((a,b)=>ORDER[a.stage]-ORDER[b.stage]);
  }
  async function run(){
    const started=performance.now();
    try{
      const ops=makePlan($('#prompt').value),width=num($('#width').value),height=num($('#height').value),duration=num($('#duration').value),fps=num($('#fps').value),budget=num($('#budget').value);
      if([width,height,duration,fps,budget].some(v=>v<=0))throw new Error('Media profile and budget values must be positive.');
      const frames=Math.max(1,Math.round(duration*fps)),mp=width*height/1e6,complexity=1+ops.reduce((s,o)=>s+o.weight,0),weighted=mp*frames*complexity,within=ops.length<=8&&weighted<=budget;
      const plan=ops.map(o=>({operation:o.operation,parameters:o.parameters,stage:o.stage})),fp=await fingerprint(plan),json=JSON.stringify(plan,null,2);
      setHTML('#result',metrics([['Operations',ops.length],['Frames',frames.toLocaleString()],['Complexity',fmt(complexity,2)],['Weighted MP-frames',Math.round(weighted).toLocaleString(),within?'good':'bad']])+
        '<div class="row" style="margin:12px 0">'+badge(within?'WITHIN RENDER BUDGET':'BUDGET EXCEEDED',within?'ok':'bad')+' '+badge('fp '+fp.slice(0,12)+'…')+'</div>'+
        '<div class="timeline">'+(ops.length?ops.map((o,i)=>'<div class="stage active"><span class="n">'+(i+1)+'</span><div><strong>'+o.operation+'</strong><div class="muted">'+o.stage+' · weight '+o.weight+'</div></div></div>').join(''):'<div class="empty-note">No supported operation detected.</div>')+'</div>'+
        '<div class="section-title">Validated edit plan</div><code id="media-json" class="code">'+json.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</code><div class="row"><button id="copy-plan" class="btn">Copy plan JSON</button></div>');
      $('#copy-plan').onclick=e=>copyText(json,e.currentTarget);
      trace([{label:'intent',title:'Deterministic intent parsing',text:'Detected '+ops.length+' supported operation(s).'},{label:'ordering',title:'Pipeline stage ordering',text:'vision → temporal → color → audio → overlay'},{label:'budget',title:'Render workload estimate',text:fmt(mp,2)+' MP × '+frames+' frames × '+fmt(complexity,2)+' = '+fmt(weighted,1)+' weighted MP-frames.'},{label:'quality',title:'Plan diagnostics',text:'Unique operations, deterministic ordering, JSON-safe parameters and SHA-256 fingerprint '+fp.slice(0,16)+'…'}]);
    }catch(e){error(e.message);}
    finish(started);
  }
  shell('<div class="field"><label>Edit prompt</label><textarea id="prompt">cinematic slow motion, denoise audio, add subtitles and remove background</textarea></div><div class="control-grid four"><div class="field"><label>Width</label><input id="width" type="number" value="1920"></div><div class="field"><label>Height</label><input id="height" type="number" value="1080"></div><div class="field"><label>Duration (s)</label><input id="duration" type="number" value="30" step="0.1"></div><div class="field"><label>FPS</label><input id="fps" type="number" value="30" step="0.1"></div></div><div class="field"><label>Max weighted megapixel-frames</label><input id="budget" type="number" value="250000"></div><button id="run" class="btn primary">Build + validate render plan</button>');
  $('#run').onclick=run;run();
})();