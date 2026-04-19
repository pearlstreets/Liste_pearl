import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function LanguagePicker({ visible, onClose, currentLang, onSelectLang, languages }) {
  const { t } = useTranslation();
  const [pendingLang, setPendingLang] = useState(null);

  return (
    <Modal visible={visible} animationType="slide" onShow={() => setPendingLang(null)}>
      <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
        <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
          <TouchableOpacity onPress={() => { setPendingLang(null); onClose(); }} style={{ marginRight:12 }}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.language')}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
          {languages.map(lang => {
            const isActive = currentLang === lang.code || currentLang.startsWith(lang.code);
            const isSelected = pendingLang === lang.code || (!pendingLang && isActive);
            return (
              <TouchableOpacity key={lang.code} onPress={() => setPendingLang(lang.code)} style={{
                flexDirection:'row', alignItems:'center', backgroundColor: isSelected ? '#E0F7F1' : '#fff',
                borderRadius:12, padding:16, marginBottom:8,
                borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? '#00C29B' : '#E5E7EB'
              }}>
                <Text style={{ fontSize:24, marginRight:14 }}>{lang.flag}</Text>
                <Text style={{ fontSize:16, fontWeight: isSelected ? '800' : '500', color: isSelected ? '#00C29B' : '#111', flex:1 }}>{lang.label}</Text>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color="#00C29B" />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Confirm button */}
        <SafeAreaView style={{ backgroundColor:'#F8FAFC' }}>
          <View style={{ paddingHorizontal:16, paddingVertical:12 }}>
            <TouchableOpacity onPress={() => {
              const lang = pendingLang || currentLang;
              onSelectLang(lang);
              setPendingLang(null);
              onClose();
            }} style={{
              height:50, borderRadius:14, backgroundColor: pendingLang ? '#00C29B' : '#9CA3AF',
              alignItems:'center', justifyContent:'center'
            }}>
              <Text style={{ color:'#fff', fontWeight:'800', fontSize:16 }}>{t('profile.confirm')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}
