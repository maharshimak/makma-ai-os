'use strict';
(() => {
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[ch]);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const finite = (v) => Number.isFinite(Number(v));
  const num = (v, fallback = 0) => finite(v) ? Number(v) : fallback;
  const fmt = (v, d = 3) => Number(v).toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  const tokens = (text) => String(text).toLowerCase().match(/[a-z0-9_'-]+/g) || [];
  const uniq = (arr) => [...new Set(arr)];
  const mean = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
  const parseNums = (v) => String(v).split(/[\s,]+/).filter(Boolean).map(Number);
  const readNumber = (selector, label, {min=-Infinity,max=Infinity,integer=false}={}) => {
    const el=$(selector);
    if(!el) throw new Error(label+' control is missing.');
    const raw=String(el.value).trim();
    if(!raw) throw new Error(label+' is required.');
    const value=Number(raw);
    if(!Number.isFinite(value)) throw new Error(label+' must be a finite number.');
    if(integer && !Number.isInteger(value)) throw new Error(label+' must be an integer.');
    if(value<min || value>max) throw new Error(label+' must be between '+min+' and '+max+'.');
    return value;
  };
  const parseNumberList = (value,label,{min=0}={}) => {
    const values=String(value).split(/[\s,]+/).filter(Boolean).map(Number);
    if(!values.length) throw new Error(label+' must contain at least one number.');
    if(values.some(v=>!Number.isFinite(v))) throw new Error(label+' contains a non-numeric value.');
    if(values.some(v=>v<min)) throw new Error(label+' values must be at least '+min+'.');
    return values;
  };
  const parseJson = (value,label='JSON') => {
    try { return JSON.parse(String(value)); }
    catch { throw new Error(label+' is not valid JSON.'); }
  };
  const fnv1a = (text) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };
  const fingerprint = async (value) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    return fnv1a(text).toString(16).padStart(8,'0');
  };
  const table = (rows) => {
    if (!rows?.length) return '<div class="empty-note">No rows returned.</div>';
    const cols = uniq(rows.flatMap(r => Object.keys(r)));
    return '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      cols.map(c=>'<th>'+esc(c)+'</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r=>'<tr>'+cols.map(c=>'<td>'+esc(r[c])+'</td>').join('')+'</tr>').join('') +
      '</tbody></table></div>';
  };
  const metrics = (items) => '<div class="metric-row">' + items.map(([k,v,cls='']) =>
    '<div class="mini-metric '+cls+'"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>'
  ).join('') + '</div>';
  const code = (value, id='') => '<code '+(id?'id="'+esc(id)+'" ':'')+'class="code">'+esc(value)+'</code>';
  const badge = (text, kind='') => '<span class="pill '+kind+'">'+esc(text)+'</span>';
  const setHTML = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  const trace = (items) => setHTML('#trace', items.map((x,i) =>
    '<div class="step"><div class="kicker">'+String(i+1).padStart(2,'0')+' · '+esc(x.label)+'</div>'+
    '<h3>'+esc(x.title)+'</h3><p>'+esc(x.text)+'</p>'+(x.code?code(x.code):'')+'</div>'
  ).join(''));
  const error = (message) => setHTML('#result',
    '<div class="error-box"><strong>Could not run this workflow</strong><p>'+esc(message)+'</p></div>'
  );
  const shell = (inner) => {
    const root = $('#tool-root');
    root.className = 'tool-layout';
    root.innerHTML =
      '<section class="panel tool-input"><div class="panel-head"><div><small>Interactive workspace</small>'+
      '<h2>Configure & run</h2></div><span class="status"><i class="dot"></i> live browser engine</span></div>'+
      '<div class="body">'+inner+'</div></section>'+
      '<aside class="panel result"><div class="panel-head"><div><small>Computed output</small><h2>Results</h2></div>'+
      '<span id="run-latency" class="pill">ready</span></div><div class="body"><div id="result" class="result-content"></div>'+
      '<div class="section-title">Execution trace</div><div id="trace" class="trace"></div></div></aside>';
    $$('.field', root).forEach((field, index) => {
      const label=$('label',field),control=$('input, textarea, select',field);
      if(!label||!control)return;
      if(!control.id)control.id='makma-field-'+index;
      label.htmlFor=control.id;
    });
  };
  const finish = (started) => {
    const el = $('#run-latency');
    if (el) el.textContent = fmt(performance.now() - started, 2) + ' ms';
  };
  const copyText = async (text, button) => {
    try {
      await navigator.clipboard.writeText(text);
      const before = button.textContent;
      button.textContent = 'Copied';
      setTimeout(()=>button.textContent=before, 900);
    } catch {
      button.textContent = 'Copy failed';
    }
  };
  const psi = (expected, actual, epsilon=1e-6) => {
    if (expected.length !== actual.length || !expected.length) throw new Error('Distributions must use equal non-empty bins.');
    if ([...expected,...actual].some(v=>!Number.isFinite(v)||v<0)) throw new Error('Distribution bins must be finite and non-negative.');
    const et=expected.reduce((a,b)=>a+b,0), at=actual.reduce((a,b)=>a+b,0);
    if (et<=0 || at<=0) throw new Error('Distribution totals must be positive.');
    return expected.reduce((sum,e,i)=>{
      e=Math.max(e/et,epsilon);
      const a=Math.max(actual[i]/at,epsilon);
      return sum + (a-e)*Math.log(a/e);
    },0);
  };
  window.MAKMA = {$,$,esc,clamp,finite,num,fmt,tokens,uniq,mean,parseNums,readNumber,parseNumberList,parseJson,fnv1a,fingerprint,table,metrics,code,badge,setHTML,trace,error,shell,finish,copyText,psi};
})();

