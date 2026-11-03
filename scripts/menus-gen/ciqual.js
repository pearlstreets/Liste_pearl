#!/usr/bin/env node
// Valeurs nutritionnelles des ingrédients (pour 100 g) tirées de la table Ciqual de l'Anses.
// Déterministe : même table et même correspondance = même fichier, octet pour octet.
//
// Source : table de composition nutritionnelle des aliments Ciqual 2020, Anses, version du 07/07/2020,
// format XML (XML_2020_07_07.zip), licence Ouverte Etalab 2.0. Pages :
//   https://www.data.gouv.fr/fr/datasets/table-de-composition-nutritionnelle-des-aliments-ciqual/
//   https://ciqual.anses.fr/ (onglet Téléchargement)
// Le fichier est téléchargé à la main dans un dossier hors dépôt, puis dézippé (aucun compte).
//
// Usage :
//   node scripts/menus-gen/ciqual.js <dossier-xml>                 écrit data/menus/nutrients.json et affiche
//                                                                  le rapport (écarts avec les kcal existantes)
//   node scripts/menus-gen/ciqual.js <dossier-xml> --check         recalcule et compare au fichier du dépôt
//   node scripts/menus-gen/ciqual.js <dossier-xml> --chercher <mots...>   liste les aliments Ciqual dont le nom
//                                                                  contient tous les mots (aide à la correspondance)
//
// Correspondance relue ingrédient par ingrédient : scripts/menus-gen/sources/ciqual-correspondance.json
//   { "<clé ingrédient>": <code aliment Ciqual> | null, ... }   null = aucune correspondance sûre, pas de valeur.
//   Ce fichier est écrit par node scripts/menus-gen/ciqual-correspondance-source.js (codes retenus, notes et
//   choix relus dans scripts/menus-gen/sources/ciqual-notes.json).
// Énergie absente de Ciqual (aliments génériques) : calculée par les coefficients du règlement UE 1169/2011.
// Les valeurs « traces » valent 0 ; « < x » vaut x / 2 ; « - » (non renseigné) reste inconnu (null).
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CORRESP = path.join(__dirname, 'sources', 'ciqual-correspondance.json');
const CORRESP_GEN = path.join(__dirname, 'sources', 'correspondance-ingredients.json');
const INGREDIENTS = path.join(ROOT, 'data', 'menus', 'ingredients.json');
const OUT = path.join(ROOT, 'data', 'menus', 'nutrients.json');

// Ordre des colonnes du fichier écrit, et constituant Ciqual de chacune.
const CHAMPS = [
  ['kj', 327], // énergie, règlement UE 1169/2011 (kJ)
  ['kcal', 328], // énergie, règlement UE 1169/2011 (kcal)
  ['lipides', 40000],
  ['satures', 40302], // AG saturés
  ['glucides', 31000],
  ['sucres', 32000],
  ['fibres', 34100],
  ['proteines', 25000], // protéines, N x facteur de Jones
  ['sel', 10004], // sel chlorure de sodium
];
// Énergie de secours quand celle du règlement UE manque : N x facteur de Jones, avec fibres.
const KJ_SECOURS = 332;
const KCAL_SECOURS = 333;
const ALCOOL = 60000;
const ACIDES = 65000; // acides organiques
const POLYOLS = 34000;
const CODES = new Set([...CHAMPS.map((c) => c[1]), KJ_SECOURS, KCAL_SECOURS, ALCOOL, ACIDES, POLYOLS]);
// Écart toléré avec les kcal et protéines déjà utilisées par le générateur : au-delà, à revoir.
const SEUIL_ECART = 0.25;

function echec(msg) {
  process.stderr.write(`ciqual : ${msg}\n`);
  process.exit(1);
}

const lire = (f) => {
  if (!fs.existsSync(f)) echec(`fichier introuvable : ${f}`);
  return fs.readFileSync(f, 'latin1'); // table publiée en windows-1252
};
const champ = (bloc, nom) => {
  const m = new RegExp(`<${nom}>([^<]*)</${nom}>`).exec(bloc);
  return m ? m[1].trim() : null;
};
const fichier = (dir, prefixe) => {
  const f = fs.readdirSync(dir).find((n) => n.startsWith(prefixe) && n.endsWith('.xml'));
  if (!f) echec(`${prefixe}*.xml absent de ${dir}`);
  return path.join(dir, f);
};

/** Valeur Ciqual en nombre : « 2,5 » 2.5 ; « traces » 0 ; « < 0,5 » 0.25 ; « - » ou vide null. */
function valeur(txt) {
  if (txt === null) return null;
  const t = txt.trim().toLowerCase();
  if (!t || t === '-') return null;
  if (t === 'traces') return 0;
  const m = /^(<)?\s*([0-9]+(?:,[0-9]+)?)$/.exec(t);
  if (!m) return null;
  const v = Number(m[2].replace(',', '.'));
  return m[1] ? v / 2 : v;
}

function lireTable(dir) {
  const aliments = new Map(); // code -> { code, nom, grp }
  const alimXml = lire(fichier(dir, 'alim_2'));
  for (const b of alimXml.split('<ALIM>').slice(1)) {
    const code = Number(champ(b, 'alim_code'));
    aliments.set(code, {
      code,
      nom: champ(b, 'alim_nom_fr'),
      grp: champ(b, 'alim_ssssgrp_code') || champ(b, 'alim_ssgrp_code'),
      v: {},
    });
  }
  const compo = lire(fichier(dir, 'compo_'));
  const re =
    /<COMPO>\s*<alim_code>([^<]*)<\/alim_code>\s*<const_code>([^<]*)<\/const_code>\s*<teneur>([^<]*)<\/teneur>/g;
  let m;
  let n = 0;
  while ((m = re.exec(compo))) {
    n++;
    const cc = Number(m[2]);
    if (!CODES.has(cc)) continue;
    const a = aliments.get(Number(m[1]));
    if (a) a.v[cc] = valeur(m[3]);
  }
  if (aliments.size < 3000 || n < 100000) echec(`table incomplète (${aliments.size} aliments, ${n} teneurs)`);
  return aliments;
}

const sansAccents = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function chercher(aliments, mots) {
  const ms = mots.map(sansAccents);
  for (const a of aliments.values()) {
    const n = sansAccents(a.nom);
    if (ms.every((w) => n.includes(w)))
      console.log(
        [a.code, a.nom, ...CHAMPS.map(([c, cc]) => `${c} ${a.v[cc]}`), `kcal-fibres ${a.v[KCAL_SECOURS]}`].join('\t')
      );
  }
}

const arrondi = (v) => (v === null || v === undefined ? null : Math.round(v * 100) / 100);

// Kcal et protéines pour 100 g déjà utilisées par le générateur (par clé, valeur la plus fréquente).
function existantes() {
  const out = {};
  for (const e of JSON.parse(fs.readFileSync(CORRESP_GEN, 'utf8'))) {
    if (!e.nutrition || !(e.nutrition.kcal_100 >= 0)) continue;
    (out[e.cle] = out[e.cle] || []).push(e.nutrition);
  }
  return out;
}

// Poids d'une pièce (unité « u ») utilisé par le générateur pour ses kcal (g_par_u), quand il est unique.
function poidsPieces() {
  const par = {};
  for (const e of JSON.parse(fs.readFileSync(CORRESP_GEN, 'utf8'))) {
    const g = e.nutrition && e.nutrition.g_par_u;
    if (g > 0) (par[e.cle] = par[e.cle] || new Set()).add(g);
  }
  const out = {};
  for (const [k, s] of Object.entries(par)) if (s.size === 1) out[k] = [...s][0];
  return out;
}

// Coefficients du règlement UE 1169/2011 (annexe XIV), kcal et kJ par gramme : énergie calculée quand
// Ciqual ne la donne pas (aliments génériques dont un constituant mineur manque).
const COEF = [
  [25000, 4, 17], // protéines
  [31000, 4, 17], // glucides
  [40000, 9, 37], // lipides
  [34100, 2, 8], // fibres
  [ALCOOL, 7, 29],
  [ACIDES, 3, 13],
  [POLYOLS, 2.4, 10],
];
function energieCalculee(v) {
  // au moins deux des trois (protéines, glucides, lipides) connus ; un constituant non renseigné vaut 0
  if (COEF.slice(0, 3).filter(([cc]) => v[cc] === null || v[cc] === undefined).length > 1) return null;
  let kcal = 0;
  let kj = 0;
  for (const [cc, c, j] of COEF) {
    kcal += (v[cc] || 0) * c;
    kj += (v[cc] || 0) * j;
  }
  return [Math.round(kj * 10) / 10, Math.round(kcal * 10) / 10];
}

/** Valeurs d'un ingrédient : le premier aliment qui a la valeur la donne (liste de codes possible). */
function valeursDe(k, codes, aliments) {
  const as = codes.map((c) => {
    const a = aliments.get(c);
    if (!a) echec(`${k} : aliment Ciqual ${c} introuvable`);
    return a;
  });
  const v = {};
  for (const cc of CODES) {
    const a = as.find((x) => x.v[cc] !== null && x.v[cc] !== undefined);
    v[cc] = a ? a.v[cc] : null;
  }
  const ligne = CHAMPS.map(([, cc]) => arrondi(v[cc]));
  // Énergie du règlement UE absente : énergie avec fibres de Ciqual, sinon calculée par les coefficients UE.
  if (ligne[1] === null) {
    const kc = v[KCAL_SECOURS];
    const kj = v[KJ_SECOURS];
    const calc = kc === null || kc === undefined ? energieCalculee(v) : null;
    ligne[0] = calc ? calc[0] : arrondi(kj);
    ligne[1] = calc ? calc[1] : arrondi(kc);
  }
  if (ligne[0] === null && ligne[1] !== null) ligne[0] = Math.round(ligne[1] * 4.184);
  if (ligne[1] === null) echec(`${k} : aliment Ciqual ${codes.join(', ')} sans énergie`);
  return { ligne, nom: as[0].nom };
}

function construire(aliments) {
  const ings = JSON.parse(fs.readFileSync(INGREDIENTS, 'utf8'));
  const corr = JSON.parse(fs.readFileSync(CORRESP, 'utf8'));
  const cles = Object.keys(ings);
  for (const k of cles) if (!(k in corr)) echec(`ingrédient sans ligne de correspondance : ${k}`);
  for (const k of Object.keys(corr))
    if (!k.startsWith('_') && !(k in ings)) echec(`correspondance pour une clé inconnue : ${k}`);
  const pieces = poidsPieces();
  const valeurs = {};
  const ecarts = [];
  const sans = [];
  const ex = existantes();
  for (const k of cles) {
    const c = corr[k];
    if (c === null) {
      sans.push(k);
      continue;
    }
    const codes = Array.isArray(c) ? c : [c];
    if (!codes.length || codes.some((x) => !Number.isInteger(x))) echec(`${k} : code Ciqual invalide`);
    const { ligne, nom } = valeursDe(k, codes, aliments);
    valeurs[k] = [...ligne, codes[0]];
    const vus = new Set();
    for (const nu of ex[k] || []) {
      const cle = `${nu.kcal_100}/${nu.prot_100}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      const kc = ligne[1];
      const p = ligne[7];
      const dk = nu.kcal_100 > 0 ? Math.abs(kc - nu.kcal_100) / nu.kcal_100 : kc > 5 ? 1 : 0;
      const dp = p !== null && nu.prot_100 >= 2 ? Math.abs(p - nu.prot_100) / nu.prot_100 : 0;
      if (dk > SEUIL_ECART || dp > SEUIL_ECART)
        ecarts.push(
          `${k} (${codes[0]} ${nom}) : Ciqual ${kc} kcal ${p} g prot, générateur ${nu.kcal_100} kcal ${nu.prot_100} g prot`
        );
    }
  }
  const out = {
    _source:
      'Table de composition nutritionnelle des aliments Ciqual 2020, Anses (version du 07/07/2020), https://ciqual.anses.fr/',
    _licence: 'Licence Ouverte Etalab 2.0, https://www.etalab.gouv.fr/licence-ouverte-open-licence/',
    _script: 'scripts/menus-gen/ciqual.js, correspondance scripts/menus-gen/sources/ciqual-correspondance.json',
    _unite: 'pour 100 g (ou 100 ml) de produit tel que vendu, cru en général ; null = non renseigné',
    _champs: [...CHAMPS.map((c) => c[0]), 'ciqual'],
    _poidsPiece: pieces,
    valeurs,
  };
  return { out, ecarts, sans, n: cles.length };
}

function format(out) {
  // Une ligne par ingrédient : compact et lisible dans un diff.
  const l = ['{'];
  for (const k of ['_source', '_licence', '_script', '_unite'])
    l.push(` ${JSON.stringify(k)}: ${JSON.stringify(out[k])},`);
  l.push(` "_champs": ${JSON.stringify(out._champs)},`);
  l.push(` "_poidsPiece": ${JSON.stringify(out._poidsPiece)},`);
  l.push(' "valeurs": {');
  const ks = Object.keys(out.valeurs);
  ks.forEach((k, i) =>
    l.push(`  ${JSON.stringify(k)}: ${JSON.stringify(out.valeurs[k])}${i < ks.length - 1 ? ',' : ''}`)
  );
  l.push(' }', '}', '');
  return l.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const dir = argv[0];
  if (!dir || dir.startsWith('--')) echec('usage : node scripts/menus-gen/ciqual.js <dossier-xml> [--check | --chercher <mots>]');
  const aliments = lireTable(path.resolve(dir));
  const iC = argv.indexOf('--chercher');
  if (iC >= 0) return chercher(aliments, argv.slice(iC + 1));
  const { out, ecarts, sans, n } = construire(aliments);
  const txt = format(out);
  if (argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== txt) echec('data/menus/nutrients.json diffère du calcul : relancer sans --check');
    console.log('nutrients.json à jour');
    return;
  }
  fs.writeFileSync(OUT, txt);
  console.log(`${n - sans.length} / ${n} ingrédients avec valeurs, ${sans.length} sans correspondance sûre`);
  if (sans.length) console.log(`sans valeur : ${sans.join(', ')}`);
  console.log(`${ecarts.length} écarts > ${SEUIL_ECART * 100} % avec les kcal ou protéines du générateur :`);
  for (const e of ecarts) console.log(`  ${e}`);
}

main();
