import Cocoa
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    let onlineEdition = Bundle.main.object(forInfoDictionaryKey: "HisabOnlineEdition") as? Bool ?? false
    var serverURL: URL?
    var window: NSWindow!
    var webView: WKWebView!
    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let appMenu = NSMenu()
        if onlineEdition { appMenu.addItem(withTitle: "Connect to server…", action: #selector(connectServer), keyEquivalent: "k") }
        appMenu.addItem(withTitle: "Quit Hisab AI", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let item = NSMenuItem(); item.submenu = appMenu; menu.addItem(item)
        let edit = NSMenu(title: "Edit")
        for (title, action, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        let editItem = NSMenuItem(title: "Edit", action: nil, keyEquivalent: ""); editItem.submenu = edit; menu.addItem(editItem)
        NSApp.mainMenu = menu
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        if !onlineEdition { config.userContentController.addUserScript(WKUserScript(source: "window.IS_STANDALONE = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true)) }
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self; webView.uiDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 850), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = onlineEdition ? "Hisab AI Online" : "Hisab AI Offline"; window.minSize = NSSize(width: 800, height: 600)
        window.contentView = webView; window.center(); window.makeKeyAndOrderFront(nil)
        if onlineEdition {
            if let saved = UserDefaults.standard.string(forKey: "server"), let url = validatedServer(saved) {
                serverURL = url; webView.load(URLRequest(url: url))
            } else { connectServer() }
        } else {
            let assets = Bundle.main.resourceURL!.appendingPathComponent("Web")
            webView.loadFileURL(assets.appendingPathComponent("app.html"), allowingReadAccessTo: assets)
        }
        NSApp.activate(ignoringOtherApps: true)
    }
    func validatedServer(_ text: String) -> URL? {
        guard let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
              let host = url.host, url.user == nil, url.password == nil,
              url.scheme == "https" || (url.scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)) else { return nil }
        return url
    }
    @objc func connectServer() {
        let alert = NSAlert(); alert.messageText = "Connect Hisab AI"
        alert.informativeText = "Enter your HTTPS server address. For the server on this Mac, use http://localhost:8099. Start the Hisab AI server before connecting."
        alert.addButton(withTitle: "Connect"); alert.addButton(withTitle: "Cancel")
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 400, height: 26))
        input.stringValue = UserDefaults.standard.string(forKey: "server") ?? "http://localhost:8099"
        alert.accessoryView = input
        alert.beginSheetModal(for: window) { result in
            if result == .alertFirstButtonReturn {
                guard let url = self.validatedServer(input.stringValue) else { self.connectServer(); return }
                UserDefaults.standard.set(url.absoluteString, forKey: "server")
                self.serverURL = url; self.webView.load(URLRequest(url: url))
            }
        }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let alert = NSAlert(); alert.messageText = "Unable to connect"
        alert.informativeText = "Check that your Hisab AI server is running, then use Connect to server in the app menu. " + error.localizedDescription
        alert.beginSheetModal(for: window)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.shouldPerformDownload { decisionHandler(.download); return }
        if ["file", "about", "blob", "data"].contains(url.scheme ?? "") { decisionHandler(.allow); return }
        if onlineEdition, let server = serverURL, url.scheme == server.scheme, url.host == server.host, url.port == server.port {
            decisionHandler(.allow); return
        }
        NSWorkspace.shared.open(url); decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let attachment = (navigationResponse.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition")?.lowercased().contains("attachment") ?? false
        decisionHandler(attachment || !navigationResponse.canShowMIMEType ? .download : .allow)
    }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.url : nil) }
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }; return nil
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.beginSheetModal(for: window) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert(); alert.messageText = message; alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { result in completionHandler(result == .alertFirstButtonReturn) }
    }
}
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
