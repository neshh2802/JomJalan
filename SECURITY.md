# Jalan security notes

**Review date:** 12 November 2026
**Status:** Prototype security guidance; not a certification or guarantee.

## Current architecture

- Static HTML/CSS/vanilla JavaScript frontend, MapLibre GL JS, service worker, and browser Geolocation API.
- No user authentication, account backend, operator API, or server-side authorization surface was found in the reviewed project.
- `api-config.js` contains only the public OSRM endpoint; no credential, API key, or other secret was found in the reviewed client files. Public service URLs are configuration, not secrets.
- Search is an explicit user request to Nominatim; driving-route endpoint coordinates are an explicit user request to the OSRM public demo.
- MapLibre 6.18.0 JavaScript, worker, and CSS are pinned vendor assets served by the same origin; the package tarball integrity was checked against npm registry metadata before vendoring. Map styles/tiles still come from OpenFreeMap and fonts from Google Fonts.
- The service worker caches a same-origin shell allowlist. External provider/API responses and GPS are not cached.
- External resources observed in the application are Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), OpenFreeMap styles/tiles (`tiles.openfreemap.org`), Nominatim (`nominatim.openstreetmap.org`), and OSRM (`router.project-osrm.org`). MapLibre assets are self-hosted. OpenStreetMap is used for attributed data and links; the app does not directly request tiles from `openstreetmap.org`.
- Dynamic user/provider strings are generally inserted using text nodes/`textContent`; fixed SVG fragments are the only observed `innerHTML` use. Coordinates and route response structures are validated before route rendering. Malformed search/route JSON and unexpected response shapes are surfaced as service errors.

## Privacy and location controls

- No Geolocation call is made during initialization. Location actions are explicit and browser permission remains user/device-controlled.
- A single GPS watch is reused; it is cleared when tracking stops and when navigation ends. No background tracking is implemented.
- No search, route, or location history is written by Jalan to localStorage, sessionStorage, IndexedDB, cookies, or service-worker cache.
- Route endpoints remain transiently in memory to preserve the route preview. Calculating a route sends both endpoint coordinates to OSRM; following a device location can make the map provider observe the displayed area through tile requests.
- `privacy.js` centralizes geolocation wrappers, permission-state reporting, no-persistence defaults, and the user-triggered clear of Jalan's shell caches/service worker.

## Security practices and residual hardening

- Keep all production origins HTTPS. Service workers and geolocation require secure contexts.
- [vercel.json](./vercel.json) configures the static "Other" framework deployment, CSP and response headers. The current CSP allows same-origin scripts; MapLibre requires inline style attributes, so `style-src` includes `'unsafe-inline'` for styles only. Google Fonts, OpenFreeMap, Nominatim, and OSRM are allowlisted only in their relevant resource directives. It blocks objects, external frames, and unlisted sources. The CSP has been browser-tested locally with the app shell and map; mocked requests to Nominatim and OSRM origins passed `connect-src`. Verify on an actual Vercel preview because the local server does not reproduce Vercel's deployment behavior and upstream style resources may change.

- If tightening CSP further, start with `Content-Security-Policy-Report-Only` on a Vercel preview, inspect violations while exercising map/search/routes/PWA, then enforce. Do not copy a generic policy without verifying the actual map style resource hosts:

  ```text
  default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://tiles.openfreemap.org; connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org https://tiles.openfreemap.org; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests
  ```

- Vercel security headers also include `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self), camera=(), microphone=()`, and `X-Frame-Options: DENY` as legacy defense alongside CSP `frame-ancestors 'none'`. HSTS is configured with a one-year `max-age` only (no `includeSubDomains` or preload); Vercel deployments use HTTPS and browsers ignore HSTS received over HTTP. Confirm the production domain is HTTPS before go-live.
- HTML, manifest, and service-worker responses explicitly revalidate so deployments and worker updates are not pinned in a long-lived browser cache. The manifest MIME type is set to `application/manifest+json`; other static assets retain Vercel's default MIME/caching behavior.
- MapLibre CSS and its module files are self-hosted to remove the external package-CDN execution boundary. CSS, main module, shared module, and bootstrap have SRI/modulepreload integrity metadata. The bootstrap's `.gitattributes` rule preserves LF line endings so its SRI digest is stable between Windows worktrees and the Git blob served by Vercel. The worker module is loaded by MapLibre at runtime and cannot use ordinary script-tag SRI; it is served same-origin from the package tarball verified against npm registry SHA-512 metadata. Maintain a pinned, integrity-checked update process.
- A temporary npm dependency audit of MapLibre 4.7.1 found GHSA-jrc7-96c5-q579 (critical, affected `<=6.4.0`). MapLibre was upgraded to 6.18.0 and compatibility-tested in the app; an audit of 6.18.0 and its package dependency graph returned no known advisories at review time. The project still has no committed package manifest/lockfile or automated audit cadence, and advisories can change.
- Google Fonts remains an external stylesheet/font dependency disclosed in the privacy notice. Its stylesheet response is browser/UA-adaptive and does not have a fixed SRI hash; consider self-hosting reviewed font files or retain it only after CSP and provider/privacy review.
- Keep external service URLs configurable, monitor provider policies/availability, observe Nominatim's use restrictions, and do not send confidential search text.
- Avoid logging precise coordinates, search text, complete request URLs, or raw provider payloads. Review browser/host logs separately.
- For a future native wrapper, use a minimal WebView origin/navigation allowlist, do not expose unrestricted JavaScript bridges, request native location permission only for an active user-requested feature, stop native location services on end/terminate, protect signing keys, disable production debugging, review backup/deep-link/export settings, and store any required secrets in OS secure storage. Do not treat frontend configuration as a secret.

## Threat references

OWASP Top 10 categories were considered for this client-side prototype. Access control and authentication are not applicable absent protected accounts/backend; input injection, supply chain, secure configuration, exceptional failures, and privacy boundaries remain relevant. No AI or LLM integration was found, so OWASP LLM Top 10 attack surfaces are not present. Reassess if AI functionality is introduced.

See [PRIVACY_DATA_INVENTORY.md](./PRIVACY_DATA_INVENTORY.md), [THREAT_MODEL.md](./THREAT_MODEL.md), and [SECURITY_TEST_REPORT.md](./SECURITY_TEST_REPORT.md) for scope and evidence.

## Reporting

Before publication, replace the operator identity/contact placeholders in the legal pages. Add a monitored security contact here: **[security contact placeholder]**.
