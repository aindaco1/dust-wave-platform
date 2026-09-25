import Foundation
import XCTest
@testable import DustWaveDiagnostics

private final class ReportProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        let count = Int(request.url!.lastPathComponent)!
        let response = HTTPURLResponse(url: request.url!, statusCode: 429, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(repeating: 32, count: count))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

final class TransportTests: XCTestCase {
    func testBoundedStreamingPreservesStatusForConsumerFailurePolicy() async throws {
        func configuration() -> URLSessionConfiguration {
            let result = URLSessionConfiguration.ephemeral
            result.protocolClasses = [ReportProtocol.self]
            return result
        }
        var request = URLRequest(url: URL(string: "https://example.invalid/4096")!)
        request.httpMethod = "POST"
        let (data, response) = try await BoundedReportTransport().send(request,
            maximumResponseBytes: 4096, configuration: configuration())
        XCTAssertEqual(data.count, 4096)
        XCTAssertEqual(response.statusCode, 429)
        request.url = URL(string: "https://example.invalid/4097")!
        do {
            _ = try await BoundedReportTransport().send(request,
                maximumResponseBytes: 4096, configuration: configuration())
            XCTFail("oversized response accepted")
        } catch ReportTransportError.responseTooLarge {} catch { XCTFail("unexpected error: \(error)") }
    }

    func testRedirectDelegateRejectsRedirects() {
        let transport = BoundedReportTransport()
        let url = URL(string: "https://example.invalid/reports")!
        let session = URLSession(configuration: .ephemeral)
        defer { session.invalidateAndCancel() }
        transport.urlSession(session, task: session.dataTask(with: url),
            willPerformHTTPRedirection: HTTPURLResponse(url: url, statusCode: 302, httpVersion: nil, headerFields: nil)!,
            newRequest: URLRequest(url: URL(string: "https://redirect.invalid")!)) { XCTAssertNil($0) }
    }

    func testReceiptAdaptersRetainUUIDAndLegacyExactStringContracts() throws {
        let id = UUID().uuidString.lowercased()
        func data(_ action: String, id: String) throws -> Data {
            try JSONSerialization.data(withJSONObject: ["ok": true, "reportId": id,
                "action": action, "issueNumber": 10])
        }
        XCTAssertThrowsError(try ReportAcknowledgement.decode(data("aggregated", id: id), reportID: id, maximumBytes: 4096))
        XCTAssertEqual(try ReportAcknowledgement.decode(data("aggregated", id: id), reportID: id,
            maximumBytes: 4096, actions: ["aggregated"]).issueNumber, 10)
        XCTAssertThrowsError(try ReportAcknowledgement.decode(data("created", id: id.uppercased()), reportID: id, maximumBytes: 4096))
        XCTAssertEqual(try ReportAcknowledgement.decode(data("created", id: id.uppercased()), reportID: id,
            maximumBytes: 4096, compareUUID: true).issueNumber, 10)
        XCTAssertThrowsError(try ReportAcknowledgement.decode(data("created", id: id), reportID: id,
            maximumBytes: 4096, maximumIssueNumber: 9))
    }
}
