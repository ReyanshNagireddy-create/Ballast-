import Foundation

/// Every word list the analyzers share.
///
/// **All phrases here are written in normalized form** — lower-cased, with
/// apostrophes deleted and every other non-alphanumeric character turned
/// into a space. So it is `"youre an idiot"`, never `"you're an idiot"`.
/// `Tokenizer.normalize(_:)` puts input into the same shape, and
/// `Tokenizer.contains(_:phrase:)` matches on word boundaries. Getting this
/// wrong is the single easiest way to produce a detector that never fires,
/// so the tests pin a representative phrase from each list.
public enum Lexicon {

    // MARK: - Structural words

    static let stopwords: Set<String> = Set(
        [
            "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
            "any", "are", "arent", "as", "at", "be", "because", "been", "before", "being",
            "below", "between", "both", "but", "by", "can", "cant", "could", "couldnt",
            "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during",
            "each", "few", "for", "from", "further", "had", "has", "have", "having", "he",
            "her", "here", "hers", "him", "his", "how", "i", "if", "in", "into", "is",
            "isnt", "it", "its", "just", "like", "me", "more", "most", "my", "no", "nor",
            "not", "now", "of", "off", "on", "once", "only", "or", "other", "our", "out",
            "over", "own", "really", "said", "same", "say", "says", "she", "should", "so",
            "some", "such", "than", "that", "thats", "the", "their", "them", "then",
            "there", "these", "they", "theyre", "thing", "things", "this", "those",
            "through", "to", "too", "under", "until", "up", "very", "want", "was", "wasnt",
            "we", "well", "were", "what", "when", "where", "which", "while", "who", "whom",
            "why", "will", "with", "would", "wouldnt", "you", "your", "youre", "yours",
            "im", "ive", "id", "youve", "youd", "weve", "wed", "theyve", "theyd", "hes",
            "shes", "thered", "get", "got", "go", "going", "gone", "make", "makes", "made",
            "one", "two", "also", "even", "much", "many", "lot", "lots", "kind", "sort",
            "way", "ways", "yeah", "okay", "ok", "sure", "actually", "basically", "mean",
            "means", "think", "know", "see", "look", "come", "take", "give", "put"
        ]
    )

    /// Words that flip the polarity of an assertion. Used for contradiction
    /// detection, where "X reduces Y" and "X does not reduce Y" must not be
    /// treated as the same claim.
    static let negations: Set<String> = Set(
        [
            "not", "no", "never", "none", "nobody", "nothing", "neither", "nor",
            "dont", "doesnt", "didnt", "isnt", "arent", "wasnt", "werent",
            "cant", "cannot", "wont", "shouldnt", "couldnt", "wouldnt",
            "hasnt", "havent", "hadnt", "without", "fails", "fail", "false",
            "untrue", "incorrect", "wrong", "myth", "debunked"
        ]
    )

    // MARK: - Evidence signals

    /// Phrases that point at something a listener could go and check.
    ///
    /// The bar is *specificity*, not confidence. "Studies show" is not in
    /// this list — it names no study, so there is nothing to look up and
    /// nothing that could turn out to be wrong. It lives in
    /// `vagueAuthorityCues` instead.
    static let citationCues: [String] = [
        "according to", "a study", "the study", "the trial", "the experiment",
        "research from", "researchers at", "researchers found",
        "a meta analysis", "meta analysis", "peer reviewed", "published in",
        "the data from", "data from", "the report", "a report",
        "a survey", "survey of", "the census", "census data", "a poll",
        "poll found", "randomized", "randomised", "controlled trial", "clinical trial",
        "the paper", "a paper", "the journal", "government figures", "official figures",
        "statistics from", "the numbers from", "a review of", "systematic review",
        "as documented", "on the record", "the transcript", "the filing"
    ]

    /// Named institutions and publications. Not exhaustive and not meant to
    /// be — this is a signal that the speaker named *something*, not a
    /// judgement about whether the source is good.
    static let namedSources: [String] = [
        "who", "cdc", "nih", "fda", "epa", "nasa", "noaa", "ipcc", "iea", "oecd",
        "imf", "world bank", "united nations", "eurostat", "ons", "bls",
        "bureau of labor statistics", "census bureau", "pew", "gallup", "yougov",
        "nber", "cochrane", "lancet", "nature", "science magazine", "nejm",
        "new england journal", "bmj", "jama", "harvard", "stanford", "mit",
        "oxford", "cambridge", "yale", "princeton", "berkeley", "johns hopkins",
        "supreme court", "congressional budget office", "cbo", "reuters",
        "associated press", "bloomberg", "financial times"
    ]

    /// Confident-sounding attributions with no attributable source behind
    /// them. These are the raw material of `appealToAuthority`.
    static let vagueAuthorityCues: [String] = [
        "studies show", "studies have shown", "study after study",
        "research shows", "research has shown", "data shows", "the data shows",
        "science says", "the science says", "the science is settled",
        "experts say", "experts agree", "the experts are clear",
        "scientists say", "scientists agree", "doctors say", "economists agree",
        "its been proven", "it has been proven", "its scientifically proven",
        "proven fact", "any expert will tell you", "everyone in the field",
        "my professor said", "a doctor told me", "i read somewhere",
        "trust me im", "trust me i"
    ]

    /// "who" is a legitimate English word as well as an agency, so it is
    /// only counted as a source when it appears in upper case in the
    /// original text. `EvidenceAnalyzer` handles that; this set records
    /// which entries need the check.
    static let caseSensitiveSources: Set<String> = ["who", "ons", "bls", "cbo", "nih", "mit"]

    static let quantityWords: [String] = [
        "percent", "percentage", "per cent", "million", "billion", "trillion",
        "thousand", "hundred", "dozen", "times more", "times less", "times higher",
        "times lower", "double", "triple", "half of", "a third of", "a quarter of",
        "majority of", "minority of", "average of", "median", "per capita",
        "per year", "per person", "per hour", "rate of"
    ]

    static let hedges: [String] = [
        "i think", "i feel like", "i guess", "maybe", "perhaps", "probably",
        "possibly", "it seems", "seems like", "sort of", "kind of", "kinda",
        "i believe", "i would say", "arguably", "more or less", "pretty much",
        "i heard", "someone told me", "apparently", "supposedly", "allegedly",
        "could be", "might be", "not sure but", "correct me if"
    ]

    static let absolutes: [String] = [
        "always", "never", "everyone", "everybody", "nobody", "no one",
        "everything", "nothing", "all of them", "none of them", "every single",
        "without exception", "obviously", "clearly", "undeniably", "definitely",
        "absolutely", "certainly", "any reasonable person", "it is a fact that",
        "the fact is", "period", "end of story"
    ]

    /// Words that mark reasoning structure. Their presence is the cheapest
    /// available proxy for an argument that has parts rather than a
    /// paragraph that has volume.
    static let connectives: [String] = [
        "because", "therefore", "so that means", "which means", "as a result",
        "consequently", "for example", "for instance", "in other words",
        "first", "second", "third", "finally", "however", "although", "whereas",
        "on the other hand", "the reason is", "this shows", "which suggests",
        "even if", "granted", "to be clear", "specifically"
    ]

    static let fillers: [String] = [
        "um", "uh", "like i said", "you know", "i mean", "sort of", "kind of",
        "or whatever", "and stuff", "anyway", "whatever", "blah"
    ]

    // MARK: - Turn-taking

    /// Cues that a turn is engaging with what was just said, rather than
    /// reading the next prepared paragraph.
    static let rebuttalCues: [String] = [
        "you said", "you claimed", "you argued", "your point", "your claim",
        "your argument", "you mentioned", "thats not", "that is not", "that isnt",
        "thats wrong", "that is wrong", "but that", "however", "on the contrary",
        "actually no", "the problem with that", "that ignores", "that assumes",
        "that doesnt follow", "that does not follow", "you are assuming",
        "youre assuming", "even if that were true", "granting that", "conceding that",
        "to your point", "in response to", "answering that", "as you put it",
        "the study you", "the number you", "where did that", "whats your source",
        "wheres the evidence"
    ]

    /// Explicit concessions. Worth points: conceding a point you cannot
    /// answer is a sign of good faith, not weakness.
    static let concessionCues: [String] = [
        "youre right", "you are right", "thats fair", "fair point", "good point",
        "i concede", "i will grant", "ill grant", "i accept that", "i was wrong",
        "i take that back", "thats true", "i agree that", "point taken"
    ]

    // MARK: - Tone

    static let insults: [String] = [
        "idiot", "idiotic", "moron", "moronic", "stupid", "dumb", "clueless",
        "ignorant", "delusional", "brainwashed", "sheep", "shill", "liar",
        "pathetic", "ridiculous person", "childish", "immature", "incompetent",
        "insane", "crazy", "lunatic", "snowflake", "fascist", "communist",
        "uneducated", "illiterate", "brain dead", "braindead", "smooth brain"
    ]

    static let dismissals: [String] = [
        "you clearly dont", "you obviously dont", "you have no idea",
        "you dont even know", "you wouldnt understand", "typical of you",
        "you people", "people like you", "coming from you", "of course you would",
        "do your own research", "educate yourself", "google it", "read a book",
        "grow up", "get real", "be serious", "youre not qualified",
        "you dont get to", "stay in your lane"
    ]

    static let personReferents: Set<String> = Set(
        [
            "you", "youre", "your", "yourself", "he", "him", "his", "she", "her",
            "they", "them", "their", "opponent", "opponents"
        ]
    )

    // MARK: - Normative and definitional markers

    static let normativeMarkers: [String] = [
        "should", "shouldnt", "ought to", "must", "have to", "need to",
        "its wrong", "its right", "immoral", "unethical", "unfair", "unjust",
        "deserve", "deserves", "better to", "worse to", "the moral", "morally",
        "we owe", "obligation", "duty", "rights", "acceptable", "unacceptable",
        "worth it", "not worth it", "matters more", "more important than"
    ]

    static let definitionalMarkers: [String] = [
        "is defined as", "by definition", "means that", "the definition of",
        "what we mean by", "in other words that means", "counts as",
        "the term", "technically speaking"
    ]

    static let predictiveMarkers: [String] = [
        "will", "wont", "is going to", "are going to", "by 2030", "by 2040",
        "by 2050", "in the future", "eventually", "someday", "next year",
        "in ten years", "in five years", "over time"
    ]

    static let causalMarkers: [String] = [
        "causes", "caused", "causing", "leads to", "led to", "results in",
        "resulted in", "because of", "due to", "drives", "driven by",
        "makes people", "creates", "produces", "triggers", "responsible for",
        "the reason for", "thanks to", "as a result of"
    ]

    static let anecdoteMarkers: [String] = [
        "my friend", "my cousin", "my brother", "my sister", "my mom",
        "my mother", "my dad", "my father", "my neighbor", "my neighbour",
        "my coworker", "my roommate", "i know a guy", "i know someone",
        "when i was", "back when i", "in my experience", "personally ive",
        "i once", "the other day", "happened to me", "i saw someone"
    ]

    static let abbreviations: Set<String> = Set(
        [
            "dr", "mr", "mrs", "ms", "prof", "sr", "jr", "st", "mt", "vs",
            "etc", "eg", "ie", "inc", "ltd", "co", "fig", "vol", "no",
            "approx", "est", "dept", "univ", "assn", "govt", "sen", "rep", "gen"
        ]
    )
}
