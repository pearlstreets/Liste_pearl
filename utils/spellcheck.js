import DICT from '../data/grocery-fr.json';
import CATALOG from '../data/catalog-fr.json';

function stripDiacritics(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
export function normalizeText(s) {
  return stripDiacritics(String(s).toLowerCase())
    .replace(/[^a-z0-9\s\-']/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// Damerau-Levenshtein (transposition adjacente = 1)
function damerauLevenshtein(a, b) {
  const m = a.length,
    n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

function bestCandidate(word) {
  const w = normalizeText(word);
  const candidates = new Set([...DICT, ...Object.keys(CATALOG)]);
  let best = null;
  for (const cand of candidates) {
    const cn = normalizeText(cand);
    if (!cn) continue;
    if (w === cn) return { suggestion: cand, confidence: 1 };
    if (Math.abs(w.length - cn.length) > 3) continue;
    if (w[0] && cn[0] && w[0] !== cn[0]) continue;
    const dist = damerauLevenshtein(w, cn);
    const conf = 1 - dist / Math.max(w.length, cn.length);
    if (!best || conf > best.confidence) best = { suggestion: cand, confidence: conf };
  }
  return best;
}

function canonicalizeViaCatalog(name) {
  const norm = normalizeText(name);
  for (const canonical of Object.keys(CATALOG)) {
    const normCanon = normalizeText(canonical);
    if (norm === normCanon) return canonical;
    const syns = CATALOG[canonical] || [];
    for (const s of syns) {
      if (normalizeText(s) === norm) return canonical;
    }
  }
  // Pluriel/singulier simple
  if (norm.endsWith('s')) {
    const base = norm.slice(0, -1);
    for (const canonical of Object.keys(CATALOG)) {
      if (normalizeText(canonical) === base + 's') return canonical;
      const syns = CATALOG[canonical] || [];
      for (const s of syns) if (normalizeText(s) === base) return canonical;
    }
  }
  return name;
}

export function autocorrectName(name) {
  const s = String(name || '').trim();
  if (!s) return s;
  const b = bestCandidate(s);
  const threshold = s.length <= 5 ? 0.6 : 0.57;
  const corrected = b && b.confidence >= threshold ? b.suggestion : s;
  return canonicalizeViaCatalog(corrected);
}
