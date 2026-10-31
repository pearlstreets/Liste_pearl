// Liste de courses d'un plan : agrégation, mise à l'échelle, placard, paquets.
// Tous les prix sont des ESTIMATIONS (voir pricing.js).
import {
  estObjet,
  estNombre,
  arr,
  round2,
  toBase,
  convertFam,
  FAM_UNIT,
  AISLE_ORDER,
  indexRecipes,
  hashString,
  isFreeKey,
} from './util';
import { normalizeProfile, personsFor } from './profile';
import { packInfo, packPrice, consumedCost } from './pricing';

// Besoins d'une recette pour `persons` personnes :
// [{ key, amt, fam, ing, optional }] avec amt dans la famille de l'ingrédient.
export function recipeNeeds(recipe, persons, ingredients, opts = {}) {
  const out = [];
  if (!estObjet(recipe)) return out;
  const servings = recipe.servings > 0 ? recipe.servings : 4;
  const factor = (persons > 0 ? persons : servings) / servings;
  for (const it of arr(recipe.ingredients)) {
    if (!estObjet(it) || !it.key) continue;
    if (it.optional && !opts.includeOptional) continue;
    const ing = ingredients && ingredients[it.key] ? ingredients[it.key] : null;
    const b = toBase(Number(it.qty) * factor, it.unit);
    const free = isFreeKey(it.key);
    const pk = packInfo(ing);
    if (!(b.amt > 0)) {
      // Recette personnelle, ingrédient sans quantité ("sel") : il reste une ligne de courses.
      if (recipe.custom)
        out.push({
          key: it.key,
          amt: 0,
          fam: pk ? pk.fam : 'u',
          ing,
          optional: !!it.optional,
          free,
          noQty: true,
        });
      continue;
    }
    const fam = pk ? pk.fam : b.fam;
    let amt = convertFam(b.amt, b.fam, fam, ing);
    if (amt === null) amt = b.amt; // famille non convertible : on garde la quantité brute
    out.push({ key: it.key, amt, fam, ing, optional: !!it.optional, free });
  }
  return out;
}

export function isPantryKey(key, ing, profile, includePantry) {
  if (includePantry) return false;
  const p = normalizeProfile(profile);
  return !!(ing && ing.pantry) || p.pantry.includes(key);
}

// Repas qui font cuisiner (pas les restes, les repas libres ni les repas déjà préparés) avec leurs convives.
export function cookingMeals(plan, profile) {
  const out = [];
  for (const m of arr(plan && plan.meals)) {
    if (!estObjet(m) || !m.recipeId || m.free || m.leftoverOf || m.batchOf) continue;
    const persons =
      estNombre(m.cookPersons) && m.cookPersons > 0
        ? m.cookPersons
        : estNombre(m.persons) && m.persons > 0
          ? m.persons
          : personsFor(profile, m.day, m.slot);
    out.push({ meal: m, recipeId: m.recipeId, persons });
  }
  return out;
}

export function planFingerprint(lines) {
  const parts = arr(lines)
    .map((l) => `${l.key}:${l.packs}:${round2(l.qty)}:${l.unit}`)
    .sort();
  return `mp${hashString(parts.join('|'))}`;
}

/**
 * buildShoppingList({ plan, recipes, ingredients, profile, includePantry, includeOptional, have })
 * -> { lines, byAisle, totalEur, consumedEur, wasteEur, skipped, missingRecipes, unpricedCount, fingerprint }
 * ligne = { key, qty, unit, packs, packQty, packUnit, packLabel, estimatedEur, consumedEur,
 *           aisle, emoji, usedIn:[recipeId], priceKnown, free?, noQty? }
 * Ligne `free` : ingrédient libre d'une recette personnelle, aucun prix estimé (estimatedEur = 0),
 * compté dans `unpricedCount` pour que le total le dise. Même chose pour un ingrédient sans quantité.
 * `have` : { key: quantité déjà possédée (dans l'unité de la ligne) } (optionnel).
 */
export function buildShoppingList({
  plan,
  recipes,
  ingredients,
  profile,
  includePantry = false,
  includeOptional = false,
  have,
} = {}) {
  const idx = indexRecipes(recipes);
  const ings = estObjet(ingredients) ? ingredients : {};
  const needs = new Map();
  const skipped = [];
  const skippedKeys = new Set();
  const missingRecipes = [];
  for (const cm of cookingMeals(plan, profile)) {
    const r = idx.get(cm.recipeId);
    if (!r) {
      if (!missingRecipes.includes(cm.recipeId)) missingRecipes.push(cm.recipeId);
      continue;
    }
    for (const n of recipeNeeds(r, cm.persons, ings, { includeOptional })) {
      if (isPantryKey(n.key, n.ing, profile, includePantry)) {
        if (!skippedKeys.has(n.key)) {
          skippedKeys.add(n.key);
          skipped.push({ key: n.key, reason: 'pantry' });
        }
        continue;
      }
      // Deux familles d'unités sans conversion connue (200 g et 2 pièces) : deux lignes distinctes.
      const first = needs.get(n.key);
      const split = n.free && first && !first.noQty && !n.noQty && first.fam !== n.fam;
      const mapKey = split ? `${n.key}|${n.fam}` : n.key;
      const cur = needs.get(mapKey) || {
        key: mapKey,
        ing: n.ing,
        fam: n.fam,
        amt: 0,
        usedIn: [],
        free: !!n.free,
        noQty: !!n.noQty,
      };
      if (cur.noQty && !n.noQty) {
        cur.noQty = false;
        cur.fam = n.fam;
      }
      cur.amt += n.fam === cur.fam ? n.amt : (convertFam(n.amt, n.fam, cur.fam, n.ing) ?? n.amt);
      if (!cur.usedIn.includes(cm.recipeId)) cur.usedIn.push(cm.recipeId);
      needs.set(mapKey, cur);
    }
  }
  const lines = [];
  const stock = estObjet(have) ? have : {};
  for (const cur of needs.values()) {
    let amt = cur.amt;
    const own = Number(stock[cur.key]);
    if (estNombre(own) && own > 0) amt -= own;
    if (!(amt > 1e-9) && !cur.noQty) {
      skipped.push({ key: cur.key, reason: 'have' });
      continue;
    }
    if (cur.free || cur.noQty) {
      const unit = FAM_UNIT[cur.fam];
      const qty = cur.noQty ? 0 : Math.ceil(amt - 1e-9);
      lines.push({
        key: cur.key,
        qty,
        unit,
        packs: unit === 'u' && qty > 0 ? qty : 1,
        packQty: null,
        packUnit: null,
        packLabel: '',
        estimatedEur: 0,
        consumedEur: 0,
        aisle: (cur.ing && cur.ing.aisle) || 'epicerie',
        emoji: (cur.ing && cur.ing.emoji) || '',
        usedIn: cur.usedIn,
        priceKnown: false,
        free: true,
        noQty: !!cur.noQty,
      });
      continue;
    }
    const ing = cur.ing;
    const pk = packInfo(ing);
    let packs = 1;
    let est;
    let priceKnown;
    if (pk) {
      packs = Math.max(1, Math.ceil(amt / pk.amt - 1e-9));
      const pp = packPrice(ing);
      est = packs * pp.eur;
      priceKnown = pp.priceKnown;
    } else {
      const c = consumedCost(ing, amt, cur.fam);
      est = c.eur;
      priceKnown = c.priceKnown;
    }
    const cons = consumedCost(ing, amt, cur.fam);
    const unit = FAM_UNIT[cur.fam];
    const qty = unit === 'u' ? Math.ceil(amt - 1e-9) : Math.ceil(amt);
    lines.push({
      key: cur.key,
      qty,
      unit,
      packs,
      packQty: pk ? pk.qty : null,
      packUnit: pk ? pk.unit : null,
      packLabel: pk ? pk.label : '',
      estimatedEur: round2(est),
      consumedEur: round2(Math.min(cons.eur, est)),
      aisle: (ing && ing.aisle) || 'epicerie',
      emoji: (ing && ing.emoji) || '',
      usedIn: cur.usedIn,
      priceKnown,
    });
  }
  const rank = (a) => {
    const i = AISLE_ORDER.indexOf(a);
    return i < 0 ? 99 : i;
  };
  lines.sort(
    (a, b) => rank(a.aisle) - rank(b.aisle) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  );
  const byAisle = [];
  for (const l of lines) {
    let g = byAisle[byAisle.length - 1];
    if (!g || g.aisle !== l.aisle) {
      g = { aisle: l.aisle, lines: [], totalEur: 0 };
      byAisle.push(g);
    }
    g.lines.push(l);
    g.totalEur = round2(g.totalEur + l.estimatedEur);
  }
  const totalEur = round2(lines.reduce((s, l) => s + l.estimatedEur, 0));
  const consumedEur = round2(lines.reduce((s, l) => s + l.consumedEur, 0));
  return {
    lines,
    byAisle,
    totalEur,
    consumedEur,
    wasteEur: round2(Math.max(0, totalEur - consumedEur)),
    skipped,
    missingRecipes,
    unpricedCount: lines.filter((l) => l.free).length,
    fingerprint: planFingerprint(lines),
  };
}

const newId = () => String(Date.now()) + Math.random().toString(36).slice(2);

/**
 * toListItems(lignes, nomLocalise, itemsExistants, opts)
 * Fusionne les lignes de courses dans les articles d'une liste, avec la règle
 * d'addFromInput (App.js) : même nom (insensible à la casse) ET même unité -> on additionne.
 * Quantité ajoutée = nombre de paquets (ou pièces). Format : { id, name, qty, unit:'u', crossed:false, selected:true }.
 * opts : { fingerprint, appliedFingerprints:[], idGen, force }
 * -> { items, added, merged, fingerprint, alreadyApplied }
 */
export function toListItems(lignes, nomLocalise, itemsExistants, opts = {}) {
  const o = estObjet(opts) ? opts : {};
  const existing = Array.isArray(itemsExistants) ? itemsExistants.filter(estObjet) : [];
  const lines = arr(lignes).filter((l) => estObjet(l) && l.key);
  const fingerprint = o.fingerprint || planFingerprint(lines);
  if (!o.force && arr(o.appliedFingerprints).includes(fingerprint)) {
    return { items: existing, added: 0, merged: 0, fingerprint, alreadyApplied: true };
  }
  const idGen = typeof o.idGen === 'function' ? o.idGen : newId;
  const base = [...existing];
  let added = 0;
  let merged = 0;
  for (const l of lines) {
    let name = '';
    try {
      name = typeof nomLocalise === 'function' ? nomLocalise(l) : '';
    } catch {
      name = '';
    }
    name = String(name || l.key).trim();
    if (!name) continue;
    const qty = Math.max(1, Math.round(estNombre(l.packs) && l.packs > 0 ? l.packs : l.qty || 1));
    const idx = base.findIndex(
      (b) => String(b && b.name).toLowerCase() === name.toLowerCase() && (b.unit || 'u') === 'u'
    );
    let match = null;
    try {
      const mo = typeof o.matchOf === 'function' ? o.matchOf(l) : null;
      if (Array.isArray(mo) && mo.length) match = mo.filter((x) => typeof x === 'string' && x);
    } catch {
      match = null;
    }
    const matchFields = match && match.length ? { matchNames: match, matchFor: name } : {};
    if (idx >= 0) {
      // Un article rajouté depuis Menus est de nouveau à acheter : coché pour la recherche de produits, plus barré.
      base[idx] = {
        ...base[idx],
        qty: (base[idx].qty || 1) + qty,
        crossed: false,
        selected: true,
        ...(base[idx].matchNames ? {} : matchFields),
      };
      merged++;
    } else {
      base.push({ id: idGen(), name, qty, unit: 'u', crossed: false, selected: true, ...matchFields });
      added++;
    }
  }
  return { items: base, added, merged, fingerprint, alreadyApplied: false };
}
