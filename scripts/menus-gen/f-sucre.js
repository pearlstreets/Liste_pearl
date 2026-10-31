// Desserts, gâteaux, petits-déjeuners et boissons.

const { I, S, recette } = require('./fabrique');
const { de } = require('./langue');

// Fruits : q = quantité pour 4 (u ou g), cuit = se prête à la cuisson,
// prep = préparation commune.
const FRUITS = {
  'pommes': { q: [5, 'u'], cuit: 1, prep: 'Épluchez les pommes, retirez le coeur et coupez-les en morceaux.' },
  'poires': { q: [5, 'u'], cuit: 1, prep: 'Épluchez les poires, retirez le coeur et coupez-les en morceaux.' },
  'bananes': { q: [4, 'u'], cuit: 1, prep: 'Épluchez les bananes et coupez-les en rondelles.' },
  'fraises': { q: [400, 'g'], prep: 'Lavez et équeutez les fraises, coupez-les en deux.' },
  'framboises': { q: [300, 'g'], cuit: 1, prep: 'Triez les framboises sans les laver.' },
  'myrtilles': { q: [300, 'g'], cuit: 1, prep: 'Rincez rapidement les myrtilles et séchez-les.' },
  'mûres': { q: [300, 'g'], cuit: 1, prep: 'Triez les mûres sans les laver.' },
  'cerises': { q: [500, 'g'], cuit: 1, prep: 'Lavez et dénoyautez les cerises.' },
  'abricots': { q: [10, 'u'], cuit: 1, prep: 'Lavez, dénoyautez et coupez les abricots en deux.' },
  'pêches': { q: [5, 'u'], cuit: 1, prep: 'Pelez les pêches, dénoyautez-les et coupez-les en quartiers.' },
  'nectarines': { q: [5, 'u'], cuit: 1, prep: 'Lavez, dénoyautez et coupez les nectarines en quartiers.' },
  'prunes': { q: [12, 'u'], cuit: 1, prep: 'Lavez, dénoyautez et coupez les prunes en deux.' },
  'mangues': { q: [2, 'u'], cuit: 1, prep: 'Épluchez les mangues et coupez la chair en dés.' },
  'ananas': { q: [1, 'u'], cuit: 1, prep: 'Épluchez l\'ananas, retirez le coeur et coupez la chair en dés.' },
  'kiwis': { q: [5, 'u'], prep: 'Épluchez les kiwis et coupez-les en rondelles.' },
  'oranges': { q: [4, 'u'], prep: 'Pelez les oranges à vif et prélevez les suprêmes.' },
  'figues': { q: [8, 'u'], cuit: 1, prep: 'Lavez les figues et coupez-les en quartiers.' },
  'rhubarbe': { q: [500, 'g'], cuit: 1, prep: 'Épluchez la rhubarbe et coupez-la en tronçons.' },
  'melon': { q: [1, 'u'], prep: 'Coupez le melon, retirez les graines et la peau, puis coupez la chair en dés.' },
  'pastèque': { q: [1, 'u'], prep: 'Coupez la pastèque et la chair en cubes en retirant les pépins.' },
  'raisins': { q: [400, 'g'], prep: 'Lavez et égrainez le raisin.' },
  'clémentines': { q: [6, 'u'], prep: 'Épluchez les clémentines et séparez les quartiers.' },
  'fruits de la passion': { q: [4, 'u'], prep: 'Coupez les fruits de la passion en deux et récupérez la pulpe.' },
  'coings': { q: [4, 'u'], cuit: 1, prep: 'Frottez, épluchez et coupez les coings en morceaux en retirant le coeur.' },
};
const F = (n) => [n, ...FRUITS[n].q];
const CUITS = Object.keys(FRUITS).filter((n) => FRUITS[n].cuit);
// Couples de fruits qui s'accordent bien.
const ACCORDS = [
  ['pommes', 'poires'], ['pommes', 'framboises'], ['pommes', 'mûres'], ['pommes', 'myrtilles'], ['pommes', 'rhubarbe'], ['pommes', 'coings'], ['pommes', 'figues'], ['pommes', 'prunes'], ['pommes', 'cerises'], ['pommes', 'bananes'],
  ['poires', 'framboises'], ['poires', 'figues'], ['poires', 'mûres'], ['poires', 'myrtilles'], ['poires', 'bananes'], ['poires', 'prunes'], ['poires', 'coings'],
  ['fraises', 'rhubarbe'], ['fraises', 'framboises'], ['fraises', 'bananes'], ['fraises', 'kiwis'], ['fraises', 'mangues'], ['fraises', 'myrtilles'], ['fraises', 'oranges'], ['fraises', 'pêches'],
  ['framboises', 'pêches'], ['framboises', 'nectarines'], ['framboises', 'abricots'], ['framboises', 'myrtilles'], ['framboises', 'mûres'], ['framboises', 'figues'],
  ['myrtilles', 'bananes'], ['myrtilles', 'pêches'], ['myrtilles', 'nectarines'], ['myrtilles', 'mangues'],
  ['abricots', 'pêches'], ['abricots', 'nectarines'], ['abricots', 'cerises'], ['abricots', 'prunes'],
  ['mangues', 'ananas'], ['mangues', 'bananes'], ['mangues', 'fruits de la passion'], ['ananas', 'bananes'], ['ananas', 'fruits de la passion'], ['ananas', 'kiwis'],
  ['bananes', 'kiwis'], ['bananes', 'oranges'], ['kiwis', 'oranges'], ['melon', 'pastèque'], ['melon', 'fraises'], ['oranges', 'clémentines'], ['cerises', 'pêches'], ['prunes', 'figues'],
];
const nomFruits = (a, b) => (b ? `${a} et ${b}` : a);
const auFruits = (a, b) => (b ? `${I(a).au} et ${I(b).au}` : I(a).au);
const deFruits = (a, b) => (b ? `${de(a)} et ${de(b)}` : de(a));
const demi = (n) => {
  const [q, u] = FRUITS[n].q;
  return [n, u === 'u' ? Math.max(1, Math.ceil(q / 2)) : Math.round(q / 2 / 50) * 50, u];
};
const couples = (filtre) => ACCORDS.filter(([a, b]) => filtre(a) && filtre(b));

// ---------------------------------------------------------------- Tartes aux fruits
for (const [fruits, ings] of [
  ...CUITS.map((n) => [[n], [F(n)]]),
  ...couples((n) => FRUITS[n].cuit).map(([a, b]) => [[a, b], [demi(a), demi(b)]]),
]) {
  recette({
    nom: `Tarte ${auFruits(...fruits)}`,
    cat: 'desserts',
    temps: 55,
    diff: 1,
    pers: 6,
    ings: [['pâte sablée', 1, 'rouleau'], ...ings, ['poudre d\'amande', 50, 'g'], ['sucre', 50, 'g'], ['beurre', 20, 'g']],
    etapes: [
      S('Préchauffez le four à 180 °C. Déroulez la pâte dans un moule à tarte et piquez le fond.'),
      ...fruits.map((f) => S(FRUITS[f].prep)),
      S('Répartissez la poudre d\'amande sur le fond de tarte : elle absorbera le jus des fruits.'),
      S('Disposez les fruits en rosace, saupoudrez de sucre et parsemez de petits morceaux de beurre.'),
      S('Enfournez 35 à 40 min, jusqu\'à ce que la pâte soit dorée. Servez tiède ou froid.'),
    ],
  });
}
// Tartes crues sur crème pâtissière
for (const n of ['fraises', 'framboises', 'kiwis', 'mangues', 'myrtilles', 'pêches', 'raisins', 'figues', 'abricots']) {
  recette({
    nom: `Tarte ${I(n).au} à la crème pâtissière`,
    cat: 'desserts',
    temps: 70,
    diff: 2,
    pers: 6,
    ings: [['pâte sablée', 1, 'rouleau'], F(n), ['lait', 50, 'cL'], ['oeufs', 3, 'u'], ['sucre', 80, 'g'], ['fécule de maïs', 40, 'g'], ['gousse de vanille', 1, 'u']],
    etapes: [
      S('Préchauffez le four à 180 °C. Foncez le moule avec la pâte, recouvrez de papier cuisson et de légumes secs et faites cuire à blanc 20 min, puis 5 min sans les légumes secs.'),
      S('Faites chauffer le lait avec la vanille fendue. Fouettez les jaunes avec le sucre et la fécule, versez le lait chaud dessus, remettez dans la casserole et faites épaissir 2 min en fouettant.'),
      S('Laissez refroidir la crème, filmée au contact.'),
      S(FRUITS[n].prep),
      S('Étalez la crème sur le fond de tarte refroidi et disposez joliment les fruits. Réservez au frais 1 h.'),
    ],
  });
}

// ---------------------------------------------------------------- Crumbles
const TOPPINGS = [
  { nom: '', ings: [['farine', 100, 'g'], ['sucre roux', 80, 'g'], ['beurre', 80, 'g']], mix: 'Sablez du bout des doigts la farine, le sucre roux et le beurre froid en dés.' },
  { nom: ' aux amandes', ings: [['farine', 60, 'g'], ['poudre d\'amande', 60, 'g'], ['sucre roux', 70, 'g'], ['beurre', 80, 'g']], mix: 'Sablez la farine, la poudre d\'amande, le sucre roux et le beurre froid en dés.' },
  { nom: ' aux flocons d\'avoine', ings: [['flocons d\'avoine', 80, 'g'], ['farine', 50, 'g'], ['sucre roux', 70, 'g'], ['beurre', 80, 'g']], mix: 'Mélangez les flocons d\'avoine, la farine, le sucre roux et le beurre mou jusqu\'à obtenir des grumeaux.' },
  { nom: ' aux noisettes', ings: [['noisettes', 60, 'g'], ['farine', 70, 'g'], ['sucre roux', 70, 'g'], ['beurre', 80, 'g']], mix: 'Concassez les noisettes et sablez-les avec la farine, le sucre roux et le beurre froid en dés.' },
];
for (const [fruits, ings] of [
  ...CUITS.map((n) => [[n], [F(n)]]),
  ...couples((n) => FRUITS[n].cuit).map(([a, b]) => [[a, b], [demi(a), demi(b)]]),
]) {
  for (const t of TOPPINGS) {
    recette({
      nom: `Crumble ${auFruits(...fruits)}${t.nom ? `, pâte${t.nom}` : ''}`,
      cat: 'desserts',
      temps: 50,
      diff: 1,
      pers: 6,
      ings: [...ings, ...t.ings, ['cannelle', 1, 'pincee']],
      etapes: [
        S('Préchauffez le four à 180 °C.'),
        ...fruits.map((f) => S(FRUITS[f].prep)),
        S('Disposez les fruits dans un plat beurré et saupoudrez de cannelle.'),
        S(t.mix),
        S('Répartissez la pâte à crumble sur les fruits sans tasser.'),
        S('Enfournez 30 à 35 min, jusqu\'à ce que le dessus soit doré et que le jus bouillonne. Servez tiède.'),
      ],
    });
  }
}

// ---------------------------------------------------------------- Clafoutis
for (const n of ['cerises', 'abricots', 'prunes', 'poires', 'pommes', 'framboises', 'myrtilles', 'pêches', 'figues', 'mûres', 'rhubarbe', 'bananes']) {
  for (const amande of [false, true]) {
    recette({
      nom: `Clafoutis ${I(n).au}${amande ? ' et aux amandes' : ''}`,
      cat: 'desserts',
      temps: 55,
      diff: 1,
      pers: 6,
      ings: [F(n), ['oeufs', 4, 'u'], ['sucre', 100, 'g'], ['farine', amande ? 50 : 80, 'g'], ...(amande ? [['poudre d\'amande', 50, 'g']] : []), ['lait', 40, 'cL'], ['beurre', 20, 'g'], ['sucre vanillé', 1, 'sachet']],
      etapes: [
        S('Préchauffez le four à 180 °C et beurrez un plat.'),
        S(FRUITS[n].prep),
        S('Disposez les fruits dans le plat.'),
        S('Fouettez les oeufs avec le sucre et le sucre vanillé, ajoutez la farine{0}, puis le lait petit à petit.', amande ? ' et la poudre d\'amande' : ''),
        S('Versez la pâte sur les fruits et enfournez 35 à 40 min. Servez tiède ou froid.'),
      ],
    });
  }
}

// ---------------------------------------------------------------- Compotes
const PARFUMS_COMPOTE = [
  { nom: '', ings: [], mot: '' },
  { nom: ' à la cannelle', ings: [['cannelle', 1, 'cc']], mot: 'la cannelle' },
  { nom: ' à la vanille', ings: [['gousse de vanille', 1, 'u']], mot: 'la gousse de vanille fendue' },
  { nom: ' au miel', ings: [['miel', 2, 'cs']], mot: 'le miel' },
];
for (const [fruits, ings] of [
  ...CUITS.map((n) => [[n], [F(n)]]),
  ...couples((n) => FRUITS[n].cuit).map(([a, b]) => [[a, b], [demi(a), demi(b)]]),
]) {
  for (const p of PARFUMS_COMPOTE) {
    recette({
      nom: `Compote ${deFruits(...fruits)}${p.nom}`,
      cat: 'desserts',
      temps: 30,
      diff: 1,
      ings: [...ings, ...p.ings, ...(p.nom === ' au miel' ? [] : [['sucre', 30, 'g']])],
      etapes: [
        ...fruits.map((f) => S(FRUITS[f].prep)),
        S('Mettez les fruits dans une casserole avec 5 cL d\'eau{0}{1}.', p.nom === ' au miel' ? '' : ', le sucre', p.mot ? ` et ${p.mot}` : ''),
        S('Couvrez et laissez cuire 15 à 20 min à feu doux en remuant de temps en temps.'),
        S('Écrasez à la fourchette pour une compote rustique, ou mixez pour une compote lisse. Servez tiède ou froide.'),
      ],
    });
  }
}

// ---------------------------------------------------------------- Smoothies et jus
const CRUS = Object.keys(FRUITS).filter((n) => !['coings', 'rhubarbe', 'figues', 'clémentines', 'prunes', 'mûres'].includes(n));
const LIQUIDES = [
  { mot: 'au lait', ing: ['lait', 30, 'cL'] },
  { mot: 'au yaourt', ing: ['yaourt nature', 2, 'u'] },
  { mot: 'au jus d\'orange', ing: ['jus d\'orange', 30, 'cL'] },
  { mot: 'au lait d\'amande', ing: ['lait d\'amande', 30, 'cL'] },
  { mot: 'à l\'eau de coco', ing: ['eau de coco', 30, 'cL'] },
  { mot: 'au lait d\'avoine', ing: ['lait d\'avoine', 30, 'cL'] },
];
const petit = (n) => {
  const [q, u] = FRUITS[n].q;
  if (u === 'u' && q === 1) return [n, 0.5, u]; // fruit entier unique : la moitie pour 2 verres
  return [n, u === 'u' ? Math.max(1, Math.ceil(q / 3)) : Math.round(q / 3 / 50) * 50, u];
};
for (const [a, b] of ACCORDS.filter(([a, b]) => CRUS.includes(a) && CRUS.includes(b))) {
  for (const l of LIQUIDES) {
    if (a === 'oranges' && l.mot === 'au jus d\'orange') continue;
    if ((a === 'melon' || a === 'pastèque') && l.mot !== 'à l\'eau de coco') continue;
    recette({
      nom: `Smoothie ${nomFruits(a, b)} ${l.mot}`,
      cat: 'boissons',
      temps: 10,
      diff: 1,
      pers: 2,
      ings: [petit(a), petit(b), l.ing, ['miel', 1, 'cc'], ['glaçons', 4, 'u']],
      etapes: [
        S(FRUITS[a].prep),
        S(FRUITS[b].prep),
        S('Mettez les fruits dans un blender avec le liquide, le miel et les glaçons.'),
        S('Mixez 1 min, jusqu\'à obtenir une texture bien lisse. Servez aussitôt.'),
      ],
    });
  }
}
for (const n of CRUS) {
  for (const l of LIQUIDES) {
    if (n === 'oranges' && l.mot === 'au jus d\'orange') continue;
    recette({
      nom: `Smoothie ${n} ${l.mot}`,
      cat: 'boissons',
      temps: 5,
      diff: 1,
      pers: 2,
      ings: [FRUITS[n].q[1] === 'u' && FRUITS[n].q[0] === 1 ? [n, 0.5, 'u'] : demi(n), l.ing, ['miel', 1, 'cc'], ['glaçons', 4, 'u']],
      etapes: [S(FRUITS[n].prep), S('Mixez les fruits avec le liquide, le miel et les glaçons pendant 1 min.')],
    });
  }
}
// Eaux aromatisées et citronnades
const HERBES_BOISSON = ['menthe', 'basilic', 'romarin', 'thym', 'gingembre'];
for (const n of ['citrons', 'citrons verts', 'oranges', 'fraises', 'framboises', 'concombre', 'pastèque', 'pêches', 'pamplemousses', 'ananas', 'mangues', 'kiwis']) {
  for (const h of HERBES_BOISSON) {
    const ing = FRUITS[n] ? demi(n) : [n, 2, 'u'];
    recette({
      nom: `Eau aromatisée ${nomFruits(n)} et ${h}`,
      cat: 'boissons',
      temps: 10,
      diff: 1,
      pers: 6,
      ings: [ing, [h, h === 'gingembre' ? 20 : 1, h === 'gingembre' ? 'g' : 'botte'], ['glaçons', 10, 'u']],
      etapes: [
        S('Lavez et coupez les fruits en tranches fines.'),
        S(h === 'gingembre' ? 'Épluchez le gingembre et coupez-le en fines lamelles.' : 'Froissez légèrement les feuilles pour libérer leur parfum.'),
        S('Mettez le tout dans une carafe, remplissez de 1,5 L d\'eau fraîche et laissez infuser au moins 1 h au réfrigérateur.'),
        S('Servez avec des glaçons. Se garde 24 h au frais.'),
      ],
    });
  }
}
for (const n of ['citrons', 'citrons verts', 'oranges', 'pamplemousses']) {
  for (const extra of [null, 'menthe', 'gingembre', 'framboises', 'fraises']) {
    recette({
      nom: `${n === 'citrons' ? 'Citronnade' : n === 'citrons verts' ? 'Limonade au citron vert' : n === 'oranges' ? 'Orangeade' : 'Boisson pétillante au pamplemousse'}${extra ? ` ${I(extra).au}` : ' maison'}`,
      cat: 'boissons',
      temps: 15,
      diff: 1,
      pers: 6,
      ings: [[n, 4, 'u'], ['sucre', 100, 'g'], ['eau gazeuse', 1, 'L'], ['glaçons', 10, 'u'], ...(extra ? [[extra, extra === 'menthe' ? 1 : extra === 'gingembre' ? 30 : 150, extra === 'menthe' ? 'botte' : 'g']] : [])],
      etapes: [
        S('Pressez les agrumes et filtrez le jus.'),
        S('Faites un sirop : chauffez le sucre avec 10 cL d\'eau jusqu\'à ce qu\'il soit dissous, puis laissez refroidir.'),
        extra ? S('Ajoutez {0} écrasés ou émincés au sirop et laissez infuser 15 min.', I(extra).le) : null,
        S('Mélangez le jus, le sirop et l\'eau gazeuse bien froide. Servez sur des glaçons.'),
      ],
    });
  }
}
// Milkshakes
for (const p of ['vanille', 'chocolat', 'fraises', 'bananes', 'caramel', 'café', 'framboises', 'mangues', 'pâte à tartiner', 'myrtilles']) {
  const ingP = p === 'vanille' ? ['extrait de vanille', 1, 'cc'] : p === 'chocolat' ? ['cacao', 2, 'cs'] : p === 'caramel' ? ['caramel', 3, 'cs'] : p === 'café' ? ['café', 10, 'cL'] : p === 'pâte à tartiner' ? ['pâte à tartiner', 2, 'cs'] : demi(p);
  recette({
    nom: `Milkshake ${{ vanille: 'à la vanille', chocolat: 'au chocolat', caramel: 'au caramel', café: 'au café', 'pâte à tartiner': 'à la pâte à tartiner' }[p] || I(p).au}`,
    cat: 'boissons',
    temps: 5,
    diff: 1,
    pers: 2,
    ings: [['lait', 25, 'cL'], ['glace vanille', 4, 'u'], ingP],
    etapes: [
      S('Mettez le lait bien froid, les boules de glace et le parfum dans un blender.'),
      S('Mixez 30 s, jusqu\'à obtenir une boisson mousseuse.'),
    ],
  });
}

// ---------------------------------------------------------------- Gâteaux, cakes, muffins
const PARFUMS_GATEAU = [
  { mot: 'au citron', ings: [['citrons', 2, 'u']], ajout: 'le zeste et le jus des citrons' },
  { mot: 'à l\'orange', ings: [['oranges', 2, 'u']], ajout: 'le zeste et le jus des oranges' },
  { mot: 'aux pépites de chocolat', ings: [['pépites de chocolat', 120, 'g']], ajout: 'les pépites de chocolat' },
  { mot: 'marbré au chocolat', ings: [['cacao', 3, 'cs']], ajout: 'le cacao dans la moitié de la pâte, puis alternez les deux pâtes dans le moule' },
  { mot: 'aux pommes', ings: [['pommes', 3, 'u']], ajout: 'les pommes en petits dés' },
  { mot: 'aux poires et au chocolat', ings: [['poires', 2, 'u'], ['pépites de chocolat', 80, 'g']], ajout: 'les poires en dés et les pépites de chocolat' },
  { mot: 'à la banane', ings: [['bananes', 3, 'u']], ajout: 'les bananes écrasées' },
  { mot: 'aux myrtilles', ings: [['myrtilles', 150, 'g']], ajout: 'les myrtilles farinées' },
  { mot: 'aux framboises', ings: [['framboises', 150, 'g']], ajout: 'les framboises farinées' },
  { mot: 'à la noix de coco', ings: [['noix de coco râpée', 80, 'g']], ajout: 'la noix de coco râpée' },
  { mot: 'aux amandes', ings: [['poudre d\'amande', 80, 'g'], ['amandes', 30, 'g']], ajout: 'la poudre d\'amande, puis parsemez d\'amandes effilées' },
  { mot: 'aux noisettes', ings: [['noisettes', 80, 'g']], ajout: 'les noisettes concassées' },
  { mot: 'à la vanille', ings: [['gousse de vanille', 1, 'u']], ajout: 'les graines de la gousse de vanille' },
  { mot: 'au café', ings: [['café', 5, 'cL']], ajout: 'le café serré refroidi' },
  { mot: 'à la pistache', ings: [['pistaches', 80, 'g']], ajout: 'les pistaches mixées' },
  { mot: 'au citron et aux graines de pavot', ings: [['citrons', 2, 'u'], ['graines de chia', 2, 'cs']], ajout: 'le zeste et le jus des citrons et les graines' },
  { mot: 'aux fruits rouges', ings: [['framboises', 80, 'g'], ['myrtilles', 80, 'g']], ajout: 'les fruits rouges farinés' },
  { mot: 'aux abricots', ings: [['abricots', 6, 'u']], ajout: 'les abricots en dés' },
  { mot: 'aux cerises', ings: [['cerises', 200, 'g']], ajout: 'les cerises dénoyautées' },
  { mot: 'au chocolat blanc et aux framboises', ings: [['chocolat blanc', 100, 'g'], ['framboises', 125, 'g']], ajout: 'le chocolat blanc haché et les framboises' },
  { mot: 'à la cannelle et aux noix', ings: [['cannelle', 2, 'cc'], ['noix', 80, 'g']], ajout: 'la cannelle et les noix concassées' },
  { mot: 'aux fraises', ings: [['fraises', 200, 'g']], ajout: 'les fraises en dés' },
  { mot: 'à la mangue et à la coco', ings: [['mangues', 1, 'u'], ['noix de coco râpée', 50, 'g']], ajout: 'la mangue en dés et la coco râpée' },
  { mot: 'aux figues et au miel', ings: [['figues', 5, 'u'], ['miel', 2, 'cs']], ajout: 'les figues en quartiers et le miel' },
  { mot: 'à la rhubarbe', ings: [['rhubarbe', 250, 'g']], ajout: 'la rhubarbe en petits tronçons' },
  { mot: 'aux pruneaux et au rhum', ings: [['pruneaux', 120, 'g'], ['rhum', 3, 'cs']], ajout: 'les pruneaux macérés dans le rhum' },
  { mot: 'aux raisins secs', ings: [['raisins secs', 100, 'g']], ajout: 'les raisins secs' },
  { mot: 'aux dattes', ings: [['dattes', 120, 'g']], ajout: 'les dattes dénoyautées en morceaux' },
  { mot: 'à l\'ananas', ings: [['ananas', 1, 'u']], ajout: 'l\'ananas en petits dés bien égouttés' },
  { mot: 'au caramel au beurre salé', ings: [['caramel', 4, 'cs']], ajout: 'le caramel en filet, puis marbrez avec la pointe d\'un couteau' },
];
const PATES_GATEAU = [
  { nom: 'Cake', pers: 8, temps: 60, ings: [['farine', 200, 'g'], ['sucre', 150, 'g'], ['oeufs', 3, 'u'], ['beurre', 125, 'g'], ['levure chimique', 1, 'sachet'], ['lait', 5, 'cL']],
    base: 'Fouettez le beurre mou avec le sucre, puis ajoutez les oeufs un à un, la farine et la levure, et le lait.', cuit: 'Versez dans un moule à cake beurré et enfournez 45 min à 170 °C : la lame d\'un couteau doit ressortir sèche.' },
  { nom: 'Gâteau au yaourt', pers: 8, temps: 45, ings: [['yaourt nature', 1, 'u'], ['farine', 250, 'g'], ['sucre', 150, 'g'], ['oeufs', 3, 'u'], ['huile', 10, 'cL'], ['levure chimique', 1, 'sachet']],
    base: 'Versez le yaourt dans un saladier et utilisez le pot vide comme mesure : 2 pots de sucre, 3 pots de farine, 1/2 pot d\'huile. Ajoutez les oeufs et la levure et mélangez.', cuit: 'Versez dans un moule beurré et enfournez 30 à 35 min à 180 °C.' },
  { nom: 'Muffins', pers: 12, temps: 35, ings: [['farine', 250, 'g'], ['sucre', 120, 'g'], ['oeufs', 2, 'u'], ['lait', 20, 'cL'], ['beurre', 90, 'g'], ['levure chimique', 1, 'sachet']],
    base: 'Mélangez la farine, le sucre et la levure d\'un côté ; les oeufs, le lait et le beurre fondu de l\'autre. Réunissez les deux sans trop mélanger.', cuit: 'Remplissez des moules à muffins aux deux tiers et enfournez 20 min à 180 °C.' },
];
for (const p of PATES_GATEAU) {
  for (const g of PARFUMS_GATEAU) {
    if (p.nom === 'Gâteau au yaourt' && g.mot === 'marbré au chocolat') continue;
    const nom = g.mot === 'marbré au chocolat' ? `${p.nom} ${p.nom === 'Muffins' ? 'marbrés' : 'marbré'} au chocolat` : `${p.nom} ${g.mot}`;
    recette({
      nom,
      cat: 'gateaux',
      temps: p.temps,
      diff: 1,
      pers: p.pers,
      ings: [...p.ings, ...g.ings],
      etapes: [
        S('Préchauffez le four et beurrez le moule.'),
        S(p.base),
        S('Incorporez {0}.', g.ajout),
        S(p.cuit),
        S('Laissez tiédir avant de démouler.'),
      ],
    });
  }
}

// ---------------------------------------------------------------- Chocolat
const CHOCO = [
  { nom: 'Fondant au chocolat', pers: 8, temps: 40, diff: 1, ings: [['chocolat noir', 200, 'g'], ['beurre', 150, 'g'], ['sucre', 120, 'g'], ['oeufs', 4, 'u'], ['farine', 50, 'g']], etapes: ['Préchauffez le four à 180 °C.', 'Faites fondre le chocolat et le beurre au bain-marie.', 'Fouettez les oeufs avec le sucre, ajoutez le chocolat fondu puis la farine.', 'Versez dans un moule beurré et enfournez 20 à 25 min : le centre doit rester tremblotant.'] },
  { nom: 'Brownies aux noix', pers: 12, temps: 40, diff: 1, ings: [['chocolat noir', 200, 'g'], ['beurre', 150, 'g'], ['sucre', 150, 'g'], ['oeufs', 3, 'u'], ['farine', 80, 'g'], ['noix', 100, 'g']], etapes: ['Préchauffez le four à 180 °C.', 'Faites fondre le chocolat et le beurre.', 'Ajoutez le sucre, les oeufs, la farine puis les noix concassées.', 'Étalez dans un moule carré chemisé et enfournez 25 min. Laissez refroidir avant de couper en carrés.'] },
  { nom: 'Mousse au chocolat', pers: 6, temps: 20, diff: 1, ings: [['chocolat noir', 200, 'g'], ['oeufs', 6, 'u'], ['sucre', 30, 'g'], ['sel', 1, 'pincee']], etapes: ['Faites fondre le chocolat au bain-marie et laissez tiédir.', 'Séparez les blancs des jaunes. Incorporez les jaunes au chocolat.', 'Montez les blancs en neige ferme avec la pincée de sel, puis serrez-les avec le sucre.', 'Incorporez délicatement les blancs au chocolat en trois fois. Réservez au moins 4 h au frais.'] },
  { nom: 'Cookies aux pépites de chocolat', pers: 20, temps: 30, diff: 1, ings: [['farine', 250, 'g'], ['beurre', 125, 'g'], ['sucre roux', 150, 'g'], ['oeufs', 1, 'u'], ['pépites de chocolat', 200, 'g'], ['levure chimique', 1, 'cc']], etapes: ['Préchauffez le four à 180 °C.', 'Mélangez le beurre mou et le sucre roux, ajoutez l\'oeuf, puis la farine et la levure.', 'Incorporez les pépites de chocolat.', 'Formez des boules sur une plaque en les espaçant, et enfournez 10 à 12 min : les cookies doivent rester tendres au centre.'] },
  { nom: 'Gâteau au chocolat sans farine', pers: 8, temps: 50, diff: 2, ings: [['chocolat noir', 250, 'g'], ['beurre', 150, 'g'], ['sucre', 150, 'g'], ['oeufs', 5, 'u'], ['poudre d\'amande', 50, 'g']], etapes: ['Préchauffez le four à 160 °C.', 'Faites fondre le chocolat et le beurre.', 'Fouettez les oeufs et le sucre jusqu\'à ce que le mélange blanchisse, puis ajoutez le chocolat et la poudre d\'amande.', 'Enfournez 35 min dans un moule chemisé et laissez refroidir complètement avant de démouler.'] },
  { nom: 'Truffes au chocolat', pers: 20, temps: 30, diff: 1, ings: [['chocolat noir', 200, 'g'], ['crème liquide', 10, 'cL'], ['beurre', 30, 'g'], ['cacao', 3, 'cs']], etapes: ['Faites bouillir la crème et versez-la sur le chocolat haché. Mélangez, ajoutez le beurre.', 'Laissez durcir 2 h au réfrigérateur.', 'Formez des boules avec une petite cuillère et roulez-les dans le cacao.'] },
  { nom: 'Mi-cuits au chocolat coeur coulant', pers: 6, temps: 25, diff: 2, ings: [['chocolat noir', 150, 'g'], ['beurre', 100, 'g'], ['sucre', 80, 'g'], ['oeufs', 3, 'u'], ['farine', 30, 'g']], etapes: ['Préchauffez le four à 200 °C et beurrez 6 ramequins.', 'Faites fondre le chocolat et le beurre, ajoutez le sucre, les oeufs puis la farine.', 'Remplissez les ramequins et enfournez 8 à 9 min exactement.', 'Démoulez aussitôt et servez : le coeur doit couler.'] },
  { nom: 'Mousse au chocolat blanc et aux framboises', pers: 6, temps: 25, diff: 1, ings: [['chocolat blanc', 200, 'g'], ['crème liquide', 30, 'cL'], ['framboises', 200, 'g']], etapes: ['Faites fondre le chocolat blanc avec 10 cL de crème.', 'Montez le reste de la crème bien froide en chantilly.', 'Incorporez la chantilly au chocolat refroidi.', 'Alternez mousse et framboises dans des verrines et réservez 3 h au frais.'] },
  { nom: 'Fondant au chocolat et à la crème de marrons', pers: 8, temps: 45, diff: 1, ings: [['chocolat noir', 100, 'g'], ['confiture', 250, 'g'], ['beurre', 100, 'g'], ['oeufs', 3, 'u']], etapes: ['Préchauffez le four à 180 °C.', 'Faites fondre le chocolat et le beurre, ajoutez la crème de marrons puis les oeufs battus.', 'Enfournez 25 min dans un moule beurré.'] },
  { nom: 'Cookies au chocolat blanc et aux noix de cajou', pers: 20, temps: 30, diff: 1, ings: [['farine', 250, 'g'], ['beurre', 125, 'g'], ['sucre roux', 150, 'g'], ['oeufs', 1, 'u'], ['chocolat blanc', 150, 'g'], ['noix de cajou', 80, 'g']], etapes: ['Préchauffez le four à 180 °C.', 'Mélangez le beurre mou et le sucre roux, ajoutez l\'oeuf puis la farine.', 'Incorporez le chocolat blanc et les noix de cajou concassés.', 'Formez des boules espacées et enfournez 10 à 12 min.'] },
];
for (const c of CHOCO) recette({ ...c, cat: c.nom.startsWith('Cookies') || c.nom.startsWith('Truffes') ? 'gateaux' : c.nom.startsWith('Mousse') ? 'desserts' : 'gateaux', etapes: c.etapes.map((e) => S(e)) });

// ---------------------------------------------------------------- Panna cotta, verrines, desserts lactés
const COULIS = ['fraises', 'framboises', 'myrtilles', 'mangues', 'fruits de la passion', 'abricots', 'cerises', 'kiwis', 'pêches', 'mûres', 'ananas', 'figues'];
for (const n of COULIS) {
  recette({
    nom: `Panna cotta, coulis ${de(n)}`,
    cat: 'desserts',
    temps: 25,
    diff: 1,
    pers: 6,
    ings: [['crème liquide', 50, 'cL'], ['sucre', 60, 'g'], ['gousse de vanille', 1, 'u'], ['agar-agar', 2, 'g'], demi(n), ['sucre', 30, 'g']],
    etapes: [
      S('Faites chauffer la crème avec le sucre et la vanille fendue. Ajoutez l\'agar-agar et laissez bouillir 2 min en fouettant.'),
      S('Versez dans 6 verrines et laissez prendre 3 h au réfrigérateur.'),
      S(FRUITS[n].prep),
      S('Mixez les fruits avec le sucre et filtrez si besoin. Versez le coulis sur les panna cotta au moment de servir.'),
    ],
  });
  recette({
    nom: `Verrines de fromage blanc ${I(n).au} et au crumble`,
    cat: 'desserts',
    temps: 25,
    diff: 1,
    ings: [['fromage blanc', 400, 'g'], demi(n), ['biscuits', 6, 'u'], ['miel', 2, 'cs']],
    etapes: [S(FRUITS[n].prep), S('Émiettez les biscuits.'), S('Mélangez le fromage blanc avec le miel.'), S('Alternez fromage blanc, fruits et biscuits émiettés dans des verrines. Servez frais.')],
  });
  recette({
    nom: `Mousse ${I(n).au}`,
    cat: 'desserts',
    temps: 25,
    diff: 2,
    pers: 6,
    ings: [F(n), ['crème liquide', 25, 'cL'], ['sucre', 60, 'g'], ['gélatine', 3, 'feuille']],
    etapes: [
      S('Faites tremper la gélatine dans l\'eau froide.'),
      S(FRUITS[n].prep),
      S('Mixez les fruits avec le sucre. Faites chauffer un quart de la purée et faites-y fondre la gélatine essorée, puis mélangez avec le reste.'),
      S('Montez la crème bien froide en chantilly et incorporez-la délicatement à la purée.'),
      S('Répartissez dans des verrines et laissez prendre 4 h au frais.'),
    ],
  });
}
// Salades de fruits : trios d'accords
const TRIOS = [];
for (const [a, b] of ACCORDS) {
  for (const [c, d] of ACCORDS) {
    if (c === a && d !== b && !['coings', 'rhubarbe'].some((x) => [a, b, d].includes(x))) {
      const trio = [a, b, d].sort();
      if (!TRIOS.some((t) => t.join() === trio.join())) TRIOS.push(trio);
    }
  }
}
for (const trio of TRIOS) {
  for (const parfum of [{ mot: 'à la menthe', ing: ['menthe', 1, 'botte'] }, { mot: 'au sirop vanillé', ing: ['gousse de vanille', 1, 'u'] }]) {
    recette({
      nom: `Salade ${de(trio[0])}, ${trio[1]} et ${trio[2]} ${parfum.mot}`,
      cat: 'desserts',
      temps: 20,
      diff: 1,
      ings: [...trio.map(petit), parfum.ing, ['sucre', 30, 'g'], ['citrons', 1, 'u']],
      etapes: [
        ...trio.map((f) => S(FRUITS[f].prep)),
        S(parfum.mot === 'à la menthe'
          ? 'Mélangez les fruits avec le jus du citron, le sucre et la menthe ciselée.'
          : 'Faites un sirop avec 10 cL d\'eau, le sucre et la vanille fendue, laissez refroidir puis versez sur les fruits avec le jus du citron.'),
        S('Réservez 30 min au frais avant de servir.'),
      ],
    });
  }
}

// ---------------------------------------------------------------- Petits-déjeuners
const GARN_PANCAKE = [
  { mot: 'au sirop d\'érable', prep: null, serv: 'Servez chaud, nappé de sirop d\'érable.', ings: [['sirop d\'érable', 6, 'cs']] },
  { mot: 'aux myrtilles', prep: 'Rincez rapidement les myrtilles.', serv: 'Servez chaud avec les myrtilles.', ings: [['myrtilles', 150, 'g']] },
  { mot: 'à la banane et au chocolat', prep: 'Coupez les bananes en rondelles.', serv: 'Servez chaud avec les bananes et la pâte à tartiner.', ings: [['bananes', 2, 'u'], ['pâte à tartiner', 4, 'cs']] },
  { mot: 'aux fraises et à la chantilly', prep: 'Lavez et coupez les fraises en deux.', serv: 'Servez chaud avec les fraises et la chantilly.', ings: [['fraises', 250, 'g'], ['chantilly', 1, 'u']] },
  { mot: 'au citron et au sucre', prep: 'Pressez les citrons.', serv: 'Servez chaud, arrosé de jus de citron et saupoudré de sucre.', ings: [['citrons', 2, 'u'], ['sucre', 4, 'cs']] },
  { mot: 'aux pommes caramélisées', prep: 'Coupez les pommes en lamelles et faites-les caraméliser 8 min à la poêle avec le beurre et le sucre roux.', serv: 'Servez chaud avec les pommes caramélisées.', ings: [['pommes', 3, 'u'], ['beurre', 20, 'g'], ['sucre roux', 3, 'cs']] },
  { mot: 'à la confiture', prep: null, serv: 'Servez chaud avec la confiture.', ings: [['confiture', 6, 'cs']] },
  { mot: 'au caramel au beurre salé', prep: null, serv: 'Servez chaud, nappé de caramel au beurre salé.', ings: [['caramel', 6, 'cs']] },
  { mot: 'aux fruits rouges et au fromage blanc', prep: 'Triez les fruits rouges sans les laver.', serv: 'Servez chaud avec les fruits rouges et le fromage blanc.', ings: [['framboises', 125, 'g'], ['myrtilles', 125, 'g'], ['fromage blanc', 200, 'g']] },
  { mot: 'au miel et aux noix', prep: 'Concassez les noix.', serv: 'Servez chaud avec le miel et les noix.', ings: [['miel', 4, 'cs'], ['noix', 60, 'g']] },
  { mot: 'au bacon et au sirop d\'érable', prep: 'Faites griller le bacon 5 min à la poêle.', serv: 'Servez chaud avec le bacon et le sirop d\'érable.', ings: [['bacon', 8, 'tranche'], ['sirop d\'érable', 4, 'cs']] },
  { mot: 'à la mangue et à la coco', prep: 'Épluchez la mangue et coupez la chair en dés.', serv: 'Servez chaud avec la mangue et la noix de coco râpée.', ings: [['mangues', 1, 'u'], ['noix de coco râpée', 3, 'cs']] },
];
const PATES_PDJ = [
  { nom: 'Pancakes', ings: [['farine', 250, 'g'], ['lait', 30, 'cL'], ['oeufs', 2, 'u'], ['sucre', 30, 'g'], ['levure chimique', 1, 'sachet'], ['beurre', 30, 'g']], cuit: 'Faites cuire des petites louches de pâte dans une poêle beurrée à feu moyen, 2 min par face, jusqu\'à ce que des bulles se forment.', base: 'Mélangez la farine, le sucre et la levure, puis ajoutez les oeufs, le lait et le beurre fondu. Laissez reposer 10 min.' },
  { nom: 'Crêpes', ings: [['farine', 250, 'g'], ['lait', 50, 'cL'], ['oeufs', 4, 'u'], ['sucre', 30, 'g'], ['beurre', 50, 'g']], cuit: 'Faites cuire de fines crêpes dans une poêle chaude légèrement beurrée, 1 min par face.', base: 'Mélangez la farine et le sucre, ajoutez les oeufs puis le lait petit à petit en fouettant, et enfin le beurre fondu. Laissez reposer 1 h.' },
  { nom: 'Gaufres', ings: [['farine', 250, 'g'], ['lait', 40, 'cL'], ['oeufs', 3, 'u'], ['sucre', 50, 'g'], ['beurre', 100, 'g'], ['levure chimique', 1, 'sachet']], cuit: 'Faites cuire la pâte dans un gaufrier bien chaud et huilé, 3 à 4 min par gaufre.', base: 'Mélangez la farine, le sucre et la levure, ajoutez les jaunes d\'oeufs, le lait et le beurre fondu, puis les blancs montés en neige.' },
  { nom: 'Pain perdu', ings: [['pain', 8, 'tranche'], ['lait', 25, 'cL'], ['oeufs', 3, 'u'], ['sucre', 40, 'g'], ['beurre', 40, 'g']], cuit: 'Faites dorer les tranches de pain dans le beurre, 2 min par face.', base: 'Battez les oeufs avec le lait et le sucre, et trempez-y les tranches de pain des deux côtés.' },
];
for (const p of PATES_PDJ) {
  for (const g of GARN_PANCAKE) {
    recette({
      nom: `${p.nom} ${g.mot}`,
      cat: 'petit_dejeuner',
      temps: p.nom === 'Crêpes' ? 30 : 25,
      diff: 1,
      ings: [...p.ings, ...g.ings],
      etapes: [g.prep ? S(g.prep) : null, S(p.base), S(p.cuit), S(g.serv)],
    });
  }
}
const FRUITS_PDJ = ['bananes', 'fraises', 'framboises', 'myrtilles', 'pommes', 'poires', 'mangues', 'pêches', 'kiwis', 'abricots', 'cerises', 'figues'];
const CROQUANTS = [
  { mot: 'aux amandes', ing: ['amandes', 40, 'g'] }, { mot: 'aux noix', ing: ['noix', 40, 'g'] },
  { mot: 'aux graines de chia', ing: ['graines de chia', 2, 'cs'] }, { mot: 'à la noix de coco', ing: ['noix de coco râpée', 3, 'cs'] },
];
for (const n of FRUITS_PDJ) {
  for (const c of CROQUANTS) {
    recette({
      nom: `Porridge ${I(n).au} et ${c.mot}`,
      cat: 'petit_dejeuner',
      temps: 10,
      diff: 1,
      pers: 2,
      ings: [['flocons d\'avoine', 100, 'g'], ['lait', 40, 'cL'], petit(n), c.ing, ['miel', 1, 'cs']],
      etapes: [
        S('Faites chauffer les flocons d\'avoine dans le lait 5 min à feu doux, en remuant, jusqu\'à ce que le mélange épaississe.'),
        S(FRUITS[n].prep),
        S('Versez dans des bols, ajoutez les fruits, {0} et un filet de miel.', I(c.ing[0]).le),
      ],
    });
    recette({
      nom: `Overnight oats ${I(n).au} et ${c.mot}`,
      cat: 'petit_dejeuner',
      temps: 10,
      diff: 1,
      pers: 2,
      ings: [['flocons d\'avoine', 100, 'g'], ['lait d\'amande', 20, 'cL'], ['yaourt nature', 1, 'u'], petit(n), c.ing, ['miel', 1, 'cs']],
      etapes: [
        S('Dans deux bocaux, mélangez les flocons d\'avoine, le lait d\'amande, le yaourt et le miel.'),
        S('Fermez et laissez reposer toute la nuit au réfrigérateur.'),
        S(FRUITS[n].prep),
        S('Le matin, ajoutez les fruits et {0}.', I(c.ing[0]).le),
      ],
    });
    recette({
      nom: `Bol de yaourt ${I(n).au} et ${c.mot}`,
      cat: 'petit_dejeuner',
      temps: 5,
      diff: 1,
      pers: 2,
      ings: [['yaourt grec', 2, 'u'], petit(n), c.ing, ['miel', 1, 'cs']],
      etapes: [S(FRUITS[n].prep), S('Répartissez le yaourt dans deux bols, ajoutez les fruits, {0} et un filet de miel.', I(c.ing[0]).le)],
    });
  }
}
const GRANOLAS = ['amandes', 'noisettes', 'noix de cajou', 'noix', 'pistaches', 'cacahuètes'];
for (const n of GRANOLAS) {
  for (const s of [{ mot: 'au miel', ing: ['miel', 4, 'cs'] }, { mot: 'au sirop d\'érable', ing: ['sirop d\'érable', 4, 'cs'] }]) {
    for (const x of [null, { mot: 'et aux raisins secs', ing: ['raisins secs', 60, 'g'] }, { mot: 'et au chocolat', ing: ['pépites de chocolat', 60, 'g'] }, { mot: 'et à la coco', ing: ['noix de coco râpée', 40, 'g'] }]) {
      recette({
        nom: `Granola maison ${I(n).au} ${s.mot} ${x ? x.mot : ''}`,
        cat: 'petit_dejeuner',
        temps: 35,
        diff: 1,
        pers: 8,
        ings: [['flocons d\'avoine', 300, 'g'], [n, 100, 'g'], s.ing, ['huile', 4, 'cs'], ['cannelle', 1, 'cc'], ...(x ? [x.ing] : [])],
        etapes: [
          S('Préchauffez le four à 160 °C.'),
          S('Mélangez les flocons d\'avoine, les fruits secs concassés et la cannelle.'),
          S('Ajoutez l\'huile et {0}, mélangez bien pour enrober.', I(s.ing[0]).le),
          S('Étalez sur une plaque et enfournez 20 à 25 min en remuant à mi-cuisson.'),
          x && x.mot !== 'et à la coco' ? S('Laissez refroidir avant d\'ajouter {0}.', I(x.ing[0]).le) : null,
          S('Conservez dans un bocal fermé jusqu\'à 2 semaines.'),
        ],
      });
    }
  }
}
// Oeufs du matin
const OEUFS_PDJ = [
  { nom: 'Oeufs brouillés à la ciboulette', prep: 'Ciselez la ciboulette.', mot: 'la ciboulette', ings: [['ciboulette', 1, 'botte']] },
  { nom: 'Oeufs brouillés au saumon fumé', prep: 'Coupez le saumon fumé en lanières.', mot: 'le saumon fumé', ings: [['saumon fumé', 2, 'tranche']] },
  { nom: 'Oeufs brouillés aux champignons', prep: 'Émincez les champignons et faites-les sauter 5 min à la poêle avec un peu de beurre.', mot: 'les champignons', ings: [['champignons', 150, 'g']] },
  { nom: 'Oeufs brouillés au fromage', prep: 'Râpez l\'emmental.', mot: 'l\'emmental', ings: [['emmental', 60, 'g']] },
  { nom: 'Oeufs brouillés aux tomates', prep: 'Coupez les tomates en petits dés.', mot: 'les tomates', ings: [['tomates', 2, 'u']] },
  { nom: 'Oeufs brouillés au bacon', prep: 'Faites griller le bacon 4 min à la poêle.', mot: 'le bacon', ings: [['bacon', 4, 'tranche']] },
  { nom: 'Oeufs brouillés à la feta et aux épinards', prep: 'Émiettez la feta et lavez les épinards.', mot: 'la feta et les épinards', ings: [['feta', 60, 'g'], ['pousses d\'épinards', 60, 'g']] },
];
for (const o of OEUFS_PDJ) {
  recette({
    nom: o.nom,
    cat: 'petit_dejeuner',
    temps: 10,
    diff: 1,
    pers: 2,
    ings: [['oeufs', 4, 'u'], ['beurre', 15, 'g'], ['pain', 2, 'tranche'], ...o.ings, ['sel', 0, 'qs'], ['poivre', 0, 'qs']],
    etapes: [
      S(o.prep),
      S('Battez les oeufs, salez et poivrez.'),
      S('Faites fondre le beurre à feu doux, versez les oeufs et remuez sans cesse avec une spatule jusqu\'à ce qu\'ils soient crémeux.'),
      S('Ajoutez {0} hors du feu et servez sur des tartines grillées.', o.mot),
    ],
  });
}
