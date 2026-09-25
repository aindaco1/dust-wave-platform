// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "DustWaveDesktop", platforms: [.macOS(.v13)], products: [
    .library(name: "DustWaveUpdates", targets: ["DustWaveUpdates"]),
    .library(name: "DustWaveUpdatePolicy", targets: ["DustWaveUpdatePolicy"]),
    .library(name: "DustWaveDiagnostics", targets: ["DustWaveDiagnostics"])
], dependencies: [.package(path: "../support"), .package(url: "https://github.com/sparkle-project/Sparkle", "2.9.5"..."2.10.0")], targets: [
    .target(name: "DustWaveUpdatePolicy"),
    .target(name: "DustWaveUpdates", dependencies: ["DustWaveUpdatePolicy", .product(name: "Sparkle", package: "Sparkle")]),
    .target(name: "DustWaveDiagnostics", dependencies: [.product(name: "DustWaveSupport", package: "support")]),
    .testTarget(name: "DustWaveDesktopTests", dependencies: ["DustWaveUpdates", "DustWaveDiagnostics"])
])
