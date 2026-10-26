// Pliable Android : plier ou deplier ne doit pas recreer l'activite (sinon la
// page ouverte et l'etat sont perdus, et les tailles d'ecran restent celles
// d'avant). L'activite principale declare donc gerer elle-meme ces
// changements ; React Native recoit la nouvelle taille et l'app se remet en
// page sans redemarrer. Pose a chaque prebuild.
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const REQUIS = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenLayout',
  'screenSize',
  'smallestScreenSize',
  'uiMode',
];

module.exports = function withConfigChanges(config) {
  return withAndroidManifest(config, (cfg) => {
    const activite = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const actuels = (activite.$['android:configChanges'] || '')
      .split('|')
      .map((v) => v.trim())
      .filter(Boolean);
    const tous = [...actuels];
    REQUIS.forEach((v) => {
      if (!tous.includes(v)) tous.push(v);
    });
    activite.$['android:configChanges'] = tous.join('|');
    return cfg;
  });
};
