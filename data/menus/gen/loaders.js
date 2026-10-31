// Fichier genere par scripts/menus-gen/build-menus.js : ne pas modifier a la main.
/* eslint-disable global-require */
const LANGS = ['fr'];
const NB_BLOCS = 6;
function lines(k) {
  switch (k) {
    case 0:
      return require('./lines-0');
    case 1:
      return require('./lines-1');
    case 2:
      return require('./lines-2');
    case 3:
      return require('./lines-3');
    case 4:
      return require('./lines-4');
    case 5:
      return require('./lines-5');
    default:
      return null;
  }
}
function steps(k) {
  switch (k) {
    case 0:
      return require('./steps-0');
    case 1:
      return require('./steps-1');
    case 2:
      return require('./steps-2');
    case 3:
      return require('./steps-3');
    case 4:
      return require('./steps-4');
    case 5:
      return require('./steps-5');
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
        case 1:
          return require('./lang/fr-titles-1');
        case 2:
          return require('./lang/fr-titles-2');
        case 3:
          return require('./lang/fr-titles-3');
        case 4:
          return require('./lang/fr-titles-4');
        case 5:
          return require('./lang/fr-titles-5');
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
