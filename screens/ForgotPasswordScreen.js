import React from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { forgotPassword as apiForgotPassword, resetPassword as apiResetPassword } from '../services/auth';
import { BRAND } from '../constants/brand';

// 3 internal stages: 'email' → request code | 'reset' → enter code + new pwd
// | 'done' → success. Wires services/auth.js forgotPassword / resetPassword.
export default function ForgotPasswordScreen({ onBack }) {
  const { t } = useTranslation();
  const [stage, setStage] = React.useState('email');
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [newPwd, setNewPwd] = React.useState('');
  const [confirmPwd, setConfirmPwd] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const mapHttpError = (result) => {
    // services/auth wrappers return {status, message} — no throw on API errors.
    // Network/timeouts will throw though. Use generic mapping.
    const msg = String(result?.message || '').toLowerCase();
    if (result?.status === false && /not\s*found|introuvable|inconnu/.test(msg)) return t('auth.forgot.emailNotFound');
    if (result?.status === false && /invalid|incorrect|expired/.test(msg)) return t('auth.forgot.codeInvalid');
    if (result?.status === false && /rate|too many|limit/.test(msg)) return t('auth.forgot.rateLimit');
    if (result?.status === false) return result?.message || t('auth.forgot.unexpectedError');
    return t('auth.forgot.unexpectedError');
  };

  const handleSendCode = async () => {
    setError(''); setInfo('');
    const trimmed = email.trim();
    if (!trimmed) { setError(t('auth.errorNoEmail')); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t('auth.errorInvalidEmail') || t('auth.errorNoEmail'));
      return;
    }
    setLoading(true);
    try {
      const result = await apiForgotPassword(trimmed);
      if (result?.status !== false) {
        setInfo(t('auth.forgot.codeSent'));
        setStage('reset');
      } else {
        setError(mapHttpError(result));
      }
    } catch (e) {
      setError(t('auth.forgot.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(''); setInfo('');
    if (code.trim().length < 4) { setError(t('auth.forgot.codeTooShort')); return; }
    if (newPwd.length < 6) { setError(t('auth.errorPasswordLength')); return; }
    if (newPwd !== confirmPwd) { setError(t('auth.errorPasswordMismatch')); return; }
    setLoading(true);
    try {
      const result = await apiResetPassword(email.trim(), code.trim(), newPwd);
      if (result?.status !== false) {
        setStage('done');
      } else {
        setError(mapHttpError(result));
      }
    } catch (e) {
      setError(t('auth.forgot.networkError'));
    } finally {
      setLoading(false);
    }
  };

  if (stage === 'done') {
    return (
      <SafeAreaView style={{flex:1, backgroundColor:'#fff'}}>
        <ScrollView contentContainerStyle={{flexGrow:1, justifyContent:'center', paddingHorizontal:32}}>
          <View style={{alignItems:'center'}}>
            <View style={{width:80, height:80, borderRadius:40, backgroundColor:'#DCFCE7', alignItems:'center', justifyContent:'center', marginBottom:24}}>
              <Ionicons name="checkmark-circle-outline" size={48} color={BRAND} />
            </View>
            <Text style={{fontSize:22, fontWeight:'900', color:'#111', textAlign:'center', marginBottom:12}}>
              {t('auth.forgot.successTitle')}
            </Text>
            <Text style={{fontSize:15, color:'#6B7280', textAlign:'center', lineHeight:22, marginBottom:24}}>
              {t('auth.forgot.successMsg')}
            </Text>
            <TouchableOpacity onPress={onBack}
              style={{height:52, borderRadius:14, backgroundColor:BRAND, alignItems:'center', justifyContent:'center', width:'100%'}}>
              <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('auth.forgot.backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <SafeAreaView style={{flex:1, backgroundColor:'#fff'}}>
        <TouchableOpacity onPress={onBack} style={{paddingHorizontal:16, paddingTop:12}}>
          <Ionicons name="arrow-back" size={26} color="#111" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={{flexGrow:1, justifyContent:'center', paddingHorizontal:24, paddingVertical:20}} keyboardShouldPersistTaps="handled">
          <View style={{alignItems:'center', marginBottom:20}}>
            <Ionicons name="lock-closed-outline" size={44} color={BRAND} style={{marginBottom:6}} />
            <Text style={{fontSize:20, fontWeight:'900', color:'#111'}}>{t('auth.forgot.title')}</Text>
            <Text style={{fontSize:13, color:'#6B7280', textAlign:'center', marginTop:8}}>
              {stage === 'email' ? t('auth.forgot.subtitleEmail') : t('auth.forgot.subtitleReset')}
            </Text>
          </View>

          {error ? (
            <View style={{backgroundColor:'#FEE2E2', borderRadius:10, padding:12, marginBottom:16, flexDirection:'row', alignItems:'center'}}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={{color:'#EF4444', fontSize:13, marginLeft:8, flex:1}}>{error}</Text>
            </View>
          ) : null}

          {info ? (
            <View style={{backgroundColor:'#DCFCE7', borderRadius:10, padding:12, marginBottom:16, flexDirection:'row', alignItems:'center'}}>
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={{color:'#16A34A', fontSize:13, marginLeft:8, flex:1}}>{info}</Text>
            </View>
          ) : null}

          {stage === 'email' && (
            <>
              <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('auth.forgot.emailLabel')}</Text>
              <TextInput value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:15, marginBottom:20, color:'#111'}} />
              <TouchableOpacity onPress={handleSendCode} disabled={loading} style={{height:52, borderRadius:14, backgroundColor: loading ? '#9CA3AF' : BRAND, alignItems:'center', justifyContent:'center'}}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('auth.forgot.sendCode')}</Text>}
              </TouchableOpacity>
            </>
          )}

          {stage === 'reset' && (
            <>
              <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('auth.forgot.codeLabel')}</Text>
              <TextInput value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" maxLength={8} style={{borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, padding:14, fontSize:22, marginBottom:12, color:'#111', letterSpacing:8, textAlign:'center'}} />
              <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('auth.forgot.newPwd')}</Text>
              <View style={{flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, marginBottom:12}}>
                <TextInput value={newPwd} onChangeText={setNewPwd} placeholder="••••••••" secureTextEntry={!showPwd} autoComplete="off" textContentType="oneTimeCode" style={{flex:1, padding:14, fontSize:15, color:'#111'}} />
                <TouchableOpacity onPress={() => setShowPwd(v => !v)} style={{paddingRight:14}}>
                  <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <Text style={{fontSize:13, fontWeight:'600', color:'#374151', marginBottom:4}}>{t('auth.forgot.confirmNewPwd')}</Text>
              <View style={{flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'#E5E7EB', borderRadius:12, marginBottom:20}}>
                <TextInput value={confirmPwd} onChangeText={setConfirmPwd} placeholder="••••••••" secureTextEntry={!showConfirm} autoComplete="off" textContentType="oneTimeCode" style={{flex:1, padding:14, fontSize:15, color:'#111'}} />
                <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={{paddingRight:14}}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={handleReset} disabled={loading} style={{height:52, borderRadius:14, backgroundColor: loading ? '#9CA3AF' : BRAND, alignItems:'center', justifyContent:'center', marginBottom:12}}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('auth.forgot.resetBtn')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setStage('email'); setCode(''); setNewPwd(''); setConfirmPwd(''); setError(''); setInfo(''); }} style={{alignItems:'center', paddingVertical:12}}>
                <Text style={{color:BRAND, fontSize:14, fontWeight:'600', textDecorationLine:'underline'}}>
                  {t('auth.forgot.changeEmail')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
