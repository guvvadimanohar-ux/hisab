# Dashboard improvements

Status: FINALIZED

User requested top navigation/actions, an organized overview, English/Hindi/Telugu UI across the public site and dashboard, an Ask Hisab AI popup, removal of the Listen summary button, improved Settings & Trust, and usable bank Account Aggregator controls. Preserve existing records and user edits. Verify desktop/mobile layouts and interactions locally. Hosting requires a final user choice; do not deploy in this task.

Follow-up: editable persisted shop details, hide demo bank connections and reveal setup on request, one bottom assistant launcher, reversible clear-overview control, Aruvu spelling, and three original vector logo options awaiting selection.

## Daily shop workflow — 6 October 2026
Status: FINALIZED
Implement dashboard actions from recorded customer due dates and uncategorized transactions; voice/text entry drafts for cash received, expenses and customer credit with explicit review; daily cash closing using opening float plus settled cash movements, counted cash, discrepancy notes and persisted records. Support explicit offline ledger mode, authenticated user isolation, private export/deletion, and Indian business dates. No inferred supplier obligations without recorded bills.

## Server session recognition fix
Status: FINALIZED
Read the authenticated /api/auth/me response from data.user, set signed-in mode explicitly, and retain offline fallback when no valid session or standalone environment is present. Never use a cached profile as proof of authentication. Preserve offline records. Verify with the actual auth handler response and mocked browser initialization.

## Workflow placement
Status: FINALIZED
Move voice/text entry into the Ask Hisab AI dialog, styled to match and expandable on small screens. Keep draft review functional outside the native dialog. Move action list above Business Overview, visible only on Overview. Preserve existing handlers, local records and assistant chat.

## Shop tools release — all researched features
Status: FINALIZED
User selected all researched features: promises; supplier bills/calendar; owner-set credit limits; explained existing-payment allocation; expiring customer statement links with confirmation/disputes; products/batches/expiry actions; purchase unit-cost comparisons; receipt photo OCR and voice draft correction; margin-aware loyalty earning/redemption/returns; staff draft approval inbox; repeat grocery orders with substitution/fulfillment; cash-difference evidence and adjustable purchase scenarios. Use owner-scoped state, atomic/idempotent monetary operations, selective expiring access links, private export/erasure. No money transfer or automatic messaging. Support local ledger where applicable; sharing, staff links and OCR require server. Add item ledger foundations and product sale/return workflows.

## Small-shop UI refresh
Status: FINALIZED
Refresh the merchant application with clear daily action cards, warm readable colors, consistent typography, persistent desktop navigation, complete compact mobile navigation, simplified page headings and descriptive Business Tools choices. Preserve accounting, feature handlers, local records, translations and privacy permissions. Keep Today’s action list above Business Overview. Verify desktop/mobile UI and modal navigation without creating live records.

## Matching profile and theme controls
Status: FINALIZED
Merchant theme control becomes animated accessible sun/moon switch with persisted theme and reduced-motion support. Shop title shrinks. Theme and shop-profile controls share width and height on desktop and phone. Public website theme control remains compatible.

## Compact corner controls
Status: FINALIZED
User corrected size and placement: place matched compact theme/profile controls together at the top-right, with smaller shop name. Desktop120×40; phone92×40. Preserve animation and profile/theme handlers.

## Global language selector
Status: FINALIZED
Move existing language picker from dashboard toolbar into top corner controls, available on every merchant screen. Retain saved preference and translations. Prefer persistent dropdown over interruptive entry popup. Responsive placement must avoid overlapping brand or navigation.
