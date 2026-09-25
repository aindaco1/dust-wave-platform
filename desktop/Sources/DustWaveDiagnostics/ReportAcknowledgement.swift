import Foundation

/// Receipt validation shared by clients with different retained wire contracts.
/// This proves acknowledgement, not that an issue represents a unique person or cause.
public struct ReportAcknowledgement: Decodable, Equatable, Sendable {
    public let ok: Bool
    public let reportId: String
    public let issueNumber: Int
    public let action: String

    public static func decode(_ data: Data, reportID: String, maximumBytes: Int,
                              actions: Set<String> = ["created", "updated", "duplicate"],
                              maximumIssueNumber: Int = 9_007_199_254_740_991,
                              compareUUID: Bool = false) throws -> Self {
        guard data.count <= maximumBytes,
              let receipt = try? JSONDecoder().decode(Self.self, from: data), receipt.ok,
              receipt.issueNumber > 0, receipt.issueNumber <= maximumIssueNumber,
              actions.contains(receipt.action) else { throw ReportDeliveryError.unconfirmed }
        if compareUUID {
            guard let expected = UUID(uuidString: reportID), UUID(uuidString: receipt.reportId) == expected
            else { throw ReportDeliveryError.unconfirmed }
        } else if receipt.reportId != reportID { throw ReportDeliveryError.unconfirmed }
        return receipt
    }
}
