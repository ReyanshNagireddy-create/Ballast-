import Foundation

/// The reasoning faults Veritas knows how to name.
///
/// Every case carries four things: what it is called, what it means, *why*
/// it breaks the argument, and what to say instead. Naming a fallacy and
/// walking away is a party trick; the coaching line is the product.
public enum Fallacy: String, Codable, Hashable, CaseIterable, Sendable {
    case adHominem
    case strawman
    case falseDilemma
    case appealToEmotion
    case appealToAuthority
    case bandwagon
    case slipperySlope
    case circularReasoning
    case hastyGeneralization
    case anecdotalEvidence
    case appealToNature
    case appealToIgnorance
    case falseCause
    case whataboutism
    case movingGoalposts
    case loadedQuestion
    case noTrueScotsman
    case appealToTradition

    public var title: String {
        switch self {
        case .adHominem: return "Ad hominem"
        case .strawman: return "Strawman"
        case .falseDilemma: return "False dilemma"
        case .appealToEmotion: return "Appeal to emotion"
        case .appealToAuthority: return "Appeal to vague authority"
        case .bandwagon: return "Bandwagon"
        case .slipperySlope: return "Slippery slope"
        case .circularReasoning: return "Circular reasoning"
        case .hastyGeneralization: return "Hasty generalization"
        case .anecdotalEvidence: return "Anecdote as evidence"
        case .appealToNature: return "Appeal to nature"
        case .appealToIgnorance: return "Appeal to ignorance"
        case .falseCause: return "False cause"
        case .whataboutism: return "Whataboutism"
        case .movingGoalposts: return "Moving the goalposts"
        case .loadedQuestion: return "Loaded question"
        case .noTrueScotsman: return "No true Scotsman"
        case .appealToTradition: return "Appeal to tradition"
        }
    }

    /// What the move is, in one sentence.
    public var definition: String {
        switch self {
        case .adHominem:
            return "Attacking the person making the argument instead of the argument."
        case .strawman:
            return "Restating the other side's position in an exaggerated form, then defeating that."
        case .falseDilemma:
            return "Presenting two options as the only options when others exist."
        case .appealToEmotion:
            return "Substituting an emotional reaction for a reason."
        case .appealToAuthority:
            return "Citing unnamed authority — \"experts say\" — with no source anyone can check."
        case .bandwagon:
            return "Treating popularity as proof."
        case .slipperySlope:
            return "Asserting a chain of consequences without defending any link in it."
        case .circularReasoning:
            return "Offering the conclusion again as the reason for the conclusion."
        case .hastyGeneralization:
            return "Drawing a universal rule from too few cases."
        case .anecdotalEvidence:
            return "Generalising from one story to a population."
        case .appealToNature:
            return "Treating \"natural\" as a synonym for \"good\" and \"unnatural\" for \"bad\"."
        case .appealToIgnorance:
            return "Taking the absence of disproof as proof."
        case .falseCause:
            return "Reading a sequence as a cause."
        case .whataboutism:
            return "Answering a charge by pointing at a different one."
        case .movingGoalposts:
            return "Dismissing evidence that meets the standard you just set, and raising the standard."
        case .loadedQuestion:
            return "Asking a question whose phrasing smuggles in an unproven assumption."
        case .noTrueScotsman:
            return "Redefining a group to exclude the counterexample."
        case .appealToTradition:
            return "Treating \"we have always done it\" as a reason to keep doing it."
        }
    }

    /// The mechanism — why the argument actually fails, not just what it is called.
    public var why: String {
        switch self {
        case .adHominem:
            return "The truth of a claim does not depend on who says it. Even if every insult landed, the claim would be exactly as true or false as before — so nothing has been answered."
        case .strawman:
            return "The position you defeated is not the one on the table. Your opponent's actual argument is still standing, untouched, and everyone watching can see it."
        case .falseDilemma:
            return "Collapsing a spectrum into two boxes hides the option that usually wins: some of both, or something neither of you named. The argument only works while nobody looks for a third door."
        case .appealToEmotion:
            return "Feeling strongly about a conclusion is not evidence for it. Both sides of nearly every serious question have people who are genuinely afraid — so fear cannot be what decides it."
        case .appealToAuthority:
            return "\"Experts say\" is unfalsifiable: there is nothing to look up and nothing to disagree with. A named study with a year can be checked and, crucially, can be wrong — which is what makes it evidence."
        case .bandwagon:
            return "How many people hold a belief is a fact about people, not about the thing believed. Majorities have been wrong at scale, repeatedly, and were still majorities the day before they changed."
        case .slipperySlope:
            return "The force of the argument comes entirely from the final step, but the work is in the links — each one needs its own reason, and here none of them got one."
        case .circularReasoning:
            return "The premise and the conclusion are the same sentence wearing different clothes. Anyone who doubted the conclusion has been given no new reason to stop."
        case .hastyGeneralization:
            return "A universal claim is refuted by a single counterexample, so the bigger the word — all, every, never — the smaller the evidence needed to knock it over."
        case .anecdotalEvidence:
            return "One vivid case tells you the thing is possible, not how often it happens. Memorability and frequency are not the same variable, and stories are selected for the first."
        case .appealToNature:
            return "\"Natural\" tracks origin, not safety or goodness — arsenic and tuberculosis are natural, insulin and eyeglasses are not. The word is doing no work the argument can rely on."
        case .appealToIgnorance:
            return "Not proven false and proven true are different states. Otherwise every unfalsified claim would be true at once, including this claim's exact opposite."
        case .falseCause:
            return "Two things moving together is consistent with cause, reverse cause, or a third factor driving both. Without ruling those out, the sequence is a hypothesis, not a finding."
        case .whataboutism:
            return "Even if the counter-charge is entirely accurate, the original charge is unaddressed. Two things can both be bad; that is not a defence of either."
        case .movingGoalposts:
            return "A standard that rises whenever it is met is not a standard — it is a way of never being wrong, and it costs you the ability to ever be convinced."
        case .loadedQuestion:
            return "The assumption rides in unexamined, so both answers concede it. There is no way to reply on the question's terms without granting what has not been shown."
        case .noTrueScotsman:
            return "Redefining the category mid-argument makes the claim true by construction and therefore empty — it now rules out nothing that could happen."
        case .appealToTradition:
            return "Duration is not evidence of merit. Practices persist for many reasons, including inertia and the interests of whoever benefits from them."
        }
    }

    /// What to do instead. Written to be usable in the next thirty seconds.
    public var coaching: String {
        switch self {
        case .adHominem:
            return "Take the strongest version of what they said and answer that. If their credibility genuinely matters — they are the source of the data — say what specifically makes the data unreliable."
        case .strawman:
            return "Quote them before you answer: \"You said X — is that right?\" If your rebuttal only works on the exaggerated version, you do not have a rebuttal yet."
        case .falseDilemma:
            return "Name a third option out loud, then argue why it fails. If none exists, say why the space really is exhausted — that is a claim you can defend."
        case .appealToEmotion:
            return "Keep the stakes, add the evidence. \"This matters because people get hurt\" is much stronger with how many, how often, and where that comes from."
        case .appealToAuthority:
            return "Name it: who, when, how big. \"A 2023 meta-analysis of 40 trials\" is an argument. \"Experts agree\" is a mood."
        case .bandwagon:
            return "Give the reason the majority holds the view. If the reason is good it will carry the point by itself, and you can drop the headcount."
        case .slipperySlope:
            return "Defend one link. Pick the step you think is most likely and show why it follows — a single well-argued step beats a five-step chain nobody accepts."
        case .circularReasoning:
            return "Find a premise your opponent already accepts and build from there. If the only support you can state is the conclusion, the belief may be an assumption you have not examined."
        case .hastyGeneralization:
            return "Shrink the claim to what your evidence covers. \"Most\", \"in this study\", \"among first-year students\" are harder to knock down and easier to defend."
        case .anecdotalEvidence:
            return "Keep the story as illustration, then say what it illustrates and how common it is. Use it to make a number vivid, not to replace one."
        case .appealToNature:
            return "State the property you actually care about — safer, cheaper, fewer side effects — and argue for that directly. It is what you meant anyway."
        case .appealToIgnorance:
            return "Say who carries the burden and why. If you are claiming something exists, bring the positive evidence; absence of disproof is not a starting score."
        case .falseCause:
            return "Offer a mechanism and rule out one alternative explanation. \"X causes Y through Z, and it is not just W because…\" is the move."
        case .whataboutism:
            return "Answer first, then counter. \"Yes, that happened, and here is why it does not settle the question — and separately, your side did this\" keeps both charges alive."
        case .movingGoalposts:
            return "State your standard in advance and in public: \"If you show me X, I will change my mind.\" Then honour it when they do."
        case .loadedQuestion:
            return "Split it in two: establish the assumption first, then ask the question. If you are on the receiving end, reject the premise before answering."
        case .noTrueScotsman:
            return "Fix the definition before the counterexample arrives, and accept the cases it lets in. A definition that survives every test is not describing anything."
        case .appealToTradition:
            return "Say what the practice is *for* and whether it still achieves that. Longevity can be evidence that something works — but only if you show the working."
        }
    }

    /// How much this ought to move the score.
    public var severity: Severity {
        switch self {
        case .adHominem, .strawman, .circularReasoning:
            return .major
        case .falseDilemma, .slipperySlope, .hastyGeneralization, .falseCause,
             .appealToIgnorance, .noTrueScotsman, .movingGoalposts:
            return .warning
        case .appealToEmotion, .appealToAuthority, .bandwagon, .anecdotalEvidence,
             .appealToNature, .whataboutism, .loadedQuestion, .appealToTradition:
            return .notice
        }
    }

    /// Loose grouping, used to organise the reference screen.
    public enum Family: String, Codable, Hashable, CaseIterable, Sendable {
        case relevance
        case structure
        case evidence
        case language

        public var title: String {
            switch self {
            case .relevance: return "Changing the subject"
            case .structure: return "Broken structure"
            case .evidence: return "Weak evidence"
            case .language: return "Loaded language"
            }
        }
    }

    public var family: Family {
        switch self {
        case .adHominem, .whataboutism, .appealToEmotion, .appealToTradition:
            return .relevance
        case .strawman, .falseDilemma, .circularReasoning, .slipperySlope,
             .movingGoalposts, .noTrueScotsman:
            return .structure
        case .appealToAuthority, .bandwagon, .hastyGeneralization,
             .anecdotalEvidence, .appealToIgnorance, .falseCause:
            return .evidence
        case .appealToNature, .loadedQuestion:
            return .language
        }
    }
}
