// Options (déclinaisons) d'une fiche produit et écarts de stock d'une course.
//
// Décision du 03/10/2026 : sur une fiche à plusieurs options, le client choisit
// la sienne (option épuisée grisée, quantité plafonnée au stock de l'option) ;
// une seule option est prise d'office. L'option part avec l'article à la
// création de la course (`variant_id`), et le serveur répond avec les
// quantités ramenées au stock (`adjusted_items`) et les articles épuisés
// (`excluded_items`). Fonctions pures : aucune ne lève, quelle que soit la
// forme reçue (anciennes réponses, champs absents).

const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// customizationOptions arrive en objet ou en chaîne JSON selon l'endpoint.
export function lireCustomizationOptions(brut) {
  if (estObjet(brut)) return brut;
  if (typeof brut === 'string' && brut.trim()) {
    try {
      const v = JSON.parse(brut);
      return estObjet(v) ? v : null;
    } catch {
      return null;
    }
  }
  return null;
}

const lignes = (v) => (Array.isArray(v) ? v.filter(estObjet) : []);

// (catégories, lignes) d'une fiche à options, dans le même ordre de lecture que
// le serveur (`variantes_du_produit`) : seulement si `variant` vaut "multi".
export function lignesDeclinaisons(co) {
  const vide = { categories: [], rows: [] };
  if (!estObjet(co)) return vide;
  if (
    String(co.variant || '')
      .trim()
      .toLowerCase() !== 'multi'
  ) {
    return vide;
  }
  const v = co.variants;
  let imbriquees = [];
  let catsImbriquees = [];
  if (estObjet(v)) {
    imbriquees = Array.isArray(v.rows) ? lignes(v.rows) : lignes(v.variants);
    catsImbriquees = Array.isArray(v.categories) ? v.categories : [];
    if (catsImbriquees.length && imbriquees.length) {
      return { categories: catsImbriquees, rows: imbriquees };
    }
  }
  const aPlat = lignes(co.variantRows);
  const catsAPlat = Array.isArray(co.variantCategories) ? co.variantCategories : [];
  if (catsAPlat.length && aPlat.length) return { categories: catsAPlat, rows: aPlat };
  if (Array.isArray(v) && lignes(v).length) return { categories: [], rows: lignes(v) };
  if (imbriquees.length) return { categories: catsImbriquees, rows: imbriquees };
  return { categories: catsAPlat, rows: aPlat };
}

// Stock d'une option, lu comme le serveur : null = non suivi (illimité),
// 0 = épuisée, N = plafond. Quantité en chaîne ou en nombre.
export function stockDeclinaison(row) {
  const q = row ? row.quantity : undefined;
  if (q === undefined || q === null || typeof q === 'boolean') return null;
  const s = String(q).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

// Options affichables d'une fiche : { libelle, options: [{ id, title, stock }] }.
// `undefined` quand la source ne porte aucune information d'options (à
// relire ailleurs) ; options [] pour un produit simple. Une option sans titre
// ne peut pas être montrée ; à titre égal, la première ligne compte (comme la
// fiche et le serveur).
export function optionsDeLaFiche(source) {
  if (!estObjet(source) || !('customizationOptions' in source)) return undefined;
  const co = lireCustomizationOptions(source.customizationOptions);
  const { categories, rows } = lignesDeclinaisons(co);
  const vus = new Set();
  const options = [];
  rows.forEach((r) => {
    const title =
      typeof r.title === 'string' || typeof r.title === 'number' ? String(r.title).trim() : '';
    if (!title || vus.has(title)) return;
    vus.add(title);
    const id = r.id === undefined || r.id === null || r.id === '' ? null : String(r.id);
    options.push({ id, title, stock: stockDeclinaison(r) });
  });
  const libelle = categories
    .filter((c) => typeof c === 'string' && c.trim())
    .map((c) => c.trim())
    .join(' / ');
  return { libelle, options };
}

export const optionEpuisee = (option) => !!option && option.stock === 0;

// Option prise d'office : la seule de la fiche, si elle n'est pas épuisée.
export function optionDOffice(options) {
  if (!Array.isArray(options) || options.length !== 1) return null;
  return optionEpuisee(options[0]) ? null : options[0];
}

// Aucune option choisissable : toutes épuisées.
export function ficheEpuisee(options) {
  return Array.isArray(options) && options.length > 0 && options.every(optionEpuisee);
}

// Quantité ramenée au plafond de l'option (au moins 1). Sans plafond : inchangée.
export function plafonner(qty, stock) {
  const q = Math.max(1, Math.floor(Number(qty) || 1));
  if (stock === null || stock === undefined || !Number.isFinite(Number(stock))) return q;
  return Math.max(1, Math.min(q, Math.floor(Number(stock))));
}

// Option gardée dans l'article de la liste : { id, title } seulement.
export function varianteDeLOption(option) {
  if (!option || !option.title) return null;
  return { id: option.id === undefined ? null : option.id, title: option.title };
}

// Champs de l'article envoyé à create-order : `variant_id` + `variant`.
export function champsVariante(variant) {
  if (!estObjet(variant)) return {};
  const id =
    variant.id === undefined || variant.id === null || variant.id === ''
      ? null
      : String(variant.id);
  const title = typeof variant.title === 'string' ? variant.title : '';
  if (id === null && !title) return {};
  return { ...(id !== null ? { variant_id: id } : {}), variant: { id, title } };
}

// Champ de l'option pour /users/cart/add/ (retrait) : le serveur lit
// `selected_variant` { id, title } ; sans option, rien.
export function champsVariantePanier(variant) {
  const c = champsVariante(variant);
  return c.variant ? { selected_variant: c.variant } : {};
}

// Clé d'une option : son id, sinon son titre ('' sans option).
export function cleVariante(variant) {
  if (!estObjet(variant)) return '';
  if (variant.id !== undefined && variant.id !== null && variant.id !== '')
    return 'id:' + String(variant.id);
  const t = typeof variant.title === 'string' ? variant.title.trim() : '';
  return t ? 't:' + t : '';
}

const entier = (v, defaut) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n : defaut;
};

const productIdDe = (item) => {
  const v = item ? (item.productId ?? item.id ?? null) : null;
  return v === null || v === undefined || v === '' ? null : String(v);
};

function normaliserEntree(e) {
  if (!estObjet(e)) return null;
  const pid = e.product_id === undefined || e.product_id === null ? null : String(e.product_id);
  if (!pid) return null;
  return {
    productId: pid,
    name: typeof e.name === 'string' ? e.name : '',
    requested: entier(e.requested_qty, 0),
    qty: entier(e.qty, 0),
    variant: estObjet(e.variant) ? e.variant : null,
  };
}

// { ajustes, exclus } d'une réponse create-order, ou null si la réponse n'en
// porte aucun (ancienne réponse) ou si les deux listes sont vides.
export function ecartsDeStock(reponse) {
  if (!estObjet(reponse)) return null;
  const ajustes = (Array.isArray(reponse.adjusted_items) ? reponse.adjusted_items : [])
    .map(normaliserEntree)
    .filter((e) => e && e.qty > 0);
  const exclus = (Array.isArray(reponse.excluded_items) ? reponse.excluded_items : [])
    .map(normaliserEntree)
    .filter(Boolean);
  if (!ajustes.length && !exclus.length) return null;
  return { ajustes, exclus };
}

// Applique les écarts aux articles envoyés (même ordre) :
// { commandes, exclus, lignes } où `commandes` = articles gardés (quantité
// ajustée), `exclus` = articles épuisés hors de la commande (inchangés, rien
// n'est perdu), `lignes` = [{ type: 'adjusted' | 'removed', name, variant,
// qty, requested }] pour l'affichage.
export function appliquerEcarts(items, ecarts) {
  const liste = Array.isArray(items) ? items.filter(estObjet) : [];
  if (!ecarts) return { commandes: liste, exclus: [], lignes: [] };
  const ajustes = (ecarts.ajustes || []).map((e) => ({ ...e, pris: false }));
  const exclusSrv = (ecarts.exclus || []).map((e) => ({ ...e, pris: false }));
  const trouver = (pool, pid, cle) =>
    pool.find((e) => !e.pris && e.productId === pid && cleVariante(e.variant) === cle);
  const commandes = [];
  const exclus = [];
  const lignesOut = [];
  liste.forEach((it) => {
    const pid = productIdDe(it);
    if (!pid) {
      commandes.push(it);
      return;
    }
    const cle = cleVariante(it.variant);
    const nom = it.name || it.title || '';
    const variante = estObjet(it.variant) && it.variant.title ? it.variant.title : '';
    const aj = trouver(ajustes, pid, cle);
    if (aj) {
      aj.pris = true;
      const requested = entier(it.qty, 1) || 1;
      commandes.push({ ...it, qty: aj.qty });
      lignesOut.push({
        type: 'adjusted',
        name: nom,
        variant: variante,
        qty: aj.qty,
        requested: aj.requested || requested,
      });
      return;
    }
    const ex = trouver(exclusSrv, pid, cle);
    if (ex) {
      ex.pris = true;
      exclus.push(it);
      lignesOut.push({
        type: 'removed',
        name: nom,
        variant: variante,
        qty: 0,
        requested: ex.requested || entier(it.qty, 1),
      });
      return;
    }
    commandes.push(it);
  });
  return { commandes, exclus, lignes: lignesOut };
}

// Refus 409 de create-order pour cause de stock (« Épuisé » ou « Cet article
// vient d'être vendu. »), sinon null. `err` = erreur levée par deliveryFetch
// (status + body).
export function refusDeStock(err) {
  if (!err || err.status !== 409) return null;
  const body = estObjet(err.body) ? err.body : {};
  if (body.reason !== 'out_of_stock') return null;
  const exclus = (Array.isArray(body.excluded_items) ? body.excluded_items : [])
    .map(normaliserEntree)
    .filter(Boolean);
  const manques = (Array.isArray(body.shortages) ? body.shortages : [])
    .map((s) =>
      estObjet(s) && s.product_id !== undefined && s.product_id !== null
        ? {
            productId: String(s.product_id),
            available: Math.max(0, entier(s.available, 0)),
            variant: estObjet(s.variant) ? s.variant : null,
          }
        : null
    )
    .filter(Boolean);
  return { epuise: body.epuise === true || exclus.length > 0, exclus, manques };
}

// Liste relue après un refus de stock : articles épuisés décochés (gardés dans
// la liste), quantités ramenées à ce qui reste. Ne touche qu'aux articles
// cochés. Retourne { items, selected, noms } (noms = articles concernés).
export function appliquerRefus(items, selected, refus) {
  const liste = Array.isArray(items) ? items : [];
  const sel = { ...(selected || {}) };
  if (!refus) return { items: liste, selected: sel, noms: [] };
  const noms = [];
  const exclus = refus.exclus.map((e) => ({ ...e, pris: false }));
  const out = liste.map((it, i) => {
    if (!sel[i] || !estObjet(it)) return it;
    const pid = productIdDe(it);
    if (!pid) return it;
    const cle = cleVariante(it.variant);
    const ex = exclus.find((e) => !e.pris && e.productId === pid && cleVariante(e.variant) === cle);
    if (ex) {
      ex.pris = true;
      sel[i] = false;
      noms.push(it.name || it.title || '');
      return it;
    }
    const m = refus.manques.find(
      (s) => s.productId === pid && (!s.variant || cleVariante(s.variant) === cle)
    );
    if (m) {
      noms.push(it.name || it.title || '');
      if (m.available <= 0) {
        sel[i] = false;
        return it;
      }
      if (entier(it.qty, 1) > m.available) return { ...it, qty: m.available };
    }
    return it;
  });
  return { items: out, selected: sel, noms: noms.filter(Boolean) };
}
