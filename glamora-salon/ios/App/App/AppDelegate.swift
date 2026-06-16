import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, MessagingDelegate {

    var window: UIWindow?

    // Send debug info directly to our server from native code
    private func nativeDebug(_ msg: String) {
        guard let url = URL(string: "http://192.168.1.75:3000/api/debug-log") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = "{\"msg\":\"[NATIVE] \(msg.replacingOccurrences(of: "\"", with: "'"))\"}"
        req.httpBody = body.data(using: .utf8)
        URLSession.shared.dataTask(with: req).resume()
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        nativeDebug("App launched - Firebase configured")
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenStr = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        nativeDebug("APNs token received: \(tokenStr.prefix(20))...")
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)

        Messaging.messaging().token { [weak self] token, error in
            if let error = error {
                self?.nativeDebug("FCM token ERROR: \(error.localizedDescription)")
                return
            }
            guard let token = token else {
                self?.nativeDebug("FCM token is nil")
                return
            }
            self?.nativeDebug("FCM token obtained: \(token.prefix(30))...")
            self?.injectFCMToken(token)
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        nativeDebug("APNs registration FAILED: \(error.localizedDescription)")
    }

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        nativeDebug("MessagingDelegate token: \(token.prefix(30))...")
        injectFCMToken(token)
    }

    private func injectFCMToken(_ token: String) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            let bridge = (self.window?.rootViewController as? CAPBridgeViewController)?.bridge
            let js = "window.__nativeFCMToken = '\(token)';"
            bridge?.webView?.evaluateJavaScript(js) { _, err in
                if let err = err {
                    self.nativeDebug("JS inject FAILED: \(err.localizedDescription)")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                        bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
                    }
                } else {
                    self.nativeDebug("JS inject SUCCESS - token set in WebView")
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
