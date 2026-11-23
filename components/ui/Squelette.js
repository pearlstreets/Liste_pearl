// Squelettes de chargement : la forme des vraies cartes, en gris doux qui
// pulse, à la place d'un rond d'attente. Boutiques et Comparer.
import React from 'react';
import { View, Animated, StyleSheet, Platform } from 'react-native';
import { THEME } from '../commun/theme';
import { TAILLES } from './marche';

function usePulsation() {
  const valeur = React.useRef(new Animated.Value(0.55)).current;
  React.useEffect(() => {
    const natif = Platform.OS !== 'web';
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(valeur, { toValue: 1, duration: 650, useNativeDriver: natif }),
        Animated.timing(valeur, { toValue: 0.55, duration: 650, useNativeDriver: natif }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [valeur]);
  return valeur;
}

const Bloc = ({ style }) => <View style={[s.bloc, style]} />;

/** Liste des boutiques : carte photo carrée, nom, adresse, pastille. */
export function SqueletteBoutiques({ nombre = 6 }) {
  const opacite = usePulsation();
  return (
    <Animated.View style={{ opacity: opacite, paddingHorizontal: TAILLES.marge, paddingTop: 4 }}
      accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
      {Array.from({ length: nombre }).map((_, i) => (
        <View key={i} style={s.carteBoutique}>
          <Bloc style={s.photo} />
          <View style={{ flex: 1 }}>
            <Bloc style={{ height: 15, width: '62%' }} />
            <Bloc style={{ height: 11, width: '85%', marginTop: 8 }} />
            <Bloc style={{ height: 22, width: 86, borderRadius: 999, marginTop: 10 }} />
          </View>
          <Bloc style={s.rond} />
        </View>
      ))}
    </Animated.View>
  );
}

/** Comparer : carte de boutique avec en-tête et lignes d'articles. */
export function SqueletteComparer({ nombre = 3 }) {
  const opacite = usePulsation();
  return (
    <Animated.View style={{ opacity: opacite }} accessibilityRole="progressbar" accessibilityState={{ busy: true }}>
      {Array.from({ length: nombre }).map((_, i) => (
        <View key={i} style={s.carteComparer}>
          <View style={s.tete}>
            <Bloc style={{ width: 22, height: 22, borderRadius: 6 }} />
            <Bloc style={{ width: 44, height: 44, borderRadius: 12, marginLeft: 10, marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Bloc style={{ height: 14, width: '58%' }} />
              <Bloc style={{ height: 18, width: 76, borderRadius: 999, marginTop: 8 }} />
            </View>
            <Bloc style={s.rond} />
          </View>
          {[0, 1].map((j) => (
            <View key={j} style={s.ligne}>
              <Bloc style={{ width: 48, height: 48, borderRadius: 12, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Bloc style={{ height: 12, width: j ? '48%' : '70%' }} />
                <Bloc style={{ height: 12, width: 56, marginTop: 8 }} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  bloc: { backgroundColor: THEME.subtle, borderRadius: 6 },
  carteBoutique: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.card, borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: THEME.border },
  photo: { width: 64, height: 64, borderRadius: 16, marginRight: 12 },
  rond: { width: TAILLES.icone, height: TAILLES.icone, borderRadius: TAILLES.icone / 2, marginLeft: 10, alignSelf: 'flex-start' },
  carteComparer: { backgroundColor: THEME.card, borderRadius: 16, padding: 14, marginHorizontal: TAILLES.marge, marginTop: 10, borderWidth: 1, borderColor: THEME.border },
  tete: { flexDirection: 'row', alignItems: 'center' },
  ligne: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
});
