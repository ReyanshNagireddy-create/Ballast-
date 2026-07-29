import SwiftUI
import VeritasKit

/// Colours, spacing and the small amount of shared styling the app needs.
///
/// Everything here works in both colour schemes on both platforms without
/// reaching for UIKit or AppKit, which is why there is not a single
/// `Color(.systemSomething)` in the project.
enum Theme {

    // MARK: Palette

    static let accent = Color(red: 0.29, green: 0.55, blue: 0.90)

    /// Person A and Person B need to be told apart at a glance, everywhere.
    static let sideA = Color(red: 0.20, green: 0.63, blue: 0.62)
    static let sideB = Color(red: 0.85, green: 0.52, blue: 0.19)

    static let supported = Color(red: 0.18, green: 0.62, blue: 0.40)
    static let caution = Color(red: 0.86, green: 0.62, blue: 0.15)
    static let problem = Color(red: 0.83, green: 0.33, blue: 0.31)
    static let neutral = Color.secondary

    static func color(for side: Side) -> Color {
        side == .a ? sideA : sideB
    }

    static func color(for severity: Severity) -> Color {
        switch severity {
        case .info: return neutral
        case .notice: return caution
        case .warning: return caution
        case .major: return problem
        }
    }

    static func color(for kind: FindingKind) -> Color {
        switch kind {
        case .strongEvidence, .strongRebuttal: return supported
        case .fallacy, .contradiction: return problem
        case .unsupportedClaim, .droppedArgument, .incivility: return caution
        }
    }

    static func color(for verdict: SupportVerdict) -> Color {
        switch verdict {
        case .sourced: return supported
        case .quantified: return accent
        case .hedged: return neutral
        case .unsupported: return problem
        case .notApplicable: return neutral
        }
    }

    /// Red through amber to green, for the score bars.
    static func color(forScore score: Double) -> Color {
        switch score {
        case 80...: return supported
        case 60..<80: return caution
        default: return problem
        }
    }

    // MARK: Metrics

    static let corner: CGFloat = 14
    static let gutter: CGFloat = 16
}

/// A plain card. Used everywhere so that spacing stays consistent without a
/// dozen ad-hoc paddings.
struct Card<Content: View>: View {
    var tint: Color?
    @ViewBuilder var content: Content

    init(tint: Color? = nil, @ViewBuilder content: () -> Content) {
        self.tint = tint
        self.content = content()
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.gutter)
            .background(
                RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
                    .fill(.regularMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
                    .strokeBorder((tint ?? Color.secondary).opacity(0.25), lineWidth: 1)
            )
    }
}

/// Section heading with an optional one-line explanation underneath.
struct SectionHeader: View {
    var title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.headline)
            if let subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Horizontal 0–100 bar with the number on the end.
struct ScoreBar: View {
    var value: Double
    var tint: Color?

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.secondary.opacity(0.18))
                Capsule()
                    .fill(tint ?? Theme.color(forScore: value))
                    .frame(width: max(3, proxy.size.width * fraction))
            }
        }
        .frame(height: 8)
        .accessibilityLabel(Text("Score \(Int(value.rounded())) out of 100"))
    }

    private var fraction: Double {
        min(1, max(0, value / 100))
    }
}

/// Small rounded label — severity, claim kind, side, and so on.
struct Pill: View {
    var text: String
    var color: Color
    var symbol: String?

    init(_ text: String, color: Color = .secondary, symbol: String? = nil) {
        self.text = text
        self.color = color
        self.symbol = symbol
    }

    var body: some View {
        HStack(spacing: 4) {
            if let symbol {
                Image(systemName: symbol)
                    .font(.caption2)
            }
            Text(text)
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule().fill(color.opacity(0.15))
        )
        .foregroundStyle(color)
    }
}

/// Empty-state block, so blank screens still say something useful.
struct EmptyStateView: View {
    var symbol: String
    var title: String
    var message: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 34))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}
