const KUALA_LUMPUR = [101.6869, 3.139];
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const SEARCH_DEBOUNCE_MS = 350;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const MAX_SEARCH_QUERY_LENGTH = 200;
const SEARCH_LIMIT = 8;
const ROUTE_SOURCE_ID = 'jalan-driving-route';
const ROUTE_CASING_LAYER_ID = 'jalan-driving-route-casing';
const ROUTE_LINE_LAYER_ID = 'jalan-driving-route-line';
const MAX_TRACKING_ACCURACY_METERS = 100;
const MAX_FOLLOW_UPDATE_INTERVAL_MS = 1500;
const FOLLOW_DISTANCE_THRESHOLD_METERS = 25;
const MAP_ERROR_NOTICE_INTERVAL_MS = 10000;

const elements = {
  app: document.querySelector('.app-shell'),
  sidebar: document.querySelector('#sidebar'),
  menuToggle: document.querySelector('#menu-toggle'),
  sidebarScrim: document.querySelector('#sidebar-scrim'),
  searchForm: document.querySelector('#search-form'),
  searchInput: document.querySelector('#place-search'),
  searchResults: document.querySelector('#search-results'),
  searchStatus: document.querySelector('#search-status'),
  routeToggle: document.querySelector('#route-toggle'),
  routeCard: document.querySelector('#route-card'),
  routeSheetToggle: document.querySelector('#route-sheet-toggle'),
  routeCollapsedSummary: document.querySelector('#route-collapsed-summary'),
  routeCollapsedDestination: document.querySelector('#route-collapsed-destination'),
  routeCollapsedChoice: document.querySelector('#route-collapsed-choice'),
  routeCollapsedDistance: document.querySelector('#route-collapsed-distance'),
  routeCollapsedDuration: document.querySelector('#route-collapsed-duration'),
  routeClose: document.querySelector('#route-close'),
  routeForm: document.querySelector('#route-form'),
  useLocationButton: document.querySelector('#use-location-button'),
  routeOriginName: document.querySelector('#route-origin-name'),
  originSearchButton: document.querySelector('#origin-search-button'),
  destinationSearchButton: document.querySelector('#destination-search-button'),
  swapRouteButton: document.querySelector('#swap-route-button'),
  routeDestination: document.querySelector('#route-destination'),
  travelMode: document.querySelector('#travel-mode'),
  travelModeNote: document.querySelector('#travel-mode-note'),
  travelModeOptions: [...document.querySelectorAll('.travel-mode-option')],
  calculateRouteButton: document.querySelector('#calculate-route'),
  clearRouteButton: document.querySelector('#clear-route'),
  routeSummary: document.querySelector('#route-summary'),
  routeDistance: document.querySelector('#route-distance'),
  routeDuration: document.querySelector('#route-duration'),
  routeSummaryOrigin: document.querySelector('#route-summary-origin'),
  routeSummaryDestination: document.querySelector('#route-summary-destination'),
  routeOptions: document.querySelector('#route-options'),
  startNavigationButton: document.querySelector('#start-navigation'),
  routeGuidance: document.querySelector('#route-guidance'),
  nextManoeuvreIcon: document.querySelector('#next-manoeuvre-icon'),
  nextInstructionTitle: document.querySelector('#next-instruction-title'),
  nextInstructionRoad: document.querySelector('#next-instruction-road'),
  nextInstructionDistance: document.querySelector('#next-instruction-distance'),
  instructionsToggle: document.querySelector('#instructions-toggle'),
  instructionsCount: document.querySelector('#instructions-count'),
  routeInstructions: document.querySelector('#route-instructions'),
  routeMessage: document.querySelector('#route-message'),
  locateButton: document.querySelector('#locate-button'),
  trackingStatus: document.querySelector('#tracking-status'),
  trackingStatusDot: document.querySelector('#tracking-status-dot'),
  trackingStartButton: document.querySelector('#tracking-start'),
  trackingStopButton: document.querySelector('#tracking-stop'),
  trackingFollowButton: document.querySelector('#tracking-follow'),
  trackingPanel: document.querySelector('.tracking-panel'),
  mobileExploreButton: document.querySelector('#mobile-explore'),
  mobileGpsButton: document.querySelector('#mobile-gps'),
  mobilePlanButton: document.querySelector('#mobile-plan'),
  navigationPanel: document.querySelector('#navigation-panel'),
  navigationFollowButton: document.querySelector('#navigation-follow'),
  endNavigationButton: document.querySelector('#end-navigation'),
  navigationManoeuvreIcon: document.querySelector('#navigation-manoeuvre-icon'),
  navigationInstruction: document.querySelector('#navigation-instruction'),
  navigationRoad: document.querySelector('#navigation-road'),
  navigationDistanceToManoeuvre: document.querySelector('#navigation-distance-to-manoeuvre'),
  navigationRemainingDistance: document.querySelector('#navigation-remaining-distance'),
  navigationRemainingTime: document.querySelector('#navigation-remaining-time'),
  navigationProgress: document.querySelector('#navigation-progress'),
  navigationArrivalTime: document.querySelector('#navigation-arrival-time'),
  navigationAlert: document.querySelector('#navigation-alert'),
  toast: document.querySelector('#toast'),
};

let map;
let locationMarker;
let trackingMarker;
let trackingWatchId = null;
let trackedPosition;
let latestTrackingTimestamp = 0;
let followMode = false;
let lastFollowUpdateAt = 0;
let searchMarker;
let currentLocation;
let selectedDestination;
let routeRequestId = 0;
let routeAbortController;
let calculatedRoutes = [];
let selectedRouteIndex = 0;
let toastTimer;
let searchDebounceTimer;
let searchAbortController;
let searchPopup;
let lastSearchStartedAt = 0;
let searchRequestId = 0;
let activeResultIndex = -1;
let searchTarget = 'destination';
let navigationActive = false;
let sidebarReturnFocus = null;
let navigationProgressMeters = 0;
let arrivalAnnounced = false;
let lastMapErrorNoticeAt = 0;

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 3600);
}

function notifyNavigationStateChange(active) {
  document.dispatchEvent(new CustomEvent('jalan:navigation-state-change', {
    detail: { active },
  }));
}

function initializeMap() {
  if (!window.maplibregl) {
    showToast("The map library couldn't load. Check your connection and refresh.");
    return;
  }

  map = new maplibregl.Map({
    container: 'map',
    style: MAP_STYLE_URL,
    center: KUALA_LUMPUR,
    zoom: 12,
    minZoom: 4,
    maxZoom: 19,
    attributionControl: false,
    trackResize: true,
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
  map.on('error', event => {
    if (event.error) {
      const now = Date.now();
      if (now - lastMapErrorNoticeAt >= MAP_ERROR_NOTICE_INTERVAL_MS) {
        lastMapErrorNoticeAt = now;
        console.error('Map data failed to load. Check connectivity and provider status.');
        showToast("Some map data couldn't load. Check your connection and try again.");
      }
    }
  });
  map.on('dragstart', disableFollowAfterMapInteraction);
  map.on('zoomstart', disableFollowAfterMapInteraction);
  map.on('rotatestart', disableFollowAfterMapInteraction);
  map.on('pitchstart', disableFollowAfterMapInteraction);
}

function disableFollowAfterMapInteraction(event) {
  if (followMode && event.originalEvent) {
    setFollowMode(false);
  }
}

function setSidebar(open) {
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  if (isMobile) {
    if (open) {
      sidebarReturnFocus = document.activeElement;
    }
    elements.sidebar.classList.toggle('mobile-open', open);
    elements.sidebarScrim.hidden = !open;
    elements.sidebar.inert = !open;
    if (open) {
      elements.sidebar.querySelector(
        'button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
      )?.focus();
    } else {
      const returnFocus = sidebarReturnFocus;
      sidebarReturnFocus = null;
      if (returnFocus?.isConnected) {
        returnFocus.focus();
      }
    }
  } else {
    elements.app.classList.toggle('sidebar-collapsed', !open);
    elements.sidebar.inert = !open;
  }
  elements.menuToggle.setAttribute('aria-expanded', String(open));
  elements.menuToggle.setAttribute(
    'aria-label',
    isMobile
      ? open ? 'Close explore menu' : 'Open explore menu'
      : open ? 'Collapse sidebar' : 'Expand sidebar'
  );
}

function setupSidebar() {
  elements.menuToggle.addEventListener('click', () => {
    const isMobile = window.matchMedia('(max-width: 700px)').matches;
    const isOpen = isMobile
      ? elements.sidebar.classList.contains('mobile-open')
      : !elements.app.classList.contains('sidebar-collapsed');
    setSidebar(!isOpen);
  });

  elements.sidebarScrim.addEventListener('click', () => setSidebar(false));

  const handleResize = () => {
    const focusWasInsideSidebar = elements.sidebar.contains(document.activeElement);
    elements.sidebar.classList.remove('mobile-open');
    elements.sidebarScrim.hidden = true;
    if (window.matchMedia('(max-width: 700px)').matches) {
      elements.app.classList.remove('sidebar-collapsed');
      elements.sidebar.inert = true;
      elements.menuToggle.setAttribute('aria-expanded', 'false');
      elements.menuToggle.setAttribute('aria-label', 'Open explore menu');
      if (focusWasInsideSidebar) {
        elements.menuToggle.focus();
      }
    } else {
      const isOpen = !elements.app.classList.contains('sidebar-collapsed');
      elements.sidebar.inert = !isOpen;
      elements.menuToggle.setAttribute(
        'aria-expanded',
        String(isOpen)
      );
      elements.menuToggle.setAttribute(
        'aria-label',
        isOpen ? 'Collapse sidebar' : 'Expand sidebar'
      );
    }
  };

  window.addEventListener('resize', handleResize);
  document.addEventListener('keydown', event => {
    if (!window.matchMedia('(max-width: 700px)').matches ||
        !elements.sidebar.classList.contains('mobile-open')) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      setSidebar(false);
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = [...elements.sidebar.querySelectorAll(
      'button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
    )].filter(element => element.getClientRects().length > 0);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (
      document.activeElement === first || !elements.sidebar.contains(document.activeElement)
    )) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (
      document.activeElement === last || !elements.sidebar.contains(document.activeElement)
    )) {
      event.preventDefault();
      first.focus();
    }
  });
  handleResize();
}

function setupSearch() {
  elements.searchForm.addEventListener('submit', event => {
    event.preventDefault();
    const query = elements.searchInput.value.trim();
    if (!query) {
      elements.searchInput.focus();
      return;
    }
    if (query.length > MAX_SEARCH_QUERY_LENGTH) {
      const message = `Search is limited to ${MAX_SEARCH_QUERY_LENGTH} characters.`;
      renderSearchMessage(message, 'error');
      elements.searchStatus.textContent = message;
      return;
    }
    scheduleSearch(query);
  });

  elements.searchInput.addEventListener('keydown', handleSearchKeydown);
  elements.searchInput.addEventListener('input', () => {
    if (navigationActive) {
      endNavigation('Navigation ended because the directions were changed.');
    }
    if (searchTarget === 'origin') {
      currentLocation = null;
      elements.routeOriginName.textContent = 'Starting point not set';
      if (locationMarker) {
        locationMarker.remove();
        locationMarker = null;
      }
    } else {
      selectedDestination = null;
      elements.routeDestination.value = '';
    }
    clearRoute();
    setRouteMessage(
      searchTarget === 'origin'
        ? 'Search for a place and select it as your starting point.'
        : 'Search for a place and select a result as your destination.',
      'info'
    );
    updateRouteButtonState();
    if (
      !elements.searchResults.hidden ||
      elements.searchForm.getAttribute('aria-busy') === 'true'
    ) {
      cancelSearch();
    } else {
      elements.searchStatus.textContent = '';
    }
  });

  document.addEventListener('click', event => {
    if (!elements.searchForm.contains(event.target)) {
      cancelSearch();
    }
  });

  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      elements.searchInput.focus();
    }
  });
}

function scheduleSearch(query) {
  const requestId = ++searchRequestId;
  window.clearTimeout(searchDebounceTimer);
  if (searchAbortController) {
    searchAbortController.abort();
  }

  activeResultIndex = -1;
  elements.searchInput.removeAttribute('aria-activedescendant');
  elements.searchInput.setAttribute('aria-expanded', 'true');
  elements.searchForm.setAttribute('aria-busy', 'true');
  elements.searchStatus.textContent = 'Searching Malaysian places.';
  renderSearchMessage('Searching Malaysia…', 'loading');

  const rateLimitDelay = Math.max(0, lastSearchStartedAt + NOMINATIM_MIN_INTERVAL_MS - Date.now());
  searchDebounceTimer = window.setTimeout(
    () => searchPlaces(query, requestId),
    Math.max(SEARCH_DEBOUNCE_MS, rateLimitDelay)
  );
}

async function searchPlaces(query, requestId) {
  const controller = new AbortController();
  searchAbortController = controller;
  lastSearchStartedAt = Date.now();

  const parameters = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'my',
    limit: String(SEARCH_LIMIT),
    'accept-language': 'en-MY,en',
  });
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 12000);

  try {
    const response = await fetch(`${NOMINATIM_URL}?${parameters}`, {
      headers: { Accept: 'application/json' },
      referrerPolicy: 'strict-origin-when-cross-origin',
      signal: controller.signal,
    });

    if (requestId !== searchRequestId) {
      return;
    }
    if (!response.ok) {
      const error = new Error(`Nominatim responded with ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const places = await response.json();
    if (requestId !== searchRequestId) {
      return;
    }
    if (!Array.isArray(places)) {
      const error = new Error('Nominatim returned an unexpected response.');
      error.code = 'InvalidResponse';
      throw error;
    }
    renderSearchResults(places);
  } catch (error) {
    if (requestId !== searchRequestId || (error.name === 'AbortError' && !timedOut)) {
      return;
    }
    console.error('Place search failed:', {
      name: error.name,
      status: error.status,
    });
    const message = timedOut
      ? 'Search took too long. Check your connection and try again.'
      : error.status === 429
        ? 'Search is busy right now. Please wait a moment and try again.'
        : error.name === 'SyntaxError' || error.code === 'InvalidResponse'
          ? 'Search returned an unexpected response. Please try again later.'
        : "We couldn't load places. Check your connection and try again.";
    renderSearchMessage(message, 'error');
    elements.searchStatus.textContent = message;
  } finally {
    window.clearTimeout(timeoutId);
    if (requestId === searchRequestId) {
      searchAbortController = null;
      elements.searchForm.setAttribute('aria-busy', 'false');
    }
  }
}

function renderSearchResults(places) {
  elements.searchResults.replaceChildren();
  elements.searchResults.hidden = false;
  activeResultIndex = -1;
  elements.searchInput.removeAttribute('aria-activedescendant');

  const validPlaces = Array.isArray(places)
    ? places.filter(
        place =>
          place &&
          typeof place === 'object' &&
          isValidCoordinate(place.lat, -90, 90) &&
          isValidCoordinate(place.lon, -180, 180)
      )
    : [];

  if (validPlaces.length === 0) {
    renderSearchMessage(
      'No places found in Malaysia. Try a town, street, landmark, or address.',
      'empty'
    );
    elements.searchStatus.textContent = 'No Malaysian places found.';
    return;
  }

  const list = document.createElement('div');
  list.className = 'search-result-list';
  validPlaces.forEach((place, index) => {
    const { name, address } = getPlaceLabels(place);
    const option = document.createElement('button');
    option.className = 'search-result';
    option.type = 'button';
    option.id = `search-result-${index}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.dataset.resultIndex = String(index);

    const icon = document.createElement('span');
    icon.className = 'result-pin';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';

    const copy = document.createElement('span');
    copy.className = 'result-copy';
    const title = document.createElement('span');
    title.className = 'result-title';
    title.textContent = name;
    const detail = document.createElement('span');
    detail.className = 'result-address';
    detail.textContent = address;
    copy.append(title, detail);
    option.append(icon, copy);
    option.addEventListener('click', () => selectSearchResult(place));

    const row = document.createElement('div');
    row.className = 'search-result-row';
    row.append(option);
    const actions = document.createElement('details');
    actions.className = 'search-result-actions';
    const actionsToggle = document.createElement('summary');
    actionsToggle.textContent = 'Actions';
    actionsToggle.setAttribute('aria-label', `Directions and planner actions for ${name}`);
    const actionMenu = document.createElement('div');
    actionMenu.className = 'search-result-action-menu';
    [
      ['Directions to', 'destination'],
      ['Directions from', 'origin'],
      ['Set as starting point', 'origin'],
      ['Set as destination', 'destination'],
    ].forEach(([label, target]) => {
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = label;
      action.addEventListener('click', () => {
        searchTarget = target;
        selectSearchResult(place);
        openRoutePlanner();
      });
      actionMenu.append(action);
    });
    actions.append(actionsToggle, actionMenu);
    row.append(actions);
    list.append(row);
  });

  elements.searchResults.append(list, createSearchAttribution());
  elements.searchInput.setAttribute('aria-expanded', 'true');
  elements.searchStatus.textContent = `${validPlaces.length} Malaysian ${validPlaces.length === 1 ? 'place' : 'places'} found. Use the arrow keys to browse results.`;
}

function getPlaceLabels(place) {
  const address = place.address || {};
  const name =
    place.name ||
    address.amenity ||
    address.building ||
    address.shop ||
    address.tourism ||
    address.leisure ||
    address.road ||
    String(place.display_name || '').split(',')[0] ||
    'Unnamed place';
  const addressParts = [
    address.house_number,
    address.road || address.pedestrian || address.footway,
    address.neighbourhood || address.suburb || address.quarter,
    address.city || address.town || address.village || address.municipality || address.county,
    address.state,
  ].filter(Boolean);
  const uniqueAddressParts = [...new Set(addressParts.filter(part => part !== name))];
  const detail = uniqueAddressParts.length
    ? uniqueAddressParts.join(', ')
    : String(place.display_name || '')
        .split(',')
        .slice(1, 4)
        .join(', ')
        .trim();

  return { name, address: detail || 'Malaysia' };
}

function createSearchAttribution() {
  const attribution = document.createElement('div');
  attribution.className = 'search-attribution';
  attribution.append(document.createTextNode('Search data © '));
  const link = document.createElement('a');
  link.href = 'https://www.openstreetmap.org/copyright';
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = 'OpenStreetMap contributors';
  attribution.append(link);
  return attribution;
}

function renderSearchMessage(message, state) {
  elements.searchResults.replaceChildren();
  elements.searchResults.hidden = false;
  const status = document.createElement('div');
  status.className = `search-message search-message-${state}`;
  if (state === 'loading') {
    const spinner = document.createElement('span');
    spinner.className = 'inline-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    status.append(spinner);
  }
  const text = document.createElement('span');
  text.textContent = message;
  status.append(text);

  if (state === 'error') {
    const retry = document.createElement('button');
    retry.className = 'search-retry';
    retry.type = 'button';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => elements.searchForm.requestSubmit());
    status.append(retry);
  }

  elements.searchResults.append(status);
  if (state !== 'loading') {
    elements.searchResults.append(createSearchAttribution());
  }
  elements.searchInput.setAttribute('aria-expanded', 'true');
}

function handleSearchKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelSearch();
    elements.searchInput.focus();
    return;
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const options = getSearchOptions();
    if (options.length === 0) {
      return;
    }
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    activeResultIndex =
      activeResultIndex < 0
        ? direction > 0
          ? 0
          : options.length - 1
        : (activeResultIndex + direction + options.length) % options.length;
    updateActiveSearchOption(options);
    return;
  }

  if (event.key === 'Enter' && activeResultIndex >= 0) {
    const options = getSearchOptions();
    if (options[activeResultIndex]) {
      event.preventDefault();
      options[activeResultIndex].click();
    }
  }
}

function getSearchOptions() {
  return [...elements.searchResults.querySelectorAll('[role="option"]')];
}

function updateActiveSearchOption(options) {
  options.forEach((option, index) => {
    const active = index === activeResultIndex;
    option.setAttribute('aria-selected', String(active));
    if (active) {
      elements.searchInput.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });
}

function selectSearchResult(place) {
  const longitude = Number(place.lon);
  const latitude = Number(place.lat);
  if (
    !map ||
    !window.maplibregl ||
    !isValidCoordinate(latitude, -90, 90) ||
    !isValidCoordinate(longitude, -180, 180)
  ) {
    showToast("The map is unavailable, so this place can't be shown.");
    return;
  }

  const labels = getPlaceLabels(place);
  const selectedTarget = searchTarget;
  const selectedPlace = {
    coordinates: [longitude, latitude],
    name: labels.name,
    address: labels.address,
  };
  if (navigationActive) {
    endNavigation('Navigation ended because the directions were changed.');
  }
  if (selectedTarget === 'origin') {
    currentLocation = selectedPlace;
    elements.routeOriginName.textContent = labels.name;
    setLocationMarker(selectedPlace.coordinates);
  } else {
    selectedDestination = selectedPlace;
    elements.routeDestination.value = labels.name;
    setDestinationMarker(selectedPlace, place);
  }
  elements.searchInput.value = labels.name;
  clearRoute();
  updateRouteButtonState();
  setRouteMessage(selectedTarget === 'origin'
    ? `Starting point set to ${labels.name}. Set a destination to calculate a route.`
    : `Destination set to ${labels.name}. Set a starting point to calculate a route.`, 'info');
  closeSearchResults();
  map.flyTo({ center: [longitude, latitude], zoom: getPlaceZoom(place), duration: 1100 });
  if (selectedTarget === 'destination' && searchMarker) {
    searchMarker.togglePopup();
  }
  searchTarget = 'destination';
  elements.searchInput.placeholder = 'Where do you want to go?';
}

function setDestinationMarker(destination, place = {}) {
  if (searchMarker) {
    searchMarker.remove();
  }
  if (searchPopup) {
    searchPopup.remove();
  }
  const popupContent = document.createElement('div');
  popupContent.className = 'place-popup';
  const name = document.createElement('strong');
  name.textContent = destination.name;
  const address = document.createElement('span');
  address.textContent = destination.address || 'Current location';
  popupContent.append(name, address);
  searchPopup = new maplibregl.Popup({
    offset: 24,
    closeButton: true,
    maxWidth: '260px',
  }).setDOMContent(popupContent);
  searchMarker = new maplibregl.Marker({ color: '#176f55' })
    .setLngLat(destination.coordinates)
    .setPopup(searchPopup)
    .addTo(map);
}

function setLocationMarker(coordinates) {
  if (locationMarker) {
    locationMarker.remove();
  }
  locationMarker = new maplibregl.Marker({ color: '#176f55' })
    .setLngLat(coordinates)
    .addTo(map);
}

function setSearchTarget(target) {
  searchTarget = target;
  elements.searchInput.value = '';
  elements.searchInput.placeholder = target === 'origin'
    ? 'Search for a starting point in Malaysia'
    : 'Search for a destination in Malaysia';
  closeSearchResults();
  elements.searchInput.focus();
}

function openRoutePlanner() {
  elements.routeCard.hidden = false;
  elements.app.classList.add('route-planner-open');
  elements.mobilePlanButton.setAttribute('aria-expanded', 'true');
  elements.trackingPanel.classList.remove('is-open');
  elements.mobileGpsButton.setAttribute('aria-expanded', 'false');
  setRouteSheetCollapsed(false);
  elements.routeToggle.setAttribute('aria-expanded', 'true');
  if (window.matchMedia('(max-width: 700px)').matches) {
    elements.routeDestination.focus();
  }
}

function setRouteSheetCollapsed(collapsed) {
  const canCollapse = calculatedRoutes.length > 0;
  const isCollapsed = Boolean(collapsed) && canCollapse;
  elements.routeCard.classList.toggle('is-collapsed', isCollapsed);
  elements.app.classList.toggle('route-sheet-collapsed', isCollapsed);
  elements.routeSheetToggle.setAttribute('aria-expanded', String(!isCollapsed));
  elements.routeSheetToggle.setAttribute(
    'aria-label',
    isCollapsed ? 'Expand route details' : 'Collapse route details'
  );
  elements.routeCollapsedSummary.hidden = !canCollapse;
  elements.routeCollapsedSummary.setAttribute('aria-label', isCollapsed
    ? 'Expand route details'
    : 'Route details');
  elements.routeCollapsedSummary.setAttribute('aria-expanded', String(!isCollapsed));
}

function isValidCoordinate(value, minimum, maximum) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return false;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum;
}

function getPlaceZoom(place) {
  const type = String(place.type || '').toLowerCase();
  const category = String(place.category || place.class || '').toLowerCase();
  const address = place.address || {};

  if (address.house_number || type === 'house' || category === 'building') {
    return 18;
  }
  if (address.city || type === 'city') {
    return 11;
  }
  if (address.town || type === 'town') {
    return 12;
  }
  if (address.village || type === 'village' || type === 'municipality') {
    return 13;
  }
  if (address.suburb || address.neighbourhood || type === 'suburb' || type === 'neighbourhood') {
    return 14;
  }
  if (address.road || type === 'road' || type === 'street') {
    return 16;
  }
  if (address.state && (type === 'administrative' || category === 'boundary')) {
    return 7;
  }
  if (address.county && category === 'boundary') {
    return 9;
  }
  if (category === 'place') {
    return 12;
  }
  return 16;
}

function closeSearchResults() {
  elements.searchResults.hidden = true;
  elements.searchInput.setAttribute('aria-expanded', 'false');
  elements.searchInput.removeAttribute('aria-activedescendant');
  activeResultIndex = -1;
}

function cancelSearch() {
  window.clearTimeout(searchDebounceTimer);
  searchRequestId += 1;
  if (searchAbortController) {
    searchAbortController.abort();
    searchAbortController = null;
  }
  elements.searchForm.setAttribute('aria-busy', 'false');
  elements.searchStatus.textContent = '';
  closeSearchResults();
}

function setupCategories() {
  document.querySelectorAll('.category-card').forEach(button => {
    button.addEventListener('click', () => {
      const selected = button.getAttribute('aria-pressed') !== 'true';
      document.querySelectorAll('.category-card').forEach(category => {
        category.setAttribute('aria-pressed', 'false');
      });
      button.setAttribute('aria-pressed', String(selected));
      if (selected) {
        showToast("Nearby place listings are a preview and aren't connected yet.");
      }
    });
  });
}

function setupRoutePlanner() {
  const setOpen = open => {
    elements.routeCard.hidden = !open;
    elements.app.classList.toggle('route-planner-open', open);
    elements.routeToggle.setAttribute('aria-expanded', String(open));
    elements.mobilePlanButton.setAttribute('aria-expanded', String(open));
    if (open) {
      elements.trackingPanel.classList.remove('is-open');
      elements.mobileGpsButton.setAttribute('aria-expanded', 'false');
      setRouteSheetCollapsed(false);
      elements.routeDestination.focus();
    }
  };

  elements.routeToggle.setAttribute('aria-expanded', 'false');
  elements.routeToggle.addEventListener('click', () => setOpen(elements.routeCard.hidden));
  elements.routeClose.addEventListener('click', () => {
    setOpen(false);
    (window.matchMedia('(max-width: 700px)').matches
      ? elements.mobilePlanButton
      : elements.routeToggle).focus();
  });
  elements.routeSheetToggle.addEventListener('click', () => {
    setRouteSheetCollapsed(elements.routeSheetToggle.getAttribute('aria-expanded') === 'true');
  });
  elements.routeCollapsedSummary.addEventListener('click', () => setRouteSheetCollapsed(false));
  setupRouteSheetDragging();
  elements.originSearchButton.addEventListener('click', () => setSearchTarget('origin'));
  elements.destinationSearchButton.addEventListener('click', () => setSearchTarget('destination'));
  elements.swapRouteButton.addEventListener('click', swapRouteEndpoints);
  elements.startNavigationButton.addEventListener('click', startNavigation);
  elements.endNavigationButton.addEventListener('click', () => endNavigation());
  elements.navigationFollowButton.addEventListener('click', () => {
    if (trackingWatchId === null) {
      setNavigationAlert('Location tracking is unavailable. Try starting navigation again.', 'warning');
      return;
    }
    setFollowMode(true);
    if (trackedPosition) {
      followTrackedPosition(true);
      setNavigationAlert('', '');
    } else {
      setNavigationAlert('Waiting for an accurate GPS position before following.', 'warning');
    }
  });

  elements.useLocationButton.addEventListener('click', async () => {
    if (!map || !window.maplibregl) {
      setRouteMessage('The map is unavailable, so your location cannot be set.', 'error');
      return;
    }
    setLocationLoading(true);
    setRouteMessage('Requesting your current location…', 'loading');
    try {
      currentLocation = await requestCurrentLocation();
      elements.routeOriginName.textContent = currentLocation.name;
      setRouteMessage(
        'Your location is ready. Calculate your driving route when ready.',
        'success'
      );
      updateRouteButtonState();
    } catch (error) {
      setRouteMessage(error.message, 'error');
    } finally {
      setLocationLoading(false);
    }
  });

  elements.routeForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!currentLocation) {
      setRouteMessage('Choose “Use my location” to set your starting point.', 'error');
      elements.useLocationButton.focus();
      return;
    }
    if (!selectedDestination || !elements.routeDestination.value.trim()) {
      setRouteMessage('Search for a place and select a result as your destination.', 'error');
      elements.searchInput.focus();
      return;
    }
    calculateRoute();
  });

  elements.clearRouteButton.addEventListener('click', () => clearRoute('Route cleared.'));
  elements.travelModeOptions.forEach(button => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      if (!mode || mode === elements.travelMode.value) {
        return;
      }
      if (navigationActive) {
        endNavigation('Navigation ended because the travel mode changed.');
      }
      elements.travelMode.value = mode;
      elements.travelModeOptions.forEach(option => {
        option.setAttribute('aria-pressed', String(option === button));
      });
      if (mode !== 'car') {
        clearRoute();
      }
      const isSupported = mode === 'car';
      elements.travelModeNote.textContent = isSupported
        ? 'Car routes use OSRM. Calculating sends both endpoint coordinates to the routing service.'
        : 'Routing for this mode is not connected yet. No route estimate will be shown.';
      setRouteMessage(isSupported
        ? 'Car routing is ready.'
        : `${getTravelModeName(mode)} routing isn’t available yet. Select Car for route planning.`, 'info');
      updateRouteButtonState();
    });
  });
  elements.instructionsToggle.addEventListener('click', () => {
    const expanded = elements.instructionsToggle.getAttribute('aria-expanded') !== 'true';
    elements.instructionsToggle.setAttribute('aria-expanded', String(expanded));
    elements.routeInstructions.hidden = !expanded;
  });
  elements.mobileExploreButton.addEventListener('click', () => {
    const isOpen = elements.sidebar.classList.contains('mobile-open');
    setSidebar(!isOpen);
  });
  elements.mobileGpsButton.addEventListener('click', () => {
    const open = !elements.trackingPanel.classList.contains('is-open');
    elements.trackingPanel.classList.toggle('is-open', open);
    elements.mobileGpsButton.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!elements.routeCard.hidden) {
        setOpen(false);
      }
      (elements.trackingStartButton.hidden
        ? elements.trackingFollowButton
        : elements.trackingStartButton).focus();
    }
  });
  elements.mobilePlanButton.addEventListener('click', () => {
    elements.routeToggle.click();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !elements.routeCard.hidden) {
      setOpen(false);
      (window.matchMedia('(max-width: 700px)').matches
        ? elements.mobilePlanButton
        : elements.routeToggle).focus();
    } else if (
      event.key === 'Escape' &&
      elements.trackingPanel.classList.contains('is-open')
    ) {
      elements.trackingPanel.classList.remove('is-open');
      elements.mobileGpsButton.setAttribute('aria-expanded', 'false');
      elements.mobileGpsButton.focus();
    }
  });
}

function setupRouteSheetDragging() {
  let startY = null;
  let dragHandle = null;
  let suppressClick = false;
  const handles = [
    elements.routeCard.querySelector('.route-card-heading'),
    elements.routeCollapsedSummary,
  ];

  handles.forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      if (!window.matchMedia('(max-width: 700px)').matches) {
        return;
      }
      if (handle !== elements.routeCollapsedSummary && event.target.closest('button, a')) {
        return;
      }
      startY = event.clientY;
      dragHandle = handle;
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (dragHandle !== handle || startY === null) {
        return;
      }
      const offset = Math.max(0, event.clientY - startY);
      elements.routeCard.style.transform = `translateY(${offset}px)`;
    });
    handle.addEventListener('pointerup', event => {
      if (dragHandle !== handle || startY === null) {
        return;
      }
      const distance = event.clientY - startY;
      elements.routeCard.style.transform = '';
      if (Math.abs(distance) > 40) {
        setRouteSheetCollapsed(distance > 0);
        suppressClick = true;
        window.setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
      startY = null;
      dragHandle = null;
    });
    handle.addEventListener('pointercancel', () => {
      elements.routeCard.style.transform = '';
      startY = null;
      dragHandle = null;
    });
  });
  elements.routeCollapsedSummary.addEventListener('click', event => {
    if (suppressClick) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

function startNavigation() {
  const route = calculatedRoutes[selectedRouteIndex];
  if (!route || navigationActive) {
    return;
  }
  navigationActive = true;
  notifyNavigationStateChange(true);
  navigationProgressMeters = 0;
  arrivalAnnounced = false;
  elements.navigationAlert.hidden = true;
  elements.navigationPanel.hidden = false;
  elements.navigationFollowButton.setAttribute('aria-pressed', 'true');
  elements.navigationFollowButton.textContent = 'Following';
  elements.routeCard.hidden = true;
  elements.app.classList.remove('route-planner-open');
  elements.routeToggle.setAttribute('aria-expanded', 'false');
  elements.mobilePlanButton.setAttribute('aria-expanded', 'false');
  elements.trackingPanel.hidden = true;
  elements.trackingPanel.classList.remove('is-open');
  elements.mobileGpsButton.setAttribute('aria-expanded', 'false');
  elements.routeToggle.disabled = true;
  elements.app.classList.add('navigation-active');
  renderNavigationProgress(route);

  if (trackingWatchId === null) {
    startLocationTracking();
    if (trackingWatchId === null) {
      endNavigation('Location tracking could not start. Allow GPS access and try again.');
      return;
    }
  } else {
    setFollowMode(true);
    if (trackedPosition) {
      updateNavigationProgress(trackedPosition);
    }
  }
}

function endNavigation(message = '') {
  if (!navigationActive) {
    return;
  }
  navigationActive = false;
  notifyNavigationStateChange(false);
  navigationProgressMeters = 0;
  arrivalAnnounced = false;
  elements.navigationPanel.hidden = true;
  elements.navigationAlert.hidden = true;
  elements.routeCard.hidden = false;
  elements.app.classList.add('route-planner-open');
  elements.routeToggle.setAttribute('aria-expanded', 'true');
  elements.mobilePlanButton.setAttribute('aria-expanded', 'true');
  elements.trackingPanel.hidden = false;
  elements.routeToggle.disabled = false;
  elements.app.classList.remove('navigation-active');
  setRouteSheetCollapsed(window.matchMedia('(max-width: 700px)').matches);
  if (trackingWatchId !== null) {
    stopLocationTracking();
  }
  if (message) {
    setRouteMessage(message, 'info');
  }
}

function updateNavigationProgress(position) {
  if (!navigationActive || !calculatedRoutes[selectedRouteIndex]) {
    return;
  }
  const route = calculatedRoutes[selectedRouteIndex];
  const routePosition = projectPositionOntoRoute(route, position.coordinates);
  if (!routePosition) {
    setNavigationAlert('Route progress is unavailable for this GPS position.', 'warning');
    return;
  }

  const offRouteThreshold = Math.max(75, position.accuracy * 2);
  if (routePosition.distanceFromRoute > offRouteThreshold) {
    setNavigationAlert(
      'You may be away from the selected route. This preview will not reroute automatically.',
      'warning'
    );
  } else {
    navigationProgressMeters = Math.max(
      navigationProgressMeters,
      routePosition.progressMeters - Math.min(20, position.accuracy * 0.35)
    );
    if (!arrivalAnnounced) {
      setNavigationAlert('', '');
    }
  }

  const distanceToDestination = distanceBetweenCoordinates(
    position.coordinates,
    selectedDestination.coordinates
  );
  if (!arrivalAnnounced && distanceToDestination <= ARRIVAL_RADIUS_METERS) {
    arrivalAnnounced = true;
    setNavigationAlert('Approximate arrival detected. You can end navigation when ready.', 'arrival');
    showToast('Approximate arrival detected.');
  }
  renderNavigationProgress(route, position.accuracy);
}

const ARRIVAL_RADIUS_METERS = 60;

function renderNavigationProgress(route, accuracy = null) {
  const instructions = getNavigationManeuvers(route);
  const tolerance = accuracy === null ? 0 : Math.max(10, accuracy * 0.5);
  const hasStepData = Array.isArray(route.legs) &&
    route.legs.some(leg => Array.isArray(leg?.steps) && leg.steps.length > 0);
  const arrival = instructions.find(instruction => instruction.type === 'arrive');
  const next = hasStepData
    ? instructions.find(
        instruction => instruction.type !== 'depart' &&
          instruction.progressMeters >= navigationProgressMeters + tolerance
      ) || arrival || instructions[0]
    : navigationProgressMeters >= route.distance - tolerance
      ? arrival || instructions[0]
      : instructions.find(instruction => instruction.type !== 'arrive') || instructions[0];
  if (next) {
    elements.navigationManoeuvreIcon.textContent = next.icon;
    elements.navigationInstruction.textContent = next.description;
    elements.navigationRoad.textContent = next.roadName || 'Road name unavailable';
    const nextProgressMeters = hasStepData ? next.progressMeters : route.distance;
    const distanceToManoeuvre = Math.max(0, nextProgressMeters - navigationProgressMeters);
    elements.navigationDistanceToManoeuvre.textContent = accuracy === null
      ? 'Waiting for GPS location'
      : next.type === 'arrive' || !hasStepData
        ? `${formatDistance(distanceToManoeuvre)} to destination`
        : `${formatDistance(distanceToManoeuvre)} to next manoeuvre`;
  }
  const remaining = Math.max(0, route.distance - navigationProgressMeters);
  const remainingDuration = route.distance > 0
    ? route.duration * (remaining / route.distance)
    : 0;
  elements.navigationRemainingDistance.textContent = formatDistance(remaining);
  elements.navigationRemainingTime.textContent = formatDuration(remainingDuration);
  elements.navigationProgress.value = route.distance > 0
    ? Math.min(100, Math.max(0, navigationProgressMeters / route.distance * 100))
    : 0;
  elements.navigationArrivalTime.textContent = `ETA ${new Date(
    Date.now() + remainingDuration * 1000
  ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function getNavigationManeuvers(route) {
  let cumulativeMeters = 0;
  return getRouteInstructions(route).map(instruction => {
    const progressMeters = instruction.location
      ? projectPositionOntoRoute(route, instruction.location)?.progressMeters
      : cumulativeMeters;
    if (instruction.distance !== null) {
      cumulativeMeters += instruction.distance;
    }
    return {
      ...instruction,
      progressMeters: Number.isFinite(progressMeters) ? progressMeters : cumulativeMeters,
    };
  });
}

function projectPositionOntoRoute(route, position) {
  const coordinates = route.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }
  let geometryLength = 0;
  let nearestDistance = Infinity;
  let nearestProgress = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const latitudeRadians = ((start[1] + end[1] + position[1]) / 3) * Math.PI / 180;
    const scaleX = 111320 * Math.cos(latitudeRadians);
    const scaleY = 110540;
    const endX = (end[0] - start[0]) * scaleX;
    const endY = (end[1] - start[1]) * scaleY;
    const pointX = (position[0] - start[0]) * scaleX;
    const pointY = (position[1] - start[1]) * scaleY;
    const segmentLength = Math.hypot(endX, endY);
    const fraction = segmentLength === 0
      ? 0
      : Math.max(0, Math.min(1, (pointX * endX + pointY * endY) / (segmentLength ** 2)));
    const projected = [
      start[0] + (end[0] - start[0]) * fraction,
      start[1] + (end[1] - start[1]) * fraction,
    ];
    const distanceFromSegment = distanceBetweenCoordinates(position, projected);
    if (distanceFromSegment < nearestDistance) {
      nearestDistance = distanceFromSegment;
      nearestProgress = geometryLength + segmentLength * fraction;
    }
    geometryLength += segmentLength;
  }
  return {
    distanceFromRoute: nearestDistance,
    progressMeters: geometryLength > 0
      ? nearestProgress / geometryLength * route.distance
      : 0,
  };
}

function distanceBetweenCoordinates(first, second) {
  const earthRadiusMeters = 6371000;
  const firstLatitude = first[1] * Math.PI / 180;
  const secondLatitude = second[1] * Math.PI / 180;
  const latitudeDifference = (second[1] - first[1]) * Math.PI / 180;
  const longitudeDifference = (second[0] - first[0]) * Math.PI / 180;
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) *
    Math.sin(longitudeDifference / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function setNavigationAlert(message, state) {
  elements.navigationAlert.textContent = message;
  elements.navigationAlert.dataset.state = state;
  elements.navigationAlert.hidden = !message;
}

function swapRouteEndpoints() {
  if (!currentLocation || !selectedDestination) {
    setRouteMessage('Set both a starting point and destination before swapping them.', 'error');
    return;
  }
  if (navigationActive) {
    endNavigation('Navigation ended because the directions were changed.');
  }
  const previousOrigin = currentLocation;
  currentLocation = selectedDestination;
  selectedDestination = previousOrigin;
  elements.routeOriginName.textContent = currentLocation.name;
  elements.routeDestination.value = selectedDestination.name;
  setLocationMarker(currentLocation.coordinates);
  setDestinationMarker(selectedDestination);
  clearRoute();
  updateRouteButtonState();
  setRouteMessage('Starting point and destination swapped. Calculate the new route when ready.', 'info');
}

function updateRouteButtonState() {
  const isCalculating = elements.routeForm.getAttribute('aria-busy') === 'true';
  elements.calculateRouteButton.disabled =
    isCalculating ||
    !currentLocation ||
    !selectedDestination ||
    elements.travelMode.value !== 'car';
}

function getTravelModeName(mode) {
  return {
    motorcycle: 'Motorcycle',
    transit: 'Public transport',
    walking: 'Walking',
    'heavy-vehicle': 'Heavy vehicle',
  }[mode] || 'Selected mode';
}

function setLocationLoading(isLoading) {
  elements.useLocationButton.disabled = isLoading;
  elements.useLocationButton.setAttribute('aria-busy', String(isLoading));
  elements.routeOriginName.textContent = isLoading
    ? 'Finding your location…'
    : currentLocation?.name || 'Current location not set';
}

function setRouteMessage(message, state = 'info') {
  elements.routeMessage.textContent = message;
  elements.routeMessage.dataset.state = state;
}

function requestCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!window.JALAN_PRIVACY) {
      reject(new Error('Privacy controls are unavailable. Reload Jalan and try again.'));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("Location isn't available in this browser."));
      return;
    }

    window.JALAN_PRIVACY.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
    }).then(({ coords }) => {
      if (
        !isValidCoordinate(coords.latitude, -90, 90) ||
        !isValidCoordinate(coords.longitude, -180, 180)
      ) {
        reject(new Error('Your device returned invalid location coordinates. Try again.'));
        return;
      }

      const coordinates = [coords.longitude, coords.latitude];
      setLocationMarker(coordinates);
      resolve({ coordinates, name: 'Current location' });
    }).catch(error => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location access in your browser and try again.'
            : error.code === error.POSITION_UNAVAILABLE
              ? "Your device couldn't determine your location. Check its location settings and try again."
              : 'Finding your location took too long. Try again when you have a clear signal.';
        reject(new Error(message));
    });
  });
}

async function calculateRoute() {
  if (elements.travelMode.value !== 'car') {
    setRouteMessage(
      `${getTravelModeName(elements.travelMode.value)} routing is not connected yet. No route estimate is available.`,
      'error'
    );
    return;
  }
  const origin = currentLocation?.coordinates;
  const destination = selectedDestination?.coordinates;
  if (
    !Array.isArray(origin) ||
    !isValidCoordinate(origin[1], -90, 90) ||
    !isValidCoordinate(origin[0], -180, 180)
  ) {
    setRouteMessage(
      'Your starting location is unavailable. Use “Use my location” and try again.',
      'error'
    );
    return;
  }
  if (
    !Array.isArray(destination) ||
    !isValidCoordinate(destination[1], -90, 90) ||
    !isValidCoordinate(destination[0], -180, 180)
  ) {
    setRouteMessage(
      'Select a valid destination from the search results before calculating a route.',
      'error'
    );
    return;
  }
  if (!map || !window.maplibregl || !window.JALAN_API_CONFIG?.osrmRouteUrl) {
    setRouteMessage('The route service or map is unavailable. Please try again later.', 'error');
    return;
  }

  if (routeAbortController) {
    routeAbortController.abort();
  }
  const requestId = ++routeRequestId;
  routeAbortController = new AbortController();
  removeRouteFromMap();
  resetRouteGuidance();
  elements.routeForm.setAttribute('aria-busy', 'true');
  elements.clearRouteButton.hidden = true;
  updateRouteButtonState();
  setRouteMessage('Finding your best driving route…', 'loading');

  const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const parameters = new URLSearchParams({
    overview: 'full',
    geometries: 'geojson',
    steps: 'true',
    alternatives: 'true',
  });
  const requestUrl = `${window.JALAN_API_CONFIG.osrmRouteUrl}/${coordinates}?${parameters}`;
  const controller = routeAbortController;
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(requestUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (requestId !== routeRequestId) {
      return;
    }
    if (!response.ok) {
      const error = new Error(`OSRM responded with ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const routes = validateRouteResponse(data);
    const displayed = await displayRoutes(routes, 0, requestId);
    if (requestId !== routeRequestId) {
      return;
    }
    if (!displayed) {
      return;
    }
    calculatedRoutes = routes;
    selectedRouteIndex = 0;
    renderRouteGuidance(routes[0]);
    showRouteSummary(routes[0]);
    renderRouteOptions();
    elements.startNavigationButton.hidden = false;
    setRouteSheetCollapsed(window.matchMedia('(max-width: 700px)').matches);
    setRouteMessage(routes.length > 1
      ? `${routes.length} driving routes found. Drive times are estimates and do not include live traffic.`
      : 'Route calculated. Drive times are estimates and do not include live traffic.', 'success');
    elements.clearRouteButton.hidden = false;
  } catch (error) {
    if (requestId !== routeRequestId) {
      return;
    }
    if (error.name === 'AbortError') {
      setRouteMessage('Route calculation timed out. Please try again.', 'error');
    } else {
      console.error('Route calculation failed:', {
        name: error.name,
        status: error.status,
        code: error.code,
      });
      setRouteMessage(getRouteErrorMessage(error), 'error');
    }
  } finally {
    window.clearTimeout(timeoutId);
    if (requestId === routeRequestId) {
      routeAbortController = null;
      elements.routeForm.setAttribute('aria-busy', 'false');
      updateRouteButtonState();
    }
  }
}

function validateRouteResponse(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.routes)) {
    const error = new Error('The route service returned an unexpected response.');
    error.code = 'InvalidResponse';
    throw error;
  }
  if (data.code !== 'Ok' || data.routes.length === 0) {
    const error = new Error('No driving route was found.');
    error.code = data?.code || 'NoRoute';
    throw error;
  }

  const primaryRoute = validateRoute(data.routes[0]);
  if (!primaryRoute) {
    const error = new Error('The route service returned invalid route data.');
    error.code = 'InvalidResponse';
    throw error;
  }
  return [
    primaryRoute,
    ...data.routes.slice(1).map(validateRoute).filter(Boolean),
  ];
}

function validateRoute(route) {
  if (!route || typeof route !== 'object') {
    return null;
  }
  const geometry = route.geometry;
  if (
    !geometry ||
    geometry.type !== 'LineString' ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2 ||
    !geometry.coordinates.every(
      coordinate =>
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        isValidCoordinate(coordinate[0], -180, 180) &&
        isValidCoordinate(coordinate[1], -90, 90)
    ) ||
    !Number.isFinite(route.distance) ||
    route.distance < 0 ||
    !Number.isFinite(route.duration) ||
    route.duration < 0
  ) {
    return null;
  }
  return route;
}

function getRouteErrorMessage(error) {
  if (error.name === 'TypeError') {
    return "Couldn't connect to the route service. Check your connection and try again.";
  }
  if (error.status === 429) {
    return 'The route service is busy. Please wait a moment and try again.';
  }
  if (error.status >= 500) {
    return 'The route service is temporarily unavailable. Please try again later.';
  }
  if (error.status >= 400) {
    return "The route service couldn't calculate this route. Check the selected locations and try again.";
  }
  if (error.name === 'SyntaxError') {
    return 'The route service returned an invalid response. Please try again later.';
  }
  if (error.code === 'InvalidResponse') {
    return 'The route service returned an invalid response. Please try again later.';
  }
  if (error.code === 'NoRoute' || error.code === 'NoSegment') {
    return 'No drivable route was found between these locations.';
  }
  return error.message || 'The route could not be calculated. Please try again.';
}

async function displayRoutes(routes, selectedIndex, requestId) {
  await waitForMapStyle();
  if (requestId !== routeRequestId) {
    return false;
  }

  removeRouteFromMap();
  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: createRouteFeatureCollection(routes, selectedIndex),
  });
  map.addLayer({
    id: ROUTE_CASING_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#ffffff',
      'line-width': ['case', ['get', 'selected'], 10, 7],
      'line-opacity': ['case', ['get', 'selected'], 0.95, 0.62],
    },
  });
  map.addLayer({
    id: ROUTE_LINE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['case', ['get', 'selected'], '#16845f', '#83968c'],
      'line-width': ['case', ['get', 'selected'], 6, 4],
      'line-opacity': ['case', ['get', 'selected'], 0.98, 0.72],
    },
  });

  fitRouteBounds(routes[selectedIndex]);
  return true;
}

function fitRouteBounds(route) {
  const bounds = route.geometry.coordinates.reduce(
    (routeBounds, coordinate) => routeBounds.extend(coordinate),
    new maplibregl.LngLatBounds(route.geometry.coordinates[0], route.geometry.coordinates[0])
  );
  map.fitBounds(bounds, {
    padding: { top: 112, right: 56, bottom: 100, left: 56 },
    maxZoom: 16,
    duration: 1000,
  });
}

function renderRouteOptions() {
  elements.routeOptions.replaceChildren();
  elements.routeOptions.hidden = calculatedRoutes.length === 0;
  if (calculatedRoutes.length === 0) {
    return;
  }

  calculatedRoutes.forEach((route, index) => {
    const option = document.createElement('button');
    option.className = 'route-option';
    option.type = 'button';
    option.setAttribute('aria-pressed', String(index === selectedRouteIndex));
    option.setAttribute('aria-label',
      `Route ${index + 1}, ${(route.distance / 1000).toFixed(1)} kilometres, ${formatDuration(route.duration)}${index === selectedRouteIndex ? ', selected' : ''}`);
    option.addEventListener('click', () => selectRoute(index));

    const label = document.createElement('span');
    label.className = 'route-option-label';
    label.textContent = `${formatDuration(route.duration)}${index === selectedRouteIndex ? ' · Selected' : ''}`;
    const metrics = document.createElement('span');
    metrics.className = 'route-option-metrics';
    metrics.textContent = formatDistance(route.distance);
    const description = document.createElement('span');
    description.className = 'route-option-description';
    const summary = Array.isArray(route.legs)
      ? route.legs.map(leg => leg?.summary).filter(value => typeof value === 'string' && value.trim()).join(' · ')
      : '';
    description.textContent = summary || `Route ${index + 1}`;
    option.append(label, metrics, description);
    elements.routeOptions.append(option);
  });
}

async function selectRoute(index) {
  if (!Number.isInteger(index) || !calculatedRoutes[index] || !map) {
    return;
  }
  selectedRouteIndex = index;
  if (navigationActive) {
    endNavigation('Navigation ended because the selected route changed.');
  }
  const route = calculatedRoutes[index];
  const routeSource = map.getSource(ROUTE_SOURCE_ID);
  if (routeSource) {
    routeSource.setData(createRouteFeatureCollection(calculatedRoutes, index));
    fitRouteBounds(route);
  } else {
    const requestId = routeRequestId;
    const displayed = await displayRoutes(calculatedRoutes, index, requestId);
    if (!displayed || requestId !== routeRequestId) {
      return;
    }
  }
  showRouteSummary(route);
  renderRouteGuidance(route);
  renderRouteOptions();
  elements.startNavigationButton.hidden = false;
  setRouteMessage(
    `Route ${index + 1} selected. Drive time is an estimate and does not include live traffic.`,
    'success'
  );
}

function createRouteFeatureCollection(routes, selectedIndex) {
  return {
    type: 'FeatureCollection',
    features: routes
      .map((route, routeIndex) => ({
        type: 'Feature',
        properties: { routeIndex, selected: routeIndex === selectedIndex },
        geometry: route.geometry,
      }))
      .sort((first, second) => Number(first.properties.selected) - Number(second.properties.selected)),
  };
}

function getRouteInstructions(route) {
  const steps = Array.isArray(route.legs)
    ? route.legs.flatMap(leg => (Array.isArray(leg?.steps) ? leg.steps : []))
    : [];
  const instructions = steps
    .filter(step => step && typeof step === 'object')
    .map(step => {
      const maneuver = step.maneuver && typeof step.maneuver === 'object'
        ? step.maneuver
        : {};
      const roadName = typeof step.name === 'string' ? step.name.trim() : '';
      const type = typeof maneuver.type === 'string' ? maneuver.type : '';
      const modifier = typeof maneuver.modifier === 'string' ? maneuver.modifier : '';
      return {
        type,
        modifier,
        icon: getManeuverIcon(type, modifier),
        description: getManeuverDescription(type, modifier, maneuver.exit),
        roadName,
        distance: Number.isFinite(step.distance) && step.distance >= 0 ? step.distance : null,
        location:
          Array.isArray(maneuver.location) &&
          isValidCoordinate(maneuver.location[0], -180, 180) &&
          isValidCoordinate(maneuver.location[1], -90, 90)
            ? maneuver.location
            : null,
      };
    });

  if (instructions.length === 0) {
    instructions.push({
      type: 'continue',
      modifier: '',
      icon: '↑',
      description: 'Follow the route toward your destination',
      roadName: '',
      distance: null,
      location: null,
    });
  }
  if (!instructions.some(instruction => instruction.type === 'arrive')) {
    instructions.push({
      type: 'arrive',
      modifier: '',
      icon: '◎',
      description: 'Arrive at your destination',
      roadName: '',
      distance: 0,
      location: null,
    });
  }
  return instructions;
}

function getManeuverDescription(type, modifier, exit) {
  const turn = {
    left: 'Turn left',
    right: 'Turn right',
    'sharp left': 'Make a sharp left turn',
    'sharp right': 'Make a sharp right turn',
    'slight left': 'Bear slightly left',
    'slight right': 'Bear slightly right',
    straight: 'Continue straight',
    uturn: 'Make a U-turn',
  };
  const headings = {
    north: 'Head north',
    northeast: 'Head northeast',
    east: 'Head east',
    southeast: 'Head southeast',
    south: 'Head south',
    southwest: 'Head southwest',
    west: 'Head west',
    northwest: 'Head northwest',
  };
  switch (type) {
    case 'depart': return headings[modifier] || 'Start your journey';
    case 'arrive': return 'Arrive at your destination';
    case 'turn':
    case 'end of road': return turn[modifier] || 'Continue onto the next road';
    case 'continue': return 'Continue';
    case 'new name': return 'Continue onto the new road';
    case 'merge': return 'Merge';
    case 'on ramp': return 'Take the ramp';
    case 'off ramp': return 'Take the exit ramp';
    case 'fork': return modifier === 'left' || modifier === 'slight left'
      ? 'Keep left at the fork'
      : modifier === 'right' || modifier === 'slight right'
        ? 'Keep right at the fork'
        : 'Follow the road at the fork';
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return Number.isFinite(exit) && exit > 0
        ? `At the roundabout, take exit ${Math.round(exit)}`
        : 'Continue through the roundabout';
    case 'notification': return 'Continue following the route';
    default: return 'Continue along the route';
  }
}

function getManeuverIcon(type, modifier) {
  if (type === 'arrive') return '◎';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return '⟳';
  if (type === 'merge' || type === 'on ramp') return '↗';
  if (type === 'off ramp') return '↘';
  if (type === 'fork') return modifier.includes('left') ? '↖' : modifier.includes('right') ? '↗' : '↑';
  if (modifier.includes('left')) return modifier === 'slight left' ? '↖' : '↰';
  if (modifier.includes('right')) return modifier === 'slight right' ? '↗' : '↱';
  if (modifier === 'uturn') return '↶';
  return '↑';
}

function renderRouteGuidance(route) {
  const instructions = getRouteInstructions(route);
  const next = instructions.find(instruction => instruction.type !== 'arrive') || instructions[0];
  elements.nextManoeuvreIcon.textContent = next.icon;
  elements.nextInstructionTitle.textContent = next.description;
  elements.nextInstructionRoad.textContent = next.roadName || 'Road name unavailable';
  elements.nextInstructionDistance.textContent = next.distance === null
    ? 'Distance unavailable'
    : next.type === 'arrive'
      ? 'At destination'
      : `${formatDistance(next.distance)} to the next manoeuvre`;
  elements.instructionsCount.textContent = `${instructions.length} steps`;
  elements.routeInstructions.replaceChildren();
  instructions.forEach(instruction => {
    const item = document.createElement('li');
    item.className = `route-instruction${instruction.type === 'arrive' ? ' is-arrival' : ''}`;
    const icon = document.createElement('span');
    icon.className = 'instruction-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = instruction.icon;
    const copy = document.createElement('span');
    copy.className = 'instruction-copy';
    const description = document.createElement('strong');
    description.textContent = instruction.description;
    const road = document.createElement('span');
    road.textContent = instruction.roadName || 'Road name unavailable';
    copy.append(description, road);
    const distance = document.createElement('span');
    distance.className = 'instruction-distance';
    distance.textContent = instruction.type === 'arrive'
      ? 'Arrival'
      : instruction.distance === null
        ? '—'
        : formatDistance(instruction.distance);
    item.append(icon, copy, distance);
    elements.routeInstructions.append(item);
  });
  elements.instructionsToggle.setAttribute('aria-expanded', 'false');
  elements.routeInstructions.hidden = true;
  elements.routeGuidance.hidden = false;
}

function resetRouteGuidance() {
  calculatedRoutes = [];
  selectedRouteIndex = 0;
  elements.routeCollapsedSummary.hidden = true;
  elements.routeCard.classList.remove('is-collapsed');
  elements.app.classList.remove('route-sheet-collapsed');
  elements.routeSheetToggle.setAttribute('aria-expanded', 'true');
  elements.routeSheetToggle.setAttribute('aria-label', 'Collapse route details');
  elements.routeSummary.hidden = true;
  elements.startNavigationButton.hidden = true;
  elements.routeOptions.replaceChildren();
  elements.routeOptions.hidden = true;
  elements.routeInstructions.replaceChildren();
  elements.routeInstructions.hidden = true;
  elements.routeGuidance.hidden = true;
  elements.instructionsToggle.setAttribute('aria-expanded', 'false');
}

function waitForMapStyle() {
  if (map.isStyleLoaded()) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const readinessEvents = ['styledata', 'render', 'idle'];
    const timeoutId = window.setTimeout(() => {
      readinessEvents.forEach(eventName => map.off(eventName, handleMapReady));
      reject(new Error('The map is still loading. Please try the route again.'));
    }, 10000);
    const handleMapReady = () => {
      if (map.isStyleLoaded()) {
        window.clearTimeout(timeoutId);
        readinessEvents.forEach(eventName => map.off(eventName, handleMapReady));
        resolve();
      }
    };
    readinessEvents.forEach(eventName => map.on(eventName, handleMapReady));
    handleMapReady();
  });
}

function showRouteSummary(route) {
  elements.routeDistance.textContent = `${(route.distance / 1000).toFixed(1)} km`;
  elements.routeDuration.textContent = formatDuration(route.duration);
  elements.routeSummaryOrigin.textContent = currentLocation.name;
  elements.routeSummaryDestination.textContent = selectedDestination.name;
  elements.routeCollapsedDestination.textContent = selectedDestination.name;
  elements.routeCollapsedChoice.textContent = `Route ${selectedRouteIndex + 1} · Selected`;
  elements.routeCollapsedDistance.textContent = formatDistance(route.distance);
  elements.routeCollapsedDuration.textContent = formatDuration(route.duration);
  elements.routeSummary.hidden = false;
}

function formatDistance(metres) {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${Math.round(metres / 10) * 10} m`;
}

function formatDuration(seconds) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${totalMinutes} min`;
  }
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function removeRouteFromMap() {
  if (!map || !map.getStyle()) {
    return;
  }
  if (map.getLayer(ROUTE_LINE_LAYER_ID)) {
    map.removeLayer(ROUTE_LINE_LAYER_ID);
  }
  if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
    map.removeLayer(ROUTE_CASING_LAYER_ID);
  }
  if (map.getSource(ROUTE_SOURCE_ID)) {
    map.removeSource(ROUTE_SOURCE_ID);
  }
}

function clearRoute(message = '') {
  routeRequestId += 1;
  if (routeAbortController) {
    routeAbortController.abort();
    routeAbortController = null;
  }
  elements.routeForm.setAttribute('aria-busy', 'false');
  updateRouteButtonState();
  removeRouteFromMap();
  resetRouteGuidance();
  elements.clearRouteButton.hidden = true;
  if (message) {
    setRouteMessage(message, 'info');
  }
}

function setupGeolocation() {
  elements.trackingStartButton.addEventListener('click', startLocationTracking);
  elements.trackingStopButton.addEventListener('click', () => stopLocationTracking());
  elements.trackingFollowButton.addEventListener('click', () => {
    if (trackingWatchId !== null) {
      setFollowMode(!followMode);
    }
  });

  elements.locateButton.addEventListener('click', async () => {
    if (!map || !window.maplibregl) {
      showToast("The map is unavailable, so your location can't be shown.");
      return;
    }

    if (trackingWatchId !== null) {
      if (!trackedPosition) {
        showToast('Waiting for an accurate GPS position. Keep tracking on and try again.');
        return;
      }
      if (!followMode) {
        setFollowMode(true);
      } else {
        map.flyTo({
          center: trackedPosition.coordinates,
          zoom: Math.max(map.getZoom(), 15),
          duration: 650,
        });
      }
      showToast('Map centred on your current location.');
      return;
    }

    elements.locateButton.disabled = true;
    try {
      currentLocation = await requestCurrentLocation();
      elements.routeOriginName.textContent = currentLocation.name;
      updateRouteButtonState();
      map.flyTo({ center: currentLocation.coordinates, zoom: 15, duration: 1000 });
      showToast('Showing your current location.');
    } catch (error) {
      showToast(error.message);
    } finally {
      elements.locateButton.disabled = false;
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || trackingWatchId === null) {
      return;
    }
    if (navigationActive) {
      endNavigation('Navigation ended because Jalan moved to the background. Start it again when ready.');
    } else {
      stopLocationTracking('Tracking stopped because Jalan moved to the background.');
    }
  });

  window.addEventListener('pagehide', () => {
    if (navigationActive) {
      endNavigation('Navigation ended because Jalan was closed or left.');
    } else if (trackingWatchId !== null) {
      stopLocationTracking('Tracking stopped because Jalan was closed or left.');
    }
  });
}

function startLocationTracking() {
  if (trackingWatchId !== null) {
    return;
  }
  if (!map || !window.maplibregl) {
    setTrackingStatus('The map is unavailable, so tracking cannot start.', 'error');
    return;
  }
  if (!navigator.geolocation) {
    setTrackingStatus("Location isn't available in this browser.", 'error');
    return;
  }

  setTrackingStatus('Requesting location permission…', 'loading');
  try {
    if (!window.JALAN_PRIVACY) {
      setTrackingStatus('Privacy controls are unavailable. Reload Jalan before using location.', 'error');
      return;
    }
    const watchId = window.JALAN_PRIVACY.watchPosition(
      handleTrackingPosition,
      handleTrackingError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    if (!Number.isInteger(watchId)) {
      throw new Error('Location tracking could not be started.');
    }
    trackingWatchId = watchId;
    elements.trackingStartButton.hidden = true;
    elements.trackingStopButton.hidden = false;
    elements.trackingFollowButton.disabled = false;
    setFollowMode(true);
    setTrackingStatus('Waiting for an accurate GPS position…', 'loading');
  } catch (error) {
    console.error('Location tracking could not start:', error);
    setTrackingStatus('Location tracking could not start. Check your device settings and try again.', 'error');
  }
}

function handleTrackingPosition(position) {
  if (trackingWatchId === null) {
    return;
  }
  const timestamp = Number(position?.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= latestTrackingTimestamp) {
    setTrackingStatus('Ignored an outdated GPS update.', 'warning');
    if (navigationActive) {
      setNavigationAlert('An outdated GPS update was ignored. Waiting for a newer fix.', 'warning');
    }
    return;
  }
  const latitude = position?.coords?.latitude;
  const longitude = position?.coords?.longitude;
  if (
    !isValidCoordinate(latitude, -90, 90) ||
    !isValidCoordinate(longitude, -180, 180)
  ) {
    setTrackingStatus('GPS returned an invalid position. Waiting for another update.', 'error');
    if (navigationActive) {
      setNavigationAlert('GPS returned an invalid position. Waiting for another update.', 'warning');
    }
    return;
  }

  const rawAccuracy = position.coords.accuracy;
  const accuracy = Number(rawAccuracy);
  if (
    rawAccuracy === null ||
    rawAccuracy === undefined ||
    rawAccuracy === '' ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > MAX_TRACKING_ACCURACY_METERS
  ) {
    setTrackingStatus(
      Number.isFinite(accuracy) && accuracy > MAX_TRACKING_ACCURACY_METERS
        ? `GPS accuracy is low (${Math.round(accuracy)} m). Waiting for a clearer signal…`
        : 'GPS accuracy is unavailable. Waiting for a clearer signal…',
      'warning'
    );
    if (navigationActive) {
      setNavigationAlert('GPS accuracy is too low to update route guidance. Waiting for a clearer fix.', 'warning');
    }
    return;
  }

  latestTrackingTimestamp = timestamp;
  const coordinates = [Number(longitude), Number(latitude)];
  const rawHeading = position.coords.heading;
  const heading = Number(rawHeading);
  const speed = Number(position.coords.speed);
  const hasReliableHeading =
    rawHeading !== null &&
    rawHeading !== undefined &&
    rawHeading !== '' &&
    Number.isFinite(heading) &&
    heading >= 0 &&
    heading <= 360 &&
    Number.isFinite(speed) &&
    speed > 0.5;
  trackedPosition = {
    coordinates,
    timestamp,
    accuracy,
    heading: hasReliableHeading ? heading : null,
  };
  updateTrackingMarker(trackedPosition);
  setTrackingStatus(
    `Tracking location · ±${Math.round(accuracy)} m accuracy`,
    'active'
  );
  followTrackedPosition();
  updateNavigationProgress(trackedPosition);
}

function updateTrackingMarker(position) {
  if (!trackingMarker) {
    const markerElement = document.createElement('span');
    markerElement.className = 'tracking-marker';
    markerElement.setAttribute('aria-label', 'Your current location');
    markerElement.innerHTML =
      '<span class="tracking-marker-pulse"></span><span class="tracking-marker-arrow" aria-hidden="true"></span>';
    trackingMarker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
      .setLngLat(position.coordinates)
      .addTo(map);
  } else {
    trackingMarker.setLngLat(position.coordinates);
  }
  const arrow = trackingMarker.getElement().querySelector('.tracking-marker-arrow');
  arrow.hidden = position.heading === null;
  if (position.heading !== null) {
    arrow.style.setProperty('--tracking-heading', `${position.heading}deg`);
  }
}

function followTrackedPosition(force = false) {
  if (!followMode || !trackedPosition || !map) {
    return;
  }
  const now = Date.now();
  const currentCenter = map.getCenter();
  const distanceFromCenter = new maplibregl.LngLat(
    currentCenter.lng,
    currentCenter.lat
  ).distanceTo(trackedPosition.coordinates);
  if (
    !force &&
    (now - lastFollowUpdateAt < MAX_FOLLOW_UPDATE_INTERVAL_MS ||
      distanceFromCenter < FOLLOW_DISTANCE_THRESHOLD_METERS)
  ) {
    return;
  }
  lastFollowUpdateAt = now;
  map.easeTo({ center: trackedPosition.coordinates, duration: force ? 400 : 500 });
}

function setFollowMode(enabled) {
  followMode = Boolean(enabled) && trackingWatchId !== null;
  elements.trackingFollowButton.setAttribute('aria-pressed', String(followMode));
  elements.trackingFollowButton.textContent = `Follow ${followMode ? 'on' : 'off'}`;
  if (elements.navigationFollowButton) {
    elements.navigationFollowButton.setAttribute('aria-pressed', String(followMode));
    elements.navigationFollowButton.textContent = followMode ? 'Following' : 'Follow location';
  }
  if (followMode && trackedPosition) {
    followTrackedPosition(true);
  }
}

function handleTrackingError(error) {
  if (trackingWatchId === null) {
    return;
  }
  if (error.code === error.PERMISSION_DENIED) {
    const message = 'Location permission was denied. Allow location access in your browser and try again.';
    stopLocationTracking(
      message,
      'error'
    );
    if (navigationActive) {
      endNavigation(message);
    }
    return;
  }
  const message = error.code === error.POSITION_UNAVAILABLE
    ? "Your device couldn't determine your location. Check its location settings."
    : 'GPS is taking longer than expected. Waiting for a location update…';
  const state = error.code === error.POSITION_UNAVAILABLE ? 'error' : 'warning';
  setTrackingStatus(message, state);
  if (navigationActive) {
    setNavigationAlert(message, state);
  }
}

function stopLocationTracking(message = 'Tracking is off.', state = 'idle') {
  if (trackingWatchId !== null && window.JALAN_PRIVACY) {
    window.JALAN_PRIVACY.clearLocationWatch(trackingWatchId);
  }
  trackingWatchId = null;
  trackedPosition = null;
  latestTrackingTimestamp = 0;
  lastFollowUpdateAt = 0;
  if (trackingMarker) {
    trackingMarker.remove();
    trackingMarker = null;
  }
  followMode = false;
  elements.trackingStartButton.hidden = false;
  elements.trackingStopButton.hidden = true;
  elements.trackingFollowButton.disabled = true;
  elements.trackingFollowButton.setAttribute('aria-pressed', 'false');
  elements.trackingFollowButton.textContent = 'Follow off';
  setTrackingStatus(message, state);
  if (navigationActive) {
    setNavigationAlert(
      state === 'error'
        ? message
        : 'Location tracking stopped. Route guidance will not update until tracking resumes.',
      'warning'
    );
    elements.navigationFollowButton.setAttribute('aria-pressed', 'false');
    elements.navigationFollowButton.textContent = 'Follow location';
  }
}

function setTrackingStatus(message, state) {
  elements.trackingStatus.textContent = message;
  elements.trackingStatus.dataset.state = state;
  elements.trackingStatusDot.dataset.state = state;
}

initializeRouteButtonState();
initializeMap();
setupSidebar();
setupSearch();
setupCategories();
setupRoutePlanner();
setupGeolocation();

function initializeRouteButtonState() {
  elements.routeForm.setAttribute('aria-busy', 'false');
  updateRouteButtonState();
}
