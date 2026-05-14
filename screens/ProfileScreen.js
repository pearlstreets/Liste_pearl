import React, { useEffect, useState, useCallback } from 'react';
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, Modal, ScrollView, Alert, Image, Platform, KeyboardAvoidingView, Switch, ActivityIndicator, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DeviceEventEmitter } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { getProfile as apiGetProfile, updateProfile as apiUpdateProfile, uploadProfilePhoto, getDocumentStatus } from '../services/profile';
import { logoutUser, updatePassword as apiUpdatePassword } from '../services/auth';
import { getDeliveryStatus, DELIVERY_STATUS, getDeliveryStatusInfo, toggleDriverMode, isDriverMode, getDriverEarnings, canDeliver, getDriverCountry, setDriverCountry, COUNTRY_LIMITS, getCountryLimit } from '../services/delivery';
import { getLocales } from 'expo-localization';
import { BRAND, GUTTER } from '../constants/brand';
import { KEY_AUTH, KEY_PROFILE, KEY_CART, KEY_ORDER_HISTORY, KEY_FAV_SHOPS, KEY_FAV_PRODUCTS, KEY_ACCOUNTS, KEY_ITEMS, KEY_SELECTED, KEY_FAVS } from '../constants/storageKeys';
import { ProductThumb } from '../constants/productImages';
import { CURRENCIES } from '../constants/currencies';
import { LANGUAGES } from '../constants/languages';
import LanguagePicker from '../components/LanguagePicker';
import CurrencyPicker from '../components/CurrencyPicker';
import CurrencyContext from '../context/CurrencyContext';

const useCurrency = () => React.useContext(CurrencyContext);

const CTRL = 22;
const Square = ({ value, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[{ width:CTRL, height:CTRL, borderRadius:6, borderWidth:1, borderColor:'#CBD5E1', alignItems:'center', justifyContent:'center' }, value && { backgroundColor:BRAND, borderColor:BRAND }]}>
    {value ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
  </TouchableOpacity>
);

function ProfileScreen({ onLogout, isGuest = false, onLogin }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const { currency, setCurrency, fmtPrice } = useCurrency();
  const navigation = useNavigation();
  const [profile, setProfile] = React.useState({ nom: '', prenom: '', pseudo: '', photo: null });
  const [editVisible, setEditVisible] = React.useState(false);
  const [editNom, setEditNom] = React.useState('');
  const [editPrenom, setEditPrenom] = React.useState('');
  const [editPseudo, setEditPseudo] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [showPwdChange, setShowPwdChange] = React.useState(false);
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [pwdError, setPwdError] = React.useState('');
  const [pwdSuccess, setPwdSuccess] = React.useState('');
  const [orders, setOrders] = React.useState([]);
  const [allOrdersVisible, setAllOrdersVisible] = React.useState(false);
  const [detailOrder, setDetailOrder] = React.useState(null);
  const [reorderVisible, setReorderVisible] = React.useState(false);
  const [reorderItems, setReorderItems] = React.useState([]); // [{...item, selected: true/false}]
  const [langVisible, setLangVisible] = React.useState(false);
  const [currencyVisible, setCurrencyVisible] = React.useState(false);
  const [addressVisible, setAddressVisible] = React.useState(false);
  const [addressPickerVisible, setAddressPickerVisible] = React.useState(false);
  const [editingAddressId, setEditingAddressId] = React.useState(null);
  const [editAddress, setEditAddress] = React.useState('');
  const [editAddressSupplement, setEditAddressSupplement] = React.useState('');
  const [editCity, setEditCity] = React.useState('');
  const [editPostalCode, setEditPostalCode] = React.useState('');
  const [editCountry, setEditCountry] = React.useState('');
  const [geoLoading, setGeoLoading] = React.useState(false);
  const [driverInfoVisible, setDriverInfoVisible] = React.useState(false);
  const [showAllCountries, setShowAllCountries] = React.useState(false);
  const userCountryCode = React.useMemo(() => {
    try {
      const locales = getLocales();
      const region = locales?.[0]?.regionCode?.toUpperCase();
      return region && COUNTRY_LIMITS[region] ? region : 'FR';
    } catch { return 'FR'; }
  }, []);
  const [docStatuses, setDocStatuses] = React.useState(null);
  const [driverMode, setDriverMode] = React.useState(false);
  const [driverCountry, setDriverCountryState] = React.useState('FR');
  const [driverEarnings, setDriverEarnings] = React.useState({ total_year: 0, remaining: 3000, limit: 3000 });
  const [driverBlocked, setDriverBlocked] = React.useState(false);

  const loadProfile = React.useCallback(async () => {
    let p = null;
    try {
      const apiProfile = await apiGetProfile();
      if (apiProfile && apiProfile.id) p = apiProfile;
    } catch(e) {}
    if (!p) {
      try {
        const raw = await AsyncStorage.getItem(KEY_PROFILE);
        if (raw) p = JSON.parse(raw);
      } catch(e) {}
    }
    if (p) {
      // Migrate old single-address format to addresses array
      if (!p.addresses || !Array.isArray(p.addresses) || p.addresses.length === 0) {
        if (p.address) {
          const migId = '1';
          p = { ...p, addresses: [{ id: migId, address: p.address, addressSupplement: p.addressSupplement || '', city: p.city || '', postalCode: p.postalCode || '', country: p.country || '' }], selectedAddressId: migId };
        } else {
          p = { ...p, addresses: [], selectedAddressId: null };
        }
      }
      // Preserve local selectedAddressId if valid
      const prevRaw = await AsyncStorage.getItem(KEY_PROFILE).catch(() => null);
      if (prevRaw) {
        const prev = JSON.parse(prevRaw);
        if (prev.selectedAddressId && p.addresses.some(a => a.id === prev.selectedAddressId)) {
          p.selectedAddressId = prev.selectedAddressId;
        }
      }
      setProfile(p);
    }
  }, []);
  const activeAddress = React.useMemo(() => {
    const addrs = profile.addresses || [];
    return addrs.find(a => a.id === profile.selectedAddressId) || addrs[0] || null;
  }, [profile]);
  const loadOrders = React.useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
      if (raw) setOrders(JSON.parse(raw));
    } catch(e) {}
  }, []);

  useFocusEffect(React.useCallback(() => {
    loadProfile(); loadOrders();
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
        const authRaw = await AsyncStorage.getItem(KEY_AUTH);
        const auth = authRaw ? JSON.parse(authRaw) : {};
        if (auth.role === 'professionaluser') {
          const data = await getDocumentStatus();
          if (data && data.status && data.document_status) {
            setDocStatuses(data.document_status);
            if (data.document_status.is_verified) {
              const profRaw = await AsyncStorage.getItem(KEY_PROFILE);
              const prof = profRaw ? JSON.parse(profRaw) : {};
              if (!prof.isVerified) {
                prof.isVerified = true;
                await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(prof));
                setProfile(prof);
              }
            }
          }
        }
      } catch(e) {}
    })();
  }, [loadProfile, loadOrders]));

  const saveProfile = async () => {
    const updated = { ...profile, nom: editNom.trim(), prenom: editPrenom.trim(), pseudo: editPseudo.trim(), email: editEmail.trim() };
    // Try to update on Marketplace backend first
    try {
      await apiUpdateProfile({
        prenom: editPrenom.trim(),
        nom: editNom.trim(),
        pseudo: editPseudo.trim(),
        email: editEmail.trim(),
      });
    } catch(e) {}
    // Also update local accounts as fallback
    try {
      const accRaw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      if (accRaw) {
        const accounts = JSON.parse(accRaw);
        const idx = accounts.findIndex(a => a.email.toLowerCase() === profile.email.toLowerCase());
        if (idx >= 0) {
          accounts[idx].pseudo = editPseudo.trim();
          accounts[idx].nom = editNom.trim();
          accounts[idx].prenom = editPrenom.trim();
          accounts[idx].email = editEmail.trim();
          await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
        }
      }
    } catch(e) {}
    setProfile(updated);
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    setEditVisible(false);
  };

  const saveAddress = async () => {
    const addrData = { address: editAddress.trim(), addressSupplement: editAddressSupplement.trim(), city: editCity.trim(), postalCode: editPostalCode.trim(), country: editCountry.trim() };
    let addresses = [...(profile.addresses || [])];
    let selectedAddressId = profile.selectedAddressId;
    if (editingAddressId) {
      addresses = addresses.map(a => a.id === editingAddressId ? { ...a, ...addrData } : a);
    } else {
      const newId = Date.now().toString();
      addresses.push({ id: newId, ...addrData });
      selectedAddressId = newId;
    }
    const updated = { ...profile, addresses, selectedAddressId };
    setProfile(updated);
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    setAddressVisible(false);
  };
  const deleteAddress = async (id) => {
    let addresses = (profile.addresses || []).filter(a => a.id !== id);
    let selectedAddressId = profile.selectedAddressId;
    if (selectedAddressId === id) selectedAddressId = addresses[0]?.id || null;
    const updated = { ...profile, addresses, selectedAddressId };
    setProfile(updated);
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
  };
  const selectAddress = async (id) => {
    const updated = { ...profile, selectedAddressId: id };
    setProfile(updated);
    await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
    setAddressPickerVisible(false);
  };

  const handleChangePassword = async () => {
    setPwdError(''); setPwdSuccess('');
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) { setPwdError(t('profile.pwdErrorEmpty')); return; }
    if (newPassword !== confirmPassword) { setPwdError(t('profile.pwdErrorMismatch')); return; }
    if (newPassword.length < 6) { setPwdError(t('profile.pwdErrorLength')); return; }
    try {
      // Try Marketplace API first
      const apiResult = await apiUpdatePassword(oldPassword, newPassword);
      if (apiResult.status) {
        setPwdSuccess(t('profile.pwdSuccess'));
        setOldPassword(''); setNewPassword(''); setConfirmPassword('');
        setTimeout(() => { setShowPwdChange(false); setPwdSuccess(''); }, 1500);
        return;
      }
      // Fallback to local accounts
      const accRaw = await AsyncStorage.getItem(KEY_ACCOUNTS);
      if (accRaw) {
        const accounts = JSON.parse(accRaw);
        const idx = accounts.findIndex(a => a.email.toLowerCase() === profile.email.toLowerCase());
        if (idx >= 0) {
          if (accounts[idx].password !== oldPassword) { setPwdError(apiResult.message || t('profile.pwdErrorOld')); return; }
          accounts[idx].password = newPassword;
          await AsyncStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
          setPwdSuccess(t('profile.pwdSuccess'));
          setOldPassword(''); setNewPassword(''); setConfirmPassword('');
          setTimeout(() => { setShowPwdChange(false); setPwdSuccess(''); }, 1500);
        }
      }
    } catch(e) { setPwdError(t('profile.pwdErrorGeneral')); }
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.photoPermissionTitle'), t('profile.photoPermissionMsg'));
      return;
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
      await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(updated));
      // Sync photo with Marketplace backend
      try { await uploadProfilePhoto(uri); } catch(e) {}
    }
  };

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch(e) { return iso; }
  };

  const initials = ((profile?.prenom || '')[0] || '') + ((profile?.nom || '')[0] || '');

  // Track delivery status from API for delivery orders
  const [deliveryStatuses, setDeliveryStatuses] = React.useState({});

  // Poll delivery status for recent delivery orders
  React.useEffect(() => {
    let mounted = true;
    const pollDeliveryStatuses = async () => {
      const recentDeliveryOrders = orders.filter(o => o.mode === 'delivery' && o.deliveryStatus && o.deliveryStatus !== DELIVERY_STATUS.DELIVERED && o.deliveryStatus !== DELIVERY_STATUS.CANCELLED);
      for (const order of recentDeliveryOrders.slice(0, 5)) {
        try {
          const status = await getDeliveryStatus(order.id);
          if (mounted && status && status.status) {
            setDeliveryStatuses(prev => ({ ...prev, [order.id]: status }));
            // Update order in history
            const raw = await AsyncStorage.getItem(KEY_ORDER_HISTORY);
            if (raw) {
              const hist = JSON.parse(raw);
              const idx = hist.findIndex(o => o.id === order.id);
              if (idx >= 0 && hist[idx].deliveryStatus !== status.status) {
                hist[idx].deliveryStatus = status.status;
                hist[idx].driverName = status.driver_name || '';
                hist[idx].driverPhone = status.driver_phone || '';
                hist[idx].estimatedArrival = status.estimated_arrival || '';
                await AsyncStorage.setItem(KEY_ORDER_HISTORY, JSON.stringify(hist));
              }
            }
          }
        } catch(e) {}
      }
    };
    if (orders.length > 0) {
      pollDeliveryStatuses();
      const interval = setInterval(pollDeliveryStatuses, 30000); // Poll every 30s
      const timeout = setTimeout(() => { clearInterval(interval); }, 60000); // Max 60s polling
      return () => { mounted = false; clearInterval(interval); clearTimeout(timeout); };
    }
    return () => { mounted = false; };
  }, [orders]);

  // Get order status - uses delivery API for delivery orders, simulated for collect
  const getOrderStatus = (order) => {
    // For delivery orders, check real delivery status from API
    if (order.mode === 'delivery' && order.deliveryStatus) {
      const apiStatus = deliveryStatuses[order.id];
      if (apiStatus && apiStatus.status) {
        return getDeliveryStatusInfo(apiStatus.status, t);
      }
      // Fallback: use stored delivery status
      return getDeliveryStatusInfo(order.deliveryStatus, t);
    }

    // Simulated status based on time elapsed (collect mode or no delivery tracking)
    const elapsed = Date.now() - (order.id || Date.parse(order.date) || 0);
    const minutes = elapsed / 60000;
    const isCollect = order.mode === 'collect';
    if (minutes < 5) return { step: 0, label: t('orderStatus.confirmed'), color: '#059669', icon: 'checkmark-circle' };
    if (minutes < 15) return { step: 1, label: t('orderStatus.preparing'), color: '#F59E0B', icon: 'storefront' };
    if (minutes < 30) return { step: 2, label: isCollect ? t('orderStatus.ready') : t('orderStatus.onTheWay'), color: isCollect ? '#059669' : '#F97316', icon: isCollect ? 'bag-handle' : 'bicycle' };
    if (minutes < 45) return { step: 3, label: isCollect ? t('orderStatus.waitingPickup') : t('orderStatus.almostThere'), color: '#8B5CF6', icon: isCollect ? 'walk' : 'location' };
    return { step: 4, label: isCollect ? t('orderStatus.collected') : t('orderStatus.delivered'), color: '#059669', icon: 'checkmark-done' };
  };

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
            <View style={{ width:24, height:24, borderRadius:12, backgroundColor:'#00C29B', alignItems:'center', justifyContent:'center' }}>
              <Ionicons name={step.icon} size={12} color="#fff" />
            </View>
            {i < steps.length - 1 && (
              <View style={{ position:'absolute', left:11, top:24, width:2, height:6, backgroundColor:'#00C29B' }} />
            )}
            <Text style={{ fontSize:12, fontWeight:'600', color:'#111', marginLeft:8 }}>{step.label}</Text>
            <Ionicons name="checkmark" size={14} color="#00C29B" style={{ marginLeft:6 }} />
          </View>
        ))}
      </View>
    );
  };

  if (isGuest) {
    return (
      <SafeAreaView style={{ flex:1, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', paddingHorizontal:32 }}>
        <Ionicons name="person-circle-outline" size={72} color="#D1D5DB" />
        <Text style={{ fontSize:22, fontWeight:'800', color:'#111', marginTop:16, textAlign:'center' }}>
          {t('auth.guestProfileTitle') || 'Pas encore connecté'}
        </Text>
        <Text style={{ fontSize:14, color:'#6B7280', marginTop:8, textAlign:'center', lineHeight:20 }}>
          {t('auth.guestProfileHint') || 'Créez un compte ou connectez-vous pour accéder à votre profil, vos commandes et vos livraisons.'}
        </Text>
        <TouchableOpacity onPress={onLogin} style={{ marginTop:28, height:52, borderRadius:14, backgroundColor:'#00C29B', paddingHorizontal:40, alignItems:'center', justifyContent:'center' }}>
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:16 }}>{t('auth.loginBtn') || 'Se connecter'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ paddingBottom:20 }} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <View style={{ alignItems:'center', paddingVertical:24 }}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={{ width:100, height:100, marginBottom:12 }}>
            <View style={{
              width:100, height:100, borderRadius:50, backgroundColor:'#E0F7F1',
              alignItems:'center', justifyContent:'center',
              borderWidth:3, borderColor:'#00C29B', overflow:'hidden'
            }}>
              {profile.photo && (profile.photo.startsWith('/') || profile.photo.startsWith('file')) ? (
                <Image source={{ uri: profile.photo }} style={{ width:100, height:100 }} />
              ) : (
                <Text style={{ fontSize:36, fontWeight:'800', color:'#00C29B' }}>{initials || '👤'}</Text>
              )}
            </View>
            <View style={{ position:'absolute', bottom:0, right:0, width:30, height:30, borderRadius:15,
              backgroundColor:'#00C29B', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'#fff', zIndex:10 }}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize:20, fontWeight:'900', color:'#111' }}>{(profile.prenom || '') + ' ' + (profile.nom || '')}</Text>
          {profile.pseudo ? <Text style={{ fontSize:14, color:'#6B7280', marginTop:2 }}>@{profile.pseudo}</Text> : null}

          <TouchableOpacity onPress={() => { setEditNom(profile?.nom || ''); setEditPrenom(profile?.prenom || ''); setEditPseudo(profile?.pseudo||''); setEditEmail(profile?.email||''); setShowPwdChange(false); setPwdError(''); setPwdSuccess(''); setEditVisible(true); }} style={{
            marginTop:6, paddingHorizontal:20, paddingVertical:10, borderRadius:10,
            backgroundColor:'#00C29B'
          }}>
            <Text style={{ color:'#fff', fontWeight:'700' }}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* Document Verification Status (Pro users) */}
        {profile.role === 'professionaluser' && (
          <View style={{ paddingHorizontal:16, marginBottom:16 }}>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#111', marginBottom:12 }}>
              {t('profile.verificationStatus') || 'Statut de vérification'}
            </Text>
            {!profile.isVerified && (
              <View style={{ backgroundColor:'#FEF3C7', borderRadius:12, padding:14, marginBottom:12, flexDirection:'row', alignItems:'center' }}>
                <Ionicons name="time-outline" size={20} color="#F59E0B" style={{marginRight:10}} />
                <Text style={{ flex:1, fontSize:13, color:'#92400E' }}>{t('profile.verificationPending') || 'Votre compte est en cours de vérification par notre équipe.'}</Text>
              </View>
            )}
            {profile.isVerified && (
              <View style={{ backgroundColor:'#F0FDF4', borderRadius:12, padding:14, marginBottom:12, flexDirection:'row', alignItems:'center' }}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" style={{marginRight:10}} />
                <Text style={{ flex:1, fontSize:13, color:'#065F46', fontWeight:'600' }}>{t('profile.verificationApproved') || 'Compte vérifié'}</Text>
              </View>
            )}
            {docStatuses && (
              <View style={{ backgroundColor:'#fff', borderRadius:12, padding:14, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }}>
                {[
                  { key: 'kbiss_status', label: 'KBISS' },
                  { key: 'iban_status', label: 'IBAN / RIB' },
                  { key: 'identityCardFront_status', label: t('auth.docIdFront') || 'Carte d\'identité (recto)' },
                  { key: 'identityCardBack_status', label: t('auth.docIdBack') || 'Carte d\'identité (verso)' },
                  { key: 'proofOfAddress_status', label: t('auth.docProofAddress') || 'Justificatif de domicile' },
                ].map((doc, i) => {
                  const status = docStatuses[doc.key] || 'pending';
                  const icon = status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time-outline';
                  const color = status === 'approved' ? '#059669' : status === 'rejected' ? '#EF4444' : '#F59E0B';
                  const label = status === 'approved' ? (t('profile.docApproved') || 'Approuvé') : status === 'rejected' ? (t('profile.docRejected') || 'Rejeté') : (t('profile.docPending') || 'En attente');
                  return (
                    <View key={i} style={{ flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor:'#F3F4F6' }}>
                      <Ionicons name={icon} size={18} color={color} style={{marginRight:10}} />
                      <Text style={{ flex:1, fontSize:14, fontWeight:'500', color:'#111' }}>{doc.label}</Text>
                      <Text style={{ fontSize:12, fontWeight:'600', color }}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Order History */}
        <View style={{ paddingHorizontal:16 }}>
          <Text style={{ fontSize:18, fontWeight:'800', color:'#111', marginBottom:12 }}>
            {t('profile.orderHistory')}
          </Text>

          {orders.length === 0 ? (
            <View style={{ backgroundColor:'#fff', borderRadius:12, padding:24, alignItems:'center' }}>
              <Ionicons name="receipt-outline" size={40} color="#E5E7EB" />
              <Text style={{ color:'#9CA3AF', marginTop:8 }}>{t('profile.noOrders')}</Text>
            </View>
          ) : (
            <>
              {orders.slice(0,3).map((order) => {
                const status = getOrderStatus(order);
                return (
                <TouchableOpacity key={order.id} activeOpacity={0.8} onPress={() => setDetailOrder(order)}
                  style={{ backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:10,
                    shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
                  }}>
                  <View style={{ flexDirection:'row', alignItems:'center' }}>
                    <View style={{ width:36, height:36, borderRadius:18, backgroundColor: '#F3F4F6',
                      alignItems:'center', justifyContent:'center', marginRight:10, flexShrink:0 }}>
                      <Ionicons name={status.icon} size={18} color={status.color} />
                    </View>
                    <View style={{flex:1}}>
                      <Text style={{ fontWeight:'700', color:'#111' }} numberOfLines={1}>{t('profile.orderNumber')} #{String(order.id).slice(-4)}</Text>
                      <View style={{ flexDirection:'row', alignItems:'center', marginTop:3 }}>
                        <View style={{ width:8, height:8, borderRadius:4, backgroundColor: status.color, marginRight:6 }} />
                        <Text style={{ fontSize:12, fontWeight:'600', color: status.color }}>{status.label}</Text>
                      </View>
                      {(order.shops && order.shops.length > 0) ? (
                        <Text style={{ fontSize:12, color:'#374151', marginTop:2 }} numberOfLines={1}>{order.shops.join(', ')}</Text>
                      ) : null}
                      <Text style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{fmtDate(order.date)}</Text>
                    </View>
                    <View style={{ alignItems:'flex-end', marginLeft:10, flexShrink:0 }}>
                      <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:6, marginBottom:4,
                        backgroundColor:'#F3F4F6' }}>
                        <Text style={{ fontSize:10, fontWeight:'700', color:'#374151' }}>
                          {order.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                        </Text>
                      </View>
                      <Text style={{ fontWeight:'800', color:'#111', fontSize:15 }}>
                        {fmtPrice(order.total||0)}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{marginTop:4}} />
                    </View>
                  </View>
                </TouchableOpacity>
                );
              })}
              {orders.length > 0 && (
                <TouchableOpacity onPress={() => setAllOrdersVisible(true)} style={{
                  paddingVertical:12, borderRadius:10, backgroundColor:'#00C29B', alignItems:'center', marginTop:4
                }}>
                  <Text style={{ color:'#fff', fontWeight:'700', fontSize:14 }}>{t('profile.openAllHistory')} ({orders.length})</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Address Button */}
        <View style={{ paddingHorizontal:16, marginTop:16 }}>
          <TouchableOpacity onPress={() => setAddressPickerVisible(true)} style={{
            flexDirection:'row', alignItems:'center', justifyContent:'space-between',
            backgroundColor:'#fff', borderRadius:12, padding:14,
            shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
          }}>
            <Text style={{ fontSize:15, fontWeight:'600', color:'#111' }}>{t('profile.deliveryAddress')}</Text>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Text style={{ fontSize:14, color:'#6B7280', marginRight:6 }} numberOfLines={1}>
                {activeAddress ? (activeAddress.address.length > 20 ? activeAddress.address.substring(0,20)+'…' : activeAddress.address) : t('profile.noAddress')}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Language Button */}
        <View style={{ paddingHorizontal:16, marginTop:12 }}>
          <TouchableOpacity onPress={() => setLangVisible(true)} style={{
            flexDirection:'row', alignItems:'center', justifyContent:'space-between',
            backgroundColor:'#fff', borderRadius:12, padding:14,
            shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
          }}>
            <Text style={{ fontSize:15, fontWeight:'600', color:'#111' }}>{t('profile.language')}</Text>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Text style={{ fontSize:14, color:'#6B7280', marginRight:6 }}>
                {(LANGUAGES.find(l => l.code === i18nInstance.language)?.flag || '🌐') + ' ' + (LANGUAGES.find(l => l.code === i18nInstance.language)?.label || i18nInstance.language)}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Currency Button */}
        <View style={{ paddingHorizontal:16, marginTop:12 }}>
          <TouchableOpacity onPress={() => setCurrencyVisible(true)} style={{
            flexDirection:'row', alignItems:'center', justifyContent:'space-between',
            backgroundColor:'#fff', borderRadius:12, padding:14,
            shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
          }}>
            <Text style={{ fontSize:15, fontWeight:'600', color:'#111' }}>{t('profile.currency')}</Text>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Text style={{ fontSize:14, color:'#6B7280', marginRight:6 }}>
                {currency.flag} {currency.code}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Disconnect Button */}
        {/* Become a driver */}
        <View style={{ paddingHorizontal:16, marginTop:16 }}>
          <TouchableOpacity onPress={() => setDriverInfoVisible(true)} style={{
            flexDirection:'row', alignItems:'center',
            backgroundColor:'#fff', borderRadius:12, padding:16,
            borderWidth:1, borderColor:'#E5E7EB',
            shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
          }}>
            <Ionicons name="bicycle" size={22} color={BRAND} style={{marginRight:12}} />
            <View style={{flex:1}}>
              <Text style={{ fontSize:15, fontWeight:'700', color:'#111' }}>{t('profile.becomeDriver') || 'Devenir livreur'}</Text>
              <Text style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{t('profile.driverSubtitle') || 'Livrez et gagnez un complément de revenu'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View style={{ paddingHorizontal:16, marginTop:16, marginBottom:30 }}>
          <TouchableOpacity onPress={() => {
            Alert.alert(t('profile.logoutTitle'), t('profile.logoutConfirm'), [
              { text: t('profile.cancel'), style: 'cancel' },
              { text: t('profile.logoutAction'), style: 'destructive', onPress: async () => {
                // Sauvegarder les données du compte avant déconnexion
                try {
                  const authRaw = await AsyncStorage.getItem(KEY_AUTH);
                  if (authRaw) {
                    const auth = JSON.parse(authRaw);
                    const userKey = auth.userKey || 'USER_' + auth.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
                    const data = {
                      profile: JSON.parse(await AsyncStorage.getItem(KEY_PROFILE) || 'null'),
                      items: JSON.parse(await AsyncStorage.getItem(KEY_ITEMS) || '[]'),
                      selected: JSON.parse(await AsyncStorage.getItem(KEY_SELECTED) || '[]'),
                      cart: JSON.parse(await AsyncStorage.getItem(KEY_CART) || '[]'),
                      orders: JSON.parse(await AsyncStorage.getItem(KEY_ORDER_HISTORY) || '[]'),
                      favShops: JSON.parse(await AsyncStorage.getItem(KEY_FAV_SHOPS) || '[]'),
                      favs: JSON.parse(await AsyncStorage.getItem(KEY_FAVS) || '[]'),
                    };
                    await AsyncStorage.setItem(userKey + '_DATA', JSON.stringify(data));
                  }
                } catch(e) {}
                // Logout from Marketplace API first (needs tokens)
                try { await logoutUser(); } catch(e) {}
                // Nettoyer les données courantes
                try {
                  await AsyncStorage.multiRemove([KEY_AUTH, KEY_PROFILE, KEY_ORDER_HISTORY, 'MARKETPLACE_TOKENS']);
                  await AsyncStorage.setItem(KEY_ITEMS, JSON.stringify([]));
                  await AsyncStorage.setItem(KEY_SELECTED, JSON.stringify([]));
                  await AsyncStorage.setItem(KEY_CART, JSON.stringify([]));
                  await AsyncStorage.setItem(KEY_FAV_SHOPS, JSON.stringify([]));
                  await AsyncStorage.setItem(KEY_FAVS, JSON.stringify([]));
                } catch(e) {}
                if (onLogout) onLogout();
              }}
            ]);
          }} style={{
            paddingVertical:14, borderRadius:12,
            backgroundColor:'#EF4444', alignItems:'center', flexDirection:'row', justifyContent:'center'
          }}>
            <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight:8 }} />
            <Text style={{ fontSize:16, fontWeight:'700', color:'#fff' }}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Driver Info Full Page Modal */}
      <Modal visible={driverInfoVisible} animationType="slide">
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
            <TouchableOpacity onPress={() => setDriverInfoVisible(false)} style={{ marginRight:12, paddingLeft:16 }}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.becomeDriver') || 'Devenir livreur'}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding:20, paddingBottom:40 }}>
            {/* Hero */}
            <View style={{ alignItems:'center', marginBottom:24 }}>
              <View style={{ width:70, height:70, borderRadius:35, backgroundColor:BRAND, alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                <Ionicons name="bicycle" size={36} color="#fff" />
              </View>
              <Text style={{ fontSize:22, fontWeight:'900', color:'#111', textAlign:'center' }}>Pearl Delivery</Text>
              <Text style={{ fontSize:14, color:'#6B7280', marginTop:6, textAlign:'center', lineHeight:20 }}>
                {t('profile.driverInfoDesc') || 'Gagnez un complément de revenu en livrant des commandes dans votre ville.'}
              </Text>
            </View>

            {/* Two types */}
            <Text style={{ fontSize:17, fontWeight:'800', color:'#111', marginBottom:12 }}>{t('profile.driverTypes') || 'Deux façons de livrer'}</Text>

            <View style={{ backgroundColor:'#fff', borderRadius:14, padding:16, marginBottom:12, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }}>
              <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                <Ionicons name="bicycle" size={22} color={BRAND} style={{marginRight:10}} />
                <Text style={{ fontSize:16, fontWeight:'700', color:'#111' }}>{t('profile.driverParticulier') || 'Livreur Particulier'}</Text>
              </View>
              <Text style={{ fontSize:13, color:'#6B7280', lineHeight:20 }}>
                {t('profile.driverParticulierInfo') || 'Aucun statut professionnel requis. Livrez quand vous voulez en complément de revenu, dans la limite du plafond annuel de votre pays.'}
              </Text>
            </View>

            <View style={{ backgroundColor:'#fff', borderRadius:14, padding:16, marginBottom:20, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }}>
              <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
                <Ionicons name="storefront" size={22} color={BRAND} style={{marginRight:10}} />
                <Text style={{ fontSize:16, fontWeight:'700', color:'#111' }}>{t('profile.driverPro') || 'Livreur Pro'}</Text>
              </View>
              <Text style={{ fontSize:13, color:'#6B7280', lineHeight:20 }}>
                {t('profile.driverProInfo') || 'Vous avez un statut professionnel (auto-entrepreneur, société). Pas de limite de revenus. Documents requis : carte d\'identité, IBAN, KBISS.'}
              </Text>
            </View>

            {/* Country limits — user's country first */}
            <Text style={{ fontSize:17, fontWeight:'800', color:'#111', marginBottom:12 }}>{t('profile.driverLimits') || 'Plafonds par pays (particuliers)'}</Text>

            {(() => {
              const myCountry = COUNTRY_LIMITS[userCountryCode];
              const otherEntries = Object.entries(COUNTRY_LIMITS).filter(([code]) => code !== userCountryCode);
              const statusColor = (s) => s === 'ok' ? BRAND : s === 'blocked' ? '#EF4444' : '#F59E0B';
              const statusIcon = (s) => s === 'ok' ? 'checkmark-circle' : s === 'blocked' ? 'close-circle' : 'alert-circle';
              const limitLabel = (c) => c.limit > 0 ? `${c.limit.toLocaleString('fr-FR')} ${c.currency || '€'}/an` : '—';

              return (
                <>
                  {/* Highlighted current country */}
                  <View style={{ backgroundColor:'#fff', borderRadius:14, padding:16, marginBottom:12, borderWidth:2, borderColor:BRAND, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:6, elevation:2 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                      <Text style={{ fontSize:28, marginRight:12 }}>{myCountry.flag}</Text>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize:17, fontWeight:'800', color:'#111' }}>{myCountry.label}</Text>
                        <View style={{ flexDirection:'row', alignItems:'center', marginTop:4 }}>
                          <Ionicons name={statusIcon(myCountry.status)} size={16} color={statusColor(myCountry.status)} style={{marginRight:4}} />
                          <Text style={{ fontSize:15, fontWeight:'700', color: statusColor(myCountry.status) }}>{limitLabel(myCountry)}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={{ fontSize:13, color:'#374151', lineHeight:19 }}>{myCountry.taxInfo}</Text>
                    {myCountry.beyondMsg ? <Text style={{ fontSize:12, color:'#6B7280', marginTop:6, fontStyle:'italic' }}>{myCountry.beyondMsg}</Text> : null}
                  </View>

                  {/* Toggle button for other countries */}
                  <TouchableOpacity onPress={() => setShowAllCountries(!showAllCountries)} style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:10, marginBottom:8 }}>
                    <Ionicons name={showAllCountries ? 'chevron-up' : 'chevron-down'} size={18} color={BRAND} style={{marginRight:6}} />
                    <Text style={{ fontSize:14, fontWeight:'600', color:BRAND }}>{showAllCountries ? (t('profile.hideOtherCountries') || 'Masquer les autres pays') : (t('profile.showOtherCountries') || 'Voir les autres pays')}</Text>
                  </TouchableOpacity>

                  {/* Other countries (collapsed by default) */}
                  {showAllCountries && otherEntries.map(([code, c]) => (
                    <View key={code} style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:10, padding:12, marginBottom:8 }}>
                      <Text style={{ fontSize:20, marginRight:12 }}>{c.flag}</Text>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize:14, fontWeight:'600', color:'#111' }}>{c.label}</Text>
                        <Text style={{ fontSize:11, color:'#6B7280' }}>{c.taxInfo}</Text>
                      </View>
                      <View style={{ alignItems:'flex-end' }}>
                        <Text style={{ fontSize:13, fontWeight:'700', color: statusColor(c.status) }}>{limitLabel(c)}</Text>
                        <Ionicons name={statusIcon(c.status)} size={14} color={statusColor(c.status)} style={{marginTop:2}} />
                      </View>
                    </View>
                  ))}
                </>
              );
            })()}

            {/* CTA */}
            <View style={{ marginTop:20 }}>
              <TouchableOpacity onPress={async () => {
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
                      { text: t('profile.cancel') || 'Annuler', style: 'cancel' },
                      { text: 'App Store', onPress: () => Linking.openURL('https://apps.apple.com/app/pearl-delivery/id000000000') },
                      Platform.OS === 'android' ? { text: 'Google Play', onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=com.pearlstreets.delivery') } : null,
                    ].filter(Boolean)
                  );
                }
              }} style={{ height:52, borderRadius:14, backgroundColor:BRAND, flexDirection:'row', alignItems:'center', justifyContent:'center' }}>
                <Ionicons name="bicycle" size={22} color="#fff" style={{marginRight:10}} />
                <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>{t('profile.openDeliveryApp') || "Ouvrir l'app Pearl Delivery"}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize:11, color:'#9CA3AF', textAlign:'center', marginTop:10 }}>
                {t('profile.driverLegalNote') || "L'inscription se fait directement dans l'app Pearl Delivery. Vous pouvez choisir entre livreur particulier ou professionnel."}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Profile Full Page Modal */}
      <Modal visible={editVisible} animationType="slide">
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
              <TouchableOpacity onPress={() => setEditVisible(false)} style={{ marginRight:12 }}>
                <Ionicons name="arrow-back" size={24} color="#111" />
              </TouchableOpacity>
              <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.editProfile')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding:20 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.pseudo')}</Text>
              <TextInput value={editPseudo} onChangeText={setEditPseudo} placeholder={t('profile.pseudoPlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.firstName')}</Text>
              <TextInput value={editPrenom} onChangeText={setEditPrenom} placeholder={t('profile.firstNamePlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.lastName')}</Text>
              <TextInput value={editNom} onChangeText={setEditNom} placeholder={t('profile.lastNamePlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.email')}</Text>
              <TextInput value={editEmail} onChangeText={setEditEmail} placeholder={t('profile.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none"
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              {/* Password change section */}
              {!showPwdChange ? (
                <TouchableOpacity onPress={() => { setShowPwdChange(true); setPwdError(''); setPwdSuccess(''); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                  style={{ flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:16, borderRadius:10, backgroundColor:'#fff', borderWidth:1, borderColor:'#E5E7EB', marginBottom:24 }}>
                  <Ionicons name="lock-closed-outline" size={18} color="#00C29B" />
                  <Text style={{ fontSize:15, fontWeight:'600', color:'#111', marginLeft:10, flex:1 }}>{t('profile.changePassword')}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <View style={{ backgroundColor:'#fff', borderRadius:10, borderWidth:1, borderColor:'#E5E7EB', padding:16, marginBottom:24 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', marginBottom:14 }}>
                    <Ionicons name="lock-closed-outline" size={18} color="#00C29B" />
                    <Text style={{ fontSize:15, fontWeight:'700', color:'#111', marginLeft:8, flex:1 }}>{t('profile.changePassword')}</Text>
                    <TouchableOpacity onPress={() => setShowPwdChange(false)}>
                      <Ionicons name="close" size={20} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>

                  {pwdError ? (
                    <View style={{ backgroundColor:'#FEE2E2', borderRadius:8, padding:10, marginBottom:12, flexDirection:'row', alignItems:'center' }}>
                      <Ionicons name="alert-circle" size={16} color="#EF4444" />
                      <Text style={{ color:'#EF4444', fontSize:12, marginLeft:6 }}>{pwdError}</Text>
                    </View>
                  ) : null}
                  {pwdSuccess ? (
                    <View style={{ backgroundColor:'#D1FAE5', borderRadius:8, padding:10, marginBottom:12, flexDirection:'row', alignItems:'center' }}>
                      <Ionicons name="checkmark-circle" size={16} color="#059669" />
                      <Text style={{ color:'#059669', fontSize:12, marginLeft:6 }}>{pwdSuccess}</Text>
                    </View>
                  ) : null}

                  <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.oldPassword')}</Text>
                  <TextInput value={oldPassword} onChangeText={setOldPassword} placeholder={t('profile.currentPasswordPlaceholder')} secureTextEntry
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:12, fontSize:15, backgroundColor:'#F8FAFC' }} />

                  <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.newPassword')}</Text>
                  <TextInput value={newPassword} onChangeText={setNewPassword} placeholder={t('profile.newPassword')} secureTextEntry
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:12, fontSize:15, backgroundColor:'#F8FAFC' }} />

                  <Text style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>{t('profile.confirmPassword')}</Text>
                  <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('profile.confirmPassword')} secureTextEntry
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:14, fontSize:15, backgroundColor:'#F8FAFC' }} />

                  <TouchableOpacity onPress={handleChangePassword} style={{
                    paddingVertical:12, borderRadius:10, backgroundColor:'#00C29B', alignItems:'center'
                  }}>
                    <Text style={{ fontWeight:'700', color:'#fff', fontSize:15 }}>{t('profile.validate')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ flexDirection:'row' }}>
                <TouchableOpacity onPress={() => setEditVisible(false)} style={{
                  flex:1, paddingVertical:14, borderRadius:10, borderWidth:1, borderColor:'#E5E7EB',
                  alignItems:'center', marginRight:8, backgroundColor:'#fff'
                }}>
                  <Text style={{ fontWeight:'600', color:'#6B7280' }}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveProfile} style={{
                  flex:1, paddingVertical:14, borderRadius:10, backgroundColor:'#00C29B', alignItems:'center'
                }}>
                  <Text style={{ fontWeight:'700', color:'#fff' }}>{t('profile.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Language Selector */}
      <LanguagePicker
        visible={langVisible}
        onClose={() => setLangVisible(false)}
        currentLang={i18nInstance.language}
        onSelectLang={(lang) => {
          i18nInstance.changeLanguage(lang.code);
          AsyncStorage.setItem('APP_LANGUAGE', lang.code);
        }}
        languages={LANGUAGES}
      />

      {/* Currency Selector */}
      <CurrencyPicker
        visible={currencyVisible}
        onClose={() => setCurrencyVisible(false)}
        currentCurrency={currency?.code}
        onSelectCurrency={(code) => {
          const found = CURRENCIES.find(c => c.code === code);
          if (found) setCurrency(found);
        }}
        currencies={CURRENCIES}
      />

      {/* Address Picker Modal */}
      <Modal visible={addressPickerVisible} animationType="none" transparent={true}>
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'70%', paddingBottom:40 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
              <Text style={{ fontSize:18, fontWeight:'800', color:'#111' }}>{t('profile.deliveryAddress')}</Text>
              <TouchableOpacity onPress={() => setAddressPickerVisible(false)} style={{ padding:6 }}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal:16, paddingVertical:8 }}>
              {(profile.addresses || []).map(addr => (
                <View key={addr.id} style={{ flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
                  <TouchableOpacity onPress={() => selectAddress(addr.id)} style={{ flex:1, flexDirection:'row', alignItems:'center', paddingVertical:14, paddingHorizontal:4 }}>
                    <Ionicons name={profile.selectedAddressId === addr.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={profile.selectedAddressId === addr.id ? '#00C29B' : '#9CA3AF'} style={{ marginRight:12 }} />
                    <View style={{ flex:1 }}>
                      <Text style={{ fontSize:15, fontWeight: profile.selectedAddressId === addr.id ? '700' : '500', color:'#111' }}>{addr.address}</Text>
                      {(addr.city || addr.postalCode) ? <Text style={{ fontSize:13, color:'#6B7280', marginTop:2 }}>{[addr.postalCode, addr.city].filter(Boolean).join(' ')}</Text> : null}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditingAddressId(addr.id); setEditAddress(addr.address||''); setEditAddressSupplement(addr.addressSupplement||''); setEditCity(addr.city||''); setEditPostalCode(addr.postalCode||''); setEditCountry(addr.country||''); setAddressPickerVisible(false); setAddressVisible(true); }} style={{ padding:10 }}>
                    <Ionicons name="pencil-outline" size={18} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteAddress(addr.id)} style={{ padding:10 }}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => { setEditingAddressId(null); setEditAddress(''); setEditAddressSupplement(''); setEditCity(''); setEditPostalCode(''); setEditCountry(''); setAddressPickerVisible(false); setAddressVisible(true); }}
                style={{ flexDirection:'row', alignItems:'center', paddingVertical:16, marginTop:4 }}>
                <Ionicons name="add-circle-outline" size={22} color="#00C29B" style={{ marginRight:10 }} />
                <Text style={{ fontSize:15, fontWeight:'600', color:'#00C29B' }}>{t('profile.addAddress')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delivery Address Full Page Modal */}
      <Modal visible={addressVisible} animationType="slide">
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
              <TouchableOpacity onPress={() => setAddressVisible(false)} style={{ marginRight:12 }}>
                <Ionicons name="arrow-back" size={24} color="#111" />
              </TouchableOpacity>
              <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.deliveryAddress')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding:20 }} keyboardShouldPersistTaps="handled">
              {/* Bouton géolocalisation */}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    setGeoLoading(true);
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                      setGeoLoading(false);
                      Alert.alert(t('profile.locationDenied') || 'Permission refusée', t('profile.locationDeniedMsg') || 'Autorisez la localisation dans les réglages.');
                      return;
                    }
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
                    const results = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                    const r = results && results[0];
                    if (r) {
                      const num = r.streetNumber || '';
                      const street = r.street || r.name || '';
                      setEditAddress((num + ' ' + street).trim());
                      setEditAddressSupplement(r.district || r.subregion || '');
                      setEditCity(r.city || r.region || '');
                      setEditPostalCode(r.postalCode || '');
                      setEditCountry(r.country || '');
                    } else {
                      Alert.alert('Erreur', t('profile.locationError') || 'Adresse introuvable pour cette position.');
                    }
                    setGeoLoading(false);
                  } catch(e) {
                    setGeoLoading(false);
                    Alert.alert('Erreur', t('profile.locationError') || 'Impossible de récupérer la position.');
                  }
                }}
                disabled={geoLoading}
                style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:14, borderRadius:12, backgroundColor: geoLoading ? '#F3F4F6' : '#E0F7F1', marginBottom:20 }}
              >
                {geoLoading ? (
                  <ActivityIndicator color="#00C29B" style={{marginRight:8}} />
                ) : (
                  <Ionicons name="navigate" size={20} color="#00C29B" style={{marginRight:8}} />
                )}
                <Text style={{ fontSize:15, fontWeight:'700', color:'#00C29B' }}>{geoLoading ? (t('profile.locating') || 'Localisation en cours...') : (t('profile.useMyLocation') || 'Utiliser ma position actuelle')}</Text>
              </TouchableOpacity>

              <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.street')}</Text>
              <TextInput value={editAddress} onChangeText={setEditAddress} placeholder={t('profile.streetPlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.addressSupplement')}</Text>
              <TextInput value={editAddressSupplement} onChangeText={setEditAddressSupplement} placeholder={t('profile.supplementPlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:16, fontSize:16, backgroundColor:'#fff' }} />

              <View style={{ flexDirection:'row', gap:12, marginBottom:16 }}>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.postalCode')}</Text>
                  <TextInput value={editPostalCode} onChangeText={setEditPostalCode} placeholder={t('profile.postalCodePlaceholder')} keyboardType="number-pad"
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, fontSize:16, backgroundColor:'#fff' }} />
                </View>
                <View style={{ flex:2 }}>
                  <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.city')}</Text>
                  <TextInput value={editCity} onChangeText={setEditCity} placeholder={t('profile.cityPlaceholder')}
                    style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, fontSize:16, backgroundColor:'#fff' }} />
                </View>
              </View>

              <Text style={{ fontSize:13, fontWeight:'600', color:'#6B7280', marginBottom:4 }}>{t('profile.country')}</Text>
              <TextInput value={editCountry} onChangeText={setEditCountry} placeholder={t('profile.countryPlaceholder')}
                style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12, marginBottom:24, fontSize:16, backgroundColor:'#fff' }} />

              <View style={{ flexDirection:'row' }}>
                <TouchableOpacity onPress={() => setAddressVisible(false)} style={{
                  flex:1, paddingVertical:14, borderRadius:10, borderWidth:1, borderColor:'#E5E7EB',
                  alignItems:'center', marginRight:8, backgroundColor:'#fff'
                }}>
                  <Text style={{ fontWeight:'600', color:'#6B7280' }}>{t('profile.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveAddress} style={{
                  flex:1, paddingVertical:14, borderRadius:10, backgroundColor:'#00C29B', alignItems:'center'
                }}>
                  <Text style={{ fontWeight:'700', color:'#fff' }}>{t('profile.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* All Orders Full Page Modal */}
      <Modal visible={allOrdersVisible} animationType="none">
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
            <TouchableOpacity onPress={() => setAllOrdersVisible(false)} style={{ marginRight:12 }}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.allOrders')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding:16, paddingBottom:40 }}>
            {orders.map((order) => {
              const status = getOrderStatus(order);
              return (
              <TouchableOpacity key={order.id} activeOpacity={0.8} onPress={() => { setAllOrdersVisible(false); setTimeout(() => setDetailOrder(order), 300); }}
                style={{ backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:10,
                  shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1
                }}>
                <View style={{ flexDirection:'row', alignItems:'center' }}>
                  <View style={{ width:36, height:36, borderRadius:18, backgroundColor: '#F3F4F6',
                    alignItems:'center', justifyContent:'center', marginRight:10, flexShrink:0 }}>
                    <Ionicons name={status.icon} size={18} color={status.color} />
                  </View>
                  <View style={{flex:1}}>
                    <Text style={{ fontWeight:'700', color:'#111' }} numberOfLines={1}>{t('profile.orderNumber')} #{String(order.id).slice(-4)}</Text>
                    <View style={{ flexDirection:'row', alignItems:'center', marginTop:3 }}>
                      <View style={{ width:8, height:8, borderRadius:4, backgroundColor: status.color, marginRight:6 }} />
                      <Text style={{ fontSize:12, fontWeight:'600', color: status.color }}>{status.label}</Text>
                    </View>
                    {(order.shops && order.shops.length > 0) ? (
                      <Text style={{ fontSize:12, color:'#374151', marginTop:2 }} numberOfLines={1}>{order.shops.join(', ')}</Text>
                    ) : null}
                    <Text style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{fmtDate(order.date)}</Text>
                  </View>
                  <View style={{ alignItems:'flex-end', marginLeft:10, flexShrink:0 }}>
                    <View style={{ paddingHorizontal:8, paddingVertical:2, borderRadius:6, marginBottom:4,
                      backgroundColor:'#F3F4F6' }}>
                      <Text style={{ fontSize:10, fontWeight:'700', color:'#374151' }}>
                        {order.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                      </Text>
                    </View>
                    <Text style={{ fontWeight:'800', color:'#111', fontSize:15 }}>
                      {fmtPrice(order.total||0)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{marginTop:4}} />
                  </View>
                </View>
              </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Order Detail Full Page Modal */}
      <Modal visible={!!detailOrder} animationType="none">
        <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
          <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
            <TouchableOpacity onPress={() => setDetailOrder(null)} style={{ marginRight:12 }}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>
              {t('profile.orderNumber')} #{detailOrder ? String(detailOrder.id).slice(-4) : ''}
            </Text>
            {detailOrder && (
              <View style={{ paddingHorizontal:10, paddingVertical:4, borderRadius:8,
                backgroundColor:'#D1FAE5' }}>
                <Text style={{ fontSize:11, fontWeight:'700', color:'#059669' }}>
                  {detailOrder.mode === 'collect' ? t('productsScreen.clickAndCollect') : t('cart.delivery')}
                </Text>
              </View>
            )}
          </View>
          {detailOrder && (
            <ScrollView style={{flex:1}} contentContainerStyle={{ padding:20, paddingBottom:20 }}>
              {/* Infos commande */}
              <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:14,
                shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }}>
                <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                  <Ionicons name="calendar-outline" size={16} color="#00C29B" />
                  <Text style={{ fontSize:13, color:'#6B7280', marginLeft:8 }}>{t('profile.orderedOn')}</Text>
                  <Text style={{ fontSize:13, fontWeight:'700', color:'#111', marginLeft:6 }}>{fmtDate(detailOrder.date)}</Text>
                </View>
                {detailOrder.slot ? (
                  <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                    <Ionicons name="time-outline" size={16} color="#00C29B" />
                    <Text style={{ fontSize:13, color:'#6B7280', marginLeft:8 }}>{detailOrder.mode === 'collect' ? t('cart.collect') : t('cart.delivery')}</Text>
                    <Text style={{ fontSize:13, fontWeight:'700', color:'#111', marginLeft:6 }}>
                      {detailOrder.deliveryDate ? detailOrder.deliveryDate + ', ' : ''}{detailOrder.slot}
                    </Text>
                  </View>
                ) : null}
                {detailOrder.mode === 'delivery' && detailOrder.address ? (
                  <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                    <Ionicons name="home-outline" size={16} color="#00C29B" />
                    <Text style={{ fontSize:13, color:'#6B7280', marginLeft:8 }}>{t('profile.address')}</Text>
                    <Text style={{ fontSize:13, fontWeight:'700', color:'#111', marginLeft:6, flex:1 }} numberOfLines={2}>{detailOrder.address}</Text>
                  </View>
                ) : null}
                {detailOrder.mode === 'collect' ? (
                  <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                    <Ionicons name="storefront-outline" size={16} color="#00C29B" />
                    <Text style={{ fontSize:13, color:'#6B7280', marginLeft:8 }}>{t('profile.storePickup')}</Text>
                  </View>
                ) : null}
                {/* Driver info (from Livraison-app) */}
                {detailOrder.mode === 'delivery' && (detailOrder.driverName || deliveryStatuses[detailOrder.id]?.driver_name) ? (
                  <View style={{ backgroundColor:'#F0FDF4', borderRadius:10, padding:12, marginBottom:10, flexDirection:'row', alignItems:'center' }}>
                    <View style={{ width:36, height:36, borderRadius:18, backgroundColor:'#00C29B', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                      <Ionicons name="bicycle" size={18} color="#fff" />
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={{ fontSize:13, fontWeight:'700', color:'#111' }}>
                        {deliveryStatuses[detailOrder.id]?.driver_name || detailOrder.driverName}
                      </Text>
                      <Text style={{ fontSize:12, color:'#6B7280' }}>
                        {deliveryStatuses[detailOrder.id]?.estimated_arrival || detailOrder.estimatedArrival || t('orderStatus.onTheWay')}
                      </Text>
                    </View>
                    {(deliveryStatuses[detailOrder.id]?.driver_phone || detailOrder.driverPhone) ? (
                      <TouchableOpacity style={{ width:36, height:36, borderRadius:18, backgroundColor:'#00C29B', alignItems:'center', justifyContent:'center' }}>
                        <Ionicons name="call" size={16} color="#fff" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
                {/* Coûts */}
                <View style={{ borderTopWidth:1, borderTopColor:'#F3F4F6', paddingTop:10, marginTop:2 }}>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
                    <Text style={{ fontSize:13, color:'#6B7280' }}>{t('profile.subtotal')}</Text>
                    <Text style={{ fontSize:13, fontWeight:'600', color:'#111' }}>{fmtPrice(detailOrder.subtotal != null ? detailOrder.subtotal : (detailOrder.total||0) - (detailOrder.deliveryFee||0))}</Text>
                  </View>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
                    <Text style={{ fontSize:13, color:'#6B7280' }}>{detailOrder.mode === 'delivery' ? t('profile.deliveryFee') : t('profile.collectFee')}</Text>
                    <Text style={{ fontSize:13, fontWeight:'600', color: (detailOrder.deliveryFee||0) === 0 ? '#00C29B' : '#111' }}>
                      {(detailOrder.deliveryFee||0) === 0 ? t('cart.free') : fmtPrice(detailOrder.deliveryFee||0)}
                    </Text>
                  </View>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', borderTopWidth:1, borderTopColor:'#F3F4F6', paddingTop:6, marginTop:4 }}>
                    <Text style={{ fontSize:16, fontWeight:'800', color:'#111' }}>{t('cart.total')}</Text>
                    <Text style={{ fontSize:16, fontWeight:'900', color:'#00C29B' }}>{fmtPrice(detailOrder.total||0)}</Text>
                  </View>
                </View>
              </View>

              {/* Statut actuel */}
              {(() => {
                const status = getOrderStatus(detailOrder);
                return (
                  <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:'#F0FDF4', borderRadius:12, padding:14, marginBottom:12 }}>
                    <View style={{ width:40, height:40, borderRadius:20, backgroundColor: status.color + '20', alignItems:'center', justifyContent:'center', marginRight:12 }}>
                      <Ionicons name={status.icon} size={20} color={status.color} />
                    </View>
                    <View style={{flex:1}}>
                      <Text style={{ fontSize:13, color:'#6B7280' }}>{t('profile.orderTracking')}</Text>
                      <Text style={{ fontSize:16, fontWeight:'700', color: status.color }}>{status.label}</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Produits par shop */}
              <Text style={{ fontSize:16, fontWeight:'800', color:'#111', marginBottom:12, marginTop:8 }}>{t('profile.productDetails')}</Text>
              {(() => {
                const byShop = {};
                (detailOrder.items||[]).forEach(it => {
                  const s = it.shop || '__other__';
                  if (!byShop[s]) byShop[s] = [];
                  byShop[s].push(it);
                });
                return Object.entries(byShop).map(([shop, items]) => (
                  <View key={shop} style={{ backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:12,
                    shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:10 }}>
                      <Ionicons name="storefront-outline" size={16} color="#00C29B" />
                      <Text style={{ fontSize:15, fontWeight:'700', color:'#111', marginLeft:8 }}>{shop === '__other__' ? t('cart.otherShop') : shop}</Text>
                    </View>
                    {items.map((it, idx) => (
                      <View key={idx} style={{ flexDirection:'row', alignItems:'center', paddingVertical:8,
                        borderTopWidth: idx > 0 ? 1 : 0, borderTopColor:'#F3F4F6' }}>
                        <ProductThumb name={it.name||it.title} size={36} />
                        <View style={{ flex:1, marginLeft:10 }}>
                          <Text style={{ fontSize:14, fontWeight:'600', color:'#374151' }} numberOfLines={1}>{it.name||it.title}</Text>
                          <Text style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{t('cart.qty')}: {it.qty||1} × {fmtPrice((it.price||0))}</Text>
                        </View>
                        <Text style={{ fontWeight:'700', color:'#374151', fontSize:14 }}>
                          {fmtPrice((it.price||0)*(it.qty||1))}
                        </Text>
                      </View>
                    ))}
                  </View>
                ));
              })()}

            </ScrollView>
          )}

          {/* Bouton recommander fixe en bas */}
          {detailOrder && (
            <View style={{ paddingHorizontal:20, paddingVertical:12, borderTopWidth:1, borderTopColor:'#F3F4F6', backgroundColor:'#fff' }}>
              <TouchableOpacity
                onPress={() => {
                  const items = (detailOrder.items||[]).map((it, i) => ({
                    id: i,
                    name: it.name || it.title,
                    detail: it.detail || '',
                    unitPrice: it.unitPrice || '',
                    qty: it.qty || 1,
                    price: it.price || 0,
                    shop: it.shop || '',
                    selected: true,
                  }));
                  setReorderItems(items);
                  setReorderVisible(true);
                }}
                style={{ height:50, borderRadius:14, backgroundColor:'#00C29B', flexDirection:'row', alignItems:'center', justifyContent:'center' }}
              >
                <Ionicons name="cart-outline" size={20} color="#fff" style={{marginRight:8}} />
                <Text style={{ color:'#fff', fontWeight:'700', fontSize:16 }}>{t('profile.reorder') || 'Recommander'}</Text>
              </TouchableOpacity>
            </View>
          )}

        </SafeAreaView>
      </Modal>

      {/* Modal sélection recommander — AU MÊME NIVEAU */}
      <Modal visible={reorderVisible} animationType="none" transparent={true}>
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end'}}>
          <View style={{backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'75%', paddingBottom:40}}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, borderBottomWidth:1, borderBottomColor:'#F3F4F6'}}>
              <Text style={{fontSize:18, fontWeight:'800', color:'#111'}}>{t('profile.reorder') || 'Recommander'}</Text>
              <View style={{flexDirection:'row', alignItems:'center'}}>
                <TouchableOpacity onPress={() => {
                  const allSelected = reorderItems.every(it => it.selected);
                  setReorderItems(prev => prev.map(it => ({...it, selected: !allSelected})));
                }} style={{paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:'#F3F4F6', marginRight:10}}>
                  <Text style={{fontSize:12, fontWeight:'600', color:'#374151'}}>{reorderItems.every(it => it.selected) ? t('listScreen.deselectAll') : t('listScreen.selectAll')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setReorderVisible(false)} style={{padding:4}}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={reorderItems}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{padding:16}}
              renderItem={({item}) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setReorderItems(prev => prev.map(it => it.id === item.id ? {...it, selected: !it.selected} : it))}
                  style={{flexDirection:'row', alignItems:'center', padding:12, marginBottom:6, backgroundColor: item.selected ? '#F0FDF4' : '#F9FAFB', borderRadius:10, borderWidth: item.selected ? 1 : 0, borderColor: item.selected ? '#BBF7D0' : 'transparent'}}
                >
                  <Square value={item.selected} onPress={() => setReorderItems(prev => prev.map(it => it.id === item.id ? {...it, selected: !it.selected} : it))} />
                  <View style={{width:8}} />
                  <ProductThumb name={item.name} size={40} />
                  <View style={{flex:1, marginLeft:10}}>
                    <Text style={{fontSize:14, fontWeight:'600', color:'#111'}}>{item.name}</Text>
                    {item.shop ? <Text style={{fontSize:11, color:'#6B7280', marginTop:2}}>{item.shop}</Text> : null}
                  </View>
                  <View style={{alignItems:'flex-end'}}>
                    <Text style={{fontSize:13, fontWeight:'700', color:'#374151'}}>x{item.qty||1}</Text>
                    <Text style={{fontSize:13, fontWeight:'700', color:BRAND, marginTop:2}}>{fmtPrice((item.price||0)*(item.qty||1))}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />

            <View style={{paddingHorizontal:16, gap:8}}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <Text style={{fontSize:15, fontWeight:'700', color:'#111'}}>{t('cart.total') + ' ' + t('cart.totalPrice', {defaultValue: 'prix'})}</Text>
                <Text style={{fontSize:15, fontWeight:'700', color:BRAND}}>{fmtPrice(reorderItems.filter(it => it.selected).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||1)), 0))}</Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  const selected = reorderItems.filter(it => it.selected).map(it => ({
                    name: it.name, detail: it.detail, unitPrice: it.unitPrice,
                    qty: it.qty, price: it.price, shop: it.shop
                  }));
                  if (!selected.length) return;
                  await AsyncStorage.setItem(KEY_CART, JSON.stringify(selected));
                  DeviceEventEmitter.emit('CART_UPDATED');
                  // Close everything at once and navigate
                  setReorderVisible(false);
                  setDetailOrder(null);
                  setAllOrdersVisible(false);
                  navigation.navigate('cart');
                }}
                disabled={!reorderItems.some(it => it.selected)}
                style={{height:50, borderRadius:14, backgroundColor: reorderItems.some(it => it.selected) ? '#00C29B' : '#9CA3AF', flexDirection:'row', alignItems:'center', justifyContent:'center'}}
              >
                <Ionicons name="cart-outline" size={20} color="#fff" style={{marginRight:8}} />
                <Text style={{color:'#fff', fontWeight:'700', fontSize:16}}>{t('cart.addToCart') || 'Ajouter au panier'} ({reorderItems.filter(it => it.selected).reduce((s, it) => s + (it.qty||1), 0)})</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setReorderVisible(false)} style={{height:44, borderRadius:14, borderWidth:1, borderColor:'#ddd', alignItems:'center', justifyContent:'center'}}>
                <Text style={{color:'#666', fontWeight:'600'}}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default ProfileScreen;
