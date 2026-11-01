// Regles des tags de regime, communes au build des recettes generees (build-menus.js), aux recettes ecrites a la main
// (data/menus/recipes.json) et au validateur (validate-menus.js). Securite alimentaire : en cas de doute, le tag est
// retire, jamais ajoute.
//
// Sources des doutes :
// - les allergenes declares par les fiches (ingredients.json) ;
// - la table des derives de lib/menus/allergens.js (DERIVES_ALLERGENE), lue dans le fichier pour rester la source unique :
//   toute modification de cette table demande de relancer le build (le --check le signale) ;
// - DOUTES_CLES ci-dessous (charcuteries, moutarde, sauces, levure, sarrasin...), qui ne concernent que les tags ;
// - les mots des etapes francaises (lexique) : un allergene ou une viande evoques sans ingredient sont un doute.
'use strict';
const fs = require('fs');
const path = require('path');

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Les 14 allergenes de l'Union europeenne (crustaces = crustaces et mollusques, fruits-a-coque = fruits a coque et
// arachide), plus miel et porc. Ordre fige : c'est l'ordre des bits de la colonne alg du catalogue genere (nouveaux a la fin).
const ALG_KEYS = ['gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'soja', 'sesame', 'fruits-a-coque', 'miel', 'porc', 'celeri', 'moutarde', 'lupin', 'sulfites'];

// Allergenes que certaines fiches doivent declarer au minimum (ingredients.json ; le build et validate-menus.js le
// controlent). Precaution : un ingredient souvent fabrique avec l'allergene le declare.
const ALLERGENES_MINIMUM = {
  'celeri-branche': ['celeri'],
  'celeri-rave': ['celeri'],
  bouillon: ['celeri'], // cubes de bouillon : celeri tres frequent
  ketchup: ['celeri'], // extraits d'epices au celeri frequents
  curry: ['celeri', 'moutarde'], // melanges d'epices : graines de moutarde et celeri frequents
  moutarde: ['moutarde', 'sulfites'],
  mayonnaise: ['moutarde'],
  'sauce-barbecue': ['moutarde'],
  cornichon: ['moutarde', 'sulfites'],
  'pate-tikka-masala': ['moutarde'],
  'pate-curry-korma': ['moutarde'],
  // farine de lupin possible dans le pain et les pates du commerce
  baguette: ['lupin'],
  'pain-campagne': ['lupin'],
  'pain-mie': ['lupin'],
  'pain-burger': ['lupin'],
  'pate-feuilletee': ['lupin'],
  'pate-brisee': ['lupin'],
  'pate-sablee': ['lupin'],
  'pate-pizza': ['lupin'],
  'vin-blanc': ['sulfites'],
  'vin-rouge': ['sulfites'],
  biere: ['sulfites'],
  cidre: ['sulfites'],
  vinaigre: ['sulfites'],
  'vinaigre-balsamique': ['sulfites'],
  'vinaigre-cidre': ['sulfites'],
  'abricot-sec': ['sulfites'],
  'raisins-secs': ['sulfites'],
  pruneau: ['sulfites'],
  'noix-coco-rapee': ['sulfites'],
  'tomate-sechee': ['sulfites'],
  capres: ['sulfites'],
  crevette: ['sulfites'],
  gambas: ['sulfites'],
  merguez: ['sulfites'],
  chipolata: ['sulfites'],
  saucisse: ['sulfites'],
  // mollusques sous « crustaces » (= crustaces et mollusques), arachide sous « fruits-a-coque » (= fruits a coque et arachide)
  calamar: ['crustaces'],
  palourde: ['crustaces'],
  'saint-jacques': ['crustaces'],
  'sauce-huitre': ['crustaces'],
  cacahuete: ['fruits-a-coque'],
  'beurre-cacahuete': ['fruits-a-coque'],
};

const REGIMES = ['vegetarien', 'vegan', 'sans-gluten', 'sans-lactose', 'sans-porc', 'halal-possible', 'sans-fruits-a-coque'];

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
  celeri: 'celeri',
  moutarde: 'moutarde',
  lupin: 'lupin',
  sulfites: 'vin vins vinaigre biere cidre',
  viande: 'viande boeuf veau agneau poulet dinde canard mouton lapin steak volaille merguez bavette magret gigot cuisse cuisses escalope escalopes cotelette cotelettes rumsteck paleron',
  alcool: 'vin biere rhum cognac whisky vodka alcool cidre calvados porto marsala kirsch liqueur',
};
const LEX_MOTS = Object.fromEntries(Object.entries(LEX).map(([k, v]) => [k, new Set(v.split(' '))]));
const LEX_EXPR = { crustaces: ['fruits de mer', 'saint jacques'] };
// Expressions qui contiennent un mot du lexique sans l'allergene (retirees avant lecture d'un texte).
const FAUX_AMIS = [
  'lait de coco', 'lait d amande', 'lait d avoine', 'noix de coco', 'noix de muscade', 'beurre de cacahuete', 'pate de curry',
  'pate a tartiner', 'noix de saint jacques', 'creme de coco', 'eau de coco', 'noix de beurre', 'nouilles de riz',
];
// Textes des etapes seulement : « moule » y est le moule a gateau (aucun ingredient « moules » n'existe), et les steaks
// des burgers sont aussi les galettes vegetales (les burgers a la viande ont leur viande dans les ingredients).
// « pate » au singulier y est une pate faite des ingredients listes (pate a crepes, pate d'epices) ; les pates
// alimentaires (« pates ») restent lues. « Une creme onctueuse » est une texture, un « boudin » une forme.
const FAUX_AMIS_TEXTE = ['steaks ou galettes', 'salade steak', 'obtenir une creme', 'une creme onctueuse', 'une creme lisse', 'former un boudin', 'en boudin', 'forme de boudin', 'forme de saucisson'];
const MOTS_IGNORES_TEXTE = new Set(['moule', 'moules', 'pate']);
// Mots d'etape expliques par un ingredient de la recette : la « farine » d'une recette a la farine de pois chiches,
// les « rillettes » d'une recette au poisson.
const MOTS_EXPLIQUES = { 'farine-pois-chiches': ['farine', 'farines'], sarrasin: ['farine', 'farines'] };
const MOTS_EXPLIQUES_ALLERGENE = { poisson: ['rillettes'] };

/** Allergenes, viande et alcool evoques par un texte : Set de cles de LEX. texte = true pour les etapes. */
function lexique(texte, { etape = false, expliques = null } = {}) {
  let t = ` ${norm(texte)} `;
  for (const f of FAUX_AMIS) t = t.split(` ${f} `).join(' ');
  if (etape) for (const f of FAUX_AMIS_TEXTE) t = t.split(` ${f} `).join(' ');
  let mots = t.split(' ').filter(Boolean);
  if (etape) mots = mots.filter((m) => !MOTS_IGNORES_TEXTE.has(m) && !(expliques && expliques.has(m)));
  const trouve = new Set();
  for (const [k, set] of Object.entries(LEX_MOTS)) {
    for (const m of mots) {
      if (set.has(m) || set.has(m.replace(/(es|s|x)$/, '')) || set.has(m.replace(/[sx]$/, ''))) { trouve.add(k); break; }
    }
    for (const e of LEX_EXPR[k] || []) if (t.includes(` ${e} `)) trouve.add(k);
  }
  return trouve;
}

/** DERIVES_ALLERGENE de lib/menus/allergens.js : { allergene: [cles] }. Echoue si la table est introuvable. */
function derivesAllergene(racine) {
  const f = path.join(racine, 'lib', 'menus', 'allergens.js');
  const src = fs.readFileSync(f, 'utf8');
  const m = /export const DERIVES_ALLERGENE = (\{[\s\S]*?\n\});/.exec(src);
  if (!m) throw new Error(`DERIVES_ALLERGENE introuvable dans ${f}`);
  // eslint-disable-next-line no-new-func
  const t = Function(`"use strict"; return (${m[1]});`)();
  if (!t || typeof t !== 'object') throw new Error('DERIVES_ALLERGENE illisible');
  return t;
}

// Doutes par cle d'ingredient (tags seulement, jamais la colonne alg ni les fiches).
const CHARCUTERIES_CLES = ['jambon-blanc', 'jambon-cru', 'lardons', 'bacon', 'chorizo', 'guanciale', 'merguez', 'saucisse', 'saucisse-fumee', 'chipolata', 'petit-sale', 'boudin-noir'];
const DOUTES_CLES = {
  gnocchi: ['oeuf'], // gnocchis du commerce souvent aux oeufs
  nouilles: ['oeuf'], // nouilles aux oeufs frequentes
  merguez: ['porc'], // composition variable
  'sauce-huitre': ['crustaces'],
  vanille: ['alcool'], // extrait de vanille alcoolise : pas de halal-possible
  levure: ['gluten'], // amidon de ble possible
  'sauce-barbecue': ['gluten'],
  moutarde: ['gluten'],
  ketchup: ['gluten'],
  sarrasin: ['gluten'], // farine de sarrasin souvent contaminee par le ble
  'pate-curry-jaune': ['gluten'],
  'pate-curry-korma': ['gluten'],
  'pate-curry-massaman': ['gluten'],
  'pate-curry-rouge': ['gluten'],
  'pate-curry-vert': ['gluten'],
  'pate-tikka-masala': ['gluten', 'fruits-a-coque'], // cajou ou amande frequents
};
for (const c of CHARCUTERIES_CLES) DOUTES_CLES[c] = [...new Set([...(DOUTES_CLES[c] || []), 'gluten', 'lait'])]; // additifs possibles
const CLES_VIANDE_DOUTE = new Set(['sauce-huitre', 'gelatine', 'nuoc-mam']); // d'origine animale sans rayon viande
const CLES_ALCOOL = new Set(['vin-blanc', 'vin-rouge', 'biere', 'cidre', 'rhum', 'vanille']);
const CLES_VEGAN_INTERDIT = new Set(['vin-blanc', 'vin-rouge', 'biere', 'cidre']); // collage au poisson ou a la gelatine possible

/** Mots d'etape que les ingredients de la recette expliquent (Set). */
function motsExpliques(cles, ings) {
  const out = new Set();
  for (const c of cles) {
    for (const m of MOTS_EXPLIQUES[c] || []) out.add(m);
    for (const a of (ings[c] && ings[c].allergens) || []) for (const m of MOTS_EXPLIQUES_ALLERGENE[a] || []) out.add(m);
  }
  return out;
}

/** Doutes d'une cle : allergenes de DOUTES_CLES et de la table des derives. */
function doutesDeCle(cle, derives) {
  const out = new Set(DOUTES_CLES[cle] || []);
  for (const [a, cles] of Object.entries(derives || {})) if (Array.isArray(cles) && cles.includes(cle)) out.add(a);
  return out;
}

/**
 * Tags de regime d'une recette. cles : cles de ses ingredients ; ings : ingredients.json ; derives : derivesAllergene() ;
 * textes : etapes francaises (doutes du lexique). Retourne { tags:Set, eff:Set (allergenes et doutes), viande, alcool, douteTexte }.
 */
function regimesDe({ cles, ings, derives, textes = [], extra = null }) {
  const eff = new Set();
  let viande = false;
  let alcool = false;
  let veganNon = false;
  for (const c of cles) {
    const f = ings[c];
    if (!f) continue;
    for (const a of f.allergens || []) eff.add(a);
    for (const a of doutesDeCle(c, derives)) eff.add(a);
    if (f.aisle === 'viandes-poissons' || CLES_VIANDE_DOUTE.has(c)) viande = true;
    if (CLES_ALCOOL.has(c)) alcool = true;
    if (CLES_VEGAN_INTERDIT.has(c)) veganNon = true;
  }
  if (extra) {
    for (const a of extra.eff || []) eff.add(a);
    if (extra.viande) viande = true;
    if (extra.alcool) alcool = true;
    if (extra.veganNon) veganNon = true;
  }
  if (eff.has('alcool')) { alcool = true; eff.delete('alcool'); }
  const expliques = motsExpliques(cles, ings);
  let douteTexte = false;
  for (const t of textes) {
    for (const k of lexique(t, { etape: true, expliques })) {
      if (k === 'viande') { if (!viande) { viande = true; douteTexte = true; } continue; }
      if (k === 'alcool') { if (!alcool) { alcool = true; douteTexte = true; } continue; }
      if (!eff.has(k)) { eff.add(k); douteTexte = true; }
    }
  }
  const marin = eff.has('poisson') || eff.has('crustaces');
  const tags = new Set();
  if (!viande && !marin && !eff.has('porc')) tags.add('vegetarien');
  if (tags.has('vegetarien') && !eff.has('lait') && !eff.has('oeuf') && !eff.has('miel') && !alcool && !veganNon) tags.add('vegan');
  if (!eff.has('gluten')) tags.add('sans-gluten');
  if (!eff.has('lait')) tags.add('sans-lactose');
  if (!eff.has('porc')) tags.add('sans-porc');
  if (tags.has('sans-porc') && !alcool) tags.add('halal-possible');
  if (!eff.has('fruits-a-coque')) tags.add('sans-fruits-a-coque');
  return { tags, eff, viande: viande || marin, alcool, douteTexte };
}

module.exports = {
  norm, ALG_KEYS, ALLERGENES_MINIMUM, REGIMES, LEX, LEX_MOTS, LEX_EXPR, FAUX_AMIS, lexique, derivesAllergene, DOUTES_CLES, CHARCUTERIES_CLES,
  CLES_VIANDE_DOUTE, CLES_ALCOOL, CLES_VEGAN_INTERDIT, doutesDeCle, motsExpliques, regimesDe,
};
