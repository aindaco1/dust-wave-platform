import Foundation

/// Bounded projection of MetricKit call-stack JSON. No subscriber, storage or upload.
/// Derived from Road Notice's characterized MIT implementation; the app supplies
/// its binary names. Raw addresses, system images, paths and symbols are discarded.
public enum MetricKitStackProjection {
    public struct Frame: Codable, Equatable, Sendable {
        public let uuid: String
        public let offset: UInt64
        public init(uuid: String, offset: UInt64) { self.uuid = uuid; self.offset = offset }
    }

    public static func frames(from data: Data, binaryNames: Set<String>) -> [Frame] {
        guard data.count <= 1_048_576, let root = try? JSONSerialization.jsonObject(with: data) else { return [] }
        var result: [Frame] = []; var visited = 0
        func walk(_ value: Any, depth: Int) {
            guard depth < 64, visited < 4096, result.count < 32 else { return }
            visited += 1
            if let object = value as? [String: Any] {
                if let name = object["binaryName"] as? String, binaryNames.contains(name),
                   let uuid = object["binaryUUID"] as? String, UUID(uuidString: uuid) != nil,
                   let number = object["offsetIntoBinaryTextSegment"] as? NSNumber,
                   number.doubleValue >= 0, number.doubleValue <= Double(UInt32.max),
                   number.doubleValue.rounded() == number.doubleValue {
                    result.append(.init(uuid: uuid.lowercased(), offset: number.uint64Value))
                }
                if let stacks = object["callStacks"] as? [[String: Any]] {
                    for stack in stacks.sorted(by: { ($0["threadAttributed"] as? Bool == true ? 0 : 1) < ($1["threadAttributed"] as? Bool == true ? 0 : 1) }) { walk(stack, depth: depth + 1) }
                }
                for key in ["callStackRootFrames", "subFrames"] { if let nested = object[key] { walk(nested, depth: depth + 1) } }
            } else if let array = value as? [Any] { for item in array.prefix(4096) { walk(item, depth: depth + 1) } }
        }
        walk(root, depth: 0); return result
    }
}
