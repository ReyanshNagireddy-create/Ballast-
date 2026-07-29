import Foundation

/// A quote the report wants to draw attention to, with the reason.
public struct Highlight: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var side: Side
    public var quote: String
    public var reason: String
    public var offset: TimeInterval

    public init(
        id: UUID = UUID(),
        side: Side,
        quote: String,
        reason: String,
        offset: TimeInterval = 0
    ) {
        self.id = id
        self.side = side
        self.quote = quote
        self.reason = reason
        self.offset = offset
    }
}

/// Counts the dashboard and the report header both want.
public struct SpeakerStats: Codable, Hashable, Sendable {
    public var turns: Int
    public var words: Int
    public var claims: Int
    public var checkableClaims: Int
    public var sourcedClaims: Int
    public var unsupportedClaims: Int
    public var fallacies: Int
    /// Share of turns that engaged with something the opponent actually said, 0–1.
    public var engagementRate: Double
    public var speakingTime: TimeInterval

    public init(
        turns: Int = 0,
        words: Int = 0,
        claims: Int = 0,
        checkableClaims: Int = 0,
        sourcedClaims: Int = 0,
        unsupportedClaims: Int = 0,
        fallacies: Int = 0,
        engagementRate: Double = 0,
        speakingTime: TimeInterval = 0
    ) {
        self.turns = turns
        self.words = words
        self.claims = claims
        self.checkableClaims = checkableClaims
        self.sourcedClaims = sourcedClaims
        self.unsupportedClaims = unsupportedClaims
        self.fallacies = fallacies
        self.engagementRate = engagementRate
        self.speakingTime = speakingTime
    }
}

/// Everything the report has to say about one debater.
public struct SpeakerReport: Codable, Hashable, Identifiable, Sendable {
    public var side: Side
    public var name: String
    public var scorecard: Scorecard
    public var stats: SpeakerStats
    public var bestArgument: Highlight?
    public var weakestArgument: Highlight?
    /// Points this side made that the *other* side never answered — the
    /// opponent's missed opportunities, listed here as this side's wins.
    public var unansweredPoints: [Highlight]
    /// Opponent points this side failed to answer.
    public var missedOpportunities: [Highlight]
    public var findings: [Finding]
    /// Two or three things to actually work on next time.
    public var suggestions: [String]

    public var id: Side { side }

    public init(
        side: Side,
        name: String,
        scorecard: Scorecard,
        stats: SpeakerStats,
        bestArgument: Highlight? = nil,
        weakestArgument: Highlight? = nil,
        unansweredPoints: [Highlight] = [],
        missedOpportunities: [Highlight] = [],
        findings: [Finding] = [],
        suggestions: [String] = []
    ) {
        self.side = side
        self.name = name
        self.scorecard = scorecard
        self.stats = stats
        self.bestArgument = bestArgument
        self.weakestArgument = weakestArgument
        self.unansweredPoints = unansweredPoints
        self.missedOpportunities = missedOpportunities
        self.findings = findings
        self.suggestions = suggestions
    }
}

/// The artefact the whole product exists to produce.
public struct DebateReport: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var generatedAt: Date
    public var topic: String
    public var format: DebateFormat
    public var transcript: Transcript
    public var verdict: Verdict
    public var speakers: [SpeakerReport]
    public var claims: [Claim]
    public var findings: [Finding]
    /// Places where the two sides were not actually disagreeing about facts —
    /// worth surfacing, because a lot of arguments are values wearing a
    /// factual costume.
    public var sharedGround: [String]
    /// Caveats about this specific report: thin transcript, offline-only
    /// fact-checking, and so on. Shown, never buried.
    public var caveats: [String]

    public init(
        id: UUID = UUID(),
        generatedAt: Date = Date(),
        topic: String,
        format: DebateFormat,
        transcript: Transcript,
        verdict: Verdict,
        speakers: [SpeakerReport],
        claims: [Claim] = [],
        findings: [Finding] = [],
        sharedGround: [String] = [],
        caveats: [String] = []
    ) {
        self.id = id
        self.generatedAt = generatedAt
        self.topic = topic
        self.format = format
        self.transcript = transcript
        self.verdict = verdict
        self.speakers = speakers
        self.claims = claims
        self.findings = findings
        self.sharedGround = sharedGround
        self.caveats = caveats
    }

    public func speaker(_ side: Side) -> SpeakerReport {
        speakers.first(where: { $0.side == side })
            ?? SpeakerReport(
                side: side,
                name: side.defaultName,
                scorecard: Scorecard(side: side),
                stats: SpeakerStats()
            )
    }

    public func scorecard(_ side: Side) -> Scorecard {
        speaker(side).scorecard
    }

    public func claims(for side: Side) -> [Claim] {
        claims.filter { $0.side == side }
    }

    /// Findings in the order they occurred — the replay timeline.
    public var timeline: [Finding] {
        findings.sorted { $0.offset < $1.offset }
    }

    public var winnerName: String {
        guard let winner = verdict.winner else { return "Draw" }
        return transcript.name(of: winner)
    }
}
