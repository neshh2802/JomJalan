# Jalan — Milestone 7: Cross-Platform Architecture & PWA Foundation

## Overview

Milestone 7 adds an installable, folder-relative PWA shell around Jalan's existing HTML, CSS, vanilla JavaScript, MapLibre, and routing code. It does not replace the navigation engine or claim offline maps or navigation.

## Features implemented

- Added a standalone web manifest with Jalan name, `./` start URL and scope, portrait/landscape support, existing theme/background colors, and 192px/512px any-purpose and maskable PNG icons based on the Jalan route-mark.
- Added a versioned service worker that precaches only same-origin application-shell files, removes obsolete Jalan shell caches at activation, and serves a small offline fallback for failed page navigations.
- MapLibre, fonts, external map data/tiles, Nominatim, OSRM, and location data are not cached by the service worker. Search and route errors continue through their existing online-service handling.
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
