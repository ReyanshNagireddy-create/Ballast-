import Foundation

/// Breaks turns into individual statements and decides what each one *is*.
///
/// Classification comes before everything else in the pipeline, because it
/// is what stops Veritas from fact-checking a value. If a sentence is
/// "children deserve time to be children", no source settles it, and the
/// report should say so rather than hand out a red cross.
public enum ClaimExtractor {

    public static func claims(in transcript: Transcript) -> [Claim] {
        transcript.turns.flatMap { claims(in: $0) }
    }

    public static func claims(in turn: Turn) -> [Claim] {
        let sentences = Tokenizer.sentences(in: turn.text)
        var result: [Claim] = []
        result.reserveCapacity(sentences.count)

        for (index, sentence) in sentences.enumerated() {
            let normalized = Tokenizer.normalize(sentence)
            let keywords = Tokenizer.contentWords(in: sentence)
            let signals = EvidenceAnalyzer.signals(for: sentence, normalized: normalized)
            let kind = classify(
                sentence: sentence,
                normalized: normalized,
                keywords: keywords,
                signals: signals
            )
            let verdict = EvidenceAnalyzer.verdict(kind: kind, signals: signals)

            result.append(
                Claim(
                    turnID: turn.id,
                    side: turn.side,
                    text: sentence,
                    sentenceIndex: index,
                    kind: kind,
                    signals: signals,
                    verdict: verdict,
                    keywords: keywords,
                    isNegated: isNegated(normalized)
                )
            )
        }
        return result
    }

    // MARK: - Classification

    static func classify(
        sentence: String,
        normalized: String,
        keywords: [String],
        signals: EvidenceSignals
    ) -> ClaimKind {
        // Nothing asserted: questions, transitions, one-word reactions.
        if sentence.hasSuffix("?") { return .rhetorical }
        if keywords.count < 2 { return .rhetorical }

        if Tokenizer.containsAny(normalized, phrases: Lexicon.definitionalMarkers) {
            return .definitional
        }
        if Tokenizer.containsAny(normalized, phrases: Lexicon.anecdoteMarkers) {
            return .anecdotal
        }

        // A number makes a sentence checkable even when it is wrapped in
        // "we should" — "we should ban it, it costs families $4,000 a year"
        // has something in it a source can settle.
        if signals.hasQuantity || signals.hasYear {
            return .statistical
        }

        // Predictions before causes: "banning it will cause crime to rise"
        // is a forecast, and forecasts cannot be checked today.
        if Tokenizer.containsAny(normalized, phrases: Lexicon.predictiveMarkers) {
            return .predictive
        }
        if Tokenizer.containsAny(normalized, phrases: Lexicon.causalMarkers) {
            return .causal
        }
        if Tokenizer.containsAny(normalized, phrases: Lexicon.normativeMarkers) {
            return .normative
        }
        return .empirical
    }

    /// Whether the statement is negated, used so that "X works" and "X does
    /// not work" are recognised as a contradiction rather than a repetition.
    static func isNegated(_ normalized: String) -> Bool {
        for word in normalized.split(separator: " ") where Lexicon.negations.contains(String(word)) {
            return true
        }
        return false
    }
}
