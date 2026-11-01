#!/usr/bin/env node
// Valide data/menus : recettes ecrites a la main, ingredients, traductions, et catalogue genere compact (data/menus/gen).
// Usage : node scripts/validate-menus.js [--racine <dossier>] [--gen <dossier>]
//   --racine   racine du depot a valider (defaut : ce depot) ; data/menus et scripts/menus-gen y sont lus
//   --gen      dossier du catalogue genere (defaut : <racine>/data/menus/gen ; ex. data/menus/gen-fixture)
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const argVal = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const ROOT = path.resolve(argVal('--racine', path.join(__dirname, '..')));
const DIR = path.join(ROOT, 'data', 'menus');
const GEN_DEFAUT = path.join(DIR, 'gen');
const GEN_DIR = path.resolve(argVal('--gen', GEN_DEFAUT));
const COURSES = ['plat', 'entree', 'dessert', 'petit-dejeuner'];
const AISLES = ['fruits-legumes', 'viandes-poissons', 'cremerie', 'epicerie', 'surgeles', 'boulangerie', 'boissons'];
const UNITS = ['g', 'ml', 'u', 'cs', 'cc'];
const TAGS = ['vegetarien', 'vegan', 'sans-gluten', 'sans-lactose', 'sans-porc', 'halal-possible', 'sans-fruits-a-coque', 'enfants', 'rapide', 'batch', 'economique', 'leger', 'hiver', 'printemps', 'ete', 'automne', 'four', 'sans-cuisson'];
const { ALG_KEYS, ALLERGENES_MINIMUM, REGIMES, lexique, regimesDe, derivesAllergene } = require('./menus-gen/regimes');
const { ingredientsCites } = require('./menus-gen/cites');
const DERIVES = derivesAllergene(path.join(__dirname, '..')); // table de lib/menus/allergens.js (code de l'application)
const errors = [];
let errTotal = 0;
let masquees = 0;
const err = (m) => { errTotal++; if (errors.length < 200) errors.push(m); else masquees++; };
// Erreurs regroupees par regle (catalogue genere : des milliers de cas possibles) : un seul message par regle.
const groupes = new Map();
const agg = (regle, exemple) => {
  let g = groupes.get(regle);
  if (!g) { g = { n: 0, ex: [] }; groupes.set(regle, g); }
  g.n++;
  if (g.ex.length < 5) g.ex.push(exemple);
};
const avertissements = new Map();
const avert = (regle, exemple) => {
  let g = avertissements.get(regle);
  if (!g) { g = { n: 0, ex: [] }; avertissements.set(regle, g); }
  g.n++;
  if (g.ex.length < 3) g.ex.push(exemple);
};

const load = (f) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err(`${path.basename(f)} illisible : ${e.message}`); return null; }
};
const badStr = (s) => typeof s !== 'string' || !s.trim();
// tirets cadratin et demi-cadratin, fleches
const DASH = /[—–‒―→←↔⇒⇔➔➜➡⟶]/;
const dash = (s) => typeof s === 'string' && DASH.test(s);

const recipes = load(path.join(DIR, 'recipes.json')) || [];
const ings = load(path.join(DIR, 'ingredients.json')) || {};
if (!Array.isArray(recipes)) { err('recipes.json doit etre un tableau'); }
const frRecettes = ((load(path.join(DIR, 'i18n', 'fr.json')) || {}).recipes) || {};
// Noms francais des ingredients : un nom qui evoque celeri, moutarde, lupin, sulfites, mollusques ou arachide doit le declarer.
{
  const frIng = ((load(path.join(DIR, 'i18n', 'fr.json')) || {}).ingredients) || {};
  const CONTROLES = ['celeri', 'moutarde', 'lupin', 'sulfites', 'crustaces', 'fruits-a-coque'];
  for (const [k, i] of Object.entries(ings)) {
    const lex = lexique(frIng[k] || k.replace(/-/g, ' '));
    for (const a of CONTROLES) if (lex.has(a) && !(i.allergens || []).includes(a)) err(`ingredient ${k} : le nom evoque « ${a} » mais la fiche ne le declare pas`);
  }
}

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
  const al = Array.isArray(i.allergens) ? i.allergens : [];
  if (i.allergens !== undefined && !Array.isArray(i.allergens)) err(`ingredient ${k} : allergens doit etre une liste`);
  for (const a of al) if (!ALG_KEYS.includes(a)) err(`ingredient ${k} : allergene inconnu ${a}`);
  for (const a of ALLERGENES_MINIMUM[k] || []) if (!al.includes(a)) err(`ingredient ${k} : doit declarer l'allergene ${a} (scripts/menus-gen/regimes.js)`);
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
  // Conservation : prudente et exigée. Poisson et fruits de mer : 2 jours au réfrigérateur, jamais congelés ici.
  if (!Number.isInteger(r.keepDays) || r.keepDays < 1 || r.keepDays > 14) err(`${id} : keepDays`);
  if (typeof r.freezable !== 'boolean') err(`${id} : freezable`);
  const seafood = (Array.isArray(r.ingredients) ? r.ingredients : []).some((x) =>
    ((ings[x.key] && ings[x.key].allergens) || []).some((a) => a === 'poisson' || a === 'crustaces')
  );
  if (seafood && r.keepDays > 2) err(`${id} : keepDays trop long pour du poisson`);
  if (seafood && r.freezable) err(`${id} : poisson deja cuisine, pas de congelation`);
  const timers = r.stepTimers && typeof r.stepTimers === 'object' ? r.stepTimers : {};
  if (r.stepKinds !== undefined) {
    if (!r.stepKinds || typeof r.stepKinds !== 'object') err(`${id} : stepKinds`);
    else
      Object.entries(r.stepKinds).forEach(([k, v]) => {
        if (!['four', 'feu', 'repos'].includes(v)) err(`${id} : stepKinds ${k}`);
        if (!(k in timers)) err(`${id} : stepKinds ${k} sans minuteur`);
      });
  }
  if (Object.keys(timers).some((k) => !r.stepKinds || !r.stepKinds[k])) err(`${id} : stepKinds incomplet`);
  if (r.ovenTempC !== undefined && !(Number.isInteger(r.ovenTempC) && r.ovenTempC >= 100 && r.ovenTempC <= 280))
    err(`${id} : ovenTempC`);
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
  // Tags de regime : exactement ceux des regles communes (scripts/menus-gen/regimes.js : allergenes, doutes, etapes)
  const etapesFr = (((frRecettes || {})[id] || {}).steps || []).filter((x) => typeof x === 'string');
  const attendus = regimesDe({ cles: r.ingredients.map((x) => x.key), ings, derives: DERIVES, textes: etapesFr }).tags;
  for (const t of REGIMES) {
    if (has(t) && !attendus.has(t)) err(`${id} : tag ${t} trop permissif (allergenes, doutes ou etapes)`);
    if (!has(t) && attendus.has(t)) err(`${id} : tag ${t} manquant (regles de regimes.js)`);
  }
  // Ingredients cites dans les etapes (beurre, huile, ail, sel, poivre, moutarde, porc...) : presents dans la liste
  const cites = ingredientsCites(etapesFr, r.ingredients.map((x) => x.key), ings);
  for (const a of cites.ajouts) err(`${id} : « ${a[0]} » cite dans les etapes mais absent des ingredients`);
  for (const m of cites.manquants) err(`${id} : « ${m} » cite dans les etapes sans ingredient correspondant`);
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

/* ======================================================================================================== */
/* Catalogue genere compact (data/menus/gen) : decodage independant de lib/menus/catalog.js, memes contrats    */
/* ======================================================================================================== */

// Contrat attendu des colonnes (CONCEPTION.md 2.2, avec nPhr). Le validateur ne se fie pas a meta.FIELDS : il le compare.
const FIELDS_ATTENDUS = [['course', 1], ['sub', 1], ['family', 1], ['tags', 3], ['time', 2], ['diff', 1], ['kcal', 2], ['prot', 2], ['keep', 1], ['flags', 1], ['cost', 2], ['alg', 3], ['nIng', 1], ['nStep', 1], ['nPhr', 1], ['main1', 2], ['main2', 2], ['serv', 1]];
const ALG_ATTENDUS = ALG_KEYS; // ordre fige des bits de la colonne alg (scripts/menus-gen/regimes.js)
const LANGUES_13 = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ar', 'sv', 'th'];
const LATINES = new Set(['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'sv']);
const ECRITURE = {
  ru: /[Ѐ-ӿ]/, ar: /[؀-ۿ]/, th: /[฀-๿]/, zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/,
};
const ALPHA64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const TAB64 = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) TAB64[ALPHA64.charCodeAt(i)] = i;
function lireB64(str, pos, n) {
  if (typeof str !== 'string' || pos < 0 || pos + n > str.length) return -1;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const c = str.charCodeAt(pos + i);
    const d = c < 128 ? TAB64[c] : -1;
    if (d < 0) return -1;
    v = v * 64 + d;
  }
  return v;
}
const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const { memesChiffres } = require('./menus-gen/chiffres');
const ALCOOL_MOTS = new Set('vin biere rhum cognac whisky vodka alcool cidre calvados porto marsala kirsch liqueur'.split(' '));
const estAlcool = (nomFr) => {
  const n = ` ${norm(nomFr)} `;
  return n.includes(' extrait de vanille ') || n.split(' ').some((m) => ALCOOL_MOTS.has(m));
};

let infoCatalogue = null;

function validerCatalogue() {
  const metaF = path.join(GEN_DIR, 'meta.js');
  if (!fs.existsSync(metaF)) { console.log(`Catalogue genere absent (${path.relative(ROOT, GEN_DIR)}) : controle ignore`); return; }
  let meta, hdr, loaders;
  try {
    meta = require(metaF);
    hdr = require(path.join(GEN_DIR, 'hdr.js'));
    loaders = require(path.join(GEN_DIR, 'loaders.js'));
  } catch (e) {
    err(`catalogue genere illisible : ${e.message}`);
    return;
  }
  const ok = (cond, regle, ex) => { if (!cond) agg(regle, ex); return cond; };

  // --- meta ---------------------------------------------------------------------------------------
  const N = meta.N;
  if (!Number.isInteger(N) || N <= 0) { err('catalogue : meta.N invalide'); return; }
  const SHARD = meta.SHARD;
  if (!Number.isInteger(SHARD) || SHARD <= 0) { err('catalogue : meta.SHARD invalide'); return; }
  const nBlocs = Math.ceil(N / SHARD);
  ok(loaders.NB_BLOCS === nBlocs, 'loaders : NB_BLOCS different de ceil(N / SHARD)', `${loaders.NB_BLOCS} contre ${nBlocs}`);
  ok(JSON.stringify(meta.FIELDS) === JSON.stringify(FIELDS_ATTENDUS), 'meta : FIELDS different du contrat', JSON.stringify(meta.FIELDS));
  ok(JSON.stringify(meta.TAGS) === JSON.stringify(TAGS), 'meta : TAGS different de la liste du validateur', '');
  ok(JSON.stringify(meta.COURSES) === JSON.stringify(COURSES), 'meta : COURSES different', '');
  ok(JSON.stringify(meta.ALG_KEYS) === JSON.stringify(ALG_ATTENDUS), 'meta : ALG_KEYS different', '');
  const SUBS = Array.isArray(meta.SUBS) ? meta.SUBS : [];
  const FAMILLES = typeof meta.FAMILIES === 'string' ? meta.FAMILIES.split('\n') : [];
  const ING_KEYS = typeof meta.ING_KEYS === 'string' ? meta.ING_KEYS.split('\n') : [];
  ok(ING_KEYS.length === Object.keys(ings).length && ING_KEYS.every((k, i) => k === Object.keys(ings)[i]), 'meta : ING_KEYS different des cles de ingredients.json (ordre compris)', `${ING_KEYS.length} contre ${Object.keys(ings).length}`);
  const PAIRS = typeof meta.PAIRS === 'string' && meta.PAIRS ? meta.PAIRS.split('|').map((p) => { const [q, u] = p.split(':'); return { qty: Number(q), unit: u }; }) : [];
  PAIRS.forEach((p, i) => ok(p.qty > 0 && UNITS.includes(p.unit), 'meta : couple quantite:unite invalide', `#${i} ${JSON.stringify(p)}`));
  const LINE_W = meta.LINE_W;
  const PAIR_BITS = meta.PAIR_BITS;
  if (!(LINE_W === 3 || LINE_W === 4) || PAIR_BITS !== (LINE_W === 3 ? 8 : 14)) { err(`catalogue : LINE_W ${LINE_W} et PAIR_BITS ${PAIR_BITS} incoherents`); return; }
  ok(PAIRS.length <= Math.pow(2, PAIR_BITS), 'meta : trop de couples quantite:unite', `${PAIRS.length}`);
  ok(ING_KEYS.length <= 512, 'meta : plus de 512 ingredients (9 bits)', `${ING_KEYS.length}`);
  const CONT = meta.PHRASE_CONT;
  if (CONT !== 2048) { err(`catalogue : PHRASE_CONT ${CONT} (2048 attendu)`); return; }
  const PM = typeof meta.PHRASE_META === 'string' && meta.PHRASE_META ? meta.PHRASE_META.split('|').map((p) => p.split(',').map(Number)) : [];
  const P = PM.length;
  ok(P > 0 && P <= 2048, 'meta : nombre de phrases hors de 1 a 2048', `${P}`);
  PM.forEach(([genre, sec, temp], i) => {
    if (!(Number.isInteger(genre) && genre >= 0 && genre <= 3 && Number.isInteger(sec) && sec >= 0 && Number.isInteger(temp) && temp >= 0)) { agg('minuteur : phrase de PHRASE_META illisible', `phrase ${i}`); return; }
    if (genre === 0 && sec !== 0) agg('minuteur : duree sans genre', `phrase ${i} : ${sec} s`);
    if (genre > 0 && (sec < 60 || sec > 86400)) agg('minuteur : duree hors de 1 min a 24 h', `phrase ${i} : ${sec} s`);
    if (temp !== 0 && !(temp >= 100 && temp <= 280 && temp % 10 === 0)) agg('minuteur : temperature de four hors de 100 a 280 par 10', `phrase ${i} : ${temp}`);
  });

  // --- colonnes -----------------------------------------------------------------------------------
  const largeur = Object.fromEntries(FIELDS_ATTENDUS);
  const colonnes = {};
  for (const [nom, w] of FIELDS_ATTENDUS) {
    const h = hdr[nom];
    if (typeof h !== 'string' || h.length !== N * w) { err(`catalogue : colonne ${nom} de ${h && h.length} caractere(s) au lieu de ${N * w}`); return; }
    colonnes[nom] = h;
  }
  const lit = (nom, c) => lireB64(colonnes[nom], c * largeur[nom], largeur[nom]);

  const blocLignes = [];
  const blocEtapes = [];
  for (let b = 0; b < nBlocs; b++) {
    let l = null, s = null;
    try { l = loaders.lines(b); s = loaders.steps(b); } catch (_e) { /* signale ci-dessous */ }
    if (typeof l !== 'string' || typeof s !== 'string') { err(`catalogue : bloc ${b} de lignes ou d'etapes absent (loaders.js)`); return; }
    blocLignes.push(l);
    blocEtapes.push(s);
  }

  // --- titres francais, registre, ids ---------------------------------------------------------------
  const langues = Array.isArray(loaders.LANGS) ? loaders.LANGS : [];
  if (!langues.includes('fr')) { err('catalogue : loaders.LANGS doit contenir fr'); return; }
  const lireTitres = (lang) => {
    const out = [];
    for (let b = 0; b < nBlocs; b++) {
      let t = null;
      try { t = loaders.titles(lang, b); } catch (_e) { t = null; }
      const attendu = b < nBlocs - 1 ? SHARD : N - b * SHARD;
      if (typeof t !== 'string') { err(`catalogue : titres ${lang} bloc ${b} absents`); return null; }
      const lignes = t.split('\n');
      if (lignes.length !== attendu) { err(`catalogue : titres ${lang} bloc ${b} : ${lignes.length} ligne(s) au lieu de ${attendu}`); return null; }
      out.push(...lignes);
    }
    return out;
  };
  const lirePhrases = (lang) => {
    let t = null;
    try { t = loaders.phrases(lang); } catch (_e) { t = null; }
    if (typeof t !== 'string') { err(`catalogue : phrases ${lang} absentes`); return null; }
    const lignes = t.split('\n');
    if (lignes.length !== P) { err(`catalogue : phrases ${lang} : ${lignes.length} ligne(s) au lieu de ${P}`); return null; }
    return lignes;
  };
  const titresFr = lireTitres('fr');
  const phrasesFr = lirePhrases('fr');
  if (!titresFr || !phrasesFr) return;

  const idDe = (c) => `g-${c.toString(36)}`;
  const titresLegacy = new Set(Object.values(fr.recipes || {}).map((r) => norm((r && r.title) || '')));
  for (const id of ids) if (/^g-[0-9a-z]+$/.test(id) || /^my-/.test(id)) agg('id : un id ecrit a la main ressemble a un id genere ou perso', id);
  const titresVus = new Map();

  // --- une passe sur les cases -----------------------------------------------------------------------
  const decalLignes = new Array(nBlocs).fill(0);
  const decalEtapes = new Array(nBlocs).fill(0);
  const parCourse = {};
  let retirees = 0;
  let recettesN = 0;
  const alcoolCles = new Set(ING_KEYS.filter((k) => estAlcool((fr.ingredients || {})[k] || '')));
  const rows = new Array(N); // pour les controles de langue : retiree ou non
  for (let c = 0; c < N; c++) {
    const b = (c / SHARD) | 0;
    const id = idDe(c);
    ok(parseInt(id.slice(2), 36) === c && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id), 'id : id genere non reversible ou invalide', id);
    const v = {};
    let illisible = false;
    for (const [nom] of FIELDS_ATTENDUS) {
      v[nom] = lit(nom, c);
      if (v[nom] < 0) illisible = true;
    }
    if (illisible) { agg('colonne : caractere hors alphabet ou colonne tronquee', id); rows[c] = { retiree: true }; continue; }
    const retiree = (v.flags & 4) !== 0;
    rows[c] = { retiree };
    if (retiree) {
      retirees++;
      ok(v.nIng === 0 && v.nStep === 0 && v.nPhr === 0, 'retiree : une case retiree garde des lignes ou des etapes', id);
      continue;
    }
    recettesN++;
    const course = v.course;
    const ctx = `${id} (${titresFr[c]})`;
    if (!ok(course < COURSES.length, 'colonne : course hors plage', ctx)) continue;
    parCourse[COURSES[course]] = (parCourse[COURSES[course]] || 0) + 1;
    ok(v.sub < SUBS.length, 'colonne : sub hors plage', ctx);
    ok(v.family <= FAMILLES.length, 'colonne : family hors plage', ctx);
    ok(v.diff <= 2, 'colonne : difficulte hors de 0 a 2', ctx);
    ok(v.flags < 16, 'colonne : drapeaux inconnus', ctx);
    ok(v.tags < Math.pow(2, TAGS.length), 'colonne : masque de tags hors plage', ctx);
    ok(v.alg < Math.pow(2, ALG_ATTENDUS.length), 'colonne : masque d\'allergenes hors plage', ctx);
    const temps = v.time * 5;
    ok(temps >= 5 && temps <= 480, 'plage : temps hors de 5 a 480 min', `${ctx} : ${temps}`);
    const kcal = v.kcal * 10;
    // Minimum de 100 kcal pour un plat ; 20 pour les autres (dips, compotes, boissons, petits desserts, 100 g d'un legume ou d'un fruit).
    const kcalMin = course === 0 ? 100 : 20;
    ok(kcal >= kcalMin && kcal <= 1400, `plage : kcal par portion hors de ${kcalMin} a 1400`, `${ctx} : ${kcal}`);
    ok(v.prot <= 300, 'plage : proteines par portion superieures a 300 g', `${ctx} : ${v.prot}`);
    ok(v.cost >= 2 && v.cost <= 200, 'plage : cout par portion hors de 0,2 a 20 EUR', `${ctx} : ${v.cost / 10}`);
    ok(v.keep >= 1 && v.keep <= 14, 'colonne : keepDays hors de 1 a 14', ctx);
    ok(v.nIng >= 2 && v.nIng <= 63, 'colonne : nombre d\'ingredients hors de 2 a 63', ctx);
    ok(v.nStep >= 3 && v.nStep <= 6, 'etapes : il faut 3 a 6 etapes', `${ctx} : ${v.nStep}`);
    ok(v.nPhr >= v.nStep && v.nPhr <= 63, 'etapes : nombre de phrases incoherent', `${ctx} : ${v.nPhr} phrase(s) pour ${v.nStep} etape(s)`);

    // titre francais : unique, sans tiret
    const t = titresFr[c];
    ok(typeof t === 'string' && t.trim() && t === t.trim() && t !== '-', 'titre : titre francais vide ou invalide', id);
    const nt = norm(t);
    if (titresVus.has(nt)) agg('titre : titre francais en double', `${id} et ${titresVus.get(nt)}`);
    else titresVus.set(nt, id);
    ok(!titresLegacy.has(nt), 'titre : meme titre qu\'une recette ecrite a la main', ctx);

    // lignes d'ingredients
    const seen = new Set();
    const al = new Set();
    let meat = false;
    let alcool = false;
    let cout = 0;
    const cles = [];
    for (let j = 0; j < v.nIng; j++) {
      const x = lireB64(blocLignes[b], decalLignes[b], LINE_W);
      decalLignes[b] += LINE_W;
      if (x < 0) { agg('lignes : bloc tronque ou caractere invalide', ctx); break; }
      const ingI = x % 512;
      const pairI = Math.floor(x / 512) % Math.pow(2, PAIR_BITS);
      const opt = Math.floor(x / Math.pow(2, 9 + PAIR_BITS)) === 1;
      const key = ING_KEYS[ingI];
      const pair = PAIRS[pairI];
      if (!key || !pair) { agg('lignes : indice d\'ingredient ou de couple inconnu', ctx); continue; }
      const i = ings[key];
      if (!i) { agg('lignes : ingredient absent de ingredients.json', `${ctx} : ${key}`); continue; }
      cles.push(key);
      used.add(key);
      if (seen.has(key)) agg('lignes : ingredient en double dans une recette', `${ctx} : ${key}`);
      seen.add(key);
      if (pair.unit === 'cs' || pair.unit === 'cc') ok(i.pantry, 'unites : cs ou cc sur un ingredient qui n\'est pas pantry', `${ctx} : ${key}`);
      else ok(pair.unit === i.pack.unit, 'unites : unite differente du pack de l\'ingredient', `${ctx} : ${key} en ${pair.unit}, pack ${i.pack.unit}`);
      for (const a of i.allergens || []) al.add(a);
      if (i.aisle === 'viandes-poissons' || (i.allergens || []).includes('crustaces')) meat = true;
      if (alcoolCles.has(key)) alcool = true;
      if (!i.pantry && !opt) cout += i.pricePerUnit !== undefined ? i.pricePerUnit * pair.qty : (i.pricePerKgOrL * pair.qty) / 1000;
    }
    // allergenes : la colonne doit egaler l'union des allergenes declares des ingredients
    let algAttendu = 0;
    for (const a of al) { const k = ALG_ATTENDUS.indexOf(a); if (k < 0) agg('allergenes : allergene d\'ingredient hors de la liste des 10', `${ctx} : ${a}`); else algAttendu |= 1 << k; }
    ok(v.alg === algAttendu, 'allergenes : colonne alg differente de l\'union des ingredients', `${ctx} : ${v.alg} contre ${algAttendu}`);
    // portions d'origine (colonne serv : 4 par defaut, 6 a 20 pour quiches, cakes, aperitifs, desserts et gateaux)
    ok(v.serv >= 1 && v.serv <= 20, 'portions : colonne serv hors de 1 a 20', `${ctx} : ${v.serv}`);
    // cout recalcule (meme formule que le build) : cout total divise par les portions d'origine de la recette
    const coutAttendu = Math.min(4095, Math.round((cout / Math.max(1, v.serv)) * 10));
    ok(Math.abs(coutAttendu - v.cost) <= 1, 'cout : colonne cost differente du calcul sur les ingredients', `${ctx} : ${v.cost} contre ${coutAttendu}`);
    // principaux
    for (const [nom, val] of [['main1', v.main1], ['main2', v.main2]]) {
      if (val === 0) continue;
      const k = ING_KEYS[val - 1];
      ok(k && seen.has(k) && ings[k] && !ings[k].pantry, 'principaux : ingredient principal absent de la recette ou pantry', `${ctx} : ${nom}`);
    }
    ok(v.main1 === 0 ? v.main2 === 0 : v.main1 !== v.main2, 'principaux : main2 sans main1 ou identique a main1', ctx);

    // tags
    const tags = new Set(TAGS.filter((_, k) => Math.floor(v.tags / Math.pow(2, k)) % 2 === 1));
    const has = (x) => tags.has(x);
    ok(!(has('vegetarien') && meat), 'tags : vegetarien avec viande ou poisson', ctx);
    ok(!(has('vegan') && (meat || al.has('lait') || al.has('oeuf') || al.has('miel'))), 'tags : vegan incoherent avec les allergenes', ctx);
    ok(!(has('vegan') && !has('vegetarien')), 'tags : vegan sans vegetarien', ctx);
    ok(!(has('sans-gluten') && al.has('gluten')), 'tags : sans-gluten avec du gluten', ctx);
    ok(!(has('sans-lactose') && al.has('lait')), 'tags : sans-lactose avec du lait', ctx);
    ok(!((has('sans-porc') || has('halal-possible')) && al.has('porc')), 'tags : sans-porc ou halal-possible avec du porc', ctx);
    ok(!(has('sans-fruits-a-coque') && al.has('fruits-a-coque')), 'tags : sans-fruits-a-coque avec des fruits a coque', ctx);
    {
      const permis = regimesDe({ cles, ings, derives: DERIVES }).tags; // allergenes et doutes des ingredients
      for (const x of REGIMES) ok(!(has(x) && !permis.has(x)), `tags : ${x} trop permissif (doutes de regimes.js)`, ctx);
    }
    ok(!(alcool && (has('halal-possible') || has('vegan') || has('enfants'))), 'tags : halal-possible, vegan ou enfants avec de l\'alcool', ctx);
    ok(!(has('rapide') && temps > 30), 'tags : rapide au-dessus de 30 min', `${ctx} : ${temps} min`);
    ok(!(has('four') && has('sans-cuisson')), 'tags : four et sans-cuisson ensemble', ctx);
    ok(has('four') === ((v.flags & 8) !== 0), 'tags : tag four different du drapeau four', ctx);

    // conservation
    const poisson = al.has('poisson') || al.has('crustaces');
    ok(!(poisson && v.keep > 2), 'conservation : poisson ou crustaces gardes plus de 2 jours', `${ctx} : ${v.keep} j`);
    ok(!(poisson && (v.flags & 2)), 'conservation : poisson ou crustaces congelables', ctx);
    ok(!((v.flags & 2) && !(v.flags & 1)), 'conservation : congelable sans restes', ctx);

    // etapes et minuteurs
    const groupesEtapes = [];
    let courant = [];
    let cassee = false;
    for (let j = 0; j < v.nPhr; j++) {
      const x = lireB64(blocEtapes[b], decalEtapes[b], 2);
      decalEtapes[b] += 2;
      if (x < 0 || x >= 4096) { cassee = true; break; }
      const pid = x % CONT;
      if (pid >= P) { agg('etapes : identifiant de phrase hors dictionnaire', ctx); cassee = true; break; }
      courant.push(pid);
      if (x < CONT) { groupesEtapes.push(courant); courant = []; }
    }
    if (cassee) { agg('etapes : bloc tronque ou code invalide', ctx); continue; }
    if (courant.length) agg('etapes : derniere phrase marquee comme suite', ctx);
    ok(groupesEtapes.length === v.nStep, 'etapes : nombre d\'etapes decode different de la colonne nStep', `${ctx} : ${groupesEtapes.length} contre ${v.nStep}`);
    let feuFour = 0;
    let tempMax = 0;
    for (const g of groupesEtapes) {
      let best = 0;
      let genreBest = 0;
      for (const pid of g) {
        const [genre, sec, temp] = PM[pid];
        if (genre > 0 && sec > best) { best = sec; genreBest = genre; }
        if (temp > tempMax) tempMax = temp;
      }
      if (best && genreBest !== 3) feuFour += best;
    }
    ok(feuFour / 60 <= temps + 5, 'minuteur : minuteurs de cuisson plus longs que le temps de la recette', `${ctx} : ${Math.round(feuFour / 60)} min pour ${temps} min`);
    ok(!(tempMax > 0 && !(v.flags & 8)), 'minuteur : temperature de four sans drapeau four', ctx);
  }
  for (let b = 0; b < nBlocs; b++) {
    ok(decalLignes[b] === blocLignes[b].length, 'lignes : taille du bloc differente de la somme des nIng', `bloc ${b} : ${blocLignes[b].length} caractere(s) pour ${decalLignes[b]} attendu(s)`);
    ok(decalEtapes[b] === blocEtapes[b].length, 'etapes : taille du bloc differente de la somme des nPhr', `bloc ${b} : ${blocEtapes[b].length} caractere(s) pour ${decalEtapes[b]} attendu(s)`);
  }

  // --- registre (catalogue complet seulement) --------------------------------------------------------
  if (GEN_DIR === GEN_DEFAUT) {
    const regF = path.join(ROOT, 'scripts', 'menus-gen', 'registry.json');
    const regP = path.join(ROOT, 'scripts', 'menus-gen', 'registry-phrases.json');
    if (fs.existsSync(regF)) {
      const reg = load(regF) || {};
      const parCase = new Map(Object.entries(reg).map(([k, c]) => [c, k]));
      ok(Object.keys(reg).length === N && parCase.size === N, 'registre : nombre de cases different de N ou cases en double', `${Object.keys(reg).length} cles, N ${N}`);
      for (let c = 0; c < N; c++) {
        if (rows[c] && rows[c].retiree) continue;
        ok(parCase.get(c) === norm(titresFr[c]), 'registre : le titre de la case ne correspond pas au registre', `${idDe(c)} : ${titresFr[c]}`);
      }
    }
    if (fs.existsSync(regP)) {
      const rp = load(regP);
      ok(Array.isArray(rp) && rp.length === P && rp.every((t, i) => t === phrasesFr[i]), 'registre : registry-phrases.json different des phrases francaises', '');
    }
  }

  // --- langues -------------------------------------------------------------------------------------
  const nomsI18n = new Set(files.map((f) => f.replace('.json', '')));
  for (const lang of langues) {
    if (!LANGUES_13.includes(lang)) { err(`catalogue : langue inconnue dans loaders.js : ${lang}`); continue; }
    if (!nomsI18n.has(lang)) err(`catalogue : pack ${lang} sans data/menus/i18n/${lang}.json (noms d'ingredients)`);
    const titres = lang === 'fr' ? titresFr : lireTitres(lang);
    const phrases = lang === 'fr' ? phrasesFr : lirePhrases(lang);
    if (!titres || !phrases) continue;
    const t = (regle, ex) => agg(`traduction ${lang} : ${regle}`, ex);
    const verifier = (nature, texte, frTexte, idx, strict) => {
      if (typeof texte !== 'string' || !texte.trim()) return t(`${nature} vide`, `${idx}`);
      if (texte !== texte.trim()) t(`${nature} avec espaces de bord`, `${idx}`);
      if (dash(texte)) t(`${nature} avec tiret cadratin, demi-cadratin ou fleche`, `${idx}`);
      if (/\{\d+\}/.test(texte)) t(`${nature} avec gabarit {n} residuel`, `${idx}`);
      if (LATINES.has(lang) && texte.includes('’')) t(`${nature} avec apostrophe typographique`, `${idx}`);
      if (lang !== 'fr') {
        if (ECRITURE[lang] && !ECRITURE[lang].test(texte)) {
          if (strict) t(`${nature} sans caractere de l'ecriture attendue`, `${idx}`);
          else avert(`traduction ${lang} : ${nature} sans caractere de l'ecriture attendue`, `${idx} « ${texte.slice(0, 30)} »`);
        }
        if (!memesChiffres(frTexte, texte)) {
          if (strict) t(`${nature} avec des chiffres differents du francais`, `${idx}`);
          else avert(`traduction ${lang} : ${nature} avec des chiffres differents du francais`, `${idx} « ${texte.slice(0, 30)} »`);
        }
      }
    };
    for (let c = 0; c < N; c++) {
      if (rows[c] && rows[c].retiree) continue;
      verifier('titre', titres[c], titresFr[c], idDe(c), false);
    }
    for (let p = 0; p < P; p++) verifier('phrase', phrases[p], phrasesFr[p], `phrase ${p}`, true);
  }
  for (const l of nomsI18n) if (!langues.includes(l)) avert('langue : pack de recettes generees absent', l);

  infoCatalogue = { N, recettes: recettesN, retirees, parCourse, langues };
}

try {
  validerCatalogue();
} catch (e) {
  err(`catalogue genere : controle interrompu : ${e.stack || e.message}`);
}

for (const [regle, g] of groupes) {
  errTotal += g.n;
  errors.push(`[catalogue] ${regle} : ${g.n} cas (${g.ex.join(' ; ')})`);
}
// Un ingredient que ni les recettes ecrites a la main ni le catalogue complet n'utilisent (pas pour la fixture, qui n'en couvre qu'une partie).
if (GEN_DIR === GEN_DEFAUT || !infoCatalogue) for (const k of Object.keys(ings)) if (!used.has(k)) console.warn(`avertissement : ingredient non utilise ${k}`);
for (const [regle, g] of avertissements) console.warn(`avertissement : ${regle} : ${g.n} cas (${g.ex.join(' ; ')})`);

if (errTotal) {
  console.error(errors.join('\n'));
  if (masquees) console.error(`... ${masquees} autre(s) erreur(s) non affichee(s)`);
  console.error(`\n${errTotal} erreur(s)`);
  process.exit(1);
}
console.log(`OK : ${recipes.length} recettes (${Object.entries(counts).map(([k, v]) => k + ' ' + v).join(', ')}), ${Object.keys(ings).length} ingredients, ${files.length} langue(s) : ${files.join(', ')}`);
if (infoCatalogue) {
  console.log(`Catalogue genere : ${infoCatalogue.recettes} recettes sur ${infoCatalogue.N} cases (${Object.entries(infoCatalogue.parCourse).map(([k, v]) => k + ' ' + v).join(', ')}), ${infoCatalogue.retirees} retiree(s), ${infoCatalogue.langues.length} pack(s) : ${infoCatalogue.langues.join(', ')}`);
}
console.log(`Cout estime moyen par portion : ${(costSum / costN).toFixed(2)} EUR`);
