# Dashboard update — 3 October 2026

Implemented the user's requested top navigation/actions, responsive overview, persistent English/Hindi/Telugu interface for public and merchant pages, Ask Hisab AI dialog, Listen removal, bank selection/mobile/consent validation and account sync UI, and clearer Settings & Trust copy.

Fixed existing offline dashboard crash (undefined dailyFlows), offline assistant summary shape, month grouping, customer display fields, and customer averages. Offline assistant supports English/Hindi/Telugu ledger queries and honest empty/unsupported responses. Fresh browser storage starts empty; saved browser records are preserved.

Local server now runs from Desktop/hisabai at http://localhost:8099. The previous listener was serving Downloads/hisabai. Backend confirms Account Aggregator sandbox/mock mode and mock payments. Production provider credentials and hosting are not configured by this task.

Browser verification: isolated Brave/Playwright contexts, empty and fixture-populated overview, all three languages and persistence, localized credit answers, popup/keyboard dismissal/homepage entry, consent validation and payload/URL handling against mocked routes, six mobile views without horizontal overflow, no JavaScript page errors. Screenshots inspected in /private/tmp/hisab-verified-*.png. Tests did not add records to the user's server database or saved browser.

Preserved pre-existing dirty Git changes. No deployment or Git commit performed. Ask the user whether to proceed with hosting.

## Shop settings and branding follow-up
Added persisted editable shop profile (offline browser and authenticated server), removed top assistant entry, corrected Aruvu, hid sandbox bank setup/accounts, and added reversible Clear overview. Created three original SVG logo candidates in frontend/assets/logo-options; selection pending. Verified offline save/reload and clear/refresh in browser; in-memory profile save/reload, tenant isolation, and unauthorized access passed. Full test run reached AI suite but sandbox blocked server access. Existing unrelated edits preserved.

Selected logo: Open for Business (option 2). Applied shutter/H mark to public header, menu, footer, merchant header, assistant, favicon, PWA PNG icons, and Android launcher/source assets. Vector/XML parse checks passed; Android APK not rebuilt.

Added section-specific Clear transactions and Clear all customers, with confirmation and durable undo backups. Customer clear includes linked credit entries; transactions remain. Server actions require auth and merchant scope; repeated clear blocked until undo. In-memory clear/restore, linked-credit restore, tenant isolation, and unauthorized access tests passed.

Business assistant: added restricted Ollama JSON intent routing and validated atomic customer/credit/repayment/sale/expense actions, idempotency receipts, request-scoped reads, per-merchant sessions, live model status, browser voice submission and ledger refresh. Exact English loan/repayment commands work without LLM; offline browser remains read-only for assistant. Business assistant tests and 11 customer-credit tests passed. No Ollama endpoint or executable found; hosted/local provider selection requested and pending. Cannot claim live LLM connected until model configured.

Groq live connection verified with user-provided server key (never printed). Account did not expose llama-3.3-70b-versatile; selected available openai/gpt-oss-120b in .env. Live JSON business advice and unrelated-request refusal both passed with source=groq. Server restarted with verified model.

## Daily workflow — 6 October 2026
Implemented Overview actions, voice/text draft review and persisted cash closing for server/offline ledgers. New shared calculations and authenticated endpoints; required expense-direction/controller fixes included. Full suite and isolated HTTP checks passed; desktop/mobile browser checked. Evidence: docs/DAILY-WORKFLOW.md and docs/screenshots/daily-workflow.png. Android bundled web assets synced. Live microphone and APK build remain unverified. User’s existing workspace changes retained.

## Server session recognition fix
Corrected merchant checkAuth to accept the actual authenticated response (data.user), explicitly reset offline mode, and reject cached profile metadata as proof of authentication. Offline local records preserved. Android assets synced; PWA cache advanced to v27. Regression test passes against real auth handler response, expired/missing sessions, network failure and standalone mode. Full npm test passed; graph refreshed.

## Workflow placement
Moved Today’s action list above Business Overview, scoped to Overview visibility. Moved voice/text entry into an expandable Ask Hisab AI section and matched padding, borders and surface colors. Assistant closes before opening editable transaction/credit review to avoid native-dialog stacking. Desktop screenshot and 390px inspection performed; draft review opened correctly and was cancelled without saving. Daily workflow tests passed; Android assets synced; PWA cache v28.

## All researched shop tools — 7 October 2026
Implemented all approved workflows; verification and limits in docs/SHOP-TOOLS.md. Full test suite passed; OCR and isolated browser workflows verified. Android web assets mirrored, PWA revision 31, main server restarted. Existing workspace changes preserved; no broad commit made.

## Small-shop UI refresh — 7 October 2026
Added warm illustrated overview with large sale/expense/udhaar shortcuts, visible desktop sidebar and complete two-row mobile navigation. Updated typography, form spacing, cards and tool choices; secondary KPI cards now expand under More shop insights. Added Hindi/Telugu new copy and localized India date. Navigation resets screen scroll. Existing financial handlers and records retained. Android assets synced; PWA revision 35. Full npm test passed. Browser checked 1280×900 and 390×844; no mobile horizontal overflow, expense shortcut opened correct direction and was cancelled, mobile stock navigation and Telugu switch verified (English restored). No browser console errors. Screenshots in docs/screenshots/shop-redesign-*.png. Graph refreshed.

## Theme/profile control polish
Merchant theme button now accessible sun/moon switch with animated sliding thumb, persisted checked state and reduced-motion support. Profile title reduced. Controls both 56px tall; desktop width188px, phone width167.5px in observed viewports. Dark/light behavior and reload persistence verified; original light preference restored. Site features tests passed; Android assets mirrored and PWA revision36.

## Compact top-right correction
User requested smaller matching controls at top-right. Moved theme and shop profile out of sidebar into corner toolbar; desktop120×40 and phone92×40. Owner text hidden, shop-name text smaller; toggle animation retained. Desktop/390px screenshots and matching dimensions verified, no mobile page overflow. Android mirrored, PWA37.

## Global language placement
Moved existing picker to top corner controls on every merchant screen; no entry popup. Saved preference and change handlers retained. Desktop and mobile header checked; phone brand above controls to avoid overlap. Site features tests passed, Android assets mirrored, PWA39. Screenshots language-top.png and language-top-mobile.png.
