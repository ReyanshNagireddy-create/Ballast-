import XCTest
@testable import VeritasKit

final class ScorerTests: XCTestCase {

    private func inputs(_ transcript: Transcript) -> Scorer.Inputs {
        let analysis = Referee.examine(transcript)
        return Scorer.Inputs(
            transcript: transcript,
            claims: analysis.claims,
            findings: analysis.findings,
            rebuttal: analysis.rebuttal,
            consistency: analysis.consistency,
            civility: analysis.civility
        )
    }

    // MARK: Bounds

    func testAllScoresStayInRange() {
        for transcript in SampleDebates.all {
            let input = inputs(transcript)
            for side in Side.allCases {
                let card = Scorer.scorecard(for: side, inputs: input)
                for dimension in Dimension.allCases {
                    let value = card.value(for: dimension)
                    XCTAssertGreaterThanOrEqual(value, 0, "\(dimension) went below zero")
                    XCTAssertLessThanOrEqual(value, 100, "\(dimension) went above one hundred")
                }
                XCTAssertGreaterThanOrEqual(card.overall, 0)
                XCTAssertLessThanOrEqual(card.overall, 100)
            }
        }
    }

    func testScoresSurviveAbusiveInput() {
        var transcript = Transcript(topic: "Nonsense")
        transcript.append(.a, text: "You're an idiot. You're a liar. You're an idiot again. Everyone knows it.")
        transcript.append(.b, text: "!!!")

        let input = inputs(transcript)
        for side in Side.allCases {
            let card = Scorer.scorecard(for: side, inputs: input)
            for dimension in Dimension.allCases {
                XCTAssertGreaterThanOrEqual(card.value(for: dimension), 0)
                XCTAssertLessThanOrEqual(card.value(for: dimension), 100)
            }
        }
    }

    func testDimensionWeightsSumToOne() {
        let total = Dimension.allCases.reduce(0.0) { $0 + $1.weight }
        XCTAssertEqual(total, 1.0, accuracy: 0.0001)
    }

    // MARK: Evidence

    func testNoFactualClaimsScoresNeutral() {
        var transcript = Transcript(topic: "Values only")
        transcript.append(.a, text: "Children deserve time to play. Rest matters more than marks.")
        XCTAssertEqual(Scorer.evidenceScore(for: .a, inputs: inputs(transcript)), 50, accuracy: 0.001)
    }

    func testSourcedClaimsBeatBareAssertions() {
        var sourced = Transcript(topic: "Homework")
        sourced.append(.a, text: "According to a 2006 meta-analysis by Cooper, the primary school effect is near zero.")

        var asserted = Transcript(topic: "Homework")
        asserted.append(.a, text: "Homework obviously does nothing for younger children, always.")

        XCTAssertGreaterThan(
            Scorer.evidenceScore(for: .a, inputs: inputs(sourced)),
            Scorer.evidenceScore(for: .a, inputs: inputs(asserted))
        )
    }

    func testCreditOrdering() {
        XCTAssertGreaterThan(Scorer.credit(for: .sourced), Scorer.credit(for: .quantified))
        XCTAssertGreaterThan(Scorer.credit(for: .quantified), Scorer.credit(for: .hedged))
        XCTAssertGreaterThan(Scorer.credit(for: .hedged), Scorer.credit(for: .unsupported))
    }

    // MARK: Verdict

    func testIdenticalScorecardsProduceADraw() {
        let card = Scorecard(side: .a, evidence: 70, logic: 70, rebuttal: 70, clarity: 70, consistency: 70, respectfulness: 70)
        var mirrored = card
        mirrored.side = .b

        let verdict = Scorer.verdict(transcript: SampleDebates.homework, a: card, b: mirrored)
        XCTAssertNil(verdict.winner)
        XCTAssertTrue(verdict.isDraw)
        XCTAssertEqual(verdict.margin, 0, accuracy: 0.001)
        XCTAssertFalse(verdict.rationale.isEmpty)
    }

    func testClearGapProducesAWinner() {
        let strong = Scorecard(side: .a, evidence: 90, logic: 90, rebuttal: 90, clarity: 90, consistency: 90, respectfulness: 90)
        let weak = Scorecard(side: .b, evidence: 40, logic: 40, rebuttal: 40, clarity: 40, consistency: 40, respectfulness: 40)

        let verdict = Scorer.verdict(transcript: SampleDebates.homework, a: strong, b: weak)
        XCTAssertEqual(verdict.winner, .a)
        XCTAssertGreaterThan(verdict.margin, Scorer.drawThreshold)
        XCTAssertFalse(verdict.decidingDimensions.isEmpty)
    }

    func testConfidenceStaysWithinBounds() {
        var thin = Transcript(topic: "Thin")
        thin.append(.a, text: "No.")
        thin.append(.b, text: "Yes.")

        let thinConfidence = Scorer.confidence(transcript: thin, margin: 40, isDraw: false)
        let fullConfidence = Scorer.confidence(transcript: SampleDebates.homework, margin: 40, isDraw: false)

        XCTAssertGreaterThanOrEqual(thinConfidence, 0.05)
        XCTAssertLessThanOrEqual(fullConfidence, 0.95)
        XCTAssertLessThan(thinConfidence, fullConfidence)
    }

    func testLopsidedAirtimeLowersConfidence() {
        var lopsided = Transcript(topic: "Lopsided")
        lopsided.append(.a, text: String(repeating: "The evidence on this question is genuinely mixed and worth examining. ", count: 8))
        lopsided.append(.b, text: "I disagree.")

        var balanced = Transcript(topic: "Balanced")
        balanced.append(.a, text: String(repeating: "The evidence on this question is genuinely mixed and worth examining. ", count: 4))
        balanced.append(.b, text: String(repeating: "The evidence on this question is genuinely mixed and worth examining. ", count: 4))

        XCTAssertLessThan(
            Scorer.confidence(transcript: lopsided, margin: 10, isDraw: false),
            Scorer.confidence(transcript: balanced, margin: 10, isDraw: false)
        )
    }

    // MARK: Grades

    func testGradeBoundaries() {
        XCTAssertEqual(Scorecard(side: .a, evidence: 100, logic: 100, rebuttal: 100, clarity: 100, consistency: 100, respectfulness: 100).grade, "A")
        XCTAssertEqual(Scorecard(side: .a).grade, "F")
    }
}
