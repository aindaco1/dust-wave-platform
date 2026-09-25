import Foundation

public enum ReportTransportError: Error, Sendable {
    case invalidRequest, invalidResponse, responseTooLarge
}

/// A single explicit request. The caller owns the endpoint, payload validation,
/// timeout, accepted status codes and receipt policy. Never follows redirects.
public final class BoundedReportTransport: NSObject, URLSessionTaskDelegate, Sendable {
    public func send(_ request: URLRequest, maximumResponseBytes: Int,
                     configuration: URLSessionConfiguration = .ephemeral,
                     validateResponse: @Sendable (HTTPURLResponse) throws -> Void = { _ in }) async throws -> (Data, HTTPURLResponse) {
        guard maximumResponseBytes > 0, let url = request.url, url.scheme == "https", url.host != nil,
              url.user == nil, url.password == nil, url.fragment == nil, url.query == nil,
              request.httpMethod == "POST" else { throw ReportTransportError.invalidRequest }
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        configuration.urlCredentialStorage = nil
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        let session = URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        let (bytes, response) = try await session.bytes(for: request)
        guard let response = response as? HTTPURLResponse else { throw ReportTransportError.invalidResponse }
        try validateResponse(response)
        var data = Data()
        for try await byte in bytes {
            guard data.count < maximumResponseBytes else { throw ReportTransportError.responseTooLarge }
            data.append(byte)
        }
        return (data, response)
    }

    public func urlSession(_ session: URLSession, task: URLSessionTask,
                           willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                           completionHandler: @escaping @Sendable (URLRequest?) -> Void) { completionHandler(nil) }
}
