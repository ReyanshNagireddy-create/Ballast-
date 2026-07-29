import Foundation
import SwiftUI
import VeritasKit

/// Everything needed to start a debate, in one `Hashable` value so it can
/// travel through `NavigationStack` as a route.
struct DebateSetup: Hashable {
    var topic: String
    var nameA: String
    var nameB: String
    var positionA: String
    var positionB: String
    var format: DebateFormat
    var practice: PracticeSetup?

    var transcript: Transcript {
        Transcript(
            topic: topic,
            format: format,
            participants: [
                Participant(side: .a, name: nameA, position: positionA, isMachine: practice?.userSide == .b),
                Participant(side: .b, name: nameB, position: positionB, isMachine: practice?.userSide == .a)
            ]
        )
    }
}

struct PracticeSetup: Hashable {
    var userSide: Side
    var persona: Persona
    var difficulty: Difficulty
}

/// Drives one live debate: whose turn it is, the clock, the note feed, and
/// — in practice mode — the opponent.
///
/// Deliberately not actor-isolated. Everything it touches is driven from
/// SwiftUI on the main thread, and the two places that do await a network
/// call hop back explicitly. That keeps the concurrency story short enough
/// to hold in your head.
final class DebateSession: ObservableObject {

    struct Practice {
        var userSide: Side
        var partner: SparringPartner
        var modelPartner: ModelBackedPartner?
    }

    @Published private(set) var referee: LiveReferee
    @Published var draft: String = ""
    /// Notes in the order they were raised, newest first.
    @Published private(set) var feed: [Finding] = []
    @Published private(set) var elapsed: Int = 0
    @Published private(set) var timeIsUp = false
    @Published private(set) var isOpponentThinking = false
    @Published private(set) var report: DebateReport?
    @Published private(set) var isBuildingReport = false

    let practice: Practice?
    private let model: LanguageModel?
    private var timer: Timer?

    init(transcript: Transcript, practice: Practice? = nil, model: LanguageModel? = nil) {
        self.referee = LiveReferee(transcript: transcript)
        self.practice = practice
        self.model = model
    }

    /// Builds a session from a route plus whatever model access the app has.
    convenience init(setup: DebateSetup, model: LanguageModel?) {
        var practice: Practice?
        if let config = setup.practice {
            let machineSide = config.userSide.opposite
            let partner = SparringPartner(
                persona: config.persona,
                difficulty: config.difficulty,
                topic: setup.topic,
                position: machineSide == .a ? setup.positionA : setup.positionB
            )
            practice = Practice(
                userSide: config.userSide,
                partner: partner,
                modelPartner: model.map { ModelBackedPartner(model: $0, fallback: partner) }
            )
        }
        self.init(transcript: setup.transcript, practice: practice, model: model)
    }

    deinit {
        timer?.invalidate()
    }

    // MARK: Turn state

    var transcript: Transcript { referee.transcript }
    var topic: String { referee.transcript.topic }
    var currentSide: Side { referee.currentSide }
    var isFinished: Bool { referee.isFinished }
    var hasStarted: Bool { !referee.transcript.turns.isEmpty }

    var isUsersTurn: Bool {
        guard let practice else { return true }
        return currentSide == practice.userSide
    }

    var limit: Int? { referee.transcript.format.secondsPerTurn }

    var remaining: Int? {
        guard let limit else { return nil }
        return max(0, limit - elapsed)
    }

    var clockLabel: String {
        let seconds = remaining ?? elapsed
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    var clockProgress: Double {
        guard let limit, limit > 0 else { return 0 }
        return min(1, Double(elapsed) / Double(limit))
    }

    func name(of side: Side) -> String {
        referee.transcript.name(of: side)
    }

    // MARK: Lifecycle

    /// Called once when the room appears. Starts the clock, or hands the
    /// opening to the sparring partner when it goes first.
    func begin() {
        guard report == nil, !isFinished else { return }
        if isUsersTurn {
            startClock()
        } else {
            takeOpponentTurn()
        }
    }

    // MARK: Clock

    func startClock() {
        stopClock()
        elapsed = 0
        timeIsUp = false
        guard limit != nil else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    func stopClock() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        elapsed += 1
        guard let remaining, remaining == 0 else { return }
        // Veritas never cuts anyone off mid-sentence. It says the time is up
        // and lets the speaker land the point; turn *equality* comes from the
        // format, not from a hard mute.
        timeIsUp = true
        stopClock()
    }

    // MARK: Turns

    func submitUserTurn() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        record(text, duration: TimeInterval(elapsed))
    }

    private func record(_ text: String, duration: TimeInterval) {
        let side = referee.currentSide
        let fresh = referee.submit(text, side: side, duration: duration)
        feed.insert(contentsOf: fresh.reversed(), at: 0)

        stopClock()
        elapsed = 0
        timeIsUp = false

        if referee.isFinished {
            buildReport()
        } else if isUsersTurn {
            startClock()
        } else {
            takeOpponentTurn()
        }
    }

    /// The sparring partner's turn.
    func takeOpponentTurn() {
        guard let practice, !isOpponentThinking else { return }
        isOpponentThinking = true

        let snapshot = referee.transcript
        let machineSide = practice.userSide.opposite
        let offline = practice.partner
        let modelPartner = practice.modelPartner
        let fallbackDuration = TimeInterval(limit ?? 60)

        Task { [weak self] in
            var text: String
            if let modelPartner {
                // `ModelBackedPartner` already falls back to the offline
                // partner when the call fails, so there is nothing to catch.
                text = await modelPartner.reply(to: snapshot, as: machineSide)
            } else {
                text = offline.reply(to: snapshot, as: machineSide)
            }
            if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                text = offline.opening()
            }

            let reply = text
            await MainActor.run {
                guard let self else { return }
                self.isOpponentThinking = false
                self.record(reply, duration: fallbackDuration)
            }
        }
    }

    /// Ends the debate early, keeping whatever was said.
    func endEarly() {
        stopClock()
        buildReport()
    }

    // MARK: Report

    func buildReport() {
        guard report == nil, !isBuildingReport else { return }
        isBuildingReport = true
        stopClock()

        var finished = referee.transcript
        finished.finishedAt = Date()
        let model = self.model

        Task { [weak self] in
            let result: DebateReport
            if let model {
                result = await ModelAugmentedReferee(model: model).analyze(finished)
            } else {
                result = Referee.analyze(finished, extraCaveats: [DebateSession.offlineCaveat])
            }
            await MainActor.run {
                guard let self else { return }
                self.report = result
                self.isBuildingReport = false
            }
        }
    }

    static let offlineCaveat = "No model is configured, so nothing here was checked against a source. Veritas flagged claims that were not supported; whether they are true is still your call."

    /// Wraps the finished report for saving.
    func savedDebate() -> SavedDebate? {
        guard let report else { return nil }
        return SavedDebate(
            report: report,
            userSide: practice?.userSide,
            isPractice: practice != nil,
            opponentName: practice?.partner.displayName
        )
    }
}
