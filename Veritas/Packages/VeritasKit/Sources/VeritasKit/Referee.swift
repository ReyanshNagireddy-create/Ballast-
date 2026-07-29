import Foundation

/// The front door of VeritasKit.
///
/// ```swift
/// let report = Referee.analyze(transcript)
/// print(report.verdict.rationale)
/// ```
///
/// Everything is synchronous, deterministic and offline: the same
/// transcript always produces the same report, which is the property that
/// lets the report be argued with. If two people disagree with the verdict
/// they can point at a sentence, not at a mood.
public enum Referee {

    /// Everything the pipeline produced, before it is shaped into a report.
    ///
    /// The live feed and the final report run the *same* analysis over the
    /// same transcript — the live view is just this, re-run after each turn.
    /// Two code paths would eventually disagree, and a referee that changes
    /// its mind between the debate and the report is worthless.
    public struct Analysis: Sendable {
        public var claims: [Claim]
        public var findings: [Finding]
        public var rebuttal: RebuttalAnalyzer.Result
        public var consistency: ConsistencyAnalyzer.Result
        public var civility: CivilityAnalyzer.Result
    }

    public static func examine(_ transcript: Transcript) -> Analysis {
        let claims = ClaimExtractor.claims(in: transcript)

        let rebuttal = RebuttalAnalyzer.analyze(transcript: transcript, claims: claims)
        let consistency = ConsistencyAnalyzer.analyze(transcript: transcript, claims: claims)
        let civility = CivilityAnalyzer.analyze(transcript: transcript)

        var findings: [Finding] = []
        findings.append(contentsOf: FallacyDetector.findings(in: transcript, claims: claims))
        findings.append(contentsOf: evidenceFindings(transcript: transcript, claims: claims))
        findings.append(contentsOf: rebuttal.findings)
        findings.append(contentsOf: consistency.findings)
        findings.append(contentsOf: civility.findings)

        return Analysis(
            claims: claims,
            findings: findings,
            rebuttal: rebuttal,
            consistency: consistency,
            civility: civility
        )
    }

    /// Runs the whole pipeline over a finished debate.
    public static func analyze(_ transcript: Transcript, extraCaveats: [String] = []) -> DebateReport {
        let analysis = examine(transcript)
        return ReportBuilder.build(
            transcript: transcript,
            claims: analysis.claims,
            findings: analysis.findings,
            rebuttal: analysis.rebuttal,
            consistency: analysis.consistency,
            civility: analysis.civility,
            extraCaveats: extraCaveats
        )
    }

    /// Findings about support: the unsupported claims worth flagging, and
    /// the well-sourced ones worth crediting.
    ///
    /// Capped per turn so a single dense paragraph does not bury the feed.
    static func evidenceFindings(transcript: Transcript, claims: [Claim]) -> [Finding] {
        var findings: [Finding] = []

        for turn in transcript.turns {
            let turnClaims = claims.filter { $0.turnID == turn.id }

            let unsupported = turnClaims
                .filter { $0.verdict == .unsupported && $0.isSubstantive }
                .sorted { $0.signals.absolutes.count > $1.signals.absolutes.count }

            for claim in unsupported.prefix(2) {
                findings.append(
                    Finding(
                        kind: .unsupportedClaim,
                        severity: claim.signals.absolutes.isEmpty ? .notice : .warning,
                        side: claim.side,
                        turnID: turn.id,
                        claimID: claim.id,
                        quote: Tokenizer.excerpt(claim.text),
                        title: "Unsupported claim",
                        detail: EvidenceAnalyzer.note(for: claim.verdict, signals: claim.signals),
                        coaching: "Name where it comes from, or soften it to what you can defend. \"I believe\" is a much stronger position than a fact you cannot source.",
                        offset: turn.offset
                    )
                )
            }

            if let sourced = turnClaims.first(where: { $0.verdict == .sourced }) {
                findings.append(
                    Finding(
                        kind: .strongEvidence,
                        severity: .info,
                        side: sourced.side,
                        turnID: turn.id,
                        claimID: sourced.id,
                        quote: Tokenizer.excerpt(sourced.text),
                        title: "Backed it up",
                        detail: EvidenceAnalyzer.note(for: sourced.verdict, signals: sourced.signals),
                        offset: turn.offset
                    )
                )
            }
        }
        return findings
    }
}
