(() => {
  function getAppCachePrefix() {
    const appScopePath = new URL('./', window.location.href).pathname;
    const appScopeKey = appScopePath
      .replace(/^\/|\/$/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase() || 'root';
    return `jalan-shell-${appScopeKey}-`;
  }

  async function getLocationPermissionState() {
    if (!navigator.permissions?.query) {
      return 'unknown';
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return permission.state;
    } catch {
      return 'unknown';
    }
  }

  function getCurrentPosition(options) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location isn't available in this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  function watchPosition(onSuccess, onError, options) {
    if (!navigator.geolocation) {
      throw new Error("Location isn't available in this browser.");
    }
    return navigator.geolocation.watchPosition(onSuccess, onError, options);
  }

  function clearLocationWatch(watchId) {
    if (navigator.geolocation && Number.isInteger(watchId)) {
      navigator.geolocation.clearWatch(watchId);
    }
  }

  async function clearLocalAppData() {
    const appScope = new URL('./', window.location.href).href;
    const cacheNames = await caches.keys();
    const appCachePrefix = getAppCachePrefix();
    const isLegacyRootCache = new URL(appScope).pathname === '/';
    const appCacheNames = cacheNames.filter(name =>
      name.startsWith(appCachePrefix) ||
      (isLegacyRootCache && /^jalan-shell-v\d+$/.test(name))
    );
    const registrations = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    const appRegistrations = registrations.filter(registration => registration.scope === appScope);

    await Promise.all([
      ...appCacheNames.map(name => caches.delete(name)),
      ...appRegistrations.map(registration => registration.unregister()),
    ]);

    return {
      cachesRemoved: appCacheNames.length,
      serviceWorkersUnregistered: appRegistrations.length,
    };
  }

  window.JALAN_PRIVACY = Object.freeze({
    defaults: Object.freeze({
      locationHistory: false,
      searchHistory: false,
      analytics: false,
      advertising: false,
    }),
    getLocationPermissionState,
    getCurrentPosition,
    watchPosition,
    clearLocationWatch,
    clearLocalAppData,
  });

  const permissionState = document.querySelector('#location-permission-state');
  const checkPermissionButton = document.querySelector('#check-location-permission');
  const clearDataButton = document.querySelector('#clear-app-data');
  const toolsStatus = document.querySelector('#privacy-tools-status');

  async function updatePermissionState() {
    if (!permissionState) {
      return;
    }
    const state = await getLocationPermissionState();
    permissionState.textContent = state === 'unknown'
      ? 'Not available in this browser; manage it in browser or device settings.'
      : state;
  }

  checkPermissionButton?.addEventListener('click', updatePermissionState);
  clearDataButton?.addEventListener('click', async () => {
    if (!window.confirm("Clear Jalan's offline app files and unregister its service worker for this app folder? This does not clear browser history or revoke location permission.")) {
      return;
    }
    clearDataButton.disabled = true;
    toolsStatus.textContent = 'Clearing Jalan offline app data…';
    try {
      const result = await clearLocalAppData();
      toolsStatus.textContent = `Removed ${result.cachesRemoved} Jalan cache(s) and unregistered ${result.serviceWorkersUnregistered} service worker(s). Reload online to use Jalan.`;
    } catch (error) {
      console.error('Jalan local app data could not be cleared:', error);
      toolsStatus.textContent = 'Jalan could not clear its offline data. Use your browser’s site-data settings and try again.';
    } finally {
      clearDataButton.disabled = false;
    }
  });

  updatePermissionState();
})();
