# Site features and verification — 5 October 2026

The original 3D rupee scene remains in place. Existing controls were reused where appropriate. Test actions used an isolated in-memory account on a separate host; live shop records were not changed.

| Requested feature | Implementation and verification |
|---|---|
| Dark mode | Header toggle across public, app and legal pages; persists after reload. Browser background/theme checks and desktop preview passed. Dark Settings contrast check found and fixed the mode-notice colours. |
| Simple cookie banner | Necessary-only and optional local campaign-tag choices; tested dismissal/reopening. No external analytics scripts. |
| Site search | Native dialog searches pages/features, not private customer data. Matching and no-result states, navigation destinations, input label and Escape verified. |
| Back to top | Appears after scrolling; tested returning to the top and hiding again. |
| Mobile menu | Existing public drawer retained; app phone navigation repaired after finding an old CSS rule hiding its button. Phone-width menu opens and navigates correctly; Escape/focus handling added. |
| Loading animations | Real-request progress indicator and pending-submit spinner; unit test verified loading starts during a pending request and stops on completion. Reduced-motion stylesheet retained. |
| Hover states | Button/link/FAQ states; browser confirmed hovered button and changed background colour. |
| Scroll progress | Scroll percentage updates on window or app content scroll; browser saw 61.09% after moving down the homepage. No-scroll pages show zero. |
| Copy button | Policy and assistant-answer buttons; both showed Copied after clipboard success. |
| Print stylesheet | Parsed print rules verified in browser. Print command invoked the system/browser print UI, which blocks browser automation; the temporary test tab was closed to dismiss it. No physical printer output was tested. Controls/overlays are excluded, content is unclipped and FAQs open for printing. |
| Sticky headers | Public, legal and app headers; computed sticky position checked. Anchor scroll margins prevent headings being covered. |
| Skip to content | Existing links retained; Enter focused the actual home/app main element. Legal main elements made focusable too. |
| Password visibility | Existing login/register controls retained; browser checked text/password switching and descriptive Show/Hide labels. |
| UTM tracking | Disabled by default. Opt-in stores only five UTM fields locally with timestamp; unit tests checked sanitisation, allowlist and withdrawal erasure. Browser checked preference enable/disable status. No third-party transmission or attribution dashboard is provided. |
| Form success | Isolated real login displayed Welcome back, Feature test shop!; inline status and pending-state reset verified. |
| Form error | Required-field validation and failed test login showed clear inline messages with accessible roles. |
| Confirmation modals | Existing clear/account/consent dialogs retained. Account-delete dialog opened and cancelled without erasing data. Privacy regression tests cover password protection and scoped erasure separately. |
| Last updated | Date on homepage and legal footers, in addition to policy effective dates. |
| Expandable FAQ | Native details/summary on homepage; expansion displayed its answer. |
| Floating contact | Opens a contact dialog; actual deployment truthfully shows that verified contact details are not configured. Once HISAB_OPERATOR_NAME, HISAB_OPERATOR_ADDRESS and HISAB_PRIVACY_EMAIL are configured, it provides the operator details and email link. No message is sent automatically. |

## Tests

- `node tests/site_features_tests.js`: theme defaults, no UTM capture before opt-in, field minimisation/sanitisation, erasure on withdrawal, pending-request loading lifecycle and stylesheet controls.
- `npm test`: all suites passed, including privacy/authenticated HTTP checks on an isolated server.
- Desktop and 390px phone-width browser checks; no horizontal overflow in the tested app layout. Keyboard navigation, success/error states, copy, search, dialogs, FAQ and storage preferences checked.
- Original public browser preferences restored after testing; temporary tabs/test server cleaned up.
- Android bundled web files updated; no APK/device build was performed.

## Remaining external configuration

A verified operator/privacy contact email is still needed for a real contact destination. Printing depends on the browser/system print facility. UTM tags are intentionally local and opt-in; add a separate reviewed design if server-side campaign reporting is desired.

## Layout update — 5 October 2026

- FAQ is a button under Legal & privacy on home/policy pages and in Settings privacy controls; it opens a modal with expandable questions. Home no longer renders a standalone FAQ section.
- Header contains Dark mode followed by the three-line menu at the right. Search opens from inside the home drawer or app/policy navigation popup. Print toolbar buttons removed.
- Contact appears in the Product footer; the floating contact button is removed. Verified email configuration is still required for email contact.
- Browser checks passed: home drawer search, policy and app menu search, filtered refund result, FAQ expansion/closing in home/policy/Settings, Escape dismissal, contact popup, desktop menu visibility, mobile home with no horizontal overflow. Feature tests and JavaScript syntax check passed.
