# Google Analytics 4 setup

Set GA_MEASUREMENT_ID=G-YOURID in the project's .env file and restart the server. The ID is public and validated by /api/privacy/analytics. No ID means no Google script loads.

In GA4 Admin → Data streams → the web stream, turn OFF Enhanced measurement. This integration sends a single sanitized page_view manually. Enhanced measurement can add history, form and search events independently of send_page_view=false; keep it disabled. Advertising and Google signals are disabled in the tag.

Consent is stored on each visitor's device. Necessary only loads no Google tag and sends no cookieless analytics pings. Allow analytics permits the tag on the public home and policy pages only. Dashboard, customer/transaction/AI pages and file-based Android pages are excluded. URLs are stripped of query strings and hashes; referrers are blank. No business values, names, IDs, queries or custom events are sent by this integration. Google still receives ordinary technical/network visit data after consent.

Withdraw via Storage preferences → Necessary only, or Settings → Privacy and permissions → Save analytics preference. Withdrawal clears accessible _ga cookies, disables the measurement ID and reloads an active tagged public page so the third-party script stops. It does not erase historical Google Analytics records.

Tests verify no tag before consent, no dashboard tracking after consent, sanitized pageviews, invalid measurement-ID rejection and withdrawal. Live event delivery cannot be verified until a real Measurement ID is configured. Verify a consenting visit in GA4 Realtime after activation; use necessary-only/decline to verify no Google tag request before consent.
