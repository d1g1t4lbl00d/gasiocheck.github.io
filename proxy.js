// Vercel serverless function — proxies requests to MINETUR API (no CORS)
// Usage: /api/proxy?path=Listados/Municipios/
//        /api/proxy?path=EstacionesTerrestres/FiltroMunicipio/3518
//        /api/proxy?path=EstacionesTerrestres/

const BASE = "https://sedeaplicaciones.minetur.gob.es/ServiciosRECon/webapi";

export default async function handler(req, res) {
  const { path } = req.query;

  if (!path) {
    return res.status(400).json({ error: "Missing ?path= parameter" });
  }

  // Whitelist — only allow MINETUR API paths
  const allowed = [
    /^Listados\/Municipios\/?$/,
    /^EstacionesTerrestres\/?$/,
    /^EstacionesTerrestres\/FiltroMunicipio\/\d+\/?$/,
  ];
  if (!allowed.some(re => re.test(path))) {
    return res.status(403).json({ error: "Path not allowed" });
  }

  try {
    const upstream = await fetch(`${BASE}/${path}`, {
      headers: { Accept: "application/json" },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Upstream error" });
    }

    const data = await upstream.json();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Proxy fetch failed", detail: String(err) });
  }
}
