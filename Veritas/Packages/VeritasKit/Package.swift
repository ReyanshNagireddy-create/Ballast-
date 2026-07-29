// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "VeritasKit",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "VeritasKit", targets: ["VeritasKit"])
    ],
    targets: [
        .target(name: "VeritasKit"),
        .testTarget(name: "VeritasKitTests", dependencies: ["VeritasKit"])
    ]
)
