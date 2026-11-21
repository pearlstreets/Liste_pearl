import React from "react";
import { useTranslation } from "react-i18next";
import { View, Text, TouchableOpacity, StyleSheet, DeviceEventEmitter } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import Modal from "../../components/DeuxEcrans";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { TAILLES } from "../../components/ui/marche";
import { THEME } from "../../components/commun/theme";
import { SEGMENT_COMPARER, SEGMENT_BOUTIQUES } from "../../app/onglets";
import { peekShops, loadShops } from "../../lib/shopsCache";
import { requestOpenShop } from "../../lib/openShop";
import ProductsScreen from "./ProductsScreen";
import ShopsScreen from "./ShopsScreen";
import FavoritesScreen from "./FavoritesScreen";

// Onglet « Acheter » : segment « Comparer ma liste » (ancien onglet Produits) /
// « Boutiques » (ancien onglet Boutiques). Les deux écrans restent montés, seul
// celui du segment choisi est affiché : PRODUCTS_RESET et l'ouverture d'une
// boutique depuis Menus (lib/openShop) continuent d'arriver à l'écran visé.
// Le cœur en haut ouvre les Favoris.

// Demande d'ouverture des Favoris arrivée avant le montage de l'onglet.
let favorisEnAttente = false;
DeviceEventEmitter.addListener('OUVRIR_FAVORIS', () => { favorisEnAttente = true; });

const AcheterScreen = () => {
  const { t } = useTranslation();
  const route = useRoute();
  const demande = route && route.params ? route.params.segment : undefined;
  const nonce = route && route.params ? route.params.n : undefined;
  const [segment, setSegment] = React.useState(demande === SEGMENT_BOUTIQUES ? SEGMENT_BOUTIQUES : SEGMENT_COMPARER);
  const [favVisible, setFavVisible] = React.useState(false);
  // Incrémenté à la fermeture des Favoris : les deux écrans relisent leurs favoris.
  const [favTick, setFavTick] = React.useState(0);

  // navigate('acheter', { segment }) ou ancienne route 'products' / 'shops'.
  React.useEffect(() => {
    if (demande === SEGMENT_COMPARER || demande === SEGMENT_BOUTIQUES) setSegment(demande);
  }, [demande, nonce]);

  const fermerFavoris = () => { setFavVisible(false); setFavTick((n) => n + 1); };

  // Carte d'une boutique favorite : ferme les Favoris, passe sur Boutiques puis
  // ouvre sa fiche une fois la modale fermée (deux modales à la suite sur iOS).
  const ouvrirBoutiqueFavorite = (nom) => {
    fermerFavoris();
    setSegment(SEGMENT_BOUTIQUES);
    setTimeout(() => {
      const trouver = (liste) => (Array.isArray(liste) ? liste : []).find((s) => s && s.name === nom);
      const deja = trouver(peekShops('product_purchase'));
      if (deja) { requestOpenShop(deja); return; }
      loadShops('product_purchase').then((liste) => { const s = trouver(liste); if (s) requestOpenShop(s); }).catch(() => {});
    }, 400);
  };

  // Ligne « Favoris » du Profil (EVT_OUVRIR_FAVORIS) : ouvre les Favoris.
  // L'onglet peut ne pas être monté quand l'évènement part : la demande gardée
  // par l'écouteur du module est aussi prise au montage.
  React.useEffect(() => {
    const ouvrir = () => { favorisEnAttente = false; setFavVisible(true); };
    if (favorisEnAttente) ouvrir();
    const sub = DeviceEventEmitter.addListener('OUVRIR_FAVORIS', ouvrir);
    return () => sub.remove();
  }, []);

  const Bouton = ({ valeur, icone, libelle }) => {
    const on = segment === valeur;
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={() => setSegment(valeur)} style={[styles.segBtn, on && styles.segBtnOn]}
        accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={libelle}>
        <Ionicons name={on ? icone : `${icone}-outline`} size={16} color={on ? THEME.ink : THEME.muted} />
        <Text style={[styles.segTxt, on && styles.segTxtOn]} numberOfLines={1}>{libelle}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.segment}>
          <Bouton valeur={SEGMENT_COMPARER} icone="pricetags" libelle={t('acheter.comparer')} />
          <Bouton valeur={SEGMENT_BOUTIQUES} icone="storefront" libelle={t('tabs.shops')} />
        </View>
        <TouchableOpacity onPress={() => setFavVisible(true)} style={styles.favBtn}
          accessibilityRole="button" accessibilityLabel={t('tabs.favorites')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="heart-outline" size={20} color={THEME.ink} />
        </TouchableOpacity>
      </View>
      <View style={[styles.pane, segment !== SEGMENT_COMPARER && styles.cache]}>
        <ProductsScreen integre actif={segment === SEGMENT_COMPARER} favTick={favTick} />
      </View>
      <View style={[styles.pane, segment !== SEGMENT_BOUTIQUES && styles.cache]}>
        <ShopsScreen integre actif={segment === SEGMENT_BOUTIQUES} favTick={favTick} />
      </View>
      {favVisible ? (
        <Modal visible animationType="slide" onRequestClose={fermerFavoris}>
          <FavoritesScreen onClose={fermerFavoris} onOpenShop={ouvrirBoutiqueFavorite} />
        </Modal>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: TAILLES.marge, paddingTop: 8, paddingBottom: 4 },
  segment: { flex: 1, flexDirection: 'row', backgroundColor: THEME.subtle, borderRadius: TAILLES.rayonCarte, padding: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: TAILLES.boutonPetit, borderRadius: 12, paddingHorizontal: 6 },
  segBtnOn: { backgroundColor: THEME.card, ...THEME.shadowSm, borderWidth: 1, borderColor: THEME.border },
  segTxt: { fontSize: 13.5, fontWeight: '700', color: THEME.muted, marginLeft: 6, flexShrink: 1 },
  segTxtOn: { color: THEME.ink },
  favBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  pane: { flex: 1 },
  cache: { display: 'none' },
});

export default AcheterScreen;
