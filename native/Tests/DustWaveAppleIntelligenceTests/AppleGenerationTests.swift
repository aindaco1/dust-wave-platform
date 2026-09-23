import FoundationModels
@testable import DustWaveAppleIntelligence
import XCTest

final class AppleGenerationTests: XCTestCase {
    func testConsumerResponseBudgetsStayUnchanged() throws {
        guard #available(macOS 26.0, *) else { throw XCTSkip("Requires Foundation Models") }
        for count in [40, 128, 384, 512, 768, 1024, 2048] {
            let options = try AppleGeneration.options(maximumResponseTokens: count)
            XCTAssertEqual(options.maximumResponseTokens, count)
        }
        for count in [0, -1, 4097] {
            XCTAssertThrowsError(try AppleGeneration.options(maximumResponseTokens: count)) {
                XCTAssertEqual($0 as? AppleGeneration.RequestError, .invalidResponseLimit)
            }
        }
    }

    func testCancellationDoesNotStartGeneration() async throws {
        guard #available(macOS 26.0, *) else { throw XCTSkip("Requires Foundation Models") }
        let task = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            return try await AppleGeneration.checked {
                XCTFail("Cancelled requests must not start inference")
                return "unreachable"
            }
        }
        do { _ = try await task.value; XCTFail("Expected cancellation") }
        catch is CancellationError { }
    }

    func testCancellationDiscardsCompletedOutput() async throws {
        guard #available(macOS 26.0, *) else { throw XCTSkip("Requires Foundation Models") }
        let task = Task {
            try await AppleGeneration.checked {
                withUnsafeCurrentTask { $0?.cancel() }
                return "must not be applied"
            }
        }
        do { _ = try await task.value; XCTFail("Expected cancellation") }
        catch is CancellationError { }
    }

    func testProviderErrorsAreNotReplacedByFallback() async throws {
        guard #available(macOS 26.0, *) else { throw XCTSkip("Requires Foundation Models") }
        enum Failure: Error { case sentinel }
        do {
            let _: String = try await AppleGeneration.checked { throw Failure.sentinel }
            XCTFail("Expected the original error")
        } catch Failure.sentinel { }
    }
}
