/* OVERWATCH // tile-view overlay (Leaflet)
   replaces the globe canvas at deep zoom.
   modes: STREET (Carto Voyager) / DARK (Carto Dark Matter, default) / SATELLITE (Esri World Imagery)
   markers from visible nodes (bbox-bounded for perf). */

window.OVERWATCH_MAP = (function () {
  let map = null;
  let baseLayer = null;
  let overlayLayer = null;
  let markerLayer = null;
  let mode = 'dark';
  let isOpenFlag = false;
  let autoOpened = false;
  let host = null;

  const TILE = {
    sat:   { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom:19, attribution:'Tiles © Esri' },
    dark:  { url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', maxZoom:19, attribution:'© Carto · © OSM' },
    street:{ url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', maxZoom:19, attribution:'© Carto · © OSM' },
    osm:   { url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom:19, attribution:'© OpenStreetMap contributors' }
  };

  function ensureHost() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'tile-host';
    host.className = 'tile-host hidden';
    host.innerHTML = `
      <div class="tile-bar">
        <button class="tile-btn" id="tile-back">◀ GLOBE</button>
        <div class="tile-modes">
          <button class="tile-btn" data-mode="dark">DARK</button>
          <button class="tile-btn" data-mode="street">STREET</button>
          <button class="tile-btn" data-mode="sat">SATELLITE</button>
          <button class="tile-btn" id="tile-mp">MAPILLARY</button>
        </div>
        <div class="tile-meta">
          <span id="tile-coords" class="dim">—</span>
          <span id="tile-zoom" class="dim">z —</span>
          <span id="tile-count" class="dim">— markers</span>
        </div>
      </div>
      <div id="tile-map" class="tile-map"></div>
      <div id="tile-mp-pane" class="tile-mp hidden"><iframe id="tile-mp-frame" src="about:blank" allow="geolocation; fullscreen" referrerpolicy="no-referrer"></iframe></div>
    `;
    const wrap = document.getElementById('globe-wrap');
    wrap.appendChild(host);

    host.querySelector('#tile-back').addEventListener('click', () => closeOverlay(true));
    host.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    host.querySelector('#tile-mp').addEventListener('click', toggleMapillary);
  }

  function setMode(name) {
    const src = TILE[name]; if (!src || !map) return;
    if (baseLayer) map.removeLayer(baseLayer);
    if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; }
    baseLayer = L.tileLayer(src.url, { maxZoom: src.maxZoom, attribution: src.attribution }).addTo(map);
    mode = name;
    host.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === name));
  }

  function refreshMarkers() {
    if (!map) return;
    if (markerLayer) { map.removeLayer(markerLayer); markerLayer = null; }
    // Take the N nearest to map center — guarantees markers always visible
    // even in rural areas where bbox filtering returns nothing.
    const c = map.getCenter();
    const all = window.OVERWATCH_GLOBE.getVisibleNodes();
    const ranked = [];
    for (let i = 0; i < all.length; i++) {
      const n = all[i];
      const dLat = n.lat - c.lat;
      const dLng = ((n.lng - c.lng + 540) % 360) - 180;
      ranked.push([n, dLat*dLat + dLng*dLng]);
    }
    ranked.sort((a, b) => a[1] - b[1]);
    const cap = 3000;
    const data = ranked.slice(0, cap).map(x => x[0]);
    const visible = data; // for the count display
    markerLayer = L.layerGroup();
    data.forEach(n => {
      const meta = window.OVERWATCH_DATA.typeMeta[n._layer] || { color:'#888' };
      const m = L.circleMarker([n.lat, n.lng], {
        radius: n._layer === 'flock' ? 5 : 4,
        color: meta.color,
        weight: 1.5,
        opacity: 0.95,
        fillColor: meta.color,
        fillOpacity: 0.55
      });
      m.on('click', () => {
        window.OVERWATCH_GLOBE.fireSelect(n);
      });
      m.on('mouseover', () => m.setStyle({ radius: n._layer === 'flock' ? 8 : 7, fillOpacity: 0.95 }));
      m.on('mouseout',  () => m.setStyle({ radius: n._layer === 'flock' ? 5 : 4, fillOpacity: 0.55 }));
      m.bindTooltip(`<b>${n.name}</b><br/><span style="color:${meta.color}">${(meta.label||'').toUpperCase()}</span>`, { className:'tile-tip', sticky:true });
      markerLayer.addLayer(m);
    });
    markerLayer.addTo(map);
    document.getElementById('tile-count').textContent = data.length.toLocaleString() + ' / ' + visible.length.toLocaleString() + ' markers';
  }

  function openOverlay(lat, lng, zoom = 14, auto = true) {
    ensureHost();
    host.classList.remove('hidden');
    isOpenFlag = true;
    autoOpened = auto;

    if (!map) {
      map = L.map('tile-map', {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        attributionControl: true,
        worldCopyJump: true,
        preferCanvas: true,
        zoomSnap: 0.5
      });
      setMode('dark');
      map.on('moveend zoomend', () => {
        const c = map.getCenter();
        document.getElementById('tile-coords').textContent = `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
        document.getElementById('tile-zoom').textContent = 'z ' + map.getZoom();
        refreshMarkers();
      });
    } else {
      map.setView([lat, lng], zoom);
      setTimeout(() => map.invalidateSize(), 50);
    }
    setTimeout(() => map.invalidateSize(), 80);
    refreshMarkers();
    document.getElementById('tile-coords').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    document.getElementById('tile-zoom').textContent = 'z ' + zoom;
  }

  function closeOverlay(manual) {
    if (!host) return;
    host.classList.add('hidden');
    isOpenFlag = false;
    autoOpened = false;
    if (manual && window.OVERWATCH_GLOBE && window.OVERWATCH_GLOBE.getPOV) {
      // pull the globe back out so user has a clear cue
      const p = window.OVERWATCH_GLOBE.getPOV();
      if (p && p.altitude < 0.7) window.OVERWATCH_GLOBE.flyTo(p.lat, p.lng, 1.2);
    }
  }

  function toggleMapillary() {
    if (!map) return;
    const pane = document.getElementById('tile-mp-pane');
    const ifr  = document.getElementById('tile-mp-frame');
    const open = pane.classList.contains('hidden');
    if (open) {
      const c = map.getCenter();
      ifr.src = `https://www.mapillary.com/embed?map_style=OpenStreetMap&map_lat=${c.lat}&map_lng=${c.lng}&map_zoom=17&style=photo`;
      pane.classList.remove('hidden');
    } else {
      pane.classList.add('hidden');
      ifr.src = 'about:blank';
    }
    setTimeout(() => map.invalidateSize(), 60);
  }

  function isOpen() { return isOpenFlag; }
  function isAutoOpened() { return autoOpened; }

  function open(node) {
    // legacy entry from sidebar STREET button: open at node coords, manual
    openOverlay(node.lat, node.lng, 17, false);
  }

  return { open, openOverlay, closeOverlay, isOpen, isAutoOpened };
})();
