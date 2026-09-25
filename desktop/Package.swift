// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "DustWaveDesktop", platforms: [.macOS(.v13)], products: [
    .library(name: "DustWaveUpdates", targets: ["DustWaveUpdates"]),
    .library(name: "DustWaveDiagnostics", targets: ["DustWaveDiagnostics"])
], dependencies: [.package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.10.0")], targets: [
    .target(name: "DustWaveUpdates", dependencies: [.product(name: "Sparkle", package: "Sparkle")]),
    .target(name: "DustWaveDiagnostics"),
    .testTarget(name: "DustWaveDesktopTests", dependencies: ["DustWaveUpdates", "DustWaveDiagnostics"])
])
