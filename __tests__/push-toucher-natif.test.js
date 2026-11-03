// Toucher d'une notification quand Android a tué l'app en gardant sa fenêtre
// (plugins/withToucherNotification.js), fichier Firebase et textes des
// notifications de commande dans les 13 langues.
const fs = require('fs');
const path = require('path');

const { ajouterAuKotlin } = require('../plugins/withToucherNotification');

const MAIN_ACTIVITY = `package com.pearlstreets.list

import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }
}
`;

describe('plugin withToucherNotification', () => {
  test('ajoute onNewIntent redonné et les imports manquants', () => {
    const sortie = ajouterAuKotlin(MAIN_ACTIVITY);
    expect(sortie).toContain('override fun onNewIntent(intent: Intent)');
    expect(sortie).toContain('google.message_id');
    expect(sortie).toContain('longArrayOf(1000L, 3000L, 6000L, 10000L)');
    ['android.content.Intent', 'android.os.Handler', 'android.os.Looper'].forEach((imp) =>
      expect(sortie).toMatch(new RegExp(`^import ${imp.replace(/\./g, '\.')}$`, 'm'))
    );
    // Import déjà présent : pas de doublon.
    expect(sortie.match(/^import android\.os\.Bundle$/gm)).toHaveLength(1);
  });

  test('idempotent : un second passage ne change rien', () => {
    const une = ajouterAuKotlin(MAIN_ACTIVITY);
    expect(ajouterAuKotlin(une)).toBe(une);
  });

  test('classe introuvable : erreur explicite au build', () => {
    expect(() => ajouterAuKotlin('package x\n\nclass Autre {}\n')).toThrow(
      'MainActivity introuvable'
    );
  });
});

describe('fichier Firebase', () => {
  test('google-services.json porte le client com.pearlstreets.list', () => {
    const gs = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'google-services.json'), 'utf8')
    );
    const paquets = gs.client.map((c) => c.client_info.android_client_info.package_name);
    expect(paquets).toContain('com.pearlstreets.list');
  });
});

describe('textes des notifications de commande', () => {
  const LANGUES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'nl', 'pt', 'ru', 'sv', 'th', 'zh'];
  test.each(LANGUES)('%s : les 3 clés présentes et non vides', (l) => {
    const j = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'locales', `${l}.json`), 'utf8')
    );
    for (const v of [
      j.notifications && j.notifications.channelOrders,
      j.report.answerTitle,
      j.report.handled,
    ]) {
      expect(typeof v).toBe('string');
      expect(v.trim().length).toBeGreaterThan(0);
      expect(v).not.toMatch(/[\u2014\u2192]/);
    }
  });
});
