const fs=require('fs');
let s=fs.readFileSync('App.js','utf8');
const start=s.indexOf('function parseMulti(input)');
const next=s.indexOf('\nfunction ', start+1);
if(start<0||next<0){ console.error('parseMulti block not found'); process.exit(1); }
const newFunc = [
'function parseMulti(input){',
'  const str=(input||"").trim();',
'  if(!str) return [];',
'  const parts=str.split(/[\\n,;]+/).map(s=>s.trim()).filter(Boolean);',
'  const out=[];',
'  for(const part of parts){',
'    let m;',
'    if(m=part.match(/^(\\d+)\\s+(.+)$/)){ out.push({ name:m[2].trim(), qty:Math.max(1,parseInt(m[1],10)) }); continue; }',
'    if(m=part.match(/^(.+?)\\s*[xX]\\s*(\\d+)$/)){ out.push({ name:m[1].trim(), qty:Math.max(1,parseInt(m[2],10)) }); continue; }',
'    if(m=part.match(/^(.+?)\\s*(\\d+)\\s*[xX]?$/)){ const name=m[1].trim(); const q=parseInt(m[2],10); if(name){ out.push({ name, qty:Math.max(1,q) }); continue; } }',
'    out.push({ name:part, qty:1 });',
'  }',
'  return out;',
'}',
'' ].join('\\n');
s = s.slice(0,start) + newFunc + s.slice(next);
fs.writeFileSync('App.js', s);
