// Briques communes aux familles de recettes.
// Une recette se construit une par une avec recette({...}) ; les étapes sont
// des gabarits ({0}, {1}…) remplis par des mots, pour un stockage compact.

const { INGREDIENTS } = require('./ingredients');
const { majuscule } = require('./langue');

const TOUTES = [];

// Accès à un ingrédient du dictionnaire (formes le/de/au/du).
function I(nom) {
  const i = INGREDIENTS[nom];
  if (!i) throw new Error(`Ingrédient inconnu : ${nom}`);
  return i;
}

// Étape : gabarit + mots.
function S(gabarit, ...mots) {
  return [gabarit, ...mots.map(String)];
}

// cat : clé de catégorie · temps : minutes · diff : 1 facile, 2 moyen, 3 élaboré
// ings : [[nom, quantité, unité], ...] · etapes : [S(...), ...]
function recette({ nom, cat, temps, diff = 1, pers = 4, ings, etapes }) {
  // Fusion des ingrédients répétés (même nom et même unité).
  const fusion = [];
  for (const [n, q, u] of ings) {
    I(n);
    const deja = fusion.find((f) => f[0] === n && f[2] === u);
    if (deja) deja[1] = Math.round((deja[1] + q) * 100) / 100;
    else fusion.push([n, q, u]);
  }
  // « sel, poivre » sans quantité devient inutile si l'ingrédient est déjà dosé.
  for (let k = fusion.length - 1; k >= 0; k--) {
    if (fusion[k][2] === 'qs' && fusion.some((f) => f[0] === fusion[k][0] && f[2] !== 'qs')) fusion.splice(k, 1);
  }
  TOUTES.push({
    nom: majuscule(nom.replace(/\s+/g, ' ').trim()),
    cat,
    temps,
    diff,
    pers,
    ings: fusion,
    etapes: etapes.filter(Boolean),
  });
}

// Petites aides de quantités et d'assaisonnement.
const SEL_POIVRE = [['sel', 0, 'qs'], ['poivre', 0, 'qs']];
const ETAPE_ASSAISONNER = S('Salez, poivrez et goûtez avant de servir.');

// Temps arrondi à 5 min.
const arrondi5 = (m) => Math.max(5, Math.round(m / 5) * 5);

// Variation déterministe (pas d'aléatoire) : même entrée, même sortie.
function hash(s) {
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

module.exports = { TOUTES, I, S, recette, SEL_POIVRE, ETAPE_ASSAISONNER, arrondi5, hash };
