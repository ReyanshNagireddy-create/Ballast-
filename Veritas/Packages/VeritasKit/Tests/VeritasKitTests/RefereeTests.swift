import XCTest
@testable import VeritasKit

final class RefereeTests: XCTestCase {

    func testEndToEndReportOnSampleDebate() {
        let report = Referee.analyze(SampleDebates.homework)

        XCTAssertEqual(report.speakers.count, 2)
        XCTAssertEqual(report.topic, SampleDebates.homework.topic)
        XCTAssertFalse(report.findings.isEmpty)
        XCTAssertFalse(report.claims.isEmpty)
        XCTAssertFalse(report.verdict.rationale.isEmpty)
        XCTAssertFalse(report.caveats.isEmpty)

        for speaker in report.speakers {
            XCTAssertFalse(speaker.name.isEmpty)
            XCTAssertFalse(speaker.suggestions.isEmpty)
            XCTAssertGreaterThan(speaker.stats.claims, 0)
        }
    }

    func testSampleDebateCatchesTheBandwagonAppeal() {
        let report = Referee.analyze(SampleDebates.homework)
        XCTAssertTrue(
            report.findings.contains { $0.fallacy == .bandwagon && $0.side == .a },
            "expected 'everyone knows it' to be caught"
        )
    }

    func testSourcedClaimIsCredited() {
        let report = Referee.analyze(SampleDebates.homework)
        XCTAssertTrue(report.findings.contains { $0.kind == .strongEvidence && $0.side == .b })
    }

    func testAnalysisIsDeterministic() {
        let first = Referee.analyze(SampleDebates.socialMedia)
        let second = Referee.analyze(SampleDebates.socialMedia)

        XCTAssertEqual(first.verdict.winner, second.verdict.winner)
        XCTAssertEqual(first.verdict.margin, second.verdict.margin, accuracy: 0.0001)
        XCTAssertEqual(first.findings.count, second.findings.count)
        XCTAssertEqual(first.scorecard(.a).overall, second.scorecard(.a).overall, accuracy: 0.0001)
    }

    func testEmptyTranscriptDoesNotCrash() {
        let report = Referee.analyze(Transcript(topic: "Nothing was said"))
        XCTAssertTrue(report.findings.isEmpty)
        XCTAssertEqual(report.speakers.count, 2)
        XCTAssertTrue(report.caveats.contains { $0.contains("short") })
    }

    func testEveryFindingQuotesSomething() {
        for transcript in SampleDebates.all {
            let report = Referee.analyze(transcript)
            for finding in report.findings {
                XCTAssertFalse(
                    finding.quote.trimmingCharacters(in: .whitespaces).isEmpty,
                    "\(finding.title) had no quote"
                )
                XCTAssertFalse(finding.detail.isEmpty, "\(finding.title) had no detail")
            }
        }
    }

    func testNegativeFindingsCarryCoaching() {
        let report = Referee.analyze(SampleDebates.homework)
        for finding in report.findings.negativeOnly {
            XCTAssertFalse(
                finding.coaching.isEmpty,
                "\(finding.title) tells the user what went wrong but not what to do"
            )
        }
    }

    func testMarkdownExportContainsTheEssentials() {
        let report = Referee.analyze(SampleDebates.homework)
        let markdown = ReportFormatter.markdown(report)

        XCTAssertTrue(markdown.contains(report.topic))
        XCTAssertTrue(markdown.contains("## Verdict"))
        XCTAssertTrue(markdown.contains("## Scores"))
        XCTAssertTrue(markdown.contains("## Transcript"))
        XCTAssertTrue(markdown.contains("Maya"))
        XCTAssertTrue(markdown.contains("Daniel"))
    }

    func testReportIsCodable() throws {
        let report = Referee.analyze(SampleDebates.socialMedia)
        let data = try JSONEncoder().encode(report)
        let decoded = try JSONDecoder().decode(DebateReport.self, from: data)

        XCTAssertEqual(decoded.topic, report.topic)
        XCTAssertEqual(decoded.findings.count, report.findings.count)
        XCTAssertEqual(decoded.verdict.winner, report.verdict.winner)
    }

    func testTimestampFormatting() {
        XCTAssertEqual(ReportFormatter.timestamp(0), "0:00")
        XCTAssertEqual(ReportFormatter.timestamp(65), "1:05")
        XCTAssertEqual(ReportFormatter.timestamp(600), "10:00")
    }
}

final class LiveRefereeTests: XCTestCase {

    func testTurnOrderFollowsTheOpener() {
        var live = LiveReferee(
            transcript: Transcript(topic: "Test", format: DebateFormat(secondsPerTurn: 60, turnsPerSide: 2))
        )
        XCTAssertEqual(live.currentSide, .a)
        live.submit("Opening statement about school policy and evidence.")
        XCTAssertEqual(live.currentSide, .b)
        live.submit("A reply about school policy and evidence.")
        XCTAssertEqual(live.currentSide, .a)
    }

    func testNotesAreOnlyAnnouncedOnce() {
        var live = LiveReferee(transcript: Transcript(topic: "Test"))

        let first = live.submit("Everyone knows homework is a waste of time for children.")
        XCTAssertTrue(first.contains { $0.fallacy == .bandwagon })

        let second = live.submit("Homework is defended by teachers who have not read the research.")
        XCTAssertFalse(
            second.contains { $0.fallacy == .bandwagon },
            "the same note was announced twice"
        )
        XCTAssertEqual(live.notes.filter { $0.fallacy == .bandwagon }.count, 1)
    }

    func testFinishProducesTheSameVerdictAsABatchRun() {
        var live = LiveReferee(transcript: Transcript(topic: SampleDebates.homework.topic, format: SampleDebates.homework.format, participants: SampleDebates.homework.participants))
        for turn in SampleDebates.homework.turns {
            live.submit(turn.text, side: turn.side, duration: turn.duration)
        }

        let liveReport = live.finish()
        let batchReport = Referee.analyze(SampleDebates.homework)

        XCTAssertEqual(liveReport.verdict.winner, batchReport.verdict.winner)
        XCTAssertEqual(liveReport.verdict.margin, batchReport.verdict.margin, accuracy: 0.0001)
    }

    func testFormatDrivesCompletion() {
        var live = LiveReferee(
            transcript: Transcript(topic: "Test", format: DebateFormat(secondsPerTurn: 60, turnsPerSide: 1))
        )
        XCTAssertFalse(live.isFinished)
        live.submit("First side speaks about the topic at hand.")
        live.submit("Second side replies about the topic at hand.")
        XCTAssertTrue(live.isFinished)
        XCTAssertEqual(live.turnsRemaining, 0)
    }

    func testEmptySubmissionIsIgnored() {
        var live = LiveReferee(transcript: Transcript(topic: "Test"))
        XCTAssertTrue(live.submit("   ").isEmpty)
        XCTAssertTrue(live.transcript.turns.isEmpty)
    }
}
