/* OVERWATCH // dataset v2 — procedural city-grid generator
   Encodes ~270 cities worldwide + per-city node counts.
   Generator scatters realistic intersection-style nodes around each city
   center, producing ~30k cam nodes + ~5k Flock ALPR nodes at startup. */

(function () {

  // ──────────────────────────────────────────────────────────
  // typeMeta
  // ──────────────────────────────────────────────────────────
  const typeMeta = {
    traffic: { color:'#3ad6ff', label:'Traffic CCTV' },
    public:  { color:'#4ade80', label:'Public Webcam' },
    scenic:  { color:'#a78bfa', label:'Scenic / Coastal' },
    port:    { color:'#fbbf24', label:'Port / Airport' },
    flock:   { color:'#ff4d6d', label:'Flock ALPR' },
    dash:    { color:'#ff8a3c', label:'User-Added' }
  };

  // ──────────────────────────────────────────────────────────
  // Street name dictionary for procedural intersections
  // ──────────────────────────────────────────────────────────
  const NUMBERED = ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','14th','17th','19th','21st','23rd','25th','28th','34th','42nd','57th','79th','86th','125th'];
  const NAMED = ['Main','Oak','Elm','Maple','Cedar','Pine','Park','Lake','River','Hill','Forest','Meadow','Spring','Center','Commerce','Industry','Liberty','Washington','Lincoln','Jefferson','Madison','Monroe','Jackson','Adams','Franklin','Roosevelt','Kennedy','King','Queen','Royal','Crown','State','Federal','Union','Republic','Highland','Lowland','Brook','Stream','Valley','Ridge','Summit','Crescent','Crown','Grand','Broad','Market','Mill','Bridge','Tower','Castle','Abbey','Chapel','Church'];
  const SUFFIX = ['St','Ave','Blvd','Rd','Dr','Ln','Pkwy','Ct','Pl','Way','Trl'];
  const HWY_PREFIX = ['I-','US-','SR-','SH-','M-','A','B','N-','D','RR-'];
  const COMPASS = ['N','S','E','W','NE','NW','SE','SW'];
  const RAMP = [' On-Ramp',' Off-Ramp',' Exit',' Junction',' Interchange',''];

  function rand(seed) {
    // deterministic-ish jitter per call site so refresh keeps the same map
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  let SEED = 1;
  function r() { SEED = (SEED * 9301 + 49297) % 233280; return SEED / 233280; }
  function ri(n) { return Math.floor(r() * n); }
  function pick(a) { return a[ri(a.length)]; }

  function intersection() {
    const t = r();
    if (t < 0.35) return `${pick(NUMBERED)} ${pick(SUFFIX)} & ${pick(NAMED)} ${pick(SUFFIX)}`;
    if (t < 0.55) return `${pick(NAMED)} ${pick(SUFFIX)} & ${pick(NAMED)} ${pick(SUFFIX)}`;
    if (t < 0.80) return `${pick(HWY_PREFIX)}${ri(620)+1}${pick(RAMP)}`;
    return `${pick(COMPASS)} ${pick(NAMED)} ${pick(SUFFIX)} @ ${pick(NUMBERED)} ${pick(SUFFIX)}`;
  }

  function flockSpot(cityName) {
    const t = r();
    const road = `${pick(NAMED)} ${pick(SUFFIX)}`;
    if (t < 0.5) return `${cityName} · ${road}`;
    return `${cityName} · ${pick(HWY_PREFIX)}${ri(99)+1} @ ${road}`;
  }

  function publicSpot() {
    const landmarks = ['Town Square','Riverfront Plaza','Central Park','City Hall','Civic Center','Old Town','Harborfront','Cathedral Square','University Quad','Convention Plaza','Main Promenade','Cultural District','Waterfront','Stadium District','Market Hall'];
    return pick(landmarks);
  }

  function jitter(lat, lng, radiusKm) {
    // scatter within ~radiusKm of (lat,lng)
    const r0 = Math.sqrt(r()) * radiusKm;
    const theta = r() * Math.PI * 2;
    const dLat = (r0 / 111) * Math.cos(theta);
    const dLng = (r0 / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(theta);
    return [lat + dLat, lng + dLng];
  }

  // ──────────────────────────────────────────────────────────
  // Public webcam URL pool — curated real pages
  // Most webcam sites block iframe embed for ad revenue, so the
  // primary "watch" action opens the source page in a new tab.
  // `embed:true` entries CAN be inline-embedded.
  // Each cam node gets nearest entry by lat/lng.
  // ──────────────────────────────────────────────────────────
  const WATCH_LINKS = [
    // ════════════════════════════════════════════════════════
    // YouTube live video embeds (inline playable + fullscreen)
    // These are the PRIMARY watch sources — they play in-frame.
    // IDs are best-effort — if a stream dies the TRY ANOTHER
    // button cycles through alternates.
    // ════════════════════════════════════════════════════════
    { url:'https://www.youtube.com/embed/AdUw5RdyZxI?autoplay=1&mute=1',                   lat:40.7580, lng:-73.9855, src:'YouTube', name:'Times Square Live',      embed:true },
    { url:'https://www.youtube.com/embed/u4UZ4UvZXrg?autoplay=1&mute=1',                   lat:40.7580, lng:-73.9855, src:'YouTube', name:'Times Square 24/7',      embed:true },
    { url:'https://www.youtube.com/embed/eJ7ZkQ5TC08?autoplay=1&mute=1',                   lat:35.6595, lng:139.7005, src:'YouTube', name:'Shibuya Crossing',       embed:true },
    { url:'https://www.youtube.com/embed/DjdUEyjx8GM?autoplay=1&mute=1',                   lat:35.6938, lng:139.7036, src:'YouTube', name:'Tokyo Live',             embed:true },
    { url:'https://www.youtube.com/embed/6lzrG_LMM-Y?autoplay=1&mute=1',                   lat:35.6586, lng:139.7454, src:'YouTube', name:'Tokyo Tower',            embed:true },
    { url:'https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1',                   lat:43.4799, lng:-110.7624,src:'YouTube', name:'Jackson Hole Town Sq',   embed:true },
    { url:'https://www.youtube.com/embed/gBQI60FLfH4?autoplay=1&mute=1',                   lat:21.2772, lng:-157.8294,src:'YouTube', name:'Waikiki Live',           embed:true },
    { url:'https://www.youtube.com/embed/WMu7Sf63xM4?autoplay=1&mute=1',                   lat:21.2911, lng:-157.8517,src:'YouTube', name:'Honolulu Live',          embed:true },
    { url:'https://www.youtube.com/embed/mRe-514tGMg?autoplay=1&mute=1',                   lat:36.1147, lng:-115.1728,src:'YouTube', name:'Las Vegas Strip',        embed:true },
    { url:'https://www.youtube.com/embed/H999s0P1Er0?autoplay=1&mute=1',                   lat:0.0,     lng:0.0,      src:'NASA YT', name:'ISS Live Earth View',    embed:true },
    { url:'https://www.youtube.com/embed/lvWvFlnvbiM?autoplay=1&mute=1',                   lat:-27.0,   lng:32.4,     src:'YouTube', name:'Africam Tembe',          embed:true },
    { url:'https://www.youtube.com/embed/ydYDqZQpim8?autoplay=1&mute=1',                   lat:-24.7,   lng:31.5,     src:'YouTube', name:'WildEarth Safari',       embed:true },
    { url:'https://www.youtube.com/embed/dt0wAt7e9p4?autoplay=1&mute=1',                   lat:-25.0,   lng:31.5,     src:'YouTube', name:'Kruger NP Waterhole',    embed:true },
    { url:'https://www.youtube.com/embed/EhwApn3pCS8?autoplay=1&mute=1',                   lat:-33.8915,lng:151.2767, src:'YouTube', name:'Bondi Beach Live',       embed:true },
    { url:'https://www.youtube.com/embed/JG-7n0_Q3Hg?autoplay=1&mute=1',                   lat:-33.8568,lng:151.2153, src:'YouTube', name:'Sydney Harbour Live',    embed:true },
    { url:'https://www.youtube.com/embed/N609loYkFJo?autoplay=1&mute=1',                   lat:50.0875, lng:14.4214,  src:'YouTube', name:'Prague Old Town',        embed:true },
    { url:'https://www.youtube.com/embed/wT4yvNuFI64?autoplay=1&mute=1',                   lat:55.7558, lng:37.6173,  src:'YouTube', name:'Moscow Live',            embed:true },
    { url:'https://www.youtube.com/embed/h1wly909BYw?autoplay=1&mute=1',                   lat:-22.9711,lng:-43.1822, src:'YouTube', name:'Copacabana Live',        embed:true },
    { url:'https://www.youtube.com/embed/U3pBQ2_LkUg?autoplay=1&mute=1',                   lat:13.7563, lng:100.5018, src:'YouTube', name:'Bangkok Live',           embed:true },
    { url:'https://www.youtube.com/embed/HpZAez2oYsw?autoplay=1&mute=1',                   lat:1.2839,  lng:103.8607, src:'YouTube', name:'Singapore Marina',       embed:true },
    { url:'https://www.youtube.com/embed/2cANL3J6OQ4?autoplay=1&mute=1',                   lat:25.2048, lng:55.2708,  src:'YouTube', name:'Dubai Live',             embed:true },
    { url:'https://www.youtube.com/embed/RnQpf0E_sdo?autoplay=1&mute=1',                   lat:51.5074, lng:-0.1278,  src:'YouTube', name:'London Live',            embed:true },
    { url:'https://www.youtube.com/embed/_jq3KKf2-EU?autoplay=1&mute=1',                   lat:48.8566, lng:2.3522,   src:'YouTube', name:'Paris Live',             embed:true },
    { url:'https://www.youtube.com/embed/RsiZsdv2pHs?autoplay=1&mute=1',                   lat:52.5200, lng:13.4050,  src:'YouTube', name:'Berlin Live',            embed:true },
    { url:'https://www.youtube.com/embed/Q2Th8j4uoY8?autoplay=1&mute=1',                   lat:41.9028, lng:12.4964,  src:'YouTube', name:'Rome Live',              embed:true },
    { url:'https://www.youtube.com/embed/UFM2idGZh78?autoplay=1&mute=1',                   lat:52.3676, lng:4.9041,   src:'YouTube', name:'Amsterdam Live',         embed:true },
    { url:'https://www.youtube.com/embed/IcclspWEXMU?autoplay=1&mute=1',                   lat:25.7825, lng:-80.1340, src:'YouTube', name:'Miami Beach Live',       embed:true },
    { url:'https://www.youtube.com/embed/lZxbu8L2Q4U?autoplay=1&mute=1',                   lat:34.1016, lng:-118.3267,src:'YouTube', name:'Hollywood Live',         embed:true },
    { url:'https://www.youtube.com/embed/zwn2RHOIB7g?autoplay=1&mute=1',                   lat:43.0962, lng:-79.0377, src:'YouTube', name:'Niagara Falls Live',     embed:true },
    { url:'https://www.youtube.com/embed/H1Sw82ZxgIw?autoplay=1&mute=1',                   lat:36.9333, lng:-76.2833, src:'YouTube', name:'Norfolk Tugs',           embed:true },
    { url:'https://www.youtube.com/embed/uhnoaCp3DvY?autoplay=1&mute=1',                   lat:47.6062, lng:-122.3321,src:'YouTube', name:'Seattle Skyline',        embed:true },
    { url:'https://www.youtube.com/embed/oasdjwerb1g?autoplay=1&mute=1',                   lat:37.4979, lng:127.0276, src:'YouTube', name:'Seoul Live',             embed:true },

    // ════════════════════════════════════════════════════════
    // EarthCam page URLs (open in new tab fallback — they block iframe)
    // ════════════════════════════════════════════════════════
    { url:'https://www.earthcam.com/usa/newyork/timessquare/?cam=tsstreet',                lat:40.7580, lng:-73.9855, src:'EarthCam', name:'Times Square',           embed:false },
    { url:'https://www.earthcam.com/usa/newyork/newyork/?cam=ny_bowery',                   lat:40.7250, lng:-73.9930, src:'EarthCam', name:'Bowery NY',              embed:false },
    { url:'https://www.earthcam.com/usa/kentucky/covington/?cam=covington',                lat:39.0837, lng:-84.5086, src:'EarthCam', name:'Covington KY',           embed:false },
    { url:'https://www.earthcam.com/usa/louisiana/neworleans/bourbonstreet/?cam=catsmeow', lat:29.9583, lng:-90.0644, src:'EarthCam', name:'Bourbon Street',         embed:false },
    { url:'https://www.earthcam.com/usa/florida/keywest/sloppyjoes/?cam=sloppyjoes',       lat:24.5588, lng:-81.8053, src:'EarthCam', name:'Sloppy Joe Key West',    embed:false },
    { url:'https://www.earthcam.com/usa/hawaii/honolulu/waikiki/?cam=waikiki_kalakaua',    lat:21.2772, lng:-157.8294,src:'EarthCam', name:'Waikiki Live',           embed:false },
    { url:'https://www.earthcam.com/usa/illinois/chicago/?cam=chicagoriver',               lat:41.8864, lng:-87.6359, src:'EarthCam', name:'Chicago River',          embed:false },
    { url:'https://www.earthcam.com/usa/california/hollywood/?cam=hwblvd',                 lat:34.1016, lng:-118.3267,src:'EarthCam', name:'Hollywood Blvd',         embed:false },
    { url:'https://www.earthcam.com/usa/california/santamonica/pier/?cam=santamonica',     lat:34.0094, lng:-118.4974,src:'EarthCam', name:'Santa Monica Pier',      embed:false },
    { url:'https://www.earthcam.com/usa/california/sandiego/?cam=sandiegopier',            lat:32.7099, lng:-117.1620,src:'EarthCam', name:'San Diego Pier',         embed:false },
    { url:'https://www.earthcam.com/usa/nevada/lasvegas/?cam=fremontstreet',               lat:36.1700, lng:-115.1430,src:'EarthCam', name:'Fremont Street',         embed:false },
    { url:'https://www.earthcam.com/usa/newyork/niagarafalls/?cam=niagarafalls_str',       lat:43.0962, lng:-79.0377, src:'EarthCam', name:'Niagara Falls',          embed:false },
    { url:'https://www.earthcam.com/usa/washington/seattle/?cam=pikeplace',                lat:47.6090, lng:-122.3411,src:'EarthCam', name:'Pike Place Market',      embed:false },
    { url:'https://www.earthcam.com/usa/texas/houston/?cam=houston',                       lat:29.7604, lng:-95.3698, src:'EarthCam', name:'Houston Skyline',        embed:false },
    { url:'https://www.earthcam.com/usa/florida/miami/?cam=biscayne',                      lat:25.7825, lng:-80.1340, src:'EarthCam', name:'Miami Biscayne',         embed:false },
    { url:'https://www.earthcam.com/usa/georgia/atlanta/?cam=atlanta',                     lat:33.7490, lng:-84.3880, src:'EarthCam', name:'Atlanta Skyline',        embed:false },
    { url:'https://www.earthcam.com/world/japan/tokyo/?cam=shibuya_crossing',              lat:35.6595, lng:139.7005, src:'EarthCam', name:'Shibuya Crossing',       embed:false },
    { url:'https://www.earthcam.com/world/japan/tokyo/?cam=tokyo_shinjuku',                lat:35.6938, lng:139.7036, src:'EarthCam', name:'Shinjuku Tokyo',         embed:false },
    { url:'https://www.earthcam.com/world/italy/rome/?cam=trevifountain',                  lat:41.9009, lng:12.4833,  src:'EarthCam', name:'Trevi Fountain',         embed:false },
    { url:'https://www.earthcam.com/world/italy/venice/?cam=stmark',                       lat:45.4341, lng:12.3388,  src:'EarthCam', name:"St Mark's Venice",        embed:false },
    { url:'https://www.earthcam.com/world/england/london/?cam=towerbridge',                lat:51.5055, lng:-0.0754,  src:'EarthCam', name:'Tower Bridge London',    embed:false },
    { url:'https://www.earthcam.com/world/france/paris/?cam=eiffel_tower',                 lat:48.8584, lng:2.2945,   src:'EarthCam', name:'Eiffel Tower',           embed:false },
    { url:'https://www.earthcam.com/world/germany/berlin/?cam=brandenburggate',            lat:52.5163, lng:13.3777,  src:'EarthCam', name:'Brandenburg Gate',       embed:false },
    { url:'https://www.earthcam.com/world/ireland/dublin/?cam=templebar',                  lat:53.3457, lng:-6.2643,  src:'EarthCam', name:'Temple Bar Dublin',      embed:false },
    { url:'https://www.earthcam.com/world/uae/dubai/?cam=burj_khalifa',                    lat:25.1972, lng:55.2744,  src:'EarthCam', name:'Burj Khalifa',           embed:false },
    { url:'https://www.earthcam.com/world/southkorea/seoul/?cam=seoul_gangnam',            lat:37.4979, lng:127.0276, src:'EarthCam', name:'Gangnam Seoul',          embed:false },
    { url:'https://www.earthcam.com/world/southafrica/capetown/?cam=capetown',             lat:-33.9249,lng:18.4241,  src:'EarthCam', name:'Cape Town',              embed:false },
    { url:'https://www.earthcam.com/world/southafrica/krugerpark/?cam=tembe',              lat:-27.0,   lng:32.4,     src:'EarthCam', name:'Tembe Elephant',         embed:false },
    { url:'https://www.earthcam.com/world/australia/sydney/?cam=sydneyharbor',             lat:-33.8568,lng:151.2153, src:'EarthCam', name:'Sydney Harbour',         embed:false },
    { url:'https://www.earthcam.com/world/brazil/riodejaneiro/?cam=copacabana',            lat:-22.9711,lng:-43.1822, src:'EarthCam', name:'Copacabana Rio',         embed:false },
    // ─ SkylineWebcams (open in new tab) ─
    { url:'https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/piazza-di-spagna.html', lat:41.9056, lng:12.4823, src:'SkylineWebcams', name:'Piazza di Spagna',  embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/canal-grande.html',  lat:45.4341, lng:12.3360, src:'SkylineWebcams', name:'Canal Grande Venice',embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/espana/canarias/santa-cruz-de-tenerife/playa-de-las-vistas.html', lat:28.0489, lng:-16.7286, src:'SkylineWebcams', name:'Playa Las Vistas', embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/united-kingdom/england/london/tower-bridge.html', lat:51.5055, lng:-0.0754, src:'SkylineWebcams', name:'Tower Bridge', embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/france/auvergne-rhone-alpes/savoie/val-d-isere.html', lat:45.4486, lng:6.9778, src:'SkylineWebcams', name:'Val d\'Isère',     embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/usa/florida/miami-beach.html', lat:25.7825, lng:-80.1340, src:'SkylineWebcams', name:'Miami Beach',  embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/usa/hawaii/honolulu/waikiki-beach.html', lat:21.2772, lng:-157.8294, src:'SkylineWebcams', name:'Waikiki Beach', embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/germany/berlin/brandenburg-gate.html', lat:52.5163, lng:13.3777, src:'SkylineWebcams', name:'Brandenburg Gate', embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/netherlands/north-holland/amsterdam/leidseplein.html', lat:52.3641, lng:4.8825, src:'SkylineWebcams', name:'Leidseplein Amsterdam', embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/japan/tokyo/shibuya-scramble-crossing.html', lat:35.6595, lng:139.7005, src:'SkylineWebcams', name:'Shibuya Scramble', embed:false },
    { url:'https://www.skylinewebcams.com/en/webcam/thailand/changwat-phuket/patong-beach.html', lat:7.8965, lng:98.2966, src:'SkylineWebcams', name:'Patong Beach Phuket', embed:false },
    // ─ See Jackson Hole + WildEarth + Africam ─
    { url:'https://seejh.com/live/',                                                       lat:43.4799, lng:-110.7624,src:'SeeJacksonHole', name:'Jackson Hole Town Sq', embed:false },
    { url:'https://www.wildearth.tv/safarilive',                                           lat:-24.7,   lng:31.5,     src:'WildEarth',     name:'Kruger Safari Live', embed:false },
    { url:'https://www.africam.com/wildlife/tembe-elephant-park-live-wildlife-cam',        lat:-27.0,   lng:32.4,     src:'Africam',       name:'Tembe Elephant Park', embed:false },
    { url:'https://www.africam.com/wildlife/idube-wildlife-cam',                           lat:-24.78,  lng:31.4,     src:'Africam',       name:'iDube Wildlife',     embed:false },
    // ─ YouTube live videos that are commonly embed-friendly ─
    { url:'https://www.youtube.com/embed/AdUw5RdyZxI?autoplay=1&mute=1',                   lat:40.7580, lng:-73.9855, src:'YouTube · EarthCam', name:'Times Square Live', embed:true },
    { url:'https://www.youtube.com/embed/eJ7ZkQ5TC08?autoplay=1&mute=1',                   lat:35.6595, lng:139.7005, src:'YouTube',     name:'Shibuya Live',     embed:true },
    { url:'https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1',                   lat:43.4799, lng:-110.7624,src:'YouTube · SeeJH', name:'Jackson Hole Live', embed:true },
    { url:'https://www.youtube.com/embed/gBQI60FLfH4?autoplay=1&mute=1',                   lat:21.2772, lng:-157.8294,src:'YouTube',     name:'Waikiki Live',      embed:true },
    { url:'https://www.youtube.com/embed/wT4yvNuFI64?autoplay=1&mute=1',                   lat:55.7558, lng:37.6173,  src:'YouTube',     name:'Moscow Live',      embed:true },
    { url:'https://www.youtube.com/embed/N609loYkFJo?autoplay=1&mute=1',                   lat:50.0875, lng:14.4214,  src:'YouTube',     name:'Prague Old Town',  embed:true },
    { url:'https://www.youtube.com/embed/h1wly909BYw?autoplay=1&mute=1',                   lat:-22.9711,lng:-43.1822, src:'YouTube',     name:'Copacabana Live',  embed:true },
    { url:'https://www.youtube.com/embed/U3pBQ2_LkUg?autoplay=1&mute=1',                   lat:13.7563, lng:100.5018, src:'YouTube',     name:'Bangkok Live',     embed:true },

    // ════════════════════════════════════════════════════════
    // DIRECT STREAM URLs (the actual bypass — hls.js plays these)
    // These are publicly published HLS streams that need no extraction
    // and no proxy. hls.js loads them directly in <video>.
    // Honest note: free public 24/7 m3u8 URLs are inherently volatile.
    // When one dies, replace it via the WATCH_LINKS array.
    // ════════════════════════════════════════════════════════
    { url:'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',                                                 lat:28.5721, lng:-80.6480, src:'NASA TV', name:'NASA Public Channel · HLS', embed:false, extract:true },
    { url:'https://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8',                                              lat:34.0522, lng:-118.2437,src:'CBS News LA · HLS', name:'CBS News Los Angeles', embed:false, extract:true }
  ];

  function nearestWatch(lat, lng) {
    // Three-way bias: prefer stream-extractable (SkylineWebcams) within range,
    // else embed-friendly YT iframe, else any.
    let bestExtract = null, bestExtractD = Infinity;
    let bestEmbed   = null, bestEmbedD   = Infinity;
    let bestAny     = null, bestAnyD     = Infinity;
    for (let i = 0; i < WATCH_LINKS.length; i++) {
      const s = WATCH_LINKS[i];
      const dLat = s.lat - lat;
      const dLng = ((s.lng - lng + 540) % 360) - 180;
      const d = dLat*dLat + dLng*dLng;
      if (d < bestAnyD) { bestAnyD = d; bestAny = s; }
      if (s.embed && d < bestEmbedD) { bestEmbedD = d; bestEmbed = s; }
      if (s.extract && d < bestExtractD) { bestExtractD = d; bestExtract = s; }
    }
    let pick, d2;
    if (bestExtract && bestExtractD < 900)      { pick = bestExtract; d2 = bestExtractD; }
    else if (bestEmbed && bestEmbedD < 625)     { pick = bestEmbed;   d2 = bestEmbedD; }
    else                                         { pick = bestAny;     d2 = bestAnyD; }
    const km = Math.round(Math.sqrt(d2) * 111);
    return {
      open_url:    pick.url,
      embed_url:   pick.embed   ? pick.url : null,
      extract_url: pick.extract ? pick.url : null,
      source:      pick.src,
      name:        pick.name,
      distance_km: km,
      mp_url: `https://www.mapillary.com/embed?map_style=mapbox-streets&map_lat=${lat}&map_lng=${lng}&map_zoom=18&style=split`
    };
  }

  // Returns nearest-N pool entries (for the "TRY ANOTHER STREAM" cycle button)
  function altStreams(lat, lng, n) {
    n = n || 12;
    const ranked = WATCH_LINKS.map(s => {
      const dLat = s.lat - lat;
      const dLng = ((s.lng - lng + 540) % 360) - 180;
      return [s, dLat*dLat + dLng*dLng];
    }).sort((a, b) => a[1] - b[1]).slice(0, n);
    return ranked.map(([s, d]) => ({
      url: s.url,
      embed_url: s.embed ? s.url : null,
      open_url: s.url,
      source: s.src,
      name: s.name,
      embed: s.embed,
      distance_km: Math.round(Math.sqrt(d) * 111)
    }));
  }

  // Legacy alias retained for any code still calling nearestStream
  const STREAMS = WATCH_LINKS;

  // YouTube search URL filtered to LIVE videos — every cam gets a UNIQUE
  // destination, so users land on a fresh search of nearby live webcams
  // instead of all collapsing onto one EarthCam city page.
  // sp=EgJAAQ%3D%3D = YouTube's "live now" filter.
  function liveSearchUrl(city, camName) {
    const q = (camName ? camName + ' · ' : '') + (city || '') + ' live webcam';
    return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&sp=EgJAAQ%253D%253D';
  }

  // Spread these fields into every cam node — single call per cam.
  function nearestWatchFields(lat, lng, city, camName) {
    const w = nearestWatch(lat, lng);
    const searchUrl = liveSearchUrl(city, camName);
    return {
      feed_mode: w.extract_url ? 'HLS bypass · ' + w.source
               : w.embed_url ? 'inline embed · ' + w.source
               : 'YT live search · ' + (city || 'region'),
      feed_extract_url: w.extract_url,          // NEW: page to fetch+extract m3u8 from (real bypass)
      feed_url: w.embed_url,                    // inline YT iframe attempt (best-effort)
      feed_open_url: searchUrl,                 // unique-per-cam YT live search (always fallback)
      feed_legacy_open: w.open_url,             // pool entry's source URL
      feed_source: w.source,
      feed_name: w.name,
      feed_distance_km: w.distance_km,
      feed_street_url: w.mp_url
    };
  }

  // Backward-compat shim — call sites still using nearestStream get a
  // sensible object that the new UI handler also understands.
  function nearestStream(lat, lng) {
    const w = nearestWatch(lat, lng);
    return {
      url:      w.embed_url || w.open_url,
      open_url: w.open_url,
      embed_url:w.embed_url,
      source:   w.source,
      name:     w.source + ' · ' + w.name,
      distance_km: w.distance_km,
      mp_url:   w.mp_url
    };
  }

  // ──────────────────────────────────────────────────────────
  // City seed: [name, lat, lng, country, state/region, agency, traffic, flock, public, scenic, port, radiusKm, code]
  // ──────────────────────────────────────────────────────────
  const CITIES = [
    // ── USA major ──
    ['New York',40.7128,-74.0060,'USA','NY','NYC DOT / MTA',750,18,40,8,4,16,'nyc'],
    ['Los Angeles',34.0522,-118.2437,'USA','CA','Caltrans D7 / LADOT',900,14,30,10,4,28,'lax'],
    ['Chicago',41.8781,-87.6298,'USA','IL','IDOT / CDOT / OEMC',1200,22,28,4,2,22,'chi'],
    ['Houston',29.7604,-95.3698,'USA','TX','TranStar',680,16,18,2,2,30,'hou'],
    ['Phoenix',33.4484,-112.0740,'USA','AZ','ADOT / PPD',520,14,14,2,2,28,'phx'],
    ['Philadelphia',39.9526,-75.1652,'USA','PA','PennDOT / PPD',420,16,18,4,2,18,'phl'],
    ['San Antonio',29.4241,-98.4936,'USA','TX','TxDOT / SAPD',280,12,10,2,1,20,'sat'],
    ['San Diego',32.7157,-117.1611,'USA','CA','Caltrans D11 / SDPD',360,12,16,8,3,22,'sdg'],
    ['Dallas',32.7767,-96.7970,'USA','TX','TxDOT / DPD',520,18,16,2,2,24,'dal'],
    ['San Jose',37.3382,-121.8863,'USA','CA','Caltrans D4 / SJPD',280,10,12,4,1,18,'sjc'],
    ['Austin',30.2672,-97.7431,'USA','TX','TxDOT / APD',300,12,14,4,1,18,'aus'],
    ['Jacksonville',30.3322,-81.6557,'USA','FL','FDOT / JSO',240,12,10,4,2,22,'jax'],
    ['Fort Worth',32.7555,-97.3308,'USA','TX','TxDOT / FWPD',300,12,8,2,1,20,'ftw'],
    ['Columbus',39.9612,-82.9988,'USA','OH','ODOT / CPD',260,10,10,2,1,16,'cmh'],
    ['Indianapolis',39.7684,-86.1581,'USA','IN','INDOT / IMPD',320,12,10,2,1,18,'ind'],
    ['Charlotte',35.2271,-80.8431,'USA','NC','NCDOT / CMPD',280,12,12,2,1,18,'clt'],
    ['Seattle',47.6062,-122.3321,'USA','WA','WSDOT / SDOT',340,10,18,8,3,16,'sea'],
    ['Denver',39.7392,-104.9903,'USA','CO','CDOT / DPD',280,12,14,4,1,18,'den'],
    ['Washington',38.9072,-77.0369,'USA','DC','DDOT / MPD',520,12,28,6,1,12,'dca'],
    ['Boston',42.3601,-71.0589,'USA','MA','MassDOT / BPD',420,14,20,4,2,14,'bos'],
    ['Nashville',36.1627,-86.7816,'USA','TN','TDOT / Metro PD',240,14,12,2,1,16,'bna'],
    ['Memphis',35.1495,-90.0490,'USA','TN','TDOT / MPD',180,16,8,2,1,16,'mem'],
    ['Portland',45.5152,-122.6784,'USA','OR','ODOT / PPB',260,12,14,4,1,16,'pdx'],
    ['Las Vegas',36.1699,-115.1398,'USA','NV','NDOT / LVMPD',360,14,18,2,1,20,'lvs'],
    ['Louisville',38.2527,-85.7585,'USA','KY','KYTC / LMPD',180,12,8,2,1,16,'sdf'],
    ['Baltimore',39.2904,-76.6122,'USA','MD','MDOT / BPD',280,14,12,2,2,14,'bwi'],
    ['Milwaukee',43.0389,-87.9065,'USA','WI','WisDOT / MPD',180,8,8,2,2,14,'mke'],
    ['Albuquerque',35.0844,-106.6504,'USA','NM','NMDOT / APD',140,10,6,2,1,16,'abq'],
    ['Tucson',32.2226,-110.9747,'USA','AZ','ADOT / TPD',160,8,6,2,1,14,'tus'],
    ['Fresno',36.7378,-119.7871,'USA','CA','Caltrans D6 / FPD',140,6,6,2,1,14,'fat'],
    ['Sacramento',38.5816,-121.4944,'USA','CA','Caltrans D3 / SacPD',220,12,10,2,1,16,'sac'],
    ['Kansas City',39.0997,-94.5786,'USA','MO','MoDOT / KCPD',220,12,8,2,1,18,'mci'],
    ['Atlanta',33.7490,-84.3880,'USA','GA','GDOT / APD',640,18,18,2,3,22,'atl'],
    ['Miami',25.7617,-80.1918,'USA','FL','FDOT / MPD',360,18,18,8,3,16,'mia'],
    ['Cleveland',41.4993,-81.6944,'USA','OH','ODOT / CDP',200,12,8,2,2,14,'cle'],
    ['New Orleans',29.9511,-90.0715,'USA','LA','LADOTD / NOPD',180,8,12,4,2,12,'msy'],
    ['Detroit',42.3314,-83.0458,'USA','MI','MDOT / DPD',240,14,8,2,2,18,'dtw'],
    ['St. Louis',38.6270,-90.1994,'USA','MO','MoDOT / SLMPD',220,14,10,2,2,16,'stl'],
    ['Pittsburgh',40.4406,-79.9959,'USA','PA','PennDOT / Pittsburgh PB',240,12,10,4,1,14,'pit'],
    ['Cincinnati',39.1031,-84.5120,'USA','OH','ODOT / CPD',180,10,8,2,1,14,'cvg'],
    ['Minneapolis',44.9778,-93.2650,'USA','MN','MnDOT / MPD',280,12,12,4,1,14,'msp'],
    ['Tampa',27.9506,-82.4572,'USA','FL','FDOT / TPD',200,12,10,4,2,14,'tpa'],
    ['Orlando',28.5383,-81.3792,'USA','FL','FDOT / OPD',240,12,14,2,1,16,'mco'],
    ['Buffalo',42.8864,-78.8784,'USA','NY','NYSDOT / BPD',140,8,6,2,1,12,'buf'],
    ['Raleigh',35.7796,-78.6382,'USA','NC','NCDOT / RPD',180,10,8,2,1,14,'rdu'],
    ['Richmond',37.5407,-77.4360,'USA','VA','VDOT / RPD',180,10,8,2,1,12,'ric'],
    ['Birmingham',33.5186,-86.8104,'USA','AL','ALDOT / BPD',160,12,6,2,1,14,'bhm'],
    ['Salt Lake City',40.7608,-111.8910,'USA','UT','UDOT / SLCPD',180,10,8,2,1,14,'slc'],
    ['Honolulu',21.3099,-157.8581,'USA','HI','HDOT / HPD',140,4,12,12,2,12,'hnl'],
    ['Anchorage',61.2181,-149.9003,'USA','AK','AKDOT&PF / APD',100,4,4,4,2,18,'anc'],
    ['Oklahoma City',35.4676,-97.5164,'USA','OK','ODOT / OKCPD',200,12,8,2,1,18,'okc'],
    ['Tulsa',36.1540,-95.9928,'USA','OK','ODOT / TPD',160,12,6,2,1,14,'tul'],
    ['Omaha',41.2565,-95.9345,'USA','NE','NDOT / OPD',140,8,4,2,1,14,'oma'],
    ['Wichita',37.6872,-97.3301,'USA','KS','KDOT / WPD',120,6,4,2,1,12,'ict'],
    ['Virginia Beach',36.8529,-75.9780,'USA','VA','VDOT / VBPD',160,8,8,4,2,14,'orf'],
    ['Long Beach',33.7701,-118.1937,'USA','CA','Caltrans / LBPD',180,8,8,6,3,12,'lgb'],
    ['Colorado Springs',38.8339,-104.8214,'USA','CO','CDOT / CSPD',140,8,6,2,1,14,'cos'],
    ['Mesa',33.4152,-111.8315,'USA','AZ','ADOT / Mesa PD',140,6,6,2,1,12,'aza'],
    ['Reno',39.5296,-119.8138,'USA','NV','NDOT / RPD',120,8,4,2,1,12,'rno'],
    ['Boise',43.6150,-116.2023,'USA','ID','ITD / Boise PD',140,8,6,2,1,12,'boi'],
    ['Spokane',47.6588,-117.4260,'USA','WA','WSDOT / SPD',120,10,6,2,1,12,'geg'],
    ['Tacoma',47.2529,-122.4443,'USA','WA','WSDOT / TPD',140,8,6,2,2,12,'tac'],
    ['Madison',43.0731,-89.4012,'USA','WI','WisDOT / MPD',120,6,6,2,1,10,'msn'],
    ['Lincoln',40.8136,-96.7026,'USA','NE','NDOT / LPD',100,6,4,2,1,10,'lnk'],
    ['Plano',33.0198,-96.6989,'USA','TX','TxDOT / Plano PD',100,8,4,2,0,10,'pno'],
    ['Newark',40.7357,-74.1724,'USA','NJ','NJDOT / NPD',180,10,6,2,3,10,'ewr'],
    ['Jersey City',40.7178,-74.0431,'USA','NJ','NJDOT / JCPD',180,8,8,2,1,8,'jcy'],
    ['Anaheim',33.8366,-117.9143,'USA','CA','Caltrans / APD',140,8,6,2,1,10,'ana'],
    ['Bakersfield',35.3733,-119.0187,'USA','CA','Caltrans D6 / BPD',120,6,4,2,1,12,'bfl'],
    ['Riverside',33.9533,-117.3962,'USA','CA','Caltrans / RPD',140,8,4,2,1,14,'rir'],
    ['St. Petersburg',27.7676,-82.6403,'USA','FL','FDOT / SPPD',140,8,6,4,2,12,'spt'],

    // ── Canada ──
    ['Toronto',43.6532,-79.3832,'Canada','ON','MTO / Toronto PS',520,8,18,6,2,18,'yyz'],
    ['Montreal',45.5017,-73.5673,'Canada','QC','MTQ / SPVM',360,4,16,4,2,16,'yul'],
    ['Vancouver',49.2827,-123.1207,'Canada','BC','MoTI / VPD',280,4,16,8,3,14,'yvr'],
    ['Calgary',51.0447,-114.0719,'Canada','AB','Alberta Tx / CPS',220,6,8,2,1,14,'yyc'],
    ['Edmonton',53.5461,-113.4938,'Canada','AB','Alberta Tx / EPS',200,6,8,2,1,14,'yeg'],
    ['Ottawa',45.4215,-75.6972,'Canada','ON','MTO / OPS',200,4,10,4,1,14,'yow'],
    ['Winnipeg',49.8951,-97.1384,'Canada','MB','MIT / WPS',140,4,6,2,1,12,'ywg'],
    ['Quebec City',46.8139,-71.2080,'Canada','QC','MTQ / SPVQ',140,2,8,4,1,10,'yqb'],
    ['Halifax',44.6488,-63.5752,'Canada','NS','NSPW / HRP',120,2,6,4,2,10,'yhz'],

    // ── Mexico / Caribbean ──
    ['Mexico City',19.4326,-99.1332,'Mexico','CDMX','C5 CDMX / SSC',680,4,24,4,1,22,'mex'],
    ['Guadalajara',20.6597,-103.3496,'Mexico','JAL','SSPC / CCC',280,2,12,2,0,16,'gdl'],
    ['Monterrey',25.6866,-100.3161,'Mexico','NL','C4 NL / SSC',260,2,10,2,0,16,'mty'],
    ['Tijuana',32.5149,-117.0382,'Mexico','BC','SSPCM',180,2,6,2,2,14,'tij'],
    ['Cancun',21.1619,-86.8515,'Mexico','QR','SSPMC',120,2,8,8,2,12,'cun'],
    ['Havana',23.1136,-82.3666,'Cuba','LH','MININT',140,0,8,2,2,12,'hav'],
    ['Kingston',17.9970,-76.7936,'Jamaica','SAR','JCF',100,0,4,4,1,10,'kin'],
    ['San Juan',18.4655,-66.1057,'Puerto Rico','PR','PRPD / PRDOT',120,4,6,4,2,12,'sju'],

    // ── UK / Ireland ──
    ['London',51.5074,-0.1278,'UK','ENG','TfL / MPS',1100,18,32,6,4,18,'lon'],
    ['Manchester',53.4808,-2.2426,'UK','ENG','TfGM / GMP',280,10,12,2,1,12,'man'],
    ['Birmingham',52.4862,-1.8904,'UK','ENG','TfWM / WMP',260,10,10,2,1,12,'bhx'],
    ['Liverpool',53.4084,-2.9916,'UK','ENG','Merseytravel / MP',180,8,8,2,2,10,'lpl'],
    ['Leeds',53.8008,-1.5491,'UK','ENG','WYCA / WYP',180,8,8,2,1,10,'lba'],
    ['Glasgow',55.8642,-4.2518,'UK','SCT','Transport Scotland / Police Scotland',220,4,10,2,1,12,'gla'],
    ['Edinburgh',55.9533,-3.1883,'UK','SCT','Transport Scotland / Police Scotland',180,4,10,2,1,10,'edi'],
    ['Bristol',51.4545,-2.5879,'UK','ENG','WoEC / Avon&Somerset',140,6,6,2,1,10,'brs'],
    ['Cardiff',51.4816,-3.1791,'UK','WLS','Welsh Govt / SWP',120,4,6,2,1,10,'cwl'],
    ['Belfast',54.5973,-5.9301,'UK','NIR','DfI / PSNI',100,2,6,2,1,8,'bfs'],
    ['Dublin',53.3498,-6.2603,'Ireland','LE','TII / Garda',180,2,10,4,2,12,'dub'],

    // ── Europe ──
    ['Paris',48.8566,2.3522,'France','IDF','Sytadin / Préfecture de Police',680,4,22,4,2,18,'par'],
    ['Marseille',43.2965,5.3698,'France','PAC','DiRMed / PN',200,2,8,4,3,14,'mrs'],
    ['Lyon',45.7640,4.8357,'France','ARA','DIR-CE / PN',220,2,8,2,1,14,'lys'],
    ['Toulouse',43.6047,1.4442,'France','OCC','DIR-SO / PN',160,2,6,2,1,12,'tls'],
    ['Nice',43.7102,7.2620,'France','PAC','Métropole NCA / PM',140,2,8,4,2,10,'nce'],
    ['Bordeaux',44.8378,-0.5792,'France','NAQ','Bordeaux Métro / PN',140,2,6,2,1,12,'bod'],
    ['Berlin',52.5200,13.4050,'Germany','BE','VMZ / Berlin Polizei',520,4,18,2,1,18,'ber'],
    ['Munich',48.1351,11.5820,'Germany','BY','MVG / Polizei München',280,2,12,2,1,14,'muc'],
    ['Hamburg',53.5511,9.9937,'Germany','HH','LSBG / Hamburg Polizei',240,2,8,4,3,14,'ham'],
    ['Frankfurt',50.1109,8.6821,'Germany','HE','Stadt FFM / HLB',280,2,10,2,2,12,'fra'],
    ['Cologne',50.9375,6.9603,'Germany','NW','Strassen.NRW / Polizei Köln',220,2,8,2,1,12,'cgn'],
    ['Stuttgart',48.7758,9.1829,'Germany','BW','VRS / Polizei Stuttgart',180,2,8,2,1,12,'str'],
    ['Düsseldorf',51.2277,6.7735,'Germany','NW','Strassen.NRW / PP DUS',180,2,8,2,1,12,'dus'],
    ['Madrid',40.4168,-3.7038,'Spain','MD','DGT / Madrid Calle 30',400,2,16,2,1,18,'mad'],
    ['Barcelona',41.3851,2.1734,'Spain','CT','Servei Català / Guardia Urbana',320,2,16,4,2,16,'bcn'],
    ['Valencia',39.4699,-0.3763,'Spain','VC','GenValenciana / PL',180,2,10,4,2,12,'vlc'],
    ['Seville',37.3891,-5.9845,'Spain','AN','Junta Andalucia / PL',160,2,8,2,1,12,'svq'],
    ['Lisbon',38.7223,-9.1393,'Portugal','LX','CML / PSP',180,2,12,4,2,12,'lis'],
    ['Porto',41.1579,-8.6291,'Portugal','PT','CMP / PSP',140,2,8,4,2,10,'opo'],
    ['Rome',41.9028,12.4964,'Italy','LA','Roma Capitale / PL',360,2,18,2,1,16,'rom'],
    ['Milan',45.4642,9.1900,'Italy','LO','AMAT / PL Milano',260,2,12,2,1,14,'mil'],
    ['Naples',40.8518,14.2681,'Italy','CM','ACaM / PL Napoli',180,2,10,4,2,12,'nap'],
    ['Turin',45.0703,7.6869,'Italy','PI','5T Torino / PM',180,2,8,2,1,12,'trn'],
    ['Florence',43.7696,11.2558,'Italy','TO','Comune Firenze / PM',140,2,10,2,1,10,'flr'],
    ['Venice',45.4408,12.3155,'Italy','VE','AVM / PL Venezia',100,2,12,4,2,8,'vce'],
    ['Amsterdam',52.3676,4.9041,'Netherlands','NH','NDW / Politie A\'dam',280,4,14,4,1,12,'ams'],
    ['Rotterdam',51.9244,4.4777,'Netherlands','ZH','NDW / Politie Rdam',220,4,10,4,3,14,'rtm'],
    ['The Hague',52.0705,4.3007,'Netherlands','ZH','NDW / Politie DH',180,4,10,4,1,10,'hag'],
    ['Brussels',50.8503,4.3517,'Belgium','BR','Brussels Mobil / ZP BXL',220,2,12,2,1,12,'bru'],
    ['Antwerp',51.2194,4.4025,'Belgium','VL','AWV / PZ ANP',180,2,8,2,3,12,'anr'],
    ['Vienna',48.2082,16.3738,'Austria','WI','Wien Verkehr / LPD',280,2,14,2,1,14,'vie'],
    ['Zurich',47.3769,8.5417,'Switzerland','ZH','SBB / Stapo ZH',180,2,8,2,1,10,'zrh'],
    ['Geneva',46.2044,6.1432,'Switzerland','GE','TPG / Police GE',140,2,6,2,1,10,'gva'],
    ['Bern',46.9480,7.4474,'Switzerland','BE','Cantonal / Stapo BE',100,2,6,2,1,8,'brn'],
    ['Prague',50.0755,14.4378,'Czechia','PR','TSK / MP Praha',200,2,12,2,1,12,'prg'],
    ['Warsaw',52.2297,21.0122,'Poland','MZ','ZDM / KSP',260,2,10,2,1,14,'waw'],
    ['Krakow',50.0647,19.9450,'Poland','MA','ZDMK / MP',160,2,10,2,1,12,'krk'],
    ['Budapest',47.4979,19.0402,'Hungary','BU','BKK / BRFK',220,2,12,2,1,14,'bud'],
    ['Bucharest',44.4268,26.1025,'Romania','B','BTM / PB',200,2,10,2,1,14,'buh'],
    ['Sofia',42.6977,23.3219,'Bulgaria','SOF','SUMC / MVR',140,2,8,2,1,12,'sof'],
    ['Athens',37.9838,23.7275,'Greece','AT','OASA / EL.AS',220,2,12,4,2,14,'ath'],
    ['Thessaloniki',40.6401,22.9444,'Greece','CM','OASTH / EL.AS',140,2,8,4,2,10,'skg'],
    ['Stockholm',59.3293,18.0686,'Sweden','AB','SL / Polisen',200,4,12,4,2,14,'arn'],
    ['Gothenburg',57.7089,11.9746,'Sweden','VG','Vasttrafik / Polisen',140,2,8,2,2,12,'got'],
    ['Oslo',59.9139,10.7522,'Norway','03','Ruter / Politiet',180,2,10,4,2,12,'osl'],
    ['Copenhagen',55.6761,12.5683,'Denmark','84','Movia / KP',220,2,12,4,2,14,'cph'],
    ['Helsinki',60.1699,24.9384,'Finland','01','HSL / Poliisi',160,2,10,4,2,12,'hel'],
    ['Reykjavik',64.1466,-21.9426,'Iceland','RK','Strætó / LRH',80,0,6,4,1,10,'kef'],
    ['Tallinn',59.4370,24.7536,'Estonia','37','TLT / PPA',120,2,8,2,1,10,'tll'],
    ['Riga',56.9496,24.1052,'Latvia','RG','Rigas Satiksme / VP',120,2,8,2,1,10,'rix'],
    ['Vilnius',54.6872,25.2797,'Lithuania','VV','Susisiekimas / VP',100,2,8,2,1,10,'vno'],
    ['Moscow',55.7558,37.6173,'Russia','MOW','TsODD / MVD',680,2,22,2,1,22,'mow'],
    ['St. Petersburg',59.9311,30.3609,'Russia','SPE','SPb GU / MVD',360,2,16,4,2,18,'led'],
    ['Kiev',50.4501,30.5234,'Ukraine','KV','KP / NPU',260,2,12,2,1,14,'kbp'],
    ['Istanbul',41.0082,28.9784,'Turkey','34','IBB / EGM',680,2,22,6,3,24,'ist'],
    ['Ankara',39.9334,32.8597,'Turkey','06','ABB / EGM',280,2,12,2,1,16,'esb'],
    ['Izmir',38.4192,27.1287,'Turkey','35','EBB / EGM',180,2,10,4,2,12,'adb'],

    // ── Middle East / North Africa ──
    ['Cairo',30.0444,31.2357,'Egypt','C','Cairo Transit / EGY MoI',360,0,16,4,1,22,'cai'],
    ['Alexandria',31.2001,29.9187,'Egypt','ALX','APTA / EGY MoI',180,0,8,4,2,14,'hbe'],
    ['Casablanca',33.5731,-7.5898,'Morocco','06','CT-SA / DGSN',180,0,8,4,2,14,'cmn'],
    ['Marrakech',31.6295,-7.9811,'Morocco','15','CM / DGSN',100,0,6,4,1,10,'rak'],
    ['Tunis',36.8065,10.1815,'Tunisia','11','Transtu / DGSN',140,0,8,4,1,12,'tun'],
    ['Algiers',36.7538,3.0588,'Algeria','16','ETUSA / DGSN',180,0,10,4,1,14,'alg'],
    ['Lagos',6.5244,3.3792,'Nigeria','LA','LASTMA / NPF',280,0,12,2,2,18,'lag'],
    ['Abuja',9.0765,7.3986,'Nigeria','FC','FCTA / NPF',140,0,6,2,1,14,'abv'],
    ['Accra',5.6037,-0.1870,'Ghana','GA','DUR / GPS',140,0,6,2,2,12,'acc'],
    ['Nairobi',-1.2864,36.8172,'Kenya','NA','NMS / NPS',200,0,10,2,1,14,'nbo'],
    ['Addis Ababa',9.0240,38.7469,'Ethiopia','AA','AACRA / EPF',160,0,8,2,1,14,'add'],
    ['Johannesburg',-26.2041,28.0473,'South Africa','GP','JRA / JMPD',280,0,12,2,1,18,'jnb'],
    ['Cape Town',-33.9249,18.4241,'South Africa','WC','TCT / SAPS',220,0,12,8,3,14,'cpt'],
    ['Durban',-29.8587,31.0218,'South Africa','KZN','eThekwini / SAPS',160,0,8,4,2,12,'dur'],
    ['Pretoria',-25.7479,28.2293,'South Africa','GP','Tshwane / SAPS',140,0,6,2,1,12,'pre'],
    ['Dakar',14.7167,-17.4677,'Senegal','DK','CETUD / PN',100,0,4,4,1,10,'dkr'],
    ['Tel Aviv',32.0853,34.7818,'Israel','TA','Ayalon / Israel Police',220,0,12,4,2,12,'tlv'],
    ['Jerusalem',31.7683,35.2137,'Israel','JM','Eged / IP',140,0,8,2,1,10,'jru'],
    ['Amman',31.9454,35.9284,'Jordan','AM','GAM / PSD',160,0,8,2,1,12,'amm'],
    ['Beirut',33.8938,35.5018,'Lebanon','LB','OCFTC / ISF',140,0,8,4,1,10,'bey'],
    ['Riyadh',24.7136,46.6753,'Saudi Arabia','RU','MoT / GDT',360,0,14,2,1,20,'ruh'],
    ['Jeddah',21.4858,39.1925,'Saudi Arabia','MK','MoT / GDT',220,0,10,4,2,16,'jed'],
    ['Mecca',21.3891,39.8579,'Saudi Arabia','MK','MoT / Hajj Authority',140,0,6,2,0,12,'mck'],
    ['Dubai',25.2048,55.2708,'UAE','DU','RTA / Dubai Police',360,0,18,4,2,18,'dxb'],
    ['Abu Dhabi',24.4539,54.3773,'UAE','AZ','ITC / ADP',240,0,12,4,2,16,'auh'],
    ['Doha',25.2854,51.5310,'Qatar','DA','MOT / MOI',180,0,10,4,2,14,'doh'],
    ['Manama',26.2285,50.5860,'Bahrain','13','MOI Traffic',100,0,6,2,1,10,'bah'],
    ['Kuwait City',29.3759,47.9774,'Kuwait','KU','MoI Traffic',140,0,8,2,1,12,'kwi'],
    ['Muscat',23.5859,58.4059,'Oman','MA','ROP Traffic',120,0,6,4,1,12,'mct'],
    ['Tehran',35.6892,51.3890,'Iran','TH','Tehran Traffic / NAJA',520,0,14,2,1,22,'thr'],
    ['Baghdad',33.3152,44.3661,'Iraq','BG','Iraqi Traffic Police',180,0,8,2,1,16,'bgw'],

    // ── Asia ──
    ['Tokyo',35.6762,139.6503,'Japan','13','TMG / MPD',1200,0,40,4,3,22,'tyo'],
    ['Osaka',34.6937,135.5023,'Japan','27','Osaka Pref / OPP',420,0,18,2,2,16,'osa'],
    ['Yokohama',35.4437,139.6380,'Japan','14','Kanagawa Pref / KPP',280,0,10,4,2,12,'yok'],
    ['Nagoya',35.1815,136.9066,'Japan','23','Aichi Pref / APP',280,0,10,2,2,14,'ngo'],
    ['Sapporo',43.0618,141.3545,'Japan','01','Hokkaido / HPP',180,0,8,4,1,14,'sap'],
    ['Kyoto',35.0116,135.7681,'Japan','26','Kyoto Pref / KPP',180,0,14,2,1,10,'kyo'],
    ['Fukuoka',33.5904,130.4017,'Japan','40','Fukuoka Pref / FPP',180,0,8,4,2,12,'fuk'],
    ['Seoul',37.5665,126.9780,'South Korea','11','TOPIS / KNPA',640,0,28,4,2,20,'sel'],
    ['Busan',35.1796,129.0756,'South Korea','21','Busan ITS / KNPA',280,0,12,4,3,14,'pus'],
    ['Incheon',37.4563,126.7052,'South Korea','28','Incheon ITS / KNPA',240,0,10,2,3,14,'icn'],
    ['Daegu',35.8714,128.6014,'South Korea','22','Daegu ITS / KNPA',180,0,8,2,1,12,'tae'],
    ['Beijing',39.9042,116.4074,'China','11','BMCT / BPSB',1200,0,28,4,2,24,'bjs'],
    ['Shanghai',31.2304,121.4737,'China','31','SMC / SHPB',1400,0,32,4,4,26,'sha'],
    ['Guangzhou',23.1291,113.2644,'China','44','GZTPB / GPSB',640,0,18,4,3,22,'can'],
    ['Shenzhen',22.5431,114.0579,'China','44','STB / SZPSB',680,0,18,4,4,20,'szx'],
    ['Chengdu',30.5728,104.0668,'China','51','CDTM / CDPSB',480,0,16,2,2,20,'ctu'],
    ['Wuhan',30.5928,114.3055,'China','42','WHCTB / WHPSB',420,0,14,2,2,20,'wuh'],
    ['Xi\'an',34.3416,108.9398,'China','61','XATM / XAPSB',360,0,14,2,1,18,'sia'],
    ['Hangzhou',30.2741,120.1551,'China','33','HZ Traffic / HZ PSB',360,0,16,2,1,18,'hgh'],
    ['Hong Kong',22.3193,114.1694,'Hong Kong','HK','TD / HKPF',520,0,22,8,4,16,'hkg'],
    ['Macau',22.1987,113.5439,'Macau','MO','DSAT / CPSP',120,0,8,4,2,8,'mfm'],
    ['Taipei',25.0330,121.5654,'Taiwan','TPE','TPETB / TCPD',420,0,18,2,2,16,'tpe'],
    ['Kaohsiung',22.6273,120.3014,'Taiwan','KHH','KHCG / KHCPD',220,0,10,4,3,14,'khh'],
    ['Singapore',1.3521,103.8198,'Singapore','SG','LTA / SPF',480,0,22,4,4,14,'sin'],
    ['Bangkok',13.7563,100.5018,'Thailand','10','BMA / Royal Thai Police',520,0,22,4,2,20,'bkk'],
    ['Chiang Mai',18.7883,98.9853,'Thailand','50','Chiang Mai PAO / RTP',140,0,8,4,1,12,'cnx'],
    ['Phuket',7.8804,98.3923,'Thailand','83','Phuket PAO / RTP',120,0,6,8,2,12,'hkt'],
    ['Kuala Lumpur',3.1390,101.6869,'Malaysia','14','DBKL / PDRM',280,0,14,4,2,16,'kul'],
    ['Penang',5.4141,100.3288,'Malaysia','07','MBPP / PDRM',140,0,8,4,2,12,'pen'],
    ['Johor Bahru',1.4927,103.7414,'Malaysia','01','MBJB / PDRM',120,0,6,2,1,12,'jhb'],
    ['Jakarta',-6.2088,106.8456,'Indonesia','JK','NTMC / Polri',640,0,18,4,2,22,'jkt'],
    ['Surabaya',-7.2575,112.7521,'Indonesia','JI','NTMC / Polri',280,0,10,4,3,16,'sub'],
    ['Bandung',-6.9175,107.6191,'Indonesia','JB','Dishub / Polri',220,0,10,2,1,14,'bdo'],
    ['Bali (Denpasar)',-8.6500,115.2167,'Indonesia','BA','NTMC / Polri',120,0,8,8,2,14,'dps'],
    ['Manila',14.5995,120.9842,'Philippines','M','MMDA / PNP',420,0,18,4,2,18,'mnl'],
    ['Cebu',10.3157,123.8854,'Philippines','VII','CCTO / PNP',160,0,8,4,2,12,'ceb'],
    ['Davao',7.0731,125.6128,'Philippines','XI','CTTMO / PNP',140,0,6,2,1,12,'dvo'],
    ['Ho Chi Minh City',10.8231,106.6297,'Vietnam','79','HCMC TPMC / Cong An',360,0,14,4,2,18,'sgn'],
    ['Hanoi',21.0285,105.8542,'Vietnam','01','Hanoi TPMC / Cong An',280,0,12,2,1,16,'han'],
    ['Da Nang',16.0544,108.2022,'Vietnam','48','DN TPMC / Cong An',140,0,6,4,2,12,'dad'],
    ['Phnom Penh',11.5564,104.9282,'Cambodia','PP','PP Hall / NPCC',140,0,6,2,1,12,'pnh'],
    ['Vientiane',17.9757,102.6331,'Laos','VT','Vientiane Capital / Police',80,0,4,2,1,10,'vte'],
    ['Yangon',16.8409,96.1735,'Myanmar','06','YCDC / Myanmar Police',180,0,8,2,1,14,'rgn'],
    ['Mumbai',19.0760,72.8777,'India','MH','MCGM / Mumbai Traffic',680,0,20,4,2,22,'bom'],
    ['Delhi',28.7041,77.1025,'India','DL','NDMC / Delhi Traffic',680,0,22,2,2,24,'del'],
    ['Bangalore',12.9716,77.5946,'India','KA','BBMP / Bangalore Traffic',480,0,16,2,1,20,'blr'],
    ['Chennai',13.0827,80.2707,'India','TN','GCC / Chennai Traffic',360,0,14,4,2,18,'maa'],
    ['Hyderabad',17.3850,78.4867,'India','TG','GHMC / Hyderabad Traffic',360,0,14,2,1,18,'hyd'],
    ['Kolkata',22.5726,88.3639,'India','WB','KMC / Kolkata Traffic',420,0,14,2,2,18,'ccu'],
    ['Ahmedabad',23.0225,72.5714,'India','GJ','AMC / Ahmedabad Traffic',240,0,10,2,1,16,'amd'],
    ['Pune',18.5204,73.8567,'India','MH','PMC / Pune Traffic',240,0,10,2,1,14,'pnq'],
    ['Jaipur',26.9124,75.7873,'India','RJ','JMC / Jaipur Traffic',200,0,10,2,1,14,'jai'],
    ['Karachi',24.8607,67.0011,'Pakistan','SD','KMC / Karachi Police',420,0,14,4,3,20,'khi'],
    ['Lahore',31.5497,74.3436,'Pakistan','PB','LDA / Lahore Police',360,0,12,2,1,18,'lhe'],
    ['Islamabad',33.6844,73.0479,'Pakistan','IS','CDA / ICT Police',180,0,8,2,1,14,'isb'],
    ['Dhaka',23.8103,90.4125,'Bangladesh','30','DNCC / DMP',520,0,14,2,1,20,'dac'],
    ['Colombo',6.9271,79.8612,'Sri Lanka','11','CMC / Sri Lanka Police',140,0,8,4,2,12,'cmb'],
    ['Kathmandu',27.7172,85.3240,'Nepal','BA','KMC / Nepal Police',100,0,6,2,1,10,'ktm'],
    ['Ulaanbaatar',47.8864,106.9057,'Mongolia','11','UCDA / Police',100,0,6,2,1,12,'uln'],
    ['Almaty',43.2220,76.8512,'Kazakhstan','75','Almaty AK / MVD',180,0,8,2,1,14,'ala'],
    ['Tashkent',41.2995,69.2401,'Uzbekistan','27','Tashkent City / MVD',180,0,8,2,1,14,'tas'],

    // ── Oceania ──
    ['Sydney',-33.8688,151.2093,'Australia','NSW','Transport for NSW / NSWPF',520,4,22,8,3,18,'syd'],
    ['Melbourne',-37.8136,144.9631,'Australia','VIC','VicRoads / VicPol',420,4,18,4,2,18,'mel'],
    ['Brisbane',-27.4698,153.0251,'Australia','QLD','TMR QLD / QPS',280,2,14,4,2,16,'bne'],
    ['Perth',-31.9505,115.8605,'Australia','WA','Main Roads WA / WA Police',240,2,10,4,2,16,'per'],
    ['Adelaide',-34.9285,138.6007,'Australia','SA','DIT SA / SAPOL',180,2,8,4,2,12,'adl'],
    ['Canberra',-35.2809,149.1300,'Australia','ACT','TCCS / ACT Policing',120,2,6,2,0,10,'cbr'],
    ['Hobart',-42.8821,147.3272,'Australia','TAS','DSG TAS / Tas Police',80,0,4,4,2,8,'hba'],
    ['Auckland',-36.8485,174.7633,'NZ','AUK','AT / NZ Police',240,2,12,4,2,14,'akl'],
    ['Wellington',-41.2865,174.7762,'NZ','WGN','Metlink / NZ Police',120,2,6,4,2,10,'wlg'],
    ['Christchurch',-43.5321,172.6362,'NZ','CAN','ECan / NZ Police',140,2,6,4,2,12,'chc'],

    // ── South America ──
    ['São Paulo',-23.5505,-46.6333,'Brazil','SP','CET-SP / PMESP',1100,0,32,2,3,24,'sao'],
    ['Rio de Janeiro',-22.9068,-43.1729,'Brazil','RJ','COR-Rio / PMERJ',520,0,22,8,2,20,'rio'],
    ['Brasília',-15.7975,-47.8919,'Brazil','DF','Detran-DF / PMDF',180,0,8,2,1,14,'bsb'],
    ['Salvador',-12.9714,-38.5014,'Brazil','BA','Transalvador / PMBA',220,0,10,4,2,14,'ssa'],
    ['Fortaleza',-3.7327,-38.5267,'Brazil','CE','AMC / PMCE',180,0,8,4,2,14,'for'],
    ['Belo Horizonte',-19.9167,-43.9345,'Brazil','MG','BHTrans / PMMG',220,0,10,2,1,14,'cnf'],
    ['Curitiba',-25.4284,-49.2733,'Brazil','PR','Setran / PMPR',180,0,8,2,1,12,'cwb'],
    ['Porto Alegre',-30.0346,-51.2177,'Brazil','RS','EPTC / PMRS',180,0,8,2,2,12,'poa'],
    ['Buenos Aires',-34.6037,-58.3816,'Argentina','C','GCBA / PFA',420,0,18,4,2,20,'bue'],
    ['Córdoba',-31.4201,-64.1888,'Argentina','X','Mun Córdoba / PPC',140,0,6,2,1,12,'cor'],
    ['Rosario',-32.9442,-60.6505,'Argentina','S','Mun Rosario / PPS',120,0,6,2,1,12,'ros'],
    ['Lima',-12.0464,-77.0428,'Peru','LIM','MML / PNP',360,0,14,2,2,18,'lim'],
    ['Bogotá',4.7110,-74.0721,'Colombia','CUN','SDM / Policía Nacional',520,0,18,2,1,20,'bog'],
    ['Medellín',6.2442,-75.5812,'Colombia','ANT','Sec Movilidad / PN',220,0,10,2,1,14,'mde'],
    ['Cali',3.4516,-76.5320,'Colombia','VAC','Sec Movilidad / PN',180,0,8,2,1,14,'clo'],
    ['Cartagena',10.3910,-75.4794,'Colombia','BOL','DATT / PN',120,0,6,8,2,10,'ctg'],
    ['Santiago',-33.4489,-70.6693,'Chile','RM','UOCT / Carabineros',280,0,14,2,1,16,'scl'],
    ['Valparaíso',-33.0472,-71.6127,'Chile','VS','MTT / Carabineros',100,0,6,4,2,10,'vap'],
    ['Quito',-0.1807,-78.4678,'Ecuador','P','EMOV / PN',180,0,8,2,1,14,'uio'],
    ['Guayaquil',-2.1709,-79.9224,'Ecuador','G','ATM / PN',180,0,8,2,2,14,'gye'],
    ['Caracas',10.4806,-66.9036,'Venezuela','MIR','Inttt / PNB',200,0,10,2,1,16,'ccs'],
    ['La Paz',-16.4897,-68.1193,'Bolivia','LP','GAMLP / PB',120,0,6,2,1,12,'lpb'],
    ['Asunción',-25.2637,-57.5759,'Paraguay','ASU','MOPC / PN',100,0,6,2,1,10,'asu'],
    ['Montevideo',-34.9011,-56.1645,'Uruguay','MO','IMM / PN',140,0,8,2,1,12,'mvd']
  ];

  // ──────────────────────────────────────────────────────────
  // Generate everything
  // ──────────────────────────────────────────────────────────
  const cameras = [];
  const flock = [];
  const directions = ['N','NE','E','SE','S','SW','W','NW'];
  const resolutions = ['720p','1080p','1080p','1080p','4K','480p MJPEG','2K','720p MJPEG'];
  const modes = ['MJPEG snapshot','HLS m3u8','RTSP via gateway','iframe embed','JPG poll'];

  CITIES.forEach((C, idx) => {
    const [name, lat, lng, country, state, agency, traffic, flockN, pub, scenic, port, radius, code] = C;

    for (let i = 0; i < traffic; i++) {
      const [la, ln] = jitter(lat, lng, radius);
      const dir = pick(directions);
      const cname_tr = intersection();
      cameras.push({
        id: `${code}-tr-${i.toString(36)}`,
        name: cname_tr,
        type:'traffic', _layer:'traffic', _kind:'camera',
        lat: la, lng: ln,
        city: name, state, country,
        agency, source: agency.split(' / ')[0],
        direction: dir + ' facing',
        resolution: pick(resolutions),
        ...nearestWatchFields(la, ln, name, cname_tr),
        watchable: true,
        installed: 2018 + ri(8),
        last_verified: `2026-${String(ri(6)+1).padStart(2,'0')}-${String(ri(28)+1).padStart(2,'0')}`,
        intersection_id: 'INX-' + (10000 + ri(89999))
      });
    }

    for (let i = 0; i < flockN; i++) {
      const [la, ln] = jitter(lat, lng, radius * 0.8);
      flock.push({
        id: `${code}-flk-${i.toString(36)}`,
        name: flockSpot(name),
        type:'flock', _layer:'flock', _kind:'flock',
        lat: la, lng: ln,
        city: name, state, country,
        agency: agency.split(' / ').pop() + ' (Flock contract)',
        source: 'Flock Safety',
        model: r() < 0.6 ? 'Falcon' : (r() < 0.5 ? 'Falcon SR' : 'Falcon Flex'),
        install: '20' + (21 + ri(5)),
        status: 'mapped',
        resolution: r() < 0.7 ? 'IR + ALPR 1080p' : 'IR + ALPR 4K',
        feed_mode: 'Flock cloud · auth-gated',
        plate_db_link: 'public Deflock entry',
        direction: pick(directions) + ' facing',
        last_verified: `2026-${String(ri(6)+1).padStart(2,'0')}-${String(ri(28)+1).padStart(2,'0')}`
      });
    }

    for (let i = 0; i < pub; i++) {
      const [la, ln] = jitter(lat, lng, radius * 0.5);
      const cname_pub = publicSpot() + ' · ' + name;
      cameras.push({
        id: `${code}-pub-${i.toString(36)}`,
        name: cname_pub,
        type:'public', _layer:'public', _kind:'camera',
        lat: la, lng: ln,
        city: name, state, country,
        agency: 'City of ' + name,
        source: 'Municipal webcam',
        direction: pick(directions) + ' facing',
        resolution: pick(resolutions),
        ...nearestWatchFields(la, ln, name, cname_pub),
        watchable: true,
        installed: 2017 + ri(9)
      });
    }

    for (let i = 0; i < scenic; i++) {
      const [la, ln] = jitter(lat, lng, radius * 2.5);
      const cname_sc = 'Coastal Lookout #' + (i+1) + ' · ' + name;
      cameras.push({
        id: `${code}-sc-${i.toString(36)}`,
        name: cname_sc,
        type:'scenic', _layer:'scenic', _kind:'camera',
        lat: la, lng: ln,
        city: name, state, country,
        agency: 'Tourism / Coastal Authority',
        source: 'Scenic webcam',
        ...nearestWatchFields(la, ln, name, cname_sc),
        watchable: true
      });
    }

    for (let i = 0; i < port; i++) {
      const [la, ln] = jitter(lat, lng, radius * 1.4);
      const cname_pt = (r()<0.5?'Port Gate':'Apron Cam') + ' #' + (i+1) + ' · ' + name;
      cameras.push({
        id: `${code}-pt-${i.toString(36)}`,
        name: cname_pt,
        type:'port', _layer:'port', _kind:'camera',
        lat: la, lng: ln,
        city: name, state, country,
        agency: r()<0.5 ? 'Port Authority' : 'Airport Authority',
        source: 'Logistics CCTV',
        ...nearestWatchFields(la, ln, name, cname_pt),
        watchable: true
      });
    }
  });

  // ──────────────────────────────────────────────────────────
  // Rural / intercity highway corridor cams — global infill so
  // random country roads still have cams nearby.
  // ──────────────────────────────────────────────────────────
  const RURAL_COUNT = 100000;
  for (let i = 0; i < RURAL_COUNT; i++) {
    const c = CITIES[ri(CITIES.length)];
    const cLat = c[1], cLng = c[2];
    const deg = 0.2 + r() * 3.8; // 0.2°–4° tight rings for denser per-degree coverage
    const theta = r() * Math.PI * 2;
    const lat = cLat + deg * Math.cos(theta);
    const lng = cLng + deg * Math.sin(theta);
    if (Math.abs(lat) > 78) continue;
    const hwy = pick(HWY_PREFIX) + (ri(99)+1);
    const cname_rur = `${hwy} @ MP ${ri(950)+1}`;
    cameras.push({
      id: `rur-${i.toString(36)}`,
      name: cname_rur,
      type:'traffic', _layer:'traffic', _kind:'camera',
      lat, lng,
      city: 'Intercity Corridor · near ' + c[0],
      state: c[4],
      country: c[3],
      agency: c[5].split(' / ')[0] + ' · rural',
      source: 'Highway corridor cam',
      direction: pick(directions) + ' facing',
      resolution: pick(resolutions),
      ...nearestWatchFields(lat, lng, c[0], cname_rur),
      watchable: true,
      installed: 2018 + ri(8)
    });
  }

  // expose alternates lookup for UI's TRY ANOTHER button
  const _ovwAltExport = altStreams;

  // expose
  window.OVERWATCH_DATA = {
    altStreams: _ovwAltExport,
    cameras, flock, typeMeta,
    cities: CITIES.map(c => ({ name:c[0], lat:c[1], lng:c[2], country:c[3], state:c[4], code:c[12] })),
    stats: {
      cameras: cameras.length,
      flock: flock.length,
      total: cameras.length + flock.length,
      cities: CITIES.length
    }
  };
})();
