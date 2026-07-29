import Foundation

/// Catches a side arguing against itself.
///
/// Kept deliberately narrow: two statements only count as a contradiction
/// when they are about nearly the same things and differ in polarity. Real
/// positions evolve during a debate, and calling every refinement a
/// contradiction would punish the one thing debate is supposed to do.
public enum ConsistencyAnalyzer {

    public struct Result: Sendable {
        public var findings: [Finding] = []
        public var counts: [Side: Int] = [:]
    }

    /// How similar two claims must be before their polarity is compared.
    static let similarityThreshold = 0.6
    /// At most this many per side — after two, the point is made.
    static let maximumPerSide = 2

    public static func analyze(transcript: Transcript, claims: [Claim]) -> Result {
        var result = Result()
        var counts: [Side: Int] = [.a: 0, .b: 0]

        for side in Side.allCases {
            let candidates = claims.filter { claim in
                claim.side == side && claim.isSubstantive && claim.kind != .rhetorical
            }
            guard candidates.count > 1 else { continue }

            var reported = 0
            var usedClaims: Set<UUID> = []

            for i in 0..<candidates.count {
                if reported >= maximumPerSide { break }
                for j in (i + 1)..<candidates.count {
                    if reported >= maximumPerSide { break }
                    let first = candidates[i]
                    let second = candidates[j]

                    // Same turn: usually a clause pair, not a reversal.
                    guard first.turnID != second.turnID else { continue }
                    guard !usedClaims.contains(first.id), !usedClaims.contains(second.id) else { continue }
                    guard first.isNegated != second.isNegated else { continue }
                    guard Tokenizer.jaccard(first.keywords, second.keywords) >= similarityThreshold else { continue }

                    let turn = transcript.turn(withID: second.turnID)
                    result.findings.append(
                        Finding(
                            kind: .contradiction,
                            severity: .warning,
                            side: side,
                            turnID: second.turnID,
                            claimID: second.id,
                            quote: Tokenizer.excerpt(second.text),
                            title: "Reversed an earlier position",
                            detail: "Earlier: \u{201C}\(Tokenizer.excerpt(first.text, limit: 120))\u{201D} — then this. Both cannot hold.",
                            coaching: "If you changed your mind, say so out loud: \"I was wrong about that, here is where I land now.\" Announced, it reads as honesty. Unannounced, it reads as not having a position.",
                            offset: turn?.offset ?? 0
                        )
                    )
                    usedClaims.insert(first.id)
                    usedClaims.insert(second.id)
                    counts[side, default: 0] += 1
                    reported += 1
                }
            }
        }

        result.counts = counts
        return result
    }
}
