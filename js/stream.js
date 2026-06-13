/* OVERWATCH // stream extraction & playback (the bypass)
   - Fetches a public webcam page through a public CORS proxy chain
   - Regex-extracts the underlying .m3u8 HLS stream URL
   - Plays it directly in a <video> tag via hls.js (no iframe restrictions)
   - Also handles direct .m3u8 / .mpd / .jpg URLs without proxy hop
   Honest limits: best-effort. Works for sites that emit M3U8 URLs in HTML
   (SkylineWebcams, many EarthCam, most DOT cams). Fails when the URL is
   constructed at runtime by site JS or guarded by short-lived tokens. */

window.OVERWATCH_STREAM = (function () {

  // Public CORS proxy chain — tried in order, first that returns 200 with
  // sensible body length wins. All are free, no signup.
  const PROXIES = [
    url => 'https://corsproxy.io/?' + encodeURIComponent(url),
    url => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
    url => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    url => 'https://proxy.cors.sh/' + url,
    url => 'https://thingproxy.freeboard.io/fetch/' + url
  ];

  const M3U8_PATTERNS = [
    /['"]([^'"\s<>]+\.m3u8(?:\?[^'"\s<>]*)?)['"]/g,
    /file\s*[:=]\s*['"]([^'"\s<>]+\.m3u8(?:\?[^'"\s<>]*)?)['"]/g,
    /source\s*[:=]\s*['"]([^'"\s<>]+\.m3u8(?:\?[^'"\s<>]*)?)['"]/g,
    /src\s*[:=]\s*['"]([^'"\s<>]+\.m3u8(?:\?[^'"\s<>]*)?)['"]/g
  ];

  function extractStreams(html) {
    const found = new Set();
    for (const pat of M3U8_PATTERNS) {
      pat.lastIndex = 0;
      let m;
      while ((m = pat.exec(html))) {
        let u = m[1];
        if (u.startsWith('//')) u = 'https:' + u;
        if (u.startsWith('http')) found.add(u.replace(/\\\//g, '/'));
      }
    }
    return [...found];
  }

  async function fetchWithTimeout(url, ms) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms || 12000);
    try {
      const res = await fetch(url, { signal: c.signal, redirect: 'follow' });
      return res;
    } finally { clearTimeout(t); }
  }

  async function fetchPageViaProxy(url, onProgress) {
    let lastErr;
    for (let i = 0; i < PROXIES.length; i++) {
      onProgress && onProgress(`proxy ${i+1}/${PROXIES.length}…`);
      try {
        const res = await fetchWithTimeout(PROXIES[i](url), 11000);
        if (!res.ok) { lastErr = new Error('proxy ' + i + ' http ' + res.status); continue; }
        const text = await res.text();
        if (text.length < 300) { lastErr = new Error('proxy ' + i + ' empty body'); continue; }
        return text;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('all proxies failed');
  }

  async function findStream(camPageUrl, onProgress) {
    // Shortcut: direct stream / image URLs need no extraction
    const lc = camPageUrl.toLowerCase().split('?')[0];
    if (lc.endsWith('.m3u8') || lc.endsWith('.mpd')) return { url: camPageUrl, kind: 'hls' };
    if (lc.endsWith('.jpg') || lc.endsWith('.jpeg') || lc.endsWith('.png')) return { url: camPageUrl, kind: 'img' };
    if (lc.endsWith('.mp4') || lc.endsWith('.webm')) return { url: camPageUrl, kind: 'video' };

    const html = await fetchPageViaProxy(camPageUrl, onProgress);
    onProgress && onProgress('parsing stream URL…');
    const streams = extractStreams(html);
    if (!streams.length) throw new Error('no m3u8 found in page source');
    return { url: streams[0], kind: 'hls', all: streams };
  }

  function tearDown(videoEl) {
    if (videoEl._hls) { try { videoEl._hls.destroy(); } catch {} videoEl._hls = null; }
    videoEl.removeAttribute('src');
    videoEl.load && videoEl.load();
  }

  function playHls(videoEl, m3u8) {
    tearDown(videoEl);
    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 8,
        liveDurationInfinity: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 12000
      });
      videoEl._hls = hls;
      hls.loadSource(m3u8);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoEl.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) videoEl.dispatchEvent(new CustomEvent('hls-fatal', { detail: data }));
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = m3u8;
      videoEl.play().catch(() => {});
    } else {
      throw new Error('HLS not supported in this browser (hls.js missing)');
    }
  }

  function playMp4(videoEl, url) {
    tearDown(videoEl);
    videoEl.src = url;
    videoEl.play().catch(() => {});
  }

  // Auto-refreshing image (DOT JPG snapshots)
  function playImage(imgEl, url, intervalMs) {
    if (imgEl._timer) clearInterval(imgEl._timer);
    const tick = () => { imgEl.src = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now(); };
    tick();
    imgEl._timer = setInterval(tick, intervalMs || 1500);
  }

  async function watchCam(camPageUrl, container, onProgress) {
    container.innerHTML = '';
    const { url, kind } = await findStream(camPageUrl, onProgress);
    onProgress && onProgress('▶ playing · ' + url.slice(0, 60) + '…');
    if (kind === 'img') {
      const img = document.createElement('img');
      img.id = 'feed-video';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;background:#000;';
      container.appendChild(img);
      playImage(img, url, 1500);
      return { kind, url };
    }
    const v = document.createElement('video');
    v.id = 'feed-video';
    v.controls = true; v.autoplay = true; v.muted = true; v.playsInline = true;
    v.style.cssText = 'width:100%;height:100%;background:#000;object-fit:contain;';
    container.appendChild(v);
    if (kind === 'hls') playHls(v, url);
    else playMp4(v, url);
    return { kind, url };
  }

  return { watchCam, findStream, extractStreams };
})();
