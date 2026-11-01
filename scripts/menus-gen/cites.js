// Ingredients cites dans les etapes francaises : un mot de cette liste demande un ingredient correspondant dans la
// recette, sinon il manque aux courses et aux exclusions (« dans le beurre » sans beurre). Commun au build (recettes
// generees : l'ingredient est ajoute) et a validate-menus.js (recettes ecrites a la main : erreur).
// Ajouts au format du generateur [nom de correspondance-ingredients.json, quantite, unite] pour 4 personnes.
'use strict';
const { norm } = require('./regimes');

const aPorc = (k, ings) => ((ings[k] && ings[k].allergens) || []).includes('porc');

const REGLES = [
  {
    id: 'beurre',
    re: /\b(beurre|beurres|beurrer|beurrez)\b/,
    sauf: ['beurre de cacahuete'],
    ok: (k) => k === 'beurre' || k === 'beurre-demi-sel',
    // noix de beurre ou moule beurre : 10 g ; cuisson dans le beurre : 20 g
    ajout: (t) => (/\bnoix de beurre\b|\bmoule\b[^.]*\bbeurre\b|\bbeurrer\b|\bbeurrez\b/.test(t) && !/\bdans le beurre\b/.test(t) ? ['beurre', 10, 'g'] : ['beurre', 20, 'g']),
  },
  // huile de sesame : allergene sesame, jamais remplacee par une autre huile
  { id: 'huile-sesame', re: /\bhuile de sesame\b/, ok: (k) => k === 'huile-sesame', ajout: () => ['huile de sésame', 1, 'cc'] },
  {
    id: 'huile',
    re: /\b(huile|huiles|huiler|huilez)\b/,
    sauf: ['huile de sesame'],
    ok: (k) => k.startsWith('huile-'),
    ajout: (t) => (/\bhuile d olive\b/.test(t) ? ["huile d'olive", 1, 'cs'] : ['huile', 1, 'cs']),
  },
  { id: 'ail', re: /\bail\b/, ok: (k) => k === 'ail', ajout: () => ['ail', 1, 'gousse'] },
  // « citron vert » cite : citron vert ajoute, pas un citron jaune
  {
    id: 'citron',
    re: /\bcitrons?\b/,
    ok: (k) => k === 'citron' || k === 'citron-vert',
    ajout: (t) => (/\bcitrons? verts?\b/.test(t) ? ['citrons verts', 1, 'u'] : ['citrons', 0.5, 'u']),
  },
  { id: 'sel', re: /\b(sel|saler|salez)\b/, ok: (k) => k === 'sel', ajout: () => ['sel', 0, 'qs'] },
  { id: 'poivre', re: /\b(poivre|poivrer|poivrez)\b/, ok: (k) => k === 'poivre', ajout: () => ['poivre', 0, 'qs'] },
  { id: 'moutarde', re: /\bmoutarde\b/, ok: (k) => k === 'moutarde' || k === 'mayonnaise', ajout: () => ['moutarde', 1, 'cs'] },
  // porc cite sans ingredient porc : jamais ajoute en silence, toujours une erreur
  { id: 'porc', re: /\b(lardons?|jambon|bacon|chorizo|saucisses?|chipolatas?|porc)\b/, ok: aPorc, ajout: null },
];

/**
 * textes : etapes francaises ; cles : cles des ingredients de la recette ; ings : ingredients.json.
 * -> { ajouts: [[nom, q, u]], manquants: [id de regle sans ajout possible] }
 */
function ingredientsCites(textes, cles, ings) {
  const ajouts = [];
  const manquants = [];
  for (const r of REGLES) {
    const hits = [];
    for (const s of textes) {
      let t = ` ${norm(s)} `;
      for (const f of r.sauf || []) t = t.split(` ${f} `).join(' ');
      if (r.re.test(t)) hits.push(t);
    }
    if (!hits.length || cles.some((k) => r.ok(k, ings))) continue;
    if (r.ajout) ajouts.push(r.ajout(hits.join(' . ')));
    else manquants.push(r.id);
  }
  return { ajouts, manquants };
}

module.exports = { REGLES_CITES: REGLES, ingredientsCites };
