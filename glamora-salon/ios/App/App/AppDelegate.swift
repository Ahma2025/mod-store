import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        return true
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        UserDefaults.standard.set(token, forKey: "glamora_fcm_token_firebase")
        // Retry injection multiple times to handle slow WebView load
        for delay in [1.0, 3.0, 6.0, 10.0, 15.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                self.injectFCMToken(token)
            }
        }
    }

    private func injectFCMToken(_ token: String) {
        let safeToken = token.replacingOccurrences(of: "'", with: "\\'")
        let js = "window.__nativeFCMToken = '\(safeToken)'; if(typeof onNativeFCMToken==='function') onNativeFCMToken('\(safeToken)');"
        DispatchQueue.main.async {
            self.evalInAllWindows(js)
        }
    }

    private func evalInAllWindows(_ js: String) {
        let scenes = UIApplication.shared.connectedScenes
        for scene in scenes {
            if let windowScene = scene as? UIWindowScene {
                for window in windowScene.windows {
                    if let rootVC = window.rootViewController {
                        self.evalInViewController(js, vc: rootVC)
                    }
                }
            }
        }
    }

    private func evalInViewController(_ js: String, vc: UIViewController) {
        if let bridge = (vc as? CAPBridgeViewController)?.bridge {
            bridge.webView?.evaluateJavaScript(js, completionHandler: nil)
            return
        }
        if let presented = vc.presentedViewController {
            evalInViewController(js, vc: presented)
        }
        for child in vc.children {
            evalInViewController(js, vc: child)
        }
        if let nav = vc as? UINavigationController {
            for childVC in nav.viewControllers {
                evalInViewController(js, vc: childVC)
            }
        }
    }

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
