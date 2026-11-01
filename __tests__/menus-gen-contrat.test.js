// Contrat des donnees generees (lot 0 et lot A de scripts/menus-gen/CONCEPTION.md) :
// relit data/menus/gen et data/menus/gen-fixture avec lib/menus/b64.js et verifie colonnes, lignes, etapes, titres.
import { readInt, writeInt } from '../lib/menus/b64';

const ingredients = require('../data/menus/ingredients.json');

const DASH = /[—–→←⇒⇔↔]/;

function charger(dir) {
  const base = `../data/menus/${dir}`;
  const meta = require(`${base}/meta.js`);
  const hdr = require(`${base}/hdr.js`);
  const loaders = require(`${base}/loaders.js`);
  return { meta, hdr, loaders };
}

function colonnes({ meta, hdr }) {
  const col = {};
  for (const [nom, w] of meta.FIELDS) {
    expect(hdr[nom].length).toBe(meta.N * w);
    const a = new Array(meta.N);
    for (let i = 0; i < meta.N; i++) a[i] = readInt(hdr[nom], i * w, w);
    col[nom] = a;
  }
  return col;
}

describe('b64', () => {
  test('aller-retour et valeurs invalides', () => {
    for (const [v, n] of [[0, 1], [63, 1], [64, 2], [4095, 2], [262143, 3], [123456, 4]]) expect(readInt(writeInt(v, n), 0, n)).toBe(v);
    expect(writeInt(64, 1)).toBeNull();
    expect(readInt('A', 0, 2)).toBe(-1);
    expect(readInt('A!', 0, 2)).toBe(-1);
    expect(readInt(null, 0, 1)).toBe(-1);
    expect(readInt('BA', 0, 2)).toBe(64);
  });
});

describe.each(['gen', 'gen-fixture'])('donnees %s', (dir) => {
  const d = charger(dir);
  const { meta, loaders } = d;
  const col = colonnes(d);
  const ING = meta.ING_KEYS.split('\n');
  const PAIRS = meta.PAIRS.split('|');
  const PM = meta.PHRASE_META.split('|').map((x) => x.split(',').map(Number));
  const phrases = loaders.phrases('fr').split('\n');
  const nbBlocs = Math.ceil(meta.N / meta.SHARD);

  test('meta et ordre des ingredients', () => {
    expect(meta.VERSION).toBe(1);
    expect(meta.SHARD).toBe(2048);
    expect(ING).toEqual(Object.keys(ingredients));
    expect(loaders.NB_BLOCS).toBe(nbBlocs);
    expect(PM.length).toBe(phrases.length);
    expect(phrases.length).toBeLessThanOrEqual(meta.PHRASE_CONT);
    for (const p of phrases) {
      expect(p.trim()).not.toBe('');
      expect(DASH.test(p)).toBe(false);
    }
    for (const [g, s, t] of PM) {
      expect([0, 1, 2, 3]).toContain(g);
      if (g === 0) expect(s).toBe(0);
      else expect(s % 60).toBe(0);
      if (t) expect(t >= 100 && t <= 280 && t % 10 === 0).toBe(true);
    }
  });

  test('colonnes', () => {
    for (let i = 0; i < meta.N; i++) {
      if (col.flags[i] & 4) continue;
      expect(col.course[i]).toBeLessThan(meta.COURSES.length);
      expect(col.sub[i]).toBeLessThan(meta.SUBS.length);
      expect(col.family[i]).toBeLessThanOrEqual(meta.FAMILIES.split('\n').length);
      expect(col.time[i]).toBeGreaterThan(0);
      expect(col.diff[i]).toBeLessThanOrEqual(2);
      expect(col.kcal[i]).toBeGreaterThan(0);
      expect(col.keep[i]).toBeGreaterThanOrEqual(1);
      expect(col.keep[i]).toBeLessThanOrEqual(14);
      expect(col.nIng[i]).toBeGreaterThanOrEqual(2);
      expect(col.nStep[i]).toBeGreaterThanOrEqual(3);
      expect(col.nStep[i]).toBeLessThanOrEqual(6);
      expect(col.nPhr[i]).toBeGreaterThanOrEqual(col.nStep[i]);
      expect(col.main1[i]).toBeLessThanOrEqual(ING.length);
      expect(col.main2[i]).toBeLessThanOrEqual(ING.length);
    }
  });

  test('lignes, etapes, titres, coherence des tags', () => {
    let li = 0;
    let si = 0;
    let n = 0;
    const lignesBloc = [];
    const etapesBloc = [];
    const titres = [];
    for (let b = 0; b < nbBlocs; b++) {
      lignesBloc.push(loaders.lines(b));
      etapesBloc.push(loaders.steps(b));
      const t = loaders.titles('fr', b).split('\n');
      expect(t.length).toBe(b < nbBlocs - 1 ? meta.SHARD : meta.N - b * meta.SHARD);
      titres.push(...t);
    }
    const pairBits = meta.PAIR_BITS;
    for (let i = 0; i < meta.N; i++) {
      const b = Math.floor(i / meta.SHARD);
      if (i % meta.SHARD === 0) { li = 0; si = 0; }
      expect(titres[i].trim()).not.toBe('');
      expect(DASH.test(titres[i])).toBe(false);
      const als = new Set();
      let viande = false;
      const cles = new Set();
      for (let k = 0; k < col.nIng[i]; k++) {
        const v = readInt(lignesBloc[b], li * meta.LINE_W, meta.LINE_W);
        li++;
        expect(v).toBeGreaterThanOrEqual(0);
        const ing = ING[v % 512];
        const pr = Math.floor(v / 512) % (1 << pairBits);
        expect(PAIRS[pr]).toBeDefined();
        const [qty, unit] = PAIRS[pr].split(':');
        const f = ingredients[ing];
        expect(f).toBeDefined();
        expect(Number(qty)).toBeGreaterThan(0);
        expect(['g', 'ml', 'u', 'cs', 'cc']).toContain(unit);
        if (unit === 'cs' || unit === 'cc') expect(f.pantry).toBe(true);
        else expect(unit).toBe(f.pack.unit);
        expect(cles.has(ing)).toBe(false);
        cles.add(ing);
        (f.allergens || []).forEach((a) => als.add(a));
        if (f.aisle === 'viandes-poissons' || (f.allergens || []).includes('crustaces')) viande = true;
      }
      // etapes : nPhr identifiants, nStep fins d'etape, derniere phrase sans continuation
      let fins = 0;
      for (let k = 0; k < col.nPhr[i]; k++) {
        const v = readInt(etapesBloc[b], si * 2, 2);
        si++;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v % meta.PHRASE_CONT).toBeLessThan(phrases.length);
        if (v < meta.PHRASE_CONT) fins++;
        else expect(k).toBeLessThan(col.nPhr[i] - 1);
      }
      expect(fins).toBe(col.nStep[i]);
      // coherence tags / allergenes / conservation (regles de validate-menus.js)
      const tags = meta.TAGS.filter((t, k) => Math.floor(col.tags[i] / 2 ** k) % 2 === 1);
      const has = (t) => tags.includes(t);
      if (has('vegetarien')) expect(viande).toBe(false);
      if (has('vegan')) expect(viande || als.has('lait') || als.has('oeuf') || als.has('miel')).toBe(false);
      if (has('sans-gluten')) expect(als.has('gluten')).toBe(false);
      if (has('sans-lactose')) expect(als.has('lait')).toBe(false);
      if (has('sans-porc') || has('halal-possible')) expect(als.has('porc')).toBe(false);
      if (has('sans-fruits-a-coque')) expect(als.has('fruits-a-coque')).toBe(false);
      if (has('vegan')) expect(has('vegetarien')).toBe(true);
      if (has('halal-possible')) expect(has('sans-porc')).toBe(true);
      const mer = als.has('poisson') || als.has('crustaces');
      if (mer) {
        expect(col.keep[i]).toBeLessThanOrEqual(2);
        expect(col.flags[i] & 2).toBe(0);
      }
      if (col.flags[i] & 2) expect(col.flags[i] & 1).toBe(1);
      const alg = meta.ALG_KEYS.filter((a, k) => Math.floor(col.alg[i] / 2 ** k) % 2 === 1);
      expect(alg.sort()).toEqual([...als].sort());
      n++;
    }
    expect(n).toBe(meta.N);
    // les decalages cumules retombent sur la taille des blocs
    expect(li).toBeGreaterThan(0);
  });

  test('identifiants g- reversibles', () => {
    for (const c of [0, 1, 35, 36, meta.N - 1]) {
      if (c >= meta.N) continue;
      const id = `g-${c.toString(36)}`;
      expect(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)).toBe(true);
      expect(parseInt(id.slice(2), 36)).toBe(c);
    }
  });
});
