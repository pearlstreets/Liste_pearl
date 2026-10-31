# Regles de calcul des champs recette (deduites des 474 recettes existantes)

Corpus : 474 recettes (330 plats, 61 entrees, 52 desserts, 31 petits-dejeuners), toutes servings = 4, 199 ingredients, 3 a 6 etapes (359 recettes en 4 etapes).
Scripts d'analyse (lecture seule) : dossier gen/ du scratchpad, fichiers lib.js et a1.js a a20.js.

## 0. A lire d'abord : le corpus a deux populations

Les recettes ne sont pas toutes etiquetees avec la meme rigueur. L'ordre du fichier recipes.json compte :

- Indices 0 a 343 (344 recettes) : etiquetage tres regulier, regles nettes. Le tag halal-possible n'existe QUE dans cette zone (dernier tag halal a l'indice 343 ; 0 tag halal sur les 130 suivantes, dont 104 eligibles).
- Indices 0 a 375 (376 recettes) : regles rapide, economique, leger quasi deterministes (96 a 99 %).
- Indices 376 a 473 (98 dernieres, de sundubu-jjigae-tofu a galettes-patate-douce-oeuf, cuisines du monde et variantes) : etiquetage plus lache ou autre calibration (rapide jusqu'a 30 min, economique et leger plus stricts, 50 % sans aucune saison, 23 freezable sur 98 contre 153 sur 376, aucun halal).

Les taux d'accord ci-dessous sont donnes sur les 474, et sur la zone propre quand l'ecart est net. Pour 11 754 recettes, les regles de la zone propre (0 a 375) sont a retenir comme reference ; les points ou la zone recente diverge sont signales "A TRANCHER".

Cout par portion (identique a validate-menus.js) : somme sur les ingredients non pantry et non optionnels de pricePerUnit x qty (pack en u) ou pricePerKgOrL x qty / 1000, divisee par 4. Moyenne du corpus : 1,97 EUR. Un ingredient en cs ou cc doit etre pantry, donc ne compte pas.

## 1. Tags alimentaires : derives des allergenes des ingredients (deterministe)

Definitions utilisees par validate-menus.js : "viande" = au moins un ingredient du rayon viandes-poissons OU allergene crustaces. Allergenes presents dans ingredients.json : porc, poisson, oeuf, lait, soja, gluten, miel, fruits-a-coque, sesame, crustaces.

| Tag | Regle | Accord sur 474 | Cas hors regle |
|---|---|---|---|
| vegetarien | aucune viande ni poisson ni crustace | 240/240 tags, 100 % | aucun. Les oeufs et le lait n'empechent pas. 3 recettes vegetariennes contiennent du vin |
| vegan | vegetarien ET aucun allergene lait, oeuf, miel | 99,8 % | bourguignon-champignons-lentilles (vin rouge) non tague vegan alors que la regle le dit ; 1 recette vegan contient du vin : AMBIGU pour le vin, ni regle claire ni validateur. Prudence : exclure vin, biere, cidre du vegan |
| sans-gluten | aucun allergene gluten, ET aucune charcuterie transformee (saucisse, saucisse-fumee, boudin-noir, petit-sale) ET pas de sarrasin | 98,1 % | 7 salades ou entrees avec moutarde + vinaigre + charcuterie (jambon, lardons, chorizo) non taguees (precaution). Moutarde seule : 11 recettes taguees sans-gluten contre 6 non taguees, donc moutarde n'exclut pas toujours : AMBIGU. Le bouillon (allergenes gluten et lait), la sauce soja, le speculoos portent gluten : 0 recette avec bouillon n'est taguee sans-gluten ni sans-lactose |
| sans-lactose | aucun allergene lait ET aucune saucisse, saucisse-fumee, petit-sale, boudin-noir | 99,6 % | rougail-saucisses, petit-sale-lentilles (taguees malgre la saucisse) |
| sans-porc | aucun allergene porc (porc-filet, porc-echine, saucisse, saucisse-fumee, lardons, jambon-blanc, chorizo, petit-sale, boudin-noir) | 100 % (416 taguees) | aucun |
| sans-fruits-a-coque | aucun allergene fruits-a-coque | 100 % (435 taguees) | aucun |
| halal-possible | sans-porc ET aucun vin-blanc, vin-rouge, biere, cidre | 100 % sur les indices 0 a 343 (297 taguees, 0 faux positif) ; 95,7 % sur 0 a 375 ; 78 % sur 474 | OUI l'alcool exclut : sur 21 recettes avec alcool, 0 taguee halal. Le vinaigre et la sauce soja ne l'excluent pas (15 recettes au vinaigre sans halal sont dans la zone recente, pas une exclusion). Les 88 eligibles non tagues sont presque tous dans les 98 dernieres : oubli, pas une regle. Poisson et volaille sont halal-possible |

Logique entre tags : vegan implique vegetarien (72/72) et sans-lactose (72/72) ; vegetarien implique sans-porc (240/240) ; vegetarien tague halal-possible dans 172 cas sur 240 (les non-eligibles sont dans la zone recente ou ont de l'alcool).

Regle de coherence imposee par le validateur (a respecter en generation) : un tag alimentaire ne peut jamais contredire les allergenes (vegetarien avec viande, vegan avec lait ou oeuf ou miel, sans-gluten avec gluten, sans-lactose avec lait, sans-porc ou halal avec porc, sans-fruits-a-coque avec fruits a coque sont des erreurs bloquantes).

## 2. Temps, cout, calories : seuils

### rapide (timeMin)
- Zone propre (0 a 375) : rapide = timeMin <= 20 min ET aucun minuteur de repos long (repos < 60 min). Accord 99,5 %.
- Distribution des taguees rapide (88) : mediane 20 min, p90 25, max 30 ; non taguees : mediane 50.
- Seuil unique <= 20 sur 474 : 95,6 % (73 vrais positifs, 6 faux positifs, 15 faux negatifs). Les faux positifs sont des desserts avec attente : mouhalabieh, panna cotta, thiakry, shrikhand-yaourt-mangue, chia-coco-mangue (repos au frais), polenta-sucree-poire-miel.
- A TRANCHER : les 98 dernieres recettes sont taguees rapide jusqu'a 30 min (31 taguees, 96,9 % avec le seuil 30, mais les plats et entrees de 25 a 30 min des zones anciennes ne le sont jamais : 0 sur environ 60). Seuil 30 applique a tout le corpus : 86,1 % seulement (66 faux positifs). Recommandation : seuil 20 min (le plus coherent avec 79 % du corpus) ; ou 30 min si l'on veut davantage de rapides, avec condition supplementaire "somme des minuteurs feu et four <= 20 min" (qui tient pour 100 % des rapides recentes).
- Recouvrement : sans-cuisson et rapide ensemble sur 29 des 46 sans-cuisson ; 59 rapides ne sont pas sans-cuisson.

### economique (cout par portion)
- Zone propre : seuils par type de plat, accord 96,0 % sur 0 a 375 (258 vrais positifs, 12 faux positifs, 3 faux negatifs), 88,4 % sur 474 :
  - plat <= 2,60 EUR
  - entree <= 1,90 EUR
  - dessert <= 1,55 EUR
  - petit-dejeuner <= 1,40 EUR
- Un seuil unique <= 2,5 EUR donne 84,8 % ; <= 2,2 donne 80,0 % ; <= 3,0 donne 80,6 %.
- Cout des recettes taguees : p25 0,96, mediane 1,38, p75 1,95, p90 2,36 EUR, max 4,15 ; non taguees : mediane 2,92, p75 3,66, max 5,55.
- Ambigu : dans les 98 dernieres le tag suit mal le cout (goulasch-hongrois-boeuf-paprika a 4,15 EUR tague economique ; pates-ricotta-courgettes a 1,58 non tague) : 70 % d'accord avec les seuils ci-dessus. Les prix ont peut-etre bouge depuis l'etiquetage. A TRANCHER : garder les seuils par type.

### leger (kcal par portion)
- Zone propre : seuils par type, accord 98,9 % sur 0 a 375, 93,2 % sur 474 :
  - plat <= 450 kcal
  - entree <= 240 kcal
  - dessert <= 250 kcal
  - petit-dejeuner <= 210 kcal
- Seuil unique <= 450 : 77,0 % (109 faux positifs). Taguees leger : plat de 280 a 450 (mediane 410), entree de 60 a 330 (mediane 170), dessert de 100 a 250, pdj de 190 a 410.
- Les 98 dernieres sont plus strictes : plat leger seulement <= 380 environ (18 plats a <= 450 kcal non tagues, surtout poissons et salades). A TRANCHER : retenir 450 pour les plats (regle historique) ou 400 si l'on veut etre plus sobre.

## 3. Saisons (hiver, printemps, ete, automne)

Tags les plus subjectifs du corpus. Repartition des jeux de saisons : aucune saison 144 (30 %), hiver+automne 128, ete seul 61, hiver seul 47, printemps+ete 26, ete+automne 18, printemps seul 14, printemps+automne 14, automne seul 10, hiver+printemps+automne 8, hiver+printemps 3, hiver+ete 1. Hiver et automne vont ensemble dans 136 cas (93 recettes n'ont que l'un des deux). Jamais les 4 saisons : "toute l'annee" = aucun tag saison.

Taux de tag par categorie (hiver / printemps / ete / automne ; sans saison) :
- plat >= 60 min : 61 % / 12 / 19 / 54 ; sans saison 15 %
- plat <= 30 min : 19 / 16 / 20 / 21 ; sans saison 53 %
- soupe, veloute, potage (35) : 71 / 9 / 11 / 60
- gratin (26) : 69 / 12 / 12 / 69
- mijote, daube, cassoulet, chili (14) : 93 / 7 / 0 / 71
- curry (7) : 71 / 0 / 0 / 57
- salade (28) : 25 / 11 / 46 / 14 ; sans saison 29 %
- entree : ete 46 % ; sans-cuisson : ete 46 %, sans saison 41 %
- glace, sorbet, semifreddo (3) : ete 100 %
- grill, brochette (6) : ete 67 %, printemps 33 %
- petit-dejeuner : sans saison 58 % ; dessert : sans saison 38 %

Ingredients : part des recettes contenant l'ingredient qui portent le tag (hiver / ete) :
- hiver : chou-vert 100, courge 100, poireau 96, navet 88, chou-fleur 83, echalote 79, champignon 77, chou 71, pomme-de-terre 69, carotte 63, gingembre 56, pomme 53 (automne 76)
- ete : mangue 100, fraise 100, menthe 78, aubergine 73, tomate fraiche 69, courgette 64, basilic 63, citron-vert 62, concombre 57, haricot-vert 56, poivron 50, salade 43, tomate-cerise 44
- printemps : aucun ingredient frequent (n >= 10) ne depasse 40 % ; seuls de petits echantillons montent plus haut (feves 2 sur 3, ricotta 5 sur 8, epinard-surgele 6 sur 10). 65 recettes en tout, dont 47 plats.
- automne : pomme 76, champignon 71, poireau 68, patate-douce 71, aubergine 53.

Regle proposee, a utiliser comme heuristique de depart :
1. ete si ingredient d'ete fort (tomate fraiche, courgette, aubergine, poivron, concombre, basilic, menthe, fraise, mangue, haricot-vert, citron-vert, ananas) OU titre salade, glace, sorbet, carpaccio, brochette, grill OU sans-cuisson (hors petit-dejeuner).
2. hiver ET automne ensemble si ingredient d'hiver (poireau, courge, potimarron, chou et variantes, navet, panais, endive, patate-douce, betterave, pomme, poire, champignon) OU titre soupe, gratin, mijote, curry, potee, lasagnes OU plat de 60 min ou plus, sauf si un ingredient d'ete fort est la sans ingredient d'hiver.
3. printemps si radis, petits-pois, feves, oignon-nouveau, fraise, cresson ou titre "printanier". Regle faible.
4. sinon aucune saison.
Accord sur les 376 premieres : hiver 76,6 %, ete 81,1 %, automne 69,9 %, printemps 83,0 % (mais rappel 11 % seulement : quasi non derivable), jeu de saisons exact identique dans 38,6 % des cas sur 474. Conclusion : les saisons ne sont deductibles que de facon grossiere ; le cas "plat de moins de 30 min sans ingredient saisonnier = aucune saison" est le plus sur (53 %).

## 4. Four, sans-cuisson, minuteurs

### four et ovenTempC
- tag four = presence de ovenTempC OU d'un stepKinds "four" : accord 98,9 % (137 vrais positifs, 3 faux positifs, 2 faux negatifs). 139 recettes ont le tag four, 139 ont ovenTempC (137 en commun).
- Le texte seul ("four" ou "enfourn" dans une etape) n'est pas fiable : 126/139 seulement avec 10 faux positifs (par exemple "ecraser a la fourchette").
- ovenTempC : entier entre 150 et 230, multiple de 10 : 200 (61 recettes, 44 %), 180 (35), 190 (17), 220 (8), 210 (5), 160 (5), 230 (4), 170 (3), 150 (1). Il est egal a la temperature ecrite dans le texte pour 133 recettes sur 139 (les 6 autres sont des recettes recentes ou la temperature n'apparait pas dans les etapes). Le validateur exige un entier de 100 a 280.
- Une etape "Prechauffer le four a X °C" existe dans 108 recettes, mais ne porte un minuteur que dans 16 : le prechauffage n'a en general PAS de minuteur.

### sans-cuisson
- sans-cuisson (46 recettes : 2 plats, 19 entrees, 19 desserts, 6 pdj) = aucun verbe de cuisson dans les etapes (cuire, chauffer, poele, saisir, revenir, dorer, bouillir, mijoter, four, griller, rotir, frire, vapeur, casserole) ET aucun minuteur feu ou four. Accord global 96,2 % (34 vrais positifs, 6 faux positifs, 12 faux negatifs).
- Faux negatifs : recettes taguees sans-cuisson malgre un geste leger (ganache : on chauffe la creme ; compote ; "ecraser a la fourchette" detecte a tort comme four). Ils peuvent avoir un minuteur de repos (29 sur 46 n'ont aucun minuteur, 17 ont un minuteur de repos ou, rarement, feu).
- Faux positifs : nouilles-sautees-legumes-oeuf, salade-chevre-chaud-noix, mouhalabieh, tiramisu, shrikhand, salade-boulgour-saumon-fume (cuisson cachee ou formulee autrement).
- Un plat sans minuteur n'est pas forcement sans-cuisson : 100 recettes n'ont aucun minuteur, dont 53 plats non taggues sans-cuisson (sautes courts de moins de 10 min).

### stepTimers, stepKinds
- 374 recettes sur 474 (79 %) ont au moins un minuteur ; 644 minuteurs en tout. Nombre par recette : 1 (198), 2 (101), 3 (57), 4 (17), 5 (1). Les 100 sans minuteur : 55 plats (timeMin mediane 30), 23 entrees, 6 desserts, 16 pdj.
- Cle = indice d'etape en base 0 (en chaine "0", "3"). Valeur = SECONDES, toujours multiple de 60 (642 sur 644). Plage de 60 s (1 min) a 21 600 s (6 h).
- stepKinds : meme cles que stepTimers, valeurs "four", "feu" ou "repos" (validateur : un stepKinds sans minuteur est une erreur, un minuteur sans stepKinds aussi). Repartition : feu 432 (67 %), four 149 (23 %), repos 63 (10 %).
- Valeurs : four mediane 25 min (p10 11, p90 45, max 150) ; feu mediane 15 min (p10 4, p90 35, max 165) ; repos mediane 30 min (p10 10, p90 180, max 360).
- Position : 134 minuteurs sur l'etape 0, 351 en milieu, 159 sur la derniere etape.
- La valeur est la duree ecrite dans l'etape, convertie en secondes : 560 minuteurs sur 644 sont dans la fourchette du texte. S'il y a plusieurs durees dans l'etape, c'est la plus longue qui est retenue (9 cas sur 14) ; une fourchette "a a b minutes" est rare (1 cas) ; 4 cas sont une somme. Pour les cuissons sans duree ecrite (cuire le riz selon le paquet) la valeur est posee par convention (riz 15 min, risotto 18 a 19 min, etc.) : 80 minuteurs ne se lisent pas dans le texte, surtout dans les recettes recentes dont les etapes ne chiffrent pas la duree.
- Choix du "kind" : "four" pour toute etape de cuisson ou de gratinage au four (y compris "Cuire 35 minutes a 190 °C" sans le mot four, des qu'il y a un ovenTempC) ; "repos" pour marinade, refroidissement, prise au frais, congelation, levee, trempage ; "feu" pour poele, casserole, bouillon, mijotage, cuisson des pates et du riz. Detection par mots-cles : 88 % d'accord (569/644) ; les erreurs viennent presque toutes de "Cuire N minutes" dans une recette a four (a classer four si ovenTempC est defini).
- Coherence a respecter : timeMin >= somme des minuteurs feu et four (473 recettes sur 474).

## 5. timeMin, difficulty

### timeMin
- Toujours un multiple de 5 (474/474). Plat : 15 a 230, mediane 50 ; entree 10 a 60 ; dessert 15 a 370 ; pdj 5 a 100.
- Structure : timeMin = preparation + somme des minuteurs feu et four + minuteurs de repos courts. Preparation implicite (timeMin moins somme des minuteurs) : plat mediane 20 min (p10 10, p90 30), entree 14, dessert 15, pdj 12. Sans minuteur : plat mediane 30 (15 a 45), entree 15, dessert 15, pdj 15.
- Regression sur les plats : timeMin ~ 20,4 + 1,0 x (minutes feu et four) + 0,95 x (minutes repos) + 0,12 x (nombre d'ingredients), puis arrondi a 5 ; 74 % des plats dans +/- 10 min (erreur mediane 6 min).
- Les repos de plus de 60 min ne sont comptes que partiellement : 6 desserts ont timeMin inferieur au minuteur de repos (mousse-chocolat-noir 30 min pour 180 min de repos, tiramisu 30 pour 240, panna-cotta 20 pour 120). Regle : repos long (>= 120 min) = temps actif seulement dans timeMin ; repos <= 60 min compte en entier.

### difficulty (1 a 3)
- Repartition : 1 = 345 (72,8 %), 2 = 124 (26,2 %), 3 = 5 (1,1 %). Plats : 226 / 100 / 4 ; entrees 52 / 9 / 0 ; desserts 42 / 9 / 1 ; pdj 25 / 6 / 0.
- difficulty 3 uniquement : chou-farci-familial, souffle-fromage-salade, pastilla-poulet-amandes, makloubeh-au-poulet-riz-renverse, iles-flottantes-vanille (techniques : farce, souffle, feuilletage, retournement, blancs en neige).
- difficulty 2 : timeMin mediane 60 (p25 40, p75 80), 10 ingredients (contre 8), 5 etapes ; mijotes longs (bourguignon, daube, blanquette, navarin, coq au vin, carbonade), farcis, lasagnes, risotto, tajine, couscous, paella, moussaka, pizza maison, pate ou friture maison.
- Aucune regle chiffree ne depasse 75 % d'accord (seuils de temps : 69 a 72 % ; "1 par defaut" : 72,8 %). Regle la moins mauvaise : 1 par defaut ; 2 si timeMin >= 75 OU recette de type farci, mijote long a 2 phases, risotto, lasagnes, pate maison ; 3 reserve aux techniques delicates. Accord 75,1 %. DIFFICILE a deduire, a laisser au jugement de la generation.

## 6. Conservation : leftoverOk, keepDays, freezable, batch

### Regles dures imposees par validate-menus.js
- keepDays entier de 1 a 14.
- Poisson ou crustaces (75 recettes, soit 16 %) : keepDays <= 2 et freezable = false, toujours (43 a 1 jour, 32 a 2 jours). Le seul critere est l'allergene poisson ou crustaces.

### leftoverOk (restes bons)
- Global : 340 vrais sur 474 (72 %). Plats 73 %, entrees 70 %, desserts 71 %, pdj 48 %.
- leftoverOk faux (139 recettes) : keepDays = 1 dans 107 cas (77 %), 2 dans 29, 3 dans 3 ; presque jamais freezable (4 cas).
- Typologie des "non" : fritures et croustillants (nuggets, burgers, tacos, wraps, falafels, galettes), croque-monsieur, pizza, omelettes et oeufs, risotto et pates minute, poisson delicat (papillote, colin, saumon laque), salades, sautes minute.
- Typologie des "oui" : mijotes (21 plats : 20 oui), gratins et pates au four (33 : 31 oui), soupes (28 : 19), tartes (8 : 7), feculents et riz (58 : 41), salades (15 : 8 seulement).

### keepDays (accord 69,2 % en prenant le mode de chaque cellule)
| Cellule | n | Repartition keepDays | Regle |
|---|---|---|---|
| plat ou entree, hors poisson, leftoverOk faux, non freezable | 60 | 1 : 43, 2 : 17 | 1 |
| plat ou entree, hors poisson, leftoverOk vrai, non freezable | 101 | 1 : 8, 2 : 61, 3 : 31, 4 : 1 | 2 |
| plat ou entree, hors poisson, leftoverOk vrai, freezable | 152 | 2 : 27, 3 : 106, 4 : 19 | 3 (4 pour mijotes et soupes denses) |
| poisson ou crustaces, leftoverOk faux | 45 | 1 : 39, 2 : 6 | 1 |
| poisson ou crustaces, leftoverOk vrai | 30 | 1 : 4, 2 : 26 | 2 |
| dessert, leftoverOk faux | 15 | 1 : 10, 2 : 4, 3 : 1 | 1 |
| dessert, leftoverOk vrai, non freezable | 21 | 1 : 3, 2 : 10, 3 : 8 | 2 |
| dessert, leftoverOk vrai, freezable | 16 | 3 : 6, 4 : 4, 5 : 6 | 3 a 5 (biscuits, truffes, energy balls, cookies : 5) |
| petit-dejeuner, leftoverOk faux | 15 | 1 : 15 | 1 |
| petit-dejeuner, leftoverOk vrai | 16 | 2 : 9, 3 : 3, 1 : 2, 14 : 1 | 2 (granola 14) |

Moyennes par famille de plats : poissons 1 a 2 ; volaille 2 a 3 ; viande ou charcuterie 3 (62 sur 101) ; sans viande 2 a 3. Les mijotes sont a 3 ou 4 (18 sur 21), les soupes de 1 a 3. Les salades sont a 1 (8 sur 15). Le texte du plat (viande, feculent, oeuf, salade) ne separe pas 2 de 3 de facon nette (moyennes toutes entre 2,0 et 2,4 dans la cellule du milieu) : AMBIGU entre 2 et 3.

### freezable
- 176 recettes (37 %) : 141 plats, 14 entrees, 16 desserts, 5 pdj. freezable implique leftoverOk (172/176) et keepDays >= 2 (2 : 31, 3 : 116, 4 : 23, 5 : 6). Jamais poisson ni crustaces.
- Parmi les plats leftoverOk hors poisson, taux de congelation : batch 96 %, mijote (minuteur feu >= 20 min) 81 %, legumineuses 80 %, sauce (tomate, creme, lait de coco, bouillon) 73 %, viande 72 %, four 65 %, pates ou riz 59 %, oeufs 68 %.
- Taux tres bas : salades (1 sur 15), poissons (0), crudites et ingredients frais en finition (concombre, avocat, radis, germes de soja, oignon-nouveau, ciboulette, salade), fritures, pates levees fraiches.
- Regle essayee : plat, leftoverOk, hors poisson, aucun ingredient cru de finition, timeMin >= 30 : 77 % d'accord seulement. Inversement : leftoverOk + keepDays >= 2 + hors poisson donne 305 recettes dont 172 freezables (56 %). Regle pratique : freezable si leftoverOk ET non poisson ET (mijote, soupe, gratin, tarte, sauce, legumineuses) ET aucun cru de finition ; la limite avec les plats a base de pates ou de riz est floue : AMBIGU.

### batch
- 115 recettes (24 %) : 101 plats (31 % des plats), 5 entrees, 7 desserts, 2 pdj.
- batch implique leftoverOk (100 %), souvent freezable (88 %) et keepDays >= 3 (104/115).
- Regle : plat ET freezable ET keepDays >= 3 ET minuteurs feu et four cumules >= 20 min : accord 90,1 % (87 vrais positifs, 19 faux positifs, 28 faux negatifs). Cote plats freezables : keepDays 4 donne batch 100 %, keepDays 3 donne 77 %, keepDays 2 donne 8 %. Plats non freezables : batch 4 %.
- timeMin des batch : mediane 70 min (p25 50, p75 100) ; a 30 min au minimum.
- Ingredients les plus associes : saucisse 100 %, lentilles 100 %, aubergine 100 %, vin rouge 100 %, boeuf-paleron 92 %, laurier 92 %, thym 89 %, concentre de tomate 87 %, lait de coco 86 %. Les plus pauvres : poulet-filet seul 20 %, oeufs 24 %, creme 33 %.
- Freezables mais non batch (25 exemples) : tartes, quiches, soupes courtes (poulet-teriyaki, quiche-lorraine, tarte-jambon-comte, soupe-oignon-gratinee) : plats a temps plus court ou format "individuel". AMBIGU.

## 7. enfants

- 139 recettes (29 %) : plats 29 %, entrees 10 %, desserts 52 %, pdj 32 %. Aucune difference de temps ni de nombre d'ingredients (medianes 45 min et 9 ingredients des deux cotes).
- Marqueurs positifs (part taguee enfants) : levure 92 % (gateaux), sucre-vanille 80 %, jambon-blanc 79 %, mais 70 %, boeuf-hache 67 %, pate-brisee 67 %, mozzarella 64 %, chapelure 63 % (pane), tortilla 62 %, banane 60 %, pates 59 %, fromage-rape 59 %, farine 58 %, chocolat-noir 58 %.
- Marqueurs negatifs (0 % taguee) : piment, harissa, curry et epices fortes (14 % globalement), vin et biere, anchois, olives, sardine, maquereau, haddock, chorizo, canard, lapin, agneau, tofu, lentilles, epinard, aubergine, navet, chou-vert, radis, orange, menthe, lait de coco, crevettes, pain-campagne.
- Regle : enfants = aucun ingredient fort ou amer de la liste negative ET au moins un ingredient familier (jambon, viande hachee, chapelure, pates, fromage rape, mozzarella, tortilla, pain burger, banane, chocolat, speculoos, mais, pate brisee, gnocchi, lait). Accord 79,5 % (99 vrais positifs, 57 faux positifs, 40 faux negatifs) : plats 80 %, entrees 92 %, desserts 73 %, pdj 58 %. Pour comparaison, "jamais enfants" donne 70,7 %. C'est la part la plus subjective : AMBIGU, la regle est un filtre de plausibilite, pas une definition.
- Plats "enfants" type : nuggets, burgers, lasagnes, pates bolognaise, quiche, croque-monsieur, pizza, gratin macaronis, carbonara, hachis parmentier, boulettes sauce tomate, riz cantonais, tacos, fajitas.

## 8. kcal et protein par portion (ordres de grandeur)

kcal : toujours un multiple de 10 (470/474), protein : entier en g.

| Type | kcal (min, p10, mediane, p90, max) | protein g (p10, mediane, p90) |
|---|---|---|
| plat (330) | 280, 380, 540, 650, 820 | 16, 30, 42 |
| entree (61) | 60, 120, 220, 330, 360 | 3, 7, 13 |
| dessert (52) | 100, 175, 350, 480, 740 | 2, 6, 11 |
| petit-dejeuner (31) | 190, 210, 340, 430, 540 | 7, 10, 19 |

Plats par famille (mediane kcal, mediane protein) : poisson et fruits de mer 520 kcal / 34 g (p10 de 350, 26 g) ; volaille 580 kcal / 40 g ; viande et charcuterie 580 kcal / 34 g (max 820) ; sans viande ni poisson 480 kcal / 19 g (p90 610 kcal, 24 g).
Tendance : proteines = en moyenne 19 % des kcal (p10 8 %, p90 32 %, max 46 %). Correlation protein et kcal 0,72 ; correlation kcal et masse (g par portion) seulement 0,49, donc les kcal ne se deduisent pas de la masse brute, il faut un bareme par ingredient.
Plages de controle utiles : plat sans viande a moins de 340 kcal ou plus de 610 kcal est suspect ; plat avec viande ou volaille a moins de 24 g de proteines est suspect ; dessert a plus de 480 kcal ou entree a plus de 360 kcal est hors norme.

## 9. Tags : synthese et ordre

- Nombre de tags par recette : de 1 a 13, mediane 7 (zone recente : moyenne 5,7 contre 7,4 dans la zone propre).
- Ordre observe : tags alimentaires d'abord (vegetarien, vegan, sans-gluten, sans-lactose, sans-porc, halal-possible, sans-fruits-a-coque), puis enfants, rapide, batch, saisons, four, economique, leger, sans-cuisson ; le jeu est sans doublon et limite aux 18 tags du validateur.
- Frequence : sans-fruits-a-coque 435, sans-porc 416, economique 303, halal-possible 297, vegetarien 240, sans-gluten 198, sans-lactose 190, hiver 187, automne 178, enfants 139, four 139, batch 115, leger 110, ete 106, rapide 88, vegan 72, printemps 65, sans-cuisson 46.

## 10. Points ambigus a trancher avant generation (resume)

1. rapide : 20 min (regle historique, 99,5 % en zone propre) ou 30 min (98 recentes).
2. halal-possible : generer systematiquement pour sans-porc sans alcool (regle 100 % en zone propre) ; les 88 recettes recentes eligibles n'en ont pas, probablement un oubli.
3. economique et leger : seuils par type de plat (2,6 / 1,9 / 1,55 / 1,4 EUR ; 450 / 240 / 250 / 210 kcal) ; les recentes sont plus strictes (leger plat vers 380).
4. vegan avec vin ou biere, moutarde et sans-gluten : traitement non uniforme dans le corpus ; prudence recommandee (exclure vin et biere du vegan ; exclure la moutarde du sans-gluten uniquement avec vinaigre et charcuterie).
5. saisons : pas de regle forte, surtout printemps (rappel 11 %) ; 30 % des recettes n'ont aucune saison.
6. difficulty : quasi non deductible (75 % au mieux, 1 par defaut = 72,8 %).
7. keepDays 2 ou 3 : la distinction non-poisson leftoverOk n'est pas determinee par la nature du plat.
8. freezable et batch : frontiere floue pour tartes, quiches et soupes courtes (freezables non batch).
9. enfants : subjectif (79,5 %).
10. timeMin des desserts a long repos : temps actif seulement.
