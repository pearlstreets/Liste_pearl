// Fusion d'articles dans Ma Liste (saisie au clavier, photo lue par le Scan) :
// même nom (sans tenir compte des majuscules) et même unité, les quantités
// s'additionnent ; sinon l'article est ajouté, sélectionné et non barré.
// Renvoie une NOUVELLE liste, `prev` n'est pas modifiée.
export function fusionnerArticles(prev, ajouts) {
  const base = [...(Array.isArray(prev) ? prev : [])];
  for (const p of ajouts || []) {
    const idx = base.findIndex(b => b.name.toLowerCase() === p.name.toLowerCase() && (b.unit || 'u') === (p.unit || 'u'));
    if (idx >= 0) base[idx] = { ...base[idx], qty: (base[idx].qty || 1) + p.qty };
    else base.push({ id: String(Date.now()) + Math.random().toString(36).slice(2), name: p.name, qty: p.qty, unit: p.unit || 'u', crossed: false, selected: true });
  }
  return base;
}
