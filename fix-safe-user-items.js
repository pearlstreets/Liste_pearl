const fs = require('fs');
const FILE = 'App.js';
let s = fs.readFileSync(FILE, 'utf8');
let changed = false;

if (!s.includes('function __getUserItems(')) {
  const anchor = s.indexOf('from "react"');
  if (anchor > -1) {
    const nl = s.indexOf('\n', anchor);
    const helper = `
function __getUserItems(){
  try { if (typeof items !== "undefined" && Array.isArray(items)) return items; } catch(_) {}
  try { if (typeof list !== "undefined" && Array.isArray(list)) return list; } catch(_) {}
  try { if (typeof userItems !== "undefined" && Array.isArray(userItems)) return userItems; } catch(_) {}
  try { if (typeof myList !== "undefined" && Array.isArray(myList)) return myList; } catch(_) {}
  return [];
}
`;
    s = s.slice(0, nl+1) + helper + s.slice(nl+1);
    changed = true;
  }
}

// Remplacer l'IIFE insérée pour utiliser __getUserItems()
s = s.replace(
  /return\s+src\.map\(g=>\{\s*const\s+assigned[\s\S]*?return\s*\{\s*\.\.\.g,\s*__renderItems:[\s\S]*?\}\s*;\s*\}\);\s*\}\)\(\)\}\}/m,
  `return src.map(g=>{
        const assigned = g.items || g.products || g.lines || [];
        const user = __getUserItems();
        return { ...g, __renderItems: itemsToRenderForShop(user, assigned) };
      });
    })()}`
);

if (s.includes('Array.isArray(items)?items:(Array.isArray(list)?list:[])')) {
  s = s.replace(
    'const user = Array.isArray(items)?items:(Array.isArray(list)?list:[])',
    'const user = __getUserItems()'
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(FILE, s);
  console.log('Safe user-items patch applied.');
} else {
  console.log('No changes needed.');
}
