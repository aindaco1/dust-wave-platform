import XCTest
@testable import DustWaveDiagnostics
@testable import DustWaveUpdates
final class DiagnosticsTests: XCTestCase {
    func testLaunchCheckRespectsOptOutBusyAndOnce() {
        var policy = LaunchUpdateCheckPolicy()
        XCTAssertFalse(policy.takeLaunchCheck(enabled: false, busy: false))
        XCTAssertFalse(policy.takeLaunchCheck(enabled: true, busy: true))
        XCTAssertTrue(policy.takeLaunchCheck(enabled: true, busy: false))
        XCTAssertFalse(policy.takeLaunchCheck(enabled: true, busy: false))
    }
    func testReceiptsRequireMatchingAcknowledgement() throws {
        let id = UUID()
        func receipt(_ overrides: [String: Any] = [:]) throws -> Data {
            var value: [String: Any] = ["ok": true, "reportId": id.uuidString, "issueNumber": 2, "action": "created"]
            value.merge(overrides) { _, b in b }; return try JSONSerialization.data(withJSONObject: value)
        }
        XCTAssertEqual(try ReportReceipt.decode(receipt(), reportID: id).issueNumber, 2)
        XCTAssertTrue(try ReportReceipt.decode(receipt(["action": "duplicate"]), reportID: id).duplicate)
        for invalid: [String: Any] in [["ok": false], ["reportId": UUID().uuidString], ["issueNumber": 0],
                ["issueNumber": true], ["issueNumber": 1.5], ["action": "pending"]] {
            XCTAssertThrowsError(try ReportReceipt.decode(receipt(invalid), reportID: id))
        }
        XCTAssertThrowsError(try ReportReceipt.decode(Data(repeating: 32, count: 8193), reportID: id))
    }
    func testCrashProjectionDropsPrivateDataAndUsesIncidentVersion() throws {
        let header: [String: Any] = ["bundleID": "xyz.dustwave.paper", "app_version": "0.3.0", "build_version": "6", "incident_id": "PRIVATE"]
        let body: [String: Any] = ["procName": "Paper", "procPath": "/Users/private/Paper", "exception": ["type": "EXC_BAD_ACCESS", "signal": "SIGSEGV"], "faultingThread": 0,
            "threads": [["frames": [["imageIndex": 0, "imageOffset": 123, "symbol": "PRIVATE"]]]],
            "usedImages": [["name": "Paper", "path": "/Users/private/Paper"]], "osVersion": ["train": "macOS 27.0 (26A428)"]]
        let data = try JSONSerialization.data(withJSONObject: header) + Data([10]) + JSONSerialization.data(withJSONObject: body)
        let result = try NativeCrashSummary.project(data, bundleID: "xyz.dustwave.paper", processNames: ["Paper"], images: ["Paper"])
        XCTAssertEqual(result.imageOffset, 123); XCTAssertEqual(result.build, "6"); XCTAssertEqual(result.operatingSystem, "27.0")
        let json = String(decoding: try JSONEncoder().encode(result), as: UTF8.self)
        XCTAssertFalse(json.contains("PRIVATE")); XCTAssertFalse(json.contains("/Users/")); XCTAssertFalse(json.contains("symbol"))
        XCTAssertThrowsError(try NativeCrashSummary.project(data, bundleID: "other.app", processNames: ["Paper"], images: ["Paper"]))
        XCTAssertThrowsError(try NativeCrashSummary.project(Data(repeating: 10, count: 2_097_153), bundleID: "xyz.dustwave.paper", processNames: ["Paper"], images: ["Paper"]))
    }
}
