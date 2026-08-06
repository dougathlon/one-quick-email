import XCTest

final class OneQuickEmailUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testOpenComposeInMobileSafari() throws {
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.launch()

        let address = safari.textFields["Address"]
        XCTAssertTrue(address.waitForExistence(timeout: 8))
        address.tap()
        address.typeText("http://127.0.0.1:4173/?test=1&seed=xcode-simulator")
        let goButton = safari.keyboards.buttons["Go"]
        XCTAssertTrue(goButton.waitForExistence(timeout: 3))
        goButton.tap()
        sleep(3)

        let safariTutorialClose = safari.buttons["Close"]
        if safariTutorialClose.waitForExistence(timeout: 1) {
            safariTutorialClose.tap()
        }

        let window = safari.windows.firstMatch
        XCTAssertTrue(window.exists)
        let startWork = safari.buttons["Start Work"]
        if startWork.waitForExistence(timeout: 2) {
            startWork.tap()
        } else {
            window.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.545)).tap()
        }
        XCTAssertTrue(safari.keyboards.firstMatch.waitForExistence(timeout: 4))

        XCTContext.runActivity(named: "Compose screen") { activity in
            let attachment = XCTAttachment(screenshot: safari.screenshot())
            attachment.lifetime = .keepAlways
            activity.add(attachment)
        }
    }

    func testHeldTouchCannotStrandTheMiniGameTransition() throws {
        let app = XCUIApplication()
        app.launch()

        let webView = app.webViews["game-web-view"]
        let trace = app.staticTexts["qa-trace"]
        XCTAssertTrue(webView.waitForExistence(timeout: 10))
        XCTAssertTrue(trace.waitForExistence(timeout: 10))
        XCTAssertTrue(waitForTrace(trace, containing: "\"draft\":\"a\"", timeout: 10))

        webView.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.35))
            .press(forDuration: 8.5)

        XCTAssertTrue(
            waitForTrace(trace, containing: "\"phase\":\"compose\"", timeout: 2),
            trace.label
        )
        let finalTrace = trace.label
        XCTAssertTrue(finalTrace.contains("minigame:briefing"), finalTrace)
        XCTAssertTrue(finalTrace.contains("minigame:playing"), finalTrace)
        XCTAssertTrue(finalTrace.contains("compose:timeout"), finalTrace)
        XCTAssertTrue(finalTrace.contains("\"draft\":\"a\""), finalTrace)

        XCTContext.runActivity(named: "Returned compose screen after held touch") { activity in
            let attachment = XCTAttachment(screenshot: app.screenshot())
            attachment.lifetime = .keepAlways
            activity.add(attachment)
        }
    }

    private func waitForTrace(
        _ trace: XCUIElement,
        containing text: String,
        timeout: TimeInterval
    ) -> Bool {
        let predicate = NSPredicate(format: "label CONTAINS %@", text)
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: trace)
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }
}
