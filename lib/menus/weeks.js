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
