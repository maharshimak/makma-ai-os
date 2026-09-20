'use strict';
(() => {
  const M=window.MAKMA,{ $,num,clamp,metrics,badge,setHTML,trace,error,shell,finish,table,esc}=M;
  const CUSTOMERS=[{id:1,name:'Northwind Labs',region:'EU',email:'ops@northwind.test'},{id:2,name:'Atlas Retail',region:'EU',email:'data@atlas.test'},{id:3,name:'Orion Health',region:'US',email:'analyst@orion.test'},{id:4,name:'Nova Foods',region:'APAC',email:'finance@nova.test'}];
  const ORDERS=[{id:101,customer_id:1,amount:82000,created_at:'2026-09-18'},{id:102,customer_id:1,amount:102000,created_at:'2026-09-19'},{id:103,customer_id:2,amount:139000,created_at:'2026-09-19'},{id:104,customer_id:3,amount:97000,created_at:'2026-09-20'},{id:105,customer_id:4,amount:61000,created_at:'2026-09-20'}];
  const FORBIDDEN=new Set(['insert','update','delete','drop','alter','create','replace','truncate','attach','detach','pragma','vacuum','reindex','grant','revoke','commit','rollback','savepoint']);
  function validateSQL(sql,maxRows){
    const n=sql.trim().replace(/;+$/,'').replace(/\s+/g,' ');
    if(!n)throw new Error('SQL cannot be empty.');
    if(n.includes(';'))throw new Error('Multiple statements are not allowed.');
    const first=n.toLowerCase().split(/\s+/,1)[0];if(!['select','with'].includes(first))throw new Error('Only SELECT or WITH queries are allowed.');
    const t=new Set(n.toLowerCase().match(/[a-z_]+/g)||[]),blocked=[...t].filter(x=>FORBIDDEN.has(x));if(blocked.length)throw new Error('Forbidden SQL operation(s): '+blocked.sort().join(', '));
    return 'SELECT * FROM (\n'+n+'\n) AS bounded_result LIMIT '+maxRows;
  }
  function risk(sql){
    const l=sql.toLowerCase();let score=0,f=[];const add=(c,p,s)=>{if(c){score+=p;f.push(s);}},joins=(l.match(/\bjoin\b/g)||[]).length,selects=(l.match(/\bselect\b/g)||[]).length;
    add(/\bselect\s+\*/.test(l),10,'wildcard projection');add(joins>=2,Math.min(24,joins*8),'multiple joins');add(/\bcross\s+join\b/.test(l),30,'cross join');add(/\bunion(?:\s+all)?\b/.test(l),20,'set union');add(selects>1,Math.min(24,(selects-1)*12),'nested query');add(l.includes('--')||l.includes('/*'),10,'SQL comments');add(/\border\s+by\s+random\s*\(/.test(l),20,'random ordering');add(l.startsWith('with '),8,'CTE');
    score=Math.min(score,100);return {score,level:score<20?'low':score<50?'medium':'high',factors:f};
  }
  function privacy(columns){
    const rules=[['credential','critical',['password','passwd','secret','token','api_key','apikey']],['government_id','high',['ssn','social_security','passport','national_id','tax_id']],['financial','high',['iban','swift','card_number','credit_card','bank_account']],['contact','medium',['email','phone','mobile','telephone']],['location','medium',['address','street_address','latitude','longitude','gps']],['health','high',['diagnosis','medical_record','mrn','condition','medication']]],weight={low:1,medium:2,high:4,critical:8},findings=[];
    columns.forEach(column=>{const snake=column.replace(/(?<!^)(?=[A-Z])/g,'_').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),parts=snake.split('_').filter(Boolean),variants=new Set([snake,...parts]);for(let i=0;i<parts.length-1;i++)variants.add(parts.slice(i,i+2).join('_'));rules.forEach(([category,severity,indicators])=>{if(indicators.some(x=>variants.has(x)))findings.push({column,category,severity});});});
    findings.sort((a,b)=>weight[b.severity]-weight[a.severity]||a.column.localeCompare(b.column));return {findings,score:findings.reduce((s,x)=>s+weight[x.severity],0)};
  }
  function plan(q){
    const l=q.toLowerCase();
    if(l.includes('customer')&&/(top|highest|revenue|sales)/.test(l))return {sql:'SELECT c.name, SUM(o.amount) AS revenue FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id, c.name ORDER BY revenue DESC',why:'Aggregate order value by customer and rank descending.',confidence:.95,kind:'top'};
    if(l.includes('revenue'))return {sql:'SELECT SUM(amount) AS total_revenue FROM orders',why:'Sum the order amount column.',confidence:.9,kind:'revenue'};
    if(l.includes('order'))return {sql:'SELECT * FROM orders ORDER BY created_at DESC',why:'Return recent orders.',confidence:.8,kind:'orders'};
    if(l.includes('customer'))return {sql:'SELECT * FROM customers',why:'Question references customers.',confidence:.55,kind:'customers'};
    throw new Error('Planner could not map the question. Try top customers by revenue, total revenue, recent orders, or customers.');
  }
  function execute(kind){
    if(kind==='revenue')return [{total_revenue:ORDERS.reduce((s,o)=>s+o.amount,0)}];
    if(kind==='orders')return [...ORDERS].sort((a,b)=>b.created_at.localeCompare(a.created_at));
    if(kind==='customers')return CUSTOMERS;
    if(kind==='top')return CUSTOMERS.map(c=>({name:c.name,revenue:ORDERS.filter(o=>o.customer_id===c.id).reduce((s,o)=>s+o.amount,0)})).sort((a,b)=>b.revenue-a.revenue);
    return [];
  }
  function summarize(rows){const out={row_count:rows.length,numeric:{}};if(!rows.length)return out;const values={};rows.forEach(r=>Object.entries(r).forEach(([k,v])=>{if(typeof v==='number'&&Number.isFinite(v))(values[k]||(values[k]=[])).push(v);}));Object.entries(values).forEach(([k,a])=>out.numeric[k]={min:Math.min(...a),max:Math.max(...a),mean:a.reduce((s,v)=>s+v,0)/a.length,sum:a.reduce((s,v)=>s+v,0)});return out;}
  function run(){
    const started=performance.now();
    try{
      const question=$('#question').value.trim(),maxRows=clamp(parseInt($('#maxrows').value||'200',10),1,1000),maxRisk=clamp(parseInt($('#maxrisk').value||'40',10),0,100),p=plan(question),bounded=validateSQL(p.sql,maxRows),r=risk(p.sql);
      if(r.score>maxRisk)throw new Error('Query risk '+r.score+' exceeds configured maximum '+maxRisk+': '+(r.factors.join(', ')||'policy'));
      const rows=execute(p.kind).slice(0,maxRows),summary=summarize(rows),priv=privacy(['id','name','region','email','customer_id','amount','created_at']);
      setHTML('#result',metrics([['Confidence',(p.confidence*100).toFixed(0)+'%'],['Risk',r.score+' · '+r.level,r.level==='high'?'bad':r.level==='medium'?'warn':'good'],['Rows',rows.length],['Privacy score',priv.score,priv.score?'warn':'good']])+
        '<div class="section-title">Query plan</div><code class="code">'+esc(p.sql)+'</code><p class="muted">'+esc(p.why)+'</p>'+
        '<div class="section-title">Bounded read-only SQL</div><code class="code">'+esc(bounded)+'</code><div class="section-title">Executed result</div>'+table(rows)+
        '<div class="section-title">Numeric summary</div><code class="code">'+esc(JSON.stringify(summary,null,2))+'</code>'+
        '<div class="section-title">Schema privacy scan</div>'+priv.findings.map(f=>'<div class="card compact"><strong>'+esc(f.column)+'</strong> '+badge(f.category)+' '+badge(f.severity,f.severity==='critical'||f.severity==='high'?'bad':'warn')+'</div>').join(''));
      trace([{label:'planner',title:'Schema-aware deterministic planner',text:'Confidence '+(p.confidence*100).toFixed(0)+'%. '+p.why},{label:'safety',title:'Read-only SQL validation',text:'Single SELECT/WITH only; write, DDL and administrative operations are forbidden; outer row bound is enforced.'},{label:'risk',title:'Query-risk budget',text:'Score '+r.score+'/100 ('+r.level+'); maximum '+maxRisk+'. '+(r.factors.join(', ')||'No risk factors.')},{label:'privacy',title:'Schema privacy scan',text:'Detected '+priv.findings.length+' sensitive-column signal(s); weighted score '+priv.score+'.'},{label:'execute',title:'Local synthetic execution',text:'Executed the validated plan over '+CUSTOMERS.length+' customers and '+ORDERS.length+' orders.'}]);
    }catch(e){error(e.message);trace([{label:'blocked',title:'Fail-closed policy',text:e.message}]);}
    finish(started);
  }
  shell('<div class="field"><label>Business question</label><textarea id="question">Show the top customers by revenue</textarea></div><div class="control-grid"><div class="field"><label>Max rows</label><input id="maxrows" type="number" min="1" max="1000" value="200"></div><div class="field"><label>Max query risk</label><input id="maxrisk" type="number" min="0" max="100" value="40"></div></div><div class="quick-actions"><button class="btn sample" data-q="What is total revenue?">Total revenue</button><button class="btn sample" data-q="Show recent orders">Recent orders</button><button class="btn sample" data-q="Show customers">Customers</button></div><button id="run" class="btn primary">Plan + validate + execute safely</button>');
  document.querySelectorAll('.sample').forEach(b=>b.onclick=()=>{$('#question').value=b.dataset.q;run();});$('#run').onclick=run;run();
})();