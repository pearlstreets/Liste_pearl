// Eligibilite par masques de bits, liste courte, echantillonnage et audit sur le catalogue genere
// (lib/menus/pool.js). Donnees : fixture de 50 recettes et vraies donnees francaises (11 581 cases).
import { setGenSource, resetGenSource } from '../lib/menus/genSource';
import { getRecipes, getCatalog, getIngredients, resetMenusCache } from '../lib/menus/recipes';
import { rejectReason, eligibleRecipes, generatePlan, swapMeal } from '../lib/menus/planner';
import {
  eligibleCatalog,
  prepareElig,
  buildPool,
  sampleMains,
  auditPlan,
  catalogActive,
  cheapest,
  profileSig,
  POOL_PLAN,
  POOL_SWAP,
} from '../lib/menus/pool';
import { getCore } from '../lib/menus/catalog';
import { createRng } from '../lib/menus/util';

const reel = () => ({
  meta: require('../data/menus/gen/meta.js'),
  hdr: require('../data/menus/gen/hdr.js'),
  loaders: require('../data/menus/gen/loaders.js'),
});
function utiliser(src) {
  resetMenusCache();
  setGenSource(src);
}
beforeEach(() => {
  resetMenusCache();
  setGenSource(null);
  resetGenSource();
});
afterAll(() => {
  setGenSource(null);
  resetMenusCache();
});

const REGIMES = [
  'vegetarien',
  'vegan',
  'sans-gluten',
  'sans-lactose',
  'sans-porc',
  'halal-possible',
  'sans-fruits-a-coque',
];
const ALLERGENES = [
  'gluten',
  'lait',
  'oeuf',
  'poisson',
  'crustaces',
  'soja',
  'sesame',
  'fruits-a-coque',
  'miel',
  'porc',
];
const CLES = [
  'champignon',
  'poulet-filet',
  'oignon',
  'tomate',
  'citron',
  'saumon',
  'lardons',
  'courgette',
  'riz',
];

// Profils aleatoires deterministes.
function profilsAleatoires(n, graine) {
  const rng = createRng(graine);
  const pick = (liste, k) => liste.filter(() => rng() < k / liste.length);
  const out = [
    { adults: 2 },
    { adults: 2, diets: ['vegan'] },
    { adults: 2, excludedIngredients: ['gluten', 'lait'] },
  ];
  for (let i = 0; i < n; i++) {
    const t = rng();
    out.push({
      adults: 2,
      children: Math.floor(rng() * 3),
      diets: pick(REGIMES, 1.2),
      excludedIngredients: [...pick(ALLERGENES, 1.2), ...pick(CLES, 0.8)],
      maxTimeMin: t < 0.5 ? null : [15, 20, 30, 45, 60][Math.floor(rng() * 5)],
    });
  }
  return out;
}

describe('eligibilite par masques de bits', () => {
  let toutes; // objets de toutes les cases non retirees
  const prepare = () => {
    utiliser(reel());
    const cat = getCatalog();
    const c = getCore();
    toutes = [];
    for (let i = 0; i < c.N; i++) {
      const r = cat.materialize(i);
      if (r) toutes.push([i, r]);
    }
    return { cat, c };
  };

  test('equivalence avec rejectReason sur les 474 ecrites a la main et sur toutes les cases generees', () => {
    const { cat, c } = prepare();
    const ings = getIngredients();
    const legacy = getRecipes();
    expect(toutes.length).toBe(c.alive);
    for (const profil of profilsAleatoires(14, 'equiv')) {
      const el = eligibleCatalog(cat, ings, profil);
      // 474 : memes admises, memes plats que le chemin tableau
      const ref = eligibleRecipes({ recipes: legacy, ingredients: ings, profile: profil });
      expect(el.legacyAll.map((r) => r.id)).toEqual(ref.all.map((r) => r.id));
      expect(el.legacyMains.map((r) => r.id)).toEqual(ref.mains.map((r) => r.id));
      // generees : masque == rejectReason, raison par raison
      const compte = { diet: 0, excluded: 0, time: 0 };
      let admises = 0;
      for (const [row, r] of toutes) {
        const why = rejectReason(r, ings, profil);
        if (why) compte[why]++;
        else admises++;
        if ((el.gen.all[row] === 1) !== !why)
          throw new Error(
            `case ${row} (${r.id}) : masque ${el.gen.all[row]} mais rejectReason ${why} pour ${JSON.stringify(profil)}`
          );
      }
      expect(el.gen.nAll).toBe(admises);
      expect(el.gen.rejected).toEqual(compte);
      // allows() egal a l'appartenance a l'ensemble des admises
      for (const [row, r] of toutes.slice(0, 400))
        expect(el.allows(r.id)).toBe(el.gen.all[row] === 1);
    }
  }, 120000);

  test('les plats sont les cases de course plat hors accompagnements', () => {
    const { cat, c } = prepare();
    const el = eligibleCatalog(cat, getIngredients(), { adults: 2 });
    const attendu = toutes.filter(
      ([, r]) => r.course === 'plat' && r.sub !== 'accompagnements'
    ).length;
    expect(el.G).toBe(attendu);
    expect(el.M).toBe(el.L + el.G);
    for (let g = 0; g < Math.min(el.G, 300); g++) {
      const row = el.gen.rows[g];
      expect(c.cols.course[row]).toBe(0);
      expect(el.entryOfRow[row]).toBe(el.L + g);
      expect(el.entryOf(el.idOfEntry(el.L + g))).toBe(el.L + g);
    }
  });

  test('profil mis en cache par signature : meme objet, nouvelle signature = nouveau calcul', () => {
    utiliser(reel());
    const cat = getCatalog();
    const ings = getIngredients();
    const a = eligibleCatalog(cat, ings, { adults: 2, diets: ['vegan'] });
    const b = eligibleCatalog(cat, ings, { adults: 3, children: 1, diets: ['vegan'], budget: 50 });
    expect(b).toBe(a); // adultes, enfants et budget ne changent pas l'eligibilite
    const c2 = eligibleCatalog(cat, ings, { adults: 2, diets: ['vegetarien'] });
    expect(c2).not.toBe(a);
    expect(profileSig(prepareElig({ adults: 2, pantry: ['sel'] }))).not.toBe(
      profileSig(prepareElig({ adults: 2 }))
    );
  });

  test("exclusion par cle d'ingredient et par allergene hors masque", () => {
    const { cat } = prepare();
    const ings = getIngredients();
    for (const profil of [
      { adults: 2, excludedIngredients: ['champignon'] },
      { adults: 2, excludedIngredients: ['CHAMPIGNON', 'Lait'] },
      { adults: 2, excludedIngredients: ['inconnu-total'] },
    ]) {
      const el = eligibleCatalog(cat, ings, profil);
      for (const [row, r] of toutes)
        expect((el.gen.all[row] === 1) === !rejectReason(r, ings, profil)).toBe(true);
    }
  }, 60000);

  test('catalogue degrade : la facade ne passe pas par le chemin catalogue', () => {
    utiliser({ meta: {}, hdr: {}, loaders: {} });
    expect(catalogActive(getCatalog())).toBe(false);
    const plan = generatePlan({
      recipes: getCatalog(),
      ingredients: getIngredients(),
      profile: { adults: 2 },
      seed: 3,
    });
    expect(plan.meals.some((m) => m.recipeId)).toBe(true);
    expect(plan.meals.some((m) => (m.recipeId || '').startsWith('g-'))).toBe(false);
  });
});

describe('liste courte', () => {
  const lancer = () => {
    utiliser(reel());
    const cat = getCatalog();
    return { cat, ings: getIngredients() };
  };

  test('deterministe a graine egale, differente selon la graine', () => {
    const { cat, ings } = lancer();
    const el = eligibleCatalog(cat, ings, { adults: 2 });
    const a = buildPool(el, { seed: 5, K: POOL_PLAN });
    const b = buildPool(el, { seed: 5, K: POOL_PLAN });
    const c = buildPool(el, { seed: 6, K: POOL_PLAN });
    expect(b.entries).toEqual(a.entries);
    expect(c.entries).not.toEqual(a.entries);
    expect(a.entries.length).toBeGreaterThan(150);
    expect(a.entries.length).toBeLessThanOrEqual(POOL_PLAN);
    expect(new Set(a.entries).size).toBe(a.entries.length);
  });

  test('au moins 12 familles dans la liste courte par defaut, un plafond par ingredient principal', () => {
    const { cat, ings } = lancer();
    const el = eligibleCatalog(cat, ings, { adults: 2 });
    for (let seed = 1; seed <= 10; seed++) {
      const { entries } = buildPool(el, { seed, K: POOL_PLAN });
      const fam = new Set(entries.map((e) => el.fam[e]).filter((f) => f > 0));
      expect(fam.size).toBeGreaterThanOrEqual(12);
      const parMain = new Map();
      for (const e of entries)
        if (el.main1[e]) parMain.set(el.main1[e], (parMain.get(el.main1[e]) || 0) + 1);
      expect(Math.max(...parMain.values())).toBeLessThanOrEqual(6);
    }
  });

  test('repas poses hors liste conserves ; echange : 140 au plus ; petite priorite des recettes relues', () => {
    const { cat, ings } = lancer();
    const el = eligibleCatalog(cat, ings, { adults: 2 });
    // une case quelconque (peu probable dans la liste) est forcee
    const forced = el.L + Math.floor(el.G / 2);
    const sans = buildPool(el, { seed: 9, K: POOL_SWAP });
    const avec = buildPool(el, { seed: 9, K: POOL_SWAP, forced: [forced] });
    expect(avec.flag[forced]).toBe(1);
    expect(avec.entries).toContain(forced);
    expect(sans.entries.length).toBeLessThanOrEqual(POOL_SWAP);
    // les recettes relues sont presentes bien au-dela de leur proportion (330 sur 9 800)
    const relues = sans.entries.filter((e) => e < el.L).length;
    expect(relues).toBeGreaterThan(POOL_SWAP * (el.L / el.M) * 3);
  });

  test('catalogue de 300 plats ou moins : la liste courte est tout le catalogue', () => {
    utiliser(reel());
    const cat = getCatalog();
    const ings = getIngredients();
    const el = eligibleCatalog(cat, ings, {
      adults: 1,
      diets: ['vegan', 'sans-gluten', 'halal-possible'],
      excludedIngredients: ['soja'],
    });
    expect(el.M).toBeLessThanOrEqual(300);
    const p = buildPool(el, { seed: 1, K: POOL_PLAN });
    expect(p.entries.length).toBe(el.M);
  });

  test('cheapest : tri par cout, plafond par ingredient principal', () => {
    const { cat, ings } = lancer();
    const el = eligibleCatalog(cat, ings, { adults: 2 });
    const liste = cheapest(el, 60, { perMain: 3 });
    expect(liste.length).toBe(60);
    for (let i = 1; i < liste.length; i++) expect(el.cost[liste[i]]).toBeGreaterThanOrEqual(0);
    const par = new Map();
    for (const e of liste) if (el.main1[e]) par.set(el.main1[e], (par.get(el.main1[e]) || 0) + 1);
    expect(Math.max(...par.values())).toBeLessThanOrEqual(3);
    // les moins chers du catalogue entier sont bien devant
    const min = Math.min(...Array.from(el.cost));
    expect(el.cost[cheapest(el, 1)[0]]).toBe(min);
  });

  test('echantillonnage : n recettes admises, hors exclusion, sans doublon, deterministe avec un rng fixe', () => {
    const { cat, ings } = lancer();
    const profil = { adults: 2, diets: ['vegetarien'], excludedIngredients: ['gluten'], month: 6 };
    const el = eligibleCatalog(cat, ings, profil);
    const a = sampleMains(el, { n: 3, rng: createRng('s1'), month: 6 });
    const b = sampleMains(el, { n: 3, rng: createRng('s1'), month: 6 });
    expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
    expect(a).toHaveLength(3);
    expect(new Set(a.map((r) => r.id)).size).toBe(3);
    for (const r of a) expect(rejectReason(r, ings, profil)).toBeNull();
    const exclus = new Set(a.map((r) => r.id));
    for (let i = 0; i < 20; i++) {
      const autres = sampleMains(el, { n: 3, exclude: exclus, month: 6 });
      for (const r of autres) expect(exclus.has(r.id)).toBe(false);
    }
    expect(sampleMains(el, { n: 0 })).toEqual([]);
    // la saison est preferee quand assez de recettes en sont : jamais un plat d'hiver en ete si l'ete suffit
    for (let i = 0; i < 20; i++)
      for (const r of sampleMains(el, { n: 3, month: 6 }))
        expect(r.tags.includes('hiver')).toBe(false);
  });

  test('auditPlan : renvoie les repas devenus incompatibles, ignore les repas libres, poses a la main et inconnus', () => {
    const { cat, ings } = lancer();
    const plan = generatePlan({
      recipes: cat,
      ingredients: ings,
      profile: { adults: 2 },
      seed: 11,
    });
    expect(auditPlan(plan, { recipes: cat, ingredients: ings, profile: { adults: 2 } })).toEqual(
      []
    );
    const strict = { adults: 2, diets: ['vegan'] };
    const res = auditPlan(plan, { recipes: cat, ingredients: ings, profile: strict });
    for (const x of res) {
      expect(x.reason).toBe('diet');
      expect(rejectReason(cat.get(x.recipeId), ings, strict)).toBe('diet');
    }
    expect(res.length).toBeGreaterThan(0);
    const faux = {
      meals: [
        { key: '0-midi', recipeId: 'g-zzzzzz' },
        { key: '0-soir', free: true },
        { key: '1-midi', recipeId: 'inconnu' },
      ],
    };
    expect(auditPlan(faux, { recipes: cat, ingredients: ings, profile: strict })).toEqual([]);
    expect(auditPlan(null, {})).toEqual([]);
  });
});

describe('planificateur avec le catalogue', () => {
  test("un repas pose d'une case generee est garde, un echange ne le touche pas", () => {
    utiliser(reel());
    const cat = getCatalog();
    const ings = getIngredients();
    const el = eligibleCatalog(cat, ings, { adults: 2 });
    const id = el.idOfEntry(el.L + 1234);
    const plan = generatePlan({
      recipes: cat,
      ingredients: ings,
      profile: { adults: 2 },
      seed: 4,
      locked: { '2-soir': id },
    });
    const m = plan.meals.find((x) => x.key === '2-soir');
    expect(m.recipeId).toBe(id);
    expect(m.locked).toBe(true);
    const autre =
      plan.meals.find((x) => x.key === '4-midi' && x.recipeId && !x.leftoverOf) ||
      plan.meals.find((x) => x.recipeId && !x.locked && !x.leftoverOf);
    const next = swapMeal({
      recipes: cat,
      ingredients: ings,
      profile: { adults: 2 },
      plan,
      mealKey: autre.key,
    });
    expect(next.meals.find((x) => x.key === '2-soir').recipeId).toBe(id);
    expect(next.meals.find((x) => x.key === autre.key).recipeId).not.toBe(autre.recipeId);
  });

  test("un id d'une recette non admise par le profil est refuse (lock_invalid), jamais place", () => {
    utiliser(reel());
    const cat = getCatalog();
    const ings = getIngredients();
    const vegan = { adults: 2, diets: ['vegan'] };
    const el = eligibleCatalog(cat, ings, { adults: 2 });
    const c = getCore();
    let id = null;
    for (let g = 0; g < el.G && !id; g++) {
      const row = el.gen.rows[g];
      if (!(c.cols.tags[row] & (1 << c.TAGS.indexOf('vegan')))) id = el.idOfEntry(el.L + g);
    }
    const plan = generatePlan({
      recipes: cat,
      ingredients: ings,
      profile: vegan,
      seed: 2,
      locked: { '0-midi': id },
    });
    expect(plan.warnings.some((w) => w.code === 'lock_invalid' && w.recipeId === id)).toBe(true);
    expect(plan.meals.some((m) => m.recipeId === id)).toBe(false);
  });

  test('plan avec le catalogue complet : variete, repas generes presents, deterministe', () => {
    utiliser(reel());
    const cat = getCatalog();
    const ings = getIngredients();
    const args = {
      recipes: cat,
      ingredients: ings,
      profile: { adults: 2, children: 2 },
      seed: 21,
      weekStart: '2026-11-02',
    };
    const a = generatePlan(args);
    const b = generatePlan(args);
    expect(b).toEqual(a);
    expect(a.warnings.filter((w) => w.code === 'error')).toEqual([]);
    const cuisines = a.meals.filter((m) => m.recipeId && !m.leftoverOf);
    expect(cuisines.length).toBeGreaterThanOrEqual(8);
    expect(new Set(cuisines.map((m) => m.recipeId)).size).toBe(cuisines.length);
  });
});

describe('derives des exclusions dans le catalogue genere', () => {
  test('aucune recette admise ne contient un derive exclu (sans lait : parmesan ; sans moutarde : mayonnaise)', () => {
    const { getCatalog, getIngredients } = require('../lib/menus/recipes');
    const { eligibleCatalog } = require('../lib/menus/pool');
    const cat = getCatalog();
    const ings = getIngredients();
    for (const [x, key] of [
      ['lait', 'parmesan'],
      ['moutarde', 'mayonnaise'],
      ['porc-filet', 'lardons'],
    ]) {
      const el = eligibleCatalog(cat, ings, { excludedIngredients: [x] });
      let vus = 0;
      for (let en = 0; en < el.M; en++) {
        const r = el.objOfEntry(en);
        if (!r) continue;
        vus++;
        expect(r.ingredients.some((i) => i.key === key)).toBe(false);
      }
      expect(vus).toBeGreaterThan(100);
    }
  }, 300000);
});
