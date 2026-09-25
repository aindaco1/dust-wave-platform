import Foundation
import CoreFoundation

/// A projection of a user-selected .ips file, never the raw incident or stack.
public struct NativeCrashSummary: Codable, Equatable {
    public let exception: String
    public let signal: String?
    public let image: String?
    public let imageOffset: Int?
    public let version: String
    public let build: String
    public let operatingSystem: String
    public static let exceptions: Set<String> = ["EXC_BAD_ACCESS", "EXC_BAD_INSTRUCTION", "EXC_ARITHMETIC", "EXC_SOFTWARE", "EXC_BREAKPOINT", "EXC_CRASH", "EXC_RESOURCE", "EXC_GUARD"]
    public static let signals: Set<String> = ["SIGABRT", "SIGSEGV", "SIGBUS", "SIGILL", "SIGTRAP", "SIGKILL", "SIGFPE", "SIGTERM", "SIGPIPE"]
    public static func numericVersion(_ value: Any?) -> String {
        guard let value = value as? String,
              value.range(of: #"^[0-9]{1,8}(?:\.[0-9]{1,8}){0,3}$"#, options: .regularExpression) != nil else { return "0" }
        return value
    }
    public static func project(_ data: Data, bundleID: String, processNames: Set<String>, images: Set<String>) throws -> Self {
        guard data.count <= 2_097_152, let newline = data.firstIndex(of: 10),
              let header = try? JSONSerialization.jsonObject(with: data[..<newline]) as? [String: Any],
              let body = try? JSONSerialization.jsonObject(with: data[data.index(after: newline)...]) as? [String: Any],
              header["bundleID"] as? String == bundleID,
              let name = body["procName"] as? String, processNames.contains(name),
              let exception = body["exception"] as? [String: Any], let type = exception["type"] as? String,
              exceptions.contains(type) else { throw ReportDeliveryError.invalidReport }
        let bundle = body["bundleInfo"] as? [String: Any] ?? [:]
        if let bodyID = bundle["CFBundleIdentifier"] as? String, bodyID != bundleID { throw ReportDeliveryError.invalidReport }
        let signal = (exception["signal"] as? String).flatMap { signals.contains($0) ? $0 : nil }
        let threads = body["threads"] as? [[String: Any]] ?? []
        let index = integer(body["faultingThread"]) ?? -1
        let frames = threads.indices.contains(index) ? threads[index]["frames"] as? [[String: Any]] ?? [] : []
        let usedImages = body["usedImages"] as? [[String: Any]] ?? []
        var image: String?, offset: Int?
        for frame in frames.prefix(12) {
            guard let i = integer(frame["imageIndex"]), usedImages.indices.contains(i),
                  let name = usedImages[i]["name"] as? String, images.contains(name),
                  let value = integer(frame["imageOffset"]), (0...1_000_000_000).contains(value) else { continue }
            image = name; offset = value; break
        }
        let os = body["osVersion"] as? [String: Any] ?? [:]
        let train = os["train"] as? String ?? ""
        let parts = train.split(separator: " ")
        let version = parts.first == "macOS" && parts.count >= 2 ? numericVersion(String(parts[1])) : "0"
        return Self(exception: type, signal: signal, image: image, imageOffset: offset,
                    version: numericVersion(header["app_version"] ?? bundle["CFBundleShortVersionString"]),
                    build: numericVersion(header["build_version"] ?? bundle["CFBundleVersion"]), operatingSystem: version)
    }
    private static func integer(_ value: Any?) -> Int? {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
              number.doubleValue.isFinite, number.doubleValue.rounded() == number.doubleValue,
              number.doubleValue >= 0, number.doubleValue <= 1_000_000_000 else { return nil }
        return number.intValue
    }
}
