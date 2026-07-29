import Foundation

/// What a model concluded about one factual claim.
public struct ClaimAssessment: Codable, Hashable, Identifiable, Sendable {
    public enum Outcome: String, Codable, Hashable, Sendable {
        case supported
        case contradicted
        case mixed
        case unverifiable

        public var title: String {
            switch self {
            case .supported: return "Supported by current evidence"
            case .contradicted: return "Contradicted by current evidence"
            case .mixed: return "Partly true — context missing"
            case .unverifiable: return "Could not be verified"
            }
        }

        var severity: Severity {
            switch self {
            case .supported: return .info
            case .contradicted: return .major
            case .mixed: return .warning
            case .unverifiable: return .notice
            }
        }
    }

    public var id: UUID { claimID }
    public var claimID: UUID
    public var outcome: Outcome
    public var note: String
    public var sources: [String]

    public init(claimID: UUID, outcome: Outcome, note: String, sources: [String] = []) {
        self.claimID = claimID
        self.outcome = outcome
        self.note = note
        self.sources = sources
    }
}

/// Adds real fact-checking on top of the offline engine.
///
/// The division of labour is deliberate and worth stating plainly, because
/// it is what keeps the product honest:
///
/// - The **offline engine owns the scores.** They are deterministic and
///   reproducible, and anyone can re-derive them from the transcript.
/// - The **model owns verification.** It can reach sources; the offline
///   engine cannot, and says so rather than guessing.
///
/// Model output is therefore additive — it appends findings and annotates
/// claims. It never silently moves a number, so nobody has to wonder
/// whether a score changed because the argument changed or because the
/// weather in a datacenter did.
public struct ModelAugmentedReferee: Sendable {

    public var model: LanguageModel
    /// How many claims to send in one request.
    public var maximumClaims: Int

    public init(model: LanguageModel, maximumClaims: Int = 12) {
        self.model = model
        self.maximumClaims = maximumClaims
    }

    public func analyze(_ transcript: Transcript) async -> DebateReport {
        let offline = Referee.analyze(transcript)
        let checkable = offline.claims
            .filter { $0.kind.isCheckable && $0.verdict != .notApplicable && $0.isSubstantive }
            .prefix(maximumClaims)

        guard !checkable.isEmpty else { return offline }

        do {
            let assessments = try await assess(claims: Array(checkable), topic: transcript.topic)
            return merge(assessments: assessments, into: offline)
        } catch {
            var degraded = offline
            degraded.caveats.append(
                "Live fact-checking was unavailable for this report (\(error.localizedDescription)) — the offline engine ran on its own, so claims are marked supported or unsupported, never true or false."
            )
            return degraded
        }
    }

    // MARK: - Verification

    public func assess(claims: [Claim], topic: String) async throws -> [ClaimAssessment] {
        let system = """
        You are the fact-checking stage of a debate referee. You are given numbered claims \
        taken from a live debate. For each one, judge only whether current, mainstream \
        evidence supports it.

        Rules:
        - Judge the claim, never the person, and never who "won".
        - If a claim is a value judgement, a prediction, or a matter of definition, \
        return "unverifiable" and say why in one sentence — do not grade values as false.
        - Only name sources you are confident actually exist. If you cannot name one, \
        return an empty sources array. Never invent a study, an author, or a statistic.
        - Prefer "mixed" when a claim is true only under conditions the speaker left out.

        Reply with JSON only: an array of objects with keys "index" (integer), \
        "outcome" (one of "supported", "contradicted", "mixed", "unverifiable"), \
        "note" (one or two sentences), and "sources" (array of short strings).
        """

        var lines: [String] = ["Debate topic: \(topic)", "", "Claims:"]
        for (index, claim) in claims.enumerated() {
            lines.append("\(index). \(claim.text)")
        }

        let text = try await model.complete(
            system: system,
            messages: [LanguageModelMessage(role: .user, content: lines.joined(separator: "\n"))],
            maxTokens: 1500
        )

        return decode(text, claims: claims)
    }

    /// Defensive JSON extraction — models sometimes wrap JSON in prose or a
    /// code fence, and a report should not be lost to a stray backtick.
    func decode(_ text: String, claims: [Claim]) -> [ClaimAssessment] {
        guard let start = text.firstIndex(of: "["), let end = text.lastIndex(of: "]"), start < end else {
            return []
        }
        let json = String(text[start...end])
        guard let data = json.data(using: .utf8) else { return [] }

        struct Row: Decodable {
            let index: Int
            let outcome: String
            let note: String
            let sources: [String]?
        }

        guard let rows = try? JSONDecoder().decode([Row].self, from: data) else { return [] }

        return rows.compactMap { row in
            guard row.index >= 0, row.index < claims.count else { return nil }
            guard let outcome = ClaimAssessment.Outcome(rawValue: row.outcome.lowercased()) else { return nil }
            return ClaimAssessment(
                claimID: claims[row.index].id,
                outcome: outcome,
                note: row.note,
                sources: row.sources ?? []
            )
        }
    }

    /// Every negative finding in a Veritas report carries a next step. A
    /// verdict with no coaching attached is just a scoreboard.
    private func coaching(for outcome: ClaimAssessment.Outcome) -> String {
        switch outcome {
        case .supported:
            return ""
        case .contradicted:
            return "Check this before you use it again — a claim the other side can look up and disprove costs you every other point you made."
        case .mixed:
            return "Add the condition the claim depends on. \u{201C}In the trials that ran longer than a year\u{201D} is a smaller claim and a much harder one to knock down."
        case .unverifiable:
            return "Nothing settles this from the outside, so say what would. If you cannot name the evidence, argue it as a judgement rather than a fact."
        }
    }

    func merge(assessments: [ClaimAssessment], into report: DebateReport) -> DebateReport {
        var updated = report
        var extra: [Finding] = []

        for assessment in assessments {
            guard let claim = report.claims.first(where: { $0.id == assessment.claimID }) else { continue }
            let turn = report.transcript.turn(withID: claim.turnID)
            let sourceLine = assessment.sources.isEmpty
                ? ""
                : " Sources: \(assessment.sources.joined(separator: "; "))."

            extra.append(
                Finding(
                    kind: assessment.outcome == .supported ? .strongEvidence : .unsupportedClaim,
                    severity: assessment.outcome.severity,
                    side: claim.side,
                    turnID: claim.turnID,
                    claimID: claim.id,
                    quote: Tokenizer.excerpt(claim.text),
                    title: assessment.outcome.title,
                    detail: assessment.note + sourceLine,
                    coaching: coaching(for: assessment.outcome),
                    offset: turn?.offset ?? 0
                )
            )
        }

        updated.findings.append(contentsOf: extra)
        for index in updated.speakers.indices {
            let side = updated.speakers[index].side
            updated.speakers[index].findings = updated.findings.forSide(side).ranked
        }
        updated.caveats.append(
            "Fact-checking on \(assessments.count) claim\(assessments.count == 1 ? "" : "s") came from a language model with web knowledge. The six scores above are unchanged by it — they are computed offline and are reproducible from the transcript alone."
        )
        return updated
    }
}

/// The practice opponent, backed by a real model, with the offline
/// `SparringPartner` as its floor.
public struct ModelBackedPartner: Sendable {

    public var model: LanguageModel
    public var fallback: SparringPartner

    public init(model: LanguageModel, fallback: SparringPartner) {
        self.model = model
        self.fallback = fallback
    }

    public var displayName: String { fallback.displayName }

    public func opening() async -> String {
        await respond(history: [], transcript: nil, side: .b)
    }

    public func reply(to transcript: Transcript, as side: Side) async -> String {
        let history = transcript.turns.map { turn in
            LanguageModelMessage(
                role: turn.side == side ? .assistant : .user,
                content: turn.text
            )
        }
        return await respond(history: history, transcript: transcript, side: side)
    }

    private func respond(history: [LanguageModelMessage], transcript: Transcript?, side: Side) async -> String {
        let messages = history.isEmpty
            ? [LanguageModelMessage(role: .user, content: "Open the debate.")]
            : history

        do {
            let text = try await model.complete(
                system: systemPrompt(),
                messages: messages,
                maxTokens: 500
            )
            return text
        } catch {
            guard let transcript else { return fallback.opening() }
            return fallback.reply(to: transcript, as: side)
        }
    }

    private func systemPrompt() -> String {
        let persona = fallback.persona
        let difficulty = fallback.difficulty

        var prompt = """
        You are a debate sparring partner in a practice app. Topic: \(fallback.topic).
        You are arguing: \(fallback.position.isEmpty ? "the opposing side" : fallback.position).

        Your lens: \(persona.blurb)
        Difficulty: \(difficulty.title). \(difficulty.blurb)

        Hard rules:
        - Never invent a statistic, study, author, or date. If you cannot name a real \
        source you are confident about, argue structurally instead — go after support, \
        definitions, trade-offs and consistency.
        - Answer what your opponent actually said before advancing your own point. \
        Quote a few of their words so it is clear what you are responding to.
        - Concede anything you cannot answer, explicitly.
        - Keep it to three or four sentences. Speak like a person, not an essay.
        """

        if difficulty.plantsFallacies {
            prompt += """

            - This difficulty is a teaching mode: include exactly one clear logical \
            fallacy per turn for the learner to catch. Do not label it or hint at it.
            """
        } else {
            prompt += """

            - Reason cleanly. No fallacies, no rhetorical tricks. Attack the strongest \
            version of their argument, not the weakest.
            """
        }
        return prompt
    }
}
