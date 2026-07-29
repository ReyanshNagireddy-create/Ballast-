import XCTest
@testable import VeritasKit

final class ClaimExtractorTests: XCTestCase {

    private func claim(_ text: String) -> Claim {
        let turn = Turn(side: .a, text: text, index: 0)
        let claims = ClaimExtractor.claims(in: turn)
        return claims[0]
    }

    // MARK: Classification

    func testStatisticalClaim() {
        let result = claim("According to a 2006 meta-analysis, the effect is close to zero.")
        XCTAssertEqual(result.kind, .statistical)
        XCTAssertEqual(result.verdict, .sourced)
        XCTAssertTrue(result.signals.isSourced)
    }

    func testNormativeClaimIsNeverFactChecked() {
        let result = claim("Children deserve time to play after school.")
        XCTAssertEqual(result.kind, .normative)
        XCTAssertEqual(result.verdict, .notApplicable)
        XCTAssertFalse(result.kind.isCheckable)
    }

    func testQuestionIsRhetorical() {
        XCTAssertEqual(claim("Is homework actually useful?").kind, .rhetorical)
    }

    func testPredictionBeatsCause() {
        let result = claim("Banning it will cause the problem to move somewhere else.")
        XCTAssertEqual(result.kind, .predictive)
    }

    func testCausalClaim() {
        XCTAssertEqual(claim("Overwork leads to burnout in younger pupils.").kind, .causal)
    }

    func testDefinitionalClaim() {
        XCTAssertEqual(claim("By definition a tax is a compulsory payment.").kind, .definitional)
    }

    func testAnecdotalClaim() {
        XCTAssertEqual(claim("My cousin tried it for a whole term.").kind, .anecdotal)
    }

    // MARK: Support verdicts

    func testUnsupportedClaim() {
        let result = claim("Homework harms children in primary school.")
        XCTAssertEqual(result.verdict, .unsupported)
    }

    func testHedgedClaim() {
        let result = claim("I think it is probably fine for older pupils.")
        XCTAssertEqual(result.verdict, .hedged)
        XCTAssertFalse(result.signals.hedges.isEmpty)
    }

    func testAbsolutesAreRecorded() {
        let result = claim("Homework obviously harms children, always.")
        XCTAssertFalse(result.signals.absolutes.isEmpty)
        XCTAssertEqual(result.verdict, .unsupported)
    }

    func testLowercaseWhoIsNotTheWorldHealthOrganization() {
        let result = claim("And who decides what counts as harm here.")
        XCTAssertTrue(result.signals.sources.isEmpty)
    }

    func testUppercaseWHOCountsAsASource() {
        let result = claim("The WHO position on this has not changed.")
        XCTAssertFalse(result.signals.sources.isEmpty)
    }

    // MARK: Negation

    func testNegationIsDetected() {
        XCTAssertTrue(claim("It does not reduce costs at all.").isNegated)
        XCTAssertFalse(claim("It reduces costs substantially.").isNegated)
    }

    // MARK: Splitting

    func testTurnSplitsIntoSentences() {
        let turn = Turn(side: .a, text: "First point here. Second point there. Third one too.", index: 0)
        let claims = ClaimExtractor.claims(in: turn)
        XCTAssertEqual(claims.count, 3)
        XCTAssertEqual(claims[1].sentenceIndex, 1)
        XCTAssertTrue(claims.allSatisfy { $0.turnID == turn.id })
    }

    func testDemandsResponseExcludesFiller() {
        XCTAssertFalse(claim("Right, okay.").demandsResponse)
        XCTAssertTrue(claim("Homework harms children in primary school.").demandsResponse)
    }
}
