'use strict';
(() => {
  const M=window.MAKMA,{ $,esc,clamp,num,fingerprint,metrics,badge,setHTML,trace,error,shell,finish,copyText}=M;
  function capture(pattern,text,field,normalize=x=>x.trim()){const m=pattern.exec(text);if(!m)return null;const offset=m[0].indexOf(m[1]),start=m.index+offset;return {field,raw:m[1].trim(),value:normalize(m[1]),start,end:start+m[1].length};}
  async function run(){
    const started=performance.now();
    try{
      const text=$('#document').value,threshold=clamp(num($('#complete').value,.8),0,1),roman={I:'1',II:'2',III:'3',IV:'4'};
      const fields=[capture(/study\s*(?:id)?\s*:\s*([A-Z0-9-]+)/i,text,'study_id'),capture(/phase\s*:\s*([^\n]+)/i,text,'phase',x=>roman[x.trim().toUpperCase()]||x.trim()),capture(/participants?\s*:\s*(-?\d+)\b/i,text,'participants',x=>Number(x.trim())),capture(/intervention\s*:\s*([^\n]+)/i,text,'intervention'),capture(/primary endpoint\s*:\s*([^\n]+)/i,text,'primary_endpoint')];
      const record={study_id:null,phase:null,participants:null,intervention:null,primary_endpoint:null};fields.filter(Boolean).forEach(f=>record[f.field]=f.value);
      const errors=[];if(record.participants!=null&&record.participants<=0)errors.push('participants must be positive');if(record.study_id==null)errors.push('study_id missing');if(record.phase!=null&&!['1','2','3','4'].includes(String(record.phase)))errors.push('phase must be 1, 2, 3 or 4');
      const missing=Object.keys(record).filter(k=>record[k]==null),complete=1-missing.length/5,ready=!errors.length&&complete>=threshold,fp=await fingerprint(record),json=JSON.stringify(record,null,2);
      setHTML('#result',metrics([['Completeness',(complete*100).toFixed(0)+'%',ready?'good':'bad'],['Evidence',fields.filter(Boolean).length+'/5'],['Validation',errors.length?errors.length+' error(s)':'passed',errors.length?'bad':'good'],['Fingerprint',fp.slice(0,12)+'…']])+
        '<div class="row" style="margin:12px 0">'+badge(ready?'QUALITY GATE PASS':'QUALITY GATE BLOCK',ready?'ok':'bad')+' '+(missing.length?badge('missing: '+missing.join(', '),'warn'):badge('all required fields','ok'))+'</div>'+
        '<div class="section-title">Structured record</div><code id="clinical-json" class="code">'+esc(json)+'</code><div class="row"><button id="copy-record" class="btn">Copy record JSON</button></div>'+
        '<div class="section-title">Field provenance</div>'+fields.filter(Boolean).map(f=>'<div class="card"><div class="row split"><strong>'+esc(f.field)+'</strong><span>'+f.start+':'+f.end+'</span></div><p>raw: '+esc(f.raw)+' → normalized: '+esc(f.value)+'</p></div>').join('')+
        (errors.length?'<div class="error-box"><strong>Validation errors</strong><p>'+esc(errors.join(' · '))+'</p></div>':'')+
        '<div class="notice">Synthetic/portfolio extraction only — not a clinical decision tool.</div>');
      $('#copy-record').onclick=e=>copyText(json,e.currentTarget);
      trace([{label:'extract',title:'Rule-based extraction',text:'Located '+fields.filter(Boolean).length+' of 5 supported schema fields.'},{label:'normalize',title:'Normalization',text:'Roman-numeral phases normalize to numeric phases; participant counts parse to integers.'},{label:'provenance',title:'Evidence offsets',text:'Every captured field keeps its source-character start/end offsets.'},{label:'quality',title:'Completeness + validation gate',text:'Threshold '+(threshold*100).toFixed(0)+'%; actual '+(complete*100).toFixed(0)+'%; '+(ready?'PASS':'BLOCK')+'.'}]);
    }catch(e){error(e.message);}
    finish(started);
  }
  shell('<div class="field"><label>Synthetic clinical-style text</label><textarea id="document" class="tall">Study ID: SYN-204\nPhase: III\nParticipants: 180\nIntervention: Example compound A\nPrimary Endpoint: Change from baseline at week 12</textarea></div><div class="field"><label>Minimum completeness (0–1)</label><input id="complete" type="number" min="0" max="1" step="0.05" value="0.8"></div><button id="run" class="btn primary">Extract + validate + trace provenance</button>');
  $('#run').onclick=run;run();
})();