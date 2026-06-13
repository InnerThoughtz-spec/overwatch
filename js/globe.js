/* OVERWATCH // globe layer (globe.gl) — LoD clustering edition
   levels:
     L0 (alt > 1.4)   city blobs   ~282 fat dots, sized by node count
     L1 (0.5 < a ≤ 1.4) grid bins   ~3-5k medium dots (5° hex grid)
     L2 (alt ≤ 0.5)   individuals  ~visible-within-radius nodes
   auto-triggers tile-view at altitude < 0.4. */

window.OVERWATCH_GLOBE = (function () {
  let globe = null;
  let container = null;
  let allNodes = [];
  let visibleNodes = [];
  let onSelectCb = null;
  let arcsOn = false;
  let spinOn = false;
  let nightOn = false;
  let lastTilePOV = null;

  const TEX_DAY = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg';
  const TEX_NIGHT = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg';
  const TEX_BUMP = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png';

  // ── unify cams + flock ────────────────────────────────────
  function unifyNodes() {
    const cams = (window.OVERWATCH_DATA.cameras || []).map(c => ({ ...c, _kind:'camera', _layer: c.type }));
    const flk  = (window.OVERWATCH_DATA.flock || []).map(f => ({ ...f, _kind:'flock', _layer:'flock', type:'flock' }));
    return [...cams, ...flk];
  }

  // ── LoD precompute ────────────────────────────────────────
  let clusterL0 = []; // city-level blobs
  let clusterL1 = []; // grid-bin blobs
  let layerFilters = null;

  function buildClusters(nodes) {
    // L0: aggregate by city
    const byCity = {};
    nodes.forEach(n => {
      const k = (n.country || '?') + '::' + (n.city || '?');
      if (!byCity[k]) byCity[k] = { lat:0, lng:0, n:0, city:n.city, country:n.country, types:{} };
      byCity[k].lat += n.lat; byCity[k].lng += n.lng; byCity[k].n++;
      byCity[k].types[n._layer] = (byCity[k].types[n._layer] || 0) + 1;
    });
    clusterL0 = Object.values(byCity).map(c => {
      const dominant = Object.entries(c.types).sort((a,b)=>b[1]-a[1])[0][0];
      return {
        _cluster: 'L0',
        _layer: dominant,
        lat: c.lat / c.n, lng: c.lng / c.n,
        name: `${c.city || 'Region'} · ${c.n.toLocaleString()} nodes`,
        city: c.city, country: c.country,
        n: c.n, types: c.types
      };
    });

    // L1: hex-ish grid bins (~3° lat × 3° lng)
    const BIN = 2;
    const byBin = {};
    nodes.forEach(n => {
      const bx = Math.round(n.lat / BIN), by = Math.round(n.lng / BIN);
      const k = bx + ',' + by + '|' + n._layer;
      if (!byBin[k]) byBin[k] = { lat:0, lng:0, n:0, layer:n._layer };
      byBin[k].lat += n.lat; byBin[k].lng += n.lng; byBin[k].n++;
    });
    clusterL1 = Object.values(byBin).map(b => ({
      _cluster: 'L1',
      _layer: b.layer,
      lat: b.lat / b.n, lng: b.lng / b.n,
      name: `${b.n.toLocaleString()} ${(window.OVERWATCH_DATA.typeMeta[b.layer]||{}).label||b.layer} nodes`,
      n: b.n
    }));
  }

  function colorFor(n) {
    const meta = window.OVERWATCH_DATA.typeMeta[n._layer] || { color:'#888' };
    return meta.color;
  }
  function radiusFor(n) {
    if (n._cluster === 'L0') return Math.min(1.6, 0.35 + Math.log10(Math.max(2, n.n)) * 0.32);
    if (n._cluster === 'L1') return Math.min(0.7, 0.15 + Math.log10(Math.max(2, n.n)) * 0.18);
    return 0.06;
  }
  function altFor(n) {
    if (n._cluster === 'L0') return 0.018;
    if (n._cluster === 'L1') return 0.010;
    return 0.004;
  }

  function buildArcs(nodes) {
    const out = [];
    const sample = nodes.filter((n,i) => n._cluster === 'L0' && i % 1 === 0).slice(0, 80);
    for (let i = 0; i < sample.length; i++) {
      const a = sample[i];
      const b = sample[(i * 7 + 3) % sample.length];
      if (a === b) continue;
      out.push({
        startLat: a.lat, startLng: a.lng,
        endLat: b.lat, endLng: b.lng,
        color: ['rgba(255,77,109,0.05)', 'rgba(58,214,255,0.35)']
      });
    }
    return out;
  }

  // ── current view state ───────────────────────────────────
  let currentLevel = 'L0';

  function pickDataset(altitude) {
    if (altitude > 1.4) return { level:'L0', data: clusterL0 };
    if (altitude > 0.5) return { level:'L1', data: clusterL1 };
    // individuals — but cull to ~6000 closest to current POV center for perf
    const pov = globe.pointOfView();
    const visibleByLayer = visibleNodes.filter(n => true);
    const sorted = visibleByLayer.map(n => {
      const dLat = (n.lat - pov.lat), dLng = (n.lng - pov.lng);
      return [n, dLat*dLat + dLng*dLng];
    }).sort((a,b) => a[1] - b[1]).slice(0, 6000).map(x => x[0]);
    return { level:'L2', data: sorted };
  }

  // ── render ───────────────────────────────────────────────
  let renderTimer = null;
  function renderView(force) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      if (!globe) return;
      const pov = globe.pointOfView();
      const { level, data } = pickDataset(pov.altitude);
      if (level !== currentLevel || force) {
        currentLevel = level;
        if (typeof window.OVERWATCH_UI?.setLevel === 'function') window.OVERWATCH_UI.setLevel(level, data.length);
      }
      globe.pointsData(data);
      if (arcsOn && level === 'L0') globe.arcsData(buildArcs(data)); else globe.arcsData([]);

      // auto-tile-view trigger
      if (pov.altitude < 0.4 && window.OVERWATCH_MAP && !window.OVERWATCH_MAP.isOpen()) {
        // tile zoom proportional to altitude: shallower altitude → higher zoom
        const tileZoom = Math.round(Math.max(7, Math.min(14, 14 - pov.altitude * 10)));
        window.OVERWATCH_MAP.openOverlay(pov.lat, pov.lng, tileZoom);
        lastTilePOV = { lat: pov.lat, lng: pov.lng, altitude: pov.altitude };
      } else if (pov.altitude > 0.7 && window.OVERWATCH_MAP && window.OVERWATCH_MAP.isOpen() && window.OVERWATCH_MAP.isAutoOpened()) {
        window.OVERWATCH_MAP.closeOverlay();
      }
    }, 80);
  }

  // ── init ─────────────────────────────────────────────────
  function init(domId) {
    container = document.getElementById(domId);
    globe = Globe()(container)
      .globeImageUrl(TEX_DAY)
      .bumpImageUrl(TEX_BUMP)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#3ad6ff')
      .atmosphereAltitude(0.18)
      .pointsMerge(true)
      .pointAltitude(altFor)
      .pointRadius(radiusFor)
      .pointColor(colorFor)
      .pointResolution(5)
      .pointLabel(n => `
        <div style="font-family:'JetBrains Mono',monospace; font-size:11px; background:rgba(6,8,12,0.92); border:1px solid #283448; padding:6px 8px; color:#d6dde8; pointer-events:none;">
          <div style="color:${colorFor(n)}; letter-spacing:2px; font-size:9px; margin-bottom:2px;">${(window.OVERWATCH_DATA.typeMeta[n._layer] || {label:'NODE'}).label.toUpperCase()}</div>
          <div style="color:#fff; font-weight:600;">${n.name}</div>
          ${n._cluster ? `<div style="color:#3ad6ff; font-size:10px; margin-top:2px;">${n._cluster === 'L0' ? 'CITY GRID · click to inspect' : 'GRID BIN · click to inspect'}</div>` : ''}
          ${n.agency ? `<div style="color:#6c7a90; font-size:10px;">${n.agency}</div>` : ''}
        </div>
      `)
      .onPointClick(n => {
        if (n._cluster === 'L0') {
          flyTo(n.lat, n.lng, 0.55);
        } else if (n._cluster === 'L1') {
          flyTo(n.lat, n.lng, 0.35);
        } else {
          if (onSelectCb) onSelectCb(n);
          flyTo(n.lat, n.lng, Math.min(0.3, globe.pointOfView().altitude));
        }
      })
      .arcStartLat(d => d.startLat).arcStartLng(d => d.startLng)
      .arcEndLat(d => d.endLat).arcEndLng(d => d.endLng)
      .arcColor('color')
      .arcDashLength(0.5).arcDashGap(0.7).arcDashAnimateTime(4000).arcStroke(0.25)
      .arcAltitudeAutoScale(0.4);

    const controls = globe.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.9;
    controls.minDistance = 105;
    controls.maxDistance = 600;
    controls.addEventListener('change', renderView);

    globe.pointOfView({ lat: 30, lng: -40, altitude: 2.4 }, 0);

    allNodes = unifyNodes();
    visibleNodes = allNodes.slice();
    buildClusters(allNodes);
    renderView(true);

    window.addEventListener('resize', () => {
      globe.width(container.clientWidth).height(container.clientHeight);
    });
    globe.width(container.clientWidth).height(container.clientHeight);

    // animation tick — spin + FPS + HUD
    let lastFrame = performance.now();
    let fps = 0, frames = 0, fpsAcc = 0;
    function tick(now) {
      const dt = now - lastFrame; lastFrame = now;
      if (spinOn) {
        const pov = globe.pointOfView();
        globe.pointOfView({ lat: pov.lat, lng: (pov.lng + 0.05) % 360, altitude: pov.altitude }, 0);
      }
      frames++; fpsAcc += dt;
      if (fpsAcc > 500) { fps = Math.round(1000 / (fpsAcc / frames)); frames = 0; fpsAcc = 0; const el = document.getElementById('hud-fps'); if (el) el.textContent = fps + ' fps'; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    container.addEventListener('mousemove', e => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const coords = globe.toGeoCoords({ x, y });
      const el = document.getElementById('hud-cursor');
      if (el && coords) el.textContent = `${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)}`;
    });

    setInterval(() => {
      const pov = globe.pointOfView();
      const lat = document.getElementById('hud-lat'); if (lat) lat.textContent = pov.lat.toFixed(3);
      const lng = document.getElementById('hud-lng'); if (lng) lng.textContent = pov.lng.toFixed(3);
      const alt = document.getElementById('hud-alt'); if (alt) alt.textContent = pov.altitude.toFixed(2);
    }, 200);

    return globe;
  }

  function setFilter(predicate) {
    visibleNodes = allNodes.filter(predicate);
    buildClusters(visibleNodes);
    renderView(true);
    return visibleNodes.length;
  }
  function addNode(n) {
    n._kind = n._kind || 'camera';
    n._layer = n._layer || n.type || 'dash';
    allNodes.push(n);
    visibleNodes.push(n);
    buildClusters(visibleNodes);
    renderView(true);
  }
  function flyTo(lat, lng, alt = 1.5) {
    globe.pointOfView({ lat, lng, altitude: alt }, 1100);
  }
  function setArcs(on) { arcsOn = on; renderView(true); }
  function setSpin(on) { spinOn = on; }
  function setNight(on) { nightOn = on; globe.globeImageUrl(on ? TEX_NIGHT : TEX_DAY); }
  function setAtmosphere(on) { globe.showAtmosphere(on); }
  function setGraticule(on) { /* simplified — atmosphere is the main backdrop */ }
  function setOnSelect(cb) { onSelectCb = cb; }
  function getAllNodes() { return allNodes; }
  function getVisibleNodes() { return visibleNodes; }
  function zoom(delta) {
    const pov = globe.pointOfView();
    globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: Math.max(0.18, Math.min(4, pov.altitude + delta)) }, 400);
  }
  function resetView() { globe.pointOfView({ lat: 30, lng: -40, altitude: 2.4 }, 1000); }
  function getPOV() { return globe ? globe.pointOfView() : null; }
  function fireSelect(n) { if (onSelectCb) onSelectCb(n); }

  return {
    init, setFilter, addNode, flyTo,
    setArcs, setSpin, setNight, setAtmosphere, setGraticule,
    setOnSelect, getAllNodes, getVisibleNodes, zoom, resetView,
    getPOV, fireSelect
  };
})();
