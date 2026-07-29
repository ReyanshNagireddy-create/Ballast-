import Foundation

/// The six things Veritas grades.
///
/// Persuasiveness is deliberately absent. Whether an argument *felt*
/// convincing is exactly the thing people are already bad at judging, and
/// grading it would reward the loud speaker the product exists to defuse.
public enum Dimension: String, Codable, Hashable, CaseIterable, Sendable {
    case evidence
    case logic
    case rebuttal
    case clarity
    case consistency
    case respectfulness

    public var title: String {
        switch self {
        case .evidence: return "Evidence"
        case .logic: return "Logic"
        case .rebuttal: return "Rebuttal"
        case .clarity: return "Clarity"
        case .consistency: return "Consistency"
        case .respectfulness: return "Respect"
        }
    }

    public var blurb: String {
        switch self {
        case .evidence:
            return "Did the factual claims come with something checkable behind them?"
        case .logic:
            return "Did the reasoning hold, or did it lean on fallacies?"
        case .rebuttal:
            return "Did each turn answer what the other side actually said?"
        case .clarity:
            return "Were the arguments concrete, structured, and specific?"
        case .consistency:
            return "Did the position stay the same from the first turn to the last?"
        case .respectfulness:
            return "Was the disagreement about the argument rather than the person?"
        }
    }

    /// Contribution to the overall score. Evidence and logic carry the most
    /// because they are the two things the product claims to teach.
    public var weight: Double {
        switch self {
        case .evidence: return 0.28
        case .logic: return 0.26
        case .rebuttal: return 0.22
        case .clarity: return 0.10
        case .consistency: return 0.08
        case .respectfulness: return 0.06
        }
    }

    public var symbol: String {
        switch self {
        case .evidence: return "doc.text.magnifyingglass"
        case .logic: return "arrow.triangle.branch"
        case .rebuttal: return "arrow.uturn.left"
        case .clarity: return "text.alignleft"
        case .consistency: return "equal.circle"
        case .respectfulness: return "hand.raised"
        }
    }
}

/// One side's six scores plus the weighted total.
public struct Scorecard: Codable, Hashable, Sendable {
    public var side: Side
    public var evidence: Double
    public var logic: Double
    public var rebuttal: Double
    public var clarity: Double
    public var consistency: Double
    public var respectfulness: Double

    public init(
        side: Side,
        evidence: Double = 0,
        logic: Double = 0,
        rebuttal: Double = 0,
        clarity: Double = 0,
        consistency: Double = 0,
        respectfulness: Double = 0
    ) {
        self.side = side
        self.evidence = evidence
        self.logic = logic
        self.rebuttal = rebuttal
        self.clarity = clarity
        self.consistency = consistency
        self.respectfulness = respectfulness
    }

    public func value(for dimension: Dimension) -> Double {
        switch dimension {
        case .evidence: return evidence
        case .logic: return logic
        case .rebuttal: return rebuttal
        case .clarity: return clarity
        case .consistency: return consistency
        case .respectfulness: return respectfulness
        }
    }

    public mutating func set(_ value: Double, for dimension: Dimension) {
        let clamped = min(100, max(0, value))
        switch dimension {
        case .evidence: evidence = clamped
        case .logic: logic = clamped
        case .rebuttal: rebuttal = clamped
        case .clarity: clarity = clamped
        case .consistency: consistency = clamped
        case .respectfulness: respectfulness = clamped
        }
    }

    /// Weighted total, 0–100.
    public var overall: Double {
        var total = 0.0
        for dimension in Dimension.allCases {
            total += value(for: dimension) * dimension.weight
        }
        return min(100, max(0, total))
    }

    public var grade: String {
        switch overall {
        case 90...: return "A"
        case 80..<90: return "B"
        case 70..<80: return "C"
        case 60..<70: return "D"
        default: return "F"
        }
    }

    /// The dimension this side did best at.
    public var strongest: Dimension {
        Dimension.allCases.max(by: { value(for: $0) < value(for: $1) }) ?? .evidence
    }

    /// The dimension most worth working on.
    public var weakest: Dimension {
        Dimension.allCases.min(by: { value(for: $0) < value(for: $1) }) ?? .evidence
    }
}

/// Who the referee thinks did the better job, and how sure it is.
public struct Verdict: Codable, Hashable, Sendable {
    /// `nil` means too close to call. Veritas says "draw" rather than
    /// inventing a winner from noise.
    public var winner: Side?
    /// Difference in overall score, 0–100.
    public var margin: Double
    /// 0–1. Driven by margin *and* by how much was actually said.
    public var confidence: Double
    /// Plain-language explanation of what decided it.
    public var rationale: String
    /// Dimensions where the winner beat the loser by a clear margin.
    public var decidingDimensions: [Dimension]

    public init(
        winner: Side?,
        margin: Double,
        confidence: Double,
        rationale: String,
        decidingDimensions: [Dimension] = []
    ) {
        self.winner = winner
        self.margin = margin
        self.confidence = confidence
        self.rationale = rationale
        self.decidingDimensions = decidingDimensions
    }

    public var isDraw: Bool { winner == nil }

    public var confidenceLabel: String {
        switch confidence {
        case 0.75...: return "High confidence"
        case 0.5..<0.75: return "Moderate confidence"
        case 0.3..<0.5: return "Low confidence"
        default: return "Very low confidence"
        }
    }
}
