import SwiftUI
import VeritasKit

/// Progress over time, plus every debate you have finished.
struct HistoryView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if store.debates.isEmpty {
                    EmptyStateView(
                        symbol: "chart.bar",
                        title: "No debates yet",
                        message: "Finish one and this fills in: your averages, the fallacies you reach for most, and whether any of it is improving."
                    )
                } else {
                    summary
                    averages
                    habits
                    list
                }
            }
            .padding()
        }
        .navigationTitle("Progress")
        .navigationDestination(for: SavedDebate.self) { ReportView(debate: $0) }
    }

    private var progress: AppStore.Progress { store.progress }

    // MARK: Sections

    private var summary: some View {
        Card {
            HStack(alignment: .top, spacing: 0) {
                summaryCell("\(progress.debateCount)", "debates")
                summaryCell("\(progress.practiceCount)", "practice")
                summaryCell(winRateLabel, "win rate")
                summaryCell(String(format: "%.1f", progress.fallaciesPerDebate), "fallacies/debate")
            }
        }
    }

    private var winRateLabel: String {
        guard let rate = progress.winRate else { return "—" }
        return "\(Int((rate * 100).rounded()))%"
    }

    private func summaryCell(_ value: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.title3.weight(.semibold).monospacedDigit())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var averages: some View {
        if !progress.averages.isEmpty {
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader(
                        title: "Your averages",
                        subtitle: "Across every debate where Veritas knew which side was yours."
                    )
                    ForEach(Dimension.allCases, id: \.self) { dimension in
                        if let value = progress.averages[dimension] {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Label(dimension.title, systemImage: dimension.symbol)
                                        .font(.caption.weight(.medium))
                                    Spacer()
                                    Text("\(Int(value.rounded()))")
                                        .font(.caption.monospacedDigit())
                                        .foregroundStyle(Theme.color(forScore: value))
                                }
                                ScoreBar(value: value)
                            }
                        }
                    }

                    if progress.trend.count >= 2 {
                        Divider()
                        TrendLine(values: progress.trend)
                            .frame(height: 46)
                        Text(trendLabel)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private var trendLabel: String {
        guard let first = progress.trend.first, let last = progress.trend.last else { return "" }
        let change = last - first
        if abs(change) < 2 { return "Overall score, oldest to newest. Flat so far." }
        let direction = change > 0 ? "up" : "down"
        return "Overall score, oldest to newest — \(direction) \(Int(abs(change).rounded())) points since your first debate."
    }

    @ViewBuilder
    private var habits: some View {
        if !progress.commonFallacies.isEmpty {
            Card(tint: Theme.caution) {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(
                        title: "What you reach for",
                        subtitle: "The reasoning shortcuts that show up most often in your turns."
                    )
                    ForEach(Array(progress.commonFallacies.prefix(4).enumerated()), id: \.offset) { _, entry in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(entry.0.title)
                                    .font(.caption.weight(.medium))
                                Spacer()
                                Text("\(entry.1)×")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            Text(entry.0.coaching)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
    }

    private var list: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "All debates")
            ForEach(store.debates) { debate in
                NavigationLink(value: debate) {
                    DebateRow(debate: debate)
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button("Delete", role: .destructive) { store.delete(debate) }
                }
            }
        }
    }
}

/// A minimal sparkline. No axes, no legend — it exists to answer one
/// question, which is whether the line is going up.
struct TrendLine: View {
    var values: [Double]

    var body: some View {
        GeometryReader { proxy in
            let points = self.points(in: proxy.size)
            ZStack {
                Path { path in
                    guard let first = points.first else { return }
                    path.move(to: first)
                    for point in points.dropFirst() {
                        path.addLine(to: point)
                    }
                }
                .stroke(Theme.accent, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))

                if let last = points.last {
                    Circle()
                        .fill(Theme.accent)
                        .frame(width: 6, height: 6)
                        .position(last)
                }
            }
        }
        .accessibilityLabel(Text("Overall score trend"))
    }

    private func points(in size: CGSize) -> [CGPoint] {
        guard values.count > 1 else { return [] }
        let lowest = values.min() ?? 0
        let highest = values.max() ?? 100
        let span = max(1, highest - lowest)
        let step = size.width / CGFloat(values.count - 1)

        return values.enumerated().map { index, value in
            let fraction = (value - lowest) / span
            return CGPoint(
                x: CGFloat(index) * step,
                y: size.height - CGFloat(fraction) * size.height
            )
        }
    }
}

#Preview {
    NavigationStack { HistoryView() }
        .environmentObject(AppStore())
}
