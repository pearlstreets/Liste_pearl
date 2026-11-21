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
//  - tablette en portrait : son contenu est rendu par-dessus l'ecran ;
//  - deplie : son contenu est rendu dans la moitie droite (Modal opaque = page)
//    ou par-dessus la moitie qui l'a ouverte (Modal transparente = fenetre de
//    choix). La moitie d'en face reste utilisable.
// La derniere page ouverte est visible, les autres restent montees et cachees
// (comme une pile). Le bouton retour d'Android ferme la derniere ouverte.
// `figer` (paiement) : la fenetre garde, tant qu'elle reste ouverte, le mode
// de son ouverture. Pliage ou depliage en cours de route : elle n'est jamais
// remontee (saisie de carte gardee, aucun paiement relance).
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
  KeyboardAvoidingView,
  Modal as ModalNative,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';

// Grand ecran (plus petit cote >= 600 dp : pliable deplie, tablette Android,
// iPad ; user 20/11/2026 pour les tablettes) :
//  - pliable Android deplie, deux moities (estDeplie) ;
//  - sinon (tablette en portrait ou en paysage, pliable tenu en portrait),
//    l'ecran du telephone sur toute la largeur (estEnColonne), pages et
//    fenetres comprises.
// Tablette (plus petit cote >= MIN_AGRANDI) : tout est affiche ECHELLE fois
// plus gros (boutons, cases, textes ; user 20/11/2026, sans marges grises).
// Exportees pour les tests.
export const LARGEUR_MIN = 600;
export const MIN_AGRANDI = 740;
export const ECHELLE = 1.2;
const grandEcran = (os, width, height) =>
  (os === 'android' || os === 'ios') && Math.min(width, height) >= LARGEUR_MIN;
// Tablette et pliable sont deux choses differentes (user 20/11/2026) : seul
// le pliable Android deplie (ecran presque carre : Galaxy Z Fold, Pixel Fold)
// est coupe en deux ; une tablette (iPad, tablette Android) garde un seul
// ecran sur toute la largeur, en paysage aussi.
export const RAPPORT_MAX_PLIABLE = 1.3;
const pliableDeplie = (os, width, height) =>
  os === 'android' &&
  grandEcran(os, width, height) &&
  width >= height &&
  width / height < RAPPORT_MAX_PLIABLE;
export const estDeplie = (os, width, height) => pliableDeplie(os, width, height);
export const estEnColonne = (os, width, height) =>
  grandEcran(os, width, height) && !pliableDeplie(os, width, height);
export const echelleDe = (os, width, height) =>
  grandEcran(os, width, height) && Math.min(width, height) >= MIN_AGRANDI ? ECHELLE : 1;

// Echelle en cours, lue par le correctif clavier ci-dessous.
let echelleCourante = 1;

// KeyboardAvoidingView compare sa place (en points de l'app, donc agrandis)
// a la position du clavier (en points de l'ecran) : sur un ecran agrandi, la
// position du clavier est ramenee en points de l'app, sinon le champ saisi
// reste sous le clavier.
const hauteurClavierOrigine = KeyboardAvoidingView?.prototype?._relativeKeyboardHeight;
if (hauteurClavierOrigine) {
  KeyboardAvoidingView.prototype._relativeKeyboardHeight = function (clavier) {
    if (echelleCourante === 1 || !clavier) return hauteurClavierOrigine.call(this, clavier);
    return hauteurClavierOrigine.call(this, {
      ...clavier,
      screenX: clavier.screenX / echelleCourante,
      screenY: clavier.screenY / echelleCourante,
      width: clavier.width / echelleCourante,
      height: clavier.height / echelleCourante,
    });
  };
}

// Contenu dessine `echelle` fois plus gros, sur tout l'ecran : il est mis en
// page sur l'ecran divise par `echelle`, puis agrandi.
function Agrandi({ echelle, width, height, children }) {
  if (echelle === 1) return children;
  return (
    <View style={styles.agrandi}>
      <View
        style={{
          width: width / echelle,
          height: height / echelle,
          transform: [{ scale: echelle }],
        }}
      >
        {children}
      </View>
    </View>
  );
}

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
  const colonne = estEnColonne(Platform.OS, width, height);
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
  // `deplie` (pour Modal) : le contenu est rendu ici, pas en Modal native.
  const horsModale = deplie || colonne;
  const valeur = useMemo(() => ({ deplie: horsModale, ...actions }), [horsModale, actions]);

  // Retour Android : ferme le dernier contenu ouvert, comme une Modal.
  const derniers = useRef(ouverts);
  derniers.current = ouverts;
  // Plie, seule une fenetre figee (ouverte deplie) peut rester dans la liste.
  const ecoute = horsModale || ouverts.length > 0;
  useEffect(() => {
    if (!ecoute) return undefined;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => {
      const liste = derniers.current;
      if (!liste.length) return false;
      const haut = liste[liste.length - 1];
      if (haut.onRequestClose) haut.onRequestClose();
      return true;
    });
    return () => abonnement.remove();
  }, [ecoute]);

  const echelle = echelleDe(Platform.OS, width, height);
  echelleCourante = echelle;
  const moitie = Math.floor(width / echelle / 2);
  const pages = horsModale ? ouverts.filter((e) => e.page) : [];
  const pageVisible = pages[pages.length - 1];
  const rendrePages = () =>
    pages.map((p) => (
      <View key={p.id} style={[StyleSheet.absoluteFill, p === pageVisible ? null : styles.cache]}>
        <PageContext.Provider value={p.id}>
          {p.contenu}
          {fenetres(p.id)}
        </PageContext.Provider>
      </View>
    ));
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
  if (colonne) {
    // Portrait : les pages s'empilent par-dessus l'ecran.
    return (
      <HoteContext.Provider value={valeur}>
        <Agrandi echelle={echelle} width={width} height={height}>
          <View style={styles.racine}>
            <View style={[styles.cote, styles.plein]}>
              {children}
              {fenetres(null)}
              {rendrePages()}
            </View>
          </View>
        </Agrandi>
      </HoteContext.Provider>
    );
  }

  return (
    <HoteContext.Provider value={valeur}>
      <Agrandi echelle={echelle} width={width} height={height}>
        <View style={styles.racine}>
          <View style={deplie ? [styles.cote, { width: moitie }] : styles.plein}>
            {children}
            {fenetres(null)}
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
              {rendrePages()}
            </View>
          ) : null}
          {deplie ? (
            <View pointerEvents="none" style={[styles.separation, { left: moitie }]} />
          ) : null}
        </View>
      </Agrandi>
    </HoteContext.Provider>
  );
}

// Remplace la Modal de react-native (memes proprietes). `page` : contenu
// transparent a montrer quand meme comme une page, a droite. `figer` : voir
// en tete du fichier.
export default function Modal({ page, figer, ...props }) {
  const hote = useContext(HoteContext);
  const parent = useContext(PageContext);
  const navigation = useContext(NavigationContext);
  const route = useContext(NavigationRouteContext);
  const id = useRef(null);
  if (id.current === null) {
    compteur += 1;
    id.current = `modale-${compteur}`;
  }
  const visible = props.visible !== false;
  const enMoitieMaintenant = !!(hote && hote.deplie);
  const modeFige = useRef(null);
  if (!figer || !hote || !visible) modeFige.current = null;
  else if (modeFige.current === null) modeFige.current = enMoitieMaintenant;
  const enMoitie = modeFige.current === null ? enMoitieMaintenant : modeFige.current;
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

// Ecran d'avant l'app (choix de la langue) : une colonne au milieu deplie,
// toute la largeur en portrait ; agrandi sur tablette.
export function AuMilieu({ children }) {
  const { width, height } = useWindowDimensions();
  const deplie = estDeplie(Platform.OS, width, height);
  const echelle = echelleDe(Platform.OS, width, height);
  const contenu = deplie ? (
    <View style={styles.milieu}>
      <View style={{ width: Math.floor(width / echelle / 2), backgroundColor: '#fff' }}>
        {children}
      </View>
    </View>
  ) : (
    children
  );
  return (
    <Agrandi echelle={echelle} width={width} height={height}>
      {contenu}
    </Agrandi>
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
  agrandi: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
});
