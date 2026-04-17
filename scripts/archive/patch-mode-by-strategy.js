const fs = require('fs');
const FILE = 'App.js';
let s = fs.readFileSync(FILE,'utf8');
let changed = false;

// Remplace la fonction itemsToRenderForShop pour accepter un 3e paramètre "optimized"
if (s.includes('function itemsToRenderForShop(')) {
  const start = s.indexOf('function itemsToRenderForShop(');
  let i = start, depth = 0, end = -1;
  while (i < s.length) {
    const ch = s[i++];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end > start) {
    const fn = `
function itemsToRenderForShop(allUserItems, assignedForThisShop, optimized){
  const A = Array.isArray(allUserItems) ? allUserItems : [];
  const B = Array.isArray(assignedForThisShop) ? assignedForThisShop : [];
  const opt = typeof optimized === "boolean" ? optimized : false;
  return opt ? B : A;
}
`;
    s = s.slice(0, start) + fn + s.slice(end);
    changed = true;
  }
}

// Dans le mapping groups -> __renderItems, passe le flag optimized basé sur strategy==='single'
if (/itemsToRenderForShop\(user,\s*assigned\)/.test(s)) {
  s = s.replace(/itemsToRenderForShop\(user,\s*assigned\)/g, 'itemsToRenderForShop(user, assigned, (typeof strategy !== "undefined" ? strategy === "single" : false))');
  changed = true;
}

// Variante si l'appel a un 3e param déjà présent mais vide
if (/itemsToRenderForShop\(user,\s*assigned,\s*\)/.test(s)) {
  s = s.replace(/itemsToRenderForShop\(user,\s*assigned,\s*\)/g, 'itemsToRenderForShop(user, assigned, (typeof strategy !== "undefined" ? strategy === "single" : false))');
  changed = true;
}

if (changed) {
  fs.writeFileSync(FILE, s);
  console.log('Mode comparatif dérivé de strategy appliqué.');
} else {
  console.log('Aucun changement (déjà appliqué ou patterns non trouvés).');
}
