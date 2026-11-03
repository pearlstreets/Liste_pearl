// Visionneuse plein écran d'une photo de recette : photo entière, fermeture par le bouton en haut
// à droite, le bouton retour Android, un glissement vers le bas ou un toucher hors de la photo.
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Image,
  Pressable,
  TouchableOpacity,
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '../ui/IoniconsSens';
import { containRect, shouldDismissSwipe } from '../../lib/menus/photoUrls';
import { T } from './theme';
import useT from './useT';

function useNaturalSize(source) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    setSize(null);
    if (!source) return undefined;
    let vivant = true;
    if (typeof source === 'number') {
      const r = Image.resolveAssetSource && Image.resolveAssetSource(source);
      if (r && r.width && r.height) setSize({ w: r.width, h: r.height });
    } else if (source.uri) {
      Image.getSize(
        source.uri,
        (w, h) => vivant && setSize({ w, h }),
        () => {}
      );
    }
    return () => {
      vivant = false;
    };
  }, [source]);
  return size;
}

const PhotoViewer = memo(function PhotoViewer({ source, visible, onClose }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const natural = useNaturalSize(visible ? source : null);
  const rect = containRect(natural && natural.w, natural && natural.h, width, height);
  const dy = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (visible) dy.setValue(0);
  }, [visible, dy]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => dy.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (shouldDismissSwipe(g.dy, g.vy)) closeRef.current && closeRef.current();
          else Animated.spring(dy, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(dy, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [dy]
  );

  if (!source) return null;
  const fond = dy.interpolate({
    inputRange: [0, 300],
    outputRange: [1, 0.4],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: fond }]} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
        />
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { transform: [{ translateY: dy }] }]}
        >
          {/* La photo garde les touchers pour elle : seul un toucher hors de la photo ferme. */}
          <Pressable
            onPress={() => {}}
            accessible={false}
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
            }}
          >
            <Image
              source={source}
              resizeMode="contain"
              style={{ width: rect.width, height: rect.height }}
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        </Animated.View>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('recipe.photoClose')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[s.close, { top: insets.top + 12, right: insets.right + 16 }]}
        >
          <Ionicons name="close" size={26} color={T.ink} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
});

export default PhotoViewer;

const s = StyleSheet.create({
  // Seul écran à fond sombre de l'onglet : la photo plein écran.
  backdrop: { backgroundColor: 'rgba(12,10,9,0.94)' },
  close: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
