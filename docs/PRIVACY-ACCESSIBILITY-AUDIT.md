# Hisab privacy, trust and accessibility audit

Reviewed 5 October 2026. This is an implementation audit, not a legal or accessibility certification. No live shop records were deleted during verification.

## Implemented

- Standalone Privacy, Terms, Cookies/storage and Refund pages linked from the homepage footer and Settings.
- Published notices describe actual offline storage, Groq processing, browser speech vendors, bank/payment providers, undo copies and limits of account erasure.
- Required registration consent and adult/authorised-shop confirmation; consent version and acceptance time recorded server-side. Email optional.
- AI and voice disabled until optional consent, with server enforcement and Settings withdrawal. Consent version and time stored. Manual ledger use does not need AI/voice permission.
- Essential-storage notice with no fictitious analytics toggles. A later site-feature update adds optional UTM attribution stored only on the device, with explicit consent and withdrawal; see SITE-FEATURES-CHECKLIST.md. Removed remote Google Fonts and CDN Three.js requests; no third-party embeds or advertising/analytics scripts found in application entry pages. External WhatsApp/bank navigation remains user initiated.
- Reduced AI customer detail context to dates, amounts and transaction types, excluding full transaction/provider payloads.
- Account-scoped private export, password-protected permanent account erasure, undo-copy and AI receipt erasure, session removal. Bank accounts must first be disconnected so external consent can be revoked. Exports/backups/provider records/logs require separate handling.
- Removed simulated OTP/CAPTCHA and false password-reset-sent claim. Registration is password based; no phone/email verification is claimed.
- Failed remote bank-consent revocation now returns an error and preserves the connection instead of falsely reporting consent as revoked.
- Removed unsupported local/read-only AI claims and invented corporate footer name. No review/testimonial section found in current entry pages; none added.
- Image alt text, linked form labels, named close buttons, skip links, visible focus, dialog keyboard trapping/return focus, reduced-motion support and darker muted text. Locally rendered registration and Settings text passed the sampled contrast check. Closed overlays are removed from the tab order, and background controls are inert while an app dialog is open. Complete WCAG conformance still requires a broader assistive-technology audit.
- Security headers: nosniff, frame blocking, no-referrer, camera/geolocation disabled. API responses no-store. Optional Secure session cookie configuration for HTTPS deployment. Logout clears its cookie.
- Android bundled web assets updated. APK has not been rebuilt or device-tested.

- Moved historical app screenshots out of publicly served assets into local documentation; SVG logo options remain available. Local review screenshots are excluded from Git to prevent accidental repository publication. Hardened the static-file directory boundary.

## Required before public launch

1. Set verified `HISAB_OPERATOR_NAME`, `HISAB_OPERATOR_ADDRESS`, `HISAB_PRIVACY_EMAIL` in server configuration. Confirm the mailbox works and define support/grievance handling, nomination and customer-data rights verification. Missing details are visibly marked pending; no invented support address is published.
2. Get policies reviewed for the actual operator, offering, applicable consumer/tax/lending rules and Indian data protection obligations. DPDP Rules 2025 have staged commencement; the existence of policy pages is not proof of compliance. Plain-language notices in users’ chosen Indian language and accessible grievance procedures require further work. Current full legal pages are English.
3. Define and implement retention periods for backups, security logs and external providers, secure disposal and restore-time erasure procedures. Active-database erasure does not purge previous backups or third-party copies. SQLite deletion is logical deletion, not forensic disk sanitisation.
4. Configure HTTPS and `COOKIE_SECURE=true` in production. Protect/encrypt hosting disks and backups; restrict operator access, define incident/breach notification and recovery processes. Offline browser records have no application-level encryption. Do not run public production on the local HTTP server configuration.
5. Review Groq/browser speech/bank/payment provider terms, processing agreements, retention settings and international transfers. Optional consent does not itself resolve all provider obligations. Do not send credentials or identity documents to AI.
6. Registration does not verify phone/email ownership and password recovery is not configured. Configure real ownership verification and recovery before public account onboarding. Adult attestation is not verified parental consent: this release excludes children’s data.
7. Before charging fees, replace the current no-subscription Refund policy with actual plan, taxes, cancellation, renewal and refund terms. Do not promise refunds for customer/provider transactions Hisab cannot reverse.
8. Review rights to brand assets and any future uploads. Current visible images are local Hisab artwork; no stock photos or external image embeds were found. A complete trademark/copyright clearance has not been performed.
9. Complete screen-reader, mobile, chart/table and error-announcement testing. Keyboard labels/focus and sampled contrast improvements do not establish full WCAG AA conformance. Inline event handlers remain; CSP permits inline script for existing UI and is not a complete XSS defence. Server supports external connection URLs; connect policy is broad for that existing feature.
10. Bank/payment integrations are configured in mock/sandbox mode in this local deployment. Do not present them as live production services; configure and verify actual providers before launch.

## Verification

- `npm test`: all suites passed, including 11 authenticated HTTP AI/privacy checks on an isolated in-memory server. The integration suite no longer attaches to a live shop server or depends on unauthenticated access.

- `node tests/privacy_tests.js`: consent default/withdrawal, scoped export without password hashes, API consent gate, incorrect-password protection, account erasure with foreign keys enabled, other-user preservation and registration receipts.
- `node tests/business_assistant_tests.js`: business action/multilingual regression checks.
- `node tests/security_tests.js`: 22/22 security and isolation checks.
- Browser checks: Settings controls, actual policy navigation, registration consent and optional email, image alternatives, field labels and removal of external stylesheet/script loads. No permissions were enabled for the live user during browser testing.

## Reference material

- [MeitY: DPDP Rules 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), particularly notice, consent withdrawal, security/erasure, rights and staged commencement.
- [MeitY: Act commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf).
- [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/).
- [W3C minimum contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html).
