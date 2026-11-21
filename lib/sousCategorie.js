import i18nApi from '../i18n';

// Sous-categorie d'un produit dans la langue de l'app (le serveur la donne en
// anglais, ex. « Art galleries ») ; traduction par son slug, sinon le nom recu.
export const sousCategorie = (p) => {
  if (!p) return '';
  const nom = p.subcategory || '';
  return p.subcategorySlug ? i18nApi.t(`subcategories.${p.subcategorySlug}`, { defaultValue: nom }) : nom;
};
