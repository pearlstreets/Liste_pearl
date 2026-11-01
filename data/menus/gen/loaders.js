// Fichier genere par scripts/menus-gen/build-menus.js : ne pas modifier a la main.
/* eslint-disable global-require */
const LANGS = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ar', 'sv', 'th'];
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
    case 'en':
      switch (k) {
        case 0:
          return require('./lang/en-titles-0');
        case 1:
          return require('./lang/en-titles-1');
        case 2:
          return require('./lang/en-titles-2');
        case 3:
          return require('./lang/en-titles-3');
        case 4:
          return require('./lang/en-titles-4');
        case 5:
          return require('./lang/en-titles-5');
        default:
          return null;
      }
    case 'de':
      switch (k) {
        case 0:
          return require('./lang/de-titles-0');
        case 1:
          return require('./lang/de-titles-1');
        case 2:
          return require('./lang/de-titles-2');
        case 3:
          return require('./lang/de-titles-3');
        case 4:
          return require('./lang/de-titles-4');
        case 5:
          return require('./lang/de-titles-5');
        default:
          return null;
      }
    case 'es':
      switch (k) {
        case 0:
          return require('./lang/es-titles-0');
        case 1:
          return require('./lang/es-titles-1');
        case 2:
          return require('./lang/es-titles-2');
        case 3:
          return require('./lang/es-titles-3');
        case 4:
          return require('./lang/es-titles-4');
        case 5:
          return require('./lang/es-titles-5');
        default:
          return null;
      }
    case 'it':
      switch (k) {
        case 0:
          return require('./lang/it-titles-0');
        case 1:
          return require('./lang/it-titles-1');
        case 2:
          return require('./lang/it-titles-2');
        case 3:
          return require('./lang/it-titles-3');
        case 4:
          return require('./lang/it-titles-4');
        case 5:
          return require('./lang/it-titles-5');
        default:
          return null;
      }
    case 'pt':
      switch (k) {
        case 0:
          return require('./lang/pt-titles-0');
        case 1:
          return require('./lang/pt-titles-1');
        case 2:
          return require('./lang/pt-titles-2');
        case 3:
          return require('./lang/pt-titles-3');
        case 4:
          return require('./lang/pt-titles-4');
        case 5:
          return require('./lang/pt-titles-5');
        default:
          return null;
      }
    case 'nl':
      switch (k) {
        case 0:
          return require('./lang/nl-titles-0');
        case 1:
          return require('./lang/nl-titles-1');
        case 2:
          return require('./lang/nl-titles-2');
        case 3:
          return require('./lang/nl-titles-3');
        case 4:
          return require('./lang/nl-titles-4');
        case 5:
          return require('./lang/nl-titles-5');
        default:
          return null;
      }
    case 'ru':
      switch (k) {
        case 0:
          return require('./lang/ru-titles-0');
        case 1:
          return require('./lang/ru-titles-1');
        case 2:
          return require('./lang/ru-titles-2');
        case 3:
          return require('./lang/ru-titles-3');
        case 4:
          return require('./lang/ru-titles-4');
        case 5:
          return require('./lang/ru-titles-5');
        default:
          return null;
      }
    case 'zh':
      switch (k) {
        case 0:
          return require('./lang/zh-titles-0');
        case 1:
          return require('./lang/zh-titles-1');
        case 2:
          return require('./lang/zh-titles-2');
        case 3:
          return require('./lang/zh-titles-3');
        case 4:
          return require('./lang/zh-titles-4');
        case 5:
          return require('./lang/zh-titles-5');
        default:
          return null;
      }
    case 'ja':
      switch (k) {
        case 0:
          return require('./lang/ja-titles-0');
        case 1:
          return require('./lang/ja-titles-1');
        case 2:
          return require('./lang/ja-titles-2');
        case 3:
          return require('./lang/ja-titles-3');
        case 4:
          return require('./lang/ja-titles-4');
        case 5:
          return require('./lang/ja-titles-5');
        default:
          return null;
      }
    case 'ar':
      switch (k) {
        case 0:
          return require('./lang/ar-titles-0');
        case 1:
          return require('./lang/ar-titles-1');
        case 2:
          return require('./lang/ar-titles-2');
        case 3:
          return require('./lang/ar-titles-3');
        case 4:
          return require('./lang/ar-titles-4');
        case 5:
          return require('./lang/ar-titles-5');
        default:
          return null;
      }
    case 'sv':
      switch (k) {
        case 0:
          return require('./lang/sv-titles-0');
        case 1:
          return require('./lang/sv-titles-1');
        case 2:
          return require('./lang/sv-titles-2');
        case 3:
          return require('./lang/sv-titles-3');
        case 4:
          return require('./lang/sv-titles-4');
        case 5:
          return require('./lang/sv-titles-5');
        default:
          return null;
      }
    case 'th':
      switch (k) {
        case 0:
          return require('./lang/th-titles-0');
        case 1:
          return require('./lang/th-titles-1');
        case 2:
          return require('./lang/th-titles-2');
        case 3:
          return require('./lang/th-titles-3');
        case 4:
          return require('./lang/th-titles-4');
        case 5:
          return require('./lang/th-titles-5');
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
    case 'en':
      return require('./lang/en-steps');
    case 'de':
      return require('./lang/de-steps');
    case 'es':
      return require('./lang/es-steps');
    case 'it':
      return require('./lang/it-steps');
    case 'pt':
      return require('./lang/pt-steps');
    case 'nl':
      return require('./lang/nl-steps');
    case 'ru':
      return require('./lang/ru-steps');
    case 'zh':
      return require('./lang/zh-steps');
    case 'ja':
      return require('./lang/ja-steps');
    case 'ar':
      return require('./lang/ar-steps');
    case 'sv':
      return require('./lang/sv-steps');
    case 'th':
      return require('./lang/th-steps');
    default:
      return null;
  }
}
module.exports = { LANGS, NB_BLOCS, lines, steps, titles, phrases };
