// Config plugin Expo : toucher d'une notification quand Android a tué l'app
// en gardant sa fenêtre (mémoire, arrière-plan long).
//
// Le toucher relance l'activité et arrive par onNewIntent pendant le
// chargement de l'app. Expo l'ignore tant que ce chargement n'est pas fini
// (ReactActivityDelegateWrapper.onNewIntent : loadAppReady non terminé), et
// la notification ouvrait alors l'accueil. L'intent est redonné quelques
// fois pendant les 10 premières secondes : App.js ne traite qu'une fois un
// même toucher (dédoublonnage par identifiant).
//
// android/ est GÉNÉRÉ au build : la règle doit vivre ici.

const { withMainActivity } = require('@expo/config-plugins');

const MARQUE = 'Toucher de notification redonné';

const IMPORTS = ['android.content.Intent', 'android.os.Handler', 'android.os.Looper'];

const METHODE = `
  // ${MARQUE} pendant le chargement (plugins/withToucherNotification.js).
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    if (intent.extras?.containsKey("google.message_id") != true) return
    val principal = Handler(Looper.getMainLooper())
    longArrayOf(1000L, 3000L, 6000L, 10000L).forEach { delai ->
      principal.postDelayed({
        if (!isFinishing && !isDestroyed) super.onNewIntent(intent)
      }, delai)
    }
  }
`;

function ajouterAuKotlin(source) {
  if (source.includes(MARQUE)) return source;
  let sortie = source;
  const manquants = IMPORTS.filter(
    (imp) => !new RegExp(`^import ${imp.replace(/\./g, '\\.')}$`, 'm').test(sortie),
  );
  if (manquants.length) {
    const bloc = manquants.map((imp) => `import ${imp}\n`).join('');
    sortie = sortie.replace(/^(package [^\n]+\n)/m, `$1\n${bloc}`);
  }
  const classe = /class MainActivity\s*:\s*ReactActivity\(\)\s*\{/;
  if (!classe.test(sortie)) {
    throw new Error('withToucherNotification : classe MainActivity introuvable');
  }
  return sortie.replace(classe, (m) => `${m}${METHODE}`);
}

module.exports = function withToucherNotification(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withToucherNotification : MainActivity Kotlin attendue');
    }
    cfg.modResults.contents = ajouterAuKotlin(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.ajouterAuKotlin = ajouterAuKotlin;
