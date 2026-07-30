import SwiftUI

/// The live debate: turn indicator, clock, transcript, note feed, input.
struct DebateRoomView: View {

    private enum Panel: String, CaseIterable, Identifiable {
        case transcript = "Transcript"
        case notes = "Notes"
        var id: String { rawValue }
    }

    @EnvironmentObject private var store: AppStore
    @StateObject private var session: DebateSession
    @State private var panel: Panel = .transcript
    @State private var showEndConfirmation = false

    init(setup: DebateSetup, model: LanguageModel?) {
        _session = StateObject(wrappedValue: DebateSession(setup: setup, model: model))
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            content
            Divider()
            footer
        }
        .navigationTitle(session.topic)
        .toolbar {
            ToolbarItem {
                Button("End") { showEndConfirmation = true }
                    .disabled(session.report != nil || !session.hasStarted)
            }
        }
        .confirmationDialog(
            "End the debate now?",
            isPresented: $showEndConfirmation,
            titleVisibility: .visible
        ) {
            Button("End and score it", role: .destructive) { session.endEarly() }
            Button("Keep going", role: .cancel) {}
        } message: {
            Text("Veritas will report on what was said so far, and will say plainly that the transcript was short.")
        }
        .onAppear { session.begin() }
        .onDisappear { session.stopClock() }
        .onChange(of: session.report) { _, report in
            guard report != nil, let saved = session.savedDebate() else { return }
            store.save(saved)
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                speakerChip(.a)
                speakerChip(.b)
            }

            if session.report == nil {
                HStack {
                    Text(turnLabel)
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    Text(session.clockLabel)
                        .font(.system(.title3, design: .monospaced))
                        .foregroundStyle(session.timeIsUp ? Theme.problem : .primary)
                }
                if session.limit != nil {
                    ScoreBar(
                        value: (1 - session.clockProgress) * 100,
                        tint: session.timeIsUp ? Theme.problem : Theme.color(for: session.currentSide)
                    )
                }
                if session.timeIsUp {
                    Text("Time. Finish the sentence you are on — Veritas will not cut you off.")
                        .font(.caption)
                        .foregroundStyle(Theme.problem)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding()
    }

    private func speakerChip(_ side: Side) -> some View {
        let isActive = session.report == nil && session.currentSide == side
        return VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 5) {
                Circle()
                    .fill(Theme.color(for: side))
                    .frame(width: 8, height: 8)
                Text(session.name(of: side))
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
            }
            Text(isActive ? "Speaking" : "Waiting")
                .font(.caption2)
                .foregroundStyle(isActive ? Theme.color(for: side) : .secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(Theme.color(for: side).opacity(isActive ? 0.16 : 0.06))
        )
    }

    private var turnLabel: String {
        if session.isOpponentThinking { return "\(session.name(of: session.currentSide)) is thinking…" }
        if let remaining = session.referee.turnsRemaining, remaining > 0 {
            return "\(session.name(of: session.currentSide))'s turn · \(remaining) left"
        }
        return "\(session.name(of: session.currentSide))'s turn"
    }

    // MARK: Content

    private var content: some View {
        VStack(spacing: 0) {
            Picker("View", selection: $panel) {
                ForEach(Panel.allCases) { option in
                    Text(option.rawValue).tag(option)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.top, 8)

            ScrollView {
                switch panel {
                case .transcript: transcriptList
                case .notes: notesList
                }
            }
        }
    }

    private var transcriptList: some View {
        LazyVStack(alignment: .leading, spacing: 12) {
            if session.transcript.turns.isEmpty {
                EmptyStateView(
                    symbol: "text.bubble",
                    title: "Nothing said yet",
                    message: "\(session.name(of: session.currentSide)) opens. Say what you are arguing and why."
                )
            }
            ForEach(session.transcript.turns) { turn in
                TurnBubble(
                    turn: turn,
                    name: session.name(of: turn.side),
                    claims: session.referee.verdicts(forTurn: turn.id)
                )
            }
        }
        .padding()
    }

    private var notesList: some View {
        LazyVStack(alignment: .leading, spacing: 10) {
            if session.feed.isEmpty {
                EmptyStateView(
                    symbol: "checkmark.seal",
                    title: "Nothing flagged yet",
                    message: "Veritas raises a note the moment something is asserted without support, or the reasoning slips. It never interrupts the turn."
                )
            }
            ForEach(session.feed) { finding in
                FindingCard(finding: finding, name: session.name(of: finding.side))
            }
        }
        .padding()
    }

    // MARK: Footer

    @ViewBuilder
    private var footer: some View {
        if session.isBuildingReport {
            HStack(spacing: 10) {
                ProgressView()
                Text("Scoring the debate…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding()
        } else if let report = session.report {
            NavigationLink(value: savedDebate(for: report)) {
                Text("Open the report")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Theme.accent.opacity(0.18))
                    )
            }
            .buttonStyle(.plain)
            .padding()
        } else if session.isOpponentThinking || !session.isUsersTurn {
            HStack(spacing: 10) {
                ProgressView()
                Text("\(session.name(of: session.currentSide)) is composing a reply…")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding()
        } else {
            composer
        }
    }

    private var composer: some View {
        VStack(spacing: 8) {
            TextEditor(text: $session.draft)
                .frame(minHeight: 74, maxHeight: 150)
                .font(.body)
                .scrollContentBackground(.hidden)
                .padding(6)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.secondary.opacity(0.10))
                )
                .overlay(alignment: .topLeading) {
                    if session.draft.isEmpty {
                        Text("Make your argument…")
                            .font(.body)
                            .foregroundStyle(.tertiary)
                            .padding(.horizontal, 11)
                            .padding(.vertical, 14)
                            .allowsHitTesting(false)
                    }
                }

            HStack {
                #if os(iOS)
                DictationButton(text: $session.draft)
                #endif
                Spacer()
                Text("\(wordCount) words")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Button {
                    session.submitUserTurn()
                } label: {
                    Label("Send turn", systemImage: "paperplane.fill")
                }
                .buttonStyle(.borderedProminent)
                .disabled(session.draft.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding()
    }

    private var wordCount: Int {
        session.draft.split(whereSeparator: { $0.isWhitespace }).count
    }

    private func savedDebate(for report: DebateReport) -> SavedDebate {
        session.savedDebate() ?? SavedDebate(
            report: report,
            userSide: nil,
            isPractice: false,
            opponentName: nil
        )
    }
}

/// One turn in the transcript, with its live support verdicts underneath.
struct TurnBubble: View {
    var turn: Turn
    var name: String
    var claims: [Claim]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Circle()
                    .fill(Theme.color(for: turn.side))
                    .frame(width: 7, height: 7)
                Text(name)
                    .font(.caption.weight(.semibold))
                Spacer()
                Text(ReportFormatter.timestamp(turn.offset))
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
            }

            Text(turn.text)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)

            if !claims.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(claims) { claim in
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: claim.verdict.symbol)
                                .font(.caption2)
                                .foregroundStyle(Theme.color(for: claim.verdict))
                            Text(claim.verdict.label)
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(Theme.color(for: claim.verdict))
                            Text(Tokenizer.excerpt(claim.text, limit: 70))
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
                .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Theme.color(for: turn.side).opacity(0.08))
        )
    }
}

/// One note in the live feed, or one row in the report's finding list.
struct FindingCard: View {
    var finding: Finding
    var name: String
    var showsCoaching: Bool = true

    var body: some View {
        Card(tint: Theme.color(for: finding.kind)) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: finding.kind.symbol)
                        .font(.caption)
                        .foregroundStyle(Theme.color(for: finding.kind))
                    Text(finding.title)
                        .font(.subheadline.weight(.semibold))
                    Spacer(minLength: 0)
                    Pill(name, color: Theme.color(for: finding.side))
                }

                Text("\u{201C}\(finding.quote)\u{201D}")
                    .font(.callout.italic())
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text(finding.detail)
                    .font(.caption)
                    .fixedSize(horizontal: false, vertical: true)

                if showsCoaching, !finding.coaching.isEmpty {
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "lightbulb")
                            .font(.caption2)
                            .foregroundStyle(Theme.accent)
                        Text(finding.coaching)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }
}
