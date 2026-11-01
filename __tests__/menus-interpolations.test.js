// Interpolations des phrases : chaque {{variable}} d'une cle (et de ses formes plurielles) doit etre fournie par
// l'appel t() qui l'affiche, sinon l'ecran montre le texte brut (« SUR {{AMOUNT}} » dans la jauge de la semaine).
// Controle statique de tous les appels t('cle', { ... }) a cle et options litterales du depot.
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const LANGUES = fs.readdirSync(path.join(ROOT, 'locales')).filter((f) => f.endsWith('.json'));
const LOC = Object.fromEntries(
  LANGUES.map((f) => [f, JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', f), 'utf8'))])
);
const lire = (o, k) => k.split('.').reduce((a, p) => (a && typeof a === 'object' ? a[p] : undefined), o);
const variables = (s) =>
  typeof s === 'string' ? [...s.matchAll(/\{\{\s*([^}\s,]+)[^}]*\}\}/g)].map((m) => m[1]) : [];
const FORMES = ['zero', 'one', 'two', 'few', 'many', 'other'];

function fichiers(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fichiers(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Cles de premier niveau d'un objet litteral passe en 2e argument ; null si l'argument n'est pas litteral
// (variable, decomposition ...) : l'appel n'est alors pas controle.
function options(src, i) {
  let j = i;
  while (/\s/.test(src[j])) j++;
  if (src[j] === ')') return [];
  if (src[j] !== ',') return null;
  j++;
  while (/\s/.test(src[j])) j++;
  if (src[j] !== '{') return null;
  let prof = 0;
  let haut = '';
  for (let k = j; k < src.length; k++) {
    const c = src[k];
    if ('{(['.includes(c)) prof++;
    else if ('})]'.includes(c)) {
      prof--;
      if (prof === 0) break;
    }
    haut += prof === 1 ? c : ' ';
  }
  haut = haut.slice(1);
  if (haut.includes('...')) return null;
  const cles = [];
  for (const part of haut.split(',')) {
    const m = part.trim().match(/^([A-Za-z_$][\w$]*)\s*(:|$)/);
    if (m) cles.push(m[1]);
  }
  return cles;
}

function controler(fichier) {
  const src = fs.readFileSync(fichier, 'utf8');
  const avecUseT = /import useT\b/.test(src);
  const re = /\b(i18n\.)?t\(\s*(['"])([\w.-]+)\2/g;
  const fautes = [];
  let m;
  while ((m = re.exec(src))) {
    const cle = (avecUseT && !m[1] ? 'menus.' : '') + m[3];
    const fournies = options(src, re.lastIndex);
    if (fournies === null) continue;
    const parent = cle.split('.').slice(0, -1).join('.');
    const dernier = cle.split('.').pop();
    for (const [lf, loc] of Object.entries(LOC)) {
      const textes = [lire(loc, cle)];
      const par = lire(loc, parent) || {};
      for (const f of FORMES) textes.push(par[`${dernier}_${f}`]);
      const manque = [...new Set(textes.flatMap(variables))].filter((v) => !fournies.includes(v));
      if (manque.length) {
        const ligne = src.slice(0, m.index).split('\n').length;
        fautes.push(`${path.relative(ROOT, fichier)}:${ligne} ${cle} (${lf}) : ${manque.join(', ')}`);
      }
    }
  }
  return fautes;
}

describe('interpolations des phrases', () => {
  test('ecran Ma semaine : toutes les variables fournies', () => {
    const fautes = ['WeekScreen.js', 'MealCard.js', 'SettingsScreen.js'].flatMap((f) =>
      controler(path.join(ROOT, 'components', 'menus', f))
    );
    expect(fautes).toEqual([]);
  });

  test('tout le depot : toutes les variables fournies', () => {
    const tous = [
      ...['components', 'services', 'utils', 'lib'].flatMap((d) => fichiers(path.join(ROOT, d))),
      path.join(ROOT, 'App.js'),
    ];
    expect(tous.flatMap(controler)).toEqual([]);
  });

  test('le controle repere bien une variable non fournie', () => {
    const tmp = path.join(ROOT, '__tests__', '.interp-sonde.js');
    try {
      fs.writeFileSync(tmp, "import useT from './useT';\nconst a = t('week.overBudget');\n");
      expect(controler(tmp).length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});
