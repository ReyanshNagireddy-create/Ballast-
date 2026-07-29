#if os(iOS)
import SwiftUI
import Speech
import AVFoundation

/// On-device dictation for a spoken turn.
///
/// Speech is where this product is actually meant to live — people argue out
/// loud, not in a text box. This is the smallest honest version of that:
/// Apple's recogniser fills the composer, and the debater still presses send.
/// Nothing is uploaded anywhere by this file.
final class DictationController: ObservableObject {

    @Published var partialText: String = ""
    @Published var isRecording = false
    @Published var errorMessage: String?

    private let recognizer = SFSpeechRecognizer()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let engine = AVAudioEngine()

    var isAvailable: Bool {
        recognizer?.isAvailable ?? false
    }

    func start() {
        partialText = ""
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                guard status == .authorized else {
                    self.errorMessage = "Veritas needs speech recognition permission to take a spoken turn."
                    return
                }
                self.beginRecording()
            }
        }
    }

    private func beginRecording() {
        guard let recognizer, recognizer.isAvailable else {
            errorMessage = "Speech recognition is not available right now."
            return
        }

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            self.request = request

            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }

            engine.prepare()
            try engine.start()
            isRecording = true
            errorMessage = nil

            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self else { return }
                    if let result {
                        self.partialText = result.bestTranscription.formattedString
                    }
                    if error != nil || result?.isFinal == true {
                        self.stop()
                    }
                }
            }
        } catch {
            errorMessage = error.localizedDescription
            stop()
        }
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        if engine.isRunning {
            engine.stop()
        }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// Mic button that appends what it hears to the composer.
struct DictationButton: View {
    @Binding var text: String

    @StateObject private var controller = DictationController()
    @State private var textBeforeDictation = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Button {
                if controller.isRecording {
                    controller.stop()
                } else {
                    textBeforeDictation = text
                    controller.start()
                }
            } label: {
                Image(systemName: controller.isRecording ? "stop.circle.fill" : "mic.fill")
                    .font(.title3)
                    .foregroundStyle(controller.isRecording ? Theme.problem : Theme.accent)
            }
            .buttonStyle(.plain)
            .disabled(!controller.isAvailable)
            .accessibilityLabel(controller.isRecording ? "Stop dictation" : "Dictate your turn")

            if let message = controller.errorMessage {
                Text(message)
                    .font(.caption2)
                    .foregroundStyle(Theme.problem)
                    .lineLimit(2)
            }
        }
        .onChange(of: controller.partialText) { _, heard in
            guard controller.isRecording, !heard.isEmpty else { return }
            text = textBeforeDictation.isEmpty ? heard : textBeforeDictation + " " + heard
        }
        .onDisappear { controller.stop() }
    }
}
#endif
