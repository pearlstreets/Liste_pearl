// Photos des recettes et des ingrédients : adresses, repli, sans doublon, visionneuse, aucun émoji affiché.
const fs = require('fs');
const path = require('path');
const {
  PHOTO_BASE,
  INGREDIENT_PHOTO_BASE,
  INGREDIENT_IMAGES,
  recipePhotoUri,
  ingredientPhotoSource,
  uniqueUris,
  pickPhotoSource,
  photoKey,
  uniquePhotos,
  distinctPhotoRecipes,
  shouldDismissSwipe,
  containRect,
} = require('../lib/menus/photoUrls');

const BASE = 'https://cdn.exemple.test/menus/';

describe('adresses distantes', () => {
  test('rien tant que les bases sont vides', () => {
    expect(PHOTO_BASE).toBe('');
    expect(INGREDIENT_PHOTO_BASE).toBe('');
    expect(Object.keys(INGREDIENT_IMAGES)).toHaveLength(0);
    expect(recipePhotoUri({ id: 'ratatouille' })).toBeNull();
    expect(ingredientPhotoSource('tomate')).toBeNull();
  });

  test('photo de recette du catalogue, jamais pour une recette personnelle', () => {
    expect(recipePhotoUri({ id: 'ratatouille' }, BASE)).toBe(
      'https://cdn.exemple.test/menus/ratatouille.webp'
    );
    expect(recipePhotoUri({ id: 'a b/c' }, BASE)).toBe(
      'https://cdn.exemple.test/menus/a%20b%2Fc.webp'
    );
    expect(recipePhotoUri({ id: 'x', custom: true }, BASE)).toBeNull();
    expect(recipePhotoUri(null, BASE)).toBeNull();
    expect(recipePhotoUri({ id: '' }, BASE)).toBeNull();
    expect(recipePhotoUri({ id: 'x'.repeat(200) }, BASE)).toBeNull();
  });

  test('seulement en https', () => {
    expect(recipePhotoUri({ id: 'x' }, 'http://cdn.exemple.test')).toBeNull();
    expect(recipePhotoUri({ id: 'x' }, 'javascript:alert(1)')).toBeNull();
    expect(recipePhotoUri({ id: 'x' }, null)).toBeNull();
  });

  test('vignette d ingrédient : celle du paquet, puis la distante, sinon rien', () => {
    expect(ingredientPhotoSource('tomate', { tomate: 12 }, BASE)).toBe(12);
    expect(ingredientPhotoSource('oignon', { tomate: 12 }, BASE)).toEqual({
      uri: 'https://cdn.exemple.test/menus/oignon.webp',
    });
    expect(ingredientPhotoSource('oignon', { tomate: 12 }, '')).toBeNull();
    expect(ingredientPhotoSource('', {}, BASE)).toBeNull();
    expect(ingredientPhotoSource(undefined, {}, BASE)).toBeNull();
    expect(ingredientPhotoSource('toString', {}, '')).toBeNull();
  });
});

describe('repli et doublons', () => {
  test('adresses sans vide ni doublon', () => {
    expect(uniqueUris(['a', null, '', 'b', 'a', 3, 'b'])).toEqual(['a', 'b']);
    expect(uniqueUris(null)).toEqual([]);
  });

  test('photo du paquet d abord, puis chaque adresse jusqu au repli', () => {
    expect(pickPhotoSource(7, ['https://x/a.webp'], 0)).toBe(7);
    expect(pickPhotoSource(null, ['https://x/a.webp', 'https://x/b.webp'], 0)).toEqual({
      uri: 'https://x/a.webp',
      cache: 'force-cache',
    });
    expect(pickPhotoSource(null, ['https://x/a.webp', 'https://x/b.webp'], 1).uri).toBe(
      'https://x/b.webp'
    );
    expect(pickPhotoSource(null, ['https://x/a.webp'], 1)).toBeNull();
    expect(pickPhotoSource(null, [], 0)).toBeNull();
  });

  test('clé de photo', () => {
    expect(photoKey(5)).toBe('5');
    expect(photoKey({ uri: 'https://x/a' })).toBe('https://x/a');
    expect(photoKey(null)).toBeNull();
    expect(photoKey({})).toBeNull();
  });

  test('jamais deux fois la même photo dans une rangée', () => {
    expect(uniquePhotos([1, { uri: 'u' }, 1, { uri: 'u' }, null, 2], 5)).toEqual([
      1,
      { uri: 'u' },
      2,
    ]);
    expect(uniquePhotos([1, 2, 3], 2)).toEqual([1, 2]);
  });

  test('vignettes d une semaine : recettes avec photo, sans doublon, au plus 5', () => {
    const images = { a: 1, b: 2, c: 1 };
    const rs = [
      { id: 'a' },
      { id: 'a' },
      { id: 'sans-photo' },
      { id: 'c' }, // même fichier que a
      null,
      { id: 'b' },
      { id: 'perso', custom: true, photoUrl: 'https://x/p.jpg' },
      { id: 'perso2', custom: true },
    ];
    expect(distinctPhotoRecipes(rs, images, 5, '').map((r) => r.id)).toEqual(['a', 'b', 'perso']);
    expect(distinctPhotoRecipes(rs, images, 1, '').map((r) => r.id)).toEqual(['a']);
    expect(distinctPhotoRecipes(null, images)).toEqual([]);
  });

  test('aucune photo de recette du paquet en double (même fichier pour deux recettes)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../lib/menus/recipeImages.js'), 'utf8');
    const files = [...src.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThan(300);
    expect(new Set(files).size).toBe(files.length);
    const dir = path.join(__dirname, '../assets/menus');
    const tailles = new Map();
    for (const f of files) {
      const buf = fs.readFileSync(path.join(dir, path.basename(f)));
      const cle = `${buf.length}:${buf.subarray(0, 64).toString('hex')}:${buf.subarray(-64).toString('hex')}`;
      expect(tailles.get(cle)).toBeUndefined();
      tailles.set(cle, f);
    }
  });
});

describe('visionneuse', () => {
  test('glissement vers le bas : long ou rapide ferme', () => {
    expect(shouldDismissSwipe(130, 0)).toBe(true);
    expect(shouldDismissSwipe(60, 1.2)).toBe(true);
    expect(shouldDismissSwipe(60, 0.3)).toBe(false);
    expect(shouldDismissSwipe(20, 3)).toBe(false);
    expect(shouldDismissSwipe(-200, 0)).toBe(false);
    expect(shouldDismissSwipe(undefined, undefined)).toBe(false);
  });

  test('cadre de la photo entière (contain)', () => {
    expect(containRect(800, 600, 400, 800)).toEqual({ x: 0, y: 250, width: 400, height: 300 });
    expect(containRect(600, 1200, 400, 400)).toEqual({ x: 100, y: 0, width: 200, height: 400 });
    // taille inconnue : 4:3 sur toute la largeur
    expect(containRect(0, 0, 400, 800)).toEqual({ x: 0, y: 250, width: 400, height: 300 });
    expect(containRect(800, 600, 0, 0)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('aucun émoji affiché dans Menus', () => {
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}]/u;
  const dir = path.join(__dirname, '../components/menus');
  test.each(fs.readdirSync(dir).filter((f) => f.endsWith('.js')))('%s', (f) => {
    const lignes = fs
      .readFileSync(path.join(dir, f), 'utf8')
      .split('\n')
      .filter((l) => EMOJI.test(l));
    expect(lignes).toEqual([]);
  });

  test('libellés de la visionneuse dans les 13 langues', () => {
    const loc = path.join(__dirname, '../locales');
    const langs = fs.readdirSync(loc).filter((f) => f.endsWith('.json'));
    expect(langs).toHaveLength(13);
    for (const f of langs) {
      const r = JSON.parse(fs.readFileSync(path.join(loc, f), 'utf8')).menus.recipe;
      expect(typeof r.photoZoom).toBe('string');
      expect(r.photoZoom.length).toBeGreaterThan(0);
      expect(typeof r.photoClose).toBe('string');
      expect(r.photoClose.length).toBeGreaterThan(0);
    }
  });
});
