// Adresse affichee : le serveur repete parfois la ville
// (« 69003 Lyon Lyon France »). Retire un mot identique a celui qui le precede
// (casse et ponctuation ignorees).
export function sansMotRepete(adresse) {
  if (!adresse || typeof adresse !== 'string') return adresse || '';
  const cle = (m) => m.replace(/[,;.]+$/g, '').toLocaleLowerCase();
  const sortie = [];
  adresse.split(/\s+/).filter(Boolean).forEach((mot) => {
    const precedent = sortie[sortie.length - 1];
    if (precedent && cle(precedent) === cle(mot) && !/^\d+$/.test(cle(mot))) {
      // Garde la ponctuation du dernier (« Lyon Lyon, France » -> « Lyon, France »).
      sortie[sortie.length - 1] = precedent.replace(/[,;.]+$/g, '') + (mot.match(/[,;.]+$/) || [''])[0];
      return;
    }
    sortie.push(mot);
  });
  return sortie.join(' ');
}
