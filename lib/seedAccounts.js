// Seed / demo accounts loader.
//
// In development, drop a `data/seed-accounts.json` file (gitignored) with the
// same shape as `data/seed-accounts.example.json` to get demo users locally.
// In production, this resolves to an empty list — real accounts come from the
// backend and should never be shipped in source.

let accounts = [];

try {
  // Optional file; never shipped in git.

  accounts = require('../data/seed-accounts.json');
  if (!Array.isArray(accounts)) accounts = [];
} catch (_) {
  accounts = [];
}

export const SEED_ACCOUNTS = accounts;
export const DEFAULT_SEED_ACCOUNT = accounts[0] || null;
