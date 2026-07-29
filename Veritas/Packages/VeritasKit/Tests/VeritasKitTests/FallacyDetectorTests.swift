import XCTest
@testable import VeritasKit

/// Every detector gets a pair: one sentence that must fire it, and one that
/// must not. The negative half is the important half — a referee with false
/// positives gets muted, and a muted referee teaches nobody anything.
final class FallacyDetectorTests: XCTestCase {

    // MARK: Harness

    private func fallacies(
        _ text: String,
        isResponse: Bool = true,
        opponentDeliveredEvidence: Bool = true
    ) -> Set<Fallacy> {
        let turn = Turn(side: .a, text: text, index: 1)
        let claims = ClaimExtractor.claims(in: turn)
        let context = FallacyDetector.Context(
            turn: turn,
            turnNormalized: Tokenizer.normalize(text),
            isResponse: isResponse,
            opponentDeliveredEvidence: opponentDeliveredEvidence
        )
        var found: Set<Fallacy> = []
        for claim in claims {
            for detection in FallacyDetector.detect(claim: claim, context: context) {
                found.insert(detection.fallacy)
            }
        }
        return found
    }

    private func assertFires(
        _ fallacy: Fallacy,
        _ text: String,
        isResponse: Bool = true,
        opponentDeliveredEvidence: Bool = true,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let found = fallacies(text, isResponse: isResponse, opponentDeliveredEvidence: opponentDeliveredEvidence)
        XCTAssertTrue(
            found.contains(fallacy),
            "expected \(fallacy.rawValue) for \"\(text)\", got \(found.map(\.rawValue).sorted())",
            file: file,
            line: line
        )
    }

    private func assertQuiet(
        _ fallacy: Fallacy,
        _ text: String,
        isResponse: Bool = true,
        opponentDeliveredEvidence: Bool = true,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        let found = fallacies(text, isResponse: isResponse, opponentDeliveredEvidence: opponentDeliveredEvidence)
        XCTAssertFalse(
            found.contains(fallacy),
            "false positive: \(fallacy.rawValue) fired on \"\(text)\"",
            file: file,
            line: line
        )
    }

    // MARK: Relevance

    func testAdHominem() {
        assertFires(.adHominem, "You're an idiot if you believe that.")
        assertFires(.adHominem, "You clearly don't understand how any of this works.")
        // Harsh, but aimed at the argument rather than the person.
        assertQuiet(.adHominem, "Your argument is stupid, and here is exactly why.")
    }

    func testWhataboutism() {
        assertFires(.whataboutism, "What about your own party's record on this?")
        // A real question about the topic is not deflection.
        assertQuiet(.whataboutism, "What about the cost to families who cannot absorb it?")
        // Nothing to deflect from before the other side has spoken.
        assertQuiet(.whataboutism, "What about your record?", isResponse: false)
    }

    func testAppealToEmotion() {
        assertFires(.appealToEmotion, "Think of the children who will suffer because of this.")
        // Emotion carried alongside a measurement is rhetoric, not fallacy.
        assertQuiet(.appealToEmotion, "The 2011 famine was devastating for the region.")
    }

    func testAppealToTradition() {
        assertFires(.appealToTradition, "We've always done it this way, so we should keep it.")
        assertQuiet(.appealToTradition, "We've always done it this way, and it stopped working in the nineties.")
    }

    // MARK: Structure

    func testStrawman() {
        assertFires(.strawman, "So you're saying we should abolish all testing everywhere.")
        assertFires(.strawman, "So you are saying we should make every child work all evening.")
        // Clarifying is not misrepresenting.
        assertQuiet(.strawman, "So you're saying the study was small?")
    }

    func testFalseDilemma() {
        assertFires(.falseDilemma, "You either support the policy or you support the harm it prevents.")
        assertFires(.falseDilemma, "There are only two ways this can go.")
        assertQuiet(.falseDilemma, "I don't think either party or the public wants this.")
    }

    func testSlipperySlope() {
        assertFires(.slipperySlope, "If we allow this, soon nobody will bother following any of it.")
        assertFires(.slipperySlope, "Before you know it we will be doing three hours a night.")
        assertQuiet(.slipperySlope, "If we allow this, the policy takes effect in September.")
    }

    func testCircularReasoning() {
        assertFires(.circularReasoning, "It is dangerous because it is dangerous.")
        // Containment is not circularity: the reason adds something.
        assertQuiet(.circularReasoning, "Vaccines are safe because vaccines have been tested in large trials.")
        assertQuiet(.circularReasoning, "Homework is bad because homework takes time away from families.")
    }

    func testMovingGoalposts() {
        assertFires(.movingGoalposts, "That's just one study, so that doesn't count.")
        // The goalposts cannot move before evidence arrives.
        assertQuiet(.movingGoalposts, "That's just one study, so that doesn't count.", opponentDeliveredEvidence: false)
    }

    func testNoTrueScotsman() {
        assertFires(.noTrueScotsman, "No true conservative would support that.")
        // Ordinary English about quantities.
        assertQuiet(.noTrueScotsman, "There is no real evidence for that claim.")
        assertQuiet(.noTrueScotsman, "It made no real difference to the outcome.")
    }

    // MARK: Evidence

    func testAppealToAuthority() {
        assertFires(.appealToAuthority, "Experts say this is completely settled.")
        assertFires(.appealToAuthority, "Studies show it is the right thing to do.")
        // Naming an institution defeats it.
        assertQuiet(.appealToAuthority, "WHO researchers say studies show the risk is low.")
    }

    func testBandwagon() {
        assertFires(.bandwagon, "Everyone knows this is a waste of everybody's time.")
        // A measurement of popularity is evidence about popularity.
        assertQuiet(.bandwagon, "Most people agree, and a Gallup poll put it at 62 percent.")
    }

    func testHastyGeneralization() {
        assertFires(.hastyGeneralization, "Teenagers always ignore rules like this one.")
        assertQuiet(.hastyGeneralization, "Not all teenagers ignore rules like this one.")
        // Values are not sampling errors.
        assertQuiet(.hastyGeneralization, "Everyone deserves a fair hearing before that happens.")
        // A first-person habit is not a claim about a population.
        assertQuiet(.hastyGeneralization, "I would never say that about someone's family.")
    }

    func testAnecdotalEvidence() {
        assertFires(.anecdotalEvidence, "My cousin tried it and it failed. That is how it works for everyone.")
        // Telling a story is allowed.
        assertQuiet(.anecdotalEvidence, "My cousin tried it and it did not work out for her.")
    }

    func testAppealToIgnorance() {
        assertFires(.appealToIgnorance, "No one has proven it doesn't work, so it works.")
        assertQuiet(.appealToIgnorance, "The claim has not been tested in a large trial yet.")
    }

    func testFalseCause() {
        assertFires(.falseCause, "Ever since the law passed, crime went up, which is why we should repeal it.")
        // Someone correctly warning about correlation is not committing it.
        assertQuiet(.falseCause, "Ever since the law passed crime went up, but correlation is not causation.")
    }

    // MARK: Language

    func testAppealToNature() {
        assertFires(.appealToNature, "We shouldn't use it because it's unnatural.")
        assertQuiet(.appealToNature, "The unnatural colour was the first clue that something was wrong.")
    }

    func testLoadedQuestion() {
        assertFires(.loadedQuestion, "Why do you hate working families so much?")
        assertQuiet(.loadedQuestion, "Why do you think that is the right threshold?")
    }

    // MARK: Whole-transcript behaviour

    func testOneFindingPerFallacyPerTurn() {
        var transcript = Transcript(topic: "Test")
        transcript.append(.a, text: "Everyone knows this. Everybody agrees with it. Everyone knows it again.")
        let claims = ClaimExtractor.claims(in: transcript)
        let findings = FallacyDetector.findings(in: transcript, claims: claims)
        XCTAssertEqual(findings.filter { $0.fallacy == .bandwagon }.count, 1)
    }

    func testFindingsCarryQuoteAndCoaching() {
        var transcript = Transcript(topic: "Test")
        transcript.append(.a, text: "You're an idiot if you believe that.")
        let claims = ClaimExtractor.claims(in: transcript)
        let findings = FallacyDetector.findings(in: transcript, claims: claims)

        guard let finding = findings.first(where: { $0.fallacy == .adHominem }) else {
            return XCTFail("expected an ad hominem finding")
        }
        XCTAssertFalse(finding.quote.isEmpty)
        XCTAssertFalse(finding.coaching.isEmpty)
        XCTAssertEqual(finding.severity, .major)
        XCTAssertEqual(finding.side, .a)
    }

    func testEveryFallacyHasCompleteCopy() {
        for fallacy in Fallacy.allCases {
            XCTAssertFalse(fallacy.title.isEmpty, "\(fallacy.rawValue) has no title")
            XCTAssertFalse(fallacy.definition.isEmpty, "\(fallacy.rawValue) has no definition")
            XCTAssertFalse(fallacy.why.isEmpty, "\(fallacy.rawValue) has no mechanism")
            XCTAssertFalse(fallacy.coaching.isEmpty, "\(fallacy.rawValue) has no coaching")
        }
    }
}
