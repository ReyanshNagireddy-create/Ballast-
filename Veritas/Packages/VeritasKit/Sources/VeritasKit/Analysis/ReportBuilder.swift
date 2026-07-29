import Foundation

/// Assembles the report a human actually reads.
public enum ReportBuilder {

    public static func build(
        transcript: Transcript,
        claims: [Claim],
        findings: [Finding],
        rebuttal: RebuttalAnalyzer.Result,
        consistency: ConsistencyAnalyzer.Result,
        civility: CivilityAnalyzer.Result,
        extraCaveats: [String] = []
    ) -> DebateReport {
        let inputs = Scorer.Inputs(
            transcript: transcript,
            claims: claims,
            findings: findings,
            rebuttal: rebuttal,
            consistency: consistency,
            civility: civility
        )

        let cardA = Scorer.scorecard(for: .a, inputs: inputs)
        let cardB = Scorer.scorecard(for: .b, inputs: inputs)
        let verdict = Scorer.verdict(transcript: transcript, a: cardA, b: cardB)

        let speakers = Side.allCases.map { side in
            speakerReport(
                side: side,
                scorecard: side == .a ? cardA : cardB,
                transcript: transcript,
                claims: claims,
                findings: findings,
                rebuttal: rebuttal
            )
        }

        return DebateReport(
            topic: transcript.topic,
            format: transcript.format,
            transcript: transcript,
            verdict: verdict,
            speakers: speakers,
            claims: claims,
            findings: findings,
            sharedGround: sharedGround(transcript: transcript, claims: claims, civility: civility),
            caveats: caveats(transcript: transcript, claims: claims) + extraCaveats
        )
    }

    // MARK: - Per speaker

    static func speakerReport(
        side: Side,
        scorecard: Scorecard,
        transcript: Transcript,
        claims: [Claim],
        findings: [Finding],
        rebuttal: RebuttalAnalyzer.Result
    ) -> SpeakerReport {
        let sideClaims = claims.filter { $0.side == side }
        let sideFindings = findings.filter { $0.side == side }

        let stats = SpeakerStats(
            turns: transcript.turns(by: side).count,
            words: transcript.wordCount(for: side),
            claims: sideClaims.count,
            checkableClaims: sideClaims.filter { $0.verdict != .notApplicable }.count,
            sourcedClaims: sideClaims.filter { $0.verdict == .sourced }.count,
            unsupportedClaims: sideClaims.filter { $0.verdict == .unsupported }.count,
            fallacies: sideFindings.filter { $0.kind == .fallacy }.count,
            engagementRate: rebuttal.engagementRate[side] ?? 0,
            speakingTime: transcript.turns(by: side).reduce(0) { $0 + $1.duration }
        )

        // Dropped-argument findings are filed against the side that failed
        // to answer, so this side's misses are its own findings and its wins
        // are the ones filed against the opponent.
        let missed = findings
            .filter { $0.kind == .droppedArgument && $0.side == side }
            .map { Highlight(side: side.opposite, quote: $0.quote, reason: $0.detail, offset: $0.offset) }
        let unanswered = findings
            .filter { $0.kind == .droppedArgument && $0.side == side.opposite }
            .map { Highlight(side: side, quote: $0.quote, reason: "Never answered by \(transcript.name(of: side.opposite)).", offset: $0.offset) }

        return SpeakerReport(
            side: side,
            name: transcript.name(of: side),
            scorecard: scorecard,
            stats: stats,
            bestArgument: bestArgument(claims: sideClaims, findings: findings, transcript: transcript),
            weakestArgument: weakestArgument(claims: sideClaims, findings: sideFindings, transcript: transcript),
            unansweredPoints: unanswered,
            missedOpportunities: missed,
            findings: sideFindings.ranked,
            suggestions: suggestions(scorecard: scorecard, stats: stats, findings: sideFindings)
        )
    }

    /// The claim that did the most work: supported, substantial, and not
    /// sitting inside a turn that got flagged.
    static func bestArgument(claims: [Claim], findings: [Finding], transcript: Transcript) -> Highlight? {
        let flaggedTurns = Set(
            findings
                .filter { $0.kind == .fallacy && $0.severity >= .warning }
                .compactMap(\.turnID)
        )

        var best: (claim: Claim, score: Double)?
        for claim in claims where claim.isSubstantive {
            var score = Scorer.credit(for: claim.verdict) * 3
            score += min(1.5, Double(claim.keywords.count) / 8.0)
            if !claim.signals.sources.isEmpty { score += 1 }
            if flaggedTurns.contains(claim.turnID) { score -= 1.5 }
            if claim.kind == .statistical { score += 0.5 }
            if let current = best {
                if score > current.score { best = (claim, score) }
            } else {
                best = (claim, score)
            }
        }

        guard let winner = best, winner.score > 0.8 else { return nil }
        let claim = winner.claim
        let offset = transcript.turn(withID: claim.turnID)?.offset ?? 0
        return Highlight(
            side: claim.side,
            quote: Tokenizer.excerpt(claim.text),
            reason: reason(forBest: claim),
            offset: offset
        )
    }

    private static func reason(forBest claim: Claim) -> String {
        switch claim.verdict {
        case .sourced:
            let named = (claim.signals.sources + claim.signals.citations).first
            if let named {
                return "Specific and attributed — \u{201C}\(named)\u{201D} gives the other side something to actually check."
            }
            return "Specific and attributed, so it can be checked rather than just asserted."
        case .quantified:
            return "Concrete and quantified. Add where the number came from and this becomes hard to answer."
        case .hedged:
            return "Carefully qualified, which makes it difficult to knock down."
        case .unsupported, .notApplicable:
            return "The clearest statement of the position on this side."
        }
    }

    /// The moment that cost the most.
    static func weakestArgument(claims: [Claim], findings: [Finding], transcript: Transcript) -> Highlight? {
        if let worst = findings
            .filter({ $0.kind == .fallacy || $0.kind == .contradiction })
            .max(by: { $0.severity < $1.severity }) {
            return Highlight(
                side: worst.side,
                quote: worst.quote,
                reason: "\(worst.title). \(worst.detail)",
                offset: worst.offset
            )
        }

        let unsupported = claims
            .filter { $0.verdict == .unsupported && $0.isSubstantive }
            .max(by: { $0.signals.absolutes.count < $1.signals.absolutes.count })

        guard let claim = unsupported else { return nil }
        let offset = transcript.turn(withID: claim.turnID)?.offset ?? 0
        return Highlight(
            side: claim.side,
            quote: Tokenizer.excerpt(claim.text),
            reason: "Asserted as fact with nothing offered behind it. This is the sentence the other side should have asked you to back up.",
            offset: offset
        )
    }

    // MARK: - Suggestions

    /// Two or three things worth doing differently, ordered by how much
    /// they would actually change the score.
    static func suggestions(scorecard: Scorecard, stats: SpeakerStats, findings: [Finding]) -> [String] {
        let ranked = Dimension.allCases
            .map { ($0, (100 - scorecard.value(for: $0)) * $0.weight) }
            .filter { $0.1 > 1.5 }
            .sorted { $0.1 > $1.1 }

        var result: [String] = []
        for (dimension, _) in ranked {
            guard result.count < 3 else { break }
            if let line = suggestion(for: dimension, stats: stats, findings: findings) {
                result.append(line)
            }
        }

        if result.isEmpty {
            result.append("Nothing obvious to fix on this transcript. Try a harder opponent, or take the side you disagree with.")
        }
        return result
    }

    private static func suggestion(for dimension: Dimension, stats: SpeakerStats, findings: [Finding]) -> String? {
        switch dimension {
        case .evidence:
            guard stats.checkableClaims > 0 else { return nil }
            if stats.unsupportedClaims == 0 { return nil }
            return "\(stats.unsupportedClaims) of your \(stats.checkableClaims) factual claims came with nothing to check. Pick the single one your case depends on and bring a source for it — one named study beats five confident assertions."

        case .logic:
            let worst = findings.filter { $0.kind == .fallacy }.max(by: { $0.severity < $1.severity })
            guard let worst, let fallacy = worst.fallacy else { return nil }
            return "\(fallacy.title) cost you the most. \(fallacy.coaching)"

        case .rebuttal:
            let percent = Int((stats.engagementRate * 100).rounded())
            let dropped = findings.filter { $0.kind == .droppedArgument }.count
            if dropped > 0 {
                return "You left \(dropped) of their points unanswered. Open your next turn by naming their strongest one and dealing with it before you advance your own."
            }
            return "You engaged with the other side on \(percent)% of your turns. Quote them before you answer — it forces the reply to land on what they actually said."

        case .clarity:
            return "Signpost the structure. \"There are two reasons — first…, second…\" makes an argument easier to follow and much harder to misrepresent."

        case .consistency:
            let contradictions = findings.filter { $0.kind == .contradiction }.count
            guard contradictions > 0 else { return nil }
            return "You reversed a position mid-debate without flagging it. Changing your mind is fine; doing it silently reads as not having a position."

        case .respectfulness:
            let incivility = findings.filter { $0.kind == .incivility }.count
            guard incivility > 0 else { return nil }
            return "Keep the heat on the argument. Every line aimed at the person gives the room a reason to stop weighing what you said."
        }
    }

    // MARK: - Shared ground and caveats

    static func sharedGround(transcript: Transcript, claims: [Claim], civility: CivilityAnalyzer.Result) -> [String] {
        var result: [String] = []

        let normativeShare = { (side: Side) -> Double in
            let own = claims.filter { $0.side == side && $0.isSubstantive }
            guard !own.isEmpty else { return 0 }
            let normative = own.filter { $0.kind == .normative || $0.kind == .predictive }.count
            return Double(normative) / Double(own.count)
        }

        if normativeShare(.a) >= 0.4 && normativeShare(.b) >= 0.4 {
            result.append("Most of this was a disagreement about values, not facts. No source settles whether the trade-off is worth it — which is worth knowing before either of you goes looking for one.")
        }

        // The vocabulary both sides used: evidence they were arguing about
        // the same thing rather than past each other.
        let keywordsA = Set(claims.filter { $0.side == .a }.flatMap(\.keywords))
        let keywordsB = Set(claims.filter { $0.side == .b }.flatMap(\.keywords))
        let shared = keywordsA.intersection(keywordsB).sorted().prefix(4)
        if shared.count >= 3 {
            result.append("You did agree on the terms of the dispute — both sides argued about \(shared.joined(separator: ", ")).")
        } else if !keywordsA.isEmpty && !keywordsB.isEmpty {
            result.append("The two sides barely used the same words. That usually means you were answering different questions.")
        }

        let concessions = (civility.concessionCounts[.a] ?? 0) + (civility.concessionCounts[.b] ?? 0)
        if concessions > 0 {
            result.append("At least one point was conceded outright. That is rarer than it should be, and it is what makes the rest of a position credible.")
        }
        return result
    }

    static func caveats(transcript: Transcript, claims: [Claim]) -> [String] {
        var result: [String] = [
            "Veritas checked whether claims were *supported*, not whether they were *true*. Marking something unsupported is a note about the argument, not a ruling on the fact."
        ]

        if !transcript.hasEnoughMaterial {
            result.append("This transcript is short. Treat the scores as a sketch — there was not much here to grade.")
        }

        let wordsA = transcript.wordCount(for: .a)
        let wordsB = transcript.wordCount(for: .b)
        let larger = max(wordsA, wordsB)
        let smaller = min(wordsA, wordsB)
        if smaller > 0, Double(larger) / Double(smaller) >= 2.0 {
            let name = wordsA > wordsB ? transcript.name(of: .a) : transcript.name(of: .b)
            result.append("\(name) spoke about \(larger / max(smaller, 1))× more. Uneven airtime moves nearly every score here, so the comparison is not like for like.")
        }

        if claims.filter({ $0.verdict != .notApplicable }).isEmpty {
            result.append("Nothing in this debate was a factual claim, so the evidence scores are neutral placeholders rather than judgements.")
        }
        return result
    }
}
