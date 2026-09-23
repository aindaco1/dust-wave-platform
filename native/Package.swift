// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "DustWaveNative",
    platforms: [.macOS(.v15)],
    products: [
        .library(name: "DustWaveSpeechCore", targets: ["DustWaveSpeechCore"]),
        .library(name: "DustWaveSpeech", targets: ["DustWaveSpeech"]),
        .library(name: "DustWaveAppleIntelligence", targets: ["DustWaveAppleIntelligence"]),
    ],
    dependencies: [
        // Consumers retain their characterized exact version and Package.resolved.
        .package(url: "https://github.com/FluidInference/FluidAudio.git", "0.15.5"..."0.15.7"),
    ],
    targets: [
        .target(name: "DustWaveSpeechCore"),
        .target(name: "DustWaveSpeech", dependencies: [
            "DustWaveSpeechCore", .product(name: "FluidAudio", package: "FluidAudio"),
        ]),
        .target(name: "DustWaveAppleIntelligence"),
        .testTarget(name: "DustWaveSpeechTests", dependencies: [
            "DustWaveSpeech", .product(name: "FluidAudio", package: "FluidAudio"),
        ]),
        .testTarget(name: "DustWaveAppleIntelligenceTests", dependencies: ["DustWaveAppleIntelligence"]),
    ]
)
