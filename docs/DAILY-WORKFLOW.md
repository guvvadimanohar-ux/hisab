# Daily shop workflow — 6 October 2026

Implemented Today’s action list, voice/text drafts, and daily cash closing on Overview.

Actions use outstanding customer credit due dates and uncategorized/flagged transactions. Supplier bill obligations are not modeled yet. Voice supports browser language selection (English India, Hindi, Telugu), numeric amounts, deterministic draft parsing and editable confirmation through existing transaction/udhaar forms. Ambiguous inputs are rejected. No entry is saved by recognition itself. Credit repayments use the existing repayment workflow.

Cash closing uses opening cash + settled cash receipts − settled cash payments. Excludes UPI, bank, pending/duplicate records and customer credit issuance. An explanation is required for nonzero differences. One editable closing per date is persisted; server records are authenticated and scoped to the owner. Closings are included in private export and account deletion. Offline records persist with the selected local ledger. Network save errors do not silently write a second copy into an offline ledger. Indian business dates are used.

Verification:
- Full npm test suite passed, including new financial, validation, auth, tenant isolation, export and deletion tests.
- Isolated HTTP fixture: manual expense 201; daily action list 200; closing save/reload 200 with opening 100, cash expense 25, expected/count 75, difference 0.
- Browser: paid supplier 2,000 draft correctly selects expense/cash, explicit save updates expense totals; opening 3,000 and counted 1,000 produce zero difference after the 2,000 expense; closing persists.
- Desktop screenshot and 390px phone inspection: no horizontal overflow; long modal scrolls.
- Android web assets updated; no APK/device build. Live microphone recognition needs real-device verification and browser speech availability.
- Graphify AST refresh performed.

Existing fixes required by these workflows: manual transaction controller imports parseBody; transaction engine accepts the form’s flow field; offline engine normalizes INFLOW/OUTFLOW; manual form opens with the correct direction.
