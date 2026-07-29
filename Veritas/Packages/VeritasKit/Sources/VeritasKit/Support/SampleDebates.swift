import Foundation

/// Fixed transcripts for previews, tests and the app's demo mode.
///
/// Written to exercise the engine honestly: each one contains real
/// argument alongside the specific failures the detectors are meant to
/// catch, so a preview shows a report worth reading rather than six
/// scores of 100.
public enum SampleDebates {

    public static func build(
        topic: String,
        nameA: String,
        positionA: String,
        nameB: String,
        positionB: String,
        turns: [(Side, String)],
        secondsPerTurn: Int = 90
    ) -> Transcript {
        var transcript = Transcript(
            topic: topic,
            format: DebateFormat(
                secondsPerTurn: secondsPerTurn,
                turnsPerSide: max(1, turns.count / 2),
                mode: .text
            ),
            participants: [
                Participant(side: .a, name: nameA, position: positionA),
                Participant(side: .b, name: nameB, position: positionB)
            ]
        )
        for (side, text) in turns {
            transcript.append(side, text: text, duration: TimeInterval(secondsPerTurn))
        }
        transcript.finishedAt = transcript.startedAt.addingTimeInterval(
            TimeInterval(secondsPerTurn * turns.count)
        )
        return transcript
    }

    /// The default demo. A loses on evidence and tone while making a real
    /// point; B is drier but sources one claim and answers directly.
    public static let homework: Transcript = build(
        topic: "Should primary schools stop setting homework?",
        nameA: "Maya",
        positionA: "Primary schools should stop setting homework",
        nameB: "Daniel",
        positionB: "Primary schools should keep setting homework",
        turns: [
            (.a, """
            Homework in primary school is pointless and everyone knows it. My nephew is eight and he \
            spends an hour every night on worksheets while his parents argue with him about it, so it is \
            clearly doing more harm than good. Kids that age need to play. Every teacher I have spoken to \
            says the same thing.
            """),
            (.b, """
            You said homework is pointless and that everyone knows it, and I think that is the part worth \
            slowing down on. According to a 2006 meta-analysis by Cooper, the measured effect of homework \
            on achievement in primary school is close to zero — so on the narrow academic question you are \
            largely right. Where I disagree is the conclusion. The point of ten minutes of reading at home \
            is not test scores, it is the habit, and habits set at seven are cheaper to build than at \
            fourteen.
            """),
            (.a, """
            So you are saying we should make every child work all evening because of some habit. That is \
            exactly the kind of thinking that gives us burned out ten year olds. Once you accept homework \
            at eight, before you know it they are doing three hours a night in secondary and nobody stops \
            it. And frankly if you had actually sat with a crying child over a maths sheet you would not be \
            so relaxed about it.
            """),
            (.b, """
            I did not say all evening, and I would not defend three hours — I will grant you that a lot of \
            what gets set is busywork and should go. My claim is narrower than the one you answered: ten \
            minutes of reading, no marking, no consequences for not doing it. You have not addressed the \
            habit argument yet. What evidence would change your mind about the reading specifically?
            """)
        ]
    )

    /// A closer, cleaner debate — used to show what a draw looks like.
    public static let socialMedia: Transcript = build(
        topic: "Should social media have a minimum age of sixteen?",
        nameA: "Priya",
        positionA: "Social media should have a minimum age of sixteen",
        nameB: "Tom",
        positionB: "A minimum age of sixteen is the wrong tool",
        turns: [
            (.a, """
            The case for sixteen is about capacity, not screens. Adolescent risk processing is still \
            developing, and we already accept that reasoning for driving and for alcohol. A platform \
            designed to maximise engagement is not a neutral environment for a twelve year old, and the \
            companies have had a decade to fix it voluntarily.
            """),
            (.b, """
            You are right that the design is adversarial, and I will concede the engagement point entirely. \
            Where the argument runs into trouble is enforcement. An age limit that is checked by asking \
            means nothing, and an age limit that is checked properly means identity verification for \
            everybody, including adults. So the real question is which trade you prefer, and that is a cost \
            your side has not named.
            """),
            (.a, """
            That is a fair challenge on enforcement. My answer is that we already do age verification for \
            gambling and it is imperfect but not useless — imperfect enforcement still shifts behaviour at \
            the margin. On the privacy cost, I would accept device level attestation rather than uploading \
            documents, which keeps the identity check off the platform entirely.
            """),
            (.b, """
            Device level attestation is a better answer than the one I expected, and it does reduce the \
            privacy cost. I still think the age line is the wrong instrument, because the harm you are \
            describing is a design harm and it does not stop at sixteen. Regulate the recommendation \
            system and you help the seventeen year olds too. Why pick the tool that only protects some of \
            the people being hurt?
            """)
        ]
    )

    public static let all: [Transcript] = [homework, socialMedia]
}
