import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function CurrencyPicker({ visible, onClose, currentCurrency, onSelectCurrency, currencies }) {
  const { t } = useTranslation();
  const [pendingCurrency, setPendingCurrency] = useState(null);

  return (
    <Modal visible={visible} animationType="slide" onShow={() => setPendingCurrency(null)}>
      <SafeAreaView style={{ flex:1, backgroundColor:'#F8FAFC' }}>
        <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' }}>
          <TouchableOpacity onPress={() => { setPendingCurrency(null); onClose(); }} style={{ marginRight:12 }}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </TouchableOpacity>
          <Text style={{ fontSize:18, fontWeight:'800', color:'#111', flex:1 }}>{t('profile.currency')}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
          {currencies.map(curr => {
            const isSelected = pendingCurrency === curr.code || (!pendingCurrency && currentCurrency === curr.code);
            return (
              <TouchableOpacity key={curr.code} onPress={() => setPendingCurrency(curr.code)} style={{
                flexDirection:'row', alignItems:'center', backgroundColor: isSelected ? '#E0F7F1' : '#fff',
                borderRadius:12, padding:16, marginBottom:8,
                borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? '#00C29B' : '#E5E7EB'
              }}>
                <Text style={{ fontSize:24, marginRight:14 }}>{curr.flag}</Text>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:16, fontWeight: isSelected ? '800' : '500', color: isSelected ? '#00C29B' : '#111' }}>{curr.name}</Text>
                  <Text style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{curr.code}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color="#00C29B" />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Confirm button */}
        <SafeAreaView style={{ backgroundColor:'#F8FAFC' }}>
          <View style={{ paddingHorizontal:16, paddingVertical:12 }}>
            <TouchableOpacity onPress={() => {
              const code = pendingCurrency || currentCurrency;
              onSelectCurrency(code);
              setPendingCurrency(null);
              onClose();
            }} style={{
              height:50, borderRadius:14, backgroundColor: pendingCurrency ? '#00C29B' : '#9CA3AF',
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
