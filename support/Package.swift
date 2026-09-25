// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DustWaveSupport",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [.library(name: "DustWaveSupport", targets: ["DustWaveSupport"])],
    targets: [
        .target(name: "DustWaveSupport"),
        .testTarget(name: "DustWaveSupportTests", dependencies: ["DustWaveSupport"])
    ]
)
