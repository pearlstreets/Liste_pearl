// Prompts anglais des photos IA : un par recette sans photo et un par ingrédient.
// Style calqué sur les 344 photos de assets/menus (640x640) : photo culinaire réaliste, assiette en grès
// clair moucheté, fond beige clair (pierre ou lin), lumière naturelle douce de fenêtre, vue de trois quarts,
// faible profondeur de champ, accessoires flous derrière (huile, sel, herbes, ail, ingrédient cru du plat).
'use strict';

const ASPECTS = require('./aspects');

/* ------------------------------------------------------------------ utilitaires */

/** FNV-1a 32 bits : décalage stable par famille. */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const uniq = (a) => [...new Set(a.filter(Boolean))];
const enumerer = (mots) =>
  mots.length <= 1 ? mots.join('') : `${mots.slice(0, -1).join(', ')} and ${mots[mots.length - 1]}`;

/* ------------------------------------------------------------------ ingrédients */

// Jamais visibles dans un plat fini (assaisonnements, liants, liquides de cuisson).
const INVISIBLES = new Set([
  'farine',
  'sucre',
  'sucre-roux',
  'sucre-vanille',
  'levure',
  'levure-boulangere',
  'maizena',
  'agar',
  'gelatine',
  'bouillon',
  'glacons',
  'vin-blanc',
  'vin-rouge',
  'biere',
  'cidre',
  'rhum',
  'eau-gazeuse',
  'concentre-tomate',
  'chapelure',
  'vanille',
  'eau-fleur-oranger',
  'ail',
  'echalote',
]);
const DANS_LA_PATE = new Set(['beurre', 'beurre-demi-sel', 'oeuf', 'lait', 'amande-poudre']); // gâteaux, crêpes
const BASES =
  /^(riz|pates|nouilles|semoule|boulgour|quinoa|gnocchi|polenta|pomme-de-terre|patate-douce|pain-|baguette|tortilla|galette-riz|pate-(feuilletee|brisee|pizza|sablee)|feuille-brick|flocons-avoine|sarrasin)/;
const PROTEINES = new Set([
  'crevette',
  'tofu',
  'tofu-fume',
  'oeuf',
  'halloumi',
  'pois-chiches',
  'lentilles',
  'lentilles-corail',
  'haricots-rouges',
  'haricots-blancs',
  'flageolets',
  'feves',
  'pois-casses',
]);
const SAUCES = {
  creme: 'a creamy sauce',
  'creme-fraiche': 'a creamy sauce',
  'lait-coco': 'a coconut milk sauce',
  'tomate-concassee': 'a rich tomato sauce',
  'coulis-tomate': 'a rich tomato sauce',
  pesto: 'a basil pesto',
  'pesto-rosso': 'a red pesto',
  tahini: 'a tahini sauce',
  'beurre-cacahuete': 'a peanut sauce',
  'pate-curry-vert': 'a green curry sauce',
  'pate-curry-rouge': 'a red curry sauce',
  'pate-curry-jaune': 'a yellow curry sauce',
  'pate-curry-massaman': 'a massaman curry sauce',
  'pate-curry-korma': 'a mild creamy korma sauce',
  'pate-tikka-masala': 'an orange tikka masala sauce',
  'sauce-huitre': 'a glossy oyster sauce',
  'sauce-soja': 'a glossy soy glaze',
  'sauce-barbecue': 'a barbecue glaze',
  caramel: 'a caramel drizzle',
  'sirop-erable': 'a maple syrup drizzle',
  miel: 'a honey drizzle',
  'pate-a-tartiner': 'a chocolate hazelnut spread',
};
const GRAMMES_UNITE = { 'fruits-legumes': 120, 'viandes-poissons': 150, cremerie: 60 };

/** Nom d'ingrédient pour un plat : sans « canned », « frozen »… (on voit l'aliment, pas le conditionnement). */
function nomDansPlat(nomEn) {
  return nomEn
    .replace(
      /\b(canned|frozen|cooked|pitted|shelled|peeled|fresh|raw|drained|instant|thick|plain|firm|single)\s+/gi,
      ''
    )
    .replace(/\s+(for braising|stew|bits|\(slice\)|pieces)$/i, '')
    .trim()
    .toLowerCase()
    .replace(/\bchinese\b/, 'Chinese')
    .replace(/\bcomté\b/, 'Comté')
    .replace(/\bgruyère\b/, 'Gruyère')
    .replace(/\bparmesan\b/, 'Parmesan')
    .replace(/\bemmental\b/, 'Emmental')
    .replace(/\bcheddar\b/, 'Cheddar')
    .replace(/\breblochon\b/, 'Reblochon')
    .replace(/\broquefort\b/, 'Roquefort')
    .replace(/\bbrie\b/, 'Brie');
}

function grammes(ligne, info) {
  const q = Number(ligne.qty) || 0;
  switch (ligne.unit) {
    case 'g':
    case 'ml':
      return q;
    case 'cs':
      return q * 15;
    case 'cc':
      return q * 5;
    default:
      return q * ((info && GRAMMES_UNITE[info.aisle]) || 50);
  }
}

// Mots qui ne désignent pas l'aliment lui-même : on ne les cherche pas dans le titre.
const MOTS_VAGUES = new Set(
  'cheese sheet sheets fresh leaves leaf powder paste fillet fillets loin meat sauce whole ground minced baby sweet red green yellow white black smoked cherry sun dried flaked grated button bell spring cured cooked sliced large small mixed rump'.split(
    ' '
  )
);
const racine = (m) =>
  m
    .toLowerCase()
    .replace(/ies$/, 'y')
    .replace(/(ch|sh|ss|x|o)es$/, '$1')
    .replace(/s$/, '');

/** Position (en mots) du nom d'ingrédient dans le titre, d'après ses mots propres au singulier, ou -1. */
function positionDansTitre(nom, titre) {
  if (!titre) return -1;
  const motsTitre = titre
    .toLowerCase()
    .split(/[^a-zà-ÿ]+/)
    .filter(Boolean)
    .map(racine);
  const mots = nom
    .toLowerCase()
    .split(/[^a-zà-ÿ]+/)
    .filter(Boolean);
  let cherche = mots.filter((m) => m.length >= 3 && !MOTS_VAGUES.has(m));
  if (!cherche.length) cherche = mots.slice(-1);
  let pos = -1;
  for (const m of cherche) {
    const i = motsTitre.indexOf(racine(m));
    if (i >= 0 && (pos < 0 || i < pos)) pos = i;
  }
  return pos;
}

// Nommés dans le titre mais jamais « élément principal » : herbes, agrumes, aromates.
const ACCENTS = /^(citron|citron-vert|ail|gingembre|piment|echalote|oignon-nouveau)/;
// Plats où un œuf absent du titre se voit encore (salade, bowl, sandwich, soupe, wok, omelette) ;
// ailleurs (quiche, cake, pâte, liaison, dorure, panure) il est fondu dans le plat : pas montré.
const OEUF_VISIBLE = new Set(['salade', 'bowl', 'sandwich', 'soupe', 'wok', 'omelette']);

/**
 * Ingrédients visibles d'une recette, du plus important au moins important, rangés par rôle.
 * dp.mains (cœur du catalogue généré) passent devant. Avec le titre (et le type de plat) : les
 * ingrédients nommés dans le titre passent tout devant, dans l'ordre du titre (roles.principaux) ;
 * un œuf absent du titre n'est jamais l'élément principal.
 */
function rolesIngredients(recette, ingredients, nomEn, sucre, titre, typeT) {
  const mains = (recette.dp && recette.dp.mains) || [];
  const lignes = (recette.ingredients || []).filter((l) => l && l.key && !l.optional);
  const vus = lignes
    .map((l, i) => {
      const info = ingredients[l.key] || {};
      const pos = positionDansTitre(nomDansPlat(nomEn(l.key)), titre);
      const poids =
        grammes(l, info) +
        (mains.includes(l.key) ? 1e6 * (2 - mains.indexOf(l.key)) : 0) +
        (pos >= 0 ? 1e8 * (60 - pos) : 0);
      return { key: l.key, info, poids, ordre: i, dansTitre: pos >= 0 };
    })
    .sort((a, b) => b.poids - a.poids || a.ordre - b.ordre);
  const roles = { principaux: [], proteine: [], base: [], legumes: [], sauce: [], visibles: [] };
  for (const v of vus) {
    const k = v.key;
    if (SAUCES[k]) {
      roles.sauce.push(SAUCES[k]);
      continue;
    }
    if (INVISIBLES.has(k) || k === 'farine') continue;
    if (sucre && DANS_LA_PATE.has(k) && !v.dansTitre) continue;
    if (v.info.pantry && !mains.includes(k)) continue;
    if (
      ['lait', 'beurre', 'beurre-demi-sel', 'huile-olive'].includes(k) &&
      !mains.includes(k) &&
      !v.dansTitre
    )
      continue;
    // œuf de liaison, de pâte ou de dorure, absent du titre : fondu dans le plat
    if (titre && k === 'oeuf' && !v.dansTitre && !OEUF_VISIBLE.has(typeT)) continue;
    const nom = nomDansPlat(nomEn(k));
    roles.visibles.push({ key: k, nom });
    if (v.dansTitre && !ACCENTS.test(k) && !HERBES.has(k) && roles.principaux.length < 3) {
      roles.principaux.push(nom);
      continue;
    }
    if (titre && k === 'oeuf') roles.legumes.push(nom);
    else if (v.info.aisle === 'viandes-poissons' || PROTEINES.has(k)) roles.proteine.push(nom);
    else if (BASES.test(k)) roles.base.push(nom);
    else roles.legumes.push(nom);
  }
  roles.sauce = uniq(roles.sauce);
  return roles;
}

/* ------------------------------------------------------------------ type de plat et cuisine */

// Ordre = priorité. Chaque type : motif sur le titre anglais (et sub / famille), mise en scène.
const TYPES = [
  {
    t: 'boisson',
    re: /\b(smoothie|milkshake|lassi|juice|lemonade|iced tea|iced coffee|hot chocolate|drink)\b/,
    sub: ['boissons'],
    scene:
      'served in a tall clear drinking glass filled to just below the rim, thick and smooth texture, a few pieces of the fresh fruit beside the glass',
    contenant: 'glass',
  },
  {
    t: 'soupe-veloute',
    re: /\b(cream of|velout|bisque)\b/,
    scene:
      'served in a wide off-white stoneware soup bowl, smooth velvety soup with a light swirl of cream and a small garnish on top',
    contenant: 'bowl',
  },
  {
    t: 'soupe',
    re: /\b(soup|broth|minestrone|harira|ramen|pho|gazpacho|chowder|dal|dhal)\b/,
    sub: ['soupes'],
    scene:
      'served in a wide off-white stoneware soup bowl, hearty soup with visible pieces of the ingredients',
    contenant: 'bowl',
  },
  {
    t: 'bowl',
    re: /\bbowls?\b|\bbibimbap\b|\bpoke\b|\bburrito bowl\b/,
    sub: ['bowls'],
    scene:
      'served as a generous bowl in a deep off-white ceramic bowl: the base at the bottom and the toppings arranged in neat colorful sections, the sauce drizzled over',
    contenant: 'bowl',
  },
  {
    t: 'salade-fruits',
    re: /\b(fruit salad)\b|^[a-z ,]+ salad with mint$/i,
    sub: [],
    scene:
      'a fresh fruit salad in a shallow off-white ceramic bowl, juicy cut fruit glistening, a few mint leaves',
    contenant: 'bowl',
  },
  {
    t: 'salade',
    re: /\b(salad|tabbouleh|coleslaw|fattoush|slaw)\b/,
    sub: ['salades'],
    scene:
      'a fresh and colorful salad served in a wide shallow off-white ceramic bowl, ingredients clearly distinct and lightly dressed',
    contenant: 'bowl',
  },
  {
    t: 'gratin',
    re: /\b(gratin|lasagna|lasagne|moussaka|parmigiana|tartiflette|hachis|shepherd|cottage pie|gratin\w*|baked (pasta|gnocchi|macaroni|ziti|penne|rigatoni))\b/,
    sub: ['gratins'],
    scene:
      'baked in an oval off-white ceramic gratin dish, golden bubbling crust, one portion just served on a plate next to it showing the layers inside',
    contenant: 'gratin dish',
  },
  {
    // flan aux fruits sans pâte : pas la mise en scène d'une tarte
    t: 'clafoutis',
    re: /\b(clafoutis|far breton)\b/,
    course: ['dessert'],
    scene:
      'baked in a round off-white ceramic baking dish, one generous portion served on a small dessert plate next to it',
    contenant: 'plate',
  },
  {
    t: 'tarte-sucree',
    re: /\b(tart|tarte|pie|galette des rois)\b/,
    course: ['dessert'],
    scene:
      'a slice of the tart on a small off-white dessert plate, the rest of the whole tart in its ceramic tart dish softly blurred behind, golden crisp pastry',
    contenant: 'plate',
  },
  {
    t: 'quiche',
    re: /\b(quiche|tart|tarte|pie|pissaladi[eè]re|flamiche)\b/,
    sub: ['tartes_salees'],
    scene:
      'a generous slice of the savory tart on a plate, the rest of the whole tart in its ceramic tart dish softly blurred behind, golden flaky crust and a moist filling',
    contenant: 'plate',
  },
  {
    t: 'cake-sale',
    re: /\bsavou?ry (cake|loaf|muffins?)\b/,
    scene:
      'a few thick slices of savory loaf cake on a plate showing the filling inside, the rest of the loaf behind',
    contenant: 'plate',
  },
  {
    t: 'pizza',
    re: /\b(pizza|calzone|flatbread|pide|lahmacun)\b/,
    sub: ['pizzas'],
    scene:
      'a whole homemade pizza on a large light ceramic plate, blistered golden crust, one slice slightly pulled apart, toppings clearly visible',
    contenant: 'plate',
  },
  {
    t: 'wok',
    re: /\b(stir-fr\w*|stir fr\w*|wok|fried rice|fried noodles|chow mein|pad thai|yakisoba|lo mein)\b/,
    scene:
      'a wok-tossed stir-fry served in a shallow wide off-white ceramic bowl, glossy sauce coating everything, vibrant crisp-tender vegetables, slight char',
    contenant: 'bowl',
  },
  {
    t: 'curry',
    re: /\b(curry|korma|tikka|masala|massaman|vindaloo|rogan|dal makhani|madras|jalfrezi)\b/,
    fam: ['curry'],
    scene:
      'a fragrant curry served in a shallow off-white ceramic bowl, the sauce rich and glossy, pieces clearly visible',
    contenant: 'bowl',
  },
  {
    t: 'risotto',
    re: /\b(risotto|orzotto|paella|biryani|pilaf|pilau|jambalaya)\b/,
    fam: ['risotto'],
    scene:
      'served on a shallow off-white ceramic plate, creamy and glossy grains, generous portion',
    contenant: 'plate',
  },
  {
    t: 'pates',
    re: /\b(spaghetti|penne|fusilli|rigatoni|tagliatelle|linguine|farfalle|conchiglie|macaroni|pasta|noodles?|gnocchi|ravioli|orecchiette|pappardelle|vermicelli)\b/,
    sub: ['pates_riz'],
    scene:
      'a generous portion served on a shallow off-white ceramic plate, the sauce coating the pasta or noodles, garnish on top',
    contenant: 'plate',
  },
  {
    t: 'papillote',
    re: /\ben papillote\b/,
    scene:
      'an opened parchment paper parcel on a plate revealing the steamed fish and vegetables inside, juices glistening',
    contenant: 'plate',
  },
  {
    t: 'brochettes',
    re: /\b(skewers?|kebabs?|brochettes?|yakitori|satay|souvlaki)\b/,
    scene:
      'a few grilled skewers laid on a plate, nicely charred edges, vegetables threaded between the pieces',
    contenant: 'plate',
  },
  {
    t: 'petit-dejeuner',
    re: /\b(pancakes?|cr[eê]pes?|porridge|overnight oats|granola|waffles?|french toast|pain perdu|chia pudding)\b/,
    sub: ['petit_dejeuner'],
    scene: 'a cozy breakfast served on a light ceramic plate or bowl, toppings scattered on top',
    contenant: 'plate',
  },
  {
    t: 'omelette',
    re: /\b(omelet\w*|frittata|tortilla espa\w*|scrambled eggs|shakshuka|chakchouka|eggs? (benedict|cocotte|en cocotte)|fried eggs?|egg muffins?)\b/,
    sub: ['oeufs'],
    scene: 'served on a light ceramic plate, soft golden eggs, fillings visible, freshly cooked',
    contenant: 'plate',
  },
  {
    t: 'sandwich',
    re: /\b(sandwich\w*|wraps?|burgers?|bruschett\w*|tartines?|toasts?|croque|pitas?|tacos?|burritos?|quesadillas?|fajitas?|bagels?|panini|club)\b/,
    sub: ['sandwichs'],
    scene:
      'served on a light ceramic plate, cut to show the generous filling inside, crisp bread or wrap',
    contenant: 'plate',
  },
  {
    t: 'crumble',
    re: /\b(crumble|cobbler)\b/,
    scene:
      'baked in an off-white ceramic baking dish, golden crunchy crumble topping with bubbling fruit at the edges, one portion served in a small bowl',
    contenant: 'baking dish',
  },
  {
    t: 'gateau',
    re: /\b(cake|muffins?|brownies?|cookies?|loaf|madeleines?|financiers?|cheesecake|fondant|moelleux|banana bread|scones?|biscuits?)\b/,
    sub: ['gateaux'],
    scene:
      'a few slices or pieces arranged on a small off-white ceramic plate, soft crumb visible, the rest of the cake behind',
    contenant: 'plate',
  },
  {
    t: 'dessert-verrine',
    re: /\b(mousse|panna cotta|tiramisu|compote|pudding|cream|custard|flan|verrine|rice pudding|yogurt|parfait|sorbet|ice cream)\b/,
    course: ['dessert'],
    scene:
      'served in a small clear glass or small off-white ceramic bowl, smooth texture, a delicate topping',
    contenant: 'bowl',
  },
  {
    t: 'dessert',
    re: /./,
    course: ['dessert'],
    scene: 'served on a small off-white ceramic dessert plate, elegant homemade presentation',
    contenant: 'plate',
  },
  {
    t: 'aperitif',
    re: /\b(dip|hummus|houmous|tapenade|rillettes|spread|falafels?|arancini|nems|spring rolls?|samosas?|bhajis?|fritters?|croquettes?|mezze|nuggets|puffs?|crackers|chips)\b/,
    sub: ['aperitif', 'sauces'],
    scene:
      'arranged on a light ceramic plate as a sharing appetizer, a small bowl of dip alongside',
    contenant: 'plate',
  },
  {
    t: 'accompagnement',
    // en tête de titre seulement : « …, served with sautéed potatoes » reste un plat
    re: /^(?!.*\b(fillets?|loin|steaks?|chops?|breasts?|thighs?|escalopes?|sardines|cod|salmon|chicken|pork|beef|lamb|duck|turkey|veal|shrimp|tuna)\b)(oven-)?(saut[ée]ed|roasted|mashed|pur[ée]e|steamed|glazed|braised|grilled) [a-z ,]*(vegetables|carrots|potatoes|zucchini|beans|peppers|broccoli|squash|leeks|mushrooms|cauliflower|spinach|onions|asparagus|sprouts|eggplants?|fennel|tomatoes)/,
    sub: ['accompagnements'],
    scene:
      'a side dish served in a shallow off-white ceramic bowl, vegetables nicely caramelized and glossy',
    contenant: 'bowl',
  },
  {
    t: 'mijote',
    re: /\b(stew|tagine|tajine|bourguignon|blanquette|navarin|goulash|chili|daube|casserole|ragout|ragù|cassoulet|pot-au-feu|osso buco|confit|mijot\w*)\b/,
    scene:
      'a comforting slow-cooked dish served on a deep off-white ceramic plate, tender pieces in a rich sauce',
    contenant: 'plate',
  },
  {
    t: 'filet',
    re: /\b(fillets?|loin|steaks?|chops?|breasts?|thighs?|escalopes?|cutlets?|magret|roast|roasted|grilled|pan-fried|seared|baked)\b/,
    sub: ['viandes', 'poissons'],
    scene:
      'plated on a light ceramic plate: the main piece nicely seared and golden, the side arranged next to it, sauce spooned around',
    contenant: 'plate',
  },
  {
    t: 'plat',
    re: /./,
    scene: 'a generous home-cooked portion plated on a light ceramic plate',
    contenant: 'plate',
  },
];

function typeDePlat(titreEn, recette) {
  const t = (titreEn || '').toLowerCase();
  const sub = recette.sub || '';
  const fam = recette.family || '';
  const course = recette.course || '';
  // 1) le titre décide (le plus précis)
  for (const ty of TYPES) {
    if (ty.re.source === '.') continue;
    if (ty.course && !ty.course.includes(course)) continue;
    if (ty.re.test(t)) return ty;
  }
  // 2) puis la catégorie du générateur, puis la famille, puis le repas
  for (const ty of TYPES) if (ty.sub && ty.sub.includes(sub)) return ty;
  for (const ty of TYPES) if (ty.fam && ty.fam.includes(fam)) return ty;
  for (const ty of TYPES)
    if (ty.course && ty.course.includes(course) && ty.re.source === '.') return ty;
  return TYPES[TYPES.length - 1];
}

const CUISINES = [
  [
    'Thai',
    /\b(thai|green curry|red curry|yellow curry|massaman|pad thai|lemongrass|tom kha|tom yum)\b/,
    [
      'pate-curry-vert',
      'pate-curry-rouge',
      'pate-curry-jaune',
      'pate-curry-massaman',
      'citronnelle',
    ],
  ],
  [
    'Indian',
    /\b(korma|tikka|masala|tandoori|dal|dhal|biryani|aloo|bhajis?|naan|palak|vindaloo|lassi|chana)\b/,
    ['garam-masala', 'pate-curry-korma', 'pate-tikka-masala'],
  ],
  [
    'Japanese',
    /\b(teriyaki|miso|ramen|yakitori|katsu|japanese|donburi|yakisoba|udon|soba|onigiri)\b/,
    [],
  ],
  ['Korean', /\b(bibimbap|korean|kimchi|bulgogi|gochujang)\b/, []],
  [
    'Vietnamese',
    /\b(vietnamese|bo bun|pho|banh|spring rolls?|nems?)\b/,
    ['nuoc-mam', 'galette-riz'],
  ],
  [
    'Chinese-style',
    /\b(stir-fr\w*|oyster sauce|cantonese|chinese|sichuan|fried rice|chow mein|lo mein|sweet and sour|hoisin|pak choi)\b/,
    ['sauce-huitre'],
  ],
  [
    'Moroccan',
    /\b(tagine|tajine|couscous|harira|moroccan|kefta|merguez|ras el hanout|chakchouka|baghrir|pastilla)\b/,
    ['ras-el-hanout'],
  ],
  [
    'Middle Eastern',
    /\b(hummus|houmous|falafels?|tabbouleh|shawarma|za'?atar|tahini|baba|sayadieh|fattoush|lebanese|shakshuka|mezze|pitas?|baklava)\b/,
    ['zaatar'],
  ],
  ['Greek', /\b(greek|moussaka|souvlaki|tzatziki|spanakopita|gyros?)\b/, []],
  [
    'Mexican',
    /\b(tacos?|burritos?|fajitas?|chili con carne|quesadillas?|enchiladas?|guacamole|mexican|salsa|nachos)\b/,
    [],
  ],
  ['Spanish', /\b(paella|tortilla espa\w*|gazpacho|spanish|patatas|tapas|churros)\b/, []],
  [
    'Italian',
    /\b(spaghetti|penne|fusilli|rigatoni|tagliatelle|linguine|lasagn\w*|gnocchi|risotto|pizza|bruschett\w*|carbonara|arrabbiata|norma|frittata|saltimbocca|parmigiana|pesto|polenta|arancini|tiramisu|panna cotta|minestrone|osso buco|calzone|orecchiette|focaccia)\b/,
    [],
  ],
  [
    'French',
    /\b(gratin|quiche|blanquette|bourguignon|ratatouille|croque|tartiflette|papillote|cr[eê]pes?|galettes?|lyonnaise|proven[cç]al|ni[cç]oise|cream of|velout\w*|pot-au-feu|cassoulet|clafoutis|madeleines?|financiers?|tartines?|meuni[eè]re|daube|navarin|choucroute|confit)\b/,
    [],
  ],
  [
    'American',
    /\b(burgers?|pancakes?|muffins?|brownies?|cookies?|bbq|barbecue|coleslaw|cheesecake|mac and cheese|banana bread)\b/,
    [],
  ],
];

function cuisine(titreEn, recette) {
  const t = (titreEn || '').toLowerCase();
  const cles = new Set((recette.ingredients || []).map((l) => l.key));
  for (const [nom, re] of CUISINES) if (re.test(t)) return nom;
  for (const [nom, , keys] of CUISINES) if (keys.some((k) => cles.has(k))) return nom;
  return '';
}

/* ------------------------------------------------------------------ style commun et variations */

const ANGLES = [
  'three-quarter view from about 30 degrees above the table',
  'three-quarter view from about 35 degrees above the table',
  'three-quarter view from about 40 degrees above the table',
  'three-quarter view from about 45 degrees above the table, slightly from the left',
  'three-quarter view from about 35 degrees above the table, slightly from the right',
];
const FINITIONS = [
  'speckled off-white stoneware with a thin brown rim',
  'matte cream-colored ceramic',
  'pale beige glazed ceramic with an organic, slightly irregular edge',
  'off-white ceramic with a subtle reactive glaze',
];
const SURFACES = [
  'a light beige textured stone surface',
  'a light beige stone surface with a crumpled natural linen napkin',
  'a pale warm-grey plaster surface',
];
const CADRAGES = [
  'the dish centered and filling most of the square frame',
  'the dish slightly off-center to the left, filling most of the square frame',
  'the dish slightly off-center to the right, filling most of the square frame',
];
const LUMIERES = [
  'soft natural daylight from a window on the left',
  'soft natural daylight from a window on the right',
];
const ACCESSOIRES_SALE = [
  'a small glass bottle of olive oil',
  'a small wooden bowl of coarse sea salt',
  'a sprig of fresh thyme',
  'a few garlic cloves',
  'a wooden pepper mill',
  'a halved lemon',
  'a small ceramic dish of ground spices',
  'a few fresh parsley leaves',
  'a sprig of rosemary',
  'a small dish of black peppercorns',
];
const ACCESSOIRES_SUCRE = [
  'a small glass jar of honey',
  'a small ceramic bowl of sugar',
  'a few cinnamon sticks',
  'a few fresh berries',
  'a folded beige linen napkin',
  'a small glass jug of milk',
  'a vanilla pod',
  'a few mint leaves',
  'a small bowl of nuts',
  'a halved lemon',
];
const ACCESSOIRES_CUISINE = {
  Thai: ['a lime wedge', 'a small bunch of fresh coriander', 'a red chili'],
  Indian: [
    'a small ceramic bowl of whole spices',
    'a sprig of fresh coriander',
    'a few cardamom pods',
  ],
  Japanese: ['a small ceramic dish of soy sauce', 'a few spring onion slices'],
  Korean: ['a small ceramic dish of kimchi', 'toasted sesame seeds'],
  Vietnamese: ['a lime wedge', 'fresh mint and coriander leaves'],
  'Chinese-style': ['a small ceramic dish of soy sauce', 'a few spring onions', 'a red chili'],
  Moroccan: [
    'a small ceramic dish of ras el hanout',
    'a sprig of fresh coriander',
    'a lemon wedge',
  ],
  'Middle Eastern': ['a small dish of zaatar', 'fresh mint leaves', 'a lemon wedge'],
  Greek: ['a small bowl of olives', 'a sprig of oregano'],
  Mexican: ['a lime wedge', 'a small bunch of fresh coriander'],
  Spanish: ['a small dish of smoked paprika', 'a lemon wedge'],
  Italian: ['a sprig of fresh basil', 'a small wedge of Parmesan'],
};

// Ingrédient seul : aucun autre aliment derrière (il serait confondu avec le sujet).
const ACCESSOIRES_NEUTRES = [
  'a folded beige linen napkin',
  'a crumpled natural linen cloth',
  'a small empty off-white ceramic dish',
  'a small light wooden board',
  'a crumpled sheet of parchment paper',
  'a wooden pepper mill',
  'an empty small glass jar',
  'a stack of two small off-white plates',
];

const C10_3 = (() => {
  const out = [];
  for (let a = 0; a < 10; a++)
    for (let b = a + 1; b < 10; b++) for (let c = b + 1; c < 10; c++) out.push([a, b, c]);
  return out;
})();
// Angle (5), assiette (4), fond (3) et lumière (2) tournent avec le rang k : deux voisins d'une famille
// diffèrent sur ces quatre axes, et (k mod 60) se lit dans le triplet angle, assiette, fond (restes chinois).
// Les accessoires avancent de 61 (inversible modulo 120) tous les 60 rangs : 7200 variations distinctes
// par famille (la plus grande, les filets, en compte 2017).
const TOTAL = 60 * C10_3.length; // 7200

/** Variation n° k d'une famille (déterministe). essai > 0 change les accessoires d'une image refaite. */
function variation(famille, k, essai = 0) {
  const n = (fnv(famille) % TOTAL) + k;
  const acc = (Math.floor(n / 60) * 61 + essai * 37) % C10_3.length;
  return {
    angle: ANGLES[n % 5],
    finition: FINITIONS[n % 4],
    surface: SURFACES[n % 3],
    cadrage: CADRAGES[(n + Math.floor(n / 3)) % 3],
    lumiere: LUMIERES[n % 2],
    accessoires: C10_3[acc],
  };
}

const INTERDITS =
  'No text, no letters, no numbers, no labels, no logos, no brand names, no watermark, no packaging, no hands, no people, no cutlery in the foreground.';

function gabaritStyle(v, accessoires, contenant) {
  const pose =
    contenant === 'glass'
      ? `The clear glass stands on ${v.surface}, next to a small saucer of ${v.finition}. `
      : contenant
        ? `The ${contenant} is ${v.finition}, set on ${v.surface}. `
        : `Any dish or plate is ${v.finition}, set on ${v.surface}. `;
  return (
    `Style: photorealistic, appetizing home-style food photography, as in a modern recipe app. ` +
    pose +
    `${v.lumiere[0].toUpperCase()}${v.lumiere.slice(1)}, gentle soft shadows, warm neutral tones, natural colors, shallow depth of field. ` +
    `${v.angle[0].toUpperCase()}${v.angle.slice(1)}, not a top-down shot, ${v.cadrage}. ` +
    `In the softly blurred background: ${enumerer(accessoires)}. ` +
    INTERDITS
  );
}

/* ------------------------------------------------------------------ prompts */

const SUBS_SUCRES = new Set(['desserts', 'gateaux', 'boissons', 'petit_dejeuner']);
function estSucre(recette, titreEn, type) {
  if (/\b(egg|eggs|omelet\w*|frittata|bacon|ham|cheese|salmon)\b/i.test(titreEn || ''))
    return false;
  if (
    [
      'boisson',
      'tarte-sucree',
      'clafoutis',
      'crumble',
      'gateau',
      'dessert',
      'dessert-verrine',
      'salade-fruits',
    ].includes(type.t)
  )
    return true;
  return recette.course === 'dessert' || SUBS_SUCRES.has(recette.sub || '');
}

/**
 * Prompt d'une recette. item : { id, titre, recette } (voir donnees.js). ctx : { ingredients, nomEn }.
 * k : rang dans sa famille (variation), essai : n° de reprise.
 */
function promptRecette(item, ctx, k = 0, essai = 0) {
  const { recette } = item;
  const titre = (item.titre || item.id).trim();
  const type = typeDePlat(titre, recette);
  const sucre = estSucre(recette, titre, type);
  const roles = rolesIngredients(recette, ctx.ingredients, ctx.nomEn, sucre, titre, type.t);
  const cuis = cuisine(titre, recette);
  const famille = familleDe(item);
  const v = variation(famille, k, essai);
  const asp = ASPECTS.aspectDe(titre);
  const exclus = ASPECTS.exclusions(
    asp,
    (recette.ingredients || []).filter((l) => l && l.key && !l.optional).map((l) => l.key)
  );

  const morceaux = [];
  morceaux.push(
    `Realistic food photograph of a single dish: "${titre}"${cuis ? `, ${cuis} home cooking` : ''}, ${type.scene}.`
  );
  if (asp) morceaux.push(`The finished dish looks like this: ${asp.aspect}.`);
  const visibles = roles.visibles.slice(0, 6).map((x) => x.nom);
  if (visibles.length) {
    const desc = [];
    // nommés dans le titre d'abord ; sinon la protéine, jamais un œuf absent du titre
    if (roles.principaux.length)
      desc.push(
        `${enumerer(roles.principaux)} as the main element${roles.principaux.length > 1 ? 's' : ''}`
      );
    else if (roles.proteine.length)
      desc.push(`${enumerer(roles.proteine.slice(0, 2))} as the main element`);
    if (roles.principaux.length && roles.proteine.length)
      roles.legumes.unshift(...roles.proteine.slice(0, 2));
    if (roles.base.length) desc.push(`${enumerer(roles.base.slice(0, 2))} as the base`);
    if (roles.legumes.length) desc.push(`${enumerer(roles.legumes.slice(0, 4))} clearly visible`);
    const soupe = type.t === 'soupe' || type.t === 'soupe-veloute';
    if (roles.sauce.length && !sucre && !soupe) desc.push(`with ${roles.sauce[0]}`);
    else if (roles.sauce.length) desc.push(`finished with ${roles.sauce[0]}`);
    if (type.t === 'boisson') {
      morceaux.push(
        `Blended from ${enumerer(visibles.slice(0, 4))}; the color of the drink matches these ingredients, and the fresh fruit is recognizable beside the glass.`
      );
    } else {
      morceaux.push(`In the dish: ${desc.join('; ')}.`);
      morceaux.push(
        `The main ingredients must be easy to recognize: ${enumerer(visibles.slice(0, 4))}. Nothing that is not in the recipe${exclus.length ? `: no ${exclus.join(', no ')}` : ''}.`
      );
    }
  }
  // ingrédient cru principal posé derrière, flou, comme sur les photos actuelles
  const cru = roles.visibles.find((x) => {
    const info = ctx.ingredients[x.key] || {};
    return info.aisle === 'fruits-legumes';
  });
  const pool = sucre ? ACCESSOIRES_SUCRE : ACCESSOIRES_SALE;
  const acc = v.accessoires.map((i) => pool[i]);
  if (cuis && ACCESSOIRES_CUISINE[cuis])
    acc[2] = ACCESSOIRES_CUISINE[cuis][k % ACCESSOIRES_CUISINE[cuis].length];
  if (cru) acc.unshift(`some raw ${cru.nom}`);
  morceaux.push(gabaritStyle(v, uniq(acc), type.contenant));
  morceaux.push(`Reference ${item.id} (internal identifier, never shown in the image).`);
  return morceaux.join(' ');
}

/* ------------------------------------------------------------------ ingrédients seuls */

const HERBES = new Set([
  'persil',
  'coriandre',
  'basilic',
  'menthe',
  'ciboulette',
  'aneth',
  'romarin',
  'sauge',
  'thym-frais',
  'estragon-frais',
  'citronnelle',
  'oignon-nouveau',
  'cresson',
  'roquette',
]);
const PETITS = new Set([
  'tomate-cerise',
  'radis',
  'fraise',
  'framboise',
  'myrtille',
  'mure',
  'cerise',
  'raisin',
  'germes-soja',
  'haricot-vert',
  'chou-bruxelles',
  'champignon',
  'shiitake',
  'epinard',
  'salade',
  'abricot',
  'figue',
  'prune',
  'ail',
  'echalote',
  'piment-frais',
  'asperge-verte',
]);
const LIQUIDES =
  /^(lait|creme|huile|vinaigre|sauce|nuoc|tamari|jus|boisson|eau|vin|biere|cidre|rhum|sirop|caramel|lait-coco|lait-amande|coulis|miel)/;
const POTS =
  /^(mayonnaise|ketchup|moutarde|pesto|tahini|beurre-cacahuete|confiture|pate-a-tartiner|pate-curry|pate-tikka|harissa|concentre-tomate|yaourt|fromage-blanc|mascarpone|ricotta|cream-cheese|chantilly|creme-fraiche|tomate-concassee|tapenade)/;
const CONSERVES =
  /^(thon-conserve|sardine$|haricots-|pois-chiches|mais|feves|flageolets|coeur-artichaut|anchois|olives|cornichon|capres)/;
const PATES_A_ETALER =
  /^(pate-(feuilletee|brisee|sablee|pizza)|feuille-brick|galette-riz|pates-lasagne|tortilla)/;

function sceneIngredient(cle, info, nom) {
  const n = nom.toLowerCase();
  if (cle === 'glacons') return 'a few clear ice cubes in a small off-white ceramic bowl';
  if (cle === 'glace-vanille')
    return 'two scoops of vanilla ice cream in a small off-white ceramic bowl';
  if (cle === 'bouillon') return 'two unwrapped stock cubes on a small off-white ceramic dish';
  if (cle === 'oeuf')
    return 'a few whole brown eggs in a small off-white ceramic bowl, one cracked open beside it showing the yolk';
  if (cle === 'tofu' || cle === 'tofu-fume')
    return `a block of ${n} on a small off-white ceramic plate, one slice cut`;
  if (cle === 'beurre' || cle === 'beurre-demi-sel')
    return `a block of ${n} on a small off-white ceramic butter dish, a curl shaved off`;
  if (PATES_A_ETALER.test(cle))
    return `a sheet of raw ${n} partly unrolled on the surface, a light dusting of flour`;
  if (CONSERVES.test(cle))
    return `drained ${nomDansPlat(nom)} in a small off-white ceramic bowl, no can, no jar`;
  if (POTS.test(cle))
    return `${n} in a small off-white ceramic ramekin, a small spoonful resting on the rim, no jar`;
  if (LIQUIDES.test(cle) || info.aisle === 'boissons')
    return `${n} in a small clear unlabeled glass bottle or jug, a small glass or dish of it poured in front`;
  if (info.aisle === 'viandes-poissons') {
    if (/smoked salmon|cured ham|cooked ham|bacon|guanciale/.test(n))
      return `a few thin slices of ${n} loosely folded on a small off-white ceramic plate`;
    return `raw ${n} on a small off-white ceramic plate lined with a piece of parchment paper, fresh and glistening`;
  }
  if (info.aisle === 'surgeles')
    return `${nomDansPlat(nom)}, lightly frosted, in a small off-white ceramic bowl`;
  if (info.aisle === 'cremerie') {
    if (
      /cheese|mozzarella|feta|parmesan|comté|brie|burrata|cheddar|emmental|gorgonzola|gruyère|halloumi|pecorino|reblochon|roquefort|ricotta/.test(
        n
      )
    )
      return `a piece of ${n} on a small off-white ceramic plate, a few slices or crumbles cut beside it`;
    return `${n} in a small off-white ceramic bowl`;
  }
  if (info.aisle === 'boulangerie')
    return `${n}, whole, on a small off-white ceramic plate, one slice or half cut`;
  if (HERBES.has(cle))
    return `a small fresh bunch of ${n} lying on the surface, a few loose leaves`;
  if (PETITS.has(cle))
    return `a small heap of raw ${n} in a shallow off-white ceramic dish, a few pieces beside it`;
  if (info.aisle === 'fruits-legumes')
    return `raw ${n}: one or two whole pieces, one of them cut in half to show the inside, lying on the surface`;
  // épicerie sèche : grains, farines, épices, fruits secs
  return `a small heap of ${n} in a small off-white ceramic bowl, a few grains or pieces scattered in front`;
}

function promptIngredient(item, k = 0, essai = 0) {
  const v = variation('ingredient', k, essai);
  const scene = sceneIngredient(item.cle, item.info || {}, item.nom);
  const acc = [
    ACCESSOIRES_NEUTRES[v.accessoires[0] % 5],
    ACCESSOIRES_NEUTRES[5 + (v.accessoires[1] % 3)],
  ];
  return [
    `Realistic food photograph of a single raw ingredient: ${item.nom.toLowerCase()}, ${scene}. It is the only subject in focus, nothing else is cooked or mixed with it.`,
    gabaritStyle({ ...v, cadrage: v.cadrage.replace('the dish', 'the ingredient') }, acc, ''),
    `Reference ingredient ${item.id} (internal identifier, never shown in the image).`,
  ].join(' ');
}

/* ------------------------------------------------------------------ familles et lot */

function familleDe(item) {
  if (item.type === 'ingredient') return 'ingredient';
  const ty = typeDePlat(item.titre, item.recette);
  return ty.t;
}

/**
 * Prompts de toute une liste (rangs dans la famille calculés dans l'ordre de la liste).
 * essais : { id: n } pour les images à refaire. Renvoie [{ id, type, famille, prompt }].
 */
function construirePrompts(liste, ctx, essais = {}) {
  const rangs = new Map();
  const out = [];
  for (const item of liste) {
    const fam = familleDe(item);
    const k = rangs.get(fam) || 0;
    rangs.set(fam, k + 1);
    const essai = essais[item.id] || 0;
    const prompt =
      item.type === 'ingredient'
        ? promptIngredient(item, k, essai)
        : promptRecette(item, ctx, k, essai);
    out.push({ id: item.id, type: item.type, famille: fam, prompt });
  }
  return out;
}

/** Contexte à partir de donnees.js. */
function contexte(donnees) {
  const { ingredients } = donnees.charger();
  return { ingredients, nomEn: donnees.nomIngredientEn };
}

module.exports = {
  construirePrompts,
  promptRecette,
  promptIngredient,
  typeDePlat,
  cuisine,
  rolesIngredients,
  nomDansPlat,
  variation,
  contexte,
  INTERDITS,
  TOTAL_VARIATIONS: TOTAL,
};
