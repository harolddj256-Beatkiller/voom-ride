import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { USE_GOOGLE_MAPS } from './mapsClient';
const { coordinates, pointLabel }=require('./geo.cjs');

// The controlled data is the selected pin, not the map camera. Gestures stay free.
export default function VoomMap({ market, pickup, destination, routeInfo, onChoose,
  style, children, bottomPadding=70, pointTitle='Pickup', controlTop=16 }) {
  const ref=useRef(null); const [ready,setReady]=useState(false); const [error,setError]=useState('');
  const key=[pickup.latitude,pickup.longitude,destination?.latitude,destination?.longitude,routeInfo?.source].join('|');
  function fit() {
    const points=routeInfo?.source==='google' && routeInfo.coordinates.length>1
      ? routeInfo.coordinates : destination ? [coordinates(pickup),coordinates(destination)] : [coordinates(pickup)];
    try {
      if (points.length>1) ref.current?.fitToCoordinates(points, { edgePadding:{ top:80,right:45,bottom:35,left:45 },animated:true });
      else ref.current?.animateToRegion({...coordinates(pickup),latitudeDelta:0.025,longitudeDelta:0.025},400);
    } catch (_) { /* the native map may not be laid out yet; the Fit button retries */ }
  }
  useEffect(() => { if (ready) { const timer=setTimeout(fit,120); return () => clearTimeout(timer); } },[ready,key,bottomPadding]);
  return <View style={style}>
    <MapView ref={ref} style={StyleSheet.absoluteFillObject}
      provider={USE_GOOGLE_MAPS?PROVIDER_GOOGLE:undefined}
      initialRegion={{...market.map,...coordinates(pickup)}}
      onMapReady={() => setReady(true)} onMapLoaded={() => setError('')}
      onError={() => setError('Map unavailable. Use the selected coordinates or retry on a stable connection.')}
      onPress={onChoose ? e => onChoose(e.nativeEvent.coordinate) : undefined}
      onLongPress={onChoose ? e => onChoose(e.nativeEvent.coordinate) : undefined}
      mapPadding={{ top:0,right:0,bottom:bottomPadding,left:0 }}
      showsMyLocationButton={false} toolbarEnabled={false}>
      {/* Real street-map fallback for Expo Go. Google-native builds keep their Google base map. */}
      {!USE_GOOGLE_MAPS && <UrlTile
        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
      />}
      <Marker coordinate={coordinates(pickup)} title={pointTitle} description={pickup.label || pointLabel(pickup)}
        pinColor="#0B2A5B" draggable={!!onChoose}
        onDragEnd={onChoose ? e => onChoose(e.nativeEvent.coordinate) : undefined} />
      {!!destination && <Marker coordinate={coordinates(destination)} title="Destination" description={destination.label} pinColor="#FF7A1A" />}
      {routeInfo?.source==='google' && routeInfo.coordinates.length>1 &&
        <Polyline coordinates={routeInfo.coordinates} strokeWidth={5} strokeColor="#FF7A1A" />}
      {children}
    </MapView>
    <TouchableOpacity accessibilityLabel="Recenter map on selected pins" style={[s.fit,{top:controlTop}]} onPress={fit}>
      <Text style={s.fitText}>{destination?'Fit route':'Recenter'}</Text>
    </TouchableOpacity>
    {!USE_GOOGLE_MAPS && <Text style={s.attribution}>© OpenStreetMap contributors</Text>}
    {!!error && <Text style={s.error}>{error}</Text>}
  </View>;
}
const s=StyleSheet.create({ fit:{position:'absolute',top:16,right:14,backgroundColor:'#fff',borderRadius:20,paddingHorizontal:14,paddingVertical:12,elevation:4},
  fitText:{color:'#111',fontWeight:'700',fontSize:12},attribution:{position:'absolute',bottom:4,left:8,fontSize:9,color:'#394239',backgroundColor:'rgba(255,255,255,0.78)',paddingHorizontal:4,paddingVertical:2},error:{position:'absolute',top:66,left:18,right:18,padding:12,backgroundColor:'#fff',color:'#9a3412',fontSize:12} });
