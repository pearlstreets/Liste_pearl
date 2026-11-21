// ---- Autocomplétion d'adresse Photon (komoot, OSM) — JS pur, sans clé API ----
const PHOTON_LANGS = ['fr', 'de', 'en'];
export async function fetchPhotonSuggestions(query, countryCode, lang) {
  const isoLang = (lang || 'en').toLowerCase();
  const photonLang = PHOTON_LANGS.includes(isoLang) ? isoLang : 'en';
  try {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15&lang=${photonLang}`);
    const json = await res.json();
    const feats = (json && json.features) || [];
    const seen = new Set();
    return feats
      .filter((f) => !countryCode || ((f?.properties?.countrycode || '').toUpperCase() === countryCode))
      .map((f) => {
        const p = f?.properties || {};
        const c = f?.geometry?.coordinates || [];
        const street = [p.housenumber, p.street].filter(Boolean).join(' ');
        const city = p.city || p.district || p.county || p.name || '';
        const label = [street || p.name, p.postcode, city].filter(Boolean).join(', ');
        return label ? { label, address: street || p.name || city || '', postcode: p.postcode || '', city, country: p.country || '', lat: c[1], lng: c[0] } : null;
      })
      .filter(Boolean)
      .filter((s) => !seen.has(s.label) && seen.add(s.label))
      .slice(0, 4);
  } catch (_e) {
    return [];
  }
}
