// Apports par jour (par portion adulte, repas libres non comptés).
import { estObjet, estNombre, arr, round2, indexRecipes } from './util';
import { normalizeProfile } from './profile';
import {
  membersAt,
  memberNeeds,
  portionFactor,
  mealShare,
  mealTarget,
  portionTarget,
  recipePortionScale,
} from './needs';

/**
 * dayNutrition(plan, recipes) -> { days:[{ day, kcal, protein, meals, freeMeals }], avgKcal, avgProtein, daysWithMeals }
 * kcal et protein : par personne et par jour, somme des portions des repas du jour.
 */
export function dayNutrition(plan, recipes) {
  const idx = indexRecipes(recipes);
  const days = [];
  for (let d = 0; d < 7; d++) days.push({ day: d, kcal: 0, protein: 0, meals: 0, freeMeals: 0 });
  for (const m of arr(plan && plan.meals)) {
    if (!estObjet(m) || !estNombre(m.day) || !days[m.day]) continue;
    const day = days[m.day];
    if (m.free || !m.recipeId) {
      day.freeMeals++;
      continue;
    }
    const r = idx.get(m.recipeId);
    if (!r) continue;
    day.meals++;
    day.kcal += Number(r.kcal) || 0;
    day.protein += Number(r.protein) || 0;
  }
  const active = days.filter((d) => d.meals > 0);
  for (const d of days) {
    d.kcal = Math.round(d.kcal);
    d.protein = round2(d.protein);
  }
  const avg = (k) =>
    active.length ? round2(active.reduce((s, d) => s + d[k], 0) / active.length) : 0;
  return {
    days,
    avgKcal: Math.round(avg('kcal')),
    avgProtein: avg('protein'),
    daysWithMeals: active.length,
  };
}

// Une recette : kcal et protéines par portion (jamais NaN).
export function recipeNutrition(recipe) {
  return {
    kcal: Math.round(Number(recipe && recipe.kcal) || 0),
    protein: round2(Number(recipe && recipe.protein) || 0),
  };
}

/**
 * weekTargets(plan, recipes, profile) : apports servis et cibles de la semaine, par jour et par repas.
 * -> { hasTargets, days:[{ day, kcal, protein, meals:[...], members:[...] }] }
 *  - repas : { key, slot, recipeId (null si libre), free, leftover, kcal, protein (par portion de référence
 *    servie : portion de recette x recipePortionScale),
 *    target: { kcal, protein } par portion (mealTarget) ou null, members:[{ id, name, kcal, protein,
 *    targetKcal, targetProtein }] (servi = portion de la personne x valeurs par portion ; cible = besoins du
 *    jour x part du repas) } ;
 *  - jour : kcal et protein par portion de recette (somme des repas servis), members = totaux du jour par
 *    personne (repas servis seulement, cibles des mêmes repas).
 * Sans profile.members : hasTargets false, cibles null et members vides (kcal et protein restent donnés).
 * Estimation indicative. Fonction pure, jamais d'exception.
 */
export function weekTargets(plan, recipes, profile) {
  const p = normalizeProfile(profile);
  const has = !!p.members;
  const idx = indexRecipes(recipes);
  const days = [];
  for (let d = 0; d < 7; d++) days.push({ day: d, kcal: 0, protein: 0, meals: [], members: [] });
  const meals = arr(plan && plan.meals)
    .filter((m) => estObjet(m) && estNombre(m.day) && days[m.day] && typeof m.slot === 'string')
    .sort((a, b) => a.day - b.day || (a.slot === b.slot ? 0 : a.slot === 'midi' ? -1 : 1));
  // Portion servie : ajustée aux besoins des personnes renseignées (comme la liste de courses).
  const pt = has ? portionTarget(p) : null;
  for (const m of meals) {
    const day = days[m.day];
    const r = !m.free && m.recipeId ? idx.get(m.recipeId) : null;
    const sc = r && pt ? recipePortionScale(p, r, pt) : 1;
    const kcal = r ? Math.round((Number(r.kcal) || 0) * sc) : 0;
    const protein = r ? round2((Number(r.protein) || 0) * sc) : 0;
    const out = {
      key: typeof m.key === 'string' ? m.key : `${m.day}-${m.slot}`,
      slot: m.slot,
      recipeId: r ? r.id : null,
      free: !r,
      leftover: !!(r && m.leftoverOf),
      kcal,
      protein,
      target: has ? mealTarget(p, m.day, m.slot, m) : null,
      members: [],
    };
    if (has) {
      const share = mealShare(m.slot);
      for (const mb of membersAt(p, m.day, m.slot, m)) {
        const n = memberNeeds(mb);
        const f = portionFactor(mb);
        const row = {
          id: mb.id,
          name: mb.name,
          kcal: r ? Math.round(kcal * f) : 0,
          protein: r ? round2(protein * f) : 0,
          targetKcal: Math.round(n.kcal * share),
          targetProtein: Math.round(n.protein * share),
        };
        out.members.push(row);
        if (!r) continue;
        let tot = day.members.find((x) => x.id === mb.id);
        if (!tot) {
          tot = { id: mb.id, name: mb.name, kcal: 0, protein: 0, targetKcal: 0, targetProtein: 0 };
          day.members.push(tot);
        }
        tot.kcal += row.kcal;
        tot.protein = round2(tot.protein + row.protein);
        tot.targetKcal += row.targetKcal;
        tot.targetProtein += row.targetProtein;
      }
    }
    if (r) {
      day.kcal += kcal;
      day.protein = round2(day.protein + protein);
    }
    day.meals.push(out);
  }
  return { hasTargets: has, days };
}
