@preconcurrency import FluidAudio
import Foundation

// FluidAudio's offline manager owns immutable model handles after initialize
// and is serialized by OfflineSpeakerDiarizer below. Upstream does not yet
// declare that usage Sendable, so this narrow adapter supplies the contract.
extension OfflineDiarizerManager: @retroactive @unchecked Sendable {}

public struct AnonymousSpeakerTurn: Codable, Sendable, Equatable {
    public let cluster: String
    public let startsAtSeconds: TimeInterval
    public let endsAtSeconds: TimeInterval
    public let confidence: Float

    public init(
        cluster: String,
        startsAtSeconds: TimeInterval,
        endsAtSeconds: TimeInterval,
        confidence: Float
    ) {
        self.cluster = cluster
        self.startsAtSeconds = startsAtSeconds
        self.endsAtSeconds = endsAtSeconds
        self.confidence = confidence
    }
}

public enum OfflineSpeakerConstraint: Sendable, Equatable {
    case automatic(maximum: Int)
    case exact(Int)

    public var maximum: Int {
        switch self {
        case .automatic(let maximum), .exact(let maximum): maximum
        }
    }
}

public actor OfflineSpeakerDiarizer {
    public enum DiarizerError: Error, CustomStringConvertible {
        case notPrepared
        case tooManySpeakers(Int)
        case unexpectedSpeakerCount(expected: Int, actual: Int)

        public var description: String {
            switch self {
            case .notPrepared: "offline speaker diarizer used before prepare()"
            case .tooManySpeakers(let count): "offline diarizer found \(count) speakers"
            case .unexpectedSpeakerCount(let expected, let actual):
                "offline diarizer expected \(expected) speakers but found \(actual)"
            }
        }
    }

    public nonisolated let speakerConstraint: OfflineSpeakerConstraint
    private var manager: OfflineDiarizerManager?

    public init(maximumSpeakers: Int = 6, expectedSpeakers: Int? = nil) {
        precondition((1...6).contains(maximumSpeakers))
        if let expectedSpeakers {
            precondition((1...maximumSpeakers).contains(expectedSpeakers))
            speakerConstraint = .exact(expectedSpeakers)
        } else {
            speakerConstraint = .automatic(maximum: maximumSpeakers)
        }
    }

    public static func defaultModelDirectory() -> URL {
        OfflineDiarizerModels.defaultModelsDirectory()
    }

    public func prepare(modelDirectory: URL? = nil) async throws {
        LocalSpeechOfflinePolicy.enforce()
        guard manager == nil else { return }
        let directory = modelDirectory ?? Self.defaultModelDirectory()
        let models = try await OfflineDiarizerModels.load(from: directory)
        let config = switch speakerConstraint {
        case .automatic(let maximum):
            OfflineDiarizerConfig.default.withSpeakers(min: 1, max: maximum)
        case .exact(let count):
            OfflineDiarizerConfig.default.withSpeakers(exactly: count)
        }
        let manager = OfflineDiarizerManager(config: config)
        manager.initialize(models: models)
        self.manager = manager
    }

    public func diarize(
        _ audio: URL,
        progress: (@Sendable (_ completedChunks: Int, _ totalChunks: Int) -> Void)? = nil
    ) async throws -> [AnonymousSpeakerTurn] {
        guard let manager else { throw DiarizerError.notPrepared }
        let result = try await manager.process(audio, progressCallback: progress)
        let speakerCount = Set(result.segments.map(\.speakerId)).count
        switch speakerConstraint {
        case .automatic(let maximum):
            guard speakerCount <= maximum else { throw DiarizerError.tooManySpeakers(speakerCount) }
        case .exact(let expected):
            guard speakerCount == expected else {
                throw DiarizerError.unexpectedSpeakerCount(expected: expected, actual: speakerCount)
            }
        }
        return result.segments.map {
            AnonymousSpeakerTurn(
                cluster: $0.speakerId,
                startsAtSeconds: TimeInterval($0.startTimeSeconds),
                endsAtSeconds: TimeInterval($0.endTimeSeconds),
                confidence: $0.qualityScore
            )
        }
    }
}
