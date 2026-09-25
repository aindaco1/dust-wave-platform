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
    private var pendingInstall: (() -> Void)?
    public var busy = false {
        didSet {
            if !busy, let install = pendingInstall { pendingInstall = nil; install() }
        }
    }
    public init(startingUpdater: Bool = true) {
        started = startingUpdater
        super.init()
        controller = SPUStandardUpdaterController(startingUpdater: startingUpdater, updaterDelegate: self, userDriverDelegate: nil)
        controller.updater.publisher(for: \.canCheckForUpdates)
            .sink { [weak self] in self?.canCheckForUpdates = $0 }.store(in: &observations)
        controller.updater.publisher(for: \.automaticallyChecksForUpdates)
            .sink { [weak self] in self?.automaticallyChecksForUpdates = $0 }.store(in: &observations)
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
        if busy { throw NSError(domain: "DustWave.Updates", code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Finish the current operation, then check for updates."]) }
    }
    public func updater(_ updater: SPUUpdater, shouldPostponeRelaunchForUpdate item: SUAppcastItem,
                        untilInvokingBlock installHandler: @escaping () -> Void) -> Bool {
        guard busy else { return false }
        pendingInstall = installHandler
        return true
    }
}
