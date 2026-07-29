import Foundation

/// Sentence and word splitting, plus the normalization every detector relies on.
///
/// Deliberately hand-rolled and dependency-free: it runs identically on
/// iOS, macOS and in tests, and there is nothing to be surprised by at
/// three in the morning when a detector misfires.
public enum Tokenizer {

    // MARK: - Normalization

    /// Lower-cases, deletes apostrophes, turns every other non-alphanumeric
    /// character into a space, collapses runs of whitespace, and pads the
    /// result with a single space at each end.
    ///
    /// The padding is what makes `contains(_:phrase:)` a word-boundary
    /// match without a regex: `" no one "` cannot match inside `"snow onions"`.
    public static func normalize(_ text: String) -> String {
        collapse(text.lowercased())
    }

    /// Same shape as `normalize(_:)` but without lower-casing, so that
    /// acronyms which are also ordinary words — WHO, ONS, BLS — can be
    /// told apart from "who", "ons" and "bls".
    static func normalizeKeepingCase(_ text: String) -> String {
        collapse(text)
    }

    private static func collapse(_ text: String) -> String {
        var out = ""
        out.reserveCapacity(text.count + 2)
        out.append(" ")
        var lastWasSpace = true
        for scalar in text.unicodeScalars {
            let character = Character(scalar)
            if character == "'" || character == "\u{2019}" || character == "`" {
                continue
            }
            if character.isLetter || character.isNumber {
                out.append(character)
                lastWasSpace = false
            } else if !lastWasSpace {
                out.append(" ")
                lastWasSpace = true
            }
        }
        if !lastWasSpace {
            out.append(" ")
        }
        return out
    }

    /// True when `phrase` (already in normalized form) occurs in `text` on
    /// word boundaries.
    public static func contains(_ text: String, phrase: String) -> Bool {
        text.contains(" " + phrase + " ")
    }

    /// Every phrase from `phrases` present in the normalized `text`.
    static func matches(in text: String, phrases: [String]) -> [String] {
        phrases.filter { contains(text, phrase: $0) }
    }

    static func containsAny(_ text: String, phrases: [String]) -> Bool {
        for phrase in phrases where contains(text, phrase: phrase) {
            return true
        }
        return false
    }

    // MARK: - Words

    /// Lower-cased alphanumeric tokens, apostrophes removed.
    public static func words(in text: String) -> [String] {
        normalize(text)
            .split(separator: " ", omittingEmptySubsequences: true)
            .map(String.init)
    }

    /// Words that carry meaning: stop words dropped, short tokens dropped,
    /// everything stemmed so "reduces", "reduced" and "reducing" collide.
    public static func contentWords(in text: String) -> [String] {
        var result: [String] = []
        for word in words(in: text) {
            if Lexicon.stopwords.contains(word) { continue }
            if word.count < 3 && !word.contains(where: { $0.isNumber }) { continue }
            result.append(stem(word))
        }
        return result
    }

    /// A very small suffix stripper. Not linguistics — just enough that
    /// rebuttal matching does not miss because one side said "bans" and the
    /// other said "banning".
    static func stem(_ word: String) -> String {
        var stemmed = word
        var strippedVerbEnding = false

        if stemmed.count > 4, stemmed.hasSuffix("ies") {
            return String(stemmed.dropLast(3)) + "y"
        }
        if stemmed.count > 5, stemmed.hasSuffix("ness") {
            return String(stemmed.dropLast(4))
        }
        if stemmed.count > 4, stemmed.hasSuffix("ing") {
            stemmed = String(stemmed.dropLast(3))
            strippedVerbEnding = true
        } else if stemmed.count > 4, stemmed.hasSuffix("ed") {
            stemmed = String(stemmed.dropLast(2))
            strippedVerbEnding = true
        } else if stemmed.count > 4, stemmed.hasSuffix("ly") {
            stemmed = String(stemmed.dropLast(2))
        } else if stemmed.count > 4, stemmed.hasSuffix("es") {
            // "boxes" and "classes" lose both letters; "reduces" and
            // "vaccines" lose only the s, so that they collide with their
            // own base forms rather than with nothing.
            let withoutES = String(stemmed.dropLast(2))
            let takesFullES = withoutES.hasSuffix("s")
                || withoutES.hasSuffix("x")
                || withoutES.hasSuffix("z")
                || withoutES.hasSuffix("ch")
                || withoutES.hasSuffix("sh")
            stemmed = takesFullES ? withoutES : String(stemmed.dropLast(1))
        } else if stemmed.count > 3, stemmed.hasSuffix("s"), !stemmed.hasSuffix("ss") {
            stemmed = String(stemmed.dropLast(1))
        }

        // "running" -> "runn" -> "run". Only after a verb ending, so that
        // "class" and "press" are left alone.
        if strippedVerbEnding, stemmed.count > 3 {
            let characters = Array(stemmed)
            let last = characters[characters.count - 1]
            let penultimate = characters[characters.count - 2]
            if last == penultimate, !"aeiou".contains(last) {
                stemmed = String(stemmed.dropLast(1))
            }
        }
        return stemmed
    }

    /// Overlap of two content-word sets, 0–1.
    ///
    /// Divides by the *smaller* set rather than the union: a two-word
    /// question that lands squarely on a long claim is engagement, and
    /// Jaccard would score it near zero.
    /// Symmetric similarity of two content-word sets, 0–1.
    ///
    /// Used where "these two clauses say the same thing" is the question,
    /// which `overlap(_:_:)` answers badly: a one-word clause is fully
    /// contained in almost anything.
    static func jaccard(_ lhs: [String], _ rhs: [String]) -> Double {
        let left = Set(lhs)
        let right = Set(rhs)
        guard !left.isEmpty, !right.isEmpty else { return 0 }
        let shared = left.intersection(right).count
        let combined = left.union(right).count
        return Double(shared) / Double(combined)
    }

    static func overlap(_ lhs: [String], _ rhs: [String]) -> Double {
        let left = Set(lhs)
        let right = Set(rhs)
        guard !left.isEmpty, !right.isEmpty else { return 0 }
        let shared = left.intersection(right).count
        let denominator = Double(min(left.count, right.count))
        return Double(shared) / denominator
    }

    // MARK: - Sentences

    private static let closingMarks: Set<Character> = ["\"", "\u{201D}", "\u{2019}", ")", "]"]

    /// Splits text into sentences, keeping abbreviations and decimals intact.
    public static func sentences(in text: String) -> [String] {
        var result: [String] = []
        var current = ""
        let characters = Array(text)
        var index = 0

        func flush() {
            let trimmed = current.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                result.append(trimmed)
            }
            current = ""
        }

        while index < characters.count {
            let character = characters[index]

            if character == "\n" {
                flush()
                index += 1
                continue
            }

            current.append(character)

            guard character == "." || character == "!" || character == "?" else {
                index += 1
                continue
            }

            var next = index + 1
            var runLength = 1
            while next < characters.count,
                  characters[next] == "." || characters[next] == "!" || characters[next] == "?" {
                current.append(characters[next])
                runLength += 1
                next += 1
            }

            let couldBeAbbreviation = (character == "." && runLength == 1)

            var closers = 0
            while next < characters.count, closingMarks.contains(characters[next]) {
                current.append(characters[next])
                closers += 1
                next += 1
            }

            let atEnd = next >= characters.count
            let followedBySpace = !atEnd && characters[next].isWhitespace

            if atEnd || followedBySpace {
                if couldBeAbbreviation, closers == 0, endsInAbbreviation(current) {
                    index = next
                    continue
                }
                flush()
            }
            index = next
        }

        flush()
        return result
    }

    /// True when a trailing "." belongs to an abbreviation rather than a
    /// sentence: "Dr.", "e.g.", "U.S.".
    private static func endsInAbbreviation(_ text: String) -> Bool {
        var characters = Array(text)
        guard characters.last == "." else { return false }
        characters.removeLast()

        // Dotted initialisms: the letter before the final dot is itself
        // preceded by a dot.
        if characters.count >= 2, characters[characters.count - 2] == "." {
            return true
        }

        var token = ""
        var index = characters.count - 1
        while index >= 0, characters[index].isLetter {
            token.insert(characters[index], at: token.startIndex)
            index -= 1
        }
        guard !token.isEmpty else { return false }
        return Lexicon.abbreviations.contains(token.lowercased())
    }

    // MARK: - Numbers

    /// True when the *original* text carries a digit or a written quantity.
    /// Checked against the original because normalization splits "3.5"
    /// into two tokens.
    static func hasQuantity(_ original: String, normalized: String) -> Bool {
        if original.contains("%") { return true }
        if original.contains(where: { $0.isNumber }) { return true }
        return containsAny(normalized, phrases: Lexicon.quantityWords)
    }

    /// True when the text contains something shaped like a year, 1800–2099.
    static func hasYear(_ original: String) -> Bool {
        let digits = Array(original)
        var index = 0
        while index + 3 < digits.count {
            if digits[index].isNumber,
               digits[index + 1].isNumber,
               digits[index + 2].isNumber,
               digits[index + 3].isNumber {
                let before = index > 0 ? digits[index - 1] : " "
                let afterIndex = index + 4
                let after: Character = afterIndex < digits.count ? digits[afterIndex] : " "
                if !before.isNumber, !after.isNumber {
                    let value = Int(String(digits[index...(index + 3)])) ?? 0
                    if value >= 1800 && value <= 2099 {
                        return true
                    }
                }
            }
            index += 1
        }
        return false
    }

    /// Shortens a quote for display without cutting mid-word.
    public static func excerpt(_ text: String, limit: Int = 180) -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > limit else { return trimmed }
        let prefix = trimmed.prefix(limit)
        if let lastSpace = prefix.lastIndex(of: " ") {
            return String(prefix[prefix.startIndex..<lastSpace]) + "…"
        }
        return String(prefix) + "…"
    }
}
