#!/usr/bin/env node
// Construit les donnees du catalogue de recettes generees (lot 0 et partie donnees du lot A de CONCEPTION.md).
// Deterministe : aucun aleatoire, aucune date. Echoue (code 1, message clair) sur toute anomalie.
//
// Usage : node scripts/menus-gen/build-menus.js [--check] [--a-traduire <dossier>] [--fixture-dir <dossier>]
//         [--traductions <dossier>] [--langues <liste>] [--toutes-les-langues] [--corriger-apostrophes] [--racine <dossier>]
//   (sans option)   ecrit data/menus/gen, data/menus/gen-fixture, registres, ingredients.json, fr.json, fichiers a traduire
//   --check         refait le calcul et compare avec les fichiers du depot, n'ecrit rien
//   --a-traduire    dossier des fichiers a traduire (titres.json, phrases.json, ingredients.json, fixture-50.json)
//   --traductions   dossier des traductions : <langue>/ingredients.json, <langue>/phrases-*.json et <langue>/titres-*.json
//                   (listes [{i, t}] ; ingredients : [{cle, t}] ou {cle: nom}). Produit data/menus/gen/lang/<langue>-*.js, regenere
//                   loaders.js avec toutes les langues disponibles et ajoute les noms des nouveaux ingredients dans
//                   data/menus/i18n/<langue>.json (cle « ingredients » seulement, format du fichier conserve).
//                   Une langue presente dans le dossier doit etre COMPLETE, sinon le build echoue. Une langue deja integree
//                   (gen/lang/<langue>-*.js) et absente du dossier est conservee telle quelle si elle est complete.
//   --langues       restreint --traductions a ces langues (ex. en,de)
//   --toutes-les-langues   exige les 13 langues
//   --corriger-apostrophes remplace l'apostrophe typographique par l'apostrophe droite dans les langues latines
//   --racine        racine de travail a la place du depot (data/menus et scripts/menus-gen y sont lus et ecrits) : sert aux essais
//
// Regles de calcul : REGLES-TAGS.md. Format des fichiers : CONCEPTION.md sections 2.1 a 2.7
// (ecarts documentes en tete de chaque bloc de code concerne).
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const GEN_SCRIPTS = __dirname;
const SOURCES = path.join(GEN_SCRIPTS, 'sources');

/* --------------------------------- arguments -------------------------------- */

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const argVal = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const ROOT = path.resolve(argVal('--racine', path.resolve(GEN_SCRIPTS, '..', '..')));
const DATA = path.join(ROOT, 'data', 'menus');
const GEN = path.join(ROOT, 'scripts', 'menus-gen'); // registres
const OUT_GEN = path.join(DATA, 'gen');
const TRADUCTIONS = argVal('--traductions', null) ? path.resolve(argVal('--traductions', null)) : null;
const LANGUES_DEMANDEES = argVal('--langues', null);
const TOUTES_LANGUES = argv.includes('--toutes-les-langues');
const CORRIGER_APOSTROPHES = argv.includes('--corriger-apostrophes');
const OUT_FIXTURE = path.resolve(argVal('--fixture-dir', path.join(DATA, 'gen-fixture')));
const OUT_TRAD = path.resolve(argVal('--a-traduire', path.join(os.tmpdir(), 'pearl-menus-a-traduire')));

/* --------------------------------- anomalies -------------------------------- */

const problemes = [];
const compteurProblemes = {};
function echec(categorie, message) {
  compteurProblemes[categorie] = (compteurProblemes[categorie] || 0) + 1;
  if (problemes.length < 60) problemes.push(`[${categorie}] ${message}`);
}
function finirSiProblemes() {
  const total = Object.values(compteurProblemes).reduce((a, b) => a + b, 0);
  if (!total) return;
  console.error(problemes.join('\n'));
  console.error(`\nECHEC : ${total} anomalie(s) : ${Object.entries(compteurProblemes).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  process.exit(1);
}

/* ----------------------------------- constantes ----------------------------------- */

const COURSES = ['plat', 'entree', 'dessert', 'petit-dejeuner']; // codes 0 a 3 de la colonne course
const SUBS = [
  'soupes', 'gratins', 'tartes_salees', 'aperitif', 'oeufs', 'accompagnements', 'pates_riz', 'viandes', 'poissons',
  'vegetarien', 'salades', 'bowls', 'sandwichs', 'pizzas', 'sauces', 'desserts', 'boissons', 'gateaux', 'petit_dejeuner',
];
const COURSE_DE_SUB = {
  soupes: 'entree', aperitif: 'entree', accompagnements: 'entree', desserts: 'dessert', gateaux: 'dessert', petit_dejeuner: 'petit-dejeuner',
  boissons: 'petit-dejeuner',
};
const TAGS = [
  'vegetarien', 'vegan', 'sans-gluten', 'sans-lactose', 'sans-porc', 'halal-possible', 'sans-fruits-a-coque', 'enfants', 'rapide',
  'batch', 'economique', 'leger', 'hiver', 'printemps', 'ete', 'automne', 'four', 'sans-cuisson',
];
const ALG_KEYS = ['gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'soja', 'sesame', 'fruits-a-coque', 'miel', 'porc'];
const UNITS = ['g', 'ml', 'u', 'cs', 'cc'];
const AISLES = ['fruits-legumes', 'viandes-poissons', 'cremerie', 'epicerie', 'surgeles', 'boulangerie', 'boissons'];
const SHARD = 2048;
const PHRASE_CONT = 2048; // bit de continuation : la phrase suivante appartient a la meme etape
const MAX_PHRASES = 2048; // 11 bits d'identifiant de phrase
const GENRE_NOM = ['', 'four', 'feu', 'repos'];
const FIELDS = [
  ['course', 1], ['sub', 1], ['family', 1], ['tags', 3], ['time', 2], ['diff', 1], ['kcal', 2], ['prot', 2], ['keep', 1],
  ['flags', 1], ['cost', 2], ['alg', 3], ['nIng', 1], ['nStep', 1], ['nPhr', 1], ['main1', 2], ['main2', 2],
];
const TIRET = /[—–→←⇒⇔↔]/;

/* --------------------------------- utilitaires --------------------------------- */

const ALPHA64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function enc(v, n, ctx) {
  if (!Number.isInteger(v) || v < 0 || v >= Math.pow(64, n)) {
    echec('colonne', `${ctx || '?'} : valeur ${v} hors plage pour ${n} caractere(s)`);
    return '0'.repeat(n).replace(/0/g, 'A');
  }
  let out = '';
  let x = v;
  for (let i = 0; i < n; i++) { out = ALPHA64[x % 64] + out; x = Math.floor(x / 64); }
  return out;
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
const slug = (s) => norm(s).replace(/ /g, '-');
const lire = (f) => fs.readFileSync(f, 'utf8');
const lireJson = (f) => JSON.parse(lire(f));
const uniq = (a) => [...new Set(a)];
const arrondi = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

/* ------------------------------ chargement du generateur ------------------------------ */

const { TOUTES } = require('./fabrique');
for (const f of ['f-legumes', 'f-plats', 'f-salades', 'f-sucre']) require(`./${f}`);

const CORRESP = lireJson(path.join(SOURCES, 'correspondance-ingredients.json'));
const PHRASES_INF = lireJson(path.join(SOURCES, 'phrases-infinitif.json'));
const INGS_ACTUELS_BRUT = lire(path.join(DATA, 'ingredients.json'));
const FR_ACTUEL_BRUT = lire(path.join(DATA, 'i18n', 'fr.json'));
const CRLF = INGS_ACTUELS_BRUT.includes('\r\n');
const INGS_ACTUELS = JSON.parse(INGS_ACTUELS_BRUT);
const FR_ACTUEL = JSON.parse(FR_ACTUEL_BRUT);
const RECETTES_HERITEES = lireJson(path.join(DATA, 'recipes.json'));

const REGISTRE_FICHIER = path.join(GEN, 'registry.json');
const REGISTRE_PHRASES_FICHIER = path.join(GEN, 'registry-phrases.json');
const registre = fs.existsSync(REGISTRE_FICHIER) ? lireJson(REGISTRE_FICHIER) : {};
const registrePhrases = fs.existsSync(REGISTRE_PHRASES_FICHIER) ? lireJson(REGISTRE_PHRASES_FICHIER) : [];

/* ---------------- fiches d'ingredients : correspondance, corrections, lexique ---------------- */

const parNom = new Map(CORRESP.map((e) => [e.nom, e]));
if (parNom.size !== CORRESP.length) echec('correspondance', 'noms en double dans correspondance-ingredients.json');

// Corrections des NOUVELLES fiches apres controle lexical (allergenes absents de la source). Les 199 fiches
// existantes ne sont jamais modifiees. Les mollusques sont declares sous « crustaces », comme dans
// lib/menus/allergens.js (huitre, palourde, calamar, saint-jacques).
const CORRECTIONS_ALLERGENES = {
  'sauce-huitre': ['crustaces'],
  'saint-jacques': ['crustaces'],
  palourde: ['crustaces'],
  calamar: ['crustaces'],
};

// Etiquettes de paquet comptees a la piece reconnues par lib/menus/lineText.js (packKind) ; les autres sont
// ramenees a « piece » (1 unite) ou « lot de N » pour que l'affichage des courses ne retombe pas sur « N x taille ».
function etiquettePaquet(pack) {
  const l = String(pack.label || '').trim();
  if (pack.unit !== 'u') return pack.label;
  if (['pièce', 'tête', 'rouleau', 'paquet (tranches)', 'boîte de cubes'].includes(l) || /^(boîte|lot) de d+$/.test(l)) return l;
  return pack.qty === 1 ? 'pièce' : `lot de ${pack.qty}`;
}

// Nouvelles fiches (cle -> fiche), dans l'ordre de la correspondance.
const NOUVELLES_FICHES = new Map();
const NOMS_FR_NOUVEAUX = new Map();
for (const e of CORRESP) {
  if (!e.nouvelle) continue;
  if (!e.fiche) { echec('fiche', `${e.nom} : nouvelle sans fiche`); continue; }
  const f = { emoji: e.fiche.emoji, aisle: e.fiche.aisle };
  if (e.fiche.pricePerUnit !== undefined) f.pricePerUnit = e.fiche.pricePerUnit;
  if (e.fiche.pricePerKgOrL !== undefined) f.pricePerKgOrL = e.fiche.pricePerKgOrL;
  f.pack = { qty: e.fiche.pack.qty, unit: e.fiche.pack.unit, label: etiquettePaquet(e.fiche.pack) };
  f.pantry = e.fiche.pantry;
  const al = uniq([...(e.fiche.allergens || []), ...(CORRECTIONS_ALLERGENES[e.cle] || [])]);
  if (al.length) f.allergens = al;
  const deja = NOUVELLES_FICHES.get(e.cle);
  if (deja && JSON.stringify(deja) !== JSON.stringify(f)) echec('fiche', `${e.cle} : deux fiches differentes`);
  if (!deja) NOUVELLES_FICHES.set(e.cle, f);
  if (e.nom_fr) NOMS_FR_NOUVEAUX.set(e.cle, e.nom_fr);
  else echec('fiche', `${e.cle} : nom_fr manquant`);
}
for (const [cle, f] of NOUVELLES_FICHES) {
  if (INGS_ACTUELS[cle]) {
    if (JSON.stringify(INGS_ACTUELS[cle]) !== JSON.stringify(f)) echec('fiche', `${cle} : existe deja avec un contenu different`);
  }
}
// Table finale des ingredients : existants puis nouveaux, ordre fige (sert d'ING_KEYS).
const INGS = { ...INGS_ACTUELS };
for (const [cle, f] of NOUVELLES_FICHES) if (!INGS[cle]) INGS[cle] = f;
const ING_KEYS = Object.keys(INGS);
const ING_INDEX = new Map(ING_KEYS.map((k, i) => [k, i]));

// Controle des fiches (memes regles que validate-menus.js).
for (const [k, i] of Object.entries(INGS)) {
  if (!/^[a-z0-9-]+$/.test(k)) echec('fiche', `${k} : cle invalide`);
  if (!AISLES.includes(i.aisle)) echec('fiche', `${k} : rayon inconnu ${i.aisle}`);
  if (!i.pack || !(i.pack.qty > 0) || !UNITS.includes(i.pack.unit)) echec('fiche', `${k} : pack invalide`);
  if (typeof i.pantry !== 'boolean') echec('fiche', `${k} : pantry`);
  const parU = i.pack && i.pack.unit === 'u';
  if (parU && !(i.pricePerUnit > 0)) echec('fiche', `${k} : pricePerUnit manquant`);
  if (!parU && !(i.pricePerKgOrL > 0)) echec('fiche', `${k} : pricePerKgOrL manquant`);
  if (!i.emoji) echec('fiche', `${k} : emoji vide`);
  if (TIRET.test(JSON.stringify(i))) echec('fiche', `${k} : tiret long ou fleche`);
  for (const a of i.allergens || []) if (!ALG_KEYS.includes(a)) echec('fiche', `${k} : allergene inconnu ${a}`);
}

// Lexique francais des allergenes (extrait de lib/menus/allergens.js, partie francaise, plus quelques mots).
const LEX = {
  gluten: 'ble farine farines pain pate pates semoule couscous boulgour orge seigle epeautre chapelure biscuit brioche crepe nouille nouilles raviolis lasagne lasagnes spaghetti tagliatelle tagliatelles macaroni gnocchi avoine seitan malt',
  lait: 'lait beurre creme fromage yaourt yogourt lactose mozzarella parmesan gruyere emmental comte chevre feta mascarpone ricotta lactoserum ghee bechamel cheddar burrata chantilly reblochon roquefort gorgonzola pecorino halloumi brie raclette',
  oeuf: 'oeuf oeufs mayonnaise meringue',
  poisson: 'poisson saumon thon cabillaud morue truite sardine sardines maquereau anchois colin merlu dorade hareng lotte surimi haddock sole nuoc',
  crustaces: 'crevette crevettes crabe homard langouste langoustine gambas ecrevisse crustace crustaces moule moules huitre huitres palourde palourdes bulot calamar calamars encornet seiche poulpe',
  soja: 'soja tofu tempeh miso edamame tamari',
  sesame: 'sesame tahini tahin gomasio',
  'fruits-a-coque': 'noix noisette noisettes amande amandes pistache pistaches cajou pecan macadamia pignon pignons praline arachide cacahuete cacahuetes nougat frangipane',
  miel: 'miel',
  porc: 'porc lardon lardons lard jambon bacon saucisse saucisses saucisson chorizo pancetta coppa rillettes andouille boudin chipolata chipolatas prosciutto gelatine guanciale',
  viande: 'viande boeuf veau agneau poulet dinde canard mouton lapin steak volaille merguez bavette magret gigot cuisse cuisses escalope escalopes cotelette cotelettes rumsteck paleron',
  alcool: 'vin biere rhum cognac whisky vodka alcool cidre calvados porto marsala kirsch liqueur',
};
const LEX_MOTS = Object.fromEntries(Object.entries(LEX).map(([k, v]) => [k, new Set(v.split(' '))]));
const LEX_EXPR = { crustaces: ['fruits de mer', 'saint jacques'] };
// Expressions qui contiennent un mot du lexique sans l'allergene (retirees avant lecture d'un texte d'etape).
const FAUX_AMIS = [
  'lait de coco', 'lait d amande', 'lait d avoine', 'noix de coco', 'noix de muscade', 'beurre de cacahuete', 'pate de curry',
  'pate a tartiner', 'noix de saint jacques', 'creme de coco', 'eau de coco', 'noix de beurre', 'nouilles de riz',
];
function lexique(texte) {
  let t = ` ${norm(texte)} `;
  for (const f of FAUX_AMIS) t = t.split(` ${f} `).join(' ');
  const mots = t.split(' ').filter(Boolean);
  const trouve = new Set();
  for (const [k, set] of Object.entries(LEX_MOTS)) {
    for (const m of mots) {
      if (set.has(m) || set.has(m.replace(/(es|s|x)$/, '')) || set.has(m.replace(/[sx]$/, ''))) { trouve.add(k); break; }
    }
    for (const e of LEX_EXPR[k] || []) if (t.includes(` ${e} `)) trouve.add(k);
  }
  return trouve;
}
// Derogations du controle lexical des NOMS d'ingredients : le nom contient un mot du lexique sans l'allergene.
const DEROGATIONS_LEXICALES = {
  'beurre de cacahuète': ['lait'], // cacahuetes seules, aucun lait
  'lait de coco': ['lait'], // coco, aucun lait
  "lait d'amande": ['lait'], // boisson vegetale, la fiche declare les fruits a coque
  "lait d'avoine": ['lait'], // boisson vegetale, la fiche declare le gluten
  'nouilles de riz': ['gluten'], // riz seul
  'pousses de soja': ['soja'], // germes de haricot mungo, pas du soja transforme
  'noix de coco râpée': ['fruits-a-coque'], // la coco n'est pas un fruit a coque (convention des 474 recettes : 19 sur 21 recettes a la coco sont sans-fruits-a-coque)
  'noix de Saint-Jacques': ['fruits-a-coque'], // mollusque
  'pâte à tartiner': ['gluten'], // « pate » = pate a tartiner, pas de ble
  'pâte de curry jaune': ['gluten'], // « pate » = pate d'epices
  'pâte de curry massaman': ['gluten'],
  'pâte de curry korma': ['gluten'],
  'pâte de curry rouge': ['gluten'],
  'pâte de curry vert': ['gluten'],
  'pâte tikka masala': ['gluten'],
  'pâte à pizza': [], // gluten declare
  'extrait de vanille': ['alcool'], // traite en doute halal ci-dessous
  'gousse de vanille': [],
  'eau de coco': [],
  'sucre vanillé': [],
  'tomates séchées': [],
};
// Doutes sur les regimes, ajoutes aux allergenes declares pour les TAGS seulement (jamais pour la colonne alg).
const DOUTE_PAR_NOM = {
  gnocchis: ['oeuf'], // gnocchis du commerce souvent aux oeufs
  'nouilles chinoises': ['oeuf'], // nouilles aux oeufs frequentes
  merguez: ['porc', 'gluten', 'lait'], // composition variable
  "sauce d'huître": ['crustaces'],
  'extrait de vanille': ['alcool'], // extrait de vanille alcoolise : pas de halal-possible
  'levure chimique': ['gluten'], // amidon de ble possible
  'sauce barbecue': ['gluten'],
  moutarde: ['gluten'],
  "moutarde à l'ancienne": ['gluten'],
  ketchup: ['gluten'],
};
const CHARCUTERIES = ['jambon', 'jambon cru', 'lardons', 'bacon', 'chorizo', 'guanciale', 'merguez', 'saucisses', 'saucisses de Toulouse', 'chipolatas'];
for (const c of CHARCUTERIES) DOUTE_PAR_NOM[c] = uniq([...(DOUTE_PAR_NOM[c] || []), 'gluten', 'lait']); // additifs possibles
const DOUTE_VIANDE_NOM = new Set(["sauce d'huître", 'gélatine']); // d'origine animale sans rayon viande
for (const e of CORRESP) {
  if (/^pâte de curry|^pâte tikka/.test(e.nom)) DOUTE_PAR_NOM[e.nom] = uniq([...(DOUTE_PAR_NOM[e.nom] || []), 'gluten']);
  if (/^pâte tikka/.test(e.nom)) DOUTE_PAR_NOM[e.nom] = uniq([...(DOUTE_PAR_NOM[e.nom] || []), 'fruits-a-coque']); // cajou ou amande frequents dans les pates tikka
}
const ALCOOL_NOMS = new Set(['bière', 'cidre', 'vin blanc', 'vin rouge', 'rhum', 'extrait de vanille']);
const VEGAN_INTERDIT_NOMS = new Set(['bière', 'cidre', 'vin blanc', 'vin rouge']);

// Attributs par nom d'ingredient de la correspondance.
const ATTR = new Map();
for (const e of CORRESP) {
  const fiche = INGS[e.cle];
  if (!fiche) { echec('correspondance', `${e.nom} : cle ${e.cle} sans fiche`); continue; }
  const declares = new Set(fiche.allergens || []);
  const lex = lexique(`${e.nom} ${e.nom_fr || ''}`);
  const derog = new Set(DEROGATIONS_LEXICALES[e.nom] || []);
  for (const a of lex) {
    if (a === 'viande' || a === 'alcool') continue;
    if (!declares.has(a) && !derog.has(a)) echec('lexique', `${e.nom} (${e.cle}) : le nom evoque « ${a} » mais la fiche ne le declare pas`);
  }
  const doute = new Set(DOUTE_PAR_NOM[e.nom] || []);
  const eff = new Set([...declares, ...doute]);
  const alcool = ALCOOL_NOMS.has(e.nom) || lex.has('alcool') || doute.has('alcool');
  const viande =
    fiche.aisle === 'viandes-poissons' || declares.has('poisson') || declares.has('crustaces') || declares.has('porc') ||
    lex.has('viande') || lex.has('poisson') || lex.has('crustaces') || lex.has('porc') || DOUTE_VIANDE_NOM.has(e.nom) ||
    eff.has('crustaces') || eff.has('porc');
  ATTR.set(e.nom, { cle: e.cle, fiche, declares, eff, alcool, viande, nom: e.nom });
}

/* -------------------------------- analyse des phrases -------------------------------- */

// Famille de plat (reprise de lib/menus/variety.js, appliquee au titre transforme en identifiant).
const FAMILLES_REGLES = [
  ['curry', /(^|-)(curry|dahl|tikka|tajine|yassa)(-|$)/],
  ['chili', /(^|-)chili(-|$)/],
  ['risotto', /(^|-)risotto(-|$)/],
  ['gratin', /(^|-)(gratin|tartiflette|hachis|moussaka|lasagnes?)(-|$)/],
  ['soupe', /(^|-)(soupe|veloute|gaspacho)(-|$)/],
  ['salade', /(^|-)salade(-|$)/],
  ['pizza', /(^|-)(pizza|pizzas)(-|$)/],
  ['tarte', /(^|-)(quiche|tarte|feuilletes?)(-|$)/],
  ['sandwich', /(^|-)(wraps?|tacos|quesadillas|fajitas|gyros|burgers?|croque|bruschettas?|galettes?)(-|$)/],
  ['pates', /(^|-)(pates|spaghettis|tagliatelles|macaronis|gnocchi|nouilles|boulettes)(-|$)/],
  ['omelette', /(^|-)(omelette|tortilla|shakshuka|oeufs)(-|$)/],
  ['riz', /(^|-)(riz|paella)(-|$)/],
  ['four', /(^|-)(roti|papillote|nuggets|brochettes|fish)(-|$)/],
];
const FAMILLES = FAMILLES_REGLES.map((r) => r[0]);
function familleDe(titre) {
  const s = slug(titre);
  for (const [nom, re] of FAMILLES_REGLES) if (re.test(s)) return FAMILLES.indexOf(nom) + 1;
  return 0;
}

const RE_DUREE = /(\d+)(?:\s*(?:à|-)\s*(\d+))?\s*(min|h)\b/gi;
const MOTS_REPOS = /(repos|mariner|infuser|r[ée]frig[ée]rateur|au frais|cong[ée]lateur|refroidir|ti[ée]dir|durcir|gonfler|\blever\b|tremper)/gi;
const MOTS_FOUR = /(enfourn|r[ôo]tir|au four|dans le four|sous le gril|à blanc)/gi;
const MOTS_FEU =
  /(cuire|cuisson|mijoter|revenir|dorer|sauter|saisir|griller|braiser|fondre|bouillir|pocher|r[ée]duire|compoter|caram[ée]liser|[ée]paissir|r[ée]chauffer|chauffer|po[êe]le|casserole|vapeur|\bfeu\b|fr[ée]missement|poursuivre|pr[ée]cuire|tomber|prendre|torr[ée]fier|ouvrir|mousser|absorb[ée])/gi;
const OVEN_CTX = /(enfourn|\bau four\b|dans le four|pr[ée]chauffer le four|°C|sous le gril)/i;
const STOVE = /(po[êe]le|casserole|\bfeu\b|vapeur|à l'eau|eau bouillante|cocotte|plancha|barbecue|friteuse)/i;

function motsAvec(re, s) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(s))) out.push({ i: m.index, fin: m.index + m[0].length });
  return out;
}

// Retourne { genre, sec, temp, cuisson, four } d'une phrase francaise a l'infinitif.
function analysePhrase(texte) {
  const t = texte.replace(/allant au four/gi, 'allant au X');
  const phraseFour = OVEN_CTX.test(t);
  const phrases = t.split(/(?<=[.!?])\s+/);
  const parGenre = { 1: 0, 2: 0, 3: 0 };
  for (const s of phrases) {
    RE_DUREE.lastIndex = 0;
    let m;
    while ((m = RE_DUREE.exec(s))) {
      const hau = m[2] ? +m[2] : +m[1];
      const base = /^h/i.test(m[3]) ? 3600 : 60;
      let sec = hau * base;
      const debut = m.index;
      const fin = m.index + m[0].length;
      const apres = s.slice(fin, fin + 30);
      if (/^\s*avant la fin/i.test(apres)) continue;
      if (/\bgarde\b|conserver|conservation/i.test(s)) continue;
      if (/^\s*par (face|c[ôo]t[ée]|gaufre)/i.test(apres)) sec *= /par gaufre/i.test(apres) ? 1 : 2;
      // mot-cle le plus proche : avant la duree (70 caracteres) sinon apres (45 caracteres)
      const cand = [];
      for (const [genre, re] of [[3, MOTS_REPOS], [1, MOTS_FOUR], [2, MOTS_FEU]]) {
        for (const w of motsAvec(re, s)) {
          if (w.fin <= debut + 1 && debut - w.fin <= 110) cand.push({ genre, d: debut - w.fin, avant: true });
          else if (w.i >= fin - 1 && w.i - fin <= 45) cand.push({ genre, d: w.i - fin + 1000, avant: false });
        }
      }
      if (!cand.length) continue;
      cand.sort((a, b) => a.d - b.d || a.genre - b.genre);
      let genre = cand[0].genre;
      // « au four » juste apres la duree l'emporte sur le verbe de cuisson qui precede
      const suite = s.slice(fin, fin + 14);
      if (/^\s*(au four|à \d+ ?°C)/.test(suite)) genre = 1;
      if (genre === 2 && phraseFour && !STOVE.test(s)) genre = 1;
      parGenre[genre] += sec;
    }
  }
  // cuisson sans duree ecrite (convention de REGLES-TAGS) : riz 15 min, nouilles 8 min, pates 10 min
  if (!parGenre[1] && !parGenre[2] && !parGenre[3] && /selon (le temps indiqu[ée] sur )?le paquet/i.test(t)) parGenre[2] = /nouilles/i.test(t) ? 480 : /riz/i.test(t) ? 900 : 600;
  let genre = 0;
  let sec = 0;
  for (const g of [1, 2, 3]) if (parGenre[g] > sec) { sec = parGenre[g]; genre = g; }
  let temp = 0;
  if (phraseFour) {
    const mt = [...t.matchAll(/(\d{2,3})\s*°C/g)].map((x) => +x[1]);
    if (mt.length) temp = Math.max(...mt);
  } else if (/°C/.test(t)) {
    temp = -1; // temperature hors four : anomalie signalee plus bas
  }
  const mentionFour = /(pr[ée]chauffer le four|enfourn|\bau four\b|dans le four)/i.test(t);
  const cuisson = /(cuire|cuisson|chauff|po[êe]le|saisir|revenir|dorer|bouill|mijot|\bfour\b|enfourn|griller|r[ôo]tir|frire|friture|vapeur|casserole|fondre|blanch|caram[ée]l|torr[ée]f|sauter|braiser|pocher|r[ée]duire|r[ée]chauff|gratiner|tomber|compot|plancha|barbecue|\bgril\b|micro-ondes|br[ûu]l|pr[ée]cuire|frémiss|fr[ée]miss)/i.test(t);
  return { genre, sec, temp, cuisson, four: mentionFour || genre === 1 || temp > 0 };
}

/* -------------------------------- conversion des recettes -------------------------------- */

function arrondiQuantite(unit, v) {
  if (unit === 'g' || unit === 'ml') return Math.max(1, Math.round(v));
  return Math.max(0.5, Math.round(v * 2) / 2); // u, cs, cc : au demi
}

function convertirIngredients(rec, scale) {
  const lignes = new Map(); // cle -> { cle, unit, qty, optional, noms:Set, nutri:{g,kcal,prot} }
  const noms = [];
  let kcal = 0;
  let prot = 0;
  for (const [nom, q, u] of rec.ings) {
    const e = parNom.get(nom);
    const attr = ATTR.get(nom);
    if (!e || !attr) { echec('ingredient', `${rec.nom} : ingredient inconnu « ${nom} »`); continue; }
    const conv = e.conversions && e.conversions[u];
    if (!conv) { echec('conversion', `${rec.nom} : conversion manquante « ${nom} » en ${u}`); continue; }
    const qBrut = u === 'qs' ? 1 : q;
    if (!(qBrut > 0)) { echec('quantite', `${rec.nom} : quantite nulle pour « ${nom} »`); continue; }
    const qty = qBrut * conv.facteur * scale;
    const unit = conv.vers;
    if (!UNITS.includes(unit)) { echec('unite', `${rec.nom} : unite interdite ${unit} pour « ${nom} »`); continue; }
    if (!(qty > 0)) { echec('quantite', `${rec.nom} : quantite nulle pour « ${nom} »`); continue; }
    const fiche = attr.fiche;
    if (unit === 'cs' || unit === 'cc') {
      if (!fiche.pantry) { echec('unite', `${rec.nom} : ${attr.cle} en ${unit} doit etre pantry`); continue; }
    } else if (unit !== fiche.pack.unit) {
      echec('unite', `${rec.nom} : ${attr.cle} en ${unit}, pack en ${fiche.pack.unit}`);
      continue;
    }
    const optional = u === 'qs';
    const cur = lignes.get(attr.cle);
    if (cur) {
      if (cur.unit !== unit && ['cs', 'cc'].includes(cur.unit) && ['cs', 'cc'].includes(unit)) {
        // cuilleres a soupe et a cafe d'un meme placard : tout en cuilleres a cafe (1 cs = 3 cc)
        if (cur.unit === 'cs') { cur.qty *= 3; cur.unit = 'cc'; }
        cur.qty += unit === 'cs' ? qty * 3 : qty;
      } else if (cur.unit !== unit) { echec('fusion', `${rec.nom} : ${attr.cle} en ${cur.unit} et ${unit}, fusion impossible`); continue; }
      else cur.qty += qty;
      cur.optional = cur.optional && optional;
    } else {
      lignes.set(attr.cle, { cle: attr.cle, unit, qty, optional });
    }
    noms.push(nom);
    // nutrition (par nom, quantite convertie avant arrondi)
    const nu = e.nutrition;
    let grammes;
    if (unit === 'g' || unit === 'ml') grammes = qty;
    else if (unit === 'cs') grammes = qty * 15;
    else if (unit === 'cc') grammes = qty * 5;
    else if (nu && nu.g_par_u > 0) grammes = qty * nu.g_par_u;
    else { echec('nutrition', `${rec.nom} : g_par_u manquant pour « ${nom} » (unite u)`); continue; }
    if (!nu) { echec('nutrition', `${rec.nom} : nutrition manquante pour « ${nom} »`); continue; }
    kcal += (grammes * nu.kcal_100) / 100;
    prot += (grammes * nu.prot_100) / 100;
  }
  const out = [];
  for (const l of lignes.values()) {
    const qty = arrondiQuantite(l.unit, l.qty);
    out.push({ cle: l.cle, unit: l.unit, qty, optional: l.optional });
  }
  return { lignes: out, noms: uniq(noms), kcalTotal: kcal, protTotal: prot };
}

/* ---------------------- regroupement des phrases en 3 a 6 etapes ---------------------- */

const PHRASE_FINALE = {
  chaud: 'Servir aussitôt.',
  frais: 'Servir bien frais.',
  deja: 'Déguster sans attendre.',
  verres: 'Verser dans des verres et servir bien frais.',
  paille: 'Verser dans des verres et servir aussitôt avec une paille.',
};
function regrouper(phrases, infos) {
  // phrases : textes ; infos : analyses ; renvoie un tableau de groupes d'indices
  const groupes = phrases.map((_, i) => [i]);
  const longueur = (g) => g.reduce((s, i) => s + phrases[i].length, 0);
  const minuteur = (g) => g.some((i) => infos[i].genre > 0 && infos[i].sec > 0);
  while (groupes.length > 6) {
    let meilleur = 0;
    let coutMin = Infinity;
    for (let k = 0; k < groupes.length - 1; k++) {
      const a = groupes[k];
      const b = groupes[k + 1];
      const L = longueur(a) + longueur(b);
      let cout = L;
      if (minuteur(a) && minuteur(b)) cout += 400;
      if (L > 350) cout += (L - 350) * 2;
      if (/^Préchauffer/.test(phrases[a[0]]) && a.length === 1) cout -= 150;
      if (/^(Saler|Poivrer|Assaisonner|Servir|Parsemer|Décorer|Garnir|Napper|Arroser|Réserver)/.test(phrases[b[0]])) cout -= 60;
      if (cout < coutMin) { coutMin = cout; meilleur = k; }
    }
    groupes.splice(meilleur, 2, [...groupes[meilleur], ...groupes[meilleur + 1]]);
  }
  return groupes;
}

/* ----------------------------------- regles calculees ----------------------------------- */

const SEUIL_ECO = { plat: 2.6, entree: 1.9, dessert: 1.55, 'petit-dejeuner': 1.4 };
const SEUIL_LEGER = { plat: 450, entree: 240, dessert: 250, 'petit-dejeuner': 210 };
const ENFANTS_NON = new Set([
  'piment-frais', 'piment-espelette', 'curry', 'cumin', 'ras-el-hanout', 'pate-curry-jaune', 'pate-curry-korma', 'pate-curry-massaman',
  'pate-curry-rouge', 'pate-curry-vert', 'pate-tikka-masala', 'vin-blanc', 'vin-rouge', 'biere', 'cidre', 'rhum', 'olives', 'sardine',
  'sardine-fraiche', 'maquereau', 'chorizo', 'magret-canard', 'agneau', 'gigot-agneau', 'cotelette-agneau', 'tofu', 'tofu-fume', 'lentilles',
  'lentilles-corail', 'epinard', 'aubergine', 'navet', 'radis', 'menthe', 'lait-coco', 'crevette', 'gambas', 'saint-jacques', 'palourde',
  'calamar', 'endive', 'fenouil', 'roquette', 'celeri-rave', 'celeri-branche', 'chou-bruxelles', 'pain-campagne', 'merguez', 'roquefort',
  'gorgonzola', 'nuoc-mam', 'sauce-huitre', 'pak-choi', 'estragon-frais', 'coriandre',
]);
const ENFANTS_OUI = new Set([
  'jambon-blanc', 'boeuf-hache', 'chapelure', 'pates', 'emmental', 'gruyere', 'cheddar', 'mozzarella', 'tortilla', 'pain-burger', 'banane',
  'chocolat-noir', 'chocolat-blanc', 'speculoos', 'mais', 'pate-brisee', 'gnocchi', 'lait', 'pate-pizza', 'pepites-chocolat', 'pate-a-tartiner',
  'sucre-vanille', 'levure', 'chantilly', 'glace-vanille', 'pate-sablee', 'pain-mie', 'yaourt', 'fromage-blanc', 'fraise',
]);
const SAISON_ETE = new Set([
  'tomate', 'tomate-cerise', 'courgette', 'aubergine', 'poivron', 'concombre', 'basilic', 'menthe', 'fraise', 'mangue', 'haricot-vert',
  'citron-vert', 'pasteque', 'melon', 'peche', 'nectarine', 'framboise', 'abricot',
]);
const SAISON_HIVER = new Set([
  'poireau', 'courge', 'potiron', 'chou-rouge', 'chou-fleur', 'chou-bruxelles', 'navet', 'panais', 'endive', 'patate-douce', 'betterave',
  'pomme', 'poire', 'champignon', 'celeri-rave', 'coing',
]);
const SAISON_PRINTEMPS = new Set(['radis', 'petits-pois', 'feves', 'asperge-verte', 'rhubarbe', 'artichaut', 'fraise']);
const CRU_FINITION = new Set(['concombre', 'avocat', 'radis', 'germes-soja', 'ciboulette', 'salade', 'roquette', 'burrata', 'mayonnaise', 'oignon-rouge']);
const FRAIS_CREMERIE = new Set(['mascarpone', 'fromage-blanc', 'chantilly', 'cream-cheese', 'creme', 'creme-fraiche', 'yaourt', 'yaourt-grec', 'ricotta', 'glace-vanille']);

function ranger(titre, sub) {
  const t = norm(titre);
  const has = (re) => re.test(t);
  return {
    soupe: sub === 'soupes' || has(/\b(soupe|veloute|potage|gaspacho)\b/),
    gratin: sub === 'gratins' || has(/\b(gratin|lasagnes?|hachis|moussaka|parmentier|cannellonis|tartiflette)\b/),
    tarte: sub === 'tartes_salees' || has(/\b(tarte|quiche|tourte|feuillete)\b/),
    mijote: has(/\b(mijote|daube|bourguignon|ragout|cassoulet|chili|tajine|blanquette|navarin|potee|osso|curry|dahl|colombo|carbonade|braise|confit|bolognaise|sauce tomate|marmite|korma|tikka|masala|biryani|vindaloo|madras|massaman|jalfrezi|rogan josh)\b/),
    friture: has(/\b(frit|frites|croustillant|nuggets?|beignets?|tempura|panee?s?|croquettes?|falafels?|accras?|nems?|samoussas?|cordon bleu|burgers?|tacos?|wraps?|galettes?|croque)\b/),
    risotto: has(/\b(risotto|carbonara)\b/),
    gateau: sub === 'gateaux' || has(/\b(cakes?|muffins?|cookies?|quiches?|brownies?|fondant|madeleines?)\b/),
  };
}

function difficulteDe(titre, timeMin, sub) {
  const t = norm(titre);
  if (/\b(souffle|pastilla|iles flottantes|chou farci|feuilletage)\b/.test(t)) return 3;
  if (timeMin >= 75) return 2;
  if (/\b(farci|farcie|farcis|farcies|risotto|lasagnes?|cassoulet|bourguignon|daube|blanquette|navarin|coq au vin|carbonade|tajine|couscous|paella|moussaka|pizza maison|pate maison|osso|choucroute|cannellonis)\b/.test(t)) return 2;
  return 1;
}

/* ---------------------------------- construction ---------------------------------- */

// 1. Selection des recettes et motifs d'ecart
const titresHerites = new Set(Object.values(FR_ACTUEL.recipes).map((r) => norm(r.title)));
const bilan = { generees: TOUTES.length, exclusion: {}, doublon: 0, versees: {}, parSub: {} };
const retenues = [];
for (const r of TOUTES) {
  if (!SUBS.includes(r.cat)) echec('categorie', `${r.nom} : categorie inconnue ${r.cat}`);
  let motif = null;
  if (r.cat === 'sauces') motif = 'sauce';
  else if (r.cat === 'boissons' && !/^(Smoothie|Milkshake)\b/.test(r.nom)) motif = 'boisson (eau aromatisee, citronnade, limonade, orangeade, autre)';
  else if (/^Pur[ée]e\b/i.test(r.nom)) motif = 'puree';
  if (motif) { bilan.exclusion[motif] = (bilan.exclusion[motif] || 0) + 1; continue; }
  if (titresHerites.has(norm(r.nom))) { bilan.doublon++; continue; }
  retenues.push(r);
}

// 2. Phrases : dictionnaire, analyse
const phrasesTexte = registrePhrases.slice(); // id -> texte, append-only
const phraseId = new Map(phrasesTexte.map((t, i) => [t, i]));
function idPhrase(texte) {
  if (phraseId.has(texte)) return phraseId.get(texte);
  const id = phrasesTexte.length;
  phrasesTexte.push(texte);
  phraseId.set(texte, id);
  return id;
}
const remplir = (e) => e[0].replace(/\{(\d+)\}/g, (m, i) => (e[1 + +i] === undefined ? m : e[1 + +i]));

// 3. Recettes : calcul complet
const recettes = [];
const titresVus = new Map();
const phraseAnalyse = new Map(); // texte -> analyse
const analyser = (t) => {
  if (!phraseAnalyse.has(t)) phraseAnalyse.set(t, analysePhrase(t));
  return phraseAnalyse.get(t);
};
const lexPhrase = new Map();
const lexDe = (t) => {
  if (!lexPhrase.has(t)) lexPhrase.set(t, lexique(t));
  return lexPhrase.get(t);
};
const ajoutsFinaux = { chaud: 0, frais: 0, deja: 0, verres: 0, paille: 0 };
const hist = { etapes: {}, phrases: {} };

for (const r of retenues) {
  const titre = r.nom;
  const cle = norm(titre);
  if (TIRET.test(titre) || /\s{2,}/.test(titre)) echec('titre', `titre invalide : ${titre}`);
  if (titresVus.has(cle)) echec('titre', `titre en double : ${titre}`);
  titresVus.set(cle, true);
  const sub = r.cat;
  const course = COURSE_DE_SUB[sub] || 'plat';
  const scale = (sub === 'boissons' || sub === 'petit_dejeuner') && r.pers === 2 ? 2 : 1;
  const conv = convertirIngredients(r, scale);
  if (conv.lignes.length < 2) echec('ingredients', `${titre} : moins de 2 ingredients`);
  if (conv.lignes.length > 63) echec('ingredients', `${titre} : plus de 63 ingredients`);

  // phrases
  let textes = [];
  for (const e of r.etapes) {
    const imp = remplir(e);
    if (/\{\d+\}/.test(imp)) echec('phrase', `${titre} : gabarit non rempli « ${imp.slice(0, 50)} »`);
    const inf = PHRASES_INF[imp];
    if (inf === undefined || !String(inf).trim()) { echec('phrase', `${titre} : phrase sans traduction francaise « ${imp.slice(0, 60)} »`); continue; }
    if (TIRET.test(inf)) echec('tiret', `${titre} : tiret long ou fleche dans une phrase`);
    textes.push(inf);
  }
  if (textes.length === 2) {
    const derniere = textes[1];
    let choix;
    if (sub === 'boissons') choix = /^Milkshake/.test(titre) ? 'paille' : 'verres';
    else if (/\b(servir|déguster)\b/i.test(derniere)) choix = 'deja';
    else if (course === 'dessert' || sub === 'salades') choix = 'frais';
    else choix = 'chaud';
    ajoutsFinaux[choix]++;
    textes = [...textes, PHRASE_FINALE[choix]];
  }
  if (textes.length < 3 && textes.length > 0) echec('etapes', `${titre} : ${textes.length} phrase(s) seulement`);
  const infos = textes.map(analyser);
  const groupes = regrouper(textes, infos);
  if (groupes.length < 3 || groupes.length > 6) echec('etapes', `${titre} : ${groupes.length} etapes`);
  hist.etapes[groupes.length] = (hist.etapes[groupes.length] || 0) + 1;
  const ids = textes.map(idPhrase);

  // minuteurs par etape
  const stepTimers = {};
  const stepKinds = {};
  let feuFour = 0;
  let reposMax = 0;
  let reposCourt = 0;
  let reposLong = 0;
  groupes.forEach((g, k) => {
    let best = null;
    for (const i of g) if (infos[i].genre > 0 && infos[i].sec > 0 && (!best || infos[i].sec > best.sec)) best = infos[i];
    if (best) {
      stepTimers[k] = best.sec;
      stepKinds[k] = GENRE_NOM[best.genre];
      if (best.genre === 3) { reposMax = Math.max(reposMax, best.sec); if (best.sec >= 7200) reposLong += best.sec; else reposCourt += best.sec; }
      else feuFour += best.sec;
    }
  });
  const ovenTempC = Math.max(0, ...infos.map((i) => (i.temp > 0 ? i.temp : 0)));
  if (infos.some((i) => i.temp === -1)) echec('four', `${titre} : temperature hors four`);
  if (ovenTempC && (ovenTempC < 100 || ovenTempC > 280 || ovenTempC % 10)) echec('four', `${titre} : temperature de four ${ovenTempC}`);
  const four = ovenTempC > 0 || Object.values(stepKinds).includes('four') || infos.some((i) => i.four);
  const cuisson = infos.some((i) => i.cuisson) || feuFour > 0;

  // temps : preparation implicite (temps du generateur moins duree des minuteurs, au moins 5 min) + minuteurs
  const minutes = (s) => Math.round(s / 60);
  const prep = Math.max(5, r.temps - Math.min(r.temps - 5, minutes(feuFour + reposCourt)));
  const timeMin = Math.max(5, Math.round((prep + minutes(feuFour) + minutes(reposCourt)) / 5) * 5);

  // allergenes, tags
  const decl = new Set();
  const eff = new Set();
  let viande = false;
  let alcool = false;
  let veganNon = false;
  for (const nom of conv.noms) {
    const a = ATTR.get(nom);
    a.declares.forEach((x) => decl.add(x));
    a.eff.forEach((x) => eff.add(x));
    if (a.viande) viande = true;
    if (a.alcool) alcool = true;
    if (VEGAN_INTERDIT_NOMS.has(nom)) veganNon = true;
  }
  // allergenes evoques par le texte des etapes mais absents des ingredients : doute, pas de tag de regime
  const effTags = new Set(eff);
  let douteTexte = false;
  for (const t of textes) {
    for (const k of lexDe(t)) {
      if (k === 'viande') { if (!viande) { viande = true; douteTexte = true; } continue; }
      if (k === 'alcool') { if (!alcool) { alcool = true; douteTexte = true; } continue; }
      if (!effTags.has(k)) { effTags.add(k); douteTexte = true; }
    }
  }

  const alg = ALG_KEYS.reduce((m, k, i) => (decl.has(k) ? m | (1 << i) : m), 0);
  const poissonOuCrustace = effTags.has('poisson') || effTags.has('crustaces');

  const tags = new Set();
  const cles = new Set(conv.lignes.map((l) => l.cle));
  const nomsSet = new Set(conv.noms);
  if (!viande && !poissonOuCrustace && !effTags.has('porc')) tags.add('vegetarien');
  if (tags.has('vegetarien') && !effTags.has('lait') && !effTags.has('oeuf') && !effTags.has('miel') && !alcool && !veganNon) tags.add('vegan');
  if (!effTags.has('gluten')) tags.add('sans-gluten');
  if (!effTags.has('lait')) tags.add('sans-lactose');
  if (!effTags.has('porc')) tags.add('sans-porc');
  if (tags.has('sans-porc') && !alcool) tags.add('halal-possible');
  if (!effTags.has('fruits-a-coque')) tags.add('sans-fruits-a-coque');
  if (tags.has('vegan') && !tags.has('vegetarien')) tags.delete('vegan');

  // cout par portion (formule de validate-menus.js)
  let cout = 0;
  for (const l of conv.lignes) {
    const f = INGS[l.cle];
    if (f.pantry || l.optional) continue;
    cout += f.pricePerUnit !== undefined ? f.pricePerUnit * l.qty : (f.pricePerKgOrL * l.qty) / 1000;
  }
  const coutPortion = cout / 4;
  // portions d'origine du generateur : quantites gardees entieres (scale 1) = pers portions (desserts, gateaux, quiches, aperitifs de 6 a 20) ;
  // quantites doublees (scale 2, pers 2) = 4 portions
  const portions = Math.max(1, (Number(r.pers) || 4) * scale);
  const kcal = Math.round(conv.kcalTotal / portions / 10) * 10;
  const prot = Math.round(conv.protTotal / portions);
  if (!(kcal > 0) || kcal > 2500) echec('nutrition', `${titre} : kcal ${kcal}`);

  // enfants
  const nonEnfant = [...cles].some((c) => ENFANTS_NON.has(c));
  const ouiEnfant = [...cles].some((c) => ENFANTS_OUI.has(c));
  if (!nonEnfant && ouiEnfant && !alcool) tags.add('enfants');
  if (timeMin <= 20 && reposMax < 3600) tags.add('rapide');
  if (coutPortion <= SEUIL_ECO[course]) tags.add('economique');
  if (kcal <= SEUIL_LEGER[course]) tags.add('leger');
  if (four) tags.add('four');
  if (!cuisson) tags.add('sans-cuisson');

  // saisons
  const ete = [...cles].some((c) => SAISON_ETE.has(c));
  const hiv = [...cles].some((c) => SAISON_HIVER.has(c));
  const titreN = norm(titre);
  const titreEte = /\b(salade|glace|sorbet|carpaccio|brochettes?|grill|gaspacho)\b/.test(titreN);
  const titreHiver = /\b(soupe|veloute|gratin|mijote|curry|potee|lasagnes?|chili|raclette|tartiflette)\b/.test(titreN);
  const longPlat = course === 'plat' && timeMin >= 60;
  if (ete && !hiv) tags.add('ete');
  else if (hiv || titreHiver || longPlat) { tags.add('hiver'); tags.add('automne'); }
  else if (titreEte || (!cuisson && course !== 'petit-dejeuner')) tags.add('ete');
  if (/\bprintani/.test(titreN) || [...cles].some((c) => SAISON_PRINTEMPS.has(c))) tags.add('printemps');

  // conservation
  const typo = ranger(titre, sub);
  const gateauGarde = typo.gateau; // decision du user : gateaux, cakes, muffins, cookies, quiches, cakes sales gardent leurs restes
  let leftoverOk;
  if (gateauGarde) leftoverOk = true;
  else if (sub === 'boissons' || sub === 'oeufs' || sub === 'pizzas' || sub === 'sandwichs' || sub === 'bowls') leftoverOk = false;
  else if (sub === 'salades') leftoverOk = [...cles].some((c) => ['pates', 'riz', 'pomme-de-terre', 'quinoa', 'boulgour', 'lentilles', 'pois-chiches', 'haricots-blancs', 'haricots-rouges', 'semoule'].includes(c)) && !cles.has('avocat') && !cles.has('roquette') && !cles.has('salade');
  else if (sub === 'poissons') leftoverOk = typo.gratin || typo.soupe || typo.mijote || /\b(brandade|parmentier)\b/.test(titreN);
  else if (sub === 'viandes') leftoverOk = !typo.friture && (typo.mijote || typo.gratin || /\b(roti|saute|ragout|boulettes|emince|farci|terrine|pot au feu|poulet roti|cuisses?|gigot|epaule|filet mignon|saucisses?|chipolatas?|jarret|paleron|travers)\b/.test(titreN));
  else if (sub === 'pates_riz') leftoverOk = !typo.risotto && !typo.friture && !/\b(saute|sautees?|poelee|pad thai|wok)\b/.test(titreN);
  else if (sub === 'vegetarien') leftoverOk = !typo.friture;
  else if (sub === 'aperitif') leftoverOk = /\b(houmous|tapenade|rillettes|tzatziki|caviar|tartinade|dip|mousse|verrines?|brandade|guacamole|pesto|cake|muffins?)\b/.test(titreN) && !typo.friture;
  else if (sub === 'accompagnements') leftoverOk = !typo.friture && !/\b(rosti|poelee)\b/.test(titreN);
  else if (sub === 'desserts') leftoverOk = !/\b(beignets?|crepes?|gaufres?|pancakes?|souffles?|profiteroles?|eclairs?|meringues?|pavlova|chantilly|fondue|flambe|tartines?|poelee)\b/.test(titreN);
  else if (sub === 'petit_dejeuner') leftoverOk = /\b(porridge|granola|overnight|chia)\b/.test(titreN);
  else leftoverOk = true; // soupes, gratins, tartes salees
  const marine = poissonOuCrustace;
  let freezable = false;
  const cruFinition = [...cles].some((c) => CRU_FINITION.has(c));
  if (leftoverOk && !marine && !cruFinition) {
    if (course === 'dessert') {
      freezable = (sub === 'gateaux' || /\b(cookies?|brownies?|muffins?|cakes?|biscuits?|crumble|tarte|truffes?|sables?|energy|granola|compote)\b/.test(titreN)) && ![...cles].some((c) => FRAIS_CREMERIE.has(c));
    } else if (course === 'petit-dejeuner') {
      freezable = /\b(muffins?|cakes?|cookies?|granola)\b/.test(titreN) && ![...cles].some((c) => FRAIS_CREMERIE.has(c));
    } else if (typo.soupe || typo.gratin || typo.tarte || typo.mijote || gateauGarde) freezable = true;
    else if (sub === 'viandes' && [...cles].some((c) => ['tomate-concassee', 'coulis-tomate', 'creme', 'lait-coco', 'bouillon', 'vin-rouge', 'vin-blanc'].includes(c))) freezable = true;
    else if (sub === 'pates_riz' && !typo.risotto && [...cles].some((c) => ['tomate-concassee', 'coulis-tomate', 'creme', 'lait-coco', 'bouillon', 'boeuf-hache'].includes(c))) freezable = true;
    else if (sub === 'vegetarien' && [...cles].some((c) => ['lentilles', 'lentilles-corail', 'pois-chiches', 'haricots-rouges', 'haricots-blancs', 'tomate-concassee', 'lait-coco'].includes(c))) freezable = true;
    else if (sub === 'accompagnements' && typo.gratin) freezable = true;
  }
  let keepDays;
  if (marine) keepDays = leftoverOk ? 2 : 1;
  else if (!leftoverOk) keepDays = 1;
  else if (course === 'dessert') keepDays = freezable ? (/\b(cookies?|biscuits?|sables?|truffes?|energy)\b/.test(titreN) ? 5 : 3) : 2;
  else if (course === 'petit-dejeuner') keepDays = /^granola/.test(titreN) && ![...cles].some((c) => FRAIS_CREMERIE.has(c) || INGS[c].aisle === 'fruits-legumes') ? 14 : 2;
  else if (freezable) keepDays = typo.mijote || typo.soupe ? 4 : 3;
  else keepDays = 2;
  if (marine) freezable = false;
  const batch = course === 'plat' && freezable && keepDays >= 3 && minutes(feuFour) >= 20;
  if (batch) tags.add('batch');

  const difficulty = difficulteDe(titre, timeMin, sub);
  const [m1, m2] = principaux(conv.lignes);

  recettes.push({
    titre, cle, sub, course, famille: familleDe(titre), tags: TAGS.filter((t) => tags.has(t)), timeMin, difficulty, kcal, prot,
    keepDays, leftoverOk, freezable, four, retiree: false, coutPortion, alg, lignes: conv.lignes, ids, groupes, stepTimers, stepKinds,
    ovenTempC, m1, m2, effTags: [...effTags], douteTexte, nonVegetarien: viande || poissonOuCrustace, scale, pers: r.pers,
  });
}

// Ingredients principaux (reprise de mainIngredients de lib/menus/variety.js)
function principaux(lignes) {
  const NEUTRE = new Set([
    'riz', 'pates', 'semoule', 'boulgour', 'nouilles', 'nouilles-riz', 'pates-lasagne', 'baguette', 'tortilla', 'pain-burger', 'pain-mie', 'pain-pita',
    'oignon', 'ail', 'echalote', 'citron', 'tomate-concassee', 'concentre-tomate', 'lait-coco', 'lait', 'creme', 'creme-fraiche', 'beurre',
    'fromage-rape', 'farine', 'sucre', 'chapelure', 'pate-feuilletee', 'pate-brisee', 'persil', 'coriandre', 'basilic', 'menthe', 'ciboulette',
    'gingembre', 'herbes', 'tahini', 'olives',
  ]);
  const PULSES = new Set(['pois-chiches', 'lentilles', 'haricots-rouges', 'tofu']);
  const sc = [];
  for (const l of lignes) {
    if (l.optional) continue;
    const f = INGS[l.cle];
    if (f.pantry || NEUTRE.has(l.cle)) continue;
    const amt = l.unit === 'cs' ? l.qty * 15 : l.unit === 'cc' ? l.qty * 5 : l.qty;
    let w = l.unit === 'u' ? amt * 80 : amt;
    if (f.aisle === 'viandes-poissons') w += 10000;
    else if (PULSES.has(l.cle)) w += 5000;
    sc.push([l.cle, w]);
  }
  sc.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const top = sc.slice(0, 2).map((x) => ING_INDEX.get(x[0]) + 1);
  return [top[0] || 0, top[1] || 0];
}

finirSiProblemes();

/* --------------------- coherence finale (memes regles que validate-menus.js) --------------------- */

for (const r of recettes) {
  const al = new Set();
  let meat = false;
  for (const l of r.lignes) {
    const f = INGS[l.cle];
    (f.allergens || []).forEach((a) => al.add(a));
    if (f.aisle === 'viandes-poissons' || (f.allergens || []).includes('crustaces')) meat = true;
  }
  const has = (t) => r.tags.includes(t);
  if (has('vegetarien') && (meat || r.nonVegetarien)) echec('tag', `${r.titre} : vegetarien avec viande ou poisson`);
  if (has('vegan') && (meat || al.has('lait') || al.has('oeuf') || al.has('miel'))) echec('tag', `${r.titre} : vegan incoherent`);
  if (has('sans-gluten') && al.has('gluten')) echec('tag', `${r.titre} : sans-gluten incoherent`);
  if (has('sans-lactose') && al.has('lait')) echec('tag', `${r.titre} : sans-lactose incoherent`);
  if ((has('sans-porc') || has('halal-possible')) && al.has('porc')) echec('tag', `${r.titre} : sans-porc ou halal incoherent`);
  if (has('sans-fruits-a-coque') && al.has('fruits-a-coque')) echec('tag', `${r.titre} : sans-fruits-a-coque incoherent`);
  const poisson = [...al].some((a) => a === 'poisson' || a === 'crustaces');
  if (poisson && r.keepDays > 2) echec('tag', `${r.titre} : keepDays trop long pour du poisson`);
  if (poisson && r.freezable) echec('tag', `${r.titre} : poisson congelable`);
  if (r.freezable && !r.leftoverOk) echec('tag', `${r.titre} : congelable sans restes`);
  if (r.timeMin % 5) echec('temps', `${r.titre} : timeMin non multiple de 5`);
}
if (phrasesTexte.length > MAX_PHRASES) echec('phrases', `${phrasesTexte.length} phrases, maximum ${MAX_PHRASES}`);
for (const t of phrasesTexte) if (!t || TIRET.test(t) || /\{\d+\}/.test(t)) echec('phrases', `phrase invalide : ${String(t).slice(0, 60)}`);
finirSiProblemes();

/* --------------------------------- registre des cases --------------------------------- */

const registreFinal = { ...registre };
let prochaineCase = Object.keys(registre).length;
for (const [k, v] of Object.entries(registre)) if (!Number.isInteger(v) || v < 0 || v >= prochaineCase) echec('registre', `case invalide pour ${k}`);
const caseDe = new Map();
for (const r of recettes) {
  if (registreFinal[r.cle] === undefined) registreFinal[r.cle] = prochaineCase++;
  caseDe.set(r.cle, registreFinal[r.cle]);
}
const N = Object.keys(registreFinal).length;
const lignesParCase = new Array(N).fill(null);
for (const r of recettes) {
  const c = caseDe.get(r.cle);
  if (lignesParCase[c]) echec('id', `case ${c} en double`);
  lignesParCase[c] = r;
}
const idDe = (c) => `g-${c.toString(36)}`;
const idsHerites = new Set(RECETTES_HERITEES.map((r) => r.id));
for (const id of idsHerites) if (/^g-[0-9a-z]+$/.test(id) || /^my-/.test(id)) echec('id', `id herite ressemble a un id genere : ${id}`);
const idsVus = new Set();
for (let c = 0; c < N; c++) {
  const id = idDe(c);
  if (idsVus.has(id) || idsHerites.has(id)) echec('id', `id en double : ${id}`);
  idsVus.add(id);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) echec('id', `id invalide : ${id}`);
  if (parseInt(id.slice(2), 36) !== c) echec('id', `id non reversible : ${id}`);
}
finirSiProblemes();

/* ------------------------------------- ecriture des colonnes ------------------------------------- */

function construireJeu(rows, phrasesTextes, remapPhrase) {
  // rows : tableau (index = case) de recettes ou null (retiree). remapPhrase : id global -> id local
  const n = rows.length;
  const paires = new Map();
  const pairesListe = [];
  const lignesDe = (r) => (r ? r.lignes : []);
  for (const r of rows) {
    for (const l of lignesDe(r)) {
      const k = `${l.qty}:${l.unit}`;
      if (!paires.has(k)) { paires.set(k, pairesListe.length); pairesListe.push(k); }
    }
  }
  const LINE_W = pairesListe.length > 256 ? 4 : 3;
  const PAIR_BITS = LINE_W === 3 ? 8 : 14;
  if (pairesListe.length > (1 << PAIR_BITS)) echec('paires', `${pairesListe.length} couples quantite/unite, maximum ${1 << PAIR_BITS}`);
  const champs = {};
  for (const [nom] of FIELDS) champs[nom] = new Array(n);
  const lignesBlocs = [];
  const etapesBlocs = [];
  const nbBlocs = Math.max(1, Math.ceil(n / SHARD));
  for (let b = 0; b < nbBlocs; b++) { lignesBlocs.push([]); etapesBlocs.push([]); }
  for (let c = 0; c < n; c++) {
    const r = rows[c];
    const ctx = `case ${c}`;
    const bloc = Math.floor(c / SHARD);
    if (!r) {
      for (const [nom, w] of FIELDS) champs[nom][c] = enc(nom === 'flags' ? 4 : 0, w, ctx);
      continue;
    }
    const tagsMask = TAGS.reduce((m, t, i) => (r.tags.includes(t) ? m + Math.pow(2, i) : m), 0);
    const flags = (r.leftoverOk ? 1 : 0) | (r.freezable ? 2 : 0) | (r.retiree ? 4 : 0) | (r.four ? 8 : 0);
    const vals = {
      course: COURSES.indexOf(r.course), sub: SUBS.indexOf(r.sub), family: r.famille, tags: tagsMask, time: r.timeMin / 5,
      diff: r.difficulty - 1, kcal: r.kcal / 10, prot: r.prot, keep: r.keepDays, flags,
      cost: Math.min(4095, Math.round(r.coutPortion * 10)), alg: r.alg, nIng: r.lignes.length, nStep: r.groupes.length,
      nPhr: r.ids.length, main1: r.m1, main2: r.m2,
    };
    for (const [nom, w] of FIELDS) champs[nom][c] = enc(vals[nom], w, `${ctx} ${nom}`);
    for (const l of r.lignes) {
      const v = ING_INDEX.get(l.cle) + (paires.get(`${l.qty}:${l.unit}`) << 9) + (l.optional ? Math.pow(2, 9 + PAIR_BITS) : 0);
      lignesBlocs[bloc].push(enc(v, LINE_W, ctx));
    }
    r.groupes.forEach((g) => {
      g.forEach((idx, j) => {
        const id = remapPhrase(r.ids[idx]);
        etapesBlocs[bloc].push(enc(id + (j < g.length - 1 ? PHRASE_CONT : 0), 2, ctx));
      });
    });
  }
  return { n, champs, pairesListe, LINE_W, PAIR_BITS, lignesBlocs, etapesBlocs, nbBlocs };
}

// Metadonnees par phrase : genre, secondes, temperature de four
function metaPhrase(texte) {
  const a = analyser(texte);
  return [a.genre, a.genre > 0 ? a.sec : 0, a.temp > 0 ? a.temp : 0];
}

const js = (s) => `module.exports = ${JSON.stringify(s)};\n`;
const jsObj = (o) => `module.exports = ${JSON.stringify(o)};\n`;

// packs : Map langue -> { titres: string[] (un par case), phrases: string[] (un par identifiant de phrase) }, 'fr' en tete.
function fichiersDuJeu(dir, jeu, packs) {
  const sorties = new Map();
  const phrasesTextes = packs.get('fr').phrases;
  const meta = {
    VERSION: 1,
    N: jeu.n,
    SHARD,
    LINE_W: jeu.LINE_W,
    PAIR_BITS: jeu.PAIR_BITS,
    PHRASE_CONT,
    FIELDS,
    COURSES,
    SUBS,
    TAGS,
    ALG_KEYS,
    FAMILIES: FAMILLES.join('\n'),
    ING_KEYS: ING_KEYS.join('\n'),
    PAIRS: jeu.pairesListe.join('|'),
    PHRASE_META: phrasesTextes.map((t) => metaPhrase(t).join(',')).join('|'),
  };
  const entete = `// Fichier genere par scripts/menus-gen/build-menus.js : ne pas modifier a la main.\n`;
  sorties.set(path.join(dir, 'meta.js'), `${entete}module.exports = ${JSON.stringify(meta, null, 2).replace(/"FIELDS": \[[\s\S]*?\n  \],/, (m) => `"FIELDS": ${JSON.stringify(FIELDS)},`)};\n`);
  const hdr = {};
  for (const [nom] of FIELDS) hdr[nom] = jeu.champs[nom].join('');
  sorties.set(path.join(dir, 'hdr.js'), `${entete}module.exports = ${JSON.stringify(hdr)};\n`);
  for (let b = 0; b < jeu.nbBlocs; b++) {
    sorties.set(path.join(dir, `lines-${b}.js`), js(jeu.lignesBlocs[b].join('')));
    sorties.set(path.join(dir, `steps-${b}.js`), js(jeu.etapesBlocs[b].join('')));
    const debut = b * SHARD;
    for (const [lang, pack] of packs) sorties.set(path.join(dir, 'lang', `${lang}-titles-${b}.js`), js(pack.titres.slice(debut, debut + SHARD).join('\n')));
  }
  for (const [lang, pack] of packs) sorties.set(path.join(dir, 'lang', `${lang}-steps.js`), js(pack.phrases.join('\n')));
  // table statique des require (Metro)
  const langs = [...packs.keys()];
  const L = [];
  L.push(entete.trim());
  L.push("/* eslint-disable global-require */");
  L.push('const LANGS = [' + langs.map((l) => `'${l}'`).join(', ') + '];');
  L.push('const NB_BLOCS = ' + jeu.nbBlocs + ';');
  const sw = (nom, args, corps) => {
    L.push(`function ${nom}(${args}) {`);
    L.push(corps);
    L.push('}');
  };
  const cas = (prefixe, b) => `    case ${b}:\n      return require('${prefixe}${b}');`;
  const range = Array.from({ length: jeu.nbBlocs }, (_, i) => i);
  sw('lines', 'k', `  switch (k) {\n${range.map((b) => cas('./lines-', b)).join('\n')}\n    default:\n      return null;\n  }`);
  sw('steps', 'k', `  switch (k) {\n${range.map((b) => cas('./steps-', b)).join('\n')}\n    default:\n      return null;\n  }`);
  const titresCas = langs
    .map((l) => `    case '${l}':\n      switch (k) {\n${range.map((b) => `        case ${b}:\n          return require('./lang/${l}-titles-${b}');`).join('\n')}\n        default:\n          return null;\n      }`)
    .join('\n');
  sw('titles', 'lang, k', `  switch (lang) {\n${titresCas}\n    default:\n      return null;\n  }`);
  sw('phrases', 'lang', `  switch (lang) {\n${langs.map((l) => `    case '${l}':\n      return require('./lang/${l}-steps');`).join('\n')}\n    default:\n      return null;\n  }`);
  L.push('module.exports = { LANGS, NB_BLOCS, lines, steps, titles, phrases };');
  sorties.set(path.join(dir, 'loaders.js'), L.join('\n') + '\n');
  return sorties;
}

// Jeu complet
const titresParCase = lignesParCase.map((r) => (r ? r.titre : '-'));
const jeuComplet = construireJeu(lignesParCase, phrasesTexte, (x) => x);
finirSiProblemes();

/* ---------------------------- traductions : packs de langue ---------------------------- */

const LANGUES = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ar', 'sv', 'th']; // MENU_LANGS de lib/menus/recipes.js
const ALIAS_LANGUE = { cn: 'zh', jp: 'ja', se: 'sv', us: 'en', gb: 'en', sa: 'ar' };
const normaliserLangue = (nom) => {
  const l = String(nom).toLowerCase().replace('_', '-').split('-')[0];
  return ALIAS_LANGUE[l] || l;
};
const LANGUES_LATINES = new Set(['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'sv']);
const ECRITURE = {
  ru: /[Ѐ-ӿ]/,
  ar: /[؀-ۿ]/,
  th: /[฀-๿]/,
  zh: /[一-鿿]/,
  ja: /[぀-ヿ一-鿿]/,
};
const TIRET_TRAD = /[—–‒―→←↔⇒⇔➔➜➡⟶]/;
const avertissements = {}; // categorie -> { n, exemples }
function avertir(categorie, message) {
  const a = avertissements[categorie] || (avertissements[categorie] = { n: 0, exemples: [] });
  a.n++;
  if (a.exemples.length < 5) a.exemples.push(message);
}
const { chiffresDe, memesChiffres } = require('./chiffres');
// Controle commun d'un texte traduit. Renvoie le texte nettoye (espaces de bord retirees) ou null (erreur deja signalee).
// nature : 'phrase' (chiffres et ecriture obligatoires), 'titre' et 'ingredient' (avertissements pour ces deux controles).
function controlerTexte(lang, nature, id, brut, fr) {
  const ctx = `${lang} ${nature} ${id}`;
  if (typeof brut !== 'string') { echec('traduction', `${ctx} : texte absent ou non textuel`); return null; }
  let t = brut.trim();
  if (!t) { echec('traduction', `${ctx} : texte vide`); return null; }
  if (/[\r\n]/.test(t)) { echec('traduction', `${ctx} : saut de ligne dans le texte`); return null; }
  if (TIRET_TRAD.test(t)) { echec('traduction', `${ctx} : tiret cadratin, demi-cadratin ou fleche`); return null; }
  if (/\{\d+\}/.test(t)) { echec('traduction', `${ctx} : gabarit {n} residuel`); return null; }
  if (LANGUES_LATINES.has(lang) && t.includes('’')) {
    if (CORRIGER_APOSTROPHES) t = t.replace(/’/g, "'");
    else { echec('traduction', `${ctx} : apostrophe typographique (utiliser ' ou --corriger-apostrophes)`); return null; }
  }
  if (ECRITURE[lang] && !ECRITURE[lang].test(t)) {
    if (nature === 'phrase') { echec('traduction', `${ctx} : aucun caractere de l'ecriture attendue (non traduit ?)`); return null; }
    avertir(`ecriture-${nature}`, `${ctx} « ${t.slice(0, 40)} »`);
  }
  if (fr !== undefined && !memesChiffres(fr, t)) {
    if (nature === 'phrase') { echec('traduction', `${ctx} : chiffres differents du francais (« ${chiffresDe(fr)} » contre « ${chiffresDe(t)} »)`); return null; }
    if (nature === 'titre') avertir('chiffres-titre', `${ctx} « ${t.slice(0, 40)} » (fr : ${chiffresDe(fr)})`);
  }
  return t;
}

const trier = (a, b) => a.localeCompare(b, 'en', { numeric: true });
function lireListeJson(lang, fichier, dir) {
  try { return JSON.parse(lire(path.join(dir, fichier))); } catch (e) { echec('traduction', `${lang}/${fichier} illisible : ${e.message}`); return null; }
}
// [{i, t}] ou {indice: texte} -> Map
function fusionnerIndexes(lang, fichier, data, cible) {
  const entrees = Array.isArray(data)
    ? data.map((e) => [e && e.i, e && e.t])
    : data && typeof data === 'object' ? Object.entries(data).map(([k, v]) => [/^\d+$/.test(k) ? Number(k) : NaN, v]) : null;
  if (!entrees) { echec('traduction', `${lang}/${fichier} : une liste [{i, t}] est attendue`); return; }
  for (const [i, t] of entrees) {
    if (!Number.isInteger(i) || i < 0) { echec('traduction', `${lang}/${fichier} : indice invalide ${JSON.stringify(i)}`); continue; }
    if (typeof t !== 'string') { echec('traduction', `${lang}/${fichier} : texte absent a l'indice ${i}`); continue; }
    if (cible.has(i) && cible.get(i) !== t) { echec('traduction', `${lang}/${fichier} : indice ${i} traduit deux fois differemment`); continue; }
    cible.set(i, t);
  }
}
function lireTraductions(dir) {
  const out = new Map();
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) { echec('traduction', `dossier de traductions introuvable : ${dir}`); return out; }
  const demandees = LANGUES_DEMANDEES ? new Set(LANGUES_DEMANDEES.split(',').map((x) => normaliserLangue(x.trim()))) : null;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const lang = normaliserLangue(d.name);
    if (!LANGUES.includes(lang)) { echec('traduction', `dossier de langue inconnu : ${d.name}`); continue; }
    if (lang === 'fr') { avertir('fr-ignore', 'le francais est genere par le build : dossier fr ignore'); continue; }
    if (demandees && !demandees.has(lang)) continue;
    if (out.has(lang)) { echec('traduction', `${lang} : deux dossiers pour la meme langue`); continue; }
    const base = path.join(dir, d.name);
    const fichiers = fs.readdirSync(base).sort(trier);
    const t = { lang, titres: new Map(), phrases: new Map(), ingredients: new Map(), fichiers: fichiers.length };
    for (const f of fichiers) {
      if (/^titres(-[^.]*)?\.json$/.test(f)) fusionnerIndexes(lang, f, lireListeJson(lang, f, base), t.titres);
      else if (/^phrases(-[^.]*)?\.json$/.test(f)) fusionnerIndexes(lang, f, lireListeJson(lang, f, base), t.phrases);
      else if (f === 'ingredients.json') {
        const data = lireListeJson(lang, f, base);
        const entrees = Array.isArray(data) ? data.map((e) => [e && e.cle, e && e.t]) : data && typeof data === 'object' ? Object.entries(data) : null;
        if (!entrees) { echec('traduction', `${lang}/${f} : une liste [{cle, t}] ou un objet {cle: nom} est attendu`); continue; }
        for (const [cle, nom] of entrees) {
          if (typeof cle !== 'string' || typeof nom !== 'string') { echec('traduction', `${lang}/${f} : entree invalide ${JSON.stringify(cle)}`); continue; }
          if (t.ingredients.has(cle) && t.ingredients.get(cle) !== nom) { echec('traduction', `${lang}/${f} : ${cle} traduit deux fois differemment`); continue; }
          t.ingredients.set(cle, nom);
        }
      } else avertir('fichier-ignore', `${lang}/${f}`);
    }
    out.set(lang, t);
  }
  if (demandees) for (const l of demandees) if (!out.has(l)) echec('traduction', `${l} : demandee par --langues mais absente du dossier`);
  return out;
}

const exemples = (a) => a.slice(0, 6).join(', ') + (a.length > 6 ? ', ...' : '');
// Construit le pack complet (titres par case, phrases par identifiant) d'une langue traduite ; signale chaque trou.
function construirePack(lang, trad) {
  const titres = new Array(N);
  const manquantsT = [];
  for (let c = 0; c < N; c++) {
    if (titresParCase[c] === '-') { titres[c] = '-'; continue; }
    if (!trad.titres.has(c)) { manquantsT.push(c); titres[c] = ''; continue; }
    const t = controlerTexte(lang, 'titre', c, trad.titres.get(c), titresParCase[c]);
    titres[c] = t === null ? '' : t;
  }
  if (manquantsT.length) echec('traduction', `${lang} : ${manquantsT.length} titre(s) manquant(s) sur ${N} (cases ${exemples(manquantsT)})`);
  const horsT = [...trad.titres.keys()].filter((i) => i >= N || titresParCase[i] === '-');
  if (horsT.length) echec('traduction', `${lang} : ${horsT.length} titre(s) pour des cases inexistantes ou retirees (${exemples(horsT)})`);
  const P = phrasesTexte.length;
  const phrases = new Array(P);
  const manquantsP = [];
  for (let i = 0; i < P; i++) {
    if (!trad.phrases.has(i)) { manquantsP.push(i); phrases[i] = ''; continue; }
    const t = controlerTexte(lang, 'phrase', i, trad.phrases.get(i), phrasesTexte[i]);
    phrases[i] = t === null ? '' : t;
  }
  if (manquantsP.length) echec('traduction', `${lang} : ${manquantsP.length} phrase(s) manquante(s) sur ${P} (identifiants ${exemples(manquantsP)})`);
  const horsP = [...trad.phrases.keys()].filter((i) => i >= P);
  if (horsP.length) echec('traduction', `${lang} : ${horsP.length} phrase(s) hors dictionnaire (${exemples(horsP)})`);
  // noms des nouveaux ingredients
  const noms = new Map();
  const attendus = [...NOUVELLES_FICHES.keys()];
  const manquantsI = attendus.filter((k) => !trad.ingredients.has(k));
  if (manquantsI.length) echec('traduction', `${lang} : ${manquantsI.length} nom(s) d'ingredient manquant(s) sur ${attendus.length} (${exemples(manquantsI)})`);
  const inconnusI = [...trad.ingredients.keys()].filter((k) => !NOUVELLES_FICHES.has(k));
  if (inconnusI.length) echec('traduction', `${lang} : ${inconnusI.length} ingredient(s) inconnu(s) ou deja traduit(s) (${exemples(inconnusI)})`);
  for (const k of attendus) {
    if (!trad.ingredients.has(k)) continue;
    const t = controlerTexte(lang, 'ingredient', k, trad.ingredients.get(k), undefined);
    if (t !== null) noms.set(k, t);
  }
  return { titres, phrases, noms };
}

// Pack deja integre (gen/lang/<langue>-*.js) conserve quand la langue n'est pas retraduite ; null s'il n'y en a pas.
function lirePackExistant(lang, nbBlocs) {
  const f = (n) => path.join(OUT_GEN, 'lang', n);
  if (!fs.existsSync(f(`${lang}-steps.js`))) return null;
  const charge = (n) => {
    try { const v = require(f(n)); return typeof v === 'string' ? v : null; } catch (_e) { return null; }
  };
  const titres = [];
  for (let b = 0; b < nbBlocs; b++) {
    const txt = charge(`${lang}-titles-${b}.js`);
    if (txt === null) { echec('pack', `${lang} : bloc de titres ${b} absent ou illisible`); return null; }
    titres.push(...txt.split('\n'));
  }
  const txtP = charge(`${lang}-steps.js`);
  if (txtP === null) { echec('pack', `${lang} : phrases illisibles`); return null; }
  const phrases = txtP.split('\n');
  if (titres.length !== N) { echec('pack', `${lang} : ${titres.length} titre(s) au lieu de ${N} (pack incomplet : fournir --traductions)`); return null; }
  if (phrases.length !== phrasesTexte.length) { echec('pack', `${lang} : ${phrases.length} phrase(s) au lieu de ${phrasesTexte.length} (pack incomplet : fournir --traductions)`); return null; }
  return { titres, phrases };
}

const tradLues = TRADUCTIONS ? lireTraductions(TRADUCTIONS) : new Map();
const packsComplets = new Map([['fr', { titres: titresParCase, phrases: phrasesTexte }]]);
const nomsIngredientsParLangue = new Map();
for (const lang of LANGUES) {
  if (lang === 'fr') continue;
  if (tradLues.has(lang)) {
    const p = construirePack(lang, tradLues.get(lang));
    packsComplets.set(lang, { titres: p.titres, phrases: p.phrases });
    nomsIngredientsParLangue.set(lang, p.noms);
  } else {
    const p = lirePackExistant(lang, Math.max(1, Math.ceil(N / SHARD)));
    if (p) packsComplets.set(lang, p);
  }
}
if (TOUTES_LANGUES) {
  const absentes = LANGUES.filter((l) => !packsComplets.has(l));
  if (absentes.length) echec('traduction', `langue(s) absente(s) : ${absentes.join(', ')}`);
}
finirSiProblemes();

const sorties = fichiersDuJeu(OUT_GEN, jeuComplet, packsComplets);

/* ---------------------------------------- fixture de 50 recettes ---------------------------------------- */

function choisirFixture() {
  const choix = [];
  const pris = new Set();
  const prendre = (pred) => {
    for (let c = 0; c < N; c++) {
      const r = lignesParCase[c];
      if (r && !pris.has(c) && pred(r)) { pris.add(c); choix.push(c); return true; }
    }
    return false;
  };
  for (const s of SUBS) prendre((r) => r.sub === s);
  const criteres = [
    (r) => r.tags.includes('vegan'), (r) => r.tags.includes('halal-possible') && r.course === 'plat',
    (r) => r.stepKinds && Object.values(r.stepKinds).includes('four') && r.ovenTempC > 0,
    (r) => Object.values(r.stepKinds).includes('repos'), (r) => r.lignes.some((l) => l.optional), (r) => r.groupes.length === 6,
    (r) => r.groupes.length === 3, (r) => r.scale === 2, (r) => r.ids.length === 3 && r.groupes.length === 3 && r.sub === 'petit_dejeuner',
    (r) => !r.tags.includes('sans-gluten') && !r.tags.includes('sans-lactose'), (r) => !r.tags.includes('sans-fruits-a-coque'),
    (r) => r.keepDays === 1 && r.course === 'plat', (r) => r.freezable && r.course === 'plat', (r) => r.tags.includes('batch'),
    (r) => r.tags.includes('sans-cuisson'), (r) => r.tags.includes('rapide') && r.course === 'dessert',
    (r) => r.tags.includes('enfants'), (r) => r.tags.includes('leger') && r.course === 'plat', (r) => r.tags.includes('economique'),
    (r) => r.keepDays >= 5, (r) => r.difficulty === 2, (r) => r.alg !== 0 && r.course === 'dessert', (r) => r.course === 'entree',
    (r) => r.course === 'dessert', (r) => r.lignes.length >= 14, (r) => r.ids.length >= 9, (r) => r.tags.includes('printemps'),
    (r) => r.tags.includes('hiver'), (r) => r.tags.includes('ete'),
  ];
  for (const p of criteres) if (choix.length < 50) prendre(p);
  for (let c = 0; choix.length < 50 && c < N; c += Math.max(1, Math.floor(N / 97))) if (lignesParCase[c] && !pris.has(c)) { pris.add(c); choix.push(c); }
  for (let c = 0; choix.length < 50 && c < N; c++) if (lignesParCase[c] && !pris.has(c)) { pris.add(c); choix.push(c); }
  return choix.slice(0, 50).sort((a, b) => a - b);
}
const fixtureCases = choisirFixture();
const fixtureRows = fixtureCases.map((c) => lignesParCase[c]);
const phrasesFixtureIds = [];
const remapFixture = new Map();
for (const r of fixtureRows) for (const id of r.ids) if (!remapFixture.has(id)) { remapFixture.set(id, phrasesFixtureIds.length); phrasesFixtureIds.push(id); }
const jeuFixture = construireJeu(fixtureRows, null, (id) => remapFixture.get(id));
const phrasesFixture = phrasesFixtureIds.map((id) => phrasesTexte[id]);
const packsFixture = new Map(
  [...packsComplets].map(([lang, p]) => [lang, { titres: fixtureCases.map((c) => p.titres[c]), phrases: phrasesFixtureIds.map((id) => p.phrases[id]) }])
);
const sortiesFixture = fichiersDuJeu(OUT_FIXTURE, jeuFixture, packsFixture);
finirSiProblemes();

/* -------------------------------- ingredients.json et fr.json -------------------------------- */

const aCRLF = (s) => (CRLF ? s.replace(/\n/g, '\r\n') : s);
const ingsFinal = aCRLF(JSON.stringify(INGS, null, 1));
const frFinal = { ...FR_ACTUEL, ingredients: { ...FR_ACTUEL.ingredients } };
for (const [cle, nom] of NOMS_FR_NOUVEAUX) if (frFinal.ingredients[cle] === undefined) frFinal.ingredients[cle] = nom;
else if (frFinal.ingredients[cle] !== nom) echec('fiche', `${cle} : nom francais deja present et different`);
const frTexte = aCRLF(JSON.stringify(frFinal, null, 2));
// les recettes de fr.json ne bougent pas
if (JSON.stringify(frFinal.recipes) !== JSON.stringify(FR_ACTUEL.recipes)) echec('fr', 'les recettes de fr.json ont change');
for (const cle of Object.keys(INGS)) if (!frFinal.ingredients[cle]) echec('fr', `nom francais manquant pour ${cle}`);
// Noms des nouveaux ingredients dans data/menus/i18n/<langue>.json : cle « ingredients » seulement, ordre des cles et format
// (indentation, fins de ligne, saut de ligne final) conserves ; les cles deja presentes gardent leur place.
const i18nSorties = new Map();
for (const [lang, noms] of nomsIngredientsParLangue) {
  const f = path.join(DATA, 'i18n', `${lang}.json`);
  if (!fs.existsSync(f)) { echec('i18n', `${lang}.json absent`); continue; }
  const brut = lire(f);
  const crlf = brut.includes('\r\n');
  const finLigne = /\n$/.test(brut);
  const mise = (o) => {
    let t = JSON.stringify(o, null, 2);
    if (crlf) t = t.replace(/\n/g, '\r\n');
    return t + (finLigne ? (crlf ? '\r\n' : '\n') : '');
  };
  let o;
  try { o = JSON.parse(brut); } catch (e) { echec('i18n', `${lang}.json illisible : ${e.message}`); continue; }
  if (mise(o) !== brut) { echec('i18n', `${lang}.json : format non reproductible (indentation, fins de ligne ou echappements), fichier non modifie`); continue; }
  if (!o.ingredients || typeof o.ingredients !== 'object') { echec('i18n', `${lang}.json : cle ingredients absente`); continue; }
  const ingredients = { ...o.ingredients };
  for (const k of NOUVELLES_FICHES.keys()) if (noms.has(k)) ingredients[k] = noms.get(k);
  i18nSorties.set(f, mise({ ...o, ingredients }));
}
const ecritIngs = INGS_ACTUELS_BRUT !== ingsFinal;
const ecritFr = FR_ACTUEL_BRUT !== frTexte;

const registreTexte = '{\n' + Object.entries(registreFinal).map(([k, v]) => ` ${JSON.stringify(k)}: ${v}`).join(',\n') + '\n}\n';
const registrePhrasesTexte = '[\n' + phrasesTexte.map((t) => ' ' + JSON.stringify(t)).join(',\n') + '\n]\n';
const ingredientsATraduire = [...NOUVELLES_FICHES.keys()].map((cle) => ({ cle, fr: NOMS_FR_NOUVEAUX.get(cle) }));
const aTraduire = new Map([
  [path.join(OUT_TRAD, 'titres.json'), JSON.stringify(titresParCase.map((fr, i) => ({ i, fr })), null, 1) + '\n'],
  [path.join(OUT_TRAD, 'phrases.json'), JSON.stringify(phrasesTexte.map((fr, i) => ({ i, fr })), null, 1) + '\n'],
  [path.join(OUT_TRAD, 'ingredients.json'), JSON.stringify(ingredientsATraduire, null, 1) + '\n'],
  [path.join(OUT_TRAD, 'fixture-50.json'), JSON.stringify(fixtureCases.map((c) => ({ i: c, id: idDe(c), fr: titresParCase[c] })), null, 1) + '\n'],
]);
finirSiProblemes();

/* ----------------------------------------- ecriture ----------------------------------------- */

const tous = new Map([...sorties, ...sortiesFixture, ...aTraduire]);
tous.set(REGISTRE_FICHIER, registreTexte);
tous.set(REGISTRE_PHRASES_FICHIER, registrePhrasesTexte);
tous.set(path.join(DATA, 'ingredients.json'), ingsFinal);
tous.set(path.join(DATA, 'i18n', 'fr.json'), frTexte);
for (const [f, contenu] of i18nSorties) tous.set(f, contenu);

let ecarts = 0;
let ecrits = 0;
for (const [f, contenu] of tous) {
  const existe = fs.existsSync(f);
  const identique = existe && lire(f) === contenu;
  if (CHECK) {
    if (!identique) { ecarts++; console.error(`ecart : ${path.relative(ROOT, f)}`); }
    continue;
  }
  if (identique) continue;
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, contenu);
  ecrits++;
}
// Le fichier lang de chaque bloc : un fichier de trop dans gen/ signale un build precedent plus grand
const tailles = {};
for (const [f, c] of tous) tailles[path.relative(ROOT, f).replace(/\\/g, '/')] = Buffer.byteLength(c);

/* ------------------------------------------- bilan ------------------------------------------- */

const parCourse = {};
const parSousCat = {};
const pers = {};
const nonQuatre = {};
const tagsCompte = {};
let douteN = 0;
const plages = { kcalHors: 0, coutHors: 0, tempsHors: 0 };
for (const r of recettes) {
  parCourse[r.course] = (parCourse[r.course] || 0) + 1;
  parSousCat[r.sub] = (parSousCat[r.sub] || 0) + 1;
  if (r.pers !== 4) pers[`${r.sub}:${r.pers}${r.scale === 2 ? ' (x2)' : ''}`] = (pers[`${r.sub}:${r.pers}${r.scale === 2 ? ' (x2)' : ''}`] || 0) + 1;
  for (const t of r.tags) tagsCompte[t] = (tagsCompte[t] || 0) + 1;
  if (r.douteTexte) douteN++;
  if (r.kcal < 100 || r.kcal > 1400) plages.kcalHors++;
  if (r.coutPortion < 0.2 || r.coutPortion > 20) plages.coutHors++;
  if (r.timeMin < 5 || r.timeMin > 480) plages.tempsHors++;
}
const exclusTotal = Object.values(bilan.exclusion).reduce((a, b) => a + b, 0);
const rapport = {
  mode: CHECK ? 'check' : 'ecriture',
  generees: bilan.generees,
  ecartees: { exclusion: bilan.exclusion, exclusionTotal: exclusTotal, doublonAvecLes474: bilan.doublon },
  versees: recettes.length,
  parCourse,
  parSousCategorie: parSousCat,
  etapes: hist.etapes,
  phrasesDuDictionnaire: phrasesTexte.length,
  phrasesFinalesAjoutees: ajoutsFinaux,
  couplesQuantiteUnite: jeuComplet.pairesListe.length,
  largeurLigne: jeuComplet.LINE_W,
  cases: N,
  blocs: jeuComplet.nbBlocs,
  nouvellesFiches: NOUVELLES_FICHES.size,
  ingredientsTotal: ING_KEYS.length,
  fixture: fixtureCases.length,
  langues: [...packsComplets.keys()],
  languesTraduitesCeTour: [...tradLues.keys()],
  avertissements,
  recettesNonQuatrePersonnes: pers,
  tags: tagsCompte,
  recettesAvecDouteTexte: douteN,
  horsPlages: plages,
  ecrits,
  ecartsCheck: ecarts,
  tailles,
};
fs.mkdirSync(OUT_TRAD, { recursive: true });
if (!CHECK) fs.writeFileSync(path.join(OUT_TRAD, 'rapport-build.json'), JSON.stringify(rapport, null, 1) + '\n');
console.log(JSON.stringify(rapport, null, 1));
if (CHECK && ecarts) { console.error(`ECHEC : ${ecarts} fichier(s) differents (relancer le build)`); process.exit(1); }
finirSiProblemes();
