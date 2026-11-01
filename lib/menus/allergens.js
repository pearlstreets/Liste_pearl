// Sécurité alimentaire des recettes personnelles : leurs ingrédients ne sont pas vérifiés. On
// cherche dans leur texte les mots qui évoquent un allergène ou un interdit du profil. Prudent par
// construction : "lait de coco" alerte sur le lait, mieux vaut une alerte de trop qu'une de moins.
// Pur et tolérant. Les mots sont cherchés dans TOUTES les langues : une recette importée n'est pas
// forcément écrite dans la langue de l'application.
import { estObjet, arr, norm } from './util';
import { normalizeProfile } from './profile';

// w : mots entiers (pluriels en -s, -x, -es acceptés).
// s : morceaux cherchés partout (mots composés allemands, néerlandais, suédois ; langues sans espaces).
const LISTES = {
  gluten: {
    w: `ble farine farines pain pate pates semoule couscous boulgour orge seigle epeautre chapelure biscuit
      brioche crepe nouille raviolis lasagne spaghetti tagliatelle macaroni gnocchi avoine seitan malt
      wheat flour bread breadcrumbs pasta noodle barley rye spelt semolina bulgur oat oats cracker tortilla
      trigo harina cebada centeno fideos espelta semola grano frumento farina pane segale farro
      farinha pao massa cevada centeio aveia tarwe gerst rogge vete korn`,
    s: `weizen mehl brot nudel roggen dinkel gerste griess meel brood vetemjol ragmjol пшениц мука муки муку хлеб
      макарон лапш ячмен 小麦 面粉 面包 面条 麵 大麦 黑麦 薄力粉 強力粉 パン パスタ うどん ラーメン 麺
      قمح دقيق طحين خبز معكرونة شعير برغل سميد แป้ง ข้าวสาลี ขนมปัง บะหมี่ พาสต้า`,
  },
  lait: {
    w: `lait beurre creme fromage yaourt yogourt lactose mozzarella parmesan gruyere emmental comte chevre feta
      mascarpone ricotta lactoserum ghee bechamel cheddar milk butter cream cheese yogurt yoghurt whey buttermilk
      leche mantequilla nata queso yogur crema latte burro panna formaggio leite manteiga natas queijo iogurte
      room smor ost сыр сыра творог кефир йогурт`,
    s: `milch butter sahne kase joghurt rahm quark melk boter kaas mjolk gradde молок сливк сливочн сметан
      牛奶 奶油 黄油 奶酪 芝士 酸奶 乳 牛乳 ミルク バター チーズ ヨーグルト クリーム
      حليب زبدة جبن قشطة لبن زبادي كريمة นม เนย ชีส โยเกิร์ต ครีม`,
  },
  oeuf: {
    w: `oeuf mayonnaise meringue egg mayo ei eier eigelb eiweiss huevo uovo uova tuorlo ovo gema eieren eidooier agg aggula`,
    s: `яйц яиц яичн 鸡蛋 蛋 卵 たまご 玉子 マヨネーズ بيض مايونيز ไข่`,
  },
  poisson: {
    w: `poisson saumon thon cabillaud morue truite sardine maquereau anchois colin merlu dorade hareng lotte surimi
      fish salmon tuna cod trout mackerel anchovy anchovies herring haddock halibut tilapia
      pescado atun bacalao trucha sardina anchoa merluza caballa pesce salmone tonno merluzzo trota acciuga acciughe
      sgombro baccala peixe salmao atum bacalhau truta anchova vis zalm tonijn kabeljauw forel haring ansjovis
      lax torsk sill makrill kabeljau forelle sardelle hering nuoc`,
    s: `fisch lachs fisk рыб лосос тунец треск сельд форел скумбри 鱼 魚 鮭 サーモン ツナ マグロ サバ イワシ
      سمك سلمون تونة أنشوجة ปลา`,
  },
  crustaces: {
    w: `crevette crabe homard langouste langoustine gambas ecrevisse crustace shrimp prawn crab lobster crayfish
      shellfish seafood krabbe hummer krebs languste meeresfruchte gamba camaron cangrejo langosta marisco
      gambero gamberi gamberetti granchio aragosta scampi camarao caranguejo lagosta garnaal garnalen krab kreeft
      rakor raka krabba moule huitre palourde bulot calamar encornet seiche poulpe mussel oyster clam squid
      octopus scallop mejillon ostra almeja calamares pulpo cozza cozze ostrica vongole polpo seppia mexilhao
      amejoa lula mossel oester inktvis musslor ostron blackfisk`,
    s: `garnele кревет краб омар лобстер мидии устриц кальмар осьминог 虾 蟹 エビ 海老 カニ ロブスター 贝 牡蛎 鱿鱼 章鱼 ムール 牡蠣 イカ タコ
      روبيان جمبري سلطعون كركند محار حبار أخطبوط กุ้ง ปู หอย ปลาหมึก`,
  },
  soja: {
    w: `soja tofu tempeh miso edamame tamari soy soya soybean soia`,
    s: `соя сое соев 大豆 豆腐 酱油 味噌 黄豆 醤油 納豆 しょうゆ صويا توفو ถั่วเหลือง เต้าหู้ ซีอิ๊ว`,
  },
  sesame: {
    w: `sesame tahini tahin gomasio sesamo gergelim`,
    s: `sesam кунжут 芝麻 ごま 胡麻 セサミ سمسم طحينة งาขาว งาดำ น้ำมันงา`,
  },
  'fruits-a-coque': {
    w: `noix noisette amande pistache cajou pecan macadamia pignon praline arachide cacahuete nougat frangipane
      nut walnut hazelnut almond pistachio cashew peanut marzipan pistazie nuez nueces avellana almendra pistacho
      anacardo mani noce noci nocciola nocciole mandorla mandorle pistacchio anacardi noz nozes avela amendoa
      pistacio amendoim caju noot noten pinda notter`,
    s: `nuss nusse mandel marzipan walnoot hazelnoot amandel hasselnot valnot jordnot орех миндал фисташ фундук
      арахис кешью 坚果 核桃 杏仁 榛子 花生 腰果 开心果 ナッツ くるみ クルミ アーモンド ピーナッツ カシュー ピスタチオ
      مكسرات لوز جوز بندق فستق كاجو ถั่ว อัลมอนด์ วอลนัท`,
  },
  miel: {
    w: `miel honey miele mel honing honung мед меда`,
    s: `honig 蜂蜜 はちみつ ハチミツ عسل น้ำผึ้ง`,
  },
  porc: {
    w: `porc lardon lard jambon bacon saucisse saucisson chorizo pancetta coppa rillettes andouille boudin chipolata
      prosciutto pork ham sausage gammon pepperoni salami schinken speck cerdo jamon tocino panceta maiale guanciale
      salame porco presunto toucinho varken spek flask skinka сало gelatine gelatin gelatina`,
    s: `schwein свинин бекон ветчин 猪 培根 火腿 豚 ベーコン ハム خنزير หมู เบคอน แฮม`,
  },
  viande: {
    w: `viande boeuf veau agneau poulet dinde canard mouton lapin steak volaille merguez meat beef veal lamb chicken
      turkey duck mutton poultry rind huhn hahnchen pute ente lamm carne pollo ternera cordero pavo pato manzo
      vitello agnello tacchino anatra frango vitela borrego peru vlees rund kip lam kalkoen eend kyckling`,
    s: `fleisch kott мяс говядин куриц баранин индейк утк 肉 鸡 鶏 チキン لحم دجاج เนื้อ ไก่ เป็ด`,
  },
  alcool: {
    w: `vin biere rhum cognac whisky vodka alcool alcohol wine beer rum vino birra cerveja cerveza vinho`,
    s: `wein bier вино пиво 酒 ワイン ビール نبيذ بيرة ไวน์ เบียร์`,
  },
};

const compile = (bloc) =>
  bloc
    .trim()
    .split(/\s+/)
    .map(norm)
    .filter(Boolean);

// Expressions de plusieurs mots.
const EXPRESSIONS = {
  crustaces: ['fruits de mer', 'frutti di mare', 'saint jacques'],
  viande: ['ديك رومي'],
};

export const ALLERGEN_WORDS = Object.fromEntries(
  Object.entries(LISTES).map(([k, v]) => [
    k,
    {
      words: new Set(compile(v.w)),
      parts: [...compile(v.s), ...(EXPRESSIONS[k] || []).map((e) => norm(e))],
    },
  ])
);

/*
 * Table unique des derives, lue par l'eligibilite des recettes ecrites a la main ET des recettes generees
 * (pool.js), et par l'avertissement des recettes personnelles. Les fiches d'ingredients (ingredients.json)
 * portent deja leurs allergenes : fromage, beurre, creme, parmesan... ont "lait" ; lardons, jambon, chorizo...
 * ont "porc" ; pain, pates, semoule, boulgour, biere... ont "gluten". Exclure un allergene exclut donc deja ces
 * ingredients. La table ajoute ce que les fiches ne disent pas :
 * - DERIVES_ALLERGENE : ingredients qui contiennent souvent l'allergene sans que leur fiche le declare (doutes :
 *   securite alimentaire, en cas de doute la recette est exclue) ;
 * - DERIVES_ALIMENT : ingredients faits a partir d'un aliment exclu, ou autre forme du meme aliment ;
 * - ALIMENT_ALLERGENE : aliment exclu qui vaut toute sa famille (filet de porc exclu : tout le porc).
 */
export const DERIVES_ALLERGENE = {
  gluten: ['moutarde', 'sauce-barbecue'],
  lait: ['pain-burger'],
  oeuf: ['gnocchi', 'nouilles', 'pates-lasagne', 'pain-burger', 'pain-mie'],
  soja: ['chocolat-noir'],
  // la noix de coco n'est pas un fruit a coque pour l'Union europeenne, mais l'est pour d'autres pays : doute
  'fruits-a-coque': ['noix-coco-rapee', 'lait-coco', 'eau-de-coco'],
  porc: ['merguez'],
};

export const DERIVES_ALIMENT = {
  tomate: [
    'tomate-cerise',
    'tomate-concassee',
    'concentre-tomate',
    'coulis-tomate',
    'tomate-sechee',
    'ketchup',
    'sauce-barbecue',
  ],
  oignon: ['oignon-rouge', 'oignon-nouveau'],
  champignon: ['shiitake'],
  piment: ['piment-frais', 'piment-espelette', 'harissa'],
  'piment-frais': ['piment', 'piment-espelette', 'harissa'],
  'poulet-filet': ['cuisse-poulet'],
  'cuisse-poulet': ['poulet-filet'],
  'boeuf-hache': ['boeuf-paleron', 'boeuf-rumsteck', 'boeuf-bavette'],
  'boeuf-paleron': ['boeuf-hache', 'boeuf-rumsteck', 'boeuf-bavette'],
  'boeuf-rumsteck': ['boeuf-hache', 'boeuf-paleron', 'boeuf-bavette'],
  'boeuf-bavette': ['boeuf-hache', 'boeuf-paleron', 'boeuf-rumsteck'],
  agneau: ['gigot-agneau', 'cotelette-agneau', 'merguez'],
  'gigot-agneau': ['agneau', 'cotelette-agneau', 'merguez'],
  'cotelette-agneau': ['agneau', 'gigot-agneau', 'merguez'],
  'cuisse-canard': ['magret-canard'],
  'magret-canard': ['cuisse-canard'],
  veau: ['escalope-veau'],
  'escalope-veau': ['veau'],
  saumon: ['saumon-fume'],
  'saumon-fume': ['saumon'],
  'thon-conserve': ['steak-thon'],
  'steak-thon': ['thon-conserve'],
  sardine: ['sardine-fraiche'],
  'sardine-fraiche': ['sardine'],
  anchois: ['nuoc-mam'],
  'lait-coco': ['noix-coco-rapee', 'eau-de-coco'],
  'noix-coco-rapee': ['lait-coco', 'eau-de-coco'],
  'eau-de-coco': ['lait-coco', 'noix-coco-rapee'],
  'chocolat-noir': ['pepites-chocolat', 'pate-a-tartiner', 'chocolat-blanc'],
  cacao: ['chocolat-noir', 'pepites-chocolat', 'pate-a-tartiner'],
  cacahuete: ['beurre-cacahuete'],
  amande: ['amande-poudre', 'amande-effilee', 'lait-amande'],
  noisette: ['pate-a-tartiner'],
  pates: ['pates-lasagne'],
  riz: ['riz-arborio', 'riz-basmati', 'nouilles-riz', 'galette-riz'],
  yaourt: ['yaourt-grec'],
  chevre: ['chevre-frais'],
  creme: ['creme-fraiche', 'chantilly'],
  'creme-fraiche': ['creme'],
  beurre: ['beurre-demi-sel'],
  'pomme-de-terre': ['gnocchi'],
  mais: ['polenta', 'maizena'],
  'pois-chiches': ['farine-pois-chiches'],
  moutarde: ['mayonnaise', 'sauce-barbecue'],
  'celeri-branche': ['celeri-rave', 'bouillon'],
  'celeri-rave': ['celeri-branche', 'bouillon'],
  vinaigre: ['vinaigre-balsamique', 'vinaigre-cidre'],
  sucre: ['sucre-roux', 'sucre-vanille'],
  thym: ['thym-frais'],
  'thym-frais': ['thym'],
  estragon: ['estragon-frais'],
  'estragon-frais': ['estragon'],
  gingembre: ['gingembre-poudre'],
  'gingembre-poudre': ['gingembre'],
  vanille: ['gousse-vanille', 'sucre-vanille'],
  'gousse-vanille': ['vanille', 'sucre-vanille'],
  orange: ['jus-orange'],
  epinard: ['epinard-surgele'],
  'epinard-surgele': ['epinard'],
  raisin: ['raisins-secs'],
  abricot: ['abricot-sec'],
  prune: ['pruneau'],
  pomme: ['cidre', 'vinaigre-cidre'],
};

export const ALIMENT_ALLERGENE = {
  'porc-filet': 'porc',
  'porc-echine': 'porc',
  'cotes-porc': 'porc',
};

/**
 * Exclusions du profil (cles d'ingredients ou allergenes) etendues a leurs derives :
 * { allergens:Set (allergenes refuses dans les fiches), keys:Set (cles d'ingredients refusees) }.
 * Un allergene refuse aussi ses ingredients douteux ; un aliment ses derives (et toute sa famille s'il en est une).
 */
export function expandExclusions(excluded) {
  const allergens = new Set();
  const keys = new Set();
  for (const raw of arr(excluded)) {
    if (typeof raw !== 'string' || !raw) continue;
    const x = raw.toLowerCase();
    allergens.add(x); // une cle peut aussi etre un nom d'allergene (lait, oeuf, sesame, miel)
    keys.add(x);
    for (const k of arr(DERIVES_ALIMENT[x])) keys.add(k);
    if (ALIMENT_ALLERGENE[x]) allergens.add(ALIMENT_ALLERGENE[x]);
  }
  for (const a of allergens) for (const k of arr(DERIVES_ALLERGENE[a])) keys.add(k);
  return { allergens, keys };
}

const DIET_ALLERGENS = {
  'sans-gluten': ['gluten'],
  'sans-lactose': ['lait'],
  'sans-fruits-a-coque': ['fruits-a-coque'],
  'sans-porc': ['porc'],
  'halal-possible': ['porc', 'alcool'],
  vegetarien: ['viande', 'porc', 'poisson', 'crustaces'],
  vegan: ['viande', 'porc', 'poisson', 'crustaces', 'lait', 'oeuf', 'miel'],
};

/** Ce que le profil interdit : { allergens:[clés de ALLERGEN_WORDS], keys:[ingrédients écartés], any } */
export function restrictionsOf(profile) {
  const p = normalizeProfile(profile);
  const allergens = new Set();
  const keys = [];
  for (const x of p.excludedIngredients) {
    if (ALLERGEN_WORDS[x]) allergens.add(x);
    else keys.push(x);
    if (ALIMENT_ALLERGENE[x]) allergens.add(ALIMENT_ALLERGENE[x]); // filet de porc exclu : tout le porc
  }
  for (const d of p.diets) for (const a of arr(DIET_ALLERGENS[d])) allergens.add(a);
  return {
    allergens: [...allergens],
    keys,
    any: p.diets.length > 0 || p.excludedIngredients.length > 0,
  };
}

function motsDe(texteNorm) {
  const set = new Set();
  for (const m of texteNorm.split(' ')) {
    if (!m) continue;
    set.add(m);
    set.add(m.replace(/(es|s|x)$/, ''));
    set.add(m.replace(/[sx]$/, ''));
  }
  return set;
}

/** Allergènes de `wanted` évoqués par ce texte : [clé]. */
export function findAllergens(text, wanted) {
  const nt = norm(text);
  if (!nt) return [];
  const mots = motsDe(nt);
  const cadre = ` ${nt} `;
  const out = [];
  for (const a of arr(wanted)) {
    const l = ALLERGEN_WORDS[a];
    if (!l) continue;
    let hit = false;
    for (const m of mots)
      if (l.words.has(m)) {
        hit = true;
        break;
      }
    if (!hit) hit = l.parts.some((p) => (p.includes(' ') ? cadre.includes(` ${p} `) : nt.includes(p)));
    if (hit) out.push(a);
  }
  return out;
}

/**
 * Avertissement pour une recette personnelle, null si la recette n'en est pas une ou si le profil
 * n'a aucune restriction. -> { allergens:[clés], ingredients:[noms écartés retrouvés], found:bool }
 * found = false : rien de repéré, mais rien n'est vérifié non plus.
 */
export function recipeWarnings({ recipe, profile, ingredients, texts } = {}) {
  try {
    if (!estObjet(recipe) || !recipe.custom) return null;
    const r = restrictionsOf(profile);
    if (!r.any) return null;
    const nomDe = (key) => {
      try {
        return texts && texts.ingredientName ? texts.ingredientName(key) : '';
      } catch {
        return '';
      }
    };
    const lignes = arr(recipe.ingredients).filter(estObjet);
    const noms = lignes.map((i) => i.name || nomDe(i.key)).filter(Boolean);
    const texte = [recipe.title, ...noms, ...arr(recipe.steps)].join(' . ');
    const trouves = new Set(findAllergens(texte, r.allergens));
    for (const i of lignes) {
      const fiche = estObjet(ingredients) ? ingredients[i.key] : null;
      for (const a of arr(fiche && fiche.allergens)) if (r.allergens.includes(a)) trouves.add(a);
      // derives douteux (table unique, comme l'eligibilite des plans)
      for (const a of r.allergens) if (arr(DERIVES_ALLERGENE[a]).includes(i.key)) trouves.add(a);
    }
    const nt = norm(texte);
    const ecartes = [];
    for (const key of r.keys) {
      const derives = arr(DERIVES_ALIMENT[key]);
      const direct = lignes.some((i) => i.key === key || derives.includes(i.key));
      const n = norm(nomDe(key));
      if (direct || (n.length >= 3 && ` ${nt} `.includes(` ${n} `))) ecartes.push(nomDe(key) || key);
    }
    const allergens = [...trouves];
    return { allergens, ingredients: ecartes, found: allergens.length + ecartes.length > 0 };
  } catch {
    return { allergens: [], ingredients: [], found: false };
  }
}
