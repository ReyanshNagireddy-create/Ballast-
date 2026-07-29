import Foundation

/// How much attention a finding deserves.
public enum Severity: Int, Codable, Hashable, CaseIterable, Comparable, Sendable {
    case info = 0
    case notice = 1
    case warning = 2
    case major = 3

    public static func < (lhs: Severity, rhs: Severity) -> Bool {
        lhs.rawValue < rhs.rawValue
    }

    public var title: String {
        switch self {
        case .info: return "Note"
        case .notice: return "Notice"
        case .warning: return "Warning"
        case .major: return "Major"
        }
    }

    /// Points removed from the relevant dimension, before normalisation.
    var penalty: Double {
        switch self {
        case .info: return 0
        case .notice: return 6
        case .warning: return 11
        case .major: return 17
        }
    }
}

/// The categories of thing Veritas can observe.
public enum FindingKind: String, Codable, Hashable, CaseIterable, Sendable {
    case fallacy
    case unsupportedClaim
    case contradiction
    case droppedArgument
    case incivility
    /// Positive findings. A referee that only ever says what went wrong
    /// teaches people to be quiet, not to argue well.
    case strongEvidence
    case strongRebuttal

    public var title: String {
        switch self {
        case .fallacy: return "Reasoning"
        case .unsupportedClaim: return "Unsupported"
        case .contradiction: return "Contradiction"
        case .droppedArgument: return "Dropped"
        case .incivility: return "Tone"
        case .strongEvidence: return "Well sourced"
        case .strongRebuttal: return "Direct rebuttal"
        }
    }

    public var isPositive: Bool {
        self == .strongEvidence || self == .strongRebuttal
    }

    /// SF Symbol name, so the app does not have to switch on this again.
    public var symbol: String {
        switch self {
        case .fallacy: return "arrow.triangle.branch"
        case .unsupportedClaim: return "exclamationmark.triangle"
        case .contradiction: return "arrow.left.arrow.right"
        case .droppedArgument: return "questionmark.bubble"
        case .incivility: return "hand.raised"
        case .strongEvidence: return "checkmark.seal"
        case .strongRebuttal: return "arrow.uturn.left"
        }
    }
}

/// One observation about one moment in the debate.
///
/// Findings are the atom of the whole product: the live feed shows them as
/// they happen, the score is computed from them, and the report is mostly
/// findings grouped and explained. Every one of them points at a quote, so
/// nothing in the report is unfalsifiable.
public struct Finding: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var kind: FindingKind
    public var severity: Severity
    /// The side this is *about*.
    public var side: Side
    public var turnID: UUID?
    public var claimID: UUID?
    /// The exact words this is about. Never paraphrased.
    public var quote: String
    public var title: String
    /// What happened.
    public var detail: String
    /// What to do differently. Empty for positive findings.
    public var coaching: String
    public var fallacy: Fallacy?
    /// Where in the debate, in seconds, for the replay timeline.
    public var offset: TimeInterval

    public init(
        id: UUID = UUID(),
        kind: FindingKind,
        severity: Severity,
        side: Side,
        turnID: UUID? = nil,
        claimID: UUID? = nil,
        quote: String,
        title: String,
        detail: String,
        coaching: String = "",
        fallacy: Fallacy? = nil,
        offset: TimeInterval = 0
    ) {
        self.id = id
        self.kind = kind
        self.severity = severity
        self.side = side
        self.turnID = turnID
        self.claimID = claimID
        self.quote = quote
        self.title = title
        self.detail = detail
        self.coaching = coaching
        self.fallacy = fallacy
        self.offset = offset
    }
}

public extension Array where Element == Finding {
    func forSide(_ side: Side) -> [Finding] {
        filter { $0.side == side }
    }

    func ofKind(_ kind: FindingKind) -> [Finding] {
        filter { $0.kind == kind }
    }

    var negativeOnly: [Finding] {
        filter { !$0.kind.isPositive }
    }

    /// Worst first, then earliest — the order a reader wants.
    var ranked: [Finding] {
        sorted { lhs, rhs in
            if lhs.severity != rhs.severity { return lhs.severity > rhs.severity }
            return lhs.offset < rhs.offset
        }
    }
}
