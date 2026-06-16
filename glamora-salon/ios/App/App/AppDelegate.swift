import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize Firebase for FCM push notifications
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        return true
    }

    // Firebase gives us the real FCM registration token here
    // (This is what we send to our backend, not the raw APNs token)
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        UserDefaults.standard.set(token, forKey: "glamora_fcm_token_firebase")

        // Inject FCM token into the WebView so JavaScript can pick it up
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.injectFCMToken(token)
        }
    }

    private func injectFCMToken(_ token: String) {
        guard let window = UIApplication.shared.windows.first,
              let rootVC = window.rootViewController else { return }
        let js = "window.__nativeFCMToken = '\(token)'; if(typeof onNativeFCMToken==='function') onNativeFCMToken('\(token)');"
        findBridgeAndEval(js, in: rootVC)
    }

    private func findBridgeAndEval(_ js: String, in vc: UIViewController) {
        if let bridge = (vc as? CAPBridgeViewController)?.bridge {
            bridge.webView?.evaluateJavaScript(js, completionHandler: nil)
        } else if let nav = vc as? UINavigationController,
                  let top = nav.topViewController {
            findBridgeAndEval(js, in: top)
        }
    }

    // When swizzling is disabled, we must manually forward the APNs token to Firebase
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
