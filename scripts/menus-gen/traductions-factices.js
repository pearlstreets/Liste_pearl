#!/usr/bin/env node
// Fabrique de FAUSSES traductions pour essayer l'integration (build-menus.js --traductions) sans toucher aux vraies donnees.
// Chaque texte francais recoit un prefixe de langue (dans l'ecriture attendue pour ru, ar, th, zh, ja). Les chiffres sont gardes.
//
// Usage : node scripts/menus-gen/traductions-factices.js <dossier-a-traduire> <dossier-sortie> [langues separees par des virgules]
//   <dossier-a-traduire> : sortie de build-menus.js --a-traduire (titres.json, phrases.json, ingredients.json)
//   <dossier-sortie>     : recoit <langue>/ingredients.json, <langue>/phrases-<k>.json, <langue>/titres-<k>.json
'use strict';
const fs = require('fs');
const path = require('path');

const LANGUES = ['en', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ar', 'sv', 'th'];
const PREFIXE = { ru: 'Блюдо ', zh: '菜 ', ja: '料理 ', ar: 'طبق ', th: 'จาน ' };
const PAR_FICHIER = 4000;

const [aTraduire, sortie, liste] = process.argv.slice(2);
if (!aTraduire || !sortie) {
  console.error('Usage : node scripts/menus-gen/traductions-factices.js <dossier-a-traduire> <dossier-sortie> [langues]');
  process.exit(2);
}
const langues = liste ? liste.split(',') : LANGUES;
const lireJson = (f) => JSON.parse(fs.readFileSync(path.join(aTraduire, f), 'utf8'));
const titres = lireJson('titres.json');
const phrases = lireJson('phrases.json');
const ingredients = lireJson('ingredients.json');

for (const lang of langues) {
  const pre = PREFIXE[lang] || `[${lang}] `;
  const dir = path.join(sortie, lang);
  fs.mkdirSync(dir, { recursive: true });
  const ecrire = (nom, data) => fs.writeFileSync(path.join(dir, nom), JSON.stringify(data) + '\n');
  ecrire('ingredients.json', ingredients.map((e) => ({ cle: e.cle, t: pre + e.fr })));
  const decouper = (liste, prefixeFichier) => {
    for (let k = 0, n = 0; k < liste.length; k += PAR_FICHIER, n++) {
      ecrire(`${prefixeFichier}-${n}.json`, liste.slice(k, k + PAR_FICHIER).filter((e) => e.fr !== '-').map((e) => ({ i: e.i, t: pre + e.fr })));
    }
  };
  decouper(titres, 'titres');
  decouper(phrases, 'phrases');
}
console.log(`${langues.length} langue(s) ecrite(s) dans ${sortie}`);
