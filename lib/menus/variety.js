// Variété du planificateur : famille de plat et ingrédients principaux, DÉDUITS de l'identifiant
// et des ingrédients de chaque recette (aucune donnée à saisir à la main dans les recettes).
import { estObjet, arr, toBase } from './util';

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
