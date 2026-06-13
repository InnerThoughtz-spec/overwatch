/* OVERWATCH // UI layer: search, filters, modals, target detail */

window.OVERWATCH_UI = (function () {
  const state = {
    query: '',
    layers: { traffic:true, public:true, scenic:true, port:true, flock:true, dash:false },
    selected: null,
    activity: []
  };

  function applyFilter() {
    const q = state.query.trim().toLowerCase();
    const total = window.OVERWATCH_GLOBE.setFilter(n => {
      if (!state.layers[n._layer]) return false;
      if (!q) return true;
      const blob = [n.name, n.city, n.state, n.country, n.agency, n.source, n.type, n._layer].join(' ').toLowerCase();
      return blob.includes(q);
    });
    updateCounts();
  }

  function setLevel(level, count) {
    const el = document.getElementById('level-indicator');
    if (!el) return;
    const labels = { L0:'CITY GRID', L1:'REGION BINS', L2:'INDIVIDUAL NODES' };
    el.textContent = (labels[level] || level) + ' · ' + (count||0).toLocaleString();
    el.dataset.level = level;
  }

  function updateCounts() {
    const all = window.OVERWATCH_GLOBE.getAllNodes();
    const vis = window.OVERWATCH_GLOBE.getVisibleNodes();
    document.getElementById('node-count').textContent = vis.length;
    const alpr = vis.filter(n => n._layer === 'flock').length;
    document.getElementById('alpr-count').textContent = alpr;
    document.getElementById('feed-count').textContent = vis.filter(n => n.feed_url).length;

    // per-layer counts
    for (const layer of Object.keys(state.layers)) {
      const c = all.filter(n => n._layer === layer).length;
      const el = document.querySelector(`[data-count="${layer}"]`);
      if (el) el.textContent = c;
    }
  }

  function bindSearch() {
    const inp = document.getElementById('search');
    const clr = document.getElementById('search-clear');
    inp.addEventListener('input', e => {
      state.query = e.target.value;
      applyFilter();
    });
    clr.addEventListener('click', () => { inp.value = ''; state.query = ''; applyFilter(); });
    document.querySelectorAll('.chip').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        const q = c.dataset.quick;
        const presets = { usa:'USA', europe:'', asia:'', flock:'flock', traffic:'traffic', public:'public' };
        if (q === 'europe') state.query = '';
        else state.query = presets[q] || q;
        if (q === 'europe') {
          // region preset via filter not search
          state.query = '';
          inp.value = '';
          window.OVERWATCH_GLOBE.setFilter(n => state.layers[n._layer] && ['UK','France','Germany','Italy','Spain','Netherlands','Belgium','Portugal','Czechia','Austria','Poland','Hungary','Greece','Ireland','Norway','Sweden','Finland','Russia'].includes(n.country));
          updateCounts();
          return;
        }
        if (q === 'asia') {
          state.query = '';
          inp.value = '';
          window.OVERWATCH_GLOBE.setFilter(n => state.layers[n._layer] && ['Japan','South Korea','Singapore','Hong Kong','Taiwan','Thailand','Vietnam','Indonesia','Philippines','China','India'].includes(n.country));
          updateCounts();
          return;
        }
        inp.value = state.query;
        applyFilter();
      });
    });
  }

  function bindLayers() {
    document.querySelectorAll('#layer-list input').forEach(cb => {
      cb.addEventListener('change', e => {
        state.layers[cb.dataset.layer] = cb.checked;
        applyFilter();
      });
    });
  }

  function bindOverlays() {
    document.getElementById('ov-arcs').addEventListener('change', e => window.OVERWATCH_GLOBE.setArcs(e.target.checked));
    document.getElementById('ov-graticule').addEventListener('change', e => window.OVERWATCH_GLOBE.setGraticule(e.target.checked));
    document.getElementById('ov-atmosphere').addEventListener('change', e => window.OVERWATCH_GLOBE.setAtmosphere(e.target.checked));
    document.getElementById('ov-spin').addEventListener('change', e => window.OVERWATCH_GLOBE.setSpin(e.target.checked));
    document.getElementById('ov-night').addEventListener('change', e => window.OVERWATCH_GLOBE.setNight(e.target.checked));
    document.getElementById('ov-heat').addEventListener('change', e => {
      logActivity(e.target.checked ? 'heatmap layer ENABLED' : 'heatmap layer DISABLED');
    });
  }

  function bindZoom() {
    document.querySelectorAll('#globe-zoom button').forEach(b => {
      b.addEventListener('click', () => {
        const z = b.dataset.zoom;
        if (z === 'in') window.OVERWATCH_GLOBE.zoom(-0.4);
        else if (z === 'out') window.OVERWATCH_GLOBE.zoom(0.4);
        else window.OVERWATCH_GLOBE.resetView();
      });
    });
  }

  function bindControlBtns() {
    document.getElementById('btn-add').addEventListener('click', () => openModal('modal-add'));
    document.getElementById('btn-export').addEventListener('click', exportSet);
    document.getElementById('btn-import').addEventListener('click', importSet);
    document.getElementById('btn-flock-load').addEventListener('click', () => {
      logActivity('FULL FLOCK MAP request — using seeded dataset (' + (window.OVERWATCH_DATA.flock||[]).length + ' nodes). Plug Deflock.me JSON via Import for the live community set.');
    });
  }

  function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

  function bindModals() {
    document.getElementById('add-cancel').addEventListener('click', () => closeModal('modal-add'));
    document.getElementById('add-save').addEventListener('click', () => {
      const n = {
        id: 'usr-' + Math.random().toString(36).slice(2, 8),
        name: document.getElementById('add-name').value || 'Unnamed Node',
        lat: parseFloat(document.getElementById('add-lat').value),
        lng: parseFloat(document.getElementById('add-lng').value),
        type: document.getElementById('add-type').value,
        feed_url: document.getElementById('add-feed').value,
        agency: document.getElementById('add-agency').value,
        city: document.getElementById('add-place').value,
        notes: document.getElementById('add-notes').value,
        source: 'User',
        feed_mode: 'iframe'
      };
      if (isNaN(n.lat) || isNaN(n.lng)) { alert('latitude / longitude required'); return; }
      n._layer = n.type;
      window.OVERWATCH_GLOBE.addNode(n);
      updateCounts();
      logActivity(`NODE DEPLOYED · ${n.name}`);
      closeModal('modal-add');
      // reset form
      ['add-name','add-lat','add-lng','add-feed','add-agency','add-place','add-notes'].forEach(id => document.getElementById(id).value = '');
    });

  }

  function _legacyConnectFeed() {
    const url = (document.getElementById('feed-url')||{value:''}).value.trim();
    const mode = (document.getElementById('feed-mode')||{value:'iframe'}).value;
    const poll = 1500;
    if (!url) return;
    const finalUrl = url;

    const frame = document.getElementById('feed-frame');
    frame.innerHTML = '';
    if (mode === 'iframe') {
      const ifr = document.createElement('iframe');
      ifr.src = finalUrl;
      ifr.setAttribute('allow', 'autoplay; fullscreen');
      frame.appendChild(ifr);
    } else if (mode === 'img') {
      const img = document.createElement('img');
      const refresh = () => { img.src = finalUrl + (finalUrl.includes('?') ? '&' : '?') + '_t=' + Date.now(); };
      refresh();
      img._timer = setInterval(refresh, poll);
      frame.appendChild(img);
    } else if (mode === 'video') {
      const v = document.createElement('video');
      v.src = finalUrl; v.autoplay = true; v.muted = true; v.controls = true; v.playsInline = true;
      frame.appendChild(v);
    } else if (mode === 'mjpeg') {
      const img = document.createElement('img');
      img.src = finalUrl;
      frame.appendChild(img);
    }
    logActivity(`FEED CONNECTED · ${mode.toUpperCase()} · ${url.slice(0, 50)}…`);
    closeModal('modal-feed');
  }

  function exportSet() {
    const data = { exported: new Date().toISOString(), nodes: window.OVERWATCH_GLOBE.getVisibleNodes() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `overwatch-export-${Date.now()}.json`;
    a.click();
    logActivity(`EXPORT · ${data.nodes.length} nodes written to disk`);
  }

  function importSet() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.addEventListener('change', () => {
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const obj = JSON.parse(r.result);
          const list = Array.isArray(obj) ? obj : (obj.nodes || obj.cameras || obj.features || []);
          let n = 0;
          list.forEach(node => {
            // accept GeoJSON Point features (deflock-style)
            if (node.geometry && node.geometry.type === 'Point') {
              window.OVERWATCH_GLOBE.addNode({
                id: 'imp-' + Math.random().toString(36).slice(2,8),
                name: (node.properties && (node.properties.name || node.properties.ref)) || 'Imported',
                lat: node.geometry.coordinates[1],
                lng: node.geometry.coordinates[0],
                type: 'flock', _layer: 'flock',
                agency: (node.properties && node.properties.operator) || 'Unknown',
                source: 'Imported'
              });
            } else if (typeof node.lat === 'number' && typeof node.lng === 'number') {
              window.OVERWATCH_GLOBE.addNode(node);
            }
            n++;
          });
          logActivity(`IMPORT · ${n} nodes ingested`);
          updateCounts();
        } catch (err) { alert('Failed to parse JSON: ' + err.message); }
      };
      r.readAsText(f);
    });
    inp.click();
  }

  // ─── target panel ─────────────────────────────────────────
  function showTarget(n) {
    state.selected = n;
    document.getElementById('target-empty').classList.add('hidden');
    document.getElementById('target-card').classList.remove('hidden');
    document.getElementById('t-name').textContent = n.name || '—';
    document.getElementById('hud-target').textContent = n.name || '—';
    document.getElementById('t-id').textContent = n.id || '—';
    document.getElementById('t-type').textContent = (window.OVERWATCH_DATA.typeMeta[n._layer]||{}).label || n.type || '—';
    document.getElementById('t-source').textContent = n.source || '—';
    document.getElementById('t-agency').textContent = n.agency || '—';
    document.getElementById('t-lat').textContent = (n.lat||0).toFixed(4);
    document.getElementById('t-lng').textContent = (n.lng||0).toFixed(4);
    document.getElementById('t-country').textContent = n.country || '—';
    document.getElementById('t-city').textContent = n.city || '—';
    document.getElementById('t-notes').value = n.notes || '';
    document.getElementById('t-dir').textContent = n.direction || '—';
    document.getElementById('t-res').textContent = n.resolution || '—';
    document.getElementById('t-mode').textContent = n.feed_mode || '—';
    document.getElementById('t-inst').textContent = n.installed || n.install || '—';
    document.getElementById('t-model').textContent = n.model || '—';
    document.getElementById('t-last').textContent = n.last_verified || '—';

    const tags = document.getElementById('t-tags');
    tags.innerHTML = '';
    const tagClass = n._layer;
    const lbl = (window.OVERWATCH_DATA.typeMeta[n._layer]||{}).label || n.type;
    const t1 = document.createElement('span'); t1.className = 'tag ' + tagClass; t1.textContent = lbl.toUpperCase(); tags.appendChild(t1);
    if (n.model) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = n.model.toUpperCase(); tags.appendChild(t); }
    if (n.status) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = n.status.toUpperCase(); tags.appendChild(t); }
    if (n.install) { const t = document.createElement('span'); t.className = 'tag'; t.textContent = 'INSTALL ' + n.install; tags.appendChild(t); }

    // feed frame: auto-embed for any watchable node; locked panel for Flock
    const frame = document.getElementById('feed-frame');
    frame.innerHTML = '';
    if (n._layer === 'flock') {
      const locked = document.createElement('div');
      locked.className = 'feed-empty';
      locked.innerHTML = `
        <div style="color:#ff4d6d; letter-spacing:2px;">FLOCK ALPR · LOCATION ONLY</div>
        <div class="dim small" style="text-align:center; max-width:80%;">publicly mapped surveillance node · plate-recognition feed is auth-gated by ${n.agency || 'operating agency'}</div>
      `;
      frame.appendChild(locked);
    } else if (n.feed_open_url || n.feed_url) {
      const street = n.feed_street_url;
      const cityName = n.city || 'this area';
      const stateName = n.state || '';
      const country  = n.country || '';
      const camName  = n.name || '';

      // Build search variants — 6 different YouTube live-filter queries per cam.
      // Each one widens or specializes the search so users can find a working stream fast.
      const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&sp=EgJAAQ%253D%253D';
      const variants = [
        { url: yt(`${camName} ${cityName} live webcam`),        label: `${camName} · ${cityName}` },
        { url: yt(`${cityName} live webcam`),                    label: `${cityName} live` },
        { url: yt(`${cityName} traffic camera live`),            label: `${cityName} traffic cam` },
        { url: yt(`live webcam ${cityName} 24/7`),               label: `${cityName} 24/7 stream` },
        { url: yt(`${cityName} ${stateName} webcam`),            label: `${cityName} ${stateName}`.trim() },
        { url: yt(`${country} live cam stream`),                 label: `${country} cams` }
      ].filter(v => v.label && v.label.trim() && !v.label.startsWith('·'));
      let idx = 0;
      let mode = 'live';

      const head = document.createElement('div');
      head.className = 'feed-toggle';
      head.innerHTML = `
        <button class="ft-btn on" data-ft="live">▶ LIVE</button>
        ${street ? `<button class="ft-btn" data-ft="street">STREET</button>` : ''}
        <button class="ft-btn ft-cycle" id="ft-next">↻ NEXT</button>
        <button class="ft-btn ft-fs" id="ft-fs" title="fullscreen">⛶ FULL</button>
        <span class="ft-src" id="ft-src"></span>
      `;
      frame.appendChild(head);

      const body = document.createElement('div');
      body.className = 'feed-body';
      frame.appendChild(body);

      async function renderLive() {
        const cur = variants[idx % variants.length];
        body.innerHTML = '';

        // 1) If we have a stream-extract URL, attempt the real bypass: fetch cam
        //    page via CORS proxy, extract m3u8, play in <video> with hls.js.
        if (n.feed_extract_url && window.OVERWATCH_STREAM) {
          const stage = document.createElement('div');
          stage.className = 'watch-stream-stage';
          stage.innerHTML = `
            <div class="watch-overlay" id="watch-overlay">
              <div class="watch-spinner"></div>
              <div class="watch-status" id="watch-status">connecting…</div>
              <div class="watch-source dim small">bypass · ${escapeHtml(n.feed_source)} · ${escapeHtml(n.feed_name)}</div>
            </div>
            <div id="stream-target" class="stream-target"></div>
          `;
          body.appendChild(stage);
          const setStatus = msg => { const el = document.getElementById('watch-status'); if (el) el.textContent = msg; };
          try {
            await window.OVERWATCH_STREAM.watchCam(n.feed_extract_url, document.getElementById('stream-target'), setStatus);
            const ov = document.getElementById('watch-overlay'); if (ov) ov.remove();
            document.getElementById('ft-src').textContent = `HLS bypass · ${n.feed_source} · ${n.feed_name}`;
            return;
          } catch (err) {
            // fall through to YT search pad
            console.warn('[watchCam]', err);
          }
        }

        // 2) Fallback: YT live-filter search pad
        const pad = document.createElement('div');
        pad.className = 'watch-pad';
        pad.innerHTML = `
          <div class="watch-thumb"><div class="watch-glyph">▶</div></div>
          <a class="btn-watch" href="${cur.url}" target="_blank" rel="noopener noreferrer">
            WATCH LIVE CAMS NEAR ${escapeHtml(cityName.toUpperCase())} ↗
          </a>
          <div class="watch-note dim small">
            ${n.feed_extract_url ? '<b>HLS bypass failed</b> for nearest source — ' : ''}
            search query · <b>${escapeHtml(cur.label)}</b><br/>
            opens YouTube filtered to LIVE streams in a new tab — press <b>↻ NEXT</b> to widen / narrow.
          </div>
        `;
        body.appendChild(pad);
        document.getElementById('ft-src').textContent = `YouTube live search · ${cur.label} · ${idx+1}/${variants.length}`;
      }
      function renderStreet() {
        body.innerHTML = '';
        const ifr = document.createElement('iframe');
        ifr.src = street;
        ifr.id = 'feed-iframe';
        ifr.setAttribute('allow', 'autoplay; fullscreen; geolocation');
        ifr.setAttribute('allowfullscreen', '');
        ifr.setAttribute('referrerpolicy', 'no-referrer');
        body.appendChild(ifr);
        document.getElementById('ft-src').textContent = 'Mapillary · street imagery near ' + camName;
      }

      renderLive();

      head.querySelectorAll('[data-ft]').forEach(b => b.addEventListener('click', () => {
        head.querySelectorAll('[data-ft]').forEach(x => x.classList.toggle('on', x === b));
        mode = b.dataset.ft;
        if (mode === 'street') renderStreet(); else renderLive();
      }));
      // ↻ NEXT cycles search variants in LIVE mode
      document.getElementById('ft-next').addEventListener('click', () => {
        if (mode === 'street') {
          // back to LIVE on next press from street
          head.querySelectorAll('[data-ft]').forEach(x => x.classList.toggle('on', x.dataset.ft === 'live'));
          mode = 'live';
        } else {
          idx = (idx + 1) % variants.length;
        }
        renderLive();
      });
      // ⛶ FULL — works in either mode (targets iframe or body)
      document.getElementById('ft-fs').addEventListener('click', () => {
        const el = document.getElementById('feed-iframe') || body;
        if (document.fullscreenElement) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
          if (fn) fn.call(el);
        }
      });

      logActivity(`▶ WATCH READY · ${camName} → ${cityName}`);
    } else {
      frame.innerHTML = '<div class="feed-empty"><div>NO FEED</div></div>';
    }
  }

  function bindTargetActions() {
    document.getElementById('right-panel').addEventListener('click', e => {
      const n = state.selected; if (!n) return;
      if (e.target.id === 'btn-streetview') { window.OVERWATCH_MAP.open(n); logActivity(`STREET/SAT VIEW · ${n.name}`); }
      else if (e.target.id === 'btn-fly') window.OVERWATCH_GLOBE.flyTo(n.lat, n.lng, 0.8);
      else if (e.target.id === 'btn-copy') {
        navigator.clipboard?.writeText(`${n.lat}, ${n.lng}`);
        logActivity(`COORDS COPIED · ${n.name}`);
      } else if (e.target.id === 'btn-osint') {
        const url = `https://www.google.com/maps/@${n.lat},${n.lng},19z`;
        window.open(url, '_blank');
      } else if (e.target.id === 'btn-mark') {
        logActivity(`MARKED · ${n.name}`);
      }
    });
    document.getElementById('t-notes').addEventListener('input', e => {
      if (state.selected) state.selected.notes = e.target.value;
    });
  }

  // ─── activity ticker ─────────────────────────────────────
  function logActivity(msg) {
    const time = new Date().toISOString().slice(11,19);
    state.activity.unshift({ time, msg });
    state.activity = state.activity.slice(0, 30);
    const ul = document.getElementById('activity-list');
    ul.innerHTML = state.activity.map(a => `<li><span class="time">${a.time}</span><span class="ev">${escapeHtml(a.msg)}</span></li>`).join('');
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function init() {
    bindSearch();
    bindLayers();
    bindOverlays();
    bindZoom();
    bindControlBtns();
    bindModals();
    bindTargetActions();
    window.OVERWATCH_GLOBE.setOnSelect(n => { showTarget(n); /* auto open street view on dbl click handled in globe */ });
    applyFilter();
    updateCounts();
    logActivity('GRID ONLINE · ' + window.OVERWATCH_GLOBE.getAllNodes().length + ' nodes ingested');
  }

  return { init, logActivity, applyFilter, updateCounts, showTarget, setLevel };
})();
