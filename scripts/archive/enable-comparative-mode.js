const fs = require('fs');

const FILE = 'App.js';
let s = fs.readFileSync(FILE,'utf8');
let changed = false;

// 1) import helper
if (!s.includes('utils/distributionMode')) {
  s = s.replace(/(^import .*?;[\r\n]+)/, `$1import { isOptimized, setOptimized } from "./utils/distributionMode";\n`);
  changed = true;
}

// 2) insérer helper itemsToRenderForShop si absent
if (!s.includes('function itemsToRenderForShop(')) {
  const helper = `
function itemsToRenderForShop(allUserItems, assignedForThisShop){
  const A = Array.isArray(allUserItems) ? allUserItems : [];
  const B = Array.isArray(assignedForThisShop) ? assignedForThisShop : [];
  return isOptimized() ? B : A;
}
`;
  // insère juste après le premier import React pour rester sûr
  const idx = s.indexOf('\n', s.indexOf('from "react"'));
  if (idx > -1) {
    s = s.slice(0, idx+1) + helper + s.slice(idx+1);
    changed = true;
  }
}

// 3) rendre le chip "Optimisé" basculant
// essaie de faire réagir tout bouton lié à singleShop
const rePress = /onPress=\{([^}]*)\}/g;
s = s.replace(rePress, (m, body) => {
  if (/singleShop/.test(body) && !/setOptimized\(true\)/.test(body)) {
    changed = true;
    return `onPress={()=>{ setOptimized(true); }}`;
  }
  // pour les autres chips de stratégie, on repasse en comparatif
  if (/(balanced|totalPrice|time)/i.test(body) && !/setOptimized\(false\)/.test(body)) {
    changed = true;
    return `onPress={()=>{ setOptimized(false); }}`;
  }
  return m;
});

// 4) forcer la source d'items par magasin
// on cible plusieurs noms possibles de variable
const candidates = [
  'itemsForShop','shopItems','productsForShop','itemsThisShop','assignedItems'
];

for (const name of candidates) {
  const decl = new RegExp(`\\b(const|let|var)\\s+${name}\\s*=\\s*([^;]+);`);
  if (decl.test(s)) {
    s = s.replace(decl, (m, kind, rhs) => {
      // on cherche une liste utilisateur probable
      // noms possibles trouvés sur des projets similaires
      const userNames = ['items','list','userItems','myList','shoppingList','allItems'];
      let userVar = null;
      for (const u of userNames) {
        const rx = new RegExp(`\\b${u}\\b`);
        if (rx.test(s)) { userVar = u; break; }
      }
      const userSrc = userVar ? userVar : name; // fallback
      changed = true;
      return `${kind} ${name} = ${rhs};
const __allUserItems = Array.isArray(${userSrc}) ? ${userSrc} : [];
const itemsForUI = itemsToRenderForShop(__allUserItems, ${name});`;
    });

    // remplacer usages courants pour l’affichage
    const useRe = new RegExp(`\\b${name}(\\s*\\)|\\s*\\]|\\.map)`, 'g');
    if (useRe.test(s)) {
      s = s.replace(useRe, 'itemsForUI$1');
      changed = true;
    }
  }
}

// 5) si on n’a pas pu remplacer, on log pour debug
if (!changed) {
  console.log('No safe pattern matched. Nothing changed.');
} else {
  fs.writeFileSync(FILE, s);
  console.log('Comparative mode enabled by injector.');
}
