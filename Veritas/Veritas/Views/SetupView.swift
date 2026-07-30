import SwiftUI

struct SetupView: View {
    let kind: SetupKind

    @EnvironmentObject private var store: AppStore

    @State private var topic = ""
    @State private var nameA = ""
    @State private var nameB = ""
    @State private var positionA = ""
    @State private var positionB = ""
    @State private var secondsPerTurn = 90
    @State private var turnsPerSide = 3
    @State private var isUntimed = false

    @State private var userSide: Side = .a
    @State private var persona: Persona = .teacher
    @State private var difficulty: Difficulty = .medium

    private static let lengths: [Int] = [60, 90, 120, 180]

    var body: some View {
        Form {
            Section {
                TextField("Topic", text: $topic, axis: .vertical)
                    .lineLimit(1...3)
                if topic.isEmpty {
                    suggestions
                }
            } header: {
                Text("What are you arguing about?")
            } footer: {
                Text("A question with two defensible sides works best. \u{201C}Is homework useful?\u{201D} beats \u{201C}homework\u{201D}.")
            }

            if kind == .twoPlayer {
                Section("Debaters") {
                    LabeledContent("Person A") {
                        TextField("Name", text: $nameA)
                            .multilineTextAlignment(.trailing)
                    }
                    TextField("Arguing that…", text: $positionA)
                    LabeledContent("Person B") {
                        TextField("Name", text: $nameB)
                            .multilineTextAlignment(.trailing)
                    }
                    TextField("Arguing that…", text: $positionB)
                }
            } else {
                practiceSections
            }

            Section {
                Toggle("Untimed", isOn: $isUntimed)
                if !isUntimed {
                    Picker("Time per turn", selection: $secondsPerTurn) {
                        ForEach(SetupView.lengths, id: \.self) { seconds in
                            Text(label(forSeconds: seconds)).tag(seconds)
                        }
                    }
                    Stepper("Turns each: \(turnsPerSide)", value: $turnsPerSide, in: 1...8)
                }
            } header: {
                Text("Format")
            } footer: {
                Text(formatFooter)
            }

            Section {
                NavigationLink(value: setup) {
                    Text(kind == .twoPlayer ? "Start debate" : "Start practice")
                        .fontWeight(.semibold)
                }
                .disabled(!isValid)
            } footer: {
                if !store.hasModelAccess {
                    Text("Running offline. Veritas will flag claims that were not supported, but it cannot check whether they are true — add an API key in Settings for that.")
                }
            }
        }
        .navigationTitle(kind.title)
        .onAppear(perform: applyPreferences)
    }

    // MARK: Sections

    private var suggestions: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(SetupView.topicIdeas, id: \.self) { idea in
                Button {
                    topic = idea
                } label: {
                    HStack {
                        Image(systemName: "sparkles")
                            .font(.caption2)
                            .foregroundStyle(Theme.accent)
                        Text(idea)
                            .font(.caption)
                        Spacer(minLength: 0)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var practiceSections: some View {
        Group {
            Section("You") {
                TextField("Your name", text: $nameA)
                TextField("You are arguing that…", text: $positionA)
                Picker("Your side", selection: $userSide) {
                    Text("Open first").tag(Side.a)
                    Text("Respond second").tag(Side.b)
                }
                .pickerStyle(.segmented)
            }

            Section {
                Picker("Opponent", selection: $persona) {
                    ForEach(Persona.allCases) { option in
                        Label(option.title, systemImage: option.symbol).tag(option)
                    }
                }
                Text(persona.blurb)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } header: {
                Text("Opponent")
            }

            Section {
                Picker("Difficulty", selection: $difficulty) {
                    ForEach(Difficulty.allCases) { option in
                        Text(option.title).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                Text(difficulty.blurb)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } header: {
                Text("Difficulty")
            } footer: {
                if !store.hasModelAccess {
                    Text("Offline, the opponent argues structurally and never invents statistics — it has no sources, so any number it gave you would be made up.")
                }
            }
        }
    }

    // MARK: Derived

    private var isValid: Bool {
        !topic.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var format: DebateFormat {
        DebateFormat(
            secondsPerTurn: isUntimed ? nil : secondsPerTurn,
            turnsPerSide: isUntimed ? nil : turnsPerSide,
            mode: .text,
            opener: .a
        )
    }

    private var setup: DebateSetup {
        let machineSide = userSide.opposite
        let opponentName = "\(persona.title) (AI)"
        return DebateSetup(
            topic: topic.trimmingCharacters(in: .whitespacesAndNewlines),
            nameA: kind == .practice && machineSide == .a ? opponentName : displayName(nameA, fallback: "Person A"),
            nameB: kind == .practice && machineSide == .b ? opponentName : displayName(nameB, fallback: "Person B"),
            positionA: positionA,
            positionB: positionB,
            format: format,
            practice: kind == .practice ? PracticeSetup(userSide: userSide, persona: persona, difficulty: difficulty) : nil
        )
    }

    private func displayName(_ value: String, fallback: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? fallback : trimmed
    }

    private var formatFooter: String {
        if isUntimed {
            return "No clock. Either side can end the debate whenever you are both done."
        }
        let total = secondsPerTurn * turnsPerSide * 2 / 60
        return "About \(max(1, total)) minutes in total. When a turn runs out Veritas says so — it does not cut you off mid-sentence."
    }

    private func label(forSeconds seconds: Int) -> String {
        seconds % 60 == 0 ? "\(seconds / 60) min" : "\(seconds)s"
    }

    private func applyPreferences() {
        guard topic.isEmpty else { return }
        secondsPerTurn = SetupView.lengths.contains(store.preferences.defaultSecondsPerTurn)
            ? store.preferences.defaultSecondsPerTurn
            : 90
        turnsPerSide = store.preferences.defaultTurnsPerSide
        persona = store.preferences.defaultPersona
        difficulty = store.preferences.defaultDifficulty
    }

    static let topicIdeas: [String] = [
        "Should primary schools stop setting homework?",
        "Should social media have a minimum age of sixteen?",
        "Is remote work better for early-career employees?",
        "Should university admissions be decided by lottery above a threshold?",
        "Are ranked-choice elections an improvement?"
    ]
}

#Preview {
    NavigationStack { SetupView(kind: .practice) }
        .environmentObject(AppStore())
}
