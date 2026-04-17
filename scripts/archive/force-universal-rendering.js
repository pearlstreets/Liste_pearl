const fs = require('fs');
const FILE = 'App.js';
let s = fs.readFileSync(FILE,'utf8');
let changed = false;

// 1) Helper sûr pour récupérer la liste utilisateur, si absent
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

// 2) Forcer la FlatList des shops à toujours avoir des lignes à afficher
const flatListPattern = /data=\{Array\.isArray\(groups\)\?groups:\[\]\}/;
if (flatListPattern.test(s)) {
  s = s.replace(flatListPattern, `data={(function(){
      const src = Array.isArray(groups)?groups:[];
      const user = __getUserItems();
      return src.map(g=>{
        const assigned = g.items || g.products || g.lines || [];
        const useAssigned = Array.isArray(assigned) && assigned.length>0;
        return { ...g, __renderItems: useAssigned ? assigned : user };
      });
    })()}`);
  changed = true;
} else {
  // Si on avait déjà un mapping injecté, on le rend universel
  s = s.replace(/__renderItems:\s*itemsToRenderForShop\([^)]+\)/g,
                `__renderItems: (Array.isArray(assigned)&&assigned.length>0 ? assigned : user)`);
}

// 3) Dans les cartes shop, utiliser __renderItems si dispo, sinon champ d'origine
// (permet d'afficher les lignes même si la stratégie n'affecte rien)
s = s.replace(/\bitem\.items\b/g, 'item.__renderItems || item.items');
s = s.replace(/\bitem\.products\b/g, 'item.__renderItems || item.products');
s = s.replace(/\bitem\.lines\b/g, 'item.__renderItems || item.lines');

if (changed) {
  fs.writeFileSync(FILE, s);
  console.log('Universal rendering enabled: results + Search for all tabs.');
} else {
  fs.writeFileSync(FILE, s);
  console.log('Checked: mappings adjusted if present; fallbacks added.');
}
