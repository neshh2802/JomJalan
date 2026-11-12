try {
  const maplibregl = await import('./maplibre-gl.mjs');
  window.maplibregl = maplibregl;
} catch {
  console.error('MapLibre could not load. Map-dependent features may be unavailable.');
}

await import('../../../api-config.js');
await import('../../../privacy.js');
await import('../../../script.js');
await import('../../../pwa.js');
