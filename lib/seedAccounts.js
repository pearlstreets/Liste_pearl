// Seed / demo accounts loader.
//
// In development, drop a `data/seed-accounts.json` file (gitignored) with the
// same shape as `data/seed-accounts.example.json` to get demo users locally.
// In production, this resolves to an empty list — real accounts come from the
// backend and should never be shipped in source.
//
// SECURITE (19/10/2026) : le fichier n'est lu QUE sous `__DEV__`. Metro
// remplace `__DEV__` par `false` en production et retire la branche morte
// AVANT de collecter les dépendances : le JSON (et son mot de passe) n'entre
// plus dans le bundle livré (binaire ou mise à jour OTA), même si le fichier
// est présent sur la machine qui construit.

let accounts = [];

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    // Optional file; never shipped in git.
    accounts = require('../data/seed-accounts.json');
    if (!Array.isArray(accounts)) accounts = [];
  } catch (_) {
    accounts = [];
  }
}

export const SEED_ACCOUNTS = accounts;
export const DEFAULT_SEED_ACCOUNT = accounts[0] || null;
