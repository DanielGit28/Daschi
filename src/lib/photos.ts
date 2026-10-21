// Fotos de la línea de tiempo: elegir o sacar, achicar en el dispositivo, subir a Vercel Blob y guardar.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { addPhoto } from './db';
import { apiUrl, syncDogData, httpTransport } from './sync';

const MAX_WIDTH = 1280;

export type PhotoSource = 'camera' | 'library';

/** La cámara no existe en web: ahí siempre se elige un archivo. */
export const cameraAvailable = Platform.OS !== 'web';

/**
 * Abre la cámara o la galería y sube la foto. Devuelve false si el usuario canceló.
 * Lanza un error con mensaje para mostrar si no hay permiso o conexión.
 */
export async function pickAndUploadPhoto(
  db: SQLiteDatabase,
  dogId: string,
  source: PhotoSource,
  extra: { caption?: string | null; levelId?: string | null } = {},
): Promise<boolean> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Activá el permiso de cámara en Ajustes para sacar fotos.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return false;
  const asset = result.assets[0];

  // Achicar antes de subir: fotos de 1280 px en JPEG pesan ~200-400 KB.
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH, height: null });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!saved.base64) throw new Error('No se pudo preparar la foto.');

  // La mascota tiene que existir en el servidor antes de guardar su foto.
  await syncDogData(db, dogId, httpTransport);
  const res = await fetch(apiUrl('/api/photos'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dogId, contentType: 'image/jpeg', base64: saved.base64 }),
  });
  if (!res.ok) throw new Error('No se pudo subir la foto. Revisá la conexión e intentá de nuevo.');
  const { url } = (await res.json()) as { url: string };

  await addPhoto(db, {
    dog_id: dogId,
    url,
    taken_at: new Date().toISOString(),
    caption: extra.caption ?? null,
    level_id: extra.levelId ?? null,
    width: saved.width,
    height: saved.height,
  });
  return true;
}
