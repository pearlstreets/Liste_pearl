// Une seule recette -> lignes de courses, pour la portion choisie. Même format que la liste de la semaine.
import { buildShoppingList } from './shopping';

/**
 * -> { lines, fingerprint }. L'empreinte dépend de la recette, des portions et des paquets :
 * le même appui deux fois n'ajoute rien de plus (addToList répond "already").
 */
export function recipeListLines({ recipe, persons, recipes, ingredients, profile } = {}) {
  if (!recipe || !recipe.id) return { lines: [], fingerprint: '' };
  const n = Math.max(1, Math.round(Number(persons) || 1));
  const plan = {
    meals: [{ key: '0-lunch', day: 0, slot: 'lunch', recipeId: recipe.id, persons: n }],
  };
  const sh = buildShoppingList({ plan, recipes, ingredients, profile });
  const lines = sh.lines || [];
  const fp = lines
    .map((l) => `${l.key}:${l.packs}`)
    .sort()
    .join('|');
  return { lines, fingerprint: `recette:${recipe.id}:${n}:${fp}` };
}
