// Fusion des données de sauvegarde des menus. Aucune dépendance au réseau ni au stockage :
// tout ici est pur et testable. Format d'une clé : { u: horodatage en ms, v: valeur }.
import { estObjet, arr } from './util';
import { mergeMyRecipes } from './myRecipes';

// Liste unique des clés sauvegardées sur le compte, avec la forme attendue de leur valeur.
// Pour sauvegarder une nouvelle clé : l'ajouter ici, avec son entrée
// dans MENUS_KEY et SPEC de storage.js. `applied` et `sent` restent exclus : ils dépendent des
// listes locales de l'appareil.
export const SYNC_SHAPES = {
  profile: estObjet,
  plan: (v) => estObjet(v) && Array.isArray(v.meals),
  history: Array.isArray,
  favorites: Array.isArray,
  notes: estObjet,
  cooked: estObjet,
  fridge: Array.isArray,
  myRecipes: Array.isArray,
  reminders: estObjet,
  familyShare: estObjet,
  batch: estObjet,
};
export const SYNC_KEYS = Object.keys(SYNC_SHAPES);

/** Horodatage d'une donnée locale antérieure à la sauvegarde : plus ancienne que tout. */
export const LEGACY_STAMP = 1;

const HISTORY_MAX = 26;
const INTERDITES = ['__proto__', 'constructor', 'prototype'];

const connue = (k) => Object.prototype.hasOwnProperty.call(SYNC_SHAPES, k);

// `u` entier sûr : au-delà, `u + 1` ne bouge plus et le serveur refuse tout l'envoi.
export const entreeValide = (e) =>
  estObjet(e) &&
  Number.isSafeInteger(e.u) &&
  e.u >= 0 &&
  Object.prototype.hasOwnProperty.call(e, 'v');

/** Valeur acceptable pour cette clé (null = effacement explicite). Une clé inconnue est gardée telle quelle. */
export const valeurValide = (k, v) => !connue(k) || SYNC_SHAPES[k](v);

const entreeUtile = (k, e) => entreeValide(e) && (e.v === null || valeurValide(k, e.v));

/** Réponse du serveur { version, data } ou null si elle est inexploitable (on n'écrit alors rien). */
export function lireEtatServeur(d) {
  if (!estObjet(d) || !Number.isInteger(d.version) || d.version < 0 || !estObjet(d.data))
    return null;
  return { version: d.version, data: d.data };
}

/**
 * Fusion clé par clé : le `u` le plus récent gagne, à égalité le serveur (tous les appareils
 * convergent). Une clé absente d'un côté n'est jamais effacée ; une entrée illisible est ignorée.
 * Rend { data: à envoyer, toApply: clés à écrire localement, toPush: clés que le serveur n'a pas }.
 */
export function mergeData(local, remote) {
  const l0 = estObjet(local) ? local : {};
  const r0 = estObjet(remote) ? remote : {};
  const res = { data: {}, toApply: [], toPush: [] };
  for (const k of new Set([...Object.keys(l0), ...Object.keys(r0)])) {
    if (INTERDITES.includes(k)) continue;
    const l = entreeUtile(k, l0[k]) ? l0[k] : null;
    const r = entreeUtile(k, r0[k]) ? r0[k] : null;
    if (l && (!r || l.u > r.u)) {
      res.data[k] = l;
      res.toPush.push(k);
    } else if (r) {
      res.data[k] = r;
      // Deux données antérieures à la sauvegarde ont le même `u` sans être la même donnée.
      const differente =
        !l ||
        l.u !== r.u ||
        (l.u === LEGACY_STAMP && JSON.stringify(l.v) !== JSON.stringify(r.v));
      if (connue(k) && differente) res.toApply.push(k);
    } else if (entreeValide(r0[k])) {
      res.data[k] = r0[k]; // illisible pour cette version de l'app : conservé sur le compte
    }
  }
  return res;
}

const sansDouble = (a) => a.filter((x, i) => a.indexOf(x) === i);
const clePlan = (p) => `${(p && p.weekStart) || ''}|${(p && p.fingerprint) || ''}`;

function unirHistorique(ancien, recent) {
  const parCle = new Map();
  for (const p of [...arr(ancien), ...arr(recent)]) if (estObjet(p)) parCle.set(clePlan(p), p);
  return [...parCle.values()]
    .sort((a, b) => (Number(a.savedAt) || 0) - (Number(b.savedAt) || 0))
    .slice(-HISTORY_MAX);
}

function unirCuisinees(a, b) {
  const out = { ...a };
  for (const [k, e] of Object.entries(b)) {
    const p = out[k];
    if (!estObjet(e)) continue;
    out[k] = estObjet(p)
      ? {
          count: Math.max(Number(p.count) || 0, Number(e.count) || 0),
          last: Math.max(Number(p.last) || 0, Number(e.last) || 0),
        }
      : e;
  }
  return out;
}

// Le reste du profil suit le plus récent ; une allergie ou un régime ne disparaît jamais d'une fusion.
const unirProfil = (ancien, recent) => ({
  ...recent,
  diets: sansDouble([...arr(ancien.diets), ...arr(recent.diets)]),
  excludedIngredients: sansDouble([
    ...arr(ancien.excludedIngredients),
    ...arr(recent.excludedIngredients),
  ]),
});

// Pour ces clés, une fusion de deux versions différentes additionne les deux côtés.
const UNIONS = {
  profile: unirProfil,
  favorites: (a, b) => sansDouble([...a, ...b]),
  fridge: (a, b) => sansDouble([...a, ...b]),
  notes: (a, b) => ({ ...a, ...b }),
  cooked: unirCuisinees,
  history: unirHistorique,
  myRecipes: mergeMyRecipes,
};

const ajouter = (liste, k) => {
  if (!liste.includes(k)) liste.push(k);
};

function remplacer(res, k, entree) {
  res.data[k] = entree;
  ajouter(res.toApply, k);
  ajouter(res.toPush, k);
}

// Réunit les deux versions de ces clés, sans en perdre aucune. Le plan écarté rejoint l'historique.
function reunir(res, l0, r0, cles) {
  for (const k of cles) {
    const l = entreeUtile(k, l0[k]) ? l0[k] : null;
    const r = entreeUtile(k, r0[k]) ? r0[k] : null;
    if (!l || !r) continue;
    if (l.v === null && r.v !== null) {
      res.data[k] = r;
      res.toPush = res.toPush.filter((x) => x !== k);
      if (l.u !== r.u) ajouter(res.toApply, k);
      continue;
    }
    if (l.v === null || r.v === null || !UNIONS[k]) continue;
    const [ancien, recent] = l.u > r.u ? [r, l] : [l, r];
    const union = UNIONS[k](ancien.v, recent.v);
    if (JSON.stringify(union) !== JSON.stringify(recent.v))
      remplacer(res, k, { u: Math.max(l.u, r.u) + 1, v: union });
  }
  const lp = entreeUtile('plan', l0.plan) ? l0.plan : null;
  const rp = entreeUtile('plan', r0.plan) ? r0.plan : null;
  if (cles.includes('plan') && lp && rp && lp.v && rp.v && clePlan(lp.v) !== clePlan(rp.v)) {
    const ecarte = lp.u > rp.u ? rp : lp;
    if (ecarte.v.meals.length > 0) {
      const h = res.data.history;
      const u = Math.max(h ? h.u : 0, lp.u, rp.u) + 1;
      const entree = { ...ecarte.v, savedAt: ecarte.u };
      remplacer(res, 'history', { u, v: unirHistorique(h && h.v, [entree]) });
    }
  }
  return res;
}

/**
 * Première fusion d'un appareil avec un compte : rien n'est perdu. Favoris, frigo, notes,
 * cuisinées, recettes personnelles et historique sont additionnés, comme les allergies et régimes
 * du profil ; un effacement local ne supprime rien du compte ; le plan écarté rejoint l'historique.
 */
export function mergeFirstLogin(local, remote) {
  const l0 = estObjet(local) ? local : {};
  const r0 = estObjet(remote) ? remote : {};
  return reunir(mergeData(l0, r0), l0, r0, SYNC_KEYS);
}

/**
 * Fusion courante, un appareil déjà rattaché au compte. Une clé modifiée ici alors que le compte a
 * changé depuis le dernier échange (`base` : dernier `u` connu du compte) est un vrai conflit entre
 * deux téléphones : les deux versions sont réunies, quelle que soit l'heure de chaque appareil.
 * Sans conflit, le plus récent gagne : un favori retiré ne revient pas.
 */
export function mergeSync(local, remote, { dirty, base } = {}) {
  const l0 = estObjet(local) ? local : {};
  const r0 = estObjet(remote) ? remote : {};
  const aEnvoyer = estObjet(dirty) ? dirty : {};
  const connus = estObjet(base) ? base : {};
  const conflits = SYNC_KEYS.filter(
    (k) =>
      aEnvoyer[k] &&
      entreeUtile(k, r0[k]) &&
      r0[k].u !== connus[k] &&
      JSON.stringify(entreeUtile(k, l0[k]) ? l0[k] : null) !== JSON.stringify(r0[k])
  );
  return reunir(mergeData(l0, r0), l0, r0, conflits);
}
