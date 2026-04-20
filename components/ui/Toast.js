import React from 'react';
import { Animated, Platform, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const BRAND_DEFAULT = '#00C29B';

// Accepts an optional `brand` color override to avoid a cross-file constant dependency.
const Toast = ({ visible, message, brand = BRAND_DEFAULT }) => {
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, message, opacity]);
  if (!visible) return null;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 30,
        left: 20,
        right: 20,
        zIndex: 9999,
        backgroundColor: '#111',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
      }}
    >
      <Ionicons name="checkmark-circle" size={20} color={brand} style={{ marginRight: 8 }} />
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{message}</Text>
    </Animated.View>
  );
};

export default Toast;
