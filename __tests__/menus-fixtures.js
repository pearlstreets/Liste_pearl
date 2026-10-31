// Jeu de données de test pour la logique des menus (pas un vrai catalogue).
const ing = (o) => o;
export const INGREDIENTS = {
  poulet: ing({
    emoji: 'p',
    aisle: 'viandes-poissons',
    pricePerKgOrL: 9,
    pack: { qty: 500, unit: 'g' },
    pantry: false,
  }),
  boeuf: ing({
    emoji: 'b',
    aisle: 'viandes-poissons',
    pricePerKgOrL: 14,
    pack: { qty: 400, unit: 'g' },
    pantry: false,
  }),
  porc: ing({
    emoji: 'c',
    aisle: 'viandes-poissons',
    pricePerKgOrL: 8,
    pack: { qty: 500, unit: 'g' },
    pantry: false,
  }),
  saumon: ing({
    emoji: 's',
    aisle: 'viandes-poissons',
    pricePerKgOrL: 22,
    pack: { qty: 300, unit: 'g' },
    pantry: false,
    allergens: ['poisson'],
  }),
  riz: ing({
    emoji: 'r',
    aisle: 'epicerie',
    pricePerKgOrL: 2.5,
    pack: { qty: 1000, unit: 'g' },
    pantry: false,
  }),
  pates: ing({
    emoji: 'p',
    aisle: 'epicerie',
    pricePerKgOrL: 2,
    pack: { qty: 500, unit: 'g' },
    pantry: false,
    allergens: ['gluten'],
  }),
  lentilles: ing({
    emoji: 'l',
    aisle: 'epicerie',
    pricePerKgOrL: 3,
    pack: { qty: 500, unit: 'g' },
    pantry: false,
  }),
  tomate: ing({
    emoji: 't',
    aisle: 'fruits-legumes',
    pricePerKgOrL: 3,
    pack: { qty: 500, unit: 'g' },
    pantry: false,
  }),
  courgette: ing({
    emoji: 'c',
    aisle: 'fruits-legumes',
    pricePerKgOrL: 2.5,
    pack: { qty: 500, unit: 'g' },
    pantry: false,
  }),
  oignon: ing({
    emoji: 'o',
    aisle: 'fruits-legumes',
    pricePerKgOrL: 1.5,
    pack: { qty: 1000, unit: 'g' },
    pantry: false,
  }),
  oeuf: ing({
    emoji: 'e',
    aisle: 'cremerie',
    pricePerUnit: 0.35,
    pack: { qty: 6, unit: 'u' },
    pantry: false,
    allergens: ['oeuf'],
  }),
  fromage: ing({
    emoji: 'f',
    aisle: 'cremerie',
    pricePerKgOrL: 12,
    pack: { qty: 200, unit: 'g' },
    pantry: false,
    allergens: ['lactose'],
  }),
  creme: ing({
    emoji: 'k',
    aisle: 'cremerie',
    pricePerKgOrL: 4,
    pack: { qty: 200, unit: 'ml' },
    pantry: false,
    allergens: ['lactose'],
  }),
  sel: ing({
    emoji: 'x',
    aisle: 'epicerie',
    pricePerKgOrL: 1,
    pack: { qty: 1000, unit: 'g' },
    pantry: true,
  }),
  huile: ing({
    emoji: 'h',
    aisle: 'epicerie',
    pricePerKgOrL: 6,
    pack: { qty: 1000, unit: 'ml' },
    pantry: true,
  }),
  noix: ing({
    emoji: 'n',
    aisle: 'epicerie',
    pricePerKgOrL: 15,
    pack: { qty: 200, unit: 'g' },
    pantry: false,
    allergens: ['fruits-a-coque'],
  }),
};

const r = (id, o) => ({
  id,
  image: false,
  course: 'plat',
  timeMin: 30,
  difficulty: 1,
  servings: 4,
  tags: [],
  kcal: 600,
  protein: 25,
  leftoverOk: false,
  ingredients: [],
  ...o,
});

export const RECIPES = [
  r('poulet-riz', {
    tags: ['sans-porc', 'enfants'],
    leftoverOk: true,
    ingredients: [
      { key: 'poulet', qty: 500, unit: 'g' },
      { key: 'riz', qty: 300, unit: 'g' },
      { key: 'oignon', qty: 100, unit: 'g' },
      { key: 'sel', qty: 1, unit: 'cc' },
    ],
  }),
  r('boeuf-pates', {
    tags: ['sans-porc'],
    leftoverOk: true,
    ingredients: [
      { key: 'boeuf', qty: 400, unit: 'g' },
      { key: 'pates', qty: 400, unit: 'g' },
      { key: 'tomate', qty: 400, unit: 'g' },
    ],
  }),
  r('porc-lentilles', {
    tags: [],
    leftoverOk: true,
    ingredients: [
      { key: 'porc', qty: 500, unit: 'g' },
      { key: 'lentilles', qty: 300, unit: 'g' },
      { key: 'oignon', qty: 100, unit: 'g' },
    ],
  }),
  r('saumon-riz', {
    tags: ['sans-porc', 'leger'],
    ingredients: [
      { key: 'saumon', qty: 400, unit: 'g' },
      { key: 'riz', qty: 300, unit: 'g' },
      { key: 'courgette', qty: 300, unit: 'g' },
    ],
  }),
  r('lentilles-tomate', {
    tags: ['vegetarien', 'vegan', 'sans-porc', 'economique', 'sans-lactose'],
    timeMin: 25,
    leftoverOk: true,
    ingredients: [
      { key: 'lentilles', qty: 300, unit: 'g' },
      { key: 'tomate', qty: 400, unit: 'g' },
      { key: 'oignon', qty: 150, unit: 'g' },
      { key: 'huile', qty: 2, unit: 'cs' },
    ],
  }),
  r('riz-courgette', {
    tags: ['vegetarien', 'vegan', 'sans-porc', 'economique', 'rapide', 'sans-lactose'],
    timeMin: 20,
    ingredients: [
      { key: 'riz', qty: 300, unit: 'g' },
      { key: 'courgette', qty: 500, unit: 'g' },
      { key: 'oignon', qty: 100, unit: 'g' },
    ],
  }),
  r('omelette-fromage', {
    tags: ['vegetarien', 'sans-porc', 'rapide'],
    timeMin: 15,
    ingredients: [
      { key: 'oeuf', qty: 8, unit: 'u' },
      { key: 'fromage', qty: 100, unit: 'g' },
      { key: 'courgette', qty: 200, unit: 'g' },
    ],
  }),
  r('gratin-pates', {
    tags: ['vegetarien', 'sans-porc', 'four', 'enfants'],
    timeMin: 45,
    leftoverOk: true,
    ingredients: [
      { key: 'pates', qty: 400, unit: 'g' },
      { key: 'fromage', qty: 150, unit: 'g' },
      { key: 'creme', qty: 200, unit: 'ml' },
    ],
  }),
  r('poulet-courgette', {
    tags: ['sans-porc', 'sans-lactose', 'rapide'],
    timeMin: 25,
    ingredients: [
      { key: 'poulet', qty: 500, unit: 'g' },
      { key: 'courgette', qty: 400, unit: 'g' },
      { key: 'oignon', qty: 100, unit: 'g' },
    ],
  }),
  r('salade-noix', {
    tags: ['vegetarien', 'sans-porc', 'leger', 'ete'],
    timeMin: 10,
    ingredients: [
      { key: 'tomate', qty: 400, unit: 'g' },
      { key: 'noix', qty: 60, unit: 'g' },
      { key: 'fromage', qty: 100, unit: 'g' },
    ],
  }),
  r('soupe-hiver', {
    tags: ['vegetarien', 'vegan', 'sans-porc', 'hiver', 'sans-lactose'],
    timeMin: 35,
    ingredients: [
      { key: 'courgette', qty: 500, unit: 'g' },
      { key: 'oignon', qty: 200, unit: 'g' },
    ],
  }),
  r('tarte-dessert', {
    course: 'dessert',
    tags: ['vegetarien'],
    ingredients: [
      { key: 'oeuf', qty: 3, unit: 'u' },
      { key: 'creme', qty: 200, unit: 'ml' },
    ],
  }),
];
