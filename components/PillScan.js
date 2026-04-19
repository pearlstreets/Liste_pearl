import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { styles } from '../styles/shared';
import { BRAND } from '../constants/brand';
import { openCamera } from '../utils/openCamera';

export const PillScan = () => {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={async () => { await openCamera(); }} activeOpacity={0.8} style={styles.scanPill} accessibilityRole="button" accessibilityLabel="Scan">
      <Ionicons name="scan" size={16} color={BRAND} />
      <Text style={styles.scanText}>{t('listScreen.scan')}</Text>
    </TouchableOpacity>
  );
};
