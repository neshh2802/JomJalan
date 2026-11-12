# Jalan — Milestone 9.2: Restore Production Application Initialization

## Incident and fix

- The live Vercel page loaded only the MapLibre bootstrap module from `index.html`. The bootstrap is the intentional single entry point: it awaits MapLibre, then imports `api-config.js`, `privacy.js`, `script.js`, and `pwa.js` in order. This guarantees `window.maplibregl` is ready before the application initializes, and avoids duplicate initialization.
- The live bootstrap request was blocked by Subresource Integrity: the configured digest matched the Windows CRLF working copy, but Git stored and Vercel served the LF-normalized blob. The observed live SHA-384 digest was `G+XFNTpflli0fl5FTqMf2dQASYiiq3DjTYC+MoH4FeqVXGUTxNhLdOHJWnSPEkFh`.
- Updated the bootstrap's SRI digest in `index.html` and added `.gitattributes` to keep that hashed resource LF in future checkouts. No duplicate script tags or navigation changes were introduced.

## Verification

- Confirmed local, staged Git blob, and published digest values match. A local browser loaded the MapLibre map, `script.js`, and `pwa.js` under the configured CSP without JavaScript errors or CSP violations.
- With mock geolocation, Nominatim, and OSRM responses: sidebar and route-planner controls responded; search result actions selected a destination; route calculation and both route alternatives worked; navigation follow/end worked; the GPS watch cleared and route preview remained. Mocked GPS permission denial displayed the expected message.
- Verified service-worker activation and HTTP 200 for Privacy Policy and Terms. At 390×844, 768×900, and 1440×900, the map stayed visible and the document had no horizontal overflow. The route panel fit within the 390 px viewport.
- Live production had not yet been rechecked after the source fix when these local tests were recorded. Real GPS permission prompts and live search/routing were not used in mocked tests.

## Files changed

- Updated: `index.html`, `REPORT.md`, `SECURITY.md`, `SECURITY_TEST_REPORT.md`.
- Added: `.gitattributes`.

---

# Jalan — Milestone 9.1: Vercel Deployment Configuration

## Overview

Prepared the static Jalan project for Vercel using the existing HTML, CSS, vanilla JavaScript, MapLibre, and PWA architecture. No deployment was performed, no UI/navigation code was changed, and no new dependencies were introduced.

## Implemented

- Added [vercel.json](./vercel.json) for Vercel's static "Other" project mode, with no build framework or route rewrites.
- Added an enforcing CSP scoped to the verified runtime origins: same-origin assets, Google Fonts, OpenFreeMap, Nominatim, and OSRM. MapLibre inline style attributes are permitted; external scripts, objects, and frames remain disallowed.
- Added `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and one-year HSTS without `includeSubDomains` or preload.
- Set HTML, legal/offline pages, the service worker, and the web manifest to revalidate. Set the `.webmanifest` response MIME type explicitly.
- Updated [SECURITY.md](./SECURITY.md) and [SECURITY_TEST_REPORT.md](./SECURITY_TEST_REPORT.md) with the policy, evidence, and deployment-dependent limitations.

## Files changed

- Created: `vercel.json`.
- Updated: `SECURITY.md`, `SECURITY_TEST_REPORT.md`, `REPORT.md`.
- No application, navigation, service-worker, manifest, or dependency files were changed for this milestone.

## Verification

- Parsed `vercel.json` and checked key rule structure, CSP presence, manifest MIME, and revalidation rules. Inspected the official Vercel schema's nullable `framework` and header-rule shape; Vercel CLI validation was not run.
- Served the project locally with a test server applying the configured response-header values. The browser loaded Jalan, the MapLibre worker/style and OpenFreeMap map tiles without CSP violations or runtime errors.
- Confirmed mocked browser requests to Nominatim and OSRM origins passed the configured CSP and returned the fixture responses. Search/route UI actions were not rerun in this Vercel-header pass; prior mocked regression results remain separately documented.
- Confirmed the manifest returned HTTP 200 with `application/manifest+json` and the service worker registered and activated.

## Not tested and next steps

- No Vercel deployment or preview was created. Platform routing, actual response-header merging, HTTPS redirects, HSTS behavior, static asset MIME/caching, and CSP must be verified on an approved preview before production.
- Live search/routing, actual device geolocation permission, and installed/offline PWA behavior were not retested in this pass. Do not treat the local simulation as provider, device, or deployment certification.
- Create an authorized Vercel preview, exercise search/route/GPS/PWA flows, inspect browser CSP violations and deployed headers, and then address remaining legal/provider review items before production.

---

# Jalan — Milestone 7: Cross-Platform Architecture & PWA Foundation

## Overview

Milestone 7 adds an installable, folder-relative PWA shell around Jalan's existing HTML, CSS, vanilla JavaScript, MapLibre, and routing code. It does not replace the navigation engine or claim offline maps or navigation.

## Features implemented

- Added a standalone web manifest with Jalan name, `./` start URL and scope, portrait/landscape support, existing theme/background colors, and 192px/512px any-purpose and maskable PNG icons based on the Jalan route-mark.
- Added a versioned service worker that precaches only same-origin application-shell files, removes obsolete Jalan shell caches at activation, and serves a small offline fallback for failed page navigations.
- Vendored MapLibre files, fonts, external map data/tiles, Nominatim, OSRM, and location data are not cached by the service worker. Search and route errors continue through their existing online-service handling.
- Added an install action that uses `beforeinstallprompt` after an explicit user click where supported and shows browser-specific installation guidance otherwise. Installed mode and `appinstalled` hide the action; dismissal does not trigger repeated automatic prompts.
- Added online/offline browser status. Its copy distinguishes cached app shell from live map, search, and route services and cautions that “online” does not guarantee individual services are reachable.
- Added update detection and an explicit **Update Jalan** action. Updates wait for user confirmation; an accepted update waits until navigation ends before activating and reloading.
- Kept platform lifecycle code in `pwa.js`, separate from the shared navigation engine. No Capacitor, Tauri, or new framework was added.

## Files created

- `manifest.webmanifest` — installation metadata and icon declarations.
- `service-worker.js` — versioned app-shell cache, offline navigation fallback, and user-gated update activation.
- `offline.html` — an explicit offline state explaining what is and is not available.
- `pwa.js` — install, connectivity, registration, and update UI.
- `assets/icons/icon-192.png` and `assets/icons/icon-512.png` — Jalan brand icons.

## Existing files modified

- `index.html` — manifest and Apple touch icon links, PWA module, connectivity/install controls.
- `script.js` — emits navigation lifecycle events so accepted updates can wait for navigation to end.
- `style.css` — responsive PWA controls and offline/update states.
- `REPORT.md` — milestone, architecture, testing, and deployment notes.

## Architecture and limitations

- Manifest, service-worker, and shell paths are relative to the app folder so root or subfolder deployments can use the same files.
- The service worker uses network-first behavior for page navigations and an explicit cached offline document on network failure. Only an allowlist of same-origin shell files is precached; API responses, GPS, map tiles, CDN libraries, and fonts remain outside its caches.
- The offline page is an app-shell fallback, not an interactive offline app. Map data, place search, route calculation, and GPS-assisted navigation are not promised offline.
- Installation prompts depend on browser support and install criteria. Browsers without `beforeinstallprompt` receive instructions to use their browser's installation or home-screen menu.
- Native Android, iOS, and desktop wrappers are future options only. Browser GPS and PWA behavior remain platform-dependent.
- Service workers require a secure context: normally HTTPS, or `localhost` during development. Deploy the manifest, service worker, offline document, and icons at the same relative app paths; serve `.webmanifest` with an `application/manifest+json` MIME type.

## Local testing

From this folder, run `python -m http.server 8765` and open `http://localhost:8765/`. Service workers do not work from a `file://` URL. In browser developer tools, inspect the manifest and service-worker registration, simulate offline, and trigger a service-worker update. Online geocoding, routing, map data, and physical-device installation/location require a network-connected browser or device.

## Tests and verification

### Milestone 7 test results

- `node --check` passed for `script.js`, `api-config.js`, `pwa.js`, and `service-worker.js`.
- The manifest parsed as JSON and its name, scope, standalone display, orientation, icon declarations, and 192×192/512×512 PNG dimensions were verified.
- HTML checks found no duplicate IDs or buttons without an explicit type. Local HTTP checks returned the app shell, manifest, service worker, offline page, and icons successfully; `.webmanifest` was served with the expected manifest MIME type.
- Browser testing confirmed automatic service-worker registration and activation, precaching of the expected same-origin shell files, and cleanup of the prior `jalan-shell-v1` cache after the updated worker activated.
- Browser connectivity emulation changed the indicator to Offline and back to Online. The no-prompt installation guidance displayed when `beforeinstallprompt` was unavailable.
- The update banner appeared for a waiting worker; accepting the update activated it and reloaded the page. Deferral while actual navigation is active was not exercised end-to-end.
- At 390×844, 768×900, and 1440×900, the shell had no horizontal document overflow and the install/connectivity controls remained visible.
- The browser automation attempt did not confirm offline navigation fallback. Existing Milestone 6 mocked search, routing, and GPS regression results are documented below; those flows were not rerun for Milestone 7.
- No real install prompt, standalone launch, physical-device behavior, live search/routing regression, or device GPS behavior was verified.

These are local and browser-emulated checks, not physical-device or live-service certification.

## Recommended next milestone

Validate installation and secure-context behavior on physical iOS and Android devices, then evaluate native packaging only if product requirements call for capabilities beyond the responsive PWA.

---

# Jalan — Privacy Inventory and Enforcement Follow-up

## Overview

This privacy-focused phase addresses the disclosure gap identified during the security review. It preserves the existing static HTML, CSS, vanilla JavaScript, MapLibre, geocoding, routing, and PWA architecture. No Capacitor/native integration, AI feature, analytics, advertising tracker, or new framework was introduced.

## Features and documentation

- Added [privacy.js](./privacy.js) to centralize explicit geolocation calls, permission-state reporting, non-persistence defaults, and user-initiated clearing of Jalan's scoped shell caches/service worker.
- Added point-of-use notices for search, route calculation, and location controls. Search input is limited to 200 characters; over-limit input is rejected before a Nominatim request.
- Added [privacy.html](./privacy.html) and [terms.html](./terms.html), linked from the app. Operator identity/contact and other unverified legal details remain clearly marked placeholders for Malaysian legal review.
- Updated location lifecycle handling so navigation end, explicit stop, and page-background/leave events clear the active GPS watch. Route preview stays in transient page memory; location/search/route history is not written to app storage.
- Updated the service-worker shell allowlist to include the legal/privacy resources; search, routing, map tiles, and GPS are not cached.
- Documented data flows, request recipients, triggers, retention unknowns, trust boundaries, and provider references in [PRIVACY_DATA_INVENTORY.md](./PRIVACY_DATA_INVENTORY.md); added [SECURITY.md](./SECURITY.md), [THREAT_MODEL.md](./THREAT_MODEL.md), and [SECURITY_TEST_REPORT.md](./SECURITY_TEST_REPORT.md).

## Files created or modified

- Created: `privacy.js`, `privacy.html`, `terms.html`, `PRIVACY_DATA_INVENTORY.md`, `SECURITY.md`, `THREAT_MODEL.md`, `SECURITY_TEST_REPORT.md`.
- Modified: `index.html`, `script.js`, `style.css`, `service-worker.js`, `REPORT.md`.

## Verification

- Mocked browser checks confirmed no geolocation request on app load; location access followed a user action; permission denial was surfaced; search and route calls occurred only after explicit submit/calculation; and an over-limit search generated no request.
- Mocked malicious HTML-shaped search results rendered as text rather than executable markup.
- Mocked route calculation sent the selected endpoints to OSRM only on calculation. Starting navigation used one GPS watch; ending it cleared the watch and preserved route preview. Explicit stop and a simulated hidden-page event also cleared the active watch.
- The clear-local-data control removed Jalan's scope-specific cache entries and unregistered the service worker. Search and route history were not persisted in browser app storage.
- At 390×844, 768×900, and 1440×900, app, privacy, and terms page layouts had no horizontal overflow. Search disclosure/results overlap found during testing was corrected.
- Local HTTP checks returned 200 for the app, legal pages, privacy module, service worker, and security/privacy documentation. Static checks found no duplicate IDs or buttons lacking an explicit type. Final JavaScript syntax, manifest JSON, and icon dimension checks passed.
- All search, route, and geolocation behavior tests used mocks. No hostile requests were sent to external providers.

## Known issues and outstanding verification

- The legal pages are drafts, not legal advice or proof of compliance. Replace placeholders and obtain qualified Malaysian legal review before publication.
- Hosting provider/region/logging and external provider retention are unknown and outside Jalan's control. Search text is sent in the Nominatim URL; route endpoint coordinates are sent to the OSRM public demo; map tile requests can disclose the viewed area, including an area centered on the user's location.
- Malformed route-response fixtures, actual browser permission prompts, live-provider behavior, and physical-device tests were not performed.
- Production CSP and response security headers, plus a recurring dependency audit process, remain outstanding. MapLibre is now self-hosted from an integrity-verified release with SRI on the entry modules and CSS.
- Clearing Jalan app data cannot remove browser history, provider/hosting logs, device permission records, or browser-managed HTTP cache.

## Recommended next steps

Complete operator/provider and hosting review, populate legal placeholders, obtain Malaysian legal review, and configure/test production security headers. Maintain a lockfile-based recurring dependency audit and verify vendor integrity at release updates. Then perform authorized physical-device permission and lifecycle verification. Do not begin native Android integration until these risks have been reviewed.

---

# Jalan — Production Readiness Security and Reliability Pass

## Implemented

- Replaced the CDN-loaded MapLibre 4.7.1 with same-origin MapLibre GL JS 6.18.0 assets. The release tarball SHA-512 was verified against npm registry metadata before the browser module, worker, stylesheet, and license were vendored. SRI metadata protects the bootstrap, main module, shared module, and CSS. Existing app code remains vanilla JavaScript; a small module bootstrap preserves script initialization order and displays a map-unavailable message if MapLibre fails to load.
- Added the vendor package license and removed the separate UNPKG request. Google Fonts remains an external disclosed resource; its browser-adaptive stylesheet does not use a fixed SRI hash.
- Updated the service-worker cache version for the changed shell and precached the module bootstrap. The larger MapLibre modules/worker remain outside the service-worker cache; maps are not promised offline.
- Added user-visible, rate-limited map data load errors to avoid logging the same tile failure repeatedly.
- Search now distinguishes malformed JSON/unexpected response shapes from an empty result set; invalid result entries are filtered safely.
- Route response validation now returns an explicit invalid-response error for malformed objects and primary route geometry. Existing HTTP status handling, abort timeouts, cancellation on replacement/clear, coordinate validation, and no-auto-retry behavior remain in place. Nominatim and OSRM requests are not automatically retried; Search's manual retry respects the Nominatim request interval.
- Updated security guidance with dependency audit results and example response-header/CSP policy requirements. These headers are recommendations only: the static project does not configure production server headers.

## Dependency audit

- A temporary npm audit for the previous pinned MapLibre 4.7.1 dependency reported **GHSA-jrc7-96c5-q579, critical** (XSS sanitizer bypass; affected versions `<=6.4.0`).
- Upgraded to 6.18.0 after compatibility checks. A temporary audit of 6.18.0 and its npm dependency graph reported zero known advisories on 12 November 2026.
- The project has no package manifest or lockfile; the audit snapshot is not a committed automated audit process. Recheck advisories and publisher integrity during dependency updates.

## Verification performed

- JavaScript syntax checks passed for app scripts, service worker, and the module bootstrap.
- A local browser loaded MapLibre 6.18.0, created the map canvas and worker, loaded the existing OpenFreeMap style, and rendered the map. A mocked OSRM response produced the route summary; two alternatives rendered and selecting the second updated the displayed route, distance, duration, and instructions.
- Mocked Nominatim and OSRM requests verified explicit search/route workflows. Malformed search JSON produced an actionable message; Nominatim HTTP 429 displayed a wait/retry message; a 201-character query is rejected before request (verified in the prior privacy phase).
- Malformed route geometry produced an invalid-response message and reset the loading state. OSRM HTTP 503 produced a temporary-unavailable message. A delayed local OSRM fixture exercised the 15-second abort and timeout message; a delayed Nominatim fixture exercised its 12-second timeout. No external API failure probes were sent.
- Mocked geolocation created exactly one watch, navigation used the fix and displayed progress, ending navigation cleared the watch and preserved the route preview. A simulated permission revocation cleared the watch, stopped navigation, and retained the route preview.
- A mocked OpenFreeMap tile HTTP 503 response caused a user-visible map-data message. This was a browser fixture; live map resources were used only for ordinary visual compatibility checks.
- At 390×844, 768×900, and 1440×900, the application had no horizontal document overflow after the MapLibre update.

## Files changed in this pass

- Updated: `index.html`, `script.js`, `service-worker.js`, `privacy.html`, `PRIVACY_DATA_INVENTORY.md`, `SECURITY.md`, `THREAT_MODEL.md`, `SECURITY_TEST_REPORT.md`, and `REPORT.md`.
- Added: `assets/vendor/maplibre-gl/maplibre-bootstrap.js`, `maplibre-gl.mjs`, `maplibre-gl-shared.mjs`, `maplibre-gl-worker.mjs`, `maplibre-gl.css`, and `LICENSE.txt`.

## Not tested / deployment-dependent

- Production CSP enforcement, security headers, hosting/CDN tampering, real browser install/permissions, physical-device GPS, live Nominatim/OSRM outage behavior, and provider-side retention were not assessed.
- The `SECURITY.md` CSP is a report-only starting point, not a validated production policy. Confirm all live OpenFreeMap style resource hosts and test all map, search, route, PWA update, and location flows before enforcing it.
- Recommended host headers include HSTS after confirming the HTTPS deployment scope, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and clickjacking protection. Legal identity/provider/hosting confirmation and Malaysian legal review remain required.

## Remaining risks and recommended next steps

- Production response headers/CSP remain the primary unresolved application hardening gap. Configure them at the host and verify no needed resource is blocked.
- Keep vendor assets synchronized with the verified npm package release; the same-origin deployment host remains a trusted code-delivery boundary. Maintain and review a lockfile/audit process if package-managed dependencies are introduced.
- Public routing/geocoding/map providers may fail or change policies. No retry loop was added; user-controlled retry avoids amplifying requests and respects provider policy.
- This is a prototype, not safety-certified navigation. No live traffic, background tracking, automatic rerouting, or guarantee of route/GPS accuracy is provided.

---

# Jalan — Milestone 6: Directions and Navigation UI

## Features implemented

- Expanded each Malaysian place result with contextual **Directions to**, **Directions from**, **Set as starting point**, and **Set as destination** actions. The existing result selection, keyboard browsing, loading, retry, and error states remain in place.
- Added Car, Motorcycle, Public transport, Walking, and Heavy vehicle mode selectors. Only Car is connected to the existing OSRM driving endpoint; unsupported modes explain that routing is not available, disable calculation, and never show a fabricated estimate.
- Kept route alternatives as individual selectable cards with distance, estimated duration, road summary, and clear selected-state styling. Route changes and clearing invalidate any pending route request.
- Added a navigation follow/re-centre control. Navigation continues to reuse the existing GPS watcher, route geometry, and progress calculations; permission denial returns to the preserved route preview, while unavailable or inaccurate fixes are surfaced in the guidance panel.
- Refined the compact mobile navigation panel and its map-control spacing, and constrained tablet search layout to prevent horizontal overflow.
- Multi-stop planning is not included: the current OSRM flow calculates a single origin-to-destination route.

## Files modified

- `index.html` — five mode choices, contextual search actions, and a navigation follow control.
- `style.css` — mode selectors, contextual action menu, follow control, and responsive refinements.
- `script.js` — contextual endpoint selection, unsupported-mode guarding, in-flight route cancellation, and navigation follow/error state.
- `REPORT.md` — milestone features, verification, limitations, and next milestone.

## Tests performed

- JavaScript syntax checks passed for `script.js` and `api-config.js`.
- HTML checks found no duplicate IDs or buttons without an explicit type.
- Browser flow with mocked Nominatim, OSRM, and GPS verified **Directions from**, **Directions to**, setting either endpoint, swapping endpoints, route calculation, alternative selection, and unsupported-mode handling.
- Mocked navigation updates changed the next manoeuvre and remaining distance (5.4 km to 2.9 km); follow/re-centre, ending with the route preview retained, low-accuracy fixes, unavailable GPS, and permission denial were exercised.
- Responsive browser checks at 390×844, 768×900, and 1440×900 found no document horizontal overflow. At 390×844, the search-result action menu fit within the viewport, planner fields and route cards fit their panel, and the navigation panel remained clear of the map controls.
- No live routing/search service or physical-device GPS test was performed. The repository has no automated test runner or visual-regression suite.

## Known issues and unsupported features

- Motorcycle, public transport, walking, and heavy-vehicle routing are not connected. Only car routing through the existing OSRM driving endpoint is supported.
- Guidance is approximate and depends on device GPS quality. There is no automatic rerouting, voice guidance, live traffic, background tracking, or multi-stop planning.
- Public OSRM, Nominatim, OpenFreeMap, and browser/device location availability and usage limits remain external dependencies.

## Recommended next milestone

Add a provider-backed routing layer for the next supported travel mode, with explicit provider capability metadata and mocked contract tests before enabling its route estimates. Follow with real-device GPS and accessibility testing.

---

# Jalan — Milestone 5: Directions Planner & Navigation Experience

## Overview

Milestone 5 builds a directions planner and approximate, GPS-assisted route-guidance mode on top of Jalan's existing vanilla JavaScript, MapLibre, Nominatim, and OSRM implementation. It remains a prototype and does not provide production-grade or turn-by-turn live navigation.

## Features implemented

- Search results retain their existing selection behavior and now include a **Directions** action that selects the destination and opens the planner.
- The planner supports a selected origin and destination, the existing **Use my location** flow, origin/destination search using the existing search box, swapping endpoints, clearing a route, closing the planner, and a travel-mode selector. Driving is currently the only available mode; walking and transit are explicitly unavailable.
- OSRM-provided routes appear as selectable cards with estimated time, distance, and route description when available. Selecting an alternative updates map emphasis, route bounds, summary, and directions. No traffic or fastest-route claims are made.
- **Start navigation** opens a compact, high-contrast guidance panel and enables map following. It reuses an existing GPS watch or starts one on the user's explicit action.
- Approximate route progress projects accepted GPS positions onto the selected route geometry to estimate the next manoeuvre, distance to that manoeuvre, remaining route distance, and remaining time.
- GPS readings farther than `max(75 m, 2 × reported accuracy)` from the selected route trigger an off-route warning. Approximate arrival is detected within 60 m of the selected destination and is announced only once per navigation session. Neither case triggers rerouting.
- **End** restores the route planner and route preview. Tracking started before navigation remains active and its earlier follow-mode preference is restored; tracking started by navigation is stopped.
- Manual origin/destination search, swapping, and the navigation panel preserve the existing route/search markers and route layers until route changes or the user clears the route.
- Desktop directions appear on the left side of the map; the mobile planner and navigation panel are sized for a 390px viewport. Essential map controls are raised above the mobile navigation panel.
- GPS coordinates remain in memory. They are not written to storage or sent to external services except when the user explicitly calculates a route using the chosen origin and destination.

## Files modified

- `index.html` — search-result Directions actions, endpoint search/swap controls, mode selector, route cards, Start button, and navigation guidance panel.
- `style.css` — desktop directions panel, route cards, responsive mobile layout, and high-contrast navigation panel.
- `script.js` — endpoint selection and swapping, route-mode handling, navigation lifecycle, watcher reuse, route-progress projection, off-route and arrival detection, and cleanup.
- `REPORT.md` — milestone features, architecture, verification, instructions, and limitations.

## Architecture

The existing search, route calculation, alternative rendering, and GPS watcher remain the shared services. A single `searchTarget` chooses which planner endpoint the existing Nominatim search populates. `currentLocation` remains the route origin; the live `trackedPosition` is separate and is used only for the moving marker, map follow, and navigation progress. Navigation uses the existing `calculatedRoutes` and selected route geometry without making additional routing requests. No new dependencies or frameworks were added.

## Tests and results

- `node --check script.js` and `node --check api-config.js` pass.
- HTML checks found no duplicate IDs or buttons missing an explicit button type.
- Browser tests with mocked Nominatim, OSRM, and GPS verified the result-to-Directions workflow, manual origin search, endpoint swapping, route calculation, alternative selection, and route-summary updates.
- Mocked GPS tests verified watcher reuse, follow-mode entry/restoration, GPS-driven manoeuvre and remaining-distance updates, off-route warning, one-time approximate-arrival state, and ending navigation while preserving the route and a pre-existing tracker.
- Mocked permission-denial and timeout checks verified understandable errors and cleanup. Earlier mocked invalid/inaccurate GPS checks also verified those readings are rejected.
- At 390×844, the navigation panel and essential map controls were checked for overlap. Real-device GPS, sensor accuracy, and real permission behavior were not tested.
- All GPS, search, and route responses used in UI behavior tests were mocked. No real OSRM route was used to verify navigation progress. Public map tiles loaded in the browser; this is not a GPS or route-service verification.
- No project test runner, automated visual-regression suite, or ESLint configuration is included.

## Manual testing

Serve this folder from `localhost` or HTTPS, then:

1. Search for a Malaysian place. Select **Directions** on a result and confirm the planner opens with that destination.
2. Set an origin with **Search**, or select **Use my location**. Search and set a destination, swap endpoints, then calculate a driving route.
3. If OSRM returns alternatives, select each card and verify the selected line, bounds, distance, duration, and instructions update. Availability depends on OSRM.
4. Select **Start navigation** and grant GPS permission. Confirm the next manoeuvre and remaining estimates update with new positions. Manually move the map and re-enable follow if needed.
5. In a local test harness, feed points along the route, beyond the off-route threshold, and within 60 m of the destination. Confirm the off-route warning, approximate arrival, and no automatic rerouting.
6. End navigation. Confirm the selected route preview is preserved. If tracking was already active before navigation, it should remain active; if navigation started it, the watcher should stop.
7. Test permission denial, timeout, invalid coordinates, and low-accuracy fixes with mocked geolocation. Repeat planner and navigation layout checks at 390px and a desktop viewport.

## Known limitations and excluded features

- This is approximate route guidance, not production-grade or precise turn-by-turn live navigation. Route progress is based on straight-line projection to OSRM geometry and device GPS fixes.
- No automatic rerouting, voice guidance, live traffic, background tracking, speed-camera alerts, or community reports are implemented.
- Walking and transit routing are unavailable; only OSRM driving routes are supported.
- Route estimates do not account for live traffic. Public OSRM, Nominatim, and map services have independent availability and usage limits.
- GPS availability, permission UX, accuracy, and heading depend on the browser and device. Real-device testing remains necessary.
