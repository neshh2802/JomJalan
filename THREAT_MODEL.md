# Jalan threat model

**Date:** 12 November 2026
**Scope:** Current browser/PWA prototype; no native wrapper, accounts, or backend.

## Assets

- User-entered search text and place results.
- Precise device coordinates, accuracy, route endpoints, and transient route state.
- App code, service-worker cache, manifest, map rendering and route guidance.
- User safety decisions made using approximate route/map information.

## Actors and trust boundaries

- User/browser/device and OS location provider.
- Jalan static application and same-origin service worker.
- Deployment host (identity and logging unknown).
- Nominatim, OSRM demo, OpenFreeMap, OpenStreetMap data, Google Fonts, and the deployment host serving pinned MapLibre vendor assets.
- Malicious or malformed search text, provider response, map style metadata, or network response.

## Data flows and threats

| Flow | Threats | Current controls / residual risk |
|---|---|---|
| Search input → Nominatim | Sensitive query exposure, request abuse, malformed response, reflected/stored XSS | Explicit submit, debounce/rate spacing, abort/timeout, URLSearchParams, validation, safe text rendering. Provider receives query and technical metadata; public endpoint restrictions and retention are external. |
| Browser geolocation → page | Silent collection, excessive tracking, stale/invalid fixes, permission denial | No load-time call; explicit controls, coordinate/accuracy/timestamp checks, one watcher, `clearWatch` on stop and nav end. Browser/OS behavior is external. |
| Page location/route endpoints → OSRM | Precise endpoint disclosure, route URL leakage, provider availability | Route calculation requires user action and inline disclosure; coordinates validated; request is HTTPS; no response caching/history. OSRM receives precise endpoints and request metadata. |
| MapLibre viewport → OpenFreeMap | Location inference from tile requests; malicious map style resource URLs; tile availability | Fixed HTTPS style URL in app code and default viewport in KL. Following GPS causes viewport tile requests that reveal requested area. Dynamic style resources should be reviewed; no offline tile capture. |
| Dependency package → same-origin browser code/CSS | Supply-chain compromise, dependency tampering, availability | MapLibre 6.18.0 is self-hosted from an npm tarball whose SHA-512 matched registry metadata; CSS/main/shared modules use integrity metadata. A temporary npm audit found a critical advisory in old 4.7.1 (`GHSA-jrc7-96c5-q579`, affected `<=6.4.0`); upgrading to 6.18.0 removes that known advisory in the current audit. Package updates still require verification and the deployment host can alter same-origin files. |
| Deployment host → browser security policy | Missing CSP/headers, insecure transport, framing | No host configuration is in this repository. A report-only CSP and recommended headers are documented in `SECURITY.md`; operator must configure and test them at deployment. |
| Same-origin worker/cache | Cache poisoning/stale app, overbroad interception, malicious worker update | Explicit same-origin shell allowlist; API/external URLs excluded; versioned cache and old-cache cleanup; user-confirmed update. Same-origin deployment integrity and headers remain important. |
| Provider JSON → DOM | XSS via malicious result/instruction fields | Dynamic text uses `textContent`/text nodes and route data is structurally validated. Static icon markup is hard-coded. Maintain this rule for new fields. |
| Route/map guidance → driver | Incorrect route, stale data, GPS error, distraction | Prototype caveats and approximate guidance. Not safety-certified; no live traffic or automatic rerouting. Road signs, traffic laws, and driver judgment take precedence. |
| Future native bridge | WebView navigation abuse, overprivileged bridge, background GPS, debug/backup exposure | Not implemented. Keep bridge minimal/allowlisted, use native permissions only for explicit features, stop location on lifecycle end, disable debug and review backup/signing. |

## OWASP and AI threat references

- OWASP Top 10:2025 themes: injection and insecure design are relevant to DOM/API input; software supply-chain failures to CDN resources; security misconfiguration to missing response-header controls; mishandling failures to provider/GPS paths; access-control/authentication concerns are not applicable because no protected backend/account was found.
- No AI model, prompt, tool, vector store, or AI-generated route exists. OWASP LLM Top 10:2025 categories are not currently exploitable app surfaces. If AI is added, constrain tools/data/permissions server-side, validate outputs, defend against indirect prompt injection, require confirmation for consequential actions, and impose budgets/rate limits.

## Out of scope

Production host configuration, provider internal processing, mobile binaries/native APIs, live third-party service penetration testing, and physical-device location behavior. No attacks are to be sent to third-party infrastructure.
