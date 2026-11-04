// Aspect du plat fini, ajouté au prompt d'une recette : à quoi ressemble VRAIMENT le plat une fois servi
// (forme, texture, couleur, façon dont les ingrédients apparaissent). Testé sur le titre anglais.
// Ordre = priorité : les plats précis passent avant les mots génériques (« pil pil » avant « cod »,
// « clafoutis » avant « cake »). Une entrée « precis » est cherchée dans tout le titre ; les autres
// d'abord dans la tête du titre (avant « with », « served », « in »), puis dans tout le titre (sauf
// « h » : tête seulement, mots de dessert trop vagues).
// sans : faux amis à exclure si la recette n'a aucun ingrédient dont la clé correspond ([mot, /clé/]),
// ou toujours (mot seul).
'use strict';

const PDT = ['potatoes', /^(pomme-de-terre|frites|gnocchi)/];
const RIZ = ['rice', /^riz/];
const PAIN = ['bread', /^(pain|baguette|croutons|tortilla)/];

const ASPECTS = [
  /* ---------------------------------------------------------------- plats précis (tout le titre) */
  {
    p: 1,
    re: /\baligot\b/,
    aspect:
      'a mound of smooth, glossy, stretchy cheesy mashed potato pulled up into long elastic ribbons, pale ivory and lump-free',
    sans: ['gnocchi', 'pasta'],
  },
  {
    p: 1,
    re: /\bpil[- ]?pil\b/,
    aspect:
      'thick white cod pieces, skin side up, coated in a thick pale golden emulsified garlic olive oil sauce, golden garlic slices',
  },
  {
    p: 1,
    re: /\bclafoutis\b/,
    aspect:
      'a baked custard flan in a round ceramic dish, no crust, puffed golden top, whole fruit pieces set in the creamy batter',
    sans: ['pastry crust'],
  },
  {
    p: 1,
    re: /\bfar breton\b/,
    aspect:
      'a dense, custardy flan cake with a deep brown caramelized top, cut into squares showing soft prunes inside',
    sans: ['pastry crust'],
  },
  {
    p: 1,
    re: /\b(brick pastr\w*|bricks?|briouats?)\b/,
    aspect:
      'crisp golden triangles of very thin fried brick pastry, flaky and blistered, one cut open showing the filling inside',
    sans: ['fried egg on top'],
  },
  {
    p: 1,
    re: /\bfloating islands?\b/,
    aspect:
      'soft white poached meringue clouds floating on pale yellow vanilla custard, thin threads of amber caramel on top',
  },
  {
    p: 1,
    re: /\bosso buco\b/,
    aspect:
      'thick cross-cut veal shanks with the round marrow bone in the center, braised in a chunky tomato sauce, sprinkled with gremolata',
  },
  {
    p: 1,
    re: /\bsaltimbocca\b/,
    aspect:
      'thin golden pan-fried escalopes each topped with a slice of cured ham and a sage leaf, glossy pan juices',
  },
  {
    p: 1,
    re: /\barancini\b/,
    aspect:
      'golden deep-fried breaded rice balls, crisp crust, one broken open showing the rice and melted stringy mozzarella inside',
  },
  {
    p: 1,
    re: /\bcannelloni\b/,
    aspect:
      'large stuffed pasta tubes lined up side by side in the dish, covered with sauce and melted golden cheese',
  },
  {
    p: 1,
    re: /\b(croquetas|croquettes?)\b/,
    aspect:
      'small cylinder-shaped golden breaded croquettes, crisp outside, one cut open showing a creamy filling',
  },
  {
    p: 1,
    re: /\b(fabada|cassoulet)\b/,
    aspect:
      'a hearty stew of large creamy white beans with chunks of sausage and pork in a thick orange-tinted broth',
  },
  {
    p: 1,
    re: /\bcocido\b/,
    aspect:
      'chickpeas, chunks of vegetables and pieces of meat served together in a light golden broth',
  },
  {
    p: 1,
    re: /\bmigas\b/,
    aspect:
      'golden pan-fried bread crumbs, slightly crunchy, tossed with crisp pieces of chorizo and garlic',
  },
  {
    p: 1,
    re: /\bempanadas?\b/,
    aspect:
      'a large golden pastry pie with crimped edges and a glossy top, one slice cut out showing the filling',
  },
  {
    p: 1,
    re: /\bpisto\b|\bratatouille\b/,
    aspect:
      'a chunky stew of soft diced tomato, bell peppers, zucchini and onion in a glossy red sauce',
  },
  {
    p: 1,
    re: /\bkibbeh\b/,
    aspect:
      'a baked layer of bulgur and spiced ground meat cut into diamond shapes, crisp deep golden-brown top',
  },
  {
    p: 1,
    re: /\b(makloubeh|maqluba)\b/,
    aspect:
      'a tall dome of rice turned out upside down, topped with golden chicken pieces and fried vegetables',
  },
  {
    p: 1,
    re: /\bsayadieh\b/,
    aspect:
      'brown caramelized onion rice topped with flakes of white fish, toasted nuts and golden fried onions',
  },
  {
    p: 1,
    re: /\bshawarma\b/,
    aspect:
      'thin strips of spiced roasted meat with crisp charred edges, fresh salad beside them and a drizzle of white sauce',
  },
  {
    p: 1,
    re: /\btandoori\b/,
    aspect: 'bright red-orange spiced pieces with charred edges, juicy, lemon wedges beside them',
  },
  {
    p: 1,
    re: /\bbutter chicken\b/,
    aspect:
      'tender chicken pieces in a smooth, creamy orange tomato sauce with a glossy surface and a swirl of cream',
  },
  {
    p: 1,
    re: /\b(oyakodon|donburi)\b/,
    aspect:
      'a bowl of white rice topped with chicken simmered in softly set egg and a glossy brown sauce',
  },
  {
    p: 1,
    re: /\bbulgogi\b/,
    aspect:
      'thin caramelized slices of marinated beef with a glossy dark glaze and sesame seeds, steamed rice beside them',
  },
  {
    p: 1,
    re: /\b(tonkatsu|katsu)\b/,
    aspect:
      'a thick golden panko-breaded pork cutlet sliced into strips, crisp crust, juicy pale meat, a mound of shredded cabbage',
  },
  {
    p: 1,
    re: /\bpozole\b/,
    aspect:
      'a deep red chili broth with large white hominy corn kernels and tender pork pieces, sliced radish on top',
  },
  {
    p: 1,
    re: /\bmole\b/,
    aspect:
      'chicken pieces covered with a thick, glossy, very dark brown mole sauce, sprinkled with sesame seeds',
  },
  {
    p: 1,
    re: /\bpibil\b/,
    aspect:
      'tender shredded pork tinted bright orange by achiote, very juicy, with pickled red onions on top',
  },
  {
    p: 1,
    re: /\bpicadillo\b/,
    aspect: 'browned ground beef in a thick tomato sauce studded with green olives and raisins',
  },
  {
    p: 1,
    re: /\bgoulash\b/,
    aspect: 'tender chunks of beef in a thick, glossy, deep red paprika sauce',
  },
  {
    p: 1,
    re: /\b(bourguignon|daube)\b/,
    aspect:
      'large tender chunks of beef in a dark, glossy red wine sauce with carrots and small mushrooms',
  },
  {
    p: 1,
    re: /\bblanquette\b/,
    aspect: 'pale tender veal pieces and vegetables in a smooth, creamy ivory-white sauce',
  },
  {
    p: 1,
    re: /^eggs? in red wine sauce|\bmeurette\b/,
    aspect:
      'soft poached eggs with runny yolks sitting in a glossy dark red wine sauce, crisp bread croutons beside them',
  },
  {
    p: 1,
    re: /\bal ajillo\b/,
    aspect:
      'pieces sizzling in golden olive oil with plenty of sliced golden garlic and red chili, glossy and fragrant',
  },
  {
    p: 1,
    re: /\bescabeche\b/,
    aspect:
      'fish fillets resting in a tangy golden marinade with thin carrot rounds, onion rings and bay leaves',
  },
  {
    p: 1,
    re: /\b(socca|farinata)\b/,
    aspect:
      'a thin golden chickpea flour pancake with crisp blistered edges, cut into wedges, the toppings scattered over',
  },
  {
    p: 1,
    re: /\btartiflette\b/,
    aspect: 'potato slices, bacon and onions baked under a melted, bubbling golden Reblochon crust',
  },
  {
    p: 1,
    re: /\b(hachis parmentier|shepherd'?s pie|cottage pie)\b/,
    aspect:
      'minced meat under a thick layer of golden mashed potato with browned ridges on top, a portion showing both layers',
  },
  {
    p: 1,
    re: /\b(lasagn[ae])\b/,
    aspect:
      'a square portion showing distinct layers of pasta sheets, sauce and white béchamel, golden bubbling cheese on top',
  },
  {
    p: 1,
    re: /\bmoussaka\b/,
    aspect:
      'a square portion showing layers of eggplant slices and meat sauce under a thick golden béchamel top',
  },
  {
    p: 1,
    re: /\bcarbonara\b/,
    aspect:
      'pasta coated in a silky pale yellow egg and cheese sauce with crisp pieces of bacon and black pepper',
  },
  {
    p: 1,
    re: /\bpaella\b/,
    aspect:
      'saffron yellow rice spread thin in a wide shallow pan, the pieces nestled on top, slightly crisp at the edges',
  },
  {
    p: 1,
    re: /\bbiryani\b/,
    aspect:
      'long fluffy rice grains streaked yellow and white, layered with spiced pieces, fried onions on top',
  },
  {
    p: 1,
    re: /\bjambalaya\b/,
    aspect: 'tomato-red rice mixed with pieces of sausage, chicken and peppers',
  },
  {
    p: 1,
    re: /\bshakshuka|chakchouka\b/,
    aspect:
      'eggs gently poached in a bubbling chunky red tomato and pepper sauce, glossy runny yolks',
  },
  {
    p: 1,
    re: /\btortilla espa\w*|spanish (omelet\w*|tortilla)\b/,
    aspect:
      'a thick golden potato omelette cut into wedges, showing soft layers of potato and onion inside',
  },
  {
    p: 1,
    re: /\bpad thai\b/,
    aspect:
      'flat rice noodles tinted orange, tossed with bean sprouts and scrambled egg, crushed peanuts and a lime wedge on top',
  },
  {
    p: 1,
    re: /\bfried rice\b/,
    aspect:
      'loose separate grains of lightly browned fried rice with small diced pieces of the ingredients mixed through',
  },
  {
    p: 1,
    re: /\bbibimbap\b/,
    aspect:
      'white rice topped with neat separate sections of colorful vegetables and the topping, red chili paste in the center',
  },
  {
    p: 1,
    re: /\bpoke\b/,
    aspect:
      'rice at the bottom with raw cubed fish and fresh toppings in neat sections, sesame seeds sprinkled',
  },
  {
    p: 1,
    re: /\bramen\b/,
    aspect: 'wavy noodles in a steaming golden broth, the toppings neatly arranged on the surface',
  },
  {
    p: 1,
    re: /\bpho\b/,
    aspect: 'thin rice noodles in a clear steaming broth with thin slices and fresh herbs on top',
  },
  {
    p: 1,
    re: /\btortilla soup\b/,
    aspect:
      'a red tomato broth with tender pieces, topped with crisp golden tortilla strips and diced avocado',
  },
  {
    p: 1,
    re: /\bgazpacho\b/,
    aspect: 'a chilled, perfectly smooth bright red soup with tiny diced vegetables on top',
  },
  {
    p: 1,
    re: /\b(cream of|velout\w*|bisque|creamy [a-z ]*soup)\b/,
    aspect:
      'a perfectly smooth, thick and velvety blended soup, the color of its main vegetable, no chunks',
    sans: [PAIN],
  },
  {
    p: 1,
    re: /\b(dal|dhal|dal makhani)\b/,
    aspect: 'a thick golden lentil stew, soft and creamy, glossy spiced surface',
  },
  {
    p: 1,
    re: /\bcarpaccio\b/,
    aspect: 'paper-thin slices fanned out flat over the whole plate, the toppings scattered on top',
  },
  {
    p: 1,
    re: /\blyonnaise salad\b/,
    aspect:
      'curly frisée leaves with crisp bacon pieces and croutons, topped with a poached egg with a runny yolk',
  },
  {
    p: 1,
    re: /\b(leeks? with vinaigrette|leeks? vinaigrette)\b/,
    aspect: 'tender whole leeks halved lengthwise, glossy with vinaigrette, laid side by side',
  },
  {
    p: 1,
    re: /^marinated pork\b/,
    aspect:
      'roasted marinated pork pieces with caramelized glossy edges beside golden roasted potato chunks',
  },
  {
    p: 1,
    re: /\boven-baked rice\b|\barroz al horno\b/,
    aspect:
      'golden baked rice in a shallow earthenware dish, slightly crisp on top, the pieces nestled in',
  },
  {
    p: 1,
    re: /\bfrench toast\b|\bpain perdu\b/,
    aspect: 'thick slices of golden caramelized custard-soaked bread, soft inside',
  },
  {
    p: 1,
    re: /\b(chocolate fondant|lava cakes?|molten)\b/,
    aspect: 'a small round dark chocolate cake with a thin crust and a soft, molten, glossy center',
  },
  {
    p: 1,
    re: /\ben papillote\b/,
    aspect:
      'an opened parchment parcel with the fish steamed on a bed of vegetables inside, moist and glistening with juices',
  },
  {
    p: 1,
    re: /\btuna steaks?\b/,
    aspect:
      'thick tuna steaks browned outside, moist and slightly pink in the center, one sliced to show it',
    sans: [PDT],
  },
  {
    p: 1,
    re: /\bmagret|duck breasts?\b/,
    aspect: 'sliced duck breast fanned out, crisp golden scored skin and rosy pink meat',
    sans: [PDT],
  },
  {
    p: 1,
    re: /\bduck legs?\b|\bconfit\b/,
    aspect: 'whole duck legs with crisp, deep golden, crackling skin and tender meat',
  },

  /* ---------------------------------------------------------------- types de plat (tête du titre) */
  {
    re: /\b(hummus|houmous)\b/,
    aspect:
      'a thick, smooth, creamy spread swirled in a bowl with a pool of olive oil in the center',
  },
  {
    re: /\bspread\b(?! milkshake)|\brillettes\b|\bdip\b|\btzatziki\b|\btapenade\b|\bbaba\b|\bguacamole\b|\bcaviar\b|\bmuhammara\b/,
    aspect: 'a thick creamy spread in a small bowl with toasted bread slices beside it',
  },
  {
    re: /\bsardines\b/,
    aspect: 'whole small sardines with crisp silvery golden skin, lined up side by side',
    sans: [PDT],
  },
  {
    re: /\brice noodle bowls?\b/,
    aspect:
      'thin white rice vermicelli at the bottom of the bowl, the toppings in separate neat sections on top, sauce drizzled',
  },
  {
    re: /\bnoodle soup\b/,
    aspect: 'noodles in a light steaming broth, the toppings arranged on the surface',
  },
  {
    re: /\bstir-fried noodles|\b(chow mein|lo mein|yakisoba|fried noodles)\b/,
    aspect:
      'tangled glossy noodles tossed with crisp-tender vegetables and pieces, evenly coated in sauce, slightly charred',
  },
  {
    re: /\bstir-fry\b|\bstir fry\b|\bwok\b|\bstir-fried\b/,
    aspect:
      'bite-size pieces and crisp-tender vegetables tossed together in a glossy sauce, slightly charred edges',
  },
  {
    re: /\brice bowls?\b/,
    aspect:
      'fluffy white rice at the bottom, the toppings in separate colorful sections on top, sauce drizzled over',
  },
  {
    re: /\bquinoa bowls?\b/,
    aspect:
      'fluffy quinoa with tiny curled grains at the bottom, the toppings in separate colorful sections, sauce drizzled',
  },
  {
    re: /\bbulgur bowls?\b/,
    aspect:
      'fluffy golden bulgur grains at the bottom, the toppings in separate colorful sections, sauce drizzled',
  },
  {
    re: /\byogh?urt bowls?\b/,
    aspect: 'thick creamy white yogurt topped with the fruit, nuts and seeds arranged on top',
  },
  {
    re: /\bsmoothie bowls?\b/,
    aspect:
      'a thick smoothie in a bowl, smooth surface, the fruit and seeds arranged in rows on top',
  },
  {
    re: /\bsavou?ry (cake|loaf)\b/,
    aspect:
      'a golden loaf with a domed crust, thick slices showing a soft yellow crumb dotted with pieces of the filling',
  },
  {
    re: /\bsavou?ry muffins?\b/,
    aspect: 'domed golden muffins, one broken open showing pieces of the filling in the soft crumb',
  },
  {
    re: /\bpuff pastry (tart|tarte)\b/,
    aspect:
      'a flat rectangle of golden, puffed, flaky pastry with raised crisp edges, the toppings arranged over the surface',
  },
  {
    re: /\bpuff pastry bites\b/,
    aspect: 'small golden puffed flaky pastry squares, each topped with the filling',
  },
  {
    re: /\bquiche\b/,
    aspect:
      'a deep slice showing a set, creamy pale yellow custard filling with pieces of the filling, golden shortcrust edge',
  },
  {
    re: /\btartlets?\b/,
    aspect: 'small round golden pastry cases filled with the filling, crisp edges',
  },
  {
    re: /\bomelet\w*\b/,
    aspect:
      'a soft golden folded omelette with a smooth surface, the filling peeking out from the fold',
  },
  {
    re: /\bfrittata\b/,
    aspect:
      'a thick round golden frittata, set and slightly puffed, pieces of the filling visible on top, cut into wedges',
  },
  {
    re: /^scrambled eggs?\b(?!.*\bwraps?\b)/,
    aspect: 'soft, creamy, glossy curds of pale yellow scrambled egg',
  },
  {
    re: /\b(soft|hard)-boiled eggs?\b/,
    aspect: 'eggs halved to show the yolks',
  },
  {
    re: /\bwhite pizza\b/,
    aspect:
      'a round pizza with no tomato sauce, a creamy white base, pools of melted mozzarella and the toppings scattered',
  },
  {
    re: /\bpizza\b/,
    aspect:
      'a round pizza with a thin blistered crust, red tomato sauce, pools of melted mozzarella and the toppings scattered',
  },
  {
    re: /\b(calzone)\b/,
    aspect:
      'a folded half-moon pizza with a puffed blistered golden crust, cut to show the filling',
  },
  {
    re: /\bflatbreads?|\blahmacun|\bpide\b/,
    aspect: 'a thin golden flatbread with blistered edges, the toppings spread over the surface',
  },
  {
    re: /\bgreen curry\b/,
    aspect: 'tender pieces and vegetables in a pale green, thin, glossy coconut curry sauce',
    sans: [RIZ],
  },
  {
    re: /\bred curry\b/,
    aspect: 'tender pieces and vegetables in an orange-red, glossy coconut curry sauce',
    sans: [RIZ],
  },
  {
    re: /\byellow curry\b/,
    aspect: 'tender pieces and vegetables in a golden yellow, creamy coconut curry sauce',
    sans: [RIZ],
  },
  {
    re: /\bmassaman\b/,
    aspect: 'tender chunks in a thick, rich, reddish-brown massaman curry sauce, glossy surface',
    sans: [RIZ],
  },
  {
    re: /\bkorma\b/,
    aspect: 'tender pieces in a mild, smooth, pale golden creamy sauce',
    sans: [RIZ],
  },
  {
    re: /\btikka masala|\btikka\b|\bmasala\b/,
    aspect: 'tender pieces in a creamy, bright orange spiced tomato sauce',
    sans: [RIZ],
  },
  {
    re: /\bcoconut curry\b/,
    aspect: 'tender pieces and vegetables in a creamy, pale golden coconut curry sauce',
    sans: [RIZ],
  },
  {
    re: /\bjapanese curry\b/,
    aspect: 'chunks in a thick, glossy, dark brown curry sauce, white rice beside it',
  },
  {
    re: /\bcurry\b|\bvindaloo\b|\bmadras\b|\bjalfrezi\b/,
    aspect: 'tender pieces in a thick, glossy, spiced curry sauce',
    sans: [RIZ],
  },
  {
    re: /\btagine|tajine\b/,
    aspect:
      'tender pieces slow-cooked in a thick golden spiced sauce in a terracotta tagine with a conical lid set aside',
  },
  {
    re: /\bcouscous\b/,
    aspect: 'fluffy separate grains of couscous with the vegetables and pieces arranged on top',
  },
  {
    re: /\brisotto|orzotto\b/,
    aspect:
      'creamy, loose, glossy rice that spreads slightly on the plate, each grain still distinct, the pieces mixed through',
  },
  {
    re: /\bpasta salad\b/,
    aspect: 'cold short pasta tossed with the pieces and lightly dressed, glossy and colorful',
  },
  {
    re: /\bbulgur salad\b/,
    aspect: 'fluffy golden bulgur grains mixed with small diced pieces of the ingredients',
  },
  {
    re: /\btabbouleh\b/,
    aspect: 'fine grains mixed with plenty of finely chopped fresh herbs and small diced pieces',
  },
  {
    re: /\brice salad\b/,
    aspect: 'cold separate rice grains mixed with small colorful diced pieces',
  },
  {
    re: /\bquinoa salad\b/,
    aspect: 'fluffy quinoa with tiny curled grains mixed with small colorful diced pieces',
  },
  {
    re: /\bpotato salad\b/,
    aspect: 'tender cubes of cooked potato lightly dressed and mixed with the other pieces',
  },
  {
    re: /\blentil salad\b/,
    aspect: 'small whole lentils, firm and glossy, mixed with small diced pieces',
  },
  {
    re: /\bchickpea salad\b/,
    aspect: 'whole chickpeas mixed with small diced pieces, lightly dressed',
  },
  {
    re: /\b(vermicelli|noodle) salad\b/,
    aspect: 'thin rice vermicelli tossed with crunchy vegetables and fresh herbs',
  },
  {
    p: 1,
    re: /\bfruit salad\b|^[a-z ,]+ salad with (mint|vanilla syrup)$/,
    aspect: 'neat bite-size pieces of fresh fruit, juicy and glistening, gently mixed',
  },
  {
    re: /\b(coleslaw|slaw)\b/,
    aspect: 'finely shredded crunchy cabbage and carrot in a light creamy dressing',
  },
  {
    re: /\bsalad\b/,
    aspect: 'loose fresh leaves tossed with the toppings, lightly dressed, fresh and colorful',
  },
  {
    re: /\bgratin\b/,
    aspect:
      'tender pieces of the vegetable baked in a creamy sauce under a golden, bubbling, browned cheese crust',
  },
  {
    re: /\bbaked (gnocchi|pasta|macaroni|penne|rigatoni)\b/,
    aspect: 'pasta baked in sauce under a golden, bubbling, melted cheese crust',
  },
  {
    re: /\bsoups?\b|\bbroth\b|\bminestrone\b|\bharira\b|\bchowder\b/,
    aspect: 'a brothy soup with tender visible pieces of the ingredients',
    sans: [PAIN],
  },
  {
    re: /\bstew\b|\bnavarin\b|\bragout\b|\bcasserole\b/,
    aspect: 'tender chunks in a thick, glossy sauce',
  },
  {
    re: /\bchili con carne\b|^chili\b/,
    aspect: 'a thick red stew of ground beef and beans',
  },
  {
    re: /\bpan-fried [a-z ]*fillets?\b|\bpan-fried [a-z ]*loin\b/,
    aspect:
      'fish fillets with a crisp golden seared skin side, moist flaky flesh, the side arranged next to them',
    sans: [PDT],
  },
  {
    re: /\bgrilled [a-z ]*fillets?\b|\bgrilled [a-z ]*loin\b/,
    aspect:
      'fish fillets with light grill marks, moist flaky white flesh, the side arranged next to them',
    sans: [PDT],
  },
  {
    re: /\bbaked [a-z ]*fillets?\b|\bbaked [a-z ]*loin\b/,
    aspect: 'tender oven-baked fish fillets, opaque and flaky, lightly golden on top',
    sans: [PDT],
  },
  {
    re: /\bcod loin\b/,
    aspect: 'a thick white cod loin with large moist flakes, lightly golden on top',
    sans: [PDT],
  },
  {
    re: /\b(salmon|trout) fillets?\b/,
    aspect: 'pink-orange fish fillets, moist and flaky, lightly golden on top',
    sans: [PDT],
  },
  {
    re: /\bfillets?\b/,
    aspect: 'moist flaky fish fillets, lightly golden',
    sans: [PDT],
  },
  {
    re: /\bescalopes?\b|\bcutlets?\b/,
    aspect:
      'thin golden pan-fried escalopes, lightly browned, the sauce spooned over, the side next to them',
  },
  {
    re: /\bchicken thighs?\b/,
    aspect: 'golden browned chicken thighs, juicy and glazed, the side arranged next to them',
  },
  {
    re: /\bchicken breasts?\b/,
    aspect: 'a golden seared chicken breast sliced to show juicy white meat, the side next to it',
  },
  {
    re: /\btenderloin\b/,
    aspect: 'round medallions of pork tenderloin, browned outside and juicy inside, sauce around',
  },
  {
    re: /\blamb chops?\b/,
    aspect: 'small bone-in lamb chops charred outside and pink inside, the side next to them',
  },
  {
    re: /\bpork chops?\b|\bchops?\b/,
    aspect: 'thick bone-in pork chops seared golden-brown, juicy, the side next to them',
  },
  {
    re: /\bsteaks?\b/,
    aspect:
      'a seared beef steak with a dark brown crust, sliced to show the pink center, the side next to it',
  },
  {
    re: /\btoulouse sausages?\b/,
    aspect: 'thick coiled pork sausage browned and glossy, the side next to it',
  },
  {
    re: /\bsausages?\b|\bchipolatas?\b|\bmerguez\b/,
    aspect: 'browned glossy sausages, the side arranged next to them',
  },
  {
    re: /\bskewers?\b|\bkebabs?\b|\bbrochettes?\b|\bsatay\b|\bsouvlaki\b|\byakitori\b/,
    aspect: 'pieces and vegetables threaded on wooden skewers, nicely charred edges',
  },
  {
    re: /\broast(ed)? (chicken|lamb|pork|beef)\b|\bshoulder\b|\bcordero\b/,
    aspect: 'tender roasted meat with a deep golden-brown crust, juicy, carved pieces',
  },
  {
    re: /\bspaghetti\b|\blinguine\b/,
    aspect: 'long thin pasta twirled into a nest, evenly coated in the sauce, pieces on top',
  },
  {
    re: /\btagliatelle|pappardelle|fettuccine\b/,
    aspect: 'long flat ribbon pasta in loose nests, coated in the sauce',
  },
  {
    re: /\bpenne\b/,
    aspect: 'short ridged pasta tubes cut on the diagonal, coated in the sauce',
  },
  {
    re: /\brigatoni\b/,
    aspect: 'large ridged pasta tubes coated in the sauce',
  },
  {
    re: /\bfusilli\b/,
    aspect: 'short corkscrew spiral pasta coated in the sauce',
  },
  {
    re: /\bfarfalle\b/,
    aspect: 'bow-tie shaped pasta coated in the sauce',
  },
  {
    re: /\borecchiette\b/,
    aspect: 'small ear-shaped cupped pasta coated in the sauce',
  },
  {
    re: /\bconchiglie\b/,
    aspect: 'shell-shaped pasta coated in the sauce',
  },
  {
    re: /\bgnocchi\b/,
    aspect: 'small soft pillowy potato gnocchi with ridges, coated in the sauce',
  },
  {
    re: /\bravioli|tortellini\b/,
    aspect: 'plump square stuffed pasta parcels coated in the sauce',
  },
  {
    re: /\bmac(aroni)? and cheese\b/,
    aspect: 'short elbow pasta in a thick, creamy, golden cheese sauce',
  },
  {
    re: /\bpasta\b|\bnoodles?\b|\bvermicelli\b/,
    aspect: 'pasta evenly coated in the sauce with the pieces mixed through',
  },
  {
    re: /\bpolenta sticks\b|\bpolenta fries\b/,
    aspect: 'golden crisp polenta sticks, crunchy outside and soft inside',
  },
  {
    re: /\bcreamy polenta\b|\bpolenta\b/,
    aspect: 'soft, creamy, golden yellow polenta',
  },
  {
    re: /\b(mashed|pur[ée]e)\b/,
    aspect: 'a smooth, creamy, fluffy purée with a pool of melted butter',
  },
  {
    re: /^(oven-)?roasted\b/,
    aspect: 'tender pieces caramelized with browned edges, glossy with oil, sprinkled with herbs',
  },
  {
    re: /^(saut[ée]ed|golden)\b/,
    aspect: 'tender pieces lightly browned and glossy, sprinkled with herbs',
  },
  {
    re: /^steamed\b/,
    aspect: 'bright, tender steamed pieces of the vegetable, glistening',
  },
  {
    re: /^(braised|glazed)\b/,
    aspect: 'tender, glossy, caramelized pieces of the vegetable in their reduced juices',
  },
  {
    re: /\bcreamed\b|\bcreamy (peas|spinach|leeks)\b/,
    aspect: 'tender vegetables coated in a smooth cream sauce',
  },
  {
    re: /\bwraps?\b|\bburritos?\b/,
    aspect: 'rolled soft tortilla wraps cut in half, showing the layered filling inside',
  },
  {
    re: /\bpitas?\b/,
    aspect: 'warm pita breads stuffed generously with the filling',
  },
  {
    re: /\bpatties\b|\bfalafels?\b|\b(sweet potato|quinoa) cakes\b/,
    aspect: 'golden pan-fried patties, crisp browned outside, one cut open showing the soft inside',
  },
  {
    re: /\bfritters?\b|\bbhajis?\b|\bbeignets?\b/,
    aspect: 'golden puffy deep-fried fritters, crisp and craggy outside, soft inside',
  },
  {
    re: /\b(meatballs?|herb balls|kefta)\b/,
    aspect: 'round browned balls simmered in sauce, glossy and tender',
  },
  {
    re: /\bburgers?\b/,
    aspect:
      'a burger in a soft toasted bun, the patty and fillings stacked and clearly visible from the side',
  },
  {
    re: /\btacos?\b/,
    aspect: 'soft small tortillas folded around the filling, topped with fresh garnish',
  },
  {
    re: /\bquesadillas?\b/,
    aspect: 'golden toasted folded tortillas cut into wedges, melted cheese and filling inside',
  },
  {
    re: /\bfajitas?\b/,
    aspect: 'strips of seared meat and bell peppers with warm soft tortillas beside them',
  },
  {
    re: /\bbruschett\w*|\btartines?\b|\btoasts?\b|\bcrostini\b/,
    aspect: 'slices of golden toasted bread generously topped with the toppings',
  },
  {
    re: /\bsandwich\w*|\bpanini\b|\bcroque\b|\bbagels?\b|\bclub\b/,
    aspect: 'a sandwich cut in half showing the generous layered filling',
  },
  {
    re: /\bbites\b|\bnuggets\b|\bpuffs?\b/,
    aspect: 'small golden bite-size pieces, crisp outside',
  },

  /* ---------------------------------------------------------------- petit-déjeuner, desserts, boissons */
  {
    re: /\bsmoothie\b/,
    aspect: 'a thick, smooth, creamy drink, the color of its fruit, a few small bubbles on top',
  },
  {
    re: /\bmilkshake\b/,
    aspect: 'a thick frothy milkshake, the color of its flavor, foamy on top',
  },
  {
    re: /\blassi\b/,
    aspect: 'a thick creamy yogurt drink, pale and smooth',
  },
  {
    re: /\bjuice\b|\blemonade\b/,
    aspect: 'a fresh clear drink the color of its fruit, with ice',
  },
  {
    re: /\biced tea\b|\biced coffee\b|\bhot chocolate\b|\bdrink\b/,
    aspect: 'a drink the color of its ingredients',
  },
  {
    h: 1,
    re: /\bcups\b|\bverrines?\b|\bparfait\b/,
    aspect: 'distinct layers of cream, fruit and crumbs in a small clear glass',
  },
  {
    re: /\bcrumble\b|\bcobbler\b/,
    aspect:
      'a golden crumbly topping over soft baked fruit, purple or golden juices bubbling up at the edges',
  },
  {
    re: /\bcompote\b/,
    aspect: 'soft stewed pieces of fruit in their glossy syrup, chunky texture',
  },
  {
    re: /\bovernight oats\b/,
    aspect: 'creamy soaked oats in a glass, the fruit and toppings layered on top',
  },
  {
    re: /\bporridge\b/,
    aspect: 'creamy warm oatmeal porridge, the fruit and toppings arranged on top',
  },
  {
    re: /\bgranola\b/,
    aspect: 'crunchy golden clusters of granola over thick white yogurt with the fruit',
  },
  {
    re: /\bchia pudding\b/,
    aspect: 'a thick chia seed pudding with tiny dark seeds visible, the fruit on top',
  },
  {
    re: /\bpancakes?\b/,
    aspect: 'a stack of thick, fluffy golden pancakes, the toppings on top',
  },
  {
    re: /\bcr[eê]pes?\b/,
    aspect: 'thin golden lacy crêpes folded into quarters, the filling peeking out',
  },
  {
    re: /\bwaffles?\b/,
    aspect: 'golden crisp waffles with a deep grid pattern, the toppings on top',
  },
  {
    re: /\bcheesecake\b/,
    aspect: 'a slice of smooth, dense, creamy cheesecake on a thin biscuit base, topping on top',
  },
  {
    re: /\btiramisu\b/,
    aspect: 'layers of soaked ladyfinger biscuits and white mascarpone cream, dusted with cocoa',
  },
  {
    re: /\bpanna cotta\b/,
    aspect: 'a smooth, wobbly, creamy white panna cotta with a glossy fruit coulis on top',
  },
  {
    re: /\bsemifreddo\b|\bice cream\b|\bnice cream\b|\bsorbet\b|\bfrozen yogh?urt\b/,
    aspect: 'smooth rounded scoops, frosty and creamy',
  },
  {
    re: /\bchocolate mousse\b/,
    aspect: 'a light, airy, dark brown chocolate mousse with a smooth surface',
  },
  {
    re: /\bmousse\b/,
    aspect: 'a light, airy, smooth mousse, the color of its fruit, with a delicate topping',
  },
  {
    re: /\brice pudding\b|\bsemolina pudding\b/,
    aspect: 'soft creamy grains in a thick, smooth, pale sweet milk pudding',
  },
  {
    h: 1,
    re: /\bcream\b|\bcustard\b|\bflan\b|\bpudding\b/,
    aspect: 'a silky smooth, creamy dessert, the color of its flavor, with a delicate topping',
  },
  {
    re: /\bbrownies?\b/,
    aspect: 'dense fudgy squares of dark chocolate brownie with a crackly shiny top',
  },
  {
    re: /\bcookies?\b|\bbiscuits?\b/,
    aspect:
      'round golden cookies with crisp edges and a soft center, pieces of the filling visible',
  },
  {
    re: /\bmuffins?\b/,
    aspect:
      'domed golden muffins with a cracked top, one broken open showing a soft crumb with the fruit',
  },
  {
    re: /\bbanana bread\b|\bloaf\b/,
    aspect: 'a golden loaf cake with a cracked top, thick slices showing the soft moist crumb',
  },
  {
    re: /\btruffles?\b|\benergy balls?\b/,
    aspect: 'small round bite-size balls with a matte coating',
  },
  {
    re: /\bbark\b/,
    aspect: 'broken shards of a thin chocolate slab studded with the toppings',
  },
  {
    re: /\bchocolate salami\b/,
    aspect: 'a log of chocolate studded with biscuit pieces, cut into round slices',
  },
  {
    re: /\bturnovers?\b|\bchaussons?\b/,
    aspect: 'golden half-moon puff pastry turnovers with a glossy flaky top, one cut open',
  },
  {
    re: /\bbaked apples?\b/,
    aspect:
      'whole soft baked apples with wrinkled golden skin, the filling spilling from the center',
  },
  {
    h: 1,
    re: /\bpan-fried bananas?\b|\bcaramelized\b/,
    aspect: 'golden caramelized fruit pieces, glossy and soft',
  },
  {
    h: 1,
    re: /^(strawberries|peaches|oranges|pineapple|fruit)[a-z ]* marinated\b/,
    aspect: 'pieces of fresh fruit glistening in their marinade',
  },
  {
    re: /\b(tart|tarte|pie)\b/,
    aspect: 'a crisp golden shortcrust tart with the fruit neatly arranged on top, glossy',
  },
  {
    re: /\bcake\b|\bgâteau\b|\bfondant\b|\bmoelleux\b|\bmadeleines?\b|\bfinanciers?\b|\bscones?\b/,
    aspect: 'a golden cake, a slice cut out showing the soft moist crumb and the pieces inside',
  },
];

/** Tête du titre : avant « with », « , served », « in ». */
function tete(titre) {
  return titre.toLowerCase().split(/ with |, served | in /)[0];
}

/** Entrée d'aspect pour un titre anglais, ou null. */
function aspectDe(titre) {
  const t = (titre || '').toLowerCase();
  const h = tete(t);
  for (const a of ASPECTS) if (a.p && a.re.test(t)) return a;
  for (const a of ASPECTS) if (!a.p && a.re.test(h)) return a;
  for (const a of ASPECTS) if (!a.p && !a.h && a.re.test(t)) return a;
  return null;
}

/** Faux amis à exclure : ceux sans condition, puis ceux dont la recette n'a aucun ingrédient. Deux au plus. */
function exclusions(entree, cles) {
  if (!entree || !entree.sans) return [];
  const out = [];
  for (const s of entree.sans) {
    if (typeof s === 'string') out.push(s);
    else if (!cles.some((k) => s[1].test(k))) out.push(s[0]);
  }
  return out.slice(0, 2);
}

module.exports = { ASPECTS, aspectDe, exclusions, tete };
