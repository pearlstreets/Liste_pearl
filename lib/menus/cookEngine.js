// Mode cuisine optimisé : déroulé d'un plan (lib/menus/cookPlan.js). Pur : chaque action rend un
// nouvel état, rien n'est modifié en place. Temps en secondes.
//
// État : { st:[{ s:'todo'|'run'|'done', r, pz }], cooks:[{ k, task, tot, r, pz, ok }], pz, t }
// Règles de la maquette v15 :
// - ce qui vient d'être prêt passe devant (l'eau bout : on jette les pâtes), puis la tâche en cours,
//   puis la suivante faisable ;
// - lancer une cuisson la compte comme faite : on enchaîne pendant qu'elle cuit ;
// - Défaire revient à l'action précédente sans jamais faire reculer cuissons ni minuteurs.
import { estObjet, arr } from './util';

export const MAX_UNDO = 50;

const clone = (S) => ({
  st: S.st.map((x) => ({ ...x })),
  cooks: S.cooks.map((c) => ({ ...c })),
  pz: !!S.pz,
  t: Number(S.t) || 0,
});

export function initState(plan) {
  return {
    st: arr(plan && plan.tasks).map(() => ({ s: 'todo', r: 0, pz: false })),
    cooks: [],
    pz: false,
    t: 0,
  };
}

/** État relu (sauvegarde) : forme vérifiée, sinon null. */
export function validState(plan, S) {
  const n = arr(plan && plan.tasks).length;
  if (!estObjet(S) || !Array.isArray(S.st) || S.st.length !== n || !Array.isArray(S.cooks))
    return null;
  const okSt = S.st.every(
    (x) => estObjet(x) && ['todo', 'run', 'done'].includes(x.s) && Number.isFinite(x.r)
  );
  const okCk = S.cooks.every((c) => estObjet(c) && typeof c.k === 'string' && Number.isFinite(c.r));
  return okSt && okCk ? clone(S) : null;
}

const tasksOf = (plan) => arr(plan && plan.tasks);
const cookOf = (S, k) => S.cooks.find((c) => c.k === k) || null;
export const cookTaskIndex = (plan, k) => tasksOf(plan).findIndex((t) => t.cook && t.cook.k === k);

const needOk = (plan, S, i) =>
  tasksOf(plan)[i].need.every((k) => {
    const c = cookOf(S, k);
    return !!(c && c.ok);
  });
const afterOk = (plan, S, i) =>
  tasksOf(plan)[i].after.every((j) => S.st[j] && S.st[j].s === 'done');
function syncOk(plan, S, i) {
  const y = tasksOf(plan)[i].sync;
  if (!y) return true;
  const c = cookOf(S, y.k);
  if (c) return c.ok || c.r <= y.lead;
  // cuisson de référence annulée ou consommée : plus rien à attendre
  const j = cookTaskIndex(plan, y.k);
  return j < 0 || S.st[j].s === 'done';
}
export const can = (plan, S, i) =>
  S.st[i].s === 'todo' && needOk(plan, S, i) && afterOk(plan, S, i) && syncOk(plan, S, i);

/** Première cuisson requise et pas encore prête. */
export function missing(plan, S, i) {
  for (const k of tasksOf(plan)[i].need) {
    const c = cookOf(S, k);
    if (!(c && c.ok)) return k;
  }
  return null;
}

/** Secondes avant que la tâche i puisse partir (cuisson attendue ou lancement juste à temps). */
export function waitSec(plan, S, i) {
  const m = missing(plan, S, i);
  if (m) {
    const c = cookOf(S, m);
    return c ? c.r : null;
  }
  const y = tasksOf(plan)[i].sync;
  if (y && !syncOk(plan, S, i)) {
    const c = cookOf(S, y.k);
    return c ? Math.max(0, c.r - y.lead) : null;
  }
  return null;
}

/** La tâche à faire maintenant, ou -1. */
export function current(plan, S) {
  const T = tasksOf(plan);
  for (let i = 0; i < T.length; i++)
    if ((T[i].need.length || T[i].sync) && can(plan, S, i)) return i;
  for (let i = 0; i < T.length; i++) if (S.st[i].s === 'run') return i;
  for (let i = 0; i < T.length; i++) if (can(plan, S, i)) return i;
  return -1;
}

/** Rien ne tourne et rien ne peut partir : on débloque la première tâche dont l'ordre est respecté. */
export function stuck(plan, S) {
  if (allDone(plan, S) || current(plan, S) >= 0) return -1;
  if (S.cooks.some((c) => !c.ok) || S.st.some((x) => x.s === 'run')) return -1;
  const i = S.st.findIndex((x, j) => x.s === 'todo' && afterOk(plan, S, j));
  return i >= 0 ? i : S.st.findIndex((x) => x.s === 'todo');
}

export const allDone = (plan, S) => S.st.every((x) => x.s === 'done') && S.cooks.every((c) => c.ok);
export const doneCount = (S) => S.st.filter((x) => x.s === 'done').length;
export const active = (S) => S.cooks.some((c) => !c.ok) || S.st.some((x) => x.s === 'run');

function consume(plan, S, i) {
  const need = tasksOf(plan)[i].need;
  S.cooks = S.cooks.filter((c) => !need.includes(c.k));
}

/** Lancer : une cuisson part toute seule ; une tâche démarre son minuteur. */
export function launch(plan, S0, i) {
  const S = clone(S0);
  const t = tasksOf(plan)[i];
  if (!t || S.st[i].s !== 'todo') return S;
  if (t.cook) {
    S.st[i] = { s: 'done', r: 0, pz: false };
    consume(plan, S, i);
    S.cooks = S.cooks.filter((c) => c.k !== t.cook.k);
    S.cooks.push({ k: t.cook.k, task: i, tot: t.d, r: t.d, pz: false, ok: !(t.d > 0) });
  } else S.st[i] = { s: 'run', r: t.d, pz: false };
  return S;
}

export function finish(plan, S0, i) {
  const S = clone(S0);
  if (!S.st[i] || S.st[i].s === 'done') return S;
  S.st[i] = { s: 'done', r: 0, pz: false };
  consume(plan, S, i);
  return S;
}

export function toggleStep(S0, i) {
  const S = clone(S0);
  if (S.st[i] && S.st[i].s === 'run') S.st[i].pz = !S.st[i].pz;
  return S;
}

export function toggleCook(S0, k) {
  const S = clone(S0);
  const c = cookOf(S, k);
  if (c && !c.ok) c.pz = !c.pz;
  return S;
}

export function toggleAll(S0) {
  const S = clone(S0);
  S.pz = !S.pz;
  return S;
}

/** Annuler une cuisson : elle revient à lancer ; ce qu'elle avait consommé reste prêt. */
export function cancelCook(plan, S0, k) {
  const S = clone(S0);
  S.cooks = S.cooks.filter((c) => c.k !== k);
  const j = cookTaskIndex(plan, k);
  if (j >= 0) {
    S.st[j] = { s: 'todo', r: 0, pz: false };
    for (const n of tasksOf(plan)[j].need)
      if (!cookOf(S, n))
        S.cooks.unshift({ k: n, task: cookTaskIndex(plan, n), tot: 1, r: 0, pz: false, ok: true });
  }
  return S;
}

/**
 * Défaire : revient à l'état d'avant (prev), mais le temps a passé : minuteurs et cuissons gardent
 * leur avance et ne reculent jamais.
 */
export function undo(plan, now, prev) {
  const p = validState(plan, prev);
  if (!p) return clone(now);
  const dt = Math.max(0, now.t - p.t);
  p.t = now.t;
  p.st.forEach((x) => {
    if (x.s === 'run' && !x.pz && !p.pz) x.r = Math.max(0, x.r - dt);
  });
  p.cooks.forEach((c) => {
    const n = cookOf(now, c.k);
    if (n) {
      c.r = n.r;
      c.ok = n.ok;
      c.pz = n.pz;
    } else if (!c.ok && !c.pz && !p.pz) {
      c.r = Math.max(0, c.r - dt);
      if (!c.r) c.ok = true;
    }
  });
  return p;
}

/**
 * Le temps passe de dt secondes. Rend { S, ready:[clés de cuissons prêtes], over:[tâches dont le
 * minuteur vient de finir] }.
 */
export function advance(plan, S0, dt) {
  const S = clone(S0);
  const ready = [];
  const over = [];
  const d = Math.max(0, Number(dt) || 0);
  if (S.pz || !d) return { S, ready, over };
  S.t += d;
  S.st.forEach((x, i) => {
    if (x.s === 'run' && !x.pz && x.r > 0) {
      x.r = Math.max(0, x.r - d);
      if (!x.r) over.push(i);
    }
  });
  S.cooks.forEach((c) => {
    if (c.ok || c.pz) return;
    c.r = Math.max(0, c.r - d);
    if (!c.r) {
      c.ok = true;
      ready.push(c.k);
    }
  });
  return { S, ready, over };
}

/**
 * Temps restant si l'on suit l'ordre proposé dès maintenant (simulation par événements).
 * Les pauses en cours sont levées dans la simulation.
 */
export function remaining(plan, S0) {
  return simulate(plan, S0).sec;
}

/** Simulation complète : { sec, done } (done = le repas se termine sans blocage). */
export function simulate(plan, S0) {
  const T = tasksOf(plan);
  let S = clone(S0);
  S.pz = false;
  S.st.forEach((x) => (x.pz = false));
  S.cooks.forEach((c) => (c.pz = false));
  const t0 = S.t;
  for (let n = 0; n < 400 && !allDone(plan, S); n++) {
    let c = current(plan, S);
    if (c < 0) c = stuck(plan, S);
    if (c >= 0 && S.st[c].s === 'todo') {
      S = launch(plan, S, c);
      continue;
    }
    // prochain événement : un minuteur, une cuisson, un seuil de lancement juste à temps
    let step = Infinity;
    S.st.forEach((x) => {
      if (x.s === 'run') step = Math.min(step, x.r);
    });
    S.cooks.forEach((k) => {
      if (!k.ok) step = Math.min(step, k.r);
    });
    T.forEach((t, i) => {
      if (S.st[i].s === 'todo' && t.sync) {
        const k = cookOf(S, t.sync.k);
        if (k && !k.ok && k.r > t.sync.lead) step = Math.min(step, k.r - t.sync.lead);
      }
    });
    if (!Number.isFinite(step)) break;
    const res = advance(plan, S, Math.max(1, step));
    S = res.S;
    S.st.forEach((x, i) => {
      if (x.s === 'run' && x.r <= 0) S = finish(plan, S, i);
    });
  }
  return { sec: Math.max(0, Math.round(S.t - t0)), done: allDone(plan, S) };
}
