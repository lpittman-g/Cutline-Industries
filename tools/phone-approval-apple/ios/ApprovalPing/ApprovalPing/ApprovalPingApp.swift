import SwiftUI
import UserNotifications

@main
struct ApprovalPingApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(AppState.shared)
        }
    }
}

final class AppState: ObservableObject {
    static let shared = AppState()
    @Published var deviceToken: String = ""
    @Published var lastApprovalId: String = ""
    @Published var lastService: String = ""
    @Published var status: String = "Waiting for APNs registration…"
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            DispatchQueue.main.async {
                AppState.shared.status = granted ? "Push permission granted — registering…" : "Push permission denied"
            }
            if granted {
                DispatchQueue.main.async { application.registerForRemoteNotifications() }
            }
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        DispatchQueue.main.async {
            AppState.shared.deviceToken = token
            AppState.shared.status = "Device token ready — paste into agent"
            UIPasteboard.general.string = token
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        DispatchQueue.main.async {
            AppState.shared.status = "APNs registration failed: \(error.localizedDescription)"
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        handle(userInfo: notification.request.content.userInfo)
        completionHandler([.banner, .sound, .list])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        handle(userInfo: response.notification.request.content.userInfo)
        completionHandler()
    }

    private func handle(userInfo: [AnyHashable: Any]) {
        let approvalId = userInfo["approvalId"] as? String ?? ""
        let service = userInfo["service"] as? String ?? "Agent request"
        DispatchQueue.main.async {
            AppState.shared.lastApprovalId = approvalId
            AppState.shared.lastService = service
            AppState.shared.status = approvalId.isEmpty ? "Notification received" : "Approval pending: \(service)"
        }
    }
}
