# ONE QUICK EMAIL

A browser office-survival game about finishing a single email. Read the request, type a reply of at least 150 words, and handle a stream of timed workplace interruptions without losing your place. After you send, the game ends in the inbox when one final unread message arrives.

Play the canonical release at [dougathlon.github.io/one-quick-email](https://dougathlon.github.io/one-quick-email/).

The full loop supports desktop keyboards and mouse input as well as portrait phone layouts and touch controls. The primary tested sizes are 1440 × 900, 1280 × 720, 390 × 844, and 360 × 800.

## Run locally

Use Node.js 20.19 or newer and npm.

```sh
npm ci
npm run dev
```

Vite prints the local development URL. The other project checks are:

```sh
npm run typecheck       # TypeScript
npm test                # Vitest unit tests
npm run test:browser    # Playwright browser tests
npm run test:mobile     # Playwright touch and phone-layout tests
npm run build           # Type-check and create dist/
npm run preview         # Serve the production build locally
npm run test:all        # Unit tests, production build, and browser tests
```

Install Playwright's Chromium and WebKit binaries once before running browser tests locally:

```sh
npx playwright install chromium webkit
```

### Xcode mobile regression

The Xcode harness in `tests/xcode/OneQuickEmailXcodeQA/` runs two iPhone Simulator checks: a Mobile Safari compose-screen smoke test and a WebKit press-and-hold regression for the email-to-mini-game transition.

Start the development server on the harness's fixed local port:

```sh
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

Open `tests/xcode/OneQuickEmailXcodeQA/OneQuickEmailXcodeQA.xcodeproj`, select the `OneQuickEmailXcodeQA` scheme and an iPhone simulator, then run **Product → Test**. The harness is development-only and is not included in the game bundle.

## Controls

- Type directly in the reply editor with a physical or on-screen keyboard. Paste, copy, cut, drag-and-drop, undo/redo, and text selection are intentionally disabled.
- Use the on-screen buttons to start, send, mute sound, and play again.
- Each interruption displays its controls. Mini-games accept touch or mouse input; desktop alternatives commonly use `A`/`D`, the arrow keys, `Space`, and `Enter`.
- The Send button unlocks at 150 words.

## Architecture

- `src/app/` owns the application state machine and coordinates composing, interruptions, inbox delivery, audio, and rendering.
- `src/ui/` renders the email-client interface as DOM and exposes user actions through callbacks.
- `src/phaser/` contains the Phaser mini-game host, shared scene behavior, and individual interruption scenes.
- `src/game/` contains framework-independent rules such as word counting, random selection, editor restrictions, and interruption timing.
- `src/data/` contains the built-in email scenarios and inbox content; `src/audio/` synthesizes sound with the Web Audio API.
- `tests/unit/` covers domain behavior, `tests/e2e/` exercises the desktop loop, `tests/mobile/` covers portrait touch layouts in Chromium and iPhone-emulated WebKit, and `tests/xcode/` contains the native iPhone Simulator regression harness.

The production bundle is entirely static. It has no backend, runtime API calls, analytics, or external asset requests; scenario data and audio generation ship in the bundle. Only mute preference and the most recent scenario are stored locally in the browser.

## Deploy to GitHub Pages

The included workflow tests and builds the game, uploads `dist/`, and deploys it on pushes to `main` or a manual workflow run.

1. Push the repository to GitHub with the repository name `one-quick-email`.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
3. Push to `main`, or run **Deploy to GitHub Pages** from the Actions tab.

The site will be available at `https://<owner>.github.io/one-quick-email/`. Production asset URLs are relative so the same static build can also be served from another root or subpath.
