import FluidAudio
import Foundation
import DustWaveSpeechCore
@testable import DustWaveSpeech
import XCTest

final class DustWaveSpeechTests: XCTestCase {
    func testOfflinePolicyBlocksDownloadEntryPoint() async {
        LocalSpeechOfflinePolicy.enforce()
        XCTAssertTrue(LocalSpeechOfflinePolicy.isEnforced)
        do {
            _ = try await ModelHub.fetchWithAuth(
                from: URL(fileURLWithPath: "/network-must-remain-disabled")
            )
            XCTFail("offline speech primitives must block FluidAudio downloads")
        } catch {
            XCTAssertTrue(LocalSpeechOfflinePolicy.isEnforced)
        }
    }

    func testPublicResultContractsAreStableAndCodable() throws {
        let result = ParakeetTranscriptResult(
            text: "hello", durationSeconds: 1, confidence: 0.9,
            tokens: [.init(text: "▁hello", tokenId: 1, startsAtSeconds: 0, endsAtSeconds: 1, confidence: 0.9)],
            words: [.init(text: "hello", startsAtSeconds: 0, endsAtSeconds: 1)]
        )
        XCTAssertEqual(try JSONDecoder().decode(ParakeetTranscriptResult.self, from: JSONEncoder().encode(result)), result)
        XCTAssertEqual(ParakeetTranscriber.defaultModelDirectory(for: .v3).lastPathComponent, "parakeet-tdt-0.6b-v3")
    }

    func testSharedModelVerifierRejectsAnIncompleteModel() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        XCTAssertThrowsError(try ParakeetModelVerifier.validateV3(at: root)) { error in
            XCTAssertTrue(String(describing: error).contains("Preprocessor.mlmodelc/coremldata.bin is missing"))
        }
    }

    func testAudioDurationFillsFluidAudioZeroDuration() {
        XCTAssertEqual(ParakeetTranscriber.resolvedDuration(reported: 0, audio: 87), 87)
        XCTAssertEqual(ParakeetTranscriber.resolvedDuration(reported: 86.9, audio: 87), 86.9)
    }

    func testUnpreparedEnginesRejectBeforeProgressOrAudioAccess() async {
        let audio = URL(fileURLWithPath: "/synthetic-audio-must-not-be-opened")
        do {
            _ = try await ParakeetTranscriber().transcribe(audio, progress: { _ in
                XCTFail("Unprepared inference must not report progress")
            })
            XCTFail("Expected notPrepared")
        } catch ParakeetTranscriber.TranscriberError.notPrepared { }
        catch { XCTFail("Unexpected error: \(error)") }
        do {
            _ = try await OfflineSpeakerDiarizer().diarize(audio, progress: { _, _ in
                XCTFail("Unprepared diarization must not report progress")
            })
            XCTFail("Expected notPrepared")
        } catch OfflineSpeakerDiarizer.DiarizerError.notPrepared { }
        catch { XCTFail("Unexpected error: \(error)") }
    }

    func testModelVerificationRejectsTamperingAndSymlinkEscapes() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appendingPathComponent("model.bin")
        try Data("hello".utf8).write(to: file)
        let manifest = ParakeetModelManifest(model: .v3, sourceRevision: "synthetic",
            localFolderName: "synthetic", files: [.init(path: "model.bin", size: 5,
                sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")])
        try ParakeetModelVerifier.validate(modelAt: root, manifest: manifest)
        try Data("other".utf8).write(to: file)
        XCTAssertThrowsError(try ParakeetModelVerifier.validate(modelAt: root, manifest: manifest)) {
            guard case ParakeetModelVerifier.VerificationError.checksumMismatch = $0 else {
                return XCTFail("Expected checksum rejection")
            }
        }
        try FileManager.default.removeItem(at: file)
        try FileManager.default.createSymbolicLink(at: file, withDestinationURL: root.deletingLastPathComponent())
        XCTAssertThrowsError(try ParakeetModelVerifier.validate(modelAt: root, manifest: manifest)) {
            guard case ParakeetModelVerifier.VerificationError.unsafeFile = $0 else {
                return XCTFail("Expected path-containment rejection")
            }
        }
    }

    func testSpeakerCountConstraintDistinguishesAutomaticAndExactModes() {
        let automatic = OfflineSpeakerDiarizer(maximumSpeakers: 6)
        XCTAssertEqual(automatic.speakerConstraint, .automatic(maximum: 6))
        let exact = OfflineSpeakerDiarizer(maximumSpeakers: 6, expectedSpeakers: 2)
        XCTAssertEqual(exact.speakerConstraint, .exact(2))
        XCTAssertEqual(exact.speakerConstraint.maximum, 2)
    }
}
