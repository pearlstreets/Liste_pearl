// Outils de grammaire française pour composer les noms et les étapes des
// recettes : articles (le, la, l', les), partitifs (de, d') et contractions
// (au, à la, à l', aux). Chaque ingrédient déclare son genre et son nombre.

// Mots commençant par un h aspiré : pas d'élision (« de haricots »).
const H_ASPIRE = /^(haricot|hachis|hareng|homard|houmous)/i;

function elide(mot) {
  return /^[aeiouyàâéèêëîïôöûüœh]/i.test(mot) && !H_ASPIRE.test(mot);
}

// genre : 'm' ou 'f' ; nombre : 's' ou 'p'
function formes(nom, genre, nombre) {
  const e = elide(nom);
  const pluriel = nombre === 'p';
  return {
    le: pluriel ? `les ${nom}` : e ? `l'${nom}` : genre === 'f' ? `la ${nom}` : `le ${nom}`,
    de: e ? `d'${nom}` : `de ${nom}`,
    au: pluriel ? `aux ${nom}` : e ? `à l'${nom}` : genre === 'f' ? `à la ${nom}` : `au ${nom}`,
    du: pluriel ? `des ${nom}` : e ? `de l'${nom}` : genre === 'f' ? `de la ${nom}` : `du ${nom}`,
  };
}

// « de X » devant un nom de plat : « Gratin de courgettes », « Soupe d'épinards ».
function de(nom) {
  return elide(nom) ? `d'${nom}` : `de ${nom}`;
}

function majuscule(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Liste lisible : « a », « a et b », « a, b et c ».
function enumere(mots) {
  if (mots.length <= 1) return mots.join('');
  return `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1]}`;
}

module.exports = { elide, formes, de, majuscule, enumere };
