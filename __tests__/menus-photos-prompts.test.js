// Prompts des photos IA (scripts/menus-photos) : un prompt unique par recette sans photo et par ingrédient,
// sans demande de texte, de logo ni de main, et fidèle à la recette (titre et ingrédients principaux).
const donnees = require('../scripts/menus-photos/donnees');
const P = require('../scripts/menus-photos/prompts');

jest.setTimeout(120000);

const INTERDITS_HORS_CONSIGNE =
  /\b(text|letters?|logos?|labels?|hands?|fingers?|forks?|knife|knives|spoons?|chopsticks|people|person|brands?|watermark|undefined|null|NaN)\b/i;

let ctx;
let recettes;
let ingredients;
let prompts;
let parId;

beforeAll(() => {
  ctx = P.contexte(donnees);
  recettes = donnees.recettesSansPhoto();
  ingredients = donnees.ingredientsTous();
  prompts = P.construirePrompts(recettes.concat(ingredients), ctx);
  parId = new Map(prompts.map((p) => [p.id, p]));
});

test('liste de travail : 130 recettes écrites à la main sans photo, tout le catalogue généré, 317 ingrédients', () => {
  expect(recettes.filter((r) => r.source === 'main')).toHaveLength(130);
  expect(recettes.filter((r) => r.source === 'gen').length).toBe(donnees.charger().core.alive);
  expect(ingredients).toHaveLength(317);
  expect(prompts).toHaveLength(recettes.length + ingredients.length);
});

test('un prompt par identifiant, tous différents, identifiant inclus', () => {
  expect(parId.size).toBe(prompts.length);
  expect(new Set(prompts.map((p) => p.prompt)).size).toBe(prompts.length);
  // même sans la référence finale, deux prompts ne se ressemblent jamais à l'identique
  expect(new Set(prompts.map((p) => p.prompt.replace(/Reference .*$/, ''))).size).toBe(
    prompts.length
  );
  for (const p of prompts) expect(p.prompt).toContain(` ${p.id} (internal identifier`);
});

test('style commun et consignes partout, aucun texte interdit hors de la consigne', () => {
  for (const p of prompts) {
    expect(p.prompt).toContain(P.INTERDITS);
    expect(p.prompt).toContain('not a top-down shot');
    expect(p.prompt).toContain('shallow depth of field');
    expect(p.prompt).toMatch(/beige|warm-grey plaster/);
    const reste = p.prompt.replace(P.INTERDITS, '').replace(/Reference .*$/, '');
    expect(reste).not.toMatch(INTERDITS_HORS_CONSIGNE);
    expect(p.prompt.length).toBeLessThan(2000);
  }
});

test('20 recettes réelles : titre anglais et ingrédients principaux présents', () => {
  const choix = [];
  const main = recettes.filter((r) => r.source === 'main');
  const gen = recettes.filter((r) => r.source === 'gen');
  for (let i = 0; i < 5; i++) choix.push(main[Math.floor((i * main.length) / 5)]);
  for (let i = 0; i < 15; i++) choix.push(gen[Math.floor((i * gen.length) / 15)]);
  expect(choix).toHaveLength(20);
  for (const r of choix) {
    const p = parId.get(r.id).prompt;
    expect(r.titre).toBeTruthy();
    expect(p).toContain(`"${r.titre}"`);
    const bas = p.toLowerCase();
    if (r.source === 'gen') {
      for (const k of r.recette.dp.mains) {
        const nom = P.nomDansPlat(ctx.nomEn(k)).toLowerCase();
        expect({ id: r.id, k, present: bas.includes(nom) }).toEqual({ id: r.id, k, present: true });
      }
    } else {
      // l'ingrédient le plus lourd qui se voit dans l'assiette
      const roles = P.rolesIngredients(r.recette, ctx.ingredients, ctx.nomEn, false);
      expect(roles.visibles.length).toBeGreaterThan(0);
      expect(bas).toContain(roles.visibles[0].nom.toLowerCase());
    }
  }
});

test('mise en scène selon le plat : soupe, wok, gratin, salade, bowl, boisson, dessert', () => {
  const premier = (re) => recettes.find((r) => re.test(r.titre));
  const attendu = [
    [/^Cream of .* soup/, /soup bowl/],
    [/^Stir-fried noodles/, /stir-fry/],
    [/ gratin with /, /gratin dish/],
    [/^Rice salad/, /salad/],
    [/^Quinoa bowl/, /deep off-white ceramic bowl/],
    [/smoothie/, /tall clear drinking glass/],
    [/crumble/i, /crumble topping/],
  ];
  for (const [titre, scene] of attendu) {
    const r = premier(titre);
    expect(r).toBeTruthy();
    expect(parId.get(r.id).prompt).toMatch(scene);
  }
  // plat sucré : pas d'huile d'olive ni d'ail en accessoire
  const sucre = premier(/crumble/i);
  expect(parId.get(sucre.id).prompt).not.toMatch(/olive oil|garlic/);
});

test('variations : deux voisins d’une même famille ne partagent ni angle ni assiette ni lumière', () => {
  const a = P.variation('wok', 10);
  const b = P.variation('wok', 11);
  expect(a.angle).not.toBe(b.angle);
  expect(a.lumiere).not.toBe(b.lumiere);
  // 2017 filets : toutes les variations distinctes
  const vus = new Set();
  for (let k = 0; k < 2017; k++) vus.add(JSON.stringify(P.variation('filet', k)));
  expect(vus.size).toBe(2017);
  // une image à refaire change de variation
  expect(P.variation('wok', 3, 1)).not.toEqual(P.variation('wok', 3, 0));
});

test('ingrédients : seul, cru, nom anglais présent, aucun autre aliment en accessoire', () => {
  for (const ing of ingredients) {
    const p = parId.get(ing.id).prompt;
    expect(p).toContain(`single raw ingredient: ${ing.nom.toLowerCase()}`);
    expect(p).not.toMatch(
      /olive oil|garlic|thyme|lemon|parsley|rosemary/i.test(ing.nom)
        ? /$^/
        : /olive oil|garlic cloves|sprig/
    );
  }
});
