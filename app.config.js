// Expo SDK 57 configuration. These are restricted NATIVE SDK keys, not server keys.
module.exports = ({ config }) => {
  const ios = { ...config.ios };
  const android = { ...config.android };
  if (process.env.GOOGLE_MAPS_IOS_KEY) {
    ios.config = { ...ios.config, googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY };
  }
  if (process.env.GOOGLE_MAPS_ANDROID_KEY) {
    android.config = { ...android.config,
      googleMaps: { ...(android.config?.googleMaps || {}), apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY } };
  }
  if (process.env.EXPO_PUBLIC_USE_GOOGLE_MAPS === 'true' && !process.env.GOOGLE_MAPS_IOS_KEY)
    console.warn('Google provider requested: iOS needs a restricted Maps SDK key and a rebuilt native app.');
  return { ...config, ios, android };
};
