import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/shared';
import { BRAND } from '../constants/brand';

export const Radio = ({ value, onPress, style }) => {
  const Cmp = onPress ? TouchableOpacity : View;
  return (
    <Cmp onPress={onPress} style={[styles.radioOuter, value && { borderColor: BRAND, backgroundColor: BRAND }, style]} accessibilityRole="radio" accessibilityState={{checked: value}}>
      {value ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
    </Cmp>
  );
};
