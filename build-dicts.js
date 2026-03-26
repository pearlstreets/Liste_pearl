const fs = require("fs");

// Petite normalisation pour dédoublonner proprement
const normalize = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

// Listes ALIMENTAIRES (sélection large)
const FOODS = [
  "pain","baguette","pain de mie","pain complet","pain aux céréales","croissant","brioche","viennoiseries",
  "lait","lait entier","lait demi-écrémé","lait écrémé","lait végétal","lait d'amande","lait de soja","lait d'avoine",
  "beurre","beurre demi-sel","beurre doux","margarine",
  "yaourt","yaourt nature","yaourt grec","yaourt vanille","yaourt fraise",
  "fromage","emmental","gruyère","comté","parmesan","mozzarella","camembert","brie","chèvre",
  "crème fraîche","crème liquide","crème épaisse",
  "oeufs","œufs",
  "poulet","escalopes de poulet","boeuf","steak haché","dinde","jambon","lardons","bacon","saucisson","merguez","chipolatas",
  "saumon","thon","cabillaud","colin","crevettes","moules","sardines","saumon fumé",
  "tomates","pommes","bananes","oranges","citrons","pamplemousse","clémentines","mandarines","poires","pêches","nectarines","abricots","prunes","raisins","fraises","framboises","myrtilles","mûres","cerises","melon","pastèque","ananas","mangue","kiwi","avocat",
  "salade","laitue","mâche","roquette","concombre","courgettes","aubergine","poivron","carottes","oignons","ail","échalotes","radis","betteraves","navets","poireaux","céleri","brocoli","chou-fleur","chou","épinards","champignons","pommes de terre","patate douce","haricots verts","petits pois","maïs",
  "riz","riz basmati","riz complet","riz thaï","riz arborio","pâtes","spaghetti","penne","fusilli","coquillettes","tagliatelles","gnocchi","semoule","couscous","quinoa","boulgour","lentilles","lentilles corail","pois chiches","haricots rouges","haricots blancs","flageolets",
  "farine","sucre","sucre roux","sucre glace","levure","levure chimique","bicarbonate","sel","poivre","épices","curry","paprika","cumin","herbes de provence",
  "huile d'olive","huile de tournesol","huile de colza","vinaigre","vinaigre balsamique","sauce soja","sauce tomate","coulis de tomate","concentré de tomate","pesto","mayonnaise","ketchup","moutarde","cornichons","olives","bouillon","cubes de bouillon","lait de coco","crème de coco",
  "confiture","miel","pâte à tartiner","chocolat","cacao",
  "céréales","muesli","granola","biscuits","gâteaux","madeleines","crackers","chips","pop-corn","fruits secs","noix","amandes","noisettes","pistaches","cacahuètes",
  "eau","eau gazeuse","soda","cola","limonade","jus d'orange","jus de pomme","jus de fruits","thé","infusion","café","café moulu","café en grains","capsules café",
  "pizza surgelée","frites surgelées","légumes surgelés","glaces","sorbet",
  "pain burger","pain hot-dog","tortillas","wraps","galettes","crêpes","pâte feuilletée","pâte brisée",
  "sel fin","gros sel","purée","compote","sauce salade","vinaigrette","sirop","yaourt à boire"
];

// Listes NON ALIMENTAIRES (hygiène, maison, beauté, électronique, etc.)
const NONFOODS = [
  "lessive","lessive liquide","lessive capsules","adoucissant","détachant","blanchissant","javel","désinfectant","nettoyant multi-surfaces","nettoyant vitres","nettoyant sol",
  "liquide vaisselle","pastilles lave-vaisselle","sel régénérant","liquide rinçage","éponges","grattoirs","chiffon microfibre","balai","serpillière","seau","gants ménagers",
  "sacs poubelle","papier aluminium","film étirable","papier cuisson","sacs congélation","boîtes de conservation",
  "essuie-tout","papier toilette","mouchoirs","serviettes en papier","allumettes",
  "savon","gel douche","shampoing","après-shampoing","dentifrice","brosse à dents","brosse à dents électrique","bain de bouche","fil dentaire","déodorant",
  "rasoir","rasoir électrique","mousse à raser","gel à raser","lames de rasoir",
  "crème hydratante","lait corporel","crème mains","coton-tiges","cotons","disques démaquillants","lingettes","serviettes hygiéniques","tampons","protège-slips","gel hydroalcoolique",
  "maquillage","fond de teint","poudre compacte","blush","mascara","eyeliner","crayon yeux","fard à paupières","rouge à lèvres","gloss","vernis à ongles","dissolvant","pinceaux maquillage","démaquillant","eau micellaire","lotion tonique","sérum","bb cream",
  "télé","télévision","téléviseur","tv","smartphone","téléphone","ordinateur","ordinateur portable","pc","laptop","macbook","tablette","ipad","écran","moniteur",
  "clavier","souris","imprimante","cartouches d'encre","casque","écouteurs","écouteurs bluetooth","casque audio","enceinte bluetooth","barre de son",
  "routeur","modem","box internet","caméra","appareil photo","carte mémoire","carte sd","clé usb","disque dur","ssd","câble usb","câble usb-c","câble lightning","câble hdmi","multiprise","rallonge","chargeur","chargeur usb","adaptateur secteur","batterie externe","powerbank",
  "console","ps5","xbox","nintendo switch","manette","jeux vidéo",
  "micro-ondes","four","aspirateur","robot aspirateur","grille-pain","bouilloire","cafetière","robot de cuisine","blender","mixeur","friteuse","friteuse à air","plancha",
  "cahier","carnet","feuilles","papier a4","classeur","chemises","intercalaires","agrafeuse","agrafes","perforatrice","scotch","ruban adhésif","colle","bâton de colle","enveloppes","stylos","stylo bille","stylo gel","crayon","critérium","mines","gomme","taille-crayon","surligneur","feutres","marqueurs",
  "marteau","tournevis","tournevis cruciforme","perceuse","vis","chevilles","clous","mètre","niveau","scie","ruban isolant","colle forte","silicone","cartouche silicone","pistolet à colle","pistolet à silicone","cutter","lames cutter","gants de travail","lunettes de protection","masque",
  "terreau","engrais","graines","semences","arrosoir","tuyau d'arrosage","pistolet d'arrosage","sécateur","gants de jardin","tuteur","barbecue","charbon de bois","allume-feu",
  "lave-glace","huile moteur","liquide de frein","liquide de refroidissement","ampoules voiture","balais d'essuie-glace",
  "couches","couches bébé","lingettes bébé","lait infantile","petits pots","biberon","tétines","coton bébé","talc","crème pour le change",
  "croquettes chien","croquettes chat","pâtée chien","pâtée chat","litière","jouet chien","jouet chat"
];

// Synonymes/variantes pour remapper vers un nom canonique
const CATALOG_ADD = {
  "télé": ["tele","tv","télévision","television","téléviseur","ecran tv","ecran television"],
  "ordinateur": ["pc","computer","ordinateur fixe","unité centrale"],
  "ordinateur portable": ["laptop","notebook","portable pc","ultrabook","macbook"],
  "smartphone": ["telephone","téléphone","portable","iphone","android","gsm","téléphone portable"],
  "tablette": ["ipad","tablette tactile"],
  "casque": ["casque audio","headphone","headphones"],
  "écouteurs": ["earbuds","ecouteur","ecouteurs bluetooth","airpods"],
  "enceinte bluetooth": ["haut-parleur bluetooth","enceinte","speaker bluetooth"],
  "chargeur": ["chargeur usb","adaptateur secteur","bloc de charge","chargeur secteur"],
  "câble hdmi": ["hdmi","cordon hdmi"],
  "câble usb": ["usb","cordon usb","cable usb","câble usb-a"],
  "câble usb-c": ["usb c","type c","usb type c"],
  "câble lightning": ["lightning","cable iphone"],
  "clé usb": ["clef usb","usb key"],
  "disque dur": ["hdd","disque dur externe","disque dur portable"],
  "ssd": ["disque ssd"],
  "console": ["console de jeux","console de jeu"],
  "manette": ["gamepad","controller"],
  "rasoir": ["rasoir jetable","rasoir manuel","lame de rasoir","rasoir de sûreté"],
  "rasoir électrique": ["rasoir electrique","tondeuse barbe","tondeuse"],
  "maquillage": ["makeup","cosmetiques","cosmétiques","kit maquillage"],
  "œufs": ["oeufs","oeuf","œuf"],
  "pâtes": ["pates","pasta"],
  "pomme de terre": ["pommes de terre","patate","patates"],
  "essuie-tout": ["sopalin","essuie tout","rouleau essuie-tout"],
  "papier aluminium": ["papier alu","alu","papier d aluminium","papier d'aluminium"],
  "film étirable": ["film alimentaire","cellophane","film plastique"],
  "liquide vaisselle": ["produit vaisselle","liquide de vaisselle"],
  "lessive": ["lessive liquide","lessive en poudre","capsules de lessive"],
  "adoucissant": ["assouplissant"],
  "détachant": ["anti tache","anti taches"],
  "désinfectant": ["desinfectant"],
  "gel hydroalcoolique": ["gel hydro alcoolique","gel main"],
  "papier toilette": ["papier wc","pq","papier hygienique","papier hygiénique"],
  "serviettes hygiéniques": ["serviettes hygieniques"],
  "après-shampoing": ["apres-shampoing","apres shampoing","après shampoing","conditionneur"],
  "shampoing": ["shampooing","shampoin"],
  "yaourt": ["yahourt","yoghourt","yaourths"],
  "huile d'olive": ["huile olive"],
  "vinaigre balsamique": ["balsamique"],
  "soda": ["boisson gazeuse"],
  "cola": ["coca","coke"],
  "chips": ["chip"]
};

// Charger existants si présents
let dict = [];
let catalog = {};
try { dict = JSON.parse(fs.readFileSync("data/grocery-fr.json","utf8")); } catch {}
try { catalog = JSON.parse(fs.readFileSync("data/catalog-fr.json","utf8")); } catch {}

// Construire un set pour dédoublonner
const set = new Set(dict.map(x => x.trim()).filter(Boolean));
for (const arr of [FOODS, NONFOODS]) {
  for (const item of arr) {
    if (!item) continue;
    set.add(item.trim());
  }
}

// Ajouter les clés canoniques du catalog add dans le dict
for (const k of Object.keys(CATALOG_ADD)) set.add(k);

// Fusionner catalog existant et ajouts
for (const k of Object.keys(CATALOG_ADD)) {
  const cur = Array.isArray(catalog[k]) ? catalog[k] : [];
  const merged = new Map();
  for (const v of cur) merged.set(normalize(v), v);
  for (const v of CATALOG_ADD[k]) merged.set(normalize(v), v);
  catalog[k] = Array.from(merged.values()).sort((a,b)=>a.localeCompare(b));
}

// Écrire fichiers finaux
const outDict = Array.from(set.values()).sort((a,b)=>a.localeCompare(b));
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/grocery-fr.json", JSON.stringify(outDict, null, 2), "utf8");
fs.writeFileSync("data/catalog-fr.json", JSON.stringify(catalog, null, 2), "utf8");

console.log("Dictionnaires mis à jour:");
console.log("- data/grocery-fr.json:", outDict.length, "entrées");
console.log("- data/catalog-fr.json:", Object.keys(catalog).length, "clés canoniques");
