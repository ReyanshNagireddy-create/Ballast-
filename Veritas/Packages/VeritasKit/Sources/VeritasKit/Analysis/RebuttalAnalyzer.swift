import Foundation

/// Works out whether each turn answered the other side, or just carried on.
///
/// This is the measurement most debates are actually lost on, and the one
/// nobody keeps track of in the moment: a point made in turn one, never
/// answered, quietly decides the argument while both people are busy
/// somewhere else.
public enum RebuttalAnalyzer {

    /// A turn that engaged with something specific the opponent said.
    public struct Engagement: Hashable, Sendable {
        public var turnID: UUID
        public var side: Side
        /// Strongest content overlap with any prior opposing claim, 0–1.
        public var strength: Double
        public var engagedClaimID: UUID?
        /// Whether the speaker signposted the rebuttal ("you said…", "that assumes…").
        public var usedCue: Bool
        public var isEngaged: Bool
    }

    public struct Result: Sendable {
        public var engagements: [Engagement] = []
        public var findings: [Finding] = []
        /// Share of a side's response turns that engaged, 0–1.
        public var engagementRate: [Side: Double] = [:]
        /// How many turns each side had where engaging was even possible.
        public var responseTurns: [Side: Int] = [:]
        /// Claims that were never answered, keyed by the side that let them stand.
        public var droppedCounts: [Side: Int] = [:]
    }

    /// Content overlap at which a turn counts as having addressed a claim.
    static let engagementThreshold = 0.34
    /// Lower bar when the speaker explicitly signposted a rebuttal.
    static let cuedEngagementThreshold = 0.2

    public static func analyze(transcript: Transcript, claims: [Claim]) -> Result {
        var result = Result()
        let turns = transcript.turns.sorted(by: { $0.index < $1.index })

        var engagedCounts: [Side: Int] = [.a: 0, .b: 0]
        var responseCounts: [Side: Int] = [.a: 0, .b: 0]
        /// Claim IDs that somebody eventually answered.
        var answered: Set<UUID> = []

        for turn in turns {
            let priorOpposing = claims.filter { claim in
                claim.side == turn.side.opposite
                    && (transcript.turn(withID: claim.turnID)?.index ?? Int.max) < turn.index
                    && claim.demandsResponse
            }
            guard !priorOpposing.isEmpty else { continue }

            responseCounts[turn.side, default: 0] += 1

            let turnWords = Tokenizer.contentWords(in: turn.text)
            let normalized = Tokenizer.normalize(turn.text)
            let usedCue = Tokenizer.containsAny(normalized, phrases: Lexicon.rebuttalCues)
                || Tokenizer.containsAny(normalized, phrases: Lexicon.concessionCues)

            var best = 0.0
            var bestClaim: Claim?
            for claim in priorOpposing {
                let score = Tokenizer.overlap(turnWords, claim.keywords)
                if score > best {
                    best = score
                    bestClaim = claim
                }
                if score >= engagementThreshold {
                    answered.insert(claim.id)
                }
            }

            let isEngaged = best >= engagementThreshold
                || (usedCue && best >= cuedEngagementThreshold)
            if isEngaged {
                engagedCounts[turn.side, default: 0] += 1
                if let bestClaim, usedCue {
                    answered.insert(bestClaim.id)
                }
            }

            result.engagements.append(
                Engagement(
                    turnID: turn.id,
                    side: turn.side,
                    strength: best,
                    engagedClaimID: bestClaim?.id,
                    usedCue: usedCue,
                    isEngaged: isEngaged
                )
            )

            // A direct, signposted rebuttal is worth saying out loud. The
            // report should not be a list of things people did wrong.
            if isEngaged, usedCue, best >= 0.45, let bestClaim {
                result.findings.append(
                    Finding(
                        kind: .strongRebuttal,
                        severity: .info,
                        side: turn.side,
                        turnID: turn.id,
                        claimID: bestClaim.id,
                        quote: Tokenizer.excerpt(firstSentence(of: turn.text)),
                        title: "Answered the point directly",
                        detail: "This turn took up \u{201C}\(Tokenizer.excerpt(bestClaim.text, limit: 90))\u{201D} and responded to it rather than changing the subject.",
                        offset: turn.offset
                    )
                )
            }
        }

        for side in Side.allCases {
            let responses = responseCounts[side] ?? 0
            result.responseTurns[side] = responses
            result.engagementRate[side] = responses == 0
                ? 0
                : Double(engagedCounts[side] ?? 0) / Double(responses)
        }

        let dropped = droppedFindings(transcript: transcript, claims: claims, answered: answered)
        result.findings.append(contentsOf: dropped.findings)
        result.droppedCounts = dropped.counts
        return result
    }

    /// Points that were made, mattered, and never got a reply.
    private static func droppedFindings(
        transcript: Transcript,
        claims: [Claim],
        answered: Set<UUID>
    ) -> (findings: [Finding], counts: [Side: Int]) {
        var findings: [Finding] = []
        var counts: [Side: Int] = [.a: 0, .b: 0]

        for side in Side.allCases {
            let opponent = side.opposite
            // Only claims the opponent had a chance to answer.
            let lastOpponentTurnIndex = transcript.turns(by: opponent).map(\.index).max() ?? -1

            let candidates = claims.filter { claim in
                guard claim.side == side, claim.demandsResponse else { return false }
                guard !answered.contains(claim.id) else { return false }
                let index = transcript.turn(withID: claim.turnID)?.index ?? Int.max
                return index < lastOpponentTurnIndex
            }

            // Rank by how costly ignoring it was: evidence first, then substance.
            let ranked = candidates.sorted { lhs, rhs in
                let lhsWeight = weight(of: lhs)
                let rhsWeight = weight(of: rhs)
                if lhsWeight != rhsWeight { return lhsWeight > rhsWeight }
                return lhs.keywords.count > rhs.keywords.count
            }

            for claim in ranked.prefix(3) {
                counts[opponent, default: 0] += 1
                let turn = transcript.turn(withID: claim.turnID)
                let carriedEvidence = claim.verdict == .sourced || claim.verdict == .quantified
                findings.append(
                    Finding(
                        kind: .droppedArgument,
                        severity: carriedEvidence ? .warning : .notice,
                        side: opponent,
                        turnID: claim.turnID,
                        claimID: claim.id,
                        quote: Tokenizer.excerpt(claim.text),
                        title: "Left unanswered",
                        detail: carriedEvidence
                            ? "\(transcript.name(of: side)) put this on the table with something behind it, and it was never addressed."
                            : "\(transcript.name(of: side)) made this point and it never came up again.",
                        coaching: "Answer it or concede it. An unanswered point is read by everyone watching as one you could not answer — and conceding costs far less than it feels like it does.",
                        offset: turn?.offset ?? 0
                    )
                )
            }
        }

        return (findings, counts)
    }

    private static func weight(of claim: Claim) -> Int {
        switch claim.verdict {
        case .sourced: return 3
        case .quantified: return 2
        case .unsupported, .hedged: return 1
        case .notApplicable: return 0
        }
    }

    private static func firstSentence(of text: String) -> String {
        Tokenizer.sentences(in: text).first ?? text
    }
}
