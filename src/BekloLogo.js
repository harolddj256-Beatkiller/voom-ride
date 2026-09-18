import React from 'react';
import { Image, Text, View } from 'react-native';
import { C } from './theme';

const MULE = require('../assets/mule.png');

// The Beklo mule head, optionally with the "Beklo" word next to it.
export default function BekloLogo({ size = 28, word = true, color = C.ink, style }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: size * 0.2 }, style]}>
      <Image source={MULE} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="Beklo" />
      {word && <Text style={{ color, fontSize: size * 0.72, fontWeight: '900', letterSpacing: -0.8 }}>Beklo</Text>}
    </View>
  );
}
