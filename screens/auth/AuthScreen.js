import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image, ScrollView, Platform, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from 'react-i18next';
import AsyncStorage from "@react-native-async-storage/async-storage";
// Modal de react-native, sauf sur l'ecran deplie d'un pliable Android (voir le fichier).
import Modal from "../../components/DeuxEcrans";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { MARCHE, SERIF, TAILLES } from "../../components/ui/marche";
import { THEME } from "../../components/commun/theme";
import { loginUser, registerUser, checkEmailAvailable, checkUsernameAvailable } from "../../services/auth";
import { createAddress } from "../../services/addresses";
import { COUNTRIES, findCountry } from "../../lib/countries";
import { LANGUAGES } from "../../lib/constants";
import { fetchPhotonSuggestions } from "../../lib/photon";
import { EMAIL_RE, PASSWORD_RE, PHONE_RE, USERNAME_MIN, normalizeDob } from "./validation";
import { KEY_RESTER_CONNECTE } from "./session";
import WheelDatePicker from "./WheelDatePicker";
import MotDePasseOublie from "./MotDePasseOublie";

const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.bg },

  // Top bar (back / close)
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 4, minHeight: 46 },
  topBtn: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center' },

  // Scroll body
  // Pas de justifyContent:'center' : dès que le formulaire dépasse la hauteur
  // visible (messages d'erreur affichés), le centrage rognait le contenu en haut
  // ET en bas, donnant l'impression que le bouton était coupé. Le contenu part
  // du haut et défile normalement. paddingBottom : le sélecteur de langue est
  // FIXE en bas de l'écran, hors du ScrollView.
  scrollBody: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },

  // Brand header
  brandHeader: { alignItems: 'center', marginBottom: 28 },
  // Inscription : en-tete plus compact pour que « Continuer » tienne a l'ecran.
  scrollBodySignup: { paddingTop: 8 },
  brandHeaderSignup: { marginBottom: 16 },
  brandLogoSignup: { width: 52, height: 52, borderRadius: 16, marginBottom: 10 },
  brandLogo: { width: 72, height: 72, borderRadius: 24, borderWidth: 1, borderColor: THEME.border, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...THEME.shadow },
  brandTitle: { fontSize: 26, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, letterSpacing: -0.5, textAlign: 'center' },
  brandSubtitle: { fontSize: 13, color: THEME.muted, marginTop: 6, textAlign: 'center', lineHeight: 19, fontWeight: '600' },

  // Error banner
  errorBanner: { backgroundColor: THEME.dangerSoft, borderRadius: 16, padding: 14, marginBottom: 18, flexDirection: 'row', alignItems: 'center' },
  errorTxt: { color: THEME.danger, fontSize: 13, marginLeft: 8, flex: 1, fontWeight: '600' },
  successBanner: { backgroundColor: THEME.brandSoft, borderRadius: 16, padding: 14, marginBottom: 18, flexDirection: 'row', alignItems: 'center' },
  successTxt: { color: THEME.brandDark, fontSize: 13, marginLeft: 8, flex: 1, fontWeight: '600' },
  forgotLink: { alignSelf: 'flex-end', paddingVertical: 6, marginTop: 4 },

  // Form fields
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: THEME.muted, marginBottom: 6 },
  field: { height: TAILLES.champ, backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, paddingHorizontal: 16, fontSize: 15, color: THEME.ink, borderWidth: 1, borderColor: THEME.border },
  // Erreur affichée SOUS le champ concerné + bordure rouge sur le champ.
  fieldError: { color: THEME.danger, fontSize: 12.5, fontWeight: '600', marginTop: 6, lineHeight: 17 },
  fieldInvalid: { borderWidth: 1, borderColor: THEME.danger },
  pwdRow: { flexDirection: 'row', alignItems: 'center', height: TAILLES.champ, backgroundColor: THEME.card, borderRadius: TAILLES.rayonCarte, borderWidth: 1, borderColor: THEME.border },
  pwdInput: { flex: 1, height: TAILLES.champ - 2, paddingHorizontal: 16, fontSize: 15, color: THEME.ink },
  pwdEye: { paddingHorizontal: 14, height: TAILLES.champ - 2, alignItems: 'center', justifyContent: 'center' },
  stayRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4 },
  stayBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: THEME.faint, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center' },
  stayBoxOn: { backgroundColor: MARCHE.noir, borderColor: MARCHE.noir },
  stayTxt: { marginLeft: 10, fontSize: 14, color: THEME.ink },

  // Primary button
  primaryBtn: { height: TAILLES.bouton, borderRadius: TAILLES.rayonBouton, borderWidth: 1, borderColor: THEME.borderInput, backgroundColor: THEME.card, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 4, ...THEME.shadow },
  primaryBtnDisabled: { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
  primaryBtnTxt: { color: THEME.ink, fontWeight: '600', fontSize: 16 },

  // Toggle-mode link
  toggleLink: { alignItems: 'center', paddingVertical: 18 },
  toggleTxt: { color: THEME.muted, fontSize: 14.5, fontWeight: '600' },
  toggleTxtBrand: { color: THEME.terra, fontWeight: '600', fontSize: 14.5 },

  // Progress steps (inscription 2 étapes)
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginHorizontal: 24, marginBottom: 22, marginTop: 4 },
  stepItem: { alignItems: 'center', width: 120 },
  stepDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: THEME.subtle, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: THEME.border },
  stepDotActive: { backgroundColor: THEME.card, borderColor: MARCHE.noir },
  stepDotTxt: { fontSize: 14, fontWeight: '600', color: THEME.muted },
  stepDotTxtActive: { color: THEME.ink },
  stepLabel: { fontSize: 12, fontWeight: '700', color: THEME.faint, marginTop: 6, textAlign: 'center' },
  stepLabelActive: { color: THEME.ink },
  stepLine: { flex: 0, width: 40, height: 1.5, backgroundColor: THEME.border, marginTop: 15 },

  // Genre (segmented)
  genderRow: { flexDirection: 'row', gap: 8 },
  genderChip: { flex: 1, height: TAILLES.champ, borderRadius: 999, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center' },
  genderChipActive: { backgroundColor: MARCHE.noir, borderColor: MARCHE.noir },
  genderChipTxt: { fontSize: 14.5, fontWeight: '700', color: THEME.muted },
  genderChipTxtActive: { color: MARCHE.blanc },

  // Téléphone + indicatif
  phoneRow: { flexDirection: 'row', alignItems: 'center' },
  dialBtn: { flexDirection: 'row', alignItems: 'center', height: TAILLES.champ, paddingHorizontal: 12, borderRadius: TAILLES.rayonCarte, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, gap: 6 },
  dialFlag: { fontSize: 18 },
  dialTxt: { fontSize: 15, fontWeight: '700', color: THEME.ink },

  // Pays (adresse)
  countryBtn: { flexDirection: 'row', alignItems: 'center', height: TAILLES.champ, paddingHorizontal: 14, borderRadius: TAILLES.rayonCarte, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, gap: 8 },
  countryBtnTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: THEME.ink },

  // Dropdown de suggestions d'adresse (autocomplétion Photon)
  suggestBox: { marginTop: 6, backgroundColor: THEME.card, borderRadius: 16, borderWidth: 1, borderColor: THEME.border, overflow: 'hidden' },
  suggestRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 11 },

  // Language picker button
  langBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 24, marginTop: 16, marginBottom: 24, height: TAILLES.boutonPetit, borderRadius: TAILLES.rayonBouton, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  langBtnTxt: { fontSize: 14, fontWeight: '700', color: THEME.ink, marginLeft: 8 },
  // Android (pliable plie) : marges reduites pour que « Continuer » ne soit pas coupe
  // au-dessus de la barre de langue ; la SafeAreaView du bas ajoute deja la barre de navigation.
  langBtnAndroid: { marginTop: 8, marginBottom: 8 },

  // Language picker modal
  langBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  langSheet: { backgroundColor: THEME.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '62%', paddingBottom: 36 },
  langHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: THEME.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  langHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: THEME.border },
  langHeadTitle: { fontSize: 18, fontFamily: SERIF, fontWeight: '600', color: THEME.ink, letterSpacing: -0.3 },
  langClose: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border, alignItems: 'center', justifyContent: 'center' },
  langRow: { flexDirection: 'row', alignItems: 'center', minHeight: TAILLES.champ, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, marginBottom: 4 },
  langRowActive: { backgroundColor: THEME.subtle },
  langFlag: { fontSize: 24, marginRight: 14 },
  langLabel: { flex: 1, fontSize: 15.5, fontWeight: '600', color: THEME.ink },
  langLabelActive: { fontWeight: '600', color: THEME.ink },
});

// Pliable : au pliage, la page de connexion est rendue ailleurs dans l'arbre
// (moitie droite ou Modal plein ecran) et donc remontee. Le choix connexion /
// inscription est garde ici, en memoire, jusqu'a la fermeture de la page.
let modeAuthGarde = null;
export const oublierModeAuth = () => { modeAuthGarde = null; };

export default function AuthScreen({ onLogin, onClose, initialIsLogin = true, retourRef }) {
  const { t, i18n: i18nAuth } = useTranslation();
  const [isLogin, setIsLogin] = React.useState(() => (modeAuthGarde !== null ? modeAuthGarde : initialIsLogin));
  React.useEffect(() => { modeAuthGarde = isLogin; }, [isLogin]);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pseudo, setPseudo] = React.useState('');
  const [prenom, setPrenom] = React.useState('');
  const [nom, setNom] = React.useState('');
  const [error, setError] = React.useState('');
  // Mot de passe oublié : 0 = fermé, 1 e-mail, 2 code, 3 nouveau mot de passe.
  const [oubli, setOubli] = React.useState(0);
  const [succes, setSucces] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);
  const [resterConnecte, setResterConnecte] = React.useState(true);
  React.useEffect(() => {
    AsyncStorage.getItem(KEY_RESTER_CONNECTE).then((v) => { if (v === 'false') setResterConnecte(false); }).catch(() => {});
  }, []);
  const basculerResterConnecte = () => {
    const v = !resterConnecte;
    setResterConnecte(v);
    AsyncStorage.setItem(KEY_RESTER_CONNECTE, v ? 'true' : 'false').catch(() => {});
  };
  const [showConfirmPwd, setShowConfirmPwd] = React.useState(false);
  // Erreurs PAR CHAMP, affichées sous le champ concerné (comme l'inscription
  // AppUser) plutôt qu'en un seul bandeau en haut, loin du champ fautif.
  const [fieldErr, setFieldErr] = React.useState({});
  const clearFE = (k) => setFieldErr((p) => (p[k] ? { ...p, [k]: '' } : p));
  const [loading, setLoading] = React.useState(false);
  const [langVisible, setLangVisible] = React.useState(false);
  // Inscription en 2 étapes (comme AppUser)
  const [step, setStep] = React.useState(1);            // 1 = Authentification, 2 = Détails personnels
  const [confirmPwd, setConfirmPwd] = React.useState('');
  const [gender, setGender] = React.useState('');       // 'male' | 'female' | 'other'
  const [dob, setDob] = React.useState('');             // AAAA-MM-JJ
  const [dialCode, setDialCode] = React.useState('+33');
  const [dialCountryCode, setDialCountryCode] = React.useState('FR'); // ISO du pays choisi (désambigüe +1 US/CA)
  const [phone, setPhone] = React.useState('');
  const [addrCountry, setAddrCountry] = React.useState('France');
  const [addrLine, setAddrLine] = React.useState('');
  const [addrCity, setAddrCity] = React.useState('');
  const [addrPostal, setAddrPostal] = React.useState('');
  const [addrLat, setAddrLat] = React.useState(null);
  const [addrLng, setAddrLng] = React.useState(null);
  const [countryPickerFor, setCountryPickerFor] = React.useState(null); // 'phone' | 'address' | null
  const [dobPickerOpen, setDobPickerOpen] = React.useState(false);
  const [addrSuggestions, setAddrSuggestions] = React.useState([]);
  const addrDebounce = React.useRef(null);
  // Enchaînement des champs au clavier (touche « Suivant » puis « OK »).
  const mdpRef = React.useRef(null);
  const inscMdpRef = React.useRef(null);
  const inscConfirmRef = React.useRef(null);

  // Autocomplétion d'adresse (Photon) — comme AppUser, filtrée sur le pays choisi.
  const onAddrLineChange = (text) => {
    setAddrLine(text);
    clearFE('address');
    if (addrDebounce.current) clearTimeout(addrDebounce.current);
    const q = (text || '').trim();
    if (q.length < 2) { setAddrSuggestions([]); return; }
    const cc = (COUNTRIES.find(c => c.name === addrCountry)?.code || '').toUpperCase();
    addrDebounce.current = setTimeout(async () => {
      const s = await fetchPhotonSuggestions(q, cc, i18nAuth.language);
      setAddrSuggestions(s);
    }, 300);
  };
  const pickAddrSuggestion = (s) => {
    if (addrDebounce.current) clearTimeout(addrDebounce.current);
    setAddrLine(s.address || s.label);
    if (s.postcode) setAddrPostal(s.postcode);
    if (s.city) setAddrCity(s.city);
    if (s.lat != null) setAddrLat(s.lat);
    if (s.lng != null) setAddrLng(s.lng);
    setAddrSuggestions([]);
  };

  const handleLogin = async () => {
    setError(''); setSucces('');
    if (!email.trim() && !password.trim()) { setError(t('auth.errorBothEmpty', 'Veuillez saisir votre email et mot de passe')); return; }
    if (!email.trim()) { setError(t('auth.errorNoEmail', 'Veuillez saisir votre email')); return; }
    if (!password.trim()) { setError(t('auth.errorNoPassword', 'Veuillez saisir votre mot de passe')); return; }
    // Rate limiting: max 5 attempts per minute
    const { checkRateLimit } = require('../../services/security');
    const rateCheck = checkRateLimit('login', 5, 60000);
    if (!rateCheck.allowed) { setError((t('auth.errorRateLimit', 'Trop de tentatives. Réessayez dans')) + ' ' + rateCheck.waitSeconds + 's'); return; }
    setLoading(true);
    // Compte marketplace UNIQUEMENT — mêmes identifiants que l'app mobile
    // AppUser / le site. Plus de fallback vers des comptes locaux divergents.
    try {
      const apiPromise = loginUser(email.trim(), password);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000));
      const result = await Promise.race([apiPromise, timeoutPromise]);
      if (result && result.success) {
        try { await AsyncStorage.setItem(KEY_RESTER_CONNECTE, resterConnecte ? 'true' : 'false'); } catch (_) {}
        setLoading(false); onLogin(); return;
      }
      setError((result && result.message) || t('auth.errorWrongPassword', 'Email ou mot de passe incorrect'));
    } catch (e) {
      setError(t('auth.errorNetwork', 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.'));
    }
    setLoading(false);
  };

  // Étape 1 (Authentification) -> étape 2 (Détails personnels)
  const goToStep2 = async () => {
    setError('');
    // On valide TOUS les champs d'un coup pour signaler chaque erreur sous son
    // champ, au lieu de s'arrêter à la première.
    const fe = {};
    if (!EMAIL_RE.test((email || '').trim())) fe.email = t('auth.errorInvalidEmail', 'Adresse e-mail invalide');
    if (!PASSWORD_RE.test((password || '').trim())) {
      fe.password = t('auth.errorPasswordRule', '8 caractères minimum, avec une minuscule, une majuscule, un chiffre et un caractère spécial (@$!%*?&).');
    }
    if (!confirmPwd) fe.confirmPwd = t('auth.errorConfirmRequired', 'Confirmez votre mot de passe');
    else if (password !== confirmPwd) fe.confirmPwd = t('auth.errorPwdMismatch', 'Les mots de passe ne correspondent pas');
    setFieldErr(fe);
    if (Object.keys(fe).length) return;

    // Disponibilité de l'email, comme l'inscription marketplace.
    setLoading(true);
    const free = await checkEmailAvailable(email.trim());
    setLoading(false);
    if (!free) { setFieldErr({ email: t('auth.errorEmailTaken', 'Cette adresse e-mail est déjà utilisée.') }); return; }
    setStep(2);
  };

  const handleSignup = async () => {
    setError('');
    // Mêmes règles que l'inscription marketplace (AppUser SignupTwo), chaque
    // erreur affichée sous son champ.
    const fe = {};
    if (!gender) fe.gender = t('auth.errorGender', 'Sélectionnez votre genre');
    if (pseudo.trim().length < USERNAME_MIN) fe.pseudo = t('auth.errorUsernameMin', 'Le pseudo doit contenir au moins 4 caractères');
    if (!prenom.trim()) fe.prenom = t('auth.errorFirstName', 'Renseignez votre prénom');
    if (!nom.trim()) fe.nom = t('auth.errorLastName', 'Renseignez votre nom');
    const dobIso = normalizeDob(dob);
    if (!dob.trim()) fe.dob = t('auth.errorDob', 'Renseignez votre date de naissance');
    else if (!dobIso) fe.dob = t('auth.errorDobFormat', 'Date de naissance invalide (ex : 1990-05-12)');
    if (!PHONE_RE.test((phone || '').trim())) fe.phone = t('auth.errorPhone', 'Numéro de téléphone invalide (5 à 16 chiffres)');
    if (!addrLine.trim() || !addrCity.trim()) fe.address = t('auth.errorAddress', 'Renseignez votre adresse (rue et ville)');
    setFieldErr(fe);
    if (Object.keys(fe).length) return;

    setLoading(true);
    // Disponibilité du pseudo, comme l'inscription marketplace.
    const nameFree = await checkUsernameAvailable(pseudo.trim());
    if (!nameFree) { setLoading(false); setFieldErr({ pseudo: t('auth.errorUsernameTaken', 'Ce pseudo est déjà pris.') }); return; }
    // Inscription marketplace UNIQUEMENT — compte partagé avec l'app AppUser.
    const address = { address1: addrLine.trim(), address2: '', postalCode: addrPostal.trim(), city: addrCity.trim(), country: addrCountry, lat: addrLat ?? '', lang: addrLng ?? '' };
    try {
      const apiPromise = registerUser({
        username: pseudo.trim(), email: email.trim(), password,
        firstName: prenom.trim(), lastName: nom.trim(),
        phone: phone.trim(), countryCode: dialCode, dob: dobIso, gender, address,
      });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000));
      const result = await Promise.race([apiPromise, timeoutPromise]);
      if (result && result.success) {
        // Enregistre l'adresse saisie dans le carnet -> devient l'adresse de
        // livraison affichée directement dans le profil (best-effort, non bloquant).
        try {
          await createAddress({
            first_name: prenom.trim(), last_name: nom.trim(),
            phone_code: dialCode, phone_number: phone.trim(),
            house_building: addrLine.trim(), road_area_colony: '',
            pincode: addrPostal.trim(), city: addrCity.trim(), state: '',
            address_type: 'home',
            countryFlag: (COUNTRIES.find(c => c.name === addrCountry)?.code || 'FR'),
            lat: addrLat ?? null, lang: addrLng ?? null,
          });
        } catch (_) {}
        setLoading(false); onLogin(); return;
      }
      setError((result && result.message) || t('auth.errorEmailExists', "Impossible de créer le compte (email déjà utilisé ?)."));
    } catch (e) {
      setError(t('auth.errorNetwork', 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.'));
    }
    setLoading(false);
  };

  // Touche retour d'Android : meme effet que la fleche en haut (etape 1, puis
  // connexion) ; en connexion, la page se ferme.
  if (retourRef) {
    retourRef.current = () => {
      if (isLogin && oubli) { setOubli(oubli === 2 ? 1 : oubli === 3 ? 1 : 0); return true; }
      if (isLogin) return false;
      if (step === 2) { setStep(1); } else { setIsLogin(true); }
      setError('');
      return true;
    };
  }

  return (
    <View style={{ flex: 1, backgroundColor: THEME.bg }}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={authStyles.screen} edges={[]}>
      <View style={authStyles.topBar}>
        {isLogin && oubli ? (
          <TouchableOpacity onPress={() => setOubli(oubli === 1 ? 0 : 1)} style={authStyles.topBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={THEME.ink} />
          </TouchableOpacity>
        ) : !isLogin ? (
          <TouchableOpacity onPress={() => { if (step === 2) { setStep(1); } else { setIsLogin(true); } setError(''); }} style={authStyles.topBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={THEME.ink} />
          </TouchableOpacity>
        ) : <View style={{ width: TAILLES.icone, height: TAILLES.icone }} />}
        {onClose ? (
          <TouchableOpacity onPress={onClose} style={authStyles.topBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={THEME.ink} />
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={[authStyles.scrollBody, !isLogin && authStyles.scrollBodySignup]} keyboardShouldPersistTaps="handled">
        <View style={[authStyles.brandHeader, !isLogin && authStyles.brandHeaderSignup]}>
          <Image source={require('../../assets/icon.png')} style={[authStyles.brandLogo, !isLogin && authStyles.brandLogoSignup]} resizeMode="cover" />
          <Text style={authStyles.brandTitle}>Pearl List</Text>
          <Text style={authStyles.brandSubtitle}>
            {isLogin && oubli ? t('auth.forgotTitle', 'Réinitialiser votre mot de passe') : isLogin ? (t('auth.pearlLoginHint', 'Connectez-vous avec votre compte Pearl Streets ou Marketplace')) : (t('auth.pearlSignupHint', 'Créez un compte, utilisable sur l\'app et le site Marketplace'))}
          </Text>
        </View>
        {error && !(isLogin && oubli) ? (
          <View style={authStyles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={THEME.danger} />
            <Text style={authStyles.errorTxt}>{error}</Text>
          </View>
        ) : null}
        {succes && isLogin && !oubli ? (
          <View style={authStyles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={THEME.brandDark} />
            <Text style={authStyles.successTxt}>{succes}</Text>
          </View>
        ) : null}
        {isLogin && oubli ? (
          <>
            {/* ---------- Mot de passe oublié ---------- */}
            <MotDePasseOublie
              styles={authStyles}
              t={t}
              emailInitial={email}
              etape={oubli}
              setEtape={setOubli}
              onTermine={(e, mdpRecu) => {
                setOubli(0); setEmail(e); setPassword(mdpRecu || ''); setError('');
                setSucces(t('auth.forgotSuccess', 'Votre mot de passe a été modifié. Vous pouvez vous connecter.'));
              }}
            />
            <TouchableOpacity onPress={() => setOubli(0)} style={authStyles.toggleLink} activeOpacity={0.7}>
              <Text style={authStyles.toggleTxt}>{t('auth.forgotBackToLogin', 'Retour à la connexion')}</Text>
            </TouchableOpacity>
          </>
        ) : isLogin ? (
          <>
            {/* ---------- Connexion ---------- */}
            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.fieldLabel}>{t('auth.emailOrPseudo')}</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder={t('auth.emailOrPseudoPlaceholder')} placeholderTextColor={THEME.faint} keyboardType="email-address" autoCapitalize="none" textContentType="username" autoComplete="email" importantForAutofill="yes" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => mdpRef.current?.focus()} style={authStyles.field} />
            </View>
            <View style={authStyles.fieldGroup}>
              <Text style={authStyles.fieldLabel}>{t('auth.password')}</Text>
              <View style={authStyles.pwdRow}>
                <TextInput ref={mdpRef} returnKeyType="go" onSubmitEditing={handleLogin} value={password} onChangeText={setPassword} placeholder={t('auth.passwordPlaceholder')} placeholderTextColor={THEME.faint} secureTextEntry={!showPwd} textContentType="password" autoComplete="password" importantForAutofill="yes" style={authStyles.pwdInput} />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={authStyles.pwdEye} activeOpacity={0.7}>
                  <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color={THEME.faint} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={basculerResterConnecte} style={authStyles.stayRow} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked: resterConnecte }}>
                <View style={[authStyles.stayBox, resterConnecte && authStyles.stayBoxOn]}>
                  {resterConnecte ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                </View>
                <Text style={authStyles.stayTxt}>{t('auth.stayConnected', 'Rester connecté')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setError(''); setSucces(''); setOubli(1); }} style={authStyles.forgotLink} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}>
                <Text style={authStyles.toggleTxtBrand}>{t('auth.forgotPassword', 'Mot de passe oublié ?')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={[authStyles.primaryBtn, loading && authStyles.primaryBtnDisabled]}>
              {loading ? <ActivityIndicator color="#1C1917" /> : <Text style={authStyles.primaryBtnTxt}>{t('auth.loginBtn')}</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* ---------- Inscription en 2 étapes (comme AppUser) ---------- */}
            <View style={authStyles.stepRow}>
              <View style={authStyles.stepItem}>
                <View style={[authStyles.stepDot, step >= 1 && authStyles.stepDotActive]}>
                  {step > 1 ? <Ionicons name="checkmark" size={14} color="#1C1917" /> : <Text style={[authStyles.stepDotTxt, step >= 1 && authStyles.stepDotTxtActive]}>1</Text>}
                </View>
                <Text style={[authStyles.stepLabel, step === 1 && authStyles.stepLabelActive]}>{t('auth.stepAuth', 'Authentification')}</Text>
              </View>
              <View style={authStyles.stepLine} />
              <View style={authStyles.stepItem}>
                <View style={[authStyles.stepDot, step >= 2 && authStyles.stepDotActive]}>
                  <Text style={[authStyles.stepDotTxt, step >= 2 && authStyles.stepDotTxtActive]}>2</Text>
                </View>
                <Text style={[authStyles.stepLabel, step === 2 && authStyles.stepLabelActive]}>{t('auth.stepDetails', 'Détails personnels')}</Text>
              </View>
            </View>

            {step === 1 ? (
              <>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('profile.email', 'Adresse e-mail')}</Text>
                  <TextInput value={email} onChangeText={(v) => { setEmail(v); clearFE('email'); }} placeholder={t('auth.emailPlaceholder')} placeholderTextColor={THEME.faint} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => inscMdpRef.current?.focus()} style={[authStyles.field, fieldErr.email && authStyles.fieldInvalid]} />
                  {fieldErr.email ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.email}</Text> : null}
                </View>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('auth.password', 'Mot de passe')}</Text>
                  <View style={[authStyles.pwdRow, fieldErr.password && authStyles.fieldInvalid]}>
                    <TextInput ref={inscMdpRef} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => inscConfirmRef.current?.focus()} value={password} onChangeText={(v) => { setPassword(v); clearFE('password'); }} placeholder={t('auth.passwordPlaceholder')} placeholderTextColor={THEME.faint} secureTextEntry={!showPwd} style={authStyles.pwdInput} />
                    <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={authStyles.pwdEye} activeOpacity={0.7}>
                      <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color={THEME.faint} />
                    </TouchableOpacity>
                  </View>
                  {fieldErr.password ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.password}</Text> : null}
                </View>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('auth.confirmPassword', 'Confirmer le mot de passe')}</Text>
                  <View style={[authStyles.pwdRow, fieldErr.confirmPwd && authStyles.fieldInvalid]}>
                    <TextInput ref={inscConfirmRef} returnKeyType="go" onSubmitEditing={goToStep2} value={confirmPwd} onChangeText={(v) => { setConfirmPwd(v); clearFE('confirmPwd'); }} placeholder={t('auth.confirmPasswordPlaceholder', 'Retapez votre mot de passe')} placeholderTextColor={THEME.faint} secureTextEntry={!showConfirmPwd} style={authStyles.pwdInput} />
                    <TouchableOpacity onPress={() => setShowConfirmPwd(!showConfirmPwd)} style={authStyles.pwdEye} activeOpacity={0.7}>
                      <Ionicons name={showConfirmPwd ? "eye-off-outline" : "eye-outline"} size={20} color={THEME.faint} />
                    </TouchableOpacity>
                  </View>
                  {fieldErr.confirmPwd ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.confirmPwd}</Text> : null}
                </View>
                {/* Rappel de la règle : masqué si l'erreur rouge dit déjà la même chose. */}
                {!fieldErr.password ? (
                  <Text numberOfLines={2} style={{ fontSize: 12, color: THEME.faint, marginTop: -4, marginBottom: 10, lineHeight: 17 }}>
                    {t('auth.passwordRuleHint', '8 caractères minimum, avec une minuscule, une majuscule, un chiffre et un caractère spécial (@$!%*?&).')}
                  </Text>
                ) : null}
                <TouchableOpacity onPress={goToStep2} disabled={loading} activeOpacity={0.85} style={[authStyles.primaryBtn, loading && authStyles.primaryBtnDisabled]}>
                  {loading ? <ActivityIndicator color="#1C1917" /> : <Text style={authStyles.primaryBtnTxt}>{t('auth.continue', 'Continuer')}</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('profile.gender', 'Genre')}</Text>
                  <View style={authStyles.genderRow}>
                    {[
                      { key: 'male', label: t('auth.genderMale', 'Homme') },
                      { key: 'female', label: t('auth.genderFemale', 'Femme') },
                      { key: 'other', label: t('auth.genderOther', 'Autre') },
                    ].map(g => (
                      <TouchableOpacity key={g.key} onPress={() => { setGender(g.key); clearFE('gender'); }} activeOpacity={0.8} style={[authStyles.genderChip, gender === g.key && authStyles.genderChipActive]}>
                        <Text style={[authStyles.genderChipTxt, gender === g.key && authStyles.genderChipTxtActive]}>{g.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {fieldErr.gender ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.gender}</Text> : null}
                </View>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('profile.pseudo', 'Pseudo utilisateur')}</Text>
                  <TextInput value={pseudo} onChangeText={(v) => { setPseudo(v); clearFE('pseudo'); }} placeholder={t('profile.pseudoPlaceholder')} placeholderTextColor={THEME.faint} autoCapitalize="none" style={[authStyles.field, fieldErr.pseudo && authStyles.fieldInvalid]} />
                  {fieldErr.pseudo ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.pseudo}</Text> : null}
                </View>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('profile.firstName', 'Prénom')}</Text>
                  <TextInput value={prenom} onChangeText={(v) => { setPrenom(v); clearFE('prenom'); }} placeholder={t('profile.firstNamePlaceholder')} placeholderTextColor={THEME.faint} style={[authStyles.field, fieldErr.prenom && authStyles.fieldInvalid]} />
                  {fieldErr.prenom ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.prenom}</Text> : null}
                </View>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('profile.lastName', 'Nom')}</Text>
                  <TextInput value={nom} onChangeText={(v) => { setNom(v); clearFE('nom'); }} placeholder={t('profile.lastNamePlaceholder')} placeholderTextColor={THEME.faint} style={[authStyles.field, fieldErr.nom && authStyles.fieldInvalid]} />
                  {fieldErr.nom ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.nom}</Text> : null}
                </View>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('auth.dob', 'Date de naissance')}</Text>
                  <TouchableOpacity onPress={() => setDobPickerOpen(true)} activeOpacity={0.8} style={[authStyles.field, { justifyContent: 'center', flexDirection: 'row', alignItems: 'center' }, fieldErr.dob && authStyles.fieldInvalid]}>
                    <Text style={{ flex: 1, fontSize: 15, color: dob ? THEME.ink : THEME.faint }}>
                      {dob ? dob.split('-').reverse().join('/') : t('auth.dobPlaceholder', 'JJ/MM/AAAA')}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color={THEME.muted} />
                  </TouchableOpacity>
                  {fieldErr.dob ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.dob}</Text> : null}
                </View>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('auth.phone', 'Téléphone')}</Text>
                  <View style={authStyles.phoneRow}>
                    <TouchableOpacity onPress={() => setCountryPickerFor('phone')} activeOpacity={0.8} style={authStyles.dialBtn}>
                      <Text style={authStyles.dialFlag}>{findCountry(dialCountryCode).flag}</Text>
                      <Text style={authStyles.dialTxt}>{dialCode}</Text>
                      <Ionicons name="chevron-down" size={14} color={THEME.muted} />
                    </TouchableOpacity>
                    <TextInput value={phone} onChangeText={(v) => { setPhone(v); clearFE('phone'); }} placeholder={t('auth.phonePlaceholder', 'Numéro de téléphone')} placeholderTextColor={THEME.faint} keyboardType="phone-pad" style={[authStyles.field, { flex: 1, marginLeft: 8 }, fieldErr.phone && authStyles.fieldInvalid]} />
                  </View>
                  {fieldErr.phone ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.phone}</Text> : null}
                </View>
                <View style={authStyles.fieldGroup}>
                  <Text style={authStyles.fieldLabel}>{t('auth.address', 'Adresse')}</Text>
                  <TouchableOpacity onPress={() => setCountryPickerFor('address')} activeOpacity={0.8} style={authStyles.countryBtn}>
                    <Text style={authStyles.dialFlag}>{(COUNTRIES.find(c => c.name === addrCountry) || COUNTRIES[0]).flag}</Text>
                    <Text style={authStyles.countryBtnTxt}>{t('countries.' + (COUNTRIES.find(c => c.name === addrCountry)?.code || ''), { defaultValue: addrCountry })}</Text>
                    <Ionicons name="chevron-down" size={14} color={THEME.muted} />
                  </TouchableOpacity>
                  <TextInput value={addrLine} onChangeText={onAddrLineChange} placeholder={t('auth.addressAutoPlaceholder', 'Commencez à taper votre adresse…')} placeholderTextColor={THEME.faint} autoCorrect={false} style={[authStyles.field, { marginTop: 8 }]} />
                  {addrSuggestions.length > 0 && (
                    <View style={authStyles.suggestBox}>
                      {addrSuggestions.map((s, i) => (
                        <TouchableOpacity key={i} onPress={() => pickAddrSuggestion(s)} activeOpacity={0.7}
                          style={[authStyles.suggestRow, i < addrSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: THEME.border }]}>
                          <Ionicons name="location-outline" size={16} color={THEME.brandDark} style={{ marginRight: 8, marginTop: 2 }} />
                          <Text style={{ flex: 1, fontSize: 13.5, color: THEME.ink }} numberOfLines={2}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <TextInput value={addrPostal} onChangeText={setAddrPostal} placeholder={t('auth.postalCode', 'Code postal')} placeholderTextColor={THEME.faint} style={[authStyles.field, { width: 120, marginRight: 8 }]} />
                    <TextInput value={addrCity} onChangeText={(v) => { setAddrCity(v); clearFE('address'); }} placeholder={t('auth.city', 'Ville')} placeholderTextColor={THEME.faint} style={[authStyles.field, { flex: 1 }, fieldErr.address && authStyles.fieldInvalid]} />
                  </View>
                  {fieldErr.address ? <Text numberOfLines={2} style={authStyles.fieldError}>{fieldErr.address}</Text> : null}
                </View>
                <TouchableOpacity onPress={handleSignup} disabled={loading} activeOpacity={0.85} style={[authStyles.primaryBtn, loading && authStyles.primaryBtnDisabled]}>
                  {loading ? <ActivityIndicator color="#1C1917" /> : <Text style={authStyles.primaryBtnTxt}>{t('auth.signupBtn')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setStep(1); setError(''); setFieldErr({}); }} style={authStyles.toggleLink} activeOpacity={0.7}>
                  <Text style={authStyles.toggleTxt}>{t('auth.backToStep1', 'Retour à l\'étape précédente')}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
        {!(isLogin && oubli) ? <TouchableOpacity onPress={() => {
            setIsLogin(!isLogin); setError(''); setSucces(''); setStep(1); setFieldErr({});
            // Repart d'un formulaire propre (pas d'état d'inscription périmé).
            setConfirmPwd(''); setGender(''); setDob(''); setPhone('');
            setDialCode('+33'); setDialCountryCode('FR');
            setAddrCountry('France'); setAddrLine(''); setAddrCity(''); setAddrPostal('');
          }} style={authStyles.toggleLink} activeOpacity={0.7}>
          <Text style={authStyles.toggleTxt}>
            {isLogin ? (t('auth.noAccountPearl', 'Pas de compte ? ')) : (t('auth.hasAccountPearl', 'Déjà un compte ? '))}
            <Text style={authStyles.toggleTxtBrand}>{isLogin ? t('auth.signupBtn') : t('auth.loginBtn')}</Text>
          </Text>
        </TouchableOpacity> : null}
      </ScrollView>
    </SafeAreaView>
    </KeyboardAvoidingView>

      {/* Langue : FIXE en bas de page — hors du KeyboardAvoidingView pour qu'elle
          ne remonte PAS au-dessus du clavier et ne suive pas le scroll. */}
      {!isLogin && (
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: THEME.bg }}>
          <TouchableOpacity onPress={() => setLangVisible(true)} style={[authStyles.langBtn, Platform.OS === 'android' && authStyles.langBtnAndroid]} activeOpacity={0.7}>
            <Ionicons name="globe-outline" size={18} color={THEME.muted} />
            <Text style={authStyles.langBtnTxt}>{LANGUAGES.find(l => l.code === i18nAuth.language)?.flag || '🌐'} {LANGUAGES.find(l => l.code === i18nAuth.language)?.label || 'Language'}</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {/* Roulette de date de naissance */}
      <WheelDatePicker
        visible={dobPickerOpen}
        value={dob}
        onCancel={() => setDobPickerOpen(false)}
        onConfirm={(iso) => { setDob(iso); setDobPickerOpen(false); }}
        t={t}
      />

      {/* Country / dial-code Picker Modal (inscription étape 2) */}
      <Modal onRequestClose={() => setCountryPickerFor(null)} visible={countryPickerFor !== null} animationType="none" transparent={true}>
        <View style={authStyles.langBackdrop}>
          <View style={authStyles.langSheet}>
            <View style={authStyles.langHandle} />
            <View style={authStyles.langHeadRow}>
              <Text style={authStyles.langHeadTitle}>{countryPickerFor === 'phone' ? t('auth.selectDialCode', 'Indicatif téléphonique') : t('auth.selectCountry', 'Pays')}</Text>
              <TouchableOpacity onPress={() => setCountryPickerFor(null)} style={authStyles.langClose} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={THEME.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              contentContainerStyle={{paddingHorizontal:14, paddingVertical:10}}
              renderItem={({item: c}) => {
                const selected = countryPickerFor === 'phone' ? c.code === dialCountryCode : c.name === addrCountry;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      if (countryPickerFor === 'phone') { setDialCode(c.dial); setDialCountryCode(c.code); }
                      else setAddrCountry(c.name);
                      setCountryPickerFor(null);
                    }}
                    activeOpacity={0.7}
                    style={[authStyles.langRow, selected && authStyles.langRowActive]}
                  >
                    <Text style={authStyles.langFlag}>{c.flag}</Text>
                    <Text style={[authStyles.langLabel, selected && authStyles.langLabelActive]}>{t('countries.' + c.code, { defaultValue: c.name })}</Text>
                    {countryPickerFor === 'phone' && <Text style={authStyles.dialTxt}>{c.dial}</Text>}
                    {selected && <Ionicons name="checkmark-circle" size={20} color={THEME.brand} style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal onRequestClose={() => setLangVisible(false)} visible={langVisible} animationType="none" transparent={true}>
        <View style={authStyles.langBackdrop}>
          <View style={authStyles.langSheet}>
            <View style={authStyles.langHandle} />
            <View style={authStyles.langHeadRow}>
              <Text style={authStyles.langHeadTitle}>{t('profile.language', 'Langue')}</Text>
              <TouchableOpacity onPress={() => setLangVisible(false)} style={authStyles.langClose} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={THEME.muted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              contentContainerStyle={{paddingHorizontal:14, paddingVertical:10}}
              renderItem={({item: lang}) => (
                <TouchableOpacity
                  onPress={async () => { await i18nAuth.changeLanguage(lang.code); await AsyncStorage.setItem('APP_LANGUAGE', lang.code); setLangVisible(false); }}
                  activeOpacity={0.7}
                  style={[authStyles.langRow, i18nAuth.language === lang.code && authStyles.langRowActive]}
                >
                  <Text style={authStyles.langFlag}>{lang.flag}</Text>
                  <Text style={[authStyles.langLabel, i18nAuth.language === lang.code && authStyles.langLabelActive]}>{lang.label}</Text>
                  {i18nAuth.language === lang.code && <Ionicons name="checkmark-circle" size={20} color={THEME.brand} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
