import Foundation

/// Grades tone — and, just as deliberately, credits people for conceding.
///
/// Respectfulness is the lightest-weighted dimension on purpose. Veritas is
/// not a politeness filter: a blunt, well-evidenced argument should beat a
/// courteous empty one every time. What this catches is the move where the
/// disagreement stops being about the topic.
public enum CivilityAnalyzer {

    public struct Result: Sendable {
        public var findings: [Finding] = []
        public var insultCounts: [Side: Int] = [:]
        public var dismissalCounts: [Side: Int] = [:]
        public var shoutingCounts: [Side: Int] = [:]
        public var concessionCounts: [Side: Int] = [:]
    }

    static let profanity: [String] = [
        "bullshit", "bs", "shut up", "screw you", "piss off", "get lost",
        "damn it", "goddamn"
    ]

    public static func analyze(transcript: Transcript) -> Result {
        var result = Result()
        var insults: [Side: Int] = [.a: 0, .b: 0]
        var dismissals: [Side: Int] = [.a: 0, .b: 0]
        var shouting: [Side: Int] = [.a: 0, .b: 0]
        var concessions: [Side: Int] = [.a: 0, .b: 0]

        for turn in transcript.turns {
            let normalized = Tokenizer.normalize(turn.text)

            let insultHits = Tokenizer.matches(in: normalized, phrases: Lexicon.insults)
            let dismissalHits = Tokenizer.matches(in: normalized, phrases: Lexicon.dismissals)
            let profanityHits = Tokenizer.matches(in: normalized, phrases: profanity)
            let concessionHits = Tokenizer.matches(in: normalized, phrases: Lexicon.concessionCues)
            let shouted = shoutedWords(in: turn.text)

            insults[turn.side, default: 0] += insultHits.count + profanityHits.count
            dismissals[turn.side, default: 0] += dismissalHits.count
            shouting[turn.side, default: 0] += shouted.isEmpty ? 0 : 1
            concessions[turn.side, default: 0] += concessionHits.count

            if let hit = (insultHits + profanityHits).first {
                result.findings.append(
                    Finding(
                        kind: .incivility,
                        severity: .warning,
                        side: turn.side,
                        turnID: turn.id,
                        quote: Tokenizer.excerpt(sentence(containing: hit, in: turn.text) ?? turn.text),
                        title: "Aimed at the person",
                        detail: "\u{201C}\(hit)\u{201D} is about who you are arguing with rather than what they said. It also hands the room a reason to stop listening to the rest of your point.",
                        coaching: "Say the same thing about the argument instead. \"That reasoning doesn't hold, and here's why\" costs you nothing and keeps the floor.",
                        offset: turn.offset
                    )
                )
            } else if let hit = dismissalHits.first {
                result.findings.append(
                    Finding(
                        kind: .incivility,
                        severity: .notice,
                        side: turn.side,
                        turnID: turn.id,
                        quote: Tokenizer.excerpt(sentence(containing: hit, in: turn.text) ?? turn.text),
                        title: "Dismissed rather than answered",
                        detail: "\u{201C}\(hit)\u{201D} tells the other person they are not worth answering. Whatever they said is still on the table.",
                        coaching: "If the point is weak, show the weakness. Dismissal reads as not having a reply.",
                        offset: turn.offset
                    )
                )
            }

            if shouted.count >= 2 {
                result.findings.append(
                    Finding(
                        kind: .incivility,
                        severity: .info,
                        side: turn.side,
                        turnID: turn.id,
                        quote: Tokenizer.excerpt(turn.text),
                        title: "Volume instead of weight",
                        detail: "Words in capitals (\(shouted.prefix(3).joined(separator: ", "))) do the work of emphasis, not evidence.",
                        coaching: "Put the emphasis in the strongest sentence rather than the loudest word.",
                        offset: turn.offset
                    )
                )
            }

            if let hit = concessionHits.first {
                result.findings.append(
                    Finding(
                        kind: .strongRebuttal,
                        severity: .info,
                        side: turn.side,
                        turnID: turn.id,
                        quote: Tokenizer.excerpt(sentence(containing: hit, in: turn.text) ?? turn.text),
                        title: "Conceded a point",
                        detail: "Granting what you cannot answer is a strength. It costs one point and buys credibility on every other one.",
                        offset: turn.offset
                    )
                )
            }
        }

        result.insultCounts = insults
        result.dismissalCounts = dismissals
        result.shoutingCounts = shouting
        result.concessionCounts = concessions
        return result
    }

    /// Words written in capitals — four letters or more, so acronyms like
    /// CDC and WHO are not mistaken for shouting.
    static func shoutedWords(in text: String) -> [String] {
        var result: [String] = []
        for token in text.split(whereSeparator: { !$0.isLetter }) {
            guard token.count >= 4 else { continue }
            let word = String(token)
            if word == word.uppercased() && word != word.lowercased() {
                result.append(word)
            }
        }
        return result
    }

    /// The sentence a matched phrase came from, so quotes stay in context.
    private static func sentence(containing phrase: String, in text: String) -> String? {
        for candidate in Tokenizer.sentences(in: text) {
            if Tokenizer.contains(Tokenizer.normalize(candidate), phrase: phrase) {
                return candidate
            }
        }
        return nil
    }
}
