

export const formatSavedAddress = (a) => {
  if (!a) return '';
  const hb = (a.house_building || '').toString().trim();
  const city = (a.city || '').toString().trim();
  const pincode = (a.pincode || '').toString().trim();
  // Adresses créées par géocodage : house_building contient déjà l'adresse
  // formatée complète (rue, CP, ville, pays). Ré-ajouter road_area_colony /
  // pincode / city / state la duplique (« Meaux » 2×). Si la ligne principale
  // contient déjà ville ET code postal, on l'affiche seule.
  const hbNorm = hb.toLowerCase();
  if (hb && city && pincode && hbNorm.includes(city.toLowerCase()) && hbNorm.includes(pincode.toLowerCase())) {
    return hb;
  }
  return [
    hb,
    a.road_area_colony,
    [pincode, city].filter(Boolean).join(' ').trim(),
    a.state,
  ]
    .map((s) => (s || '').toString().trim())
    .filter(Boolean)
    .join(', ');
};

export const formatAddressContact = (a) =>
  a
    ? [
        [a.first_name, a.last_name].filter(Boolean).join(' ').trim(),
        [a.phone_code, a.phone_number].filter(Boolean).join(' ').trim(),
      ]
        .filter(Boolean)
        .join('  •  ')
    : '';
