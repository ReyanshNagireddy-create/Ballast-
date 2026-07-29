import Foundation

/// Runs the referee *during* the debate, one turn at a time.
///
/// The design constraint from the product brief is that the referee never
/// interrupts. So this returns notes for the feed and nothing else — no
/// scores mid-debate, no running winner. A live scoreboard would change how
/// people argue, and not for the better.
public struct LiveReferee: Sendable {

    public private(set) var transcript: Transcript
    /// Every note raised so far, oldest first.
    public private(set) var notes: [Finding] = []
    public private(set) var claims: [Claim] = []

    /// Stable identity for a finding across re-runs, so re-analysing the
    /// whole transcript after each turn does not re-announce old notes.
    private var seen: Set<String> = []

    public init(transcript: Transcript) {
        self.transcript = transcript
        if !transcript.turns.isEmpty {
            _ = refresh()
        }
    }

    public var currentTurnIndex: Int {
        transcript.turns.count
    }

    /// Whose turn it is, following the format's opener and alternating.
    public var currentSide: Side {
        let opener = transcript.format.opener
        return transcript.turns.count % 2 == 0 ? opener : opener.opposite
    }

    /// Whether the format says the debate is over.
    public var isFinished: Bool {
        guard let turnsPerSide = transcript.format.turnsPerSide else { return false }
        return transcript.turns.count >= turnsPerSide * 2
    }

    public var turnsRemaining: Int? {
        guard let turnsPerSide = transcript.format.turnsPerSide else { return nil }
        return max(0, turnsPerSide * 2 - transcript.turns.count)
    }

    /// Records a turn and returns only the notes that are new because of it.
    @discardableResult
    public mutating func submit(
        _ text: String,
        side: Side? = nil,
        duration: TimeInterval = 0
    ) -> [Finding] {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        transcript.append(side ?? currentSide, text: trimmed, duration: duration)
        return refresh()
    }

    /// Re-runs the analysis and returns the notes that were not there before.
    private mutating func refresh() -> [Finding] {
        let analysis = Referee.examine(transcript)
        claims = analysis.claims

        var fresh: [Finding] = []
        for finding in analysis.findings.sorted(by: { $0.offset < $1.offset }) {
            let key = identity(of: finding)
            if seen.contains(key) { continue }
            seen.insert(key)
            fresh.append(finding)
            notes.append(finding)
        }
        return fresh
    }

    /// Findings carry fresh UUIDs on every run, so identity comes from what
    /// the finding is *about*.
    private func identity(of finding: Finding) -> String {
        let turn = finding.turnID?.uuidString ?? "-"
        let fallacy = finding.fallacy?.rawValue ?? "-"
        return "\(finding.kind.rawValue)|\(finding.side.rawValue)|\(turn)|\(fallacy)|\(finding.title)|\(finding.quote)"
    }

    /// Live support verdicts for one turn, for the fact-check strip.
    public func verdicts(forTurn turnID: UUID) -> [Claim] {
        claims.filter { $0.turnID == turnID && $0.verdict != .notApplicable }
    }

    /// Ends the debate and produces the report.
    public func finish(extraCaveats: [String] = []) -> DebateReport {
        var finished = transcript
        finished.finishedAt = Date()
        return Referee.analyze(finished, extraCaveats: extraCaveats)
    }
}
