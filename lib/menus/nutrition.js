// Apports par jour (par portion adulte, repas libres non comptés).
import { estObjet, estNombre, arr, round2, indexRecipes } from './util';

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
