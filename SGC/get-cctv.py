"""
================================================================================
DOCUMENTACIÓN GENERAL: Scanner de CCTV ISAPI (CCTV-Scanner.py)
================================================================================
--------------------------------------------------------------------------------
1. REQUISITOS DE INSTALACIÓN
--------------------------------------------------------------------------------
Python 3.8 o superior  →  https://www.python.org/downloads/
  En Windows: marcar "Add Python to PATH" durante la instalación.

Paquetes externos (instalar una sola vez con pip):

    pip install requests keyring

  - requests : comunicación HTTP/HTTPS con NVRs y cámaras.
  - keyring   : almacenamiento seguro de credenciales en el S.O.
  - urllib3   : se instala automáticamente como dependencia de requests.

Todo lo demás (ssl, xml, json, re, concurrent.futures, getpass) forma parte
de la biblioteca estándar de Python y no requiere instalación adicional.

Versión mínima de Python y TLS 1.3:
  Python 3.8+ trae OpenSSL 1.1.1+ integrado en Windows, lo que habilita TLS 1.3.
  Con Python 3.7 el script funciona igual pero sin el intento TLS 1.3.

Problema con keyring en redes corporativas:
  En PCs con políticas de dominio restrictivas, keyring puede no encontrar un
  backend válido para guardar la contraseña. Solución:

    pip install keyrings.alt

  Si el problema persiste, el script igual funciona; solo pedirá la contraseña
  en cada ejecución en lugar de recordarla automáticamente.

--------------------------------------------------------------------------------
2. FUNCIONAMIENTO DEL SCRIPT
--------------------------------------------------------------------------------
El flujo lógico del programa se ejecuta en los siguientes pasos:

1. Lectura de Credenciales y Parámetros:
   - Vía Configuración: Intenta leer el usuario, la estrategia de puertos, los 
     hilos de ejecución y la lista de NVRs desde "Config/config_scanner.json". 
     Luego, busca la clave del usuario en el Administrador de Credenciales del 
     Sistema Operativo (keyring).
   - Vía Consola (Modo Recuperación): Si el JSON no existe o los datos faltan en 
     el S.O., el script te los pedirá de forma amigable (la contraseña se escribe 
     de forma oculta). Si lo deseas, guardará la clave en el S.O. para automatizar 
     futuras ejecuciones.

2. Fase 1 - Extracción desde NVRs: 
   El script se conecta a cada NVR listado mediante el protocolo ISAPI para 
   extraer los canales IP activos (InputProxyChannel), descubriendo las IPs 
   internas de cada cámara y su número de canal.

3. Fase 2 - Escaneo Directo Asíncrono: 
   Con la lista de cámaras en mano, el script lanza múltiples hilos concurrentes 
   (ThreadPoolExecutor) para consultar a cada cámara individualmente de manera 
   simultánea. Esto acelera el proceso drásticamente en redes grandes.

4. Almacenamiento de Reportes: 
   Genera automáticamente la carpeta "Datos" con dos reportes: las cámaras 
   online con toda su información técnica, y un log de auditoría con las cámaras 
   que están configuradas en el NVR pero se encuentran offline en la red.

--------------------------------------------------------------------------------
3. ESTRUCTURA DE config_scanner.json
--------------------------------------------------------------------------------
Si necesitás crear el archivo de configuración desde cero, debés crear una 
carpeta llamada "Config" al lado del script y dentro un archivo de texto llamado 
"config_scanner.json". 

La estructura del archivo debe respetar estrictamente el siguiente formato JSON:

{
    "nvr_user": "apinfo",
    "opcion_puerto": "3",
    "max_workers": 20,
    "nvrs": [
        {"ip": "192.168.1.100"},
        {"ip": "192.168.1.101"},
        {"ip": "10.0.0.5"}
    ]
}

Explicación de los Campos:
- nvr_user (String): El nombre de usuario único/común para autenticarse en todos 
  los dispositivos de la red. Si lo quitás del JSON, el script lo pedirá por pantalla.
- opcion_puerto (String): Define la estrategia de escaneo de puertos de red:
  * "1": Escanea únicamente por HTTPS (Puerto 443). Intenta TLS 1.3 primero (si
    el entorno lo soporta), luego TLS 1.2+ y finalmente TLS 1.0 como último recurso.
  * "2": Escanea únicamente por protocolo básico HTTP (Puerto 80).
  * "3": Modo mixto. Recorre la cadena TLS completa en el puerto 443 y, como
    último recurso, cae a HTTP (80). Máxima compatibilidad.
- max_workers (Integer): Cantidad de hilos de ejecución concurrentes para la Fase 2. 
  Controla cuántas cámaras se consultan al mismo tiempo. Rango permitido de 1 a 50 
  (recomendado entre 5 y 20).
- nvrs (Array/Lista): Contiene el listado de diccionarios con las direcciones IP de 
  los grabadores (NVRs) a procesar en la Fase 1.

--------------------------------------------------------------------------------
4. COMPORTAMIENTO EN ENTORNOS LIMPIOS (NUEVAS PCs)
--------------------------------------------------------------------------------
Si ejecutas el script en una computadora nueva:
1. Al no encontrar el config_scanner.json, te pedirá el Usuario.
2. Te pedirá la Contraseña (no se mostrará en pantalla mientras la escribís). 
   Te preguntará si querés guardarla para siempre en el S.O.
3. Te pedirá las IPs de los NVRs separadas por coma (ej: 192.168.1.100, 192.168.1.101).
4. Te guiará para elegir puertos e hilos y el escaneo se completará con éxito.

--------------------------------------------------------------------------------
5. RESULTADOS GENERADOS (Carpeta "Datos")
--------------------------------------------------------------------------------
- cctv_online.json: Contiene dos secciones agrupadas:
  * "nvrs": Lista de todos los NVRs escaneados con su información técnica:
    ip, nvr_name, modelo, nro_serie, mac_address, firmware, protocolo_conexion
    y total_camaras. Los NVRs que no respondieron quedan como "Fallo/Offline".
  * "camaras": Lista de cámaras online con: ip_address, camera_name, mac_address,
    modelo, nro_serie, firmware, protocolo_conexion, nvr_name, nvr_ip y channel_id.
  El campo protocolo_conexion refleja cómo se conectó cada equipo:
  HTTPS/TLS1.3:443, HTTPS/TLS1.2+:443, HTTPS/TLS1.0:443 o HTTP:80.
- cctv_offline.log: Archivo de texto plano que funciona como bitácora de fallas. 
  Guarda el listado de cámaras caídas indicando su IP, de qué NVR proviene y qué 
  canal ocupaba para ir a revisarla físicamente.
================================================================================
"""

import os
import sys
import requests
import urllib3
import ssl
from requests.adapters import HTTPAdapter
from requests.auth import HTTPDigestAuth
import xml.etree.ElementTree as ET
import json
import re
import concurrent.futures
import keyring
import getpass
import ipaddress

# Silenciar advertencias de certificados autofirmados
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- DEFINICIÓN DE CARPETAS ---
CARPETA_CONFIG = "Config"
CARPETA_DATOS  = "Datos"

# --- ADAPTADORES TLS ---

class TLS13Adapter(HTTPAdapter):
    """TLS 1.3 exclusivo. Rechaza la conexión si el equipo no lo soporta,
    cayendo al siguiente intento en la cadena. Requiere Python ≥3.7 y OpenSSL ≥1.1.1."""
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.minimum_version = ssl.TLSVersion.TLSv1_3
        kwargs['ssl_context'] = ctx
        return super().init_poolmanager(*args, **kwargs)

class ModernTLSAdapter(HTTPAdapter):
    """TLS 1.2+ para cámaras y NVRs modernos (≥ 2018 aprox.).
    No valida certificado (autofirmados son la norma en CCTV),
    pero exige cifrados fuertes y rechaza TLS 1.0/1.1."""
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        kwargs['ssl_context'] = ctx
        return super().init_poolmanager(*args, **kwargs)

class LegacyTLSAdapter(HTTPAdapter):
    """TLS 1.0+ para equipos antiguos con cifrados débiles.
    Usado como fallback cuando ModernTLSAdapter falla."""
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            ctx.minimum_version = ssl.TLSVersion.TLSv1
        except AttributeError:
            pass
        try:
            ctx.set_ciphers('DEFAULT@SECLEVEL=1')
        except ssl.SSLError:
            pass
        kwargs['ssl_context'] = ctx
        return super().init_poolmanager(*args, **kwargs)

# Verificar disponibilidad de TLS 1.3 en este entorno (Python ≥3.7 + OpenSSL ≥1.1.1)
_TLS13_SUPPORTED = hasattr(ssl, 'TLSVersion') and hasattr(ssl.TLSVersion, 'TLSv1_3')

# Instancias reutilizables a nivel de módulo (una por tipo, no por cámara)
ADAPTERS = {
    "https_modern": ModernTLSAdapter(),
    "https_legacy": LegacyTLSAdapter(),
    "http":         HTTPAdapter(),
}
if _TLS13_SUPPORTED:
    ADAPTERS["https_tls13"] = TLS13Adapter()

_PROTO_LABEL = {
    "https_tls13":  "HTTPS/TLS1.3",
    "https_modern": "HTTPS/TLS1.2+",
    "https_legacy": "HTTPS/TLS1.0",
    "http":         "HTTP",
}

def describir_protocolo(key):
    return _PROTO_LABEL.get(key, key.upper())

# Cadena HTTPS construida según lo que soporta el entorno
_HTTPS_CHAIN = (
    [("https_tls13", "443")] if _TLS13_SUPPORTED else []
) + [("https_modern", "443"), ("https_legacy", "443")]

# ---------------------------------------------------------------------------
# GESTIÓN DE CONFIGURACIÓN
# ---------------------------------------------------------------------------

def cargar_config_json():
    ruta = os.path.join(CARPETA_CONFIG, "config_scanner.json")
    if os.path.exists(ruta):
        try:
            with open(ruta, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Error leyendo '{ruta}': {e}")
    return None

def pedir_puertos():
    OPCIONES = {
        "1": _HTTPS_CHAIN,
        "2": [("http", "80")],
        "3": _HTTPS_CHAIN + [("http", "80")],
    }
    print("  ┌── Puerto de conexión (NVRs y Cámaras) ──────────┐")
    if _TLS13_SUPPORTED:
        print("  │  1 · Solo HTTPS:443  (TLS 1.3 → 1.2 → 1.0)     │")
    else:
        print("  │  1 · Solo HTTPS:443  (TLS 1.2 → TLS 1.0)       │")
    print("  │  2 · Solo HTTP:80                               │")
    print("  │  3 · HTTPS:443 primero, luego HTTP:80           │")
    print("  └─────────────────────────────────────────────────┘")

    while True:
        opcion = input("  Elegí una opción [1/2/3, Enter=3]: ").strip()
        
        # Si el usuario solo aprieta Enter, forzamos la opción 3
        if opcion == "":
            return OPCIONES["3"]
            
        if opcion in OPCIONES:
            return OPCIONES[opcion]
            
        print("  [!] Ingresá 1, 2 o 3.")

def pedir_workers():
    MAX_PERMITIDO = 50
    print("\n  ┌── Hilos de Ejecución (Workers) ─────────────────┐")
    print(f"  │ Rango permitido : 1 – {MAX_PERMITIDO:<25} │")
    print("  │ Recomendado     : 5–15 en redes normales        │")
    print("  └─────────────────────────────────────────────────┘")

    while True:
        try:
            valor = input("  ¿Cuántas cámaras consultar al mismo tiempo? [Enter = 15]: ").strip()
            if valor == "":
                return 15
            workers = int(valor)
            if 1 <= workers <= MAX_PERMITIDO:
                return workers
            print(f"  [!] Ingresá un número entre 1 y {MAX_PERMITIDO}.")
        except ValueError:
            print("  [!] Ingresá solo un número entero.")

# ---------------------------------------------------------------------------
# FASE 1: Extracción desde NVRs
# ---------------------------------------------------------------------------

def obtener_camaras_desde_nvrs(nvr_list, puertos, user, password):
    if not nvr_list:
        return [], []

    camaras_base = []
    nvrs_info    = []

    print("\n--- FASE 1: Extrayendo cámaras desde los NVRs ---")
    for nvr in nvr_list:
        nvr_name     = "NVR_Desconocido"
        nvr_modelo   = "N/A"
        nvr_serial   = "N/A"
        nvr_mac      = "N/A"
        nvr_firmware = "N/A"
        nvr_conectado = False

        for protocolo_key, puerto in puertos:
            proto_real = "https" if protocolo_key.startswith("https") else "http"
            session = requests.Session()
            session.mount(f"{proto_real}://", ADAPTERS[protocolo_key])

            try:
                url_info = f"{proto_real}://{nvr['ip']}:{puerto}/ISAPI/System/deviceInfo"
                resp_info = session.get(
                    url_info, auth=HTTPDigestAuth(user, password),
                    timeout=5, verify=False
                )
                if resp_info.status_code == 200:
                    xml_info  = re.sub(' xmlns="[^"]+"', '', resp_info.text)
                    root_info = ET.fromstring(xml_info)

                    def _f(tag):
                        el = root_info.find(tag)
                        return el.text if el is not None else "N/A"

                    nvr_name     = _f('deviceName') or "NVR_Desconocido"
                    nvr_modelo   = _f('model')
                    serial_raw   = _f('serialNumber')
                    nvr_serial   = serial_raw[len(nvr_modelo):] if (serial_raw != "N/A" and serial_raw.startswith(nvr_modelo)) else serial_raw
                    nvr_mac      = _f('macAddress')
                    nvr_firmware = _f('firmwareVersion')

                etiqueta      = " (Fallback)" if (protocolo_key, puerto) != puertos[0] else ""
                proto_display = describir_protocolo(protocolo_key)
                print(f"Consultando NVR: {nvr_name} ({nvr['ip']}) en {proto_display}:{puerto}{etiqueta}...")

                url_cameras = f"{proto_real}://{nvr['ip']}:{puerto}/ISAPI/ContentMgmt/InputProxy/channels"
                response = session.get(
                    url_cameras, auth=HTTPDigestAuth(user, password),
                    timeout=10, verify=False
                )
                response.raise_for_status()
                xml_data = re.sub(' xmlns="[^"]+"', '', response.text)
                root = ET.fromstring(xml_data)

                camaras_nvr = 0
                for channel in root.findall('InputProxyChannel'):
                    chan_id_elem = channel.find('id')
                    chan_id = chan_id_elem.text if chan_id_elem is not None else "N/A"

                    ip_address = "N/A"
                    descriptor = channel.find('sourceInputPortDescriptor')
                    if descriptor is not None:
                        ip_elem = descriptor.find('ipAddress')
                        if ip_elem is not None and ip_elem.text:
                            ip_address = ip_elem.text

                    if ip_address and ip_address != "0.0.0.0" and ip_address != "N/A":
                        camaras_base.append({
                            "ip_address": ip_address,
                            "channel_id": int(chan_id) if chan_id.isdigit() else chan_id,
                            "nvr_ip":     nvr['ip'],
                            "nvr_name":   nvr_name
                        })
                        camaras_nvr += 1

                nvrs_info.append({
                    "ip":                nvr['ip'],
                    "nvr_name":          nvr_name,
                    "modelo":            nvr_modelo,
                    "nro_serie":         nvr_serial,
                    "mac_address":       nvr_mac,
                    "firmware":          nvr_firmware,
                    "protocolo_conexion": f"{describir_protocolo(protocolo_key)}:{puerto}",
                    "total_camaras":     camaras_nvr,
                })
                nvr_conectado = True
                print(f"  -> OK: {camaras_nvr} cámaras extraídas de {nvr['ip']}.")
                break

            except Exception as e:
                if (protocolo_key, puerto) != puertos[-1]:
                    print(f"  -> [WARN] NVR {nvr['ip']} no respondió en {describir_protocolo(protocolo_key)}:{puerto}. Probando siguiente...")
                else:
                    print(f"  -> [ERROR] Fallo total al consultar canales en NVR {nvr['ip']}: {e}")

        if not nvr_conectado:
            nvrs_info.append({
                "ip":                nvr['ip'],
                "nvr_name":          "Fallo/Offline",
                "modelo":            "N/A",
                "nro_serie":         "N/A",
                "mac_address":       "N/A",
                "firmware":          "N/A",
                "protocolo_conexion": "Fallo/Offline",
                "total_camaras":     0,
            })

    print(f"-> Total de cámaras encontradas en los NVRs: {len(camaras_base)}")
    return camaras_base, nvrs_info

# ---------------------------------------------------------------------------
# FASE 2: Extracción directa a cada cámara
# ---------------------------------------------------------------------------

def intentar_conexion(ip, protocolo_key, puerto, user, password):
    proto_real = "https" if protocolo_key.startswith("https") else "http"
    url = f"{proto_real}://{ip}:{puerto}/ISAPI/System/deviceInfo"
    session = requests.Session()
    session.mount(f"{proto_real}://", ADAPTERS[protocolo_key])
    response = session.get(
        url,
        auth=HTTPDigestAuth(user, password),
        timeout=5,
        verify=False
    )
    response.raise_for_status()
    return response

def procesar_camara(args):
    cam_data, puertos, user, password = args
    ip = cam_data['ip_address']

    response     = None
    protocolo_ok = None
    puerto_ok    = None

    for protocolo_key, puerto in puertos:
        try:
            response     = intentar_conexion(ip, protocolo_key, puerto, user, password)
            protocolo_ok = protocolo_key
            puerto_ok    = puerto
            etiqueta      = "(fallback)" if (protocolo_key, puerto) != puertos[0] else ""
            proto_display = describir_protocolo(protocolo_key)
            print(f"[OK] {ip} → {proto_display}:{puerto} {etiqueta}".strip())
            break
        except requests.exceptions.RequestException:
            if (protocolo_key, puerto) != puertos[-1]:
                print(f"[WARN] {ip} no respondió en {describir_protocolo(protocolo_key)}:{puerto}. Probando siguiente...")

    camera_name       = "N/A"
    mac_address       = "N/A"
    modelo            = "N/A"
    nro_serie         = "N/A"
    firmware          = "N/A"
    protocolo_conexion = "Fallo/Offline"

    if response is not None:
        try:
            xml_info  = re.sub(' xmlns="[^"]+"', '', response.text)
            root_info = ET.fromstring(xml_info)

            def texto(tag):
                el = root_info.find(tag)
                return el.text if el is not None else "N/A"

            modelo     = texto('model')
            serial_raw = texto('serialNumber')

            if serial_raw != "N/A" and serial_raw.startswith(modelo):
                nro_serie = serial_raw[len(modelo):]
            else:
                nro_serie = serial_raw

            camera_name        = texto('deviceName')
            mac_address        = texto('macAddress')
            firmware           = texto('firmwareVersion')
            protocolo_conexion = f"{describir_protocolo(protocolo_ok)}:{puerto_ok}"

        except Exception as e:
            print(f"[ERROR XML] Fallo al leer datos de {ip}: {e}")
    else:
        intentados = ", ".join(f"{describir_protocolo(p)}:{pt}" for p, pt in puertos)
        print(f"[ERROR] {ip} no respondió en ningún puerto ({intentados}).")

    camara_ordenada = {
        "ip_address":        cam_data["ip_address"],
        "camera_name":       camera_name,
        "mac_address":       mac_address,
        "modelo":            modelo,
        "nro_serie":         nro_serie,
        "firmware":          firmware,
        "protocolo_conexion": protocolo_conexion,
        "nvr_name":          cam_data["nvr_name"],
        "nvr_ip":            cam_data["nvr_ip"],
        "channel_id":        cam_data["channel_id"],
    }

    return camara_ordenada

# ---------------------------------------------------------------------------
# MAIN - Orquestador
# ---------------------------------------------------------------------------

def ejecutar_escaneo_unificado():
    config_data      = cargar_config_json()
    usar_interactivo = (config_data is None)

    print("\n=========================================")
    print("      DAEMON DE ESCANEO CCTV ISAPI       ")
    print("=========================================")

    # --- OFRECER DOCUMENTACIÓN EN MODO MANUAL ---
    if usar_interactivo:
        print("\n[INFO] No se detectó el archivo de configuración 'config_scanner.json'.")
        ver_ayuda = input("  ¿Querés ver la documentación de uso antes de continuar? [s/n, Enter=n]: ").strip().lower()
        if ver_ayuda == 's':
            print(__doc__)
            print("="*80)
            input("Presioná Enter para continuar con el asistente manual...")

    # 1. Determinar Usuario
    user = None
    if config_data and "nvr_user" in config_data:
        user = str(config_data["nvr_user"]).strip()

    if not user:
        print("\n[!] No se detectó usuario en la configuración.")
        user = input("  -> Ingresá el usuario de los NVRs/Cámaras: ").strip()
        if not user:
            print("[ERROR] El usuario no puede estar vacío. Saliendo.")
            return
        usar_interactivo = True

    # 2. Determinar Contraseña
    password = keyring.get_password("CCTV_Daemon", user)

    if not password:
        print(f"\n[INFO] No hay credenciales guardadas en el Sistema Operativo para '{user}'.")
        password = getpass.getpass(f"  -> Ingresá la contraseña para '{user}' (no se va a ver al escribir): ").strip()

        if not password:
            print("[ERROR] La contraseña no puede estar vacía. Saliendo.")
            return
        usar_interactivo = True

        guardar = input(f"  ¿Querés guardar esta clave en el S.O. para no tener que tipearla más? [s/n]: ").strip().lower()
        if guardar == 's':
            try:
                keyring.set_password("CCTV_Daemon", user, password)
                print("[OK] Contraseña guardada de forma segura en el Administrador de Credenciales.")
            except Exception as e:
                print(f"[WARN] No se pudo guardar la clave en el almacén del sistema: {e}")

    # 3. Determinar lista de NVRs
    nvr_list = []
    if config_data and "nvrs" in config_data:
        nvr_list = config_data["nvrs"]

    if not nvr_list:
        print(f"\n[INFO] No se encontró una lista de NVRs en el archivo de configuración.")
        
        while True:
            print("  Ingresá las IPs de los NVRs separadas por coma")
            ips_input = input("  -> Ejemplo [192.168.1.100, 192.168.1.101]: ").strip()

            if not ips_input:
                print("  [ERROR] No ingresaste ninguna IP. Intentá de nuevo.\n")
                continue

            # Separamos el string por comas y limpiamos los espacios
            ips_crudas = [ip.strip() for ip in ips_input.split(",") if ip.strip()]
            
            nvr_list_temp = []
            errores_ip = False

            for ip_str in ips_crudas:
                try:
                    # ipaddress valida que el formato sea estrictamente una IPv4 o IPv6 real
                    ipaddress.ip_address(ip_str)
                    nvr_list_temp.append({"ip": ip_str})
                except ValueError:
                    print(f"  [!] FORMATO INVÁLIDO: La dirección '{ip_str}' no es una IP real.")
                    errores_ip = True

            # Si hubo al menos un error, reiniciamos el bucle
            if errores_ip:
                print("  [!] Por favor, ingresá la lista de IPs nuevamente y sin errores.\n")
            else:
                # Si todo está perfecto, guardamos la lista y salimos del bucle
                nvr_list = nvr_list_temp
                break
                
        usar_interactivo = True

    # 4. Determinar Puertos y Workers
    OPCIONES_PUERTOS = {
        "1": _HTTPS_CHAIN,
        "2": [("http", "80")],
        "3": _HTTPS_CHAIN + [("http", "80")],
    }
    puertos     = None
    max_workers = None

    if not usar_interactivo:
        op = str(config_data.get("opcion_puerto", "")).strip()
        mw = config_data.get("max_workers")
        if op in OPCIONES_PUERTOS and isinstance(mw, int) and 1 <= mw <= 50:
            puertos     = OPCIONES_PUERTOS[op]
            max_workers = mw
            print(f"\n[INFO] Configuración e Inventario cargados automáticamente desde el JSON.")
        else:
            print(f"\n[WARN] Parámetros de red inválidos en JSON. Pasando a modo manual...")
            usar_interactivo = True

    if usar_interactivo or puertos is None:
        print("\n--- CONFIGURACIÓN DE RED ---")
        puertos = pedir_puertos()

    if usar_interactivo or max_workers is None:
        max_workers = pedir_workers()

    # 5. Ejecución de Fase 1
    camaras_base, nvrs_info = obtener_camaras_desde_nvrs(nvr_list, puertos, user, password)
    if not camaras_base:
        print("\n[ERROR] No se pudieron extraer canales de los NVRs provistos. Saliendo.")
        return

    desc_puertos = " → ".join(f"{describir_protocolo(p)}:{pt}" for p, pt in puertos)
    print(f"\nIniciando escaneo asíncrono ({max_workers} simultáneas · {desc_puertos})...\n")

    # 6. Ejecución de Fase 2
    args             = [(cam, puertos, user, password) for cam in camaras_base]
    camaras_completas = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        for resultado in executor.map(procesar_camara, args):
            camaras_completas.append(resultado)

    camaras_exitosas = [c for c in camaras_completas if c["protocolo_conexion"] != "Fallo/Offline"]
    camaras_fallidas = [c for c in camaras_completas if c["protocolo_conexion"] == "Fallo/Offline"]

    # 7. Almacenamiento de reportes
    os.makedirs(CARPETA_DATOS, exist_ok=True)

    archivo_salida = os.path.join(CARPETA_DATOS, "cctv_online.json")
    with open(archivo_salida, "w", encoding="utf-8") as f:
        json.dump({"nvrs": nvrs_info, "camaras": camaras_exitosas}, f, indent=4, ensure_ascii=False)

    archivo_log = os.path.join(CARPETA_DATOS, "cctv_offline.log")
    with open(archivo_log, "w", encoding="utf-8") as f_log:
        if camaras_fallidas:
            f_log.write("=== CÁMARAS QUE NO RESPONDIERON AL ESCANEO DIRECTO ===\n")
            for cam in camaras_fallidas:
                f_log.write(f"IP: {cam['ip_address']} | Proveniente del NVR: {cam['nvr_name']} ({cam['nvr_ip']}) | Canal NVR: {cam['channel_id']}\n")
        else:
            f_log.write("Todas las cámaras respondieron correctamente de forma directa. ¡0 fallas!")

    print(f"\n--- RESUMEN ---")
    print(f"Total NVRs procesados               : {len(nvr_list)}")
    print(f"Total cámaras identificadas en NVRs : {len(camaras_base)}")
    print(f"Cámaras online (JSON de salida)     : {len(camaras_exitosas)}")
    print(f"Cámaras offline (Log de errores)    : {len(camaras_fallidas)}")
    print(f"-> Archivo generado                 : '{archivo_salida}'")
    print(f"-> Log de errores generado          : '{archivo_log}'")

if __name__ == "__main__":
    # Soporte para --help en terminal de comandos de forma directa
    if len(sys.argv) > 1 and sys.argv[1].lower() in ["--help", "-h", "--ayuda"]:
        print(__doc__)
        print("="*80)
        input("Presioná Enter para cerrar...")
        sys.exit(0)

    try:
        ejecutar_escaneo_unificado()
    except Exception as e:
        print(f"\nOcurrió un error grave: {e}")

    print("\n" + "="*40)
    input("Presiona Enter para cerrar la ventana...")