// Carte de suivi live du livreur (type Uber Eats).
// Alimentée par le polling /status/ (services/delivery.getDeliveryStatus) qui
// renvoie driver_lat/lng, pickup/dropoff, eta_minutes/estimated_arrival + une
// alerte de proximité via le statut ('arrived'). react-native-maps est fourni
// par Expo Go (SDK 54) → rendu OK en build natif ET en Go.
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

const BRAND = '#00C29B';

function num(v) {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

// Région englobant tous les points fournis, avec marge.
function regionFor(points) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latDelta = Math.max((maxLat - minLat) * 1.6, 0.01);
  const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.01);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export default function LiveDeliveryMap({ status, t }) {
  const mapRef = useRef(null);
  const tr = (k, d) => (t ? t(k) || d : d);

  const driver = { latitude: num(status?.driver_lat), longitude: num(status?.driver_lng) };
  const pickup = { latitude: num(status?.pickup_lat), longitude: num(status?.pickup_lng) };
  const dropoff = { latitude: num(status?.dropoff_lat), longitude: num(status?.dropoff_lng) };

  const hasDriver = driver.latitude != null && driver.longitude != null;
  const hasPickup = pickup.latitude != null && pickup.longitude != null;
  const hasDropoff = dropoff.latitude != null && dropoff.longitude != null;

  const points = [];
  if (hasDriver) points.push(driver);
  if (hasPickup) points.push(pickup);
  if (hasDropoff) points.push(dropoff);

  // Recentre/refit à chaque déplacement du livreur (suivi fluide).
  useEffect(() => {
    if (mapRef.current && points.length >= 2) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [status?.driver_lat, status?.driver_lng]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasDropoff && !hasDriver) return null; // rien à afficher

  const st = (status?.status || '').toLowerCase();
  const arriving = st === 'arrived';
  const eta = status?.estimated_arrival || (status?.eta_minutes ? `${status.eta_minutes} min` : '');

  return (
    <View style={s.wrap}>
      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={regionFor(points.length ? points : [dropoff])}
        pointerEvents="none"
      >
        {hasPickup && (
          <Marker coordinate={pickup} title={tr('tracking.pickup', 'Boutique')} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.pin, { backgroundColor: '#fff', borderColor: BRAND }]}>
              <Ionicons name="storefront" size={14} color={BRAND} />
            </View>
          </Marker>
        )}
        {hasDropoff && (
          <Marker coordinate={dropoff} title={tr('tracking.you', 'Vous')} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.pin, { backgroundColor: '#fff', borderColor: '#111' }]}>
              <Ionicons name="home" size={14} color="#111" />
            </View>
          </Marker>
        )}
        {hasDriver && (
          <Marker coordinate={driver} title={status?.driver_name || tr('tracking.driver', 'Livreur')} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.pin, s.driverPin]}>
              <Ionicons name="bicycle" size={16} color="#fff" />
            </View>
          </Marker>
        )}
        {hasDriver && hasDropoff && (
          <Polyline
            coordinates={[driver, dropoff]}
            strokeColor={BRAND}
            strokeWidth={4}
            lineDashPattern={Platform.OS === 'ios' ? [0] : undefined}
          />
        )}
      </MapView>

      {/* Bandeau ETA / proximité */}
      <View style={s.banner}>
        <Ionicons name={arriving ? 'location' : 'time-outline'} size={18} color={BRAND} />
        <Text style={s.bannerTxt}>
          {arriving
            ? tr('tracking.arriving', 'Votre livreur est arrivé')
            : eta
              ? `${tr('tracking.eta', 'Arrivée estimée')} · ${eta}`
              : tr('tracking.onTheWay', 'En route vers vous')}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#e9eef0' },
  map: { width: '100%', height: 200 },
  pin: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  driverPin: { backgroundColor: BRAND, borderColor: '#fff', width: 34, height: 34, borderRadius: 17 },
  banner: {
    position: 'absolute', left: 12, right: 12, bottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  bannerTxt: { fontWeight: '800', fontSize: 14, color: '#111', flex: 1 },
});
