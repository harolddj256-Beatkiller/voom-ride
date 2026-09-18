import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
const { coordinates, pointLabel } = require('./geo.cjs');

// Browser review fallback. Native iOS/Android builds continue to use VoomMap.js.
export default function VoomMap({ market, pickup, destination, routeInfo, onChoose,
  style, children, controlTop = 16, pointTitle = 'Pickup' }) {
  const chooseNearby = () => {
    if (!onChoose) return;
    const current = coordinates(pickup);
    onChoose({ latitude: current.latitude + 0.0025, longitude: current.longitude + 0.003 });
  };

  return <TouchableOpacity activeOpacity={onChoose ? 0.94 : 1} onPress={chooseNearby}
    disabled={!onChoose} style={[styles.frame, style]}>
    <View style={styles.roadA}/><View style={styles.roadB}/><View style={styles.roadC}/>
    <View style={styles.park}/>
    <Text style={styles.city}>{market.city}</Text>
    <View style={[styles.pin, styles.pickup]}><Text style={styles.pinText}>●</Text></View>
    {!!destination && <View style={[styles.pin, styles.destination]}><Text style={styles.destinationText}>●</Text></View>}
    <View style={styles.caption}>
      <Text style={styles.captionTitle}>{pointTitle}: {pickup.label || pointLabel(pickup)}</Text>
      <Text style={styles.captionText}>{onChoose ? 'Tap map to adjust the pin' : routeInfo?.source === 'google' ? 'Road route preview' : 'Browser review map'}</Text>
    </View>
    <View style={[styles.fit, { top: controlTop }]}><Text style={styles.fitText}>{destination ? 'Fit route' : 'Recenter'}</Text></View>
    {children}
  </TouchableOpacity>;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#e8ebe4', minHeight: 220 },
  roadA: { position: 'absolute', width: '125%', height: 34, backgroundColor: '#fff', top: '38%', left: '-10%', transform: [{ rotate: '-8deg' }] },
  roadB: { position: 'absolute', width: 30, height: '130%', backgroundColor: '#fff', top: '-10%', left: '58%', transform: [{ rotate: '10deg' }] },
  roadC: { position: 'absolute', width: '90%', height: 15, backgroundColor: '#f8f8f5', top: '70%', left: '8%', transform: [{ rotate: '13deg' }] },
  park: { position: 'absolute', width: 150, height: 105, borderRadius: 55, backgroundColor: '#c9dfbd', top: '9%', left: '8%' },
  city: { position: 'absolute', top: '18%', left: '39%', color: '#70766e', fontWeight: '700', fontSize: 15 },
  pin: { position: 'absolute', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff' },
  pickup: { left: '47%', top: '43%', backgroundColor: '#111' },
  destination: { left: '70%', top: '28%', backgroundColor: '#198754' },
  pinText: { color: '#FF7A1A', fontSize: 22, lineHeight: 22 },
  destinationText: { color: '#fff', fontSize: 22, lineHeight: 22 },
  caption: { position: 'absolute', left: 14, right: 14, bottom: 14, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 12, padding: 10 },
  captionTitle: { color: '#111', fontSize: 12, fontWeight: '700' },
  captionText: { color: '#667066', fontSize: 11, marginTop: 2 },
  fit: { position: 'absolute', right: 14, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12 },
  fitText: { color: '#111', fontWeight: '700', fontSize: 12 },
});
