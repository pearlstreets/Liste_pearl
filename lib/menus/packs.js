// Textes des recettes generees par langue : titres complets (un par case) et dictionnaire de phrases.
// Les packs sont des modules de chaines (data/menus/gen/lang), charges a la demande. Un pack absent ou incoherent
// est ignore (repli sur le francais, gere par l'appelant) ; seul un pack francais invalide met le catalogue en
// etat degrade. Aucune fonction ne leve.
import { getCore, markDegraded, phraseGroups } from './catalog';

const titlePacks = {}; // langue -> { blocks: [ {text, off} | false | null ] }
const phrasePacks = {}; // langue -> string[] | false

function packFor(lang) {
  if (!titlePacks[lang]) {
    const c = getCore();
    titlePacks[lang] = { blocks: new Array(c.status === 'ready' ? c.nBlocks : 0).fill(null) };
  }
  return titlePacks[lang];
}

function langAvailable(c, lang) {
  const l = c.source.loaders && c.source.loaders.LANGS;
  return !Array.isArray(l) || l.includes(lang);
}

/**
 * Charge le bloc b des titres de la langue (decalages par balayage des fins de ligne).
 * Renvoie true si le bloc est utilisable. Un bloc invalide est memorise (pas de nouvelle tentative).
 */
export function loadTitleBlock(lang, b) {
  const c = getCore();
  if (c.status !== 'ready' || !(b >= 0 && b < c.nBlocks)) return false;
  const pack = packFor(lang);
  if (pack.blocks[b]) return true;
  if (pack.blocks[b] === false) return false;
  if (!langAvailable(c, lang)) {
    pack.blocks[b] = false;
    return false;
  }
  let text = null;
  try {
    text = c.source.loaders.titles(lang, b);
  } catch (_e) {
    text = null;
  }
  const count = b < c.nBlocks - 1 ? c.SHARD : c.N - b * c.SHARD;
  let off = null;
  if (typeof text === 'string') {
    off = new Int32Array(count + 1);
    let pos = 0;
    for (let i = 0; i < count; i++) {
      off[i] = pos;
      const nx = text.indexOf('\n', pos);
      if (nx < 0) {
        if (i !== count - 1) {
          off = null;
          break;
        }
        pos = text.length + 1;
      } else {
        pos = nx + 1;
      }
    }
    if (off) {
      if (pos !== text.length + 1)
        off = null; // des lignes en trop
      else off[count] = pos;
    }
  }
  if (!off) {
    pack.blocks[b] = false;
    if (lang === 'fr') markDegraded(c, `titres fr-${b} absents ou incoherents`);
    return false;
  }
  pack.blocks[b] = { text, off };
  return true;
}

/** Texte brut d'un bloc de titres deja charge (un titre par ligne), ou null. */
export function titleBlockText(lang, b) {
  const p = titlePacks[lang];
  const blk = p && p.blocks[b];
  return blk ? blk.text : null;
}

/** Charge tous les blocs de titres de la langue ; true si tous sont utilisables. */
export function loadTitles(lang) {
  const c = getCore();
  if (c.status !== 'ready') return false;
  let ok = true;
  for (let b = 0; b < c.nBlocks; b++) if (!loadTitleBlock(lang, b)) ok = false;
  return ok;
}

/** Titre de la case dans la langue demandee, ou null (langue absente, bloc invalide, titre vide). */
export function titleOf(row, lang) {
  const c = getCore();
  if (c.status !== 'ready' || !Number.isInteger(row) || row < 0 || row >= c.N) return null;
  const b = (row / c.SHARD) | 0;
  if (!loadTitleBlock(lang, b)) return null;
  const blk = titlePacks[lang].blocks[b];
  const i = row - b * c.SHARD;
  const t = blk.text.slice(blk.off[i], blk.off[i + 1] - 1);
  return t.trim() ? t : null;
}

/** Dictionnaire de phrases de la langue (tableau indexe par identifiant de phrase), ou null. */
export function loadPhrases(lang) {
  const c = getCore();
  if (c.status !== 'ready') return null;
  if (phrasePacks[lang] !== undefined) return phrasePacks[lang] || null;
  let list = false;
  if (langAvailable(c, lang)) {
    try {
      const text = c.source.loaders.phrases(lang);
      if (typeof text === 'string') {
        const parts = text.split('\n');
        list = parts.length === c.nPhrases ? parts : false;
      }
    } catch (_e) {
      list = false;
    }
  }
  phrasePacks[lang] = list;
  if (!list && lang === 'fr') markDegraded(c, 'phrases fr absentes ou incoherentes');
  return list || null;
}

/**
 * Etapes de la case dans la langue : phrases d'une meme etape reunies par une espace. Phrase absente de la
 * langue : celle du francais ; absente aussi : remplacee par le texte « etapes indisponibles » (l'etape garde sa place). Renvoie un tableau (vide si rien n'est disponible).
 */
export function stepsOf(row, lang) {
  const c = getCore();
  const groups = phraseGroups(c, row);
  if (!groups) return [];
  const cur = loadPhrases(lang);
  let fr = lang === 'fr' ? cur : undefined; // francais lu seulement au premier manque
  const out = [];
  for (const g of groups) {
    const parts = [];
    for (const id of g) {
      let t = cur && cur[id];
      if (!t || !t.trim()) {
        if (fr === undefined) fr = loadPhrases('fr');
        t = fr && fr[id];
      }
      if (t && t.trim()) parts.push(t);
    }
    // une etape sans texte garde sa place (les minuteurs et les natures d'etape sont indexes sur les groupes d'origine)
    out.push(parts.length ? parts.join(' ') : null);
  }
  if (!out.some((x) => x !== null)) return [];
  return out.map((x) => (x === null ? noStepsText(lang) : x));
}

/** Libere les packs de titres et de phrases des langues autres que celles gardees (la langue en cours et le repli). */
export function releasePacks(keep) {
  const k = new Set(keep || []);
  for (const l of Object.keys(titlePacks)) if (!k.has(l)) delete titlePacks[l];
  for (const l of Object.keys(phrasePacks)) if (!k.has(l)) delete phrasePacks[l];
}

export function loadedPackLangs() {
  return { titles: Object.keys(titlePacks), phrases: Object.keys(phrasePacks) };
}

export function resetPacks() {
  for (const l of Object.keys(titlePacks)) delete titlePacks[l];
  for (const l of Object.keys(phrasePacks)) delete phrasePacks[l];
}

/* Textes fixes localises (aucune dependance aux fichiers de langue de l'application). Vouvoiement, pas de tiret long. */
const UNTITLED = {
  fr: 'Recette',
  en: 'Recipe',
  de: 'Rezept',
  es: 'Receta',
  it: 'Ricetta',
  pt: 'Receita',
  nl: 'Recept',
  ru: 'Рецепт',
  zh: '食谱',
  ja: 'レシピ',
  ar: 'وصفة',
  sv: 'Recept',
  th: 'สูตรอาหาร',
};
const NO_STEPS = {
  fr: 'Étapes indisponibles.',
  en: 'Steps unavailable.',
  de: 'Schritte nicht verfügbar.',
  es: 'Pasos no disponibles.',
  it: 'Passaggi non disponibili.',
  pt: 'Passos indisponíveis.',
  nl: 'Stappen niet beschikbaar.',
  ru: 'Шаги недоступны.',
  zh: '步骤暂不可用。',
  ja: '手順は利用できません。',
  ar: 'الخطوات غير متوفرة.',
  sv: 'Stegen är inte tillgängliga.',
  th: 'ไม่มีขั้นตอนในขณะนี้',
};
export const untitledText = (lang) => UNTITLED[lang] || UNTITLED.fr;
export const noStepsText = (lang) => NO_STEPS[lang] || NO_STEPS.fr;
