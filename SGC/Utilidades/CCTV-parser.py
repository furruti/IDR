#!/usr/bin/env python3
"""
CCTV Parser
Actualiza los campos serial, firmware y modelo en cctv.json
usando cctv_online.json como fuente de datos actualizada.
Clave de coincidencia: dirección MAC.

Los tres archivos deben estar en la misma carpeta que este script:
  - cctv.json          → inventario a actualizar
  - cctv_online.json   → fuente de datos actualizada
  - CCTV_actualizado.json  → resultado (se genera automáticamente)
"""

import json
import sys
from pathlib import Path
from datetime import datetime

# ─── Rutas relativas a la carpeta del script ──────────────────────────────────
BASE_DIR    = Path(__file__).parent
FILE_CCTV   = BASE_DIR / "cctv.json"
FILE_ONLINE = BASE_DIR / "cctv_online.json"
FILE_OUT    = BASE_DIR / "CCTV_actualizado.json"
FILE_LOG    = BASE_DIR / "cctv_parser_report.txt"

def normalize_mac(mac: str) -> str:
    """Normaliza MAC a mayúsculas para comparación uniforme."""
    return mac.upper().strip()

def load_online_lookup(online_data: dict) -> dict:
    """
    Construye un dict { MAC_UPPER: {nro_serie, firmware, modelo} }
    a partir de camaras y nvrs de cctv_online.json.
    En caso de MAC duplicada (misma cámara en varios NVRs), prevalece el último registro.
    """
    lookup = {}
    sources = [
        (online_data.get("camaras", []), "camara"),
        (online_data.get("nvrs", []),    "nvr"),
    ]
    for items, tipo in sources:
        for item in items:
            mac = normalize_mac(item.get("mac_address", ""))
            if not mac:
                continue
            lookup[mac] = {
                "nro_serie": item.get("nro_serie", ""),
                "firmware":  item.get("firmware",  ""),
                "modelo":    item.get("modelo",    ""),
                "_tipo":     tipo,
                "_nombre":   item.get("camera_name") or item.get("nvr_name") or "",
            }
    return lookup

def run_update(cctv_data: dict, lookup: dict) -> tuple[dict, list]:
    """
    Recorre los dispositivos de CCTV_2026-06-04.json y actualiza
    serial / firmware / modelo cuando hay coincidencia por MAC.
    Devuelve (datos_actualizados, lista_de_cambios).
    """
    changes = []

    for dispositivo in cctv_data.get("dispositivos", []):
        mac = normalize_mac(dispositivo.get("mac", ""))
        if not mac or mac not in lookup:
            continue

        source  = lookup[mac]
        dev_id  = dispositivo.get("id", "")
        dev_tipo = dispositivo.get("tipo", "")
        dev_nombre = dispositivo.get("nombre") or dispositivo.get("camera_name") or ""

        change = {
            "id":    dev_id,
            "tipo":  dev_tipo,
            "mac":   dispositivo.get("mac", ""),
            "fuente_nombre": source["_nombre"],
            "cambios": [],
        }

        # ── serial ──────────────────────────────────────────────────
        old_serial = dispositivo.get("serial", "")
        new_serial = source["nro_serie"]
        if old_serial != new_serial:
            dispositivo["serial"] = new_serial
            change["cambios"].append(
                f"serial:  '{old_serial}' → '{new_serial}'"
            )

        # ── firmware ─────────────────────────────────────────────────
        old_fw = dispositivo.get("firmware", "")
        new_fw = source["firmware"]
        if old_fw != new_fw:
            dispositivo["firmware"] = new_fw
            change["cambios"].append(
                f"firmware: '{old_fw}' → '{new_fw}'"
            )

        # ── modelo ───────────────────────────────────────────────────
        old_modelo = dispositivo.get("modelo", "")
        new_modelo = source["modelo"]
        if old_modelo != new_modelo:
            dispositivo["modelo"] = new_modelo
            change["cambios"].append(
                f"modelo:  '{old_modelo}' → '{new_modelo}'"
            )

        if change["cambios"]:
            changes.append(change)

    return cctv_data, changes

def write_report(changes: list, total_dispositivos: int, file_path: str) -> str:
    """Genera un reporte de texto con el resumen de los cambios."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        "=" * 70,
        "  CCTV PARSER — REPORTE DE ACTUALIZACIÓN",
        f"  Ejecutado: {ts}",
        "=" * 70,
        f"\nTotal dispositivos procesados : {total_dispositivos}",
        f"Dispositivos actualizados     : {len(changes)}",
        f"Sin coincidencia en online    : {total_dispositivos - len(changes)}",
        "\n" + "─" * 70,
        "  DETALLE DE CAMBIOS",
        "─" * 70,
    ]
    for c in changes:
        lines.append(f"\n▶ ID     : {c['id']}")
        lines.append(f"  Tipo   : {c['tipo']}")
        lines.append(f"  MAC    : {c['mac']}")
        lines.append(f"  Fuente : {c['fuente_nombre']}")
        for cambio in c["cambios"]:
            lines.append(f"    • {cambio}")
    lines += ["\n" + "=" * 70, "  FIN DEL REPORTE", "=" * 70]

    report = "\n".join(lines)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(report)
    return report

def main():
    print("Cargando archivos...")
    try:
        with open(FILE_CCTV, encoding="utf-8") as f:
            cctv_data = json.load(f)
        with open(FILE_ONLINE, encoding="utf-8") as f:
            online_data = json.load(f)
    except FileNotFoundError as e:
        print(f"ERROR: No se encontró el archivo: {e}")
        sys.exit(1)

    print("Construyendo lookup de online...")
    lookup = load_online_lookup(online_data)
    print(f"  → {len(lookup)} MACs únicos en cctv_online")

    total = len(cctv_data.get("dispositivos", []))
    print(f"Procesando {total} dispositivos...")
    updated_data, changes = run_update(cctv_data, lookup)

    print(f"  → {len(changes)} dispositivos actualizados")

    print("Guardando JSON actualizado...")
    with open(FILE_OUT, "w", encoding="utf-8") as f:
        json.dump(updated_data, f, ensure_ascii=False, indent=2)

    print("Generando reporte...")
    report = write_report(changes, total, FILE_LOG)
    print("\n" + report)
    print(f"\nArchivos generados:")
    print(f"  • {FILE_OUT}")
    print(f"  • {FILE_LOG}")

if __name__ == "__main__":
    main()
