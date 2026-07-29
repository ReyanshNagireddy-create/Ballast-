import Foundation

/// Names the reasoning faults in a debate.
///
/// The governing rule of this file, borrowed from every static analyzer
/// that people actually keep installed: **a false positive is a bug.** A
/// referee that flags "so you're saying the study was small" as a strawman
/// gets muted within one debate, and then it teaches nobody anything.
///
/// So every detector is a cue plus at least one guard, and every guard is
/// pinned by a negative test. Recall is the thing we are willing to lose.
public enum FallacyDetector {

    struct Detection {
        let fallacy: Fallacy
        /// The phrase that fired, shown to the user so the call is auditable.
        let trigger: String
    }

    struct Context {
        let turn: Turn
        let turnNormalized: String
        /// Whether the other side has already spoken, so this turn could be
        /// answering something.
        let isResponse: Bool
        /// Whether the opponent has actually put evidence on the table.
        /// Goalposts can only move once there is something to move them past.
        let opponentDeliveredEvidence: Bool
    }

    // MARK: - Entry point

    public static func findings(in transcript: Transcript, claims: [Claim]) -> [Finding] {
        var findings: [Finding] = []
        var deliveredEvidence: Set<Side> = []
        var hasHeardOpponent: Set<Side> = []

        for turn in transcript.turns.sorted(by: { $0.index < $1.index }) {
            let turnClaims = claims.filter { $0.turnID == turn.id }
            let context = Context(
                turn: turn,
                turnNormalized: Tokenizer.normalize(turn.text),
                isResponse: hasHeardOpponent.contains(turn.side),
                opponentDeliveredEvidence: deliveredEvidence.contains(turn.side.opposite)
            )

            // One finding per fallacy per turn. A single heated paragraph
            // should not produce six identical ad hominem cards.
            var alreadyFlagged: Set<Fallacy> = []
            for claim in turnClaims {
                for detection in detect(claim: claim, context: context) {
                    guard !alreadyFlagged.contains(detection.fallacy) else { continue }
                    alreadyFlagged.insert(detection.fallacy)
                    findings.append(finding(for: detection, claim: claim, turn: turn))
                }
            }

            if turnClaims.contains(where: { $0.verdict == .sourced || $0.verdict == .quantified }) {
                deliveredEvidence.insert(turn.side)
            }
            hasHeardOpponent.insert(turn.side.opposite)
        }
        return findings
    }

    private static func finding(for detection: Detection, claim: Claim, turn: Turn) -> Finding {
        let fallacy = detection.fallacy
        return Finding(
            kind: .fallacy,
            severity: fallacy.severity,
            side: claim.side,
            turnID: turn.id,
            claimID: claim.id,
            quote: Tokenizer.excerpt(claim.text),
            title: fallacy.title,
            detail: "Flagged on \u{201C}\(detection.trigger)\u{201D}. \(fallacy.why)",
            coaching: fallacy.coaching,
            fallacy: fallacy,
            offset: turn.offset
        )
    }

    static func detect(claim: Claim, context: Context) -> [Detection] {
        let text = Tokenizer.normalize(claim.text)
        var detections: [Detection] = []

        let checks: [(Claim, Context, String) -> Detection?] = [
            adHominem,
            strawman,
            falseDilemma,
            appealToEmotion,
            appealToAuthority,
            bandwagon,
            slipperySlope,
            circularReasoning,
            hastyGeneralization,
            anecdotalEvidence,
            appealToNature,
            appealToIgnorance,
            falseCause,
            whataboutism,
            movingGoalposts,
            loadedQuestion,
            noTrueScotsman,
            appealToTradition
        ]

        for check in checks {
            if let detection = check(claim, context, text) {
                detections.append(detection)
            }
        }
        return detections
    }

    // MARK: - Shared helpers

    private static func firstMatch(_ text: String, _ phrases: [String]) -> String? {
        for phrase in phrases where Tokenizer.contains(text, phrase: phrase) {
            return phrase
        }
        return nil
    }

    private static func has(_ text: String, _ phrase: String) -> Bool {
        Tokenizer.contains(text, phrase: phrase)
    }

    /// The word immediately following `phrase`, if `phrase` is present.
    private static func word(after phrase: String, in text: String) -> String? {
        guard let range = text.range(of: " " + phrase + " ") else { return nil }
        let remainder = text[range.upperBound...]
        let next = remainder.prefix(while: { $0 != " " })
        return next.isEmpty ? nil : String(next)
    }

    /// Words that mean the criticism is aimed at an argument rather than a person.
    private static let ideaReferents: [String] = [
        "argument", "arguments", "idea", "ideas", "claim", "claims", "point",
        "points", "position", "policy", "plan", "reasoning", "logic",
        "comparison", "analogy", "statistic", "statistics", "study", "premise",
        "assumption", "example", "framing", "definition"
    ]

    /// "any" and "anyone" are deliberately absent: "it doesn't have any
    /// effect" is a negated claim, not a claim about a whole population,
    /// and including them made the detector fire on ordinary sentences.
    private static let universalQuantifiers: [String] = [
        "all", "every", "always", "never", "none", "nobody", "no one",
        "everyone", "everybody", "every single"
    ]

    private static func universalQuantifier(in text: String) -> String? {
        firstMatch(text, universalQuantifiers)
    }

    // MARK: - Relevance

    /// Ad hominem — the attack lands on the speaker, not the claim.
    ///
    /// Guard: "your argument is stupid" is harsh but on topic, so an insult
    /// sitting next to an idea word is not flagged. Only the unambiguous
    /// person-directed forms and the dismissal phrases get through.
    private static let directAttacks: [String] = [
        "youre an idiot", "you are an idiot", "youre stupid", "you are stupid",
        "youre a moron", "you are a moron", "youre delusional", "you are delusional",
        "youre a liar", "you are a liar", "youre insane", "you are insane",
        "youre pathetic", "you are pathetic", "youre brainwashed",
        "you are brainwashed", "youre clueless", "youre ignorant",
        "youre being ridiculous", "what an idiot", "typical idiot"
    ]

    static func adHominem(claim: Claim, context: Context, text: String) -> Detection? {
        if let trigger = firstMatch(text, directAttacks) {
            return Detection(fallacy: .adHominem, trigger: trigger)
        }
        if let trigger = firstMatch(text, Lexicon.dismissals) {
            return Detection(fallacy: .adHominem, trigger: trigger)
        }

        guard let insult = firstMatch(text, Lexicon.insults) else { return nil }
        // The insult must be pointed at a person.
        let hasPersonReferent = Lexicon.personReferents.contains { has(text, $0) }
        guard hasPersonReferent else { return nil }
        // …and not at something the person said.
        guard firstMatch(text, ideaReferents) == nil else { return nil }
        return Detection(fallacy: .adHominem, trigger: insult)
    }

    /// Whataboutism — the reply points at the other side instead of answering.
    ///
    /// Guard: "what about the cost to families?" is a real question about
    /// the topic. It only counts as deflection when it points at the person
    /// or their side.
    private static let whataboutCues: [String] = ["what about", "how about", "what about when", "how about when"]
    private static let deflectionTargets: [String] = [
        "you", "your", "youre", "yours", "yourself", "your side", "your party",
        "they", "them", "their", "theirs", "your own", "you people"
    ]

    static func whataboutism(claim: Claim, context: Context, text: String) -> Detection? {
        guard context.isResponse else { return nil }
        if let trigger = firstMatch(text, ["but you also", "and yet you", "you did the same", "you do it too", "your side does"]) {
            return Detection(fallacy: .whataboutism, trigger: trigger)
        }
        guard let cue = firstMatch(text, whataboutCues) else { return nil }
        guard firstMatch(text, deflectionTargets) != nil else { return nil }
        return Detection(fallacy: .whataboutism, trigger: cue)
    }

    /// Appeal to emotion — feeling offered in place of a reason.
    ///
    /// Guard: emotion carried alongside evidence is good rhetoric, not a
    /// fallacy, so a sourced or quantified sentence is left alone.
    private static let emotionCues: [String] = [
        "think of the children", "how would you feel", "imagine if it were your",
        "its heartbreaking", "heartbreaking", "devastating", "tragic",
        "horrifying", "terrifying", "disgusting", "sickening", "monstrous",
        "you should be ashamed", "shame on you", "how can you sleep",
        "have you no", "it makes me sick"
    ]

    static func appealToEmotion(claim: Claim, context: Context, text: String) -> Detection? {
        guard !claim.signals.isSourced, !claim.signals.hasQuantity else { return nil }
        guard let trigger = firstMatch(text, emotionCues) else { return nil }
        return Detection(fallacy: .appealToEmotion, trigger: trigger)
    }

    /// Appeal to tradition — "we have always done it" offered as the reason.
    ///
    /// Guard: mentioning history is not the fallacy; using it as the
    /// justification is. Requires a reason-giving context.
    private static let traditionCues: [String] = [
        "weve always done it", "we have always done it", "thats how its always been",
        "thats how weve always", "the way its always been", "its tradition",
        "for centuries", "for generations", "our ancestors", "time honored",
        "time honoured", "its always worked"
    ]
    private static let justificationCues: [String] = [
        "because", "so we should", "thats why", "which is why", "therefore",
        "so it should", "no reason to change", "why change it", "so we keep"
    ]

    static func appealToTradition(claim: Claim, context: Context, text: String) -> Detection? {
        guard let trigger = firstMatch(text, traditionCues) else { return nil }
        let isJustifying = firstMatch(text, justificationCues) != nil || claim.kind == .normative
        guard isJustifying else { return nil }
        return Detection(fallacy: .appealToTradition, trigger: trigger)
    }

    // MARK: - Structure

    /// Strawman — the position being defeated is not the one on the table.
    ///
    /// Guard: "so you're saying the study was small?" is a clarifying
    /// question and must not fire. The exaggeration marker is required.
    /// Both contraction and long forms: normalization deletes apostrophes,
    /// so "you're" becomes "youre" but "you are" stays "you are". Missing
    /// the long form is the quietest way to ship a detector that never fires.
    private static let strawmanCues: [String] = [
        "so youre saying", "so you are saying", "so what youre saying is",
        "so what you are saying is", "so youre basically saying",
        "so you are basically saying", "youre basically saying",
        "you are basically saying", "what youre really saying",
        "what you are really saying", "so your position is",
        "so according to you", "so you want", "so you would", "you basically want",
        "youd rather", "you would rather", "so you think we should just",
        "so we should just"
    ]
    private static let exaggerationMarkers: [String] = [
        "everyone", "everybody", "all", "every", "no one", "nobody", "never",
        "abolish", "get rid of", "completely", "entirely", "literally",
        "destroy", "eliminate", "zero", "total", "always", "ban everything",
        "let anyone", "anything goes", "nothing at all"
    ]

    static func strawman(claim: Claim, context: Context, text: String) -> Detection? {
        guard context.isResponse else { return nil }
        guard let cue = firstMatch(text, strawmanCues) else { return nil }
        guard firstMatch(text, exaggerationMarkers) != nil else { return nil }
        return Detection(fallacy: .strawman, trigger: cue)
    }

    /// False dilemma — two doors presented as the only doors.
    ///
    /// Guard: "either way", "either of them" and friends are ordinary
    /// English and never fire.
    /// A bare "either … or" is not enough. "I don't think either party or
    /// the public wants this" is an ordinary sentence, so the cue has to be
    /// one of the framings that actually present a forced choice.
    private static let dilemmaCues: [String] = [
        "you either", "we either", "they either", "either you", "either we",
        "either they", "its either", "either its", "there are only two",
        "only two options", "only two choices", "only two ways",
        "youre either with", "with us or against us", "us or them",
        "theres no middle ground", "no middle ground", "no in between",
        "pick a side", "one or the other", "theres no third option",
        "if youre not with", "if youre not part of the solution"
    ]

    /// Cues that already contain the dichotomy and need no "or" to follow.
    private static let selfContainedDilemmas: Set<String> = Set(
        [
            "there are only two", "only two options", "only two choices",
            "only two ways", "theres no middle ground", "no middle ground",
            "no in between", "pick a side", "one or the other",
            "theres no third option", "with us or against us", "us or them"
        ]
    )

    static func falseDilemma(claim: Claim, context: Context, text: String) -> Detection? {
        guard let trigger = firstMatch(text, dilemmaCues) else { return nil }
        // An "either you…" opening still has to name the second door.
        guard selfContainedDilemmas.contains(trigger) || text.contains(" or ") else { return nil }
        return Detection(fallacy: .falseDilemma, trigger: trigger)
    }

    /// Slippery slope — a chain of consequences with no link defended.
    ///
    /// Guard: a documented progression ("according to the review, the 2011
    /// change led to…") is history, not speculation.
    private static let slopeCues: [String] = [
        "slippery slope", "next thing you know", "before you know it",
        "where does it end", "whats next", "it wont stop there",
        "opens the door to", "opens the floodgates", "the floodgates",
        "spiral out of control", "give an inch", "snowball"
    ]
    private static let slopePremises: [String] = [
        "if we allow", "if we let", "once we start", "if we open", "if you allow",
        "the moment we", "as soon as we"
    ]
    private static let slopeConsequences: [String] = [
        "soon", "eventually", "then", "next", "before long", "end up",
        "pretty soon", "within a few years"
    ]

    static func slipperySlope(claim: Claim, context: Context, text: String) -> Detection? {
        guard !claim.signals.isSourced else { return nil }
        if let trigger = firstMatch(text, slopeCues) {
            return Detection(fallacy: .slipperySlope, trigger: trigger)
        }
        guard let premise = firstMatch(text, slopePremises) else { return nil }
        guard firstMatch(text, slopeConsequences) != nil else { return nil }
        return Detection(fallacy: .slipperySlope, trigger: premise)
    }

    /// Circular reasoning — the reason restates the conclusion.
    ///
    /// Measured rather than pattern-matched: the content words on each side
    /// of "because" are compared, and only near-identity fires.
    static func circularReasoning(claim: Claim, context: Context, text: String) -> Detection? {
        for connector in [" because ", " since "] {
            guard let range = text.range(of: connector) else { continue }
            let left = String(text[text.startIndex..<range.lowerBound])
            let right = String(text[range.upperBound...])
            let leftWords = Tokenizer.contentWords(in: left)
            let rightWords = Tokenizer.contentWords(in: right)
            guard !leftWords.isEmpty, !rightWords.isEmpty else { continue }

            // Jaccard, not containment: "vaccines are safe because vaccines
            // have been tested" contains its left clause entirely inside its
            // right one and is a perfectly ordinary argument.
            if Tokenizer.jaccard(leftWords, rightWords) >= 0.7 {
                return Detection(
                    fallacy: .circularReasoning,
                    trigger: connector.trimmingCharacters(in: .whitespaces)
                )
            }
        }
        return nil
    }

    /// Moving the goalposts — the standard rises the moment it is met.
    ///
    /// Guard: this cannot happen before the opponent has actually put
    /// evidence on the table, so it needs the debate's history, not just
    /// the sentence.
    private static let goalpostCues: [String] = [
        "that doesnt count", "that doesnt really count", "thats not enough",
        "thats still not", "okay but thats different", "fine but thats different",
        "sure but thats different", "that doesnt prove anything",
        "one study isnt", "one study doesnt", "thats just one study",
        "thats just one", "youd need way more", "even so youd need",
        "thats not what i asked for"
    ]

    static func movingGoalposts(claim: Claim, context: Context, text: String) -> Detection? {
        guard context.isResponse, context.opponentDeliveredEvidence else { return nil }
        guard let trigger = firstMatch(text, goalpostCues) else { return nil }
        return Detection(fallacy: .movingGoalposts, trigger: trigger)
    }

    /// No true Scotsman — the category is redefined to exclude the counterexample.
    ///
    /// Guard: "no real evidence" and "no real difference" are ordinary
    /// English about quantities, not membership claims, so the noun that
    /// follows is checked.
    private static let scotsmanCues: [String] = [
        "no real", "no true", "not a real", "not a true", "any real", "isnt a real"
    ]
    private static let abstractNouns: Set<String> = Set(
        [
            "evidence", "difference", "reason", "change", "problem", "proof",
            "data", "need", "point", "chance", "way", "effect", "impact",
            "benefit", "harm", "risk", "alternative", "solution", "issue",
            "value", "cost", "threat", "danger", "basis", "answer", "world"
        ]
    )

    static func noTrueScotsman(claim: Claim, context: Context, text: String) -> Detection? {
        for cue in scotsmanCues {
            guard let next = word(after: cue, in: text) else { continue }
            guard !abstractNouns.contains(next) else { continue }
            return Detection(fallacy: .noTrueScotsman, trigger: "\(cue) \(next)")
        }
        return nil
    }

    // MARK: - Evidence

    /// Appeal to vague authority — confidence with nothing to look up.
    ///
    /// Guard: naming an institution defeats it. "WHO guidance says" is a
    /// citation; "experts say" is a mood.
    static func appealToAuthority(claim: Claim, context: Context, text: String) -> Detection? {
        guard claim.signals.sources.isEmpty, claim.signals.citations.isEmpty else { return nil }
        guard let trigger = firstMatch(text, Lexicon.vagueAuthorityCues) else { return nil }
        return Detection(fallacy: .appealToAuthority, trigger: trigger)
    }

    /// Bandwagon — popularity offered as proof.
    ///
    /// Guard: an actual measurement of popularity is evidence about
    /// popularity, so quantified or sourced sentences are left alone.
    private static let bandwagonCues: [String] = [
        "everyone knows", "everybody knows", "everyone agrees", "everybody agrees",
        "most people think", "most people agree", "most people know",
        "nobody believes", "no one believes", "its common sense", "common sense",
        "everyone is doing it", "the majority agrees", "public opinion is clear",
        "most of the country", "any reasonable person knows", "were all thinking it"
    ]

    static func bandwagon(claim: Claim, context: Context, text: String) -> Detection? {
        guard !claim.signals.isSourced, !claim.signals.hasQuantity else { return nil }
        guard let trigger = firstMatch(text, bandwagonCues) else { return nil }
        return Detection(fallacy: .bandwagon, trigger: trigger)
    }

    /// Hasty generalization — a universal built from nothing.
    ///
    /// Guards: values are exempt ("everyone deserves a fair hearing" is not
    /// a sampling error), measured claims are exempt, "not all" is the
    /// correction rather than the crime, and first-person habits
    /// ("I would never say that") are not claims about a population.
    private static let quantifierIdioms: [String] = [
        "all in all", "after all", "at all", "first of all", "all right",
        "in all", "all of the above", "not all", "not everyone", "not everybody",
        "all along", "all over", "all the same", "above all", "all but"
    ]
    private static let personalHabits: [String] = [
        "i would never", "i never", "i always", "i would always", "ive never",
        "ive always", "id never", "id always"
    ]

    static func hastyGeneralization(claim: Claim, context: Context, text: String) -> Detection? {
        switch claim.kind {
        case .empirical, .statistical, .causal, .predictive:
            break
        case .normative, .definitional, .anecdotal, .rhetorical:
            return nil
        }
        guard claim.keywords.count >= 3 else { return nil }
        guard !claim.signals.isSourced, !claim.signals.hasQuantity else { return nil }
        guard firstMatch(text, quantifierIdioms) == nil else { return nil }
        guard firstMatch(text, personalHabits) == nil else { return nil }
        guard let quantifier = universalQuantifier(in: text) else { return nil }
        return Detection(fallacy: .hastyGeneralization, trigger: quantifier)
    }

    /// Anecdote as evidence — one story standing in for a rate.
    ///
    /// Guard: telling a story is fine. It only becomes this fallacy when
    /// the same turn generalises from it.
    private static let generalizationCues: [String] = [
        "everyone", "everybody", "most people", "all of them", "always",
        "never", "thats how it works", "thats how it is", "proves",
        "which shows", "so obviously", "that tells you", "typical",
        "they all", "people just"
    ]

    static func anecdotalEvidence(claim: Claim, context: Context, text: String) -> Detection? {
        guard claim.kind == .anecdotal else { return nil }
        guard let trigger = firstMatch(context.turnNormalized, generalizationCues) else { return nil }
        return Detection(fallacy: .anecdotalEvidence, trigger: trigger)
    }

    /// Appeal to ignorance — absence of disproof taken as proof.
    private static let ignoranceCues: [String] = [
        "no one has proven", "nobody has proven", "no one has ever shown",
        "theres no evidence that it isnt", "theres no proof it doesnt",
        "you cant prove it doesnt", "you cant prove that it isnt",
        "hasnt been disproven", "has not been disproven", "until someone proves",
        "prove me wrong", "prove that im wrong", "nobody can show otherwise"
    ]

    static func appealToIgnorance(claim: Claim, context: Context, text: String) -> Detection? {
        guard let trigger = firstMatch(text, ignoranceCues) else { return nil }
        return Detection(fallacy: .appealToIgnorance, trigger: trigger)
    }

    /// False cause — a sequence read as a mechanism.
    ///
    /// Guards: someone correctly *warning* about correlation is not
    /// committing the fallacy, and a controlled study is exactly the thing
    /// that licenses the causal step.
    private static let sequenceCues: [String] = [
        "ever since", "right after", "the year after", "immediately after",
        "as soon as they", "the moment they", "no coincidence", "not a coincidence"
    ]
    private static let causalConclusions: [String] = [
        "thats why", "which is why", "proves", "proof that", "shows that",
        "caused", "causes", "led to", "because of that", "so it must be"
    ]
    private static let correlationAwareness: [String] = [
        "correlation is not causation", "correlation doesnt", "correlation does not",
        "not causation", "confounding", "confounder", "controlled for",
        "controlling for", "randomized", "randomised", "controlled trial",
        "third factor", "reverse causation"
    ]

    static func falseCause(claim: Claim, context: Context, text: String) -> Detection? {
        guard firstMatch(text, correlationAwareness) == nil else { return nil }
        guard let sequence = firstMatch(text, sequenceCues) else { return nil }
        if sequence == "no coincidence" || sequence == "not a coincidence" {
            return Detection(fallacy: .falseCause, trigger: sequence)
        }
        guard firstMatch(text, causalConclusions) != nil || firstMatch(text, Lexicon.causalMarkers) != nil else {
            return nil
        }
        return Detection(fallacy: .falseCause, trigger: sequence)
    }

    // MARK: - Language

    /// Appeal to nature — "natural" doing work it cannot do.
    ///
    /// Guard: needs to be functioning as a reason, not just a description
    /// of something as natural.
    private static let natureCues: [String] = [
        "unnatural", "against nature", "not natural", "its natural",
        "natural is better", "the way nature intended", "mother nature",
        "full of chemicals", "chemicals in it", "man made chemicals",
        "artificial ingredients", "organic is safer"
    ]

    static func appealToNature(claim: Claim, context: Context, text: String) -> Detection? {
        guard let trigger = firstMatch(text, natureCues) else { return nil }
        let isJustifying = firstMatch(text, justificationCues) != nil || claim.kind == .normative
        guard isJustifying else { return nil }
        return Detection(fallacy: .appealToNature, trigger: trigger)
    }

    /// Loaded question — the assumption rides in on the phrasing.
    private static let loadedQuestionCues: [String] = [
        "why do you hate", "why are you so", "why do you always",
        "when will you admit", "how can you defend", "why do you keep",
        "do you really believe", "have you stopped", "why cant you just admit",
        "what makes you think you", "why would anyone", "how do you justify"
    ]

    static func loadedQuestion(claim: Claim, context: Context, text: String) -> Detection? {
        guard claim.text.hasSuffix("?") else { return nil }
        guard let trigger = firstMatch(text, loadedQuestionCues) else { return nil }
        return Detection(fallacy: .loadedQuestion, trigger: trigger)
    }
}
