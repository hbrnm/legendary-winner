# Modern Web Guidance Implementation Plan

**Goal:** Apply the five recommendations accepted in the conversation, preserving the current architecture and offline behavior.
**Architecture:** Native browser capabilities with graceful degradation; no new dependencies. Image priority is explicit at the recipe detail panel, not inferred from every large image. Installation appears only when available. OCR changes depend on a browser benchmark.

- [x] Test image loading: detail image eager/high, list images lazy, including household photos; implement explicit priority prop.
- [x] Make TextArea grow vertically with field-sizing and bounded height, preserving manual scrolling and older-browser fallback; verify in Chromium.
- [x] Contain scroll at Sheet content, modal and backdrop; verify background scroll and Escape. Safari support requires separate real-device verification.
- [x] Give manifest id '/' (matching existing start_url identity). Add supported installation action in household settings, handle cancellation/retry and installed state; test unsupported browsers and event lifecycle.
- [x] Benchmark existing receipt preprocessing at 1800px width in Chromium with CPU throttling. If it blocks beyond 50ms, move preparation to a dedicated worker, preserving pixels and fallback on failure. Test output equivalence and worker lifecycle.
- [x] Run unit suite, lint, typecheck, build and focused browser tests; inspect diff. Record limits without claiming iPhone validation.

No production network requests, analytics collection, dependency changes, deployment or unrelated modernization. Retain user changes and use the existing isolated checkout.

## Validation results

- `npm test`: 79 files, 777 tests passed.
- `npm run lint`, `npm run typecheck`, `git diff --check`: passed.
- `npm run build`: passed twice consecutively after excluding generated `out/` and `out-cloud/` from TypeScript source discovery.
- `npx playwright test --config .agents/onboarding.playwright.config.ts e2e/modern-web.spec.ts e2e/offline-pwa.spec.ts e2e/fotografii.spec.ts --project telefon --workers 2`: 12 passed in system Chromium. This covers native CSS sizing, dialog backdrop wheel containment and Escape, catalog/household image priority, stable manifest identity, persisted installation offers across SPA routes, actual Tesseract reading with worker and forced worker failure, and offline repeats.
- Independent review identified a route-local installation listener; moved lifecycle capture into InstallAppProvider in the persistent root layout and added unit/browser regressions.

## OCR measurement and integration findings

Before changing preprocessing, a browser benchmark ran the original grayscale, contrast, sharpening and RGBA loops on a synthetic 1800 × 5400 pixel buffer. Chromium with CDP CPU slowdown 4 reported approximately 2302 ms of synchronous work. This is a diagnostic on the cloud machine, not a measurement from a physical phone or the full OCR duration. The unchanged pixel algorithm now runs in a short-lived dedicated worker. The original bitmap stays available; failure falls back locally.

An actual OCR browser test exposed that cached worker Responses dropped the Turbopack bootstrap URL fragment. Returning a synthetic same-origin cached worker Response preserves the requested worker location. The worker-result assertion and offline repeat now pass, so a successful OCR fallback cannot conceal a broken worker.

## Limits

No Safari/iPhone physical-device validation or OS installation-dialog automation was performed. CSS field sizing and backdrop containment remain progressive enhancements; unsupported browsers retain ordinary text-field scrolling and existing modal focus behavior. Install action tests simulate browser installation events/native API outcomes; actual consent UI remains controlled by the browser. No telemetry collection, new dependencies, production changes, commit or deployment.
