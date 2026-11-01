// Chargeur paresseux des recettes, ingrédients et traductions (repli sur le français).
// Les require sont statiques (obligatoire pour Metro) mais exécutés à la demande.

import { estObjet, arr, isFreeKey, freeLabel } from './util';
import {
  Catalog,
  isGeneratedId,
  initCatalogAsync,
  resetCatalogCore,
  catalogStatus,
  nowMs,
} from './catalog';
import { resetSearchIndex } from './searchIndex';
import {
  loadTitleBlock,
  loadPhrases,
  titleOf,
  stepsOf,
  releasePacks,
  resetPacks,
  untitledText,
  noStepsText,
} from './packs';

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

const cache = {
  recipes: null,
  ingredients: null,
  packs: {},
  texts: {},
  catalog: null,
  preload: {},
};

/** Toutes les recettes ecrites a la main, valides (tableau, jamais d'exception). Les recettes generees : getCatalog(). */
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

/**
 * Facade de toutes les recettes (ecrites a la main + generees) : get, has, size, sans iteration complete.
 * Le catalogue genere n'est lu qu'au premier acces a une recette generee.
 */
export function getCatalog() {
  if (!cache.catalog) cache.catalog = new Catalog(() => getRecipes());
  return cache.catalog;
}

/** Facade avec les recettes personnelles en plus ({ extra }). Sans extra : la facade partagee. */
export function getRecipeIndex({ extra } = {}) {
  const base = getCatalog();
  return Array.isArray(extra) && extra.length ? base.withCustom(extra) : base;
}

/** Une recette (ecrite a la main ou generee) par identifiant, ou null. */
export function getRecipe(id) {
  return getCatalog().get(id) || null;
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
 * Repli champ par champ : langue demandée, puis français (lu seulement au premier manque), puis l'identifiant
 * lisible. Recette générée : titre de la langue, puis du français, puis « Recette » ; jamais l'identifiant.
 * Synchrone : le catalogue et les packs se chargent à la demande si preloadMenusData n'est pas passé.
 */
export function getTexts(lang) {
  const l = normalizeLang(lang);
  if (cache.texts[l]) return cache.texts[l];
  const cur = loadPack(l);
  const fr = () => (l === 'fr' ? cur : loadPack('fr'));
  const humanize = (s) => String(s || '').replace(/-/g, ' ');
  const texts = {
    lang: l,
    recipeTitle: (id) => {
      if (isGeneratedId(id)) {
        const row = getCatalog().rowOf(id);
        return (
          (row >= 0 && (titleOf(row, l) || (l !== 'fr' && titleOf(row, 'fr')))) || untitledText(l)
        );
      }
      const a = cur && cur.recipes[id] && cur.recipes[id].title;
      if (a) return a;
      const f = fr();
      return (f && f.recipes[id] && f.recipes[id].title) || humanize(id);
    },
    recipeSteps: (id) => {
      if (isGeneratedId(id)) {
        const row = getCatalog().rowOf(id);
        if (row < 0) return [];
        const out = stepsOf(row, l);
        return out.length ? out : [noStepsText(l)];
      }
      const a = cur && cur.recipes[id] && cur.recipes[id].steps;
      if (Array.isArray(a) && a.length) return a;
      const f = fr();
      const b = f && f.recipes[id] && f.recipes[id].steps;
      return Array.isArray(b) ? b : [];
    },
    ingredientName: (key) => {
      if (isFreeKey(key) && freeLabel(key)) return freeLabel(key);
      const a = cur && cur.ingredients[key];
      if (a) return a;
      const f = fr();
      return (f && f.ingredients[key]) || humanize(key);
    },
  };
  cache.texts[l] = texts;
  return texts;
}

const defaultYield = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Prépare les données des menus en tranches courtes (rend la main entre deux tranches) : catalogue généré,
 * titres de la langue, ingrédients et textes de la langue. Ne rejette jamais ; mémoïsée par langue.
 * -> { lang, status: 'ready' | 'degraded', ms, maxSliceMs, slices:[{label, ms}] }
 * Les phrases des étapes se chargent ensuite en tâche de fond (opts.background = false pour l'éviter).
 */
export function preloadMenusData(lang, opts = {}) {
  const l = normalizeLang(lang);
  if (cache.preload[l]) return cache.preload[l];
  const yieldFn = typeof opts.yieldFn === 'function' ? opts.yieldFn : defaultYield;
  const p = (async () => {
    const t0 = nowMs();
    const slices = [];
    const run = (label, fn) => {
      const a = nowMs();
      try {
        fn();
      } catch {
        /* jamais bloquant */
      }
      slices.push({ label, ms: nowMs() - a });
    };
    try {
      const init = await initCatalogAsync(yieldFn);
      init.slices.forEach((ms, i) => slices.push({ label: 'catalogue-' + i, ms }));
      const core = init.core;
      if (core.status === 'ready') {
        for (let b = 0; b < core.nBlocks; b++) {
          run('titres-' + l + '-' + b, () => loadTitleBlock(l, b));
          await yieldFn();
        }
      }
      run('ingredients', getIngredients);
      await yieldFn();
      run('textes-' + l, () => loadPack(l));
      releasePacks([l, 'fr']);
    } catch {
      /* le catalogue ne leve jamais ; filet de securite */
    }
    const status = catalogStatus().status === 'degraded' ? 'degraded' : 'ready';
    if (status === 'ready' && opts.background !== false)
      setTimeout(() => {
        try {
          loadPhrases(l);
        } catch {
          /* rien */
        }
      }, 0);
    return {
      lang: l,
      status,
      ms: nowMs() - t0,
      maxSliceMs: slices.reduce((m, x) => Math.max(m, x.ms), 0),
      slices,
    };
  })();
  cache.preload[l] = p;
  return p;
}

/** État du catalogue généré : 'idle' (pas encore chargé), 'ready' ou 'degraded' (recettes écrites à la main seules). */
export function getCatalogStatus() {
  return catalogStatus().status;
}

/** Pour les tests : vide la mémoire (recettes, ingrédients, textes, catalogue généré, packs). */
export function resetMenusCache() {
  cache.recipes = null;
  cache.ingredients = null;
  cache.packs = {};
  cache.texts = {};
  cache.catalog = null;
  cache.preload = {};
  resetCatalogCore();
  resetPacks();
  resetSearchIndex();
}
