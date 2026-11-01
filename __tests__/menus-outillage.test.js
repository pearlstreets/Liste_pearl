// Outillage des donnees generees (lot E de scripts/menus-gen/CONCEPTION.md) :
// build-menus.js --traductions (packs de langue, loaders, noms d'ingredients) et validate-menus.js (catalogue compact).
// Tout se passe dans une COPIE de data/menus sous le dossier temporaire : les vraies donnees ne sont jamais ecrites.
import { readInt, writeInt } from '../lib/menus/b64';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const BUILD = path.join(REPO, 'scripts', 'menus-gen', 'build-menus.js');
const VALIDATE = path.join(REPO, 'scripts', 'validate-menus.js');
const FACTICES = path.join(REPO, 'scripts', 'menus-gen', 'traductions-factices.js');

jest.setTimeout(180000);

let tmp;
let racine;
let atrad;
let trad;

function node(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: r.status, out: r.stdout || '', err: r.stderr || '' };
}
const build = (args) => node(BUILD, ['--racine', racine, '--a-traduire', atrad, ...args]);
const valider = (args = []) => node(VALIDATE, ['--racine', racine, ...args]);
const lire = (f) => fs.readFileSync(f, 'utf8');
const gen = (...p) => path.join(racine, 'data', 'menus', 'gen', ...p);
const i18n = (l) => path.join(racine, 'data', 'menus', 'i18n', `${l}.json`);
const rapport = (r) => JSON.parse(r.out);

// Retire les packs autres que le francais d'une racine (le depot peut deja les contenir une fois l'integration faite).
function garderFrancaisSeul(dest) {
  for (const dir of ['gen', 'gen-fixture']) {
    const d = path.join(dest, 'data', 'menus', dir, 'lang');
    if (fs.existsSync(d))
      for (const f of fs.readdirSync(d)) if (!f.startsWith('fr-')) fs.rmSync(path.join(d, f));
  }
}

function copierRacine(dest) {
  fs.mkdirSync(path.join(dest, 'data'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'scripts', 'menus-gen'), { recursive: true });
  fs.cpSync(path.join(REPO, 'data', 'menus'), path.join(dest, 'data', 'menus'), {
    recursive: true,
  });
  for (const f of ['registry.json', 'registry-phrases.json'])
    fs.copyFileSync(
      path.join(REPO, 'scripts', 'menus-gen', f),
      path.join(dest, 'scripts', 'menus-gen', f)
    );
}

// Modifie un fichier le temps d'un essai, puis le remet.
function avecFichier(f, transformer, essai) {
  const avant = fs.readFileSync(f);
  try {
    fs.writeFileSync(f, transformer(avant.toString('utf8')));
    return essai();
  } finally {
    fs.writeFileSync(f, avant);
  }
}
function avecModule(f, transformer, essai) {
  return avecFichier(
    f,
    (src) => {
      const obj = JSON.parse(
        src
          .slice(src.indexOf('module.exports = ') + 'module.exports = '.length)
          .replace(/;\s*$/, '')
      );
      transformer(obj);
      return `module.exports = ${JSON.stringify(obj)};\n`;
    },
    essai
  );
}
const lireJson = (f) => JSON.parse(lire(f));
const sansKcal = (stderr) =>
  stderr
    .split('\n')
    .filter(
      (l) =>
        l.trim() &&
        !/^\[catalogue\] plage : kcal/.test(l) &&
        !/erreur\(s\)\s*$/.test(l) &&
        !/^avertissement/.test(l)
    );

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pearl-menus-outillage-'));
  racine = path.join(tmp, 'racine');
  atrad = path.join(tmp, 'atrad');
  trad = path.join(tmp, 'trad');
  copierRacine(racine);
  garderFrancaisSeul(racine);
  expect(build([]).status).toBe(0); // fichiers a traduire, loaders limites au francais
  const f = node(FACTICES, [atrad, trad]);
  expect(f.status).toBe(0);
});

afterAll(() => {
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe('build-menus.js --traductions', () => {
  let avantI18n;
  beforeAll(() => {
    avantI18n = Object.fromEntries(['en', 'th', 'fr'].map((l) => [l, lire(i18n(l))]));
  });

  test('sans traduction : francais seul, build reproductible', () => {
    expect(require(gen('meta.js')).N).toBeGreaterThan(0);
    expect(build(['--check']).status).toBe(0);
    expect(lire(gen('loaders.js'))).toContain("const LANGS = ['fr'];");
  });

  test("integre 12 langues factices : packs, loaders, noms d'ingredients", () => {
    const r = build(['--traductions', trad, '--toutes-les-langues']);
    expect(r.err).toBe('');
    expect(r.status).toBe(0);
    const rap = rapport(r);
    expect(rap.langues).toEqual([
      'fr',
      'en',
      'de',
      'es',
      'it',
      'pt',
      'nl',
      'ru',
      'zh',
      'ja',
      'ar',
      'sv',
      'th',
    ]);
    expect(rap.languesTraduitesCeTour).toHaveLength(12);
    expect(lire(gen('loaders.js'))).toContain(
      "const LANGS = ['fr', 'en', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ar', 'sv', 'th'];"
    );
    const meta = require(gen('meta.js'));
    for (const l of rap.langues) {
      expect(fs.existsSync(gen('lang', `${l}-steps.js`))).toBe(true);
      for (let b = 0; b < Math.ceil(meta.N / meta.SHARD); b++)
        expect(fs.existsSync(gen('lang', `${l}-titles-${b}.js`))).toBe(true);
      const loaders = require(gen('loaders.js'));
      expect(loaders.phrases(l).split('\n')).toHaveLength(meta.PHRASE_META.split('|').length);
      expect(loaders.titles(l, 0).split('\n')).toHaveLength(meta.SHARD);
    }
    // la fixture recoit les memes langues
    expect(lire(path.join(racine, 'data', 'menus', 'gen-fixture', 'loaders.js'))).toContain("'th'");
    // i18n : cle ingredients seulement, ordre et format conserves
    const nouveaux = new Set(lireJson(path.join(atrad, 'ingredients.json')).map((e) => e.cle));
    expect(nouveaux.size).toBeGreaterThan(50);
    for (const l of ['en', 'th']) {
      const apres = lire(i18n(l));
      const A = JSON.parse(avantI18n[l]);
      const B = JSON.parse(apres);
      expect(B.recipes).toEqual(A.recipes);
      const ka = Object.keys(A.ingredients);
      const kb = Object.keys(B.ingredients);
      expect(kb.slice(0, ka.length)).toEqual(ka);
      for (const k of ka) if (!nouveaux.has(k)) expect(B.ingredients[k]).toBe(A.ingredients[k]);
      for (const k of nouveaux) expect(B.ingredients[k]).toBeTruthy();
      expect(kb).toEqual(Object.keys(lireJson(i18n('fr')).ingredients));
      expect(apres.includes('\r\n')).toBe(avantI18n[l].includes('\r\n'));
      expect(apres.endsWith('\n')).toBe(avantI18n[l].endsWith('\n'));
    }
    expect(lire(i18n('fr'))).toBe(avantI18n.fr);
  });

  test('deuxieme passage : rien a ecrire ; --check avec et sans dossier de traductions', () => {
    expect(rapport(build(['--traductions', trad])).ecrits).toBe(0);
    expect(build(['--check', '--traductions', trad]).status).toBe(0);
    expect(build(['--check']).status).toBe(0); // les packs deja integres sont conserves
  });

  test('--langues restreint le dossier de traductions', () => {
    const r = build(['--check', '--traductions', trad, '--langues', 'en,de']);
    expect(r.status).toBe(0);
    expect(rapport(r).languesTraduitesCeTour).toEqual(['de', 'en']);
  });

  describe("refus (rien n'est ecrit)", () => {
    const copieTrad = (nom, langs = ['en', 'ru']) => {
      const d = path.join(tmp, `trad-${nom}`);
      fs.rmSync(d, { recursive: true, force: true });
      for (const l of langs) fs.cpSync(path.join(trad, l), path.join(d, l), { recursive: true });
      return d;
    };
    const modifier = (d, lang, fichier, fn) => {
      const f = path.join(d, lang, fichier);
      const o = lireJson(f);
      fs.writeFileSync(f, JSON.stringify(fn(o) || o));
    };
    const essayer = (nom, fn, attendu, extra = []) => {
      test(nom, () => {
        const d = copieTrad(nom.replace(/\W+/g, '-'));
        fn(d);
        const r = build(['--check', '--traductions', d, ...extra]);
        expect(r.status).toBe(1);
        expect(r.err).toContain(attendu);
      });
    };

    essayer(
      'titre manquant',
      (d) => modifier(d, 'en', 'titres-1.json', (o) => o.slice(1)),
      'titre(s) manquant(s)'
    );
    essayer(
      'phrase manquante',
      (d) => modifier(d, 'en', 'phrases-0.json', (o) => o.slice(0, -1)),
      'phrase(s) manquante(s)'
    );
    essayer(
      "nom d'ingredient manquant",
      (d) => modifier(d, 'ru', 'ingredients.json', (o) => o.slice(1)),
      "nom(s) d'ingredient manquant(s)"
    );
    essayer(
      'ingredient inconnu',
      (d) => modifier(d, 'ru', 'ingredients.json', (o) => [...o, { cle: 'farine', t: 'Мука' }]),
      'inconnu(s) ou deja traduit(s)'
    );
    essayer(
      'chiffres differents du francais dans une phrase',
      (d) =>
        modifier(d, 'en', 'phrases-0.json', (o) => {
          const k = o.findIndex((e) => /\d/.test(e.t));
          o[k].t = o[k].t.replace(/\d+/g, '999');
        }),
      'chiffres differents du francais'
    );
    essayer(
      'tiret cadratin',
      (d) =>
        modifier(d, 'ru', 'phrases-0.json', (o) => {
          o[3].t += ` ${String.fromCharCode(0x2014)} fin`;
        }),
      'tiret cadratin'
    );
    essayer(
      'fleche',
      (d) =>
        modifier(d, 'en', 'titres-0.json', (o) => {
          o[3].t += ` ${String.fromCharCode(0x2192)}`;
        }),
      'tiret cadratin, demi-cadratin ou fleche'
    );
    essayer(
      'phrase non traduite (ecriture attendue)',
      (d) =>
        modifier(d, 'ru', 'phrases-0.json', (o) => {
          o[5].t = 'Cook for 10 minutes.';
        }),
      'ecriture attendue'
    );
    essayer(
      'saut de ligne',
      (d) =>
        modifier(d, 'en', 'titres-0.json', (o) => {
          o[7].t = 'a\nb';
        }),
      'saut de ligne'
    );
    essayer(
      'texte vide',
      (d) =>
        modifier(d, 'en', 'titres-0.json', (o) => {
          o[7].t = '  ';
        }),
      'texte vide'
    );
    essayer(
      'gabarit residuel',
      (d) =>
        modifier(d, 'en', 'phrases-0.json', (o) => {
          o[2].t += ' {0}';
        }),
      'gabarit'
    );
    essayer(
      'indice hors plage',
      (d) => modifier(d, 'en', 'titres-0.json', (o) => [...o, { i: 99999, t: 'x' }]),
      'cases inexistantes'
    );
    essayer(
      'doublon contradictoire',
      (d) => modifier(d, 'en', 'titres-0.json', (o) => [...o, { i: o[0].i, t: 'autre' }]),
      'traduit deux fois differemment'
    );
    essayer(
      'dossier de langue inconnu',
      (d) => fs.mkdirSync(path.join(d, 'xx')),
      'dossier de langue inconnu'
    );
    essayer('langue demandee absente', () => {}, 'demandee par --langues mais absente', [
      '--langues',
      'de',
    ]);
    essayer(
      'JSON illisible',
      (d) => fs.writeFileSync(path.join(d, 'en', 'titres-2.json'), '{'),
      'illisible'
    );
    essayer(
      'apostrophe typographique',
      (d) =>
        modifier(d, 'en', 'phrases-0.json', (o) => {
          const k = o.findIndex((e) => e.t.includes("'"));
          o[k].t = o[k].t.replace("'", '’');
        }),
      'apostrophe typographique'
    );

    test("--corriger-apostrophes remet l'apostrophe droite", () => {
      const d = copieTrad('apostrophes');
      modifier(d, 'en', 'phrases-0.json', (o) => {
        const k = o.findIndex((e) => e.t.includes("'"));
        o[k].t = o[k].t.replace("'", '’');
      });
      const r = build(['--check', '--traductions', d, '--corriger-apostrophes']);
      expect(r.err).toBe('');
      expect(r.status).toBe(0);
    });

    test('pack deja integre incomplet', () => {
      const f = gen('lang', 'de-steps.js');
      const r = avecFichier(
        f,
        () => 'module.exports = "a\\nb";\n',
        () => build(['--check'])
      );
      expect(r.status).toBe(1);
      expect(r.err).toContain('pack incomplet');
    });

    test('--toutes-les-langues sans traductions', () => {
      const vierge = path.join(tmp, 'racine-vierge');
      fs.rmSync(vierge, { recursive: true, force: true });
      copierRacine(vierge);
      garderFrancaisSeul(vierge);
      const r = node(BUILD, [
        '--racine',
        vierge,
        '--a-traduire',
        atrad,
        '--check',
        '--toutes-les-langues',
      ]);
      expect(r.status).toBe(1);
      expect(r.err).toContain('langue(s) absente(s)');
      fs.rmSync(vierge, { recursive: true, force: true });
    });

    test("un i18n au format non reproductible n'est pas modifie", () => {
      const f = i18n('de');
      const avant = lire(f);
      const r = avecFichier(
        f,
        (s) => s.replace(/\r?\n/g, '\n').replace('{\n  "recipes"', '{\n    "recipes"'),
        () => build(['--check', '--traductions', trad, '--langues', 'de'])
      );
      expect(lire(f)).toBe(avant);
      expect(r.status).toBe(1);
      expect(r.err).toContain('format non reproductible');
    });
  });
});

describe('validate-menus.js (catalogue compact)', () => {
  const meta = () => require(gen('meta.js'));
  const hdrPath = () => gen('hdr.js');
  const caseOu = (pred) => {
    const m = meta();
    const h = require(hdrPath());
    const w = Object.fromEntries(m.FIELDS);
    const lit = (nom, c) => readInt(h[nom], c * w[nom], w[nom]);
    for (let c = 0; c < m.N; c++) if ((lit('flags', c) & 4) === 0 && pred(lit, c)) return c;
    throw new Error('aucune case');
  };
  const poserChamp = (nom, c, valeur) => (hdr) => {
    const w = Object.fromEntries(meta().FIELDS)[nom];
    hdr[nom] = hdr[nom].slice(0, c * w) + writeInt(valeur, w) + hdr[nom].slice((c + 1) * w);
  };
  const avecHdr = (fn, essai) => avecModule(hdrPath(), fn, essai);
  const attendre = (r, extrait) => {
    expect(r.status).toBe(1);
    expect(r.err).toContain(extrait);
  };

  test('donnees integrees : seules les plages de kcal sont signalees (decision du user en attente)', () => {
    const r = valider();
    expect(sansKcal(r.err)).toEqual([]);
    expect(r.out + r.err).not.toContain('Catalogue genere absent');
  });

  test('la fixture est valide aussi', () => {
    const r = valider(['--gen', path.join(racine, 'data', 'menus', 'gen-fixture')]);
    expect(r.err.split('\n').filter((l) => l.trim() && !/^avertissement/.test(l))).toEqual([]);
    expect(r.status).toBe(0);
    expect(r.out).toContain('Catalogue genere : 50 recettes');
  });

  test('poisson garde plus de 2 jours', () => {
    const c = caseOu((lit, i) => (lit('alg', i) & 8) !== 0);
    attendre(
      avecHdr(poserChamp('keep', c, 5), () => valider()),
      'poisson ou crustaces gardes plus de 2 jours'
    );
  });

  test('poisson congelable', () => {
    const c = caseOu((lit, i) => (lit('alg', i) & 8) !== 0 && (lit('flags', i) & 2) === 0);
    attendre(
      avecHdr(
        (h) => poserChamp('flags', c, readInt(h.flags, c, 1) | 3)(h),
        () => valider()
      ),
      'poisson ou crustaces congelables'
    );
  });

  test('tag sans-gluten sur une recette au gluten', () => {
    const c = caseOu((lit, i) => (lit('alg', i) & 1) !== 0 && (lit('tags', i) & 4) === 0);
    attendre(
      avecHdr(
        (h) => poserChamp('tags', c, readInt(h.tags, c * 3, 3) | 4)(h),
        () => valider()
      ),
      'sans-gluten avec du gluten'
    );
  });

  test('vegetarien sur une recette de viande', () => {
    // une recette sans tag vegetarien qui contient du poisson
    const c = caseOu((lit, i) => (lit('alg', i) & 8) !== 0 && (lit('tags', i) & 1) === 0);
    attendre(
      avecHdr(
        (h) => poserChamp('tags', c, readInt(h.tags, c * 3, 3) | 1)(h),
        () => valider()
      ),
      'vegetarien avec viande ou poisson'
    );
  });

  test("nombre d'etapes hors de 3 a 6", () => {
    attendre(
      avecHdr(poserChamp('nStep', 5, 1), () => valider()),
      'il faut 3 a 6 etapes'
    );
  });

  test('plages : temps, cout', () => {
    attendre(
      avecHdr(poserChamp('time', 7, 200), () => valider()),
      'temps hors de 5 a 480 min'
    );
    attendre(
      avecHdr(poserChamp('cost', 9, 1), () => valider()),
      'cout par portion hors de 0,2 a 20 EUR'
    );
  });

  test('cout different du calcul sur les ingredients', () => {
    const c = caseOu((lit, i) => lit('cost', i) >= 20 && lit('cost', i) < 150);
    attendre(
      avecHdr(
        (h) => poserChamp('cost', c, readInt(h.cost, c * 2, 2) + 25)(h),
        () => valider()
      ),
      'colonne cost differente du calcul'
    );
  });

  test("allergenes differents de l'union des ingredients", () => {
    attendre(
      avecHdr(
        (h) => poserChamp('alg', 11, readInt(h.alg, 11 * 3, 3) ^ 1)(h),
        () => valider()
      ),
      'colonne alg differente'
    );
  });

  test('colonne tronquee', () => {
    attendre(
      avecHdr(
        (h) => {
          h.kcal = h.kcal.slice(0, -2);
        },
        () => valider()
      ),
      'colonne kcal'
    );
  });

  test('bloc de lignes tronque', () => {
    attendre(
      avecFichier(
        gen('lines-0.js'),
        (s) => s.replace(/.{3}";\s*$/, '";\n'),
        () => valider()
      ),
      'bloc tronque'
    );
  });

  test('temperature de four hors plage', () => {
    attendre(
      avecModule(
        gen('meta.js'),
        (o) => {
          const p = o.PHRASE_META.split('|');
          p[0] = '1,600,123';
          o.PHRASE_META = p.join('|');
        },
        () => valider()
      ),
      'temperature de four'
    );
  });

  test('titre francais vide, en double', () => {
    attendre(
      avecFichier(
        gen('lang', 'fr-titles-0.js'),
        (s) => s.replace(/^module\.exports = "[^\\"]*/, 'module.exports = "'),
        () => valider()
      ),
      'titre francais'
    );
    const lignes = lire(gen('lang', 'fr-titles-0.js'));
    const premiere = JSON.parse(lignes.replace('module.exports = ', '').replace(/;\s*$/, '')).split(
      '\n'
    );
    attendre(
      avecFichier(
        gen('lang', 'fr-titles-0.js'),
        () =>
          `module.exports = ${JSON.stringify([premiere[0], premiere[0], ...premiere.slice(2)].join('\n'))};\n`,
        () => valider()
      ),
      'titre francais en double'
    );
  });

  test('langue inconnue dans loaders.js', () => {
    attendre(
      avecFichier(
        gen('loaders.js'),
        (s) => s.replace("const LANGS = ['fr'", "const LANGS = ['xx', 'fr'"),
        () => valider()
      ),
      'langue inconnue'
    );
  });

  test('pack de langue : titre vide, chiffres, tiret, ecriture, apostrophe', () => {
    const phrasesEn = JSON.parse(
      lire(gen('lang', 'en-steps.js')).replace('module.exports = ', '').replace(/;\s*$/, '')
    ).split('\n');
    const k = phrasesEn.findIndex((p) => /\d/.test(p));
    const ecrire = (f, lignes) => `module.exports = ${JSON.stringify(lignes.join('\n'))};\n`;
    const modPhrase = (lang, fn) =>
      avecFichier(
        gen('lang', `${lang}-steps.js`),
        (s) => {
          const l = JSON.parse(s.replace('module.exports = ', '').replace(/;\s*$/, '')).split('\n');
          fn(l);
          return ecrire('', l);
        },
        () => valider()
      );
    attendre(
      modPhrase('en', (l) => {
        l[k] = l[k].replace(/\d+/g, '777');
      }),
      'traduction en : phrase avec des chiffres differents'
    );
    attendre(
      modPhrase('en', (l) => {
        l[0] += ` ${String.fromCharCode(0x2014)} x`;
      }),
      'traduction en : phrase avec tiret'
    );
    attendre(
      modPhrase('en', (l) => {
        l[1] = ' ';
      }),
      'traduction en : phrase vide'
    );
    attendre(
      modPhrase('en', (l) => {
        l[1] = 'l’eau';
      }),
      'traduction en : phrase avec apostrophe typographique'
    );
    attendre(
      modPhrase('ru', (l) => {
        l[2] = 'Cook it.';
      }),
      "traduction ru : phrase sans caractere de l'ecriture attendue"
    );
    attendre(
      modPhrase('th', (l) => l.pop()),
      'phrases th'
    );
    attendre(
      avecFichier(
        gen('lang', 'ja-titles-0.js'),
        (s) => s.replace(/^module\.exports = "[^\\"]*/, 'module.exports = "'),
        () => valider()
      ),
      'traduction ja : titre vide'
    );
  });

  test('ingredient sans nom dans une langue du catalogue', () => {
    const f = i18n('de');
    const r = avecFichier(
      f,
      (s) => s.replace(/"yaourt-grec": "[^"]*"/, '"yaourt-grec": ""'),
      () => valider()
    );
    attendre(r, "de : nom d'ingredient manquant ou vide yaourt-grec");
  });

  test('catalogue absent : controle ignore', () => {
    const vide = path.join(tmp, 'racine-sans-gen');
    fs.rmSync(vide, { recursive: true, force: true });
    fs.mkdirSync(path.join(vide, 'data', 'menus', 'i18n'), { recursive: true });
    for (const f of ['recipes.json', 'ingredients.json'])
      fs.copyFileSync(path.join(REPO, 'data', 'menus', f), path.join(vide, 'data', 'menus', f));
    fs.copyFileSync(
      path.join(REPO, 'data', 'menus', 'i18n', 'fr.json'),
      path.join(vide, 'data', 'menus', 'i18n', 'fr.json')
    );
    const r = node(VALIDATE, ['--racine', vide]);
    expect(r.status).toBe(0);
    expect(r.out).toContain('Catalogue genere absent');
    fs.rmSync(vide, { recursive: true, force: true });
  });
});
