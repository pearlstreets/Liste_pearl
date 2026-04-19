import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BRAND } from '../constants/brand';
import i18n from '../i18n';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (__DEV__) console.warn('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const isFr = (i18n.language || '').startsWith('fr');
      const title = isFr ? 'Une erreur est survenue' : 'An error occurred';
      const subtitle = isFr ? "L'application a rencontré un problème." : 'The application encountered a problem.';
      const retry = isFr ? 'Réessayer' : 'Retry';

      return (
        <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>😵</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8, textAlign: 'center' }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, textAlign: 'center' }}>
            {__DEV__ && this.state.error?.message ? this.state.error.message : subtitle}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            accessibilityRole="button"
            accessibilityLabel={retry}
            style={{ backgroundColor: BRAND, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{retry}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
