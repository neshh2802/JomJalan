const APP_SCOPE = self.registration.scope;
const APP_SCOPE_PATH = new URL(APP_SCOPE).pathname;
const APP_SCOPE_KEY = APP_SCOPE_PATH
  .replace(/^\/|\/$/g, '')
  .replace(/[^a-z0-9]+/gi, '-')
  .toLowerCase() || 'root';
const CACHE_PREFIX = `jalan-shell-${APP_SCOPE_KEY}-`;
const CACHE_NAME = `${CACHE_PREFIX}v7`;
const SHELL_PATHS = [
  './',
  'index.html',
  'offline.html',
  'privacy.html',
  'terms.html',
  'style.css',
  'script.js',
  'api-config.js',
  'privacy.js',
  'pwa.js',
  'manifest.webmanifest',
  'assets/icons/mark.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/vendor/maplibre-gl/maplibre-bootstrap.js',
];
const SHELL_URLS = SHELL_PATHS.map(path => new URL(path, APP_SCOPE).href);
const SHELL_URL_SET = new Set(SHELL_URLS);
const OFFLINE_URL = new URL('offline.html', APP_SCOPE).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_URLS.map(async url => {
      const request = new Request(url, { cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok) {
        throw new Error(`Jalan shell resource failed to cache: ${url} (${response.status})`);
      }
      await cache.put(url, response);
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name =>
        (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) ||
        (APP_SCOPE_PATH === '/' && /^jalan-shell-v\d+$/.test(name))
      )
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(APP_SCOPE);
  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && SHELL_URL_SET.has(request.url)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const offlinePage = await cache.match(OFFLINE_URL);
        return offlinePage || new Response(
          'Jalan is offline. Reconnect to load the application.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  if (!SHELL_URL_SET.has(request.url)) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
