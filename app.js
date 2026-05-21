/* ════════════════════════════════════════════════════════════
   IberoFuel — App logic
   ════════════════════════════════════════════════════════════ */

// ────────── PROVINCIAS FALLBACK ──────────
const PROVINCIAS_FALLBACK = [
  {id:'1',name:'ÁLAVA'},{id:'2',name:'ALBACETE'},{id:'3',name:'ALICANTE/ALACANT'},
  {id:'4',name:'ALMERÍA'},{id:'5',name:'ÁVILA'},{id:'6',name:'BADAJOZ'},
  {id:'7',name:'BALEARS (ILLES)'},{id:'8',name:'BARCELONA'},{id:'9',name:'BURGOS'},
  {id:'10',name:'CÁCERES'},{id:'11',name:'CÁDIZ'},{id:'12',name:'CASTELLÓN/CASTELLÓ'},
  {id:'13',name:'CIUDAD REAL'},{id:'14',name:'CÓRDOBA'},{id:'15',name:'CORUÑA (A)'},
  {id:'16',name:'CUENCA'},{id:'17',name:'GIRONA'},{id:'18',name:'GRANADA'},
  {id:'19',name:'GUADALAJARA'},{id:'20',name:'GIPUZKOA'},{id:'21',name:'HUELVA'},
  {id:'22',name:'HUESCA'},{id:'23',name:'JAÉN'},{id:'24',name:'LEÓN'},
  {id:'25',name:'LLEIDA'},{id:'26',name:'RIOJA (LA)'},{id:'27',name:'LUGO'},
  {id:'28',name:'MADRID'},{id:'29',name:'MÁLAGA'},{id:'30',name:'MURCIA'},
  {id:'31',name:'NAVARRA'},{id:'32',name:'OURENSE'},{id:'33',name:'ASTURIAS'},
  {id:'34',name:'PALENCIA'},{id:'35',name:'PALMAS (LAS)'},{id:'36',name:'PONTEVEDRA'},
  {id:'37',name:'SALAMANCA'},{id:'38',name:'SANTA CRUZ DE TENERIFE'},{id:'39',name:'CANTABRIA'},
  {id:'40',name:'SEGOVIA'},{id:'41',name:'SEVILLA'},{id:'42',name:'SORIA'},
  {id:'43',name:'TARRAGONA'},{id:'44',name:'TERUEL'},{id:'45',name:'TOLEDO'},
  {id:'46',name:'VALENCIA/VALÈNCIA'},{id:'47',name:'VALLADOLID'},{id:'48',name:'BIZKAIA'},
  {id:'49',name:'ZAMORA'},{id:'50',name:'ZARAGOZA'},{id:'51',name:'CEUTA'},{id:'52',name:'MELILLA'},
];

// ────────── SUPABASE ──────────
const SUPABASE_URL  = 'https://gwycdrnwkzmoxbxcqxih.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eWNkcm53a3ptb3hieGNxeGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyNDEsImV4cCI6MjA5NDYxNDI0MX0.fTm-TesEgil6NjaiiCspZdjMCX6PxAclFhlPs6PNngc';
const sb = (window.supabase && typeof window.supabase.createClient === 'function')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

// ────────── API PROXY ──────────
const API_BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';
const CLIENT_CORS_PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];
let apiKnownOffline = false;

// ────────── PRECIOIL API ──────────
const PRECIOIL_BASE = 'https://api.precioil.es';
const PRECIOIL_KEY  = 'pk_live_ariw0DFEmwHiFTNlX8dZSBXDI3bNhyI-gysXv9XkNy4';

function poiToStation(s) {
  const c = v => (v != null && String(v).trim() !== '') ? String(v).replace('.', ',') : '';
  return {
    'IDEESS':                             String(s.idEstacion || ''),
    'Rótulo':                             s.nombreEstacion || s.marca || '',
    'Tipo Vía':                           '',
    'Dirección':                          s.direccion || '',
    'Municipio':                          s.localidad || '',
    'IDMunicipio':                        String(s.idMunicipio || ''),
    'IDProvincia':                        String(s.idProvincia || ''),
    'Provincia':                          s.provincia || '',
    'Latitud':                            c(s.latitud),
    'Longitud (WGS84)':                   c(s.longitud),
    'Precio Gasolina 95 E5':              c(s.Gasolina95),
    'Precio Gasolina 98 E5':              c(s.Gasolina98),
    'Precio Gasóleo A':                   c(s.Diesel),
    'Precio Gasóleo B':                   c(s.DieselB),
    'Precio Gasóleo Premium':             c(s.DieselPremium),
    'Precio Gases licuados del petróleo': c(s.GLP),
    'Precio Gas Natural Comprimido':      c(s.GNC),
    'Precio Gas Natural Licuado':         c(s.GNL),
    'Precio Hidrógeno':                   c(s.Hidrogeno),
    'Horario':                            s.horario || '',
    'Rem. Autoservicio':                  '',
    'Tipo Servicio':                      s.tipoVenta || '',
  };
}

async function fetchPrecioIL(path, timeoutMs = 8000) {
  // PrecioIL only supports municipality-level station queries
  const m = path.match(/^EstacionesTerrestres\/FiltroMunicipio\/(\d+)/);
  if (!m) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${PRECIOIL_BASE}/estaciones/municipio/${m[1]}`, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${PRECIOIL_KEY}` },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const arr = await r.json().catch(() => null);
    if (!Array.isArray(arr) || !arr.length) return null;
    return {
      ListaEESSPrecio: arr.map(poiToStation),
      Fecha: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      ResultadoConsulta: 'OK',
    };
  } catch { clearTimeout(t); return null; }
}

async function tryUrl(url, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok) return null;
    const text = await r.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch { clearTimeout(t); return null; }
}

// Try the Vercel /api/fuel proxy first (it has Supabase cache fallback baked-in).
// If we're not on Vercel (local file:// or github pages), it will just 404 and we fall through.
async function tryVercelProxy(path, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`/api/fuel?path=${encodeURIComponent(path)}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const xCache = r.headers.get('X-Cache');
    const xDate  = r.headers.get('X-Cache-Date');
    const data = await r.json().catch(() => null);
    if (!data) return null;
    if (xCache === 'stale' && xDate) showCacheBanner(xDate); else hideCacheBanner();
    return data;
  } catch { clearTimeout(t); return null; }
}

async function fetchAPI(fullUrl) {
  const path = fullUrl.replace(API_BASE, '').replace(/^\//, '');

  // 1. Vercel proxy (instant 404 on GitHub Pages, works on Vercel)
  const viaProxy = await tryVercelProxy(path, 5000);
  if (viaProxy) { apiKnownOffline = false; return viaProxy; }

  // 2. PrecioIL API — municipality searches (paid, has CORS, no province endpoint)
  const viaPrecioIL = await fetchPrecioIL(path);
  if (viaPrecioIL) { apiKnownOffline = false; hideCacheBanner(); return viaPrecioIL; }

  // 3. Direct MINETUR (blocked by CORS on GitHub Pages but worth a fast try)
  if (!apiKnownOffline) {
    const direct = await tryUrl(fullUrl, 3000);
    if (direct) { hideCacheBanner(); return direct; }
  }

  // 4. All CORS proxies in parallel — fastest one wins
  const proxyData = await Promise.any(
    CLIENT_CORS_PROXIES.map(mk =>
      tryUrl(mk(fullUrl), 8000).then(d => d ?? Promise.reject('null'))
    )
  ).catch(() => null);
  if (proxyData) { apiKnownOffline = false; hideCacheBanner(); return proxyData; }

  // 5. Supabase cache — direct client-side query as final fallback
  const cachedData = await trySupabaseCache(path);
  if (cachedData) return cachedData;

  apiKnownOffline = true;
  throw new Error('API_OFFLINE');
}

function showCacheBanner(dateStr) {
  let el = document.getElementById('cache-banner');
  if (el) return;
  el = document.createElement('div');
  el.id = 'cache-banner';
  el.style.cssText = 'margin:0 0 10px 0;padding:9px 14px;border-radius:10px;background:rgba(242,178,58,0.15);border:1px solid rgba(242,178,58,0.4);font-size:12px;color:#8a6a16;display:flex;align-items:center;gap:8px;';
  let fechaStr = '—';
  try {
    fechaStr = new Date(dateStr).toLocaleString('es-ES', {
      day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'
    });
  } catch {}
  el.innerHTML = `<span style="font-size:15px">🕐</span><span><b>Datos guardados</b> del ${fechaStr} — la API del Ministerio está temporalmente caída.</span>`;
  const scroll = document.getElementById('stations-scroll');
  if (scroll) scroll.prepend(el);
}

function hideCacheBanner() {
  document.getElementById('cache-banner')?.remove();
}

async function trySupabaseCache(path) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/minetur_cache?cache_key=eq.${encodeURIComponent(path)}&select=payload,updated_at&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    showCacheBanner(rows[0].updated_at);
    return rows[0].payload;
  } catch { return null; }
}

// ────────── HELPERS ──────────
function parseNum(v) {
  if (v === null || v === undefined || v === '') return NaN;
  return parseFloat(String(v).replace(',', '.'));
}
function getIdeess(s) {
  return String(s.IDEESS || s['IDEESS '] || (s.Dirección + '|' + s.Municipio + '|' + s.Rótulo));
}
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDateTime(iso) {
  return new Date(iso).toLocaleDateString('es-ES', {
    weekday:'long', day:'2-digit', month:'long',
    hour:'2-digit', minute:'2-digit'
  });
}
function haversine(lat1,lng1,lat2,lng2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function titleCase(str){
  if(!str) return '';
  return str.toLowerCase().split(/(\s|[\/\-])/g).map(w => w.length>2 ? w[0].toUpperCase()+w.slice(1) : w).join('');
}

// ────────── STATE ──────────
let currentUser = null;
let favorites = new Set();
let profileTab = 'historial';
let refuelTarget = null;
let alertTarget = null;
let tankEmptyTarget = null;
const favDataMap = new Map();

let allStations = [], filteredStations = [], provinciasData = [];
let autocompleteResults = [];
let autocompleteTimer = null;
let autocompleteCtrl = null;
let autocompleteHighlight = -1;
let activeFuel = 'gasolina95', sortMode = 'precio';
let mapInstance = null, markersLayer = null;
let selectedCard = null, userPos = null;
let currentTab = 'lista';
let searchOpen = true;
let authTab = 'login';
let tooltipOpen = false;

const FUEL_MAP = {
  gasolina95: { key: 'Precio Gasolina 95 E5',              label: 'Gasolina 95', short: '95'  },
  gasolina98: { key: 'Precio Gasolina 98 E5',              label: 'Gasolina 98', short: '98'  },
  gasoleoA:   { key: 'Precio Gasoleo A',                   label: 'Gasóleo A',   short: 'GA'  },
  gasoleoB:   { key: 'Precio Gasoleo B',                   label: 'Gasóleo B',   short: 'GB'  },
  glp:        { key: 'Precio Gases licuados del petróleo', label: 'GLP',         short: 'GLP' },
};

// ────────── GENERIC STATION LOGO (non-branded) ──────────
// We deliberately do NOT recreate copyrighted brand logos.
// Instead we generate a clean initials badge with a deterministic color
// derived from the station name, so each brand gets a consistent look.
function getBrandLogo(name) {
  const safe = (name || 'Gasolinera').trim();
  // Take up to 3 letters of first word (or initials of first two words)
  const words = safe.split(/\s+/);
  let initials;
  if (words.length >= 2 && words[0].length <= 4) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else {
    initials = words[0].substring(0, 3).toUpperCase();
  }
  // Hash → deterministic hue in a calming green/teal/blue range
  let h = 0;
  for (const ch of safe.toUpperCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // Bias toward greens / muted earth tones
  const hue = 120 + (h % 100) - 50; // 70..170 (green-teal-blue)
  const sat = 35 + (h % 20);
  const lit = 38 + (h % 8);
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
    <rect width="40" height="40" rx="10" fill="hsl(${hue},${sat}%,${lit}%)"/>
    <text x="20" y="26" font-family="'Plus Jakarta Sans',sans-serif" font-size="${initials.length === 3 ? 12 : 14}" font-weight="900" fill="white" text-anchor="middle" letter-spacing="0.3">${initials}</text>
  </svg>`;
}

// ────────── NAV BUTTONS ──────────
function buildNavHTML(lat, lng, name) {
  if (isNaN(lat) || isNaN(lng)) return '';
  const enc = encodeURIComponent(name || 'Gasolinera');
  return `<div class="popup-nav">
    <div class="popup-nav-label">Cómo llegar</div>
    <div class="popup-nav-btns">
      <a class="nav-btn waze"  href="https://waze.com/ul?ll=${lat},${lng}&navigate=yes" target="_blank" rel="noopener">Waze</a>
      <a class="nav-btn gmaps" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_name=${enc}&travelmode=driving" target="_blank" rel="noopener">Google</a>
      <a class="nav-btn apple" href="https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d" target="_blank" rel="noopener">Apple</a>
    </div>
  </div>`;
}

// ────────── MAP ──────────
function initMap() {
  if (typeof L === 'undefined') { console.warn('Leaflet not loaded'); return; }
  mapInstance = L.map('map', { zoomControl: true }).setView([40.416, -3.703], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(mapInstance);
  markersLayer = L.layerGroup().addTo(mapInstance);
  setTimeout(() => mapInstance.invalidateSize(), 200);
}

function makeIcon(level) {
  const cols = { cheap:'#1E6B4B', avg:'#2E8B57', expensive:'#C8443A', default:'#8A8A8A' };
  const c = cols[level] || cols.default;
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c};border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.20)"></div>`,
    iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-34],
  });
}

// ────────── PROVINCIAS ──────────
function poblarProvincias(list) {
  const sel = document.getElementById('sel-prov');
  sel.innerHTML = '<option value="">Provincia</option>';
  provinciasData = [];
  list.forEach(p => {
    const id   = p.id   || p.IDPovincia || p.IDProvincia;
    const name = p.name || p.Provincia;
    if (!id || !name) return;
    provinciasData.push({ id, name });
    sel.appendChild(new Option(titleCase(name), id));
  });
}

async function loadProvincias() {
  // Always populate from fallback first so the UI is instantly usable
  let fromCache = false;
  try {
    const cached = localStorage.getItem('iberofuel_provincias_v2');
    if (cached) {
      const p = JSON.parse(cached);
      if (p && p.length) { poblarProvincias(p); fromCache = true; }
    }
  } catch (_) {}
  if (!fromCache) poblarProvincias(PROVINCIAS_FALLBACK);

  // Background refresh from API
  try {
    const data = await fetchAPI(`${API_BASE}/Listados/Provincias/`);
    const list = Array.isArray(data) ? data : (data.Provincias || data.ListaProvincias || []);
    if (list.length) {
      const normalized = list.map(p => ({
        id: p.IDPovincia || p.IDProvincia || p.id,
        name: p.Provincia || p.name
      })).filter(p => p.id && p.name);
      try { localStorage.setItem('iberofuel_provincias_v2', JSON.stringify(normalized)); } catch(_) {}
      poblarProvincias(normalized);
    }
  } catch (_) {
    // silently keep fallback
  }
}

async function onProvinciaChange() {
  const idProv = document.getElementById('sel-prov').value;
  const selMun = document.getElementById('sel-mun');
  selMun.disabled = true;
  selMun.innerHTML = '<option>Cargando…</option>';
  if (!idProv) { selMun.innerHTML = '<option value="">Municipio</option>'; selMun.disabled = false; return; }
  try {
    const data = await fetchAPI(`${API_BASE}/Listados/MunicipiosPorProvincia/${idProv}`);
    const list = Array.isArray(data) ? data : (data.Municipios || data.ListaMunicipios || []);
    selMun.innerHTML = '<option value="">Municipio</option>';
    list.forEach(m => selMun.appendChild(new Option(titleCase(m.Municipio), m.IDMunicipio)));
    selMun.disabled = false;
    Pepe.say('¡Bien! Ahora elige tu municipio y te enseño las gasolineras 🐽', 'happy');
  } catch(e) {
    selMun.innerHTML = '<option value="">No disponible — reintenta</option>';
    selMun.disabled = false;
  }
}

let _lastSearch = null;
function retryLastSearch() { if (_lastSearch) _lastSearch(); }

async function buscarPorMunicipio() {
  const idMun = document.getElementById('sel-mun').value;
  if (!idMun) {
    Pepe.say('Eh, elige primero un municipio 🗺️', 'thinking');
    return;
  }
  _lastSearch = buscarPorMunicipio;
  Pepe.say('Olfateando precios… esto es lo mío 🐽', 'thinking');
  showLoading('Buscando gasolineras…');
  try {
    const data = await fetchAPI(`${API_BASE}/EstacionesTerrestres/FiltroMunicipio/${idMun}`);
    if (!data || !data.ListaEESSPrecio) throw new Error('Sin datos');
    processStations(data.ListaEESSPrecio);
    if (searchOpen) toggleSearch();
    if (isMobile()) switchTab('lista');
  } catch(e) {
    showError(e.message);
  }
}

async function buscarPorCoords(lat, lng, displayName) {
  _lastSearch = () => buscarPorCoords(lat, lng, displayName);
  userPos = { lat, lng };
  if (mapInstance) mapInstance.setView([lat, lng], 12);
  showLoading('Buscando en ' + displayName + '…');
  Pepe.say('Buscando gasolineras en ' + displayName + '… 🐽', 'thinking');
  try {
    const result = await getIdProvinciaDesdeCoords(lat, lng);
    if (!result) throw new Error('No pude identificar la provincia. Prueba con el selector de provincia.');
    const data = await fetchAPI(`${API_BASE}/EstacionesTerrestresFiltros/FiltroProvincia/${result.id}`);
    if (!data || !data.ListaEESSPrecio) throw new Error('Sin datos de la API');
    processStations(data.ListaEESSPrecio);
    showLocationStatus(result.cityName || displayName);
    if (isMobile()) switchTab('lista');
  } catch(e) {
    showError(e.message);
  }
}

async function buscarPorTexto() {
  const q = (document.getElementById('search-text')?.value || '').trim();
  if (!q) {
    Pepe.say('Escribe una ciudad o municipio y pulsa buscar 🔍', 'thinking');
    return;
  }
  hideAutocomplete();
  _lastSearch = buscarPorTexto;
  showLoading('Buscando «' + q + '»…');
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=es&limit=1&accept-language=es`,
      { headers: { Accept: 'application/json' } }
    );
    const results = await r.json();
    if (!results || !results.length) throw new Error('No encontré «' + q + '» en España. Prueba con otra ciudad.');
    const name = results[0].display_name.split(',')[0].trim();
    await buscarPorCoords(parseFloat(results[0].lat), parseFloat(results[0].lon), name);
  } catch(e) {
    showError(e.message);
  }
}

function onSearchTextInput(val) {
  clearTimeout(autocompleteTimer);
  autocompleteCtrl?.abort();
  const q = val.trim();
  if (q.length < 2) { hideAutocomplete(); return; }
  autocompleteTimer = setTimeout(async () => {
    autocompleteCtrl = new AbortController();
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=es&limit=6&accept-language=es`,
        { headers: { Accept: 'application/json' }, signal: autocompleteCtrl.signal }
      );
      if (!r.ok) return;
      const results = await r.json();
      if (!results.length) { hideAutocomplete(); return; }
      autocompleteResults = results;
      showAutocomplete(results);
    } catch(e) {
      if (e.name !== 'AbortError') hideAutocomplete();
    }
  }, 320);
}

function onSearchTextKeydown(e) {
  const el = document.getElementById('search-suggestions');
  const visible = el && el.style.display !== 'none';
  if (e.key === 'Enter') {
    if (visible && autocompleteHighlight >= 0) {
      e.preventDefault();
      selectSuggestion(autocompleteHighlight);
    } else {
      buscarPorTexto();
    }
    return;
  }
  if (!visible) return;
  const items = el.querySelectorAll('.search-suggestion');
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setAutocompleteHighlight((autocompleteHighlight + 1) % items.length, items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setAutocompleteHighlight((autocompleteHighlight - 1 + items.length) % items.length, items);
  } else if (e.key === 'Escape') {
    hideAutocomplete();
  }
}

function setAutocompleteHighlight(idx, items) {
  items.forEach((item, i) => item.classList.toggle('highlighted', i === idx));
  autocompleteHighlight = idx;
  const r = autocompleteResults[idx];
  if (r) {
    const input = document.getElementById('search-text');
    if (input) input.value = r.display_name.split(',')[0].trim();
  }
}

function showAutocomplete(results) {
  autocompleteHighlight = -1;
  let el = document.getElementById('search-suggestions');
  if (!el) {
    el = document.createElement('div');
    el.id = 'search-suggestions';
    el.className = 'search-suggestions';
    const wrap = document.querySelector('.search-input-wrap');
    if (!wrap) return;
    wrap.appendChild(el);
  }
  el.innerHTML = results.map((r, i) => {
    const parts = r.display_name.split(',');
    const name = parts[0].trim();
    const region = parts.slice(1, 3).map(s => s.trim()).filter(s => s && s !== 'España').join(', ');
    return `<div class="search-suggestion" onmousedown="selectSuggestion(${i})">
      <svg class="suggestion-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <span class="suggestion-name">${escHtml(name)}</span>
      ${region ? `<span class="suggestion-region">${escHtml(region)}</span>` : ''}
    </div>`;
  }).join('');
  el.style.display = 'block';
}

function hideAutocomplete() {
  autocompleteHighlight = -1;
  const el = document.getElementById('search-suggestions');
  if (el) el.style.display = 'none';
}

function selectSuggestion(i) {
  autocompleteHighlight = -1;
  const r = autocompleteResults[i];
  if (!r) return;
  const name = r.display_name.split(',')[0].trim();
  const input = document.getElementById('search-text');
  if (input) input.value = name;
  hideAutocomplete();
  buscarPorCoords(parseFloat(r.lat), parseFloat(r.lon), name);
}

async function usarMiUbicacion() {
  if (!navigator.geolocation) {
    Pepe.say('Tu navegador no soporta geolocalización 😕', 'thinking');
    showError('Tu navegador no soporta geolocalización. Prueba a buscar por provincia o municipio.');
    return;
  }
  // Requires HTTPS (or localhost). Some browsers silently fail otherwise.
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showError('La ubicación solo funciona en HTTPS. Abre la web por https:// o usa la búsqueda manual.');
    return;
  }
  const btn = document.getElementById('locate-btn');
  btn.disabled = true; btn.classList.add('searching');

  // Pre-flight: check permission state so we can guide the user clearly if blocked.
  // Without this, a denied state just throws code-1 with no actionable info.
  let permState = 'prompt';
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      permState = result.state; // 'granted' | 'prompt' | 'denied'
    } catch(_) { /* some browsers reject; treat as 'prompt' */ }
  }

  if (permState === 'denied') {
    btn.disabled = false; btn.classList.remove('searching');
    Pepe.say('La ubicación está bloqueada para esta web 🔒', 'thinking', 7000);
    const ua = navigator.userAgent;
    const isAndroidChrome = /Android/i.test(ua) && /Chrome/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    let how;
    if (isAndroidChrome) {
      how = 'Toca el candado 🔒 a la izquierda de la URL → Permisos → Ubicación → cambia a Permitir. Después recarga la página.';
    } else if (isIOS) {
      how = 'En Ajustes → Safari (o Chrome) → Ubicación: cambia a "Permitir". Después recarga la página.';
    } else {
      how = 'Pulsa el icono 🔒 o ⓘ junto a la URL → Permisos → Ubicación → Permitir. Después recarga.';
    }
    showError('Has bloqueado la ubicación para esta web. ' + how);
    return;
  }

  Pepe.say('Buscando dónde estás… un momentito 📍', 'thinking');
  showLoading('Detectando tu posición…');

  async function procesarPosicion(pos) {
    userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (mapInstance) mapInstance.setView([userPos.lat, userPos.lng], 13);
    showLoading('Identificando tu provincia…');
    try {
      const result = await getIdProvinciaDesdeCoords(userPos.lat, userPos.lng);
      if (!result) throw new Error(`No pude identificar tu provincia automáticamente (lat ${userPos.lat.toFixed(3)}, lng ${userPos.lng.toFixed(3)}). Búscala manualmente arriba.`);
      showLoading('Buscando gasolineras cerca…');
      _lastSearch = usarMiUbicacion;
      const data = await fetchAPI(`${API_BASE}/EstacionesTerrestresFiltros/FiltroProvincia/${result.id}`);
      if (!data || !data.ListaEESSPrecio) throw new Error('Sin datos de la API');
      const nearby = data.ListaEESSPrecio.filter(s => {
        const lat = parseFloat((s.Latitud || '').replace(',','.'));
        const lng = parseFloat((s['Longitud (WGS84)'] || s.Longitud || '').replace(',','.'));
        return !isNaN(lat) && !isNaN(lng) && haversine(userPos.lat, userPos.lng, lat, lng) <= 15;
      });
      if (!nearby.length) throw new Error('No hay gasolineras en un radio de 15 km');
      processStations(nearby);
      showLocationStatus(result.cityName);
      if (isMobile()) switchTab('lista');
    } catch(e) {
      showError(e.message);
    } finally {
      btn.disabled = false; btn.classList.remove('searching');
    }
  }

  function manejarErrorGeo(err, esReintento) {
    if (err.code === 3 && !esReintento) {
      // Timeout con alta precisión → reintentar con red (más rápido y fiable)
      Pepe.say('Tardó demasiado con GPS, reintentando con red… 📶', 'thinking');
      showLoading('Reintentando con localización por red…');
      navigator.geolocation.getCurrentPosition(
        procesarPosicion,
        function(err2) { manejarErrorGeo(err2, true); },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      );
      return;
    }
    btn.disabled = false; btn.classList.remove('searching');
    const ua = navigator.userAgent;
    const isAndroidChrome = /Android/i.test(ua) && /Chrome/i.test(ua);
    let msg = 'No pude obtener tu ubicación. Intenta de nuevo o busca por provincia.';
    if (err.code === 1) {
      msg = isAndroidChrome
        ? 'Has bloqueado la ubicación. Toca el candado 🔒 junto a la URL → Permisos → Ubicación → Permitir, y recarga.'
        : 'Permiso denegado. Activa el acceso a la ubicación en tu navegador y recarga.';
    }
    if (err.code === 2) msg = 'No se puede determinar tu posición. Asegúrate de tener la ubicación activada en el sistema (ajustes del móvil → Ubicación) y vuelve a intentarlo.';
    if (err.code === 3) msg = 'Tiempo de espera agotado. Sal al exterior o conéctate a WiFi y vuelve a intentarlo. Si sigue sin funcionar, busca por provincia.';
    showError(msg);
  }

  // Primero intentamos sin alta precisión: usa WiFi/red, es más rápido y funciona en interior.
  // Es más que suficiente para detectar la provincia.
  navigator.geolocation.getCurrentPosition(
    procesarPosicion,
    function(err) { manejarErrorGeo(err, false); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
  );
}

// Bilingual aliases — Nominatim may return either the regional form ("Bizkaia",
// "A Coruña") or the Spanish form ("Vizcaya", "La Coruña"). The Ministerio uses
// the OFFICIAL form (mostly the regional one). Map every variant to a single
// canonical key so both sides normalize to the same string.
const PROVINCE_ALIASES = {
  // Vizcaya / Bizkaia  → 'bizkaia' (Ministerio: BIZKAIA)
  'vizcaya': 'bizkaia',
  // Guipúzcoa / Gipuzkoa → 'gipuzkoa'
  'guipuzcoa': 'gipuzkoa',
  // Álava / Araba → 'alava' (Ministerio: ÁLAVA)
  'araba': 'alava',
  'araba alava': 'alava',
  // A Coruña / La Coruña → 'coruna' (Ministerio: CORUÑA (A) → 'coruna a')
  'a coruna': 'coruna',
  'coruna a': 'coruna',
  // Ourense / Orense → 'ourense'
  'orense': 'ourense',
  // Lleida / Lérida → 'lleida'
  'lerida': 'lleida',
  // Girona / Gerona → 'girona'
  'gerona': 'girona',
  // Baleares / Balears → 'balears' (Ministerio: BALEARS (ILLES) → 'balears illes')
  'balears illes': 'balears',
  'illes balears': 'balears',
  'baleares': 'balears',
  'islas baleares': 'balears',
  // Castellón / Castelló → 'castellon' (Ministerio: CASTELLÓN/CASTELLÓ → 'castellon castello')
  'castellon castello': 'castellon',
  'castello': 'castellon',
  // Alicante / Alacant → 'alicante' (Ministerio: ALICANTE/ALACANT → 'alicante alacant')
  'alicante alacant': 'alicante',
  'alacant': 'alicante',
  // Valencia / València → 'valencia' (Ministerio: 'valencia valencia')
  'valencia valencia': 'valencia',
  // Asturias variants
  'asturies': 'asturias',
  'principado asturias': 'asturias',
  'principat asturies': 'asturias',
  // CCAA → provincia (when Nominatim only returns the autonomous community)
  'comunidad madrid': 'madrid',
  'comunitat madrid': 'madrid',
  'comunidad foral navarra': 'navarra',
  'comunitat foral navarra': 'navarra',
  'region murcia': 'murcia',
  // Las Palmas (Ministerio: PALMAS (LAS) → 'palmas')
  'las palmas': 'palmas',
  'palmas gran canaria': 'palmas',
};

function normProv(s){
  let v = (s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')   // strip diacritics
    .replace(/\b(provincia|provincie|comunidad|comunitat|region|regiao|autonoma|autonoma)\b/g,'')
    .replace(/\bde\b|\bdel\b|\bla\b|\bles\b|\blos\b|\blas\b/g,'')
    .replace(/[\/\-,]/g,' ')
    .replace(/\s+/g,' ').trim();
  // Resolve alias if any
  if (PROVINCE_ALIASES[v]) v = PROVINCE_ALIASES[v];
  return v;
}

// Fallback reverse-geocoder. BigDataCloud is free and has no rate limit for the
// client-side endpoint, and returns Spanish admin levels reliably.
async function reverseGeoBigDataCloud(lat, lng) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`,
      { signal: ctrl.signal }
    );
    const d = await r.json();
    // localityInfo.administrative contains an ordered list of admin divisions.
    // For Spain: order 4 = comunidad autónoma, order 6 = provincia, order 8 = municipio.
    const admins = (d.localityInfo && d.localityInfo.administrative) || [];
    const candidates = [];
    // Province first (order 6), then any other admin level as fallback
    const province = admins.find(a => a.order === 6 || a.adminLevel === 6);
    if (province) candidates.push(province.name);
    // Also include principalSubdivision (CCAA) as fallback
    if (d.principalSubdivision) candidates.push(d.principalSubdivision);
    admins.forEach(a => a.name && candidates.push(a.name));
    const cityName = d.city || d.locality || d.localityInfo?.informative?.[0]?.name || '';
    return { candidates, cityName };
  } catch(e) {
    console.warn('[BigDataCloud reverse-geo failed]', e);
    return { candidates: [], cityName: '' };
  } finally {
    clearTimeout(t);
  }
}

async function getIdProvinciaDesdeCoords(lat, lng) {
  // Helper: try matching a list of candidate strings against provinciasData
  const tryMatch = (candidates, cityName) => {
    for (const c of candidates) {
      if (!c) continue;
      const nc = normProv(c);
      if (!nc) continue;
      const found = provinciasData.find(p => {
        const np = normProv(p.name);
        return np === nc || nc.includes(np) || np.includes(nc);
      });
      if (found) return { id: found.id, cityName };
    }
    return null;
  };

  // 1) Try Nominatim first
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  let nominatimCandidates = [];
  let nominatimCity = '';
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=es&zoom=10`,
      { signal: ctrl.signal }
    );
    if (r.ok) {
      const d = await r.json();
      const addr = d.address || {};
      nominatimCity = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
      nominatimCandidates = [addr.province, addr.state_district, addr.state, addr.county, addr.region].filter(Boolean);
    } else {
      console.warn('[Nominatim] HTTP', r.status);
    }
  } catch(e) {
    console.warn('[Nominatim failed]', e);
  } finally {
    clearTimeout(t);
  }
  let match = tryMatch(nominatimCandidates, nominatimCity);
  if (match) return match;

  // 2) Fallback to BigDataCloud (no rate limits, works when Nominatim is down or rate-limited)
  console.info('[reverse-geo] Nominatim did not resolve a province, falling back to BigDataCloud…');
  const bdc = await reverseGeoBigDataCloud(lat, lng);
  match = tryMatch(bdc.candidates, bdc.cityName || nominatimCity);
  if (match) return match;

  // 3) Total failure — log diagnostic info for debugging
  console.error('[reverse-geo] Could not match any province from these candidates:', {
    nominatim: nominatimCandidates,
    bigDataCloud: bdc.candidates,
    knownProvinces: provinciasData.map(p => p.name).slice(0,5) + '…'
  });
  return null;
}

// ────────── PROCESS & RENDER ──────────
function processStations(raw) {
  allStations = raw.map(s => {
    const lat = parseFloat((s.Latitud || '').replace(',','.'));
    const lng = parseFloat((s['Longitud (WGS84)'] || s.Longitud || '').replace(',','.'));
    const dist = (userPos && !isNaN(lat) && !isNaN(lng))
      ? haversine(userPos.lat, userPos.lng, lat, lng) : null;
    const prices = {};
    Object.entries(FUEL_MAP).forEach(([k,v]) => {
      const val = s[v.key] ?? s[v.key.replace('Gasoleo', 'Gasóleo')];
      prices[k] = (val && val !== '') ? parseFloat(String(val).replace(',','.')) : null;
    });
    return { ...s, lat, lng, dist, prices };
  });
  sortMode = 'precio';
  document.querySelectorAll('.sort-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  renderAll();
  document.getElementById('stats-bar').classList.add('visible');
  document.getElementById('filter-bar').classList.add('visible');
  document.getElementById('fuel-filter')?.classList.remove('chips-collapsed');
  if (!currentUser) document.getElementById('upsell-banner').classList.add('visible');
  // Pepe celebrates
  const prices = filteredStations.map(s => s.prices[activeFuel]).filter(Boolean);
  if (prices.length) {
    const minP = Math.min(...prices), maxP = Math.max(...prices);
    const saving = ((maxP - minP) * 50).toFixed(2);
    Pepe.say(`¡Encontré <b>${filteredStations.length}</b> gasolineras! 🎉<br>Eligiendo bien ahorras hasta <b>${saving}€</b> en un depósito de 50L.`, 'happy', 8000);
    // 🎉 Juicy confetti
    if (window.Juice) Juice.confetti(70);
  } else {
    Pepe.say('No veo precios de este combustible aquí. Prueba con otro 👀', 'thinking', 6000);
  }
}

function renderAll() {
  filteredStations = allStations
    .filter(s => s.prices[activeFuel] !== null)
    .sort((a,b) => {
      if (sortMode === 'precio')    return (a.prices[activeFuel] || 99) - (b.prices[activeFuel] || 99);
      if (sortMode === 'distancia') return (a.dist ?? 999) - (b.dist ?? 999);
      return 0;
    });
  updateStats();
  renderList();
  renderMarkers();
}

function updateStats() {
  const prices = filteredStations.map(s => s.prices[activeFuel]).filter(Boolean);
  document.getElementById('stat-total').textContent = filteredStations.length;
  document.getElementById('stat-min').textContent   = prices.length ? Math.min(...prices).toFixed(3) : '—';
  document.getElementById('stat-avg').textContent   = prices.length ? (prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(3) : '—';
  document.getElementById('stat-max').textContent   = prices.length ? Math.max(...prices).toFixed(3) : '—';
}

function getPriceClass(price, min, max) {
  if (!price) return 'default';
  const mid = (min + max) / 2;
  if (price <= min + (mid - min) * 0.4) return 'cheap';
  if (price >= max - (max - mid) * 0.4) return 'expensive';
  return 'avg';
}

function renderList() {
  const scroll = document.getElementById('stations-scroll');
  if (!filteredStations.length) {
    scroll.innerHTML = `<div class="state-panel">
      <div class="state-icon-box">🔍</div>
      <div class="state-title">Sin resultados</div>
      <div class="state-sub">No hay datos de ${FUEL_MAP[activeFuel].label} en esta zona.</div>
    </div>`;
    return;
  }
  const prices = filteredStations.map(s => s.prices[activeFuel]).filter(Boolean);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const frag = document.createDocumentFragment();

  filteredStations.forEach((s, i) => {
    const price = s.prices[activeFuel];
    const cls   = getPriceClass(price, minP, maxP);
    const saving = (price - minP).toFixed(3);
    const topBadge = sortMode === 'distancia' ? '📍 Más cercana' : '🏆 La elegida de Pepe';
    let savingBadge;
    if (sortMode === 'distancia') {
      const minDist = filteredStations[0]?.dist ?? null;
      if (i === 0) {
        savingBadge = '<div class="badge-pill badge-winner">📍 La más cercana</div>';
      } else if (s.dist !== null && minDist !== null) {
        savingBadge = `<div class="badge-pill badge-saving">+ ${(s.dist - minDist).toFixed(1)} km</div>`;
      } else {
        savingBadge = '';
      }
    } else {
      savingBadge = i === 0
        ? '<div class="badge-pill badge-winner">⭐ La más barata</div>'
        : `<div class="badge-pill badge-saving">+ ${saving} €/L</div>`;
    }

    const otherPrices = Object.entries(FUEL_MAP)
      .filter(([k]) => k !== activeFuel && s.prices[k])
      .map(([k,v]) => `<div class="fuel-pill"><span class="fuel-pill-tag">${escHtml(v.short)}</span>${s.prices[k]?.toFixed(3)} €</div>`)
      .join('');

    const ideess = getIdeess(s);
    const isFav  = favorites.has(ideess);
    const distStr = s.dist !== null
      ? `<span class="station-dist">⊙ ${s.dist.toFixed(1)} km</span><span class="meta-dot"></span>` : '';

    const loggedBtns = currentUser
      ? `<div class="card-action-row">
           <button class="btn-refuel-card" data-idx="${i}" onclick="event.stopPropagation();openRefuelModal(parseInt(this.dataset.idx))">⛽ Repostar</button>
           <button class="btn-alert-card"  data-idx="${i}" onclick="event.stopPropagation();openAlertModal(parseInt(this.dataset.idx))" aria-label="Alerta de precio">🔔</button>
           <button class="fav-btn ${isFav?'saved':''}" data-idx="${i}" onclick="event.stopPropagation();toggleFavorite(parseInt(this.dataset.idx),this)" aria-label="Favorito">${isFav?'★':'☆'}</button>
         </div>`
      : `<button class="fav-btn" onclick="event.stopPropagation();openAuthModal()" title="Inicia sesión para guardar favoritas" aria-label="Iniciar sesión">☆</button>`;

    const isFirst = i === 0;
    const card = document.createElement('div');
    card.className = 'station-card' + (isFirst ? ' has-winner-band' : '') + (isFirst ? ' is-winner' : '');
    card.id = `card-${i}`;
    card.style.animationDelay = `${Math.min(i * 0.04, 0.32)}s`;
    card.setAttribute('data-idx', i);
    card.onclick = function(){ selectStation(parseInt(this.dataset.idx)); };

    card.innerHTML = `
      ${isFirst ? `<div class="winner-band">${topBadge}</div>` : ''}
      <div class="card-body">
        <div class="brand-logo">${getBrandLogo(s.Rótulo)}</div>
        <div class="card-info">
          <div class="station-name">${escHtml(titleCase(s.Rótulo) || 'Gasolinera')}</div>
          <div class="station-meta">${distStr}<span class="station-city">${escHtml(titleCase(s.Municipio) || '')}</span></div>
          <div class="station-address">📍 ${escHtml(titleCase(s.Dirección) || '')}</div>
        </div>
        <div class="card-right">
          <div class="price-${cls}">
            <div class="price-display">
              <span class="price-val">${price?.toFixed(3)}</span>
              <span class="price-unit">€/L</span>
            </div>
          </div>
          ${savingBadge}
          ${loggedBtns}
        </div>
      </div>
      ${otherPrices ? `<div class="card-footer">${otherPrices}</div>` : ''}
    `;
    frag.appendChild(card);
  });

  scroll.innerHTML = '';
  scroll.appendChild(frag);
  scroll.scrollTop = 0;

  // ─── Winner price "slot machine" effect ─────────────────────
  // Animate the cheapest station's price from a teaser (9.999) down to real value,
  // synced with the winner-arrive bounce. Only on the *first* fresh render.
  const winnerPriceEl = scroll.querySelector('.station-card.is-winner .price-val');
  if (winnerPriceEl && !winnerPriceEl.dataset.animated) {
    const target = parseFloat(winnerPriceEl.textContent.replace(',', '.'));
    if (!isNaN(target) && target > 0) {
      winnerPriceEl.dataset.animated = '1';
      const start = Math.max(target + 0.4, 2.000);
      const t0 = performance.now() + 350;
      const duration = 900;
      const tick = (now) => {
        const elapsed = now - t0;
        if (elapsed < 0) { winnerPriceEl.textContent = start.toFixed(3); requestAnimationFrame(tick); return; }
        const p = Math.min(1, elapsed / duration);
        // ease-out quart for "settling" feel
        const eased = 1 - Math.pow(1 - p, 4);
        const v = start - (start - target) * eased;
        winnerPriceEl.textContent = v.toFixed(3);
        if (p < 1) requestAnimationFrame(tick);
        else winnerPriceEl.textContent = target.toFixed(3);
      };
      requestAnimationFrame(tick);
    }
  }
}

function renderMarkers() {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  if (userPos) {
    L.marker([userPos.lat, userPos.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="width:20px;height:20px;border-radius:50%;background:#1E6B4B;border:3px solid white;box-shadow:0 0 0 6px rgba(30,107,75,0.18)"></div>',
        iconSize:[20,20], iconAnchor:[10,10]
      })
    }).addTo(markersLayer).bindPopup('📍 Estás aquí');
  }
  const prices = filteredStations.map(s => s.prices[activeFuel]).filter(Boolean);
  if (!prices.length) return;
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const bounds = [];
  filteredStations.forEach((s, i) => {
    if (isNaN(s.lat) || isNaN(s.lng)) return;
    const cls = getPriceClass(s.prices[activeFuel], minP, maxP);
    const marker = L.marker([s.lat, s.lng], { icon: makeIcon(cls) });
    const rows = Object.entries(FUEL_MAP)
      .filter(([k]) => s.prices[k])
      .map(([k,v]) => `<div class="popup-price-row"><span class="popup-fuel-name">${v.label}</span><span class="popup-fuel-price">${s.prices[k]?.toFixed(3)} €</span></div>`)
      .join('');
    marker.bindPopup(`
      <div class="popup-header">
        <div class="popup-brand">${escHtml(titleCase(s.Rótulo) || 'Gasolinera')}</div>
        <div class="popup-addr">${escHtml(titleCase(s.Dirección) || '')} · ${escHtml(titleCase(s.Municipio) || '')}</div>
      </div>
      <div class="popup-prices">${rows}</div>
      ${buildNavHTML(s.lat, s.lng, s.Rótulo)}
    `, { maxWidth: 280 });
    marker.on('click', () => selectStation(i, false));
    marker.addTo(markersLayer);
    s._marker = marker;
    bounds.push([s.lat, s.lng]);
  });
  if (bounds.length) {
    mapInstance.fitBounds(bounds, { padding:[40,40], maxZoom: userPos ? 14 : 18 });
  }
}

function selectStation(i, scrollToCard=true) {
  if (selectedCard) selectedCard.classList.remove('selected');
  const card = document.getElementById(`card-${i}`);
  if (card) {
    card.classList.add('selected');
    selectedCard = card;
    if (scrollToCard) card.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
  const s = filteredStations[i];
  if (!s || isNaN(s.lat) || isNaN(s.lng)) return;
  if (isMobile() && currentTab !== 'mapa') switchTab('mapa');
  const delay = (isMobile() && currentTab !== 'mapa') ? 150 : 40;
  setTimeout(() => {
    if (!mapInstance) return;
    mapInstance.invalidateSize();
    mapInstance.setView([s.lat, s.lng], 15, { animate: true });
    if (s._marker) s._marker.openPopup();
  }, delay);
}

// ────────── LOCATION STATUS ──────────
function showLocationStatus(city) {
  if (searchOpen) toggleSearch();
  const status = document.getElementById('location-status');
  status.style.display = 'flex';
  document.getElementById('location-city').textContent = city || 'Tu ubicación';
  document.getElementById('location-fuel-label').textContent = FUEL_MAP[activeFuel]?.label || '';
}

function resetLocation() {
  allStations = [];
  filteredStations = [];
  userPos = null;
  const btn = document.getElementById('locate-btn');
  if (btn) { btn.disabled = false; btn.classList.remove('searching'); }
  document.getElementById('location-status').style.display = 'none';
  if (!searchOpen) toggleSearch();
  document.getElementById('stats-bar').classList.remove('visible');
  document.getElementById('filter-bar')?.classList.remove('visible');
  document.getElementById('upsell-banner')?.classList.remove('visible');
  hideCacheBanner();
  if (markersLayer) markersLayer.clearLayers();
  document.getElementById('stations-scroll').innerHTML = `
    <div class="state-panel">
      <div class="state-icon-box" style="width:104px;height:104px;border-radius:28px;background:linear-gradient(145deg,#fff,var(--green-pale));border-color:var(--border-g);font-size:48px;color:var(--green-1)">⛽</div>
      <div class="state-title">Listo para ahorrar</div>
      <div class="state-sub">Usa <b style="color:var(--green-1)">Ubicarme</b> o selecciona provincia y municipio.</div>
    </div>`;
}

// ────────── FILTROS / ORDEN ──────────
function toggleFuel(el) {
  const chipsEl = document.getElementById('fuel-filter');
  // Collapsed + tapping active chip → re-expand all
  if (chipsEl?.classList.contains('chips-collapsed') && el.classList.contains('active')) {
    chipsEl.classList.remove('chips-collapsed');
    return;
  }
  document.querySelectorAll('.fuel-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activeFuel = el.dataset.fuel;
  const fuelLabel = document.getElementById('location-fuel-label');
  if (fuelLabel) fuelLabel.textContent = FUEL_MAP[activeFuel]?.label || '';
  if (allStations.length) renderAll();
  // Collapse non-active chips after brief pause
  setTimeout(() => chipsEl?.classList.add('chips-collapsed'), 550);
}
function setSortMode(mode, btn) {
  sortMode = mode;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (allStations.length) renderAll();
}

// ────────── LOADING / ERROR ──────────
function showLoading(msg='Buscando gasolineras…') {
  document.getElementById('stations-scroll').innerHTML = `
    <div class="state-panel">
      <div class="spinner"></div>
      <div class="state-title" style="font-size:15px;margin-top:6px">${escHtml(msg)}</div>
    </div>`;
}
function showError(msg) {
  const offline = msg === 'API_OFFLINE' || msg.includes('API_OFFLINE');
  Pepe.say(offline ? 'La API del Ministerio está caída ahora mismo. Pero volveré a intentarlo 🔧' : msg, 'thinking', 6000);
  if (offline) {
    document.getElementById('stations-scroll').innerHTML = `
      <div class="state-panel">
        <div class="state-icon-box">🔧</div>
        <div class="state-title">API temporalmente caída</div>
        <div class="state-sub">El servicio del Ministerio está temporalmente no disponible. Reintentalo en unos segundos.</div>
        <button class="btn-pill" onclick="retryLastSearch()">🔄 Reintentar</button>
      </div>`;
  } else {
    document.getElementById('stations-scroll').innerHTML = `
      <div class="state-panel">
        <div class="state-icon-box">⚠️</div>
        <div class="state-title">Algo no fue bien</div>
        <div class="error-toast">${escHtml(msg)}</div>
      </div>`;
  }
}

// ────────── UI BITS ──────────
function isMobile() { return window.innerWidth <= 768; }
function toggleSearch() {
  searchOpen = !searchOpen;
  document.getElementById('search-body').classList.toggle('collapsed', !searchOpen);
  const chevron = document.getElementById('search-chevron');
  if (chevron) chevron.style.transform = searchOpen ? '' : 'rotate(-90deg)';
}
function switchTab(tab) {
  if (tab === 'perfil' && !currentUser) {
    openAuthModal();
    document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', i===0));
    currentTab = 'lista';
    return;
  }
  currentTab = tab;
  ['lista','mapa','perfil'].forEach(t => {
    const btn = document.getElementById('tab-'+t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  const sidebar   = document.getElementById('sidebar');
  const mapEl     = document.getElementById('map-container');
  const profileEl = document.getElementById('profile-panel');
  if (tab === 'lista') {
    sidebar.classList.remove('map-active');
    mapEl.classList.remove('active');
    if (isMobile()) profileEl.classList.remove('open');
  } else if (tab === 'mapa') {
    sidebar.classList.add('map-active');
    mapEl.classList.add('active');
    if (isMobile()) profileEl.classList.remove('open');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setTimeout(() => mapInstance && mapInstance.invalidateSize(), 50);
    }));
  } else if (tab === 'perfil') {
    sidebar.classList.remove('map-active');
    mapEl.classList.remove('active');
    profileEl.classList.add('open');
    loadProfileData();
  }
}

function toggleTooltip() {
  tooltipOpen = !tooltipOpen;
  document.getElementById('donate-tooltip').classList.toggle('open', tooltipOpen);
  document.getElementById('donate-pill').classList.toggle('active', tooltipOpen);
}
function closeTooltip() {
  tooltipOpen = false;
  document.getElementById('donate-tooltip').classList.remove('open');
  document.getElementById('donate-pill').classList.remove('active');
}

// ────────── AUTH ──────────
function switchAuthTab(tab) {
  authTab = tab;
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-name-field').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('auth-submit-btn').textContent = tab === 'login' ? 'Entrar' : 'Crear cuenta';
  clearAuthMsg();
}
function openAuthModal() {
  document.getElementById('auth-modal').classList.add('open');
  setTimeout(() => document.getElementById('auth-email').focus(), 100);
}
function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
  clearAuthMsg();
  ['auth-email','auth-password','auth-name'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
}
function clearAuthMsg() {
  const el = document.getElementById('auth-msg');
  el.className = 'auth-msg'; el.textContent = '';
}
function showAuthMsg(msg, type='error') {
  const el = document.getElementById('auth-msg');
  el.className = `auth-msg ${type}`; el.textContent = msg;
}
async function doAuth() {
  if (!sb) {
    showAuthMsg('Conexión no disponible. Recarga la página e inténtalo de nuevo.');
    return;
  }
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-password').value;
  const name  = document.getElementById('auth-name').value.trim();
  const btn   = document.getElementById('auth-submit-btn');
  if (!email || !pass) { showAuthMsg('Completa todos los campos.'); return; }
  btn.disabled = true;
  btn.textContent = authTab === 'login' ? 'Entrando…' : 'Creando cuenta…';
  clearAuthMsg();

  // Timeout de 15s para que el botón nunca quede bloqueado indefinidamente
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), 15000)
  );

  try {
    if (authTab === 'login') {
      const { error } = await Promise.race([
        sb.auth.signInWithPassword({ email, password: pass }),
        timeout,
      ]);
      if (error) throw error;
    } else {
      const redirectTo = window.location.origin + window.location.pathname;
      const { data, error } = await Promise.race([
        sb.auth.signUp({
          email, password: pass,
          options: { emailRedirectTo: redirectTo, data: { display_name: name || email.split('@')[0] } }
        }),
        timeout,
      ]);
      if (error) throw error;
      if (data.user && !data.session) {
        showAuthMsg('¡Revisa tu email para confirmar la cuenta!', 'success');
        btn.disabled = false; btn.textContent = 'Crear cuenta';
        return;
      }
    }
  } catch (err) {
    const msg = err.message === 'TIMEOUT'
      ? 'No se pudo conectar con el servidor. Revisa tu conexión y recarga la página.'
      : translateAuthError(err.message || String(err));
    showAuthMsg(msg);
  } finally {
    btn.disabled = false;
    btn.textContent = authTab === 'login' ? 'Entrar' : 'Crear cuenta';
  }
}
function translateAuthError(msg) {
  if (!msg) return 'Error desconocido.';
  if (msg.includes('Invalid login'))           return 'Email o contraseña incorrectos.';
  if (msg.includes('User already registered')) return 'Este email ya está registrado. Inicia sesión.';
  if (msg.includes('Password should be'))      return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('Invalid email'))           return 'El formato del email no es válido.';
  if (msg.includes('Email not confirmed'))     return 'Confirma tu email primero.';
  return msg;
}
async function doLogout() {
  try { if (sb) await sb.auth.signOut(); } catch(_){}
  currentUser = null;
  favorites.clear();
  favDataMap.clear();
  closeProfilePanel();
  updateAuthButton();
  if (allStations.length) renderList();
  if (isMobile()) switchTab('lista');
  Pepe.say('¡Hasta luego! Vuelve pronto 👋', 'happy');
}
function handleAuthBtn() {
  if (currentUser) {
    const panel = document.getElementById('profile-panel');
    if (panel.classList.contains('open')) closeProfilePanel();
    else openProfilePanel();
  } else {
    openAuthModal();
  }
}

function openProfilePanel() {
  document.getElementById('profile-panel').classList.add('open');
  loadProfileData();
}
function closeProfilePanel() {
  document.getElementById('profile-panel').classList.remove('open');
  if (isMobile()) {
    currentTab = 'lista';
    document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  }
}

function updateAuthButton() {
  const btn = document.getElementById('auth-btn');
  if (!btn) return;
  if (currentUser) {
    const displayName = currentUser.user_metadata?.display_name || currentUser.email || '?';
    const initial = displayName[0].toUpperCase();
    btn.classList.add('logged-in');
    btn.innerHTML = `<div class="auth-avatar">${initial}</div><span class="auth-btn-text">${escHtml(displayName.split(' ')[0])}</span>`;
    const banner = document.getElementById('upsell-banner');
    if (banner) banner.classList.remove('visible');
    const avatarEl = document.getElementById('profile-avatar-lg');
    if (avatarEl) avatarEl.textContent = initial;
    const nameEl  = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    if (nameEl)  nameEl.textContent  = displayName;
    if (emailEl) emailEl.textContent = currentUser.email;
  } else {
    btn.classList.remove('logged-in');
    btn.innerHTML = `<span>👤</span><span class="auth-btn-text">Acceder</span>`;
    document.getElementById('profile-panel').classList.remove('open');
    if (allStations.length) document.getElementById('upsell-banner').classList.add('visible');
  }
}

function switchProfileTab(tab, btn) {
  profileTab = tab;
  document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadProfileData();
}

async function loadProfileData() {
  if (!currentUser || !sb) return;
  const scroll = document.getElementById('profile-scroll');
  scroll.innerHTML = '<div style="text-align:center;padding:24px;"><div class="spinner" style="margin:0 auto"></div></div>';
  try {
    if      (profileTab === 'historial')  await renderHistorial(scroll);
    else if (profileTab === 'favoritas')  await renderFavoritas(scroll);
    else if (profileTab === 'alertas')    await renderAlertas(scroll);
  } catch(err) {
    scroll.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div>Error al cargar datos.<br><span style="font-size:11px;color:var(--danger)">${escHtml(err.message)}</span></div>`;
  }
}

async function renderHistorial(scroll) {
  const { data, error } = await sb.from('refuel_logs')
    .select('*').eq('user_id', currentUser.id)
    .order('refueled_at', { ascending: false }).limit(100);
  if (error) throw new Error('Supabase: ' + error.message);
  const addBtn = `<button class="ptab-add-btn" onclick="openQuickRefuelModal()">＋ Añadir repostaje</button>`;
  if (!data || !data.length) {
    document.getElementById('pstat-repostajes').textContent = '0';
    document.getElementById('pstat-gasto').textContent = '0€';
    scroll.innerHTML = addBtn + `<div class="empty-state">
      <div class="empty-state-icon">🧾</div>
      Aún no tienes repostajes.<br>
      <span style="font-size:12px;margin-top:8px;display:block">Pulsa ⛽ en cualquier gasolinera para registrar uno.</span>
    </div>`;
    return;
  }
  let totalGasto = 0;
  data.forEach(r => { totalGasto += (r.total_cost || 0); });
  document.getElementById('pstat-repostajes').textContent = data.length;
  document.getElementById('pstat-gasto').textContent = totalGasto.toFixed(0) + '€';
  const items = data.map(r => {
    const dateStr = fmtDate(r.refueled_at);
    const total  = r.total_cost ? r.total_cost.toFixed(2) + '€' : '—';
    const liters = r.liters ? r.liters.toFixed(1) + 'L' : '—';
    const price  = r.price_per_liter ? r.price_per_liter.toFixed(3) + '€/L' : '—';
    const fuelLabel = FUEL_MAP[r.fuel_type]?.label || r.fuel_type || '—';
    const safeId = escHtml(r.id);
    const safeName = escHtml(r.station_name || 'Gasolinera');
    let durationHTML = '';
    if (r.emptied_at) {
      const days = Math.max(0, Math.round((new Date(r.emptied_at) - new Date(r.refueled_at)) / 86400000));
      let kmStr = '';
      if (r.km_at_refuel && r.km_when_empty && r.km_when_empty > r.km_at_refuel) {
        kmStr = ` · 📏 ${Math.round(r.km_when_empty - r.km_at_refuel)} km`;
      }
      durationHTML = `<div class="duration-badge">⏱ ${days} día${days!==1?'s':''}${kmStr}</div>`;
    } else {
      durationHTML = `<button class="btn-empty-tank"
        data-id="${safeId}" data-name="${safeName}"
        data-km="${r.km_at_refuel || 0}" data-date="${escHtml(r.refueled_at)}"
        onclick="openTankEmptyModalFromBtn(this)">🪫 ¿Se vació?</button>`;
    }
    return `<div class="history-item">
      <div class="hi-top">
        <div style="flex:1;min-width:0;">
          <div class="hi-name">${safeName}</div>
          <div class="hi-meta">${fuelLabel} · ${liters} · ${price} · ${dateStr}</div>
          ${durationHTML}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
          <div class="hi-price">${total}</div>
          <button class="hi-delete" data-id="${safeId}" onclick="deleteRefuel(this.dataset.id)" aria-label="Borrar">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
  scroll.innerHTML = addBtn + items;
}

async function renderFavoritas(scroll) {
  const { data, error } = await sb.from('favorites')
    .select('*').eq('user_id', currentUser.id)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Supabase: ' + error.message);
  document.getElementById('pstat-favoritas').textContent = data?.length || 0;
  if (!data || !data.length) {
    scroll.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⭐</div>Aún no has guardado favoritas.<br><span style="font-size:12px;margin-top:8px;display:block">Pulsa ☆ en cualquier gasolinera.</span></div>`;
    return;
  }
  favDataMap.clear();
  data.forEach(f => favDataMap.set(f.ideess, f));
  scroll.innerHTML = data.map(f => `
    <div class="history-item">
      <div class="hi-top">
        <div style="flex:1;min-width:0">
          <div class="hi-name">⭐ ${escHtml(titleCase(f.station_name))}</div>
          <div class="hi-meta">📍 ${escHtml(titleCase(f.station_address) || '')}${f.municipio ? ' · ' + escHtml(titleCase(f.municipio)) : ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <button class="btn-refuel-card" data-ideess="${escHtml(f.ideess)}" onclick="openRefuelModalFromFavKey(this.dataset.ideess)">⛽ Repostar</button>
          <button class="hi-delete" data-ideess="${escHtml(f.ideess)}" onclick="deleteFavorite(this.dataset.ideess)">🗑</button>
        </div>
      </div>
    </div>`).join('');
}

async function renderAlertas(scroll) {
  const { data, error } = await sb.from('price_alerts')
    .select('*').eq('user_id', currentUser.id).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Supabase: ' + error.message);
  if (!data || !data.length) {
    scroll.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔔</div>No tienes alertas activas.<br><span style="font-size:12px;margin-top:8px;display:block">Pulsa 🔔 en cualquier gasolinera.</span></div>`;
    return;
  }
  scroll.innerHTML = data.map(a => {
    const fuelLabel = FUEL_MAP[a.fuel_type]?.label || a.fuel_type;
    return `<div class="alert-item">
      <div class="alert-item-info">
        <div class="alert-item-name">🔔 ${escHtml(titleCase(a.station_name))}</div>
        <div class="alert-item-detail">${fuelLabel} — Avisar si baja de</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div class="alert-item-price">${a.target_price.toFixed(3)} €/L</div>
        <button class="alert-delete" data-id="${escHtml(a.id)}" onclick="deleteAlert(this.dataset.id)">🗑</button>
      </div>
    </div>`;
  }).join('');
}

async function loadFavorites() {
  if (!currentUser || !sb) return;
  const { data, error } = await sb.from('favorites').select('ideess').eq('user_id', currentUser.id);
  if (error) { console.error(error.message); return; }
  favorites = new Set((data || []).map(f => f.ideess));
}

async function toggleFavorite(i, btn) {
  if (!currentUser) { openAuthModal(); return; }
  const s = filteredStations[i];
  const ideess = getIdeess(s);
  if (favorites.has(ideess)) {
    const { error } = await sb.from('favorites').delete().eq('user_id', currentUser.id).eq('ideess', ideess);
    if (error) { console.error(error); return; }
    favorites.delete(ideess);
    btn.textContent = '☆'; btn.classList.remove('saved');
  } else {
    const { error } = await sb.from('favorites').upsert({
      user_id: currentUser.id, ideess,
      station_name: s.Rótulo || 'Gasolinera',
      station_address: s.Dirección || '',
      municipio: s.Municipio || '',
      lat: s.lat || null, lng: s.lng || null,
      fuel_type: activeFuel
    }, { onConflict: 'user_id,ideess' });
    if (error) { console.error(error); return; }
    favorites.add(ideess);
    btn.textContent = '★'; btn.classList.add('saved');
    Pepe.say('¡Guardada en favoritas! ⭐', 'happy', 3500);
  }
}

async function deleteFavorite(ideess) {
  await sb.from('favorites').delete().eq('user_id', currentUser.id).eq('ideess', ideess);
  favorites.delete(ideess);
  loadProfileData();
  if (allStations.length) renderList();
}

// ────────── REFUEL ──────────
function openRefuelModal(i) {
  if (!currentUser) { openAuthModal(); return; }
  refuelTarget = filteredStations[i];
  document.getElementById('refuel-date-display').textContent = fmtDateTime(new Date());
  document.getElementById('refuel-station-name').textContent = titleCase(refuelTarget.Rótulo) || 'Gasolinera';
  document.getElementById('refuel-station-addr').textContent = `📍 ${titleCase(refuelTarget.Dirección) || ''} · ${titleCase(refuelTarget.Municipio) || ''}`;
  const price = refuelTarget.prices[activeFuel];
  document.getElementById('refuel-price').value  = price ? price.toFixed(3) : '';
  document.getElementById('refuel-fuel').value   = activeFuel;
  document.getElementById('refuel-liters').value = '';
  document.getElementById('refuel-km').value     = '';
  document.getElementById('refuel-msg').className = 'auth-msg';
  document.getElementById('refuel-msg').textContent = '';
  document.getElementById('refuel-preview').classList.remove('visible');
  document.getElementById('refuel-modal').classList.add('open');
}
function openRefuelModalFromFavKey(ideess) {
  const fav = favDataMap.get(ideess);
  if (!fav) return;
  refuelTarget = {
    Rótulo: fav.station_name, Dirección: fav.station_address,
    Municipio: fav.municipio, lat: fav.lat, lng: fav.lng,
    IDEESS: fav.ideess, prices: {}
  };
  document.getElementById('refuel-date-display').textContent = fmtDateTime(new Date());
  document.getElementById('refuel-station-name').textContent = titleCase(fav.station_name);
  document.getElementById('refuel-station-addr').textContent = `📍 ${titleCase(fav.station_address) || ''} · ${titleCase(fav.municipio) || ''}`;
  document.getElementById('refuel-price').value  = '';
  document.getElementById('refuel-fuel').value   = fav.fuel_type || 'gasolina95';
  document.getElementById('refuel-liters').value = '';
  document.getElementById('refuel-km').value     = '';
  document.getElementById('refuel-msg').className = 'auth-msg';
  document.getElementById('refuel-msg').textContent = '';
  document.getElementById('refuel-preview').classList.remove('visible');
  document.getElementById('refuel-modal').classList.add('open');
}
function closeRefuelModal() { document.getElementById('refuel-modal').classList.remove('open'); }
function updateRefuelPreview() {
  const price  = parseNum(document.getElementById('refuel-price').value);
  const liters = parseNum(document.getElementById('refuel-liters').value);
  const prev = document.getElementById('refuel-preview');
  if (!isNaN(price) && !isNaN(liters) && price > 0 && liters > 0) {
    document.getElementById('refuel-total-val').textContent = (price * liters).toFixed(2) + ' €';
    prev.classList.add('visible');
  } else prev.classList.remove('visible');
}
async function saveRefuel() {
  const price  = parseNum(document.getElementById('refuel-price').value);
  const liters = parseNum(document.getElementById('refuel-liters').value);
  const fuel   = document.getElementById('refuel-fuel').value;
  const km     = parseNum(document.getElementById('refuel-km').value);
  const msgEl  = document.getElementById('refuel-msg');
  if (isNaN(price) || isNaN(liters) || price <= 0 || liters <= 0) {
    msgEl.className = 'auth-msg error'; msgEl.textContent = 'Precio y litros válidos, porfa.'; return;
  }
  const payload = {
    user_id: currentUser.id, ideess: getIdeess(refuelTarget),
    station_name: refuelTarget.Rótulo || 'Gasolinera',
    station_address: refuelTarget.Dirección || '',
    municipio: refuelTarget.Municipio || '',
    fuel_type: fuel, price_per_liter: price, liters,
    total_cost: price * liters,
    km_at_refuel: !isNaN(km) ? km : null,
    refueled_at: new Date().toISOString()
  };
  const { error } = await sb.from('refuel_logs').insert(payload);
  if (error) { msgEl.className = 'auth-msg error'; msgEl.textContent = error.message; return; }
  msgEl.className = 'auth-msg success'; msgEl.textContent = '¡Guardado!';
  setTimeout(() => { closeRefuelModal(); loadProfileData(); Pepe.say('¡Repostaje guardado! 🧾', 'happy'); }, 700);
}

function openQuickRefuelModal() {
  if (!currentUser) { openAuthModal(); return; }
  document.getElementById('qr-date-display').textContent = fmtDateTime(new Date());
  ['qr-station','qr-price','qr-liters','qr-km'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('qr-fuel').value = 'gasolina95';
  document.getElementById('qr-preview').classList.remove('visible');
  document.getElementById('qr-msg').className = 'auth-msg';
  document.getElementById('qr-msg').textContent = '';
  document.getElementById('quick-refuel-modal').classList.add('open');
}
function closeQuickRefuelModal() { document.getElementById('quick-refuel-modal').classList.remove('open'); }
function updateQRPreview() {
  const price  = parseNum(document.getElementById('qr-price').value);
  const liters = parseNum(document.getElementById('qr-liters').value);
  const prev = document.getElementById('qr-preview');
  if (!isNaN(price) && !isNaN(liters) && price > 0 && liters > 0) {
    document.getElementById('qr-total-val').textContent = (price * liters).toFixed(2) + ' €';
    prev.classList.add('visible');
  } else prev.classList.remove('visible');
}
async function saveQuickRefuel() {
  const station = document.getElementById('qr-station').value.trim();
  const price   = parseNum(document.getElementById('qr-price').value);
  const liters  = parseNum(document.getElementById('qr-liters').value);
  const fuel    = document.getElementById('qr-fuel').value;
  const km      = parseNum(document.getElementById('qr-km').value);
  const msgEl   = document.getElementById('qr-msg');
  if (!station || isNaN(price) || isNaN(liters) || price <= 0 || liters <= 0) {
    msgEl.className = 'auth-msg error'; msgEl.textContent = 'Completa nombre, precio y litros.'; return;
  }
  const { error } = await sb.from('refuel_logs').insert({
    user_id: currentUser.id, ideess: 'manual_' + Date.now(),
    station_name: station, fuel_type: fuel,
    price_per_liter: price, liters, total_cost: price * liters,
    km_at_refuel: !isNaN(km) ? km : null,
    refueled_at: new Date().toISOString()
  });
  if (error) { msgEl.className = 'auth-msg error'; msgEl.textContent = error.message; return; }
  msgEl.className = 'auth-msg success'; msgEl.textContent = '¡Guardado!';
  setTimeout(() => { closeQuickRefuelModal(); loadProfileData(); }, 700);
}

async function deleteRefuel(id) {
  await sb.from('refuel_logs').delete().eq('id', id).eq('user_id', currentUser.id);
  loadProfileData();
}

function openTankEmptyModalFromBtn(btn) {
  tankEmptyTarget = {
    id: btn.dataset.id, name: btn.dataset.name,
    km: parseFloat(btn.dataset.km) || 0, date: btn.dataset.date
  };
  document.getElementById('te-date-display').textContent = fmtDateTime(new Date());
  const days = Math.max(0, Math.round((Date.now() - new Date(tankEmptyTarget.date)) / 86400000));
  document.getElementById('te-days-info').textContent = `Han pasado ${days} día${days!==1?'s':''} desde el repostaje en ${tankEmptyTarget.name}.`;
  document.getElementById('te-km').value = '';
  document.getElementById('te-preview').classList.remove('visible');
  document.getElementById('te-msg').className = 'auth-msg';
  document.getElementById('te-msg').textContent = '';
  document.getElementById('tank-empty-modal').classList.add('open');
}
function closeTankEmptyModal() { document.getElementById('tank-empty-modal').classList.remove('open'); }
function updateTEPreview() {
  const km = parseNum(document.getElementById('te-km').value);
  const prev = document.getElementById('te-preview');
  if (!isNaN(km) && tankEmptyTarget && tankEmptyTarget.km > 0 && km > tankEmptyTarget.km) {
    document.getElementById('te-km-val').textContent = Math.round(km - tankEmptyTarget.km) + ' km';
    prev.classList.add('visible');
  } else prev.classList.remove('visible');
}
async function saveTankEmpty() {
  const km = parseNum(document.getElementById('te-km').value);
  const msgEl = document.getElementById('te-msg');
  const payload = { emptied_at: new Date().toISOString() };
  if (!isNaN(km)) payload.km_when_empty = km;
  const { error } = await sb.from('refuel_logs').update(payload).eq('id', tankEmptyTarget.id);
  if (error) { msgEl.className = 'auth-msg error'; msgEl.textContent = error.message; return; }
  msgEl.className = 'auth-msg success'; msgEl.textContent = 'Registrado.';
  setTimeout(() => { closeTankEmptyModal(); loadProfileData(); }, 600);
}

function openAlertModal(i) {
  if (!currentUser) { openAuthModal(); return; }
  alertTarget = filteredStations[i];
  document.getElementById('alert-station-name-sub').textContent = titleCase(alertTarget.Rótulo) || '—';
  document.getElementById('alert-fuel').value = activeFuel;
  const price = alertTarget.prices[activeFuel];
  document.getElementById('alert-price').value = price ? (price - 0.02).toFixed(3) : '';
  document.getElementById('alert-msg').className = 'auth-msg';
  document.getElementById('alert-msg').textContent = '';
  document.getElementById('alert-modal').classList.add('open');
}
function closeAlertModal() { document.getElementById('alert-modal').classList.remove('open'); }
async function saveAlert() {
  const fuel  = document.getElementById('alert-fuel').value;
  const price = parseNum(document.getElementById('alert-price').value);
  const msgEl = document.getElementById('alert-msg');
  if (isNaN(price) || price <= 0) { msgEl.className='auth-msg error'; msgEl.textContent='Precio válido.'; return; }
  const { error } = await sb.from('price_alerts').insert({
    user_id: currentUser.id, ideess: getIdeess(alertTarget),
    station_name: alertTarget.Rótulo || 'Gasolinera',
    fuel_type: fuel, target_price: price, is_active: true
  });
  if (error) { msgEl.className='auth-msg error'; msgEl.textContent=error.message; return; }
  msgEl.className = 'auth-msg success'; msgEl.textContent = '¡Alerta activada!';
  setTimeout(() => { closeAlertModal(); Pepe.say('Te aviso cuando baje de ese precio 🔔', 'happy'); }, 600);
}
async function deleteAlert(id) {
  await sb.from('price_alerts').update({ is_active:false }).eq('id', id).eq('user_id', currentUser.id);
  loadProfileData();
}

// ────────── BOOT ──────────
function checkVerificationCallback() {
  const hash = window.location.hash || '';
  const params = new URLSearchParams(window.location.search);
  const isVerification = hash.includes('access_token') || hash.includes('type=signup')
    || params.get('code') || params.get('type') === 'signup';
  if (isVerification) {
    document.getElementById('verify-overlay').style.display = 'flex';
    history.replaceState(null, '', window.location.pathname);
  }
}
function dismissVerifyOverlay() {
  document.getElementById('verify-overlay').style.display = 'none';
  Pepe.say('¡Cuenta lista! Ya puedes ahorrar a tope 🐽', 'happy', 5000);
}

document.addEventListener('click', e => {
  if (tooltipOpen && !document.getElementById('donate-float').contains(e.target)) closeTooltip();
});

async function boot() {
  // Spawn floating stars in intro
  const introStars = document.getElementById('intro-stars');
  if (introStars) {
    const starSymbols = ['✦','✧','⋆','∘','·','✦'];
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('span');
      s.className = 'intro-star';
      s.textContent = starSymbols[i % starSymbols.length];
      s.style.cssText = `left:${Math.random()*100}%;top:${20+Math.random()*70}%;animation-delay:${Math.random()*2.5}s;animation-duration:${2+Math.random()*2}s;font-size:${10+Math.random()*12}px;`;
      introStars.appendChild(s);
    }
  }

  // ─── CINEMATIC INTRO CHOREOGRAPHY ──────────────────────────────
  const introOverlay = document.getElementById('intro-overlay');
  const titleEl = document.getElementById('intro-title');
  const counterEl = document.getElementById('intro-counter-val');
  const statusEl = document.getElementById('intro-status');

  // Letter-fall for the title: each letter drops in from above with a bounce.
  // Staggered so the title "writes itself" but with motion instead of just appearing.
  const TITLE = 'IberoFuel';
  if (titleEl) {
    titleEl.innerHTML = '';
    [...TITLE].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'letter';
      span.textContent = ch;
      span.style.animationDelay = (0.65 + i * 0.07) + 's';
      titleEl.appendChild(span);
    });
  }

  // Status messages — narrate what's happening behind the scenes
  const STATUS_BEATS = [
    { t: 700,  msg: 'Conectando con el Ministerio… 🇪🇸' },
    { t: 1500, msg: 'Escaneando estaciones en toda España…' },
    { t: 2400, msg: 'Pepe está organizando precios… 🐽' },
    { t: 3000, msg: '¡Listo!', ready: true },
  ];
  const statusTextEl = statusEl?.querySelector('.intro-status-text');
  STATUS_BEATS.forEach(b => setTimeout(() => {
    if (statusTextEl) statusTextEl.textContent = b.msg;
    if (b.ready && statusEl) statusEl.classList.add('ready');
  }, b.t));

  // Counter from 0 → 11,387 (approx. number of gas stations in Spain)
  if (counterEl) {
    const TARGET = 11387;
    const START = 600;
    const DURATION = 2200;
    const t0 = performance.now() + START;
    const tick = (now) => {
      const elapsed = now - t0;
      if (elapsed < 0) { requestAnimationFrame(tick); return; }
      const p = Math.min(1, elapsed / DURATION);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const val = Math.round(eased * TARGET);
      counterEl.textContent = val.toLocaleString('es-ES');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Remove overlay: listen for animationend so pointer-events drop instantly
  // (CSS fill-mode pointer-events is unreliable on mobile/Safari)
  if (introOverlay) {
    introOverlay.addEventListener('animationend', (e) => {
      if (e.animationName !== 'intro-exit') return;
      introOverlay.style.pointerEvents = 'none';
      introOverlay.classList.add('gone');
    });
    // Click anywhere on intro skips it immediately
    introOverlay.addEventListener('click', () => {
      introOverlay.style.pointerEvents = 'none';
      introOverlay.classList.add('gone');
    }, { once: true });
    // Hard fallback in case animationend never fires
    setTimeout(() => {
      introOverlay.style.pointerEvents = 'none';
      introOverlay.classList.add('gone');
    }, 4200);
  }

  // Greet AFTER the intro is gone, so Pepe's bubble doesn't fight the overlay
  setTimeout(() => {
    try { Pepe.greet(); } catch(e) { console.error('Pepe.greet failed:', e); }
  }, 4200);

  try { checkVerificationCallback(); } catch(e) { console.warn('verify check:', e); }
  try { initMap(); } catch(e) { console.warn('map init:', e); }
  try { loadProvincias(); } catch(e) { console.warn('provincias:', e); }

  if (sb) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        currentUser = session.user;
        await loadFavorites();
        updateAuthButton();
        // Si las gasolineras ya están renderizadas (la geolocalización es ahora más rápida
        // que la restauración de sesión), re-renderiza para mostrar los botones de favorito/repostar/alerta.
        if (allStations.length) renderList();
      }
      sb.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
          currentUser = session.user;
          await loadFavorites();
          updateAuthButton();
          if (allStations.length) renderList();
          closeAuthModal();
          Pepe.say(`¡Hola ${(currentUser.user_metadata?.display_name||'amigo').split(' ')[0]}! Ya estamos listos 🐽`, 'happy', 5000);
        } else if (event === 'SIGNED_OUT') {
          currentUser = null;
          favorites.clear();
          updateAuthButton();
          if (allStations.length) renderList();
        }
      });
    } catch(e) { console.warn('auth init:', e); }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // DOM already parsed — boot on next tick so other scripts finish loading
  setTimeout(boot, 0);
}

// Expose to global for inline handlers
Object.assign(window, {
  onProvinciaChange, buscarPorMunicipio, buscarPorTexto, buscarPorCoords, usarMiUbicacion, retryLastSearch,
  onSearchTextInput, onSearchTextKeydown, hideAutocomplete, selectSuggestion,
  toggleFuel, setSortMode, toggleSearch, switchTab,
  toggleTooltip, closeTooltip,
  switchAuthTab, openAuthModal, closeAuthModal, doAuth, doLogout, handleAuthBtn,
  openProfilePanel, closeProfilePanel, switchProfileTab,
  toggleFavorite, deleteFavorite,
  openRefuelModal, openRefuelModalFromFavKey, closeRefuelModal, updateRefuelPreview, saveRefuel,
  openQuickRefuelModal, closeQuickRefuelModal, updateQRPreview, saveQuickRefuel, deleteRefuel,
  openTankEmptyModalFromBtn, closeTankEmptyModal, updateTEPreview, saveTankEmpty,
  openAlertModal, closeAlertModal, saveAlert, deleteAlert,
  selectStation, dismissVerifyOverlay,
  showLocationStatus, resetLocation
});