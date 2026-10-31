jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
const mockJson = jest.fn();
const mockUpload = jest.fn();
const mockTokens = jest.fn();
jest.mock('../services/api', () => ({
  apiJsonWithStatus: (...a) => mockJson(...a),
  apiUploadWithStatus: (...a) => mockUpload(...a),
  getTokens: () => mockTokens(),
}));
jest.mock(
  'expo-file-system/legacy',
  () => ({
    documentDirectory: 'file:///docs/',
    makeDirectoryAsync: jest.fn(async () => {}),
    copyAsync: jest.fn(async () => {}),
    deleteAsync: jest.fn(async () => {}),
    getInfoAsync: jest.fn(async () => ({ exists: true, size: 1000 })),
  }),
  { virtual: true }
);
jest.mock('expo-image-picker', () => ({}), { virtual: true });
const mockList = [];
jest.mock('../lib/menus/storage', () => ({
  loadMyRecipes: async () => mockList,
  setMyRecipePhotoUrl: jest.fn(async (id, url) => ({ ok: true, list: [{ id, photoUrl: url }] })),
}));

import * as mockFs from 'expo-file-system/legacy';
import { importRecipe, uploadRecipePhoto, extractUrl } from '../services/myRecipesApi';
import { persistPhoto, photoSources, flushPendingPhotos, deletePhotoFile } from '../services/recipePhotos';
import { setMyRecipePhotoUrl } from '../lib/menus/storage';

beforeEach(() => {
  jest.clearAllMocks();
  mockTokens.mockResolvedValue({ access: 'a' });
  mockList.length = 0;
});

describe('import', () => {
  test('adresse extraite du texte collé', () => {
    expect(extractUrl('Regardez https://x.fr/tarte !')).toBe('https://x.fr/tarte');
    expect(extractUrl('www.x.fr/a')).toBe('https://www.x.fr/a');
    expect(extractUrl('pas de lien ici')).toBeNull();
  });
  test.each([
    [{ ok: true, status: 200, data: { title: 'A' } }, 'ok'],
    [{ ok: false, status: 422, data: { code: 'not_a_recipe' } }, 'not_a_recipe'],
    [{ ok: false, status: 429, data: null }, 'rate_limited'],
    [{ ok: false, status: 404, data: null }, 'unavailable'],
    [{ ok: false, status: 500, data: null }, 'unavailable'],
    [{ ok: true, status: 200, data: null }, 'unavailable'],
    [{ ok: false, status: 401, data: null }, 'login'],
  ])('réponse %j', async (rep, attendu) => {
    mockJson.mockResolvedValue(rep);
    expect((await importRecipe('https://x.fr/a')).status).toBe(attendu);
  });
  test('hors ligne, sans lien, déconnecté', async () => {
    mockJson.mockRejectedValue(new Error('net'));
    expect((await importRecipe('https://x.fr/a')).status).toBe('offline');
    expect((await importRecipe('bla')).status).toBe('invalid_url');
    mockTokens.mockResolvedValue(null);
    expect((await importRecipe('https://x.fr/a')).status).toBe('login');
  });
});

describe('photos', () => {
  test('copie durable, jamais le chemin temporaire', async () => {
    const f = await persistPhoto('file:///tmp/cache/ImagePicker/a.PNG');
    expect(f).toMatch(/^menus-photos\/[\w-]+\.png$/);
    expect(mockFs.copyAsync.mock.calls[0][0].to).toBe(`file:///docs/${f}`);
    mockFs.copyAsync.mockRejectedValueOnce(new Error('x'));
    expect(await persistPhoto('file:///tmp/b.jpg')).toBeNull();
  });
  test('ordre d affichage : local puis compte', () => {
    expect(photoSources({ custom: true, photoFile: 'menus-photos/a.jpg', photoUrl: 'https://x.fr/a.jpg' })).toEqual([
      'file:///docs/menus-photos/a.jpg',
      'https://x.fr/a.jpg',
    ]);
    expect(photoSources({ id: 'catalogue' })).toEqual([]);
    expect(photoSources(null)).toEqual([]);
  });
  test('suppression limitée au dossier des photos', async () => {
    await deletePhotoFile('../secret.jpg');
    expect(mockFs.deleteAsync).not.toHaveBeenCalled();
  });
  test('envoi repris : réussite enregistrée', async () => {
    mockList.push({ id: 'my-1', photoFile: 'menus-photos/a.jpg', photoUrl: null });
    mockUpload.mockResolvedValue({ ok: true, status: 200, data: { url: 'https://x.fr/a.jpg' } });
    const l = await flushPendingPhotos();
    expect(setMyRecipePhotoUrl).toHaveBeenCalledWith('my-1', 'https://x.fr/a.jpg', 'menus-photos/a.jpg');
    expect(l[0].photoUrl).toBe('https://x.fr/a.jpg');
  });
  test('hors ligne : arrêt au premier échec, rien de perdu', async () => {
    mockList.push({ id: 'my-1', photoFile: 'menus-photos/a.jpg' }, { id: 'my-2', photoFile: 'menus-photos/b.jpg' });
    mockUpload.mockRejectedValue(new Error('net'));
    expect(await flushPendingPhotos()).toBeNull();
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(setMyRecipePhotoUrl).not.toHaveBeenCalled();
  });
  test('route absente : pas de plantage ; déconnecté : aucun envoi', async () => {
    mockUpload.mockResolvedValue({ ok: false, status: 404, data: null });
    expect((await uploadRecipePhoto('file:///docs/a.jpg')).status).toBe('unavailable');
    mockTokens.mockResolvedValue(null);
    mockUpload.mockClear();
    expect((await uploadRecipePhoto('file:///docs/a.jpg')).status).toBe('login');
    expect(mockUpload).not.toHaveBeenCalled();
  });
  test('photo trop lourde ou fichier absent : ignorés, la suivante part', async () => {
    mockList.push({ id: 'my-1', photoFile: 'menus-photos/a.jpg' }, { id: 'my-2', photoFile: 'menus-photos/b.jpg' });
    mockFs.getInfoAsync.mockResolvedValueOnce({ exists: true, size: 6 * 1024 * 1024 });
    mockUpload.mockResolvedValue({ ok: true, status: 200, data: { url: 'https://x.fr/b.jpg' } });
    await flushPendingPhotos();
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });
});
