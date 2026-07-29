import SwiftUI
import VeritasKit

/// The reference: every fallacy Veritas can name, and what each of the six
/// scores actually measures.
///
/// This is here because naming a fallacy in a report is useless if the
/// reader has to go and look it up somewhere else. Same text, same
/// mechanism, same fix — one source, used by the report and by this screen.
struct LibraryView: View {
    @State private var query = ""

    var body: some View {
        List {
            Section {
                ForEach(Dimension.allCases, id: \.self) { dimension in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Label(dimension.title, systemImage: dimension.symbol)
                                .font(.subheadline.weight(.medium))
                            Spacer()
                            Text("\(Int((dimension.weight * 100).rounded()))%")
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        Text(dimension.blurb)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.vertical, 2)
                }
            } header: {
                Text("How the score is built")
            } footer: {
                Text("Persuasiveness is deliberately not measured. How convincing an argument felt is the thing people are already worst at judging, and scoring it would reward whoever spoke loudest.")
            }

            ForEach(Fallacy.Family.allCases, id: \.self) { family in
                let items = fallacies(in: family)
                if !items.isEmpty {
                    Section(family.title) {
                        ForEach(items, id: \.self) { fallacy in
                            NavigationLink(value: fallacy) {
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack {
                                        Text(fallacy.title)
                                            .font(.subheadline.weight(.medium))
                                        Spacer()
                                        Pill(
                                            fallacy.severity.title,
                                            color: Theme.color(for: fallacy.severity)
                                        )
                                    }
                                    Text(fallacy.definition)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                }
            }
        }
        .searchable(text: $query, prompt: "Search fallacies")
        .navigationTitle("Library")
        .navigationDestination(for: Fallacy.self) { FallacyDetailView(fallacy: $0) }
    }

    private func fallacies(in family: Fallacy.Family) -> [Fallacy] {
        let trimmed = query.trimmingCharacters(in: .whitespaces).lowercased()
        return Fallacy.allCases.filter { fallacy in
            guard fallacy.family == family else { return false }
            guard !trimmed.isEmpty else { return true }
            return fallacy.title.lowercased().contains(trimmed)
                || fallacy.definition.lowercased().contains(trimmed)
        }
    }
}

struct FallacyDetailView: View {
    let fallacy: Fallacy

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Card(tint: Theme.color(for: fallacy.severity)) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(fallacy.title)
                            .font(.title2.weight(.semibold))
                        Text(fallacy.definition)
                            .font(.callout)
                            .fixedSize(horizontal: false, vertical: true)
                        HStack(spacing: 8) {
                            Pill(fallacy.severity.title, color: Theme.color(for: fallacy.severity))
                            Pill(fallacy.family.title)
                        }
                    }
                }

                block(
                    title: "Why the argument fails",
                    body: fallacy.why,
                    symbol: "questionmark.circle",
                    tint: Theme.problem
                )
                block(
                    title: "What to say instead",
                    body: fallacy.coaching,
                    symbol: "lightbulb",
                    tint: Theme.supported
                )
            }
            .padding()
        }
        .navigationTitle(fallacy.title)
    }

    private func block(title: String, body: String, symbol: String, tint: Color) -> some View {
        Card(tint: tint) {
            VStack(alignment: .leading, spacing: 8) {
                Label(title, systemImage: symbol)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(tint)
                Text(body)
                    .font(.callout)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

#Preview {
    NavigationStack { LibraryView() }
}
