import Foundation

/// Reads the evidence signals out of a single statement.
///
/// The ceiling here is important and deliberate: this decides whether a
/// speaker *offered* support, never whether the claim is true. Offline,
/// "unsupported" is the strongest negative verdict Veritas is entitled to.
public enum EvidenceAnalyzer {

    static func signals(for sentence: String, normalized: String) -> EvidenceSignals {
        var signals = EvidenceSignals()

        signals.citations = Tokenizer.matches(in: normalized, phrases: Lexicon.citationCues)
        signals.sources = namedSources(in: sentence, normalized: normalized)
        signals.hasQuantity = Tokenizer.hasQuantity(sentence, normalized: normalized)
        signals.hasYear = Tokenizer.hasYear(sentence)
        signals.hedges = Tokenizer.matches(in: normalized, phrases: Lexicon.hedges)
        signals.absolutes = Tokenizer.matches(in: normalized, phrases: Lexicon.absolutes)

        return signals
    }

    /// Institutions and publications named in the sentence.
    ///
    /// Acronyms that are also ordinary English words are matched against
    /// the original casing, so "who decides that" does not get credited as
    /// a World Health Organization citation.
    private static func namedSources(in sentence: String, normalized: String) -> [String] {
        let cased = Tokenizer.normalizeKeepingCase(sentence)
        var found: [String] = []
        for source in Lexicon.namedSources {
            if Lexicon.caseSensitiveSources.contains(source) {
                if Tokenizer.contains(cased, phrase: source.uppercased()) {
                    found.append(source.uppercased())
                }
            } else if Tokenizer.contains(normalized, phrase: source) {
                found.append(source)
            }
        }
        return found
    }

    /// Turns the signals into the verdict shown in the live feed.
    static func verdict(kind: ClaimKind, signals: EvidenceSignals) -> SupportVerdict {
        switch kind {
        case .normative, .definitional, .rhetorical, .anecdotal:
            // Not a factual dispute. Saying "unsupported" here would be the
            // referee overstepping — these are not the kind of thing a
            // source settles.
            return .notApplicable

        case .empirical, .statistical, .causal, .predictive:
            if signals.isSourced {
                return .sourced
            }
            // A claim wrapped in "I think" and "maybe" has not been asserted
            // firmly enough to be worth challenging — unless the speaker
            // hedged and then hammered it with an absolute in the same breath.
            if !signals.hedges.isEmpty && signals.absolutes.isEmpty {
                return .hedged
            }
            if signals.hasQuantity {
                return .quantified
            }
            return .unsupported
        }
    }

    /// A short line the live feed can show next to the verdict.
    static func note(for verdict: SupportVerdict, signals: EvidenceSignals) -> String {
        switch verdict {
        case .sourced:
            let named = (signals.sources + signals.citations).prefix(2).joined(separator: ", ")
            return named.isEmpty ? verdict.explanation : "Cites \(named)."
        case .quantified:
            return "Specific enough to check — but no source was given for the number."
        case .hedged:
            let hedge = signals.hedges.first ?? "a hedge"
            return "Qualified with \"\(hedge)\", so nothing firm has been claimed yet."
        case .unsupported:
            if !signals.absolutes.isEmpty {
                let absolute = signals.absolutes.first ?? "an absolute"
                return "Stated as fact, and with \"\(absolute)\" — one counterexample would sink it."
            }
            return "Stated as fact with nothing offered in support."
        case .notApplicable:
            return verdict.explanation
        }
    }
}
