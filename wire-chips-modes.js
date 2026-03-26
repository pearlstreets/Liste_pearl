const fs = require('fs');
const FILE = 'App.js';
let s = fs.readFileSync(FILE, 'utf8');
let changed = false;

if (!/from "\.\/utils\/distributionMode"/.test(s)) {
  s = s.replace(/(^import .*?;[\r\n]+)/, `$1import { setOptimized } from "./utils/distributionMode";\n`);
  changed = true;
}

if (s.includes("onPress={()=>setStrategy('eco')}")) {
  s = s.replace("onPress={()=>setStrategy('eco')}", "onPress={()=>{ setOptimized(false); setStrategy('eco'); }}");
  changed = true;
}

if (s.includes("onPress={()=>setStrategy('fast')}")) {
  s = s.replace("onPress={()=>setStrategy('fast')}", "onPress={()=>{ setOptimized(false); setStrategy('fast'); }}");
  changed = true;
}

if (s.includes("onPress={()=>setStrategy('single')}")) {
  s = s.replace("onPress={()=>setStrategy('single')}", "onPress={()=>{ setOptimized(true); setStrategy('single'); }}");
  changed = true;
}

if (s.includes("label={t('productsScreen.strategies.balanced')}") && !/setOptimized\(\s*false\s*\)/.test(s.substring(s.indexOf("label={t('productsScreen.strategies.balanced')}"), s.indexOf("\n", s.indexOf("label={t('productsScreen.strategies.balanced')}"))+200))) {
  s = s.replace(/<Chip\s+label=\{t\('productsScreen\.strategies\.balanced'\)\}([\s\S]*?)\/>/, `<Chip label={t('productsScreen.strategies.balanced')}  active={strategy==='balanced'} onPress={()=>{ setOptimized(false); }} />`);
  changed = true;
}

if (changed) {
  fs.writeFileSync(FILE, s);
  console.log('Chips wired to modes.');
} else {
  console.log('No chip changes needed.');
}
