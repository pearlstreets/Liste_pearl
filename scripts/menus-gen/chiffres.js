'use strict';
// Comparaison des chiffres entre le francais et une traduction, commune a build-menus.js et validate-menus.js.
// Ecarts toleres, et seulement ceux-la :
//  - les centilitres ecrits en millilitres (5 cL devient 50 ml) ;
//  - un chiffre de 1 a 4 ecrit en lettres d'un cote (une louche, deux bols, deux tiers, un quart, le duel arabe),
//    en ajout ou en retrait seulement. Un 1 qui devient 2, ou toute autre difference, reste refuse.

// Chiffres d'un texte (arabes-indiens, persans, thai et pleine chasse ramenes a 0-9), tries.
function chiffresDe(texte) {
  const t = String(texte)
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0xe50));
  return (t.match(/\d+/g) || []).sort().join(',');
}
const comptes = (c) => {
  const m = new Map();
  for (const x of c ? c.split(',') : []) m.set(x, (m.get(x) || 0) + 1);
  return m;
};
// Un chiffre de 1 a 4 n'est tolere en plus ou en moins que s'il est ecrit en lettres de l'autre cote.
// Francais : mots (et fractions) qui valent ce chiffre.
const MOTS_FR = {
  1: ['un', 'une', 'premier', 'premiere', 'seul', 'seule', 'moitie', 'demi', 'demie', 'quart', 'quarts', 'louche'],
  2: ['deux', 'double', 'moitie', 'demi', 'demie', 'duo', 'paire', 'deuxieme', 'second', 'seconde'],
  3: ['trois', 'tiers', 'trio', 'troisieme'],
  4: ['quatre', 'quart', 'quarts', 'quatrieme'],
};
// Autres langues : mots entiers (separes par les non-lettres) ou, pour les ecritures sans espaces, sous-chaines.
const MOTS_ENTIERS = {
  1: ['one', 'a', 'an', 'ein', 'eine', 'einen', 'einem', 'einer', 'eins', 'un', 'una', 'uno', 'um', 'uma', 'een', 'en', 'ett', 'один', 'одна', 'одно', 'одну', 'одной', 'одного', 'واحد', 'واحدة', 'واحدا', 'واحداً', 'ملعقة', 'نصف', 'ربع', 'half', 'quarter', 'halb', 'halbe', 'viertel', 'mitad', 'mezzo', 'mezza', 'meta', 'halve', 'kwart', 'halv', 'fjardedel', 'fjärdedel', 'metade', 'quarto', 'cuarto', 'quarta', 'половина', 'половину', 'четверть', 'вторая', 'первый'],
  2: ['two', 'zwei', 'zwo', 'dos', 'due', 'dois', 'duas', 'twee', 'två', 'tva', 'два', 'две', 'двух', 'двум', 'двумя', 'اثنين', 'اثنان', 'اثنتين', 'دقيقتين', 'ساعتين', 'يومين', 'نصفين', 'ملعقتين', 'أسبوعين', 'اسبوعين', 'شهرين', 'ثانيتين', 'قطعتين', 'حبتين', 'كوبين', 'ليترين', 'بيضتين', 'شريحتين', 'سنتين', 'مرتين', 'ثانية', 'double', 'doppelt', 'doble', 'doppio', 'dubbel', 'duplo', 'вдвое', 'half', 'halb', 'halbe', 'mitad', 'mezzo', 'metade', 'половина', 'половину', 'نصف', 'second', 'zweite', 'segundo', 'secondo', 'tweede', 'andra', 'второй'],
  3: ['three', 'drei', 'tres', 'tre', 'três', 'drie', 'три', 'трех', 'трёх', 'трем', 'third', 'drittel', 'tercio', 'terzo', 'terco', 'terço', 'derde', 'tredjedel', 'треть', 'ثلاث', 'ثلاثة', 'ثلث', 'ثلاثا'],
  4: ['four', 'vier', 'cuatro', 'quattro', 'quatro', 'fyra', 'четыре', 'четырех', 'четырёх', 'четыре', 'quarter', 'viertel', 'cuarto', 'quarto', 'kwart', 'fjardedel', 'fjärdedel', 'четверть', 'أربع', 'أربعة', 'ربع'],
};
const MOTS_SANS_ESPACE = {
  1: ['一', '壱', 'ひとつ', '1つ', '半', '分の1', '二分', 'หนึ่ง', 'ครึ่ง', 'หนึ่ง', '四分之一', '一半', '半'],
  2: ['二', '两', '兩', 'ふたつ', '倍', '半', 'สอง', 'ครึ่ง', '一半', '双', '雙', 'ふた'],
  3: ['三', 'みっつ', 'สาม', '三分'],
  4: ['四', 'よっつ', 'สี่', '四分', '分の1'],
};
const norme = (x) =>
  String(x)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
function motsFr(frTexte, d) {
  const mots = new Set(norme(frTexte).split(/[^a-z]+/));
  return MOTS_FR[d].some((m) => mots.has(m));
}
function motsAutre(t, d) {
  const brut = String(t).toLowerCase();
  const mots = new Set(brut.split(/[^\p{L}\p{M}]+/u));
  const mn = new Set(norme(brut).split(/[^\p{L}]+/u));
  if (MOTS_ENTIERS[d].some((m) => mots.has(m) || mn.has(norme(m)))) return true;
  return MOTS_SANS_ESPACE[d].some((m) => brut.includes(m));
}
// a et b : chiffres tries (fr, traduction) ; vrai si la traduction ajoute (ou retire) des chiffres de 1 a 4,
// dans un seul sens, chacun etant ecrit en lettres du bon cote.
function ecartSimple(a, b, frTexte, t) {
  const ma = comptes(a);
  const mb = comptes(b);
  let plus = 0;
  let moins = 0;
  for (const k of new Set([...ma.keys(), ...mb.keys()])) {
    const d = (mb.get(k) || 0) - (ma.get(k) || 0);
    if (!d) continue;
    if (!['1', '2', '3', '4'].includes(k)) return false;
    if (d > 0) {
      if (!motsFr(frTexte, k)) return false;
      plus++;
    } else {
      if (!motsAutre(t, k)) return false;
      moins++;
    }
  }
  return !(plus && moins);
}
function memesChiffres(fr, t) {
  const cl = String(fr).replace(/(\d+(?:[.,]\d+)?)\s*cL/gi, (m, n) => `${Math.round(parseFloat(n.replace(',', '.')) * 10)} ml`);
  const ct = chiffresDe(t);
  for (const f of new Set([chiffresDe(fr), chiffresDe(cl)])) if (f === ct || ecartSimple(f, ct, fr, t)) return true;
  return false;
}
module.exports = { chiffresDe, memesChiffres };
