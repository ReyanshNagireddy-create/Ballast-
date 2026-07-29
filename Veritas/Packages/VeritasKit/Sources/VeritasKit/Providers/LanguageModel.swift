import Foundation

#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// A chat message handed to a language model.
public struct LanguageModelMessage: Hashable, Sendable {
    public enum Role: String, Hashable, Sendable {
        case user
        case assistant
    }

    public var role: Role
    public var content: String

    public init(role: Role, content: String) {
        self.role = role
        self.content = content
    }
}

/// The seam between VeritasKit and any hosted model.
///
/// Everything in the kit works with no conformer at all. This exists so
/// that fact-checking can reach real sources and the sparring partner can
/// bring real evidence — the two things an offline engine honestly cannot
/// do — without the rest of the product depending on a network call.
public protocol LanguageModel: Sendable {
    func complete(
        system: String,
        messages: [LanguageModelMessage],
        maxTokens: Int
    ) async throws -> String
}

public enum LanguageModelError: Error, LocalizedError, Sendable {
    case missingAPIKey
    case badResponse(status: Int, body: String)
    case emptyCompletion
    case transport(String)

    public var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "No API key is configured, so Veritas is running its offline engine only."
        case let .badResponse(status, body):
            return "The model service returned \(status). \(body)"
        case .emptyCompletion:
            return "The model returned no text."
        case let .transport(message):
            return message
        }
    }
}

/// Claude, via the Messages API.
public struct AnthropicLanguageModel: LanguageModel {

    public var apiKey: String
    public var model: String
    public var baseURL: URL
    public var session: URLSession

    public init(
        apiKey: String,
        model: String = AnthropicLanguageModel.defaultModel,
        baseURL: URL = URL(string: "https://api.anthropic.com/v1/messages")!,
        session: URLSession = .shared
    ) {
        self.apiKey = apiKey
        self.model = model
        self.baseURL = baseURL
        self.session = session
    }

    public static let defaultModel = "claude-opus-5"
    public static let fastModel = "claude-haiku-4-5-20251001"

    // MARK: Wire format

    private struct RequestBody: Encodable {
        struct Message: Encodable {
            let role: String
            let content: String
        }
        let model: String
        let max_tokens: Int
        let system: String
        let messages: [Message]
    }

    private struct ResponseBody: Decodable {
        struct Block: Decodable {
            let type: String
            let text: String?
        }
        let content: [Block]
    }

    public func complete(
        system: String,
        messages: [LanguageModelMessage],
        maxTokens: Int = 1024
    ) async throws -> String {
        guard !apiKey.isEmpty else { throw LanguageModelError.missingAPIKey }

        var request = URLRequest(url: baseURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.timeoutInterval = 45

        let body = RequestBody(
            model: model,
            max_tokens: maxTokens,
            system: system,
            messages: messages.map { RequestBody.Message(role: $0.role.rawValue, content: $0.content) }
        )
        request.httpBody = try JSONEncoder().encode(body)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw LanguageModelError.transport(error.localizedDescription)
        }

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw LanguageModelError.badResponse(status: http.statusCode, body: String(text.prefix(400)))
        }

        let decoded = try JSONDecoder().decode(ResponseBody.self, from: data)
        let text = decoded.content
            .compactMap { $0.type == "text" ? $0.text : nil }
            .joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !text.isEmpty else { throw LanguageModelError.emptyCompletion }
        return text
    }
}
