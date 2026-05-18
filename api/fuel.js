// api/fuel.js — Vercel Serverless Function
// Proxy para la API del MINETUR (evita CORS en el navegador)
// Uso: /api/fuel?path=EstacionesTerrestres/FiltroMunicipio/2892
//      /api/fuel?path=Listados/Provincias/
//      /api/fuel?path=Listados/MunicipiosPorProvincia/28

const BASE = 'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes';

export default async function handler(req, res) {
  // CORS headers (por si acaso)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: 'Falta el parámetro ?path=' });
  }

  // Seguridad: solo permitir rutas del API MINETUR
  if (!/^[\w\/()]+$/.test(path)) {
    return res.status(400).json({ error: 'Ruta no permitida' });
  }

  const url = `${BASE}/${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 IberoFuel/1.0',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `API respondió con ${response.status}` });
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Respuesta no válida de la API MINETUR' });
    }

    // Cache 5 minutos (precios no cambian más rápido)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(data);

  } catch (err) {
    console.error('Error proxy MINETUR:', err.message);
    return res.status(502).json({ error: 'No se pudo conectar con la API MINETUR: ' + err.message });
  }
}
