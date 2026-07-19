// Partage de listes de courses — appels API (backend marketplace app-prod).
// Voir Backend/Marketplace/UserApp/views_shared_lists.py.

import { apiGet, apiPost, apiDelete } from './api';

// --- Ma liste (synchro serveur pour le partage) ---
export const syncMyList = (items, title = '') =>
  apiPost('/users/my-list/', { items, title });

export const getMyList = () => apiGet('/users/my-list/');

// --- Partage ---
// Envoyer une demande de partage de MA liste à un user (email ou pseudo).
export const sendShareRequest = (identifier) =>
  apiPost('/users/list-share/request/', { identifier });

// Mes demandes reçues en attente.
export const getIncomingRequests = () => apiGet('/users/list-share/incoming/');

// Répondre à une demande reçue : action = 'accept' | 'reject'.
export const respondRequest = (requestId, action) =>
  apiPost('/users/list-share/respond/', { request_id: requestId, action });

// Retirer un partage que J'AI accordé (par email/pseudo).
export const revokeShare = (identifier) =>
  apiPost('/users/list-share/revoke/', { identifier });

// Les listes que d'autres m'autorisent à consulter (lecture seule).
export const getSharedWithMe = () => apiGet('/users/list-share/shared-with-me/');

// --- Blocage ---
export const getBlocks = () => apiGet('/users/block/');
export const blockUser = (identifier) => apiPost('/users/block/', { identifier });
export const blockUserById = (userId) => apiPost('/users/block/', { user_id: userId });
export const unblockUser = (identifier) => apiDelete('/users/block/', { identifier });
