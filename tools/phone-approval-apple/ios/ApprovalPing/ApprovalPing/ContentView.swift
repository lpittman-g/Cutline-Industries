import SwiftUI

struct ContentView: View {
    @EnvironmentObject var state: AppState
    @State private var decisionNote: String = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("ApprovalPing")
                    .font(.largeTitle.bold())
                Text("Cutline agent → Apple Push → your iPhone")
                    .foregroundStyle(.secondary)

                GroupBox("Status") {
                    Text(state.status)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                GroupBox("Device token (auto-copied)") {
                    Text(state.deviceToken.isEmpty ? "Not registered yet" : state.deviceToken)
                        .font(.system(.footnote, design: .monospaced))
                        .textSelection(.enabled)
                    Button("Copy token") {
                        UIPasteboard.general.string = state.deviceToken
                        decisionNote = "Copied"
                    }
                    .disabled(state.deviceToken.isEmpty)
                }

                if !state.lastApprovalId.isEmpty {
                    GroupBox("Pending: \(state.lastService)") {
                        Text(state.lastApprovalId)
                            .font(.system(.caption, design: .monospaced))
                        HStack {
                            Button("Approve") { decide("approved") }
                                .buttonStyle(.borderedProminent)
                            Button("Deny") { decide("denied") }
                                .buttonStyle(.bordered)
                        }
                    }
                }

                if !decisionNote.isEmpty {
                    Text(decisionNote).foregroundStyle(.secondary)
                }

                Spacer()
                Text("Bundle ID must be studio.cutlineindustries.approvalping")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .navigationTitle("Phone Approval")
        }
    }

    private func decide(_ decision: String) {
        // Local decision file protocol for agent-side resolve:
        // User pastes decision back, or agent MCP resolve_signin_approval is called.
        // For on-device UX we keep the decision on clipboard for the agent chat.
        let payload = "APPROVAL \(decision.uppercased()) \(state.lastApprovalId)"
        UIPasteboard.general.string = payload
        decisionNote = "Copied \(payload) — paste in Cursor chat if agent is waiting"
        // Also try posting to optional local callback URL configured in Info.plist
        if let urlString = Bundle.main.object(forInfoDictionaryKey: "ApprovalCallbackURL") as? String,
           let url = URL(string: urlString) {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let body: [String: String] = [
                "approvalId": state.lastApprovalId,
                "decision": decision,
            ]
            req.httpBody = try? JSONSerialization.data(withJSONObject: body)
            URLSession.shared.dataTask(with: req).resume()
        }
    }
}
