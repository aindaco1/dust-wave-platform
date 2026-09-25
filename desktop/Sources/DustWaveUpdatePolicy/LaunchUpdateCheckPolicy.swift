// Adapted from Record and Auto Subtitle; retained MIT notices accompany this package.
/// A disabled or busy launch does not consume the one allowed background check.
public struct LaunchUpdateCheckPolicy {
    private var checked = false
    public init() {}
    public static func shouldCheckInBackground(startingUpdater: Bool, automaticallyChecksForUpdates: Bool) -> Bool {
        startingUpdater && automaticallyChecksForUpdates
    }
    public mutating func takeLaunchCheck(enabled: Bool, busy: Bool) -> Bool {
        guard enabled, !busy, !checked else { return false }
        checked = true
        return true
    }
}
