// Pâtes, gnocchis, risottos, currys, woks, poissons et viandes.

const { I, S, recette, SEL_POIVRE, ETAPE_ASSAISONNER } = require('./fabrique');
const { de } = require('./langue');

// ---------------------------------------------------------------- Pâtes
const FORMES = ['spaghetti', 'tagliatelles', 'penne', 'fusilli', 'linguine', 'farfalle', 'rigatoni', 'orecchiette'];
// nom : suffixe du nom du plat · ings : sauce pour 4 · etapes : sauce
const SAUCES_PATES = [
  { nom: 'à la carbonara', temps: 20, ings: [['guanciale', 150, 'g'], ['oeufs', 4, 'u'], ['pecorino', 80, 'g']], etapes: [
    'Coupez le guanciale en lardons et faites-le dorer à sec 6 min dans une grande poêle.',
    'Battez les jaunes et 1 oeuf entier avec le pecorino râpé et beaucoup de poivre.',
    'Hors du feu, mélangez les pâtes égouttées avec le guanciale, puis ajoutez les oeufs et un peu d\'eau de cuisson en remuant vivement jusqu\'à obtenir une sauce crémeuse.',
  ] },
  { nom: 'à la bolognaise', temps: 75, ings: [['boeuf haché', 400, 'g'], ['oignons', 1, 'u'], ['carottes', 1, 'u'], ['céleri branche', 1, 'u'], ['tomates concassées', 2, 'boite'], ['vin rouge', 10, 'cL'], ['huile d\'olive', 2, 'cs'], ['parmesan', 50, 'g']], etapes: [
    'Hachez finement l\'oignon, la carotte et le céleri, puis faites-les revenir 8 min dans l\'huile d\'olive.',
    'Ajoutez le boeuf haché et faites-le dorer en l\'émiettant, puis déglacez au vin rouge.',
    'Ajoutez les tomates concassées, salez, poivrez et laissez mijoter 1 h à couvert, à feu doux, en remuant de temps en temps.',
    'Servez la sauce sur les pâtes avec le parmesan râpé.',
  ] },
  { nom: 'au pesto', temps: 15, ings: [['basilic', 2, 'botte'], ['pignons de pin', 40, 'g'], ['parmesan', 60, 'g'], ['ail', 1, 'gousse'], ['huile d\'olive', 10, 'cL']], etapes: [
    'Mixez le basilic, les pignons, l\'ail et le parmesan avec l\'huile d\'olive jusqu\'à obtenir un pesto épais.',
    'Mélangez le pesto aux pâtes égouttées avec un peu d\'eau de cuisson.',
  ] },
  { nom: 'à l\'arrabbiata', temps: 25, ings: [['tomates concassées', 2, 'boite'], ['ail', 3, 'gousse'], ['piments', 2, 'u'], ['huile d\'olive', 4, 'cs'], ['persil', 1, 'botte']], etapes: [
    'Faites revenir l\'ail émincé et les piments hachés 2 min dans l\'huile d\'olive.',
    'Ajoutez les tomates concassées et laissez mijoter 15 min. Salez.',
    'Mélangez la sauce aux pâtes et parsemez de persil ciselé.',
  ] },
  { nom: 'aux champignons et à la crème', temps: 25, ings: [['champignons', 400, 'g'], ['échalotes', 2, 'u'], ['crème liquide', 25, 'cL'], ['beurre', 20, 'g'], ['persil', 1, 'botte'], ['parmesan', 40, 'g']], etapes: [
    'Émincez les échalotes et les champignons. Faites-les sauter 8 min dans le beurre.',
    'Ajoutez la crème, salez, poivrez et laissez réduire 5 min.',
    'Mélangez aux pâtes, parsemez de persil ciselé et de parmesan.',
  ] },
  { nom: 'au saumon et à l\'aneth', temps: 20, ings: [['saumon fumé', 4, 'tranche'], ['crème liquide', 25, 'cL'], ['citrons', 1, 'u'], ['aneth', 1, 'botte']], etapes: [
    'Faites chauffer la crème avec le zeste du citron, sans la faire bouillir.',
    'Ajoutez le saumon fumé coupé en lanières et l\'aneth ciselé hors du feu.',
    'Mélangez aux pâtes et ajoutez un filet de jus de citron.',
  ] },
  { nom: 'au thon et aux tomates', temps: 25, ings: [['thon en boîte', 2, 'boite'], ['tomates concassées', 1, 'boite'], ['oignons', 1, 'u'], ['câpres', 2, 'cs'], ['huile d\'olive', 2, 'cs']], etapes: [
    'Faites revenir l\'oignon émincé 5 min dans l\'huile d\'olive.',
    'Ajoutez les tomates et les câpres, laissez mijoter 10 min.',
    'Ajoutez le thon émietté, réchauffez 2 min et mélangez aux pâtes.',
  ] },
  { nom: 'aux crevettes, ail et persil', temps: 20, ings: [['crevettes', 400, 'g'], ['ail', 3, 'gousse'], ['persil', 1, 'botte'], ['huile d\'olive', 4, 'cs'], ['citrons', 1, 'u']], etapes: [
    'Décortiquez les crevettes. Faites revenir l\'ail émincé 1 min dans l\'huile d\'olive.',
    'Ajoutez les crevettes et faites-les sauter 3 min, jusqu\'à ce qu\'elles soient roses.',
    'Mélangez aux pâtes avec le persil ciselé et un filet de citron.',
  ] },
  { nom: 'aux courgettes et au citron', temps: 20, ings: [['courgettes', 500, 'g'], ['citrons', 1, 'u'], ['ail', 1, 'gousse'], ['huile d\'olive', 3, 'cs'], ['parmesan', 50, 'g'], ['menthe', 1, 'botte']], etapes: [
    'Coupez les courgettes en fines demi-rondelles et faites-les sauter 6 min avec l\'ail dans l\'huile d\'olive.',
    'Ajoutez le zeste et le jus du citron.',
    'Mélangez aux pâtes avec le parmesan et la menthe ciselée.',
  ] },
  { nom: 'cacio e pepe', temps: 15, ings: [['pecorino', 120, 'g'], ['poivre', 2, 'cc']], etapes: [
    'Faites griller le poivre concassé 1 min à sec dans une grande poêle, puis ajoutez une louche d\'eau de cuisson.',
    'Ajoutez les pâtes égouttées, puis le pecorino râpé petit à petit, hors du feu, en remuant vivement jusqu\'à obtenir une sauce crémeuse.',
  ] },
  { nom: 'à la puttanesca', temps: 25, ings: [['tomates concassées', 2, 'boite'], ['olives noires', 80, 'g'], ['câpres', 2, 'cs'], ['ail', 2, 'gousse'], ['piments', 1, 'u'], ['huile d\'olive', 3, 'cs']], etapes: [
    'Faites revenir l\'ail et le piment 2 min dans l\'huile d\'olive.',
    'Ajoutez les tomates, les olives et les câpres et laissez mijoter 15 min.',
    'Mélangez aux pâtes.',
  ] },
  { nom: 'aux légumes du soleil', temps: 35, ings: [['courgettes', 300, 'g'], ['aubergines', 300, 'g'], ['poivrons rouges', 1, 'u'], ['tomates cerises', 250, 'g'], ['ail', 2, 'gousse'], ['huile d\'olive', 4, 'cs'], ['basilic', 1, 'botte']], etapes: [
    'Coupez les légumes en dés et faites-les revenir 15 min dans l\'huile d\'olive avec l\'ail.',
    'Ajoutez les tomates cerises coupées en deux et poursuivez 5 min.',
    'Mélangez aux pâtes avec le basilic ciselé.',
  ] },
  { nom: 'au gorgonzola et aux noix', temps: 15, ings: [['gorgonzola', 150, 'g'], ['crème liquide', 20, 'cL'], ['noix', 50, 'g']], etapes: [
    'Faites fondre le gorgonzola dans la crème à feu doux.',
    'Mélangez aux pâtes et parsemez de noix concassées.',
  ] },
  { nom: 'aux épinards et à la ricotta', temps: 20, ings: [['pousses d\'épinards', 200, 'g'], ['ricotta', 250, 'g'], ['ail', 1, 'gousse'], ['parmesan', 40, 'g'], ['huile d\'olive', 2, 'cs']], etapes: [
    'Faites tomber les épinards 2 min avec l\'ail dans l\'huile d\'olive.',
    'Mélangez la ricotta avec un peu d\'eau de cuisson et le parmesan.',
    'Mélangez le tout aux pâtes.',
  ] },
  { nom: 'au poulet et au brocoli', temps: 25, ings: [['blancs de poulet', 2, 'u'], ['brocoli', 400, 'g'], ['crème liquide', 20, 'cL'], ['ail', 1, 'gousse'], ['parmesan', 40, 'g'], ['huile', 1, 'cs']], etapes: [
    'Faites cuire les bouquets de brocoli 4 min avec les pâtes, en fin de cuisson.',
    'Faites dorer le poulet en dés 6 min dans l\'huile avec l\'ail, puis ajoutez la crème.',
    'Mélangez avec les pâtes et le brocoli, parsemez de parmesan.',
  ] },
  { nom: 'aux lardons et aux petits pois', temps: 20, ings: [['lardons', 200, 'g'], ['petits pois', 300, 'g'], ['crème liquide', 20, 'cL'], ['oignons', 1, 'u']], etapes: [
    'Faites dorer les lardons et l\'oignon émincé 6 min.',
    'Ajoutez les petits pois et 5 cL d\'eau, couvrez et laissez cuire 6 min.',
    'Ajoutez la crème, laissez réduire 2 min et mélangez aux pâtes.',
  ] },
  { nom: 'aux tomates cerises et au basilic', temps: 15, ings: [['tomates cerises', 400, 'g'], ['ail', 2, 'gousse'], ['huile d\'olive', 4, 'cs'], ['basilic', 1, 'botte'], ['parmesan', 40, 'g']], etapes: [
    'Faites revenir l\'ail 1 min dans l\'huile d\'olive, ajoutez les tomates cerises coupées en deux et laissez compoter 6 min.',
    'Mélangez aux pâtes avec le basilic et le parmesan.',
  ] },
  { nom: 'aglio e olio', temps: 15, ings: [['ail', 4, 'gousse'], ['huile d\'olive', 8, 'cs'], ['piments', 1, 'u'], ['persil', 1, 'botte']], etapes: [
    'Faites dorer doucement l\'ail en lamelles et le piment dans l\'huile d\'olive, 3 min, sans le brûler.',
    'Mélangez aux pâtes avec un peu d\'eau de cuisson et le persil ciselé.',
  ] },
  { nom: 'aux asperges et au parmesan', temps: 20, ings: [['asperges vertes', 400, 'g'], ['beurre', 30, 'g'], ['parmesan', 60, 'g'], ['citrons', 1, 'u']], etapes: [
    'Coupez les asperges en tronçons et faites-les cuire 4 min avec les pâtes.',
    'Mélangez avec le beurre, le zeste de citron et le parmesan.',
  ] },
  { nom: 'au potiron et à la sauge', temps: 30, ings: [['potiron', 500, 'g'], ['sauge', 8, 'feuille'], ['beurre', 40, 'g'], ['parmesan', 50, 'g']], etapes: [
    'Faites cuire le potiron en dés 10 min à la poêle avec la moitié du beurre et un fond d\'eau.',
    'Faites mousser le reste du beurre avec les feuilles de sauge.',
    'Mélangez le tout aux pâtes et parsemez de parmesan.',
  ] },
  { nom: 'au chorizo et aux poivrons', temps: 25, ings: [['chorizo', 120, 'g'], ['poivrons rouges', 2, 'u'], ['tomates concassées', 1, 'boite'], ['oignons', 1, 'u'], ['huile d\'olive', 2, 'cs']], etapes: [
    'Faites revenir l\'oignon et les poivrons en lanières 8 min dans l\'huile d\'olive.',
    'Ajoutez le chorizo en rondelles et les tomates, laissez mijoter 10 min.',
    'Mélangez aux pâtes.',
  ] },
  { nom: 'alla norma', temps: 35, ings: [['aubergines', 2, 'u'], ['tomates concassées', 2, 'boite'], ['ail', 2, 'gousse'], ['ricotta', 120, 'g'], ['basilic', 1, 'botte'], ['huile d\'olive', 6, 'cs']], etapes: [
    'Coupez les aubergines en dés et faites-les dorer 12 min dans l\'huile d\'olive.',
    'Ajoutez l\'ail et les tomates, laissez mijoter 15 min.',
    'Mélangez aux pâtes, ajoutez la ricotta émiettée et le basilic.',
  ] },
  { nom: 'au pesto rosso', temps: 15, ings: [['pesto rosso', 1, 'pot'], ['tomates cerises', 200, 'g'], ['parmesan', 40, 'g'], ['basilic', 1, 'botte']], etapes: [
    'Coupez les tomates cerises en deux.',
    'Mélangez les pâtes avec le pesto rosso, un peu d\'eau de cuisson et les tomates. Parsemez de parmesan et de basilic.',
  ] },
  { nom: 'aux palourdes', temps: 30, ings: [['palourdes', 1, 'kg'], ['ail', 3, 'gousse'], ['vin blanc', 10, 'cL'], ['persil', 1, 'botte'], ['huile d\'olive', 4, 'cs']], etapes: [
    'Rincez les palourdes plusieurs fois à l\'eau froide.',
    'Faites revenir l\'ail dans l\'huile d\'olive, ajoutez les palourdes et le vin blanc, couvrez et laissez ouvrir 5 min.',
    'Mélangez aux pâtes avec le jus filtré et le persil ciselé.',
  ] },
  { nom: 'aux quatre fromages', temps: 15, ings: [['gorgonzola', 60, 'g'], ['mozzarella', 1, 'u'], ['parmesan', 50, 'g'], ['emmental', 60, 'g'], ['crème liquide', 20, 'cL']], etapes: [
    'Faites fondre les fromages coupés en dés dans la crème, à feu doux, en remuant.',
    'Mélangez aux pâtes et poivrez généreusement.',
  ] },
  { nom: 'à la saucisse et au fenouil', temps: 30, ings: [['saucisses', 4, 'u'], ['fenouil', 1, 'u'], ['crème liquide', 15, 'cL'], ['huile d\'olive', 2, 'cs'], ['parmesan', 40, 'g']], etapes: [
    'Retirez la peau des saucisses et faites dorer la chair émiettée 6 min dans l\'huile d\'olive.',
    'Ajoutez le fenouil émincé et poursuivez 8 min, puis la crème.',
    'Mélangez aux pâtes et parsemez de parmesan.',
  ] },
  { nom: 'aux artichauts et au citron', temps: 20, ings: [['coeurs d\'artichauts', 300, 'g'], ['citrons', 1, 'u'], ['ail', 1, 'gousse'], ['huile d\'olive', 4, 'cs'], ['parmesan', 40, 'g']], etapes: [
    'Faites dorer les coeurs d\'artichauts coupés en quartiers avec l\'ail dans l\'huile d\'olive, 6 min.',
    'Ajoutez le zeste et le jus du citron, puis mélangez aux pâtes avec le parmesan.',
  ] },
  { nom: 'aux poireaux et au jambon', temps: 25, ings: [['poireaux', 500, 'g'], ['jambon', 4, 'tranche'], ['crème liquide', 20, 'cL'], ['beurre', 20, 'g']], etapes: [
    'Émincez les poireaux et faites-les fondre 10 min dans le beurre.',
    'Ajoutez le jambon en lanières et la crème, laissez réduire 3 min.',
    'Mélangez aux pâtes.',
  ] },
  { nom: 'au jambon cru et à la roquette', temps: 15, ings: [['jambon cru', 6, 'tranche'], ['roquette', 100, 'g'], ['tomates cerises', 200, 'g'], ['huile d\'olive', 4, 'cs'], ['parmesan', 50, 'g']], etapes: [
    'Coupez les tomates cerises en deux et le jambon cru en lanières.',
    'Mélangez les pâtes chaudes avec l\'huile d\'olive, les tomates, le jambon, la roquette et le parmesan en copeaux.',
  ] },
  { nom: 'aux brocolis et à l\'anchoïade', temps: 20, ings: [['brocoli', 500, 'g'], ['ail', 2, 'gousse'], ['piments', 1, 'u'], ['huile d\'olive', 5, 'cs'], ['chapelure', 4, 'cs']], etapes: [
    'Faites cuire les bouquets de brocoli 5 min avec les pâtes.',
    'Faites dorer la chapelure 2 min dans 1 c. à soupe d\'huile d\'olive. Réservez.',
    'Faites revenir l\'ail et le piment dans le reste de l\'huile, ajoutez pâtes et brocoli, puis parsemez de chapelure dorée.',
  ] },
  { nom: 'à la crème de parmesan et aux noix', temps: 15, ings: [['parmesan', 100, 'g'], ['crème liquide', 25, 'cL'], ['noix', 60, 'g'], ['beurre', 20, 'g']], etapes: [
    'Faites fondre le parmesan dans la crème chaude en fouettant.',
    'Faites dorer les noix concassées dans le beurre 2 min.',
    'Mélangez la crème aux pâtes et parsemez de noix.',
  ] },
  { nom: 'à la sauce tomate et aux boulettes', temps: 50, ings: [['boeuf haché', 500, 'g'], ['oeufs', 1, 'u'], ['chapelure', 50, 'g'], ['parmesan', 50, 'g'], ['tomates concassées', 2, 'boite'], ['ail', 2, 'gousse'], ['basilic', 1, 'botte'], ['huile d\'olive', 3, 'cs']], etapes: [
    'Mélangez le boeuf, l\'oeuf, la chapelure, le parmesan et l\'ail haché. Salez, poivrez et formez des boulettes.',
    'Faites dorer les boulettes 6 min dans l\'huile d\'olive, puis ajoutez les tomates.',
    'Laissez mijoter 25 min à couvert, ajoutez le basilic et servez sur les pâtes.',
  ] },
  { nom: 'aux sardines et au fenouil', temps: 25, ings: [['sardines en boîte', 2, 'boite'], ['fenouil', 1, 'u'], ['raisins secs', 30, 'g'], ['pignons de pin', 30, 'g'], ['huile d\'olive', 3, 'cs']], etapes: [
    'Faites fondre le fenouil émincé 10 min dans l\'huile d\'olive.',
    'Ajoutez les raisins secs, les pignons et les sardines émiettées, réchauffez 3 min.',
    'Mélangez aux pâtes.',
  ] },
  { nom: 'aux noix de Saint-Jacques', temps: 20, ings: [['noix de Saint-Jacques', 12, 'u'], ['crème liquide', 20, 'cL'], ['échalotes', 1, 'u'], ['beurre', 20, 'g'], ['ciboulette', 1, 'botte']], etapes: [
    'Saisissez les noix de Saint-Jacques 1 min par face dans le beurre, réservez.',
    'Faites revenir l\'échalote, ajoutez la crème et laissez réduire 3 min.',
    'Mélangez aux pâtes, ajoutez les Saint-Jacques et la ciboulette.',
  ] },
];
for (const f of FORMES) {
  for (const s of SAUCES_PATES) {
    recette({
      nom: `${f} ${s.nom}`,
      cat: 'pates_riz',
      temps: s.temps,
      diff: s.temps > 40 ? 2 : 1,
      ings: [[f, 400, 'g'], ...s.ings, ...SEL_POIVRE],
      etapes: [
        S('Portez une grande casserole d\'eau salée à ébullition et faites cuire {0} selon le temps indiqué sur le paquet, al dente.', I(f).le),
        ...s.etapes.map((e) => S(e)),
        S('Égouttez en gardant une louche d\'eau de cuisson pour lier la sauce si besoin. Servez aussitôt.'),
      ],
    });
  }
}

// Gnocchis : une sauce sur deux, rôtis à la poêle.
for (const s of SAUCES_PATES.filter((x) => !x.etapes.some((e) => /avec les pâtes|eau de cuisson/.test(e)))) {
  recette({
    nom: `Gnocchis ${s.nom}`,
    cat: 'pates_riz',
    temps: s.temps,
    diff: 1,
    ings: [['gnocchis', 800, 'g'], ['beurre', 20, 'g'], ...s.ings, ...SEL_POIVRE],
    etapes: [
      S('Faites dorer les gnocchis 6 à 8 min dans le beurre, dans une grande poêle, en les retournant.'),
      ...s.etapes.map((e) => S(e.replace(/aux pâtes|les pâtes/g, (m) => (m === 'aux pâtes' ? 'aux gnocchis' : 'les gnocchis')))),
      S('Servez aussitôt.'),
    ],
  });
}

// ---------------------------------------------------------------- Risottos
const RISOTTOS = [
  { nom: 'aux champignons', ings: [['champignons', 400, 'g']], prep: 'Faites sauter les champignons émincés 6 min dans une poêle, réservez.' },
  { nom: 'aux asperges', ings: [['asperges vertes', 400, 'g']], prep: 'Coupez les asperges en tronçons et faites-les cuire 4 min à l\'eau bouillante, réservez.' },
  { nom: 'au potiron', ings: [['potiron', 500, 'g']], prep: 'Ajoutez le potiron coupé en petits dés en même temps que le riz.' },
  { nom: 'aux petits pois et à la menthe', ings: [['petits pois', 300, 'g'], ['menthe', 1, 'botte']], prep: 'Ajoutez les petits pois 8 min avant la fin et la menthe ciselée au moment de servir.' },
  { nom: 'au citron', ings: [['citrons', 2, 'u']], prep: 'Ajoutez le zeste et le jus des citrons en fin de cuisson.' },
  { nom: 'au safran', ings: [['curcuma', 1, 'pincee']], prep: 'Délayez une pincée de safran ou de curcuma dans une louche de bouillon et ajoutez-la à mi-cuisson.' },
  { nom: 'aux crevettes', ings: [['crevettes', 400, 'g']], prep: 'Faites sauter les crevettes décortiquées 3 min, ajoutez-les en fin de cuisson.' },
  { nom: 'aux noix de Saint-Jacques', ings: [['noix de Saint-Jacques', 12, 'u']], prep: 'Saisissez les Saint-Jacques 1 min par face et déposez-les sur le risotto.' },
  { nom: 'au poulet et aux champignons', ings: [['blancs de poulet', 2, 'u'], ['champignons', 250, 'g']], prep: 'Faites dorer le poulet en dés et les champignons 8 min, ajoutez-les en fin de cuisson.' },
  { nom: 'aux poireaux', ings: [['poireaux', 400, 'g']], prep: 'Faites fondre les poireaux émincés avec l\'oignon, avant le riz.' },
  { nom: 'à la tomate et au basilic', ings: [['tomates concassées', 1, 'boite'], ['basilic', 1, 'botte']], prep: 'Ajoutez les tomates concassées après le vin, et le basilic au moment de servir.' },
  { nom: 'au chorizo', ings: [['chorizo', 120, 'g']], prep: 'Faites dorer le chorizo en dés avec l\'oignon.' },
  { nom: 'aux épinards et au chèvre', ings: [['pousses d\'épinards', 200, 'g'], ['chèvre frais', 100, 'g']], prep: 'Ajoutez les épinards 2 min avant la fin et le chèvre au moment de servir.' },
  { nom: 'à la courgette et au citron', ings: [['courgettes', 400, 'g'], ['citrons', 1, 'u']], prep: 'Ajoutez les courgettes en petits dés à mi-cuisson, puis le zeste de citron à la fin.' },
  { nom: 'aux lardons et aux petits pois', ings: [['lardons', 150, 'g'], ['petits pois', 250, 'g']], prep: 'Faites dorer les lardons avec l\'oignon et ajoutez les petits pois à mi-cuisson.' },
  { nom: 'à la betterave', ings: [['betteraves', 300, 'g']], prep: 'Mixez la moitié des betteraves cuites et ajoutez la purée et le reste en dés à mi-cuisson.' },
  { nom: 'au gorgonzola et aux noix', ings: [['gorgonzola', 100, 'g'], ['noix', 40, 'g']], prep: 'Remplacez le parmesan par le gorgonzola et parsemez de noix.' },
  { nom: 'aux fèves et au jambon cru', ings: [['fèves', 300, 'g'], ['jambon cru', 4, 'tranche']], prep: 'Ajoutez les fèves à mi-cuisson et le jambon cru en lanières au moment de servir.' },
  { nom: 'au saumon et à l\'aneth', ings: [['saumon fumé', 4, 'tranche'], ['aneth', 1, 'botte']], prep: 'Ajoutez le saumon fumé en lanières et l\'aneth hors du feu.' },
  { nom: 'aux légumes de printemps', ings: [['asperges vertes', 200, 'g'], ['petits pois', 200, 'g'], ['fèves', 200, 'g']], prep: 'Ajoutez les légumes en morceaux à mi-cuisson.' },
  { nom: 'au butternut et à la sauge', ings: [['butternut', 500, 'g'], ['sauge', 6, 'feuille']], prep: 'Ajoutez la butternut en petits dés avec le riz et la sauge ciselée à la fin.' },
  { nom: 'aux cèpes et au persil', ings: [['champignons', 400, 'g'], ['persil', 1, 'botte']], prep: 'Faites sauter les champignons avec un peu d\'ail, ajoutez-les en fin de cuisson avec le persil.' },
  { nom: 'au fenouil et à l\'orange', ings: [['fenouil', 1, 'u'], ['oranges', 1, 'u']], prep: 'Faites fondre le fenouil émincé avec l\'oignon, ajoutez le zeste d\'orange à la fin.' },
  { nom: 'aux tomates séchées et à la mozzarella', ings: [['tomates séchées', 80, 'g'], ['mozzarella', 1, 'u']], prep: 'Ajoutez les tomates séchées à mi-cuisson et la mozzarella en dés au moment de servir.' },
];
for (const r of RISOTTOS) {
  recette({
    nom: `Risotto ${r.nom}`,
    cat: 'pates_riz',
    temps: 40,
    diff: 2,
    ings: [['riz arborio', 320, 'g'], ['oignons', 1, 'u'], ['vin blanc', 10, 'cL'], ['bouillon de volaille', 2, 'cube'], ['beurre', 40, 'g'], ['parmesan', 60, 'g'], ['huile d\'olive', 2, 'cs'], ...r.ings, ...SEL_POIVRE],
    etapes: [
      S('Faites chauffer 1,2 L d\'eau avec les cubes de bouillon et gardez-le frémissant.'),
      S('Faites revenir l\'oignon émincé 3 min dans l\'huile d\'olive, ajoutez le riz et remuez 2 min jusqu\'à ce qu\'il devienne nacré.'),
      S('Versez le vin blanc et laissez-le s\'évaporer.'),
      S(r.prep),
      S('Ajoutez le bouillon louche par louche en remuant, en attendant qu\'il soit absorbé avant d\'en remettre, pendant 18 min environ.'),
      S('Hors du feu, ajoutez le beurre et le parmesan, couvrez 2 min puis mélangez. Servez aussitôt.'),
    ],
  });
}

// ---------------------------------------------------------------- Currys
const PROT_CURRY = [
  { nom: 'poulet', ing: ['blancs de poulet', 600, 'g'], type: 'viande' },
  { nom: 'boeuf', ing: ['boeuf à braiser', 700, 'g'], type: 'mijote' },
  { nom: 'agneau', ing: ['épaule d\'agneau', 800, 'g'], type: 'mijote' },
  { nom: 'crevettes', ing: ['crevettes', 500, 'g'], type: 'rapide' },
  { nom: 'cabillaud', ing: ['dos de cabillaud', 600, 'g'], type: 'rapide' },
  { nom: 'tofu', ing: ['tofu', 400, 'g'], type: 'vege' },
  { nom: 'pois chiches', ing: ['pois chiches', 2, 'boite'], type: 'vege' },
  { nom: 'lentilles corail', ing: ['lentilles corail', 250, 'g'], type: 'lentilles' },
  { nom: 'dinde', ing: ['escalopes de dinde', 600, 'g'], type: 'viande' },
  { nom: 'porc', ing: ['filet mignon de porc', 600, 'g'], type: 'viande' },
];
const LEG_CURRY = [
  { n: 'épinards', ing: ['pousses d\'épinards', 200, 'g'], tard: 1 },
  { n: 'patates douces', ing: ['patates douces', 500, 'g'] },
  { n: 'courgettes', ing: ['courgettes', 400, 'g'] },
  { n: 'aubergines', ing: ['aubergines', 400, 'g'] },
  { n: 'chou-fleur', ing: ['chou-fleur', 500, 'g'] },
  { n: 'poivrons', ing: ['poivrons rouges', 2, 'u'] },
  { n: 'haricots verts', ing: ['haricots verts', 300, 'g'] },
  { n: 'potiron', ing: ['potiron', 500, 'g'] },
  { n: 'petits pois', ing: ['petits pois', 300, 'g'], tard: 1 },
  { n: 'carottes', ing: ['carottes', 400, 'g'] },
  { n: 'champignons', ing: ['champignons', 300, 'g'] },
  { n: 'brocoli', ing: ['brocoli', 400, 'g'] },
];
const STYLES_CURRY = [
  { nom: (p) => `Curry rouge ${de(p)}`, pate: 'pâte de curry rouge', coco: 1 },
  { nom: (p) => `Curry vert ${de(p)}`, pate: 'pâte de curry vert', coco: 1, herbe: 'basilic' },
  { nom: (p) => `Curry jaune ${de(p)}`, pate: 'pâte de curry jaune', coco: 1 },
  { nom: (p) => `Curry massaman ${de(p)}`, pate: 'pâte de curry massaman', coco: 1, noix: 'cacahuètes' },
  { nom: (p) => `Korma ${de(p)}`, pate: 'pâte de curry korma', creme: 1, noix: 'noix de cajou' },
  { nom: (p) => `Tikka masala ${de(p)}`, pate: 'pâte tikka masala', tomate: 1 },
  { nom: (p) => `Curry coco ${de(p)}`, epices: 1, coco: 1 },
];
for (const p of PROT_CURRY) {
  for (const l of LEG_CURRY) {
    for (const st of STYLES_CURRY) {
      const v = I(l.ing[0]);
      const legLe = l.n === 'poivrons' ? 'les poivrons' : v.le;
      const nom = `${st.nom(p.nom)} ${l.n === 'poivrons' ? 'aux poivrons' : v.au}`;
      const ings = [
        p.ing, l.ing,
        ['oignons', 1, 'u'], ['ail', 2, 'gousse'], ['gingembre', 15, 'g'], ['huile', 2, 'cs'],
        ['riz basmati', 300, 'g'], ['coriandre', 1, 'botte'],
      ];
      if (st.pate) ings.push([st.pate, 3, 'cs']);
      if (st.epices) ings.push(['curry', 2, 'cc'], ['curcuma', 1, 'cc'], ['cumin', 1, 'cc']);
      if (st.coco) ings.push(['lait de coco', 40, 'cL']);
      if (st.creme) ings.push(['crème liquide', 20, 'cL']);
      if (st.tomate) ings.push(['tomates concassées', 1, 'boite'], ['yaourt nature', 1, 'u']);
      if (st.noix) ings.push([st.noix, 40, 'g']);
      if (st.herbe) ings.push([st.herbe, 1, 'botte']);
      if (st.coco && st.pate) ings.push(['sauce nuoc-mâm', 1, 'cs'], ['citrons verts', 1, 'u']);
      ings.push(...SEL_POIVRE);
      const sauce = st.coco ? 'le lait de coco' : st.creme ? 'la crème' : 'les tomates et le yaourt';
      const epice = st.pate ? 'la pâte de curry' : 'les épices';
      const etapes = [
        S('Émincez l\'oignon, hachez l\'ail et râpez le gingembre. Coupez {0} en morceaux.', legLe),
        S('Dans une cocotte, faites revenir l\'oignon, l\'ail et le gingembre 3 min dans l\'huile.'),
        S('Ajoutez {0} et faites revenir 1 min en remuant pour libérer les arômes.', epice),
      ];
      if (p.type === 'viande') {
        etapes.push(S('Ajoutez {0} et faites dorer 5 min.', p.nom === 'poulet' ? 'le poulet coupé en morceaux' : p.nom === 'dinde' ? 'la dinde coupée en morceaux' : 'le porc coupé en morceaux'));
        etapes.push(l.tard
          ? S('Versez {0} et laissez mijoter 15 min à feu doux. Ajoutez {1} et poursuivez 5 min.', sauce, legLe)
          : S('Versez {0}, ajoutez {1} et laissez mijoter 20 min à feu doux.', sauce, legLe));
      } else if (p.type === 'mijote') {
        etapes.push(S('Ajoutez la viande coupée en cubes et faites-la dorer 8 min sur toutes les faces.'));
        etapes.push(S('Versez {0} et 20 cL d\'eau, couvrez et laissez mijoter 1 h à feu doux.', sauce));
        etapes.push(S('Ajoutez {0} et poursuivez la cuisson {1} min.', legLe, l.tard ? 5 : 20));
      } else if (p.type === 'rapide') {
        etapes.push(S('Versez {0}, ajoutez les légumes et laissez mijoter 15 min.', sauce));
        etapes.push(S('Ajoutez {0} et laissez pocher 5 à 6 min dans la sauce, sans remuer trop fort.', p.nom === 'crevettes' ? 'les crevettes décortiquées' : 'le cabillaud en gros cubes'));
      } else if (p.type === 'lentilles') {
        etapes.push(S('Ajoutez les lentilles corail rincées, {0} et 40 cL d\'eau.', sauce));
        etapes.push(S('Ajoutez les légumes et laissez mijoter 20 min, jusqu\'à ce que les lentilles soient fondantes.'));
      } else {
        etapes.push(S('Versez {0}, ajoutez les légumes et laissez mijoter 15 min.', sauce));
        etapes.push(S('Ajoutez {0} et laissez mijoter encore 8 min.', p.nom === 'tofu' ? 'le tofu coupé en cubes et doré à la poêle' : 'les pois chiches égouttés'));
      }
      etapes.push(S('Pendant ce temps, faites cuire le riz basmati selon le paquet.'));
      if (st.coco && st.pate) etapes.push(S('Assaisonnez avec la sauce nuoc-mâm et le jus du citron vert.'));
      if (st.noix) etapes.push(S('Faites griller {0} 2 min à sec et concassez-les.', I(st.noix).le));
      etapes.push(S('Servez avec le riz, parsemé de {0} ciselée{1}.', st.herbe ? 'basilic et de coriandre' : 'coriandre', st.noix ? ` et ${I(st.noix).du}` : ''));
      recette({
        nom,
        cat: p.type === 'vege' || p.type === 'lentilles' ? 'vegetarien' : ['crevettes', 'cabillaud'].includes(p.nom) ? 'poissons' : 'viandes',
        temps: p.type === 'mijote' ? 110 : 45,
        diff: p.type === 'mijote' ? 2 : 1,
        ings,
        etapes,
      });
    }
  }
}

// ---------------------------------------------------------------- Woks et nouilles sautées
const PROT_WOK = [
  { nom: 'poulet', au: 'au poulet', ing: ['blancs de poulet', 500, 'g'], cuit: 'Faites sauter le poulet en lanières 5 min à feu vif, réservez.' },
  { nom: 'boeuf', au: 'au boeuf', ing: ['steaks de boeuf', 500, 'g'], cuit: 'Faites saisir le boeuf en fines lanières 2 min à feu très vif, réservez.' },
  { nom: 'porc', au: 'au porc', ing: ['filet mignon de porc', 500, 'g'], cuit: 'Faites sauter le porc en fines lanières 4 min à feu vif, réservez.' },
  { nom: 'crevettes', au: 'aux crevettes', ing: ['crevettes', 400, 'g'], cuit: 'Faites sauter les crevettes décortiquées 2 min, réservez.' },
  { nom: 'tofu', au: 'au tofu', ing: ['tofu', 400, 'g'], cuit: 'Faites dorer le tofu en cubes 6 min, réservez.' },
  { nom: 'dinde', au: 'à la dinde', ing: ['escalopes de dinde', 500, 'g'], cuit: 'Faites sauter la dinde en lanières 5 min à feu vif, réservez.' },
  { nom: 'canard', au: 'au canard', ing: ['magrets de canard', 2, 'u'], cuit: 'Retirez la peau des magrets, coupez la chair en lanières et faites-la saisir 2 min, réservez.' },
  { nom: 'calamars', au: 'aux calamars', ing: ['calamars', 400, 'g'], cuit: 'Faites saisir les calamars en anneaux 2 min à feu très vif, réservez.' },
];
const LEG_WOK = [
  { nom: 'aux poivrons et au brocoli', mots: 'poivrons et brocoli', ings: [['poivrons rouges', 1, 'u'], ['brocoli', 300, 'g']] },
  { nom: 'aux légumes croquants', mots: 'carottes, courgettes et pousses de soja', ings: [['carottes', 2, 'u'], ['courgettes', 1, 'u'], ['pousses de soja', 150, 'g']] },
  { nom: 'aux champignons et au pak choï', mots: 'champignons et pak choï', ings: [['champignons shiitakés', 200, 'g'], ['pak choï', 2, 'u']] },
  { nom: 'aux haricots verts', mots: 'haricots verts', ings: [['haricots verts', 400, 'g']] },
  { nom: 'aux poivrons et à l\'oignon', mots: 'poivrons et oignon', ings: [['poivrons rouges', 1, 'u'], ['poivrons verts', 1, 'u'], ['oignons', 1, 'u']] },
  { nom: 'au chou chinois et aux carottes', mots: 'chou chinois et carottes', ings: [['chou chinois', 400, 'g'], ['carottes', 2, 'u']] },
  { nom: 'aux courgettes et au maïs', mots: 'courgettes et maïs', ings: [['courgettes', 2, 'u'], ['maïs', 150, 'g']] },
  { nom: 'aux brocolis et aux noix de cajou', mots: 'brocoli et noix de cajou', ings: [['brocoli', 400, 'g'], ['noix de cajou', 50, 'g']] },
  { nom: 'aux pois gourmands et aux carottes', mots: 'petits pois et carottes', ings: [['petits pois', 250, 'g'], ['carottes', 2, 'u']] },
  { nom: 'à l\'ananas et aux poivrons', mots: 'ananas et poivrons', ings: [['ananas', 1, 'u'], ['poivrons rouges', 1, 'u']] },
  { nom: 'aux aubergines', mots: 'aubergines', ings: [['aubergines', 2, 'u']] },
  { nom: 'aux épinards et aux champignons', mots: 'épinards et champignons', ings: [['pousses d\'épinards', 200, 'g'], ['champignons', 250, 'g']] },
];
const SAUCES_WOK = [
  { nom: 'soja et gingembre', ings: [['sauce soja', 4, 'cs'], ['gingembre', 20, 'g'], ['miel', 1, 'cs']], mix: 'Mélangez la sauce soja, le gingembre râpé, le miel et 4 c. à soupe d\'eau.' },
  { nom: 'teriyaki', ings: [['sauce soja', 5, 'cs'], ['miel', 2, 'cs'], ['vinaigre de cidre', 1, 'cs'], ['fécule de maïs', 1, 'cc']], mix: 'Mélangez la sauce soja, le miel, le vinaigre, la fécule et 5 c. à soupe d\'eau.' },
  { nom: 'aigre-douce', ings: [['ketchup', 3, 'cs'], ['vinaigre de cidre', 2, 'cs'], ['sucre', 2, 'cs'], ['sauce soja', 2, 'cs'], ['fécule de maïs', 1, 'cc']], mix: 'Mélangez le ketchup, le vinaigre, le sucre, la sauce soja, la fécule et 10 cL d\'eau.' },
  { nom: 'cacahuète', ings: [['beurre de cacahuète', 3, 'cs'], ['sauce soja', 3, 'cs'], ['citrons verts', 1, 'u'], ['cacahuètes', 40, 'g']], mix: 'Mélangez le beurre de cacahuète, la sauce soja, le jus du citron vert et 8 c. à soupe d\'eau chaude.' },
  { nom: 'citronnelle', ings: [['citronnelle', 2, 'u'], ['sauce nuoc-mâm', 2, 'cs'], ['sucre', 1, 'cs'], ['citrons verts', 1, 'u']], mix: 'Hachez finement la citronnelle et mélangez-la avec le nuoc-mâm, le sucre et le jus du citron vert.' },
  { nom: 'à l\'huître', ings: [['sauce d\'huître', 4, 'cs'], ['sauce soja', 2, 'cs'], ['sucre', 1, 'cc']], mix: 'Mélangez la sauce d\'huître, la sauce soja, le sucre et 4 c. à soupe d\'eau.' },
  { nom: 'sésame et miel', ings: [['sauce soja', 4, 'cs'], ['miel', 2, 'cs'], ['huile de sésame', 1, 'cs'], ['graines de sésame', 2, 'cs']], mix: 'Mélangez la sauce soja, le miel et l\'huile de sésame. Gardez les graines de sésame pour la fin.' },
  { nom: 'pimentée', ings: [['sauce soja', 3, 'cs'], ['piments', 2, 'u'], ['sucre', 1, 'cs'], ['vinaigre de cidre', 1, 'cs']], mix: 'Mélangez la sauce soja, les piments hachés, le sucre et le vinaigre.' },
];
for (const p of PROT_WOK) {
  for (const l of LEG_WOK) {
    for (const s of SAUCES_WOK) {
      if (p.nom === 'canard' && s.nom === 'aigre-douce') continue;
      const base = [p.ing, ...l.ings, ...s.ings, ['ail', 2, 'gousse'], ['huile', 3, 'cs']];
      const commun = (feculent) => [
        S(s.mix),
        S('Coupez les légumes en lanières ou en petits morceaux. Hachez l\'ail.'),
        S('Chauffez 1 c. à soupe d\'huile dans un wok à feu vif.'),
        S(p.cuit),
        S('Ajoutez le reste de l\'huile et faites sauter l\'ail et les légumes 4 à 5 min : ils doivent rester croquants.'),
        S('Remettez {0}, ajoutez {1} et versez la sauce. Faites sauter 2 min jusqu\'à ce que tout soit bien enrobé.', p.nom === 'tofu' ? 'le tofu' : p.nom === 'crevettes' || p.nom === 'calamars' ? `les ${p.nom}` : p.nom === 'dinde' ? 'la dinde' : `le ${p.nom}`, feculent),
      ];
      recette({
        nom: `Wok ${de(p.nom)} ${l.nom}, sauce ${s.nom}`,
        cat: p.nom === 'tofu' ? 'vegetarien' : ['crevettes', 'calamars'].includes(p.nom) ? 'poissons' : 'viandes',
        temps: 30,
        diff: 1,
        ings: [...base, ['riz', 300, 'g']],
        etapes: [S('Faites cuire le riz selon le paquet.'), ...commun('rien d\'autre').slice(0, 5), S('Remettez {0} et versez la sauce. Faites sauter 2 min jusqu\'à ce que tout soit bien enrobé. Servez avec le riz.', p.nom === 'tofu' ? 'le tofu' : p.nom === 'crevettes' || p.nom === 'calamars' ? `les ${p.nom}` : p.nom === 'dinde' ? 'la dinde' : `le ${p.nom}`)],
      });
      recette({
        nom: `Nouilles sautées ${p.au}, ${l.mots}, sauce ${s.nom}`,
        cat: 'pates_riz',
        temps: 30,
        diff: 1,
        ings: [...base, ['nouilles chinoises', 300, 'g']],
        etapes: [S('Faites cuire les nouilles selon le paquet, égouttez-les et rincez-les à l\'eau froide.'), ...commun('les nouilles')],
      });
    }
  }
}

// ---------------------------------------------------------------- Poissons
const POISSONS = [
  { n: 'pavés de saumon', q: 4 }, { n: 'dos de cabillaud', q: 4 }, { n: 'filets de colin', q: 4 }, { n: 'filets de lieu noir', q: 4 },
  { n: 'filets de dorade', q: 4 }, { n: 'filets de bar', q: 4 }, { n: 'filets de truite', q: 4 }, { n: 'filets de merlu', q: 4 },
  { n: 'steaks de thon', q: 4 }, { n: 'filets de maquereau', q: 8 }, { n: 'filets de sole', q: 8 }, { n: 'sardines fraîches', q: 16, grill: 1 },
];
const CUISSONS = [
  { nom: 'au four', t: 25, etape: 'Déposez le poisson dans un plat huilé, salez, poivrez et enfournez 12 à 15 min à 200 °C.' },
  { nom: 'en papillote', t: 30, etape: 'Déposez chaque morceau de poisson sur une feuille de papier cuisson avec la garniture, salez, poivrez, refermez en papillote et enfournez 15 min à 200 °C.', papillote: 1 },
  { nom: 'à la poêle', t: 20, etape: 'Faites cuire le poisson 3 à 4 min par face dans une poêle chaude avec un filet d\'huile d\'olive, en commençant côté peau.' },
  { nom: 'grillé', t: 20, etape: 'Badigeonnez le poisson d\'huile d\'olive et faites-le griller 3 à 4 min par face sur un gril ou une plancha bien chaude.' },
];
const SAUCES_POISSON = [
  { nom: 'citron et aneth', ings: [['citrons', 1, 'u'], ['aneth', 1, 'botte'], ['huile d\'olive', 3, 'cs']], etape: 'Mélangez le jus du citron, l\'huile d\'olive et l\'aneth ciselé, et nappez le poisson.' },
  { nom: 'beurre blanc', ings: [['échalotes', 2, 'u'], ['vin blanc', 10, 'cL'], ['vinaigre de vin', 2, 'cs'], ['beurre', 120, 'g']], etape: 'Faites réduire l\'échalote hachée avec le vin et le vinaigre presque à sec, puis montez au fouet avec le beurre froid en dés, à feu très doux.' },
  { nom: 'sauce vierge', ings: [['tomates', 2, 'u'], ['basilic', 1, 'botte'], ['citrons', 1, 'u'], ['huile d\'olive', 6, 'cs'], ['olives noires', 40, 'g']], etape: 'Mélangez les tomates en petits dés, les olives hachées, le basilic, le jus de citron et l\'huile d\'olive, et versez sur le poisson.' },
  { nom: 'crème d\'épinards', ings: [['pousses d\'épinards', 300, 'g'], ['crème liquide', 15, 'cL'], ['ail', 1, 'gousse']], etape: 'Faites tomber les épinards avec l\'ail, ajoutez la crème et laissez réduire 3 min. Servez sous le poisson.' },
  { nom: 'pesto', ings: [['pesto', 4, 'cs'], ['pignons de pin', 30, 'g']], etape: 'Nappez le poisson de pesto et parsemez de pignons grillés.' },
  { nom: 'moutarde à l\'ancienne', ings: [['moutarde à l\'ancienne', 2, 'cs'], ['crème fraîche', 15, 'cL']], etape: 'Faites chauffer la crème avec la moutarde à l\'ancienne 2 min et nappez le poisson.' },
  { nom: 'croûte d\'herbes', ings: [['chapelure', 40, 'g'], ['persil', 1, 'botte'], ['parmesan', 30, 'g'], ['beurre', 30, 'g']], etape: 'Mélangez la chapelure, le persil haché, le parmesan et le beurre mou, et répartissez sur le poisson avant cuisson.' },
  { nom: 'chorizo et poivrons', ings: [['chorizo', 80, 'g'], ['poivrons rouges', 1, 'u'], ['huile d\'olive', 2, 'cs']], etape: 'Faites revenir le chorizo en dés et le poivron en lanières 8 min et servez avec le poisson.' },
  { nom: 'soja et sésame', ings: [['sauce soja', 3, 'cs'], ['huile de sésame', 1, 'cs'], ['graines de sésame', 1, 'cs'], ['gingembre', 10, 'g']], etape: 'Mélangez la sauce soja, l\'huile de sésame et le gingembre râpé, nappez le poisson et parsemez de sésame.' },
  { nom: 'tomates et olives', ings: [['tomates cerises', 250, 'g'], ['olives vertes', 60, 'g'], ['câpres', 1, 'cs'], ['huile d\'olive', 3, 'cs']], etape: 'Faites compoter les tomates cerises coupées en deux avec les olives et les câpres 6 min, et versez sur le poisson.' },
  { nom: 'fenouil et orange', ings: [['fenouil', 1, 'u'], ['oranges', 1, 'u'], ['huile d\'olive', 3, 'cs']], etape: 'Faites fondre le fenouil émincé 10 min dans l\'huile d\'olive avec le jus d\'orange, et servez sous le poisson.' },
  { nom: 'curry et coco', ings: [['lait de coco', 20, 'cL'], ['curry', 2, 'cc'], ['citrons verts', 1, 'u']], etape: 'Faites chauffer le lait de coco avec le curry 5 min, ajoutez le jus du citron vert et nappez le poisson.' },
];
const ACCOMP_POISSON = [
  { nom: 'riz', ings: [['riz', 250, 'g']], etape: 'Faites cuire le riz selon le paquet.' },
  { nom: 'pommes de terre vapeur', ings: [['pommes de terre', 800, 'g']], etape: 'Faites cuire les pommes de terre 20 min à la vapeur.' },
  { nom: 'haricots verts', ings: [['haricots verts', 500, 'g']], etape: 'Faites cuire les haricots verts 8 min à l\'eau bouillante salée.' },
];
for (const p of POISSONS) {
  for (const c of CUISSONS) {
    if (p.grill && c.papillote) continue;
    for (const s of SAUCES_POISSON) {
      if (c.papillote && ['beurre blanc', 'croûte d\'herbes'].includes(s.nom)) continue;
      if (p.grill && ['beurre blanc', 'crème d\'épinards', 'croûte d\'herbes', 'curry et coco'].includes(s.nom)) continue;
      for (const a of ACCOMP_POISSON) {
        recette({
          nom: `${p.n} ${c.nom}, ${s.nom}, ${a.nom}`,
          cat: 'poissons',
          temps: c.t + (a.nom === 'riz' ? 0 : 5),
          diff: s.nom === 'beurre blanc' ? 2 : 1,
          ings: [[p.n, p.q, 'u'], ...s.ings, ...a.ings, ['huile d\'olive', 1, 'cs'], ...SEL_POIVRE],
          etapes: [
            S(a.etape),
            s.nom === 'croûte d\'herbes' ? S(s.etape) : null,
            S('Rincez et séchez {0}.', I(p.n).le),
            S(c.etape),
            s.nom !== 'croûte d\'herbes' ? S(s.etape) : null,
            S('Servez aussitôt avec {0}.', a.nom === 'riz' ? 'le riz' : `les ${a.nom}`),
          ],
        });
      }
    }
  }
}

// ---------------------------------------------------------------- Viandes
// t : famille de viande pour la compatibilité des sauces
const VIANDES = [
  { n: 'blancs de poulet', q: [4, 'u'], t: 'volaille', cuit: 'Faites dorer les blancs de poulet 6 à 7 min par face dans une poêle avec l\'huile.' },
  { n: 'cuisses de poulet', q: [4, 'u'], t: 'volaille', cuit: 'Faites dorer les cuisses de poulet sur toutes les faces, puis enfournez-les 40 min à 200 °C.', long: 1 },
  { n: 'escalopes de dinde', q: [4, 'u'], t: 'volaille', cuit: 'Faites dorer les escalopes de dinde 4 min par face dans une poêle avec l\'huile.' },
  { n: 'filet mignon de porc', q: [1, 'u'], t: 'porc', cuit: 'Faites dorer le filet mignon sur toutes ses faces, puis enfournez-le 25 min à 180 °C. Laissez reposer 5 min avant de le trancher.', long: 1 },
  { n: 'côtes de porc', q: [4, 'u'], t: 'porc', cuit: 'Faites cuire les côtes de porc 5 à 6 min par face dans une poêle chaude.' },
  { n: 'steaks de boeuf', q: [4, 'u'], t: 'boeuf', cuit: 'Faites saisir les steaks 2 à 3 min par face dans une poêle très chaude, selon la cuisson désirée. Laissez reposer 3 min.' },
  { n: 'bavettes', q: [4, 'u'], t: 'boeuf', cuit: 'Faites saisir les bavettes 2 min par face dans une poêle très chaude. Laissez reposer 3 min.' },
  { n: 'côtelettes d\'agneau', q: [8, 'u'], t: 'agneau', cuit: 'Faites griller les côtelettes 3 min par face dans une poêle très chaude.' },
  { n: 'escalopes de veau', q: [4, 'u'], t: 'veau', cuit: 'Faites dorer les escalopes de veau 3 min par face dans le beurre.' },
  { n: 'magrets de canard', q: [2, 'u'], t: 'canard', cuit: 'Quadrillez la peau des magrets et faites-les cuire 8 min côté peau puis 4 min côté chair, à feu moyen. Laissez reposer 5 min avant de trancher.' },
  { n: 'saucisses de Toulouse', q: [4, 'u'], t: 'saucisse', cuit: 'Piquez les saucisses et faites-les cuire 15 min à feu moyen dans une poêle, en les retournant.' },
  { n: 'chipolatas', q: [8, 'u'], t: 'saucisse', cuit: 'Faites cuire les chipolatas 10 min à la poêle en les retournant.' },
];
const SAUCES_VIANDE = [
  { nom: 'à la moutarde', pour: ['volaille', 'porc', 'veau', 'saucisse'], ings: [['moutarde', 2, 'cs'], ['crème liquide', 20, 'cL']], etape: 'Déglacez la poêle avec la crème, ajoutez la moutarde et laissez réduire 3 min.' },
  { nom: 'à la crème et aux champignons', pour: ['volaille', 'porc', 'veau'], ings: [['champignons', 300, 'g'], ['crème liquide', 20, 'cL'], ['échalotes', 1, 'u']], etape: 'Faites sauter l\'échalote et les champignons émincés 6 min, ajoutez la crème et laissez réduire 3 min.' },
  { nom: 'au miel et au thym', pour: ['volaille', 'porc', 'canard', 'agneau'], ings: [['miel', 2, 'cs'], ['thym', 4, 'brin'], ['vinaigre balsamique', 1, 'cs']], etape: 'Déglacez avec le miel, le vinaigre balsamique et le thym, laissez caraméliser 2 min et nappez la viande.' },
  { nom: 'au citron', pour: ['volaille', 'veau'], ings: [['citrons', 1, 'u'], ['bouillon de volaille', 1, 'cube'], ['beurre', 20, 'g']], etape: 'Déglacez avec le jus du citron et 10 cL de bouillon, laissez réduire et montez avec le beurre.' },
  { nom: 'au curry', pour: ['volaille', 'porc'], ings: [['curry', 2, 'cc'], ['lait de coco', 20, 'cL']], etape: 'Ajoutez le curry dans la poêle, puis le lait de coco, et laissez mijoter 5 min.' },
  { nom: 'à la provençale', pour: ['volaille', 'porc', 'agneau', 'veau'], ings: [['tomates', 3, 'u'], ['ail', 2, 'gousse'], ['herbes de Provence', 1, 'cc'], ['olives noires', 50, 'g']], etape: 'Faites compoter les tomates en dés avec l\'ail, les herbes et les olives 10 min.' },
  { nom: 'au paprika', pour: ['volaille', 'porc'], ings: [['paprika', 2, 'cc'], ['oignons', 1, 'u'], ['crème fraîche', 15, 'cL']], etape: 'Faites revenir l\'oignon émincé avec le paprika, ajoutez la crème fraîche et laissez réduire 3 min.' },
  { nom: 'sauce au poivre', pour: ['boeuf', 'canard'], ings: [['poivre', 1, 'cs'], ['crème liquide', 20, 'cL'], ['bouillon de boeuf', 1, 'cube']], etape: 'Déglacez avec 5 cL de bouillon, ajoutez le poivre concassé et la crème, laissez réduire 4 min.' },
  { nom: 'au cidre', pour: ['volaille', 'porc', 'saucisse'], ings: [['cidre', 25, 'cL'], ['pommes', 2, 'u'], ['crème fraîche', 10, 'cL']], etape: 'Faites dorer les pommes en quartiers, déglacez au cidre, laissez réduire de moitié puis ajoutez la crème.' },
  { nom: 'aux pruneaux', pour: ['porc', 'agneau', 'canard', 'volaille'], ings: [['pruneaux', 150, 'g'], ['oignons', 1, 'u'], ['bouillon de volaille', 1, 'cube']], etape: 'Faites revenir l\'oignon, ajoutez les pruneaux et 20 cL de bouillon et laissez mijoter 15 min.' },
  { nom: 'à la bière', pour: ['porc', 'saucisse', 'boeuf'], ings: [['bière', 33, 'cL'], ['oignons', 2, 'u'], ['sucre roux', 1, 'cs']], etape: 'Faites fondre les oignons émincés avec le sucre roux 10 min, déglacez à la bière et laissez réduire 10 min.' },
  { nom: 'au vin blanc et à l\'estragon', pour: ['volaille', 'veau'], ings: [['vin blanc', 15, 'cL'], ['estragon', 1, 'botte'], ['crème liquide', 15, 'cL']], etape: 'Déglacez au vin blanc, laissez réduire, ajoutez la crème et l\'estragon ciselé.' },
  { nom: 'à l\'ail et au persil', pour: ['boeuf', 'agneau', 'volaille', 'veau'], ings: [['ail', 4, 'gousse'], ['persil', 1, 'botte'], ['beurre', 40, 'g']], etape: 'Faites mousser le beurre avec l\'ail et le persil hachés 1 min et versez sur la viande.' },
  { nom: 'aux olives', pour: ['volaille', 'agneau', 'veau'], ings: [['olives vertes', 100, 'g'], ['tomates concassées', 1, 'boite'], ['oignons', 1, 'u']], etape: 'Faites revenir l\'oignon, ajoutez les tomates et les olives et laissez mijoter 15 min.' },
  { nom: 'sauce barbecue', pour: ['volaille', 'porc', 'saucisse', 'boeuf'], ings: [['sauce barbecue', 6, 'cs']], etape: 'Badigeonnez la viande de sauce barbecue en fin de cuisson et laissez caraméliser 2 min.' },
  { nom: 'au roquefort', pour: ['boeuf', 'porc', 'volaille'], ings: [['roquefort', 80, 'g'], ['crème liquide', 20, 'cL']], etape: 'Faites fondre le roquefort dans la crème à feu doux et nappez la viande.' },
  { nom: 'aux échalotes', pour: ['boeuf', 'veau'], ings: [['échalotes', 4, 'u'], ['vin rouge', 15, 'cL'], ['beurre', 30, 'g']], etape: 'Faites fondre les échalotes émincées dans le beurre, déglacez au vin rouge et laissez réduire de moitié.' },
  { nom: 'au sirop d\'érable', pour: ['porc', 'canard', 'volaille'], ings: [['sirop d\'érable', 3, 'cs'], ['sauce soja', 2, 'cs']], etape: 'Déglacez avec le sirop d\'érable et la sauce soja, laissez caraméliser 2 min et nappez la viande.' },
  { nom: 'aux figues', pour: ['canard', 'porc', 'agneau'], ings: [['figues', 6, 'u'], ['miel', 1, 'cs'], ['vinaigre balsamique', 2, 'cs']], etape: 'Faites rôtir les figues coupées en deux 5 min avec le miel et le vinaigre balsamique.' },
  { nom: 'à la menthe', pour: ['agneau'], ings: [['menthe', 1, 'botte'], ['yaourt grec', 1, 'u'], ['citrons', 1, 'u']], etape: 'Mélangez le yaourt grec, la menthe ciselée et le jus de citron, et servez avec la viande.' },
];
const ACCOMP_VIANDE = [
  { nom: 'purée maison', long: 1, ings: [['pommes de terre', 1000, 'g'], ['lait', 15, 'cL'], ['beurre', 40, 'g']], etape: 'Faites cuire les pommes de terre épluchées 20 min à l\'eau salée, puis écrasez-les avec le lait chaud et le beurre.' },
  { nom: 'pommes de terre sautées', long: 1, ings: [['pommes de terre', 900, 'g']], etape: 'Faites sauter les pommes de terre en cubes 20 min à la poêle avec un filet d\'huile, en remuant.' },
  { nom: 'riz', ings: [['riz', 250, 'g']], etape: 'Faites cuire le riz selon le paquet.' },
  { nom: 'haricots verts', ings: [['haricots verts', 500, 'g']], etape: 'Faites cuire les haricots verts 8 min à l\'eau bouillante salée.' },
  { nom: 'frites au four', long: 1, ings: [['pommes de terre', 1000, 'g']], etape: 'Coupez les pommes de terre en frites, mélangez-les avec 2 c. à soupe d\'huile et faites-les cuire 35 min à 220 °C en les retournant.' },
  { nom: 'semoule', ings: [['semoule', 250, 'g']], etape: 'Versez la semoule dans un saladier, couvrez du même volume d\'eau bouillante salée, laissez gonfler 5 min et égrainez à la fourchette.' },
  { nom: 'légumes rôtis', long: 1, ings: [['carottes', 3, 'u'], ['courgettes', 2, 'u'], ['poivrons rouges', 1, 'u']], etape: 'Coupez les légumes en morceaux et faites-les rôtir 30 min à 210 °C avec un filet d\'huile d\'olive.' },
  { nom: 'tagliatelles', ings: [['tagliatelles', 300, 'g']], etape: 'Faites cuire les tagliatelles selon le paquet.' },
  { nom: 'polenta crémeuse', ings: [['polenta', 200, 'g'], ['lait', 50, 'cL'], ['parmesan', 40, 'g']], etape: 'Versez la polenta en pluie dans le lait chaud mélangé à 50 cL d\'eau, remuez 5 min puis ajoutez le parmesan.' },
  { nom: 'salade verte', ings: [['salade verte', 1, 'u'], ['vinaigre de vin', 1, 'cs'], ['moutarde', 1, 'cc']], etape: 'Lavez la salade et préparez une vinaigrette avec la moutarde, le vinaigre et 3 c. à soupe d\'huile.' },
];
for (const v of VIANDES) {
  for (const s of SAUCES_VIANDE) {
    if (!s.pour.includes(v.t)) continue;
    for (const a of ACCOMP_VIANDE) {
      if (v.t === 'saucisse' && a.nom === 'tagliatelles') continue;
      recette({
        nom: `${v.n} ${s.nom}, ${a.nom}`,
        cat: 'viandes',
        temps: (v.long ? 50 : 30) + (a.nom === 'frites au four' ? 15 : 0),
        diff: v.t === 'canard' ? 2 : 1,
        ings: [[v.n, ...v.q], ...s.ings, ...a.ings, ['huile', 2, 'cs'], ...SEL_POIVRE],
        etapes: [
          a.long ? S(a.etape) : null,
          S('Sortez la viande du réfrigérateur 15 min avant la cuisson. Salez et poivrez.'),
          S(v.cuit),
          a.long ? null : S('Pendant ce temps : {0}', a.etape.charAt(0).toLowerCase() + a.etape.slice(1)),
          S(s.etape),
          S('Servez la viande nappée de sauce avec {0}.', a.nom.startsWith('pommes') || a.nom.startsWith('frites') || a.nom.startsWith('haricots') || a.nom.startsWith('légumes') || a.nom.startsWith('tagliatelles') ? `les ${a.nom}` : a.nom === 'riz' ? 'le riz' : a.nom === 'semoule' ? 'la semoule' : `la ${a.nom}`),
        ],
      });
    }
  }
}

module.exports = { ETAPE_ASSAISONNER };
