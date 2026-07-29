import Foundation

/// Turns findings into numbers, and numbers into a verdict.
///
/// Every score here is a function of things that were quoted in the report.
/// There is no vibe term. If a user disagrees with a number they can find
/// the exact sentences that produced it, which is the only way a score like
/// this earns any trust at all.
public enum Scorer {

    public struct Inputs: Sendable {
        public var transcript: Transcript
        public var claims: [Claim]
        public var findings: [Finding]
        public var rebuttal: RebuttalAnalyzer.Result
        public var consistency: ConsistencyAnalyzer.Result
        public var civility: CivilityAnalyzer.Result

        public init(
            transcript: Transcript,
            claims: [Claim],
            findings: [Finding],
            rebuttal: RebuttalAnalyzer.Result,
            consistency: ConsistencyAnalyzer.Result,
            civility: CivilityAnalyzer.Result
        ) {
            self.transcript = transcript
            self.claims = claims
            self.findings = findings
            self.rebuttal = rebuttal
            self.consistency = consistency
            self.civility = civility
        }
    }

    /// Below this margin Veritas refuses to name a winner.
    public static let drawThreshold = 3.0

    // MARK: - Dimensions

    public static func scorecard(for side: Side, inputs: Inputs) -> Scorecard {
        var card = Scorecard(side: side)
        card.set(evidenceScore(for: side, inputs: inputs), for: .evidence)
        card.set(logicScore(for: side, inputs: inputs), for: .logic)
        card.set(rebuttalScore(for: side, inputs: inputs), for: .rebuttal)
        card.set(clarityScore(for: side, inputs: inputs), for: .clarity)
        card.set(consistencyScore(for: side, inputs: inputs), for: .consistency)
        card.set(respectScore(for: side, inputs: inputs), for: .respectfulness)
        return card
    }

    /// How much a support verdict is worth, 0–1.
    static func credit(for verdict: SupportVerdict) -> Double {
        switch verdict {
        case .sourced: return 1.0
        case .quantified: return 0.7
        case .hedged: return 0.4
        case .unsupported: return 0.25
        case .notApplicable: return 0
        }
    }

    static func evidenceScore(for side: Side, inputs: Inputs) -> Double {
        let sideClaims = inputs.claims.filter { $0.side == side }
        let gradeable = sideClaims.filter { $0.verdict != .notApplicable }

        // A side that made no factual claims at all is neither rewarded nor
        // punished — an argument can be entirely about values.
        guard !gradeable.isEmpty else { return 50 }

        var total = 0.0
        for claim in gradeable {
            total += credit(for: claim.verdict)
        }
        let ratio = total / Double(gradeable.count)
        var score = 30 + 70 * ratio

        let named = Set(sideClaims.flatMap { $0.signals.sources })
        if named.count >= 2 {
            score += 5
        }
        return score
    }

    static func logicScore(for side: Side, inputs: Inputs) -> Double {
        let fallacies = inputs.findings.filter { $0.side == side && $0.kind == .fallacy }
        let penalty = fallacies.reduce(0.0) { $0 + $1.severity.penalty }
        return 100 - penalty
    }

    static func rebuttalScore(for side: Side, inputs: Inputs) -> Double {
        let responses = inputs.rebuttal.responseTurns[side] ?? 0
        // No chance to respond is not a failure to respond.
        guard responses > 0 else { return 50 }

        let rate = inputs.rebuttal.engagementRate[side] ?? 0
        let dropped = Double(inputs.rebuttal.droppedCounts[side] ?? 0)
        return rate * 100 - dropped * 8
    }

    static func clarityScore(for side: Side, inputs: Inputs) -> Double {
        let turns = inputs.transcript.turns(by: side)
        guard !turns.isEmpty else { return 0 }

        let joined = turns.map(\.text).joined(separator: " ")
        let normalized = Tokenizer.normalize(joined)
        let words = Tokenizer.words(in: joined)
        let content = Tokenizer.contentWords(in: joined)
        let sentences = turns.flatMap { Tokenizer.sentences(in: $0.text) }

        guard !words.isEmpty else { return 0 }

        let connectives = Double(Tokenizer.matches(in: normalized, phrases: Lexicon.connectives).count)
        let fillers = Double(Tokenizer.matches(in: normalized, phrases: Lexicon.fillers).count)

        let structure = min(1.0, connectives / max(1.0, Double(turns.count) * 1.5))
        let concreteness = Double(content.count) / Double(words.count)
        let concretenessScore = min(1.0, concreteness / 0.5)
        let fillerRatio = min(1.0, fillers / max(1.0, Double(turns.count)))

        var score = 45 + 25 * structure + 30 * concretenessScore - 12 * fillerRatio

        let averageSentenceLength = sentences.isEmpty
            ? Double(words.count)
            : Double(words.count) / Double(sentences.count)
        if averageSentenceLength > 35 {
            score -= 8
        }
        if averageSentenceLength < 5 && words.count > 20 {
            score -= 5
        }
        return score
    }

    static func consistencyScore(for side: Side, inputs: Inputs) -> Double {
        let contradictions = Double(inputs.consistency.counts[side] ?? 0)
        return 100 - contradictions * 20
    }

    static func respectScore(for side: Side, inputs: Inputs) -> Double {
        let insults = Double(inputs.civility.insultCounts[side] ?? 0)
        let dismissals = Double(inputs.civility.dismissalCounts[side] ?? 0)
        let shouting = Double(inputs.civility.shoutingCounts[side] ?? 0)
        let concessions = Double(inputs.civility.concessionCounts[side] ?? 0)

        let penalty = insults * 15 + dismissals * 10 + shouting * 5
        // Conceding is a skill, and the score should say so.
        let concessionBonus = min(10, concessions * 5)
        return 100 - penalty + concessionBonus
    }

    // MARK: - Verdict

    public static func verdict(transcript: Transcript, a: Scorecard, b: Scorecard) -> Verdict {
        let difference = a.overall - b.overall
        let margin = abs(difference)
        let winner: Side? = margin < drawThreshold ? nil : (difference > 0 ? .a : .b)

        let deciding = decidingDimensions(winner: winner, a: a, b: b)
        let confidence = self.confidence(transcript: transcript, margin: margin, isDraw: winner == nil)
        let rationale = self.rationale(
            transcript: transcript,
            winner: winner,
            margin: margin,
            deciding: deciding,
            a: a,
            b: b
        )

        return Verdict(
            winner: winner,
            margin: margin,
            confidence: confidence,
            rationale: rationale,
            decidingDimensions: deciding
        )
    }

    static func decidingDimensions(winner: Side?, a: Scorecard, b: Scorecard) -> [Dimension] {
        guard let winner else { return [] }
        let winnerCard = winner == .a ? a : b
        let loserCard = winner == .a ? b : a

        let gaps = Dimension.allCases.compactMap { dimension -> (Dimension, Double)? in
            let gap = winnerCard.value(for: dimension) - loserCard.value(for: dimension)
            guard gap >= 8 else { return nil }
            return (dimension, gap * dimension.weight)
        }
        return gaps.sorted { $0.1 > $1.1 }.prefix(2).map(\.0)
    }

    /// Confidence falls with a thin margin, a thin transcript, or a
    /// lopsided one. Two sentences against six paragraphs does not settle
    /// anything, whatever the scores say.
    static func confidence(transcript: Transcript, margin: Double, isDraw: Bool) -> Double {
        let marginFactor = isDraw ? 0.6 : min(1.0, 0.3 + margin / 18.0)

        let words = Double(transcript.totalWordCount)
        let turns = Double(transcript.turns.count)
        let volume = (min(1.0, words / 180.0) + min(1.0, turns / 6.0)) / 2.0

        let wordsA = Double(transcript.wordCount(for: .a))
        let wordsB = Double(transcript.wordCount(for: .b))
        let larger = max(wordsA, wordsB)
        let balance = larger > 0 ? min(wordsA, wordsB) / larger : 0

        let raw = marginFactor * volume * (0.5 + 0.5 * balance)
        return min(0.95, max(0.05, raw))
    }

    static func rationale(
        transcript: Transcript,
        winner: Side?,
        margin: Double,
        deciding: [Dimension],
        a: Scorecard,
        b: Scorecard
    ) -> String {
        let nameA = transcript.name(of: .a)
        let nameB = transcript.name(of: .b)
        let rounded = String(format: "%.0f", margin)

        guard let winner else {
            let closest = Dimension.allCases.min { lhs, rhs in
                abs(a.value(for: lhs) - b.value(for: lhs)) < abs(a.value(for: rhs) - b.value(for: rhs))
            } ?? .evidence
            return "Too close to call — \(nameA) and \(nameB) finished within \(rounded) points of each other, and neither pulled clear on \(closest.title.lowercased()). On this transcript the honest answer is that nobody won."
        }

        let winnerName = transcript.name(of: winner)
        let loserName = transcript.name(of: winner.opposite)
        let winnerCard = winner == .a ? a : b
        let loserCard = winner == .a ? b : a

        var sentence = "\(winnerName) finished \(rounded) points ahead"
        if deciding.isEmpty {
            sentence += ", on a narrow spread rather than any single dimension."
        } else {
            let named = deciding.map { $0.title.lowercased() }.joined(separator: " and ")
            sentence += ", and the gap was \(named)."
        }

        let weakest = loserCard.weakest
        sentence += " \(loserName)'s weakest dimension was \(weakest.title.lowercased())"
        sentence += " at \(String(format: "%.0f", loserCard.value(for: weakest)))"
        sentence += ", against \(String(format: "%.0f", winnerCard.value(for: weakest)))."
        return sentence
    }
}
