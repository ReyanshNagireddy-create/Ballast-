import Foundation

/// What kind of statement this is — which decides what Veritas is even
/// allowed to say about it.
///
/// This distinction is the whole ethic of the product. "Nuclear power has
/// the lowest deaths per terawatt-hour" is checkable. "We shouldn't take
/// that risk with our children" is not — it is a value, and a referee that
/// marks values wrong is just a bully with a database.
public enum ClaimKind: String, Codable, Hashable, CaseIterable, Sendable {
    /// A statement about the world that could in principle be checked.
    case empirical
    /// Empirical and carrying a specific number.
    case statistical
    /// Asserts that one thing produces another.
    case causal
    /// A statement about the future.
    case predictive
    /// A statement about what a word means or covers.
    case definitional
    /// A value judgement: should, ought, better, wrong, unfair.
    case normative
    /// A personal story offered as support.
    case anecdotal
    /// Questions, framing, transitions — nothing asserted.
    case rhetorical

    public var title: String {
        switch self {
        case .empirical: return "Factual claim"
        case .statistical: return "Statistic"
        case .causal: return "Causal claim"
        case .predictive: return "Prediction"
        case .definitional: return "Definition"
        case .normative: return "Value judgement"
        case .anecdotal: return "Anecdote"
        case .rhetorical: return "Framing"
        }
    }

    /// Whether a fact-check is meaningful for this kind of statement.
    public var isCheckable: Bool {
        switch self {
        case .empirical, .statistical, .causal:
            return true
        case .predictive, .definitional, .normative, .anecdotal, .rhetorical:
            return false
        }
    }
}

/// How well a claim is backed by what the speaker actually said.
///
/// Note the ceiling: offline, Veritas can tell you a claim is *unsupported*,
/// never that it is *false*. Falsity requires sources, and sources require
/// the network. See `ModelAugmentedReferee`.
public enum SupportVerdict: String, Codable, Hashable, CaseIterable, Sendable {
    /// The speaker pointed at something checkable — a study, an agency, a year.
    case sourced
    /// Specific and quantified, but no source given.
    case quantified
    /// Hedged so heavily it asserts nothing.
    case hedged
    /// A checkable assertion with nothing behind it.
    case unsupported
    /// A value or a definition. Not the referee's business.
    case notApplicable

    public var symbol: String {
        switch self {
        case .sourced: return "checkmark.seal"
        case .quantified: return "number.circle"
        case .hedged: return "questionmark.circle"
        case .unsupported: return "exclamationmark.triangle"
        case .notApplicable: return "heart.text.square"
        }
    }

    public var label: String {
        switch self {
        case .sourced: return "Source cited"
        case .quantified: return "Specific, unsourced"
        case .hedged: return "Hedged"
        case .unsupported: return "Unsupported"
        case .notApplicable: return "Values, not facts"
        }
    }

    /// One line the UI can show under the label without overclaiming.
    public var explanation: String {
        switch self {
        case .sourced:
            return "Points at something a listener could go and check."
        case .quantified:
            return "Carries a real number, but no origin for it."
        case .hedged:
            return "So qualified that it does not commit to anything."
        case .unsupported:
            return "Stated as fact with nothing offered in support."
        case .notApplicable:
            return "A judgement about what matters — not a factual dispute."
        }
    }
}

/// The evidence signals found inside a single statement.
public struct EvidenceSignals: Codable, Hashable, Sendable {
    /// Citation cues found verbatim, e.g. "according to", "peer-reviewed".
    public var citations: [String]
    /// Named institutions or publications recognised in the text.
    public var sources: [String]
    public var hasQuantity: Bool
    public var hasYear: Bool
    /// Hedges: "maybe", "I think", "kind of".
    public var hedges: [String]
    /// Absolutes: "always", "everyone", "obviously".
    public var absolutes: [String]

    public init(
        citations: [String] = [],
        sources: [String] = [],
        hasQuantity: Bool = false,
        hasYear: Bool = false,
        hedges: [String] = [],
        absolutes: [String] = []
    ) {
        self.citations = citations
        self.sources = sources
        self.hasQuantity = hasQuantity
        self.hasYear = hasYear
        self.hedges = hedges
        self.absolutes = absolutes
    }

    public var isSourced: Bool {
        !citations.isEmpty || !sources.isEmpty
    }
}

/// One statement pulled out of a turn, classified and graded.
public struct Claim: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var turnID: UUID
    public var side: Side
    /// The sentence as spoken, trimmed.
    public var text: String
    /// Index of this sentence within its turn — used to line the report
    /// up against the transcript.
    public var sentenceIndex: Int
    public var kind: ClaimKind
    public var signals: EvidenceSignals
    public var verdict: SupportVerdict
    /// Lower-cased content words, stop words removed. The currency of
    /// rebuttal matching and contradiction detection.
    public var keywords: [String]
    /// Whether the main assertion is negated ("does not reduce").
    public var isNegated: Bool

    public init(
        id: UUID = UUID(),
        turnID: UUID,
        side: Side,
        text: String,
        sentenceIndex: Int,
        kind: ClaimKind,
        signals: EvidenceSignals,
        verdict: SupportVerdict,
        keywords: [String],
        isNegated: Bool
    ) {
        self.id = id
        self.turnID = turnID
        self.side = side
        self.text = text
        self.sentenceIndex = sentenceIndex
        self.kind = kind
        self.signals = signals
        self.verdict = verdict
        self.keywords = keywords
        self.isNegated = isNegated
    }

    /// A claim worth arguing with: checkable, substantive, not filler.
    public var isSubstantive: Bool {
        kind != .rhetorical && keywords.count >= 2
    }

    /// Claims the opposing side is expected to answer. Predictions and
    /// value judgements count: "you never answered why that is worth the
    /// cost" is as fair a criticism as ignoring a statistic.
    public var demandsResponse: Bool {
        guard isSubstantive else { return false }
        switch kind {
        case .empirical, .statistical, .causal, .predictive, .normative:
            return true
        case .definitional, .anecdotal, .rhetorical:
            return false
        }
    }
}
