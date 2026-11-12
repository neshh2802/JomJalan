# Jalan privacy data inventory

**Reviewed:** 12 November 2026
**Scope:** Current local browser/PWA implementation. No production host, operator, backend, or provider contracts were supplied. This inventory describes observed code and requests, not a guarantee about independent providers.

## Architecture and data flow

```text
Browser page
  ├─ On page load ── app files ──> deployment host (host and log practices unknown)
  ├─ On page load ── MapLibre GL JS/CSS ──> same-origin app host
  ├─ On page load ── font stylesheet/files ──> fonts.googleapis.com / fonts.gstatic.com
  ├─ On page load and map movement ── style, visible map tiles ──> OpenFreeMap
  │                                                      └─ OpenStreetMap-derived map data
  ├─ On explicit search submit ── query and search parameters ──> Nominatim
  ├─ On explicit Calculate route ── origin/destination coordinates ──> OSRM public demo
  └─ On explicit location action ── browser/device Geolocation API
         ├─ current fix and navigation progress held in page memory
         └─ map viewport follows fix ── corresponding map requests ──> OpenFreeMap

Service worker ──> same-origin allowlisted app-shell Cache API only
                  (no search, route, or GPS response caching)
```

### Trust boundaries

1. **User/device to browser:** the user enters search text, chooses endpoints, and triggers location access. The browser/OS decides whether to grant geolocation and may use device or network location sources.
2. **Browser to Jalan page code:** user input and third-party API responses are untrusted. Current search/result/route UI uses text nodes for dynamic content and validates coordinates/route payload structure before use.
3. **Jalan to public providers:** Nominatim, OSRM, OpenFreeMap, Google Fonts, and the deployment host are independent recipients. MapLibre is vendored into the app from a pinned, integrity-verified npm release and is now served by the deployment host. Jalan has no verified control of provider/host infrastructure, logs, retention, or subprocessors.
4. **Page to service worker/cache:** the worker is same-origin and caches an explicit allowlist of shell files. Provider APIs, map tiles, GPS, and route/search responses are excluded.
5. **Operator/deployment boundary:** the hosting provider, deployment region, access logs, retention, TLS/header configuration, and any processors are unknown and need operator confirmation.

## Inventory

| Data category | Collection method / trigger | Purpose | Recipient | Local storage | Retention |
|---|---|---|---|---|---|
| Search text | User submits the search form; requests are debounced and rate-spaced in page code | Geocode Malaysian place/address | `nominatim.openstreetmap.org` | Input/results in page memory; not written to app storage or history | Page memory until dismissed/replaced/reload; provider retention unknown |
| Search result coordinates and labels | Nominatim response; user selects a result | Show a place and choose a route endpoint | Browser page; may be sent to OSRM if selected for a route; map viewport requests may follow the selected place | Page memory only | Until replaced, route cleared, or page reload; provider retention unknown |
| Device location fix, accuracy, heading/speed where available | Browser Geolocation API after user action: Use my location, Re-centre, Start tracking, or Start navigation | Place marker, map follow, approximate progress/off-route/arrival | Browser/OS location implementation; Jalan page. No direct GPS API request to Jalan backend exists | Page memory only; no app-written location history | One-shot fix remains as selected route origin until route state is cleared/reloaded; tracking state is cleared on stop/end; OS/browser permission history is controlled by device |
| Route origin/destination coordinates | User selects Calculate route after setting endpoints | Request car-route geometry, duration, alternatives and instructions | `router.project-osrm.org` public demo | Request/response in page memory; no route-history persistence | Page memory until route changes/clear/reload; OSRM retention unknown |
| Map viewport and tile coordinates | MapLibre loads style/visible tiles on page load and as map pans/zooms/follows location | Render interactive map | OpenFreeMap (`tiles.openfreemap.org`; additional endpoints described by returned style may be used) | No Jalan-managed persistent tile cache; browser HTTP cache may apply. Service worker does not intercept external tiles | Provider/browser retention unknown |
| Map style and UI resources | Automatic browser requests when page loads | Render map, code, styles and fonts | OpenFreeMap, deployment host (vendored MapLibre assets), Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) | Browser-managed HTTP cache may apply; MapLibre vendor assets are not in Jalan's service-worker shell cache | Provider/browser retention unknown |
| Technical request metadata | Standard network requests from browser | Deliver pages/resources/API responses and handle network connections | Hosting provider and each external provider receiving a request | Not stored by Jalan JavaScript; browser/network/provider infrastructure may log it | Unknown; depends on host/provider |
| Geolocation permission state | Browser Permissions API query on privacy page; no prompt is requested by this check | Display current browser permission state | Browser only | Browser/OS-managed; not controlled by Jalan | Browser/OS-defined |
| App shell files | Service-worker install and same-origin application-shell access | PWA shell/offline fallback | Browser Cache API, same origin | Scope-specific cache names `jalan-shell-<scope>-*`; contains app files only | Until worker version cleanup or user clears Jalan offline app data |
| Cookies / local and session storage / IndexedDB | No calls to these mechanisms found in the reviewed app code | None implemented by Jalan | None by app code | None written/read by Jalan | Not applicable; provider/browser behavior is independent |
| Accounts, analytics, ads, identifiers, payment or contacts | No feature or SDK found in reviewed code | None implemented by Jalan | None identified | None in Jalan code | Not applicable |
| Hosting access logs | Inbound requests to deployment are inherent to serving the site | Hosting operation/security (operator must confirm) | Deployment host, presently unidentified | Outside page-controlled storage | Unknown; operator must document before publication |

## Confirmed network destinations and triggers

| Destination | Trigger | Information included / observable |
|---|---|---|
| `https://nominatim.openstreetmap.org/search` | User submits place search | `q`, `format=jsonv2`, `addressdetails=1`, Malaysia country filter, result limit, language preference, ordinary browser request metadata and referrer. The query is part of the URL and could appear in request logs. |
| `https://router.project-osrm.org/route/v1/driving/...` | User submits route calculation with valid endpoints | Longitude/latitude pairs for both endpoints and route options; ordinary request metadata |
| `https://tiles.openfreemap.org/styles/liberty` | Map initialization | Style request and ordinary request metadata |
| Map source/tile URLs in the OpenFreeMap style response | Map load, map pan/zoom, or follow/re-centre | Requested tile z/x/y and ordinary request metadata; allows the provider to infer the displayed map area. Verify any changed style URLs at deployment |
| Same-origin `assets/vendor/maplibre-gl/*` | Page load | Requests for pinned MapLibre 6.18.0 module, worker, and CSS plus ordinary metadata; now served by the deployment host rather than UNPKG |
| `https://fonts.googleapis.com/...` and `https://fonts.gstatic.com/...` | Page load | Font stylesheet/font requests plus ordinary metadata |
| Deployment origin (unknown) | Page, shell, manifest, icon, and legal document requests | Requested same-origin path and ordinary connection metadata; server logging/retention not verified |

OpenStreetMap data is attributed in the map. The current app does not directly request tiles from `openstreetmap.org`; OSM is not treated as an additional tile recipient merely because its data is used. Clicking an attribution or provider link is a separate user action.

## Changes enforced for this phase

- Location calls are routed through `privacy.js`; callers remain explicit user-action handlers. No permission request is made at app initialization.
- `watchPosition` is stopped on the explicit stop action and whenever navigation ends; live tracking state is cleared. The route preview remains in page memory by design.
- Search terms and route data are not written to persistent history; the service worker caches only app files.
- The privacy page exposes a permission-state check and a control to remove Jalan's shell caches and unregister the worker at this app scope.
- Search, location, and route-transfer disclosures are placed at the corresponding controls.
- No analytics, ad trackers, new external services, or new framework dependencies are added.

## Unknowns requiring operator/provider review

- Legal operator identity/contact, hosting provider/region, host log fields and retention, data-processing agreements, and subprocessors.
- Whether/what each provider logs, how long data is retained, cross-border transfers, and requests for deletion. Provider policies can change and this project cannot verify their runtime behavior.
- Dynamic upstream URLs returned by the live OpenFreeMap style and any infrastructure/CDN behind them.
- Browser/device geolocation processing and OS permission retention.
- Current Malaysian legal applicability, notices/consent requirements, and cross-border transfer obligations; obtain qualified local legal review.

## Provider references checked

- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) (includes privacy notice and restrictions; user-submitted searches, at most one request per second per application, and no autocomplete).
- [Nominatim API overview](https://nominatim.org/release-docs/latest/api/Overview/).
- [OpenStreetMap Foundation privacy policy](https://wiki.osmfoundation.org/wiki/Privacy_Policy).
- [OSRM API documentation](https://project-osrm.org/docs/v5.24.0/api/) and [demo-server guidance](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy); public demo is best-effort and can change.
- [OpenFreeMap](https://openfreemap.org/), its [privacy policy](https://openfreemap.org/privacy/), and [terms](https://openfreemap.org/tos/). Provider states no cookies/user database for its public instance, but this inventory does not treat that as a guarantee or assume its upstream infrastructure logs nothing.
- [OpenStreetMap attribution and ODbL](https://www.openstreetmap.org/copyright).
- [MapLibre GL JS 6.18.0 package](https://www.npmjs.com/package/maplibre-gl/v/6.18.0) and [Google privacy policy](https://policies.google.com/privacy).

The OSMF privacy policy describes automatic request records including IP address, browser/device type, OS, referrer, timestamps and accessed pages for its services, including Nominatim. Because Jalan puts search text in the request URL, it may appear as part of accessed/requested-page data; specific query retention for this API path is not established. OSMF says it may operate interaction analytics and notes Piwik IP shortening and a 180-day retention for detailed Piwik usage; whether that analytics applies to this API traffic is not verified. OpenFreeMap's policy checked on 12 November 2026 states its default access logs omit IP addresses and include browser type, referrer, date/time and OS; error logs may include IP and requested URL and are deleted after 7 days; IP logging for a security incident may be enabled for up to 30 days. It also says Cloudflare may be used. These are provider statements, not independently audited by Jalan. OSRM demo request-log retention and the actual deployment host's practices remain unknown.

The current Nominatim integration submits only after the user presses Search, not as autocomplete, and the client enforces a 1.1-second interval between requests within one page. This is not a service-wide rate limiter: aggregate application traffic must remain within the Nominatim policy, and the public endpoint could block use. The operator should obtain an appropriate production geocoder/proxy and a provider-switch plan before broad deployment.

Provider documentation was reviewed on 12 November 2026. Re-check current notices before deployment.
