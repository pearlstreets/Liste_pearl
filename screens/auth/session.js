import AsyncStorage from "@react-native-async-storage/async-storage";
import { removeSecureItems, SECURE_KEYS } from "../../services/secureStorage";

// « Rester connecté » (choix de la page de connexion, cochée par défaut).
// Décochée : la session (jetons, compte, profil) est effacée au démarrage à
// froid suivant, avant sa restauration. Une seule purge par lancement.
export const KEY_RESTER_CONNECTE = 'resterConnecte';
let purgeDemarrage = null;
export const purgerSessionSiNonConservee = () => {
  if (!purgeDemarrage) {
    purgeDemarrage = (async () => {
      try {
        const choix = await AsyncStorage.getItem(KEY_RESTER_CONNECTE);
        if (choix === 'false') await removeSecureItems(SECURE_KEYS);
      } catch (_) {}
    })();
  }
  return purgeDemarrage;
};
