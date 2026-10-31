// Estimation des coûts. Ce sont TOUJOURS des estimations en euros, jamais les
// vrais prix des boutiques (le comparateur de l'application donne ceux-là).
import { estObjet, estNombre, toBase, convertFam, round2, indexRecipes } from './util';

export const PRICE_IS_ESTIMATE = true;
export const CURRENCY = 'EUR';

// Prix de repli par rayon : euros par kg ou par litre.
const DEFAULT_PER_KG = {
  'fruits-legumes': 3,
  'viandes-poissons': 12,
  cremerie: 6,
  epicerie: 4,
  surgeles: 6,
  boulangerie: 4,
  boissons: 1.5,
};
const DEFAULT_PER_UNIT = 0.5;

// Contenance d'un paquet : { amt, fam, qty, unit, label } ou null.
export function packInfo(ing) {
  const p = estObjet(ing) ? ing.pack : null;
  if (!estObjet(p) || !estNombre(Number(p.qty)) || Number(p.qty) <= 0) return null;
  const b = toBase(Number(p.qty), p.unit);
  if (b.amt <= 0) return null;
  return { amt: b.amt, fam: b.fam, qty: Number(p.qty), unit: p.unit, label: p.label || '' };
}

// Famille dans laquelle on compte un ingrédient (celle de son paquet, sinon de la recette).
export function ingFamily(ing, fallbackFam) {
  const pk = packInfo(ing);
  return pk ? pk.fam : fallbackFam || 'u';
}

// Prix d'un paquet entier (euros). priceKnown = false si prix de repli.
export function packPrice(ing) {
  const pk = packInfo(ing);
  const aisle = estObjet(ing) ? ing.aisle : null;
  if (!pk) return { eur: 0, priceKnown: false };
  const perKg =
    estObjet(ing) && estNombre(Number(ing.pricePerKgOrL)) && Number(ing.pricePerKgOrL) > 0
      ? Number(ing.pricePerKgOrL)
      : null;
  const perU =
    estObjet(ing) && estNombre(Number(ing.pricePerUnit)) && Number(ing.pricePerUnit) > 0
      ? Number(ing.pricePerUnit)
      : null;
  if (pk.fam === 'u') {
    if (perU) return { eur: perU * pk.qty, priceKnown: true };
    if (perKg && ing.unitWeight > 0)
      return { eur: (perKg * ing.unitWeight * pk.qty) / 1000, priceKnown: true };
    return { eur: DEFAULT_PER_UNIT * pk.qty, priceKnown: false };
  }
  if (perKg) return { eur: (perKg * pk.amt) / 1000, priceKnown: true };
  if (perU) return { eur: perU, priceKnown: true }; // prix saisi par paquet
  return { eur: ((DEFAULT_PER_KG[aisle] || 4) * pk.amt) / 1000, priceKnown: false };
}

// Coût d'une quantité consommée (sans arrondi au paquet), en euros.
// amt est exprimé dans la famille `fam`.
export function consumedCost(ing, amt, fam) {
  const pk = packInfo(ing);
  if (!pk) {
    // Pas de paquet connu : prix au kilo / à l'unité, sinon repli.
    const aisle = estObjet(ing) ? ing.aisle : null;
    const perKg = estObjet(ing) && Number(ing.pricePerKgOrL) > 0 ? Number(ing.pricePerKgOrL) : null;
    const perU = estObjet(ing) && Number(ing.pricePerUnit) > 0 ? Number(ing.pricePerUnit) : null;
    if (fam === 'u') return { eur: amt * (perU || DEFAULT_PER_UNIT), priceKnown: !!perU };
    return { eur: (amt / 1000) * (perKg || DEFAULT_PER_KG[aisle] || 4), priceKnown: !!perKg };
  }
  const inPack = convertFam(amt, fam, pk.fam, ing);
  const pp = packPrice(ing);
  if (inPack === null) return { eur: pp.eur * (amt / pk.qty), priceKnown: false };
  return { eur: pp.eur * (inPack / pk.amt), priceKnown: pp.priceKnown };
}

// Coût consommé d'une recette pour `persons` personnes (hors placard par défaut).
export function estimateRecipeCost(recipe, ingredients, persons, opts = {}) {
  const o = opts || {};
  const pantry = new Set(o.pantry || []);
  const servings = recipe && recipe.servings > 0 ? recipe.servings : 4;
  const factor = (estNombre(persons) && persons > 0 ? persons : servings) / servings;
  let total = 0;
  const unknown = [];
  const list = recipe && Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  for (const it of list) {
    if (!estObjet(it) || !it.key) continue;
    if (it.optional && !o.includeOptional) continue;
    const ing = ingredients ? ingredients[it.key] : null;
    if (!o.includePantry && ((ing && ing.pantry) || pantry.has(it.key))) continue;
    const b = toBase(Number(it.qty) * factor, it.unit);
    const c = consumedCost(ing, b.amt, b.fam);
    total += c.eur;
    if (!c.priceKnown) unknown.push(it.key);
  }
  total = round2(total);
  return { total, perPerson: persons > 0 ? round2(total / persons) : total, unknown };
}

// Coût d'une liste de recettes (tableau de {recipeId, persons}).
export function estimateMealsCost(meals, recipes, ingredients, opts = {}) {
  const idx = indexRecipes(recipes);
  let total = 0;
  for (const m of Array.isArray(meals) ? meals : []) {
    const r = m && idx.get(m.recipeId);
    if (r) total += estimateRecipeCost(r, ingredients, m.persons || r.servings, opts).total;
  }
  return round2(total);
}

// Affichage d'un montant : "12,50 €" (langues à virgule), "12.50 €" (arabe) ou "€12.50" (en, ja, zh, th...).
const COMMA = new Set(['fr', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'sv']);
export function formatEur(n, lang) {
  const v = estNombre(Number(n)) ? Number(n) : 0;
  const s = v.toFixed(2);
  const l = String(lang || 'fr')
    .toLowerCase()
    .slice(0, 2);
  if (COMMA.has(l)) return `${s.replace('.', ',')} €`;
  // Arabe : comme fmtPrice de App.js, montant puis symbole, chiffres latins et point (en RTL, "€12.50" s'inverse).
  if (l === 'ar') return `${s} €`;
  return `€${s}`;
}
