import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Platform,
  Linking,
  Share,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import VoomMap from './src/VoomMap';
import { usePickup, withTimeout } from './src/usePickup';
import { useTripRoute } from './src/useTripRoute';
import { useTripPolling } from './src/useTripPolling';
import { usePaymentChannel } from './src/usePaymentChannel';
import { MAPS_CONNECTED, MAPS_SETUP_NOTE, mapsRequest, newSessionToken } from './src/mapsClient';
import { api, API_BASE_URL } from './src/api';
import { SessionProvider, useSession } from './src/session';
import AuthScreen from './src/AuthScreen';
import { C } from './src/theme';
const { MARKETS, PAYMENT_LABELS } = require('./src/markets.cjs');
const { coordinates, pointLabel, distanceKm, estimateFare, validateTrip, inServiceArea, googleDirectionsURL } = require('./src/geo.cjs');
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const STATUS_LABELS = {
  REQUESTED: 'Requested',
  ACCEPTED: 'Driver assigned',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function formatMoney(amount,currency) { return `${currency} ${Math.round(amount).toLocaleString()}`; }

function AppButton({ children, onPress, secondary = false, disabled = false, style }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, secondary && styles.buttonSecondary, disabled && { opacity: 0.45 }, style]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{children}</Text>
    </TouchableOpacity>
  );
}

export default function Root() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}

function Gate() {
  const { user, restoring } = useSession();
  if (restoring) {
    return <SafeAreaView style={[styles.safe, styles.centerAll]}><ActivityIndicator color={C.ink} /></SafeAreaView>;
  }
  if (!API_BASE_URL) {
    return (
      <SafeAreaView style={[styles.safe, styles.centerAll, { paddingHorizontal: 28 }]}>
        <Text style={styles.sheetTitle}>Backend not configured</Text>
        <Text style={styles.muted}>Set EXPO_PUBLIC_VOOM_API_URL to your deployed VOOM backend URL before running the app.</Text>
      </SafeAreaView>
    );
  }
  return user ? <VoomApp /> : <AuthScreen />;
}

function VoomApp() {
  const { user, logout } = useSession();
  const [marketId,setMarketId]=useState('et');
  const market=MARKETS[marketId];
  const [screen,setScreen]=useState('home');
  const [destination,setDestination]=useState({...market.destinations[0]});
  const [selectedRide,setSelectedRide]=useState(market.rideTypes[0].id);
  const [paymentChannelId,selectPaymentChannel]=usePaymentChannel(market);
  const paymentChannel=market.paymentChannels.find(c => c.id===paymentChannelId) || market.paymentChannels[0];
  const [activeTrip,setActiveTrip]=useState(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [marketOpen,setMarketOpen]=useState(false);
  const [paymentOpen,setPaymentOpen]=useState(false);
  const [driverMode,setDriverMode]=useState(false);
  const pickupModel=usePickup(market,changeMarket);
  const pickup=pickupModel.pickup;
  const ride=market.rideTypes.find(r => r.id===selectedRide) || market.rideTypes[0];
  const routeInfo=useTripRoute(market,pickup,destination,ride,screen==='options');
  const chosen={...ride,price:estimateFare(market,ride,routeInfo)};
  useEffect(() => { if (!['home','pickup'].includes(screen)) pickupModel.cancel(); },[screen]);
  function changeMarket(id,point) {
    pickupModel.reset(MARKETS[id],point);
    setMarketId(id); setDestination({...MARKETS[id].destinations[0]});
    setSelectedRide(MARKETS[id].rideTypes[0].id);
    setActiveTrip(null); setScreen('home');
  }
  function exitTrip() { setActiveTrip(null); setScreen('home'); }
  async function requestRide() {
    if (routeInfo.loading || validateTrip(market,pickup,destination)) return;
    try {
      const { trip } = await api.createTrip({
        market: marketId,
        rideType: selectedRide,
        pickup: { latitude: pickup.latitude, longitude: pickup.longitude, label: pickup.label },
        destination: { latitude: destination.latitude, longitude: destination.longitude, label: destination.label },
        distanceMeters: routeInfo.distanceMeters,
        durationSeconds: routeInfo.durationSeconds,
        paymentMethod: paymentChannel.backend,
      });
      setActiveTrip(trip); setScreen('trip');
    } catch (e) {
      Alert.alert('Could not request ride', e.message);
    }
  }
  if (driverMode) return <DriverMode market={market} onExit={() => setDriverMode(false)} />;
  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    {screen==='home' && <Home market={market} pickupModel={pickupModel} setScreen={setScreen}
      setMenuOpen={setMenuOpen} setMarketOpen={setMarketOpen}
      selectPlace={d => {setDestination(d);setScreen('destination-pin');}} />}
    {screen==='search' && <SearchScreen market={market} pickup={pickup} destination={destination}
      onSelect={d => {setDestination(d);setScreen('destination-pin');}}
      onPin={() => setScreen('destination-pin')} onBack={() => setScreen('home')} />}
    {screen==='destination-pin' && <DestinationPin market={market} destination={destination}
      onBack={() => setScreen('search')} onConfirm={d => {setDestination(d);setScreen('pickup');}} />}
    {screen==='pickup' && <PickupConfirm market={market} model={pickupModel} destination={destination}
      onBack={() => {pickupModel.cancel();setScreen('search');}}
      onConfirm={() => {pickupModel.cancel();setScreen('options');}} />}
    {screen==='options' && <RideOptions market={market} pickup={pickup} destination={destination}
      routeInfo={routeInfo} selectedRide={selectedRide} setSelectedRide={setSelectedRide}
      paymentChannel={paymentChannel} setPaymentOpen={setPaymentOpen} chosen={chosen} requestRide={requestRide}
      onBack={() => setScreen('pickup')} />}
    {screen==='trip' && activeTrip && <TripScreen market={market} initialTrip={activeTrip} onDone={exitTrip} onExit={exitTrip} />}
    {screen==='activity' && <ActivityScreen onBack={() => setScreen('home')} />}
    {screen==='wallet' && <WalletScreen market={market} paymentChannelId={paymentChannelId} selectPaymentChannel={selectPaymentChannel} onBack={() => setScreen('home')} />}
    {screen==='account' && <AccountScreen onBack={() => setScreen('home')} />}
    <MenuModal visible={menuOpen} close={() => setMenuOpen(false)} user={user}
      go={next => {setMenuOpen(false);setScreen(next);}}
      driver={() => {pickupModel.cancel();setMenuOpen(false);setDriverMode(true);}} />
    <MarketModal visible={marketOpen} marketId={marketId} setMarketId={changeMarket} close={() => setMarketOpen(false)} />
    <PaymentModal visible={paymentOpen} channels={market.paymentChannels} value={paymentChannelId}
      onChoose={id => {selectPaymentChannel(id);setPaymentOpen(false);}} close={() => setPaymentOpen(false)} />
  </SafeAreaView>;
}
function InfoNotice({text}) {
  return <View style={styles.infoNotice}><Ionicons name="information-circle-outline" size={16} color={C.darkGreen}/>
    <Text style={styles.infoNoticeText}>{text}</Text></View>;
}
function Home({market,pickupModel,setScreen,setMenuOpen,setMarketOpen,selectPlace}) {
  const [sheetHeight,setSheetHeight]=useState(420);
  return <View style={styles.flex}>
    <VoomMap key={market.id} market={market} pickup={pickupModel.pickup}
      style={StyleSheet.absoluteFillObject} bottomPadding={sheetHeight+16} controlTop={95} />
    <View style={styles.floatingTop}>
      <TouchableOpacity style={styles.circleShadow} accessibilityLabel="Open menu" onPress={() => setMenuOpen(true)}><Ionicons name="menu" size={24}/></TouchableOpacity>
      <TouchableOpacity style={styles.cityPill} onPress={() => setMarketOpen(true)}><Ionicons name="location" size={17}/><Text style={styles.cityPillText}>{market.city}</Text><Ionicons name="chevron-down" size={15}/></TouchableOpacity>
      <View style={{width:46}}/>
    </View>
    <View style={styles.logoFloat}><Text style={styles.logo}>VOOM</Text></View>
    <View style={[styles.homeSheet,{maxHeight:'70%'}]} onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.dragHandle}/><Text style={styles.heroTitle}>Where to?</Text>
        <TouchableOpacity style={styles.searchBox} onPress={() => setScreen('search')}>
          <View style={styles.searchDot}/><Text style={styles.searchText}>Enter destination</Text><Ionicons name="arrow-forward" size={20}/>
        </TouchableOpacity>
        <TouchableOpacity style={styles.locationAction} disabled={pickupModel.busy} onPress={pickupModel.locate}>
          <Ionicons name="locate" size={21}/><View style={{flex:1}}><Text style={styles.rideName}>{pickupModel.busy?'Finding location…':'Use my location'}</Text>
            <Text style={styles.mutedSmall}>{pickupModel.status}</Text></View>
        </TouchableOpacity>
        <Text style={styles.homeSectionTitle}>Suggested destinations</Text>
        <View style={styles.recentRow}>{market.destinations.slice(0,2).map(d => <TouchableOpacity key={d.id} style={styles.recentPlace} onPress={() => selectPlace(d)}>
          <View style={styles.recentIcon}><Ionicons name="location-outline" size={18}/></View>
          <View style={{flex:1}}><Text style={styles.recentTitle}>{d.label}</Text><Text style={styles.mutedSmall}>Approximate area • adjust the pin</Text></View>
          <Ionicons name="chevron-forward" size={16}/></TouchableOpacity>)}</View>
      </ScrollView>
      <View style={styles.homeNav}>
        <HomeNavItem icon="home" label="Home" active onPress={() => {}}/>
        <HomeNavItem icon="time-outline" label="Activity" onPress={() => setScreen('activity')}/>
        <HomeNavItem icon="wallet-outline" label="Wallet" onPress={() => setScreen('wallet')}/>
        <HomeNavItem icon="person-outline" label="Account" onPress={() => setScreen('account')}/>
      </View>
    </View>
  </View>;
}
function SearchScreen({market,pickup,destination,onSelect,onPin,onBack}) {
  const [query,setQuery]=useState('');
  const [remote,setRemote]=useState([]);
  const [nativeResults,setNativeResults]=useState([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Search suggested places or choose any point on the map.');
  const session=useRef(newSessionToken()); const generation=useRef(0);
  const request=useRef(null);
  useEffect(() => () => {generation.current++;request.current?.abort();},[]);
  const local=market.destinations.filter(d => d.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => {
    if (!MAPS_CONNECTED || query.trim().length<3) {setRemote([]);return;}
    const run=generation.current; const controller=new AbortController(); request.current=controller;
    const timer=setTimeout(() => {
      setBusy(true); setMessage('Searching Google Places…');
      mapsRequest('/v1/places/autocomplete',{market:market.id,input:query.trim(),sessionToken:session.current},controller.signal)
        .then(data => {if(run===generation.current){setRemote(data.suggestions || []);setMessage('Google Places suggestions');}})
        .catch(e => {if(run===generation.current && e.name!=='AbortError')setMessage(`${e.message} You can still use the map pin.`);})
        .finally(() => {if(run===generation.current)setBusy(false);});
    },450);
    return () => {clearTimeout(timer);controller.abort();};
  },[query,market.id]);
  function edit(text) {
    generation.current++;request.current?.abort();setQuery(text);setRemote([]);setNativeResults([]);setBusy(false);
    setMessage('Search suggested places or choose any point on the map.');
  }
  async function selectGoogle(place) {
    const run=++generation.current; request.current?.abort(); const controller=new AbortController();request.current=controller;setBusy(true);
    try {
      const result=await mapsRequest('/v1/places/details',{market:market.id,placeId:place.placeId,sessionToken:session.current},controller.signal);
      if(run!==generation.current)return;
      session.current=newSessionToken();
      if(!inServiceArea(result,market))throw new Error('This destination is outside the selected service area.');
      onSelect(result);
    } catch(e) {if(run===generation.current)setMessage(e.message);}
    finally {if(run===generation.current)setBusy(false);}
  }
  async function deviceSearch() {
    if(query.trim().length<3 || busy)return;
    const run=++generation.current;request.current?.abort();setBusy(true);setMessage('Looking up address on this device…');
    try {
      if(Platform.OS==='android') {
        const permission=await Location.requestForegroundPermissionsAsync();
        if(permission.status!=='granted')throw new Error('Device address lookup needs location permission. You can still choose a map pin.');
      }
      const rows=await withTimeout(Location.geocodeAsync(`${query.trim()}, ${market.city}, ${market.country}`),10000,'Address lookup timed out. Choose a map pin or retry.');
      if(run!==generation.current)return;
      const results=rows.filter(p => inServiceArea(p,market)).slice(0,5).map((p,i) => ({
        ...coordinates(p),id:`device-${i}`,label:query.trim(),source:'device-geocoder',subtitle:'Device address result • verify the map pin'}));
      setNativeResults(results);setMessage(results.length?'Check the result on the map before confirming.':'No address found in this service area. Choose a point on the map.');
    } catch(e) {if(run===generation.current)setMessage(e.message);}
    finally {if(run===generation.current)setBusy(false);}
  }
  const row=(d,handler=() => onSelect(d)) => <TouchableOpacity key={d.placeId || d.id} style={styles.destinationRow} onPress={handler} disabled={busy}>
    <View style={styles.placeIcon}><Ionicons name="location" size={19}/></View>
    <View style={{flex:1}}><Text style={styles.destinationTitle}>{d.label}</Text><Text style={styles.muted}>{d.subtitle || market.city}</Text></View><Ionicons name="chevron-forward" size={18}/>
  </TouchableOpacity>;
  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScreenHeader title="Plan your ride" onBack={onBack}/>
    <View style={styles.locationCard}><View style={styles.routeDots}><View style={styles.dotBlack}/><View style={styles.routeLine}/><View style={styles.squareBlack}/></View>
      <View style={{flex:1}}><View style={styles.locationInput}><Text numberOfLines={1} style={styles.locationText}>{pickup.label}</Text></View>
        <View style={[styles.locationInput,{marginBottom:0,flexDirection:'row',alignItems:'center'}]}>
          <TextInput accessibilityLabel="Destination search" placeholder="Where to?" value={query} onChangeText={edit} autoCorrect={false} style={styles.textInput}
            returnKeyType="search" onSubmitEditing={deviceSearch}/>
          {!!query && <TouchableOpacity accessibilityLabel="Clear destination search" onPress={() => edit('')}><Ionicons name="close-circle" size={21}/></TouchableOpacity>}
        </View></View></View>
    <Text style={styles.mutedSmall}>{message}</Text>
    {busy && <ActivityIndicator style={{margin:8}} color={C.ink}/>}
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {remote.length>0 && <><Text numberOfLines={1} style={styles.googleAttribution}>Google Maps</Text>{remote.map(d => row(d,() => selectGoogle(d)))}</>}
      {nativeResults.map(d => row(d))}
      <Text style={styles.sectionLabel}>{query?'Matching suggested places':'Suggested places'}</Text>
      {local.map(d => row(d))}
      {!busy && !local.length && !remote.length && !nativeResults.length && <Text style={styles.muted}>No suggested matches. Try device address search or pick a map point.</Text>}
      <AppButton secondary disabled={busy || query.trim().length<3} onPress={deviceSearch}>Search address on device</AppButton>
      <Text style={styles.mutedSmall}>Availability depends on the device and connection; this is not Google Places autocomplete.</Text>
    </ScrollView>
    <AppButton onPress={onPin}>Choose destination on map</AppButton>
  </KeyboardAvoidingView>;
}
function DestinationPin({market,destination,onBack,onConfirm}) {
  const [point,setPoint]=useState({...destination});
  const valid=inServiceArea(point,market);
  return <View style={styles.flex}>
    <VoomMap market={market} pickup={point} pointTitle="Destination" style={{flex:1}} onChoose={p => setPoint({...coordinates(p),label:'Pinned destination',source:'pin'})}/>
    <TouchableOpacity style={[styles.circleShadow,styles.mapBack]} onPress={onBack}><Ionicons name="arrow-back" size={22}/></TouchableOpacity>
    <View style={styles.driverBottom}><Text style={styles.sheetTitle}>Choose your destination</Text>
      <Text style={styles.muted}>Tap the map or drag the pin to the exact entrance.</Text>
      <Text style={styles.destinationTitle}>{point.label}</Text><Text style={styles.mutedSmall}>{pointLabel(point)}</Text>
      {point.source==='google' && <View><Text numberOfLines={1} style={styles.googleAttribution}>Google Maps</Text>{(point.attributions || []).map((a,i) => <Text key={i} style={styles.mutedSmall}>{a.provider || a.displayName || ''}</Text>)}</View>}
      {!valid && <Text style={styles.errorText}>Outside the {market.city} service area.</Text>}
      <AppButton disabled={!valid} onPress={() => onConfirm(point)}>Use this destination</AppButton>
    </View>
  </View>;
}
function PickupConfirm({market,model,destination,onBack,onConfirm}) {
  const error=validateTrip(market,model.pickup,destination);
  return <View style={styles.flex}>
    <VoomMap market={market} pickup={model.pickup} style={{flex:1}} onChoose={model.choose}/>
    <TouchableOpacity style={[styles.circleShadow,styles.mapBack]} onPress={onBack}><Ionicons name="arrow-back" size={22}/></TouchableOpacity>
    <View style={[styles.driverBottom,{maxHeight:'52%'}]}><ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.sheetTitle}>Confirm your pickup</Text><Text style={styles.muted}>Tap the map or drag the pin to a safe pickup point.</Text>
      <View style={styles.pickupAddress}><View style={styles.placeIcon}><Ionicons name="location" size={19}/></View>
        <View style={{flex:1}}><Text style={styles.destinationTitle}>{model.pickup.label}</Text><Text style={styles.mutedSmall}>{pointLabel(model.pickup)}</Text></View></View>
      <Text style={styles.mutedSmall}>{model.status}</Text>
      <View style={styles.dualButtons}>
        <AppButton secondary style={{flex:1}} disabled={model.busy} onPress={model.locate}>Use GPS</AppButton>
        <AppButton secondary style={{flex:1}} disabled={model.busy} onPress={model.resolveAddress}>Find address</AppButton>
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      <AppButton disabled={!!error || model.busy} onPress={onConfirm}>Confirm pickup</AppButton>
    </ScrollView></View>
  </View>;
}
function RouteSummary({info}) {
  if(info.loading)return <View style={styles.infoNotice}><ActivityIndicator color={C.ink}/><Text style={styles.infoNoticeText}>Getting road route…</Text></View>;
  if(info.source==='google')return <View><InfoNotice text={`${(info.distanceMeters/1000).toFixed(1)} km by road • about ${Math.ceil(info.durationSeconds/60)} min`}/><Text numberOfLines={1} style={styles.googleAttribution}>Google Maps</Text></View>;
  return <InfoNotice text={`${(info.distanceMeters/1000).toFixed(1)} km straight-line only • road ETA unavailable`}/>;
}
async function openDirections(pickup,destination) {
  try {await Linking.openURL(googleDirectionsURL(pickup,destination));}
  catch (_) {Alert.alert('Could not open Google Maps','Try again with an internet connection.');}
}
function RideOptions({market,pickup,destination,routeInfo,selectedRide,setSelectedRide,paymentChannel,setPaymentOpen,chosen,requestRide,onBack}) {
  return <View style={styles.flex}>
    <VoomMap market={market} pickup={pickup} destination={destination} routeInfo={routeInfo} style={{height:'30%'}}/>
    <TouchableOpacity style={[styles.circleShadow,styles.mapBack]} onPress={onBack}><Ionicons name="arrow-back" size={22}/></TouchableOpacity>
    <View style={styles.optionsSheet}>
      <Text style={styles.sheetTitle}>Choose a ride</Text><RouteSummary info={routeInfo}/>
      <ScrollView showsVerticalScrollIndicator={false}>
        {MAPS_CONNECTED && routeInfo.source!=='google' && !routeInfo.loading && <AppButton secondary onPress={routeInfo.retry}>Retry road route</AppButton>}
        {market.rideTypes.map(ride => <TouchableOpacity key={ride.id} disabled={routeInfo.loading}
          style={[styles.rideRow,selectedRide===ride.id && styles.rideSelected]} onPress={() => setSelectedRide(ride.id)}>
          <View style={[styles.rideIcon,selectedRide===ride.id && {backgroundColor:C.voom}]}><Ionicons name={ride.icon} size={28}/></View>
          <View style={{flex:1}}><Text style={styles.rideName}>{ride.name}</Text><Text style={styles.mutedSmall}>{ride.seats} seat{ride.seats>1?'s':''}</Text>
            <Text style={styles.rideNote}>{ride.note}</Text></View>
          <View style={{alignItems:'flex-end'}}><Text style={styles.price}>{formatMoney(estimateFare(market,ride,routeInfo),market.currency)}</Text><Text style={styles.mutedSmall}>Estimated fare</Text></View>
        </TouchableOpacity>)}
        <TouchableOpacity style={styles.locationAction} onPress={() => openDirections(pickup,destination)}><Ionicons name="navigate-outline" size={22}/>
          <View style={{flex:1}}><Text style={styles.rideName}>Open in Google Maps</Text><Text style={styles.mutedSmall}>External directions • does not update VOOM's fare</Text></View></TouchableOpacity>
        <TouchableOpacity style={styles.paymentRow} onPress={() => setPaymentOpen(true)}><View style={styles.paymentIcon}><Ionicons name={paymentChannel.icon} size={20}/></View>
          <View style={{flex:1}}><Text style={styles.paymentTitle}>{paymentChannel.label}</Text><Text style={styles.mutedSmall}>Tap to change payment method</Text></View><Ionicons name="chevron-forward" size={18}/></TouchableOpacity>
        {!!routeInfo.validationError && <Text style={styles.errorText}>{routeInfo.validationError}</Text>}
      </ScrollView>
      <AppButton disabled={routeInfo.loading || !!routeInfo.validationError} onPress={requestRide}>Request {chosen.name}</AppButton>
    </View>
  </View>;
}
function DriverCard({ driver }) {
  return (
    <View style={styles.driverCard}>
      <View style={styles.avatar}><Ionicons name="person" size={30} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rideName}>{driver?.name || 'Your driver'}</Text>
        <Text style={styles.muted}>{driver?.vehicleModel || 'Vehicle details pending'}{driver?.vehiclePlate ? ` • ${driver.vehiclePlate}` : ''}</Text>
      </View>
      <TouchableOpacity style={styles.actionCircle} accessibilityLabel="Chat with driver" onPress={() => Alert.alert('Chat isn’t available yet', 'In-app messaging is coming in a future update.')}><Ionicons name="chatbubble" size={18} /></TouchableOpacity>
      <TouchableOpacity style={styles.actionCircle} accessibilityLabel="Call driver" onPress={() => Alert.alert('Calling isn’t available yet', 'In-app calling is coming in a future update.')}><Ionicons name="call" size={18} /></TouchableOpacity>
    </View>
  );
}
function TripScreen({market,initialTrip,onDone,onExit}) {
  const { trip, refresh } = useTripPolling(initialTrip.id, initialTrip);
  const current = trip || initialTrip;
  const [payBusy,setPayBusy]=useState(false);
  const [receipt,setReceipt]=useState(null);
  useEffect(() => {
    if (current.status!=='COMPLETED') return;
    let alive=true;
    api.listReceipts().then(({receipts}) => { if(alive){const match=receipts.find(r => r.tripId===current.id);if(match)setReceipt(match);} }).catch(() => {});
    return () => {alive=false;};
  },[current.status,current.id]);
  const cancel=() => Alert.alert('Cancel this ride?','This cannot be undone.',[
    {text:'Keep ride',style:'cancel'},
    {text:'Cancel ride',style:'destructive',onPress: async () => {
      try {await api.cancelTrip(current.id);onExit();} catch(e){Alert.alert('Could not cancel',e.message);}
    }}]);
  const share=() => Share.share({message:`VOOM ride\nPickup: ${current.pickup.label} (${pointLabel(current.pickup)})\nDestination: ${current.destination.label} (${pointLabel(current.destination)})`}).catch(() => {});
  async function payWithChapa() {
    setPayBusy(true);
    try {
      const { checkoutUrl } = await api.initializeChapaPayment(current.id);
      await Linking.openURL(checkoutUrl);
    } catch(e) { Alert.alert('Could not start payment',e.message); }
    finally { setPayBusy(false); }
  }
  return <View style={styles.flex}>
    <VoomMap market={market} pickup={current.pickup} destination={current.destination} style={{flex:1}}/>
    <View style={[styles.driverBottom,{maxHeight:'66%'}]}><ScrollView>
      {current.status==='REQUESTED' && <>
        <Text style={styles.sheetTitle}>Finding your driver…</Text>
        <Text style={styles.muted}>Your request has been sent to nearby drivers.</Text>
        <ActivityIndicator color={C.ink} style={{margin:18}}/>
      </>}
      {current.status==='ACCEPTED' && <>
        <Text style={styles.sheetTitle}>Driver on the way</Text>
        <DriverCard driver={current.driver}/>
        <TripInfo icon="location" title={current.pickup.label} subtitle="Pickup"/>
        <TripInfo icon="flag" title={current.destination.label} subtitle="Destination"/>
        <Text style={styles.muted}>{PAYMENT_LABELS[current.paymentMethod]} • {formatMoney(current.fareAmount,current.currency)}</Text>
      </>}
      {current.status==='IN_PROGRESS' && <>
        <Text style={styles.sheetTitle}>Trip in progress</Text>
        <Text style={styles.muted}>{current.pickup.label} → {current.destination.label}</Text>
        <View style={styles.safetyRow}>
          <Safety icon="shield-checkmark" text="Safety info" onPress={() => Alert.alert('Emergency response is not connected yet','VOOM cannot contact emergency services or monitor this trip. In a real emergency, use your phone’s Emergency SOS or contact local emergency services directly.')}/>
          <Safety icon="share-social" text="Share details" onPress={share}/>
          <Safety icon="navigate" text="Directions" onPress={() => openDirections(current.pickup,current.destination)}/>
        </View>
      </>}
      {current.status==='COMPLETED' && <>
        <Text style={styles.sheetTitle}>Trip complete</Text>
        <Text style={styles.totalPrice}>{formatMoney(current.fareAmount,current.currency)}</Text>
        {current.paymentMethod==='CASH' && <Text style={styles.muted}>Pay your driver in cash.{receipt?` Receipt #${receipt.number}.`:''}</Text>}
        {current.paymentMethod==='CHAPA' && <>
          <Text style={styles.muted}>{receipt?`Paid • Receipt #${receipt.number}`:'Payment not completed yet.'}</Text>
          {!receipt && <AppButton disabled={payBusy} onPress={payWithChapa}>{payBusy?'Opening Chapa…':'Pay with Chapa'}</AppButton>}
          {!receipt && <AppButton secondary onPress={refresh}>I’ve paid — refresh</AppButton>}
        </>}
        <AppButton secondary onPress={onDone}>Done</AppButton>
      </>}
      {current.status==='CANCELLED' && <>
        <Text style={styles.sheetTitle}>Ride cancelled</Text>
        <AppButton secondary onPress={onDone}>Back home</AppButton>
      </>}
      {['REQUESTED','ACCEPTED'].includes(current.status) && <AppButton secondary onPress={cancel}>Cancel ride</AppButton>}
    </ScrollView></View>
  </View>;
}
function DriverMode({market,onExit}) {
  const [available,setAvailable]=useState([]);
  const [activeTrip,setActiveTrip]=useState(null);
  const [busy,setBusy]=useState(false);
  const [stats,setStats]=useState({earnings:0,count:0});
  const refreshAvailable=useCallback(async () => {
    if (activeTrip) return;
    try { const { trips } = await api.availableTrips(market.id); setAvailable(trips); } catch (_) { /* transient, retried on next tick */ }
  },[market.id,activeTrip]);
  useEffect(() => {
    refreshAvailable();
    const timer=setInterval(refreshAvailable,5000);
    return () => clearInterval(timer);
  },[refreshAvailable]);
  useEffect(() => {
    let alive=true;
    api.listTrips().then(({trips}) => {
      if(!alive)return;
      const completed=trips.filter(t => t.status==='COMPLETED');
      setStats({earnings:completed.reduce((sum,t) => sum+t.fareAmount,0),count:completed.length});
    }).catch(() => {});
    return () => {alive=false;};
  },[]);
  async function accept(trip) {
    setBusy(true);
    try { const { trip:updated } = await api.acceptTrip(trip.id); setActiveTrip(updated); }
    catch(e) { Alert.alert('Could not accept ride',e.message); }
    finally { setBusy(false); }
  }
  async function start() {
    setBusy(true);
    try { const { trip } = await api.startTrip(activeTrip.id); setActiveTrip(trip); }
    catch(e) { Alert.alert('Could not start trip',e.message); }
    finally { setBusy(false); }
  }
  async function complete() {
    setBusy(true);
    try {
      const { trip } = await api.completeTrip(activeTrip.id);
      setStats(s => ({earnings:s.earnings+trip.fareAmount,count:s.count+1}));
      setActiveTrip(trip);
    } catch(e) { Alert.alert('Could not complete trip',e.message); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark"/>
    <View style={styles.driverHeader}>
      <TouchableOpacity style={styles.circleSoft} onPress={onExit}><Ionicons name="arrow-back" size={22}/></TouchableOpacity>
      <View style={{alignItems:'center'}}><Text style={styles.logoSmall}>VOOM</Text><Text style={styles.driverTag}>DRIVER</Text></View><View style={{width:42}}/>
    </View>
    <VoomMap market={market} pickup={activeTrip?.pickup || market.map} destination={activeTrip?.destination} style={{flex:1}}/>
    <View style={[styles.driverBottom,{maxHeight:'65%'}]}><ScrollView>
      <View style={styles.driverStats}><Stat value={formatMoney(stats.earnings,market.currency)} label="Total earnings"/>
        <Stat value={String(stats.count)} label="Trips completed"/></View>
      {!activeTrip && <>
        <Text style={styles.sheetTitle}>Nearby ride requests</Text>
        {!available.length && <Text style={styles.muted}>No ride requests right now. This list refreshes automatically.</Text>}
        {available.map(trip => <View key={trip.id} style={styles.rideRow}>
          <View style={{flex:1}}>
            <Text style={styles.rideName}>{trip.pickup.label} → {trip.destination.label}</Text>
            <Text style={styles.mutedSmall}>{(trip.distanceMeters/1000).toFixed(1)} km</Text>
          </View>
          <View style={{alignItems:'flex-end'}}>
            <Text style={styles.price}>{formatMoney(trip.fareAmount,trip.currency)}</Text>
            <AppButton disabled={busy} onPress={() => accept(trip)}>Accept</AppButton>
          </View>
        </View>)}
      </>}
      {activeTrip && activeTrip.status==='ACCEPTED' && <>
        <Text style={styles.sheetTitle}>Heading to pickup</Text>
        <TripInfo icon="location" title={activeTrip.pickup.label} subtitle="Pickup"/>
        <TripInfo icon="flag" title={activeTrip.destination.label} subtitle="Destination"/>
        <AppButton secondary onPress={() => openDirections(activeTrip.pickup,activeTrip.destination)}>Open in Google Maps</AppButton>
        <AppButton disabled={busy} onPress={start}>Rider picked up — start trip</AppButton>
      </>}
      {activeTrip && activeTrip.status==='IN_PROGRESS' && <>
        <Text style={styles.sheetTitle}>Trip in progress</Text>
        <Text style={styles.muted}>Destination: {activeTrip.destination.label}</Text>
        <AppButton secondary onPress={() => openDirections(activeTrip.pickup,activeTrip.destination)}>Open Google Maps</AppButton>
        <AppButton disabled={busy} onPress={complete}>End trip</AppButton>
      </>}
      {activeTrip && activeTrip.status==='COMPLETED' && <>
        <Text style={styles.sheetTitle}>Trip completed</Text>
        <Text style={styles.totalPrice}>{formatMoney(activeTrip.fareAmount,activeTrip.currency)}</Text>
        <Text style={styles.muted}>{activeTrip.paymentMethod==='CASH' ? 'Collect cash from the rider.' : 'The rider pays through Chapa.'}</Text>
        <AppButton onPress={() => setActiveTrip(null)}>Find next ride</AppButton>
      </>}
    </ScrollView></View>
  </SafeAreaView>;
}
function ActivityScreen({onBack}) {
  const [trips,setTrips]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  useEffect(() => {
    let alive=true;
    api.listTrips().then(({trips}) => { if(alive)setTrips(trips); })
      .catch(e => { if(alive)setError(e.message); })
      .finally(() => { if(alive)setLoading(false); });
    return () => {alive=false;};
  },[]);
  return <View style={styles.page}><ScreenHeader title="Activity" onBack={onBack}/>
    <ScrollView showsVerticalScrollIndicator={false}>
      {loading && <ActivityIndicator color={C.ink} style={{marginTop:24}}/>}
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!loading && !trips.length && <Text style={styles.muted}>No rides yet. Your trip history will appear here.</Text>}
      {trips.map(trip => <View key={trip.id} style={styles.activityCard}>
        <View style={styles.activityIcon}><Ionicons name="car" size={22}/></View>
        <View style={{flex:1}}><Text style={styles.destinationTitle}>{trip.destination.label}</Text>
          <Text style={styles.mutedSmall}>From {trip.pickup.label}</Text>
          <Text style={styles.mutedSmall}>{new Date(trip.requestedAt).toLocaleString()} • {STATUS_LABELS[trip.status] || trip.status}</Text></View>
        <Text style={styles.rideName}>{formatMoney(trip.fareAmount,trip.currency)}</Text>
      </View>)}
    </ScrollView>
  </View>;
}

function WalletScreen({ market, paymentChannelId, selectPaymentChannel, onBack }) {
  const [receipts,setReceipts]=useState([]);
  useEffect(() => { let alive=true; api.listReceipts().then(({receipts}) => { if(alive)setReceipts(receipts); }).catch(() => {}); return () => {alive=false;}; },[]);
  function choose(channel) {
    selectPaymentChannel(channel.id);
    Alert.alert(`${channel.label} set as default`, channel.info);
  }
  return (
    <View style={styles.page}>
      <ScreenHeader title="Wallet" onBack={onBack} />
      <Text style={styles.sectionLabel}>Payment methods</Text>
      <Text style={styles.mutedSmall}>Tap a method to set it as your default for new rides.</Text>
      {market.paymentChannels.map((c) => <PaymentChannelButton key={c.id} channel={c} selected={c.id===paymentChannelId} onSelect={choose} />)}
      <Text style={styles.sectionLabel}>Receipts</Text>
      {!receipts.length && <Text style={styles.muted}>Receipts from paid rides will appear here.</Text>}
      {receipts.map(r => <View key={r.id} style={styles.paymentItem}>
        <View style={styles.paymentIcon}><Ionicons name="receipt-outline" size={20} /></View>
        <View style={{flex:1}}><Text style={styles.paymentTitle}>{r.number}</Text><Text style={styles.mutedSmall}>{new Date(r.issuedAt).toLocaleString()}</Text></View>
        <Text style={styles.rideName}>{formatMoney(r.amount,r.currency)}</Text>
      </View>)}
    </View>
  );
}

function AccountScreen({ onBack }) {
  const { user, logout } = useSession();
  const confirmLogout = () => Alert.alert('Log out?','',[{text:'Cancel',style:'cancel'},{text:'Log out',style:'destructive',onPress:logout}]);
  return (
    <View style={styles.page}>
      <ScreenHeader title="Account" onBack={onBack} />
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}><Ionicons name="person" size={35} /></View>
        <View><Text style={styles.sheetTitle}>{user.name}</Text><Text style={styles.muted}>{user.email || user.phone} • {user.role==='DRIVER'?'Driver':'Rider'}</Text></View>
      </View>
      <AccountRow icon="shield-checkmark" title="Safety center" />
      <AccountRow icon="notifications" title="Notifications" />
      <AccountRow icon="language" title="Language" subtitle="English • Amharic translation pending" />
      <AccountRow icon="help-circle" title="Help & support" />
      <AccountRow icon="document-text" title="Legal" />
      <TouchableOpacity style={styles.accountRow} onPress={confirmLogout}>
        <View style={styles.accountIcon}><Ionicons name="log-out-outline" size={20} /></View>
        <Text style={styles.paymentTitle}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

function ScreenHeader({ title, onBack }) {
  return (
    <View style={styles.screenHeader}>
      <TouchableOpacity style={styles.circleSoft} onPress={onBack}><Ionicons name="arrow-back" size={22} /></TouchableOpacity>
      <Text style={styles.screenTitle}>{title}</Text>
      <View style={{ width: 42 }} />
    </View>
  );
}

function TripInfo({ icon, title, subtitle }) {
  return (
    <View style={styles.tripInfo}>
      <View style={styles.smallIcon}><Ionicons name={icon} size={18} /></View>
      <View style={{flex:1}}><Text style={styles.tripInfoTitle}>{title}</Text><Text style={styles.mutedSmall}>{subtitle}</Text></View>
    </View>
  );
}

function Safety({ icon, text, onPress }) {
  return (
    <TouchableOpacity style={styles.safetyButton} onPress={onPress}>
      <Ionicons name={icon} size={20} />
      <Text style={styles.safetyText}>{text}</Text>
    </TouchableOpacity>
  );
}

function HomeNavItem({ icon, label, active = false, onPress }) {
  return (
    <TouchableOpacity style={styles.homeNavItem} onPress={onPress}>
      <Ionicons name={icon} size={21} color={active ? C.ink : C.muted} />
      <Text style={[styles.homeNavLabel, active && styles.homeNavLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Stat({ value, label }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.mutedSmall}>{label}</Text></View>;
}

function PaymentChannelButton({ channel, selected, onSelect }) {
  return (
    <TouchableOpacity style={[styles.marketRow, selected && styles.marketSelected]} onPress={() => onSelect(channel)}>
      <View style={styles.paymentIcon}><Ionicons name={channel.icon} size={20} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.paymentTitle}>{channel.label}</Text>
        <Text style={styles.mutedSmall}>{channel.info}</Text>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={C.darkGreen} /> : <Ionicons name="chevron-forward" size={18} color={C.muted} />}
    </TouchableOpacity>
  );
}

function AccountRow({ icon, title, subtitle }) {
  return (
    <TouchableOpacity style={styles.accountRow} onPress={() => Alert.alert(title, title === "Safety center" ? "VOOM does not provide emergency response yet. Use your phone’s Emergency SOS in a real emergency." : "This feature isn't available yet.")}>
      <View style={styles.accountIcon}><Ionicons name={icon} size={20} /></View>
      <View style={{ flex: 1 }}><Text style={styles.paymentTitle}>{title}</Text>{subtitle && <Text style={styles.mutedSmall}>{subtitle}</Text>}</View>
      <Ionicons name="chevron-forward" size={18} color={C.muted} />
    </TouchableOpacity>
  );
}

function MenuModal({ visible, close, go, driver, user }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={close}>
        <View style={styles.menuPanel}>
          <Text style={styles.logoMenu}>VOOM</Text>
          <View style={styles.menuProfile}><View style={styles.menuAvatar}><Ionicons name="person" size={26} /></View><View><Text style={styles.rideName}>{user.name}</Text><Text style={styles.mutedSmall}>{user.role==='DRIVER'?'Driver account':'Rider account'}</Text></View></View>
          <MenuItem icon="time" label="Activity" onPress={() => go('activity')} />
          <MenuItem icon="wallet" label="Wallet" onPress={() => go('wallet')} />
          <MenuItem icon="person" label="Account" onPress={() => go('account')} />
          {user.role==='DRIVER' && <MenuItem icon="car-sport" label="Drive with VOOM" onPress={driver} />}
          <View style={styles.menuFooter}><Text style={styles.mutedSmall}>VOOM • Ride your city</Text></View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function MenuItem({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon} size={21} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={C.muted} />
    </TouchableOpacity>
  );
}

function MarketModal({ visible, marketId, setMarketId, close }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.modalBackdrop}>
        <View style={styles.ratingCard}>
          <View style={styles.dragHandle} />
          <Text style={styles.sheetTitle}>Choose market</Text>
          <Text style={styles.muted}>VOOM is configured for Ethiopia and Uganda in this build.</Text>
          {Object.values(MARKETS).map((m) => (
            <TouchableOpacity key={m.id} style={[styles.marketRow, marketId === m.id && styles.marketSelected]} onPress={() => { setMarketId(m.id); close(); }}>
              <View style={styles.flagBox}><Text style={styles.flagText}>{m.id === 'et' ? 'ET' : 'UG'}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.rideName}>{m.city}</Text><Text style={styles.mutedSmall}>{m.country} • {m.currency}</Text></View>
              {marketId === m.id && <Ionicons name="checkmark-circle" size={23} color={C.darkGreen} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function PaymentModal({ visible, channels, value, onChoose, close }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.modalBackdrop}>
        <View style={styles.ratingCard}>
          <View style={styles.dragHandle} />
          <Text style={styles.sheetTitle}>Payment method</Text><Text style={styles.muted}>Choose how you'll pay for this ride.</Text>
          {channels.map((c) => <PaymentChannelButton key={c.id} channel={c} selected={value === c.id} onSelect={(channel) => onChoose(channel.id)} />)}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  googleAttribution:{fontSize:12,fontWeight:'400',letterSpacing:0,color:'#5E5E5E',marginTop:6,textTransform:'none'},
  infoNotice:{flexDirection:'row',alignItems:'center',gap:7,padding:10,borderRadius:12,backgroundColor:'#F0F6E8',marginVertical:8},
  infoNoticeText:{flex:1,fontSize:12,color:C.darkGreen,lineHeight:17},
  centerAll:{alignItems:'center',justifyContent:'center'},
  locationAction:{flexDirection:'row',gap:10,alignItems:'center',paddingVertical:13},
  errorText:{color:'#9A3412',fontSize:13,lineHeight:18,marginVertical:8},
  safe: { flex: 1, backgroundColor: C.paper, paddingTop: Platform.OS==='android'?26:0 },
  flex: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: C.paper },
  floatingTop: { position: 'absolute', top: Platform.OS === 'android' ? 48 : 18, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleShadow: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  circleSoft: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  cityPill: { height: 44, paddingHorizontal: 14, gap: 6, borderRadius: 22, backgroundColor: C.paper, alignItems: 'center', flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  cityPillText: { fontWeight: '800', fontSize: 14 },
  logoFloat: { position: 'absolute', top: Platform.OS === 'android' ? 105 : 76, left: 18, backgroundColor: C.ink, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9 },
  logo: { color: C.voom, fontSize: 20, fontWeight: '900', letterSpacing: -1.2 },
  homeSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 21, backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  dragHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#D7D9D4', alignSelf: 'center', marginBottom: 14 },
  heroTitle: { fontSize: 29, fontWeight: '900', letterSpacing: -1.2, marginBottom: 14, color: C.ink },
  searchBox: { height: 60, borderRadius: 16, backgroundColor: C.soft, paddingHorizontal: 16, alignItems: 'center', flexDirection: 'row' },
  searchDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.ink },
  searchText: { flex: 1, marginLeft: 12, fontSize: 17, fontWeight: '700', color: C.ink },
  homeSectionTitle: { marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: '900', color: C.ink },
  recentRow: { gap: 8 },
  recentPlace: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#F8F9F7' },
  recentIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  recentTitle: { fontWeight: '800', color: C.ink },
  homeNav: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, marginTop: 14, paddingTop: 10 },
  homeNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  homeNavLabel: { fontSize: 10, fontWeight: '700', color: C.muted },
  homeNavLabelActive: { color: C.ink, fontWeight: '900' },
  screenHeader: { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { fontSize: 20, fontWeight: '900', color: C.ink },
  locationCard: { flexDirection: 'row', padding: 12, backgroundColor: C.soft, borderRadius: 18, marginTop: 4 },
  routeDots: { width: 28, alignItems: 'center', paddingTop: 18 },
  dotBlack: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.ink },
  routeLine: { width: 2, height: 34, backgroundColor: '#BFC2BB' },
  squareBlack: { width: 9, height: 9, backgroundColor: C.ink },
  locationInput: { height: 48, backgroundColor: C.paper, borderRadius: 11, marginBottom: 8, paddingHorizontal: 12, justifyContent: 'center' },
  locationText: { fontSize: 15, fontWeight: '700', color: C.ink },
  textInput: { flex: 1, fontSize: 15, fontWeight: '700', color: C.ink },
  sectionLabel: { marginTop: 22, marginBottom: 10, color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  destinationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 9, borderBottomWidth: 1, borderBottomColor: C.line },
  placeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  destinationTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  button: { marginTop: 14, backgroundColor: C.ink, borderRadius: 14, minHeight: 54, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.line },
  buttonText: { textAlign: "center", color: C.paper, fontSize: 16, fontWeight: '900' },
  buttonSecondaryText: { color: C.ink },
  mapBack: { position: 'absolute', top: Platform.OS === 'android' ? 48 : 18, left: 16 },
  pickupAddress: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingVertical: 8 },
  optionsSheet: { flex: 1, paddingHorizontal: 18, paddingTop: 11, paddingBottom: 18, backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -20 },
  sheetTitle: { fontSize: 24, fontWeight: '900', color: C.ink, letterSpacing: -0.6 },
  rideRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 16, marginTop: 8, borderWidth: 1.5, borderColor: 'transparent' },
  rideSelected: { backgroundColor: '#F8FFE9', borderColor: C.ink },
  rideIcon: { width: 56, height: 56, borderRadius: 15, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rideName: { fontSize: 16, fontWeight: '900', color: C.ink },
  muted: { color: C.muted, marginTop: 4, lineHeight: 19 },
  mutedSmall: { color: C.muted, marginTop: 2, fontSize: 12 },
  rideNote: { color: C.muted, marginTop: 2, fontSize: 11 },
  price: { fontSize: 15, fontWeight: '900', color: C.ink },
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.line, marginTop: 6 },
  paymentIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  paymentTitle: { fontWeight: '800', color: C.ink },
  driverCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  actionCircle: { width: 39, height: 39, borderRadius: 20, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  tripInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  tripInfoTitle: { fontWeight: '800', color: C.ink },
  smallIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  safetyRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  safetyButton: { flex: 1, borderRadius: 13, backgroundColor: C.soft, paddingVertical: 11, alignItems: 'center' },
  safetyText: { fontWeight: '700', fontSize: 12, marginTop: 4 },
  totalPrice: { fontSize: 38, fontWeight: '900', letterSpacing: -1.5, marginTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.36)', justifyContent: 'flex-end' },
  ratingCard: { paddingHorizontal: 22, paddingTop: 11, paddingBottom: 28, backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.32)', justifyContent: 'flex-start' },
  menuPanel: { width: '82%', height: '100%', backgroundColor: C.paper, paddingTop: 64, paddingHorizontal: 20 },
  logoMenu: { fontSize: 30, fontWeight: '900', letterSpacing: -1.8, color: C.ink },
  menuProfile: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: C.line },
  menuAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.voom, alignItems: 'center', justifyContent: 'center' },
  menuItem: { height: 57, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  menuLabel: { flex: 1, fontWeight: '800', fontSize: 15 },
  menuFooter: { marginTop: 'auto', paddingBottom: 30 },
  marketRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, marginTop: 9, borderWidth: 1.5, borderColor: C.line },
  marketSelected: { borderColor: C.ink, backgroundColor: '#F8FFE9' },
  flagBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  flagText: { color: C.voom, fontWeight: '900' },
  activityCard: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.line },
  activityIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  paymentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  profileCard: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingVertical: 16 },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.voom, alignItems: 'center', justifyContent: 'center' },
  accountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  accountIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  driverHeader: { height: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: C.paper },
  logoSmall: { fontSize: 20, fontWeight: '900', letterSpacing: -1 },
  driverTag: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6, color: C.muted },
  driverBottom: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 22, backgroundColor: C.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  driverStats: { flexDirection: 'row', paddingBottom: 15, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontWeight: '900', fontSize: 16 },
  dualButtons: { flexDirection: 'row', gap: 10 },
});
