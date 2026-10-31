// Fichier genere par scripts/menus-gen/build-menus.js : ne pas modifier a la main.
/* eslint-disable global-require */
const LANGS = ['fr'];
const NB_BLOCS = 1;
function lines(k) {
  switch (k) {
    case 0:
      return require('./lines-0');
    default:
      return null;
  }
}
function steps(k) {
  switch (k) {
    case 0:
      return require('./steps-0');
    default:
      return null;
  }
}
function titles(lang, k) {
  switch (lang) {
    case 'fr':
      switch (k) {
        case 0:
          return require('./lang/fr-titles-0');
        default:
          return null;
      }
    default:
      return null;
  }
}
function phrases(lang) {
  switch (lang) {
    case 'fr':
      return require('./lang/fr-steps');
    default:
      return null;
  }
}
module.exports = { LANGS, NB_BLOCS, lines, steps, titles, phrases };
