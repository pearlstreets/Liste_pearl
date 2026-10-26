// Ecran deplie d'un pliable Android : l'app se presente comme deux telephones
// cote a cote (user 26/10/2026, meme principe que l'app Pearl Streets).
//
// Gauche : l'ecran de navigation (onglets Ma liste, Produits, Boutiques,
// Panier, Profil) et ses fenetres de choix. Droite : la page ouverte depuis la
// gauche (boutique, produits d'une boutique, suivi de commande, favoris,
// connexion, reglages du profil...). Rien d'ouvert : logo de l'app en gris.
//
// Dans App.js, les pages sont des <Modal> plein ecran. Sous Android une Modal
// est une fenetre a part, qui couvre tout l'ecran et retient tous les
// touchers : impossible de la poser sur une moitie. Ce fichier exporte donc un
// Modal de remplacement :
//  - plie, telephone, iPhone : la Modal de react-native, inchangee ;
//  - deplie : son contenu est rendu dans la moitie droite (Modal opaque = page)
//    ou par-dessus la moitie qui l'a ouverte (Modal transparente = fenetre de
//    choix). La moitie d'en face reste utilisable.
// La derniere page ouverte est visible, les autres restent montees et cachees
// (comme une pile). Le bouton retour d'Android ferme la derniere ouverte.
//
// Chaque moitie garde le design du telephone : App.js ne lit aucune taille
// d'ecran (tout est en flex et en tailles fixes), une moitie de ~420 dp se
// remplit donc comme un telephone. Le mode suit la taille de la fenetre : rien
// a recharger au pliage.
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Image,
  Modal as ModalNative,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';

// Deplie : Android, grand ecran (plus petit cote >= 600 dp) tenu en paysage.
// Exportee pour les tests.
export const LARGEUR_MIN = 600;
export const estDeplie = (os, width, height) =>
  os === 'android' && Math.min(width, height) >= LARGEUR_MIN && width >= height;

const HoteContext = createContext(null);
// Page (moitie droite) dans laquelle un contenu est rendu.
const PageContext = createContext(null);

const COULEUR_SEPARATION = '#E5E7EB';
const FOND_REPOS = '#F7F7F5';
const TEINTE_LOGO = '#C4C7CC';

let compteur = 0;

export function DeuxEcrans({ children }) {
  const { width, height } = useWindowDimensions();
  const deplie = estDeplie(Platform.OS, width, height);
  // Contenus ouverts, dans l'ordre d'ouverture.
  const [ouverts, setOuverts] = useState([]);

  const actions = useMemo(
    () => ({
      poser: (entree) =>
        setOuverts((liste) => {
          const i = liste.findIndex((e) => e.id === entree.id);
          if (i === -1) return [...liste, entree];
          const copie = liste.slice();
          copie[i] = entree;
          return copie;
        }),
      retirer: (id) =>
        setOuverts((liste) =>
          liste.some((e) => e.id === id) ? liste.filter((e) => e.id !== id) : liste
        ),
    }),
    []
  );
  const valeur = useMemo(() => ({ deplie, ...actions }), [deplie, actions]);

  // Retour Android : ferme le dernier contenu ouvert, comme une Modal.
  const derniers = useRef(ouverts);
  derniers.current = ouverts;
  useEffect(() => {
    if (!deplie) return undefined;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => {
      const liste = derniers.current;
      if (!liste.length) return false;
      const haut = liste[liste.length - 1];
      if (haut.onRequestClose) haut.onRequestClose();
      return true;
    });
    return () => abonnement.remove();
  }, [deplie]);

  const moitie = Math.floor(width / 2);
  const pages = deplie ? ouverts.filter((e) => e.page) : [];
  const pageVisible = pages[pages.length - 1];
  const fenetres = (parent) =>
    ouverts
      .filter((e) => !e.page && e.parent === parent)
      .map((e) => (
        <View key={e.id} style={StyleSheet.absoluteFill}>
          {e.contenu}
        </View>
      ));

  // L'app reste au meme endroit de l'arbre plie ou deplie : rien n'est
  // remonte au pliage.
  return (
    <HoteContext.Provider value={valeur}>
      <View style={styles.racine}>
        <View style={deplie ? [styles.cote, { width: moitie }] : styles.plein}>
          {children}
          {deplie ? fenetres(null) : null}
        </View>
        {deplie ? (
          <View style={[styles.cote, styles.droite]}>
            {!pageVisible ? (
              <View style={[StyleSheet.absoluteFill, styles.repos]}>
                <Image
                  source={require('../assets/logo-repos.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            ) : null}
            {pages.map((p) => (
              <View
                key={p.id}
                style={[StyleSheet.absoluteFill, p === pageVisible ? null : styles.cache]}
              >
                <PageContext.Provider value={p.id}>
                  {p.contenu}
                  {fenetres(p.id)}
                </PageContext.Provider>
              </View>
            ))}
          </View>
        ) : null}
        {deplie ? (
          <View pointerEvents="none" style={[styles.separation, { left: moitie }]} />
        ) : null}
      </View>
    </HoteContext.Provider>
  );
}

// Remplace la Modal de react-native (memes proprietes). `page` : contenu
// transparent a montrer quand meme comme une page, a droite.
export default function Modal({ page, ...props }) {
  const hote = useContext(HoteContext);
  const parent = useContext(PageContext);
  const navigation = useContext(NavigationContext);
  const route = useContext(NavigationRouteContext);
  const id = useRef(null);
  if (id.current === null) {
    compteur += 1;
    id.current = `modale-${compteur}`;
  }
  const enMoitie = !!(hote && hote.deplie);
  const visible = props.visible !== false;
  const estPage = !!page || !props.transparent;

  // A chaque rendu : le contenu suit l'etat de l'ecran qui l'a ouvert.
  useLayoutEffect(() => {
    if (!hote) return;
    if (!enMoitie || !visible) {
      hote.retirer(id.current);
      return;
    }
    hote.poser({
      id: id.current,
      page: estPage,
      parent: estPage ? null : parent,
      onRequestClose: props.onRequestClose,
      // Rendu ailleurs dans l'arbre : la navigation de l'ecran d'origine suit.
      contenu: (
        <NavigationContext.Provider value={navigation}>
          <NavigationRouteContext.Provider value={route}>
            {props.children}
          </NavigationRouteContext.Provider>
        </NavigationContext.Provider>
      ),
    });
  });
  // Ecran d'origine demonte : son contenu disparait aussi.
  const hoteActuel = useRef(hote);
  hoteActuel.current = hote;
  useEffect(
    () => () => {
      if (hoteActuel.current) hoteActuel.current.retirer(id.current);
    },
    []
  );
  const onShow = props.onShow;
  useEffect(() => {
    if (enMoitie && visible && onShow) onShow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enMoitie, visible]);

  if (enMoitie) return null;
  return <ModalNative {...props} />;
}

// Ecran d'avant l'app (choix de la langue) : une colonne au milieu, deplie.
export function AuMilieu({ children }) {
  const { width, height } = useWindowDimensions();
  if (!estDeplie(Platform.OS, width, height)) return children;
  return (
    <View style={styles.milieu}>
      <View style={{ width: Math.floor(width / 2), flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, flexDirection: 'row', backgroundColor: '#fff' },
  plein: { flex: 1 },
  cote: { overflow: 'hidden' },
  droite: { flex: 1 },
  cache: { display: 'none' },
  repos: { backgroundColor: FOND_REPOS, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 120, height: 164, tintColor: TEINTE_LOGO },
  separation: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: COULEUR_SEPARATION,
  },
  milieu: { flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#fff' },
});
