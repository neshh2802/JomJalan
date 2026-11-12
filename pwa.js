(() => {
const connectivityStatus = document.querySelector('#connectivity-status');
const connectivityLabel = document.querySelector('#connectivity-label');
const installButton = document.querySelector('#install-app');
const installHelp = document.querySelector('#install-help');
const updateBanner = document.querySelector('#pwa-update-banner');
const updateMessage = document.querySelector('#pwa-update-message');
const updateButton = document.querySelector('#apply-update');

let deferredInstallPrompt = null;
let registration = null;
let waitingWorker = null;
let navigationActive = document.querySelector('.app-shell')?.classList.contains('navigation-active') || false;
let updateAccepted = false;
let reloadAfterUpdate = false;

function updateConnectivityStatus() {
  const online = navigator.onLine;
  connectivityStatus.dataset.state = online ? 'online' : 'offline';
  connectivityStatus.closest('.platform-controls').classList.toggle('is-offline', !online);
  connectivityLabel.textContent = online
    ? 'Online'
    : 'Offline · map, search & routes need internet';
  connectivityStatus.title = online
    ? 'Your browser reports a network connection; individual map and route services may still be unavailable.'
    : 'Jalan’s app shell is cached. Live map data, place search, and route calculations need an internet connection.';
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function updateInstallVisibility() {
  installButton.hidden = isInstalled();
}

function showInstallHelp(message) {
  installHelp.textContent = message;
  installHelp.hidden = false;
  installButton.setAttribute('aria-expanded', 'true');
}

function reloadAfterAcceptedUpdate() {
  if (reloadAfterUpdate && !navigationActive && navigator.serviceWorker.controller) {
    reloadAfterUpdate = false;
    window.location.reload();
  }
}

function showUpdate(worker) {
  if (waitingWorker && waitingWorker !== worker) {
    waitingWorker.removeEventListener('statechange', handleWaitingWorkerStateChange);
  }
  waitingWorker = worker;
  updateMessage.textContent = navigationActive
    ? 'A Jalan update is ready. It will be applied after you end navigation.'
    : 'A Jalan update is ready. Choose when to reload and use it.';
  updateButton.disabled = navigationActive && updateAccepted;
  updateButton.textContent = navigationActive && updateAccepted
    ? 'After navigation'
    : 'Update Jalan';
  updateBanner.hidden = false;
}

function handleWaitingWorkerStateChange() {
  if (waitingWorker?.state === 'installed' && navigator.serviceWorker.controller) {
    showUpdate(waitingWorker);
  }
}

function activateWaitingUpdate() {
  if (!waitingWorker || !updateAccepted || navigationActive) {
    return;
  }
  reloadAfterUpdate = true;
  waitingWorker.postMessage({ type: 'ACTIVATE_UPDATE' });
}

installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) {
    if (!installHelp.hidden) {
      installHelp.hidden = true;
      installButton.setAttribute('aria-expanded', 'false');
      return;
    }
    showInstallHelp(
      'Installation depends on your browser. Try its Install app option, or use Share → Add to Home Screen on iOS.'
    );
    return;
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  installButton.disabled = true;
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === 'accepted') {
      showInstallHelp('Jalan is being installed. You can keep using it in this browser.');
    } else {
      showInstallHelp('Installation was cancelled. You can try again from your browser’s app menu.');
    }
  } catch (error) {
    console.error('Jalan install prompt failed:', error);
    showInstallHelp('This browser could not open its install prompt. Check the browser menu for installation options.');
  } finally {
    installButton.disabled = false;
  }
});

updateButton.addEventListener('click', () => {
  if (!waitingWorker) {
    updateBanner.hidden = true;
    return;
  }
  updateAccepted = true;
  if (navigationActive) {
    updateMessage.textContent = 'Update accepted. It will be applied after you end navigation.';
    updateButton.disabled = true;
    updateButton.textContent = 'After navigation';
    return;
  }
  activateWaitingUpdate();
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installHelp.hidden = true;
  installButton.hidden = true;
  installButton.setAttribute('aria-expanded', 'false');
});

window.addEventListener('online', updateConnectivityStatus);
window.addEventListener('offline', updateConnectivityStatus);
updateConnectivityStatus();
updateInstallVisibility();

document.addEventListener('jalan:navigation-state-change', event => {
  navigationActive = event.detail?.active === true;
  if (!navigationActive) {
    if (updateAccepted) {
      activateWaitingUpdate();
    }
    reloadAfterAcceptedUpdate();
  }
  if (!updateBanner.hidden && !updateAccepted) {
    showUpdate(waitingWorker);
  }
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    reloadAfterAcceptedUpdate();
  });

  navigator.serviceWorker.register('./service-worker.js')
    .then(registered => {
      registration = registered;
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdate(registration.waiting);
      }
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }
        waitingWorker = installingWorker;
        installingWorker.addEventListener('statechange', handleWaitingWorkerStateChange);
      });
    })
    .catch(error => {
      console.error('Jalan service worker registration failed:', error);
      showInstallHelp('App installation and offline fallback require HTTPS or localhost. Jalan still works online in this browser.');
    });
} else {
  showInstallHelp('App installation and offline fallback require a supported browser and HTTPS or localhost.');
}
})();
