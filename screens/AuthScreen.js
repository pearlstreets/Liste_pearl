import React from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator, Alert, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
// expo-firebase-recaptcha is archived — load lazily so the app boots even if missing
let FirebaseRecaptchaVerifierModal = null;
try { FirebaseRecaptchaVerifierModal = require('expo-firebase-recaptcha').FirebaseRecaptchaVerifierModal; } catch (_) {}
import { loginUser, registerUser, forgotPassword as apiForgotPassword } from '../services/auth';
import { saveTokens } from '../services/api';
import { checkRateLimit } from '../services/security';
import { BRAND } from '../constants/brand';
import { KEY_AUTH, KEY_PROFILE, KEY_ITEMS, KEY_SELECTED, KEY_CART, KEY_ACCOUNTS } from '../constants/storageKeys';
import { MARKETPLACE_ACCOUNTS } from '../constants/accounts';
import { LANGUAGES } from '../constants/languages';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import useOtpSender from '../services/otpauth/useOtpSender';
import { getFirebaseApp } from '../services/otpauth/firebase';

function AuthScreen({ onLogin, onContinueAsGuest }) {
  const { t, i18n: i18nAuth } = useTranslation();
  const [isLogin, setIsLogin] = React.useState(true);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pseudo, setPseudo] = React.useState('');
  const [prenom, setPrenom] = React.useState('');
  const [nom, setNom] = React.useState('');
  const [error, setError] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [langVisible, setLangVisible] = React.useState(false);
  const [showForgot, setShowForgot] = React.useState(false);

  // ── Phone OTP login state ──────────────────────────────────────
  const [showPhone, setShowPhone] = React.useState(false);
  const [phoneInput, setPhoneInput] = React.useState('');
  const [phoneCode, setPhoneCode] = React.useState('');
  const [phoneStage, setPhoneStage] = React.useState('enter-phone'); // 'enter-phone' | 'enter-code'
  const [resendTimer, setResendTimer] = React.useState(0);

  // Countdown resend cooldown — user can re-request an OTP only once
  // the timer hits 0. Prevents accidental spam and mirrors the 60 s
  // window used elsewhere (AppUser OtpVerification, Livraison_pearl).
  React.useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const iv = setInterval(() => setResendTimer((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, [resendTimer]);

  // Firebase reCAPTCHA verifier for Expo. The <FirebaseRecaptchaVerifierModal />
  // renders below; the hook uses this ref to call signInWithPhoneNumber().
  // firebaseConfig is loaded lazily from services/otpauth/firebase.js options.
  const recaptchaVerifier = React.useRef(null);
  const [firebaseOptions, setFirebaseOptions] = React.useState(null);
  React.useEffect(() => {
    (async () => {
      try {
        const app = await getFirebaseApp();
        if (app?.options) setFirebaseOptions(app.options);
      } catch (_) {}
    })();
  }, []);

  const { sendOtp, verifyOtp, reset: resetOtp, loading: otpLoading, error: otpError, shouldFallback } =
    useOtpSender({ platform: 'app-liste', recaptchaVerifier });

  const handlePhoneSend = async () => {
    if (!phoneInput.trim()) return;
    if (resendTimer > 0) return;
    const ok = await sendOtp({ phone: phoneInput.trim(), channel: 'sms' });
    if (ok) {
      setPhoneStage('enter-code');
      setResendTimer(60);
      setError('');
    } else if (shouldFallback) {
      setError(t('auth.phoneUnavailable') || 'Phone login temporarily unavailable. Please use email.');
      setShowPhone(false);
    } else {
      setError(otpError || t('auth.phoneSendFailed') || 'Failed to send code.');
    }
  };

  const handlePhoneVerify = async () => {
    if (phoneCode.length < 4) return;
    const result = await verifyOtp({ code: phoneCode });
    if (!result) {
      setError(otpError || t('auth.phoneVerifyFailed') || 'Invalid code. Try again.');
      return;
    }
    // Save tokens & minimal profile, then call onLogin
    try {
      await saveTokens(result.accessToken, result.refreshToken);
      const authData = {
        id: result.userId,
        phone: result.phoneE164 || phoneInput.trim(),
        role: result.userType || 'user',
        pseudo: '',
        prenom: '',
        nom: '',
        email: '',
        photo: null,
      };
      await AsyncStorage.setItem(KEY_AUTH, JSON.stringify(authData));
      await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(authData));
    } catch (_) {}
    onLogin();
  };

  const handlePhoneBack = () => {
    resetOtp();
    setPhoneCode('');
    setPhoneStage('enter-phone');
    if (phoneStage === 'enter-phone') setShowPhone(false);
  };
  // ──────────────────────────────────────────────────────────────

  // Sync all Marketplace accounts to local storage
  React.useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      let accounts = raw ? JSON.parse(raw) : [];
      let changed = false;
      for (const mktAccount of MARKETPLACE_ACCOUNTS) {
        const exists = accounts.some(a => a.email && a.email.toLowerCase() === mktAccount.email.toLowerCase());
        if (!exists) { accounts.push(mktAccount); changed = true; }
      }
      if (changed) await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
    })();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() && !password.trim()) { setError(t('auth.errorBothEmpty') || 'Veuillez saisir votre email et mot de passe'); return; }
    if (!email.trim()) { setError(t('auth.errorNoEmail') || 'Veuillez saisir votre email'); return; }
    if (!password.trim()) { setError(t('auth.errorNoPassword') || 'Veuillez saisir votre mot de passe'); return; }
    // Rate limiting: max 5 attempts per minute
    const rateCheck = checkRateLimit('login', 5, 60000);
    if (!rateCheck.allowed) { setError((t('auth.errorRateLimit') || 'Trop de tentatives. Réessayez dans') + ' ' + rateCheck.waitSeconds + 's'); return; }
    setLoading(true);
    // Try Marketplace API with timeout — if unavailable, fallback to local
    try {
      const apiPromise = loginUser(email.trim(), password);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
      const result = await Promise.race([apiPromise, timeoutPromise]);
      if (result && result.success) { setLoading(false); onLogin(); return; }
    } catch(e) {
      setError(t('auth.errorLoginFailed') || 'Connexion impossible. Vérifiez votre connexion internet.');
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    setError('');
    if (!email.trim() || !password.trim() || !pseudo.trim() || !prenom.trim() || !nom.trim()) { setError(t('auth.errorEmpty') || 'Remplissez tous les champs'); return; }
    if (password.length < 6) { setError(t('auth.errorPasswordLength') || 'Minimum 6 caractères'); return; }
    setLoading(true);
    try {
      const apiPromise = registerUser({ username: pseudo.trim(), email: email.trim(), password, firstName: prenom.trim(), lastName: nom.trim() });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
      const result = await Promise.race([apiPromise, timeoutPromise]);
      if (result && result.success) { setLoading(false); onLogin(); return; }
    } catch(e) { /* API unavailable — fallback to local */ }
    const raw = await AsyncStorage.getItem(KEY_ACCOUNTS);
    const accounts = raw ? JSON.parse(raw) : [];
    if (accounts.find(a => a.email.toLowerCase() === email.trim().toLowerCase())) { setError(t('auth.errorEmailExists') || 'Email déjà utilisé'); setLoading(false); return; }
    const newAccount = { pseudo: pseudo.trim(), prenom: prenom.trim(), nom: nom.trim(), email: email.trim(), password, role: 'user' };
    accounts.push(newAccount);
    await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
    await AsyncStorage.setItem(KEY_AUTH, JSON.stringify({...newAccount, userKey: 'USER_' + newAccount.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}));
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify({ pseudo: newAccount.pseudo, prenom: newAccount.prenom, nom: newAccount.nom, email: newAccount.email, photo: null }));
    setLoading(false);
    onLogin();
  };

  // Forgot-password flow: dedicated self-contained screen, wires
  // services/auth.js forgotPassword + resetPassword (which were imported
  // but never called before session C).
  if (showForgot) {
    return <ForgotPasswordScreen onBack={() => { setShowForgot(false); setError(''); }} />;
  }

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={{flex:1, backgroundColor:'#fff'}}>
      {!isLogin && (
        <TouchableOpacity onPress={() => { setIsLogin(true); setError(''); }} style={{paddingHorizontal:16, paddingTop:12}}>
          <Ionicons name="arrow-back" size={26} color="#111" />
        </TouchableOpacity>
      )}
      <ScrollView contentContainerStyle={{flexGrow:1, justifyContent:'center', paddingHorizontal:24, paddingVertical:30}} keyboardShouldPersistTaps="handled">
        <View style={{alignItems:'center', marginBottom:24}}>
          <View style={{width:60, height:60, borderRadius:30, backgroundColor:BRAND, alignItems:'center', justifyContent:'center', marginBottom:12}}>
            <Ionicons name="cart" size={30} color="#fff" />
          </View>
          <Text style={{fontSize:24, fontWeight:'900', color:'#111'}}>Pearl List</Text>
          <Text style={{fontSize:13, color:'#9CA3AF', marginTop:6, textAlign:'center'}}>
            {isLogin ? (t('auth.pearlLoginHint') || 'Connectez-vous avec votre compte Pearl Streets ou Marketplace') : (t('auth.pearlSignupHint') || 'Créez un compte — utilisable sur l\'app et le site Marketplace')}
          </Text>
        </View>
        {error ? (<View style={{backgroundColor:'#FEE2E2', borderRadius:10, padding:12, marginBottom:16, flexDirection:'row', alignItems:'center'}}><Ionicons name="alert-circle" size={18} color="#EF4444" /><Text style={{color:'#EF4444', fontSize:13, marginLeft:8, flex:1}}>{error}</Text></View>) : null}
        {!isLogin && (
          <>
            <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('profile.pseudo')}</Text>
            <TextInput value={pseudo} onChangeText={setPseudo} placeholder={t('profile.pseudoPlaceholder')} style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:12, color:'#111'}} />
            <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('profile.firstName')}</Text>
            <TextInput value={prenom} onChangeText={setPrenom} placeholder={t('profile.firstNamePlaceholder')} style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:12, color:'#111'}} />
            <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('profile.lastName')}</Text>
            <TextInput value={nom} onChangeText={setNom} placeholder={t('profile.lastNamePlaceholder')} style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:12, color:'#111'}} />
          </>
        )}
        <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{isLogin ? t('auth.emailOrPseudo') : t('profile.email')}</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder={isLogin ? t('auth.emailOrPseudoPlaceholder') : t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:12, color:'#111'}} />
        <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('auth.password')}</Text>
        <View style={{flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, marginBottom:20}}>
          <TextInput value={password} onChangeText={setPassword} placeholder={t('auth.passwordPlaceholder')} secureTextEntry={!showPwd} style={{flex:1, padding:14, fontSize:15, color:'#111'}} />
          <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={{paddingRight:14}}>
            <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
        {isLogin && (
          <TouchableOpacity onPress={() => { setShowForgot(true); setError(''); }} style={{alignSelf:'flex-end', marginTop:-12, marginBottom:12, paddingVertical:4, paddingHorizontal:4}}>
            <Text style={{color:BRAND, fontSize:13, fontWeight:'600'}}>{t('auth.forgotPasswordLink')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={isLogin ? handleLogin : handleSignup} disabled={loading} style={{height:52, borderRadius:14, backgroundColor: loading ? '#9CA3AF' : BRAND, alignItems:'center', justifyContent:'center', marginBottom:16}}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{isLogin ? t('auth.loginBtn') : t('auth.signupBtn')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setIsLogin(!isLogin); setError(''); }} style={{alignItems:'center', paddingVertical:16}}>
          <Text style={{color:'#6B7280', fontSize:15}}>
            {isLogin ? (t('auth.noAccountPearl') || 'Pas de compte ? ') : (t('auth.hasAccountPearl') || 'Déjà un compte ? ')}
            <Text style={{color:BRAND, fontWeight:'800', fontSize:15}}>{isLogin ? t('auth.signupBtn') : t('auth.loginBtn')}</Text>
          </Text>
        </TouchableOpacity>
        {isLogin && (
          <TouchableOpacity onPress={() => { setShowPhone(true); setError(''); setPhoneStage('enter-phone'); }} style={{alignItems:'center', paddingBottom:8}}>
            <Text style={{color:BRAND, fontSize:14, fontWeight:'600', textDecorationLine:'underline'}}>
              {t('auth.loginWithPhone') || 'Se connecter avec un téléphone'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <TouchableOpacity onPress={() => setLangVisible(true)} style={{flexDirection:'row', alignItems:'center', justifyContent:'center', marginHorizontal:24, marginBottom:12, paddingVertical:12, borderRadius:12, backgroundColor:'#fff'}}>
        <Ionicons name="globe-outline" size={18} color="#6B7280" style={{marginRight:8}} />
        <Text style={{fontSize:14, fontWeight:'600', color:'#374151'}}>{LANGUAGES.find(l => l.code === i18nAuth.language)?.flag || '🌐'} {LANGUAGES.find(l => l.code === i18nAuth.language)?.label || 'Language'}</Text>
      </TouchableOpacity>

      {/* Phone OTP Login Modal */}
      <Modal visible={showPhone} animationType="slide" transparent={false} onRequestClose={handlePhoneBack}>
        <SafeAreaView style={{flex:1, backgroundColor:'#fff'}}>
          {/* Invisible reCAPTCHA for Firebase Phone Auth in Expo managed.
              Must be rendered BEFORE sendOtp() is called so the ref is populated. */}
          {firebaseOptions && FirebaseRecaptchaVerifierModal && (
            <FirebaseRecaptchaVerifierModal
              ref={recaptchaVerifier}
              firebaseConfig={firebaseOptions}
              attemptInvisibleVerification={true}
            />
          )}
          <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <TouchableOpacity onPress={handlePhoneBack} style={{paddingHorizontal:16, paddingTop:12}}>
              <Ionicons name="arrow-back" size={26} color="#111" />
            </TouchableOpacity>
            <ScrollView contentContainerStyle={{flexGrow:1, justifyContent:'center', paddingHorizontal:24, paddingVertical:30}} keyboardShouldPersistTaps="handled">
              <View style={{alignItems:'center', marginBottom:24}}>
                <Ionicons name="phone-portrait-outline" size={48} color={BRAND} />
                <Text style={{fontSize:22, fontWeight:'800', color:'#111', marginTop:12}}>
                  {t('auth.phoneLoginTitle') || 'Connexion par téléphone'}
                </Text>
                <Text style={{fontSize:13, color:'#9CA3AF', marginTop:6, textAlign:'center'}}>
                  {phoneStage === 'enter-phone'
                    ? (t('auth.phoneLoginSubtitle') || 'Entrez votre numéro pour recevoir un code SMS.')
                    : (t('auth.phoneCodeSubtitle') || 'Entrez le code reçu par SMS.')}
                </Text>
              </View>
              {!!otpError && (
                <View style={{backgroundColor:'#FEE2E2', borderRadius:10, padding:12, marginBottom:16, flexDirection:'row', alignItems:'center'}}>
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  <Text style={{color:'#EF4444', fontSize:13, marginLeft:8, flex:1}}>{otpError}</Text>
                </View>
              )}
              {phoneStage === 'enter-phone' ? (
                <>
                  <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>
                    {t('auth.phoneNumber') || 'Numéro de téléphone'}
                  </Text>
                  <TextInput
                    value={phoneInput}
                    onChangeText={setPhoneInput}
                    placeholder="+33 6 12 34 56 78"
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:20, color:'#111'}}
                  />
                  <TouchableOpacity onPress={handlePhoneSend} disabled={!phoneInput.trim() || otpLoading} style={{height:52, borderRadius:14, backgroundColor: (!phoneInput.trim() || otpLoading) ? '#9CA3AF' : BRAND, alignItems:'center', justifyContent:'center'}}>
                    {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('auth.sendCode') || 'Envoyer le code'}</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{fontSize:13, color:'#6B7280', textAlign:'center', marginBottom:16}}>
                    {t('auth.codeSentTo') || 'Code envoyé à'} <Text style={{fontWeight:'700', color:'#111'}}>{phoneInput.trim()}</Text>
                  </Text>
                  <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>
                    {t('auth.otpCode') || 'Code de vérification'}
                  </Text>
                  <TextInput
                    value={phoneCode}
                    onChangeText={setPhoneCode}
                    placeholder="123456"
                    keyboardType="number-pad"
                    maxLength={6}
                    style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:22, marginBottom:20, color:'#111', letterSpacing:8, textAlign:'center'}}
                  />
                  <TouchableOpacity onPress={handlePhoneVerify} disabled={phoneCode.length < 6 || otpLoading} style={{height:52, borderRadius:14, backgroundColor: (phoneCode.length < 6 || otpLoading) ? '#9CA3AF' : BRAND, alignItems:'center', justifyContent:'center', marginBottom:12}}>
                    {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('auth.verifyCode') || 'Vérifier'}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handlePhoneSend} disabled={resendTimer > 0 || otpLoading} style={{alignItems:'center', paddingVertical:8, marginBottom:4}}>
                    <Text style={{color: resendTimer > 0 ? '#9CA3AF' : BRAND, fontSize:13, fontWeight:'600'}}>
                      {resendTimer > 0
                        ? `${t('auth.resendIn') || 'Renvoyer dans'} ${resendTimer}s`
                        : (t('auth.resendCode') || 'Renvoyer le code')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handlePhoneBack} style={{alignItems:'center', paddingVertical:12}}>
                    <Text style={{color:BRAND, fontSize:14, fontWeight:'600', textDecorationLine:'underline'}}>
                      {t('auth.changeNumber') || 'Changer de numéro'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {isLogin && onContinueAsGuest && (
        <TouchableOpacity onPress={onContinueAsGuest} style={{alignItems:'center', paddingBottom:20}}>
          <Text style={{color:'#9CA3AF', fontSize:14}}>
            {t('auth.continueAsGuest') || 'Continuer sans compte →'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Language Picker Modal */}
      <Modal visible={langVisible} animationType="none" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'60%', paddingBottom:40}}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, borderBottomWidth:1, borderBottomColor:'#F3F4F6'}}>
              <Text style={{fontSize:18, fontWeight:'800', color:'#111'}}>{t('profile.language') || 'Langue'}</Text>
              <TouchableOpacity onPress={() => setLangVisible(false)} style={{padding:6}}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              contentContainerStyle={{paddingHorizontal:16, paddingVertical:8}}
              renderItem={({item: lang}) => (
                <TouchableOpacity
                  onPress={async () => { await i18nAuth.changeLanguage(lang.code); await AsyncStorage.setItem('APP_LANG', lang.code); setLangVisible(false); }}
                  style={{flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:12, borderBottomWidth:1, borderBottomColor:'#F3F4F6', backgroundColor: i18nAuth.language === lang.code ? '#F0FDF4' : '#fff'}}
                >
                  <Text style={{fontSize:24, marginRight:14}}>{lang.flag}</Text>
                  <Text style={{flex:1, fontSize:16, fontWeight: i18nAuth.language === lang.code ? '700' : '500', color: i18nAuth.language === lang.code ? BRAND : '#111'}}>{lang.label}</Text>
                  {i18nAuth.language === lang.code && <Ionicons name="checkmark-circle" size={20} color={BRAND} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export default AuthScreen;
