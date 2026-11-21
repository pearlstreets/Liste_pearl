import React from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { THEME } from "../../components/commun/theme";
import { forgotPassword } from "../../services/auth";
import { apiPost } from "../../services/api";
import { EMAIL_RE, PASSWORD_RE } from "./validation";

// Mot de passe oublié, en trois temps comme sur le site et AppUser :
//   1. e-mail : /users/forgot-password/ (service forgotPassword) envoie un code ;
//   2. code : /users/verify-otp/ avec { email, otp } rend un `reset_token`
//      signé, valable 10 minutes et à usage unique ;
//   3. nouveau mot de passe : /users/reset-password/ avec { reset_token,
//      new_password }.
// verifyOTP et resetPassword de services/auth n'envoient ni l'e-mail ni le
// jeton que le serveur exige : les deux appels sont faits ici directement.
// Rendu DANS la page de connexion (pas de Modal en plus : iOS n'en empile pas deux).

// Réponse de quota DRF (429) : { detail } sans `status`.
const estQuota = (r) => !!(r && r.detail && r.status === undefined);

export default function MotDePasseOublie({ styles, t, emailInitial = '', etape, setEtape, onTermine }) {
  const [email, setEmail] = React.useState(EMAIL_RE.test((emailInitial || '').trim()) ? emailInitial.trim() : '');
  const [code, setCode] = React.useState('');
  const [jeton, setJeton] = React.useState('');
  const [mdp, setMdp] = React.useState('');
  const [mdp2, setMdp2] = React.useState('');
  const [voirMdp, setVoirMdp] = React.useState(false);
  const [erreur, setErreur] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [chargement, setChargement] = React.useState(false);
  const enCours = React.useRef(false);

  const limite = (cle) => {
    // Même garde que la connexion : 5 essais par minute.
    const { checkRateLimit } = require('../../services/security');
    const r = checkRateLimit(cle, 5, 60000);
    if (!r.allowed) { setErreur(t('auth.errorRateLimit', 'Trop de tentatives. Réessayez dans') + ' ' + r.waitSeconds + 's'); return false; }
    return true;
  };

  const lancer = async (fn) => {
    if (enCours.current) return;
    enCours.current = true;
    setChargement(true);
    try { await fn(); } catch (e) { setErreur(t('auth.errorNetwork', 'Connexion au serveur impossible. Vérifiez votre connexion et réessayez.')); }
    enCours.current = false;
    setChargement(false);
  };

  const envoyerCode = (renvoi) => {
    setErreur(''); setInfo('');
    const e = (email || '').trim();
    if (!EMAIL_RE.test(e)) { setErreur(t('auth.errorInvalidEmail', 'Adresse e-mail invalide')); return; }
    if (!limite('forgot_password')) return;
    lancer(async () => {
      const r = await forgotPassword(e);
      if (r && r.status) {
        setCode('');
        setEtape(2);
        if (renvoi) setInfo(t('auth.forgotCodeResent', 'Un nouveau code vous a été envoyé.'));
        return;
      }
      if (estQuota(r)) { setErreur(t('auth.forgotTooMany', 'Trop de demandes. Veuillez réessayer plus tard.')); return; }
      // Adresse reliée à aucun compte : traduite ici, dans la langue choisie dans l'app.
      if (r && r.error_code === 'email_not_found') { setErreur(t('auth.forgotEmailNotFound', 'Cette adresse e-mail n\'est reliée à aucun compte.')); return; }
      // Autres refus (quota de codes) : message du serveur.
      if (r && r.error_code && r.message) { setErreur(String(r.message)); return; }
      setErreur(t('auth.forgotErrorGeneric', 'Une erreur est survenue. Veuillez réessayer.'));
    });
  };

  const verifierCode = () => {
    setErreur(''); setInfo('');
    const c = (code || '').trim();
    if (!c) { setErreur(t('auth.forgotCodeRequired', 'Saisissez le code reçu par e-mail.')); return; }
    if (!limite('forgot_verify')) return;
    lancer(async () => {
      const r = await apiPost('/users/verify-otp/', { email: email.trim(), otp: c });
      if (r && r.status && r.reset_token) {
        setJeton(String(r.reset_token));
        setMdp(''); setMdp2('');
        setEtape(3);
        return;
      }
      if (estQuota(r)) { setErreur(t('auth.forgotTooMany', 'Trop de demandes. Veuillez réessayer plus tard.')); return; }
      setErreur(t('auth.forgotErrorCode', 'Code invalide ou expiré.'));
    });
  };

  const enregistrer = () => {
    setErreur(''); setInfo('');
    if (!PASSWORD_RE.test((mdp || '').trim())) { setErreur(t('auth.errorPasswordRule', '8 caractères minimum, avec une minuscule, une majuscule, un chiffre et un caractère spécial (@$!%*?&).')); return; }
    if (!mdp2) { setErreur(t('auth.errorConfirmRequired', 'Confirmez votre mot de passe')); return; }
    if (mdp !== mdp2) { setErreur(t('auth.errorPwdMismatch', 'Les mots de passe ne correspondent pas')); return; }
    lancer(async () => {
      const r = await apiPost('/users/reset-password/', { reset_token: jeton, new_password: mdp });
      if (r && r.status) { onTermine(email.trim(), mdp); return; }
      if (estQuota(r)) { setErreur(t('auth.forgotTooMany', 'Trop de demandes. Veuillez réessayer plus tard.')); return; }
      if (r && r.statusCode === 401) {
        // Jeton expiré ou déjà servi : il faut un nouveau code.
        setJeton(''); setCode(''); setEtape(1);
        setErreur(t('auth.forgotErrorExpired', 'Le délai est dépassé. Veuillez demander un nouveau code.'));
        return;
      }
      if (r && r.statusCode === 400) { setErreur(t('auth.forgotErrorWeak', "Ce mot de passe n'est pas accepté. Choisissez-en un autre, plus difficile à deviner.")); return; }
      setErreur(t('auth.forgotErrorGeneric', 'Une erreur est survenue. Veuillez réessayer.'));
    });
  };

  const bouton = (libelle, onPress) => (
    <TouchableOpacity onPress={onPress} disabled={chargement} activeOpacity={0.85} style={[styles.primaryBtn, chargement && styles.primaryBtnDisabled]}>
      {chargement ? <ActivityIndicator color="#1C1917" /> : <Text style={styles.primaryBtnTxt}>{libelle}</Text>}
    </TouchableOpacity>
  );

  return (
    <>
      {erreur ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={18} color={THEME.danger} />
          <Text style={styles.errorTxt}>{erreur}</Text>
        </View>
      ) : null}
      {info ? (
        <Text style={[styles.fieldLabel, { marginBottom: 14 }]}>{info}</Text>
      ) : null}

      {etape === 1 ? (
        <>
          <Text style={[styles.fieldLabel, { marginBottom: 14, lineHeight: 19 }]}>{t('auth.forgotEmailHint', "Saisissez l'adresse e-mail de votre compte. Nous vous enverrons un code de vérification.")}</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('profile.email', 'Adresse e-mail')}</Text>
            <TextInput value={email} onChangeText={(v) => { setEmail(v); setErreur(''); }} placeholder={t('auth.emailPlaceholder')} placeholderTextColor={THEME.faint} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" style={styles.field} />
          </View>
          {bouton(t('auth.forgotSendCode', 'Recevoir le code'), () => envoyerCode(false))}
        </>
      ) : etape === 2 ? (
        <>
          <Text style={[styles.fieldLabel, { marginBottom: 14, lineHeight: 19 }]}>{t('auth.forgotCodeHint', { email: email.trim(), defaultValue: 'Saisissez le code reçu par e-mail à l\'adresse {{email}}.' })}</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('auth.forgotCodeLabel', 'Code de vérification')}</Text>
            <TextInput value={code} onChangeText={(v) => { setCode(v.replace(/\s/g, '')); setErreur(''); }} placeholder={t('auth.forgotCodePlaceholder', 'Code reçu par e-mail')} placeholderTextColor={THEME.faint} keyboardType="number-pad" autoCapitalize="none" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={10} style={styles.field} />
          </View>
          {bouton(t('auth.forgotVerifyCode', 'Vérifier le code'), verifierCode)}
          <TouchableOpacity onPress={() => envoyerCode(true)} disabled={chargement} style={styles.toggleLink} activeOpacity={0.7}>
            <Text style={styles.toggleTxtBrand}>{t('auth.forgotResendCode', 'Renvoyer le code')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={[styles.fieldLabel, { marginBottom: 14, lineHeight: 19 }]}>{t('auth.forgotNewPwdHint', 'Choisissez votre nouveau mot de passe.')}</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('profile.newPassword', 'Nouveau mot de passe')}</Text>
            <View style={styles.pwdRow}>
              <TextInput value={mdp} onChangeText={(v) => { setMdp(v); setErreur(''); }} placeholder={t('auth.passwordPlaceholder')} placeholderTextColor={THEME.faint} secureTextEntry={!voirMdp} textContentType="newPassword" autoComplete="password-new" style={styles.pwdInput} />
              <TouchableOpacity onPress={() => setVoirMdp(!voirMdp)} style={styles.pwdEye} activeOpacity={0.7}>
                <Ionicons name={voirMdp ? "eye-off-outline" : "eye-outline"} size={20} color={THEME.faint} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('auth.confirmPassword', 'Confirmer le mot de passe')}</Text>
            <View style={styles.pwdRow}>
              <TextInput value={mdp2} onChangeText={(v) => { setMdp2(v); setErreur(''); }} placeholder={t('auth.confirmPasswordPlaceholder', 'Retapez votre mot de passe')} placeholderTextColor={THEME.faint} secureTextEntry={!voirMdp} textContentType="newPassword" style={styles.pwdInput} />
            </View>
          </View>
          <Text numberOfLines={2} style={{ fontSize: 12, color: THEME.faint, marginTop: -4, marginBottom: 10, lineHeight: 17 }}>
            {t('auth.passwordRuleHint', '8 caractères minimum, avec une minuscule, une majuscule, un chiffre et un caractère spécial (@$!%*?&).')}
          </Text>
          {bouton(t('auth.forgotSavePwd', 'Enregistrer le mot de passe'), enregistrer)}
        </>
      )}
    </>
  );
}
