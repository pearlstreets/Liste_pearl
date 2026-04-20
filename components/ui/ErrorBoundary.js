import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

// Top-level safety net. If any descendant throws during render, lifecycle,
// or event handlers, this shows a recoverable fallback instead of a white
// screen. Async errors (rejected promises) are NOT caught by React error
// boundaries - services/* already handle those with try/catch + fallback.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log for debugging - in production this could ship to a crash reporter
    console.log('ErrorBoundary caught:', error?.message, info?.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = this.props.t;
    const title = t ? t('errorBoundary.title') : 'Something went wrong';
    const message = t
      ? t('errorBoundary.message')
      : 'The app hit an unexpected error. Your data is safe on this device.';
    const retry = t ? t('errorBoundary.retry') : 'Try again';

    return (
      <ScrollView
        contentContainerStyle={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          backgroundColor: '#FFFFFF',
        }}
      >
        <View style={{ alignItems: 'center', maxWidth: 340 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              color: '#111827',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: '#6B7280',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            {message}
          </Text>
          <TouchableOpacity
            onPress={this.reset}
            style={{
              backgroundColor: '#00C29B',
              paddingVertical: 12,
              paddingHorizontal: 32,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>{retry}</Text>
          </TouchableOpacity>
          {__DEV__ && this.state.error ? (
            <Text
              style={{
                fontSize: 11,
                color: '#9CA3AF',
                marginTop: 24,
                textAlign: 'center',
                fontFamily: 'monospace',
              }}
            >
              {String(this.state.error?.message || this.state.error)}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    );
  }
}
