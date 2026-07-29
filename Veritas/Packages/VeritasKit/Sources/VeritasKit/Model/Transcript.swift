import Foundation

/// Which of the two chairs a turn came from.
///
/// Veritas is deliberately two-sided. A referee that has to track five
/// speakers has to guess who is answering whom; with two sides, "did you
/// actually respond to that" is a question with a real answer.
public enum Side: String, Codable, Hashable, CaseIterable, Sendable {
    case a
    case b

    public var opposite: Side {
        self == .a ? .b : .a
    }

    /// Fallback label used when a participant has not been named.
    public var defaultName: String {
        self == .a ? "Person A" : "Person B"
    }

    public var letter: String {
        self == .a ? "A" : "B"
    }
}

/// A debater: a name, a side, and the position they agreed to defend.
public struct Participant: Codable, Hashable, Identifiable, Sendable {
    public var side: Side
    public var name: String
    /// One line describing the position this person is arguing, e.g.
    /// "Homework should be abolished below high school".
    public var position: String
    /// True when this seat is played by the built-in sparring partner.
    public var isMachine: Bool

    public var id: Side { side }

    public init(side: Side, name: String? = nil, position: String = "", isMachine: Bool = false) {
        self.side = side
        if let name, !name.trimmingCharacters(in: .whitespaces).isEmpty {
            self.name = name
        } else {
            self.name = side.defaultName
        }
        self.position = position
        self.isMachine = isMachine
    }
}

/// How the debate is run.
public struct DebateFormat: Codable, Hashable, Sendable {
    public enum Mode: String, Codable, Hashable, CaseIterable, Sendable {
        case text
        case voice

        public var title: String {
            self == .text ? "Text" : "Voice"
        }
    }

    /// Seconds allowed per turn. `nil` means untimed.
    public var secondsPerTurn: Int?
    /// How many turns each side gets. `nil` means until someone stops.
    public var turnsPerSide: Int?
    public var mode: Mode
    /// Which side opens.
    public var opener: Side

    public init(secondsPerTurn: Int? = 120, turnsPerSide: Int? = 3, mode: Mode = .text, opener: Side = .a) {
        self.secondsPerTurn = secondsPerTurn
        self.turnsPerSide = turnsPerSide
        self.mode = mode
        self.opener = opener
    }

    public static let threeMinutes = DebateFormat(secondsPerTurn: 60, turnsPerSide: 3)
    public static let fiveMinutes = DebateFormat(secondsPerTurn: 90, turnsPerSide: 3)
    public static let tenMinutes = DebateFormat(secondsPerTurn: 120, turnsPerSide: 4)
    public static let untimed = DebateFormat(secondsPerTurn: nil, turnsPerSide: nil)

    /// Total speaking time both sides get, in seconds, when the format is bounded.
    public var totalSeconds: Int? {
        guard let secondsPerTurn, let turnsPerSide else { return nil }
        return secondsPerTurn * turnsPerSide * 2
    }

    public var summary: String {
        let length: String
        if let secondsPerTurn, let turnsPerSide {
            let each = secondsPerTurn >= 60 ? "\(secondsPerTurn / 60)m" : "\(secondsPerTurn)s"
            length = "\(turnsPerSide) × \(each) per side"
        } else {
            length = "Untimed"
        }
        return "\(mode.title) · \(length)"
    }
}

/// One uninterrupted contribution by one side.
public struct Turn: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var side: Side
    public var text: String
    /// Position in the debate, starting at 0.
    public var index: Int
    /// Seconds from the start of the debate to the start of this turn.
    public var offset: TimeInterval
    /// How long the turn actually took.
    public var duration: TimeInterval

    public init(
        id: UUID = UUID(),
        side: Side,
        text: String,
        index: Int,
        offset: TimeInterval = 0,
        duration: TimeInterval = 0
    ) {
        self.id = id
        self.side = side
        self.text = text
        self.index = index
        self.offset = offset
        self.duration = duration
    }

    public var wordCount: Int {
        Tokenizer.words(in: text).count
    }
}

/// Everything that was said, plus the frame it was said in.
public struct Transcript: Codable, Hashable, Sendable {
    public var topic: String
    public var format: DebateFormat
    public var participants: [Participant]
    public var turns: [Turn]
    public var startedAt: Date
    public var finishedAt: Date?

    public init(
        topic: String,
        format: DebateFormat = DebateFormat(),
        participants: [Participant] = [Participant(side: .a), Participant(side: .b)],
        turns: [Turn] = [],
        startedAt: Date = Date(),
        finishedAt: Date? = nil
    ) {
        self.topic = topic
        self.format = format
        self.participants = participants
        self.turns = turns
        self.startedAt = startedAt
        self.finishedAt = finishedAt
    }

    public func participant(_ side: Side) -> Participant {
        participants.first(where: { $0.side == side }) ?? Participant(side: side)
    }

    public func name(of side: Side) -> String {
        participant(side).name
    }

    public func turns(by side: Side) -> [Turn] {
        turns.filter { $0.side == side }
    }

    public func turn(withID id: UUID) -> Turn? {
        turns.first(where: { $0.id == id })
    }

    public func wordCount(for side: Side) -> Int {
        turns(by: side).reduce(0) { $0 + $1.wordCount }
    }

    public var totalWordCount: Int {
        turns.reduce(0) { $0 + $1.wordCount }
    }

    public var speakingTime: TimeInterval {
        turns.reduce(0) { $0 + $1.duration }
    }

    /// Whether there is enough material for the report to mean anything.
    ///
    /// Under this bar Veritas still produces a report, but marks its
    /// confidence low rather than pretending a two-sentence exchange
    /// settled something.
    public var hasEnoughMaterial: Bool {
        turns.count >= 2
            && !turns(by: .a).isEmpty
            && !turns(by: .b).isEmpty
            && totalWordCount >= 40
    }

    /// Appends a turn, filling in its index automatically.
    public mutating func append(_ side: Side, text: String, duration: TimeInterval = 0) {
        let offset = turns.last.map { $0.offset + $0.duration } ?? 0
        turns.append(
            Turn(side: side, text: text, index: turns.count, offset: offset, duration: duration)
        )
    }
}
