// api/xls-refresh.js — Descarga el XLS de geoportalgasolineras.es,
// lo parsea con SheetJS y guarda los datos por provincia en minetur_cache.
// Llamar con GET /api/xls-refresh (o desde pg_cron/pg_net).

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const SB_URL = 'https://gwycdrnwkzmoxbxcqxih.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eWNkcm53a3ptb3hieGNxeGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyNDEsImV4cCI6MjA5NDYxNDI0MX0.fTm-TesEgil6NjaiiCspZdjMCX6PxAclFhlPs6PNngc';
const XLS_URL = 'https://geoportalgasolineras.es/resources/files/preciosEESS_es.xls';

const PROV_MAP = {
  'A CORUÑA': '15', 'ÁLAVA': '01', 'ALBACETE': '02', 'ALICANTE': '03',
  'ALMERÍA': '04', 'ASTURIAS': '33', 'ÁVILA': '05', 'BADAJOZ': '06',
  'BALEARES': '07', 'BARCELONA': '08', 'BURGOS': '09', 'CÁCERES': '10',
  'CÁDIZ': '11', 'CANTABRIA': '39', 'CASTELLÓN': '12', 'CEUTA': '51',
  'CIUDAD REAL': '13', 'CÓRDOBA': '14', 'CUENCA': '16', 'GIRONA': '17',
  'GRANADA': '18', 'GUADALAJARA': '19', 'GUIPÚZCOA': '20', 'HUELVA': '21',
  'HUESCA': '22', 'JAÉN': '23', 'LA RIOJA': '26', 'LAS PALMAS': '35',
  'LEÓN': '24', 'LLEIDA': '25', 'LUGO': '27', 'MADRID': '28',
  'MÁLAGA': '29', 'MELILLA': '52', 'MURCIA': '30', 'NAVARRA': '31',
  'OURENSE': '32', 'PALENCIA': '34', 'PONTEVEDRA': '36', 'SALAMANCA': '37',
  'SANTA CRUZ DE TENERIFE': '38', 'SEGOVIA': '40', 'SEVILLA': '41',
  'SORIA': '42', 'TARRAGONA': '43', 'TERUEL': '44', 'TOLEDO': '45',
  'VALENCIA': '46', 'VALLADOLID': '47', 'VIZCAYA': '48', 'ZAMORA': '49',
  'ZARAGOZA': '50',
};

function norm(s) {
  return s.toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function resolveProvId(name) {
  const up = name.toUpperCase().trim();
  if (PROV_MAP[up]) return PROV_MAP[up];
  const n = norm(up);
  for (const [k, v] of Object.entries(PROV_MAP)) {
    if (norm(k) === n) return v;
  }
  return null;
}

async function sbUpsertBulk(records) {
  const r = await fetch(`${SB_URL}/rest/v1/minetur_cache`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(records),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Supabase upsert ${r.status}: ${txt}`);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Descargar XLS
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);
    const xlsRes = await fetch(XLS_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IberoFuel/1.0)' },
    });
    clearTimeout(timeout);
    if (!xlsRes.ok) throw new Error(`XLS HTTP ${xlsRes.status}`);
    const arrayBuf = await xlsRes.arrayBuffer();

    // 2. Parsear
    const wb = XLSX.read(Buffer.from(arrayBuf), { type: 'buffer', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // 3. Agrupar por provincia
    const byProv = {};
    for (const row of rows) {
      const provName = String(row['Provincia'] || row['PROVINCIA'] || '').trim();
      const provId = resolveProvId(provName);
      if (!provId) continue;

      const station = {
        IDEESS: row['IDEESS'] || '',
        'Rótulo': row['Rótulo'] || row['Rotulo'] || '',
        'Tipo Vía': row['Tipo Vía'] || row['Tipo Via'] || '',
        'Dirección': row['Dirección'] || row['Direccion'] || '',
        Municipio: row['Municipio'] || '',
        IDMunicipio: String(row['IDMunicipio'] || ''),
        IDProvincia: provId,
        Provincia: provName,
        Latitud: String(row['Latitud'] || '').replace('.', ','),
        'Longitud (WGS84)': String(row['Longitud (WGS84)'] || row['Longitud'] || '').replace('.', ','),
        'Precio Gasolina 95 E5': String(row['Precio Gasolina 95 E5'] || '').replace('.', ','),
        'Precio Gasolina 98 E5': String(row['Precio Gasolina 98 E5'] || '').replace('.', ','),
        'Precio Gasóleo A': String(row['Precio Gasóleo A'] || row['Precio Gasoleo A'] || '').replace('.', ','),
        'Precio Gasóleo B': String(row['Precio Gasóleo B'] || row['Precio Gasoleo B'] || '').replace('.', ','),
        'Precio Gasóleo Premium': String(row['Precio Gasóleo Premium'] || row['Precio Gasoleo Premium'] || '').replace('.', ','),
        'Precio Gases licuados del petróleo': String(row['Precio Gases licuados del petróleo'] || '').replace('.', ','),
        'Precio Gas Natural Comprimido': String(row['Precio Gas Natural Comprimido'] || '').replace('.', ','),
        'Precio Gas Natural Licuado': String(row['Precio Gas Natural Licuado'] || '').replace('.', ','),
        'Precio Hidrógeno': String(row['Precio Hidrógeno'] || row['Precio Hidrogeno'] || '').replace('.', ','),
        Horario: row['Horario'] || '',
        'Rem. Autoservicio': row['Rem. Autoservicio'] || '',
        'Tipo Servicio': row['Tipo Servicio'] || '',
      };

      if (!byProv[provId]) byProv[provId] = [];
      byProv[provId].push(station);
    }

    const now = new Date().toISOString();
    const fecha = new Date().toLocaleDateString('es-ES');
    const provIds = Object.keys(byProv);

    // 4. Lista de provincias
    const provList = Object.entries(PROV_MAP).map(([nombre, id]) => ({
      IDPovincia: id,
      IDProvincia: id,
      Provincia: nombre.charAt(0) + nombre.slice(1).toLowerCase(),
    }));

    // 5. Upsert masivo: primero provincias + índice, luego datos por provincia
    const metaRecords = [
      {
        cache_key: 'Listados/Provincias/',
        payload: provList,
        updated_at: now,
      },
    ];
    await sbUpsertBulk(metaRecords);

    // Upsert por provincia en lotes de 10 para no superar límite de tamaño
    const BATCH = 10;
    for (let i = 0; i < provIds.length; i += BATCH) {
      const batch = provIds.slice(i, i + BATCH).map(provId => ({
        cache_key: `EstacionesTerrestresFiltros/FiltroProvincia/${provId}`,
        payload: {
          ListaEESSPrecio: byProv[provId],
          Fecha: fecha,
          ResultadoConsulta: 'OK',
        },
        updated_at: now,
      }));
      await sbUpsertBulk(batch);
    }

    const totalStations = provIds.reduce((acc, id) => acc + byProv[id].length, 0);
    return res.status(200).json({
      ok: true,
      provincias: provIds.length,
      estaciones: totalStations,
      fecha,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
