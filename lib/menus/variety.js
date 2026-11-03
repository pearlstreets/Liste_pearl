// Variété du planificateur : famille de plat et ingrédients principaux, DÉDUITS de l'identifiant
// et des ingrédients de chaque recette (aucune donnée à saisir à la main dans les recettes).
import { estObjet, arr, toBase } from './util';
import { isTreatTitle } from './healthy';

// Famille de plat : premier motif trouvé dans l'identifiant de la recette.
const FAMILY_RULES = [
  ['curry', /(^|-)(curry|dahl|tikka|tajine|yassa)(-|$)/],
  ['chili', /(^|-)chili(-|$)/],
  ['risotto', /(^|-)risotto(-|$)/],
  ['gratin', /(^|-)(gratin|tartiflette|hachis|moussaka|lasagnes?)(-|$)/],
  ['soupe', /(^|-)(soupe|veloute|gaspacho)(-|$)/],
  ['salade', /(^|-)salade(-|$)/],
  ['pizza', /(^|-)(pizza|pizzas)(-|$)/],
  ['tarte', /(^|-)(quiche|tarte|feuilletes?)(-|$)/],
  [
    'sandwich',
    /(^|-)(wraps?|tacos|quesadillas|fajitas|gyros|burgers?|croque|bruschettas?|galettes?)(-|$)/,
  ],
  ['pates', /(^|-)(pates|spaghettis|tagliatelles|macaronis|gnocchi|nouilles|boulettes)(-|$)/],
  ['omelette', /(^|-)(omelette|tortilla|shakshuka|oeufs)(-|$)/],
  ['riz', /(^|-)(riz|paella)(-|$)/],
  ['four', /(^|-)(roti|papillote|nuggets|brochettes|fish)(-|$)/],
];

// Ingrédients qui ne caractérisent pas un plat : féculents d'accompagnement, base aromatique, gras.
const NEUTRAL = new Set([
  'riz',
  'pates',
  'semoule',
  'boulgour',
  'nouilles',
  'nouilles-riz',
  'pates-lasagne',
  'baguette',
  'tortilla',
  'pain-burger',
  'pain-mie',
  'pain-pita',
  'oignon',
  'ail',
  'echalote',
  'citron',
  'tomate-concassee',
  'concentre-tomate',
  'lait-coco',
  'lait',
  'creme',
  'creme-fraiche',
  'beurre',
  'fromage-rape',
  'farine',
  'sucre',
  'chapelure',
  'pate-feuilletee',
  'pate-brisee',
  'persil',
  'coriandre',
  'basilic',
  'menthe',
  'ciboulette',
  'gingembre',
  'herbes',
  'tahini',
  'olives',
]);
const PROTEIN_AISLE = 'viandes-poissons';
const PULSES = new Set(['pois-chiches', 'lentilles', 'haricots-rouges', 'tofu']);

/** Famille de plat d'une recette (chaîne) ou null. */
export function dishFamily(recipe) {
  if (!estObjet(recipe) || typeof recipe.id !== 'string') return null;
  // Recette générée : la famille vient d'une colonne (son identifiant est opaque).
  if (typeof recipe.family === 'string') return recipe.family;
  if (recipe.generated) return null;
  for (const [name, re] of FAMILY_RULES) if (re.test(recipe.id)) return name;
  return null;
}

/** Ingrédients principaux (du plus au moins caractéristique), au plus 3. */
export function mainIngredients(recipe, ingredients) {
  const ings = estObjet(ingredients) ? ingredients : {};
  const scored = [];
  for (const it of arr(recipe && recipe.ingredients)) {
    if (!estObjet(it) || !it.key || it.optional) continue;
    const ing = ings[it.key];
    if ((ing && ing.pantry) || NEUTRAL.has(it.key)) continue;
    const b = toBase(it.qty, it.unit);
    let w = b.fam === 'u' ? b.amt * 80 : b.amt;
    if (ing && ing.aisle === PROTEIN_AISLE) w += 10000;
    else if (PULSES.has(it.key)) w += 5000;
    scored.push([it.key, w]);
  }
  scored.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return scored.slice(0, 3).map((x) => x[0]);
}

export function dishProfile(recipe, ingredients) {
  if (recipe && estObjet(recipe.dp)) return recipe.dp; // recette générée : calculé au chargement
  const mains = mainIngredients(recipe, ingredients);
  const keyMain = mains.filter(
    (k) => !['pomme-de-terre', 'carotte', 'courgette', 'tomate', 'epinard'].includes(k)
  );
  return { family: dishFamily(recipe), main: mains[0] || null, mains, key: keyMain };
}

/**
 * Pénalité (>= 0) pour placer `cand` un jour donné, vu les plats déjà placés.
 * placed : [{ profile, day, leftover }]
 * Même jour (midi/soir) : un seul plat principal et une seule famille. Semaine : pénalité forte et
 * croissante pour une même famille, un même ingrédient principal ou deux ingrédients clés communs.
 */
export function varietyPenalty(cand, day, placed) {
  let pen = 0;
  let famWeek = 0;
  let mainWeek = 0;
  for (const o of placed) {
    const same = o.day === day;
    const fam = cand.family && o.profile.family === cand.family;
    const main = cand.main && (o.profile.main === cand.main || o.profile.key.includes(cand.main));
    const shared = cand.key.filter((k) => o.profile.key.includes(k)).length;
    if (same) {
      if (main) pen += 220;
      if (fam) pen += 120;
      if (shared >= 2) pen += 80;
    }
    if (o.leftover) continue; // un reste n'est pas un nouveau plat de la semaine
    if (fam) famWeek++;
    if (main) mainWeek++;
    if (shared >= 2) pen += 40;
  }
  pen += famWeek * 35 + (famWeek > 1 ? (famWeek - 1) * 40 : 0);
  pen += mainWeek * 28 + (mainWeek > 1 ? (mainWeek - 1) * 40 : 0);
  return pen;
}

/* ------------------------- base féculente et protéine d'un plat ------------------------- */

// Base féculente : la plus lourde (grammes par recette) de ces familles ; à défaut, la famille du plat.
const STARCH = new Map(
  [
    ['pates', 'pates pates-lasagne gnocchi nouilles nouilles-riz'],
    ['riz', 'riz riz-arborio riz-basmati'],
    ['pdt', 'pomme-de-terre patate-douce'],
    ['cereales', 'semoule boulgour quinoa polenta'],
    ['pain', 'baguette pain-burger pain-mie pain-pita pain-campagne tortilla pate-pizza'],
    ['tarte', 'pate-feuilletee pate-brisee feuille-brick'],
  ].flatMap(([b, ks]) => ks.split(' ').map((k) => [k, b]))
);
const STARCH_OF_FAMILY = {
  pates: 'pates',
  riz: 'riz',
  risotto: 'riz',
  pizza: 'pain',
  sandwich: 'pain',
  tarte: 'tarte',
};
// Protéine : groupe de la plus lourde ligne protéinée (poisson avant bœuf : « steak de thon »).
const PROTEIN_RULES = [
  [
    'poisson',
    /^(filet-bar|saumon|cabillaud|colin|thon|sardine|truite|maquereau|lieu|merlu|crevette|moule|poisson|calamar|surimi|anchois|dorade|steak-thon|fruits-de-mer|haddock|sole|gambas|saint-jacques|palourde)/,
  ],
  ['volaille', /^(lapin|poulet|cuisse-poulet|dinde|canard|cuisse-canard|magret|pintade)/],
  ['porc', /^(boudin|porc|cotes-porc|saucisse|lardons|jambon|chorizo|bacon|chipolata|petit-sale|guanciale)/],
  ['agneau', /^(agneau|cotelette-agneau|gigot|mouton|merguez)/],
  ['boeuf', /^(boeuf|veau|escalope-veau|steak)/],
  ['oeufs', /^oeuf/],
  [
    'legumineuses',
    /^(lentilles|pois-chiches|haricots-rouges|haricots-blancs|feves|pois-casses|tofu|tempeh|seitan|edamame)/,
  ],
];
const PROTEIN_GROUPS = PROTEIN_RULES.map((r) => r[0]);
const proteinGroupCache = new Map();
function proteinGroupOfKey(key) {
  let g = proteinGroupCache.get(key);
  if (g === undefined) {
    g = null;
    for (const [name, re] of PROTEIN_RULES)
      if (re.test(key)) {
        g = name;
        break;
      }
    proteinGroupCache.set(key, g);
  }
  return g;
}
const gramsOf = (it, perUnit) => {
  const b = toBase(it.qty, it.unit);
  return b.fam === 'u' ? b.amt * perUnit : b.amt;
};

/**
 * Repères de variété d'une recette objet : { base, protein } ; base parmi pates, riz, pdt, cereales, pain,
 * tarte (ou null), protein parmi volaille, boeuf, porc, agneau, poisson, oeufs, legumineuses (ou null).
 * Lignes facultatives ignorées. Jamais d'exception.
 */
export function mealTraits(recipe) {
  let base = null;
  let baseG = 0;
  let protein = null;
  let protG = 0;
  if (!estObjet(recipe)) return { base, protein };
  for (const it of arr(recipe.ingredients)) {
    if (!estObjet(it) || typeof it.key !== 'string' || it.optional) continue;
    const b = STARCH.get(it.key);
    if (b) {
      const g = gramsOf(it, 120);
      if (g > baseG) {
        base = b;
        baseG = g;
      }
      continue;
    }
    const pg = proteinGroupOfKey(it.key);
    if (pg) {
      // un œuf pèse environ 55 g, une autre pièce (cuisse, côte, filet) environ 150 g
      const g = gramsOf(it, pg === 'oeufs' ? 55 : 150);
      if (g > protG) {
        protein = pg;
        protG = g;
      }
    }
  }
  if (!base) base = STARCH_OF_FAMILY[dishFamily(recipe)] || null;
  return { base, protein };
}
export { PROTEIN_GROUPS };

// Garniture et sauce d'un plat (« épinards et champignons, sauce sésame et miel ») : ce qui reste une fois la base
// féculente et la protéine retirées. Garniture : les deux lignes les plus lourdes (plus de 100 g) hors base
// aromatique et gras ; sauce : au moins trois condiments en petite quantité (100 g ou ml au plus).
const SAUCE_BASIC = new Set(
  'sel poivre ail oignon echalote beurre farine sucre bouillon eau huile huile-olive huile-tournesol'.split(
    ' '
  )
);
/** { garnish, sauce } : signatures (clés triées, jointes par « + ») ou null. Lignes facultatives ignorées. */
export function garnishOf(recipe) {
  const veg = [];
  const sauce = [];
  for (const it of arr(estObjet(recipe) && recipe.ingredients)) {
    if (!estObjet(it) || typeof it.key !== 'string' || it.optional) continue;
    const k = it.key;
    if (STARCH.has(k) || proteinGroupOfKey(k) || SAUCE_BASIC.has(k)) continue;
    const b = toBase(it.qty, it.unit);
    const g = b.fam === 'u' ? b.amt * 120 : b.amt;
    if (b.fam !== 'u' && g <= 100) sauce.push(k);
    else if (g > 100 && !NEUTRAL.has(k)) veg.push([k, g]);
  }
  veg.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return {
    garnish: veg.length >= 2 ? [veg[0][0], veg[1][0]].sort().join('+') : null,
    sauce: sauce.length >= 3 ? sauce.sort().join('+') : null,
  };
}

// « Plat plaisir » : pizza, burger, frites, fritures, plats très riches (identifiant des recettes écrites à la
// main = titre français ; famille du plat ; friture ; plus de 850 kcal par portion).
const TREAT_ID = /(^|-)(pizzas?|burgers?|frites|nuggets|tacos|kebab|hot-dog|croque|fish-and-chips|beignets?|tempura|tartiflette|raclette|fondue|poutine|panes?|frit|frits|fritto)(-|$)/;
export const TREAT_KCAL = 850;
export function isTreat(recipe, fried) {
  if (!estObjet(recipe) || typeof recipe.id !== 'string') return false;
  if (fried) return true;
  const fam = dishFamily(recipe);
  if (fam === 'pizza') return true;
  if (!recipe.generated && TREAT_ID.test(recipe.id)) return true;
  if (recipe.generated && isTreatTitle(recipe)) return true;
  return (Number(recipe.kcal) || 0) >= TREAT_KCAL;
}

// Plafond doux par semaine de chaque base féculente (plats cuisinés, restes non comptés).
export const BASE_CAP = { pates: 2, riz: 2, pdt: 3, cereales: 2, pain: 2, tarte: 1 };

/**
 * Pénalité (négative = bonus) d'équilibre de la semaine pour placer un plat de repères `tr`
 * ({ base, protein, cuisine }) le jour `day`, vu les plats déjà placés ([{ traits, day, leftover }]).
 * Base féculente : jamais deux fois le même jour, évitée deux jours de suite, plafond doux par semaine.
 * Protéine : rotation (pénalité croissante), poisson, œufs et légumineuses favorisés s'ils manquent.
 * Cuisine : pénalité croissante au-delà de deux plats de la même cuisine. Garniture et sauce (garnishOf, dans
 * tr.garnish et tr.sauce) : pénalité forte deux fois dans la semaine, très forte le même jour, la veille ou le
 * lendemain. Tout reste un score : si rien
 * d'autre n'est possible (régime, budget, peu de recettes), le plat passe quand même.
 */
// Poids (points du score du planificateur, ou 1 EUR vaut environ 1,6 point sans budget).
const W = {
  sameDay: 80, // même base le même jour
  nextPates: 35, // pâtes la veille ou le lendemain
  next: 10, // autre base la veille ou le lendemain
  protDay: 30, // même protéine le même jour
  base: 0,
  over: 50, // base au plafond de la semaine (BASE_CAP), puis overStep par plat de plus
  overStep: 40,
  prot: 3, // même protéine dans la semaine, puis protStep au-delà de deux
  protStep: 8,
  fish: 6, // premier poisson de la semaine
  rot: 3, // premiers œufs, premières légumineuses
  cuis: 1, // même cuisine, puis cuisStep au-delà de deux
  cuisStep: 4,
  garnNear: 300, // même garniture ou même sauce le même jour, la veille ou le lendemain (autre plat)
  garnWeek: 60, // même garniture ou même sauce dans la semaine, par plat déjà placé
};
export function balancePenalty(tr, day, placed) {
  if (!tr) return 0;
  let pen = 0;
  let baseWeek = 0;
  let protWeek = 0;
  let cuisWeek = 0;
  let fish = 0;
  let eggs = 0;
  let pulses = 0;
  for (const o of placed) {
    const t = o.traits;
    if (!t) continue;
    const dd = o.day - day;
    // même garniture ou même sauce qu'un autre plat (son propre reste n'en est pas un autre)
    if (
      t !== tr &&
      ((tr.garnish && t.garnish === tr.garnish) || (tr.sauce && t.sauce === tr.sauce))
    )
      pen += dd >= -1 && dd <= 1 ? W.garnNear : W.garnWeek;
    if (tr.base && t.base === tr.base) {
      if (dd === 0) pen += W.sameDay;
      else if (dd === 1 || dd === -1) pen += tr.base === 'pates' ? W.nextPates : W.next;
    }
    if (tr.protein && t.protein === tr.protein && dd === 0) pen += W.protDay;
    if (o.leftover) continue; // un reste n'est pas un nouveau plat de la semaine
    if (tr.base && t.base === tr.base) baseWeek++;
    if (tr.protein && t.protein === tr.protein) protWeek++;
    if (tr.cuisine && t.cuisine === tr.cuisine) cuisWeek++;
    if (t.protein === 'poisson') fish++;
    else if (t.protein === 'oeufs') eggs++;
    else if (t.protein === 'legumineuses') pulses++;
  }
  if (tr.base) {
    const cap = BASE_CAP[tr.base] || 2;
    pen += baseWeek * W.base;
    if (baseWeek >= cap) pen += W.over + (baseWeek - cap) * W.overStep;
  }
  if (tr.protein) {
    pen += protWeek * W.prot + (protWeek > 2 ? (protWeek - 2) * W.protStep : 0);
    if (tr.protein === 'poisson' && fish === 0) pen -= W.fish;
    if (tr.protein === 'oeufs' && eggs === 0) pen -= W.rot;
    if (tr.protein === 'legumineuses' && pulses === 0) pen -= W.rot;
  }
  if (tr.cuisine) pen += cuisWeek * W.cuis + (cuisWeek > 2 ? (cuisWeek - 2) * W.cuisStep : 0);
  return pen;
}
