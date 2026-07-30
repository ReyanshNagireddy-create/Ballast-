import SwiftUI

enum SetupKind: Hashable {
    case twoPlayer
    case practice

    var title: String {
        self == .twoPlayer ? "Live debate" : "Practice with AI"
    }
}

struct HomeView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                hero
                actions
                if !store.debates.isEmpty {
                    recent
                }
                sample
            }
            .padding()
        }
        .navigationTitle("Veritas")
        .navigationDestination(for: SetupKind.self) { SetupView(kind: $0) }
        .navigationDestination(for: DebateSetup.self) { setup in
            // Built here rather than inside the room so the session can be
            // handed the model exactly once, at creation.
            DebateRoomView(setup: setup, model: store.languageModel())
        }
        .navigationDestination(for: SavedDebate.self) { ReportView(debate: $0) }
    }

    // MARK: Pieces

    private var hero: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Settle debates with evidence, not volume.")
                .font(.largeTitle.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
            Text("Two people argue. Veritas listens to the whole thing, then shows exactly where each side was supported, where the reasoning slipped, and which points were never answered.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.bottom, 4)
    }

    private var actions: some View {
        VStack(spacing: 12) {
            NavigationLink(value: SetupKind.twoPlayer) {
                actionRow(
                    title: "Start a debate",
                    detail: "Two people, one device. Timed turns, live notes, full report at the end.",
                    symbol: "person.2",
                    tint: Theme.accent
                )
            }
            .buttonStyle(.plain)

            NavigationLink(value: SetupKind.practice) {
                actionRow(
                    title: "Practice against Veritas",
                    detail: "Pick an opponent and a difficulty. The easier ones plant a fallacy each turn for you to catch.",
                    symbol: "brain.head.profile",
                    tint: Theme.sideB
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func actionRow(title: String, detail: String, symbol: String, tint: Color) -> some View {
        Card(tint: tint) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: symbol)
                    .font(.title2)
                    .foregroundStyle(tint)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    private var recent: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "Recent debates")
            ForEach(store.debates.prefix(3)) { debate in
                NavigationLink(value: debate) {
                    DebateRow(debate: debate)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var sample: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(
                title: "Not sure what you get?",
                subtitle: "A finished report from a real four-turn debate about homework."
            )
            NavigationLink(value: HomeView.sampleDebate) {
                Card {
                    HStack {
                        Image(systemName: "doc.text.magnifyingglass")
                            .foregroundStyle(Theme.accent)
                        Text("See a sample report")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.primary)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            .buttonStyle(.plain)
        }
    }

    /// Built once so that pushing it twice does not produce two routes.
    static let sampleDebate = SavedDebate(
        report: Referee.analyze(SampleDebates.homework),
        userSide: nil,
        isPractice: false,
        opponentName: nil
    )
}

/// One row in a list of finished debates.
struct DebateRow: View {
    var debate: SavedDebate

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text(debate.report.topic)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 6) {
                    if debate.report.verdict.isDraw {
                        Pill("Draw", color: .secondary, symbol: "equal")
                    } else {
                        Pill(
                            debate.report.winnerName,
                            color: Theme.color(for: debate.report.verdict.winner ?? .a),
                            symbol: "trophy"
                        )
                    }
                    if debate.isPractice {
                        Pill("Practice", color: Theme.sideB, symbol: "brain.head.profile")
                    }
                    Spacer(minLength: 0)
                    Text(debate.report.generatedAt, style: .date)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

#Preview {
    NavigationStack { HomeView() }
        .environmentObject(AppStore())
}
