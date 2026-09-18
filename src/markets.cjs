// Seed places are approximate areas to speed up destination search, not verified addresses.
const MARKETS = {
  et: {
    id: 'et',
    country: 'Ethiopia',
    city: 'Addis Ababa',
    currency: 'ETB',
    map: { latitude: 9.0192, longitude: 38.7525, latitudeDelta: 0.085, longitudeDelta: 0.085 },
    pickup: { latitude: 9.0192, longitude: 38.7525, label: 'Addis Ababa' },
    destinations: [
      { latitude: 8.9959, longitude: 38.7891, label: 'Bole' },
      { latitude: 9.0350, longitude: 38.7520, label: 'Arat Kilo' },
      { latitude: 9.0134, longitude: 38.7636, label: 'Kazanchis' },
      { latitude: 9.0289, longitude: 38.7996, label: 'CMC' },
    ],
    paymentChannels: [
      { id: 'CASH', label: 'Cash', icon: 'cash-outline', backend: 'CASH', info: 'Pay your driver directly in cash when the trip is complete. No online charge.' },
      { id: 'TELEBIRR', label: 'Telebirr', icon: 'phone-portrait-outline', backend: 'CHAPA', info: "Opens Chapa's secure checkout, where you pay with Telebirr." },
      { id: 'CBE', label: 'CBE Birr', icon: 'business-outline', backend: 'CHAPA', info: "Opens Chapa's secure checkout, where you pay with your CBE account or CBE Birr." },
    ],
    rideTypes: [
      { id: 'mini', name: 'Beklo Mini', eta: 3, seats: 4, baseFare: 90, perKm: 38, minFare: 180, icon: 'car-sport', note: 'Affordable everyday rides' },
      { id: 'comfort', name: 'Beklo Comfort', eta: 5, seats: 4, baseFare: 120, perKm: 50, minFare: 260, icon: 'car', note: 'Newer cars • extra comfort' },
      { id: 'xl', name: 'Beklo XL', eta: 7, seats: 6, baseFare: 170, perKm: 68, minFare: 350, icon: 'bus', note: 'More seats and luggage space' },
    ],
  },
  ug: {
    id: 'ug',
    country: 'Uganda',
    city: 'Kampala',
    currency: 'UGX',
    map: { latitude: 0.3476, longitude: 32.5825, latitudeDelta: 0.085, longitudeDelta: 0.085 },
    pickup: { latitude: 0.3476, longitude: 32.5825, label: 'Kampala' },
    destinations: [
      { latitude: 0.3136, longitude: 32.5811, label: 'Kabalagala' },
      { latitude: 0.3365, longitude: 32.6040, label: 'Kololo' },
      { latitude: 0.3472, longitude: 32.6160, label: 'Naguru' },
      { latitude: 0.2841, longitude: 32.5917, label: 'Munyonyo' },
    ],
    paymentChannels: [
      { id: 'CASH', label: 'Cash', icon: 'cash-outline', backend: 'CASH', info: 'Pay your driver directly in cash when the trip is complete. No online charge.' },
      { id: 'MTN_MOMO', label: 'MTN MoMo', icon: 'phone-portrait-outline', backend: 'CHAPA', info: "Opens Chapa's secure checkout, where you pay with MTN Mobile Money." },
      { id: 'AIRTEL_MONEY', label: 'Airtel Money', icon: 'phone-portrait-outline', backend: 'CHAPA', info: "Opens Chapa's secure checkout, where you pay with Airtel Money." },
    ],
    rideTypes: [
      { id: 'boda', name: 'Beklo Boda', eta: 2, seats: 1, baseFare: 1500, perKm: 900, minFare: 3000, icon: 'bicycle', note: 'Fastest through traffic' },
      { id: 'mini', name: 'Beklo Mini', eta: 3, seats: 4, baseFare: 3000, perKm: 2200, minFare: 7000, icon: 'car-sport', note: 'Affordable everyday rides' },
      { id: 'comfort', name: 'Beklo Comfort', eta: 5, seats: 4, baseFare: 4500, perKm: 3000, minFare: 10000, icon: 'car', note: 'Newer cars • extra comfort' },
      { id: 'xl', name: 'Beklo XL', eta: 7, seats: 6, baseFare: 6000, perKm: 4200, minFare: 16000, icon: 'bus', note: 'More seats and luggage space' },
    ],
  },
};

const PAYMENT_LABELS = {
  CHAPA: 'Chapa (Telebirr, card, bank, mobile money)',
  CASH: 'Cash',
};

for (const market of Object.values(MARKETS)) {
  market.serviceRadiusKm = 55; // Service area limit for this launch, not a hard geographic boundary.
  market.pickup.source = 'default';
  market.destinations = market.destinations.map((d, i) => ({...d, id: market.id+"-"+i, source:"suggested", subtitle:"Suggested area • confirm exact pin"}));
}
module.exports = { MARKETS, PAYMENT_LABELS };
