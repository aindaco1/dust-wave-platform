import Combine
import Foundation
import Sparkle

/// Record's standard Sparkle flow with Auto Subtitle's busy-operation guard.
/// The consumer owns feed/key configuration and decides when to start.
@MainActor public final class AppUpdateController: NSObject, ObservableObject, SPUUpdaterDelegate {
    @Published public private(set) var canCheckForUpdates = false
    @Published public private(set) var automaticallyChecksForUpdates = false
    private var controller: SPUStandardUpdaterController!
    private var observations = Set<AnyCancellable>()
    private var policy = LaunchUpdateCheckPolicy()
    private let started: Bool
    private let busyErrorDomain: String
    private let busyErrorMessage: String
    private var pendingInstall: (() -> Void)?
    public var busy = false {
        didSet {
            if !busy, let install = pendingInstall { pendingInstall = nil; install() }
        }
    }
    public init(startingUpdater: Bool = true, checkingOnLaunch: Bool = false,
                busyErrorDomain: String = "DustWave.Updates",
                busyErrorMessage: String = "Finish the current operation, then check for updates.") {
        started = startingUpdater
        self.busyErrorDomain = busyErrorDomain
        self.busyErrorMessage = busyErrorMessage
        super.init()
        controller = SPUStandardUpdaterController(startingUpdater: startingUpdater, updaterDelegate: self, userDriverDelegate: nil)
        controller.updater.publisher(for: \.canCheckForUpdates)
            .sink { [weak self] in self?.canCheckForUpdates = $0 }.store(in: &observations)
        controller.updater.publisher(for: \.automaticallyChecksForUpdates)
            .sink { [weak self] in self?.automaticallyChecksForUpdates = $0 }.store(in: &observations)
        if checkingOnLaunch { checkOnLaunch() }
    }
    public func setAutomaticChecks(_ enabled: Bool) { controller.updater.automaticallyChecksForUpdates = enabled }
    public func checkOnLaunch() {
        if started && policy.takeLaunchCheck(enabled: automaticallyChecksForUpdates, busy: busy) {
            controller.updater.checkForUpdatesInBackground()
        }
    }
    public func checkForUpdates() {
        guard started, !busy, canCheckForUpdates else { return }
        controller.checkForUpdates(nil)
    }
    public func updater(_ updater: SPUUpdater, mayPerform updateCheck: SPUUpdateCheck) throws {
        if busy { throw NSError(domain: busyErrorDomain, code: 1,
            userInfo: [NSLocalizedDescriptionKey: busyErrorMessage]) }
    }
    public func updater(_ updater: SPUUpdater, shouldPostponeRelaunchForUpdate item: SUAppcastItem,
                        untilInvokingBlock installHandler: @escaping () -> Void) -> Bool {
        guard busy else { return false }
        pendingInstall = installHandler
        return true
    }
}
