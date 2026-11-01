// Trait de la carte du suivi de livraison : seulement le chemin qui reste à
// parcourir, par les rues (01/11/2026).
//
// Le tracé vient du champ « itineraire » de GET /delivery/status/<id>/
// (calcul Apple Plans côté serveur) : du livreur vers la boutique avant la
// récupération, vers le client ensuite. Sans tracé reçu, aucun trait : jamais
// de ligne droite à travers les immeubles. Même logique que la carte du suivi
// d'AppUser (src/screens/SuiviLivraison/useItineraire.js).

// Statuts où plus rien ne reste à parcourir : aucun trait.
const STATUTS_SANS_TRAIT = ['arrived', 'delivered', 'cancelled'];

// [[lat, lng], ...] reçu du serveur, en points { latitude, longitude }.
// Moins de deux points valides : null.
export const enPoints = (liste) => {
  if (!Array.isArray(liste)) return null;
  const points = liste
    .filter(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        typeof p[0] === 'number' &&
        typeof p[1] === 'number' &&
        !Number.isNaN(p[0]) &&
        !Number.isNaN(p[1])
    )
    .map(([latitude, longitude]) => ({ latitude, longitude }));
  return points.length >= 2 ? points : null;
};

// Distance approchée en mètres (petites distances).
export const metres = (a, b) => {
  const k = 111320;
  const dx = (a.longitude - b.longitude) * k * Math.cos((a.latitude * Math.PI) / 180);
  const dy = (a.latitude - b.latitude) * k;
  return Math.sqrt(dx * dx + dy * dy);
};

// Point du segment [a, b] le plus proche de p (projection à plat, valable sur
// quelques centaines de mètres).
export const projeter = (a, b, p) => {
  const c = Math.cos((p.latitude * Math.PI) / 180);
  const bx = (b.longitude - a.longitude) * c;
  const by = b.latitude - a.latitude;
  const px = (p.longitude - a.longitude) * c;
  const py = p.latitude - a.latitude;
  const l2 = bx * bx + by * by;
  const t = l2 ? Math.max(0, Math.min(1, (px * bx + py * by) / l2)) : 0;
  return {
    latitude: a.latitude + t * (b.latitude - a.latitude),
    longitude: a.longitude + t * (b.longitude - a.longitude),
  };
};

// Le tracé repart de la position du livreur : la partie déjà parcourue
// disparaît au fil de l'avancée, même au milieu d'une longue rue droite
// (projection sur le segment le plus proche, pas seulement sur ses sommets).
// Écart de plus de 60 m (tracé pas encore relu) : la ligne part du point du
// tracé le plus proche, jamais de raccord en travers des maisons. Au bout du
// tracé : null.
export const recoller = (trace, position) => {
  if (!trace || !position) return trace;
  if (trace.length < 2) return null;
  let segment = 0;
  let pied = trace[0];
  let dMin = Infinity;
  for (let i = 0; i < trace.length - 1; i += 1) {
    const q = projeter(trace[i], trace[i + 1], position);
    const d = metres(q, position);
    if (d < dMin) {
      dMin = d;
      segment = i;
      pied = q;
    }
  }
  const reste = trace.slice(segment + 1);
  if (metres(pied, trace[trace.length - 1]) < 1) return null;
  const debut = dMin <= 60 ? [position, pied] : [pied];
  return [...debut, ...reste].filter((p, i, l) => i === 0 || metres(p, l[i - 1]) >= 0.5);
};

// Points du trait à dessiner pour un statut lu sur /status/, ou null (aucun
// trait) : pas d'itinéraire, livreur arrivé, course livrée ou annulée.
export const cheminRestant = (status, positionLivreur) => {
  const st = String(status?.status || '').toLowerCase();
  if (STATUTS_SANS_TRAIT.includes(st)) return null;
  const trace = enPoints(status?.itineraire);
  if (!trace) return null;
  const chemin = recoller(trace, positionLivreur || null);
  return chemin && chemin.length >= 2 ? chemin : null;
};
