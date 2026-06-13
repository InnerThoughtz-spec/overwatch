/* OVERWATCH // app glue: boot, clock, ticker, init sequence */

(function () {
  const TICKER_LINES = [
    'INTEL FEED · ',
    'globe.gl render pipeline armed · ',
    'OSINT corridor open · ',
    'flock ALPR map seeded from public reporting · ',
    'feeds shown are public sources unless authenticated by user · ',
    'use IMPORT to ingest deflock.me JSON for full community map · ',
    'PROXY at :8765 available for CORS bypass on supplied URLs · ',
    'no exploit code is shipped from this dashboard · '
  ];

  function bootSequence() {
    const log = document.getElementById('boot-log');
    const s = window.OVERWATCH_DATA && window.OVERWATCH_DATA.stats || { cameras:0, flock:0, total:0, cities:0 };
    const lines = [
      '<span class="ok">[ok]</span> webgl context',
      '<span class="ok">[ok]</span> globe.gl loaded',
      `<span class="ok">[ok]</span> tile providers · esri / osm / carto`,
      `<span class="ok">[ok]</span> mapillary embed bridge`,
      `<span class="ok">[ok]</span> dataset · ${s.cameras.toLocaleString()} cam nodes`,
      `<span class="ok">[ok]</span> dataset · ${s.flock.toLocaleString()} ALPR nodes`,
      `<span class="ok">[ok]</span> ${s.cities} city grids generated`,
      '<span class="warn">[--]</span> awaiting operator input'
    ];
    let i = 0;
    const id = setInterval(() => {
      log.innerHTML += (log.innerHTML ? '<br/>' : '') + lines[i];
      i++;
      if (i >= lines.length) {
        clearInterval(id);
        setTimeout(() => document.getElementById('boot').classList.add('gone'), 350);
        setTimeout(() => document.getElementById('boot').remove(), 1100);
      }
    }, 280);
  }

  function clockLoop() {
    const el = document.getElementById('utc-clock');
    setInterval(() => {
      el.textContent = new Date().toISOString().slice(11, 19);
    }, 1000);
    el.textContent = new Date().toISOString().slice(11, 19);
  }

  function tickerLoop() {
    const el = document.getElementById('ticker');
    let frame = TICKER_LINES.join('') + TICKER_LINES.join('');
    el.textContent = frame;
    let pos = 0;
    setInterval(() => {
      pos = (pos + 1) % frame.length;
      el.textContent = frame.slice(pos) + frame.slice(0, pos);
    }, 120);
  }

  function init() {
    bootSequence();
    clockLoop();
    tickerLoop();
    try {
      window.OVERWATCH_GLOBE.init('globe');
      window.OVERWATCH_UI.init();
    } catch (err) {
      console.error('OVERWATCH init failed', err);
      document.getElementById('boot-log').innerHTML += '<br/><span style="color:#ff4d6d">[err] ' + err.message + '</span>';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
