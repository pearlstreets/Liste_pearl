// Durcissement du binaire (19/10/2026) : suppression de compte qui ne déclare
// plus un échec comme un succès, configuration réseau posée au build
// (plugins/withSecuriteReseau.js), protection des écrans de paiement contre
// les captures (lib/useSecureScreen.js).

const fs = require('fs');
const os = require('os');
const path = require('path');

const mockStore = new Map();
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k, v) => {
    mockStore.set(k, v);
  }),
  getItem: jest.fn(async (k) => (mockStore.has(k) ? mockStore.get(k) : null)),
  removeItem: jest.fn(async (k) => {
    mockStore.delete(k);
  }),
  multiRemove: jest.fn(async (ks) => {
    ks.forEach((k) => mockStore.delete(k));
  }),
  multiSet: jest.fn(async (pairs) => {
    pairs.forEach(([k, v]) => mockStore.set(k, v));
  }),
  getAllKeys: jest.fn(async () => Array.from(mockStore.keys())),
}));
jest.mock('../services/config', () => ({ CONFIG: { API_URL: 'https://api.test/api/v1' } }));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64');
const jwt = (expSecondsFromNow) =>
  `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
const jsonRes = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('suppression du compte', () => {
  let api;
  let auth;

  beforeEach(async () => {
    jest.resetModules();
    mockStore.clear();
    global.fetch = jest.fn();
    api = require('../services/api');
    auth = require('../services/auth');
    await api.saveTokens(jwt(3600), 'R1');
    mockStore.set('KEY_ORDER_HISTORY', '{"id":1}');
  });

  const sessionIntacte = async () => {
    expect(await api.getTokens()).not.toBeNull();
    expect(mockStore.has('KEY_ORDER_HISTORY')).toBe(true);
  };

  test('succès : HTTP 200 et status true, session effacée', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonRes(200, {
        statusCode: 200,
        status: true,
        message:
          'Account scheduled for deletion. You have 30 days to restore it from the link sent by email.',
        data: { recovery_window_days: 30 },
      })
    );
    const res = await auth.deleteAccount();
    expect(res.success).toBe(true);
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/api/v1/users/delete-user/');
    expect(global.fetch.mock.calls[0][1].method).toBe('DELETE');
    expect(await api.getTokens()).toBeNull();
    expect(mockStore.has('KEY_ORDER_HISTORY')).toBe(false);
  });

  test('403 avec message : échec, la session reste', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonRes(403, {
        statusCode: 403,
        status: false,
        message: 'Only customer accounts can delete their account.',
      })
    );
    const res = await auth.deleteAccount();
    expect(res.success).toBe(false);
    expect(res.message).toBe('Only customer accounts can delete their account.');
    await sessionIntacte();
  });

  test('erreur interne renvoyée en HTTP 200 avec status false : échec', async () => {
    global.fetch.mockResolvedValueOnce(
      jsonRes(200, {
        statusCode: 500,
        status: false,
        message: 'Could not delete account',
        error: 'x',
      })
    );
    const res = await auth.deleteAccount();
    expect(res.success).toBe(false);
    await sessionIntacte();
  });

  test('HTTP 500 : échec, même avec status true dans le corps', async () => {
    global.fetch.mockResolvedValueOnce(jsonRes(500, { status: true, message: 'oops' }));
    const res = await auth.deleteAccount();
    expect(res.success).toBe(false);
    await sessionIntacte();
  });

  test('502 avec page HTML (corps non JSON) : échec sans exception', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('html');
      },
    });
    const res = await auth.deleteAccount();
    expect(res.success).toBe(false);
    await sessionIntacte();
  });

  test('réseau coupé : échec, rien n est effacé', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    const res = await auth.deleteAccount();
    expect(res.success).toBe(false);
    await sessionIntacte();
  });

  test('apiDelete garde son comportement pour les autres appels', async () => {
    global.fetch.mockResolvedValueOnce(jsonRes(200, { message: 'ok' }));
    expect(await api.apiDelete('/x/')).toEqual({ message: 'ok' });
  });
});

describe('plugin réseau withSecuriteReseau', () => {
  const plugin = require('../plugins/withSecuriteReseau');

  const configFictive = () => ({ name: 'Pearl List', slug: 'pearl-list', android: {}, ios: {} });

  const manifesteFictif = () => ({
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      application: [{ $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true' } }],
    },
  });

  test('manifeste : allowBackup false, cleartext false, networkSecurityConfig posé', async () => {
    const config = plugin(configFictive());
    const out = await config.mods.android.manifest({
      ...config,
      modResults: manifesteFictif(),
      modRequest: {},
    });
    const app = out.modResults.manifest.application[0].$;
    expect(app['android:allowBackup']).toBe('false');
    expect(app['android:usesCleartextTraffic']).toBe('false');
    expect(app['android:networkSecurityConfig']).toBe('@xml/network_security_config');
    expect(app['android:name']).toBe('.MainApplication');
  });

  test('XML : release épinglé sans clair, debug à part pour Metro', async () => {
    const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-android-'));
    try {
      const config = plugin(configFictive());
      await config.mods.android.dangerous({
        ...config,
        modResults: {},
        modRequest: { platformProjectRoot: racine, projectRoot: path.dirname(racine) },
      });
      const lire = (v) =>
        fs.readFileSync(
          path.join(racine, 'app', 'src', v, 'res', 'xml', 'network_security_config.xml'),
          'utf8'
        );

      const release = lire('main');
      expect(release).not.toMatch(/cleartextTrafficPermitted="true"/);
      expect(release).not.toMatch(/src="user"/);
      expect(release).toMatch(/<base-config cleartextTrafficPermitted="false">/);
      expect(release).toMatch(/<domain includeSubdomains="false">api\.pearlstreets\.com<\/domain>/);
      expect(release).toMatch(/<pin-set expiration="2027-08-20">/);
      for (const e of [
        'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=',
        'diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=',
        'sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=',
        's/tdAOmUzd8syaTuqfgGvFcn6DzA5Cmb+Vby1ST+U3Y=',
      ]) {
        expect(release).toContain(`<pin digest="SHA-256">${e}</pin>`);
      }
      // Un seul domaine épinglé : Stripe, frankfurter, images restent en HTTPS normal.
      expect((release.match(/<domain /g) || []).length).toBe(1);

      for (const v of ['debug', 'debugOptimized']) {
        const debug = lire(v);
        expect(debug).toMatch(/cleartextTrafficPermitted="true"/);
        expect(debug).not.toMatch(/pin-set/);
      }
    } finally {
      fs.rmSync(racine, { recursive: true, force: true });
    }
  });

  test('empreintes identiques au modèle AppUser', () => {
    const modele =
      '/Users/remsko/Marketplace/AppUser/android/app/src/main/res/xml/network_security_config.xml';
    if (!fs.existsSync(modele)) return; // poste sans le dépôt Marketplace (CI)
    const xml = fs.readFileSync(modele, 'utf8');
    const pins = [...xml.matchAll(/<pin digest="SHA-256">([^<]+)<\/pin>/g)].map((m) => m[1]);
    expect(plugin.EMPREINTES.map((e) => e.sha256)).toEqual(pins);
    expect(xml).toContain(`expiration="${plugin.EXPIRATION}"`);
  });

  test('iOS : ATS sans chargement arbitraire, api.pearlstreets.com épinglé', async () => {
    const config = plugin(configFictive());
    const out = await config.mods.ios.infoPlist({
      ...config,
      modResults: {
        CFBundleName: 'Pearl List',
        NSAppTransportSecurity: { NSAllowsArbitraryLoads: true, NSAllowsLocalNetworking: true },
      },
      modRequest: {},
    });
    const ats = out.modResults.NSAppTransportSecurity;
    expect(ats.NSAllowsArbitraryLoads).toBe(false);
    expect(ats.NSAllowsLocalNetworking).toBe(true);
    expect(Object.keys(ats.NSPinnedDomains)).toEqual(['api.pearlstreets.com']);
    const d = ats.NSPinnedDomains['api.pearlstreets.com'];
    expect(d.NSIncludesSubdomains).toBe(false);
    expect(d.NSPinnedExpirationDate.toISOString()).toBe('2027-08-20T00:00:00.000Z');
    expect(d.NSPinnedCAIdentities.map((x) => x['SPKI-SHA256-BASE64'])).toEqual(
      plugin.EMPREINTES.map((e) => e.sha256)
    );
    expect(out.modResults.CFBundleName).toBe('Pearl List');
  });

  test('app.json déclare le plugin et garde allowBackup false', () => {
    const app = require('../app.json').expo;
    expect(app.plugins).toContain('./plugins/withSecuriteReseau');
    expect(app.android.allowBackup).toBe(false);
    expect(app.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads).toBe(false);
    // Mises à jour à distance (1.0.9) : serveur Expo du projet, runtime lié à la version.
    expect(app.updates.url).toBe(`https://u.expo.dev/${app.extra.eas.projectId}`);
    expect(app.runtimeVersion).toEqual({ policy: 'appVersion' });
  });
});

describe('useSecureScreen', () => {
  // Moteur minimal de hooks : un état, des effets lancés à la demande.
  let etat;
  let effets;
  const monter = (hook, ...args) => {
    effets = [];
    return hook(...args);
  };

  beforeEach(() => {
    jest.resetModules();
    etat = undefined;
    jest.doMock('react', () => ({
      useState: (init) => {
        if (etat === undefined) etat = init;
        return [
          etat,
          (v) => {
            etat = v;
          },
        ];
      },
      useEffect: (fn) => {
        effets.push(fn);
      },
    }));
  });

  afterEach(() => {
    jest.dontMock('react');
    jest.dontMock('expo-screen-capture');
  });

  test('pose puis lève la protection, la modale attend qu elle soit posée', async () => {
    const prevent = jest.fn(async () => {});
    const allow = jest.fn(async () => {});
    jest.doMock(
      'expo-screen-capture',
      () => ({ preventScreenCaptureAsync: prevent, allowScreenCaptureAsync: allow }),
      { virtual: true }
    );
    const useSecureScreen = require('../lib/useSecureScreen').default;

    expect(monter(useSecureScreen, 'paiement-carte', true)).toBe(false);
    const nettoyer = effets[0]();
    await Promise.resolve();
    await Promise.resolve();
    expect(prevent).toHaveBeenCalledWith('paiement-carte');
    expect(monter(useSecureScreen, 'paiement-carte', true)).toBe(true);

    nettoyer();
    expect(allow).toHaveBeenCalledWith('paiement-carte');
    expect(monter(useSecureScreen, 'paiement-carte', false)).toBe(false);
  });

  test('désactivé : aucune protection demandée', () => {
    const prevent = jest.fn(async () => {});
    jest.doMock(
      'expo-screen-capture',
      () => ({ preventScreenCaptureAsync: prevent, allowScreenCaptureAsync: jest.fn() }),
      { virtual: true }
    );
    const useSecureScreen = require('../lib/useSecureScreen').default;
    monter(useSecureScreen, 'moyens-de-paiement', false);
    expect(effets[0]()).toBeUndefined();
    expect(prevent).not.toHaveBeenCalled();
  });

  test('module natif absent : inerte, l écran s affiche', () => {
    jest.doMock(
      'expo-screen-capture',
      () => {
        throw new Error('absent');
      },
      { virtual: true }
    );
    const useSecureScreen = require('../lib/useSecureScreen').default;
    expect(monter(useSecureScreen, 'paiement-carte', true)).toBe(true);
    expect(effets[0]()).toBeUndefined();
  });

  test('échec de l API native : l écran s affiche quand même', async () => {
    jest.doMock(
      'expo-screen-capture',
      () => ({
        preventScreenCaptureAsync: jest.fn(async () => {
          throw new Error('refus');
        }),
        allowScreenCaptureAsync: jest.fn(async () => {
          throw new Error('refus');
        }),
      }),
      { virtual: true }
    );
    const useSecureScreen = require('../lib/useSecureScreen').default;
    monter(useSecureScreen, 'paiement-carte', true);
    const nettoyer = effets[0]();
    await Promise.resolve();
    await Promise.resolve();
    expect(monter(useSecureScreen, 'paiement-carte', true)).toBe(true);
    expect(() => nettoyer()).not.toThrow();
  });
});
