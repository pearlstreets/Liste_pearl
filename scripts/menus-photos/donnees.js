// Données des recettes et ingrédients pour la chaîne de photos IA (scripts seulement, jamais dans l'app).
// Le cœur lib/menus/catalog.js est écrit en modules ES : on le charge via @babel/core, limité à lib/menus.
'use strict';
/* global __dirname */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const RACINE = path.resolve(__dirname, '..', '..');
const LIB_MENUS = path.join(RACINE, 'lib', 'menus') + path.sep;
const DATA = path.join(RACINE, 'data', 'menus');

let hookPose = false;
function poserHookBabel() {
  if (hookPose) return;
  hookPose = true;
  const babel = require('@babel/core');
  const origine = Module._extensions['.js'];
  Module._extensions['.js'] = function charger(mod, fichier) {
    if (!fichier.startsWith(LIB_MENUS)) return origine(mod, fichier);
    const src = fs.readFileSync(fichier, 'utf8');
    const out = babel.transformSync(src, {
      filename: fichier,
      babelrc: false,
      configFile: false,
      presets: [require.resolve('babel-preset-expo')],
      sourceMaps: false,
    });
    mod._compile(out.code, fichier);
  };
}

let cache = null;

/** Charge tout une fois : { recettes, ingredients, catalogue, enIng, cleIng }. */
function charger() {
  if (cache) return cache;
  poserHookBabel();
  const { Catalog, getCore } = require(path.join(RACINE, 'lib', 'menus', 'catalog.js'));
  const recettesMain = require(path.join(DATA, 'recipes.json'));
  const ingredients = require(path.join(DATA, 'ingredients.json'));
  const en = require(path.join(DATA, 'i18n', 'en.json'));
  const fr = require(path.join(DATA, 'i18n', 'fr.json'));
  const catalogue = new Catalog(recettesMain);
  const core = getCore();
  if (core.status !== 'ready') throw new Error(`catalogue généré illisible : ${core.reason}`);
  cache = { recettesMain, ingredients, en, fr, catalogue, core };
  return cache;
}

const titresEn = new Map();
/** Titre anglais d'une recette générée (data/menus/gen/lang/en-titles-<bloc>.js), ou ''. */
function titreGenereEn(row) {
  const { core } = charger();
  const bloc = Math.floor(row / core.SHARD);
  if (!titresEn.has(bloc)) {
    const f = path.join(DATA, 'gen', 'lang', `en-titles-${bloc}.js`);
    titresEn.set(bloc, fs.existsSync(f) ? String(require(f)).split('\n') : []);
  }
  return titresEn.get(bloc)[row % core.SHARD] || '';
}

let phrasesEn = null;
/** Étapes anglaises d'une recette générée (phrases de data/menus/gen/lang/en-steps.js), ou []. */
function etapesGenereEn(row) {
  const { core } = charger();
  const { phraseGroups } = require(path.join(RACINE, 'lib', 'menus', 'catalog.js'));
  const groupes = phraseGroups(core, row);
  if (!groupes) return [];
  if (!phrasesEn) {
    const f = path.join(DATA, 'gen', 'lang', 'en-steps.js');
    phrasesEn = fs.existsSync(f) ? String(require(f)).split('\n') : [];
  }
  return groupes
    .map((g) =>
      g
        .map((id) => phrasesEn[id] || '')
        .join(' ')
        .trim()
    )
    .filter(Boolean);
}

/** Nom anglais d'un ingrédient, sans précision entre parenthèses. */
function nomIngredientEn(cle) {
  const { en } = charger();
  const n = (en.ingredients && en.ingredients[cle]) || cle.replace(/-/g, ' ');
  return n
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recettes sans photo : les écrites à la main avec "image": false, puis toutes les générées non retirées.
 * Chaque élément : { id, type:'recette', source:'main'|'gen', recette, titre }.
 */
function recettesSansPhoto() {
  const { recettesMain, en, catalogue, core } = charger();
  const out = [];
  for (const r of recettesMain) {
    if (r && r.image === false) {
      const t = en.recipes && en.recipes[r.id] && en.recipes[r.id].title;
      out.push({ id: r.id, type: 'recette', source: 'main', recette: r, titre: t || r.id });
    }
  }
  for (let row = 0; row < core.N; row++) {
    const r = catalogue.materialize(row);
    if (!r) continue; // case retirée
    out.push({
      id: r.id,
      type: 'recette',
      source: 'gen',
      recette: r,
      titre: titreGenereEn(row),
      etapes: etapesGenereEn(row),
    });
  }
  return out;
}

/** Les 317 ingrédients : { id, type:'ingredient', cle, info, nom }. */
function ingredientsTous() {
  const { ingredients } = charger();
  return Object.keys(ingredients).map((cle) => ({
    id: cle,
    type: 'ingredient',
    cle,
    info: ingredients[cle],
    nom: nomIngredientEn(cle),
  }));
}

module.exports = {
  RACINE,
  charger,
  recettesSansPhoto,
  ingredientsTous,
  nomIngredientEn,
  titreGenereEn,
  etapesGenereEn,
};
