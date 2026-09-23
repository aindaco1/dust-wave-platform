import Foundation
import FoundationModels

/// Task policy, prompts, response schemas, and acceptance stay with the consumer.
@available(macOS 26.0, *)
public enum AppleModelProfile: String, Codable, Sendable, CaseIterable {
    case general
    case transformation
    case contentTagging

    public func makeModel() -> SystemLanguageModel {
        switch self {
        case .general: SystemLanguageModel(useCase: .general)
        case .transformation:
            SystemLanguageModel(useCase: .general, guardrails: .permissiveContentTransformations)
        case .contentTagging: SystemLanguageModel(useCase: .contentTagging)
        }
    }
}

public struct AppleModelMetadata: Codable, Equatable, Sendable {
    public let name: String
    public let contextSize: Int
    public let capabilities: [String]
}

/// Fresh sessions, bounded greedy generation, and cancellation for local Apple inference.
/// No credentials, storage, provider fallback, network client, or product formatting rules.
@available(macOS 26.0, *)
public enum AppleGeneration {
    public enum RequestError: Error, Equatable {
        case invalidResponseLimit
    }

    public static func options(maximumResponseTokens: Int) throws -> GenerationOptions {
        guard (1...4096).contains(maximumResponseTokens) else {
            throw RequestError.invalidResponseLimit
        }
        #if compiler(>=6.4)
        return GenerationOptions(samplingMode: .greedy, maximumResponseTokens: maximumResponseTokens)
        #else
        return GenerationOptions(sampling: .greedy, maximumResponseTokens: maximumResponseTokens)
        #endif
    }

    public static func metadata(for model: SystemLanguageModel) -> AppleModelMetadata? {
        #if compiler(>=6.4)
        if #available(macOS 27.0, *) {
            let supported: [(String, LanguageModelCapabilities.Capability)] = [
                ("guided_generation", .guidedGeneration), ("tool_calling", .toolCalling),
                ("reasoning", .reasoning), ("vision", .vision),
            ]
            return AppleModelMetadata(
                name: model.variant.displayName, contextSize: model.contextSize,
                capabilities: supported.compactMap { model.capabilities.contains($0.1) ? $0.0 : nil }
            )
        }
        #endif
        return nil
    }

    public static func respond<Content: Generable>(
        to prompt: String, generating type: Content.Type,
        model: SystemLanguageModel, instructions: String, maximumResponseTokens: Int
    ) async throws -> LanguageModelSession.Response<Content> {
        let options = try options(maximumResponseTokens: maximumResponseTokens)
        return try await checked {
            let session = LanguageModelSession(model: model, instructions: instructions)
            return try await session.respond(to: prompt, generating: type, options: options)
        }
    }

    public static func respond(
        to prompt: String, model: SystemLanguageModel,
        instructions: String, maximumResponseTokens: Int
    ) async throws -> LanguageModelSession.Response<String> {
        let options = try options(maximumResponseTokens: maximumResponseTokens)
        return try await checked {
            let session = LanguageModelSession(model: model, instructions: instructions)
            return try await session.respond(to: prompt, options: options)
        }
    }

    static func checked<Output>(_ operation: () async throws -> Output) async throws -> Output {
        try Task.checkCancellation()
        let output = try await operation()
        try Task.checkCancellation()
        return output
    }
}
