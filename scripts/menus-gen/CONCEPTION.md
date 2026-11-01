# Conception finale : Menus de Pearl List avec environ 11 600 recettes generees

Depot : C:/dev/pearl-list-menus, branche feat/menus-recettes-generees. Aucun fichier du depot n'est modifie par ce document.

## 0. Arbitrage

Base retenue : proposition 1 (colonnes compactes, aucun objet en masse, liste courte pour les algorithmes), parce que c'est la seule dont le cout memoire et le cout CPU ne dependent pas du nombre de recettes.

Greffes :
- De la proposition 2 : les 474 recettes actuelles ne sont pas migrees (aucun fichier existant touche sauf ajout d'ingredients), generateur de pool avec un rng a part pour ne pas decaler le flux du solveur, completion de candidats par creneau via l'index ingredient vers recettes, `recipe.dp` pour la variete, test d'equivalence d'eligibilite sur les 474, prefiltre budget par colonne cout.
- De la proposition 3 : mode degrade (le catalogue ne leve jamais, retour aux 474 sur toute anomalie), identifiants verrouilles par fichier lock, quatre couches de controle allergenes et regimes (dont audit a l'execution des repas choisis), controle de coherence etapes et ingredients, echeance sur `repairBudget`, `auditPlan` pour un plan sauvegarde, plafond de diversite dans la liste courte, bonus "relu a la main" pour les 474, tests de compatibilite id inconnu, `catalogStatus`.

Ecarts decides contre les propositions, avec raison :
1. Titres traduits en TEXTE COMPLET et non en suites d'identifiants de mots (proposition 1). Traduire mot a mot casse la grammaire (cas du russe, accords de l'arabe et de l'allemand, ordre des mots en japonais) et oblige a segmenter zh, ja, th. Cout : environ 0,6 a 1,3 Mo de texte par langue au lieu de 0,25 Mo. Accepte, car les donnees sont embarquees et la qualite prime. Repli documente en 12 si le poids du binaire pose probleme.
2. Pas de JSON dans le bundle (`require` d'un .json devient un objet litteral compile) : chaque fichier de donnees est un module JS exportant des chaines (idee commune aux 3 propositions). Les grosses chaines restent dans la table de chaines du bytecode.
3. Colonnes en champs separes de largeur fixe en base 64 (plus simple et plus sur que 90 bits empaquetes d'un seul bloc).
4. Identifiant `g-` + base36 du numero de case (et non un hash) : decodage sans table, stable par registre append-only.
5. Rien d'optionnel ajoute a l'interface : les filtres "temps max" et "famille" de la proposition 3, la bannieres d'audit visible et le plafond de favoris sont des PROPOSITIONS en section 13, pas dans le perimetre (regle "exactement ce qui est demande").

Verifie dans le code (branche actuelle) :
- `lib/menus/variety.js` : `dishFamily(recipe)` applique `FAMILY_RULES` en regex sur `recipe.id` (l. 6 et 72). Avec des id opaques elle ne trouve rien : il faut une colonne `family`.
- `lib/menus/util.js` `indexRecipes` : `if (recipes instanceof Map) return recipes;` sinon construit une Map par iteration. Une facade doit donc etre acceptee par duck typing (get/has/size).
- `components/menus/DiscoverScreen.js` : `limit: 150` (l. 109), deux FlatList (l. 351 et 443).
- `services/menuReminders.js` l. 137 : construit une Map de `getRecipes()` + recettes perso. A remplacer par la facade.
- `lib/menus/planner.js` : `makeCtx` l. 88, `solve` l. 202, boucle candidats `for (const r of ctx.el.mains)` l. 299, `repairBudget` l. 412, `mutate` l. 585.
- `scripts/validate-menus.js` : `UNITS = g ml u cs cc`, `cs`/`cc` seulement pour un ingredient `pantry`, courses `plat entree dessert petit-dejeuner`, 18 tags (`TAGS` l. 10).
- Tests existants : `__tests__/menus-*.test.js` (perf, recipes, index, logic, batch, family, textes, reminders, storage, sync...).

## 1. Principes

1. Aucun objet recette cree en masse. Les recettes generees vivent dans des colonnes (tableaux types) et des chaines. Un objet n'est cree que pour : page affichee, recette ouverte, liste courte du solveur. Cache LRU de 300 objets.
2. Les algorithmes (plan, echange, budget, suggestions, batch) travaillent sur une liste courte choisie par colonnes. Leur cout est donc independant de la taille du catalogue.
3. Tout chemin existant qui recoit un TABLEAU (tests, recettes perso, 474) reste inchange. Le nouveau chemin ne s'active que si `recipes` est une facade `Catalog`. Les tests actuels doivent passer sans modification, sauf les listes d'exports et `menus-perf`.
4. Le catalogue ne leve jamais : toute anomalie met `catalogStatus` a `degraded` et l'app continue avec les 474.
5. Aucune action destructive sur les donnees utilisateur : un id inconnu est masque, jamais supprime du stockage.

## 2. Format des donnees

### 2.1 Arborescence (tout genere par script, jamais edite a la main)

```
data/menus/gen/
  meta.js            FIELDS, ING_KEYS, PAIRS, PHRASE_META, SHARD, N, VERSION
  hdr.js             une chaine par champ de colonne (voir 2.2)
  lines-0.js ... lines-5.js     lignes d'ingredients (blocs de 2048 recettes)
  steps-0.js ... steps-5.js     identifiants de phrases (blocs de 2048 recettes)
  loaders.js         table statique des require par langue et par bloc (genere)
  lang/<lang>-titles-0.js ... -5.js   titres complets, 1 par ligne (blocs de 2048)
  lang/<lang>-steps.js                dictionnaire de phrases, 1 par ligne
scripts/menus-gen/
  registry.json      registre append-only : titre fr normalise vers numero de case
```
Chaque fichier fait moins de 350 Ko (avertissement Babel a 500 Ko, temps de transformation Jest). Un module = `module.exports = "<texte>"` ou `module.exports = { champ: "<texte>" }`. Jamais de litteral de tableau de milliers de nombres.

Les `require` sont des `switch` statiques dans `loaders.js` (Metro l'impose) : les 13 langues sont dans le binaire mais un module n'est evalue qu'au premier `require`.

`.eslintignore`, `.prettierignore` : `data/menus/gen/`.

### 2.2 Colonnes (hdr.js), largeur fixe, base 64

Alphabet `A-Za-z0-9+/`, 6 bits par caractere, lu par `charCodeAt` et une table de 128 octets (`lib/menus/b64.js`). Chaque champ est une chaine de `N * largeur` caracteres.

| Champ | Largeur (car.) | Contenu |
|---|---|---|
| course | 1 | 0 plat, 1 entree, 2 dessert, 3 petit-dejeuner |
| sub | 1 | categorie du generateur (19) |
| family | 1 | famille de plat (remplace la regex d'id de `variety.js`) |
| tags | 3 | masque des 18 tags de `TAGS` (ordre du validateur) |
| time | 2 | minutes / 5 |
| diff | 1 | difficulte 0 a 2 |
| kcal | 2 | kcal / 10 par portion |
| prot | 2 | proteines g par portion |
| keep | 1 | keepDays |
| flags | 1 | bit0 leftoverOk, bit1 freezable, bit2 retiree, bit3 four |
| cost | 2 | cout par personne en dixiemes d'euro, hors placard, precalcule au build |
| alg | 3 | masque d'allergenes (14) |
| nIng | 1 | nombre de lignes d'ingredients (borne a 63) |
| nStep | 1 | nombre d'etapes (borne a 63) |
| main1, main2 | 2 + 2 | index des 2 ingredients principaux (precalcules, remplacent `mainIngredients`) |

`FIELDS` dans `meta.js` decrit largeur et ordre ; le script d'ecriture et le lecteur sont pilotes par cette meme table (aucun decalage code en dur). Un test d'aller-retour sur 500 recettes verifie l'ensemble.

Taille : environ 26 caracteres par recette, soit environ 300 Ko.

### 2.3 Lignes d'ingredients (lines-k.js)

3 caracteres (18 bits) par ligne : index d'ingredient (9 bits, `ING_KEYS`), index de couple (quantite, unite) dans `PAIRS` (8 bits), bit optionnel (1 bit). Si `PAIRS` depasse 256 entrees, le script passe automatiquement a 4 caracteres (`meta.LINE_W`). Les quantites sont deja ramenees a 4 personnes (champ `servings = 4`). Decalage d'une recette = somme cumulee des `nIng` (calculee une fois au chargement, dans un `Uint32Array`).

### 2.4 Etapes (steps-k.js) et phrases

2 caracteres (12 bits, 4095 phrases au plus) par etape. Un dictionnaire de phrases est commun a toutes les langues : l'identifiant de phrase est la cle (texte fr, minuteur, genre). Deux textes francais identiques avec minuteurs differents ont donc deux identifiants, alignes dans les 13 langues.

`meta.PHRASE_META[id] = [genre, secondes, tempFour]` avec genre 0 aucun, 1 four, 2 feu, 3 repos. Au materialisation : `stepTimers` (secondes par etape), `stepKinds` et `ovenTempC` (maximum des phrases de la recette) sont reconstruits au format actuel, de sorte que `CookMode`, `batch` et `prepDays` ne changent pas.

Les minuteurs sont deduits du francais au build (regex "N min", "N h", "N heures") et la liste des deductions est ecrite dans un rapport a relire.

### 2.5 Packs de langue

- `lang/<lang>-titles-k.js` : une chaine, un titre complet par ligne, ordre des cases du bloc k. Aucun titre vide (le build echoue).
- `lang/<lang>-steps.js` : un dictionnaire, une phrase par ligne dans l'ordre des identifiants de phrase (environ 1 550 lignes). Le build echoue si une ligne manque.
- Les noms des nouveaux ingredients (environ 160) s'ajoutent dans `data/menus/i18n/<lang>.json` sous la cle existante des noms d'ingredients, de facon additive.
- Langues : CN DE ES FR IT JP NL PT RU SA SE TL US, avec la correspondance des codes fichiers deja utilisee par `lib/menus/recipes.js` (a reprendre telle quelle, ne pas la redefinir). Attention : dans le projet Pearl List la langue thai est `th` ; verifier le mapping reel dans `recipes.js` avant de coder les noms de fichiers.
- Vouvoiement partout sauf le suedois (regle du user), zero tiret cadratin, demi-cadratin ou fleche dans tous les textes.

### 2.6 Identifiants

- Generees : `g-` + base36 du numero de CASE (`g-0`, `g-1`, ..., `g-9ix`). Decodage : `parseInt(id.slice(2), 36)` plus verification de plage. Une Map de 11 600 chaines n'existe donc jamais.
- Verifier l'expression reguliere d'id du validateur ; si le tiret n'est pas accepte, changer le prefixe, mais jamais un prefixe commencant par `my-` (reserve aux recettes perso). Test : aucun id herite ne ressemble a `g-...`, et la resolution consulte d'abord les ids herites.
- Registre `scripts/menus-gen/registry.json` : `{ "<titre fr normalise>": case }`, append-only. Une recette retiree garde sa case (drapeau `retiree` dans `flags`), la case n'est jamais reutilisee. Retiree : `get(id)` renvoie `null`, les ecrans existants affichent "recette indisponible". Test d'empreinte sur les 200 premieres et 200 dernieres cases et sur le nombre de cases.
- Exclues au generateur sans case : sauces, eaux aromatisees, citronnades, purees.
- Les 474 gardent leurs id texte.

Exemple de fragment de `meta.js` genere :

```js
module.exports = {
  VERSION: 1,
  N: 11620,
  SHARD: 2048,
  LINE_W: 3,
  FIELDS: [["course",1],["sub",1],["family",1],["tags",3],["time",2],["diff",1],["kcal",2],["prot",2],["keep",1],["flags",1],["cost",2],["alg",3],["nIng",1],["nStep",1],["main1",2],["main2",2]],
  ING_KEYS: "ail\nbasilic\nbeurre\n...",
  PAIRS: "100:g|2:u|1:cc|25:cl|...",
  PHRASE_META: "0,0,0|1,0,180|2,600,0|3,1800,0|...",
  FAMILIES: "pates\nriz\ncurry\ngratin\n..."
};
```

Exemple de recette materialisee (meme forme qu'une entree de `recipes.json`, plus `family` et `dp`) :

```json
{
  "id": "g-9ix",
  "course": "plat",
  "servings": 4,
  "time": 35,
  "difficulty": 1,
  "kcal": 520,
  "protein": 31,
  "keepDays": 3,
  "leftoverOk": true,
  "freezable": false,
  "tags": ["sans-porc", "rapide", "enfants"],
  "ingredients": [
    { "key": "poulet", "qty": 500, "unit": "g" },
    { "key": "creme", "qty": 20, "unit": "cl", "optional": false },
    { "key": "sel", "qty": 1, "unit": "cc", "optional": true }
  ],
  "stepIds": [12, 408, 77, 1033],
  "stepTimers": [0, 0, 1200, 0],
  "ovenTempC": 0,
  "family": "poulet-creme",
  "dp": { "family": "poulet-creme", "main": "poulet", "mains": ["poulet", "creme"], "key": "poulet" },
  "generated": true
}
```
(les unites reelles sont limitees a `g ml u cs cc` par la conversion 2.7 ; `cl` ci-dessus est un exemple de ligne brute avant conversion et ne doit pas apparaitre dans les donnees finales.)

### 2.7 Conversion au build (`scripts/menus-gen/export.js`)

- Course : plat pour pates_riz, viandes, poissons, vegetarien, soupes, gratins, tartes_salees, oeufs, bowls, pizzas, sandwichs, salades ; entree pour accompagnements, aperitif ; dessert pour desserts, gateaux ; petit-dejeuner pour petit_dejeuner et boissons restantes. La categorie d'origine reste dans `sub`.
- Unites : kg en g x1000 ; cL en ml x10 ; L en ml x1000 ; mL en ml ; gousse, botte, tranche, brin, feuille, sachet, boite, pot, rouleau, cube en `u` ou `g` par une table de poids PAR INGREDIENT (`scripts/menus-gen/unites-ingredients.json`), cle (ingredient, unite) vers (unite app, facteur). Une paire absente de la table fait ECHOUER le build et alimente un rapport a completer. pincee en `cc` x0,25 sur un ingredient pantry. `qs` (17 462 lignes) : ligne `optional` `{qty:1, unit:'cc'}` pour un ingredient pantry, quantite par defaut de la table sinon, echec si absente. Verifier dans `shopping.js` que `optional` ne gonfle pas la liste de courses.
- Tags : RECALCULES a partir des allergenes et drapeaux des fiches ingredients (jamais fiance au generateur), avec les regles de coherence du validateur. `rapide` si temps <= 30, `enfants`, `batch`, `economique`, `leger`, `four`, `sans-cuisson`, saisons.
- kcal et protein : table `scripts/menus-gen/ingredients-nutrition.json` (pour 100 g, reservee au generateur).
- `keepDays` : 2 pour le poisson, jamais congelable (regle du validateur). `freezable`, `leftoverOk`, `family`, `main1/main2`, cout par personne par le meme calcul que `estimateRecipeCost` sur le panier par defaut.
- `data/menus/ingredients.json` : ajout des environ 160 ingredients manquants (emoji, rayon rayon, prix, pack avec unite parmi g ml u cs cc, allergenes, pantry). Ordre des cles fige dans `ING_KEYS` ; un test le compare a `Object.keys`.
- Mise a l'echelle des quantites a `servings = 4`.

### 2.8 Tailles attendues (a mesurer)

Catalogue independant des langues : environ 0,8 Mo (colonnes 0,3 + lignes 0,3 + etapes 0,13 + meta 0,05). Une langue : 0,6 a 1,4 Mo (titres) + 0,05 a 0,25 Mo (phrases). Total 13 langues : 9 a 12 Mo de bytecode, 3 a 4 Mo compresses dans le binaire (a mesurer par `npx expo export` avant et apres).

## 3. Chargement

API (nouveau `lib/menus/catalog.js`, `lib/menus/packs.js`) :

- `preloadMenusData(lang)` : appelee par `MenusProvider` au premier montage dans `InteractionManager.runAfterInteractions`, en tranches de moins de 40 ms V8 separees par `await new Promise(r => setTimeout(r, 0))` :
  1. `initCatalog()` : decodage des colonnes en `Uint8Array`/`Uint16Array`/`Uint32Array`, sommes cumulees, remplissage des 474 lignes heritees (course, tags, cout, famille, mains calcules depuis les objets existants), controle d'integrite O(n).
  2. pack titres de la langue : `Int32Array` d'offsets par un balayage d'`indexOf('\n')` par bloc.
  3. `ingredients.json` et noms (deja charges aujourd'hui).
  `ready` passe a vrai apres les trois. Les phrases (dictionnaire d'etapes) sont decoupees au premier `recipeSteps` et prechargees en tache de fond apres `ready`.
- Singletons de module : `catalog`, `packs[lang]`, index de recherche, index ingredient vers recettes. `resetMenusCache()` les vide tous (tests).
- Synchrone conserve : apres le prechargement `getTexts(lang)`, `recipeTitle(id)`, `recipeSteps(id)`, `ingredientName(key)` restent synchrones. Hors fournisseur (services de rappels, tests) ils chargent a la demande en synchrone (JS pur). `menuReminders` ne doit declencher que `initCatalog` et le pack de la langue, jamais les index de recherche.
- Repli francais PARESSEUX : le pack fr n'est lu qu'au premier champ manquant (aujourd'hui `getTexts` lit toujours le pack fr, soit environ 250 Ko inutiles).
- Titre manquant : langue, puis fr, puis "Recette" localise. Jamais l'id humanise. Phrase manquante : langue, puis fr, puis etape omise ; recette sans etape : texte "etapes indisponibles" (nouveau texte, 13 langues).
- Changement de langue : on libere l'ancien pack et on charge le nouveau.
- Mode degrade : tout echec (module absent, longueurs incoherentes, offsets non monotones, `N` different entre catalogue et pack) donne `catalogStatus = 'degraded'`, catalogue vide cote generees, 474 seulement, `trackMenusUsage('catalogue_degrade')`. L'ecran Menus affiche son squelette existant (`ready`, `loadError`) pendant le chargement.

Budget de chargement (V8 / Hermes estime) : initCatalog 8 ms / 40 a 80 ms en 2 tranches ; pack titres 4 ms / 20 a 40 ms ; total avant `ready` 20 ms / moins de 200 ms, aucune tranche de plus de 50 ms. Tas ajoute (fr) : environ 2 Mo (colonnes, offsets, titres) ; plafond de test : +6 Mo.

## 4. Facade Catalog

`Catalog` (classe, dans `lib/menus/catalog.js`) :
- `get(id)`, `has(id)`, `size` (comptes legacy + generees non retirees) : resolution legacy d'abord, puis `g-` + base36.
- `rowOf(id)`, `idOf(row)`, `getRow(row)` (objet via LRU 300), `materialize(row)`.
- `eligible(profile)`, `sampleMains(profile, opts)`, `buildPool(...)`, `byIngredient(keyIdx)` (index inverse paresseux), `emojisOf(row)`, `costPP(row)`, `custom` (recettes perso, objets, ajoutees a la volee).
- L'iteration complete est INTERDITE (pas de `values()`/`[Symbol.iterator]` renvoyant tout) : test qui verifie qu'aucune iteration ne materialise. Les consommateurs qui iteraient doivent etre listes et migres (section 7).

`indexRecipes` (util.js) : accepte tout objet avec `get` et `has` avant le test `instanceof Map`.

## 5. Planificateur

### 5.1 Eligibilite par colonnes

`Catalog.eligible(profile)` :
- `normalizeProfile` UNE seule fois par contexte (aujourd'hui appele a chaque recette).
- Regimes : `(tags[r] & dietMask) === dietMask` ; allergenes : `alg[r] & exMask` ; temps : `time[r]*5 <= maxTimeMin` ; ingredients exclus : etendus aux cles, puis marquage par l'index inverse.
- Resultat : bitset `Uint8Array`, liste `Uint32Array` des plats (`mains`), compteur `rejected` {invalid, diet, excluded, time} identique a l'actuel.
- Cle de cache `profileSig` (regimes tries, exclusions triees, temps max, pantry), LRU de 4. Cout : 3 a 8 ms V8, 30 a 80 ms Hermes, une fois par profil.
- `rejectReason` actuelle conservee pour objets, recettes perso et tests. Test d'equivalence : sur les 474 et sur 2000 generees, les masques donnent exactement les memes eligibles que `rejectReason` (profils aleatoires).

### 5.2 Liste courte (`buildPool`)

Si `mains.length <= 300` (tableaux, tests, 474 seuls) : liste courte = tout, comportement actuel inchange.

Sinon, K = 240 (plan) ou 140 (echange), construite avec un rng DEDIE `createRng(hashSeed(seed + ':pool'))` (le flux du solveur n'est pas decale) :
1. Score statique par ligne, colonnes seules : cout x-1,6 (x-3,2 si budget), bonus tags enfants/economique/rapide, temps x-0,1, saison +3 / -6, proteines x0,04, bruit deterministe `h(ligne, graine) x 6`, bonus +4 pour les 474 "relues" (a valider, section 13).
2. Seaux stratifies : pour chaque (famille x type de proteine viande/poisson/vegetal), les 4 meilleurs scores (environ 45 seaux, 180 lignes) ; plafond de diversite : au plus 6 par ingredient principal et 25 par famille.
3. Affinite : 6 meilleures lignes de familles differentes plus jusqu'a 40 plats partageant leurs ingredients principaux (hors neutres) via `byIngredient`. Pour un echange : affinite avec les plats de la semaine.
4. Economique : les 20 moins chers (40 si budget), au plus un par seau.
5. Les repas verrouilles/poses sont toujours inclus. Dedoublonnage, materialisation (LRU).

Completion par creneau (greffe de la proposition 2) : dans `solve`, `candidatesFor(ctx, slotState)` renvoie le pool plus jusqu'a 40 recettes eligibles hors pool partageant les 3 ingredients non placard les plus presents dans `totals` (decalage tire avec le rng du solveur). Cela garde le gain "reutiliser les ingredients de la semaine". Environ 280 evaluations par creneau au lieu de 11 600.

Sortir de la boucle candidats le `placed.filter((o) => o.key !== key)` (calcule une fois par creneau). `needsOf` memoise par recette et nombre de personnes.

### 5.3 solve, echange, suggestions, batch, budget

- `makeCtx` : branche catalogue (profil normalise une fois, `ctx.pool`, `ctx.allows(id)` en test de bit, `ctx.isMain(id)`, `ctx.mainKeyOf(r)` paresseux lisant `main1`). Cache `ctxFor(catalog, profileSig, custom)`. `finish` lit un compteur `ctx.mainCount` pour `few_recipes` et `no_eligible`. Les resolutions de repas fixes passent par `idx.get`.
- `solve` : la boucle l. 299 devient `for (const r of candidatesFor(ctx, state))`.
- `mutate`/`swapMeal` : le contexte (eligibilite, profils) vient du cache, le pool est reconstruit avec la graine `${plan.seed}:${key}:${swaps}` (deja utilisee), la recette sortante est bannie, seules 1 a 3 cases sont resolues.
- `suggest(n)` (MenusContext) : `catalog.sampleMains(profile, {n, exclude, season, rng})`, echantillonnage par reservoir sur le bitset, aucune copie ni melange. Decodage des n retenues seulement.
- `proposeBatch` (batch.js) : pool = freezable ou keep >= 3 ou tag batch, trie par score de base, tronque a 400 avant le calcul de recouvrement d'ingredients. Chemin tableau inchange.
- `repairBudget` : prefiltre par colonne `cost` (les 60 moins chers, au plus 3 par ingredient principal), `estimateRecipeCost` exact sur ces 60 + candidats herites, 20 conserves (`SHORTLIST` existant), boucle de 8 passes inchangee. Echeance de 350 ms (`performance.now()` ; en test, injectable) : au depassement, on rend le meilleur plan atteint avec l'avertissement `over_budget` existant.
- `variety.js` : `dishFamily` lit `recipe.family` s'il existe, sinon la regex d'id (les 474 inchangees) ; `dishProfile` retourne `recipe.dp` s'il existe.

### 5.4 Securite alimentaire (quatre couches, bloquantes)

1. Build : tags et allergenes RECALCULES depuis les fiches ingredients ; `validate-menus.js` applique les regles de coherence actuelles aux ~11 600 recettes (vegan, sans-gluten, sans-lactose, sans-porc, fruits a coque, poisson 2 jours non congelable).
2. Controle lexical : les listes multilingues de `lib/menus/allergens.js` appliquees aux noms des ingredients dans les 13 langues et comparees aux allergenes declares ; tout ecart echoue sauf derogation justifiee (`scripts/menus-gen/derogations.json`).
3. Alcool : verifier que `halal-possible` est impossible avec vin, biere, rhum, etc. ; si `ingredients.json` n'a pas de drapeau alcool, l'ajouter pour les nouveaux ingredients (et le declarer dans le validateur).
4. Execution : audit des repas CHOISIS (14 au plus) par `rejectReason` sur l'objet materialise ; un repas qui echoue est remplace par la meilleure alternative suivante de la liste courte. `auditPlan(plan, profile)` (fonction fournie, ecran non modifie dans ce chantier) renvoie les repas d'un plan sauvegarde devenus incompatibles.
Relecture humaine obligatoire de la table des ~360 ingredients (allergenes ligne par ligne) avant fusion.

## 6. Recherche et Decouvrir

### 6.1 Index de titres (par langue, paresseux, jamais au demarrage)

- `buildTitleIndex(lang)` : pour chaque bloc de 2048 titres, un seul `norm` (minuscules, NFD sans accents, oe/ae, caracteres hors classe en espace, `\n` conserve) donne `normBlob` ; test : chaque ligne egale `util.norm(titre)` aux espaces de bord pres. Decoupe en 6 tranches annulables, declenchee a l'ouverture de Decouvrir.
- Requete (semantique actuelle : debut de mot du titre 10, titre contenant 6, ingredient 3, tag 2, ET sur tous les mots) : pour chaque mot, `indexOf('\n'+mot)` et `indexOf(' '+mot)` pour 10, `indexOf(mot)` pour 6 ; position convertie en ligne par recherche binaire dans les offsets ; ingredients : noms normalises (environ 360, Map par langue) puis `byIngredient` ; tags : masque. Accumulation dans des `Uint8Array`, tri par seaux de score puis ordre de ligne (pas de comparateur sur 8 000 resultats).
- Cas CJK et thai : pas d'espaces, donc seulement le score 6 (sous-chaine) ; test d'equivalence avec `searchRecipes` sur les 474 pour verifier que le comportement actuel est conserve.
- Les filtres (course, tags, temps, kcal, proteines, saison, favoris, "pour mon foyer") s'appliquent par colonnes AVANT la recherche texte.
- Recettes perso : `searchRecipes` actuel sur tableau, fusion par score.
- Mode frigo (`recipesByPantry`) : candidats = union des postings des cles possedees, accumulation du poids dans un `Float32Array`, couverture calculee sur les lignes touchees seulement, meme formule de score (poids x2 perissable, x2 a finir). Test d'equivalence sur les 474 (50 requetes).
- Fonctions exportees : `searchCatalog({query, filters, lang, limit, offset})`, `pantryCatalog`, `buildSearchIndex`. Elles renvoient des lignes triees (`Uint32Array`) et un total, pas des objets.

### 6.2 DiscoverScreen

- Plafond `limit: 150` supprime. L'etat `shown` demarre a 30 et gagne 30 par `onEndReached` (seuil 0,6). La `FlatList` recoit les lignes de la fenetre transformees en objets via `catalog.getRow(row)` (LRU). Reglages : `initialNumToRender` 10, `windowSize` 7, `maxToRenderPerBatch` 8, `removeClippedSubviews` sous Android, `keyExtractor` sur l'id, `getItemLayout` si la hauteur de ligne est constante (a verifier avant).
- Compteur de resultats : total reel (le texte existant, le nombre change).
- `metaOf`/`costOf` uniquement pour les lignes affichees.
- Ordre sans requete : DECISION DU USER requise (section 13). Defaut propose en attendant : ordre stable melange par `hashSeed(ligne + feedSeed)`, 474 relues d'abord. Un tri alphabetique d'ids opaques n'aurait aucun sens.
- Les modes favoris, historique et "mes recettes" travaillent sur des listes d'ids ; un id introuvable est ignore sans exception. Le mode "pour mon foyer" utilise le bitset d'eligibilite (plus de tableau de 11 600 objets).
- Le selecteur d'ingredients du frigo garde sa limite de 40.
- `RecipeVisual` : aucun changement visuel (composition d'emojis) ; borner son cache a 400 entrees (LRU).

## 7. Fichiers a creer ou modifier

Lots independants (parallelisables) apres le lot 0.

**Lot 0 : contrat (1 developpeur, 1/2 journee, bloque les autres)**
- `lib/menus/b64.js` (`readInt(str, pos, n)`), `data/menus/gen/meta.js` (version a la main avec des donnees d'exemple de 50 recettes), spec des FIELDS. Livre un jeu de donnees minuscule "gen-fixture" pour que les lots B, C, D avancent sans attendre le generateur complet.

**Lot A : generateur et donnees (le plus long)**
1. `scripts/menus-gen/export.js` : lit le generateur (f-*.js), exclusions, course, conversion d'unites, tags/allergenes recalcules, nutrition, mises a l'echelle, cout, family/mains, lock d'ids, ecrit hdr/lines/steps/meta/loaders. Modes `--check` (refait le build et compare) et `--report` (comptes par course, distribution du cout min/mediane/max contre les 474, 30 extremes a relire, quasi-doublons listes sans suppression).
2. `scripts/menus-gen/unites-ingredients.json`, `ingredients-nutrition.json`, `derogations.json`, `registry.json`.
3. `data/menus/ingredients.json` : +160 ingredients.
4. `scripts/menus-gen/translate/` : sources par langue (phrases JSON, titres .txt une ligne par recette, noms d'ingredients), glossaire commun, `export-a-traduire.js`, `import-traductions.js` (fusion controlee : comptes de lignes, chiffres identiques au francais, pas de tiret cadratin/fleche, pas de `{0}` residuel), `build-packs.js` (ecrit `lang/*`).
5. `data/menus/i18n/<13>.json` : noms des nouveaux ingredients.

**Lot B : noyau de lecture (apres lot 0)**
6. `lib/menus/catalog.js` : voir section 4.
7. `lib/menus/packs.js` : `loadTitles(lang)`, `loadSteps(lang)`, `titleOf(row)`, `stepsOf(row)`.
8. `lib/menus/recipes.js` : `getCatalog()`, `preloadMenusData(lang)`, `getTexts` branche catalogue + packs herites, repli fr paresseux, `getRecipeIndex({extra})`, `resetMenusCache` etendu. `getRecipes()` garde son sens (474) pour les appelants et tests.
9. `lib/menus/util.js` (`indexRecipes` duck typing), `lib/menus/variety.js` (`family`, `dp`), `lib/menus/index.js` (exports).

**Lot C : algorithmes (apres lot B)**
10. `lib/menus/planner.js` : section 5.
11. `lib/menus/pool.js` : `profileSig`, `buildPool`, `cheapest`, `auditPlan`, caches LRU.
12. `lib/menus/search.js` + `lib/menus/searchIndex.js` : section 6.1.
13. `lib/menus/batch.js` : `proposeBatch` sur catalogue.

**Lot D : interface (apres lot B ; peut se faire avec la fixture)**
14. `components/menus/MenusContext.js` : `catalogStatus`, `recipes` et `recipeById` = facade, `ready` attend `preloadMenusData`, `suggest`, `costOf` via colonne `cost` quand possible.
15. `components/menus/DiscoverScreen.js` : section 6.2.
16. `components/menus/RecipeVisual.js` : cache borne. `components/menus/MenusScreen.js` : etat `degraded` discret (texte a traduire).
17. `services/menuReminders.js` : `calendrierVoulu` utilise `getRecipeIndex({extra: myRecipes})` au lieu de la Map de tout `getRecipes()`.
18. `lib/menus/sharedWeek.js` : titre de repli pour id inconnu (la ligne ne doit pas etre vide ; `shared.unknown` existe dans `SharedWeekScreen`).
19. A relire avant de coder : `BatchScreen.js`, `ShoppingScreen.js`, `WeekScreen.js`, `MealCard.js`, `RecipeScreen.js`, `CookMode.js`, `Sheets.js` (verifier seulement les usages tableau de `recipes`/`getRecipes`, conserver les gardes `if (!recipe)`).

**Lot E : validation et outillage (parallele a C et D)**
20. `scripts/validate-menus.js` : mode v2 (tout le catalogue compact) : coherence des colonnes, ids, unites, tags recalcules contre allergenes, paquets, minuteurs, couverture 100 % titres et phrases dans 13 langues, tirets et fleches, etapes de 2 a 10, plages kcal 100 a 1400, cout 0,2 a 20 euros, temps 5 a 480. La partie heritee reste telle quelle.
21. `scripts/menus-size-check.js` (tailles des fichiers et budgets), `scripts/bench-menus-plan.js` (qualite du plan, section 8.3).

## 8. Tests et budgets

### 8.1 Tests a ajouter (`__tests__/`)
- `menus-catalog.test.js` : decodage complet, aller-retour sur 500 recettes champ par champ, `ING_KEYS` = `Object.keys`, ids stables (empreintes), jamais d'objet cree par `initCatalog`, integrite (colonne tronquee, N incoherent, JSON invalide) donne `degraded` sans exception.
- `menus-packs.test.js` : 13 langues, memes nombres de titres et de phrases, aucun vide, memes chiffres et temperatures que le francais, zero tiret cadratin/demi-cadratin/fleche, repli fr paresseux, scripts attendus (ru, ar, th, zh, ja).
- `menus-pool.test.js` : eligibilite par colonnes egale a `rejectReason` (474 + 2000 generees, profils aleatoires), aucune violation de regime ou allergene sur 200 graines x 4 profils, liste courte deterministe a graine egale, au moins 12 familles dans une liste courte par defaut, repas verrouilles hors liste conserves.
- `menus-search-catalog.test.js` : equivalence avec `searchRecipes` (liste et ordre sur les 474, liste sur le catalogue complet) pour 200 requetes ; CJK, thai, accents, ET de mots ; pagination ; fusion avec les perso ; frigo equivalent a `recipesByPantry`.
- `menus-compat.test.js` : plan, favoris, notes, historique, rappels avec ids herites rechargent ; id `g-` inconnu ou retire ne plante ni `buildShoppingList` (`missingRecipes`), ni `prepDays`, ni `MealCard`, ni `SharedWeek`, ni les rappels ; aucun id supprime du stockage.
- `menus-discover-paging.test.js` : tailles de pages, aucune duplication, total correct.
- `menus-coherence.test.js` : allergenes (controle lexical), regimes, coherence etapes et ingredients (tout nom d'ingredient cite dans une phrase doit figurer dans la recette, derogations justifiees), plages.
- `menus-qualite-plan.test.js` : 100 graines x 6 profils, au plus 2 repas de meme famille par jour, pas de plat identique deux fois, ingredient principal repete 3 fois au plus, budget respecte quand atteignable.

### 8.2 A adapter
`menus-perf.test.js` (`recipes.length >= 330` devient `>= 11000`, plan/echange/recherche sur le catalogue, test de chargement mesurant `preloadMenusData` + premier `recipeTitle` + `recipeSteps`), `menus-recipes.test.js`, `menus-textes.test.js`, `menus-index.test.js` (liste d'exports). Inchanges : `menus-logic`, `menus-batch`, `menus-family`, `menus-fixes` (chemin tableau).

### 8.3 Budgets (V8, multiplies par 5 si `CI=true`, comme aujourd'hui)

| Mesure | Cible | Garde-fou test | Hermes estime |
|---|---|---|---|
| `initCatalog` | 10 ms | 30 ms | 40 a 80 ms |
| Pack titres + phrases | 8 ms | 30 ms | 20 a 60 ms |
| `generatePlan` moyenne / p95 | 70 / 150 ms | 150 / 300 ms (inchange) | moins de 700 ms |
| `swapMeal` p95 | 40 ms | 100 ms | moins de 300 ms |
| `eligible()` a froid / en cache | 8 ms / 1 ms | 40 / 3 ms | 30 a 80 ms |
| Index de recherche | 15 ms | 120 ms, en tranches | 100 a 300 ms |
| Requete (cas "p") | 3 ms | 30 ms (50 aujourd'hui) | moins de 50 ms |
| Frigo | 10 ms | 50 ms | 100 a 200 ms |
| Tas ajoute (jest) | 3 Mo | 6 Mo | |
| Donnees : catalogue / une langue / total | 0,8 / 1,5 / 12 Mo | 1 / 2 / 14 Mo | |

Qualite du plan (`bench-menus-plan.js`, bloquant) : pour 4 profils x 200 graines, comparaison solveur "tout le catalogue" (reference) et "liste courte" : 0 violation de regime ou d'allergene sur 800 plans ; cout moyen au plus reference + 8 % et jamais pire que le plan sur les 474 ; ingredients reutilises au moins egaux (tolerance 10 %) ; aucune famille repetee plus que la reference ; taux de `over_budget` et `few_recipes` non superieurs.

Mesure sur appareil, OBLIGATOIRE avant de dire "fait" : Android d'entree de gamme 2 Go, build de production Hermes, `performance.now()` temporaires hors depot : `preloadMenusData`, `generatePlan`, `swapMeal`, 1er et 2e caractere de recherche, premier defilement de Decouvrir, pic memoire. Cibles : blocage cumule de demarrage des Menus moins de 150 ms (aucune tranche > 50 ms), plan moins de 700 ms, echange moins de 300 ms, frappe moins de 50 ms, 55 images/s au defilement. Si le plan depasse, baisser K de 240 a 160 (gain lineaire).

## 9. Compatibilite des sauvegardes

- Plans, historique, favoris, notes, cuisines, frigo, lots, rappels, semaine partagee ne stockent que des chaines. `SCHEMA_VERSION` inchange, aucune migration. Les 474 ids resolvent comme avant.
- Id inconnu : masque, jamais supprime (`cleanIds` garde tout). Etat "recette indisponible" deja gere par `MealCard`, `RecipeScreen`, `SharedWeekScreen` (`shared.unknown`), `reminders.js`, `shopping.js` (`missingRecipes`) : verrouille par `menus-compat.test.js`.
- `recipeById` et `recipes` deviennent la facade (get/has/size). Consommateurs verifies par les propositions comme n'utilisant que get/has sur la table : CookMode, BatchScreen, RecipeScreen, RecipeEditScreen, SharedWeekScreen, menuReminders, planBatchMeals, prepDays. Usages tableau a migrer : Discover (base), proposeBatch, suggest, DiscoverScreen.base, menuReminders.calendrierVoulu.
- Un plan deja sauvegarde n'est pas recalcule a la lecture. `swapMeal` sur un ancien plan peut choisir autre chose qu'avant : acceptable.
- Ancienne version de l'app lisant un plan synchronise avec des `g-` : ne les connait pas, degrade proprement (titre vide possible cote partage, corrige par le point 18). Verifier cote Backend les limites de taille de la sauvegarde `sync` (512 Ko annonces) pour favorites, notes, cooked.
- Champ informatif `plan.catalog` (version) a ajouter au plan, facultatif, sans effet sur la lecture.

## 10. Calendrier et ordre

1. Lot 0 (fixture + contrat) puis en parallele : Lot A (traduction en parallele par langue, 12 agents ; les titres et phrases sont independants entre langues), Lot B, puis C et D en parallele sur la fixture, E en continu.
2. Integration : branche l'ensemble sur les vraies donnees, `validate-menus.js` v2, bancs de qualite, `npx expo export` (taille), mesure appareil.
3. Aucun deploy des donnees avant : validateur vert, tests verts, bancs verts, relecture humaine des ingredients et d'un echantillon de 100 titres par langue.

## 11. Risques et parades

1. Hermes plus lent qu'estime (seulement V8 mesure) : liste courte bornee, tranches de chargement, echeance `repairBudget`, K reductible, mesure appareil bloquante.
2. Securite alimentaire (tag ou allergene faux) : quatre couches section 5.4 + relecture humaine.
3. Conversion d'unites et prix (17 % de `qs`, unites sans equivalent) : table par ingredient obligatoire, echec du build sinon, distribution du cout comparee aux 474, 30 extremes relus.
4. Traductions (12 langues x environ 11 600 titres + 1 550 phrases + 160 noms) : glossaire, controle des chiffres et temperatures, couverture 100 %, echantillon relu ; un titre faux est moins grave qu'un vide mais reste visible.
5. Poids du binaire (et pas d'OTA, donnees embarquees comme decide) : mesurer l'export. Repli en 12.
6. Tres grosses chaines JS (Babel, Metro, Jest, ESLint) : fichiers de 350 Ko au plus, exclusions lint, verifier au premier `npx expo export` et au premier `jest`.
7. Qualite du plan avec liste courte (perte de variete ou d'anti-gaspi) : stratification, plafonds, completion par creneau, banc bloquant.
8. Quasi-doublons (variantes d'une meme base) : Decouvrir peut paraitre repetitif ; le tri par defaut melange ; deduplication = decision du user.
9. Stabilite des ids : registre append-only, test d'empreinte, jamais regenere sans accord.
10. Regression des 474 : chemin tableau intact, `dishFamily` garde la regex pour eux, tests existants inchanges.
11. Memoire cumulee avec les 344 photos (15 Mo) des 474 : les generees n'ont pas de photo (composition d'emojis). Aucun changement visuel.
12. Ecrans non relus en detail : `BatchScreen`, `ShoppingScreen`, `WeekScreen` : a relire avant de coder.
13. `qs` optionnel dans `shopping.js` : verifier qu'une ligne `optional` n'est pas comptee dans le total de la liste de courses.

## 12. Repli si le poids du binaire est trop eleve

Dans cet ordre, a ne declencher que sur mesure : (a) titres en gabarit + noms d'ingredients (reduit aussi la traduction, mais grammaire risquee en ru, ar, de) ; (b) packs de langue en fichiers assets (`.txt`, `metro.config.js` avec `assetExts`, lecture `expo-file-system`), ce qui rend la lecture asynchrone et impose des mocks Jest ; (c) migration des 474 vers le format compact (gain environ 2 Mo de tas et 4 Mo de JSON, mais touche des textes relus).

## 13. Decisions du user (non tranchees, rien n'est fait sans accord)

1. Ordre par defaut de Decouvrir sans recherche (melange stable propose).
2. Bonus de priorite des 474 recettes relues dans la liste courte (+4 propose).
3. Filtres supplementaires "temps maximum" et "famille de plat" (proposes, non inclus).
4. Plafond de favoris (3 000 propose) pour tenir sous 512 Ko de sauvegarde.
5. Bannière visible "repas devenu incompatible" pour `auditPlan` (la fonction est livree, l'ecran non).
6. Deduplication des quasi-doublons (rapport fourni, rien supprime).
7. Titres complets (retenu) contre gabarits (repli 12) si le binaire gonfle trop.
