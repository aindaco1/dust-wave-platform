// Adapted from Record and Auto Subtitle; retained MIT notices accompany this package.
public struct LaunchUpdateCheckPolicy {
    private var checked = false
    public init() {}
    public mutating func takeLaunchCheck(enabled: Bool, busy: Bool) -> Bool {
        guard enabled, !busy, !checked else { return false }
        checked = true
        return true
    }
}
