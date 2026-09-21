'use strict';
(() => {
  const M=window.MAKMA,{ $,esc,clamp,fmt,tokens,uniq,mean,fnv1a,metrics,badge,setHTML,trace,error,shell,finish,copyText}=M;
  function parseCorpus(text){
    return String(text).split(/\n+/).map(x=>x.trim()).filter(Boolean).map((line,i)=>{
      const idx=line.indexOf('|');
      return idx>0?{id:line.slice(0,idx).trim(),text:line.slice(idx+1).trim()}:{id:'doc-'+(i+1),text:line};
    }).filter(d=>d.text);
  }
  function bm25(docs,query,topK=20,k1=1.5,b=.75){
    const q=tokens(query),dt=docs.map(d=>tokens(d.text)),avg=mean(dt.map(t=>t.length))||1,df={};
    dt.forEach(ts=>uniq(ts).forEach(t=>df[t]=(df[t]||0)+1));
    return docs.map((d,i)=>{
      const ts=dt[i],freq={};ts.forEach(t=>freq[t]=(freq[t]||0)+1);let score=0;
      q.forEach(term=>{const f=freq[term]||0;if(!f)return;const idf=Math.log(1+(docs.length-(df[term]||0)+.5)/((df[term]||0)+.5));const den=f+k1*(1-b+b*ts.length/avg);score+=idf*(f*(k1+1))/den;});
      return {doc:d,score,lexical:score,semantic:0};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,topK);
  }
  function vector(text,dims=96){
    const v=Array(dims).fill(0);
    tokens(text).forEach((t,i)=>{const h=fnv1a(t),idx=h%dims,sign=((h>>>8)&1)?1:-1;v[idx]+=sign*(1+Math.log1p(i%5));});
    const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0));return n?v.map(x=>x/n):v;
  }
  function cosine(a,b){let s=0,aa=0,bb=0;for(let i=0;i<a.length;i++){s+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?s/Math.sqrt(aa*bb):0;}
  function semantic(docs,q,topK=20){const qv=vector(q);return docs.map(d=>{const sc=cosine(qv,vector(d.text));return {doc:d,score:sc,lexical:0,semantic:sc};}).sort((a,b)=>b.score-a.score).slice(0,topK);}
  function rrf(rankings,k=60){
    const map=new Map();
    rankings.forEach(r=>r.forEach((x,i)=>{const cur=map.get(x.doc.id)||{doc:x.doc,score:0,lexical:0,semantic:0};cur.score+=1/(k+i+1);cur.lexical=Math.max(cur.lexical,x.lexical||0);cur.semantic=Math.max(cur.semantic,x.semantic||0);map.set(x.doc.id,cur);}));
    return [...map.values()].sort((a,b)=>b.score-a.score);
  }
  function rerank(query,candidates,topK){
    const q=new Set(tokens(query));
    return candidates.map(x=>{const ct=new Set(tokens(x.doc.text));let hit=0;q.forEach(t=>{if(ct.has(t))hit++;});const overlap=hit/Math.max(1,q.size),phrase=x.doc.text.toLowerCase().includes(query.toLowerCase())?.15:0,score=.65*x.score+.35*overlap+phrase;return {...x,score,overlap};}).sort((a,b)=>b.score-a.score).slice(0,topK);
  }
  function plan(q){const cleaned=q.replace(/\s+/g,' ').trim(),parts=cleaned.split(/\b(?:and|versus|vs\.?|then)\b|[?;]/i).map(x=>x.trim().replace(/^[,;]+|[,;]+$/g,'')).filter(Boolean);return uniq([cleaned,...parts.filter(x=>x.toLowerCase()!==cleaned.toLowerCase())]).slice(0,3);}
  function retrievalMetrics(ranked,relevant){
    const retrieved=ranked.map(x=>x.doc.id),hits=retrieved.filter(id=>relevant.has(id));
    const first=retrieved.findIndex(id=>relevant.has(id));
    return {recall:relevant.size?hits.length/relevant.size:0,precision:retrieved.length?hits.length/retrieved.length:0,mrr:first<0?0:1/(first+1),hit:hits.length?1:0,hits};
  }
  function positiveFloat(id,label,min,max){const value=Number($(id).value);if(!Number.isFinite(value)||value<min||value>max)throw new Error(label+' must be between '+min+' and '+max+'.');return value;}
  function run(){
    const started=performance.now();
    try{
      const docs=parseCorpus($('#corpus').value),q=$('#query').value.trim(),topK=clamp(parseInt($('#topk').value||'5',10),1,10),candidateK=clamp(parseInt($('#candidatek').value||'10',10),1,50),rrfK=positiveFloat('#rrfk','RRF k',1,1000),k1=positiveFloat('#k1','BM25 k1',.1,5),b=positiveFloat('#b','BM25 b',0,1);
      if(!docs.length||!q)throw new Error('Add at least one document and a query.');
      if(new Set(docs.map(d=>d.id)).size!==docs.length)throw new Error('Document IDs must be unique.');
      if(candidateK<topK)throw new Error('Candidate K must be greater than or equal to Top K.');
      const planned=plan(q),rankings=[];
      planned.forEach(p=>rankings.push(rrf([bm25(docs,p,candidateK,k1,b),semantic(docs,p,candidateK)],rrfK)));
      const fused=rrf(rankings,rrfK).slice(0,candidateK),ranked=rerank(q,fused,topK),context=ranked.map(r=>'['+r.doc.id+'] '+r.doc.text).join('\n\n'),relevant=new Set($('#relevant').value.split(',').map(x=>x.trim()).filter(Boolean)),unknown=[...relevant].filter(id=>!docs.some(d=>d.id===id)),ev=retrievalMetrics(ranked,relevant);
      if(unknown.length)throw new Error('Relevant document IDs not found in the corpus: '+unknown.join(', ')+'.');
      setHTML('#result',metrics([['Documents',docs.length],['Planned queries',planned.length],['Candidates',fused.length],['Returned',ranked.length]])+
        '<div class="section-title">Grounded evidence</div>'+
        ranked.map((r,i)=>'<div class="card"><div class="row split"><div>'+badge('#'+(i+1))+' '+badge(r.doc.id,relevant.has(r.doc.id)?'ok':'')+'</div><strong>rerank '+fmt(r.score,4)+'</strong></div><p>'+esc(r.doc.text)+'</p><div class="score-line"><span>BM25 '+fmt(r.lexical,3)+'</span><span>semantic '+fmt(r.semantic,3)+'</span><span>fused '+fmt(fused.find(x=>x.doc.id===r.doc.id)?.score||0,4)+'</span><span>overlap '+(r.overlap*100).toFixed(0)+'%</span></div></div>').join('')+
        '<div class="section-title">Retrieval evaluation @ '+topK+'</div>'+metrics([['Recall@K',(ev.recall*100).toFixed(1)+'%',ev.recall===1?'good':'warn'],['Precision@K',(ev.precision*100).toFixed(1)+'%'],['MRR',fmt(ev.mrr,3),ev.mrr?'good':'bad'],['Hit Rate@K',ev.hit?'100%':'0%',ev.hit?'good':'bad']])+
        '<div class="section-title">Citation-ready context</div><code id="rag-context" class="code">'+esc(context)+'</code><div class="row"><button id="copy-context" class="btn">Copy context</button></div>');
      $('#copy-context').onclick=e=>copyText(context,e.currentTarget);
      trace([{label:'planner',title:'Multi-query planning',text:planned.join(' · ')},{label:'retrieval',title:'Hybrid retrieval',text:'BM25 (k1='+fmt(k1,2)+', b='+fmt(b,2)+') + deterministic hashed-vector semantic ranking; candidate K='+candidateK+'.'},{label:'fusion',title:'Reciprocal-rank fusion',text:'Fused '+fused.length+' unique candidates with RRF k='+fmt(rrfK,0)+'.'},{label:'rerank',title:'Transparent reranking',text:'Overlap-aware reranking returned top '+ranked.length+'.'},{label:'evaluation',title:'Retrieval metrics',text:relevant.size?'Recall@K '+fmt(ev.recall,3)+', Precision@K '+fmt(ev.precision,3)+', MRR '+fmt(ev.mrr,3)+', Hit Rate '+fmt(ev.hit,0)+'.':'No relevant IDs configured; evaluation metrics are zero.'}]);
    }catch(e){error(e.message);}
    finish(started);
  }
  shell('<div class="field"><label>Corpus · one document per line as <code>id | text</code></label><textarea id="corpus" class="tall">memory | SQLite stores persistent conversation memory for Mak\'ma sessions.\nretrieval | Hybrid retrieval combines BM25 lexical ranking with semantic vector ranking.\nfusion | Reciprocal-rank fusion combines independent rankings before reranking.\nevaluation | Retrieval quality can be measured with Recall@K, Precision@K, MRR and Hit Rate.\nadapters | OpenAI-compatible embedding and chat adapters can connect local or cloud model servers.</textarea></div><div class="field"><label>Query</label><textarea id="query">How does hybrid retrieval combine lexical and semantic search?</textarea></div><div class="field"><label>Relevant document IDs · comma-separated</label><input id="relevant" value="retrieval,fusion"></div><div class="control-grid three"><div class="field"><label>Top K</label><input id="topk" type="number" min="1" max="10" value="4"></div><div class="field"><label>Candidate K</label><input id="candidatek" type="number" min="1" max="50" value="10"></div><div class="field"><label>RRF k</label><input id="rrfk" type="number" min="1" max="1000" value="60"></div></div><div class="control-grid"><div class="field"><label>BM25 k1</label><input id="k1" type="number" min="0.1" max="5" step="0.1" value="1.5"></div><div class="field"><label>BM25 b</label><input id="b" type="number" min="0" max="1" step="0.05" value="0.75"></div></div><button id="run" class="btn primary">Run hybrid retrieval + evaluation</button>');
  $('#run').onclick=run;run();
})();
