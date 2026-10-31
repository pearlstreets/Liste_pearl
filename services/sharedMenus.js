// Semaines partagées avec moi. Sans compte ou hors ligne : aucune semaine, jamais d'erreur.
import { apiJsonWithStatus, getTokens } from './api';
import { cleanSharedWeeks } from '../lib/menus/sharedWeek';

const SHARED_PATH = '/users/list-menus/shared/';
const TIMEOUT_MS = 8000;

export async function fetchSharedWeeks() {
  try {
    const tokens = await getTokens();
    if (!tokens || !tokens.access) return [];
    const res = await apiJsonWithStatus('GET', SHARED_PATH, undefined, { timeoutMs: TIMEOUT_MS });
    return res.ok ? cleanSharedWeeks(res.data) : [];
  } catch {
    return [];
  }
}
