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

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)

        // Explicitly request FCM token after APNs token is set
        Messaging.messaging().token { [weak self] token, error in
            if let error = error {
                print("FCM: token error: \(error.localizedDescription)")
                return
            }
            guard let token = token else { return }
            print("FCM: Got token via explicit call: \(token.prefix(20))...")
            self?.injectFCMToken(token)
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("FCM: Failed APNs registration: \(error.localizedDescription)")
    }

    // Also receives token via delegate callback
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        print("FCM: Token via delegate: \(token.prefix(20))...")
        injectFCMToken(token)
    }

    private func injectFCMToken(_ token: String) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let bridge = (self.window?.rootViewController as? CAPBridgeViewController)?.bridge
            let js = "window.__nativeFCMToken = '\(token)';"
            bridge?.webView?.evaluateJavaScript(js) { _, err in
                if let err = err {
                    print("FCM: JS inject error: \(err.localizedDescription)")
                    // Retry after 2 seconds
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                        bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
                    }
                } else {
                    print("FCM: JS inject success")
                }
            }
        }
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
