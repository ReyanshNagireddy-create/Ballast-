import Foundation

/// The offline practice opponent.
///
/// **It never invents evidence.** Not one statistic, not one study, not one
/// date — check `opening()` and `reply(to:as:)` and you will not find a
/// digit in anything it writes. A practice partner that fabricates numbers
/// teaches the single worst habit this product exists to break, and "it was
/// only practice" is not a defence when the number ends up in someone's
/// essay.
///
/// What it does instead is argue *structurally*: it goes after your support,
/// your definitions, your trade-offs and your consistency, and at the lower
/// difficulties it plants a fallacy in each turn for you to catch. When an
/// API key is configured, `ModelBackedPartner` takes over and can bring real
/// sources; this is the floor, and the floor is honest.
public struct SparringPartner: Sendable {

    public var persona: Persona
    public var difficulty: Difficulty
    public var topic: String
    /// The position this partner is defending, in the debater's own words.
    public var position: String

    public init(persona: Persona, difficulty: Difficulty, topic: String, position: String = "") {
        self.persona = persona
        self.difficulty = difficulty
        self.topic = topic
        self.position = position
    }

    public var displayName: String {
        "\(persona.title) (AI)"
    }

    // MARK: - Turns

    public func opening() -> String {
        let term = topicTerm()
        var parts: [String] = []
        parts.append(openingFrame())
        if let advance = pick(persona.advances, seed: seed(0)) {
            parts.append(advance.replacingOccurrences(of: "{term}", with: term))
        }
        if let demand = pick(persona.demands, seed: seed(1)) {
            parts.append(demand)
        }
        return parts.joined(separator: " ")
    }

    /// Answers whatever the human said last.
    public func reply(to transcript: Transcript, as side: Side) -> String {
        let opponent = side.opposite
        guard let lastTurn = transcript.turns(by: opponent).last else {
            return opening()
        }

        let turnIndex = transcript.turns.count
        let claims = ClaimExtractor.claims(in: lastTurn)
        let target = selectTarget(from: claims)
        let term = topicTerm()

        var parts: [String] = []

        if difficulty == .expert, let target {
            parts.append(steelman(target))
        }

        if let target {
            parts.append(engagement(with: target))
        } else {
            parts.append("There is not a claim in that I can take hold of yet, so let me put one up and you can come at it.")
        }

        if let challenge = pick(persona.challenges, seed: seed(turnIndex)) {
            parts.append(challenge)
        }
        if let advance = pick(persona.advances, seed: seed(turnIndex + 7)) {
            parts.append(advance.replacingOccurrences(of: "{term}", with: term))
        }
        if difficulty.plantsFallacies, let planted = pick(difficulty.plantedLines, seed: seed(turnIndex + 13)) {
            parts.append(planted)
        }
        if difficulty == .hard || difficulty == .expert {
            parts.append(concession(for: target))
        }
        if let demand = pick(persona.demands, seed: seed(turnIndex + 3)) {
            parts.append(demand)
        }

        return parts.joined(separator: " ")
    }

    // MARK: - Pieces

    private func openingFrame() -> String {
        let stated = position.trimmingCharacters(in: .whitespacesAndNewlines)
        if stated.isEmpty {
            return "I will be arguing the other side of this, and I would rather do it properly than easily."
        }
        return "I am arguing that \(stated), and I would rather lose to a good argument than win against a weak one."
    }

    /// Which of the opponent's claims to go after.
    ///
    /// Expert deliberately attacks the *strongest* claim — beating the weakest
    /// one teaches nothing, and it is the habit that loses real debates.
    func selectTarget(from claims: [Claim]) -> Claim? {
        let substantive = claims.filter(\.isSubstantive)
        guard !substantive.isEmpty else { return claims.first }

        if difficulty == .expert {
            return substantive.max { lhs, rhs in
                strength(of: lhs) < strength(of: rhs)
            }
        }
        return substantive.max { lhs, rhs in
            weakness(of: lhs) < weakness(of: rhs)
        }
    }

    private func strength(of claim: Claim) -> Int {
        switch claim.verdict {
        case .sourced: return 4
        case .quantified: return 3
        case .hedged: return 1
        case .unsupported: return 2
        case .notApplicable: return 0
        }
    }

    private func weakness(of claim: Claim) -> Int {
        switch claim.verdict {
        case .unsupported: return 4 + claim.signals.absolutes.count
        case .hedged: return 2
        case .quantified: return 1
        case .sourced: return 0
        case .notApplicable: return 1
        }
    }

    private func engagement(with claim: Claim) -> String {
        let quote = Tokenizer.excerpt(claim.text, limit: 110)
        switch claim.verdict {
        case .unsupported:
            return "You said \u{201C}\(quote)\u{201D} — that is the sentence I want a source for, because it is carrying the most weight in your case and has the least behind it."
        case .quantified:
            return "You said \u{201C}\(quote)\u{201D}. I will take the figure at face value for now; what I do not accept is the step from the figure to your conclusion."
        case .sourced:
            return "You said \u{201C}\(quote)\u{201D}, and you attributed it, which I will credit. It still does not get you where you need to go."
        case .hedged:
            return "You said \u{201C}\(quote)\u{201D} — hedged so carefully that it does not commit to anything. Give me the firm version and I will argue with that."
        case .notApplicable:
            return "You said \u{201C}\(quote)\u{201D}. That is a judgement about what matters rather than a fact, so no source settles it — which means we should argue the value directly instead of pretending it is a data dispute."
        }
    }

    private func steelman(_ claim: Claim) -> String {
        let quote = Tokenizer.excerpt(claim.text, limit: 90)
        return "The strongest version of your position is the one behind \u{201C}\(quote)\u{201D}, and I want to answer that rather than the easier thing you also said."
    }

    private func concession(for claim: Claim?) -> String {
        guard let claim else {
            return "I will grant that the intuition behind your position is a reasonable one — that is why it is worth arguing about."
        }
        switch claim.verdict {
        case .sourced, .quantified:
            return "I will concede that point outright; it is the strongest thing you have said and I am not going to pretend otherwise."
        case .unsupported, .hedged, .notApplicable:
            return "I will grant you the underlying concern. My disagreement is with the step you take from it, not with the concern itself."
        }
    }

    // MARK: - Deterministic choice

    /// The word from the topic worth naming. Longest content word wins —
    /// crude, stable, and good enough to keep the line on topic.
    func topicTerm() -> String {
        let words = Tokenizer.contentWords(in: topic)
        guard let longest = words.max(by: { $0.count < $1.count }) else { return "this" }
        return longest
    }

    /// Process-stable hash. `String.hashValue` is seeded per launch, which
    /// would make the partner unrepeatable and the tests flaky.
    static func stableHash(_ text: String) -> Int {
        var value = 5381
        for scalar in text.unicodeScalars {
            value = (value &* 33 &+ Int(scalar.value)) % 1_000_003
        }
        return value
    }

    private func seed(_ salt: Int) -> Int {
        SparringPartner.stableHash(topic + persona.rawValue + difficulty.rawValue) &+ salt
    }

    private func pick<T>(_ options: [T], seed: Int) -> T? {
        guard !options.isEmpty else { return nil }
        let count = options.count
        let index = ((seed % count) + count) % count
        return options[index]
    }
}
