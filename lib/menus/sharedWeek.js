// Semaine partagée en famille : réglage synchronisé et lecture prudente de la réponse du serveur.
import { cleanRemoteUrl } from './myRecipes';

const CLE_REPAS = /^([0-6])-(midi|soir)$/;
const PERSONNES_MAX = 99;
const NOM_MAX = 60;
const TITRE_MAX = 120;
const SEMAINES_MAX = 20;
const REPAS_MAX = 14;

export const defaultFamilyShare = () => ({ enabled: false });
export const cleanFamilyShare = (v) => ({ enabled: !!v && v.enabled === true });

const texte = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function repas(x) {
  const m = x && typeof x.key === 'string' ? CLE_REPAS.exec(x.key) : null;
  if (!m) return null;
  const base = { key: x.key, day: Number(m[1]), slot: m[2] };
  if (x.free === true) return { ...base, free: true };
  const persons =
    Number.isInteger(x.persons) && x.persons >= 1 && x.persons <= PERSONNES_MAX ? x.persons : null;
  const recipeId = typeof x.recipe_id === 'string' && x.recipe_id ? x.recipe_id : null;
  return {
    ...base,
    free: false,
    recipeId,
    persons,
    title: recipeId ? '' : texte(x.title, TITRE_MAX),
    photo: recipeId ? '' : cleanRemoteUrl(x.photo) || '',
  };
}

/** Garde les seules personnes qui ont une semaine à montrer ; tout le reste est écarté. */
export function cleanSharedWeeks(payload) {
  const brut = payload && Array.isArray(payload.weeks) ? payload.weeks : [];
  const out = [];
  for (const x of brut.slice(0, SEMAINES_MAX)) {
    const name = texte(x && x.name, NOM_MAX);
    const week = x && x.week;
    const weekStart = week && typeof week.week_start === 'string' ? week.week_start : '';
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !Array.isArray(week.meals)) continue;
    const meals = week.meals.slice(0, REPAS_MAX).map(repas).filter(Boolean);
    if (meals.length) out.push({ name, weekStart, meals });
  }
  return out;
}
