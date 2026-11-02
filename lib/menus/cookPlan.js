// Mode cuisine optimisé : plan d'une recette. Pur : ni stockage, ni réseau, ni React.
//
// Le plan se déduit de ce que la recette porte déjà (stepTimers, stepKinds, stepDurations, ovenTempC)
// et du texte français des étapes, le même pour toutes les langues d'affichage :
// - une cuisson qui se fait toute seule (four, mijoté, repos, pâtes, riz) devient une cuisson avec
//   minuteur, et on fait la suite pendant ce temps ;
// - « Cuire les pâtes » attend l'eau qui bout : l'eau est mise à chauffer dès le début ;
// - les gestes de préparation (couper, émincer, mélanger dans un bol) se font pendant les cuissons ;
// - la dernière étape attend toutes les cuissons, et ce qui doit être servi chaud est lancé juste à
//   temps pour finir avec la plus longue.
//
// Tâche : { src, text?, label?, keys, d, est, cook?, need, after, sync? }
//   src   : index de l'étape d'origine (null pour une tâche ajoutée : eau, four)
//   label : { key, opts } à traduire quand la tâche est ajoutée
//   keys  : ingrédients cités, pour écrire leurs quantités dans l'étape
//   d     : durée en secondes ; est = durée estimée (pas de bip à la fin)
//   cook  : { k, kind: 'eau'|'four'|'cuisson' } : se lance, puis cuit tout seul pendant d secondes
//   need  : cuissons prêtes requises ; after : tâches faites requises
//   sync  : { k, lead } : lancer quand la cuisson k n'a plus que lead secondes
import { estObjet, arr } from './util';

const WATER_SEC = 480;
const PREHEAT_SEC = 600;
const MIN_ACTIVE = 60;
const MAX_ACTIVE = 300;
const SERVE_SEC = 120; // égoutter, mélanger, servir
const DEFAULT_TIME_MIN = 30;
const LONG_FEU_SEC = 900; // au-delà, une cuisson sur le feu se surveille de loin

const sansAccents = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'");

// féculents cuits dans l'eau bouillante, durée par défaut en secondes
const STARCH = [
  [
    /\b(pates|spaghettis?|tagliatelles?|penne|linguines?|fusillis?|macaronis?|coquillettes|farfalles?|rigatonis?|orzo|vermicelles?)\b/,
    600,
    'pates',
  ],
  [/\briz\b/, 720, 'riz'],
  [/\bnouilles\b/, 300, 'nouilles'],
  [/\bquinoa\b/, 900, 'quinoa'],
  [/\bboulgour\b/, 600, 'boulgour'],
  [/\bgnocchis?\b/, 180, 'gnocchi'],
  [/\bpolenta\b/, 300, 'polenta'],
];
const COOK_STARCH =
  /^(?:faire )?cuire (?:les |le |la |l')?(?:\w+ )?(pates|spaghettis?|tagliatelles?|penne|linguines?|fusillis?|macaronis?|coquillettes|farfalles?|rigatonis?|orzo|vermicelles?|riz|nouilles|quinoa|boulgour|gnocchis?|polenta)\b/;
const BOIL =
  /(porter (?:\S+ ){0,4}a ebullition|faire bouillir (?:de l'|l'|une (?:grande )?casserole d')eau|eau bouillante)/;
const PREHEAT = /prechauffer (?:le )?four/;
const PASSIVE_FEU =
  /(mijot|fremi|laisser cuire|cuire a couvert|couvrir et (?:laisser |faire )?cuire|a feu doux \S* ?\d+ ?min|laisser (?:reduire|epaissir|compoter|confire)|braiser|bouillir \d+|cuire \d+ (?:a|a) \d+ min a l'eau|a l'eau bouillante)/;
const PREP =
  /^(?:pendant ce temps,? |en attendant,? )?(laver|eplucher|peler|couper|emincer|hacher|ciseler|raper|presser|zester|egrener|detailler|tailler|trancher|preparer|melanger|fouetter|battre|delayer|essorer|rincer|denoyauter|ecraser|mixer|egoutter et rincer)\b/;
const NOT_PREP =
  /(ajout|remett|incorpor|vers(?:er|ant) (?:sur|dans|le tout)|avec les? (?:pates|riz|nouilles)|dans la (?:poele|casserole|sauteuse|cocotte|marmite|poelon)|dans le wok|le tout|cuire|dorer|revenir|sauter|enfourner|chauff|servir|dresser)/;
const OUT_OF_OVEN =
  /(sortir|sortie du four|du four|demoul|laisser tiedir|tiedir|refroidir|napper|garnir le|decouper le gateau|couper en parts|servir)/;
const MEANWHILE = /^(pendant ce temps|pendant la cuisson|en attendant)/;
const SERVE = /\b(servir|dresser|deguster|napper|parsemer)\b/;
const DURATION = /(\d+)(?:\s*(?:a|à|-)\s*\d+)?\s*(minutes?|min\b|heures?|h\b)/;
const NOT_A_DURATION = /avant la fin|derni[eè]res?/;

const positive = (x) => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function durationIn(txt) {
  if (NOT_A_DURATION.test(txt)) return 0;
  const m = txt.match(DURATION);
  if (!m) return 0;
  const q = Number(m[1]) * (/de chaque cote|par face|sur chaque face/.test(txt) ? 2 : 1);
  return /^h/.test(m[2]) ? q * 3600 : q * 60;
}

function starchOf(txt) {
  for (const [re, sec, key] of STARCH) if (re.test(txt)) return { sec, key };
  return null;
}

/** Ingrédients cités dans un texte français : mot principal du nom, au singulier ou au pluriel. */
function stemsOf(names) {
  const out = [];
  for (const [key, name] of names) {
    const words = sansAccents(name)
      .replace(/\(.*?\)/g, ' ')
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !['des', 'les', 'aux', 'pour', 'avec', 'sans'].includes(w));
    if (!words.length) continue;
    const w = words[0].replace(/(s|x)$/, '');
    out.push([key, new RegExp(`\\b${w}(s|x|e|es)?\\b`)]);
  }
  return out;
}

/**
 * Plan d'une recette.
 * recipe : la recette (stepTimers, stepKinds, stepDurations, ovenTempC, timeMin, ingredients)
 * frSteps : étapes en français (servent à comprendre la recette)
 * steps : étapes dans la langue d'affichage (même nombre que frSteps)
 * ingredientName(key) : nom français d'un ingrédient
 * -> { tasks, seqSec }
 */
export function buildCookPlan({ recipe, steps, frSteps, ingredientName } = {}) {
  const r = estObjet(recipe) ? recipe : {};
  const shown = arr(steps).map((x) => String(x || ''));
  const fr =
    arr(frSteps).length === shown.length ? arr(frSteps).map(sansAccents) : shown.map(sansAccents);
  const timers = estObjet(r.stepTimers) ? r.stepTimers : {};
  const kinds = estObjet(r.stepKinds) ? r.stepKinds : {};
  const durs = estObjet(r.stepDurations) ? r.stepDurations : {};
  const names =
    typeof ingredientName === 'function'
      ? arr(r.ingredients)
          .filter((x) => estObjet(x) && typeof x.key === 'string')
          .map((x) => [x.key, ingredientName(x.key)])
      : [];
  const stems = stemsOf(names);
  const has = new Set(names.map((x) => x[0]));

  // 1. lecture de chaque étape
  const raw = shown.map((text, i) => {
    const f = fr[i] || '';
    const fromText = /de chaque cote|par face|sur chaque face/.test(f) ? 2 : 1;
    const timer =
      positive(timers[String(i)]) || positive(durs[String(i)]) * fromText || durationIn(f);
    const kind = kinds[String(i)] || null;
    const starch = COOK_STARCH.test(f) ? starchOf(f) : null;
    // « Préchauffer le four, couper… et enfourner 25 min » : c'est la cuisson, le four chauffe avant
    const preheat =
      PREHEAT.test(f) && !(/enfourn|rotir|au four/.test(f.replace(PREHEAT, '')) && timer);
    const boil = BOIL.test(f);
    const oven = kind === 'four' || /\benfourner\b|\bau four\b/.test(f);
    const passive =
      !!starch ||
      (timer > 0 && (kind === 'four' || kind === 'repos')) ||
      (timer > 0 && oven && !preheat) ||
      (timer > 0 && (PASSIVE_FEU.test(f) || timer >= LONG_FEU_SEC));
    const prep = !timer && !starch && !preheat && PREP.test(f) && !NOT_PREP.test(f);
    return { i, text, f, timer, kind, starch, preheat, boil, oven, passive, prep };
  });

  const tasks = [];
  const add = (t) => {
    tasks.push({ need: [], after: [], keys: [], est: false, prev: -1, ...t });
    return tasks.length - 1;
  };
  let water = -1;
  let preheat = -1;
  let k = 0;
  const key = (kind) => `${kind}${k++}`;

  // 2. eau et four lancés en premier
  const needsWater = raw.some((x) => x.starch);
  const hasOven = raw.some((x) => x.oven && x.timer && !x.preheat);
  if (needsWater && !raw.some((x) => x.boil && !x.starch && !x.passive)) {
    water = add({
      src: null,
      label: { key: 'cook.k.boilWater' },
      keys: has.has('sel') ? ['sel'] : [],
      d: WATER_SEC,
      cook: { k: 'eau', kind: 'eau' },
    });
  }
  if (hasOven && !raw.some((x) => x.preheat)) {
    const temp = positive(r.ovenTempC);
    preheat = add({
      src: null,
      label: temp ? { key: 'cook.k.preheatTemp', opts: { temp } } : { key: 'cook.k.preheat' },
      d: PREHEAT_SEC,
      cook: { k: 'four', kind: 'four' },
    });
  }

  // 3. étapes de la recette
  const used = new Set();
  const keysOf = (f) => {
    const out = [];
    for (const [ik, re] of stems) if (!used.has(ik) && re.test(f)) out.push(ik);
    out.forEach((x) => used.add(x));
    return out;
  };
  let lastChain = -1;
  let pendingPrep = [];
  let pendingCooks = [];
  const timedSum = raw.reduce((n, x) => n + (x.timer || (x.starch ? x.starch.sec : 0)), 0);
  const untimed = raw.filter((x) => !x.timer && !x.starch && !x.preheat).length;
  const budget = (positive(r.timeMin) || DEFAULT_TIME_MIN) * 60 - timedSum;
  const est =
    Math.round(
      Math.min(MAX_ACTIVE, Math.max(MIN_ACTIVE, untimed ? budget / untimed : MIN_ACTIVE)) / 30
    ) * 30;

  raw.forEach((x, n) => {
    const isLast = n === raw.length - 1;
    const keys = keysOf(x.f);
    if (x.preheat) {
      preheat = add({
        src: x.i,
        text: x.text,
        keys,
        d: x.timer || PREHEAT_SEC,
        cook: { k: 'four', kind: 'four' },
      });
      return;
    }
    if (x.boil && !x.starch && !x.passive) {
      water = add({
        src: x.i,
        text: x.text,
        keys,
        d: x.timer || WATER_SEC,
        cook: { k: 'eau', kind: 'eau' },
      });
      return;
    }
    // « Cuire les pâtes et les servir avec… » : la cuisson part seule, l'étape devient le service
    const starchThenServe = !!x.starch && isLast && SERVE.test(x.f);
    let own = keys;
    if (x.starch) {
      const sk = key('cuisson');
      const sKeys = starchThenServe ? keys.filter((ik) => ik === x.starch.key) : keys;
      own = keys.filter((ik) => !sKeys.includes(ik));
      add({
        src: starchThenServe ? null : x.i,
        text: starchThenServe ? undefined : x.text,
        label: starchThenServe ? { key: 'cook.k.starch', opts: { key: x.starch.key } } : undefined,
        keys: sKeys,
        d: starchThenServe ? x.starch.sec : x.timer || x.starch.sec,
        cook: { k: sk, kind: 'cuisson', starch: true },
        need: water >= 0 ? ['eau'] : [],
      });
      pendingCooks.push(sk);
      if (!starchThenServe) return;
    }
    if (x.prep && !isLast) {
      pendingPrep.push(add({ src: x.i, text: x.text, keys, d: est, est: true }));
      return;
    }
    const after = [...(lastChain >= 0 ? [lastChain] : []), ...pendingPrep];
    pendingPrep = [];
    let need = [];
    if (isLast) need = [...new Set(pendingCooks)];
    else if (
      !MEANWHILE.test(x.f) &&
      lastChain >= 0 &&
      tasks[lastChain].cook &&
      // pendant que le plat est au four, on fait la suite ailleurs, sauf pour le sortir
      (!tasks[lastChain].cook.oven || OUT_OF_OVEN.test(x.f))
    ) {
      need = [tasks[lastChain].cook.k];
      pendingCooks = pendingCooks.filter((c) => c !== tasks[lastChain].cook.k);
    }
    if (!isLast && OUT_OF_OVEN.test(x.f)) {
      const oven = pendingCooks.filter((c) =>
        tasks.some((t) => t.cook && t.cook.k === c && t.cook.oven)
      );
      need = [...new Set([...need, ...oven])];
      pendingCooks = pendingCooks.filter((c) => !oven.includes(c));
    }
    if (x.oven && preheat >= 0 && !need.includes('four')) need.push('four');
    const prev = lastChain;
    if (x.passive && !starchThenServe) {
      const ck = key('cuisson');
      const cook = { k: ck, kind: 'cuisson', oven: x.oven || x.kind === 'four' };
      lastChain = add({ src: x.i, text: x.text, keys: own, d: x.timer, cook, need, after, prev });
      pendingCooks.push(ck);
      return;
    }
    const d =
      x.timer ||
      (isLast && (SERVE.test(x.f) || /melanger|egoutter/.test(x.f))
        ? Math.min(est, SERVE_SEC)
        : est);
    lastChain = add({ src: x.i, text: x.text, keys: own, d, est: !x.timer, need, after, prev });
  });
  // préparations restées en fin de liste : avant la dernière tâche
  if (pendingPrep.length && tasks.length) {
    const last = tasks[tasks.length - 1];
    last.after = [
      ...new Set([...last.after, ...pendingPrep.filter((p) => p !== tasks.length - 1)]),
    ];
  }
  // la dernière tâche attend toutes les cuissons qui n'ont pas d'autre usage
  const final = tasks.length - 1;
  if (final >= 0) {
    const consumed = new Set(tasks.flatMap((t, i) => (i === final ? [] : t.need)));
    const open = tasks
      .filter((t) => t.cook && !consumed.has(t.cook.k) && t !== tasks[final])
      .map((t) => t.cook.k);
    tasks[final].need = [...new Set([...tasks[final].need, ...open])].filter(
      (c) => !tasks[final].cook || c !== tasks[final].cook.k
    );
  }
  justInTime(tasks);
  return { tasks, seqSec: tasks.reduce((n, t) => n + (t.d || 0), 0) };
}

const cookTask = (tasks, k) => tasks.findIndex((t) => t.cook && t.cook.k === k);

/** Tâches dont dépend i (après et cuissons requises), de proche en proche. */
function ancestors(tasks, i, seen = new Set()) {
  const t = tasks[i];
  if (!t) return seen;
  for (const a of t.after) if (!seen.has(a)) ancestors(tasks, a, seen.add(a));
  for (const c of t.need) {
    const j = cookTask(tasks, c);
    if (j >= 0 && !seen.has(j)) ancestors(tasks, j, seen.add(j));
  }
  if (t.sync) {
    const j = cookTask(tasks, t.sync.k);
    if (j >= 0 && !seen.has(j)) ancestors(tasks, j, seen.add(j));
  }
  return seen;
}

/**
 * Juste à temps : ce qui se sert chaud finit avec la cuisson la plus longue attendue par la dernière
 * étape, au lieu d'attendre dans la poêle (ou les pâtes, au lieu de coller dans la passoire).
 */
function justInTime(tasks) {
  const final = tasks.length - 1;
  if (final < 1) return;
  const F = tasks[final];
  if (F.cook) return; // la dernière étape cuit toute seule : rien à servir chaud avant elle
  // queue active : les tâches enchaînées juste avant la dernière, sans cuisson qui se fait seule
  const tail = [];
  let j = F.prev ?? -1;
  while (j >= 0 && !tasks[j].cook && !tasks[j].need.length) {
    tail.unshift(j);
    j = tasks[j].prev ?? -1;
  }
  const lead = tail.reduce((n, i) => n + tasks[i].d, 0);
  const longest = (except) =>
    F.need
      .map((k) => cookTask(tasks, k))
      .filter((i) => i >= 0 && !except.has(i) && tasks[i].cook.kind === 'cuisson')
      .sort((a, b) => tasks[b].d - tasks[a].d)[0];
  if (tail.length && lead > 0) {
    const head = tail[0];
    const anc = new Set();
    tail.forEach((i) => ancestors(tasks, i, anc));
    const K = longest(new Set(tail));
    if (K !== undefined && tasks[K].d > lead && !ancestors(tasks, K).has(head) && !anc.has(K)) {
      tasks[head].sync = { k: tasks[K].cook.k, lead };
      return;
    }
  }
  // sinon, les pâtes partent pour finir avec la plus longue des autres cuissons
  const starch = F.need.map((k) => cookTask(tasks, k)).find((i) => i >= 0 && tasks[i].cook.starch);
  if (starch === undefined) return;
  const other = F.need
    .map((k) => cookTask(tasks, k))
    .filter(
      (i) => i >= 0 && i !== starch && !tasks[i].cook.starch && tasks[i].cook.kind === 'cuisson'
    )
    .sort((a, b) => tasks[b].d - tasks[a].d)[0];
  if (other === undefined || tasks[other].d <= tasks[starch].d) return;
  if (ancestors(tasks, other).has(starch)) return;
  tasks[starch].sync = { k: tasks[other].cook.k, lead: tasks[starch].d };
  const w = cookTask(tasks, 'eau');
  if (w >= 0 && tasks[w].src === null && !ancestors(tasks, other).has(w))
    tasks[w].sync = { k: tasks[other].cook.k, lead: tasks[starch].d + tasks[w].d };
}
