// Recherche de recettes : sans accents, filtres, "ce que j'ai chez moi", saison.
import { estObjet, arr, norm, seasonOf, SEASONS } from './util';
import { hasHealthFilters, matchHealth } from './healthy';
import { mainIngredients } from './variety';

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
//             excludedIngredients:[], season:'hiver'|..., month, favoritesOnly + favorites:Set,
//             balanced:true, minVeg:g par portion, cuisine:'asie'|... (healthy.js ; absents = aucun effet) }
export function filterRecipes(recipes, filters = {}) {
  const f = estObjet(filters) ? filters : {};
  const ex = new Set(arr(f.excludedIngredients).map(String));
  const tags = arr(f.tags);
  const fav = f.favorites instanceof Set ? f.favorites : new Set(arr(f.favorites));
  const health = hasHealthFilters(f);
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
    if (health && !matchHealth(r, f)) return false;
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

// Tri « avec ce que j'ai » : d'abord les recettes sans rien de manquant, puis 1, 2... ; à égalité, le meilleur score.
/**
 * Espace les plats presque identiques en haut d'une liste deja triee. sigOf(x) rend des cles de ressemblance
 * (ex. debut du titre, fin du titre, base + proteine) ou null : au sein d'un meme groupe (groupOf, ex. nombre de
 * manquants), un element qui partage une cle avec l'un des `gap` derniers places cede sa place au premier element
 * different parmi les `ahead` suivants dont le score (champ score) ne perd pas plus de `maxDrop` points : le
 * classement reste respecte, seuls des plats de valeur voisine changent de place.
 * Cles fortes (prefixe `opts.strong`, ex. 'h:' = meme plat de base, meme proteine, memes legumes, seule la sauce
 * change) : un tel doublon de l'un des `strongGap` derniers places cede sa place au premier element different
 * parmi les `ahead` suivants, a `strongDrop` points de score au plus (toujours dans son groupe).
 * L'ordre des groupes ne change jamais ; seuls les `head` premiers elements de chaque groupe sont reordonnes.
 * Deterministe : memes entrees, meme ordre (pages limit/offset coherentes).
 */
export function spreadSimilar(list, groupOf, sigOf, opts = {}) {
  const gap = opts.gap > 0 ? opts.gap : 2;
  const ahead = opts.ahead > 0 ? opts.ahead : 8;
  const head = opts.head > 0 ? opts.head : 120;
  const maxDrop = opts.maxDrop >= 0 ? opts.maxDrop : 12;
  const strong = typeof opts.strong === 'string' && opts.strong ? opts.strong : null;
  const strongGap = strong ? (opts.strongGap > 0 ? opts.strongGap : 6) : 0;
  const strongDrop = opts.strongDrop >= 0 ? opts.strongDrop : 30;
  const keep = Math.max(gap, strongGap);
  const scoreOf = (x) => (x && typeof x.score === 'number' ? x.score : 0);
  const out = [];
  let i = 0;
  while (i < list.length) {
    const g = groupOf(list[i]);
    let j = i;
    while (j < list.length && groupOf(list[j]) === g) j++;
    const end = Math.min(j, i + head);
    const pending = [];
    for (let k = i; k < end; k++) pending.push({ it: list[k], sig: null, done: false });
    const recent = [];
    const keysOf = (p) => {
      if (!p.done) {
        p.sig = (sigOf(p.it) || []).filter(Boolean);
        p.done = true;
      }
      return p.sig;
    };
    const clash = (p) => {
      const from = Math.max(0, recent.length - gap);
      return keysOf(p).some((k) => recent.some((r, x) => x >= from && r.includes(k)));
    };
    const clashStrong = (p) =>
      strong !== null &&
      keysOf(p).some((k) => k.startsWith(strong) && recent.some((r) => r.includes(k)));
    while (pending.length) {
      let pick = 0;
      const lim = Math.min(pending.length, ahead + 1);
      if (clashStrong(pending[0])) {
        // Les doublons ne comptent pas dans la fenetre : on regarde les `ahead` suivants differents.
        let alt = -1;
        // Jamais au profit d'un plat bien moins bien classe (un tres bon plat ne descend pas loin).
        const strongFloor = scoreOf(pending[0].it) - strongDrop;
        for (let k = 1, seen = 0; k < pending.length && seen < ahead; k++) {
          if (scoreOf(pending[k].it) < strongFloor) break;
          if (clashStrong(pending[k])) continue;
          seen++;
          if (!clash(pending[k])) {
            pick = k;
            break;
          }
          if (alt < 0) alt = k;
        }
        if (pick === 0 && alt > 0) pick = alt;
      } else {
        const floor = scoreOf(pending[0].it) - maxDrop;
        for (let k = 0; k < lim; k++)
          if (scoreOf(pending[k].it) >= floor && !clash(pending[k]) && !clashStrong(pending[k])) {
            pick = k;
            break;
          }
      }
      const p = pending.splice(pick, 1)[0];
      out.push(p.it);
      recent.push(keysOf(p));
      if (recent.length > keep) recent.shift();
    }
    for (let k = end; k < j; k++) out.push(list[k]);
    i = j;
  }
  return out;
}

export function cmpMissing(a, b) {
  return (
    a.missing.length - b.missing.length ||
    b.score - a.score ||
    (a.recipe.id < b.recipe.id ? -1 : a.recipe.id > b.recipe.id ? 1 : 0)
  );
}

const PERISHABLE = new Set(['fruits-legumes', 'viandes-poissons', 'cremerie', 'boulangerie']);

/**
 * recipesByPantry(recipes, haveKeys, { ingredients, toUseUp:[keys], filters, limit, minCoverage })
 * Recettes réalisables avec ce que l'on a chez soi, score anti-gaspi :
 * les produits frais à finir (toUseUp) et périssables pèsent plus.
 * Options facultatives : byMissing (tri par nombre d'ingrédients manquants), maxMissing, basics:[keys du placard].
 * -> [{ recipe, score, coverage (0-1), have:[keys], missing:[keys], uses:[toUseUp utilisés] }]
 */
export function recipesByPantry(recipes, haveKeys, opts = {}) {
  const o = estObjet(opts) ? opts : {};
  const ings = estObjet(o.ingredients) ? o.ingredients : {};
  const have = new Set(arr(haveKeys));
  const useUp = new Set(arr(o.toUseUp));
  const byMissing = o.byMissing === true;
  const minCov = typeof o.minCoverage === 'number' ? o.minCoverage : byMissing ? 0 : 0.4;
  const maxMiss = byMissing && o.maxMissing >= 0 ? o.maxMissing : Infinity;
  const basics = new Set(arr(o.basics)); // placard du foyer : compté comme présent, jamais « manquant »
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
      if ((ing && ing.pantry) || basics.has(it.key)) continue; // sel, huile, épices : toujours supposés présents
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
    if (coverage < minCov || hv.length === 0 || ms.length > maxMiss) continue;
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
  let res = out;
  if (byMissing) {
    out.sort(cmpMissing);
    // Frigo : pas cinq fois le meme plat de suite (meme couple d'ingredients principaux espace).
    res = spreadSimilar(
      out,
      (x) => x.missing.length,
      (x) => {
        const m = mainIngredients(x.recipe, ings).slice(0, 2).sort().join('+');
        return m ? [`m:${m}`] : null;
      }
    );
  } else out.sort((a, b) => b.score - a.score || (a.recipe.id < b.recipe.id ? -1 : 1));
  return o.limit > 0 ? res.slice(0, o.limit) : res;
}
