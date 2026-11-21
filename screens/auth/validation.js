// Règles de validation d'inscription — STRICTEMENT identiques à l'inscription
// marketplace (AppUser SignupOne/SignupTwo). Toute divergence ferait accepter
// ici un compte que le backend ou l'app mobile refuserait.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
export const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const PHONE_RE = /^\d{5,16}$/;
export const USERNAME_MIN = 4;

// Normalise une date de naissance vers l'ISO 'YYYY-MM-DD' exigé par le backend
// (DRF DateField iso-8601 uniquement). Accepte 'AAAA-MM-JJ' ET les habitudes FR
// 'JJ/MM/AAAA', 'JJ-MM-AAAA', 'JJ.MM.AAAA'. Retourne null si non parsable.
export function normalizeDob(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  let y, m, d;
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (dmy) { d = +dmy[1]; m = +dmy[2]; y = +dmy[3]; }
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${y}-${pad(m)}-${pad(d)}`;
}
