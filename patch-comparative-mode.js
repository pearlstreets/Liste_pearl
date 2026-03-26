const fs = require('fs');
const FILE = 'App.js';
let s = fs.readFileSync(FILE,'utf8');
let changed = false;

// Import
if (!/from "\.\/utils\/distributionMode"/.test(s)) {
  s = s.replace(/(^import .*?;[\r\n]+)/, `$1import { isOptimized, setOptimized } from "./utils/distributionMode";\n`);
  changed = true;
}

// Inject helper itemsToRenderForShop après import React
if (!s.includes('function itemsToRenderForShop(')) {
  const anchor = s.indexOf('from "react"');
  if (anchor > -1) {
    const nl = s.indexOf('\n', anchor);
    const helper = `
function itemsToRenderForShop(allUserItems, assignedForThisShop){
  const A = Array.isArray(allUserItems) ? allUserItems : [];
  const B = Array.isArray(assignedForThisShop) ? assignedForThisShop : [];
  return isOptimized() ? B : A;
}
`;
    s = s.slice(0, nl+1) + helper + s.slice(nl+1);
    changed = true;
  }
}

// Chips: équilibré -> Mode 2
s = s.replace(
  /<Chip\s+label=\{t\('productsScreen\.strategies\.balanced'\)\}[\s\S]*?onPress=\{\(\)\s*=>\s*\{[\s\S]*?\}\s*\}\s*\/>/,
  `<Chip label={t('productsScreen.strategies.balanced')}  active={strategy==='balanced'} onPress={()=>{ setOptimized(false); }} />`
) || s;

// Chips: totalPrice -> Mode 2 + setStrategy('eco')
s = s.replace(
  /<Chip\s+label=\{t\('productsScreen\.strategies\.totalPrice'\)\}[\s\S]*?onPress=\{\(\)\s*=>\s*setStrategy\('eco'\)\s*\}\s*\/>/,
  `<Chip label={t('productsScreen.strategies.totalPrice')}  active={strategy==='eco'}      onPress={()=>{ setOptimized(false); setStrategy('eco'); }} />`
) || s;

// Chips: time -> Mode 2 + setStrategy('fast')
s = s.replace(
  /<Chip\s+label=\{t\('productsScreen\.strategies\.time'\)\}[\s\S]*?onPress=\{\(\)\s*=>\s*setStrategy\('fast'\)\s*\}\s*\/>/,
  `<Chip label={t('productsScreen.strategies.time')}       active={strategy==='fast'}     onPress={()=>{ setOptimized(false); setStrategy('fast'); }} />`
) || s;

// Chip: singleShop -> Optimisé (Mode 1) + setStrategy('single')
s = s.replace(
  /<Chip\s+label=\{t\('productsScreen\.strategies\.singleShop'\)\}[\s\S]*?onPress=\{\(\)\s*=>\s*setStrategy\('single'\)\s*\}\s*\/>/,
  `<Chip label={t('productsScreen.strategies.singleShop')}   active={strategy==='single'}   onPress={()=>{ setOptimized(true); setStrategy('single'); }} />`
) || s;

// FlatList des shops: remappe data => groupsUI avec __renderItems
if (s.includes('data={Array.isArray(groups)?groups:[]}')) {
  s = s.replace(
    'data={Array.isArray(groups)?groups:[]}',
    `data={(function(){
      const src = Array.isArray(groups)?groups:[];
      const user = Array.isArray(items)?items:(Array.isArray(list)?list:[]);
      return src.map(g=>{
        const assigned = g.items || g.products || g.lines || [];
        return { ...g, __renderItems: itemsToRenderForShop(user, assigned) };
      });
    })()}`
  );
  changed = true;
}

// Dans le bloc render du shop, remplace les sources items par __renderItems si présentes
s = s.replace(/item\.items\b/g, 'item.__renderItems');
s = s.replace(/item\.products\b/g, 'item.__renderItems');
s = s.replace(/item\.lines\b/g, 'item.__renderItems');

if (changed) {
  fs.writeFileSync(FILE, s);
  console.log('Comparative mode patch applied.');
} else {
  console.log('Nothing changed (patterns not found or already patched).');
}
