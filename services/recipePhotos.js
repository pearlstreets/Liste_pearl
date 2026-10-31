// Photos des recettes personnelles. La photo est d'abord copiée dans documentDirectory (jamais de
// chemin temporaire, jamais de base64 dans la sauvegarde), puis envoyée au compte quand c'est
// possible. Tant que l'envoi n'a pas réussi, le fichier local fait foi : rien n'est perdu.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { cleanRemoteUrl, cleanPhotoFile, photosToUpload } from '../lib/menus/myRecipes';
import { loadMyRecipes, setMyRecipePhotoUrl } from '../lib/menus/storage';
import { uploadRecipePhoto, MAX_PHOTO_BYTES } from './myRecipesApi';

const DIR = 'menus-photos';

const localUri = (file) => (FileSystem.documentDirectory ? FileSystem.documentDirectory + file : null);

/** Adresses à essayer pour afficher la photo : le fichier local, puis celle du compte. */
export function photoSources(recipe) {
  if (!recipe || !recipe.custom) return [];
  const out = [];
  const file = cleanPhotoFile(recipe.photoFile);
  const uri = file && localUri(file);
  if (uri) out.push(uri);
  const url = cleanRemoteUrl(recipe.photoUrl);
  if (url) out.push(url);
  return out;
}

/** -> { status:'ok', uri } | { status:'cancel' } | { status:'denied' } | { status:'error' } */
export async function pickPhoto() {
  try {
    if (Platform.OS === 'ios') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return { status: 'denied' };
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.6,
    });
    if (r.canceled || !r.assets || !r.assets[0] || !r.assets[0].uri) return { status: 'cancel' };
    return { status: 'ok', uri: r.assets[0].uri };
  } catch {
    return { status: 'error' };
  }
}

/** Copie durable : rend le chemin relatif "menus-photos/xxx.jpg", ou null en cas d'échec. */
export async function persistPhoto(tempUri) {
  try {
    if (!FileSystem.documentDirectory || !tempUri) return null;
    const dir = FileSystem.documentDirectory + DIR;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const ext = /\.(jpe?g|png|webp|heic)(\?|$)/i.exec(tempUri);
    const nom = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const file = `${DIR}/${nom}.${ext ? ext[1].toLowerCase() : 'jpg'}`;
    await FileSystem.copyAsync({ from: tempUri, to: FileSystem.documentDirectory + file });
    return file;
  } catch {
    return null;
  }
}

export async function deletePhotoFile(file) {
  const propre = cleanPhotoFile(file);
  const uri = propre && localUri(propre);
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}
}

export async function deleteAllPhotos() {
  try {
    if (FileSystem.documentDirectory)
      await FileSystem.deleteAsync(FileSystem.documentDirectory + DIR, { idempotent: true });
  } catch {}
}

let enCours = false;

/**
 * Envoie les photos encore locales. S'arrête au premier échec de réseau ou de compte : la reprise
 * vient du prochain retour dans l'application, sans boucle. Rend la liste à jour, ou null si rien
 * n'a changé.
 */
export async function flushPendingPhotos() {
  if (enCours) return null;
  enCours = true;
  let liste = null;
  try {
    const attente = photosToUpload(await loadMyRecipes());
    for (const r of attente) {
      const uri = localUri(r.photoFile);
      if (!uri) break;
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || (info.size && info.size > MAX_PHOTO_BYTES)) continue;
      const res = await uploadRecipePhoto(uri);
      if (res.status === 'rejected') continue;
      if (res.status !== 'ok') break;
      const url = cleanRemoteUrl(res.url);
      if (!url) continue;
      const w = await setMyRecipePhotoUrl(r.id, url, r.photoFile);
      if (w.ok) liste = w.list;
    }
  } catch {
    // reprise au prochain passage
  }
  enCours = false;
  return liste;
}
