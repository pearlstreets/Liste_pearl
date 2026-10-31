// Chargeur paresseux des recettes, ingrédients et traductions (repli sur le français).
// Les require sont statiques (obligatoire pour Metro) mais exécutés à la demande.
/* eslint-disable global-require */
import { estObjet, arr } from './util';

export const MENU_LANGS = [
  'fr',
  'en',
  'de',
  'es',
  'it',
  'pt',
  'nl',
  'ru',
  'zh',
  'ja',
  'ar',
  'sv',
  'th',
];

export function normalizeLang(lang) {
  const l = String(lang || 'fr')
    .toLowerCase()
    .replace('_', '-');
  const short = l.split('-')[0];
  if (short === 'cn') return 'zh';
  if (short === 'jp') return 'ja';
  if (short === 'se') return 'sv';
  if (short === 'us' || short === 'gb') return 'en';
  if (short === 'sa') return 'ar';
  return MENU_LANGS.includes(short) ? short : 'fr';
}

function requirePack(lang) {
  switch (lang) {
    case 'fr':
      return require('../../data/menus/i18n/fr.json');
    case 'en':
      return require('../../data/menus/i18n/en.json');
    case 'de':
      return require('../../data/menus/i18n/de.json');
    case 'es':
      return require('../../data/menus/i18n/es.json');
    case 'it':
      return require('../../data/menus/i18n/it.json');
    case 'pt':
      return require('../../data/menus/i18n/pt.json');
    case 'nl':
      return require('../../data/menus/i18n/nl.json');
    case 'ru':
      return require('../../data/menus/i18n/ru.json');
    case 'zh':
      return require('../../data/menus/i18n/zh.json');
    case 'ja':
      return require('../../data/menus/i18n/ja.json');
    case 'ar':
      return require('../../data/menus/i18n/ar.json');
    case 'sv':
      return require('../../data/menus/i18n/sv.json');
    case 'th':
      return require('../../data/menus/i18n/th.json');
    default:
      return null;
  }
}

const cache = { recipes: null, ingredients: null, packs: {} };

/** Toutes les recettes valides (tableau, jamais d'exception). */
export function getRecipes() {
  if (cache.recipes) return cache.recipes;
  let raw = [];
  try {
    raw = require('../../data/menus/recipes.json');
  } catch {
    raw = [];
  }
  const list = (Array.isArray(raw) ? raw : arr(raw && raw.recipes)).filter(
    (r) => estObjet(r) && typeof r.id === 'string' && Array.isArray(r.ingredients)
  );
  cache.recipes = list;
  return list;
}

export function getRecipe(id) {
  return getRecipes().find((r) => r.id === id) || null;
}

/** Table des ingrédients (objet clé -> fiche). */
export function getIngredients() {
  if (cache.ingredients) return cache.ingredients;
  let raw = {};
  try {
    raw = require('../../data/menus/ingredients.json');
  } catch {
    raw = {};
  }
  cache.ingredients = estObjet(raw) ? raw : {};
  return cache.ingredients;
}

function loadPack(lang) {
  if (cache.packs[lang] !== undefined) return cache.packs[lang];
  let p = null;
  try {
    p = requirePack(lang);
  } catch {
    p = null;
  }
  cache.packs[lang] = estObjet(p)
    ? {
        recipes: estObjet(p.recipes) ? p.recipes : {},
        ingredients: estObjet(p.ingredients) ? p.ingredients : {},
      }
    : null;
  return cache.packs[lang];
}

/**
 * getTexts(lang) -> { lang, recipeTitle(id), recipeSteps(id), ingredientName(key) }
 * Repli champ par champ : langue demandée, puis français, puis l'identifiant lisible.
 */
export function getTexts(lang) {
  const l = normalizeLang(lang);
  const cur = loadPack(l);
  const fr = l === 'fr' ? cur : loadPack('fr');
  const humanize = (s) => String(s || '').replace(/-/g, ' ');
  return {
    lang: l,
    recipeTitle: (id) =>
      (cur && cur.recipes[id] && cur.recipes[id].title) ||
      (fr && fr.recipes[id] && fr.recipes[id].title) ||
      humanize(id),
    recipeSteps: (id) => {
      const a = cur && cur.recipes[id] && cur.recipes[id].steps;
      if (Array.isArray(a) && a.length) return a;
      const b = fr && fr.recipes[id] && fr.recipes[id].steps;
      return Array.isArray(b) ? b : [];
    },
    ingredientName: (key) =>
      (cur && cur.ingredients[key]) || (fr && fr.ingredients[key]) || humanize(key),
  };
}

/** Pour les tests : vide la mémoire. */
export function resetMenusCache() {
  cache.recipes = null;
  cache.ingredients = null;
  cache.packs = {};
}
