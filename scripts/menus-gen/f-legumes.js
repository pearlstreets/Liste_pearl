// Soupes, veloutés, gratins, quiches, cakes salés, tartes feuilletées,
// omelettes, frittatas, poêlées et purées de légumes.

const { I, S, recette, SEL_POIVRE, ETAPE_ASSAISONNER } = require('./fabrique');
const { de, enumere } = require('./langue');

// ---------------------------------------------------------------- Soupes
// nom (clé ingrédient), g : grammes pour 4, cuisson (min), pdt : ajoute des
// pommes de terre pour l'onctuosité.
const LEG_SOUPE = [
  { n: 'courgettes', g: 900, c: 15, pdt: 1 },
  { n: 'carottes', g: 800, c: 25, pdt: 1 },
  { n: 'potiron', g: 1000, c: 20 },
  { n: 'butternut', g: 1000, c: 20 },
  { n: 'poireaux', g: 600, c: 20, pdt: 1 },
  { n: 'brocoli', g: 600, c: 15, pdt: 1 },
  { n: 'chou-fleur', g: 800, c: 20 },
  { n: 'épinards', g: 500, c: 10, pdt: 1 },
  { n: 'petits pois', g: 600, c: 12 },
  { n: 'patates douces', g: 800, c: 20 },
  { n: 'céleri-rave', g: 700, c: 25, pdt: 1 },
  { n: 'panais', g: 700, c: 25 },
  { n: 'champignons', g: 500, c: 15, pdt: 1 },
  { n: 'tomates', g: 1000, c: 20 },
  { n: 'navets', g: 700, c: 20, pdt: 1 },
  { n: 'fenouil', g: 600, c: 20, pdt: 1 },
  { n: 'asperges vertes', g: 600, c: 15, pdt: 1 },
  { n: 'betteraves', g: 600, c: 25, pdt: 1 },
];

const EXTRAS_SOUPE = [
  { nom: 'au curry', ings: [['curry', 2, 'cc']], etape: S('Ajoutez le curry en même temps que les légumes pour bien les parfumer.') },
  { nom: 'au cumin', ings: [['cumin', 1, 'cc']], etape: S('Ajoutez le cumin en même temps que les légumes.') },
  { nom: 'au lait de coco', ings: [['lait de coco', 20, 'cL']], sansCreme: 1, etape: S('Au moment de mixer, versez le lait de coco à la place de la crème.') },
  { nom: 'au gingembre', ings: [['gingembre', 20, 'g']], etape: S('Râpez le gingembre et faites-le revenir avec l\'oignon.') },
  { nom: 'au chèvre frais', ings: [['chèvre frais', 120, 'g']], sansCreme: 1, etape: S('Mixez la soupe avec la moitié du chèvre frais, émiettez le reste dans les bols.') },
  { nom: 'au parmesan', ings: [['parmesan', 50, 'g']], etape: S('Servez avec des copeaux de parmesan.') },
  { nom: 'aux noisettes', ings: [['noisettes', 40, 'g']], etape: S('Torréfiez les noisettes 3 min à sec dans une poêle, concassez-les et parsemez-en les bols.') },
  { nom: 'aux lardons', ings: [['lardons', 150, 'g']], etape: S('Faites griller les lardons à sec dans une poêle et ajoutez-les dans les bols au moment de servir.') },
  { nom: 'à la muscade', ings: [['muscade', 1, 'pincee']], etape: S('Râpez une pincée de muscade dans la soupe avant de mixer.') },
  { nom: 'à la coriandre', ings: [['coriandre', 1, 'botte']], etape: S('Ciselez la coriandre et parsemez-en les bols.') },
  { nom: 'au paprika fumé', ings: [['paprika', 1, 'cc']], etape: S('Ajoutez le paprika avec les légumes et saupoudrez-en un peu sur chaque bol.') },
  { nom: 'aux croûtons', ings: [['pain de mie', 4, 'tranche']], etape: S('Coupez le pain de mie en dés et faites-les dorer 5 min dans une poêle avec un filet d\'huile d\'olive. Servez avec la soupe.') },
];

function soupe(nom, legs, extra) {
  const pdt = legs.some((l) => l.pdt) && !legs.some((l) => l.n === 'pommes de terre');
  const cuisson = Math.max(...legs.map((l) => l.c));
  const creme = !(extra && extra.sansCreme);
  const ings = [
    ...legs.map((l) => [l.n, Math.round(l.g / legs.length / 50) * 50 * (legs.length > 1 ? 1.2 : 1), 'g']),
    ['oignons', 1, 'u'],
    ['huile d\'olive', 2, 'cs'],
    ['bouillon de légumes', 1, 'cube'],
    ...(pdt ? [['pommes de terre', 200, 'g']] : []),
    ...(creme ? [['crème liquide', 10, 'cL']] : []),
    ...(extra ? extra.ings : []),
    ...SEL_POIVRE,
  ].map(([n, q, u]) => [n, u === 'g' ? Math.round(q / 10) * 10 : q, u]);
  const mots = enumere(legs.map((l) => I(l.n).le));
  recette({
    nom,
    cat: 'soupes',
    temps: cuisson + 15,
    diff: 1,
    ings,
    etapes: [
      S('Lavez, épluchez si besoin, puis coupez {0} en morceaux. Émincez l\'oignon.', mots + (pdt ? ' et les pommes de terre' : '')),
      S('Dans une grande casserole, faites revenir l\'oignon 3 min dans l\'huile d\'olive, à feu moyen.'),
      S('Ajoutez les légumes, couvrez d\'eau à hauteur (environ 1 L) et émiettez le cube de bouillon.'),
      extra && /avec l'oignon|avec les légumes|en même temps/.test(extra.etape[0]) ? extra.etape : null,
      S('Laissez cuire {0} min à petits frémissements, jusqu\'à ce que les légumes soient bien tendres.', cuisson),
      S(creme ? 'Mixez finement en ajoutant la crème, puis rectifiez la consistance avec un peu d\'eau si besoin.' : 'Mixez finement, puis rectifiez la consistance avec un peu d\'eau si besoin.'),
      extra && !/avec l'oignon|avec les légumes|en même temps/.test(extra.etape[0]) ? extra.etape : null,
      ETAPE_ASSAISONNER,
    ],
  });
}

for (const l of LEG_SOUPE) {
  soupe(`Velouté ${de(l.n)}`, [l]);
  for (const e of EXTRAS_SOUPE) soupe(`Velouté ${de(l.n)} ${e.nom}`, [l], e);
}
// Soupes de deux légumes : tous les couples.
for (let a = 0; a < LEG_SOUPE.length; a++) {
  for (let b = a + 1; b < LEG_SOUPE.length; b++) {
    const A = LEG_SOUPE[a];
    const B = LEG_SOUPE[b];
    soupe(`Soupe ${de(A.n)} et ${de(B.n)}`, [A, B]);
  }
}

// ---------------------------------------------------------------- Gratins
const LEG_GRATIN = [
  { n: 'courgettes', g: 1000, prep: 'Coupez les courgettes en rondelles et faites-les revenir 8 min à la poêle pour qu\'elles rendent leur eau.' },
  { n: 'pommes de terre', g: 1200, prep: 'Épluchez les pommes de terre, coupez-les en fines rondelles et faites-les précuire 10 min dans l\'eau bouillante salée.' },
  { n: 'chou-fleur', g: 1000, prep: 'Détaillez le chou-fleur en bouquets et faites-les cuire 8 min dans l\'eau bouillante salée.' },
  { n: 'brocoli', g: 800, prep: 'Détaillez le brocoli en bouquets et faites-les cuire 6 min dans l\'eau bouillante salée.' },
  { n: 'potiron', g: 1000, prep: 'Épluchez le potiron, coupez-le en cubes et faites-le cuire 10 min à la vapeur.' },
  { n: 'butternut', g: 1000, prep: 'Épluchez la butternut, coupez-la en cubes et faites-la cuire 10 min à la vapeur.' },
  { n: 'poireaux', g: 800, prep: 'Émincez les poireaux et faites-les fondre 10 min à la poêle avec une noix de beurre.' },
  { n: 'endives', g: 800, prep: 'Coupez les endives en deux dans la longueur et faites-les braiser 15 min à la poêle avec une noix de beurre.' },
  { n: 'aubergines', g: 1000, prep: 'Coupez les aubergines en tranches et faites-les dorer 10 min à la poêle avec un peu d\'huile d\'olive.' },
  { n: 'patates douces', g: 1000, prep: 'Épluchez les patates douces, coupez-les en rondelles et faites-les précuire 8 min dans l\'eau bouillante salée.' },
  { n: 'épinards', g: 800, prep: 'Faites tomber les épinards 3 min à la poêle, puis pressez-les pour retirer l\'eau.' },
  { n: 'champignons', g: 700, prep: 'Émincez les champignons et faites-les sauter 8 min à la poêle jusqu\'à évaporation de leur eau.' },
  { n: 'céleri-rave', g: 900, prep: 'Épluchez le céleri-rave, coupez-le en fines tranches et faites-le précuire 10 min dans l\'eau bouillante salée.' },
  { n: 'fenouil', g: 900, prep: 'Coupez les bulbes de fenouil en lamelles et faites-les précuire 10 min dans l\'eau bouillante salée.' },
  { n: 'carottes', g: 900, prep: 'Épluchez les carottes, coupez-les en rondelles et faites-les précuire 10 min dans l\'eau bouillante salée.' },
  { n: 'navets', g: 900, prep: 'Épluchez les navets, coupez-les en fines tranches et faites-les précuire 10 min dans l\'eau bouillante salée.' },
];
const FROMAGES_GRATIN = ['comté', 'emmental', 'gruyère', 'parmesan', 'chèvre', 'reblochon', 'roquefort', 'mozzarella', 'cheddar', 'raclette'];
const VIANDES_GRATIN = [
  null,
  { nom: 'et au jambon', ings: [['jambon', 4, 'tranche']], etape: 'Coupez le jambon en lanières et répartissez-le entre les légumes.' },
  { nom: 'et aux lardons', ings: [['lardons', 200, 'g']], etape: 'Faites dorer les lardons à sec 5 min et répartissez-les entre les légumes.' },
  { nom: 'et au poulet', ings: [['blancs de poulet', 2, 'u']], etape: 'Coupez le poulet en dés, faites-le dorer 6 min à la poêle et répartissez-le entre les légumes.' },
];
for (const l of LEG_GRATIN) {
  for (const f of FROMAGES_GRATIN) {
    for (const v of VIANDES_GRATIN) {
      const qf = f === 'parmesan' ? 80 : f === 'roquefort' ? 120 : f === 'reblochon' ? 250 : 150;
      recette({
        nom: `Gratin ${de(l.n)} ${I(f).au} ${v ? v.nom : ''}`,
        cat: 'gratins',
        temps: 50,
        diff: 1,
        ings: [
          [l.n, l.g, 'g'],
          [f, qf, 'g'],
          ['crème liquide', 30, 'cL'],
          ['lait', 10, 'cL'],
          ['ail', 1, 'gousse'],
          ['beurre', 15, 'g'],
          ['muscade', 1, 'pincee'],
          ...(v ? v.ings : []),
          ...SEL_POIVRE,
        ],
        etapes: [
          S('Préchauffez le four à 190 °C. Frottez un plat à gratin avec la gousse d\'ail coupée en deux, puis beurrez-le.'),
          S(l.prep),
          v ? S(v.etape) : null,
          S('Disposez les légumes dans le plat. Mélangez la crème, le lait et la muscade, salez, poivrez et versez sur les légumes.'),
          S('Répartissez {0} sur le dessus.', I(f).le),
          S('Enfournez 25 à 30 min, jusqu\'à ce que le dessus soit bien doré. Servez chaud.'),
        ],
      });
    }
  }
}

// ---------------------------------------------------------------- Quiches, cakes, tartes
// t : type (viande, poisson, fromage, legume) · q : quantité · prep : préparation
const GARNITURES = [
  { n: 'lardons', t: 'viande', q: [200, 'g'], prep: 'Faites dorer les lardons 5 min à sec.' },
  { n: 'jambon', t: 'viande', q: [4, 'tranche'], prep: 'Coupez le jambon en dés.' },
  { n: 'chorizo', t: 'viande', q: [120, 'g'], prep: 'Coupez le chorizo en fines rondelles.' },
  { n: 'blancs de poulet', t: 'viande', q: [2, 'u'], prep: 'Coupez le poulet en dés et faites-le dorer 6 min à la poêle.' },
  { n: 'saumon fumé', t: 'poisson', q: [4, 'tranche'], prep: 'Coupez le saumon fumé en lanières.' },
  { n: 'thon en boîte', t: 'poisson', q: [2, 'boite'], prep: 'Égouttez le thon et émiettez-le.' },
  { n: 'crevettes', t: 'poisson', q: [200, 'g'], prep: 'Décortiquez les crevettes.' },
  { n: 'chèvre', t: 'fromage', q: [150, 'g'], prep: 'Coupez le chèvre en rondelles.' },
  { n: 'feta', t: 'fromage', q: [150, 'g'], prep: 'Émiettez la feta.' },
  { n: 'roquefort', t: 'fromage', q: [120, 'g'], prep: 'Émiettez le roquefort.' },
  { n: 'comté', t: 'fromage', q: [120, 'g'], prep: 'Râpez le comté.' },
  { n: 'mozzarella', t: 'fromage', q: [1, 'u'], prep: 'Coupez la mozzarella en dés et égouttez-la.' },
  { n: 'poireaux', t: 'legume', q: [500, 'g'], prep: 'Émincez les poireaux et faites-les fondre 10 min à la poêle avec une noix de beurre.' },
  { n: 'épinards', t: 'legume', q: [400, 'g'], prep: 'Faites tomber les épinards 3 min à la poêle et pressez-les pour retirer l\'eau.' },
  { n: 'tomates cerises', t: 'legume', q: [250, 'g'], prep: 'Coupez les tomates cerises en deux.' },
  { n: 'courgettes', t: 'legume', q: [400, 'g'], prep: 'Coupez les courgettes en dés et faites-les revenir 6 min à la poêle.' },
  { n: 'champignons', t: 'legume', q: [300, 'g'], prep: 'Émincez les champignons et faites-les sauter 6 min à la poêle.' },
  { n: 'brocoli', t: 'legume', q: [300, 'g'], prep: 'Détaillez le brocoli en petits bouquets et faites-les cuire 5 min à l\'eau bouillante.' },
  { n: 'oignons', t: 'legume', q: [3, 'u'], prep: 'Émincez les oignons et faites-les fondre 10 min à la poêle.' },
  { n: 'poivrons rouges', t: 'legume', q: [2, 'u'], prep: 'Coupez les poivrons en lanières et faites-les revenir 8 min à la poêle.' },
  { n: 'asperges vertes', t: 'legume', q: [300, 'g'], prep: 'Coupez les asperges en tronçons et faites-les cuire 5 min à l\'eau bouillante.' },
  { n: 'potiron', t: 'legume', q: [400, 'g'], prep: 'Coupez le potiron en dés et faites-le cuire 10 min à la vapeur.' },
  { n: 'olives noires', t: 'legume', q: [80, 'g'], prep: 'Dénoyautez et coupez les olives en deux.' },
  { n: 'tomates séchées', t: 'legume', q: [80, 'g'], prep: 'Coupez les tomates séchées en morceaux.' },
];
// Couples logiques : jamais deux viandes/poissons, jamais viande + poisson.
const PROT = new Set(['viande', 'poisson']);
const COUPLES = [];
for (let a = 0; a < GARNITURES.length; a++) {
  for (let b = a + 1; b < GARNITURES.length; b++) {
    const A = GARNITURES[a];
    const B = GARNITURES[b];
    if (PROT.has(A.t) && PROT.has(B.t)) continue;
    if (A.t === 'fromage' && B.t === 'fromage') continue;
    // Poisson et fromage fort : non.
    if ((A.t === 'poisson' && ['roquefort', 'comté'].includes(B.n)) || (B.t === 'poisson' && ['roquefort', 'comté'].includes(A.n))) continue;
    if (A.n === 'chorizo' && B.n === 'roquefort') continue;
    COUPLES.push([A, B]);
  }
}

function nomGarnitures(A, B) {
  return `${I(A.n).au} et ${I(B.n).au}`;
}

for (const [A, B] of COUPLES) {
  // Quiche
  recette({
    nom: `Quiche ${nomGarnitures(A, B)}`,
    cat: 'tartes_salees',
    temps: 55,
    diff: 2,
    pers: 6,
    ings: [
      ['pâte brisée', 1, 'rouleau'],
      ['oeufs', 3, 'u'],
      ['crème liquide', 20, 'cL'],
      ['lait', 10, 'cL'],
      [A.n, ...A.q],
      [B.n, ...B.q],
      ['muscade', 1, 'pincee'],
      ...SEL_POIVRE,
    ],
    etapes: [
      S('Préchauffez le four à 180 °C. Déroulez la pâte dans un moule à tarte et piquez le fond à la fourchette.'),
      S(A.prep),
      S(B.prep),
      S('Battez les oeufs avec la crème, le lait et la muscade. Salez légèrement et poivrez.'),
      S('Répartissez la garniture sur la pâte et versez l\'appareil par-dessus.'),
      S('Enfournez 35 min, jusqu\'à ce que la quiche soit dorée et prise au centre. Servez chaude ou tiède avec une salade.'),
    ],
  });
  // Cake salé
  recette({
    nom: `Cake salé ${nomGarnitures(A, B)}`,
    cat: 'aperitif',
    temps: 60,
    diff: 1,
    pers: 8,
    ings: [
      ['farine', 180, 'g'],
      ['levure chimique', 1, 'sachet'],
      ['oeufs', 3, 'u'],
      ['lait', 12, 'cL'],
      ['huile d\'olive', 10, 'cL'],
      ['emmental', 100, 'g'],
      [A.n, ...A.q],
      [B.n, ...B.q],
      ...SEL_POIVRE,
    ],
    etapes: [
      S('Préchauffez le four à 180 °C et chemisez un moule à cake de papier cuisson.'),
      S(A.prep),
      S(B.prep),
      S('Fouettez les oeufs, puis ajoutez la farine et la levure, le lait et l\'huile. Mélangez jusqu\'à obtenir une pâte lisse.'),
      S('Incorporez l\'emmental râpé et la garniture. Salez légèrement et poivrez.'),
      S('Versez dans le moule et enfournez 45 min : la lame d\'un couteau doit ressortir sèche. Laissez tiédir avant de démouler.'),
    ],
  });
  // Tarte feuilletée (sans crème, plus légère)
  recette({
    nom: `Tarte feuilletée ${nomGarnitures(A, B)}`,
    cat: 'tartes_salees',
    temps: 35,
    diff: 1,
    ings: [
      ['pâte feuilletée', 1, 'rouleau'],
      ['moutarde', 2, 'cs'],
      ['crème fraîche', 3, 'cs'],
      [A.n, ...A.q],
      [B.n, ...B.q],
      ['thym', 2, 'brin'],
      ...SEL_POIVRE,
    ],
    etapes: [
      S('Préchauffez le four à 200 °C. Déroulez la pâte feuilletée sur une plaque, avec son papier.'),
      S('Mélangez la moutarde et la crème fraîche, puis étalez-les sur la pâte en laissant 2 cm de bord.'),
      S(A.prep),
      S(B.prep),
      S('Répartissez la garniture, effeuillez le thym, salez légèrement et poivrez.'),
      S('Enfournez 20 à 25 min, jusqu\'à ce que la pâte soit bien dorée et gonflée.'),
    ],
  });
}

// ---------------------------------------------------------------- Omelettes et frittatas
const GARN_OEUFS = GARNITURES.filter((g) => !['thon en boîte', 'crevettes', 'olives noires', 'blancs de poulet'].includes(g.n));
function garnOeufs(liste, type) {
  const nom = type === 'omelette'
    ? `Omelette ${liste.map((g) => I(g.n).au).join(' et ')}`
    : `Frittata ${liste.map((g) => I(g.n).au).join(' et ')}`;
  const ings = [['oeufs', type === 'omelette' ? 8 : 8, 'u'], ...liste.map((g) => [g.n, ...g.q.map((x) => (typeof x === 'number' ? Math.max(1, Math.round(x * 0.7)) : x))]), ['beurre', 20, 'g'], ['ciboulette', 1, 'botte'], ...SEL_POIVRE];
  if (type === 'frittata') ings.push(['parmesan', 40, 'g'], ['huile d\'olive', 2, 'cs']);
  recette({
    nom,
    cat: 'oeufs',
    temps: type === 'omelette' ? 15 : 30,
    diff: 1,
    ings,
    etapes: type === 'omelette'
      ? [
          ...liste.map((g) => S(g.prep)),
          S('Battez les oeufs avec la ciboulette ciselée, salez et poivrez.'),
          S('Faites fondre le beurre dans une grande poêle, versez les oeufs et laissez prendre 2 min à feu moyen en ramenant les bords vers le centre.'),
          S('Répartissez la garniture sur une moitié, pliez l\'omelette et servez aussitôt, encore baveuse au centre.'),
        ]
      : [
          S('Préchauffez le four à 180 °C.'),
          ...liste.map((g) => S(g.prep)),
          S('Battez les oeufs avec le parmesan râpé et la ciboulette ciselée, salez et poivrez.'),
          S('Dans une poêle allant au four, chauffez l\'huile d\'olive, ajoutez la garniture puis versez les oeufs. Laissez prendre 4 min à feu doux.'),
          S('Terminez la cuisson 12 min au four. Servez chaud ou froid, coupé en parts.'),
        ],
  });
}
for (const g of GARN_OEUFS) {
  garnOeufs([g], 'omelette');
  garnOeufs([g], 'frittata');
}
for (let a = 0; a < GARN_OEUFS.length; a++) {
  for (let b = a + 1; b < GARN_OEUFS.length; b++) {
    const A = GARN_OEUFS[a];
    const B = GARN_OEUFS[b];
    if (PROT.has(A.t) && PROT.has(B.t)) continue;
    if (A.t === 'fromage' && B.t === 'fromage') continue;
    if ((A.t === 'poisson' && ['roquefort', 'comté'].includes(B.n)) || (B.t === 'poisson' && ['roquefort', 'comté'].includes(A.n))) continue;
    garnOeufs([A, B], 'omelette');
    garnOeufs([A, B], 'frittata');
  }
}

// ---------------------------------------------------------------- Poêlées, légumes rôtis, purées
const LEG_POELE = [
  { n: 'courgettes', g: 500 }, { n: 'aubergines', g: 500 }, { n: 'poivrons rouges', q: 2 }, { n: 'poivrons jaunes', q: 2 },
  { n: 'carottes', g: 500 }, { n: 'champignons', g: 400 }, { n: 'haricots verts', g: 400 }, { n: 'brocoli', g: 500 },
  { n: 'chou-fleur', g: 500 }, { n: 'pommes de terre', g: 600 }, { n: 'patates douces', g: 600 }, { n: 'oignons rouges', q: 2 },
  { n: 'tomates cerises', g: 300 }, { n: 'petits pois', g: 300 }, { n: 'poireaux', g: 400 }, { n: 'fenouil', g: 400 },
  { n: 'butternut', g: 600 }, { n: 'panais', g: 500 }, { n: 'choux de Bruxelles', g: 500 }, { n: 'asperges vertes', g: 400 },
];
const qLeg = (l, k = 1) => (l.q ? [l.n, l.q, 'u'] : [l.n, Math.round((l.g * k) / 50) * 50, 'g']);
for (let a = 0; a < LEG_POELE.length; a++) {
  for (let b = a + 1; b < LEG_POELE.length; b++) {
    const A = LEG_POELE[a];
    const B = LEG_POELE[b];
    const mots = `${I(A.n).le} et ${I(B.n).le}`;
    recette({
      nom: `Poêlée ${de(A.n)} et ${de(B.n)}`,
      cat: 'accompagnements',
      temps: 25,
      diff: 1,
      ings: [qLeg(A, 0.8), qLeg(B, 0.8), ['ail', 2, 'gousse'], ['huile d\'olive', 3, 'cs'], ['persil', 1, 'botte'], ...SEL_POIVRE],
      etapes: [
        S('Lavez et coupez {0} en morceaux de taille égale.', mots),
        S('Chauffez l\'huile d\'olive dans une grande poêle ou un wok à feu vif.'),
        S('Faites sauter les légumes 12 à 15 min en remuant souvent : ils doivent rester légèrement croquants.'),
        S('Ajoutez l\'ail haché et le persil ciselé en fin de cuisson, mélangez 1 min.'),
        ETAPE_ASSAISONNER,
      ],
    });
    recette({
      nom: `${A.n} et ${B.n} au four, thym et ail`,
      cat: 'accompagnements',
      temps: 45,
      diff: 1,
      ings: [qLeg(A), qLeg(B), ['huile d\'olive', 4, 'cs'], ['thym', 4, 'brin'], ['ail', 3, 'gousse'], ...SEL_POIVRE],
      etapes: [
        S('Préchauffez le four à 210 °C.'),
        S('Lavez et coupez {0} en gros morceaux.', mots),
        S('Étalez-les sur une plaque avec les gousses d\'ail en chemise, arrosez d\'huile d\'olive, ajoutez le thym, salez et poivrez. Mélangez avec les mains.'),
        S('Enfournez 30 à 35 min en retournant à mi-cuisson, jusqu\'à ce que les légumes soient tendres et caramélisés.'),
      ],
    });
  }
}

const RACINES = ['pommes de terre', 'carottes', 'patates douces', 'céleri-rave', 'panais', 'potiron', 'butternut', 'navets', 'chou-fleur', 'brocoli', 'petits pois'];
for (let a = 0; a < RACINES.length; a++) {
  for (let b = a; b < RACINES.length; b++) {
    const A = RACINES[a];
    const B = RACINES[b];
    const seul = a === b;
    recette({
      nom: seul ? `Purée ${de(A)}` : `Purée ${de(A)} et ${de(B)}`,
      cat: 'accompagnements',
      temps: 35,
      diff: 1,
      ings: [
        ...(seul ? [[A, 1000, 'g']] : [[A, 500, 'g'], [B, 500, 'g']]),
        ['beurre', 40, 'g'],
        ['lait', 15, 'cL'],
        ['muscade', 1, 'pincee'],
        ...SEL_POIVRE,
      ],
      etapes: [
        S('Épluchez et coupez {0} en morceaux.', seul ? I(A).le : `${I(A).le} et ${I(B).le}`),
        S('Faites-les cuire 20 à 25 min dans l\'eau bouillante salée, jusqu\'à ce que la pointe d\'un couteau s\'y enfonce sans résistance.'),
        S('Égouttez, puis écrasez au presse-purée avec le beurre et le lait chaud, petit à petit.'),
        S('Ajoutez la muscade. Salez, poivrez et servez bien chaud.'),
      ],
    });
  }
}
