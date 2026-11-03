// Repères « équilibré, rapide, plein de légumes, cuisines du monde » pour la recherche et le planning.
// Module pur, aucun réglage actif par défaut. Deux chemins :
//  - recette objet (474 écrites à la main, recettes personnelles, recette générée matérialisée) : fonctions
//    vegGrams / isBalanced / cuisineOf / isFried / isSide / isQuick, résultat mis en cache par objet ;
//  - catalogue généré : colonnes calculées une seule fois, au premier usage (genHealth), sans créer d'objet
//    recette (Uint16Array de grammes de légumes par portion, Uint8Array de cuisine, Uint8Array de drapeaux).
import { norm, normBlob, estObjet, arr } from './util';
import { readInt } from './b64';
import { getCore, loadBlock, rowFromId, isGeneratedId } from './catalog';
import { loadTitleBlock, titleBlockText } from './packs';

/* ------------------------------------------ constantes ------------------------------------------ */

export const CUISINES = [
  'asie',
  'inde',
  'maghreb-orient',
  'italie',
  'espagne-portugal',
  'grece',
  'france',
  'ameriques',
  'afrique',
];
/** Seuils de isBalanced (par portion). */
export const BALANCED = { minVeg: 100, minProtein: 20, minKcal: 400, maxKcal: 750 };
/** Seuil conseillé pour « plein de légumes » (grammes par portion). */
export const PLENTY_VEG = 150;
/** Seuil par défaut de isQuick (minutes). */
export const QUICK_MAX = 20;

// Rayon fruits-legumes qui ne compte pas comme légume : fruits, herbes et aromates, oignons, féculent.
const NOT_VEG = new Set(
  (
    'citron citron-vert avocat pomme poire banane orange fraise mangue ananas abricot cerise coing figue ' +
    'framboise fruit-passion kiwi melon mure myrtille nectarine pamplemousse pasteque peche prune raisin rhubarbe ' +
    'persil coriandre basilic menthe ciboulette gingembre aneth citronnelle estragon-frais romarin sauge thym-frais ' +
    'piment-frais ail echalote oignon oignon-rouge oignon-nouveau pomme-de-terre'
  ).split(' ')
);
// Légumes hors rayon frais : surgelés et conserves.
const EXTRA_VEG = new Set(
  'petits-pois epinard-surgele poelee-legumes tomate-concassee coulis-tomate coeur-artichaut tomate-sechee mais'.split(
    ' '
  )
);
// Poids moyen d'une pièce (unité « u »), en grammes ; 100 g sinon.
export const PIECE_G = {
  tomate: 120,
  courgette: 250,
  poivron: 150,
  aubergine: 300,
  carotte: 100,
  concombre: 300,
  salade: 250,
  brocoli: 400,
  'chou-fleur': 800,
  chou: 1000,
  'chou-vert': 1000,
  'chou-rouge': 1000,
  'chou-chinois': 800,
  poireau: 150,
  endive: 100,
  fenouil: 250,
  artichaut: 300,
  betterave: 150,
  'celeri-branche': 40,
  'celeri-rave': 600,
  'pak-choi': 150,
  potimarron: 1000,
  courge: 1200,
  potiron: 1500,
  champignon: 20,
  shiitake: 15,
  radis: 15,
  navet: 150,
  panais: 200,
  'patate-douce': 300,
  'tomate-cerise': 15,
  'haricot-vert': 100,
  epinard: 100,
  cresson: 100,
  roquette: 100,
  'asperge-verte': 20,
  'coeur-artichaut': 50,
  'chou-bruxelles': 15,
};

let defaultIngs = null;
function ingDb(ingredients) {
  if (estObjet(ingredients)) return ingredients;
  if (!defaultIngs) {
    try {
      defaultIngs = require('../../data/menus/ingredients.json');
    } catch {
      defaultIngs = {};
    }
    if (!estObjet(defaultIngs)) defaultIngs = {};
  }
  return defaultIngs;
}

/** La clé d'ingrédient compte-t-elle comme légume ? */
export function isVegKey(key, ingredients) {
  if (EXTRA_VEG.has(key)) return true;
  if (NOT_VEG.has(key)) return false;
  const ing = ingDb(ingredients)[key];
  return !!(ing && ing.aisle === 'fruits-legumes');
}

/** Grammes d'une ligne { qty, unit } d'un légume. */
function lineGrams(key, qty, unit) {
  const q = Number(qty) || 0;
  if (unit === 'g' || unit === 'ml') return q;
  if (unit === 'u') return q * (PIECE_G[key] || 100);
  if (unit === 'cs') return q * 15;
  if (unit === 'cc') return q * 5;
  return 0;
}

/* --------------------------------------- règles de titre --------------------------------------- */

// Friture : mots du titre normalisé ; « au four » (frites au four, samoussas au four) l'annule.
const FRIED_WORDS =
  'frit|frite|frites|frits|beignet|beignets|tempura|pane|panes|panee|panees|nuggets|croquetas|accras|friture|churros|samoussa|samoussas|samosa|samosas|pakora|pakoras|falafel|falafels|nems|tonkatsu|katsu|fish and chips|donut|donuts|chips';

// Plats plaisir reconnus au titre (les recettes générées n'ont pas d'identifiant lisible).
const TREAT_WORDS =
  'burger|burgers|cheeseburger|cheeseburgers|kebab|kebabs|tacos|croque|hot dog|hot dogs|poutine|tartiflette|raclette|fondue';

// Cuisines : adjectifs et noms de pays (priorité), plats signature, ingrédients signature, indices faibles.
// Une recette qui cumule deux cuisines au même niveau est laissée sans cuisine (mieux vaut rien qu'un faux classement).
const RULES = {
  asie: {
    adj: 'thai|thais|thaie|thailandais|thailandaise|japonais|japonaise|japon|coreen|coreenne|coree|vietnamien|vietnamienne|chinois|chinoise|cantonais|cantonaise|indonesien|indonesienne|philippin|philippine|cambodgien|cambodgienne|malais|malaisienne|singapourien|laotien|laotienne|asiatique|szechuan|sichuan|sichuanais',
    dish: 'teriyaki|oyakodon|congee|tamagoyaki|gong bao|kung pao|che|ramen|pad thai|bibimbap|bo bun|banh mi|sushis?|makis?|wok|pho|gyozas?|yakitori|miso|laksa|nasi goreng|satay|sate|adobo|kimchi|udon|soba|dumplings?|nems?|loc lac|donburi|okonomiyaki|bulgogi|mapo|larb|tom yum|tom kha|massaman|curry vert|curry rouge|curry jaune|nouilles sautees|riz cantonais|porc au caramel|canard laque|general tao|tataki|onigiri|tteokbokki|japchae|yakisoba|katsu|tonkatsu|dashi|rouleaux de printemps|gado gado|rendang|char siu|bao|baos|dim sum',
    ing: [
      'nuoc-mam',
      'pate-curry-rouge',
      'pate-curry-vert',
      'pate-curry-jaune',
      'pate-curry-massaman',
      'sauce-huitre',
      'pak-choi',
      'citronnelle',
    ],
    weakTitle: 'nouilles|shiitake',
    weakMin: 4,
    weakIng: [
      'nouilles-riz',
      'galette-riz',
      ['sauce-soja', 'tamari', 'huile-sesame', 'sesame'],
      'gingembre',
      'tofu',
      'shiitake',
      'chou-chinois',
      'germes-soja',
      'nouilles',
      'lait-coco',
    ],
  },
  inde: {
    adj: 'indien|indienne|inde|pakistanais|pakistanaise|sri lankais|bengali|cachemire|kerala|goa',
    dish: 'tikka|shrikhand|keema|aloo gobi|gajar halwa|dal|dahl|dhal|biryani|masala|naan|korma|vindaloo|tandoori|paneer|samosas?|samoussas?|pakoras?|chana|aloo|raita|lassi|bhaji|bhajis|madras|kitchari|khichdi|butter chicken|chutney|palak|saag|jalfrezi|rogan josh|dosa|chapati|parathas?|pulao',
    ing: ['garam-masala', 'pate-tikka-masala', 'pate-curry-korma'],
    weakTitle: 'curry|curcuma|lentilles corail',
    weakIng: [
      'curry',
      'curcuma',
      'cumin',
      'lentilles-corail',
      'riz-basmati',
      'lait-coco',
      'gingembre',
      'coriandre',
    ],
  },
  'maghreb-orient': {
    adj: 'libanais|libanaise|liban|marocain|marocaine|maroc|tunisien|tunisienne|algerien|algerienne|oriental|orientale|orientaux|persan|persane|iranien|iranienne|turc|turque|syrien|syrienne|egyptien|egyptienne|israelien|maghrebin|maghrebine|berbere|ottoman',
    dish: 'tajine|tajines|couscous|mechouia|zaalouk|mouhammara|mouhalabieh|ghribas?|makloubeh|maqluba|sayadieh|foul medames|chermoula|chakchouka|shakshuka|falafels?|houmous|hummus|taboule|fattouch|kefta|keftas|kofta|koftas|chich taouk|shawarma|harira|mechoui|pastilla|baba ganoush|mezze|mezzes|labneh|kibbeh|msemen|makrouds?|baklavas?|dukkah|chorba|mloukhia|bricks?|zaatar|ras el hanout|merguez|mujaddara|moutabal|manakish|fatayer|lahmacun|kebab|kebabs|halva|loukoum|cornes de gazelle|mhancha|seffa|rfissa|tchoutchouka|loubia|kesra',
    ing: ['ras-el-hanout', 'harissa', 'zaatar', 'tahini', 'merguez'],
    weakTitle: 'pois chiches|fleur d oranger|cumin',
    weakIng: [
      'pois-chiches',
      'semoule',
      'eau-fleur-oranger',
      'cumin',
      'feuille-brick',
      'pain-pita',
      'datte',
      'menthe',
      'cannelle',
      'boulgour',
    ],
  },
  italie: {
    adj: 'italien|italienne|italiens|italiennes|italie|sicilien|sicilienne|toscan|toscane|napolitain|napolitaine|milanaise|venitien|venitienne|piemontais|sarde',
    dish: 'risotto|risottos|pizza|pizzas|lasagne|lasagnes|carbonara|bolognaise|gnocchi|gnocchis|osso buco|ossobuco|arancini|parmesane|batonnets de polenta|batons de polenta|tomates mozzarella|tomate mozzarella|tiramisu|pesto|minestrone|panna cotta|piccata|saltimbocca|focaccia|bruschetta|bruschettas|caponata|parmigiana|cannelloni|cannellonis|amatriciana|arrabbiata|cacio e pepe|vitello tonnato|calzone|frittata|panzanella|carpaccio de boeuf|carpaccio de veau|carpaccio de bresaola|ravioli|raviolis|alla norma|puttanesca|burrata|stracciatella|antipasti|crostini|piadina|affogato|cantucci|biscotti|scaloppine|tortellini|tortelloni|conchiglie|cannoli|zabaglione|pasta e fagioli|ribollita|aglio e olio|puttanesca|vongole|saltimbocca|caprese|gremolata|semifreddo',
    // formes de pâtes : seulement en tête du titre (« Côtes de porc au curry, tagliatelles » n'est pas italien)
    lead: 'orecchiette|linguine|tagliatelle|tagliatelles|spaghetti|spaghettis|penne|fusilli|farfalle|rigatoni|pappardelle|conchiglie|polenta|pasta',
    ing: [
      'riz-arborio',
      'pesto',
      'guanciale',
      'pate-pizza',
      'pates-lasagne',
      'gnocchi',
      'burrata',
      'pecorino',
      'pesto-rosso',
      'gorgonzola',
    ],
    weakTitle: 'mozzarella|parmesan|ricotta|mascarpone|basilic',
    // 4 indices : « mozzarella » au titre et en ingrédient comptent deux fois, une salade de roquette à la
    // mozzarella, avocat et maïs n'est pas italienne pour autant
    weakMin: 4,
    weakIng: [
      'mozzarella',
      'parmesan',
      'ricotta',
      'mascarpone',
      'basilic',
      'vinaigre-balsamique',
      'pignons-de-pin',
      'roquette',
      'jambon-cru',
      'polenta',
    ],
  },
  'espagne-portugal': {
    adj: 'espagnol|espagnole|espagnols|espagnoles|espagne|portugais|portugaise|portugal|catalan|catalane|andalou|andalouse|galicien|galicienne|extremegne|extremegnes',
    dish: 'paella|ajillo|fabada|cocido|adobado|pil pil|escabeche|arroz|paellas|gaspacho|gazpacho|croquetas|tapas|patatas bravas|bravas|bacalhau|pasteis|pastel de nata|churros|salmorejo|pisto|tortilla espagnole|tortilla de patatas|tortilla de pommes de terre|crema catalana|pan con tomate|pimientos|fideua|migas|caldo verde|bifana|piri piri|calamars a la romaine|albondigas|escalivada|turron|polvo',
    ing: [],
    weakTitle: 'chorizo|manchego|piment d espelette',
    weakIng: ['chorizo', 'paprika', 'jambon-cru'],
  },
  grece: {
    adj: 'grecque|grecs|grecques|grece|chypriote|cretois|cretoise',
    dish: 'moussaka|tzatziki|souvlaki|souvlakis|spanakopita|gyros|horiatiki|dolmas|dolmades|keftedes|pastitsio|tarama|taramasalata|tiropita|gemista|fasolada|stifado|kleftiko|loukoumades|briam|horta|avgolemono|kolokithokeftedes|saganaki|baklava grec',
    ing: [],
    weakTitle: 'feta|halloumi|olives|origan',
    weakMin: 4,
    weakIng: ['feta', 'halloumi', 'olives', 'origan', 'yaourt-grec', 'concombre'],
  },
  france: {
    adj: 'francais|francaise|provencal|provencale|provencales|normand|normande|savoyard|savoyarde|breton|bretonne|nicois|nicoise|basquaise|alsacien|alsacienne|lyonnais|lyonnaise|bourguignon|bourguignonne|auvergnat|auvergnate|lorrain|lorraine|landais|landaise|perigourdin|perigourdine|marseillais|marseillaise|dijonnais|forestiere|parisienne|parisien|champenois|vendeenne|ardechoise|cevenole|corse|chasseur|meuniere|mariniere|marinieres|dauphinois|dauphinoise|bearnaise|nantaise|bordelaise|toulousaine|niortaise|vosgienne|picarde|ch ti|chti',
    dish: 'blanquette|meurette|marengo|cotriade|ratatouille|pot au feu|croque monsieur|croque madame|tartiflette|raclette|choucroute|cassoulet|parmentier|navarin|bouillabaisse|tarte tatin|crepe|crepes|galette de sarrasin|galettes de sarrasin|clafoutis|far breton|madeleine|madeleines|financier|financiers|potee|daube|pistou|aioli|tapenade|pissaladiere|socca|flamiche|aligot|truffade|garbure|piperade|poule au pot|coq au vin|boeuf mode|vichyssoise|soupe a l oignon|endives au jambon|gougeres|mouclade|brandade|croziflette|fondue savoyarde|petit sale|kouign amann|paris brest|eclair|eclairs|profiteroles|mille feuille|creme brulee|ile flottante|quenelle|quenelles|andouillette|confit de canard|bouchees a la reine|vol au vent|baeckeoffe|flammekueche|tarte flambee|kig ha farz|hachis parmentier|oeufs meurette|gratin dauphinois|quiche lorraine|tarte au maroilles|welsh|carbonade|potjevleesch|salade lyonnaise|salade nicoise|soupe au pistou|pan bagnat|tian|tielle|rouille|bourride|pommes sarladaises|pommes boulangere|canneles|cannele|tarte bourdaloue|pithiviers|galette des rois|kougelhopf|bredele|religieuse|saint honore|mont blanc|charlotte|fraisier|tuiles',
    ing: [],
    weakTitle: '',
    weakIng: [],
  },
  ameriques: {
    adj: 'mexicain|mexicaine|mexicains|mexicaines|mexique|bresilien|bresilienne|bresil|peruvien|peruvienne|perou|argentin|argentine|colombien|colombienne|antillais|antillaise|antilles|creole|creoles|cubain|cubaine|jamaicain|jamaicaine|venezuelien|venezuelienne|chilien|chilienne|americain|americaine|americains|canadien|canadienne|cajun|tex mex|texan|texane|californien|californienne|new yorkais|louisianais|haitien|haitienne|caribeen|caribeenne|guadeloupeen|martiniquais|latino',
    dish: 'chili con carne|sopa de tortilla|esquites|cochinita pibil|tinga|chili sin carne|fajita|fajitas|taco|tacos|burrito|burritos|quesadilla|quesadillas|guacamole|enchilada|enchiladas|nachos|ceviche|empanada|empanadas|colombo|accras|chimichurri|feijoada|arepa|arepas|jerk|burger|burgers|cheeseburger|bbq|barbecue|cheesecake|brownie|brownies|cookie|cookies|pancake|pancakes|bagel|bagels|hot dog|hot dogs|mac and cheese|mac n cheese|coleslaw|muffin|muffins|pulled pork|poutine|donut|donuts|club sandwich|caesar|cesar|cornbread|chowder|gumbo|jambalaya|key lime|banana bread|carrot cake|sloppy joe|pico de gallo|mole|pozole|tamal|tamales|elote|bokit|blaff|ti punch|sauce chien|picadillo|tostadas?|chilaquiles|huevos rancheros|frijoles|pao de queijo|brigadeiro|dulce de leche|alfajores|lomo saltado|causa|ropa vieja|moqueca|waffles|french toast|pie|pecan pie|pumpkin pie|crab cake|buffalo|ranch',
    ing: ['pain-burger', 'sauce-barbecue'],
    weakTitle: 'tortilla|tortillas|haricots rouges|mais|avocat|wrap',
    weakMin: 4,
    weakIng: ['tortilla', 'haricots-rouges', 'avocat', 'mais', 'cheddar', 'piment', 'sirop-erable'],
  },
  afrique: {
    adj: 'africain|africaine|africains|senegalais|senegalaise|ethiopien|ethiopienne|nigerian|nigeriane|camerounais|camerounaise|ivoirien|ivoirienne|malgache|cap verdien|kenyan|ghaneen|sud africain|sud africaine|congolais|congolaise|malien|malienne|beninois|togolais|burkinabe|guineen|guineenne|erythreen|mauricien|mauricienne',
    dish: 'mafe|maffe|yassa|attieke|ndole|misir wat|wat|poulet dg|alloco|thieboudienne|thiep|tieb|jollof|romazava|bobotie|cachupa|chakalaka|fonio|foutou|moambe|saka saka|pondu|egusi|suya|injera|kedjenou|bissap|gombo|fufu|plantain|plantains',
    ing: [],
    weakTitle: 'arachide|cacahuete|patate douce|banane plantain',
    weakIng: ['beurre-cacahuete', 'cacahuete', 'patate-douce', 'piment', 'gingembre'],
  },
};

// Indices faibles (titre + ingrédients) requis pour classer sans adjectif, plat ni ingrédient signature.
const WEAK_MIN = 3;

const clean = (str) =>
  String(str || '')
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)
    .join('|');

// Compilation : un dictionnaire expression -> bits (adjectif, plat, indice faible par cuisine ; friture, « au four »,
// tête de titre). Un titre est lu mot par mot (une recherche par mot, plus les expressions de plusieurs mots qui
// commencent par ce mot) : 11 581 titres en quelques millisecondes, sans expression régulière géante.
const K_ADJ = 0;
const K_DISH = 1;
const K_WEAK = 2;
const K_LEAD = 3;
const PHRASES = new Map(); // expression -> Uint16Array(5) : bits adj, dish, weak, lead par cuisine ; [4] drapeaux
const P_FRIED = 1;
const P_OVEN = 2;
const P_TREAT = 4; // plat plaisir par le titre (burger, kebab, tacos, croque...)
const P_PREFIX = 8; // début (1 à n-1 mots) d'une expression de plusieurs mots
function entry(key) {
  let e = PHRASES.get(key);
  if (!e) {
    e = new Uint16Array(5);
    PHRASES.set(key, e);
  }
  return e;
}
function addPhrase(ph, slot, bits) {
  const key = ph.trim().replace(/\s+/g, ' ');
  if (!key) return;
  entry(key)[slot] |= bits;
  const parts = key.split(' ');
  for (let i = 1; i < parts.length; i++) entry(parts.slice(0, i).join(' '))[4] |= P_PREFIX;
}
// « sushis? » : avec et sans s ; plural : ajoute aussi la forme en s.
function addList(str, slot, bits, plural) {
  for (const raw of clean(str).split('|')) {
    const forms = raw.endsWith('s?') ? [raw.slice(0, -2), raw.slice(0, -1)] : [raw];
    for (const f of forms) {
      addPhrase(f, slot, bits);
      if (plural && !f.endsWith('s')) addPhrase(f + 's', slot, bits);
    }
  }
}
CUISINES.forEach((name, k) => {
  const r = RULES[name];
  addList(r.adj, K_ADJ, 1 << k, true);
  addList(r.dish, K_DISH, 1 << k, true);
  addList(r.weakTitle, K_WEAK, 1 << k, false);
  addList(r.lead, K_LEAD, 1 << k, false);
});
addList(FRIED_WORDS, 4, P_FRIED, false);
addPhrase('au four', 4, P_OVEN);
addList(TREAT_WORDS, 4, P_TREAT, false);
addList('bowl|bowls|buddha bowl|buddha bowls', K_LEAD, 0, false);
const BOWL_LEAD = new Set(['bowl', 'bowls', 'buddha']);

const SIG = CUISINES.map((name) => RULES[name].ing);
// Un groupe d'indices faibles compte une seule fois (sauce soja, tamari, sésame : un seul indice).
const WEAK_ING = CUISINES.map((name) =>
  RULES[name].weakIng.map((x) => (Array.isArray(x) ? x : [x]))
);
const WEAK_NEED = CUISINES.map((name) => RULES[name].weakMin || WEAK_MIN);
// clé d'ingrédient -> numéros de groupes faibles (cuisine * 16 + groupe)
const WEAK_GROUPS = new Map();
WEAK_ING.forEach((groups, k) =>
  groups.forEach((g, gi) => {
    for (const key of g) {
      const l = WEAK_GROUPS.get(key) || [];
      l.push(k * 16 + gi);
      WEAK_GROUPS.set(key, l);
    }
  })
);
const weakSeen = new Uint8Array(CUISINES.length * 16);
const weakCount = new Uint8Array(CUISINES.length);
/** Compte, par cuisine, les groupes d'indices faibles présents parmi des clés (itérable) ; résultat dans weakCount. */
function countWeak(keys) {
  weakCount.fill(0);
  const touched = [];
  for (const key of keys) {
    const l = WEAK_GROUPS.get(key);
    if (!l) continue;
    for (const id of l)
      if (!weakSeen[id]) {
        weakSeen[id] = 1;
        touched.push(id);
        weakCount[id >> 4]++;
      }
  }
  for (const id of touched) weakSeen[id] = 0;
  return weakCount;
}

// Résultat de la lecture d'un titre, réutilisé (aucun objet par titre).
const TB = { adj: 0, dish: 0, weak: 0, fried: false, bowl: false };

/** Lit un titre normalisé (mots séparés par une espace) et remplit TB. */
function readTitle(t) {
  let adj = 0;
  let dish = 0;
  let weak = 0;
  let fr = 0;
  const words = t.split(' ');
  const n = words.length;
  TB.bowl = BOWL_LEAD.has(words[0]) && (words[0] !== 'buddha' || /^bowls?$/.test(words[1] || ''));
  for (let i = 0; i < n; i++) {
    let e = PHRASES.get(words[i]);
    if (e === undefined) continue;
    adj |= e[K_ADJ];
    dish |= e[K_DISH] | (i === 0 ? e[K_LEAD] : 0);
    weak |= e[K_WEAK];
    fr |= e[4];
    if (!(e[4] & P_PREFIX)) continue;
    let ph = words[i];
    for (let j = i + 1; j < n; j++) {
      ph += ' ' + words[j];
      e = PHRASES.get(ph);
      if (e === undefined) break;
      adj |= e[K_ADJ];
      dish |= e[K_DISH] | (i === 0 ? e[K_LEAD] : 0);
      weak |= e[K_WEAK];
      fr |= e[4];
      if (!(e[4] & P_PREFIX)) break;
    }
  }
  TB.adj = adj;
  TB.dish = dish;
  TB.weak = weak;
  TB.fried = (fr & P_FRIED) !== 0 && (fr & P_OVEN) === 0;
  TB.treat = (fr & P_TREAT) !== 0;
  return TB;
}

/** Une seule cuisine : son indice ; aucune : -1 ; plusieurs : -2. */
const onlyOne = (bits) =>
  bits === 0 ? -1 : (bits & (bits - 1)) === 0 ? 31 - Math.clz32(bits) : -2;

/**
 * Cuisine (indice dans CUISINES) d'un titre déjà normalisé et d'un ensemble de clés d'ingrédients (has(clé)),
 * ou -1. Niveaux : adjectif ou pays, plat signature, ingrédient signature, puis des indices faibles (3, ou 4
 * pour l'Asie, la Grèce et les Amériques). Deux cuisines au même niveau : -1 (fusion, laissée sans cuisine).
 * sig : bits des cuisines dont un ingrédient signature est présent, s'ils sont déjà connus (catalogue généré).
 */
function cuisineIndex(t, keys, sig = -1, counts = null) {
  const r = readTitle(t);
  let s0 = sig;
  if (s0 < 0) {
    s0 = 0;
    for (let i = 0; i < SIG.length; i++) if (SIG[i].some((k) => keys.has(k))) s0 |= 1 << i;
  }
  return decide(r.adj, r.dish, r.bowl, s0, r.weak, counts || countWeak(keys));
}

/** Décision à partir des bits de titre déjà connus (adjectifs, plats, bol, indices faibles) et des ingrédients. */
function decide(adj, dish, bowl, sig, wt, counts) {
  let k = onlyOne(adj);
  if (k !== -1) return k >= 0 ? k : -1;
  k = onlyOne(dish);
  if (k !== -1) return k >= 0 ? k : -1;
  // Bols composés : mélanges libres, classés seulement par leur nom (adjectif ou plat signature).
  if (bowl) return -1;
  k = onlyOne(sig);
  if (k !== -1) return k >= 0 ? k : -1;
  let best = -1;
  let bestN = 0;
  let tie = false;
  for (let i = 0; i < CUISINES.length; i++) {
    const n = ((wt >> i) & 1) + counts[i];
    if (n < WEAK_NEED[i]) continue;
    if (n > bestN) {
      best = i;
      bestN = n;
      tie = false;
    } else if (n === bestN) tie = true;
  }
  return best >= 0 && !tie ? best : -1;
}

const friedTitle = (t) => readTitle(t).fried;
const treatTitle = (t) => readTitle(t).treat === true;

/* ------------------------------------- recettes objets ------------------------------------- */

let frPack = null;
function frTitleOfLegacy(r) {
  if (typeof r.title === 'string' && r.title) return r.title;
  if (frPack === null) {
    try {
      const p = require('../../data/menus/i18n/fr.json');
      frPack = estObjet(p) && estObjet(p.recipes) ? p.recipes : {};
    } catch {
      frPack = {};
    }
  }
  const e = frPack[r.id];
  return (e && typeof e.title === 'string' && e.title) || '';
}

/** Ligne de colonne d'une recette générée (objet matérialisé ou identifiant), sinon -1. */
function genRowOf(recipe) {
  if (!recipe || !isGeneratedId(recipe.id)) return -1;
  const row = rowFromId(recipe.id);
  return Number.isInteger(row) ? row : -1;
}

/** Grammes de légumes par portion (lignes facultatives non comptées). */
export function vegGrams(recipe, ingredients) {
  if (!estObjet(recipe)) return 0;
  let g = 0;
  for (const l of arr(recipe.ingredients)) {
    if (!estObjet(l) || !l.key || l.optional) continue;
    if (isVegKey(l.key, ingredients)) g += lineGrams(l.key, l.qty, l.unit);
  }
  const serv = Number(recipe.servings) > 0 ? Number(recipe.servings) : 4;
  return Math.round(g / serv);
}

/** Accompagnement (catalogue généré : sous-catégorie accompagnements ; recette marquée side). */
export function isSide(recipe) {
  return !!(estObjet(recipe) && (recipe.sub === 'accompagnements' || recipe.side === true));
}

/** Friture, d'après le titre français (frTitle, sinon titre connu de la recette). */
export function isFried(recipe, frTitle) {
  if (!estObjet(recipe)) return false;
  if (frTitle === undefined) {
    const row = genRowOf(recipe);
    if (row >= 0) {
      const h = genHealth();
      if (h) return (h.flags[row] & FLAG_FRIED) !== 0;
    }
  }
  const t = norm(frTitle !== undefined ? frTitle : frTitleOfLegacy(recipe));
  return friedTitle(t);
}

/** Plat plaisir d'après le titre français (burger, kebab, tacos, croque...). */
export function isTreatTitle(recipe, frTitle) {
  if (!estObjet(recipe)) return false;
  if (frTitle === undefined) {
    const row = genRowOf(recipe);
    if (row >= 0) {
      const h = genHealth();
      if (h) return (h.flags[row] & FLAG_TREAT) !== 0;
    }
  }
  return treatTitle(norm(frTitle !== undefined ? frTitle : frTitleOfLegacy(recipe)));
}

/** Recette prête en max minutes ou moins (timeMin connu). */
export function isQuick(recipe, max = QUICK_MAX) {
  const t = estObjet(recipe) ? Number(recipe.timeMin) : NaN;
  return t > 0 && t <= max;
}

/**
 * Plat équilibré : au moins 100 g de légumes et 20 g de protéines par portion, 400 à 750 kcal, sans friture.
 * Toujours faux pour un dessert, un petit-déjeuner ou un accompagnement.
 */
export function isBalanced(recipe, ingredients, frTitle) {
  if (!estObjet(recipe)) return false;
  if (recipe.course === 'dessert' || recipe.course === 'petit-dejeuner' || isSide(recipe))
    return false;
  const k = Number(recipe.kcal);
  if (!(Number(recipe.protein) >= BALANCED.minProtein)) return false;
  if (!(k >= BALANCED.minKcal && k <= BALANCED.maxKcal)) return false;
  if (vegGrams(recipe, ingredients) < BALANCED.minVeg) return false;
  return !isFried(recipe, frTitle);
}

/**
 * Cuisine du monde d'une recette : une valeur de CUISINES ou null.
 * frTitle : titre français ; à défaut, titre de la recette personnelle, du pack français (474) ou de la colonne
 * calculée (recette générée).
 */
export function cuisineOf(recipe, frTitle) {
  if (!estObjet(recipe)) return null;
  if (frTitle === undefined) {
    const row = genRowOf(recipe);
    if (row >= 0) {
      const h = genHealth();
      if (h) return h.cuisine[row] ? CUISINES[h.cuisine[row] - 1] : null;
    }
  }
  const t = norm(frTitle !== undefined ? frTitle : frTitleOfLegacy(recipe));
  const keys = new Set();
  for (const l of arr(recipe.ingredients)) if (estObjet(l) && l.key && !l.optional) keys.add(l.key);
  const k = cuisineIndex(t, keys);
  return k >= 0 ? CUISINES[k] : null;
}

// Cache par objet recette (474 et personnelles) : { veg, balanced, cuisine }.
let objCache = new WeakMap();
let objCacheIngs = null;

/** Repères d'une recette objet, mis en cache : { veg, balanced, cuisine, fried, side, quick }. */
export function healthOf(recipe, ingredients) {
  if (!estObjet(recipe)) return null;
  if (objCacheIngs !== (ingredients || null)) {
    objCache = new WeakMap();
    objCacheIngs = ingredients || null;
  }
  let h = objCache.get(recipe);
  if (!h) {
    h = {
      veg: vegGrams(recipe, ingredients),
      balanced: isBalanced(recipe, ingredients),
      cuisine: cuisineOf(recipe),
      fried: isFried(recipe),
      side: isSide(recipe),
      quick: isQuick(recipe),
    };
    objCache.set(recipe, h);
  }
  return h;
}

/** Filtres santé actifs dans un objet de filtres ({ balanced, minVeg, cuisine }) ? */
export function hasHealthFilters(f) {
  return !!(estObjet(f) && (f.balanced || Number(f.minVeg) > 0 || f.cuisine));
}

/** La recette objet passe-t-elle les filtres { balanced, minVeg, cuisine } ? Vrai si aucun n'est donné. */
export function matchHealth(recipe, f, ingredients) {
  if (!hasHealthFilters(f)) return true;
  if (f.cuisine && !CUISINES.includes(f.cuisine)) return false;
  const row = genRowOf(recipe);
  if (row >= 0) {
    const h = genHealth();
    if (h) return genPasses(h, row, f);
  }
  const h = healthOf(recipe, ingredients);
  if (f.balanced && !h.balanced) return false;
  if (Number(f.minVeg) > 0 && h.veg < Number(f.minVeg)) return false;
  if (f.cuisine && h.cuisine !== f.cuisine) return false;
  return true;
}

/* ------------------------------------- catalogue généré ------------------------------------- */

export const FLAG_FRIED = 1;
export const FLAG_SIDE = 2;
export const FLAG_BALANCED = 4;
export const FLAG_NO_TITLE = 8; // titre français illisible : cuisine et friture inconnues
export const FLAG_TREAT = 16; // plat plaisir d'après le titre

let genCache = null; // { core, veg:Uint16Array, cuisine:Uint8Array, flags:Uint8Array, ms }

/** Vide les caches (tests, changement de source). */
export function resetHealthCache() {
  genCache = null;
  objCache = new WeakMap();
  objCacheIngs = null;
}

/**
 * Colonnes santé du catalogue généré, calculées au premier appel puis gardées tant que le noyau ne change pas :
 * { veg:Uint16Array (g de légumes par portion), cuisine:Uint8Array (0 aucune, sinon indice CUISINES + 1),
 *   flags:Uint8Array (FLAG_FRIED, FLAG_SIDE, FLAG_BALANCED, FLAG_NO_TITLE), ms } ; null si catalogue indisponible.
 * Aucun objet recette créé : lignes lues dans les blocs, titres français normalisés bloc par bloc.
 */
export function genHealth(ingredients) {
  const c = getCore();
  if (!c || c.status !== 'ready') return null;
  if (genCache && genCache.core === c) return genCache;
  const t0 = Date.now();
  const b = healthBuilder(c, ingredients);
  for (let k = 0; k < c.nBlocks; k++) b.block(k);
  genCache = b.result(Date.now() - t0);
  return genCache;
}

/**
 * Comme genHealth, un bloc de 2048 cases par tranche : yieldFn() est attendu entre deux blocs (rend la main à
 * l'interface). À lancer après le chargement des données, pour que le premier filtre touché réponde tout de suite.
 */
export async function genHealthAsync(ingredients, { yieldFn, cancelled } = {}) {
  const c = getCore();
  if (!c || c.status !== 'ready') return null;
  if (genCache && genCache.core === c) return genCache;
  let spent = 0;
  const b = healthBuilder(c, ingredients);
  for (let k = 0; k < c.nBlocks; k++) {
    if (typeof cancelled === 'function' && cancelled()) return null;
    const t = Date.now();
    b.block(k);
    spent += Date.now() - t;
    if (typeof yieldFn === 'function') await yieldFn();
    if (genCache && genCache.core === c) return genCache; // calculé entre-temps par un appel synchrone
  }
  genCache = b.result(spent);
  return genCache;
}

function healthBuilder(c, ingredients) {
  const N = c.N;
  const db = ingDb(ingredients);
  const nIng = c.ING.length;
  // Par ingrédient : légume ? poids d'une pièce ; cuisines signature / indice faible (bits).
  const isVeg = new Uint8Array(nIng);
  const pieceG = new Float32Array(nIng);
  const sigBits = new Uint16Array(nIng);
  for (let i = 0; i < nIng; i++) {
    const key = c.ING[i];
    isVeg[i] = key !== 'concentre-tomate' && isVegKey(key, db) ? 1 : 0;
    pieceG[i] = PIECE_G[key] || 100;
    for (let k = 0; k < SIG.length; k++) if (SIG[k].includes(key)) sigBits[i] |= 1 << k;
  }
  const unitCode = new Uint8Array(c.pairUnit.length);
  for (let p = 0; p < c.pairUnit.length; p++)
    unitCode[p] = ['g', 'ml', 'u', 'cs', 'cc'].indexOf(c.pairUnit[p]) + 1;
  const veg = new Uint16Array(N);
  const cuisine = new Uint8Array(N);
  const flags = new Uint8Array(N);
  const cols = c.cols;
  const pairMask = (1 << c.PAIR_BITS) - 1;
  const optBit = 9 + c.PAIR_BITS;
  const sideSub = c.SUBS.indexOf('accompagnements');
  const courseDessert = c.COURSES.indexOf('dessert');
  const courseBreakfast = c.COURSES.indexOf('petit-dejeuner');
  // groupes d'indices faibles par numéro d'ingrédient
  const weakIds = new Array(nIng);
  for (let i = 0; i < nIng; i++) weakIds[i] = WEAK_GROUPS.get(c.ING[i]) || null;
  const counts = new Uint8Array(CUISINES.length);
  const seen = new Uint8Array(CUISINES.length * 16);
  const touched = new Int32Array(256);
  const block = (b) => {
    const lines = loadBlock(c, 'lines', b);
    const base = b * c.SHARD;
    const end = Math.min(N, base + c.SHARD);
    const text = loadTitleBlock('fr', b) ? titleBlockText('fr', b) : null;
    // une normalisation par bloc, puis une ligne (un titre) par case
    const blob = text ? normBlob(text) : null;
    let pos = 0;
    for (let row = base; row < end; row++) {
      let title = '';
      if (blob !== null && pos <= blob.length) {
        let nx = blob.indexOf('\n', pos);
        if (nx < 0) nx = blob.length;
        title = blob.slice(pos, nx).trim();
        pos = nx + 1;
      }
      if (cols.flags[row] & 4 || !lines) continue;
      const n = cols.nIng[row];
      const s = c.lineStart[row];
      let g = 0;
      let sig = 0;
      let nt = 0;
      for (let k = 0; k < n; k++) {
        const v = readInt(lines, (s + k) * c.LW, c.LW);
        if (v < 0) break;
        const ix = v & 511;
        if (ix >= nIng || (v >> optBit) & 1) continue;
        sig |= sigBits[ix];
        const wl = weakIds[ix];
        if (wl)
          for (let q = 0; q < wl.length; q++)
            if (!seen[wl[q]] && nt < touched.length) {
              seen[wl[q]] = 1;
              touched[nt++] = wl[q];
              counts[wl[q] >> 4]++;
            }
        if (!isVeg[ix]) continue;
        const p = (v >> 9) & pairMask;
        const q = c.pairQty[p] || 0;
        const u = unitCode[p];
        g +=
          u === 1 || u === 2
            ? q
            : u === 3
              ? q * pieceG[ix]
              : u === 4
                ? q * 15
                : u === 5
                  ? q * 5
                  : 0;
      }
      const serv = cols.serv && cols.serv[row] > 0 ? cols.serv[row] : 4;
      veg[row] = Math.min(65535, Math.round(g / serv));
      let fl = 0;
      if (cols.sub[row] === sideSub) fl |= FLAG_SIDE;
      if (!title) fl |= FLAG_NO_TITLE;
      else {
        const k = cuisineIndex(title, null, sig, counts); // remplit aussi TB.fried
        if (TB.fried) fl |= FLAG_FRIED;
        if (TB.treat) fl |= FLAG_TREAT;
        if (k >= 0) cuisine[row] = k + 1;
      }
      const kc = cols.kcal[row] * 10;
      if (
        cols.course[row] !== courseDessert &&
        cols.course[row] !== courseBreakfast &&
        !(fl & FLAG_SIDE) &&
        !(fl & FLAG_FRIED) &&
        cols.prot[row] >= BALANCED.minProtein &&
        kc >= BALANCED.minKcal &&
        kc <= BALANCED.maxKcal &&
        veg[row] >= BALANCED.minVeg
      )
        fl |= FLAG_BALANCED;
      flags[row] = fl;
      for (let k = 0; k < nt; k++) seen[touched[k]] = 0;
      counts.fill(0);
    }
  };
  return { block, result: (ms) => ({ core: c, veg, cuisine, flags, ms }) };
}

/** La case passe-t-elle les filtres { balanced, minVeg, cuisine } ? (colonnes de genHealth) */
export function genPasses(h, row, f) {
  if (f.balanced && !(h.flags[row] & FLAG_BALANCED)) return false;
  const mv = Number(f.minVeg) || 0;
  if (mv > 0 && h.veg[row] < mv) return false;
  if (f.cuisine) {
    const k = CUISINES.indexOf(f.cuisine);
    if (k < 0 || h.cuisine[row] !== k + 1) return false;
  }
  return true;
}

/** Grammes de légumes par portion d'une case générée (0 si inconnu). */
export const genVegGrams = (row) => {
  const h = genHealth();
  return h && row >= 0 && row < h.veg.length ? h.veg[row] : 0;
};
/** Cuisine d'une case générée, ou null. */
export const genCuisine = (row) => {
  const h = genHealth();
  return h && row >= 0 && row < h.cuisine.length && h.cuisine[row]
    ? CUISINES[h.cuisine[row] - 1]
    : null;
};
/** Case générée équilibrée ? */
export const genBalanced = (row) => {
  const h = genHealth();
  return !!(h && row >= 0 && row < h.flags.length && h.flags[row] & FLAG_BALANCED);
};
