import React from "react";
import { getIncomingRequests, respondRequest, getBlocks, blockUserById, unblockUser } from "../../services/sharedLists";
import { getTokens } from "../../services/api";
import Modal from '../../components/DeuxEcrans';
import { View, Text, TouchableOpacity, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "../../components/ui/IoniconsSens";
import { SERIF, TAILLES } from "../../components/ui/marche";
import { THEME } from "../../components/commun/theme";
import { profStyles } from "../profile/profStyles";

// Partage de listes : demandes reçues + utilisateurs bloqués
export function useDemandesPartage(t) {
  const [shareRequests, setShareRequests] = React.useState([]);
  const [blockedUsers, setBlockedUsers] = React.useState([]);
  const [shareRequestsVisible, setShareRequestsVisible] = React.useState(false);
  const loadShareData = React.useCallback(async () => {
    try {
      const tok = await getTokens();
      if (!tok) { setShareRequests([]); setBlockedUsers([]); return; }
      const [inc, blk] = await Promise.all([getIncomingRequests(), getBlocks()]);
      if (inc && inc.status) setShareRequests(inc.data?.requests || []);
      if (blk && blk.status) setBlockedUsers(blk.data?.blocked || []);
    } catch {}
  }, []);
  React.useEffect(() => { loadShareData(); }, [loadShareData]);
  // Exécute une action de partage avec retour d'erreur (les appels API ne throwent
  // pas sur non-2xx : on vérifie res.status et on prévient l'utilisateur si échec).
  const runShareAction = async (fn) => {
    try {
      const res = await fn();
      if (res && res.status === false) {
        Alert.alert(t('listScreen.shareFailedTitle', 'Échec'), (res && res.message) || t('listScreen.shareActionFailed', "L'action n'a pas pu être effectuée."));
      }
    } catch {
      Alert.alert(t('listScreen.shareFailedTitle', 'Échec'), t('auth.errorNetwork', 'Connexion au serveur impossible.'));
    }
    loadShareData();
  };
  return { shareRequests, setShareRequests, blockedUsers, setBlockedUsers, shareRequestsVisible, setShareRequestsVisible, loadShareData, runShareAction };
}

// Fenêtre « Partage de listes » (version invité et version connectée, inchangées).
export function DemandesPartageModale({ t, partage, invite }) {
  const { shareRequests, blockedUsers, shareRequestsVisible, setShareRequestsVisible, runShareAction } = partage;
  if (invite) return (
        <Modal visible={shareRequestsVisible} animationType="slide" onRequestClose={() => setShareRequestsVisible(false)}>
          <SafeAreaView style={{ flex:1, backgroundColor:THEME.bg }}>
            <View style={{ flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:THEME.border }}>
              <TouchableOpacity onPress={() => setShareRequestsVisible(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                <Ionicons name="arrow-back" size={24} color={THEME.ink} />
              </TouchableOpacity>
              <Text style={{ marginLeft:12, fontSize:18, fontFamily: SERIF, fontWeight:'600', color:THEME.ink }}>{t('profile.listShares', 'Partage de listes')}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding:16 }}>
              <Text style={profStyles.sectionTitle}>{t('profile.pendingRequestsTitle', 'Demandes reçues')}</Text>
              {shareRequests.length === 0 && <Text style={{ color:THEME.faint, marginBottom:16 }}>{t('profile.noRequests', 'Aucune demande pour le moment.')}</Text>}
              {shareRequests.map((r) => (
                <View key={String(r.request_id)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                  <Ionicons name="person-circle-outline" size={34} color={THEME.brandDark} />
                  <Text style={{ flex:1, marginHorizontal:10, fontWeight:'700', color:THEME.ink }} numberOfLines={1}>{r.from?.name || '-'}</Text>
                  <TouchableOpacity onPress={() => runShareAction(() => respondRequest(r.request_id, 'accept'))} style={{ borderWidth: 1, borderColor: THEME.borderInput, backgroundColor:THEME.card, borderRadius:TAILLES.rayonBouton, paddingHorizontal:14, height:TAILLES.boutonPetit, alignItems:'center', justifyContent:'center', marginRight:6 }}>
                    <Text style={{ color:THEME.ink, fontWeight:'700', fontSize:13 }}>{t('profile.accept', 'Accepter')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => runShareAction(() => respondRequest(r.request_id, 'reject'))} style={{ padding:6, marginRight:2 }}>
                    <Ionicons name="close" size={20} color={THEME.faint} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { if (r.from?.id) runShareAction(() => blockUserById(r.from.id)); }} style={{ padding:6 }}>
                    <Ionicons name="ban-outline" size={20} color={THEME.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={[profStyles.sectionTitle, { marginTop:24 }]}>{t('profile.blockedUsers', 'Utilisateurs bloqués')}</Text>
              {blockedUsers.length === 0 && <Text style={{ color:THEME.faint }}>{t('profile.noBlocked', 'Aucun utilisateur bloqué.')}</Text>}
              {blockedUsers.map((u) => (
                <View key={String(u.id)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                  <Ionicons name="ban" size={22} color={THEME.danger} />
                  <Text style={{ flex:1, marginHorizontal:10, color:THEME.ink }} numberOfLines={1}>{u.name || u.username}</Text>
                  <TouchableOpacity onPress={() => runShareAction(() => unblockUser(u.username))} style={{ borderWidth:1, borderColor:THEME.borderInput, backgroundColor:THEME.card, borderRadius:TAILLES.rayonBouton, paddingHorizontal:14, height:TAILLES.boutonPetit, alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ color:THEME.ink, fontWeight:'700', fontSize:13 }}>{t('profile.unblock', 'Débloquer')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
  );
  return (
      <Modal visible={shareRequestsVisible} animationType="slide" onRequestClose={() => setShareRequestsVisible(false)}>
        <SafeAreaView style={{ flex:1, backgroundColor:THEME.bg }}>
          <View style={{ flexDirection:'row', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:THEME.border }}>
            <TouchableOpacity onPress={() => setShareRequestsVisible(false)} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Ionicons name="arrow-back" size={24} color={THEME.ink} />
            </TouchableOpacity>
            <Text style={{ marginLeft:12, fontSize:18, fontFamily: SERIF, fontWeight:'600', color:THEME.ink }}>{t('profile.listShares', 'Partage de listes')}</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding:16 }}>
            <Text style={profStyles.sectionTitle}>{t('profile.pendingRequestsTitle', 'Demandes reçues')}</Text>
            {shareRequests.length === 0 && <Text style={{ color:THEME.faint, marginBottom:16 }}>{t('profile.noRequests', 'Aucune demande pour le moment.')}</Text>}
            {shareRequests.map((r) => (
              <View key={String(r.request_id)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                <Ionicons name="person-circle-outline" size={34} color={THEME.brandDark} />
                <Text style={{ flex:1, marginHorizontal:10, fontWeight:'700', color:THEME.ink }} numberOfLines={1}>{r.from?.name || '-'}</Text>
                <TouchableOpacity onPress={() => runShareAction(() => respondRequest(r.request_id, 'accept'))} style={{ borderWidth: 1, borderColor: '#DCC9B8', backgroundColor:'#FFFFFF', borderRadius:16, paddingHorizontal:14, paddingVertical:8, marginRight:6 }}>
                  <Text style={{ color:'#1C1917', fontWeight:'700', fontSize:13 }}>{t('profile.accept', 'Accepter')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => runShareAction(() => respondRequest(r.request_id, 'reject'))} style={{ padding:6, marginRight:2 }}>
                  <Ionicons name="close" size={20} color={THEME.faint} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (r.from?.id) runShareAction(() => blockUserById(r.from.id)); }} style={{ padding:6 }}>
                  <Ionicons name="ban-outline" size={20} color={THEME.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <Text style={[profStyles.sectionTitle, { marginTop:24 }]}>{t('profile.blockedUsers', 'Utilisateurs bloqués')}</Text>
            {blockedUsers.length === 0 && <Text style={{ color:THEME.faint }}>{t('profile.noBlocked', 'Aucun utilisateur bloqué.')}</Text>}
            {blockedUsers.map((u) => (
              <View key={String(u.id)} style={{ flexDirection:'row', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor:THEME.border }}>
                <Ionicons name="ban" size={22} color={THEME.danger} />
                <Text style={{ flex:1, marginHorizontal:10, color:THEME.ink }} numberOfLines={1}>{u.name || u.username}</Text>
                <TouchableOpacity onPress={() => runShareAction(() => unblockUser(u.username))} style={{ borderWidth:1, borderColor:THEME.borderInput, backgroundColor:THEME.card, borderRadius:TAILLES.rayonBouton, paddingHorizontal:14, height:TAILLES.boutonPetit, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ color:THEME.ink, fontWeight:'700', fontSize:13 }}>{t('profile.unblock', 'Débloquer')}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
  );
}
