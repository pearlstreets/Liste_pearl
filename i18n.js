import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Restore saved language preference
AsyncStorage.getItem('APP_LANGUAGE').then(lang => {
  if (lang && resources[lang]) {
    i18n.changeLanguage(lang);
  }
});

export default i18n;
