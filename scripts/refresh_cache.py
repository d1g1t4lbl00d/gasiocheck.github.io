#!/usr/bin/env python3
"""
Descarga el XLS de geoportalgasolineras.es, agrupa por provincia
y escribe en la tabla minetur_cache de Supabase.
"""

import sys
import json
import unicodedata
from datetime import datetime, timezone
import requests
import xlrd

XLS_URL = 'https://geoportalgasolineras.es/resources/files/preciosEESS_es.xls'
SB_URL  = 'https://gwycdrnwkzmoxbxcqxih.supabase.co'
SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eWNkcm53a3ptb3hieGNxeGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyNDEsImV4cCI6MjA5NDYxNDI0MX0.fTm-TesEgil6NjaiiCspZdjMCX6PxAclFhlPs6PNngc'

PROV_MAP = {
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
    """Encuentra la fila que contiene los nombres de columna reales."""
    for row_idx in range(min(5, ws.nrows)):
        vals = [str(ws.cell_value(row_idx, c)).strip() for c in range(ws.ncols)]
        if any('Provincia' in v or 'PROVINCIA' in v or 'IDEESS' in v for v in vals):
            return row_idx
    return 0  # fallback a la primera fila

def main():
    print(f'[{datetime.now()}] Descargando XLS...')
    resp = requests.get(
        XLS_URL,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; IberoFuel/1.0)'},
        timeout=120,
    )
    resp.raise_for_status()
    print(f'  Descargado: {len(resp.content):,} bytes')

    print('Parseando...')
    wb = xlrd.open_workbook(file_contents=resp.content)
    ws = wb.sheets()[0]
    print(f'  Hoja: "{ws.name}", filas={ws.nrows}, cols={ws.ncols}')

    # Imprimir primeras 3 filas para diagnóstico
    for i in range(min(3, ws.nrows)):
        vals = [str(ws.cell_value(i, c))[:20] for c in range(min(10, ws.ncols))]
        print(f'  Fila {i}: {vals}')

    header_row = find_header_row(ws)
    print(f'  Fila de cabeceras detectada: {header_row}')
    headers = [str(ws.cell_value(header_row, c)).strip() for c in range(ws.ncols)]
    print(f'  Cabeceras: {headers[:10]}')

    by_prov: dict[str, list] = {}
    skipped = 0

    for row_idx in range(header_row + 1, ws.nrows):
        row = {headers[c]: ws.cell_value(row_idx, c) for c in range(ws.ncols)}

        # Preferir IDProvincia directo si está disponible
        prov_id = None
        raw_id = row.get('IDProvincia') or row.get('IDPROVINCIA') or ''
        if raw_id != '':
            try:
                prov_id = str(int(float(raw_id))).zfill(2)
            except (ValueError, TypeError):
                pass

        if not prov_id:
            prov_name = str(row.get('Provincia') or row.get('PROVINCIA') or '').strip()
            prov_id = resolve_prov_id(prov_name)

        if not prov_id:
            skipped += 1
            continue

        prov_name = str(row.get('Provincia') or row.get('PROVINCIA') or '').strip()

        station = {
            'IDEESS': str_val(row.get('IDEESS', '')),
            'Rótulo': str(row.get('Rótulo') or row.get('Rotulo') or '').strip(),
            'Tipo Vía': str(row.get('Tipo Vía') or row.get('Tipo Via') or '').strip(),
            'Dirección': str(row.get('Dirección') or row.get('Direccion') or '').strip(),
            'Municipio': str(row.get('Municipio', '')).strip(),
            'IDMunicipio': str_val(row.get('IDMunicipio', '')),
            'IDProvincia': prov_id,
            'Provincia': prov_name,
            'Latitud': str_val(row.get('Latitud', '')).replace('.', ','),
            'Longitud (WGS84)': str_val(row.get('Longitud (WGS84)') or row.get('Longitud') or '').replace('.', ','),
            'Precio Gasolina 95 E5': float_str(row.get('Precio Gasolina 95 E5', '')),
            'Precio Gasolina 98 E5': float_str(row.get('Precio Gasolina 98 E5', '')),
            'Precio Gasóleo A': float_str(row.get('Precio Gasóleo A') or row.get('Precio Gasoleo A', '')),
            'Precio Gasóleo B': float_str(row.get('Precio Gasóleo B') or row.get('Precio Gasoleo B', '')),
            'Precio Gasóleo Premium': float_str(row.get('Precio Gasóleo Premium') or row.get('Precio Gasoleo Premium', '')),
            'Precio Gases licuados del petróleo': float_str(row.get('Precio Gases licuados del petróleo', '')),
            'Precio Gas Natural Comprimido': float_str(row.get('Precio Gas Natural Comprimido', '')),
            'Precio Gas Natural Licuado': float_str(row.get('Precio Gas Natural Licuado', '')),
            'Precio Hidrógeno': float_str(row.get('Precio Hidrógeno') or row.get('Precio Hidrogeno', '')),
            'Horario': str(row.get('Horario', '')).strip(),
            'Rem. Autoservicio': str(row.get('Rem. Autoservicio', '')).strip(),
            'Tipo Servicio': str(row.get('Tipo Servicio', '')).strip(),
        }
        by_prov.setdefault(prov_id, []).append(station)

    prov_ids = list(by_prov.keys())
    total = sum(len(v) for v in by_prov.values())
    print(f'  Estaciones: {total:,} en {len(prov_ids)} provincias, omitidas: {skipped}')

    if total == 0:
        print('ERROR: 0 estaciones procesadas. Revisa las cabeceras del XLS.', file=sys.stderr)
        sys.exit(1)

    now = datetime.now(timezone.utc).isoformat()
    fecha = datetime.now().strftime('%d/%m/%Y')

    # Lista de provincias
    prov_list = [
        {'IDPovincia': v, 'IDProvincia': v, 'Provincia': k[0] + k[1:].lower()}
        for k, v in PROV_MAP.items()
    ]
    print('Guardando lista de provincias...')
    ok = sb_upsert([{'cache_key': 'Listados/Provincias/', 'payload': prov_list, 'updated_at': now}])
    print(f'  {"OK" if ok else "ERROR"}')

    # Datos por provincia en lotes de 10
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
