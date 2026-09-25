import Foundation
import XCTest
import DustWaveSupport

final class SupportTests: XCTestCase {
    func testProjectionKeepsOnlySelectedBinaryAndRelativeFrames() throws {
        let uuid = UUID().uuidString
        let tree: [String: Any] = ["callStacks": [["threadAttributed": true, "callStackRootFrames": [
            ["binaryName": "Other", "binaryUUID": uuid, "offsetIntoBinaryTextSegment": 1],
            ["binaryName": "App", "binaryUUID": uuid, "offsetIntoBinaryTextSegment": 512, "path": "/private/person", "address": 999]
        ]]]]
        let data = try JSONSerialization.data(withJSONObject: tree)
        XCTAssertEqual(MetricKitStackProjection.frames(from: data, binaryNames: ["App"]), [.init(uuid: uuid.lowercased(), offset: 512)])
        XCTAssertEqual(MetricKitStackProjection.frames(from: data, binaryNames: []), [])
        let output = String(decoding: try JSONEncoder().encode(MetricKitStackProjection.frames(from: data, binaryNames: ["App"])), as: UTF8.self)
        XCTAssertFalse(output.contains("private")); XCTAssertFalse(output.contains("999"))
    }

    func testProjectionBoundsInputFramesAndOffsets() throws {
        XCTAssertEqual(MetricKitStackProjection.frames(from: Data(repeating: 32, count: 1_048_577), binaryNames: ["App"]), [])
        let frame: [String: Any] = ["binaryName": "App", "binaryUUID": UUID().uuidString, "offsetIntoBinaryTextSegment": 1]
        let data = try JSONSerialization.data(withJSONObject: ["callStackRootFrames": Array(repeating: frame, count: 40)])
        XCTAssertEqual(MetricKitStackProjection.frames(from: data, binaryNames: ["App"]).count, 32)
        for offset: NSNumber in [-1, 0.5, NSNumber(value: UInt64(UInt32.max) + 1)] {
            var invalid = frame; invalid["offsetIntoBinaryTextSegment"] = offset
            XCTAssertEqual(MetricKitStackProjection.frames(from: try JSONSerialization.data(withJSONObject: invalid), binaryNames: ["App"]), [])
        }
    }
}
