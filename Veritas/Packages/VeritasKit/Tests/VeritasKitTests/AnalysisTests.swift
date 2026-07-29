import XCTest
@testable import VeritasKit

final class RebuttalAnalyzerTests: XCTestCase {

    private func transcript(_ turns: [(Side, String)]) -> Transcript {
        var transcript = Transcript(topic: "Should primary schools stop setting homework?")
        for (side, text) in turns {
            transcript.append(side, text: text, duration: 60)
        }
        return transcript
    }

    func testDirectRebuttalCountsAsEngagement() {
        let transcript = self.transcript([
            (.a, "Homework has no measurable effect on achievement in primary school."),
            (.b, "You said homework has no measurable effect on achievement, and that is wrong.")
        ])
        let claims = ClaimExtractor.claims(in: transcript)
        let result = RebuttalAnalyzer.analyze(transcript: transcript, claims: claims)

        XCTAssertEqual(result.engagementRate[.b], 1.0)
        XCTAssertTrue(result.engagements.contains { $0.side == .b && $0.isEngaged && $0.usedCue })
        XCTAssertTrue(result.findings.contains { $0.kind == .strongRebuttal && $0.side == .b })
    }

    func testChangingTheSubjectIsNotEngagement() {
        let transcript = self.transcript([
            (.a, "Homework has no measurable effect on achievement in primary school."),
            (.b, "Teachers need proper planning time and smaller class sizes to do their jobs.")
        ])
        let claims = ClaimExtractor.claims(in: transcript)
        let result = RebuttalAnalyzer.analyze(transcript: transcript, claims: claims)

        XCTAssertEqual(result.engagementRate[.b], 0.0)
    }

    func testUnansweredPointIsFiledAgainstTheSideThatIgnoredIt() {
        let transcript = self.transcript([
            (.a, "Homework has no measurable effect on achievement in primary school."),
            (.b, "Teachers need proper planning time and smaller class sizes to do their jobs."),
            (.a, "Nothing you said touched the achievement point at all.")
        ])
        let claims = ClaimExtractor.claims(in: transcript)
        let result = RebuttalAnalyzer.analyze(transcript: transcript, claims: claims)

        let droppedByB = result.findings.filter { $0.kind == .droppedArgument && $0.side == .b }
        XCTAssertFalse(droppedByB.isEmpty)
        XCTAssertEqual(result.droppedCounts[.b], droppedByB.count)
        // The finding quotes the point that went unanswered, not the reply.
        XCTAssertTrue(droppedByB.contains { $0.quote.contains("achievement") })
    }

    func testOpeningTurnIsNotPenalised() {
        let transcript = self.transcript([
            (.a, "Homework has no measurable effect on achievement in primary school.")
        ])
        let claims = ClaimExtractor.claims(in: transcript)
        let result = RebuttalAnalyzer.analyze(transcript: transcript, claims: claims)

        XCTAssertEqual(result.responseTurns[.a], 0)
        XCTAssertTrue(result.findings.isEmpty)
    }
}

final class ConsistencyAnalyzerTests: XCTestCase {

    func testReversalIsCaught() {
        var transcript = Transcript(topic: "Screens")
        transcript.append(.a, text: "Screen time reduces attention span in children.")
        transcript.append(.b, text: "I am not convinced by that at all.")
        transcript.append(.a, text: "Screen time does not reduce attention span in children.")

        let claims = ClaimExtractor.claims(in: transcript)
        let result = ConsistencyAnalyzer.analyze(transcript: transcript, claims: claims)

        XCTAssertEqual(result.counts[.a], 1)
        XCTAssertEqual(result.findings.first?.kind, .contradiction)
    }

    func testRefiningAPositionIsNotAContradiction() {
        var transcript = Transcript(topic: "Screens")
        transcript.append(.a, text: "Screen time reduces attention span in children.")
        transcript.append(.b, text: "Which children, and measured how?")
        transcript.append(.a, text: "Teachers report the same thing about classroom focus after lunch.")

        let claims = ClaimExtractor.claims(in: transcript)
        let result = ConsistencyAnalyzer.analyze(transcript: transcript, claims: claims)

        XCTAssertEqual(result.counts[.a], 0)
    }
}

final class CivilityAnalyzerTests: XCTestCase {

    func testInsultIsCounted() {
        var transcript = Transcript(topic: "Anything")
        transcript.append(.a, text: "You're an idiot for thinking that.")

        let result = CivilityAnalyzer.analyze(transcript: transcript)
        XCTAssertEqual(result.insultCounts[.a], 1)
        XCTAssertTrue(result.findings.contains { $0.kind == .incivility })
    }

    func testConcessionIsCredited() {
        var transcript = Transcript(topic: "Anything")
        transcript.append(.a, text: "You're right about the enforcement problem, and I will grant it.")

        let result = CivilityAnalyzer.analyze(transcript: transcript)
        XCTAssertGreaterThan(result.concessionCounts[.a] ?? 0, 0)
        XCTAssertEqual(result.insultCounts[.a], 0)
    }

    func testShoutingDetectionIgnoresAcronyms() {
        XCTAssertEqual(CivilityAnalyzer.shoutedWords(in: "The CDC and WHO said so."), [])
        XCTAssertEqual(
            CivilityAnalyzer.shoutedWords(in: "This is COMPLETELY UNACCEPTABLE."),
            ["COMPLETELY", "UNACCEPTABLE"]
        )
    }

    func testPolitenessIsNotRequired() {
        var transcript = Transcript(topic: "Anything")
        transcript.append(.a, text: "That reasoning does not hold, and the number you used is out of date.")

        let result = CivilityAnalyzer.analyze(transcript: transcript)
        XCTAssertEqual(result.insultCounts[.a], 0)
        XCTAssertEqual(result.dismissalCounts[.a], 0)
    }
}
