import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Resizing + recompressing keeps a phone camera's multi-megabyte photo down to a
// base64 payload the backend (and Vercel's request-size limit) can comfortably accept.
async function compress(uri) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1024 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.5, format: SaveFormat.JPEG, base64: true });
  return `data:image/jpeg;base64,${saved.base64}`;
}

// Opens the device camera and returns a compressed data URI, or null if the
// rider/driver cancels. Throws if camera permission is denied.
export async function captureIdentityPhoto(deniedMessage) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.status !== 'granted') throw new Error(deniedMessage);
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return compress(result.assets[0].uri);
}
