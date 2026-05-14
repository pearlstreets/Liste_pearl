/**
 * ListSharing.js — Share your shopping list with friends
 *
 * Local-first (AsyncStorage). No backend required — degrades gracefully.
 * Invite codes are 6-char alphanumeric, human-readable.
 *
 * Keys:
 *   KEY_MY_SHARES   — people I invited to see my list
 *   KEY_JOINED_LISTS — lists I joined via invite code
 */

import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  Alert, ActivityIndicator, Share, Pressable, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { safeParseArray } from '../../utils/safeParse';

export const KEY_MY_SHARES   = 'KEY_MY_SHARES';
export const KEY_JOINED_LISTS = 'KEY_JOINED_LISTS';

const BRAND = '#00C29B';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** 6-char invite code: no ambiguous chars (0/O 1/I/l) */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

async function loadMyShares() {
  try {
    return safeParseArray(await AsyncStorage.getItem(KEY_MY_SHARES));
  } catch (_e) { return []; }
}

async function saveMyShares(shares) {
  try { await AsyncStorage.setItem(KEY_MY_SHARES, JSON.stringify(shares)); }
  catch (_e) {}
}

async function loadJoinedLists() {
  try {
    return safeParseArray(await AsyncStorage.getItem(KEY_JOINED_LISTS));
  } catch (_e) { return []; }
}

async function saveJoinedLists(lists) {
  try { await AsyncStorage.setItem(KEY_JOINED_LISTS, JSON.stringify(lists)); }
  catch (_e) {}
}

// ─── InviteModal ──────────────────────────────────────────────────────────────

function InviteModal({ visible, onClose, ownerPseudo, onInviteCreated }) {
  const { t } = useTranslation();
  const [pseudo, setPseudo]         = React.useState('');
  const [permission, setPermission] = React.useState('read');
  const [code, setCode]             = React.useState(null);
  const [copied, setCopied]         = React.useState(false);

  const reset = () => {
    setPseudo(''); setPermission('read'); setCode(null); setCopied(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleGenerate = async () => {
    const trimmed = pseudo.trim();
    if (!trimmed) {
      Alert.alert(t('shareList.inviteTitle'), t('shareList.pseudoRequired'));
      return;
    }
    const newCode = generateInviteCode();
    const share = {
      id: Date.now().toString(),
      pseudo: trimmed,
      permission,
      status: 'pending',
      code: newCode,
      createdAt: new Date().toISOString(),
    };
    const existing = await loadMyShares();
    await saveMyShares([...existing, share]);
    setCode(newCode);
    onInviteCreated(share);
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: t('shareList.shareMsg', { code, owner: ownerPseudo || '' }),
      });
    } catch (_e) {}
  };

  const handleCopy = () => {
    // Best-effort clipboard — no extra dep
    try {
      const { Clipboard } = require('react-native');
      if (Clipboard?.setString) Clipboard.setString(code);
    } catch (_e) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={handleClose}
      >
        <Pressable
          style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 }}
          onPress={() => {}}
        >
          {/* Handle bar */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e5e5', alignSelf: 'center', marginBottom: 20 }} />

          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 4 }}>
            {t('shareList.inviteTitle')}
          </Text>
          <Text style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
            {t('shareList.inviteSubtitle')}
          </Text>

          {!code ? (
            <>
              {/* Pseudo / email input */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                {t('shareList.pseudoOrEmail')}
              </Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16 }}
                placeholder={t('shareList.pseudoPlaceholder')}
                value={pseudo}
                onChangeText={setPseudo}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* Permission */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                {t('shareList.permission')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                {(['read', 'write']).map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPermission(p)}
                    style={{
                      flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2,
                      borderColor: permission === p ? BRAND : '#e5e7eb',
                      backgroundColor: permission === p ? BRAND + '15' : '#fff',
                      alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Ionicons
                      name={p === 'read' ? 'eye-outline' : 'pencil-outline'}
                      size={16} color={permission === p ? BRAND : '#9ca3af'}
                    />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: permission === p ? BRAND : '#6b7280' }}>
                      {t('shareList.' + (p === 'read' ? 'permRead' : 'permWrite'))}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleGenerate}
                style={{ backgroundColor: BRAND, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('shareList.generate')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Code display */
            <>
              <View style={{ backgroundColor: '#f9fafb', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="key-outline" size={32} color={BRAND} style={{ marginBottom: 10 }} />
                <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, textAlign: 'center' }}>
                  {t('shareList.codeHint')}{'\n'}
                  <Text style={{ fontWeight: '700', color: '#111' }}>{pseudo}</Text>
                </Text>
                <Text style={{ fontSize: 38, fontWeight: '800', letterSpacing: 8, color: '#111', marginBottom: 4 }}>
                  {code}
                </Text>
                <Text style={{ fontSize: 12, color: '#9ca3af' }}>
                  {t('shareList.' + (permission === 'read' ? 'permRead' : 'permWrite'))}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={handleCopy}
                  style={{
                    flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: BRAND,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={BRAND} />
                  <Text style={{ color: BRAND, fontWeight: '600' }}>
                    {copied ? t('shareList.copied') : t('shareList.copy')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleShare}
                  style={{
                    flex: 1, height: 44, borderRadius: 10, backgroundColor: BRAND,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Ionicons name="share-outline" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{t('shareList.share')}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleClose}
                style={{ height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#6b7280', fontWeight: '600' }}>{t('shareList.done')}</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── JoinModal ────────────────────────────────────────────────────────────────

function JoinModal({ visible, onClose, onJoined }) {
  const { t } = useTranslation();
  const [ownerPseudo, setOwnerPseudo] = React.useState('');
  const [code, setCode]               = React.useState('');
  const [loading, setLoading]         = React.useState(false);
  const [success, setSuccess]         = React.useState(false);
  const [joinedEntry, setJoinedEntry] = React.useState(null);

  const reset = () => {
    setOwnerPseudo(''); setCode(''); setLoading(false); setSuccess(false); setJoinedEntry(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleJoin = async () => {
    const cleanCode = code.trim().toUpperCase();
    const cleanPseudo = ownerPseudo.trim();
    if (cleanCode.length < 4) {
      Alert.alert(t('shareList.joinTitle'), t('shareList.codeInvalid'));
      return;
    }
    setLoading(true);
    try {
      const existing = await loadJoinedLists();
      if (existing.some(j => j.code === cleanCode)) {
        setLoading(false);
        Alert.alert(t('shareList.joinTitle'), t('shareList.alreadyJoined'));
        return;
      }
      const entry = {
        code: cleanCode,
        ownerPseudo: cleanPseudo || '?',
        permission: 'read',
        joinedAt: new Date().toISOString(),
      };
      await saveJoinedLists([...existing, entry]);
      setJoinedEntry(entry);
      setSuccess(true);
      onJoined(entry);
    } catch (_e) {
      Alert.alert(t('common.error'), t('shareList.joinError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={handleClose}
      >
        <Pressable
          style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44 }}
          onPress={() => {}}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e5e5', alignSelf: 'center', marginBottom: 20 }} />

          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 4 }}>{t('shareList.joinTitle')}</Text>
          <Text style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>{t('shareList.joinSubtitle')}</Text>

          {!success ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                {t('shareList.ownerPseudo')}
              </Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 14 }}
                placeholder={t('shareList.pseudoPlaceholder')}
                value={ownerPseudo}
                onChangeText={setOwnerPseudo}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>
                {t('shareList.enterCode')}
              </Text>
              <TextInput
                style={{
                  borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, padding: 14,
                  fontSize: 24, fontWeight: '800', letterSpacing: 6, textAlign: 'center', marginBottom: 24,
                }}
                placeholder={t('shareList.codePlaceholder')}
                value={code}
                onChangeText={v => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                autoCapitalize="characters"
                maxLength={6}
              />

              <TouchableOpacity
                onPress={handleJoin}
                disabled={loading}
                style={{ backgroundColor: BRAND, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{t('shareList.joinBtn')}</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Ionicons name="checkmark-circle" size={60} color={BRAND} style={{ marginBottom: 14 }} />
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                {t('shareList.joined')}
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 28 }}>
                {t('shareList.joinedMsg', { owner: joinedEntry?.ownerPseudo || '?' })}
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={{ backgroundColor: BRAND, borderRadius: 12, height: 44, paddingHorizontal: 36, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('shareList.done')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── ListSharingSection — main export ─────────────────────────────────────────

/**
 * @param {string}   ownerPseudo  — current user's pseudo (shown in share message)
 * @param {Function} requireAuth  — if provided, called instead of opening modals when not logged in
 */
export function ListSharingSection({ ownerPseudo, requireAuth }) {
  const { t } = useTranslation();
  const [shares, setShares]           = React.useState([]);
  const [joinedLists, setJoinedLists] = React.useState([]);
  const [inviteVisible, setInvite]    = React.useState(false);
  const [joinVisible, setJoin]        = React.useState(false);

  const refresh = React.useCallback(async () => {
    const [s, j] = await Promise.all([loadMyShares(), loadJoinedLists()]);
    setShares(s);
    setJoinedLists(j);
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const openInvite = () => requireAuth ? requireAuth() : setInvite(true);
  const openJoin   = () => requireAuth ? requireAuth() : setJoin(true);

  const removeShare = (id) => {
    Alert.alert(t('shareList.removeTitle'), t('shareList.removeMsg'), [
      { text: t('shareList.cancel'), style: 'cancel' },
      {
        text: t('shareList.remove'), style: 'destructive',
        onPress: async () => {
          const updated = shares.filter(s => s.id !== id);
          await saveMyShares(updated);
          setShares(updated);
        },
      },
    ]);
  };

  const leaveList = (code) => {
    Alert.alert(t('shareList.leaveTitle'), t('shareList.leaveMsg'), [
      { text: t('shareList.cancel'), style: 'cancel' },
      {
        text: t('shareList.leave'), style: 'destructive',
        onPress: async () => {
          const updated = joinedLists.filter(j => j.code !== code);
          await saveJoinedLists(updated);
          setJoinedLists(updated);
        },
      },
    ]);
  };

  return (
    <View style={{ backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: BRAND + '18', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Ionicons name="people" size={18} color={BRAND} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700' }}>{t('shareList.title')}</Text>
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>{t('shareList.subtitle')}</Text>
        </View>
      </View>

      {/* People I invited */}
      {shares.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
            {t('shareList.sharedWith')}
          </Text>
          {shares.map(share => (
            <View key={share.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 12, padding: 10, marginBottom: 6 }}>
              {/* Avatar */}
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND + '22', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND }}>
                  {(share.pseudo || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', fontSize: 14, color: '#111' }}>{share.pseudo}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                  <View style={{
                    backgroundColor: share.permission === 'write' ? '#fef3c7' : '#dbeafe',
                    borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: share.permission === 'write' ? '#b45309' : '#1d4ed8' }}>
                      {t('shareList.' + (share.permission === 'write' ? 'permWrite' : 'permRead'))}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#f3f4f6', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '600', letterSpacing: 1 }}>{share.code}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={() => removeShare(share.id)} style={{ padding: 6 }}>
                <Ionicons name="close-circle" size={22} color="#fca5a5" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Lists I've joined */}
      {joinedLists.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
            {t('shareList.joinedLists')}
          </Text>
          {joinedLists.map(j => (
            <View key={j.code} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 12, padding: 10, marginBottom: 6 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#bbf7d0', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Ionicons name="list" size={17} color="#16a34a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '600', fontSize: 14, color: '#111' }}>{j.ownerPseudo}</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{t('shareList.permRead')} · {j.code}</Text>
              </View>
              <TouchableOpacity onPress={() => leaveList(j.code)} style={{ padding: 6 }}>
                <Ionicons name="exit-outline" size={20} color="#fca5a5" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* No shares yet — empty hint */}
      {shares.length === 0 && joinedLists.length === 0 && !requireAuth && (
        <Text style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', marginVertical: 10 }}>
          {t('shareList.noShares')}
        </Text>
      )}

      {/* CTA buttons */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <TouchableOpacity
          onPress={openInvite}
          style={{ flex: 1, height: 42, borderRadius: 10, backgroundColor: BRAND, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <Ionicons name="person-add-outline" size={15} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{t('shareList.invite')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openJoin}
          style={{ flex: 1, height: 42, borderRadius: 10, borderWidth: 1.5, borderColor: BRAND, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          <Ionicons name="enter-outline" size={15} color={BRAND} />
          <Text style={{ color: BRAND, fontWeight: '700', fontSize: 13 }}>{t('shareList.join')}</Text>
        </TouchableOpacity>
      </View>

      <InviteModal
        visible={inviteVisible}
        onClose={() => setInvite(false)}
        ownerPseudo={ownerPseudo}
        onInviteCreated={share => setShares(prev => [...prev, share])}
      />
      <JoinModal
        visible={joinVisible}
        onClose={() => setJoin(false)}
        onJoined={entry => setJoinedLists(prev => [...prev, entry])}
      />
    </View>
  );
}
