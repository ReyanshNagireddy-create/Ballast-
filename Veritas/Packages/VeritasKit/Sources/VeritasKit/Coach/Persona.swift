import Foundation

/// Who you are practising against.
///
/// A persona is a *lens*, not a costume. The economist does not say
/// "as an economist"; it asks what the trade-off costs and who pays it.
/// The point of practising against several is that each one attacks a
/// different weakness in the same argument.
public enum Persona: String, Codable, Hashable, CaseIterable, Identifiable, Sendable {
    case scientist
    case lawyer
    case historian
    case economist
    case politician
    case philosopher
    case teacher

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .scientist: return "Scientist"
        case .lawyer: return "Lawyer"
        case .historian: return "Historian"
        case .economist: return "Economist"
        case .politician: return "Politician"
        case .philosopher: return "Philosopher"
        case .teacher: return "Teacher"
        }
    }

    public var symbol: String {
        switch self {
        case .scientist: return "atom"
        case .lawyer: return "scalemass"
        case .historian: return "book.closed"
        case .economist: return "chart.line.uptrend.xyaxis"
        case .politician: return "megaphone"
        case .philosopher: return "brain"
        case .teacher: return "graduationcap"
        }
    }

    /// One line describing what this opponent will come after.
    public var blurb: String {
        switch self {
        case .scientist:
            return "Wants a mechanism and a measurement. Will ask how you would know if you were wrong."
        case .lawyer:
            return "Argues burden of proof and definitions. Will hold you to the exact words you used."
        case .historian:
            return "Asks whether this has been tried before, and what happened when it was."
        case .economist:
            return "Everything is a trade-off. Will ask what it costs and who pays."
        case .politician:
            return "Fights on framing and coalitions. The one most likely to try something on you."
        case .philosopher:
            return "Goes after your premises and where your principle leads if applied consistently."
        case .teacher:
            return "Gentle, relentless, and will make you define your terms. Good place to start."
        }
    }

    /// How this persona attacks a claim it does not accept.
    var challenges: [String] {
        switch self {
        case .scientist:
            return [
                "What would we expect to observe if that were false? If the answer is nothing, it is not doing any work.",
                "That is a correlation dressed as a mechanism. What is the pathway, and what rules out the obvious third factor?",
                "Sample and setting matter here. Who was measured, and does the result survive outside the room it was measured in?"
            ]
        case .lawyer:
            return [
                "You are the one asserting it, so the burden sits with you — I do not have to prove the opposite.",
                "That turns on a word you have not defined, and the whole claim changes depending on how you define it.",
                "You have shown that it can happen. You have not shown that it does happen, and those are different cases."
            ]
        case .historian:
            return [
                "This has been tried. The relevant question is not whether it sounds right but what happened last time.",
                "You are treating the current arrangement as the natural state of things. It is roughly a century old.",
                "The precedent you are leaning on had conditions attached to it that do not hold here."
            ]
        case .economist:
            return [
                "Compared to what? A policy is not good or bad in isolation, only against the alternative you are not naming.",
                "You have described the benefit and skipped the cost. Someone pays it — who?",
                "People respond to incentives. What happens on the second move, after everyone adjusts to the first?"
            ]
        case .politician:
            return [
                "That polls well and does nothing. Which part of it actually survives contact with a legislature?",
                "You are arguing the ideal case. I am asking who implements it and what they do with the discretion.",
                "Everyone agrees with the principle. The fight is over the exception, and you have not said where you would put it."
            ]
        case .philosopher:
            return [
                "Apply that principle consistently and it produces a conclusion I suspect you would reject. Would you accept it?",
                "That is a claim about what is. You need a further premise to get to what ought to be, and it is missing.",
                "You have smuggled the conclusion into the definition. Take it back out and the argument still has to be made."
            ]
        case .teacher:
            return [
                "Say what you mean by that term, because I think we are each using it differently.",
                "Walk me through the step in the middle. You went from the evidence to the conclusion very quickly.",
                "What is the strongest argument against your own position? If you cannot state it, you may not have met it yet."
            ]
        }
    }

    /// Positive arguments this persona advances. `{term}` is replaced with a
    /// word from the topic so the line lands on the actual subject.
    var advances: [String] {
        switch self {
        case .scientist:
            return [
                "The honest position on {term} is that the effect size is small and the confidence intervals are wide, which is not the same as no effect — and it is definitely not the same as the effect you need.",
                "Before we argue about {term}, we should agree what measurement would settle it. If neither of us can name one, we are not having a factual disagreement."
            ]
        case .lawyer:
            return [
                "The standard I would hold {term} to is the one you would want applied to the case you dislike. Standards you only apply to opponents are not standards.",
                "Notice what has actually been established about {term}, and what has only been asserted loudly. Those are two different columns."
            ]
        case .historian:
            return [
                "Each generation tends to believe its argument about {term} is unprecedented. The archives are unkind to that belief, and reading them is cheaper than repeating the experiment.",
                "The change you are describing around {term} did not come from the mechanism you are crediting. It came earlier, and from something less flattering."
            ]
        case .economist:
            return [
                "The cost of {term} does not disappear when you stop measuring it. It moves — usually onto whoever has the least ability to refuse it.",
                "There is no solution to {term}, only a trade you are willing to make. Name the trade and we can compare it against mine."
            ]
        case .politician:
            return [
                "A position on {term} that cannot survive one hostile news cycle is not a position, it is a preference.",
                "You can be right about {term} and still lose, and a plan that ignores that is a plan for being right in private."
            ]
        case .philosopher:
            return [
                "The disagreement about {term} is not factual. It is about which value we are willing to sacrifice, and pretending otherwise wastes both our time.",
                "If your argument about {term} works, it works for cases you have not considered. That is either a strength or a fatal generalisation, and you have to say which."
            ]
        case .teacher:
            return [
                "Here is what I think your best argument about {term} is — stronger than the one you made. Now: can you defend it?",
                "The interesting question is not whether {term} is good or bad, but what evidence would change your mind. Start there and the rest gets easier."
            ]
        }
    }

    /// Closing demands — the questions that force the next turn to be specific.
    var demands: [String] {
        switch self {
        case .scientist: return ["What evidence would change your mind?", "How would you measure that?"]
        case .lawyer: return ["Define the term and I will meet you on it.", "What is your actual standard of proof here?"]
        case .historian: return ["When has that worked before?", "What is the closest precedent, and how did it end?"]
        case .economist: return ["What does it cost, and who pays?", "Compared to which alternative?"]
        case .politician: return ["Who implements this, and what stops them abusing it?", "Where do you put the exception?"]
        case .philosopher: return ["Would you accept that conclusion in the hard case?", "Which premise are you defending?"]
        case .teacher: return ["Can you state my position better than I did?", "Which part of your own argument is weakest?"]
        }
    }
}

/// How hard the sparring partner plays.
public enum Difficulty: String, Codable, Hashable, CaseIterable, Identifiable, Sendable {
    case easy
    case medium
    case hard
    case expert

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .easy: return "Easy"
        case .medium: return "Medium"
        case .hard: return "Hard"
        case .expert: return "Expert"
        }
    }

    /// What actually changes, said plainly.
    public var blurb: String {
        switch self {
        case .easy:
            return "Argues loosely and plants an obvious fallacy in most turns. Your job is to catch it."
        case .medium:
            return "Plants subtler fallacies — slippery slopes, forced choices — and defends them if you let it."
        case .hard:
            return "Clean reasoning. Concedes what it must, and demands specifics for everything else."
        case .expert:
            return "Attacks your strongest point rather than your weakest, and steelmans you before answering."
        }
    }

    /// Whether the partner deliberately commits a fallacy for you to find.
    var plantsFallacies: Bool {
        self == .easy || self == .medium
    }

    /// The bait it plants, in rough order of subtlety.
    var plantedLines: [String] {
        switch self {
        // Each line here must be catchable by `FallacyDetector`, otherwise
        // the teaching loop breaks: the learner spots the bait, checks the
        // report, and finds nothing. `SparringPartnerTests` pins this.
        case .easy:
            return [
                "Everyone knows that already, so I am not sure why we are arguing about it.",
                "Experts agree with me on this one, so the burden is really on you.",
                "Most people agree with that, and most people are not completely stupid."
            ]
        case .medium:
            return [
                "Once we start allowing that, there is no principled place to stop, and before you know it the whole thing goes.",
                "So either we accept your position entirely, or we keep exactly what we have.",
                "We have always done it this way, and that is not nothing, so we should keep it."
            ]
        case .hard, .expert:
            return []
        }
    }
}
