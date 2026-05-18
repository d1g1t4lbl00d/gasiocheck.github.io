// api/fuel.js — Proxy MINETUR + proxies públicos de fallback + caché Supabase
//
// Flujo por orden de prioridad:
//   1. MINETUR directo
//   2. allorigins.win  (IP europea, evita bloqueo de AWS)
//   3. corsproxy.io
//   4. codetabs.com
//   5. Supabase caché  (últimos datos guardados)
//   6. Error 503

const MINETUR  = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';
const SB_URL   = 'https://gwycdrnwkzmoxbxcqxih.supabase.co';
const SB_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eWNkcm53a3ptb3hieGNxeGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyNDEsImV4cCI6MjA5NDYxNDI0MX0.fTm-TesEgil6NjaiiCspZdjMCX6PxAclFhlPs6PNngc';
const TIMEOUT  = 18000;

// Proxies CORS públicos ordenados por fiabilidad
const CORS_PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

// ── Supabase helpers ──────────────────────────────────────────────────────

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

// ── Intentar una URL con timeout ──────────────────────────────────────────

async function tryFetch(url, isProxy = false) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: isProxy
        ? { Accept: 'application/json' }
        : { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; IberoFuel/1.0)', 'Cache-Control': 'no-cache' },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const text = await r.text();
    try { return JSON.parse(text); } catch { return null; }
  } catch {
    clearTimeout(t);
    return null;
  }
}

// ── Handler principal ─────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path } = req.query;
  if (!path)                         return res.status(400).json({ error: 'Falta ?path=' });
  if (!/^[\w\-\/().]+$/.test(path)) return res.status(400).json({ error: 'Ruta no permitida' });

  const mineturUrl = `${MINETUR}/${path}`;

  // ── 1. MINETUR directo ────────────────────────────────────
  let data = await tryFetch(mineturUrl, false);

  // ── 2-4. Proxies CORS públicos (si MINETUR falla) ─────────
  if (!data) {
    for (const mkProxy of CORS_PROXIES) {
      data = await tryFetch(mkProxy(mineturUrl), true);
      if (data) break;
    }
  }

  // ── Si tenemos datos frescos: cachear y devolver ──────────
  if (data) {
    cacheWrite(path, data);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(data);
  }

  // ── 5. Supabase caché (últimos datos guardados) ───────────
  const cached = await cacheRead(path);
  if (cached) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Cache', 'stale');
    res.setHeader('X-Cache-Date', cached.updated_at);
    return res.status(200).json(cached.payload);
  }

  // ── 6. Sin datos en ningún lado ───────────────────────────
  return res.status(503).json({
    error: 'La API del Ministerio no está disponible y aún no hay datos en caché. Inténtalo más tarde.',
  });
}
