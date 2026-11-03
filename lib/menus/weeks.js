// Semaines du plan : lundi de référence, semaine à proposer, semaine passée. Pur, sans stockage.

const p2 = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** 'AAAA-MM-JJ' -> Date locale (minuit) ou null. */
export function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d;
}

export function addDaysISO(iso, n) {
  const d = parseISO(iso);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Lundi (AAAA-MM-JJ) de la semaine qui contient `d`. */
export function mondayISO(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return toISO(x);
}

/**
 * Samedi à partir de 18 h, ou dimanche : on propose la semaine suivante.
 * -> { current, next, proposeNext, start } ; start = semaine à composer par défaut.
 */
export function weekTarget(now = new Date()) {
  const day = now.getDay();
  const proposeNext = day === 0 || (day === 6 && now.getHours() >= 18);
  const current = mondayISO(now);
  const next = addDaysISO(current, 7);
  return { current, next, proposeNext, start: proposeNext ? next : current };
}

/** Rang (0 = lundi ... 6 = dimanche) de `now` dans la semaine `weekStart`, ou -1 si hors de cette semaine. */
export function dayIndexIn(weekStart, now = new Date()) {
  const s = parseISO(weekStart);
  if (!s) return -1;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const i = Math.round((t.getTime() - s.getTime()) / 86400000);
  return i >= 0 && i <= 6 ? i : -1;
}

/** La semaine `weekStart` est terminée (son dimanche est passé). Semaine inconnue = jamais passée. */
export function isPastWeek(weekStart, now = new Date()) {
  const s = parseISO(weekStart);
  if (!s) return false;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t.getTime() - s.getTime()) / 86400000) >= 7;
}

/* --------------------------- vue Mois (calendrier) --------------------------- */

/** Mois précédent / suivant : { year, month } (month 0-11). */
export function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * Grille d'un mois, lundi en premier : liste de semaines { weekStart, days: [{ iso, date, inMonth }] }
 * (4 à 6 semaines, jours des mois voisins compris pour compléter).
 */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const weeks = [];
  let start = mondayISO(first);
  for (let guard = 0; guard < 7; guard++) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(start, i);
      const d = parseISO(iso);
      days.push({ iso, date: d.getDate(), inMonth: d.getMonth() === month && d.getFullYear() === year });
    }
    weeks.push({ weekStart: start, days });
    start = addDaysISO(start, 7);
    if (parseISO(start).getTime() > last.getTime()) break;
  }
  return weeks;
}

/**
 * Semaines connues : Map(lundi -> { plan, source }) ; le plan en cours l'emporte, puis l'entrée la plus récente
 * de l'historique pour chaque semaine. Ne modifie rien, ne lève pas.
 */
export function weeksIndex(plan, history) {
  const out = new Map();
  const list = Array.isArray(history) ? history : [];
  for (const h of list) {
    if (h && typeof h.weekStart === 'string' && Array.isArray(h.meals) && parseISO(h.weekStart))
      out.set(h.weekStart, { plan: h, source: 'history' });
  }
  if (plan && typeof plan.weekStart === 'string' && Array.isArray(plan.meals) && parseISO(plan.weekStart))
    out.set(plan.weekStart, { plan, source: 'plan' });
  return out;
}

/**
 * Ce qu'on peut faire d'une semaine :
 * 'edit' (c'est le plan en cours), 'past' (terminée : lecture seule, on peut la refaire),
 * 'resume' (gardée dans l'historique, pas encore passée : on peut la reprendre en plan en cours),
 * 'prepare' (rien de prévu : la composer, le plan en cours reste dans l'historique),
 * 'far' (trop loin : on prépare d'abord la semaine d'avant), 'none' (passée, rien d'enregistré).
 */
export function weekKind(weekStart, plan, index, now = new Date()) {
  if (!parseISO(weekStart)) return 'none';
  if (plan && plan.weekStart === weekStart) return 'edit';
  const past = isPastWeek(weekStart, now);
  const known = index && index.get(weekStart);
  if (known) return past ? 'past' : 'resume';
  if (past) return 'none';
  const t = weekTarget(now);
  const afterPlan = plan && plan.weekStart ? addDaysISO(plan.weekStart, 7) : null;
  return weekStart === t.current || weekStart === t.next || weekStart === afterPlan
    ? 'prepare'
    : 'far';
}
