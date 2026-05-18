// api/fuel.js — Vercel Serverless Function
// Proxy para la API del MINETUR (evita CORS en el navegador)
// Uso: /api/fuel?path=EstacionesTerrestres/FiltroMunicipio/2892
//      /api/fuel?path=Listados/Provincias/
//      /api/fuel?path=EstacionesTerrestres/FiltroProvincia/28

const BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';
const TIMEOUT_MS = 22000;
const MAX_INTENTOS = 2;

async function fetchMinetur(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; IberoFuel/1.0)',
        'Cache-Control': 'no-cache',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Falta el parámetro ?path=' });
  }

  if (!/^[\w\-\/().]+$/.test(path)) {
    return res.status(400).json({ error: 'Ruta no permitida: ' + path });
  }

  const url = `${BASE}/${path}`;
  let lastErr = null;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    try {
      const response = await fetchMinetur(url);

      if (!response.ok) {
        // Si es 503/502 y quedan intentos, esperar 1.5s y reintentar
        if ((response.status === 503 || response.status === 502) && intento < MAX_INTENTOS) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        return res.status(response.status).json({
          error: `La API del MINETUR no está disponible (${response.status}). El servidor del Ministerio está temporalmente caído.`,
        });
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Respuesta no JSON de MINETUR:', text.substring(0, 200));
        return res.status(502).json({ error: 'Respuesta no válida (no es JSON) de la API MINETUR' });
      }

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.status(200).json(data);

    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError') break; // timeout, no reintentar
      if (intento < MAX_INTENTOS) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  const isTimeout = lastErr?.name === 'AbortError';
  console.error('Error proxy MINETUR:', lastErr?.message);
  return res.status(502).json({
    error: isTimeout
      ? 'La API del MINETUR tardó demasiado en responder. Inténtalo de nuevo.'
      : 'No se pudo conectar con la API del MINETUR: ' + (lastErr?.message || 'error desconocido'),
  });
}
