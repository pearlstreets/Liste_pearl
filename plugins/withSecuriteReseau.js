// Durcissement réseau du binaire (Android et iOS), posé au build.
//
// Pearl List n'a pas de dossier android/ ni ios/ versionné : le natif est
// GÉNÉRÉ au build depuis app.json et ses plugins. Ce plugin écrit donc la
// configuration réseau à chaque génération :
//
//  - Android :
//      * res/xml/network_security_config.xml de PRODUCTION (src/main) :
//        HTTPS obligatoire partout, autorités système seulement, épinglage de
//        api.pearlstreets.com ;
//      * même ressource dans src/debug et src/debugOptimized : le variant
//        l'emporte à la fusion, la production n'en hérite rien. Trafic en
//        clair permis pour Metro, pas d'épinglage ;
//      * <application> : android:networkSecurityConfig,
//        android:usesCleartextTraffic="false", android:allowBackup="false"
//        (déjà demandé dans app.json, redit ici pour ne pas dépendre de
//        l'ordre des plugins).
//  - iOS : NSAppTransportSecurity, NSAllowsArbitraryLoads à false et
//    NSPinnedDomains pour api.pearlstreets.com. Fait ici et non dans
//    app.json parce que la soupape NSPinnedExpirationDate doit être une vraie
//    <date> dans Info.plist, ce que le JSON de app.json ne sait pas écrire.
//
// Empreintes et soupape : copie EXACTE du modèle AppUser
// (android/app/src/main/res/xml/network_security_config.xml et
// ios/marketplace/Info.plist). On épingle les ANCRES (racines et
// intermédiaire), jamais la feuille que Let's Encrypt renouvelle tous les
// 60 jours environ. Une seule correspondance suffit.
// À revalider à chaque build annuel :
//   openssl s_client -servername api.pearlstreets.com \
//       -connect api.pearlstreets.com:443 -showcerts
//
// Les autres domaines (api.frankfurter.app, Stripe, images...) restent en
// HTTPS normal, NON épinglés.

const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withInfoPlist } = require('expo/config-plugins');

const DOMAINE_EPINGLE = 'api.pearlstreets.com';
// Soupape : passée cette date, l'épinglage cesse d'être appliqué au lieu de
// couper l'API. MÊME date sur les deux plateformes.
const EXPIRATION = '2027-08-20';

const EMPREINTES = [
  { nom: 'ISRG Root X1', sha256: 'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=' },
  { nom: 'ISRG Root X2', sha256: 'diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=' },
  { nom: 'ISRG Root YE', sha256: 'sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=' },
  {
    nom: "Let's Encrypt YE2 (intermédiaire, secours)",
    sha256: 's/tdAOmUzd8syaTuqfgGvFcn6DzA5Cmb+Vby1ST+U3Y=',
  },
];

const NOM_RESSOURCE = 'network_security_config';

function xmlRelease() {
  const pins = EMPREINTES.map(
    (e) => `            <!-- ${e.nom} -->\n            <pin digest="SHA-256">${e.sha256}</pin>`
  ).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Généré par plugins/withSecuriteReseau.js : ne pas modifier à la main. -->
<network-security-config>
    <!-- Défaut : HTTPS obligatoire partout, autorités système seulement. -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <!-- API : épinglage des ancres de confiance, avec soupape d'expiration. -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="false">${DOMAINE_EPINGLE}</domain>
        <pin-set expiration="${EXPIRATION}">
${pins}
        </pin-set>
    </domain-config>
</network-security-config>
`;
}

// Builds debug seulement (src/debug, src/debugOptimized) : Metro tourne en
// clair, sur localhost, l'émulateur ou l'adresse du poste sur le réseau
// local. Pas d'épinglage, autorités de l'utilisateur acceptées (proxy).
function xmlDebug() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Généré par plugins/withSecuriteReseau.js : builds DEBUG uniquement. -->
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;
}

function appliquerManifeste(manifest) {
  const app = manifest?.manifest?.application?.[0];
  if (!app) throw new Error('withSecuriteReseau : <application> absent du manifeste Android');
  app.$ = app.$ || {};
  app.$['android:networkSecurityConfig'] = `@xml/${NOM_RESSOURCE}`;
  app.$['android:usesCleartextTraffic'] = 'false';
  app.$['android:allowBackup'] = 'false';
  return manifest;
}

function ecrireXml(racineAndroid) {
  const cibles = [
    ['main', xmlRelease()],
    ['debug', xmlDebug()],
    ['debugOptimized', xmlDebug()],
  ];
  for (const [variante, contenu] of cibles) {
    const dossier = path.join(racineAndroid, 'app', 'src', variante, 'res', 'xml');
    fs.mkdirSync(dossier, { recursive: true });
    fs.writeFileSync(path.join(dossier, `${NOM_RESSOURCE}.xml`), contenu);
  }
}

function appliquerInfoPlist(plist) {
  const ats = { ...(plist.NSAppTransportSecurity || {}) };
  ats.NSAllowsArbitraryLoads = false;
  ats.NSPinnedDomains = {
    ...(ats.NSPinnedDomains || {}),
    [DOMAINE_EPINGLE]: {
      NSIncludesSubdomains: false,
      NSPinnedExpirationDate: new Date(`${EXPIRATION}T00:00:00Z`),
      NSPinnedCAIdentities: EMPREINTES.map((e) => ({ 'SPKI-SHA256-BASE64': e.sha256 })),
    },
  };
  plist.NSAppTransportSecurity = ats;
  return plist;
}

function withSecuriteReseau(config) {
  config = withAndroidManifest(config, (cfg) => {
    cfg.modResults = appliquerManifeste(cfg.modResults);
    return cfg;
  });
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      ecrireXml(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults = appliquerInfoPlist(cfg.modResults);
    return cfg;
  });
  return config;
}

module.exports = withSecuriteReseau;
module.exports.xmlRelease = xmlRelease;
module.exports.xmlDebug = xmlDebug;
module.exports.appliquerManifeste = appliquerManifeste;
module.exports.appliquerInfoPlist = appliquerInfoPlist;
module.exports.EMPREINTES = EMPREINTES;
module.exports.EXPIRATION = EXPIRATION;
