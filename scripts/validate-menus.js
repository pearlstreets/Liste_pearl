#!/usr/bin/env node
// Valide data/menus : recettes, ingredients, traductions. Usage : node scripts/validate-menus.js
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'data', 'menus');
const COURSES = ['plat', 'entree', 'dessert', 'petit-dejeuner'];
const AISLES = ['fruits-legumes', 'viandes-poissons', 'cremerie', 'epicerie', 'surgeles', 'boulangerie', 'boissons'];
const UNITS = ['g', 'ml', 'u', 'cs', 'cc'];
const TAGS = ['vegetarien', 'vegan', 'sans-gluten', 'sans-lactose', 'sans-porc', 'halal-possible', 'sans-fruits-a-coque', 'enfants', 'rapide', 'batch', 'economique', 'leger', 'hiver', 'printemps', 'ete', 'automne', 'four', 'sans-cuisson'];
const errors = [];
const err = (m) => { if (errors.length < 200) errors.push(m); };

const load = (f) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err(`${path.basename(f)} illisible : ${e.message}`); return null; }
};
const badStr = (s) => typeof s !== 'string' || !s.trim();
const dash = (s) => typeof s === 'string' && /[—–→←⇒]/.test(s);

const recipes = load(path.join(DIR, 'recipes.json')) || [];
const ings = load(path.join(DIR, 'ingredients.json')) || {};
if (!Array.isArray(recipes)) { err('recipes.json doit etre un tableau'); }

// Ingredients
for (const [k, i] of Object.entries(ings)) {
  if (!/^[a-z0-9-]+$/.test(k)) err(`ingredient ${k} : cle invalide`);
  if (badStr(i.emoji)) err(`ingredient ${k} : emoji vide`);
  if (!AISLES.includes(i.aisle)) err(`ingredient ${k} : rayon inconnu ${i.aisle}`);
  if (!i.pack || !(i.pack.qty > 0) || !UNITS.includes(i.pack.unit)) err(`ingredient ${k} : pack invalide`);
  if (typeof i.pantry !== 'boolean') err(`ingredient ${k} : pantry doit etre booleen`);
  const unitPrice = i.pack && i.pack.unit === 'u';
  if (unitPrice && !(i.pricePerUnit > 0)) err(`ingredient ${k} : pricePerUnit manquant`);
  if (!unitPrice && !(i.pricePerKgOrL > 0)) err(`ingredient ${k} : pricePerKgOrL manquant`);
  if (dash(JSON.stringify(i))) err(`ingredient ${k} : tiret cadratin ou fleche`);
}

// Recettes
const ids = new Set();
const used = new Set();
let costSum = 0, costN = 0;
const counts = {};
(Array.isArray(recipes) ? recipes : []).forEach((r, n) => {
  const id = r && r.id;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id || '')) { err(`recette #${n} : id invalide`); return; }
  if (ids.has(id)) err(`${id} : id en double`);
  ids.add(id);
  counts[r.course] = (counts[r.course] || 0) + 1;
  if (!COURSES.includes(r.course)) err(`${id} : course inconnue`);
  if (typeof r.image !== 'boolean') err(`${id} : image doit etre booleen`);
  if (!(r.timeMin > 0)) err(`${id} : timeMin`);
  if (![1, 2, 3].includes(r.difficulty)) err(`${id} : difficulty`);
  if (r.servings !== 4) err(`${id} : servings doit valoir 4`);
  if (!(r.kcal > 0) || !(r.protein >= 0)) err(`${id} : kcal ou protein`);
  if (typeof r.leftoverOk !== 'boolean') err(`${id} : leftoverOk`);
  if (!Array.isArray(r.tags)) err(`${id} : tags`);
  else {
    r.tags.forEach((t) => { if (!TAGS.includes(t)) err(`${id} : tag inconnu ${t}`); });
    if (new Set(r.tags).size !== r.tags.length) err(`${id} : tags en double`);
  }
  if (!Array.isArray(r.ingredients) || r.ingredients.length < 2) { err(`${id} : ingredients`); return; }
  let c = 0;
  const seen = new Set();
  const al = new Set();
  let meat = false;
  for (const x of r.ingredients) {
    const i = ings[x.key];
    if (!i) { err(`${id} : ingredient inconnu ${x.key}`); continue; }
    if (seen.has(x.key)) err(`${id} : ingredient en double ${x.key}`);
    seen.add(x.key); used.add(x.key);
    if (!(x.qty > 0)) err(`${id} : qty ${x.key}`);
    if (!UNITS.includes(x.unit)) err(`${id} : unite ${x.key}`);
    else if (x.unit === 'cs' || x.unit === 'cc') { if (!i.pantry) err(`${id} : ${x.key} en ${x.unit} doit etre pantry`); }
    else if (x.unit !== i.pack.unit) err(`${id} : ${x.key} unite ${x.unit} differente du pack ${i.pack.unit}`);
    (i.allergens || []).forEach((a) => al.add(a));
    if (i.aisle === 'viandes-poissons' || (i.allergens || []).includes('crustaces')) meat = true;
    if (!i.pantry && !x.optional) c += i.pricePerUnit !== undefined ? i.pricePerUnit * x.qty : (i.pricePerKgOrL * x.qty) / 1000;
  }
  // Coherence des tags alimentaires
  const has = (t) => (r.tags || []).includes(t);
  if (has('vegetarien') && meat) err(`${id} : tag vegetarien mais viande ou poisson`);
  if (has('vegan') && (meat || al.has('lait') || al.has('oeuf') || al.has('miel'))) err(`${id} : tag vegan incoherent`);
  if (has('sans-gluten') && al.has('gluten')) err(`${id} : tag sans-gluten incoherent`);
  if (has('sans-lactose') && al.has('lait')) err(`${id} : tag sans-lactose incoherent`);
  if ((has('sans-porc') || has('halal-possible')) && al.has('porc')) err(`${id} : tag sans-porc incoherent`);
  if (has('sans-fruits-a-coque') && al.has('fruits-a-coque')) err(`${id} : tag sans-fruits-a-coque incoherent`);
  costSum += c / 4; costN++;
});

// Traductions
const files = fs.existsSync(path.join(DIR, 'i18n')) ? fs.readdirSync(path.join(DIR, 'i18n')).filter((f) => f.endsWith('.json')).sort() : [];
if (!files.includes('fr.json')) err('i18n/fr.json manquant');
const fr = load(path.join(DIR, 'i18n', 'fr.json')) || { recipes: {}, ingredients: {} };
const frSteps = {};
for (const r of recipes) frSteps[r.id] = ((fr.recipes || {})[r.id] || {}).steps;
for (const f of files) {
  const lang = f.replace('.json', '');
  const d = load(path.join(DIR, 'i18n', f));
  if (!d) continue;
  const R = d.recipes || {}, I = d.ingredients || {};
  for (const r of recipes) {
    const t = R[r.id];
    if (!t) { err(`${lang} : traduction manquante pour ${r.id}`); continue; }
    if (badStr(t.title)) err(`${lang}:${r.id} : titre vide`);
    if (!Array.isArray(t.steps) || !t.steps.length) { err(`${lang}:${r.id} : etapes absentes`); continue; }
    t.steps.forEach((s, k) => { if (badStr(s)) err(`${lang}:${r.id} : etape ${k + 1} vide`); });
    const ref = frSteps[r.id];
    if (ref && t.steps.length !== ref.length) err(`${lang}:${r.id} : ${t.steps.length} etapes au lieu de ${ref.length}`);
    if (lang === 'fr' && (t.steps.length < 3 || t.steps.length > 6)) err(`fr:${r.id} : il faut 3 a 6 etapes`);
    if (r.stepTimers) for (const k of Object.keys(r.stepTimers)) if (!(+k >= 0 && +k < t.steps.length)) err(`${r.id} : stepTimers index ${k} hors etapes`);
    if (dash(t.title) || t.steps.some(dash)) err(`${lang}:${r.id} : tiret cadratin ou fleche`);
  }
  for (const k of Object.keys(ings)) {
    if (badStr(I[k])) err(`${lang} : nom d'ingredient manquant ou vide ${k}`);
    else if (dash(I[k])) err(`${lang}:${k} : tiret cadratin ou fleche`);
  }
  for (const id of Object.keys(R)) if (!ids.has(id)) err(`${lang} : traduction orpheline ${id}`);
}
for (const k of Object.keys(ings)) if (!used.has(k)) console.warn(`avertissement : ingredient non utilise ${k}`);

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} erreur(s)`);
  process.exit(1);
}
console.log(`OK : ${recipes.length} recettes (${Object.entries(counts).map(([k, v]) => k + ' ' + v).join(', ')}), ${Object.keys(ings).length} ingredients, ${files.length} langue(s) : ${files.join(', ')}`);
console.log(`Cout estime moyen par portion : ${(costSum / costN).toFixed(2)} EUR`);
