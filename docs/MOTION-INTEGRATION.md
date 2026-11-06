# Presentation motion — 5 October 2026

Reviewed Anime.js, Motion, Theatre.js, Spline, Rive and Bklit UI from their official sites. Selected Anime.js 4.5.0 for the existing plain JavaScript frontend. Its MIT license is retained beside the locally hosted bundle. No external scripts, trackers or embeds are added.

Home headings/actions, first-visible dashboard cards/panels, policy content, native dialogs and form feedback receive brief opacity entrances. Business values and the existing Three.js rupee scene are untouched. Motion preferences suppress new effects; preferences changing during playback cancel effects. Each animation restores its prior inline opacity on completion, page hide or failure, with a watchdog for stalled playback. Missing animation library leaves the UI usable.

Motion offers overlapping functionality; Theatre is a sequence editor; Spline and Rive require authored scene/animation assets; Bklit supplies chart components. Additional runtimes or a chart migration were not necessary for this presentation update.

Validation: all ten test suites passed, including 11 isolated authenticated HTTP AI/privacy checks. New tests cover reduced motion, missing library, thrown animation error, completion, watchdog and navigation cleanup. Browser checks covered home rupee canvas, FAQ expand/close, drawer Search, dashboard values, transaction navigation, mobile menu to Settings, Settings FAQ and privacy page. No browser errors observed. Live ledger records were not changed. Android bundled assets and service-worker cache were updated; no new APK build was made.

## 21st.dev button adaptation — 6 October 2026

Reviewed the Shimmer Button pattern featured on https://21st.dev/. Added an original CSS adaptation to the existing Open my Hisab CTA: a slow green/gold light sweep, stronger hover and visible keyboard focus. Existing markup, click handlers, labels and rupee canvas are unchanged. No React runtime or remote asset is loaded. Reduced motion disables the sweep.

## Bklit + Motion integration — 6 October 2026

Official MIT chart source: https://github.com/bklit/bklit-ui at commit 5d699897b2dde26374cf15501dbaadbc52cea982. The Monthly Cash Flow chart uses Bklit BarChart, Bar, Grid, BarXAxis and ChartTooltip inside a local React island. Motion animates bars with reduced-motion support. The original ledger renderer remains a fallback on chart errors or missing bundles. Real dashboard cashflow data drives both the chart and accessible exact-value table. No external data transfer or runtime CDN dependency is introduced.

Build with `npm ci --prefix tools/charts` then `npm run build --prefix tools/charts`. Source/license lives in tools/charts; browser bundle and utility CSS are cached for offline use and copied to Android assets. Current compressed source bundle is approximately 461 KB before gzip. No APK rebuild was performed.

Anime.js continues its existing presentation effects. Theatre.js, Spline and Rive were reviewed; their additional scene editors and asset runtimes were not introduced because this change preserves the original Three.js rupee scene and does not require a new authored scene or .riv asset.

Browser checks: real October inflow/outflow/net values match existing overview totals; clear/refresh works; 390px chart resizes without horizontal page overflow; dark-mode chart colours change correctly; expandable exact figures are keyboard-operable; a clean page load produced no browser errors. Fixed privacy permission handling when an offline cached response has no data.
