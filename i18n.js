import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, DevSettings } from 'react-native';
import { appliquerSensEcriture } from './lib/sensEcriture';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import zh from './locales/zh.json';
import ar from './locales/ar.json';
import de from './locales/de.json';
import nl from './locales/nl.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';
import th from './locales/th.json';
import sv from './locales/sv.json';
import ru from './locales/ru.json';

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  es: { translation: es },
  zh: { translation: zh },
  ar: { translation: ar },
  de: { translation: de },
  nl: { translation: nl },
  it: { translation: it },
  pt: { translation: pt },
  ja: { translation: ja },
  th: { translation: th },
  sv: { translation: sv },
  ru: { translation: ru },
};

// Pluriels (« 1 produit », « 3 منتجات », « 5 товаров ») : i18next choisit la forme avec
// Intl.PluralRules (format v4 : cle_zero, _one, _two, _few, _many, _other). Si le moteur JS
// n'a pas Intl.PluralRules, ou une version sans les regles de l'arabe, i18next se rabat sur
// « one » pour 1 et « other » sinon : faux en arabe et en russe. Regles de secours ci-dessous,
// d'apres CLDR, pour les 13 langues de l'app (nombres entiers ; decimaux en « other »,
// sauf fr et pt ou 0 a 1,99 restent au singulier).
const CATEGORIES_PLURIEL = {
  ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
  ru: ['one', 'few', 'many', 'other'],
  fr: ['one', 'many', 'other'],
  es: ['one', 'many', 'other'],
  it: ['one', 'many', 'other'],
  pt: ['one', 'many', 'other'],
  en: ['one', 'other'],
  de: ['one', 'other'],
  nl: ['one', 'other'],
  sv: ['one', 'other'],
  zh: ['other'],
  ja: ['other'],
  th: ['other'],
};

function languePluriel(locale) {
  const code = String((Array.isArray(locale) ? locale[0] : locale) || 'en').toLowerCase().split(/[-_]/)[0];
  return CATEGORIES_PLURIEL[code] ? code : 'en';
}

export function categoriePluriel(locale, nombre) {
  const lang = languePluriel(locale);
  const n = Math.abs(Number(nombre));
  if (!Number.isFinite(n)) return 'other';
  const entier = Number.isInteger(n);
  const i = Math.floor(n);
  const million = entier && i !== 0 && i % 1000000 === 0;
  switch (lang) {
    case 'zh': case 'ja': case 'th':
      return 'other';
    case 'fr': case 'pt':
      if (i === 0 || i === 1) return 'one';
      return million ? 'many' : 'other';
    case 'es': case 'it':
      if (n === 1) return 'one';
      return million ? 'many' : 'other';
    case 'ru': {
      if (!entier) return 'other';
      const d = i % 10, c = i % 100;
      if (d === 1 && c !== 11) return 'one';
      if (d >= 2 && d <= 4 && (c < 12 || c > 14)) return 'few';
      return 'many';
    }
    case 'ar': {
      if (!entier) return 'other';
      if (n === 0) return 'zero';
      if (n === 1) return 'one';
      if (n === 2) return 'two';
      const c = n % 100;
      if (c >= 3 && c <= 10) return 'few';
      if (c >= 11) return 'many';
      return 'other';
    }
    default:
      return n === 1 ? 'one' : 'other';
  }
}

class PluralRulesDeSecours {
  constructor(locale, options) {
    this.langue = languePluriel(locale);
    this.ordinal = !!(options && options.type === 'ordinal');
  }
  select(nombre) {
    return this.ordinal ? 'other' : categoriePluriel(this.langue, nombre);
  }
  resolvedOptions() {
    return {
      locale: this.langue,
      type: this.ordinal ? 'ordinal' : 'cardinal',
      pluralCategories: this.ordinal ? ['other'] : CATEGORIES_PLURIEL[this.langue].slice(),
    };
  }
  static supportedLocalesOf(locales) {
    return [].concat(locales || []).filter((l) => CATEGORIES_PLURIEL[String(l).toLowerCase().split(/[-_]/)[0]]);
  }
}

// Installe les regles de secours si Intl.PluralRules manque ou ne connait pas l'arabe
// et le russe. Rend true si elles ont ete installees.
export function installerPluralRulesDeSecours(global = globalThis) {
  try {
    const PR = global.Intl && global.Intl.PluralRules;
    if (typeof PR === 'function'
      && new PR('ar').select(3) === 'few'
      && new PR('ru').select(5) === 'many') return false;
  } catch (_) { /* regles de secours ci-dessous */ }
  try {
    if (!global.Intl) global.Intl = {};
    global.Intl.PluralRules = PluralRulesDeSecours;
    return true;
  } catch (_) {
    return false;
  }
}
installerPluralRulesDeSecours();

// Get the device locale safely and map to a supported language
const SUPPORTED_LANGUAGES = Object.keys(resources); // ['fr','en','es','zh','ar','de','nl','it','pt','ja','th','sv','ru']
const deviceLocale = Localization.locale || 'en';
const deviceLang = deviceLocale.toLowerCase().split(/[-_]/)[0]; // e.g. 'zh-Hans-CN' → 'zh'
const initialLanguage = SUPPORTED_LANGUAGES.includes(deviceLang) ? deviceLang : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
  });

// Recharge le JS pour appliquer le sens d'écriture (droite à gauche en arabe).
function rechargerApp() {
  if (__DEV__) {
    DevSettings.reload();
    return Promise.resolve();
  }
  return require('expo-updates').reloadAsync();
}

// Onglet à rouvrir après le rechargement dû au changement de sens d'écriture
// (Profil > Langue) : sinon l'app repart sur « Ma Liste ».
export const CLE_ONGLET_APRES_RECHARGEMENT = 'APP_TAB_AFTER_RELOAD';
let ongletApresRechargement = null;
export function definirOngletApresRechargement(nom) {
  ongletApresRechargement = nom || null;
}

function appliquerSens(lang, sauverLangue) {
  return appliquerSensEcriture(lang, {
    I18nManager,
    storage: AsyncStorage,
    recharger: async () => {
      // La langue choisie doit être enregistrée avant le rechargement,
      // sinon l'ancienne revient au redémarrage.
      if (sauverLangue) await AsyncStorage.setItem('APP_LANGUAGE', lang);
      if (ongletApresRechargement) {
        try { await AsyncStorage.setItem(CLE_ONGLET_APRES_RECHARGEMENT, ongletApresRechargement); } catch (_) {}
      }
      await rechargerApp();
    },
  });
}

// Restore saved language preference
AsyncStorage.getItem('APP_LANGUAGE').then(async lang => {
  if (lang && resources[lang]) {
    await i18n.changeLanguage(lang);
  }
}).catch(() => {}).then(() => {
  // Sens de la langue effective au démarrage, puis à chaque changement de langue
  // (premier lancement, Profil > Langue).
  appliquerSens(i18n.language, false);
  i18n.on('languageChanged', (lng) => {
    appliquerSens(lng, true).finally(() => { ongletApresRechargement = null; });
  });
});

export default i18n;
