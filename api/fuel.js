// api/fuel.js — Proxy MINETUR + caché Supabase
// Flujo: 1) intenta MINETUR  2) si falla → sirve Supabase  3) si no hay caché → error
//
// Endpoints admitidos:
//   /api/fuel?path=Listados/Provincias/
//   /api/fuel?path=Listados/MunicipiosPorProvincia/28
//   /api/fuel?path=EstacionesTerrestres/FiltroMunicipio/3518
//   /api/fuel?path=EstacionesTerrestres/FiltroProvincia/28

const MINETUR   = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';
const SB_URL    = 'https://gwycdrnwkzmoxbxcqxih.supabase.co';
const SB_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eWNkcm53a3ptb3hieGNxeGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyNDEsImV4cCI6MjA5NDYxNDI0MX0.fTm-TesEgil6NjaiiCspZdjMCX6PxAclFhlPs6PNngc';
const TIMEOUT   = 22000; // ms antes de abortar llamada a MINETUR

// ── Helpers Supabase (REST nativo, sin npm) ────────────────────────────────

async function cacheRead(key) {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/minetur_cache?cache_key=eq.${encodeURIComponent(key)}&select=payload,updated_at&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch { return null; }
}

function cacheWrite(key, payload) {
  // Fire-and-forget: no bloqueamos la respuesta esperando la escritura
  fetch(`${SB_URL}/rest/v1/minetur_cache`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ cache_key: key, payload, updated_at: new Date().toISOString() }),
  }).catch(() => {});
}

// ── Llamada a MINETUR con retry ────────────────────────────────────────────

async function fetchMinetur(url, intento = 1) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; IberoFuel/1.0)',
        'Cache-Control': 'no-cache',
      },
    });
    clearTimeout(t);
    return r;
  } catch (err) {
    clearTimeout(t);
    // Reintentar una vez si no fue timeout
    if (intento < 2 && err.name !== 'AbortError') {
      await new Promise(r => setTimeout(r, 1500));
      return fetchMinetur(url, intento + 1);
    }
    throw err;
  }
}

// ── Handler principal ──────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  if (!path)                          return res.status(400).json({ error: 'Falta ?path=' });
  if (!/^[\w\-\/().]+$/.test(path))  return res.status(400).json({ error: 'Ruta no permitida' });

  const url = `${MINETUR}/${path}`;
  let mineturDown = false;

  // ── 1. Intentar MINETUR ──────────────────────────────────
  try {
    const r = await fetchMinetur(url);

    if (r.ok) {
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch {
        return res.status(502).json({ error: 'MINETUR devolvió respuesta no JSON' });
      }

      cacheWrite(path, data);                                  // guardar en caché
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.status(200).json(data);
    }

    // Solo caemos al caché si es error de servidor (50x)
    if (r.status >= 500) {
      mineturDown = true;
    } else {
      return res.status(r.status).json({ error: `MINETUR respondió con ${r.status}` });
    }

  } catch (err) {
    // Timeout u otro error de red → intentar caché
    mineturDown = true;
    console.error('MINETUR error:', err.message);
  }

  // ── 2. MINETUR caído → servir desde Supabase ────────────
  if (mineturDown) {
    const cached = await cacheRead(path);
    if (cached) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Cache', 'stale');
      res.setHeader('X-Cache-Date', cached.updated_at);
      return res.status(200).json(cached.payload);
    }
  }

  // ── 3. Sin datos en ningún lado ─────────────────────────
  return res.status(503).json({
    error: 'La API del Ministerio no está disponible y aún no hay datos guardados para esta búsqueda. Inténtalo más tarde o busca por municipio.',
    cached: false,
  });
}
