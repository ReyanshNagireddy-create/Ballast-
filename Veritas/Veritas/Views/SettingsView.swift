import SwiftUI
import VeritasKit

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @State private var draftKey = ""
    @State private var showDeleteConfirmation = false

    var body: some View {
        Form {
            Section {
                SecureField("sk-ant-…", text: $draftKey)
                HStack {
                    Button("Save key") {
                        store.apiKey = draftKey
                    }
                    .disabled(draftKey.trimmingCharacters(in: .whitespaces).isEmpty)
                    Spacer()
                    if store.hasModelAccess {
                        Button("Remove", role: .destructive) {
                            draftKey = ""
                            store.apiKey = ""
                        }
                    }
                }
                HStack(spacing: 6) {
                    Image(systemName: store.hasModelAccess ? "checkmark.seal.fill" : "wifi.slash")
                        .foregroundStyle(store.hasModelAccess ? Theme.supported : .secondary)
                    Text(store.hasModelAccess ? "Fact-checking is on." : "Running fully offline.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("Fact-checking")
            } footer: {
                Text("""
                Veritas works with no key at all. Offline it can tell you a claim was **unsupported** — asserted with nothing behind it — but never that it is false, because it has no sources to check against.

                Add an Anthropic API key and a model verifies factual claims and can bring real sources. The six scores do not change either way: they are computed on-device and stay reproducible from the transcript. The key is stored in the keychain.
                """)
            }

            Section {
                Picker("Time per turn", selection: $store.preferences.defaultSecondsPerTurn) {
                    Text("1 min").tag(60)
                    Text("90 sec").tag(90)
                    Text("2 min").tag(120)
                    Text("3 min").tag(180)
                }
                Stepper(
                    "Turns each: \(store.preferences.defaultTurnsPerSide)",
                    value: $store.preferences.defaultTurnsPerSide,
                    in: 1...8
                )
                Picker("Practice opponent", selection: $store.preferences.defaultPersona) {
                    ForEach(Persona.allCases) { persona in
                        Text(persona.title).tag(persona)
                    }
                }
                Picker("Practice difficulty", selection: $store.preferences.defaultDifficulty) {
                    ForEach(Difficulty.allCases) { level in
                        Text(level.title).tag(level)
                    }
                }
            } header: {
                Text("Defaults")
            }

            Section {
                LabeledContent("Saved debates", value: "\(store.debates.count)")
                Button("Delete all debates", role: .destructive) {
                    showDeleteConfirmation = true
                }
                .disabled(store.debates.isEmpty)
            } header: {
                Text("Data")
            } footer: {
                Text("Transcripts and reports stay on this device. Nothing is uploaded unless you add an API key, and then only the claims being checked are sent.")
            }

            Section {
                LabeledContent("Fallacies detected", value: "\(Fallacy.allCases.count)")
                LabeledContent("Scored dimensions", value: "\(Dimension.allCases.count)")
            } header: {
                Text("About")
            } footer: {
                Text("Veritas — every argument deserves evidence. The referee is deterministic: the same transcript always produces the same report, so you can argue with the verdict.")
            }
        }
        .navigationTitle("Settings")
        .onAppear { draftKey = store.apiKey }
        .confirmationDialog(
            "Delete every saved debate?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete all", role: .destructive) { store.deleteAll() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This cannot be undone, and your progress statistics go with them.")
        }
    }
}

#Preview {
    NavigationStack { SettingsView() }
        .environmentObject(AppStore())
}
