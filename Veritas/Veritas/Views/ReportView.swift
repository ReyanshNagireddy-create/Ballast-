import SwiftUI

struct ReportView: View {

    private enum Tab: Hashable, CaseIterable, Identifiable {
        case overview
        case sideA
        case sideB
        case transcript
        var id: Self { self }
    }

    let debate: SavedDebate
    @State private var tab: Tab = .overview

    private var report: DebateReport { debate.report }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                verdictCard
                picker
                switch tab {
                case .overview: overview
                case .sideA: speaker(.a)
                case .sideB: speaker(.b)
                case .transcript: transcript
                }
            }
            .padding()
        }
        .navigationTitle("Report")
        .toolbar {
            ToolbarItem {
                ShareLink(item: ReportFormatter.markdown(report)) {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
    }

    // MARK: Verdict

    private var winnerTint: Color? {
        guard let winner = report.verdict.winner else { return nil }
        return Theme.color(for: winner)
    }

    private var verdictCard: some View {
        Card(tint: winnerTint ?? .secondary) {
            VStack(alignment: .leading, spacing: 12) {
                Text(report.topic)
                    .font(.headline)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(report.verdict.isDraw ? "Draw" : report.winnerName)
                        .font(.largeTitle.weight(.semibold))
                        .foregroundStyle(winnerTint ?? Color.primary)
                    if !report.verdict.isDraw {
                        Text("by \(Int(report.verdict.margin.rounded()))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Pill(
                    report.verdict.confidenceLabel,
                    color: report.verdict.confidence >= 0.5 ? Theme.supported : Theme.caution,
                    symbol: "gauge.medium"
                )

                Text(report.verdict.rationale)
                    .font(.callout)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var picker: some View {
        Picker("Section", selection: $tab) {
            Text("Overview").tag(Tab.overview)
            Text(shortName(.a)).tag(Tab.sideA)
            Text(shortName(.b)).tag(Tab.sideB)
            Text("Replay").tag(Tab.transcript)
        }
        .pickerStyle(.segmented)
    }

    private func shortName(_ side: Side) -> String {
        let name = report.transcript.name(of: side)
        return name.count > 10 ? String(name.prefix(9)) + "…" : name
    }

    // MARK: Overview

    private var overview: some View {
        VStack(alignment: .leading, spacing: 18) {
            Card {
                VStack(alignment: .leading, spacing: 14) {
                    SectionHeader(
                        title: "The six scores",
                        subtitle: "Every number here comes from sentences you can go and read."
                    )
                    ForEach(Dimension.allCases, id: \.self) { dimension in
                        dimensionRow(dimension)
                    }
                    Divider()
                    HStack {
                        Text("Overall")
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text("\(Int(report.scorecard(.a).overall.rounded()))")
                            .font(.subheadline.weight(.bold).monospacedDigit())
                            .foregroundStyle(Theme.sideA)
                        Text("·")
                            .foregroundStyle(.secondary)
                        Text("\(Int(report.scorecard(.b).overall.rounded()))")
                            .font(.subheadline.weight(.bold).monospacedDigit())
                            .foregroundStyle(Theme.sideB)
                    }
                }
            }

            if !report.sharedGround.isEmpty {
                Card(tint: Theme.supported) {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(title: "Common ground")
                        ForEach(Array(report.sharedGround.enumerated()), id: \.offset) { _, line in
                            HStack(alignment: .top, spacing: 6) {
                                Image(systemName: "arrow.triangle.merge")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.supported)
                                Text(line)
                                    .font(.caption)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
            }

            Card(tint: Theme.neutral) {
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(
                        title: "What this report is not",
                        subtitle: "The limits, up front rather than in a footnote."
                    )
                    ForEach(Array(report.caveats.enumerated()), id: \.offset) { _, caveat in
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: "info.circle")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Text(caveat)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
    }

    private func dimensionRow(_ dimension: Dimension) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Label(dimension.title, systemImage: dimension.symbol)
                    .font(.caption.weight(.medium))
                Spacer()
                Text("\(Int(report.scorecard(.a).value(for: dimension).rounded()))")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Theme.sideA)
                Text("\(Int(report.scorecard(.b).value(for: dimension).rounded()))")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(Theme.sideB)
            }
            ScoreBar(value: report.scorecard(.a).value(for: dimension), tint: Theme.sideA)
            ScoreBar(value: report.scorecard(.b).value(for: dimension), tint: Theme.sideB)
            Text(dimension.blurb)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: Per speaker

    private func speaker(_ side: Side) -> some View {
        let person = report.speaker(side)
        return VStack(alignment: .leading, spacing: 16) {
            Card(tint: Theme.color(for: side)) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(person.name)
                            .font(.headline)
                        Spacer()
                        Text(person.scorecard.grade)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(Theme.color(forScore: person.scorecard.overall))
                    }
                    statsGrid(person.stats)
                    HStack(spacing: 8) {
                        Pill("Best: \(person.scorecard.strongest.title)", color: Theme.supported)
                        Pill("Work on: \(person.scorecard.weakest.title)", color: Theme.caution)
                    }
                }
            }

            if let best = person.bestArgument {
                highlightCard(title: "Strongest moment", highlight: best, tint: Theme.supported, symbol: "star")
            }
            if let weakest = person.weakestArgument {
                highlightCard(title: "Weakest moment", highlight: weakest, tint: Theme.problem, symbol: "exclamationmark.triangle")
            }

            if !person.suggestions.isEmpty {
                Card(tint: Theme.accent) {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionHeader(
                            title: "Do this next time",
                            subtitle: "Ordered by how much it would actually move the score."
                        )
                        ForEach(Array(person.suggestions.enumerated()), id: \.offset) { index, suggestion in
                            HStack(alignment: .top, spacing: 8) {
                                Text("\(index + 1)")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(Theme.accent)
                                    .frame(width: 14, alignment: .leading)
                                Text(suggestion)
                                    .font(.caption)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }
            }

            if !person.missedOpportunities.isEmpty {
                Card(tint: Theme.caution) {
                    VStack(alignment: .leading, spacing: 8) {
                        SectionHeader(
                            title: "Points you never answered",
                            subtitle: "Everyone watching read these as the ones you could not answer."
                        )
                        ForEach(person.missedOpportunities) { highlight in
                            Text("\u{201C}\(highlight.quote)\u{201D}")
                                .font(.caption.italic())
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            let negatives = person.findings.negativeOnly
            if !negatives.isEmpty {
                SectionHeader(title: "Everything flagged", subtitle: "\(negatives.count) findings, worst first.")
                ForEach(negatives) { finding in
                    FindingCard(finding: finding, name: person.name)
                }
            }

            let positives = person.findings.filter { $0.kind.isPositive }
            if !positives.isEmpty {
                SectionHeader(title: "What worked")
                ForEach(positives) { finding in
                    FindingCard(finding: finding, name: person.name, showsCoaching: false)
                }
            }
        }
    }

    private func statsGrid(_ stats: SpeakerStats) -> some View {
        HStack(alignment: .top, spacing: 0) {
            statCell("\(stats.turns)", "turns")
            statCell("\(stats.words)", "words")
            statCell("\(stats.sourcedClaims)", "sourced")
            statCell("\(stats.unsupportedClaims)", "unsupported")
            statCell("\(Int((stats.engagementRate * 100).rounded()))%", "engaged")
        }
    }

    private func statCell(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.weight(.semibold).monospacedDigit())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func highlightCard(title: String, highlight: Highlight, tint: Color, symbol: String) -> some View {
        Card(tint: tint) {
            VStack(alignment: .leading, spacing: 8) {
                Label(title, systemImage: symbol)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(tint)
                Text("\u{201C}\(highlight.quote)\u{201D}")
                    .font(.callout.italic())
                    .fixedSize(horizontal: false, vertical: true)
                Text(highlight.reason)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: Replay

    private var transcript: some View {
        VStack(alignment: .leading, spacing: 14) {
            SectionHeader(
                title: "Replay",
                subtitle: "Every turn, with what Veritas flagged at that moment."
            )
            ForEach(report.transcript.turns) { turn in
                VStack(alignment: .leading, spacing: 8) {
                    TurnBubble(
                        turn: turn,
                        name: report.transcript.name(of: turn.side),
                        claims: report.claims.filter { $0.turnID == turn.id && $0.verdict != .notApplicable }
                    )
                    ForEach(report.findings.filter { $0.turnID == turn.id }) { finding in
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: finding.kind.symbol)
                                .font(.caption2)
                                .foregroundStyle(Theme.color(for: finding.kind))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(finding.title)
                                    .font(.caption.weight(.medium))
                                Text(finding.detail)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .padding(.leading, 8)
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        ReportView(debate: HomeView.sampleDebate)
    }
    .environmentObject(AppStore())
}
