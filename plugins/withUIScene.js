// Cycle de vie UIScene, exigé par iOS 27 (SDK Xcode 27) : sans lui l'app
// compilée avec ce SDK se ferme au lancement (« UIScene life cycle »).
// Le gabarit Expo 54 crée la fenêtre dans AppDelegate ; ce plugin la fait
// créer par un SceneDelegate, qui relaie liens et cycle de vie à AppDelegate
// pour que les modules Expo les reçoivent comme avant.
const { withAppDelegate, withInfoPlist, withPodfile } = require('@expo/config-plugins');

// Xcode 27 refuse les cibles de pods sous iOS 15 (Stripe, Maps, AsyncStorage
// déclarent encore 11 à 13.4) : on les remonte à 15.1 après pod install.
// Même chose pour les cibles de l'app ajoutées par d'autres plugins
// (extension de notifications OneSignal créée en 11.0).
const REMONTEE_PODS = `
    installer.pods_project.targets.each do |cible|
      cible.build_configurations.each do |conf|
        if conf.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 15.1
          conf.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end
    installer.aggregate_targets.map(&:user_project).uniq.each do |projet|
      modifie = false
      projet.targets.each do |cible|
        cible.build_configurations.each do |conf|
          cible_ios = conf.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
          if cible_ios && cible_ios.to_f < 15.1
            conf.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
            modifie = true
          end
        end
      end
      projet.save if modifie
    end`;

const BLOC_FENETRE = /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)\s*#endif/;

const SCENE_DELEGATE = `
// Cycle UIScene : crée la fenêtre et la vue React Native, transmet les liens
// (y compris au démarrage à froid) et le cycle de vie à AppDelegate.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene, let appDelegate = appDelegate else { return }

    var options = appDelegate.optionsDeLancement ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      options[.url] = url
    }
    if let activite = connectionOptions.userActivities.first {
      options[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType: activite.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activite,
      ]
    }

    // La fenêtre est connue d'AppDelegate AVANT la vue : expo-updates la
    // cherche pour poser la vraie vue.
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: options)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = appDelegate else { return }
    for contexte in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
      if let source = contexte.options.sourceApplication {
        options[.sourceApplication] = source
      }
      if let annotation = contexte.options.annotation {
        options[.annotation] = annotation
      }
      options[.openInPlace] = contexte.options.openInPlace
      _ = appDelegate.application(UIApplication.shared, open: contexte.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(UIApplication.shared, continue: userActivity) { _ in }
  }

  func windowScene(
    _ windowScene: UIWindowScene,
    didUpdate previousCoordinateSpace: UICoordinateSpace,
    interfaceOrientation previousInterfaceOrientation: UIInterfaceOrientation,
    traitCollection previousTraitCollection: UITraitCollection
  ) {
    NotificationCenter.default.post(name: NSNotification.Name.RCTWindowFrameDidChange, object: self)
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    appDelegate?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    appDelegate?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    appDelegate?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    appDelegate?.applicationDidEnterBackground(UIApplication.shared)
  }
}
`;

function withUIScene(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return c;
  });

  config = withPodfile(config, (c) => {
    let src = c.modResults.contents;
    if (!src.includes("conf.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'")) {
      if (!src.includes('post_install do |installer|')) {
        throw new Error('withUIScene : post_install introuvable dans le Podfile');
      }
      src = src.replace('post_install do |installer|', 'post_install do |installer|' + REMONTEE_PODS);
    }
    c.modResults.contents = src;
    return c;
  });

  return withAppDelegate(config, (c) => {
    let src = c.modResults.contents;
    if (c.modResults.language !== 'swift') {
      throw new Error('withUIScene : AppDelegate Swift attendu');
    }
    if (src.includes('class SceneDelegate')) return c;
    if (!BLOC_FENETRE.test(src)) {
      throw new Error("withUIScene : bloc de création de la fenêtre introuvable dans AppDelegate.swift (gabarit Expo changé ?)");
    }
    src = src.replace(BLOC_FENETRE, '    optionsDeLancement = launchOptions');
    src = src.replace(
      '  var window: UIWindow?\n',
      '  var window: UIWindow?\n  var optionsDeLancement: [UIApplication.LaunchOptionsKey: Any]?\n'
    );
    if (!src.includes('var optionsDeLancement')) {
      throw new Error('withUIScene : déclaration de window introuvable dans AppDelegate.swift');
    }
    c.modResults.contents = src + SCENE_DELEGATE;
    return c;
  });
}

module.exports = withUIScene;
