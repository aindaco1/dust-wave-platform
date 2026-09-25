import Foundation

public enum ReportDeliveryError: LocalizedError {
    case invalidReport, unconfirmed
    public var errorDescription: String? {
        switch self {
        case .invalidReport: return "The diagnostic report is invalid. Refresh it and try again."
        case .unconfirmed: return "Delivery was not confirmed. Keep this report and retry later."
        }
    }
}

public struct ReportReceipt: Equatable {
    public let issueNumber: Int
    public let duplicate: Bool
    public static func decode(_ data: Data, reportID: UUID) throws -> Self {
        struct Receipt: Decodable { let ok: Bool; let reportId: UUID; let issueNumber: Int; let action: String }
        guard data.count <= 8192, let value = try? JSONDecoder().decode(Receipt.self, from: data), value.ok,
              value.reportId == reportID, value.issueNumber > 0, value.issueNumber <= 9_007_199_254_740_991,
              ["created", "updated", "duplicate"].contains(value.action) else { throw ReportDeliveryError.unconfirmed }
        return Self(issueNumber: value.issueNumber, duplicate: value.action == "duplicate")
    }
}

/// Auto Subtitle's reviewed-send contract, implemented natively without its Node runtime.
/// Never sends on initialization. Redirects, cookies, cache, oversized replies and unmatched receipts fail closed.
public final class ReviewedReportClient: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    public override init() { super.init() }
    public func send(_ data: Data, reportID: UUID, endpoint: URL) async throws -> ReportReceipt {
        guard !data.isEmpty, data.count <= 8192, endpoint.scheme == "https", endpoint.host != nil,
              endpoint.user == nil, endpoint.password == nil, endpoint.fragment == nil, endpoint.query == nil
        else { throw ReportDeliveryError.invalidReport }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 20
        let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        do {
            let (bytes, response) = try await session.bytes(for: request)
            guard let response = response as? HTTPURLResponse, response.statusCode == 200,
                  response.expectedContentLength <= 8192 else { throw ReportDeliveryError.unconfirmed }
            var body = Data()
            for try await byte in bytes {
                guard body.count < 8192 else { throw ReportDeliveryError.unconfirmed }
                body.append(byte)
            }
            return try ReportReceipt.decode(body, reportID: reportID)
        } catch { throw ReportDeliveryError.unconfirmed }
    }
    public func urlSession(_ session: URLSession, task: URLSessionTask,
                           willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                           completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
