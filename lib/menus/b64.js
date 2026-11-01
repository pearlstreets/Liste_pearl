// Entiers en base 64 de largeur fixe pour les colonnes du catalogue genere (data/menus/gen).
// Alphabet A-Z a-z 0-9 + / (6 bits par caractere), chiffre de poids fort en premier.
// Lecture par charCodeAt et une table de 128 octets : aucune allocation, aucune exception.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INVALID = 255;
const TABLE = new Uint8Array(128).fill(INVALID);
for (let i = 0; i < ALPHABET.length; i++) TABLE[ALPHABET.charCodeAt(i)] = i;

/**
 * readInt(str, pos, n) : entier lu sur n caracteres a partir de pos.
 * Renvoie -1 si la chaine est trop courte, si pos ou n sont invalides ou si un caractere est hors alphabet.
 */
export function readInt(str, pos, n) {
  if (typeof str !== 'string' || !(n >= 1) || !(pos >= 0) || pos + n > str.length) return -1;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const c = str.charCodeAt(pos + i);
    const d = c < 128 ? TABLE[c] : INVALID;
    if (d === INVALID) return -1;
    v = v * 64 + d;
  }
  return v;
}

/** writeInt(v, n) : chaine de n caracteres, ou null si v n'est pas un entier de 0 a 64^n - 1. Sert aux scripts et aux tests. */
export function writeInt(v, n) {
  if (!Number.isInteger(v) || v < 0 || !(n >= 1) || v >= Math.pow(64, n)) return null;
  let out = '';
  let x = v;
  for (let i = 0; i < n; i++) {
    out = ALPHABET[x % 64] + out;
    x = Math.floor(x / 64);
  }
  return out;
}

export const B64_ALPHABET = ALPHABET;
