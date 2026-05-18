// api/fuel.js — Vercel Serverless Function
// Proxy para la API del MINETUR (evita CORS en el navegador)
// Uso: /api/fuel?path=EstacionesTerrestres/FiltroMunicipio/2892
//      /api/fuel?path=Listados/Provincias/
//      /api/fuel?path=Listados/MunicipiosPorProvincia/28

const BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';

export default async function handler(req, res) {
  // CORS headers
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

  // Seguridad: solo permitir rutas alfanuméricas, slashes, guiones y paréntesis
  // CORREGIDO: el regex anterior era demasiado restrictivo y bloqueaba rutas válidas
  if (!/^[\w\-\/().]+$/.test(path)) {
    return res.status(400).json({ error: 'Ruta no permitida: ' + path });
  }

  const url = `${BASE}/${path}`;

  // CORREGIDO: AbortSignal.timeout() no está disponible en Node 16 (Vercel default)
  // Usamos un AbortController manual compatible con todas las versiones de Node
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 IberoFuel/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `API MINETUR respondió con ${response.status}`,
        url,
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

    // Cache 5 minutos
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(data);

  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    console.error('Error proxy MINETUR:', err.message);
    return res.status(502).json({
      error: isTimeout
        ? 'Tiempo de espera agotado conectando con la API MINETUR'
        : 'No se pudo conectar con la API MINETUR: ' + err.message,
    });
  }
}
