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
  eligSig,
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
// Budget non tenu apres la reparation : plats les moins chers essayes, departs "au moins cher" (poids du cout
// consomme face au cout des paquets achetes) et passes de la recherche du plan le moins cher.
const CHEAP_CANDS = 60;
const CHEAP_STARTS = [0, 0.3, 0.3, 1, 0.3, 0.6];
const CHEAP_PASSES = 30;
// Variete : un plat parait au plus deux fois dans la semaine (restes compris), jamais deux fois le meme jour
// (hors reste). Ces regles cedent seulement quand le budget n'est pas tenable sans elles, au-dela d'un petit
// depassement accepte (OVER_OK : 5 % du budget, 2 euros au moins).
const MAX_SAME = 2;
const overOk = (budget) => Math.max(2, budget * 0.05);

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

// Cout consomme (sans arrondi au paquet) d'une recette pour `persons` convives, hors placard. Garde sur la liste.
function consumedOf(ctx, recipe, persons) {
  const list = needsOf(ctx, recipe, persons);
  if (list.eur === undefined) {
    let eur = 0;
    for (const n of list) if (!n.free && !n.noQty) eur += consumedCost(n.ing, n.amt, n.fam).eur;
    list.eur = eur;
  }
  return list.eur;
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
      ...(manual && typeof v.okFor === 'string' ? { okFor: v.okFor } : {}),
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
  const appear = new Map(); // apparitions de chaque plat dans la semaine (restes compris)
  const mainUse = new Map();
  for (const [, v] of fixed)
    if (!v.free && v.recipeId) appear.set(v.recipeId, (appear.get(v.recipeId) || 0) + 1);
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
  // opts.cheap (nombre de 0 a 1) : depart "au moins cher" de la recherche du plan le moins cher. Seul le cout
  // compte (paquets achetes, melanges au cout consomme selon ce poids), parmi les plats les moins chers.
  const cheapW = estNombre(opts.cheap) ? opts.cheap : null;
  const strict = !!opts.strict;
  const cheap = cheapW !== null ? cheapShortlist(ctx, CHEAP_CANDS) : null;
  const made = ctx.cat && !cheap ? makePool(ctx, fixed, opts) : null;

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
          ...(fx.manual && fx.okFor ? { okFor: fx.okFor } : {}),
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
      // depart "au moins cher" : les plats les moins chers seulement
      const cands =
        cheap || (made ? candidatesFor(ctx, made.pool, made.objs, totals, rng) : ctx.el.mains);
      const others = placed.filter((o) => o.key !== key);
      // plat de l'autre repas du jour : jamais le meme plat midi et soir (hors reste)
      const otherKey = `${s.day}-${s.slot === 'midi' ? 'soir' : 'midi'}`;
      const om = meals.get(otherKey) || fixed.get(otherKey);
      const dayBan = om && !om.free && om.recipeId ? om.recipeId : null;
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
          const add = withLeft ? 2 : 1;
          if (cheap) {
            if (r.id === dayBan) continue;
            const u0 = used.get(r.id) || 0;
            // comme la reparation : au plus deux fois le meme plat (strict : restes compris)
            if (strict ? (appear.get(r.id) || 0) + add > MAX_SAME : u0 >= 2) continue;
            const eur = m.cost * (1 - cheapW) + (cheapW ? consumedOf(ctx, r, cp) * cheapW : 0);
            const sc0 = -eur * 10 + m.reuse * 1.5 - u0 * 2 - (withLeft ? 0 : 1) + rng() * 2;
            if (sc0 > bestScore || (sc0 === bestScore && best && r.id < best.id)) {
              best = r;
              bestScore = sc0;
            }
            continue;
          }
          let sc = -m.cost * (budgetOn ? 3.2 : 1.6);
          sc -= m.newKeys * 1.2;
          sc += m.reuse * 2.5;
          const u = used.get(r.id) || 0;
          sc -= u * 45;
          // regles de variete : enfreintes seulement si aucun autre plat n'est possible
          if (r.id === dayBan) sc -= 1e6;
          if ((appear.get(r.id) || 0) + add > MAX_SAME) sc -= 1e5;
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
    if (meal.recipeId && !fixed.has(key))
      appear.set(meal.recipeId, (appear.get(meal.recipeId) || 0) + 1);
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

// Plats les moins chers (`size`, SHORTLIST par defaut, CHEAP_CANDS au plus) pour la reparation du budget. Catalogue genere : les plats ecrits a la main
// sont estimes exactement ; parmi les generes, la colonne cout garde les 60 moins chers (3 par ingredient principal)
// avant le calcul exact.
function cheapShortlist(ctx, size = SHORTLIST) {
  // Memoise par contexte d'eligibilite et placard : le calcul exact des 474 recettes ecrites a la main n'est fait
  // qu'une fois tant que le profil ne change pas.
  const pantryKey = ctx.cat ? arr(ctx.p.pantry).slice().sort().join(',') : null;
  if (ctx.cat && ctx.cat.__cheap && ctx.cat.__cheap.key === pantryKey)
    return ctx.cat.__cheap.list.slice(0, size);
  if (!ctx.cat && ctx.cheapList) return ctx.cheapList.slice(0, size);
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
    .slice(0, CHEAP_CANDS)
    .map((x) => x.r);
  if (ctx.cat) ctx.cat.__cheap = { key: pantryKey, list: ranked };
  else ctx.cheapList = ranked;
  return ranked.slice(0, size);
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

// Contenance et prix du paquet d'une fiche, gardes par contexte (memes valeurs que fastTotal).
function packOf(ctx, ing) {
  let pc = ctx.packs.get(ing);
  if (pc === undefined) {
    const info = packInfo(ing);
    pc = { pk: info, eur: info ? packPrice(ing).eur : 0 };
    if (estObjet(ing)) ctx.packs.set(ing, pc);
  }
  return pc;
}

// Convives pour qui un repas cuisine (meme regle que fastTotal).
function cookPersonsOf(ctx, m) {
  if (estNombre(m.cookPersons) && m.cookPersons > 0) return m.cookPersons;
  if (estNombre(m.persons) && m.persons > 0) return m.persons;
  return personsOfSlot(ctx, m.day, m.slot);
}

// Cout d'un ingredient du plan pour une quantite totale (paquets entiers, sinon cout consomme), comme fastTotal.
function keyCost(e, amt) {
  if (!(amt > 1e-9)) return 0;
  if (e.pk) return round2(Math.max(1, Math.ceil(amt / e.pk.amt - 1e-9)) * e.eur);
  return round2(consumedCost(e.ing, amt, e.fam).eur);
}

// Quantites agregees d'un plan par ingredient (repas cuisines seulement, hors gratuits et sans quantite).
// Sert au calcul rapide de l'ecart de cout d'un echange : seuls les ingredients des deux plats sont recalcules.
function aggregate(ctx, meals) {
  const agg = new Map();
  for (const m of meals) {
    if (!estObjet(m) || !m.recipeId || m.free || m.leftoverOf || m.batchOf) continue;
    const r = ctx.idx.get(m.recipeId);
    if (r) aggAdd(ctx, agg, r, cookPersonsOf(ctx, m), 1);
  }
  return agg;
}

function entryOf(ctx, agg, n) {
  let e = agg.get(n.key);
  if (!e) {
    const pc = packOf(ctx, n.ing);
    e = { ing: n.ing, fam: n.fam, amt: 0, pk: pc.pk, eur: pc.eur };
    agg.set(n.key, e);
  }
  return e;
}

const famAmt = (n, e) =>
  n.fam === e.fam ? n.amt : (convertFam(n.amt, n.fam, e.fam, n.ing) ?? n.amt);

function aggAdd(ctx, agg, recipe, persons, sign) {
  for (const n of needsOf(ctx, recipe, persons)) {
    if (n.free || n.noQty) continue;
    const e = entryOf(ctx, agg, n);
    e.amt += sign * famAmt(n, e);
  }
}

// Ecart de cout (euros) si le plat `from` est remplace par `to` pour chacun des repas de `persons` (convives).
function swapDelta(ctx, agg, from, to, persons) {
  const ch = new Map();
  for (const p of persons)
    for (const [r, sign] of [
      [from, -1],
      [to, 1],
    ])
      for (const n of needsOf(ctx, r, p)) {
        if (n.free || n.noQty) continue;
        const e = entryOf(ctx, agg, n);
        ch.set(e, (ch.get(e) || 0) + sign * famAmt(n, e));
      }
  let d = 0;
  for (const [e, da] of ch) if (da !== 0) d += keyCost(e, e.amt + da) - keyCost(e, e.amt);
  return d;
}

// Reparation du budget : echanges un par un du plat qui fait le plus baisser le total (plats les moins chers),
// jusqu'au budget ou sans progres. Les ecarts sont calcules sur les seuls ingredients touches ; chaque echange
// retenu est verifie par le total exact (fastTotal, celui de la liste de courses).
// o : { deadline, size (plats les moins chers essayes), wide (essayer aussi les plats deja au plan), passes,
//       target (total vise, budget du profil par defaut), strict (au plus MAX_SAME apparitions, restes compris ;
//       sinon au plus deux cuissons) }. Jamais le meme plat deux fois le meme jour (hors reste).
function repairBudget(ctx, meals, repairable, o = {}) {
  const budget = ctx.p.budget;
  if (!budget || meals.length === 0) return meals;
  const target = estNombre(o.target) ? o.target : budget;
  let cur = fastTotal(ctx, meals);
  if (cur <= target) return meals;
  // Echeance : au depassement, le meilleur plan atteint est rendu (avertissement over_budget de finish).
  const deadline = estNombre(o.deadline)
    ? o.deadline
    : ctx.limitMs > 0
      ? ctx.now() + ctx.limitMs
      : Infinity;
  const late = () => deadline !== Infinity && ctx.now() > deadline;
  let ranked = cheapShortlist(ctx, o.size || SHORTLIST);
  if (o.wide) {
    // les plats deja au plan partagent ses paquets : les reprendre une fois de plus coute souvent le moins
    const seen = new Set(ranked.map((r) => r.id));
    for (const m of meals) {
      const r =
        m.recipeId && !m.free && !m.manual && !seen.has(m.recipeId)
          ? ctx.idx.get(m.recipeId)
          : null;
      if (r && ctx.allowed.has(r.id)) {
        seen.add(r.id);
        ranked = ranked.concat([r]);
      }
    }
  }
  const agg = aggregate(ctx, meals);
  const passes = o.passes || REPAIR_PASSES;
  for (let pass = 0; pass < passes && cur > target; pass++) {
    let best = null;
    const counts = new Map();
    for (const m of meals)
      if (m.recipeId && !m.free && (o.strict || !m.leftoverOf))
        counts.set(m.recipeId, (counts.get(m.recipeId) || 0) + 1);
    // plats de chaque jour, et restes de chaque repas (un echange change aussi ses restes)
    const byDay = new Map();
    const leftOf = new Map();
    for (const m of meals) {
      if (!m.recipeId || m.free) continue;
      if (!byDay.has(m.day)) byDay.set(m.day, []);
      byDay.get(m.day).push(m);
      if (m.leftoverOf) {
        if (!leftOf.has(m.leftoverOf)) leftOf.set(m.leftoverOf, []);
        leftOf.get(m.leftoverOf).push(m);
      }
    }
    // Mouvements : un repas change de plat ; en recherche elargie, aussi toutes les fois ou un plat est cuisine
    // (un plat cuisine deux fois garde ses paquets tant qu'une seule fois change).
    const moves = [];
    const groups = new Map();
    for (const m of meals) {
      if (!m.recipeId || m.free || m.leftoverOf || m.locked || m.batchOf) continue;
      if (repairable && !repairable.has(m.key)) continue;
      const from = ctx.idx.get(m.recipeId);
      if (!from) continue;
      const lefts = leftOf.get(m.key) || [];
      const mv = {
        from,
        keys: [m.key],
        persons: [cookPersonsOf(ctx, m)],
        deps: lefts.length > 0,
        touched: [m, ...lefts], // repas qui prennent le nouveau plat
      };
      moves.push(mv);
      const g = groups.get(from.id);
      if (!g)
        groups.set(from.id, {
          ...mv,
          keys: [...mv.keys],
          persons: [...mv.persons],
          touched: [...mv.touched],
        });
      else {
        g.keys.push(m.key);
        g.persons.push(mv.persons[0]);
        g.deps = g.deps || mv.deps;
        g.touched.push(...mv.touched);
      }
    }
    if (o.wide) for (const g of groups.values()) if (g.keys.length > 1) moves.push(g);
    let stop = false;
    for (const mv of moves) {
      if (late()) {
        stop = true;
        break;
      }
      const n = o.strict ? mv.touched.length : mv.keys.length;
      const tk = new Set(mv.touched.map((x) => x.key));
      // plats deja servis les jours touches par l'echange (hors repas echanges)
      const dayIds = new Set();
      for (const x of mv.touched)
        for (const y of byDay.get(x.day) || []) if (!tk.has(y.key)) dayIds.add(y.recipeId);
      for (const c of ranked) {
        if (c.id === mv.from.id || (counts.get(c.id) || 0) + n > MAX_SAME) continue;
        if (dayIds.has(c.id)) continue;
        if (mv.deps && !c.leftoverOk) continue;
        const d = swapDelta(ctx, agg, mv.from, c, mv.persons);
        if (d < -0.05 && (!best || d < best.d)) best = { d, mv, c };
      }
    }
    if (!best) break;
    const keys = new Set(best.mv.keys);
    const trial = meals.map((x) =>
      keys.has(x.key) || keys.has(x.leftoverOf) ? { ...x, recipeId: best.c.id } : x
    );
    const t = fastTotal(ctx, trial);
    if (!(t < cur - 0.05)) break;
    meals = trial;
    cur = t;
    for (const p of best.mv.persons) {
      aggAdd(ctx, agg, best.mv.from, p, -1);
      aggAdd(ctx, agg, best.c, p, 1);
    }
    if (stop) break;
  }
  return meals;
}

// Plan le moins cher d'un profil, garde par catalogue, table d'ingredients et profil hors budget (et repas
// fixes) : il ne depend pas de la graine. La recherche reprend la ou l'echeance l'a arretee au plan suivant.
const lowMemo = new WeakMap();

function lowKey(ctx, fixed, strict) {
  const p = ctx.p;
  return JSON.stringify([
    strict ? 'strict' : 'souple',
    eligSig(ctx.prep),
    p.adults,
    p.children,
    p.kidsCantine,
    p.useLeftovers,
    p.month,
    [...p.pantry].sort(),
    enabledSlots(p).map((s) => s.key),
    [...fixed].sort((x, y) => (x[0] < y[0] ? -1 : 1)),
  ]);
}

function memoSlot(ctx) {
  const a = ctx.recipesInput;
  const b = ctx.ings;
  if (!a || typeof a !== 'object' || !b || typeof b !== 'object') return null;
  let byIngs = lowMemo.get(a);
  if (!byIngs) lowMemo.set(a, (byIngs = new WeakMap()));
  let m = byIngs.get(b);
  if (!m) byIngs.set(b, (m = new Map()));
  return m;
}

// Plan trouve hors recherche (reparation du plan d'une graine) : garde comme meilleur du profil s'il est moins cher,
// pour ne jamais annoncer ensuite un minimum plus haut qu'un plan deja trouve.
function rememberLow(ctx, fixed, meals, t, strict) {
  const memo = memoSlot(ctx);
  if (!memo || !estNombre(t)) return;
  const key = lowKey(ctx, fixed, strict);
  const st = memo.get(key) || { best: null, next: 0 };
  if (st.best && st.best.t <= t) return;
  st.best = { meals: meals.map((x) => ({ ...x })), t };
  memo.delete(key);
  memo.set(key, st);
  if (memo.size > 8) memo.delete(memo.keys().next().value);
}

// Recherche du plan le moins cher : departs "au moins cher" (CHEAP_STARTS, tirages differents), chacun descendu
// par la reparation elargie (cible 0). -> { meals, t } (le meilleur trouve) ou null si rien n'a pu etre essaye.
// maxStarts : nombre de departs essayes au plus par cet appel (recherche finie par morceaux en arriere-plan).
// strict : regles de variete completes (MAX_SAME apparitions, restes compris).
function cheapestPlan(ctx, fixed, deadline, maxStarts = Infinity, strict = true) {
  const memo = memoSlot(ctx);
  const key = memo ? lowKey(ctx, fixed, strict) : null;
  const st = (memo && memo.get(key)) || { best: null, next: 0 };
  const late = () => deadline !== Infinity && ctx.now() > deadline;
  const o = { deadline, size: CHEAP_CANDS, wide: true, passes: CHEAP_PASSES, target: 0, strict };
  let tries = 0;
  while (st.next < CHEAP_STARTS.length && !late() && tries < maxStarts) {
    tries++;
    const i = st.next;
    const start = solve(ctx, fixed, createRng(hashSeed(`budget${i}`)), {
      poolSeed: 'budget',
      poolK: POOL_PLAN,
      cheap: CHEAP_STARTS[i],
      strict,
    });
    const m = repairBudget(ctx, start, null, o);
    const t = fastTotal(ctx, m);
    if (!st.best || t < st.best.t) st.best = { meals: m.map((x) => ({ ...x })), t };
    // depart interrompu par l'echeance : repris en entier au prochain plan
    if (late()) break;
    st.next++;
  }
  if (memo && st.best) {
    memo.delete(key);
    memo.set(key, st);
    if (memo.size > 8) memo.delete(memo.keys().next().value);
  }
  return st.best
    ? {
        meals: st.best.meals.map((x) => ({ ...x })),
        t: st.best.t,
        done: st.next >= CHEAP_STARTS.length,
      }
    : null;
}

/**
 * Budget depasse par le plan de la graine : la reparation elargie le descend d'abord (variete du plan gardee) ;
 * si le budget n'est toujours pas tenu, le plan le moins cher du profil (cheapestPlan) est rendu s'il le tient.
 * Les deux etapes suivent d'abord les regles de variete strictes (un plat au plus deux fois, restes compris) :
 * un petit depassement (overOk) est prefere a la repetition. Au-dela, elles sont reprises en regles souples
 * (deux cuissons au plus), et le plan le moins cher est rendu.
 * -> { meals, minimum } (minimum null si le budget est tenu, sans plafond, ou si rien n'a pu etre cherche).
 */
function lowestCost(ctx, fixed, meals) {
  const budget = ctx.p.budget;
  if (!budget || meals.length === 0) return { meals, minimum: null };
  const t0 = fastTotal(ctx, meals);
  if (t0 <= budget) return { meals, minimum: null };
  const now = ctx.now();
  // echeances (part de REPAIR_MS) : regles strictes, puis regles souples ; une recherche interrompue est reprise
  // au plan suivant (memoire par profil) ou en arriere-plan (refineCheapest)
  const at = (f) => (ctx.limitMs > 0 ? now + ctx.limitMs * f : Infinity);
  const steps = { true: [at(0.6), at(1.1)], false: [at(1.3), at(1.5)] };
  const found = [];
  for (const strict of [true, false]) {
    const [repairEnd, searchEnd] = steps[strict];
    // le plan de la graine est toujours repare (meme resultat a graine egale, que le moins cher soit connu ou non)
    const m = repairBudget(ctx, meals, null, {
      deadline: repairEnd,
      size: CHEAP_CANDS,
      wide: true,
      passes: CHEAP_PASSES,
      strict,
    });
    const own = { meals: m, t: fastTotal(ctx, m) };
    if (own.t <= budget) return { meals: own.meals, minimum: null };
    rememberLow(ctx, fixed, own.meals, own.t, strict);
    const low = cheapestPlan(ctx, fixed, searchEnd, Infinity, strict);
    if (low && low.t <= budget) return { meals: low.meals, minimum: null };
    const best = low && low.t < own.t ? low : own;
    const done = !!(low && low.done);
    found.push({ best, searched: !!low });
    if (strict) {
      // petit depassement plutot que la repetition
      if (best.t <= budget + overOk(budget)) return { meals: best.meals, minimum: done ? best.t : null };
      // recherche stricte pas finie : rien n'est encore annonce, ni les regles souples essayees
      if (!done) return { meals: best.meals, minimum: null };
    }
  }
  // budget hors d'atteinte : le plan strict est garde s'il ne coute guere plus que le plan souple
  const [st, so] = found;
  const pick = st.best.t <= so.best.t + overOk(budget) ? st : so;
  return { meals: pick.best.meals, minimum: pick.searched ? pick.best.t : null };
}

// Repas du plan pour le foyer actuel : convives recalcules par case, memes plats (rien n'est recompose).
function currentMeals(ctx, plan) {
  const meals = arr(plan && plan.meals)
    .filter((m) => estObjet(m) && parseMealKey(m.key))
    .map((m) =>
      estNombre(m.day) && m.slot ? { ...m, persons: personsOfSlot(ctx, m.day, m.slot) } : { ...m }
    );
  return recomputeCooking(meals);
}

// Etat memorise de la recherche du plan le moins cher pour ce profil et ces repas gardes (sans rien calculer).
function lowState(ctx, fixed, strict) {
  const memo = memoSlot(ctx);
  return memo ? memo.get(lowKey(ctx, fixed, strict)) || null : null;
}

const searchDone = (st) => !!st && st.next >= CHEAP_STARTS.length;

/**
 * Ou en est la recherche du moins cher, comme lowestCost : regles strictes d'abord, regles souples seulement si
 * le plan strict depasse le budget de plus d'un petit depassement.
 * -> { pending: true|false (regles strictes a poursuivre) } | { reachable } | { minimum }.
 */
function searchState(ctx, fixed, budget) {
  const st = lowState(ctx, fixed, true);
  if (!searchDone(st)) return { pending: true };
  if (st.best && st.best.t <= budget) return { reachable: true };
  if (st.best && st.best.t <= budget + overOk(budget)) return { minimum: st.best.t };
  const so = lowState(ctx, fixed, false);
  if (!searchDone(so)) return { pending: false };
  if (so.best && so.best.t <= budget) return { reachable: true };
  if (!st.best || !so.best) return { minimum: (st.best || so.best || { t: null }).t };
  return { minimum: st.best.t <= so.best.t + overOk(budget) ? st.best.t : so.best.t };
}

function statusCtx(a) {
  const ctx = makeCtx({ ...a, repairMs: 0 });
  const fixed = normalizeFixed(lockedFromPlan(a.plan), ctx, []);
  return { ctx, fixed };
}

/**
 * budgetStatus({ plan, recipes, ingredients, profile }) -> etat du budget du plan COURANT pour le budget et le foyer
 * ACTUELS (reglages changes apres la composition), sans recomposer les repas :
 * { target, estimated, over, unreachable, minimum, cheaper, searching }.
 * minimum = cout le plus bas connu (jamais plus haut qu'un plan deja trouve), donne seulement quand la recherche du
 * plan le moins cher de ce profil est finie et qu'il depasse le budget. searching = recherche pas encore finie
 * (refineCheapest la poursuit par morceaux) : rien n'est annonce d'ici la, pour ne jamais afficher une valeur pire.
 */
export function budgetStatus(args = {}) {
  const none = {
    target: null,
    estimated: 0,
    over: false,
    unreachable: false,
    minimum: null,
    cheaper: false,
    searching: false,
  };
  try {
    const a = estObjet(args) ? args : {};
    if (!estObjet(a.plan)) return none;
    const { ctx, fixed } = statusCtx(a);
    const estimated = fastTotal(ctx, currentMeals(ctx, a.plan));
    const target = ctx.p.budget || null;
    if (!target || estimated <= target)
      return { ...none, target, estimated };
    // sans memoire de recherche (donnees non memorisables) : depassement seul, aucune recherche relancee en boucle
    if (!memoSlot(ctx)) return { ...none, target, estimated, over: true };
    const ss = searchState(ctx, fixed, target);
    // budget atteignable avec le catalogue : depasse seulement, "Tout recomposer" le tient
    if (ss.reachable) return { ...none, target, estimated, over: true };
    if (ss.pending !== undefined)
      return { ...none, target, estimated, over: true, searching: true };
    if (!estNombre(ss.minimum)) return { ...none, target, estimated, over: true };
    const minimum = round2(Math.min(estimated, ss.minimum));
    // cheaper : le plan affiche coute plus que le moins cher trouve ("Tout recomposer" le donne)
    return {
      ...none,
      target,
      estimated,
      over: true,
      unreachable: minimum > target,
      minimum,
      cheaper: minimum < estimated - 0.01,
    };
  } catch {
    return none;
  }
}

/**
 * refineCheapest({ plan, recipes, ingredients, profile }) -> true quand la recherche du plan le moins cher du profil
 * est finie. Chaque appel essaie UN depart de plus (quelques dizaines de ms) : a appeler en arriere-plan tant que
 * budgetStatus rend searching. Le meilleur plan trouve est memorise par profil et repris par generatePlan.
 */
export function refineCheapest(args = {}) {
  try {
    const a = estObjet(args) ? args : {};
    if (!estObjet(a.plan)) return true;
    const { ctx, fixed } = statusCtx(a);
    if (!ctx.p.budget) return true;
    const ss = searchState(ctx, fixed, ctx.p.budget);
    if (ss.pending === undefined) return true;
    cheapestPlan(ctx, fixed, Infinity, 1, ss.pending);
    return searchState(ctx, fixed, ctx.p.budget).pending === undefined;
  } catch {
    return true;
  }
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
  // Budget hors d'atteinte : meme le plan le moins cher trouve le depasse (minimum = son total estime).
  const minimum =
    target && gap > 0 && estNombre(meta.minimum) && meta.minimum > target
      ? round2(Math.min(meta.minimum, sh.totalEur))
      : null;
  if (minimum !== null) out.push({ code: 'budget_unreachable', budget: target, minimum });
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
      unreachable: target ? minimum !== null : null,
      minimum,
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
 *          warnings:[{code,...}], budget:{target,estimated,consumed,waste,gap,within,unreachable,minimum}, stats, fingerprint }
 * locked : { "2-soir": "recipe-id" | { recipeId } | { free:true } } ou tableau de repas verrouillés.
 * Budget : tenu des qu'il est atteignable avec le catalogue. Sinon unreachable = true, minimum = total du plan le
 * moins cher trouve (le plan rendu), et l'avertissement { code:'budget_unreachable', budget, minimum } s'ajoute a
 * over_budget.
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
    // budget depasse : reparation, puis plan le moins cher (budget tenu des qu'il est atteignable)
    const low = lowestCost(ctx, fixed, meals);
    return finish(ctx, low.meals, warnings, {
      seed,
      weekStart: a.weekStart,
      minimum: low.minimum,
    });
  } catch (e) {
    return {
      version: 1,
      seed: args && args.seed !== undefined ? args.seed : 1,
      weekStart: null,
      swaps: 0,
      meals: [],
      warnings: [{ code: 'error', message: String(e && e.message) }],
      budget: {
        target: null,
        estimated: 0,
        consumed: 0,
        waste: 0,
        gap: 0,
        within: null,
        unreachable: null,
        minimum: null,
      },
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
        ...(m.manual && typeof m.okFor === 'string' ? { okFor: m.okFor } : {}),
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
    // minimum du plan d'origine garde : un echange ne change pas le cout du plan le moins cher
    const b = estObjet(plan.budget) ? plan.budget : {};
    return finish(ctx, meals, [], {
      seed: plan.seed,
      weekStart: plan.weekStart,
      swaps,
      minimum: b.unreachable ? b.minimum : null,
    });
  } catch {
    return args && args.plan;
  }
}

/** swapMeal({ plan, mealKey, recipeId?, recipes, ingredients, profile, seed? }) -> nouveau plan (le repas change, les autres restent). */
export function swapMeal(args = {}) {
  return mutate(args, (ctx, meal) => {
    if (args.recipeId) {
      if (args.manual && ctx.manualOk(args.recipeId)) {
        // okFor : restrictions du profil pour lesquelles ce choix a ete confirme (unsuitableMeals)
        const okFor = typeof args.okFor === 'string' ? { okFor: args.okFor } : {};
        return {
          replace: { [meal.key]: { recipeId: args.recipeId, locked: true, manual: true, ...okFor } },
        };
      }
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

/**
 * replaceMeals({ plan, keys, recipes, ingredients, profile, seed? }) -> nouveau plan : les repas `keys` (et leurs
 * restes) recoivent un autre plat admis par le profil ; tous les autres repas restent tels quels (gardes ou non).
 * Sert a remplacer les repas qui ne conviennent plus (unsuitableMeals). Aucun repas a remplacer : plan inchange.
 */
export function replaceMeals(args = {}) {
  try {
    const { plan } = args;
    const want = new Set(arr(args.keys).filter((k) => typeof k === 'string'));
    if (!estObjet(plan) || !Array.isArray(plan.meals)) return plan;
    const targets = plan.meals.filter((m) => estObjet(m) && want.has(m.key) && !m.free);
    if (targets.length === 0) return plan;
    const ctx = makeCtx(args);
    const swaps = (plan.swaps || 0) + 1;
    const seed =
      args.seed !== undefined && args.seed !== null ? args.seed : `${plan.seed}:remplacer:${swaps}`;
    const rng = createRng(hashSeed(seed));
    const drop = new Set(targets.map((m) => m.key));
    for (const m of plan.meals) if (estObjet(m) && drop.has(m.leftoverOf)) drop.add(m.key);
    const ban = {};
    const old = new Set(targets.map((m) => m.recipeId).filter(Boolean));
    for (const k of drop) ban[k] = old;
    const fixed = fixedFromPlan(plan, ctx, drop, {});
    const meals = solve(ctx, fixed, rng, { ban, poolSeed: seed, poolK: POOL_SWAP });
    const b = estObjet(plan.budget) ? plan.budget : {};
    return finish(ctx, meals, [], {
      seed: plan.seed,
      weekStart: plan.weekStart,
      swaps,
      minimum: b.unreachable ? b.minimum : null,
    });
  } catch {
    return args && args.plan;
  }
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
            ...(m.manual && typeof m.okFor === 'string' ? { okFor: m.okFor } : {}),
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
