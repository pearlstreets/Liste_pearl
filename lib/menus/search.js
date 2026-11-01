// Recherche de recettes : sans accents, filtres, "ce que j'ai chez moi", saison.
import { estObjet, arr, norm, seasonOf, SEASONS } from './util';

export function inSeason(recipe, month) {
  const s = seasonOf(month);
  const tags = arr(recipe && recipe.tags);
  const own = tags.filter((t) => SEASONS.includes(t));
  if (!s || own.length === 0) return true;
  return own.includes(s);
}

/** Recettes de saison pour un mois (0-11) ou une date. */
export function seasonalRecipes(recipes, dateOrMonth) {
  const month = dateOrMonth instanceof Date ? dateOrMonth.getMonth() : dateOrMonth;
  return arr(recipes).filter((r) => estObjet(r) && inSeason(r, month));
}

// Filtres : { course, tags:[tous requis], maxTimeMin, maxDifficulty, maxKcal, minProtein,
//             excludedIngredients:[], season:'hiver'|..., month, favoritesOnly + favorites:Set }
export function filterRecipes(recipes, filters = {}) {
  const f = estObjet(filters) ? filters : {};
  const ex = new Set(arr(f.excludedIngredients).map(String));
  const tags = arr(f.tags);
  const fav = f.favorites instanceof Set ? f.favorites : new Set(arr(f.favorites));
  return arr(recipes).filter((r) => {
    if (!estObjet(r) || !r.id) return false;
    if (f.course && r.course !== f.course) return false;
    const rt = arr(r.tags);
    for (const t of tags) if (!rt.includes(t)) return false;
    if (f.season && rt.some((t) => SEASONS.includes(t)) && !rt.includes(f.season)) return false;
    if (f.month !== undefined && f.month !== null && !inSeason(r, f.month)) return false;
    if (f.maxTimeMin && Number(r.timeMin) > f.maxTimeMin) return false;
    if (f.maxDifficulty && Number(r.difficulty) > f.maxDifficulty) return false;
    if (f.maxKcal && Number(r.kcal) > f.maxKcal) return false;
    if (f.minProtein && !(Number(r.protein) >= f.minProtein)) return false;
    if (ex.size && arr(r.ingredients).some((i) => i && ex.has(i.key))) return false;
    if (f.favoritesOnly && !fav.has(r.id)) return false;
    return true;
  });
}

/**
 * searchRecipes(recipes, { query, filters, titleOf(recipe), ingredientNameOf(key), limit })
 * -> recettes triées par pertinence. Chaque mot de la requête doit se retrouver dans
 * le titre, un ingrédient ou une étiquette (sans accents ni casse).
 */
export function searchRecipes(recipes, opts = {}) {
  const o = estObjet(opts) ? opts : {};
  const out = scoreRecipes(recipes, o);
  out.sort((a, b) => b.s - a.s || (a.r.id < b.r.id ? -1 : 1));
  const list = out.map((x) => x.r);
  return o.limit > 0 ? list.slice(0, o.limit) : list;
}

/** Comme searchRecipes, sans tri : [{ r, s }] (s = pertinence). Sert aussi a fusionner avec le catalogue genere. */
export function scoreRecipes(recipes, opts = {}) {
  const o = estObjet(opts) ? opts : {};
  const base = filterRecipes(recipes, o.filters);
  const words = norm(o.query).split(' ').filter(Boolean);
  const titleOf = typeof o.titleOf === 'function' ? o.titleOf : (r) => r.id.replace(/-/g, ' ');
  const nameOf =
    typeof o.ingredientNameOf === 'function'
      ? o.ingredientNameOf
      : (k) => String(k).replace(/-/g, ' ');
  let out;
  if (words.length === 0) {
    out = base.map((r) => ({ r, s: 0 }));
  } else {
    out = [];
    for (const r of base) {
      let title = '';
      try {
        title = norm(titleOf(r));
      } catch {
        title = '';
      }
      const ingText = arr(r.ingredients)
        .map((i) => {
          try {
            return norm(nameOf(i.key)) + ' ' + norm(i.key);
          } catch {
            return '';
          }
        })
        .join(' ');
      const tagText = arr(r.tags).map(norm).join(' ');
      let score = 0;
      let ok = true;
      for (const w of words) {
        if (title.split(' ').some((t) => t.startsWith(w))) score += 10;
        else if (title.includes(w)) score += 6;
        else if (ingText.includes(w)) score += 3;
        else if (tagText.includes(w)) score += 2;
        else {
          ok = false;
          break;
        }
      }
      if (ok) out.push({ r, s: score });
    }
  }
  return out;
}

const PERISHABLE = new Set(['fruits-legumes', 'viandes-poissons', 'cremerie', 'boulangerie']);

/**
 * recipesByPantry(recipes, haveKeys, { ingredients, toUseUp:[keys], filters, limit, minCoverage })
 * Recettes réalisables avec ce que l'on a chez soi, score anti-gaspi :
 * les produits frais à finir (toUseUp) et périssables pèsent plus.
 * -> [{ recipe, score, coverage (0-1), have:[keys], missing:[keys], uses:[toUseUp utilisés] }]
 */
export function recipesByPantry(recipes, haveKeys, opts = {}) {
  const o = estObjet(opts) ? opts : {};
  const ings = estObjet(o.ingredients) ? o.ingredients : {};
  const have = new Set(arr(haveKeys));
  const useUp = new Set(arr(o.toUseUp));
  const minCov = typeof o.minCoverage === 'number' ? o.minCoverage : 0.4;
  const out = [];
  for (const r of filterRecipes(recipes, o.filters)) {
    let tot = 0;
    let got = 0;
    const hv = [];
    const ms = [];
    const uses = [];
    for (const it of arr(r.ingredients)) {
      if (!estObjet(it) || !it.key || it.optional) continue;
      const ing = ings[it.key];
      if (ing && ing.pantry) continue; // sel, huile, épices : toujours supposés présents
      const w = (ing && PERISHABLE.has(ing.aisle) ? 2 : 1) * (useUp.has(it.key) ? 2 : 1);
      tot += w;
      if (have.has(it.key)) {
        got += w;
        hv.push(it.key);
        if (useUp.has(it.key)) uses.push(it.key);
      } else ms.push(it.key);
    }
    if (tot === 0) continue;
    const coverage = got / tot;
    if (coverage < minCov || hv.length === 0) continue;
    const score =
      coverage * 100 + uses.length * 15 - ms.length * 4 - (Number(r.timeMin) || 0) * 0.05;
    out.push({
      recipe: r,
      score: Math.round(score * 100) / 100,
      coverage: Math.round(coverage * 100) / 100,
      have: hv,
      missing: ms,
      uses,
    });
  }
  out.sort((a, b) => b.score - a.score || (a.recipe.id < b.recipe.id ? -1 : 1));
  return o.limit > 0 ? out.slice(0, o.limit) : out;
}
