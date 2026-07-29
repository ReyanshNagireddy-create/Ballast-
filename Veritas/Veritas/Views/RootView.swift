import SwiftUI
import VeritasKit

struct RootView: View {
    var body: some View {
        TabView {
            NavigationStack { HomeView() }
                .tabItem { Label("Debate", systemImage: "bubble.left.and.bubble.right") }

            NavigationStack { HistoryView() }
                .tabItem { Label("Progress", systemImage: "chart.bar") }

            NavigationStack { LibraryView() }
                .tabItem { Label("Library", systemImage: "books.vertical") }

            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}

#Preview {
    RootView().environmentObject(AppStore())
}
