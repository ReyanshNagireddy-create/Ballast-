import XCTest
@testable import VeritasKit

final class TokenizerTests: XCTestCase {

    // MARK: Normalization

    func testNormalizeLowercasesStripsApostrophesAndPads() {
        XCTAssertEqual(Tokenizer.normalize("You're an idiot!"), " youre an idiot ")
        XCTAssertEqual(Tokenizer.normalize("  Hello,   world.  "), " hello world ")
        XCTAssertEqual(Tokenizer.normalize(""), " ")
    }

    func testNormalizeHandlesCurlyApostrophes() {
        XCTAssertEqual(Tokenizer.normalize("that\u{2019}s it"), " thats it ")
    }

    func testContainsMatchesOnWordBoundaries() {
        let text = Tokenizer.normalize("Snow onions are not no one.")
        XCTAssertTrue(Tokenizer.contains(text, phrase: "no one"))
        XCTAssertFalse(Tokenizer.contains(Tokenizer.normalize("Snow onions."), phrase: "no on"))
    }

    func testNormalizeKeepingCasePreservesAcronyms() {
        let cased = Tokenizer.normalizeKeepingCase("The WHO said so.")
        XCTAssertTrue(Tokenizer.contains(cased, phrase: "WHO"))
        XCTAssertFalse(Tokenizer.contains(Tokenizer.normalizeKeepingCase("who said so"), phrase: "WHO"))
    }

    // MARK: Sentences

    func testSentenceSplitting() {
        let sentences = Tokenizer.sentences(in: "This is one. This is two! And three?")
        XCTAssertEqual(sentences.count, 3)
        XCTAssertEqual(sentences[0], "This is one.")
        XCTAssertEqual(sentences[2], "And three?")
    }

    func testSentenceSplittingKeepsAbbreviationsIntact() {
        let sentences = Tokenizer.sentences(in: "Dr. Cooper ran the study. It was small.")
        XCTAssertEqual(sentences.count, 2)
        XCTAssertEqual(sentences[0], "Dr. Cooper ran the study.")
    }

    func testSentenceSplittingKeepsDottedInitialismsIntact() {
        let sentences = Tokenizer.sentences(in: "It happened in the U.S. and nowhere else.")
        XCTAssertEqual(sentences.count, 1)
    }

    func testSentenceSplittingKeepsDecimalsIntact() {
        let sentences = Tokenizer.sentences(in: "It rose 3.5 points. Then it fell.")
        XCTAssertEqual(sentences.count, 2)
        XCTAssertTrue(sentences[0].contains("3.5"))
    }

    func testSentenceSplittingBreaksOnNewlines() {
        XCTAssertEqual(Tokenizer.sentences(in: "First line\nSecond line").count, 2)
    }

    func testSentenceSplittingHandlesEllipsisAndQuotes() {
        let sentences = Tokenizer.sentences(in: "He said \"that is wrong.\" Then he left.")
        XCTAssertEqual(sentences.count, 2)
    }

    // MARK: Words and stemming

    func testContentWordsDropStopWordsAndShortTokens() {
        let words = Tokenizer.contentWords(in: "The homework is a waste of time")
        XCTAssertFalse(words.contains("the"))
        XCTAssertFalse(words.contains("is"))
        XCTAssertTrue(words.contains("homework"))
    }

    func testStemmerCollapsesInflections() {
        XCTAssertEqual(Tokenizer.stem("banning"), Tokenizer.stem("banned"))
        XCTAssertEqual(Tokenizer.stem("reduces"), Tokenizer.stem("reduce"))
        XCTAssertEqual(Tokenizer.stem("policies"), "policy")
    }

    func testStemmerLeavesDoubleSAlone() {
        XCTAssertEqual(Tokenizer.stem("class"), "class")
        XCTAssertEqual(Tokenizer.stem("press"), "press")
    }

    // MARK: Similarity

    func testOverlapUsesSmallerSetAsDenominator() {
        XCTAssertEqual(Tokenizer.overlap(["a", "b"], ["a", "b", "c", "d"]), 1.0, accuracy: 0.001)
        XCTAssertEqual(Tokenizer.overlap([], ["a"]), 0)
    }

    func testJaccardIsSymmetricAndPenalisesSizeDifference() {
        XCTAssertEqual(Tokenizer.jaccard(["a", "b"], ["a", "b"]), 1.0, accuracy: 0.001)
        XCTAssertEqual(Tokenizer.jaccard(["a"], ["a", "b", "c", "d"]), 0.25, accuracy: 0.001)
        XCTAssertEqual(
            Tokenizer.jaccard(["a", "b"], ["b", "a"]),
            Tokenizer.jaccard(["b", "a"], ["a", "b"]),
            accuracy: 0.001
        )
    }

    // MARK: Numbers

    func testYearDetection() {
        XCTAssertTrue(Tokenizer.hasYear("A 2006 meta-analysis"))
        XCTAssertTrue(Tokenizer.hasYear("back in 1974"))
        XCTAssertFalse(Tokenizer.hasYear("there were 12000 of them"))
        XCTAssertFalse(Tokenizer.hasYear("no numbers here"))
    }

    func testQuantityDetection() {
        XCTAssertTrue(Tokenizer.hasQuantity("62%", normalized: Tokenizer.normalize("62%")))
        XCTAssertTrue(Tokenizer.hasQuantity(
            "a third of families",
            normalized: Tokenizer.normalize("a third of families")
        ))
        XCTAssertFalse(Tokenizer.hasQuantity(
            "lots of families",
            normalized: Tokenizer.normalize("lots of families")
        ))
    }

    func testExcerptTrimsOnWordBoundary() {
        let long = String(repeating: "word ", count: 60)
        let excerpt = Tokenizer.excerpt(long, limit: 20)
        XCTAssertTrue(excerpt.hasSuffix("\u{2026}"))
        XCTAssertLessThanOrEqual(excerpt.count, 21)
    }
}
