// Source des donnees du catalogue genere (data/menus/gen). Les require sont statiques (Metro) et executes
// a la demande. Les tests remplacent la source par un jeu reduit (data/menus/gen-fixture) avec setGenSource.

let override = null;
let cached;

function loadDefault() {
  try {
    return {
      meta: require('../../data/menus/gen/meta'),
      hdr: require('../../data/menus/gen/hdr'),
      loaders: require('../../data/menus/gen/loaders'),
    };
  } catch (_e) {
    return null;
  }
}

/** { meta, hdr, loaders } ou null si les donnees sont absentes (le catalogue passe alors en mode degrade). */
export function getGenSource() {
  if (override) return override;
  if (cached === undefined) cached = loadDefault();
  return cached;
}

/** Remplace la source (tests). null revient a la source par defaut. L'appelant vide ensuite les caches. */
export function setGenSource(src) {
  override = src || null;
}

export function resetGenSource() {
  cached = undefined;
}
