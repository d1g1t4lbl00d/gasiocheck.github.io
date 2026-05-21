#!/usr/bin/env python3
"""
Comprueba alertas de precio activas y envía emails via Resend
cuando el precio actual de una gasolinera baja del umbral configurado.

Requiere variables de entorno:
  SUPABASE_SERVICE_KEY  — Service role key de Supabase (no el anon key)
  RESEND_API_KEY        — API key de Resend (resend.com, plan gratuito)
  FROM_EMAIL            — Dirección de envío (dominio verificado en Resend)
"""

import os
import sys
import json
import requests
from datetime import datetime

SB_URL     = 'https://gwycdrnwkzmoxbxcqxih.supabase.co'
SB_SERVICE = os.environ.get('SUPABASE_SERVICE_KEY', '')
RESEND_KEY = os.environ.get('RESEND_API_KEY', '')
FROM_EMAIL = os.environ.get('FROM_EMAIL', 'alertas@iberofuel.es')

FUEL_LABELS = {
    'gasolina95': 'Gasolina 95 E5',
    'gasolina98': 'Gasolina 98 E5',
    'gasoleoA':   'Gasóleo A',
    'gasoleoB':   'Gasóleo B',
    'glp':        'GLP',
}

# Mapa: fuel_type → campo en el JSON de MINETUR
FUEL_KEYS = {
    'gasolina95': 'Precio Gasolina 95 E5',
    'gasolina98': 'Precio Gasolina 98 E5',
    'gasoleoA':   'Precio Gasóleo A',
    'gasoleoB':   'Precio Gasóleo B',
    'glp':        'Precio Gases licuados del petróleo',
}

def sb_get(path, key=None):
    headers = {
        'apikey': key or SB_SERVICE,
        'Authorization': f'Bearer {key or SB_SERVICE}',
        'Accept': 'application/json',
    }
    r = requests.get(f'{SB_URL}/rest/v1/{path}', headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()

def get_active_alerts():
    return sb_get('price_alerts?select=*&is_active=eq.true')

def get_user_email(user_id):
    """Usa la API de admin de Supabase para obtener el email del usuario."""
    headers = {
        'apikey': SB_SERVICE,
        'Authorization': f'Bearer {SB_SERVICE}',
        'Accept': 'application/json',
    }
    r = requests.get(f'{SB_URL}/auth/v1/admin/users/{user_id}', headers=headers, timeout=15)
    if not r.ok:
        return None
    return r.json().get('email')

def get_station_price(ideess, fuel_key):
    """
    Busca el precio actual de una estación (por IDEESS) en la caché de Supabase.
    Itera sobre los registros de provincias hasta encontrar la estación.
    """
    headers = {
        'apikey': SB_SERVICE,
        'Authorization': f'Bearer {SB_SERVICE}',
        'Accept': 'application/json',
    }
    # Traer solo las claves de provincia
    r = requests.get(
        f'{SB_URL}/rest/v1/minetur_cache'
        f'?select=payload'
        f'&cache_key=like.EstacionesTerrestresFiltros/FiltroProvincia/*',
        headers=headers, timeout=60
    )
    if not r.ok:
        return None

    for row in r.json():
        payload = row.get('payload') or {}
        stations = payload.get('ListaEESSPrecio') or []
        for st in stations:
            if str(st.get('IDEESS', '')).strip() == str(ideess).strip():
                raw = st.get(fuel_key, '').strip()
                if raw:
                    return float(raw.replace(',', '.'))
    return None

def send_email(to_email, station_name, fuel_label, current_price, target_price):
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#f7f9f6;border-radius:16px">
      <div style="text-align:center;margin-bottom:20px">
        <img src="https://iberofuel.gasiocheck.github.io/assets/pepe-logo.png"
             width="72" height="72" alt="Pepe" style="border-radius:50%">
        <h1 style="color:#1E6B4B;font-size:22px;margin:12px 0 4px">¡Alerta de precio activada! 🎉</h1>
        <p style="color:#5C625F;font-size:14px;margin:0">IberoFuel — Tu gasolinera más barata</p>
      </div>
      <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid rgba(30,107,75,0.12)">
        <p style="margin:0 0 8px;color:#3A3F3C;font-size:15px">
          <strong>⛽ {station_name}</strong>
        </p>
        <p style="margin:0 0 4px;color:#5C625F;font-size:14px">Combustible: <strong>{fuel_label}</strong></p>
        <p style="margin:0 0 4px;color:#5C625F;font-size:14px">
          Precio actual: <strong style="color:#1E6B4B;font-size:18px">{current_price:.3f} €/L</strong>
        </p>
        <p style="margin:0;color:#8A8A8A;font-size:13px">
          Tu umbral: {target_price:.3f} €/L
        </p>
      </div>
      <a href="https://iberofuel.gasiocheck.github.io"
         style="display:block;text-align:center;background:#1E6B4B;color:#fff;text-decoration:none;
                padding:14px;border-radius:10px;font-weight:700;font-size:15px">
        Ver gasolineras ahora →
      </a>
      <p style="text-align:center;color:#B7BDB9;font-size:12px;margin-top:16px">
        Para dejar de recibir alertas, ábrelas en la app y elimínalas.<br>
        IberoFuel · Datos del Ministerio de Energía
      </p>
    </div>
    """

    r = requests.post(
        'https://api.resend.com/emails',
        headers={
            'Authorization': f'Bearer {RESEND_KEY}',
            'Content-Type': 'application/json',
        },
        json={
            'from': FROM_EMAIL,
            'to': [to_email],
            'subject': f'🔔 {station_name} — {fuel_label} a {current_price:.3f} €/L',
            'html': html,
        },
        timeout=15,
    )
    return r.ok

def main():
    if not SB_SERVICE:
        print('ERROR: Falta SUPABASE_SERVICE_KEY', file=sys.stderr)
        sys.exit(1)
    if not RESEND_KEY:
        print('AVISO: Falta RESEND_API_KEY — se omite envío de emails')

    print(f'[{datetime.now()}] Comprobando alertas de precio...')
    alerts = get_active_alerts()
    print(f'  Alertas activas: {len(alerts)}')

    if not alerts:
        print('  Sin alertas. Nada que hacer.')
        return

    triggered = 0
    errors = 0

    for alert in alerts:
        ideess      = alert.get('ideess', '')
        station     = alert.get('station_name', 'Gasolinera')
        fuel_type   = alert.get('fuel_type', '')
        target      = float(alert.get('target_price', 0))
        user_id     = alert.get('user_id', '')

        fuel_key    = FUEL_KEYS.get(fuel_type)
        fuel_label  = FUEL_LABELS.get(fuel_type, fuel_type)

        if not fuel_key:
            print(f'  ⚠ Tipo de combustible desconocido: {fuel_type}')
            continue

        current = get_station_price(ideess, fuel_key)
        if current is None:
            print(f'  ? No se encontró precio para IDEESS={ideess}')
            continue

        print(f'  {station} — {fuel_label}: {current:.3f} (umbral: {target:.3f})')

        if current <= target:
            email = get_user_email(user_id)
            if not email:
                print(f'    ⚠ No se pudo obtener el email del usuario {user_id}')
                errors += 1
                continue

            if RESEND_KEY:
                ok = send_email(email, station, fuel_label, current, target)
                if ok:
                    print(f'    ✉ Email enviado a {email}')
                    triggered += 1
                else:
                    print(f'    ✗ Error enviando email a {email}')
                    errors += 1
            else:
                print(f'    → Activada (sin RESEND_API_KEY — no se envió email): {email}')
                triggered += 1

    print(f'\nFinalizado. Alertas activadas: {triggered}, Errores: {errors}')
    if errors:
        sys.exit(1)

if __name__ == '__main__':
    main()
