#!/usr/bin/env node
// Manifeste des photos distantes pour l'application : quelles recettes et quels ingrédients ont une photo
// en ligne, sous une forme compacte, avec un numéro de version qui change l'adresse (cache cassé).
//
//   node scripts/menus-photos/manifeste.js <dossier-sortie> <fichier-manifeste.js|.json> --version N
//        [--refus a-refaire.json] [--dimension 640]
//
// Seules les images valides (non vides, N x N) et absentes de la liste --refus entrent au manifeste.
// Le fichier produit est à placer ensuite dans lib/menus (ce script ne l'écrit jamais dans le dépôt).
//
// Encodage (module ES) :
//   PHOTOS_VERSION   entier ; préfixe en ligne uploads/list-menus/v<N>/ (recettes) et .../ingredients/
//   PHOTOS_GEN_N     nombre de cases du catalogue généré au moment du manifeste
//   PHOTOS_GEN       bitset en base 64 (alphabet de lib/menus/b64.js, 6 cases par caractère) :
//                    la case r (id g-<r en base 36>) a une photo si (readInt(PHOTOS_GEN, r / 6 | 0, 1) >> (r % 6)) & 1
//   PHOTOS_RECETTES  identifiants des recettes écrites à la main qui ont une photo distante (triés)
//   PHOTOS_INGREDIENTS clés d'ingrédients qui ont une vignette distante (triées)
'use strict';
/* global __dirname */

const fs = require('fs');
const path = require('path');
const IMG = require('./images');
const { fichiersDe } = require('./controle');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const GEN_RE = /^g-([0-9a-z]+)$/;

function lireArgs(argv) {
  const o = { sortie: null, fichier: null, version: null, refus: null, dimension: 640 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version') o.version = parseInt(argv[++i], 10);
    else if (a === '--refus') o.refus = argv[++i];
    else if (a === '--dimension') o.dimension = parseInt(argv[++i], 10);
    else if (a.startsWith('--')) throw new Error(`option inconnue : ${a}`);
    else if (!o.sortie) o.sortie = a;
    else if (!o.fichier) o.fichier = a;
    else throw new Error(`argument en trop : ${a}`);
  }
  if (!o.sortie || !o.fichier || !(o.version >= 1))
    throw new Error('usage : manifeste.js <dossier-sortie> <fichier> --version N');
  return o;
}

/** Bitset base 64 : 6 cases par caractère, bit (r % 6) du caractère r / 6. */
function encoderBitset(rows, n) {
  const mots = new Uint8Array(Math.ceil(n / 6));
  for (const r of rows) if (r >= 0 && r < n) mots[(r / 6) | 0] |= 1 << (r % 6);
  let s = '';
  for (const v of mots) s += ALPHABET[v];
  return s;
}

function decoderBitset(s, n) {
  const out = [];
  for (let r = 0; r < n; r++) if ((ALPHABET.indexOf(s[(r / 6) | 0]) >> (r % 6)) & 1) out.push(r);
  return out;
}

/** Calcule le manifeste. ctx : { genN, recettesMain:Set, ingredients:Set } (données actuelles). */
function construire(o, ctx) {
  const refus = new Set();
  if (o.refus)
    for (const id of JSON.parse(fs.readFileSync(o.refus, 'utf8')).ids || []) refus.add(id);
  const rows = [];
  const recettes = [];
  const ingredients = [];
  const ecartes = [];
  for (const el of fichiersDe(o.sortie)) {
    if (!el.fichier.endsWith('.webp')) {
      ecartes.push(`${el.id} (pas en WebP)`);
      continue;
    }
    if (refus.has(el.id)) {
      ecartes.push(`${el.id} (à refaire)`);
      continue;
    }
    const buf = fs.readFileSync(el.fichier);
    const d = buf.length ? IMG.dimensions(buf) : null;
    if (!d || d.largeur !== o.dimension || d.hauteur !== o.dimension) {
      ecartes.push(`${el.id} (invalide)`);
      continue;
    }
    if (el.type === 'ingredient') {
      if (ctx.ingredients.has(el.id)) ingredients.push(el.id);
      else ecartes.push(`${el.id} (ingrédient inconnu)`);
      continue;
    }
    const m = GEN_RE.exec(el.id);
    if (m) {
      const r = parseInt(m[1], 36);
      if (r.toString(36) === m[1] && r < ctx.genN) rows.push(r);
      else ecartes.push(`${el.id} (case inconnue)`);
    } else if (ctx.recettesMain.has(el.id)) recettes.push(el.id);
    else ecartes.push(`${el.id} (recette inconnue)`);
  }
  recettes.sort();
  ingredients.sort();
  rows.sort((a, b) => a - b);
  return {
    version: o.version,
    prefixe: `uploads/list-menus/v${o.version}`,
    genN: ctx.genN,
    gen: encoderBitset(rows, ctx.genN),
    nGen: rows.length,
    recettes,
    ingredients,
    ecartes,
  };
}

function ecrire(fichier, m) {
  if (fichier.endsWith('.json')) {
    const { ecartes: _ecartes, ...rest } = m;
    fs.writeFileSync(fichier, JSON.stringify(rest));
    return;
  }
  const liste = (a) => (a.length ? `[\n  '${a.join("',\n  '")}',\n]` : '[]');
  const js =
    `// Genere par scripts/menus-photos/manifeste.js : ne pas modifier a la main.\n` +
    `// Photos distantes : ${m.nGen} recettes generees, ${m.recettes.length} recettes ecrites a la main, ${m.ingredients.length} ingredients.\n` +
    `// Bitset : la case r a une photo si (readInt(PHOTOS_GEN, (r / 6) | 0, 1) >> (r % 6)) & 1 (readInt de ./b64).\n` +
    `export const PHOTOS_VERSION = ${m.version};\n` +
    `export const PHOTOS_PREFIXE = '${m.prefixe}';\n` +
    `export const PHOTOS_GEN_N = ${m.genN};\n` +
    `export const PHOTOS_GEN =\n  '${m.gen}';\n` +
    `export const PHOTOS_RECETTES = ${liste(m.recettes)};\n` +
    `export const PHOTOS_INGREDIENTS = ${liste(m.ingredients)};\n`;
  fs.writeFileSync(fichier, js);
}

function main() {
  const o = lireArgs(process.argv.slice(2));
  const RACINE = path.resolve(__dirname, '..', '..');
  const f = path.resolve(o.fichier);
  const rel = path.relative(path.join(RACINE, 'lib'), f);
  if (!rel.startsWith('..') && !path.isAbsolute(rel))
    throw new Error('le manifeste ne s’écrit pas dans lib/ : sortez-le ailleurs puis copiez-le');
  const meta = require(path.join(RACINE, 'data', 'menus', 'gen', 'meta.js'));
  const recettesMain = new Set(
    require(path.join(RACINE, 'data', 'menus', 'recipes.json')).map((r) => r.id)
  );
  const ingredients = new Set(
    Object.keys(require(path.join(RACINE, 'data', 'menus', 'ingredients.json')))
  );
  const m = construire(o, { genN: meta.N, recettesMain, ingredients });
  ecrire(f, m);
  console.log(
    `Manifeste v${m.version} : ${m.nGen} recettes générées, ${m.recettes.length} écrites à la main, ${m.ingredients.length} ingrédients ; ${m.ecartes.length} écartées. ${f} (${fs.statSync(f).size} octets)`
  );
  for (const e of m.ecartes.slice(0, 10)) console.log(`  écartée : ${e}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`Erreur : ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { encoderBitset, decoderBitset, construire, ecrire, lireArgs };
