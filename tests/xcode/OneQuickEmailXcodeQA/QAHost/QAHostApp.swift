import Combine
import SwiftUI
import WebKit

@main
struct QAHostApp: App {
    @StateObject private var trace = QATrace()

    var body: some Scene {
        WindowGroup {
            VStack(spacing: 0) {
                Text(trace.value)
                    .font(.system(size: 8, design: .monospaced))
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, minHeight: 18, maxHeight: 18)
                    .foregroundStyle(.green)
                    .background(.black)
                    .accessibilityIdentifier("qa-trace")

                GameWebView(trace: trace)
                    .ignoresSafeArea(edges: .bottom)
            }
        }
    }
}

final class QATrace: NSObject, ObservableObject, WKScriptMessageHandler {
    @Published var value = "loading"

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let value = message.body as? String else { return }
        DispatchQueue.main.async {
            self.value = value
        }
    }
}

struct GameWebView: UIViewRepresentable {
    let trace: QATrace

    func makeCoordinator() -> QATrace {
        trace
    }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "qaTrace")
        contentController.addUserScript(WKUserScript(
            source: Self.qaScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.accessibilityIdentifier = "game-web-view"
        webView.scrollView.isScrollEnabled = false
        webView.load(URLRequest(url: URL(
            string: "http://127.0.0.1:4173/?test=1&seed=xcode-held-touch"
        )!))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: QATrace) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "qaTrace")
    }

    private static let qaScript = #"""
        (() => {
          const history = [];
          let lastTransition = '';
          let pointerArmed = false;

          const report = () => {
            const hook = window.__ONE_QUICK_EMAIL_TEST__;
            if (!hook) return;
            const state = hook.getState();
            const layer = document.querySelector('#phaser-layer');
            const status = layer?.dataset.miniGameStatus ?? 'none';
            const transition = `${state.phase}:${status}`;
            if (transition !== lastTransition) {
              history.push(transition);
              lastTransition = transition;
            }
            window.webkit.messageHandlers.qaTrace.postMessage(JSON.stringify({
              phase: state.phase,
              status,
              draft: state.draft,
              history,
            }));
          };

          const prepare = window.setInterval(() => {
            const hook = window.__ONE_QUICK_EMAIL_TEST__;
            const start = document.querySelector('[data-testid="start-work"]');
            if (!hook || !start) return;
            window.clearInterval(prepare);
            start.click();

            window.setTimeout(() => {
              const editor = document.querySelector('[data-testid="reply-editor"]');
              if (!(editor instanceof HTMLTextAreaElement)) return;
              editor.focus();
              editor.value = 'a';
              editor.setSelectionRange(1, 1);
              editor.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                composed: true,
                data: 'a',
                inputType: 'insertText',
              }));
              pointerArmed = true;
              report();
            }, 250);
          }, 50);

          window.addEventListener('pointerdown', () => {
            if (!pointerArmed) return;
            pointerArmed = false;
            window.__ONE_QUICK_EMAIL_TEST__?.forceInterruption('stamp-of-approval');
            report();
          }, { capture: true });

          new MutationObserver(report).observe(document.documentElement, {
            attributes: true,
            childList: true,
            subtree: true,
          });
          window.setInterval(report, 100);
          report();
        })();
        """#
}
