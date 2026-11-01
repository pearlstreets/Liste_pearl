// Générateur de plan de repas de la semaine. Pur, déterministe à graine égale,
// ne lève jamais d'exception (catalogue vide ou impossible -> repas libres + avertissements).
import {
  estObjet,
  estNombre,
  arr,
  round2,
  convertFam,
  createRng,
  indexRecipes,
  mealKey,
  parseMealKey,
  seasonOf,
  hashSeed,
} from './util';
import { personsFor, enabledSlots } from './profile';
import { packInfo, packPrice, consumedCost, estimateRecipeCost } from './pricing';
import { recipeNeeds, buildShoppingList, isPantryKey } from './shopping';
import { dishProfile, varietyPenalty } from './variety';
import { nowMs } from './catalog';
import {
  prepareElig,
  rejectWith,
  mainKeyOf,
  catalogActive,
  eligibleCatalog,
  buildPool,
  completionEntries,
  ingInfo,
  cheapest,
  POOL_PLAN,
  POOL_SWAP,
  COMPLETION_MAX,
} from './pool';

const MAX_LEFTOVERS = 3;
const SHORTLIST = 20;
const REPAIR_PASSES = 8;
const REPAIR_MS = 350; // echeance de repairBudget avec le catalogue genere
const REPAIR_CHEAP = 60; // plats generes gardes par la colonne cout avant le calcul exact

/* ------------------------------ éligibilité ------------------------------ */

// Pourquoi une recette est refusée : 'invalid' | 'custom' | 'diet' | 'excluded' | 'time' | null.
// 'custom' : recette personnelle, ses ingrédients ne sont pas vérifiés. Avec une allergie ou un
// régime au profil, elle n'entre jamais seule dans un plan ; seul un ajout à la main la place.
export function rejectReason(recipe, ingredients, profile) {
  return rejectWith(recipe, ingredients, prepareElig(profile));
}

/** eligibleRecipes({recipes, ingredients, profile}) -> { all:[recette], mains:[recette], rejected:{invalid,diet,excluded,time} } */
export function eligibleRecipes({ recipes, ingredients, profile } = {}) {
  const idx = indexRecipes(recipes);
  const ings = estObjet(ingredients) ? ingredients : {};
  const rejected = { invalid: 0, diet: 0, excluded: 0, time: 0 };
  const all = [];
  const prep = prepareElig(profile);
  for (const r of [...idx.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const why = rejectWith(r, ings, prep);
    if (why) rejected[why] = (rejected[why] || 0) + 1;
    else all.push(r);
  }
  let mains = all.filter((r) => !r.course || r.course === 'plat');
  if (mains.length === 0)
    mains = all.filter((r) => r.course !== 'dessert' && r.course !== 'petit-dejeuner');
  return { all, mains, rejected };
}

/* -------------------------------- contexte -------------------------------- */

function makeCtx({ recipes, ingredients, profile, clock, repairMs }) {
  const prep = prepareElig(profile);
  const p = prep.p;
  const idx = indexRecipes(recipes);
  const ings = estObjet(ingredients) ? ingredients : {};
  const mainKeys = new Map();
  const profiles = new Map();
  const profileOf = (r) => {
    if (!profiles.has(r.id)) profiles.set(r.id, dishProfile(r, ings));
    return profiles.get(r.id);
  };
  const mainKeyFor = (r) => {
    if (mainKeys.has(r.id)) return mainKeys.get(r.id);
    const k = r.generated && r.dp ? r.dp.main || null : mainKeyOf(r, ings);
    mainKeys.set(r.id, k);
    return k;
  };
  // Recette personnelle posée à la main : gardée même si le profil l'écarte des plans automatiques.
  const manualOk = (id) => {
    const r = idx.get(id);
    return !!(r && r.custom && arr(r.ingredients).some((i) => estObjet(i) && i.key));
  };
  const common = {
    p,
    prep,
    idx,
    ings,
    profileOf,
    mainKeyFor,
    needs: new Map(),
    packs: new Map(), // contenance et prix de paquet par fiche d'ingredient (fonctions pures)
    persons: new Map(), // convives par case (jour, creneau)
    manualOk,
    season: seasonOf(p.month),
    recipesInput: recipes,
    now: typeof clock === 'function' ? clock : nowMs,
  };
  if (catalogActive(idx)) {
    // Catalogue genere : eligibilite par colonnes, liste courte pour le solveur.
    const cat = eligibleCatalog(idx, ings, prep);
    return {
      ...common,
      el: null,
      cat,
      rejected: cat.rejected,
      mainCount: cat.mainCount,
      allowed: { has: (id) => cat.allows(id) },
      limitMs: estNombre(repairMs) ? repairMs : REPAIR_MS,
      // Audit a l'execution (4e couche de securite) : le repas choisi respecte le profil.
      auditOk: (r) => rejectWith(r, ings, prep) === null,
    };
  }
  const el = eligibleRecipes({ recipes, ingredients: ings, profile: p });
  for (const r of el.mains) mainKeys.set(r.id, mainKeyOf(r, ings));
  return {
    ...common,
    el,
    cat: null,
    rejected: el.rejected,
    mainCount: el.mains.length,
    allowed: new Set(el.all.map((r) => r.id)),
    limitMs: estNombre(repairMs) ? repairMs : 0,
  };
}

// Besoins hors placard d'une recette, gardés pour toute la génération : le solveur les relit à chaque case.
function needsOf(ctx, recipe, persons) {
  let parPersonnes = ctx.needs.get(recipe.id);
  if (!parPersonnes) ctx.needs.set(recipe.id, (parPersonnes = new Map()));
  let liste = parPersonnes.get(persons);
  if (!liste) {
    liste = recipeNeeds(recipe, persons, ctx.ings).filter(
      (n) => !isPantryKey(n.key, n.ing, ctx.p, false)
    );
    parPersonnes.set(persons, liste);
  }
  return liste;
}

function addTotals(totals, ctx, recipe, persons) {
  for (const n of needsOf(ctx, recipe, persons)) {
    totals.set(n.key, (totals.get(n.key) || 0) + n.amt);
  }
}

function marginal(totals, ctx, recipe, persons) {
  let cost = 0;
  let newKeys = 0;
  let reuse = 0;
  for (const n of needsOf(ctx, recipe, persons)) {
    const t = totals.get(n.key) || 0;
    // Contenance et prix du paquet : calcules une fois par besoin (la liste des besoins est gardee).
    if (n.pk === undefined) {
      n.pk = packInfo(n.ing);
      n.pe = n.pk ? packPrice(n.ing).eur : 0;
    }
    const pk = n.pk;
    if (t === 0) newKeys++;
    if (pk) {
      const before = Math.ceil(t / pk.amt - 1e-9);
      const after = Math.ceil((t + n.amt) / pk.amt - 1e-9);
      cost += Math.max(0, after - before) * n.pe;
      const rem = before * pk.amt - t;
      if (t > 0 && rem > 0) reuse += Math.min(n.amt, rem) / pk.amt;
    } else {
      cost += consumedCost(n.ing, n.amt, n.fam).eur;
    }
  }
  return { cost, newKeys, reuse };
}

/* --------------------------------- solveur -------------------------------- */

function normalizeFixed(locked, ctx, warnings) {
  const fixed = new Map();
  const entries = [];
  if (Array.isArray(locked)) {
    for (const m of locked) {
      if (!estObjet(m) || m.locked === false) continue;
      const key = m.key || (estNombre(m.day) && m.slot ? mealKey(m.day, m.slot) : null);
      if (key) entries.push([key, m]);
    }
  } else if (estObjet(locked)) {
    for (const [k, v] of Object.entries(locked))
      entries.push([k, typeof v === 'string' ? { recipeId: v } : v]);
  }
  for (const [key, v] of entries) {
    if (!parseMealKey(key) || !estObjet(v)) continue;
    if (!ctx.p.slots[key]) continue;
    if (v.free) {
      fixed.set(key, { free: true, locked: true });
      continue;
    }
    if (!v.recipeId) continue;
    if (!ctx.idx.has(v.recipeId)) {
      warnings.push({ code: 'lock_invalid', key, recipeId: v.recipeId, reason: 'unknown' });
      continue;
    }
    const manual = !!v.manual && ctx.manualOk(v.recipeId);
    if (!ctx.allowed.has(v.recipeId) && !manual) {
      warnings.push({ code: 'lock_invalid', key, recipeId: v.recipeId, reason: 'rules' });
      continue;
    }
    fixed.set(key, {
      recipeId: v.recipeId,
      locked: true,
      leftoverOf: v.leftoverOf || null,
      ...(manual ? { manual: true } : {}),
      ...(v.batchOf ? { batchOf: v.batchOf } : {}),
    });
  }
  return fixed;
}

// Candidats d'un creneau avec le catalogue genere : liste courte + recettes hors liste partageant les
// ingredients deja achetes (decalage tire avec le rng du solveur, un tirage par creneau).
function candidatesFor(ctx, pool, poolObjs, totals, rng) {
  const cat = ctx.cat;
  if (pool.entries.length >= cat.M) return poolObjs; // la liste courte est tout le catalogue
  const off = rng();
  if (totals.size === 0) return poolObjs;
  const info = ingInfo(cat.core, ctx.ings);
  const top = [];
  for (const [key, amt] of totals) {
    const ix = info.idx.get(key);
    if (!ix) continue;
    const pk = packInfo(ctx.ings[key]);
    top.push([ix, pk ? amt / pk.amt : amt / 1000, key]);
  }
  if (top.length === 0) return poolObjs;
  top.sort((a, b) => b[1] - a[1] || (a[2] < b[2] ? -1 : 1));
  const extra = completionEntries(
    cat,
    pool,
    top.slice(0, 3).map((x) => x[0]),
    off,
    COMPLETION_MAX
  );
  if (extra.length === 0) return poolObjs;
  const objs = [];
  for (const en of extra) {
    const o = cat.objOfEntry(en);
    if (o) objs.push(o);
  }
  return poolObjs.concat(objs);
}

// Liste courte du solveur (catalogue genere) : objets tries par identifiant, plus ses marqueurs.
function makePool(ctx, fixed, opts) {
  const cat = ctx.cat;
  const forced = [];
  const info = ingInfo(cat.core, ctx.ings);
  const weekMains = [];
  for (const [, v] of fixed) {
    if (v.free || !v.recipeId || v.leftoverOf) continue;
    const en = cat.entryOf(v.recipeId);
    if (en >= 0) forced.push(en);
    const r = ctx.idx.get(v.recipeId);
    if (r) for (const k of ctx.profileOf(r).mains || []) weekMains.push(info.idx.get(k) || 0);
  }
  const pool = buildPool(cat, {
    seed: opts.poolSeed,
    K: opts.poolK || POOL_PLAN,
    forced,
    weekMains,
    profile: ctx.p,
  });
  const objs = [];
  for (const en of pool.entries) {
    const o = cat.objOfEntry(en);
    if (o) objs.push(o);
  }
  objs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { pool, objs };
}

function solve(ctx, fixedIn, rng, opts = {}) {
  const { p, idx } = ctx;
  const slots = enabledSlots(p);
  const fixed = new Map();
  for (const [k, v] of fixedIn) {
    if (!p.slots[k]) continue;
    const permis =
      v.recipeId && (ctx.allowed.has(v.recipeId) || (v.manual && ctx.manualOk(v.recipeId)));
    if (!v.free && !permis) continue; // règle changée : on retire la fixation
    fixed.set(k, v);
  }
  const ban = opts.ban || {};
  const noLeftover = opts.noLeftover || new Set();
  const totals = new Map();
  const used = new Map();
  const mainUse = new Map();
  for (const [k, v] of fixed) {
    if (v.free || !v.recipeId || v.leftoverOf) continue;
    const r = idx.get(v.recipeId);
    const s = parseMealKey(k);
    addTotals(totals, ctx, r, personsFor(p, s.day, s.slot));
    used.set(v.recipeId, (used.get(v.recipeId) || 0) + 1);
  }
  // Plats déjà placés (repas verrouillés compris) pour la variété.
  const placed = [];
  for (const [k, v] of fixed) {
    if (v.free || !v.recipeId || !idx.get(v.recipeId)) continue;
    placed.push({
      profile: ctx.profileOf(idx.get(v.recipeId)),
      day: parseMealKey(k).day,
      leftover: !!v.leftoverOf,
      key: k,
    });
  }
  const meals = new Map();
  const pending = new Map();
  let leftovers = 0;
  let lastMain = null;
  const lastCookIndex = new Map(); // recipeId -> dernier rang de cuisine
  let cookRank = 0;
  const budgetOn = !!p.budget;
  const made = ctx.cat ? makePool(ctx, fixed, opts) : null;

  for (const s of slots) {
    const key = s.key;
    const persons = personsFor(p, s.day, s.slot);
    const base = {
      key,
      day: s.day,
      slot: s.slot,
      recipeId: null,
      free: false,
      locked: false,
      leftoverOf: null,
      persons,
    };
    const fx = fixed.get(key);
    let meal = null;

    if (fx && fx.free) {
      meal = { ...base, free: true, locked: !!fx.locked };
    } else if (fx) {
      const src = fx.leftoverOf ? meals.get(fx.leftoverOf) : null;
      if (src && src.recipeId === fx.recipeId && !src.leftoverOf && !src.free) {
        meal = { ...base, recipeId: fx.recipeId, locked: !!fx.locked, leftoverOf: fx.leftoverOf };
        leftovers++;
      } else {
        meal = {
          ...base,
          recipeId: fx.recipeId,
          locked: !!fx.locked,
          ...(fx.manual ? { manual: true } : {}),
          ...(fx.batchOf ? { batchOf: fx.batchOf } : {}),
        };
        if (fx.leftoverOf) addTotals(totals, ctx, idx.get(fx.recipeId), persons);
      }
    } else if (pending.has(key) && !noLeftover.has(key)) {
      const src = meals.get(pending.get(key));
      if (src && src.recipeId && !src.free) {
        meal = { ...base, recipeId: src.recipeId, leftoverOf: src.key };
        leftovers++;
      }
    }

    if (!meal) {
      // Choix d'une recette.
      const next = s.slot === 'soir' && s.day < 6 ? `${s.day + 1}-midi` : null;
      const nextOk = !!(
        next &&
        p.slots[next] &&
        !fixed.has(next) &&
        !noLeftover.has(next) &&
        p.useLeftovers &&
        leftovers < MAX_LEFTOVERS
      );
      const nextPersons = nextOk ? personsFor(p, s.day + 1, 'midi') : 0;
      const banned = ban[key];
      const cands = made ? candidatesFor(ctx, made.pool, made.objs, totals, rng) : ctx.el.mains;
      const others = placed.filter((o) => o.key !== key);
      const refused = new Set();
      let best = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        best = null;
        let bestScore = -Infinity;
        for (const r of cands) {
          if (banned && banned.has(r.id)) continue;
          if (refused.has(r.id)) continue;
          const withLeft = nextOk && r.leftoverOk;
          const cp = persons + (withLeft ? nextPersons : 0);
          const m = marginal(totals, ctx, r, cp);
          let sc = -m.cost * (budgetOn ? 3.2 : 1.6);
          sc -= m.newKeys * 1.2;
          sc += m.reuse * 2.5;
          const u = used.get(r.id) || 0;
          sc -= u * 45;
          const li = lastCookIndex.get(r.id);
          if (li !== undefined && cookRank - li <= 3) sc -= 30;
          sc -= varietyPenalty(ctx.profileOf(r), s.day, others);
          const mk = ctx.mainKeyFor(r);
          if (mk) {
            sc -= (mainUse.get(mk) || 0) * 8;
            if (mk === lastMain) sc -= 12;
          }
          const tm = estNombre(Number(r.timeMin)) ? Number(r.timeMin) : 30;
          sc -= tm * (s.day <= 4 ? (s.slot === 'midi' ? 0.12 : 0.08) : 0.01);
          const tags = arr(r.tags);
          if (p.children > 0 && tags.includes('enfants')) sc += 3;
          if (budgetOn && tags.includes('economique')) sc += 2;
          if (s.day <= 4 && tags.includes('rapide')) sc += 1;
          if (withLeft) sc += 4;
          if (ctx.season) {
            const seas = tags.filter((t) => ['hiver', 'printemps', 'ete', 'automne'].includes(t));
            if (seas.length) sc += seas.includes(ctx.season) ? 3 : -6;
          }
          sc += (Number(r.protein) || 0) * 0.04;
          sc += rng() * 6;
          if (sc > bestScore || (sc === bestScore && best && r.id < best.id)) {
            best = r;
            bestScore = sc;
          }
        }
        if (!best || !ctx.auditOk || ctx.auditOk(best)) break;
        refused.add(best.id); // audit : le repas choisi ne respecte pas le profil, on prend le suivant
      }
      // quatre refus de suite : jamais de repas refuse par l'audit, le creneau reste libre
      if (best && ctx.auditOk && !ctx.auditOk(best)) best = null;
      if (best) {
        meal = { ...base, recipeId: best.id };
      } else {
        meal = { ...base, free: true };
      }
    }

    if (meal.recipeId && !fixed.has(key) && idx.get(meal.recipeId))
      placed.push({
        profile: ctx.profileOf(idx.get(meal.recipeId)),
        day: s.day,
        leftover: !!meal.leftoverOf,
        key,
      });
    if (meal.recipeId && !meal.leftoverOf && !fixed.has(key)) {
      const r = idx.get(meal.recipeId);
      const next = s.slot === 'soir' && s.day < 6 ? `${s.day + 1}-midi` : null;
      const nextOk = !!(
        next &&
        p.slots[next] &&
        !fixed.has(next) &&
        !noLeftover.has(next) &&
        p.useLeftovers &&
        leftovers < MAX_LEFTOVERS
      );
      const cp = persons + (nextOk && r.leftoverOk ? personsFor(p, s.day + 1, 'midi') : 0);
      addTotals(totals, ctx, r, cp);
      used.set(r.id, (used.get(r.id) || 0) + 1);
    }
    if (meal.recipeId && !meal.leftoverOf) {
      const r = idx.get(meal.recipeId);
      lastCookIndex.set(r.id, cookRank++);
      const mk = ctx.mainKeyFor(r);
      if (mk) mainUse.set(mk, (mainUse.get(mk) || 0) + 1);
      lastMain = mk;
      const next = s.slot === 'soir' && s.day < 6 ? `${s.day + 1}-midi` : null;
      if (
        next &&
        p.slots[next] &&
        !fixed.has(next) &&
        !noLeftover.has(next) &&
        p.useLeftovers &&
        r.leftoverOk &&
        leftovers < MAX_LEFTOVERS
      ) {
        pending.set(next, key);
      }
    }
    meals.set(key, meal);
  }
  // Convives qui cuisinent : eux-mêmes + ceux qui mangent les restes.
  const list = slots.map((s) => meals.get(s.key));
  for (const m of list) {
    if (m.recipeId && !m.leftoverOf && !m.free) {
      let cp = m.persons;
      for (const d of list) if (d.leftoverOf === m.key) cp += d.persons;
      m.cookPersons = round2(cp);
    }
  }
  return list;
}

/* ------------------------- budget : réparation / bilan ------------------------- */

function evaluate(ctx, meals) {
  return buildShoppingList({
    plan: { meals },
    recipes: ctx.idx,
    ingredients: ctx.ings,
    profile: ctx.p,
  });
}

// Plats les moins chers (SHORTLIST) pour la reparation du budget. Catalogue genere : les plats ecrits a la main
// sont estimes exactement ; parmi les generes, la colonne cout garde les 60 moins chers (3 par ingredient principal)
// avant le calcul exact.
function cheapShortlist(ctx) {
  // Memoise par contexte d'eligibilite et placard : le calcul exact des 474 recettes ecrites a la main n'est fait
  // qu'une fois tant que le profil ne change pas.
  const pantryKey = ctx.cat ? arr(ctx.p.pantry).slice().sort().join(',') : null;
  if (ctx.cat && ctx.cat.__cheap && ctx.cat.__cheap.key === pantryKey) return ctx.cat.__cheap.list;
  const cost = (r) =>
    estimateRecipeCost(r, ctx.ings, r.servings || 4, { pantry: ctx.p.pantry }).perPerson;
  let list;
  if (ctx.cat) {
    const cat = ctx.cat;
    const skip = new Uint8Array(cat.M);
    for (let i = 0; i < cat.L; i++) skip[i] = 1;
    list = [...cat.legacyMains];
    for (const en of cheapest(cat, REPAIR_CHEAP, { perMain: 3, skip })) {
      const o = cat.objOfEntry(en);
      if (o) list.push(o);
    }
  } else {
    list = [...ctx.el.mains];
  }
  const ranked = list
    .map((r) => ({ r, c: cost(r) }))
    .sort((a, b) => a.c - b.c || (a.r.id < b.r.id ? -1 : 1))
    .slice(0, SHORTLIST)
    .map((x) => x.r);
  if (ctx.cat) ctx.cat.__cheap = { key: pantryKey, list: ranked };
  return ranked;
}

// Convives d'une case, calcules une fois par contexte (personsFor renormalise le profil a chaque appel).
function personsOfSlot(ctx, day, slot) {
  const k = `${day}-${slot}`;
  let n = ctx.persons.get(k);
  if (n === undefined) {
    n = personsFor(ctx.p, day, slot);
    ctx.persons.set(k, n);
  }
  return n;
}

// Total estime d'un plan : meme resultat que evaluate(ctx, meals).totalEur (liste de courses), sans construire les
// lignes ni l'empreinte. Sert aux essais de la reparation du budget (des centaines d'evaluations).
function fastTotal(ctx, meals) {
  const need = new Map();
  for (const m of meals) {
    if (!estObjet(m) || !m.recipeId || m.free || m.leftoverOf || m.batchOf) continue;
    const persons =
      estNombre(m.cookPersons) && m.cookPersons > 0
        ? m.cookPersons
        : estNombre(m.persons) && m.persons > 0
          ? m.persons
          : personsOfSlot(ctx, m.day, m.slot);
    const r = ctx.idx.get(m.recipeId);
    if (!r) continue;
    for (const n of needsOf(ctx, r, persons)) {
      const first = need.get(n.key);
      const split = n.free && first && !first.noQty && !n.noQty && first.fam !== n.fam;
      const mapKey = split ? `${n.key}|${n.fam}` : n.key;
      let cur = need.get(mapKey);
      if (!cur) cur = { ing: n.ing, fam: n.fam, amt: 0, free: !!n.free, noQty: !!n.noQty };
      if (cur.noQty && !n.noQty) {
        cur.noQty = false;
        cur.fam = n.fam;
      }
      cur.amt += n.fam === cur.fam ? n.amt : (convertFam(n.amt, n.fam, cur.fam, n.ing) ?? n.amt);
      need.set(mapKey, cur);
    }
  }
  let total = 0;
  for (const cur of need.values()) {
    if (!(cur.amt > 1e-9) && !cur.noQty) continue;
    if (cur.free || cur.noQty) continue;
    let pc = ctx.packs.get(cur.ing);
    if (pc === undefined) {
      const info = packInfo(cur.ing);
      pc = { pk: info, eur: info ? packPrice(cur.ing).eur : 0 };
      if (estObjet(cur.ing)) ctx.packs.set(cur.ing, pc);
    }
    const pk = pc.pk;
    const est = pk
      ? Math.max(1, Math.ceil(cur.amt / pk.amt - 1e-9)) * pc.eur
      : consumedCost(cur.ing, cur.amt, cur.fam).eur;
    total += round2(est);
  }
  return round2(total);
}

/** estimatePlanTotal({ plan, recipes, ingredients, profile }) -> total estime des courses (euros), comme buildShoppingList. */
export function estimatePlanTotal(args = {}) {
  try {
    const ctx = makeCtx(args);
    return fastTotal(ctx, arr(args.plan && args.plan.meals));
  } catch {
    return 0;
  }
}

function repairBudget(ctx, meals, repairable) {
  const budget = ctx.p.budget;
  if (!budget || meals.length === 0) return meals;
  let cur = fastTotal(ctx, meals);
  if (cur <= budget) return meals;
  // Echeance : au depassement, le meilleur plan atteint est rendu (avertissement over_budget de finish).
  const deadline = ctx.limitMs > 0 ? ctx.now() + ctx.limitMs : Infinity;
  const late = () => deadline !== Infinity && ctx.now() > deadline;
  const ranked = cheapShortlist(ctx);
  for (let pass = 0; pass < REPAIR_PASSES && cur > budget; pass++) {
    let best = null;
    const counts = new Map();
    for (const m of meals)
      if (m.recipeId && !m.leftoverOf) counts.set(m.recipeId, (counts.get(m.recipeId) || 0) + 1);
    let stop = false;
    for (const m of meals) {
      if (!m.recipeId || m.free || m.leftoverOf || m.locked) continue;
      if (repairable && !repairable.has(m.key)) continue;
      const deps = meals.filter((d) => d.leftoverOf === m.key);
      for (const c of ranked) {
        if (c.id === m.recipeId || (counts.get(c.id) || 0) >= 2) continue;
        if (deps.length && !c.leftoverOk) continue;
        if (late()) {
          stop = true;
          break;
        }
        const trial = meals.map((x) =>
          x.key === m.key || x.leftoverOf === m.key ? { ...x, recipeId: c.id } : x
        );
        const t = fastTotal(ctx, trial);
        if (t < cur - 0.05 && (!best || t < best.t)) best = { t, trial };
      }
      if (stop) break;
    }
    if (best) {
      meals = best.trial;
      cur = best.t;
    }
    if (!best || stop) break;
  }
  return meals;
}

/**
 * Recalcule les liens de restes et les convives qui cuisinent. Un reste dont la source a changé
 * (autre recette, repas libre, source absente ou elle-même un reste) redevient un repas à cuisiner ;
 * cookPersons = convives du repas + convives de ses restes valides (uniquement pour un repas cuisiné).
 */
export function recomputeCooking(mealsIn) {
  const list = arr(mealsIn).map((m) => (estObjet(m) ? { ...m } : m));
  const byKey = new Map();
  for (const m of list) if (estObjet(m)) byKey.set(m.key, m);
  for (const m of list) {
    if (!estObjet(m) || !m.leftoverOf) continue;
    const src = byKey.get(m.leftoverOf);
    if (
      !src ||
      src.free ||
      !src.recipeId ||
      src.leftoverOf ||
      src.recipeId !== m.recipeId ||
      m.free
    )
      m.leftoverOf = null;
  }
  for (const m of list) {
    if (!estObjet(m)) continue;
    delete m.cookPersons;
    if (!m.recipeId || m.leftoverOf || m.free) continue;
    let cp = Number(m.persons) || 0;
    for (const d of list) if (estObjet(d) && d.leftoverOf === m.key) cp += Number(d.persons) || 0;
    m.cookPersons = round2(cp);
  }
  return list;
}

function finish(ctx, meals, warnings, meta) {
  meals = recomputeCooking(meals);
  const p = ctx.p;
  const sh = evaluate(ctx, meals);
  const out = [...warnings];
  const cookCount = meals.filter((m) => m.recipeId && !m.leftoverOf).length;
  if (meals.length === 0) out.push({ code: 'no_slots' });
  if (ctx.idx.size === 0) out.push({ code: 'no_recipes' });
  else if (ctx.mainCount === 0) out.push({ code: 'no_eligible', rejected: ctx.rejected });
  else if (ctx.mainCount < cookCount)
    out.push({ code: 'few_recipes', available: ctx.mainCount, needed: cookCount });
  const target = p.budget;
  const gap = target ? round2(sh.totalEur - target) : 0;
  if (target && gap > 0)
    out.push({ code: 'over_budget', budget: target, estimated: sh.totalEur, gap });
  const distinct = new Set(sh.lines.map((l) => l.key)).size;
  return {
    version: 1,
    seed: meta.seed,
    weekStart: meta.weekStart || null,
    swaps: meta.swaps || 0,
    meals: meals.map((m) => ({ ...m })),
    warnings: out,
    budget: {
      target: target || null,
      estimated: sh.totalEur,
      consumed: sh.consumedEur,
      waste: sh.wasteEur,
      gap: target ? gap : 0,
      within: target ? gap <= 0 : null,
    },
    stats: {
      cookCount,
      leftoverCount: meals.filter((m) => m.leftoverOf).length,
      freeCount: meals.filter((m) => m.free).length,
      distinctIngredients: distinct,
      distinctRecipes: new Set(meals.filter((m) => m.recipeId).map((m) => m.recipeId)).size,
    },
    fingerprint: sh.fingerprint,
  };
}

/* --------------------------------- API publique --------------------------------- */

/**
 * generatePlan({ recipes, ingredients, profile, seed, locked, weekStart }) -> plan
 * plan = { version, seed, weekStart, swaps, meals:[{ key, day, slot, recipeId, free, locked, leftoverOf, persons, cookPersons? }],
 *          warnings:[{code,...}], budget:{target,estimated,consumed,waste,gap,within}, stats, fingerprint }
 * locked : { "2-soir": "recipe-id" | { recipeId } | { free:true } } ou tableau de repas verrouillés.
 */
export function generatePlan(args = {}) {
  try {
    const a = estObjet(args) ? args : {};
    const ctx = makeCtx(a);
    const warnings = [];
    const seed = a.seed === undefined || a.seed === null ? 1 : a.seed;
    const fixed = normalizeFixed(a.locked, ctx, warnings);
    const rng = createRng(seed);
    let meals = solve(ctx, fixed, rng, {
      poolSeed: seed,
      poolK: a.poolK > 0 ? a.poolK : POOL_PLAN, // poolK : banc de qualite (reference = tout le catalogue)
    });
    meals = repairBudget(ctx, meals, null);
    return finish(ctx, meals, warnings, { seed, weekStart: a.weekStart });
  } catch (e) {
    return {
      version: 1,
      seed: args && args.seed !== undefined ? args.seed : 1,
      weekStart: null,
      swaps: 0,
      meals: [],
      warnings: [{ code: 'error', message: String(e && e.message) }],
      budget: { target: null, estimated: 0, consumed: 0, waste: 0, gap: 0, within: null },
      stats: {
        cookCount: 0,
        leftoverCount: 0,
        freeCount: 0,
        distinctIngredients: 0,
        distinctRecipes: 0,
      },
      fingerprint: 'mp0',
    };
  }
}

function fixedFromPlan(plan, ctx, dropKeys, replace) {
  const fixed = new Map();
  for (const m of arr(plan && plan.meals)) {
    if (!estObjet(m) || !parseMealKey(m.key) || dropKeys.has(m.key)) continue;
    if (replace[m.key]) continue;
    if (m.free) fixed.set(m.key, { free: true, locked: !!m.locked });
    else if (m.recipeId)
      fixed.set(m.key, {
        recipeId: m.recipeId,
        locked: !!m.locked,
        leftoverOf: m.leftoverOf || null,
        ...(m.manual ? { manual: true } : {}),
        ...(m.batchOf ? { batchOf: m.batchOf } : {}),
      });
  }
  for (const [k, v] of Object.entries(replace)) fixed.set(k, v);
  return fixed;
}

function mutate(args, buildReplace) {
  try {
    const { plan, mealKey: key } = args || {};
    if (!estObjet(plan) || !arr(plan.meals).some((m) => m && m.key === key)) return plan;
    const ctx = makeCtx(args);
    const meal = plan.meals.find((m) => m.key === key);
    const swaps = (plan.swaps || 0) + 1;
    const seed =
      args.seed !== undefined && args.seed !== null ? args.seed : `${plan.seed}:${key}:${swaps}`;
    const rng = createRng(hashSeed(seed));
    const r = buildReplace(ctx, meal);
    if (!r) return plan;
    // Les restes qui dépendaient de ce repas sont recalculés.
    const drop = new Set(plan.meals.filter((m) => m.leftoverOf === key).map((m) => m.key));
    if (!r.replace || !r.replace[key]) drop.add(key);
    const fixed = fixedFromPlan(plan, ctx, drop, r.replace || {});
    const meals = solve(ctx, fixed, rng, {
      ban: r.ban,
      noLeftover: r.noLeftover,
      poolSeed: seed,
      poolK: POOL_SWAP,
    });
    return finish(ctx, meals, [], { seed: plan.seed, weekStart: plan.weekStart, swaps });
  } catch {
    return args && args.plan;
  }
}

/** swapMeal({ plan, mealKey, recipeId?, recipes, ingredients, profile, seed? }) -> nouveau plan (le repas change, les autres restent). */
export function swapMeal(args = {}) {
  return mutate(args, (ctx, meal) => {
    if (args.recipeId) {
      if (args.manual && ctx.manualOk(args.recipeId))
        return { replace: { [meal.key]: { recipeId: args.recipeId, locked: true, manual: true } } };
      if (!ctx.allowed.has(args.recipeId)) return null;
      return { replace: { [meal.key]: { recipeId: args.recipeId, locked: !!meal.locked } } };
    }
    const ban = new Set(meal.recipeId ? [meal.recipeId] : []);
    return { ban: { [meal.key]: ban }, noLeftover: new Set([meal.key]) };
  });
}

/** setFree({ plan, mealKey, free = true, recipes, ingredients, profile }) -> repas libre (restaurant, invités...) ou retour à une recette. */
export function setFree(args = {}) {
  const free = args.free !== false;
  return mutate(args, (ctx, meal) => {
    if (free) return { replace: { [meal.key]: { free: true, locked: true } } };
    return { noLeftover: new Set([meal.key]) };
  });
}

/** lockMeal({ plan, mealKey, locked = true }) / lockMeal(plan, mealKey, locked) -> plan avec le repas (dé)verrouillé. */
export function lockMeal(planOrArgs, key, locked) {
  const a =
    estObjet(planOrArgs) && planOrArgs.mealKey !== undefined
      ? planOrArgs
      : { plan: planOrArgs, mealKey: key, locked };
  const plan = a.plan;
  if (!estObjet(plan) || !Array.isArray(plan.meals)) return plan;
  const want = a.locked !== false;
  return {
    ...plan,
    meals: recomputeCooking(
      plan.meals.map((m) => (m && m.key === a.mealKey ? { ...m, locked: want } : m))
    ),
  };
}

/** Repas verrouillés d'un plan, au format attendu par generatePlan({ locked }). */
export function lockedFromPlan(plan) {
  const out = {};
  for (const m of arr(plan && plan.meals)) {
    if (!estObjet(m) || !m.locked || !parseMealKey(m.key)) continue;
    out[m.key] = m.free
      ? { free: true }
      : m.recipeId
        ? {
            recipeId: m.recipeId,
            leftoverOf: m.leftoverOf || null,
            ...(m.manual ? { manual: true } : {}),
            ...(m.batchOf ? { batchOf: m.batchOf } : {}),
          }
        : null;
    if (!out[m.key]) delete out[m.key];
  }
  return out;
}

/** Plan -> 7 jours { day, midi, soir } (repas absents = null), pratique pour l'affichage. */
export function mealsByDay(plan) {
  const days = [];
  for (let d = 0; d < 7; d++) days.push({ day: d, midi: null, soir: null });
  for (const m of arr(plan && plan.meals)) {
    if (estObjet(m) && estNombre(m.day) && days[m.day] && (m.slot === 'midi' || m.slot === 'soir'))
      days[m.day][m.slot] = m;
  }
  return days;
}
