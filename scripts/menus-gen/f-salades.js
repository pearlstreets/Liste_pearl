// Salades composées, bowls, wraps, burgers, pizzas, bruschettas,
// brochettes, tartinades, sauces et vinaigrettes, tajines.

const { I, S, recette, SEL_POIVRE } = require('./fabrique');
const { de, enumere } = require('./langue');

// ---------------------------------------------------------------- Salades composées
const BASES_SALADE = [
  { nom: 'Salade de riz', ings: [['riz', 250, 'g']], cuit: 'Faites cuire le riz selon le paquet, rincez-le à l\'eau froide et égouttez-le.' },
  { nom: 'Salade de pâtes', ings: [['fusilli', 300, 'g']], cuit: 'Faites cuire les pâtes al dente, rincez-les à l\'eau froide et égouttez-les.' },
  { nom: 'Salade de lentilles', ings: [['lentilles vertes', 250, 'g'], ['échalotes', 1, 'u']], cuit: 'Faites cuire les lentilles 25 min à l\'eau non salée, égouttez-les et laissez tiédir.' },
  { nom: 'Salade de quinoa', ings: [['quinoa', 250, 'g']], cuit: 'Rincez le quinoa, faites-le cuire 12 min dans deux fois son volume d\'eau salée et laissez refroidir.' },
  { nom: 'Taboulé', ings: [['semoule', 250, 'g'], ['menthe', 1, 'botte'], ['persil', 1, 'botte']], cuit: 'Faites gonfler la semoule avec le même volume d\'eau bouillante salée 5 min, égrainez-la, puis ajoutez la menthe et le persil ciselés.' },
  { nom: 'Salade de boulgour', ings: [['boulgour', 250, 'g']], cuit: 'Faites cuire le boulgour 12 min à l\'eau salée, égouttez-le et laissez refroidir.' },
  { nom: 'Salade de pommes de terre', ings: [['pommes de terre', 800, 'g'], ['ciboulette', 1, 'botte']], cuit: 'Faites cuire les pommes de terre 20 min à l\'eau salée, épluchez-les tièdes et coupez-les en rondelles.' },
  { nom: 'Salade de pois chiches', ings: [['pois chiches', 2, 'boite'], ['oignons rouges', 1, 'u']], cuit: 'Rincez et égouttez les pois chiches. Émincez finement l\'oignon rouge.' },
  { nom: 'Salade verte composée', ings: [['salade verte', 1, 'u']], cuit: 'Lavez, essorez et déchirez la salade en morceaux.' },
  { nom: 'Salade de roquette', ings: [['roquette', 150, 'g']], cuit: 'Rincez et essorez la roquette.' },
];
const PROT_SALADE = [
  { au: 'au poulet', ings: [['blancs de poulet', 2, 'u']], prep: 'Faites dorer le poulet 6 min par face, laissez tiédir et coupez-le en lamelles.' },
  { au: 'au thon', ings: [['thon en boîte', 2, 'boite']], prep: 'Égouttez et émiettez le thon.' },
  { au: 'au saumon fumé', ings: [['saumon fumé', 4, 'tranche']], prep: 'Coupez le saumon fumé en lanières.' },
  { au: 'à la feta', ings: [['feta', 200, 'g']], prep: 'Coupez la feta en dés.' },
  { au: 'à la mozzarella', ings: [['mozzarella', 1, 'u']], prep: 'Coupez la mozzarella en dés et égouttez-la.' },
  { au: 'aux oeufs durs', ings: [['oeufs', 4, 'u']], prep: 'Faites cuire les oeufs 10 min à l\'eau bouillante, écalez-les et coupez-les en quartiers.' },
  { au: 'au chèvre', ings: [['chèvre', 150, 'g']], prep: 'Coupez le chèvre en rondelles.' },
  { au: 'aux crevettes', ings: [['crevettes', 300, 'g']], prep: 'Décortiquez les crevettes.' },
  { au: 'au jambon', ings: [['jambon', 4, 'tranche']], prep: 'Coupez le jambon en lanières.' },
  { au: 'au halloumi', ings: [['halloumi', 250, 'g']], prep: 'Coupez le halloumi en tranches et faites-le griller 2 min par face à sec.' },
  { au: 'au tofu fumé', ings: [['tofu fumé', 200, 'g']], prep: 'Coupez le tofu fumé en dés et faites-le dorer 5 min à la poêle.' },
];
const EXTRAS_SALADE = [
  { mots: 'tomates cerises et concombre', ings: [['tomates cerises', 250, 'g'], ['concombre', 1, 'u']] },
  { mots: 'avocat et maïs', ings: [['avocats', 2, 'u'], ['maïs', 150, 'g']] },
  { mots: 'poivrons et olives', ings: [['poivrons rouges', 1, 'u'], ['olives noires', 60, 'g']] },
  { mots: 'radis et ciboulette', ings: [['radis', 1, 'botte'], ['ciboulette', 1, 'botte']] },
  { mots: 'betterave et noix', ings: [['betteraves', 2, 'u'], ['noix', 50, 'g']] },
  { mots: 'tomates séchées et roquette', ings: [['tomates séchées', 80, 'g'], ['roquette', 50, 'g']] },
  { mots: 'pomme et céleri', ings: [['pommes', 1, 'u'], ['céleri branche', 2, 'u']] },
  { mots: 'carottes râpées et raisins secs', ings: [['carottes', 2, 'u'], ['raisins secs', 40, 'g']] },
];
const VINAIGRETTE = [['huile d\'olive', 5, 'cs'], ['vinaigre de vin', 2, 'cs'], ['moutarde', 1, 'cc']];
for (const b of BASES_SALADE) {
  for (const p of PROT_SALADE) {
    for (const e of EXTRAS_SALADE) {
      if (b.nom === 'Salade de roquette' && e.mots.includes('roquette')) continue;
      recette({
        nom: `${b.nom} ${p.au}, ${e.mots}`,
        cat: 'salades',
        temps: 25,
        diff: 1,
        ings: [...b.ings, ...p.ings, ...e.ings, ...VINAIGRETTE, ...SEL_POIVRE],
        etapes: [
          S(b.cuit),
          S(p.prep),
          S('Lavez et coupez en petits morceaux : {0}.', e.mots),
          S('Préparez la vinaigrette en fouettant la moutarde, le vinaigre et l\'huile d\'olive. Salez et poivrez.'),
          S('Mélangez tous les ingrédients avec la vinaigrette juste avant de servir.'),
        ],
      });
    }
  }
}

// ---------------------------------------------------------------- Bowls
const BASES_BOWL = [
  { mot: 'riz', ings: [['riz', 250, 'g']], cuit: 'Faites cuire le riz selon le paquet.' },
  { mot: 'quinoa', ings: [['quinoa', 250, 'g']], cuit: 'Faites cuire le quinoa 12 min dans deux fois son volume d\'eau salée.' },
  { mot: 'boulgour', ings: [['boulgour', 250, 'g']], cuit: 'Faites cuire le boulgour 12 min à l\'eau salée.' },
  { mot: 'nouilles de riz', ings: [['nouilles de riz', 250, 'g']], cuit: 'Faites tremper les nouilles de riz dans l\'eau bouillante selon le paquet, puis rincez-les à l\'eau froide.' },
];
const PROT_BOWL = [
  { mot: 'poulet', ings: [['blancs de poulet', 2, 'u']], prep: 'Faites dorer le poulet 6 min par face et coupez-le en tranches.' },
  { mot: 'saumon', ings: [['pavés de saumon', 2, 'u']], prep: 'Faites cuire le saumon 4 min par face à la poêle et effeuillez-le.' },
  { mot: 'tofu', ings: [['tofu', 300, 'g']], prep: 'Coupez le tofu en cubes et faites-le dorer 8 min à la poêle.' },
  { mot: 'crevettes', ings: [['crevettes', 300, 'g']], prep: 'Faites sauter les crevettes décortiquées 3 min.' },
  { mot: 'pois chiches rôtis', ings: [['pois chiches', 1, 'boite'], ['paprika', 1, 'cc']], prep: 'Égouttez les pois chiches, mélangez-les avec le paprika et un filet d\'huile et faites-les rôtir 20 min à 200 °C.' },
  { mot: 'oeuf mollet', ings: [['oeufs', 4, 'u']], prep: 'Faites cuire les oeufs 6 min à l\'eau bouillante, plongez-les dans l\'eau froide et écalez-les.' },
  { mot: 'thon mi-cuit', ings: [['steaks de thon', 2, 'u'], ['graines de sésame', 2, 'cs']], prep: 'Enrobez le thon de sésame et saisissez-le 1 min par face, puis tranchez-le.' },
];
const LEG_BOWL = [
  { mots: 'avocat, concombre et radis', ings: [['avocats', 2, 'u'], ['concombre', 1, 'u'], ['radis', 1, 'botte']] },
  { mots: 'patate douce rôtie et chou rouge', ings: [['patates douces', 2, 'u'], ['chou rouge', 200, 'g']] },
  { mots: 'carottes, edamame et mangue', ings: [['carottes', 2, 'u'], ['fèves', 150, 'g'], ['mangues', 1, 'u']] },
  { mots: 'brocoli, épinards et avocat', ings: [['brocoli', 300, 'g'], ['pousses d\'épinards', 100, 'g'], ['avocats', 1, 'u']] },
  { mots: 'tomates cerises, concombre et feta', ings: [['tomates cerises', 250, 'g'], ['concombre', 1, 'u'], ['feta', 150, 'g']] },
  { mots: 'maïs, haricots rouges et avocat', ings: [['maïs', 150, 'g'], ['haricots rouges', 1, 'boite'], ['avocats', 1, 'u']] },
  { mots: 'butternut rôtie et roquette', ings: [['butternut', 600, 'g'], ['roquette', 80, 'g']] },
  { mots: 'chou chinois, carottes et coriandre', ings: [['chou chinois', 300, 'g'], ['carottes', 2, 'u'], ['coriandre', 1, 'botte']] },
];
const SAUCES_BOWL = [
  { mot: 'tahini', ings: [['tahini', 3, 'cs'], ['citrons', 1, 'u']], mix: 'Mélangez le tahini, le jus du citron et 4 c. à soupe d\'eau jusqu\'à obtenir une sauce lisse.' },
  { mot: 'soja et sésame', ings: [['sauce soja', 3, 'cs'], ['huile de sésame', 1, 'cs'], ['miel', 1, 'cc']], mix: 'Mélangez la sauce soja, l\'huile de sésame et le miel.' },
  { mot: 'yaourt et citron', ings: [['yaourt grec', 1, 'u'], ['citrons', 1, 'u'], ['menthe', 1, 'botte']], mix: 'Mélangez le yaourt avec le jus du citron et la menthe ciselée.' },
  { mot: 'cacahuète', ings: [['beurre de cacahuète', 2, 'cs'], ['sauce soja', 2, 'cs'], ['citrons verts', 1, 'u']], mix: 'Mélangez le beurre de cacahuète, la sauce soja, le jus du citron vert et un peu d\'eau chaude.' },
];
for (const b of BASES_BOWL) {
  for (const p of PROT_BOWL) {
    for (const l of LEG_BOWL) {
      for (const s of SAUCES_BOWL) {
        if (p.mot === 'oeuf mollet' && b.mot === 'nouilles de riz' && s.mot === 'yaourt et citron') continue;
        const rotie = /rôtie/.test(l.mots);
        recette({
          nom: `Bowl ${b.mot}, ${p.mot}, ${l.mots}, sauce ${s.mot}`,
          cat: 'bowls',
          temps: rotie || p.mot === 'pois chiches rôtis' ? 40 : 25,
          diff: 1,
          ings: [...b.ings, ...p.ings, ...l.ings, ...s.ings, ['huile d\'olive', 2, 'cs'], ...SEL_POIVRE],
          etapes: [
            S(b.cuit),
            rotie ? S('Coupez la courge ou la patate douce en cubes et faites-la rôtir 25 min à 200 °C avec l\'huile d\'olive.') : null,
            S(p.prep),
            S('Préparez les légumes ({0}) : lavez-les, égouttez ceux en conserve et coupez le reste en tranches fines.', l.mots),
            S(s.mix),
            S('Répartissez la base dans 4 bols, disposez joliment les légumes et la garniture par-dessus, et arrosez de sauce.'),
          ],
        });
      }
    }
  }
}

// ---------------------------------------------------------------- Wraps et burgers
const GARN_WRAP = [
  { mot: 'au poulet', ings: [['blancs de poulet', 2, 'u']], prep: 'Faites dorer le poulet en lamelles 6 min à la poêle.' },
  { mot: 'au saumon fumé', ings: [['saumon fumé', 4, 'tranche'], ['cream cheese', 100, 'g']], prep: 'Tartinez les tortillas de cream cheese et ajoutez le saumon.' },
  { mot: 'au thon', ings: [['thon en boîte', 2, 'boite'], ['mayonnaise', 2, 'cs']], prep: 'Mélangez le thon émietté avec la mayonnaise.' },
  { mot: 'au boeuf haché épicé', ings: [['boeuf haché', 400, 'g'], ['cumin', 1, 'cc'], ['paprika', 1, 'cc']], prep: 'Faites dorer le boeuf avec le cumin et le paprika 8 min.' },
  { mot: 'au falafel de pois chiches', ings: [['pois chiches', 2, 'boite'], ['farine', 2, 'cs'], ['cumin', 1, 'cc'], ['persil', 1, 'botte']], prep: 'Mixez les pois chiches égouttés avec la farine, le cumin et le persil, formez des galettes et faites-les dorer 3 min par face.' },
  { mot: 'au halloumi', ings: [['halloumi', 250, 'g']], prep: 'Faites griller le halloumi en tranches 2 min par face.' },
  { mot: 'à la dinde et au bacon', ings: [['escalopes de dinde', 2, 'u'], ['bacon', 4, 'tranche']], prep: 'Faites dorer la dinde en lamelles et le bacon 6 min à la poêle.' },
  { mot: 'aux crevettes', ings: [['crevettes', 300, 'g']], prep: 'Faites sauter les crevettes décortiquées 3 min.' },
];
const LEG_WRAP = [
  { mots: 'crudités et sauce yaourt', ings: [['laitue', 1, 'u'], ['tomates', 2, 'u'], ['concombre', 1, 'u'], ['yaourt grec', 1, 'u']] },
  { mots: 'avocat et salsa', ings: [['avocats', 2, 'u'], ['tomates', 2, 'u'], ['oignons rouges', 1, 'u'], ['citrons verts', 1, 'u']] },
  { mots: 'carottes, chou rouge et sauce cacahuète', ings: [['carottes', 2, 'u'], ['chou rouge', 150, 'g'], ['beurre de cacahuète', 2, 'cs']] },
  { mots: 'poivrons grillés et fromage', ings: [['poivrons rouges', 2, 'u'], ['cheddar', 100, 'g']] },
  { mots: 'roquette, tomates séchées et pesto', ings: [['roquette', 60, 'g'], ['tomates séchées', 60, 'g'], ['pesto', 3, 'cs']] },
  { mots: 'concombre et tzatziki', ings: [['concombre', 1, 'u'], ['yaourt grec', 1, 'u'], ['ail', 1, 'gousse'], ['menthe', 1, 'botte']] },
];
for (const g of GARN_WRAP) {
  for (const l of LEG_WRAP) {
    recette({
      nom: `Wraps ${g.mot}, ${l.mots}`,
      cat: 'sandwichs',
      temps: 20,
      diff: 1,
      ings: [['tortillas', 4, 'u'], ...g.ings, ...l.ings, ...SEL_POIVRE],
      etapes: [
        S(g.prep),
        S('Préparez {0} : lavez et émincez les légumes, mélangez la sauce.', l.mots),
        S('Réchauffez les tortillas 30 s à la poêle.'),
        S('Garnissez chaque tortilla, roulez-la bien serrée en repliant les bords et coupez-la en deux.'),
      ],
    });
  }
}

const BURGERS = [
  { nom: 'Burger classique au cheddar', ings: [['boeuf haché', 600, 'g'], ['cheddar', 4, 'tranche'], ['tomates', 1, 'u'], ['laitue', 1, 'u'], ['oignons rouges', 1, 'u'], ['cornichons', 4, 'u'], ['ketchup', 2, 'cs'], ['moutarde', 1, 'cs']] },
  { nom: 'Burger au bacon et au cheddar', ings: [['boeuf haché', 600, 'g'], ['bacon', 8, 'tranche'], ['cheddar', 4, 'tranche'], ['laitue', 1, 'u'], ['sauce barbecue', 4, 'cs']] },
  { nom: 'Burger au chèvre et au miel', ings: [['boeuf haché', 600, 'g'], ['chèvre', 150, 'g'], ['miel', 2, 'cs'], ['roquette', 60, 'g'], ['oignons rouges', 1, 'u']] },
  { nom: 'Burger au reblochon', ings: [['boeuf haché', 600, 'g'], ['reblochon', 1, 'u'], ['lardons', 100, 'g'], ['oignons', 2, 'u'], ['laitue', 1, 'u']] },
  { nom: 'Burger au poulet croustillant', ings: [['blancs de poulet', 4, 'u'], ['chapelure', 100, 'g'], ['oeufs', 1, 'u'], ['farine', 50, 'g'], ['laitue', 1, 'u'], ['mayonnaise', 4, 'cs']] },
  { nom: 'Burger végétarien aux pois chiches', ings: [['pois chiches', 2, 'boite'], ['oignons', 1, 'u'], ['chapelure', 60, 'g'], ['cumin', 1, 'cc'], ['avocats', 1, 'u'], ['tomates', 1, 'u']] },
  { nom: 'Burger au saumon et à l\'aneth', ings: [['pavés de saumon', 4, 'u'], ['aneth', 1, 'botte'], ['concombre', 1, 'u'], ['cream cheese', 100, 'g']] },
  { nom: 'Burger au bleu et aux oignons confits', ings: [['boeuf haché', 600, 'g'], ['roquefort', 100, 'g'], ['oignons', 3, 'u'], ['sucre roux', 1, 'cs'], ['roquette', 50, 'g']] },
  { nom: 'Burger de dinde à la mexicaine', ings: [['escalopes de dinde', 4, 'u'], ['avocats', 1, 'u'], ['piments', 1, 'u'], ['cheddar', 4, 'tranche'], ['tomates', 1, 'u']] },
  { nom: 'Burger au halloumi et aux légumes grillés', ings: [['halloumi', 250, 'g'], ['courgettes', 1, 'u'], ['poivrons rouges', 1, 'u'], ['pesto', 3, 'cs']] },
];
for (const b of BURGERS) {
  const steak = b.ings[0][0];
  recette({
    nom: b.nom,
    cat: 'sandwichs',
    temps: 30,
    diff: 1,
    ings: [['pains à burger', 4, 'u'], ...b.ings, ['huile', 1, 'cs'], ...SEL_POIVRE],
    etapes: [
      steak === 'boeuf haché'
        ? S('Formez 4 steaks avec le boeuf haché, salez et poivrez.')
        : steak === 'pois chiches'
          ? S('Mixez les pois chiches égouttés avec l\'oignon, la chapelure et le cumin, puis formez 4 galettes.')
          : steak === 'blancs de poulet'
            ? S('Aplatissez les blancs de poulet, passez-les dans la farine, l\'oeuf battu puis la chapelure.')
            : S('Préparez {0} en 4 parts.', I(steak).le),
      S('Faites cuire les steaks ou galettes 3 à 5 min par face dans une poêle chaude avec l\'huile.'),
      S('Pendant ce temps, préparez la garniture : lavez la salade, tranchez les légumes et faites cuire ce qui doit l\'être.'),
      S('Toastez les pains coupés en deux, puis montez les burgers : sauce, salade, steak, fromage et garniture.'),
    ],
  });
}

// ---------------------------------------------------------------- Pizzas
const GARN_PIZZA = [
  ['jambon', 4, 'tranche'], ['champignons', 200, 'g'], ['chorizo', 100, 'g'], ['poivrons rouges', 1, 'u'], ['olives noires', 60, 'g'],
  ['chèvre', 120, 'g'], ['oignons rouges', 1, 'u'], ['thon en boîte', 1, 'boite'], ['lardons', 150, 'g'], ['aubergines', 1, 'u'],
  ['courgettes', 1, 'u'], ['roquette', 50, 'g'], ['jambon cru', 4, 'tranche'], ['gorgonzola', 100, 'g'], ['tomates cerises', 200, 'g'],
  ['merguez', 3, 'u'], ['saumon fumé', 3, 'tranche'], ['artichauts', 4, 'u'], ['pommes de terre', 300, 'g'], ['miel', 1, 'cs'],
];
const MAUVAIS_PIZZA = [
  ['thon en boîte', 'chorizo'], ['thon en boîte', 'lardons'], ['thon en boîte', 'merguez'], ['thon en boîte', 'jambon'], ['thon en boîte', 'jambon cru'], ['thon en boîte', 'gorgonzola'], ['thon en boîte', 'saumon fumé'], ['thon en boîte', 'miel'],
  ['saumon fumé', 'chorizo'], ['saumon fumé', 'lardons'], ['saumon fumé', 'merguez'], ['saumon fumé', 'jambon'], ['saumon fumé', 'jambon cru'], ['saumon fumé', 'gorgonzola'], ['saumon fumé', 'olives noires'], ['saumon fumé', 'miel'], ['saumon fumé', 'aubergines'],
  ['chorizo', 'merguez'], ['chorizo', 'jambon'], ['chorizo', 'jambon cru'], ['chorizo', 'lardons'], ['lardons', 'jambon'], ['lardons', 'jambon cru'], ['lardons', 'merguez'], ['jambon', 'jambon cru'], ['merguez', 'jambon'], ['merguez', 'jambon cru'],
  ['miel', 'olives noires'], ['miel', 'merguez'], ['miel', 'chorizo'], ['miel', 'champignons'], ['miel', 'poivrons rouges'], ['miel', 'aubergines'], ['miel', 'courgettes'], ['miel', 'artichauts'], ['miel', 'tomates cerises'], ['miel', 'pommes de terre'], ['miel', 'oignons rouges'],
  ['gorgonzola', 'merguez'], ['chèvre', 'gorgonzola'],
];
const mauvais = (a, b) => MAUVAIS_PIZZA.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
for (const base of ['tomate', 'crème']) {
  for (let a = 0; a < GARN_PIZZA.length; a++) {
    for (let b = a + 1; b < GARN_PIZZA.length; b++) {
      const A = GARN_PIZZA[a];
      const B = GARN_PIZZA[b];
      if (mauvais(A[0], B[0])) continue;
      if (base === 'crème' && (A[0] === 'merguez' || B[0] === 'merguez')) continue;
      if (base === 'tomate' && (A[0] === 'miel' || B[0] === 'miel' || A[0] === 'pommes de terre' || B[0] === 'pommes de terre')) continue;
      const nomA = A[0] === 'thon en boîte' ? 'thon' : A[0];
      const nomB = B[0] === 'thon en boîte' ? 'thon' : B[0];
      recette({
        nom: `Pizza ${base === 'crème' ? 'blanche ' : ''}${nomA}, ${nomB} et mozzarella`,
        cat: 'pizzas',
        temps: 30,
        diff: 1,
        ings: [
          ['pâte à pizza', 1, 'u'],
          ...(base === 'tomate' ? [['coulis de tomates', 20, 'cL']] : [['crème fraîche', 15, 'cL']]),
          ['mozzarella', 1, 'u'], A, B, ['huile d\'olive', 2, 'cs'], ['herbes de Provence', 1, 'cc'], ...SEL_POIVRE,
        ],
        etapes: [
          S('Préchauffez le four à 240 °C, chaleur tournante si possible.'),
          S('Étalez la pâte sur une plaque recouverte de papier cuisson.'),
          S(base === 'tomate' ? 'Étalez le coulis de tomates en laissant 1 cm de bord, salez et ajoutez les herbes.' : 'Étalez la crème fraîche en laissant 1 cm de bord, salez, poivrez.'),
          S('Préparez la garniture : {0} et {1}, coupés en morceaux ou en tranches fines.', nomA, nomB),
          S('Répartissez la mozzarella en morceaux puis la garniture{0}. Arrosez d\'un filet d\'huile d\'olive.', [A[0], B[0]].some((x) => ['roquette', 'jambon cru'].includes(x)) ? ' (gardez la roquette et le jambon cru pour la sortie du four)' : ''),
          S('Enfournez 12 à 15 min, jusqu\'à ce que la pâte soit dorée et le fromage fondu.'),
        ],
      });
    }
  }
}

// ---------------------------------------------------------------- Bruschettas et tartines
const TARTINES = [
  { mots: 'tomates, basilic et mozzarella', ings: [['tomates', 3, 'u'], ['basilic', 1, 'botte'], ['mozzarella', 1, 'u']] },
  { mots: 'avocat, citron et piment', ings: [['avocats', 2, 'u'], ['citrons verts', 1, 'u'], ['piment d\'Espelette', 1, 'pincee']] },
  { mots: 'chèvre, miel et noix', ings: [['chèvre', 150, 'g'], ['miel', 2, 'cs'], ['noix', 40, 'g']] },
  { mots: 'saumon fumé et fromage frais', ings: [['saumon fumé', 4, 'tranche'], ['cream cheese', 150, 'g'], ['aneth', 1, 'botte']] },
  { mots: 'champignons et ail', ings: [['champignons', 300, 'g'], ['ail', 2, 'gousse'], ['persil', 1, 'botte']] },
  { mots: 'ricotta, figues et jambon cru', ings: [['ricotta', 200, 'g'], ['figues', 4, 'u'], ['jambon cru', 4, 'tranche']] },
  { mots: 'poivrons grillés et feta', ings: [['poivrons rouges', 2, 'u'], ['feta', 150, 'g']] },
  { mots: 'houmous et légumes croquants', ings: [['pois chiches', 1, 'boite'], ['tahini', 2, 'cs'], ['radis', 1, 'botte'], ['concombre', 1, 'u']] },
  { mots: 'oeuf, avocat et graines', ings: [['oeufs', 4, 'u'], ['avocats', 2, 'u'], ['graines de sésame', 1, 'cs']] },
  { mots: 'tapenade et tomates cerises', ings: [['olives noires', 150, 'g'], ['câpres', 1, 'cs'], ['tomates cerises', 200, 'g']] },
  { mots: 'burrata, roquette et tomates', ings: [['burrata', 1, 'u'], ['roquette', 50, 'g'], ['tomates cerises', 200, 'g']] },
  { mots: 'thon, câpres et citron', ings: [['thon en boîte', 1, 'boite'], ['câpres', 1, 'cs'], ['citrons', 1, 'u'], ['mayonnaise', 1, 'cs']] },
  { mots: 'brie, pomme et miel', ings: [['brie', 200, 'g'], ['pommes', 1, 'u'], ['miel', 1, 'cs']] },
  { mots: 'aubergine grillée et menthe', ings: [['aubergines', 1, 'u'], ['menthe', 1, 'botte'], ['yaourt grec', 1, 'u']] },
  { mots: 'petits pois, menthe et feta', ings: [['petits pois', 250, 'g'], ['menthe', 1, 'botte'], ['feta', 100, 'g']] },
];
const PAINS = [
  { nom: 'Bruschettas', ings: [['baguette', 1, 'u']], prep: 'Coupez la baguette en tranches, frottez-les d\'ail et faites-les griller 5 min au four à 200 °C avec un filet d\'huile d\'olive.', cat: 'aperitif' },
  { nom: 'Tartines', ings: [['pain', 4, 'tranche']], prep: 'Faites griller les tranches de pain de campagne.', cat: 'sandwichs' },
];
for (const p of PAINS) {
  for (const t of TARTINES) {
    recette({
      nom: `${p.nom} ${t.mots}`,
      cat: p.cat,
      temps: 20,
      diff: 1,
      ings: [...p.ings, ...t.ings, ['ail', 1, 'gousse'], ['huile d\'olive', 3, 'cs'], ...SEL_POIVRE],
      etapes: [
        S(p.prep),
        S('Préparez la garniture : {0}, lavés et coupés en petits morceaux ou écrasés à la fourchette selon le cas.', t.mots),
        S('Garnissez le pain juste avant de servir, salez, poivrez et ajoutez un filet d\'huile d\'olive.'),
      ],
    });
  }
}

// ---------------------------------------------------------------- Brochettes
const PROT_BROCHETTE = [
  { mot: 'poulet', ing: ['blancs de poulet', 600, 'g'] }, { mot: 'boeuf', ing: ['steaks de boeuf', 600, 'g'] },
  { mot: 'agneau', ing: ['gigot d\'agneau', 700, 'g'] }, { mot: 'crevettes', ing: ['gambas', 16, 'u'] },
  { mot: 'saumon', ing: ['pavés de saumon', 4, 'u'] }, { mot: 'halloumi', ing: ['halloumi', 400, 'g'] },
  { mot: 'tofu', ing: ['tofu', 400, 'g'] }, { mot: 'dinde', ing: ['escalopes de dinde', 600, 'g'] },
];
const MARINADES = [
  { mot: 'au citron et au thym', ings: [['citrons', 1, 'u'], ['thym', 4, 'brin'], ['huile d\'olive', 4, 'cs']] },
  { mot: 'tandoori', ings: [['yaourt nature', 1, 'u'], ['curry', 2, 'cc'], ['paprika', 1, 'cc']] },
  { mot: 'au miel et au soja', ings: [['miel', 2, 'cs'], ['sauce soja', 3, 'cs'], ['ail', 1, 'gousse']] },
  { mot: 'aux herbes de Provence', ings: [['herbes de Provence', 2, 'cc'], ['huile d\'olive', 4, 'cs'], ['ail', 2, 'gousse']] },
  { mot: 'au paprika fumé', ings: [['paprika', 2, 'cc'], ['huile d\'olive', 4, 'cs'], ['citrons', 1, 'u']] },
  { mot: 'à la marocaine', ings: [['ras el hanout', 2, 'cc'], ['coriandre', 1, 'botte'], ['huile d\'olive', 4, 'cs']] },
];
const LEG_BROCHETTE = [
  { mots: 'poivrons et oignons rouges', ings: [['poivrons rouges', 1, 'u'], ['poivrons jaunes', 1, 'u'], ['oignons rouges', 2, 'u']] },
  { mots: 'courgettes et tomates cerises', ings: [['courgettes', 2, 'u'], ['tomates cerises', 250, 'g']] },
  { mots: 'ananas et poivrons', ings: [['ananas', 1, 'u'], ['poivrons rouges', 1, 'u']] },
];
for (const p of PROT_BROCHETTE) {
  for (const m of MARINADES) {
    for (const l of LEG_BROCHETTE) {
      if (p.mot === 'saumon' && m.mot === 'à la marocaine') continue;
      recette({
        nom: `Brochettes ${de(p.mot)} ${m.mot}, ${l.mots}`,
        cat: ['crevettes', 'saumon'].includes(p.mot) ? 'poissons' : ['halloumi', 'tofu'].includes(p.mot) ? 'vegetarien' : 'viandes',
        temps: 50,
        diff: 1,
        ings: [p.ing, ...m.ings, ...l.ings, ...SEL_POIVRE],
        etapes: [
          S('Coupez {0} en gros cubes réguliers.', p.mot === 'crevettes' ? 'les gambas décortiquées (gardez-les entières)' : `le ${p.mot}`),
          S('Mélangez les ingrédients de la marinade, ajoutez {0} et laissez mariner 30 min au frais.', p.mot === 'crevettes' ? 'les gambas' : 'les cubes'),
          S('Coupez les légumes ({0}) en morceaux de même taille.', l.mots),
          S('Enfilez en alternant sur des piques, en serrant bien.'),
          S('Faites cuire 8 à 12 min au barbecue, à la plancha ou sous le gril du four, en tournant régulièrement.'),
        ],
      });
    }
  }
}

// ---------------------------------------------------------------- Tartinades, houmous, dips
const DIPS = [
  { nom: 'Houmous classique', ings: [['pois chiches', 2, 'boite'], ['tahini', 3, 'cs'], ['citrons', 1, 'u'], ['ail', 1, 'gousse'], ['huile d\'olive', 4, 'cs'], ['cumin', 1, 'cc']] },
  { nom: 'Houmous à la betterave', ings: [['pois chiches', 1, 'boite'], ['betteraves', 2, 'u'], ['tahini', 2, 'cs'], ['citrons', 1, 'u'], ['huile d\'olive', 3, 'cs']] },
  { nom: 'Houmous à la patate douce', ings: [['pois chiches', 1, 'boite'], ['patates douces', 1, 'u'], ['tahini', 2, 'cs'], ['cumin', 1, 'cc'], ['huile d\'olive', 3, 'cs']] },
  { nom: 'Houmous aux poivrons grillés', ings: [['pois chiches', 1, 'boite'], ['poivrons rouges', 2, 'u'], ['tahini', 2, 'cs'], ['paprika', 1, 'cc'], ['huile d\'olive', 3, 'cs']] },
  { nom: 'Houmous à l\'avocat', ings: [['pois chiches', 1, 'boite'], ['avocats', 1, 'u'], ['citrons verts', 1, 'u'], ['coriandre', 1, 'botte'], ['huile d\'olive', 2, 'cs']] },
  { nom: 'Houmous au pesto', ings: [['pois chiches', 2, 'boite'], ['pesto', 3, 'cs'], ['citrons', 1, 'u'], ['huile d\'olive', 2, 'cs']] },
  { nom: 'Guacamole', ings: [['avocats', 3, 'u'], ['citrons verts', 1, 'u'], ['tomates', 1, 'u'], ['oignons rouges', 1, 'u'], ['coriandre', 1, 'botte'], ['piments', 1, 'u']] },
  { nom: 'Tzatziki', ings: [['yaourt grec', 2, 'u'], ['concombre', 1, 'u'], ['ail', 1, 'gousse'], ['menthe', 1, 'botte'], ['huile d\'olive', 1, 'cs']] },
  { nom: 'Caviar d\'aubergine', ings: [['aubergines', 3, 'u'], ['ail', 1, 'gousse'], ['citrons', 1, 'u'], ['huile d\'olive', 4, 'cs'], ['cumin', 1, 'cc']] },
  { nom: 'Tapenade noire', ings: [['olives noires', 200, 'g'], ['câpres', 2, 'cs'], ['ail', 1, 'gousse'], ['huile d\'olive', 5, 'cs']] },
  { nom: 'Tapenade verte', ings: [['olives vertes', 200, 'g'], ['câpres', 2, 'cs'], ['basilic', 1, 'botte'], ['huile d\'olive', 5, 'cs']] },
  { nom: 'Rillettes de thon', ings: [['thon en boîte', 2, 'boite'], ['cream cheese', 150, 'g'], ['citrons', 1, 'u'], ['ciboulette', 1, 'botte']] },
  { nom: 'Rillettes de saumon', ings: [['saumon fumé', 4, 'tranche'], ['pavés de saumon', 1, 'u'], ['fromage blanc', 150, 'g'], ['aneth', 1, 'botte'], ['citrons', 1, 'u']] },
  { nom: 'Rillettes de sardines', ings: [['sardines en boîte', 2, 'boite'], ['cream cheese', 100, 'g'], ['citrons', 1, 'u'], ['ciboulette', 1, 'botte']] },
  { nom: 'Dip au fromage blanc et aux herbes', ings: [['fromage blanc', 300, 'g'], ['ciboulette', 1, 'botte'], ['persil', 1, 'botte'], ['échalotes', 1, 'u']] },
  { nom: 'Dip feta et poivrons', ings: [['feta', 200, 'g'], ['poivrons rouges', 1, 'u'], ['yaourt grec', 1, 'u'], ['piment d\'Espelette', 1, 'pincee']] },
  { nom: 'Muhammara aux noix et poivrons', ings: [['poivrons rouges', 3, 'u'], ['noix', 100, 'g'], ['chapelure', 30, 'g'], ['citrons', 1, 'u'], ['huile d\'olive', 4, 'cs'], ['cumin', 1, 'cc']] },
  { nom: 'Tartinade de haricots blancs au romarin', ings: [['haricots blancs', 1, 'boite'], ['romarin', 1, 'brin'], ['ail', 1, 'gousse'], ['citrons', 1, 'u'], ['huile d\'olive', 4, 'cs']] },
  { nom: 'Baba ganoush', ings: [['aubergines', 2, 'u'], ['tahini', 3, 'cs'], ['citrons', 1, 'u'], ['ail', 1, 'gousse'], ['persil', 1, 'botte']] },
  { nom: 'Tartinade de petits pois à la menthe', ings: [['petits pois', 300, 'g'], ['menthe', 1, 'botte'], ['ricotta', 100, 'g'], ['citrons', 1, 'u']] },
];
for (const d of DIPS) {
  const cuire = d.ings.some(([n]) => ['aubergines', 'poivrons rouges', 'betteraves', 'patates douces', 'petits pois'].includes(n));
  recette({
    nom: d.nom,
    cat: 'aperitif',
    temps: cuire ? 45 : 15,
    diff: 1,
    pers: 6,
    ings: [...d.ings, ...SEL_POIVRE],
    etapes: [
      cuire ? S('Faites cuire ou rôtir les légumes jusqu\'à ce qu\'ils soient bien tendres (environ 30 min au four à 200 °C pour les aubergines et les poivrons, 10 min à l\'eau pour les petits pois), puis laissez tiédir et retirez la peau si besoin.') : null,
      S('Égouttez, épluchez et coupez grossièrement les ingrédients qui le demandent.'),
      S('Mixez le tout jusqu\'à obtenir la texture souhaitée, lisse ou un peu rustique.'),
      S('Salez, poivrez, goûtez et rectifiez avec un peu de citron ou d\'huile. Servez frais avec du pain ou des légumes à croquer.'),
    ],
  });
}

// ---------------------------------------------------------------- Vinaigrettes et sauces
const SAUCES = [
  { nom: 'Vinaigrette classique à la moutarde', ings: [['moutarde', 1, 'cs'], ['vinaigre de vin', 2, 'cs'], ['huile', 6, 'cs']] },
  { nom: 'Vinaigrette balsamique', ings: [['vinaigre balsamique', 2, 'cs'], ['huile d\'olive', 6, 'cs'], ['miel', 1, 'cc']] },
  { nom: 'Vinaigrette au miel et à la moutarde à l\'ancienne', ings: [['moutarde à l\'ancienne', 1, 'cs'], ['miel', 1, 'cs'], ['vinaigre de cidre', 2, 'cs'], ['huile', 5, 'cs']] },
  { nom: 'Vinaigrette asiatique au sésame', ings: [['sauce soja', 2, 'cs'], ['huile de sésame', 1, 'cs'], ['vinaigre de cidre', 1, 'cs'], ['gingembre', 10, 'g'], ['miel', 1, 'cc']] },
  { nom: 'Vinaigrette au citron et aux herbes', ings: [['citrons', 1, 'u'], ['huile d\'olive', 5, 'cs'], ['ciboulette', 1, 'botte'], ['persil', 1, 'botte']] },
  { nom: 'Sauce César', ings: [['mayonnaise', 4, 'cs'], ['parmesan', 30, 'g'], ['citrons', 1, 'u'], ['ail', 1, 'gousse']] },
  { nom: 'Sauce au yaourt et à l\'ail', ings: [['yaourt grec', 1, 'u'], ['ail', 1, 'gousse'], ['citrons', 1, 'u'], ['ciboulette', 1, 'botte']] },
  { nom: 'Sauce tomate maison', ings: [['tomates concassées', 2, 'boite'], ['oignons', 1, 'u'], ['ail', 2, 'gousse'], ['huile d\'olive', 3, 'cs'], ['basilic', 1, 'botte'], ['sucre', 1, 'cc']] },
  { nom: 'Sauce béchamel', ings: [['beurre', 50, 'g'], ['farine', 50, 'g'], ['lait', 50, 'cL'], ['muscade', 1, 'pincee']] },
  { nom: 'Mayonnaise maison', ings: [['oeufs', 1, 'u'], ['moutarde', 1, 'cs'], ['huile', 25, 'cL'], ['vinaigre de vin', 1, 'cc']] },
  { nom: 'Sauce chimichurri', ings: [['persil', 1, 'botte'], ['ail', 3, 'gousse'], ['vinaigre de vin', 3, 'cs'], ['huile d\'olive', 10, 'cL'], ['piment d\'Espelette', 1, 'cc']] },
  { nom: 'Sauce salsa verde', ings: [['persil', 1, 'botte'], ['basilic', 1, 'botte'], ['câpres', 1, 'cs'], ['citrons', 1, 'u'], ['huile d\'olive', 10, 'cL']] },
  { nom: 'Sauce aux champignons', ings: [['champignons', 250, 'g'], ['échalotes', 1, 'u'], ['crème liquide', 20, 'cL'], ['beurre', 20, 'g']] },
  { nom: 'Sauce cocktail', ings: [['mayonnaise', 5, 'cs'], ['ketchup', 2, 'cs'], ['jus de citron', 1, 'cs']] },
  { nom: 'Sauce tartare', ings: [['mayonnaise', 5, 'cs'], ['cornichons', 4, 'u'], ['câpres', 1, 'cs'], ['échalotes', 1, 'u'], ['persil', 1, 'botte']] },
  { nom: 'Sauce barbecue maison', ings: [['ketchup', 15, 'cL'], ['miel', 2, 'cs'], ['sauce soja', 2, 'cs'], ['vinaigre de cidre', 2, 'cs'], ['paprika', 1, 'cc']] },
  { nom: 'Sauce caramel au beurre salé', ings: [['sucre', 150, 'g'], ['beurre demi-sel', 60, 'g'], ['crème liquide', 15, 'cL']] },
  { nom: 'Sauce au chocolat', ings: [['chocolat noir', 150, 'g'], ['crème liquide', 15, 'cL']] },
  { nom: 'Coulis de fruits rouges', ings: [['framboises', 250, 'g'], ['sucre', 50, 'g'], ['citrons', 1, 'u']] },
  { nom: 'Pesto de roquette', ings: [['roquette', 100, 'g'], ['parmesan', 50, 'g'], ['pignons de pin', 30, 'g'], ['huile d\'olive', 10, 'cL'], ['ail', 1, 'gousse']] },
];
for (const s of SAUCES) {
  const chaud = /béchamel|tomate maison|champignons|caramel|chocolat|Coulis/.test(s.nom);
  recette({
    nom: s.nom,
    cat: 'sauces',
    temps: chaud ? 20 : 10,
    diff: /Mayonnaise|béchamel|caramel/.test(s.nom) ? 2 : 1,
    pers: 6,
    ings: [...s.ings, ...(/caramel|chocolat|Coulis/.test(s.nom) ? [] : SEL_POIVRE)],
    etapes: chaud
      ? [
          S('Préparez et mesurez tous les ingrédients avant de commencer.'),
          S(/béchamel/.test(s.nom)
            ? 'Faites fondre le beurre, ajoutez la farine et remuez 1 min, puis versez le lait froid petit à petit en fouettant. Laissez épaissir 5 min à feu doux.'
            : /caramel/.test(s.nom)
              ? 'Faites fondre le sucre à sec jusqu\'à obtenir un caramel ambré, ajoutez le beurre puis la crème chaude, hors du feu, en fouettant.'
              : /chocolat/.test(s.nom)
                ? 'Faites chauffer la crème, versez-la sur le chocolat haché et mélangez jusqu\'à obtenir une sauce lisse.'
                : /Coulis/.test(s.nom)
                  ? 'Faites chauffer les fruits avec le sucre 5 min, ajoutez le jus du citron, mixez et filtrez.'
                  : 'Faites revenir les aromates dans la matière grasse, ajoutez le reste des ingrédients et laissez mijoter 15 min à feu doux.'),
          S('Goûtez, rectifiez l\'assaisonnement et laissez tiédir avant de servir ou de mettre en pot.'),
        ]
      : [
          S('Hachez finement les herbes et les aromates.'),
          S(/Mayonnaise/.test(s.nom)
            ? 'Mélangez le jaune d\'oeuf et la moutarde, puis versez l\'huile en mince filet en fouettant sans arrêt. Ajoutez le vinaigre à la fin.'
            : 'Mélangez tous les ingrédients au fouet ou au mixeur jusqu\'à obtenir une sauce homogène.'),
          S('Goûtez et rectifiez l\'assaisonnement. Se conserve 3 jours au réfrigérateur dans un pot fermé.'),
        ],
  });
}

// ---------------------------------------------------------------- Tajines
const PROT_TAJINE = [
  { mot: 'poulet', ing: ['cuisses de poulet', 4, 'u'], t: 45 },
  { mot: 'agneau', ing: ['épaule d\'agneau', 1000, 'g'], t: 90 },
  { mot: 'boeuf', ing: ['boeuf à braiser', 900, 'g'], t: 100 },
  { mot: 'légumes', ing: ['pois chiches', 1, 'boite'], t: 40 },
];
const GARN_TAJINE = [
  { mots: 'aux citrons confits et aux olives', ings: [['citrons', 2, 'u'], ['olives vertes', 100, 'g']] },
  { mots: 'aux pruneaux et aux amandes', ings: [['pruneaux', 200, 'g'], ['amandes', 60, 'g'], ['miel', 1, 'cs']] },
  { mots: 'aux abricots secs', ings: [['abricots secs', 150, 'g'], ['cannelle', 1, 'cc']] },
  { mots: 'aux carottes et aux pois chiches', ings: [['carottes', 4, 'u'], ['pois chiches', 1, 'boite']] },
  { mots: 'aux courgettes et aux tomates', ings: [['courgettes', 3, 'u'], ['tomates', 3, 'u']] },
  { mots: 'aux patates douces', ings: [['patates douces', 2, 'u']] },
  { mots: 'aux poires et au miel', ings: [['poires', 3, 'u'], ['miel', 2, 'cs']] },
  { mots: 'aux artichauts et aux petits pois', ings: [['artichauts', 4, 'u'], ['petits pois', 300, 'g']] },
];
for (const p of PROT_TAJINE) {
  for (const g of GARN_TAJINE) {
    if (p.mot === 'légumes' && g.mots.includes('pois chiches')) continue;
    recette({
      nom: `Tajine ${de(p.mot)} ${g.mots}`,
      cat: p.mot === 'légumes' ? 'vegetarien' : 'viandes',
      temps: p.t + 20,
      diff: 2,
      ings: [p.ing, ...g.ings, ['oignons', 2, 'u'], ['ail', 2, 'gousse'], ['ras el hanout', 2, 'cc'], ['gingembre en poudre', 1, 'cc'], ['coriandre', 1, 'botte'], ['huile d\'olive', 3, 'cs'], ['semoule', 300, 'g'], ...SEL_POIVRE],
      etapes: [
        S('Émincez les oignons et l\'ail. Coupez {0} en morceaux.', p.mot === 'légumes' ? 'les légumes' : 'la viande'),
        S('Dans un tajine ou une cocotte, faites dorer {0} dans l\'huile d\'olive avec les oignons, l\'ail et les épices, 8 min.', p.mot === 'légumes' ? 'les oignons' : 'la viande'),
        S('Ajoutez la garniture et 30 cL d\'eau. Couvrez et laissez mijoter {0} min à feu doux.', p.t),
        S('Pendant ce temps, faites gonfler la semoule avec le même volume d\'eau bouillante salée et un filet d\'huile.'),
        S('Parsemez de coriandre ciselée et servez avec la semoule.'),
      ],
    });
  }
}

module.exports = { enumere };
