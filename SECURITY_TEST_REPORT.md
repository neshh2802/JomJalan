# Jalan privacy and security test report

**Date:** 12 November 2026
**Environment:** Local project and isolated browser/mocked-service tests. No malicious requests were sent to third-party services.

## Production initialization follow-up — 13 November 2026

The pre-fix live deployment's MapLibre bootstrap failed browser SRI validation. `index.html`'s digest matched the Windows CRLF working copy, but the committed and deployed bootstrap was LF-normalized by Git. The live resource SHA-384 was `G+XFNTpflli0fl5FTqMf2dQASYiiq3DjTYC+MoH4FeqVXGUTxNhLdOHJWnSPEkFh`; the HTML had a different digest. Updated the HTML digest and added `.gitattributes` to keep the hashed bootstrap LF. The bootstrap's awaited module imports preserve MapLibre → API config → privacy → app → PWA ordering; no duplicate script tags were added. Commit `5460f618bca2598f5d1a96ce4f68d12df6ecbd45` was pushed to the existing `main` branch.

Local browser verification after the fix passed under the configured CSP: map rendered; app and PWA modules loaded; mocked search and Nominatim result actions worked; mocked OSRM calculation and route alternatives rendered; navigation follow/end cleared the mocked GPS watch and retained the route; mocked geolocation permission denial displayed the expected message; service worker activated; legal pages returned HTTP 200. At 390×844, 768×900, and 1440×900, the map remained visible without horizontal document overflow. No CSP violations or JavaScript errors were observed.

The existing Vercel deployment updated automatically after the push. Live verification confirmed HTTP 200 for the application/bootstrap and legal pages; the live bootstrap digest matches the HTML SRI; MapLibre and OpenFreeMap rendered; actual Nominatim search and OSRM route calculation returned results; route alternatives, navigation start/end, and route-preview retention worked with mocked GPS. The service worker was `activated`; the manifest returned HTTP 200 with `application/manifest+json; charset=utf-8`. The live CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` headers matched configuration, with no CSP violations or JavaScript errors. Responsive checks at 390×844, 768×900, and 1440×900 found no horizontal overflow.

Real device/browser GPS permission and PWA installation prompts were not tested. OpenFreeMap produced non-fatal warnings for null style-filter values and missing style images; map rendering and interaction succeeded.

## Scope and method

Reviewed the local HTML, CSS, JavaScript, API configuration, manifest, offline page, service worker, and vendored MapLibre assets. Ran static checks, local HTTP checks, npm audit snapshots, live-browser compatibility checks, and browser tests with mocked geolocation, Nominatim, OSRM, and map tiles. This is not a penetration test, legal opinion, or external assessment. No malicious request traffic was sent to third-party services.

## Test matrix

| Check | Status | Evidence / limitation |
|---|---|---|
| Geolocation is not invoked during page initialization | PASS | Mocked browser call counter remained at zero on app load. |
| Location use follows an explicit user action | PASS | A mocked location action caused a one-shot request; mocked permission denial displayed an error and caused no search or route request. |
| Navigation end clears a GPS watch | PASS | Mocked navigation created one watch; ending navigation called `clearWatch` and retained route preview. Explicit stop and simulated hidden-page lifecycle also cleared the active watch. |
| Location/search history is not persistently stored | PASS (code review and local test) | No app use of cookies, Web Storage, or IndexedDB for history was found. Search and route state remained in memory; the Jalan cache-clear control removed scoped shell cache entries and unregistered the worker. |
| Route sends endpoints only after explicit calculation | PASS | Mocked OSRM received selected endpoint coordinates only after Calculate route. No external OSRM test request was made. |
| Search sends user query only after explicit submit | PASS | Mocked Nominatim was called on form submission; a 201-character query was rejected client-side with no request. No external Nominatim test request was made. |
| Malicious query/result text does not execute markup | PASS | HTML-shaped mock result rendered as text; no injected `script` or `img` element was created. |
| Malformed search JSON / unexpected shape | PASS | Malformed JSON fixture returned the user-facing unexpected-response error; malformed entries are filtered safely. |
| Malformed route geometry | PASS | Mocked out-of-range route coordinates were rejected with an invalid-response message and the busy state reset. |
| Nominatim and OSRM HTTP errors | PASS | Mocked Nominatim 429 displayed a wait/retry message; mocked OSRM 503 displayed a temporary-unavailable message. |
| Search and route request timeouts | PASS | Delayed local fixtures exercised the 12-second search abort and 15-second route abort; each surfaced the relevant timeout message. |
| OpenFreeMap tile failure handling | PASS (mock) | Mocked tile HTTP 503 requests produced a user-visible map-data message; map resources were not attacked. |
| Route alternatives and navigation regression after MapLibre upgrade | PASS (mock) | Two mocked OSRM routes rendered; selecting route 2 updated summary and instructions. Navigation used one mocked GPS watcher; end/revocation cleared it and preserved route preview. |
| External providers and map viewport disclosure are documented | PASS (code/document review) | See [PRIVACY_DATA_INVENTORY.md](./PRIVACY_DATA_INVENTORY.md). Actual upstream logging and retention remain unknown. |
| User can clear Jalan shell cache and unregister scoped worker | PASS | Local browser test confirmed removal/unregistration; a subsequent worker install populated its versioned shell cache. The control cannot clear provider logs, browser history, permissions, or global HTTP cache. |
| Legal pages load and are linked from app | PASS | Local HTTP returned 200 for both pages; HTML/link checks found app links. Privacy and terms pages were checked at 390×844, 768×900, and 1440×900 with no horizontal overflow. |
| Responsive app and search disclosure | PASS | At 390×844, 768×900, and 1440×900, app document had no horizontal overflow; search disclosure/results no longer overlapped after layout correction. Privacy page also had no horizontal overflow at these sizes. |
| HTML structure, JavaScript syntax, manifest, icons | PASS | No duplicate IDs or buttons missing explicit types in checked pages. `node --check` passed for app/PWA/privacy scripts; manifest parsed and icon PNG dimensions were verified as 192×192 and 512×512. |
| Third-party policies and Nominatim restrictions reviewed | PASS (documentation review) | References and review date recorded in inventory; policies can change and this review is not independent verification. |
| MapLibre integrity and dependency vulnerability audit | PASS WITH WARNINGS | MapLibre 6.18.0 assets are same-origin; bootstrap, main module, shared module, and CSS use SRI/modulepreload integrity metadata. npm tarball SHA-512 matched registry metadata. Temporary npm audit reported a critical vulnerability in prior 4.7.1 (`GHSA-jrc7-96c5-q579`, affected `<=6.4.0`) and zero known advisories for 6.18.0 at review time. No committed lockfile or continuous audit exists. |
| MapLibre 6.18.0 browser compatibility | PASS | Local browser loaded the map, worker, and OpenFreeMap style; route display, alternatives, and navigation were exercised with mocks. Existing provider style emitted non-fatal null-filter warnings. |
| Responsive app after dependency update | PASS | Browser checks at 390×844, 768×900, and 1440×900 found no horizontal document overflow. |
| Remaining external stylesheets and integrity | PASS WITH WARNINGS | No third-party script remains; Google Fonts CSS/font files remain external and are disclosed, but the adaptive stylesheet has no fixed SRI. Consider self-hosting if reducing third-party trust is required. |
| Vercel CSP and security headers | PASS WITH WARNINGS | `vercel.json` defines an enforcing CSP and response headers. Browser testing used a local static server applying those values; actual Vercel response behavior, HTTPS, and production headers remain unverified. |
| Vercel configuration structure | PASS (static checks) | `vercel.json` parses as JSON; targeted checks covered the static framework setting, global/header routes, CSP, manifest MIME, and HTML revalidation. The official schema's framework and header-rule shapes were inspected; Vercel CLI validation was not run. |
| CSP browser compatibility | PASS WITH WARNINGS (local simulation) | The local server applied the configured headers. The app and MapLibre worker/style/tiles loaded; mocked fetches to Nominatim and OSRM origins returned successfully under `connect-src`; no CSP violations or browser runtime errors were observed. Search and route UI flows were not repeated during this header test. The simulation does not reproduce Vercel's platform behavior, and provider resources can change. |
| Vercel HTTPS/HSTS behavior | NOT RUN | No deployment was performed. HTTPS redirects, final response headers, custom-domain HSTS behavior, and project settings must be confirmed on a Vercel preview before production. |
| SQL injection and path traversal | NOT APPLICABLE | No SQL or filesystem-serving backend exists in the reviewed project. |
| AI prompt injection, model poisoning, or tool misuse | NOT APPLICABLE | No AI/LLM integration exists. Reassess before introducing AI features. |
| Physical device, actual browser permission prompt, and live search/routing services | NOT RUN | Requires device/browser and authorized service verification; no such results are claimed. |

## Findings and remediation

1. **Critical MapLibre XSS sanitizer advisory in former 4.7.1 dependency — remediated by upgrade.** Temporary npm audit reported GHSA-jrc7-96c5-q579 (affected `<=6.4.0`). MapLibre 6.18.0 is now vendored and its dependency audit returned zero known advisories at review time. The 6.x compatibility check covered map rendering, route alternatives, and navigation; it is not a full upstream test suite.
2. **External MapLibre CDN integrity gap — remediated.** The library is now served same-origin; npm tarball SHA-512 matched registry metadata, and SRI metadata protects the bootstrap, main module, shared module, and CSS. Runtime worker files are same-origin and included in that verified package; ordinary script-tag SRI is not applied directly to Worker construction.
3. **Privacy transparency and GPS lifecycle — addressed and locally verified.** Point-of-use notices and legal/data-inventory pages were added; explicit location actions, watch cleanup, and non-persistence defaults were verified in mocked browser tests. Operator/legal review remains outstanding.
4. **Map viewport disclosure — disclosed, not eliminated.** OpenFreeMap tile requests reveal the displayed area; following device location may therefore reveal an approximate location area to the map provider.
5. **CSP and deployment headers — configured, deployment verification outstanding.** Added a CSP and security headers in [vercel.json](./vercel.json). Browser checks against a local server confirmed map loading and mocked Nominatim/OSRM origin requests under the policy with no CSP violations. Verify actual response headers, HTTPS/HSTS behavior, and CSP behavior on a Vercel preview before production.
6. **Provider retention and hosting — unknown.** Jalan cannot determine or control independent-provider logging/retention, hosting region, or host logs from this static client. Confirm these before publication.

## Status summary

**Overall: PASS WITH WARNINGS (local implementation, CSP simulation, package audit snapshot, browser compatibility, and mocked tests only).** Vercel preview/production headers and HTTPS behavior, legal placeholders, dependency audit cadence, actual device/browser behavior, and provider practices remain outstanding. The npm audit result reflects the review date and is not a guarantee against later advisories. This is not a security certification or assurance against all attacks.
