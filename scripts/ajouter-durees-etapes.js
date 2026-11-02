// Ajoute stepDurations (secondes par étape) aux recettes écrites à la main : la durée lue dans le
// texte français d'une étape qui n'a pas déjà de minuteur (stepTimers). Le mode cuisine s'en sert
// pour proposer un minuteur ; la cuisine en lot (stepTimers) n'est pas touchée.
// Usage : node scripts/ajouter-durees-etapes.js
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../data/menus/recipes.json');
const recipes = JSON.parse(fs.readFileSync(file, 'utf8'));
const fr = require('../data/menus/i18n/fr.json');

// « 2 minutes avant la fin », « les 30 dernières minutes » : un moment, pas une durée
const PAS_UNE_DUREE = /avant la fin|derni[eè]res?/i;
const DUREE = /(\d+)\s*(minutes?|min\b|heures?|h\b)/i;

let n = 0;
for (const r of recipes) {
  const steps = (fr.recipes[r.id] || {}).steps || [];
  const out = {};
  steps.forEach((txt, i) => {
    if (r.stepTimers && r.stepTimers[String(i)]) return;
    if (PAS_UNE_DUREE.test(txt)) return;
    const m = txt.match(DUREE);
    if (!m) return;
    const q = Number(m[1]);
    const sec = /^h/i.test(m[2]) ? q * 3600 : q * 60;
    if (sec > 0) out[String(i)] = sec;
  });
  if (Object.keys(out).length) {
    r.stepDurations = out;
    n += Object.keys(out).length;
  } else delete r.stepDurations;
}

fs.writeFileSync(file, `${JSON.stringify(recipes, null, 1)}\n`);
console.log(`${n} étapes avec une durée`);
