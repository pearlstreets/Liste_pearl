// Correctifs issus de la relecture independante : cases allergie, profil courant de la liste courte,
// accompagnements, chiffres des traductions, etapes sans texte.
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { eligibleCatalog, buildPool, rejectWith, prepareElig, POOL_PLAN } from '../lib/menus/pool';
import { getCore } from '../lib/menus/catalog';

const { memesChiffres } = require('../scripts/menus-gen/chiffres');

const reel = () => ({
  meta: require('../data/menus/gen/meta.js'),
  hdr: require('../data/menus/gen/hdr.js'),
  loaders: require('../data/menus/gen/loaders.js'),
});
beforeEach(() => {
  resetMenusCache();
  setGenSource(reel());
});
afterAll(() => {
  setGenSource(null);
  resetGenSource();
  resetMenusCache();
});

describe('cases allergie au moins aussi strictes que les regimes', () => {
  const CAS = [
    ['gluten', 'sans-gluten'],
    ['lait', 'sans-lactose'],
    ['porc', 'sans-porc'],
    ['fruits-a-coque', 'sans-fruits-a-coque'],
  ];
  test.each(CAS)('exclure %s ecarte les cases sans le tag %s', (allergene, tag) => {
    const cat = getCatalog();
    const c = getCore();
    const el = eligibleCatalog(cat, getIngredients(), {
      adults: 2,
      excludedIngredients: [allergene],
    });
    const bit = 1 << c.TAGS.indexOf(tag);
    let admises = 0;
    for (let i = 0; i < c.N; i++) {
      if (el.gen.all[i] !== 1) continue;
      admises++;
      expect(c.cols.tags[i] & bit).toBe(bit);
    }
    expect(admises).toBeGreaterThan(100);
  });

  test('exclure oeuf ecarte les gnocchis et les nouilles', () => {
    const cat = getCatalog();
    const c = getCore();
    const ings = getIngredients();
    const el = eligibleCatalog(cat, ings, { adults: 2, excludedIngredients: ['oeuf'] });
    const e = prepareElig({ adults: 2, excludedIngredients: ['oeuf'] });
    let vus = 0;
    for (let i = 0; i < c.N && vus < 40; i++) {
      const r = cat.materialize(i);
      if (!r || !r.ingredients.some((x) => x.key === 'gnocchi' || x.key === 'nouilles')) continue;
      vus++;
      expect(el.gen.all[i]).toBe(0);
      expect(rejectWith(r, ings, e)).toBe('excluded');
    }
    expect(vus).toBeGreaterThan(0);
  });
});

describe('profil courant de la liste courte', () => {
  test('le budget change la liste courte meme avec une eligibilite en cache', () => {
    const cat = getCatalog();
    const ings = getIngredients();
    const el = eligibleCatalog(cat, ings, { adults: 2, diets: [] });
    const sans = buildPool(el, { seed: 3, K: POOL_PLAN, profile: { ...el.p, budget: 0 } });
    const avec = buildPool(el, { seed: 3, K: POOL_PLAN, profile: { ...el.p, budget: 30 } });
    expect(avec.entries.join(',')).not.toBe(sans.entries.join(','));
    // sans profil passe : le profil de l'eligibilite
    const defaut = buildPool(el, { seed: 3, K: POOL_PLAN });
    expect(defaut.entries.join(',')).toBe(sans.entries.join(','));
  });
});

describe('accompagnements', () => {
  test('aucun accompagnement n\'est de course plat', () => {
    const c = getCore();
    getCatalog();
    const side = c.SUBS.indexOf('accompagnements');
    const plat = c.COURSES.indexOf('plat');
    let n = 0;
    for (let i = 0; i < c.N; i++) {
      if (c.cols.sub[i] !== side) continue;
      n++;
      expect(c.cols.course[i]).not.toBe(plat);
    }
    expect(n).toBeGreaterThan(300);
  });
});

describe('chiffres des traductions', () => {
  test('un chiffre disparu ou invente est refuse', () => {
    expect(memesChiffres('Cuire 3 minutes.', 'Kochen Sie Minuten.')).toBe(false);
    expect(memesChiffres('Cuire 3 minutes.', 'Kochen Sie drei Minuten.')).toBe(true);
    expect(memesChiffres('Cuire minutes.', 'Cook 3 minutes.')).toBe(false);
    expect(memesChiffres('Cuire 2 min.', 'اطبخوا دقيقتين.')).toBe(true);
    expect(memesChiffres('Cuire 3 min.', 'اطبخوا دقيقتين.')).toBe(false);
  });
  test('un chiffre ecrit en lettres en francais est accepte', () => {
    expect(memesChiffres('Remplir aux deux tiers.', 'Fill to 2/3.')).toBe(true);
    expect(memesChiffres('Garder une louche.', 'Keep 1 ladle.')).toBe(true);
    expect(memesChiffres('Cuire 18 min.', 'Cook 8 min.')).toBe(false);
  });
});
