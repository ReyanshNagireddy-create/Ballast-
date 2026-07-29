import XCTest
@testable import VeritasKit

final class SparringPartnerTests: XCTestCase {

    private func partner(_ persona: Persona = .scientist, _ difficulty: Difficulty = .hard) -> SparringPartner {
        SparringPartner(
            persona: persona,
            difficulty: difficulty,
            topic: "Should primary schools stop setting homework?",
            position: "primary schools should keep setting homework"
        )
    }

    private func transcriptWithHumanTurn(_ text: String) -> Transcript {
        var transcript = Transcript(topic: "Should primary schools stop setting homework?")
        transcript.append(.a, text: text, duration: 60)
        return transcript
    }

    // MARK: The honesty rule

    /// The offline partner must never produce a number. It has no sources,
    /// so any statistic it emitted would be invented — and a practice
    /// partner that fabricates evidence teaches the exact habit this
    /// product exists to break.
    func testOfflinePartnerNeverEmitsDigits() {
        for persona in Persona.allCases {
            for difficulty in Difficulty.allCases {
                let partner = SparringPartner(
                    persona: persona,
                    difficulty: difficulty,
                    topic: "Should social media have a minimum age?",
                    position: "an age limit is the wrong instrument"
                )
                let opening = partner.opening()
                XCTAssertFalse(
                    opening.contains(where: { $0.isNumber }),
                    "\(persona.rawValue)/\(difficulty.rawValue) invented a figure: \(opening)"
                )
            }
        }
    }

    func testReplyOnlyQuotesNumbersTheHumanUsed() {
        let transcript = transcriptWithHumanTurn("Homework harms children and it always has.")
        let reply = partner().reply(to: transcript, as: .b)
        XCTAssertFalse(reply.contains(where: { $0.isNumber }))
    }

    // MARK: Determinism

    func testRepliesAreDeterministic() {
        let transcript = transcriptWithHumanTurn("Homework harms children in primary school.")
        let first = partner().reply(to: transcript, as: .b)
        let second = partner().reply(to: transcript, as: .b)
        XCTAssertEqual(first, second)
    }

    func testStableHashDoesNotDependOnProcessSeed() {
        XCTAssertEqual(
            SparringPartner.stableHash("homework"),
            SparringPartner.stableHash("homework")
        )
        XCTAssertNotEqual(
            SparringPartner.stableHash("homework"),
            SparringPartner.stableHash("social media")
        )
    }

    // MARK: Behaviour

    func testOpeningStatesThePosition() {
        XCTAssertTrue(partner().opening().contains("primary schools should keep setting homework"))
    }

    func testReplyEngagesWithWhatWasSaid() {
        let transcript = transcriptWithHumanTurn("Homework harms children in primary school.")
        let reply = partner().reply(to: transcript, as: .b)
        XCTAssertTrue(reply.contains("You said"))
        XCTAssertTrue(reply.contains("Homework harms children"))
    }

    func testExpertAttacksTheStrongestClaim() {
        let turn = Turn(
            side: .a,
            text: "Homework is bad. According to a 2006 meta-analysis by Cooper, the primary school effect is near zero.",
            index: 0
        )
        let claims = ClaimExtractor.claims(in: turn)

        let expert = partner(.scientist, .expert)
        XCTAssertEqual(expert.selectTarget(from: claims)?.verdict, .sourced)

        let easy = partner(.scientist, .easy)
        XCTAssertEqual(easy.selectTarget(from: claims)?.verdict, .unsupported)
    }

    func testTeachingModesPlantACatchableFallacy() {
        let transcript = transcriptWithHumanTurn("Homework harms children in primary school.")

        for difficulty in [Difficulty.easy, .medium] {
            for persona in Persona.allCases {
                let partner = SparringPartner(
                    persona: persona,
                    difficulty: difficulty,
                    topic: "Should primary schools stop setting homework?",
                    position: "primary schools should keep setting homework"
                )
                let reply = partner.reply(to: transcript, as: .b)

                var practice = transcript
                practice.append(.b, text: reply, duration: 60)
                let claims = ClaimExtractor.claims(in: practice)
                let findings = FallacyDetector.findings(in: practice, claims: claims)

                XCTAssertTrue(
                    findings.contains { $0.side == .b },
                    "\(persona.rawValue)/\(difficulty.rawValue) planted nothing the report can catch"
                )
            }
        }
    }

    func testHigherDifficultiesConcede() {
        let transcript = transcriptWithHumanTurn("Homework harms children in primary school.")
        let reply = partner(.economist, .hard).reply(to: transcript, as: .b)
        XCTAssertTrue(reply.lowercased().contains("grant") || reply.lowercased().contains("concede"))
    }

    func testTopicTermPicksAContentWord() {
        XCTAssertEqual(
            SparringPartner(persona: .teacher, difficulty: .easy, topic: "Is homework useful?", position: "")
                .topicTerm(),
            "homework"
        )
    }

    func testEveryPersonaAndDifficultyHasCopy() {
        for persona in Persona.allCases {
            XCTAssertFalse(persona.title.isEmpty)
            XCTAssertFalse(persona.blurb.isEmpty)
            XCTAssertFalse(persona.challenges.isEmpty)
            XCTAssertFalse(persona.advances.isEmpty)
            XCTAssertFalse(persona.demands.isEmpty)
        }
        for difficulty in Difficulty.allCases {
            XCTAssertFalse(difficulty.title.isEmpty)
            XCTAssertFalse(difficulty.blurb.isEmpty)
            XCTAssertEqual(difficulty.plantsFallacies, !difficulty.plantedLines.isEmpty)
        }
    }
}
