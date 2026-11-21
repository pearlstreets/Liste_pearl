import React from "react";
import { logoutUser, deleteAccount as apiDeleteAccount, updatePassword as apiUpdatePassword, getDocumentStatus, clearLocalUserData } from "../../services/auth";
import { getProfile as apiGetProfile, updateProfile as apiUpdateProfile, uploadProfilePhoto } from "../../services/profile";
import { fetchAddresses, createAddress, updateAddress, deleteAddressById, makeAddressDefault } from "../../services/addresses";
import { getSecureItem, setSecureItem } from "../../services/secureStorage";
import { isDriverMode, getDriverEarnings, canDeliver, getDriverCountry } from "../../services/delivery";
import PaymentMethodsModal from "../../components/PaymentMethodsModal";
import { definirOngletApresRechargement } from '../../i18n';
import { useTranslation } from 'react-i18next';
import { DeviceEventEmitter } from 'react-native';
import Modal from '../../components/DeuxEcrans';
import * as Location from 'expo-location';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { loadListItems } from "../../lib/listStore";
import { flushMenusSync } from "../../services/menusSync";
import * as ImagePicker from 'expo-image-picker';
import { MARCHE } from "../../components/ui/marche";
import { CURRENCIES } from "../../data/currencies";
import { PASSWORD_RE } from "../auth/validation";
import { BRAND, THEME } from "../../components/commun/theme";
import { lstyles } from "../../components/commun/lstyles";
import { useCurrency } from "../../components/commun/devise";
import { KEY_LISTS, DEFAULT_LIST_ID, KEY_PROFILE, KEY_AUTH, KEY_ORDER_HISTORY, LANGUAGES } from "../../lib/constants";
import { fetchPhotonSuggestions } from "../../lib/photon";
import { formatSavedAddress } from "../cart/adresses";
import { profStyles } from "./profStyles";
import LegalLinks from "./LegalLinks";
import { useDemandesPartage } from "../list/DemandesPartage";

// Le Profil ne garde que le compte. Les commandes vivent dans Panier > Mes
// commandes, les favoris dans Acheter, les demandes de partage dans Ma Liste :
// les lignes du Profil ouvrent l'onglet puis émettent l'évènement d'ouverture.
export const EVT_OUVRIR_MES_COMMANDES = 'OUVRIR_MES_COMMANDES';
export const EVT_OUVRIR_FAVORIS = 'OUVRIR_FAVORIS';
export const EVT_OUVRIR_DEMANDES_PARTAGE = 'OUVRIR_DEMANDES_PARTAGE';
// Émis par un autre écran (Panier par exemple) pour ouvrir le gestionnaire d'adresses.
export const EVT_OUVRIR_ADRESSES = 'OUVRIR_ADRESSES';

const EMPTY_ADDR_FORM = {
  first_name: '', last_name: '', phone_code: '+33', phone_number: '',
  house_building: '', road_area_colony: '', pincode: '', city: '',
  state: '', address_type: 'home', countryFlag: 'FR', lat: null, lang: null,
};

export default function FakeProfileScreen({ onLogout, isAuth }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const navigation = useNavigation();
  const [profile, setProfile] = React.useState({ nom: '', prenom: '', pseudo: '', photo: null });
  const [editVisible, setEditVisible] = React.useState(false);
  const [editNom, setEditNom] = React.useState('');
  const [editPrenom, setEditPrenom] = React.useState('');
  const [editPseudo, setEditPseudo] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [showPwdChange, setShowPwdChange] = React.useState(false);
  // Suppression du compte en cours : bloque un second envoi pendant l'appel.
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const deletingAccountRef = React.useRef(false);
  const loggingOutRef = React.useRef(false);
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [pwdError, setPwdError] = React.useState('');
  const [pwdSuccess, setPwdSuccess] = React.useState('');
  // Nombre de commandes de l'appareil : seul usage restant ici, la couleur de
  // l'anneau de l'avatar (bleu tant qu'aucune commande).
  const [nbCommandes, setNbCommandes] = React.useState(0);
  const loadOrders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
      const list = raw ? JSON.parse(raw) : [];
      setNbCommandes(Array.isArray(list) ? list.length : 0);
    } catch (e) {}
  }, []);
  const [langVisible, setLangVisible] = React.useState(false);
  const [pendingLang, setPendingLang] = React.useState(null);
  const [currencyVisible, setCurrencyVisible] = React.useState(false);
  const [pendingCurrency, setPendingCurrency] = React.useState(null);
  const [paymentMethodsVisible, setPaymentMethodsVisible] = React.useState(false); // section Moyens de paiement (cartes)
  // Partage de listes : seul le nombre de demandes reçues reste ici (pastille).
  const { shareRequests, loadShareData } = useDemandesPartage(t);
  const [addressListVisible, setAddressListVisible] = React.useState(false);
  const [addresses, setAddresses] = React.useState([]);
  const [addressLoading, setAddressLoading] = React.useState(false);
  const [addressFormVisible, setAddressFormVisible] = React.useState(false);
  const [editingAddressId, setEditingAddressId] = React.useState(null);
  const [addrForm, setAddrForm] = React.useState(EMPTY_ADDR_FORM);
  const [addrPhotonSuggestions, setAddrPhotonSuggestions] = React.useState([]);
  const addrPhotonDebounce = React.useRef(null);
  const [addrSaving, setAddrSaving] = React.useState(false);
  const [geoLoading, setGeoLoading] = React.useState(false);
  const [driverInfoVisible, setDriverInfoVisible] = React.useState(false);
  const [docStatuses, setDocStatuses] = React.useState(null);
  const [driverMode, setDriverMode] = React.useState(false);
  const [driverCountry, setDriverCountryState] = React.useState('FR');
  const [driverEarnings, setDriverEarnings] = React.useState({ total_year: 0, remaining: 3000, limit: 3000 });
  const [driverBlocked, setDriverBlocked] = React.useState(false);

  const loadProfile = React.useCallback(async () => {
    try {
      // Try to fetch from Marketplace API first
      const apiProfile = await apiGetProfile();
      if (apiProfile && apiProfile.id) {
        setProfile(apiProfile);
        return;
      }
    } catch(e) {}
    // Fallback to local storage
    try {
      const raw = await getSecureItem(KEY_PROFILE);
      if (raw) setProfile(JSON.parse(raw));
    } catch(e) {}
  }, []);
  const loadAddresses = React.useCallback(async () => {
    setAddressLoading(true);
    try {
      const list = await fetchAddresses();
      setAddresses(Array.isArray(list) ? list : []);
    } catch(e) {}
    setAddressLoading(false);
  }, []);

  // Ouvre un onglet puis l'écran demandé dans cet onglet. L'évènement part un
  // peu après la navigation : un onglet jamais ouvert doit d'abord se monter et
  // brancher son écouteur.
  const allerVers = React.useCallback((onglet, evenement) => {
    try { navigation.navigate(onglet); } catch (e) {}
    setTimeout(() => DeviceEventEmitter.emit(evenement), 350);
  }, [navigation]);

  // Gestionnaire d'adresses demandé depuis un autre écran. iOS n'empile pas
  // deux Modal : une autre fenêtre du Profil est fermée d'abord. Invité : la
  // page de connexion (les adresses sont rattachées au compte).
  const autreModaleOuverte = React.useRef(false);
  autreModaleOuverte.current = driverInfoVisible || editVisible || langVisible || currencyVisible || paymentMethodsVisible;
  const addressListVisibleRef = React.useRef(false);
  addressListVisibleRef.current = addressListVisible;
  const isAuthRef = React.useRef(isAuth);
  isAuthRef.current = isAuth;
  // Seul le Panier émet cet évènement (« Ajouter une adresse ») : le formulaire
  // s'ouvre directement, et la nouvelle adresse enregistrée ramène au Panier.
  const depuisPanierRef = React.useRef(false);
  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener(EVT_OUVRIR_ADRESSES, () => {
      if (!isAuthRef.current) { DeviceEventEmitter.emit('OPEN_AUTH'); return; }
      depuisPanierRef.current = true;
      const ouvrirFormulaire = () => {
        setEditingAddressId(null);
        setAddrForm(EMPTY_ADDR_FORM);
        setAddressFormVisible(true);
        loadAddresses();
      };
      if (autreModaleOuverte.current || addressListVisibleRef.current) {
        setDriverInfoVisible(false); setEditVisible(false); setLangVisible(false);
        setCurrencyVisible(false); setPaymentMethodsVisible(false); setAddressListVisible(false);
        setTimeout(ouvrirFormulaire, 300);
      } else {
        ouvrirFormulaire();
      }
    });
    return () => sub.remove();
  }, [loadAddresses]);
  // Formulaire refermé sans nouvelle adresse : on reste dans le Profil.
  React.useEffect(() => {
    if (!addressFormVisible) depuisPanierRef.current = false;
  }, [addressFormVisible]);

  useFocusEffect(React.useCallback(() => {
    loadProfile(); loadOrders(); loadAddresses(); loadShareData();
    // Load driver mode status for regular users
    (async () => {
      try {
        const dm = await isDriverMode();
        setDriverMode(dm);
        const cc = await getDriverCountry();
        setDriverCountryState(cc);
        if (dm) {
          const earnings = await getDriverEarnings();
          setDriverEarnings(earnings);
          const ok = await canDeliver();
          setDriverBlocked(!ok);
        }
      } catch(e) {}
    })();
    // Load document verification status for pro users
    (async () => {
      try {
        const authRaw = await getSecureItem(KEY_AUTH);
        const auth = authRaw ? JSON.parse(authRaw) : {};
        if (auth.role === 'professionaluser') {
          const data = await getDocumentStatus();
          if (data && data.status && data.document_status) {
            setDocStatuses(data.document_status);
            // Update isVerified in profile
            if (data.document_status.is_verified) {
              const profRaw = await getSecureItem(KEY_PROFILE);
              const prof = profRaw ? JSON.parse(profRaw) : {};
              if (!prof.isVerified) {
                prof.isVerified = true;
                await setSecureItem(KEY_PROFILE, JSON.stringify(prof));
                setProfile(prof);
              }
            }
          }
        }
      } catch(e) {}
    })();
  }, [loadProfile, loadOrders, loadAddresses, loadShareData]));

  React.useEffect(() => {
    if (isAuth) { loadProfile(); loadOrders(); }
  }, [isAuth, loadProfile, loadOrders]);

  const saveProfile = async () => {
    const updated = { ...profile, nom: editNom.trim(), prenom: editPrenom.trim(), pseudo: editPseudo.trim(), email: editEmail.trim() };
    // Try to update on Marketplace backend first
    try {
      const res = await apiUpdateProfile({
        prenom: editPrenom.trim(),
        nom: editNom.trim(),
        pseudo: editPseudo.trim(),
        email: editEmail.trim(),
      });
      // Refus du serveur (compte connecté) : on le dit et on garde la fenêtre
      // ouverte, sans enregistrer localement ce qui n'a pas été accepté.
      if (isAuth && res && res.success === false && res.message) {
        Alert.alert(t('profile.editProfile'), res.message);
        return;
      }
    } catch(e) {}
    setProfile(updated);
    await setSecureItem(KEY_PROFILE, JSON.stringify(updated));
    setEditVisible(false);
  };

  const setAF = (k, v) => setAddrForm(f => ({ ...f, [k]: v }));

  // Autocomplétion d'adresse (Photon) dans le formulaire du profil — même
  // comportement que l'inscription : on tape la rue, on choisit, tout se remplit.
  const onAddrStreetChange = (v) => {
    setAF('house_building', v);
    if (addrPhotonDebounce.current) clearTimeout(addrPhotonDebounce.current);
    const q = (v || '').trim();
    if (q.length < 3) { setAddrPhotonSuggestions([]); return; }
    const cc = (addrForm.countryFlag || 'FR').toUpperCase();
    addrPhotonDebounce.current = setTimeout(async () => {
      setAddrPhotonSuggestions(await fetchPhotonSuggestions(q, cc, i18nInstance.language));
    }, 300);
  };
  const pickProfileAddress = (s) => {
    if (addrPhotonDebounce.current) clearTimeout(addrPhotonDebounce.current);
    setAddrForm(f => ({
      ...f,
      house_building: s.address || s.label,
      pincode: s.postcode || f.pincode,
      city: s.city || f.city,
      lat: s.lat ?? f.lat,
      lang: s.lng ?? f.lang,
    }));
    setAddrPhotonSuggestions([]);
  };

  const openAddressList = () => { setAddressListVisible(true); loadAddresses(); };

  const openAddAddress = () => {
    setEditingAddressId(null);
    setAddrForm(EMPTY_ADDR_FORM);
    setAddressFormVisible(true);
  };

  const openEditAddress = (item) => {
    setEditingAddressId(item.id);
    setAddrForm({
      first_name: item.first_name || '', last_name: item.last_name || '',
      phone_code: item.phone_code || '+33', phone_number: item.phone_number || '',
      house_building: item.house_building || '', road_area_colony: item.road_area_colony || '',
      pincode: item.pincode || '', city: item.city || '', state: item.state || '',
      address_type: item.address_type === 'work' ? 'work' : 'home',
      countryFlag: item.countryFlag || 'FR',
      lat: item.lat ?? null, lang: item.lang ?? null,
    });
    setAddressFormVisible(true);
  };

  const submitAddress = async () => {
    if (!addrForm.first_name.trim() || !addrForm.house_building.trim() || !addrForm.city.trim()) {
      Alert.alert(t('profile.deliveryAddress'), t('profile.pwdErrorEmpty'));
      return;
    }
    setAddrSaving(true);
    try {
      const payload = {
        first_name: addrForm.first_name.trim(),
        last_name: addrForm.last_name.trim(),
        phone_code: (addrForm.phone_code || '').trim() || '+33',
        phone_number: addrForm.phone_number.trim(),
        house_building: addrForm.house_building.trim(),
        road_area_colony: addrForm.road_area_colony.trim(),
        pincode: addrForm.pincode.trim(),
        city: addrForm.city.trim(),
        state: addrForm.state.trim(),
        address_type: addrForm.address_type,
        countryFlag: addrForm.countryFlag || 'FR',
        lat: addrForm.lat, lang: addrForm.lang,
      };
      if (editingAddressId) await updateAddress(editingAddressId, payload);
      else await createAddress(payload);
      await loadAddresses();
      const retourPanier = !editingAddressId && depuisPanierRef.current;
      depuisPanierRef.current = false;
      setAddressFormVisible(false);
      if (retourPanier) { try { navigation.navigate('cart'); } catch {} }
    } catch (e) {
      Alert.alert(t('profile.deliveryAddress'), t('profile.addrSaveError', 'Could not save the address.'));
    }
    setAddrSaving(false);
  };

  const confirmDeleteAddress = (id) => {
    Alert.alert(
      t('profile.deliveryAddress'),
      t('profile.addrDeleteConfirm', 'Delete this address?'),
      [
        { text: t('profile.cancel'), style: 'cancel' },
        { text: t('profile.delete', 'Delete'), style: 'destructive', onPress: async () => {
          try { await deleteAddressById(id); await loadAddresses(); } catch (e) {}
        } },
      ]
    );
  };

  const selectDefaultAddress = async (id) => {
    setAddresses(prev => prev.map(a => ({ ...a, is_default: a.id === id })));
    try { await makeAddressDefault(id); } catch (e) {}
    loadAddresses();
  };

  const addressGeo = async () => {
    try {
      setGeoLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGeoLoading(false);
        Alert.alert(t('profile.locationDenied'), t('profile.locationDeniedMsg'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const results = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const r = results && results[0];
      if (r) {
        setAddrForm(f => ({
          ...f,
          house_building: ((r.streetNumber || '') + ' ' + (r.street || r.name || '')).trim() || f.house_building,
          road_area_colony: r.district || r.subregion || f.road_area_colony,
          city: r.city || r.region || f.city,
          pincode: r.postalCode || f.pincode,
          state: r.region || f.state,
          countryFlag: r.isoCountryCode || f.countryFlag,
          lat: loc.coords.latitude, lang: loc.coords.longitude,
        }));
      } else {
        Alert.alert(t('profile.deliveryAddress'), t('profile.locationError'));
      }
      setGeoLoading(false);
    } catch (e) {
      setGeoLoading(false);
      Alert.alert(t('profile.deliveryAddress'), t('profile.locationError'));
    }
  };

  const defaultAddress = addresses.find(a => a.is_default) || addresses[0] || null;
  // Repli : si le carnet d'adresses est vide, on affiche l'adresse donnée à
  // l'inscription (stockée sur le profil) plutôt que « Non définie ».
  const registrationAddress = React.useMemo(() => {
    const a = (profile && (profile.manualAddress || profile.automatic_address)) || null;
    if (!a) return '';
    return [a.address1, a.address2, a.postalCode, a.city].filter(Boolean).join(', ');
  }, [profile]);

  const handleChangePassword = async () => {
    setPwdError(''); setPwdSuccess('');
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) { setPwdError(t('profile.pwdErrorEmpty')); return; }
    if (newPassword !== confirmPassword) { setPwdError(t('profile.pwdErrorMismatch')); return; }
    if (!PASSWORD_RE.test(newPassword.trim())) { setPwdError(t('auth.errorPasswordRule')); return; }
    try {
      // Uniquement par le serveur Marketplace : aucun mot de passe n'est
      // gardé ni comparé en local.
      const apiResult = await apiUpdatePassword(oldPassword, newPassword);
      if (apiResult && apiResult.status) {
        setPwdSuccess(t('profile.pwdSuccess'));
        setOldPassword(''); setNewPassword(''); setConfirmPassword('');
        setTimeout(() => { setShowPwdChange(false); setPwdSuccess(''); }, 1500);
        return;
      }
      const oldWrong = !!(apiResult && apiResult.errors && apiResult.errors.old_password);
      setPwdError(oldWrong ? t('profile.pwdErrorOld') : t('profile.pwdErrorGeneral'));
    } catch(e) { setPwdError(t('profile.pwdErrorGeneral')); }
  };

  const pickPhoto = async () => {
    // Android : sélecteur de photos du système, aucune permission (règle Google Play
    // sur READ_MEDIA_IMAGES, bloquée dans app.json). iOS : autorisation demandée.
    if (Platform.OS !== 'android') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('profile.photoPermissionTitle'), t('profile.photoPermissionMsg'));
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      const updated = { ...profile, photo: uri };
      setProfile(updated);
      await setSecureItem(KEY_PROFILE, JSON.stringify(updated));
      // Sync photo with Marketplace backend
      try { await uploadProfilePhoto(uri); } catch(e) {}
    }
  };

  const initials = (profile.prenom || profile.nom || '').trim().charAt(0).toUpperCase();
  // Avatar ring reflects the user's status — a new user (no orders yet) gets a blue ring.
  const statusRingColor = (nbCommandes === 0) ? '#3B82F6' : BRAND;

  const OrderSteps = ({ mode }) => {
    const isCollect = mode === 'collect';
    const steps = isCollect ? [
      { icon: "checkmark-circle", label: t('orderStatus.confirmed') },
      { icon: "storefront", label: t('orderStatus.preparingDone') },
      { icon: "bag-handle", label: t('orderStatus.ready') },
      { icon: "walk", label: t('orderStatus.pickedUp') },
      { icon: "checkmark-done", label: t('orderStatus.collected') },
    ] : [
      { icon: "checkmark-circle", label: t('orderStatus.confirmed') },
      { icon: "storefront", label: t('orderStatus.preparingDone') },
      { icon: "bicycle", label: t('orderStatus.onTheWay') },
      { icon: "location", label: t('orderStatus.almostThere') },
      { icon: "home", label: t('orderStatus.delivered') },
    ];
    return (
      <View style={{ marginBottom:10 }}>
        {steps.map((step, i) => (
          <View key={i} style={{ flexDirection:'row', alignItems:'center', marginBottom:6 }}>
            <View style={{ width:24, height:24, borderRadius:12, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor:THEME.card, alignItems:'center', justifyContent:'center' }}>
              <Ionicons name={step.icon} size={12} color={THEME.ink} />
            </View>
            {i < steps.length - 1 && (
              <View style={{ position:'absolute', left:11, top:24, width:2, height:6, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor:THEME.card }} />
            )}
            <Text style={{ fontSize:12, fontWeight:'600', color:THEME.ink, marginLeft:8 }}>{step.label}</Text>
            <Ionicons name="checkmark" size={14} color={THEME.terra} style={{ marginLeft:6 }} />
          </View>
        ))}
      </View>
    );
  };

  // UN SEUL arbre pour l'invité et le compte connecté : l'invité voit en haut
  // « Se connecter / Créer un compte », puis les sections utilisables sans compte.
  return (
    <SafeAreaView style={profStyles.screen} edges={['top']}>
      <View style={profStyles.header}>
        <Text style={profStyles.title}>{t('tabs.profile')}</Text>
        {isAuth ? <Text style={profStyles.subtitle}>{(profile.prenom || '') + ' ' + (profile.nom || '')}</Text> : null}
      </View>
      {isAuth && paymentMethodsVisible ? (
        <PaymentMethodsModal visible={paymentMethodsVisible} t={t} onClose={() => setPaymentMethodsVisible(false)} />
      ) : null}
      <ScrollView contentContainerStyle={{ paddingBottom:28 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!isAuth ? (
          <>
          {/* Hero connexion — design soigné */}
          <View style={profStyles.guestHero}>
            <View style={profStyles.guestHeroIcon}>
              <Ionicons name="person-circle-outline" size={54} color="#1C1917" />
            </View>
            <Text style={profStyles.guestHeroTitle}>{t('profile.guestTitle', 'Vous n\'êtes pas connecté')}</Text>
            <Text style={profStyles.guestHeroHint}>{t('profile.guestHint', 'Connectez-vous pour gérer votre profil, vos commandes et la livraison.')}</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={() => DeviceEventEmitter.emit('OPEN_AUTH')} style={profStyles.guestHeroBtn}>
              <Ionicons name="log-in-outline" size={20} color={MARCHE.blanc} />
              <Text style={profStyles.guestHeroBtnTxt}>{t('auth.loginBtn', 'Se connecter')}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={() => DeviceEventEmitter.emit('OPEN_AUTH', { signup: true })} style={profStyles.guestHeroBtnAlt}>
              <Ionicons name="person-add-outline" size={19} color="#1C1917" />
              <Text style={profStyles.guestHeroBtnAltTxt}>{t('auth.signupBtn', 'Créer un compte')}</Text>
            </TouchableOpacity>
          </View>
          </>
        ) : (
          <>
          {/* Profile Card */}
          <View style={profStyles.profileCard}>
            <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={profStyles.avatarWrap}>
              <View style={[profStyles.avatar, { borderColor: statusRingColor }]}>
                {profile.photo && (/^(https?:|data:|file:|content:)/i.test(profile.photo) || profile.photo.startsWith('/')) ? (
                  <Image source={{ uri: profile.photo }} style={profStyles.avatarImg} />
                ) : (
                  <Text style={profStyles.avatarInitials}>{initials || '👤'}</Text>
                )}
              </View>
              <View style={profStyles.avatarBadge}>
                <Ionicons name="camera" size={14} color="#1C1917" />
              </View>
            </TouchableOpacity>
            <Text style={profStyles.profileName}>{(profile.prenom || '') + ' ' + (profile.nom || '')}</Text>
            {profile.pseudo ? <Text style={profStyles.profileHandle}>@{profile.pseudo}</Text> : null}

            <TouchableOpacity activeOpacity={0.85} onPress={() => { setEditNom(profile.nom); setEditPrenom(profile.prenom); setEditPseudo(profile.pseudo||''); setEditEmail(profile.email||''); setShowPwdChange(false); setPwdError(''); setPwdSuccess(''); setEditVisible(true); }} style={profStyles.editBtn}>
              <Ionicons name="create-outline" size={16} color={THEME.brandDark} />
              <Text style={profStyles.editBtnTxt}>{t('profile.editProfile')}</Text>
            </TouchableOpacity>
          </View>

          {/* Document Verification Status (Pro users) */}
          {profile.role === 'professionaluser' && (
            <View style={profStyles.section}>
              <View style={profStyles.sectionHeadRow}>
                <Text style={profStyles.sectionTitle}>{t('profile.verificationStatus', 'Statut de vérification')}</Text>
              </View>
              {!profile.isVerified && (
                <View style={[profStyles.banner, profStyles.bannerWarn]}>
                  <Ionicons name="time-outline" size={20} color="#B45309" />
                  <Text style={[profStyles.bannerTxt, { color:'#92400E' }]}>{t('profile.verificationPending', 'Votre compte est en cours de vérification par notre équipe.')}</Text>
                </View>
              )}
              {profile.isVerified && (
                <View style={[profStyles.banner, profStyles.bannerOk]}>
                  <Ionicons name="checkmark-circle" size={20} color={THEME.brandDark} />
                  <Text style={[profStyles.bannerTxt, { color:THEME.brandDark }]}>{t('profile.verificationApproved', 'Compte vérifié')}</Text>
                </View>
              )}
              {docStatuses && (
                <View style={profStyles.docCard}>
                  {[
                    { key: 'kbiss_status', label: t('auth.docKbiss', 'Kbis') },
                    { key: 'iban_status', label: t('auth.docIban', 'IBAN / RIB') },
                    { key: 'identityCardFront_status', label: t('auth.docIdFront', 'Carte d\'identité (recto)') },
                    { key: 'identityCardBack_status', label: t('auth.docIdBack', 'Carte d\'identité (verso)') },
                    { key: 'proofOfAddress_status', label: t('auth.docProofAddress', 'Justificatif de domicile') },
                  ].map((doc, i) => {
                    const status = docStatuses[doc.key] || 'pending';
                    const icon = status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time-outline';
                    const color = status === 'approved' ? THEME.brand : status === 'rejected' ? THEME.danger : '#F59E0B';
                    const tint = status === 'approved' ? THEME.brandSoft : status === 'rejected' ? THEME.dangerSoft : '#FEF3C7';
                    const label = status === 'approved' ? (t('profile.docApproved', 'Approuvé')) : status === 'rejected' ? (t('profile.docRejected', 'Rejeté')) : (t('profile.docPending', 'En attente'));
                    return (
                      <View key={i} style={[profStyles.docRow, i < 4 && profStyles.docDivider]}>
                        <View style={[profStyles.docIcon, { backgroundColor: tint }]}>
                          <Ionicons name={icon} size={17} color={color} />
                        </View>
                        <Text style={profStyles.docLabel}>{doc.label}</Text>
                        <View style={[profStyles.docStatusPill, { backgroundColor: tint }]}>
                          <Text style={[profStyles.docStatusTxt, { color }]}>{label}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
          </>
        )}

        {/* Commandes, favoris, partage : ouverts dans leur onglet */}
        <View style={profStyles.section}>
          <View style={profStyles.settingsCard}>
            {/* Mes commandes : ouvertes dans Panier (compte connecté seulement, comme avant) */}
            {isAuth ? (
            <TouchableOpacity activeOpacity={0.8} onPress={() => allerVers('cart', EVT_OUVRIR_MES_COMMANDES)} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="receipt-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.myOrders', 'Mes commandes')}</Text>
                <Text style={profStyles.settingValue}>{t('profile.myOrdersHint', 'Suivez et retrouvez vos commandes')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>
            ) : null}
            {/* Favoris : onglet Acheter (accessibles SANS connexion, stockés localement) */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => allerVers('acheter', EVT_OUVRIR_FAVORIS)} style={[profStyles.settingRow, isAuth && profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="heart-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('tabs.favorites')}</Text>
                <Text style={profStyles.settingValue}>{t('favorites.manageHint', 'Vos boutiques et produits favoris')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>
            {isAuth ? (
              <>
                {/* Demandes de partage de liste */}
                <TouchableOpacity activeOpacity={0.8} onPress={() => allerVers('myList', EVT_OUVRIR_DEMANDES_PARTAGE)} style={profStyles.settingRow}>
                  <View style={profStyles.settingIcon}>
                    <Ionicons name="git-network-outline" size={19} color="#1C1917" />
                  </View>
                  <View style={profStyles.settingBody}>
                    <Text style={profStyles.settingLabel}>{t('profile.listShares', 'Partage de listes')}</Text>
                    <Text style={profStyles.settingValue}>{shareRequests.length > 0 ? t('counts.pendingRequests', { count: shareRequests.length }) : (t('profile.manageShares', 'Demandes reçues · utilisateurs bloqués'))}</Text>
                  </View>
                  {shareRequests.length > 0 && (
                    <View style={{ backgroundColor: THEME.danger, borderRadius:11, minWidth:22, height:22, alignItems:'center', justifyContent:'center', paddingHorizontal:6, marginRight:6 }}>
                      <Text style={{ color:'#fff', fontWeight:'800', fontSize:12 }}>{shareRequests.length}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>

        {/* Compte : adresse, moyens de paiement */}
        {isAuth ? (
          <View style={profStyles.section}>
            <View style={profStyles.settingsCard}>
            {/* Address */}
            <TouchableOpacity activeOpacity={0.8} onPress={openAddressList} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="location-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.deliveryAddress')}</Text>
                <Text style={profStyles.settingValue} numberOfLines={1}>
                  {defaultAddress ? formatSavedAddress(defaultAddress) : (registrationAddress || t('profile.noAddress'))}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>
            {/* Moyens de paiement (cartes enregistrées) */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setPaymentMethodsVisible(true)} style={profStyles.settingRow}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="card-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('cart.paymentMethods', 'Moyens de paiement')}</Text>
                <Text style={profStyles.settingValue}>{t('cart.paymentMethodsHint', 'Vos cartes pour payer')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Préférences : accessibles SANS connexion */}
        <View style={profStyles.section}>
          <Text style={profStyles.guestPrefTitle}>{t('profile.preferences', 'Préférences')}</Text>
          <View style={profStyles.settingsCard}>
            {/* Language */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setLangVisible(true)} style={[profStyles.settingRow, profStyles.settingDivider]}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="language-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.language')}</Text>
                <Text style={profStyles.settingValue}>
                  {LANGUAGES.find(l => l.code === i18nInstance.language)?.flag || '🌐'} {({'fr':'Français','en':'English','es':'Español','zh':'中文','ar':'العربية','de':'Deutsch','nl':'Nederlands','it':'Italiano','pt':'Português','ja':'日本語','th':'ไทย','sv':'Svenska','ru':'Русский'})[i18nInstance.language] || i18nInstance.language}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>
            {/* Currency */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setCurrencyVisible(true)} style={profStyles.settingRow}>
              <View style={profStyles.settingIcon}>
                <Ionicons name="cash-outline" size={19} color="#1C1917" />
              </View>
              <View style={profStyles.settingBody}>
                <Text style={profStyles.settingLabel}>{t('profile.currency')}</Text>
                <Text style={profStyles.settingValue}>{currency.flag} {currency.code}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={THEME.faint} />
            </TouchableOpacity>
          </View>
        </View>

        <LegalLinks />

        {isAuth ? (
          <>
            {/* Become a driver */}
            <View style={profStyles.section}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setDriverInfoVisible(true)} style={profStyles.driverCard}>
                <View style={profStyles.driverIcon}>
                  <Ionicons name="bicycle" size={22} color="#1C1917" />
                </View>
                <View style={profStyles.driverBody}>
                  <Text style={profStyles.driverTitle}>{t('profile.becomeDriver', 'Devenir livreur')}</Text>
                  <Text style={profStyles.driverSub}>{t('profile.driverSubtitle', 'Livrez et gagnez un complément de revenu')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={THEME.faint} />
              </TouchableOpacity>
            </View>

            {/* Logout */}
            <View style={[profStyles.section, { marginBottom: 8 }]}>
              <TouchableOpacity activeOpacity={0.85} onPress={async () => {
                // Les listes nommées n'ont aucune copie sur le compte : prévenir
                // seulement si elles contiennent des articles.
                let listesPerdues = [];
                try {
                  const reg = JSON.parse((await AsyncStorage.getItem(KEY_LISTS)) || '[]');
                  for (const l of (Array.isArray(reg) ? reg : [])) {
                    if (!l || !l.id || l.id === DEFAULT_LIST_ID) continue;
                    const r = await loadListItems(l.id, DEFAULT_LIST_ID);
                    const nom = String(l.name || '').trim();
                    if (nom && r.ok && r.items.length > 0) listesPerdues.push(nom);
                  }
                } catch (e) { listesPerdues = []; }
                const msgDeconnexion = listesPerdues.length
                  ? t('profile.logoutConfirm') + '\n\n' + t('profile.logoutListsLost', { names: listesPerdues.join(', ') })
                  : t('profile.logoutConfirm');
                Alert.alert(t('profile.logoutTitle'), msgDeconnexion, [
                  { text: t('profile.cancel'), style: 'cancel' },
                  { text: t('profile.logoutAction'), style: 'destructive', onPress: async () => {
                    if (loggingOutRef.current) return;
                    loggingOutRef.current = true;
                    // Les menus en attente partent d'abord (jetons encore valables) ; s'ils n'ont pas pu
                    // partir (hors ligne, trop volumineux, délai), rien n'est effacé sans votre accord.
                    let menusOk = false;
                    try { menusOk = await flushMenusSync(); } catch (e) { menusOk = false; }
                    const terminer = async () => {
                      // Logout from Marketplace API first (needs tokens)
                      try { await logoutUser({ menusFlushed: true }); } catch(e) {}
                      // Effacer TOUTES les données du compte gardées sur l'appareil
                      // (jetons, profil, listes, panier, favoris, commandes).
                      try {
                        await clearLocalUserData({ menusFlushed: true });
                        DeviceEventEmitter.emit('USER_DATA_CLEARED');
                        DeviceEventEmitter.emit('CART_COUNT_CHANGED');
                      } catch(e) {}
                      loggingOutRef.current = false;
                      if (onLogout) onLogout();
                    };
                    if (menusOk) { await terminer(); return; }
                    Alert.alert(
                      t('profile.menusUnsavedTitle', 'Menus non sauvegardés'),
                      t('profile.menusUnsavedMsg', "Vos menus n'ont pas pu être sauvegardés sur votre compte. Les effacer de cet appareil ?"),
                      [
                        { text: t('profile.cancel', 'Annuler'), style: 'cancel', onPress: () => { loggingOutRef.current = false; } },
                        { text: t('profile.menusUnsavedErase', 'Effacer et me déconnecter'), style: 'destructive', onPress: terminer },
                      ],
                      { cancelable: false }
                    );
                  }}
                ]);
              }} style={profStyles.logoutBtn}>
                <Ionicons name="log-out-outline" size={20} color={THEME.danger} />
                <Text style={profStyles.logoutTxt}>{t('profile.logout')}</Text>
              </TouchableOpacity>
            </View>

            {/* Supprimer le compte (obligatoire App Store 5.1.1(v)) */}
            <View style={[profStyles.section, { marginBottom: 24 }]}>
              <TouchableOpacity activeOpacity={0.85} disabled={deletingAccount} onPress={() => {
                if (deletingAccountRef.current) return;
                Alert.alert(
                  t('profile.deleteAccountTitle', 'Supprimer mon compte'),
                  t('profile.deleteAccountConfirm', "Attention : votre compte est un compte Pearl Streets partagé. Le supprimer ici le supprime aussi sur l'app et le site Marketplace Pearl Streets (commandes, favoris, fidélité). Vos données sont conservées le temps requis par la loi puis effacées. Vous pouvez restaurer votre compte pendant 30 jours ; ensuite, la suppression est définitive."),
                  [
                    { text: t('profile.cancel', 'Annuler'), style: 'cancel' },
                    { text: t('profile.deleteAccountAction', 'Supprimer'), style: 'destructive', onPress: async () => {
                      if (deletingAccountRef.current) return;
                      deletingAccountRef.current = true;
                      setDeletingAccount(true);
                      let res;
                      try { res = await apiDeleteAccount(); } catch (e) { res = { success: false }; }
                      deletingAccountRef.current = false;
                      setDeletingAccount(false);
                      if (!res || !res.success) {
                        Alert.alert(
                          t('profile.deleteAccountErrTitle', 'Suppression impossible'),
                          t('profile.deleteAccountErr', 'La suppression du compte a échoué. Vérifiez votre connexion et réessayez.')
                        );
                        return;
                      }
                      // Effacer toutes les données locales (comme à la déconnexion)
                      try {
                        await clearLocalUserData();
                        DeviceEventEmitter.emit('USER_DATA_CLEARED');
                        DeviceEventEmitter.emit('CART_COUNT_CHANGED');
                      } catch (e) {}
                      Alert.alert(
                        t('profile.deleteAccountDoneTitle', 'Compte supprimé'),
                        t('profile.deleteAccountDone', 'Votre compte a bien été supprimé.')
                      );
                      if (onLogout) onLogout();
                    }},
                  ]
                );
              }} style={profStyles.deleteAccountBtn}>
                {deletingAccount
                  ? <ActivityIndicator size="small" color={THEME.danger} />
                  : <Ionicons name="trash-outline" size={18} color={THEME.danger} />}
                <Text style={profStyles.deleteAccountTxt}>{t('profile.deleteAccount', 'Supprimer mon compte')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Driver Info Full Page Modal */}
      <Modal onRequestClose={() => setDriverInfoVisible(false)} visible={driverInfoVisible} animationType="slide">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setDriverInfoVisible(false)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.becomeDriver', 'Devenir livreur')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:40 }} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={profStyles.driverHero}>
              <View style={profStyles.driverHeroIcon}>
                <Ionicons name="bicycle" size={36} color="#1C1917" />
              </View>
              <Text style={profStyles.driverHeroTitle}>Pearl Delivery</Text>
              <Text style={profStyles.driverHeroSub}>
                {t('profile.driverInfoDesc', 'Gagnez un complément de revenu en livrant des commandes dans votre ville.')}
              </Text>
            </View>

            {/* Two types */}
            <View style={profStyles.sectionHeadRow}>
              <Text style={profStyles.sectionTitle}>{t('profile.driverTypes', 'Deux façons de livrer')}</Text>
            </View>

            <View style={profStyles.driverTypeCard}>
              <View style={profStyles.driverTypeHead}>
                <View style={profStyles.driverTypeIcon}>
                  <Ionicons name="bicycle" size={19} color={THEME.brand} />
                </View>
                <Text style={profStyles.driverTypeTitle}>{t('profile.driverParticulier', 'Livreur Particulier')}</Text>
              </View>
              <Text style={profStyles.driverTypeTxt}>
                {t('profile.driverParticulierInfo', 'Aucun statut professionnel requis. Livrez quand vous voulez en complément de revenu, dans la limite du plafond annuel de votre pays.')}
              </Text>
            </View>

            <View style={[profStyles.driverTypeCard, { marginBottom: 18 }]}>
              <View style={profStyles.driverTypeHead}>
                <View style={profStyles.driverTypeIcon}>
                  <Ionicons name="storefront" size={19} color={THEME.brand} />
                </View>
                <Text style={profStyles.driverTypeTitle}>{t('profile.driverPro', 'Livreur Pro')}</Text>
              </View>
              <Text style={profStyles.driverTypeTxt}>
                {t('profile.driverProInfo', 'Vous avez un statut professionnel (auto-entrepreneur, société). Pas de limite de revenus. Documents requis : carte d\'identité, IBAN, Kbis.')}
              </Text>
            </View>

            {/* Country limits */}
            <View style={profStyles.sectionHeadRow}>
              <Text style={profStyles.sectionTitle}>{t('profile.driverLimits', 'Plafonds par pays (particuliers)')}</Text>
            </View>

            {[
              { flag: '🇫🇷', name: t('countries.FR', 'France'), limit: t('profile.perYear', { amount: '3 000 €', defaultValue: '3 000 €/an' }), status: 'ok', info: t('profile.limitMicroBic', 'Micro-BIC, abattement 50%') },
              { flag: '🇧🇪', name: t('countries.BE', 'Belgique'), limit: t('profile.perYear', { amount: '7 700 €', defaultValue: '7 700 €/an' }), status: 'ok', info: t('profile.limitFixedRate', 'Taux fixe 10,7%') },
              { flag: '🇬🇧', name: t('countries.GB', 'Royaume-Uni'), limit: t('profile.perYear', { amount: '1 000 £', defaultValue: '1 000 £/an' }), status: 'ok', info: t('profile.limitTradingAllowance', 'Trading Allowance') },
              { flag: '🇩🇪', name: t('countries.DE', 'Allemagne'), limit: '-', status: 'gray', info: t('profile.limitNoFramework', 'Pas de cadre spécifique') },
              { flag: '🇮🇹', name: t('countries.IT', 'Italie'), limit: '-', status: 'gray', info: t('profile.limitNoFramework', 'Pas de cadre spécifique') },
              { flag: '🇪🇸', name: t('countries.ES', 'Espagne'), limit: '-', status: 'blocked', info: t('profile.limitEmployeeRequired', 'Statut salarié obligatoire') },
              { flag: '🇨🇭', name: t('countries.CH', 'Suisse'), limit: '-', status: 'blocked', info: t('profile.limitEmployeeSince2023', 'Statut salarié depuis 2023') },
              { flag: '🇳🇱', name: t('countries.NL', 'Pays-Bas'), limit: '-', status: 'strict', info: t('profile.limitRequalification', 'Risque de requalification') },
              { flag: '🇵🇹', name: t('countries.PT', 'Portugal'), limit: '-', status: 'gray', info: t('profile.limitNoFramework', 'Pas de cadre spécifique') },
            ].map((c, i) => {
              const limitColor = c.status === 'ok' ? THEME.brand : c.status === 'blocked' ? THEME.danger : '#F59E0B';
              return (
              <View key={i} style={profStyles.limitRow}>
                <Text style={profStyles.limitFlag}>{c.flag}</Text>
                <View style={{ flex:1 }}>
                  <Text style={profStyles.limitName}>{c.name}</Text>
                  <Text style={profStyles.limitInfo}>{c.info}</Text>
                </View>
                <View style={{ alignItems:'flex-end' }}>
                  <Text style={[profStyles.limitValue, { color: limitColor }]}>{c.limit}</Text>
                  <Ionicons name={c.status === 'ok' ? 'checkmark-circle' : c.status === 'blocked' ? 'close-circle' : 'alert-circle'} size={14} color={limitColor} style={{marginTop:2}} />
                </View>
              </View>
              );
            })}

            {/* CTA */}
            <View style={{ marginTop:18 }}>
              <TouchableOpacity activeOpacity={0.85} onPress={async () => {
                const { Linking, Platform } = require('react-native');
                try {
                  const canOpen = await Linking.canOpenURL('pearl-delivery://');
                  if (canOpen) {
                    setDriverInfoVisible(false);
                    Linking.openURL('pearl-delivery://');
                  } else {
                    throw new Error('not installed');
                  }
                } catch(e) {
                  // App not installed — redirect to store
                  Alert.alert(
                    'Pearl Delivery',
                    t('profile.downloadDeliveryApp') || "L'app Pearl Delivery n'est pas installée. Téléchargez-la pour devenir livreur.",
                    [
                      { text: t('profile.cancel', 'Annuler'), style: 'cancel' },
                      { text: 'App Store', onPress: () => Linking.openURL('https://apps.apple.com/app/pearl-delivery/id6749835609') },
                      Platform.OS === 'android' ? { text: 'Google Play', onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.pearlstreets.delivery') } : null,
                    ].filter(Boolean)
                  );
                }
              }} style={profStyles.primaryBtn}>
                <Ionicons name="bicycle" size={22} color="#1C1917" />
                <Text style={profStyles.primaryBtnTxt}>{t('profile.openDeliveryApp') || "Ouvrir l'app Pearl Delivery"}</Text>
              </TouchableOpacity>
              <Text style={profStyles.legalNote}>
                {t('profile.driverLegalNote') || "L'inscription se fait directement dans l'app Pearl Delivery. Vous pouvez choisir entre livreur particulier ou professionnel."}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Profile Full Page Modal */}
      <Modal onRequestClose={() => setEditVisible(false)} visible={editVisible} animationType="slide">
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={profStyles.modalHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={profStyles.modalBack}>
                <Ionicons name="arrow-back" size={20} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={profStyles.modalTitle}>{t('profile.editProfile')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.pseudo')}</Text>
                <TextInput value={editPseudo} onChangeText={setEditPseudo} placeholder={t('profile.pseudoPlaceholder')}
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.firstName')}</Text>
                <TextInput value={editPrenom} onChangeText={setEditPrenom} placeholder={t('profile.firstNamePlaceholder')}
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.lastName')}</Text>
                <TextInput value={editNom} onChangeText={setEditNom} placeholder={t('profile.lastNamePlaceholder')}
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.email')}</Text>
                <TextInput value={editEmail} onChangeText={setEditEmail} placeholder={t('profile.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none"
                  placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              {/* Password change section */}
              {!showPwdChange ? (
                <TouchableOpacity activeOpacity={0.8} onPress={() => { setShowPwdChange(true); setPwdError(''); setPwdSuccess(''); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  style={profStyles.pwdToggle}>
                  <View style={profStyles.settingIcon}>
                    <Ionicons name="lock-closed-outline" size={18} color="#1C1917" />
                  </View>
                  <Text style={profStyles.pwdToggleTxt}>{t('profile.changePassword')}</Text>
                  <Ionicons name="chevron-forward" size={18} color={THEME.faint} />
                </TouchableOpacity>
              ) : (
                <View style={profStyles.pwdPanel}>
                  <View style={profStyles.pwdPanelHead}>
                    <Ionicons name="lock-closed-outline" size={18} color={THEME.brand} />
                    <Text style={profStyles.pwdPanelTitle}>{t('profile.changePassword')}</Text>
                    <TouchableOpacity onPress={() => setShowPwdChange(false)} style={profStyles.closeBtn}>
                      <Ionicons name="close" size={18} color={THEME.muted} />
                    </TouchableOpacity>
                  </View>

                  {pwdError ? (
                    <View style={[profStyles.pwdAlert, { backgroundColor: THEME.dangerSoft }]}>
                      <Ionicons name="alert-circle" size={16} color={THEME.danger} />
                      <Text style={[profStyles.pwdAlertTxt, { color: THEME.danger }]}>{pwdError}</Text>
                    </View>
                  ) : null}
                  {pwdSuccess ? (
                    <View style={[profStyles.pwdAlert, { backgroundColor: THEME.brandSoft }]}>
                      <Ionicons name="checkmark-circle" size={16} color={THEME.brandDark} />
                      <Text style={[profStyles.pwdAlertTxt, { color: THEME.brandDark }]}>{pwdSuccess}</Text>
                    </View>
                  ) : null}

                  <View style={profStyles.fieldGroup}>
                    <Text style={profStyles.fieldLabel}>{t('profile.oldPassword')}</Text>
                    <TextInput value={oldPassword} onChangeText={setOldPassword} placeholder={t('profile.currentPasswordPlaceholder')} secureTextEntry
                      placeholderTextColor={THEME.faint} style={profStyles.field} />
                  </View>

                  <View style={profStyles.fieldGroup}>
                    <Text style={profStyles.fieldLabel}>{t('profile.newPassword')}</Text>
                    <TextInput value={newPassword} onChangeText={setNewPassword} placeholder={t('profile.newPassword')} secureTextEntry
                      placeholderTextColor={THEME.faint} style={profStyles.field} />
                    <Text numberOfLines={2} style={{ fontSize: 12, color: THEME.faint, marginTop: 6, lineHeight: 17 }}>{t('auth.passwordRuleHint')}</Text>
                  </View>

                  <View style={[profStyles.fieldGroup, { marginBottom: 4 }]}>
                    <Text style={profStyles.fieldLabel}>{t('profile.confirmPassword')}</Text>
                    <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('profile.confirmPassword')} secureTextEntry
                      placeholderTextColor={THEME.faint} style={profStyles.field} />
                  </View>

                  <TouchableOpacity activeOpacity={0.85} onPress={handleChangePassword} style={[profStyles.primaryBtn, { marginTop: 12 }]}>
                    <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.validate')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={profStyles.btnRow}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setEditVisible(false)} style={[profStyles.cancelBtn, { flex: 1 }]}>
                  <Text style={profStyles.cancelBtnTxt}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={saveProfile} style={profStyles.saveBtn}>
                  <Text style={profStyles.saveBtnTxt}>{t('profile.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Language Selector Full Page Modal */}
      <Modal onRequestClose={() => { setPendingLang(null); setLangVisible(false); }} visible={langVisible} animationType="slide" onShow={() => setPendingLang(null)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => { setPendingLang(null); setLangVisible(false); }} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.language')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:24 }} showsVerticalScrollIndicator={false}>
            {LANGUAGES.map(lang => {
              const currentLang = i18nInstance.language || 'fr';
              const isActive = currentLang === lang.code || currentLang.startsWith(lang.code);
              const isSelected = pendingLang === lang.code || (!pendingLang && isActive);
              return (
                <TouchableOpacity key={lang.code} activeOpacity={0.8} onPress={() => setPendingLang(lang.code)} style={[profStyles.pickerRow, isSelected && profStyles.pickerRowOn]}>
                  <Text style={profStyles.pickerFlag}>{lang.flag}</Text>
                  <Text style={[profStyles.pickerName, isSelected && profStyles.pickerNameOn, { flex:1 }]}>{lang.label}</Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={THEME.brand} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Confirm button */}
          <SafeAreaView style={{ backgroundColor: THEME.bg }} edges={[]}>
            <View style={profStyles.sheetFooter}>
              <TouchableOpacity activeOpacity={0.85} onPress={async () => {
                const lang = pendingLang || i18nInstance.language;
                definirOngletApresRechargement('profile');
                i18nInstance.changeLanguage(lang);
                await AsyncStorage.setItem('APP_LANGUAGE', lang);
                setPendingLang(null);
                setLangVisible(false);
              }} style={[profStyles.primaryBtn, !pendingLang && profStyles.primaryBtnDisabled]}>
                <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Modal>

      {/* Currency Selector Full Page Modal */}
      <Modal onRequestClose={() => { setPendingCurrency(null); setCurrencyVisible(false); }} visible={currencyVisible} animationType="slide" onShow={() => setPendingCurrency(null)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => { setPendingCurrency(null); setCurrencyVisible(false); }} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.currency')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal:20, paddingTop:10, paddingBottom:24 }} showsVerticalScrollIndicator={false}>
            {CURRENCIES.map(curr => {
              const isSelected = pendingCurrency === curr.code || (!pendingCurrency && currency.code === curr.code);
              return (
                <TouchableOpacity key={curr.code} activeOpacity={0.8} onPress={() => {
                  const found = CURRENCIES.find(c => c.code === curr.code);
                  if (found) setCurrency(found);
                  setPendingCurrency(null);
                  setCurrencyVisible(false);
                }} style={[profStyles.pickerRow, isSelected && profStyles.pickerRowOn]}>
                  <Text style={profStyles.pickerFlag}>{curr.flag}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={[profStyles.pickerName, isSelected && profStyles.pickerNameOn]}>{t(`currencies.${curr.code}`, curr.name)}</Text>
                    <Text style={profStyles.pickerSub}>{curr.code}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={THEME.brand} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {/* Confirm button */}
          <SafeAreaView style={{ backgroundColor: THEME.bg }} edges={[]}>
            <View style={profStyles.sheetFooter}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => {
                const code = pendingCurrency || currency.code;
                const found = CURRENCIES.find(c => c.code === code);
                if (found) setCurrency(found);
                setPendingCurrency(null);
                setCurrencyVisible(false);
              }} style={[profStyles.primaryBtn, !pendingCurrency && profStyles.primaryBtnDisabled]}>
                <Text style={[profStyles.primaryBtnTxt, { marginLeft: 0 }]}>{t('profile.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Modal>

      {/* Delivery Address — saved addresses list */}
      <Modal visible={addressListVisible} animationType="slide" onRequestClose={() => setAddressListVisible(false)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <View style={profStyles.modalHeader}>
            <TouchableOpacity onPress={() => setAddressListVisible(false)} style={profStyles.modalBack}>
              <Ionicons name="arrow-back" size={20} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={profStyles.modalTitle}>{t('profile.deliveryAddress')}</Text>
          </View>
          {addressLoading && addresses.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={THEME.brand} size="large" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={profStyles.addrSectionTitle}>{t('profile.addrSelect', 'Select delivery address')}</Text>
              {addresses.length === 0 ? (
                <View style={profStyles.addrEmpty}>
                  <View style={profStyles.addrEmptyIcon}>
                    <Ionicons name="location-outline" size={26} color="#1C1917" />
                  </View>
                  <Text style={profStyles.addrEmptyTxt}>{t('profile.addrEmpty', 'No saved address yet')}</Text>
                </View>
              ) : addresses.map((item) => {
                const isDef = !!item.is_default;
                const isWork = item.address_type === 'work';
                const fullAddr = formatSavedAddress(item);
                const who = [item.first_name, item.last_name].filter(Boolean).join(' ');
                const phone = [item.phone_code, item.phone_number].filter(Boolean).join(' ');
                return (
                  <TouchableOpacity key={String(item.id)} activeOpacity={0.85} onPress={() => !isDef && selectDefaultAddress(item.id)} style={[profStyles.addrCard, isDef && profStyles.addrCardOn]}>
                    <View style={profStyles.addrCardHead}>
                      <View style={profStyles.addrTypeIcon}>
                        <Ionicons name={isWork ? 'briefcase' : 'home'} size={14} color="#1C1917" />
                      </View>
                      <Text style={profStyles.addrType}>{isWork ? t('profile.addrWork', 'Work') : t('profile.addrHome', 'Home')}</Text>
                      {isDef && (
                        <View style={profStyles.addrBadge}>
                          <Text style={profStyles.addrBadgeTxt}>{t('profile.addrDefault', 'Default')}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }} />
                      {isDef && (
                        <View style={profStyles.addrCheck}>
                          <Ionicons name="checkmark" size={15} color="#1C1917" />
                        </View>
                      )}
                    </View>
                    {!!(who || phone) && (
                      <Text style={profStyles.addrName} numberOfLines={1}>{[who, phone].filter(Boolean).join('  •  ')}</Text>
                    )}
                    <Text style={profStyles.addrText}>{fullAddr}</Text>
                    <View style={profStyles.addrDivider} />
                    <View style={profStyles.addrActions}>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => openEditAddress(item)} style={profStyles.addrAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="create-outline" size={17} color={THEME.ink} />
                        <Text style={profStyles.addrActionTxt}>{t('profile.edit', 'Edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => confirmDeleteAddress(item.id)} style={profStyles.addrAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={17} color={THEME.danger} />
                        <Text style={[profStyles.addrActionTxt, { color: THEME.danger }]}>{t('profile.delete', 'Delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          <View style={profStyles.addrFooter}>
            <TouchableOpacity activeOpacity={0.9} onPress={openAddAddress} style={profStyles.primaryBtn}>
              <Ionicons name="add" size={20} color="#1C1917" />
              <Text style={profStyles.primaryBtnTxt}>{t('profile.addrAdd', 'Add New Address')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Delivery Address — add / edit form */}
      <Modal visible={addressFormVisible} animationType="slide" onRequestClose={() => setAddressFormVisible(false)}>
        <SafeAreaView style={profStyles.modalScreen} edges={[]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={profStyles.modalHeader}>
              <TouchableOpacity onPress={() => setAddressFormVisible(false)} style={profStyles.modalBack}>
                <Ionicons name="arrow-back" size={20} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={profStyles.modalTitle}>{editingAddressId ? t('profile.addrEditTitle', 'Edit Address') : t('profile.addrAdd', 'Add New Address')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TouchableOpacity activeOpacity={0.85} onPress={addressGeo} disabled={geoLoading} style={[profStyles.geoBtn, geoLoading && { backgroundColor: THEME.subtle }]}>
                {geoLoading ? (
                  <ActivityIndicator color={THEME.brand} />
                ) : (
                  <Ionicons name="navigate" size={19} color={THEME.brandDark} />
                )}
                <Text style={profStyles.geoBtnTxt}>{geoLoading ? t('profile.locating') : t('profile.useMyLocation')}</Text>
              </TouchableOpacity>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.addrType', 'Address type')}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {[['home', 'home', t('profile.addrHome', 'Home')], ['work', 'briefcase', t('profile.addrWork', 'Work')]].map(([key, icon, label]) => {
                    const on = addrForm.address_type === key;
                    return (
                      <TouchableOpacity key={key} activeOpacity={0.8} onPress={() => setAF('address_type', key)} style={[profStyles.addrTypeBtn, on && profStyles.addrTypeBtnOn]}>
                        <Ionicons name={on ? icon : icon + '-outline'} size={17} color={on ? MARCHE.blanc : THEME.muted} />
                        <Text style={[profStyles.addrTypeBtnTxt, on && profStyles.addrTypeBtnTxtOn]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={profStyles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.firstName')}</Text>
                  <TextInput value={addrForm.first_name} onChangeText={(v) => setAF('first_name', v)} placeholder={t('profile.firstNamePlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.lastName')}</Text>
                  <TextInput value={addrForm.last_name} onChangeText={(v) => setAF('last_name', v)} placeholder={t('profile.lastNamePlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.addrPhone', 'Phone')}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TextInput value={addrForm.phone_code} onChangeText={(v) => setAF('phone_code', v)} placeholder="+33" placeholderTextColor={THEME.faint} keyboardType="phone-pad" style={[profStyles.field, { width: 88 }]} />
                  <TextInput value={addrForm.phone_number} onChangeText={(v) => setAF('phone_number', v)} placeholder="6 12 34 56 78" placeholderTextColor={THEME.faint} keyboardType="phone-pad" style={[profStyles.field, { flex: 1 }]} />
                </View>
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.street')}</Text>
                <TextInput value={addrForm.house_building} onChangeText={onAddrStreetChange} placeholder={t('auth.addressAutoPlaceholder', 'Commencez à taper votre adresse…')} placeholderTextColor={THEME.faint} autoCorrect={false} style={profStyles.field} />
                {addrPhotonSuggestions.length > 0 && (
                  <View style={lstyles.suggestBox}>
                    {addrPhotonSuggestions.map((s, i) => (
                      <TouchableOpacity key={i} onPress={() => pickProfileAddress(s)} activeOpacity={0.7}
                        style={[lstyles.suggestRow, i < addrPhotonSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: THEME.border }]}>
                        <Ionicons name="location-outline" size={16} color={THEME.brandDark} style={{ marginRight: 8 }} />
                        <Text style={{ flex: 1, fontSize: 13.5, color: THEME.ink }} numberOfLines={2}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={profStyles.fieldGroup}>
                <Text style={profStyles.fieldLabel}>{t('profile.addressSupplement')}</Text>
                <TextInput value={addrForm.road_area_colony} onChangeText={(v) => setAF('road_area_colony', v)} placeholder={t('profile.supplementPlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.postalCode')}</Text>
                  <TextInput value={addrForm.pincode} onChangeText={(v) => setAF('pincode', v)} placeholder={t('profile.postalCodePlaceholder')} keyboardType="number-pad" placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={profStyles.fieldLabel}>{t('profile.city')}</Text>
                  <TextInput value={addrForm.city} onChangeText={(v) => setAF('city', v)} placeholder={t('profile.cityPlaceholder')} placeholderTextColor={THEME.faint} style={profStyles.field} />
                </View>
              </View>

              <View style={[profStyles.fieldGroup, { marginBottom: 24 }]}>
                <Text style={profStyles.fieldLabel}>{t('profile.addrState', 'State / Region')}</Text>
                <TextInput value={addrForm.state} onChangeText={(v) => setAF('state', v)} placeholder={t('profile.addrState', 'State / Region')} placeholderTextColor={THEME.faint} style={profStyles.field} />
              </View>

              <View style={profStyles.btnRow}>
                <TouchableOpacity activeOpacity={0.85} onPress={() => setAddressFormVisible(false)} style={[profStyles.cancelBtn, { flex: 1 }]}>
                  <Text style={profStyles.cancelBtnTxt}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={submitAddress} disabled={addrSaving} style={profStyles.saveBtn}>
                  {addrSaving ? <ActivityIndicator color="#1C1917" /> : <Text style={profStyles.saveBtnTxt}>{t('profile.save')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}
