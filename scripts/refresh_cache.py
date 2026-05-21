#!/usr/bin/env python3
"""
Descarga el XLS de geoportalgasolineras.es, agrupa por provincia
y escribe en la tabla minetur_cache de Supabase.
"""

import sys
import json
import unicodedata
import urllib3
from datetime import datetime, timezone
import requests

# geoportalgasolineras.es serves a broken SSL chain (missing intermediate cert).
# verify=False is intentional here — this is a public government XLS download.
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
import xlrd

XLS_URL = 'https://geoportalgasolineras.es/resources/files/preciosEESS_es.xls'
SB_URL  = 'https://gwycdrnwkzmoxbxcqxih.supabase.co'
SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eWNkcm53a3ptb3hieGNxeGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyNDEsImV4cCI6MjA5NDYxNDI0MX0.fTm-TesEgil6NjaiiCspZdjMCX6PxAclFhlPs6PNngc'

# Todas las variantes posibles: nombres oficiales, bilingües y alternativos
PROV_MAP = {
    # ID: nombre canónico MINETUR (clave = lo que aparece en el XLS, en mayúsculas)
    'A CORUÑA': '15', 'CORUÑA (A)': '15', 'CORUÑA, A': '15', 'LA CORUÑA': '15',
    'ÁLAVA': '01', 'ARABA': '01', 'ARABA/ÁLAVA': '01', 'ALAVA': '01',
    'ALBACETE': '02',
    'ALICANTE': '03', 'ALICANTE/ALACANT': '03',
    'ALMERÍA': '04', 'ALMERIA': '04',
    'ASTURIAS': '33',
    'ÁVILA': '05', 'AVILA': '05',
    'BADAJOZ': '06',
    'BALEARES': '07', 'ILLES BALEARS': '07', 'ISLAS BALEARES': '07', 'BALEARS (ILLES)': '07',
    'BARCELONA': '08',
    'BURGOS': '09',
    'CÁCERES': '10', 'CACERES': '10',
    'CÁDIZ': '11', 'CADIZ': '11',
    'CANTABRIA': '39',
    'CASTELLÓN': '12', 'CASTELLON': '12', 'CASTELLÓ': '12', 'CASTELLO': '12',
    'CASTELLÓN / CASTELLÓ': '12', 'CASTELLON / CASTELLO': '12',
    'CASTELLÓN DE LA PLANA': '12', 'CASTELLÓ DE LA PLANA': '12',
    'CEUTA': '51',
    'CIUDAD REAL': '13',
    'CÓRDOBA': '14', 'CORDOBA': '14',
    'CUENCA': '16',
    'GIRONA': '17', 'GERONA': '17',
    'GRANADA': '18',
    'GUADALAJARA': '19',
    'GUIPÚZCOA': '20', 'GUIPUZCOA': '20', 'GIPUZKOA': '20',
    'HUELVA': '21',
    'HUESCA': '22',
    'JAÉN': '23', 'JAEN': '23',
    'LA RIOJA': '26', 'RIOJA (LA)': '26', 'RIOJA, LA': '26',
    'LAS PALMAS': '35', 'PALMAS (LAS)': '35', 'PALMAS, LAS': '35',
    'LEÓN': '24', 'LEON': '24',
    'LLEIDA': '25', 'LÉRIDA': '25', 'LERIDA': '25',
    'LUGO': '27',
    'MADRID': '28',
    'MÁLAGA': '29', 'MALAGA': '29',
    'MELILLA': '52',
    'MURCIA': '30',
    'NAVARRA': '31', 'NAFARROA': '31',
    'OURENSE': '32', 'ORENSE': '32',
    'PALENCIA': '34',
    'PONTEVEDRA': '36',
    'SALAMANCA': '37',
    'SANTA CRUZ DE TENERIFE': '38', 'TENERIFE': '38',
    'SEGOVIA': '40',
    'SEVILLA': '41',
    'SORIA': '42',
    'TARRAGONA': '43',
    'TERUEL': '44',
    'TOLEDO': '45',
    'VALENCIA': '46', 'VALÈNCIA': '46', 'VALENCIA/VALÈNCIA': '46', 'VALENCIA / VALÈNCIA': '46',
    'VALLADOLID': '47',
    'VIZCAYA': '48', 'BIZKAIA': '48',
    'ZAMORA': '49',
    'ZARAGOZA': '50',
}

# Nombre canónico MINETUR para la lista de provincias (IDProvincia → nombre)
PROV_CANONICAL = {
    '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería',
    '05': 'Ávila', '06': 'Badajoz', '07': 'Baleares', '08': 'Barcelona',
    '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón',
    '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca',
    '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Guipúzcoa',
    '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León',
    '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid',
    '29': 'Málaga', '30': 'Murcia', '31': 'Navarra', '32': 'Ourense',
    '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra',
    '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria',
    '40': 'Segovia', '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona',
    '44': 'Teruel', '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid',
    '48': 'Vizcaya', '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla',
}


def norm(s: str) -> str:
    return unicodedata.normalize('NFD', s.upper()).encode('ascii', 'ignore').decode().replace('  ', ' ').strip()

PROV_MAP_NORM = {norm(k): v for k, v in PROV_MAP.items()}

def resolve_prov_id(name: str):
    up = name.upper().strip()
    if up in PROV_MAP:
        return PROV_MAP[up]
    return PROV_MAP_NORM.get(norm(up))

def float_str(val) -> str:
    if val == '' or val is None:
        return ''
    try:
        f = float(val)
        if f == 0:
            return ''
        return f'{f:.3f}'.replace('.', ',')
    except (TypeError, ValueError):
        s = str(val).strip()
        return s.replace('.', ',') if s else ''

def str_val(val) -> str:
    if isinstance(val, float) and val == int(val):
        return str(int(val))
    return str(val).strip()

def sb_upsert(records: list) -> bool:
    r = requests.post(
        f'{SB_URL}/rest/v1/minetur_cache',
        headers={
            'apikey': SB_KEY,
            'Authorization': f'Bearer {SB_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
        },
        data=json.dumps(records, ensure_ascii=False).encode('utf-8'),
        timeout=60,
    )
    if not r.ok:
        print(f'  Supabase error {r.status_code}: {r.text[:500]}', file=sys.stderr)
        return False
    return True

def find_header_row(ws) -> int:
    for row_idx in range(min(10, ws.nrows)):
        vals = [str(ws.cell_value(row_idx, c)).strip() for c in range(ws.ncols)]
        if any(norm(v) in ('PROVINCIA', 'IDEESS', 'ROTULO') for v in vals if v):
            return row_idx
    return 0

def main():
    print(f'[{datetime.now()}] Descargando XLS...')
    resp = requests.get(
        XLS_URL,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; IberoFuel/1.0)'},
        timeout=120,
        verify=False,
    )
    resp.raise_for_status()
    print(f'  Descargado: {len(resp.content):,} bytes')

    print('Parseando...')
    wb = xlrd.open_workbook(file_contents=resp.content)
    ws = wb.sheets()[0]
    print(f'  Hoja: "{ws.name}", filas={ws.nrows}, cols={ws.ncols}')

    header_row = find_header_row(ws)
    print(f'  Fila de cabeceras: {header_row}')

    # Cabeceras en minúsculas para lookup insensible a mayúsculas
    headers_orig = [str(ws.cell_value(header_row, c)).strip() for c in range(ws.ncols)]
    headers_lower = [h.lower() for h in headers_orig]
    print(f'  Cabeceras: {headers_orig[:15]}')

    # Helper para acceder a una columna por nombre (insensible a mayúsculas)
    def gcol(row_lower: dict, *keys):
        for k in keys:
            v = row_lower.get(k.lower())
            if v is not None and v != '':
                return v
        return ''

    by_prov: dict[str, list] = {}
    skipped_names: set = set()
    skipped = 0

    for row_idx in range(header_row + 1, ws.nrows):
        # Construir dict con claves en minúsculas
        row = {headers_lower[c]: ws.cell_value(row_idx, c) for c in range(ws.ncols)}

        # Preferir IDProvincia directo
        prov_id = None
        raw_id = row.get('idprovincia') or row.get('id provincia') or ''
        if raw_id != '':
            try:
                prov_id = str(int(float(raw_id))).zfill(2)
                if prov_id not in PROV_CANONICAL:
                    prov_id = None
            except (ValueError, TypeError):
                prov_id = None

        if not prov_id:
            prov_name = str(row.get('provincia') or '').strip()
            prov_id = resolve_prov_id(prov_name)
            if not prov_id and prov_name:
                skipped_names.add(prov_name)

        if not prov_id:
            skipped += 1
            continue

        prov_name_orig = str(row.get('provincia') or '').strip()

        station = {
            'IDEESS': str_val(gcol(row, 'IDEESS')),
            'Rótulo': str(gcol(row, 'Rótulo', 'Rotulo', 'rótulo', 'rotulo')).strip(),
            'Tipo Vía': str(gcol(row, 'Tipo Vía', 'Tipo Via', 'tipo vía', 'tipo via')).strip(),
            'Dirección': str(gcol(row, 'Dirección', 'Direccion', 'dirección', 'direccion')).strip(),
            'Municipio': str(gcol(row, 'Municipio', 'municipio')).strip(),
            'IDMunicipio': str_val(gcol(row, 'IDMunicipio', 'idmunicipio')),
            'IDProvincia': prov_id,
            'Provincia': prov_name_orig,
            'Latitud': str_val(gcol(row, 'Latitud', 'latitud')).replace('.', ','),
            'Longitud (WGS84)': str_val(gcol(row, 'Longitud (WGS84)', 'Longitud', 'longitud (wgs84)', 'longitud')).replace('.', ','),
            'Precio Gasolina 95 E5': float_str(gcol(row, 'Precio Gasolina 95 E5', 'Precio gasolina 95 E5')),
            'Precio Gasolina 98 E5': float_str(gcol(row, 'Precio Gasolina 98 E5', 'Precio gasolina 98 E5')),
            'Precio Gasóleo A': float_str(gcol(row, 'Precio Gasóleo A', 'Precio Gasoleo A', 'Precio gasóleo A', 'Precio gasoleo A')),
            'Precio Gasóleo B': float_str(gcol(row, 'Precio Gasóleo B', 'Precio Gasoleo B', 'Precio gasóleo B', 'Precio gasoleo B')),
            'Precio Gasóleo Premium': float_str(gcol(row, 'Precio Gasóleo Premium', 'Precio Gasoleo Premium', 'Precio gasóleo Premium', 'Precio gasoleo Premium')),
            'Precio Gases licuados del petróleo': float_str(gcol(row, 'Precio Gases licuados del petróleo', 'Precio gases licuados del petróleo')),
            'Precio Gas Natural Comprimido': float_str(gcol(row, 'Precio Gas Natural Comprimido', 'Precio gas natural comprimido')),
            'Precio Gas Natural Licuado': float_str(gcol(row, 'Precio Gas Natural Licuado', 'Precio gas natural licuado')),
            'Precio Hidrógeno': float_str(gcol(row, 'Precio Hidrógeno', 'Precio Hidrogeno', 'Precio hidrógeno', 'Precio hidrogeno')),
            'Horario': str(gcol(row, 'Horario', 'horario')).strip(),
            'Rem. Autoservicio': str(gcol(row, 'Rem. Autoservicio', 'rem. autoservicio')).strip(),
            'Tipo Servicio': str(gcol(row, 'Tipo Servicio', 'tipo servicio')).strip(),
        }
        by_prov.setdefault(prov_id, []).append(station)

    prov_ids = list(by_prov.keys())
    total = sum(len(v) for v in by_prov.values())
    print(f'  Estaciones: {total:,} en {len(prov_ids)} provincias, omitidas: {skipped}')
    if skipped_names:
        print(f'  Nombres no reconocidos: {sorted(skipped_names)[:20]}')

    if total == 0:
        print('ERROR: 0 estaciones procesadas.', file=sys.stderr)
        sys.exit(1)

    now = datetime.now(timezone.utc).isoformat()
    fecha = datetime.now().strftime('%d/%m/%Y')

    # Lista de provincias
    prov_list = [
        {'IDPovincia': pid, 'IDProvincia': pid, 'Provincia': nombre}
        for pid, nombre in sorted(PROV_CANONICAL.items())
    ]
    print('Guardando lista de provincias...')
    ok = sb_upsert([{'cache_key': 'Listados/Provincias/', 'payload': prov_list, 'updated_at': now}])
    print(f'  {"OK" if ok else "ERROR"}')

    BATCH = 10
    print(f'Guardando {len(prov_ids)} provincias en lotes de {BATCH}...')
    errors = 0
    for i in range(0, len(prov_ids), BATCH):
        batch_ids = prov_ids[i:i + BATCH]
        records = [
            {
                'cache_key': f'EstacionesTerrestresFiltros/FiltroProvincia/{pid}',
                'payload': {'ListaEESSPrecio': by_prov[pid], 'Fecha': fecha, 'ResultadoConsulta': 'OK'},
                'updated_at': now,
            }
            for pid in batch_ids
        ]
        if not sb_upsert(records):
            errors += 1
        print(f'  Lote {i // BATCH + 1}/{(len(prov_ids) + BATCH - 1) // BATCH}: {batch_ids}')

    print(f'\nFinalizado. Estaciones: {total}, Provincias: {len(prov_ids)}, Errores: {errors}')
    sys.exit(1 if errors else 0)

if __name__ == '__main__':
    main()
