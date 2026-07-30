import Foundation
import SwiftUI

/// A finished debate as the app stores it: the report plus which chair the
/// user was sitting in, which is what makes the dashboard mean anything.
struct SavedDebate: Codable, Hashable, Identifiable {
    var report: DebateReport
    /// `nil` when two people shared the device and neither seat is "yours".
    var userSide: Side?
    var isPractice: Bool
    var opponentName: String?

    var id: UUID { report.id }

    var userScorecard: Scorecard? {
        guard let userSide else { return nil }
        return report.scorecard(userSide)
    }

    var didUserWin: Bool? {
        guard let userSide, let winner = report.verdict.winner else { return nil }
        return winner == userSide
    }
}

/// User preferences. The API key is *not* in here — it lives in the
/// keychain, because a secret in `UserDefaults` is a secret in a plist.
struct Preferences: Codable, Hashable {
    var defaultSecondsPerTurn: Int = 90
    var defaultTurnsPerSide: Int = 3
    var defaultMode: DebateFormat.Mode = .text
    var useLiveFactChecking: Bool = false
    var defaultPersona: Persona = .teacher
    var defaultDifficulty: Difficulty = .medium

    var format: DebateFormat {
        DebateFormat(
            secondsPerTurn: defaultSecondsPerTurn,
            turnsPerSide: defaultTurnsPerSide,
            mode: defaultMode
        )
    }
}

/// App-wide state: saved debates, preferences, and the optional API key.
final class AppStore: ObservableObject {

    @Published private(set) var debates: [SavedDebate] = []
    @Published var preferences: Preferences {
        didSet { savePreferences() }
    }
    /// Empty when no key is configured — the app is fully usable in that state.
    @Published var apiKey: String {
        didSet { Keychain.set(apiKey, for: AppStore.keychainAccount) }
    }

    private static let keychainAccount = "anthropic-api-key"
    private static let preferencesKey = "veritas.preferences"

    init() {
        let stored = UserDefaults.standard.data(forKey: AppStore.preferencesKey)
        let decoded = stored.flatMap { try? JSONDecoder().decode(Preferences.self, from: $0) }
        preferences = decoded ?? Preferences()
        apiKey = Keychain.get(AppStore.keychainAccount) ?? ""
        debates = AppStore.loadDebates()
    }

    // MARK: Model access

    var hasModelAccess: Bool {
        !apiKey.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// The live model, or `nil` when the app should stay offline.
    func languageModel() -> LanguageModel? {
        guard hasModelAccess else { return nil }
        return AnthropicLanguageModel(apiKey: apiKey.trimmingCharacters(in: .whitespaces))
    }

    // MARK: Debates

    func save(_ debate: SavedDebate) {
        debates.removeAll { $0.id == debate.id }
        debates.insert(debate, at: 0)
        persistDebates()
    }

    func delete(_ debate: SavedDebate) {
        debates.removeAll { $0.id == debate.id }
        persistDebates()
    }

    func deleteAll() {
        debates.removeAll()
        persistDebates()
    }

    // MARK: Dashboard

    struct Progress {
        var debateCount: Int = 0
        var practiceCount: Int = 0
        var averages: [Dimension: Double] = [:]
        var winRate: Double?
        var fallaciesPerDebate: Double = 0
        /// Most frequent fallacies, worst first.
        var commonFallacies: [(Fallacy, Int)] = []
        var topics: [String] = []
        var totalSpeakingTime: TimeInterval = 0
        /// Overall score of each rated debate, oldest first — the trend line.
        var trend: [Double] = []
    }

    var progress: Progress {
        var result = Progress()
        result.debateCount = debates.count
        result.practiceCount = debates.filter(\.isPractice).count
        result.topics = Array(Set(debates.map(\.report.topic))).sorted()

        let rated = debates.filter { $0.userSide != nil }
        guard !rated.isEmpty else { return result }

        for dimension in Dimension.allCases {
            let values = rated.compactMap { $0.userScorecard?.value(for: dimension) }
            guard !values.isEmpty else { continue }
            result.averages[dimension] = values.reduce(0, +) / Double(values.count)
        }

        let decided = rated.compactMap(\.didUserWin)
        if !decided.isEmpty {
            result.winRate = Double(decided.filter { $0 }.count) / Double(decided.count)
        }

        var counts: [Fallacy: Int] = [:]
        var fallacyTotal = 0
        for debate in rated {
            guard let side = debate.userSide else { continue }
            for finding in debate.report.findings.forSide(side) where finding.kind == .fallacy {
                fallacyTotal += 1
                if let fallacy = finding.fallacy {
                    counts[fallacy, default: 0] += 1
                }
            }
            result.totalSpeakingTime += debate.report.speaker(side).stats.speakingTime
        }
        result.fallaciesPerDebate = Double(fallacyTotal) / Double(rated.count)
        result.commonFallacies = counts.sorted { $0.value > $1.value }.map { ($0.key, $0.value) }

        result.trend = rated
            .sorted { $0.report.generatedAt < $1.report.generatedAt }
            .compactMap { $0.userScorecard?.overall }

        return result
    }

    // MARK: Persistence

    private func savePreferences() {
        guard let data = try? JSONEncoder().encode(preferences) else { return }
        UserDefaults.standard.set(data, forKey: AppStore.preferencesKey)
    }

    private func persistDebates() {
        guard let url = AppStore.storeURL else { return }
        do {
            let data = try JSONEncoder().encode(debates)
            try data.write(to: url, options: .atomic)
        } catch {
            // A failed write must never take the app down mid-debate; the
            // report is still on screen and can be exported by hand.
            print("Veritas: could not save debates — \(error.localizedDescription)")
        }
    }

    private static func loadDebates() -> [SavedDebate] {
        guard let url = storeURL, let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([SavedDebate].self, from: data)) ?? []
    }

    private static var storeURL: URL? {
        let manager = FileManager.default
        guard let base = manager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let directory = base.appendingPathComponent("Veritas", isDirectory: true)
        if !manager.fileExists(atPath: directory.path) {
            try? manager.createDirectory(at: directory, withIntermediateDirectories: true)
        }
        return directory.appendingPathComponent("debates.json")
    }
}
