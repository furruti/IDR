# Importación CCTV infraestructura

## Diagnóstico y formato legacy

La aplicación legacy SGC persiste el estado en `localStorage` con la clave `cctvs:cctv_data_v1`. El payload que sube/baja GistSync usa el archivo `cctv_data.json` y contiene `dispositivos`, `grabadores`, `otros_prod`, `tiposCustom`, `edificios`, `version`, `fecha` y `hash`.

`otros_prod` contiene los dispositivos en producción que deben importarse como infraestructura. Sus campos reales sanitizados son: `id`, `dispositivoId`, `descripcion`, `ip`, `edificio`, `piso`, `rack`, `puerto`, `comentarios`, `updatedAt`.

La ficha de inventario enlazada por `otros_prod.dispositivoId` vive en `dispositivos`. Para servidores, monitores, PC y teclados de red se usan los tipos legacy `servidor`, `monitor`, `pc`, `teclado_red` y los campos sanitizados: `id`, `tipo`, `estado`, `marca`, `modelo`, `serial`, `mac`, `patrimonio`, `firmware`, `comentario`, `updatedAt`. El adaptador PostgreSQL también reconoce `hostname` y `rol`/`role` si vienen en payloads más nuevos.

No todos los campos existen en todos los registros. El importador no inventa datos faltantes.

## Archivo de entrada

Guardar el export real en:

```bash
backend/data/cctv-legacy-import.json
```

Hay un ejemplo mínimo en:

```bash
backend/data/cctv-legacy-import.example.json
```

El archivo real no debe contener tokens de Gist ni secretos. Se aceptan estas formas:

```json
{ "dispositivos": [], "grabadores": [], "otros_prod": [] }
```

```json
{ "_data": { "dispositivos": [], "grabadores": [], "otros_prod": [] } }
```

```json
{ "otros_prod": [] }
```

Si se usa solo `{ "otros_prod": [] }`, cada registro debe traer suficiente información propia (`tipo`, nombre/serial/inventario) porque no habrá `dispositivos` para resolver `dispositivoId`.

## Ejecución

Dry-run:

```bash
cd backend
npm run import:cctv-infrastructure -- --file backend/data/cctv-legacy-import.json --dry-run
```

Importación:

```bash
cd backend
DATABASE_URL=postgresql://usuario:password@host:5432/idr npm run import:cctv-infrastructure -- --file backend/data/cctv-legacy-import.json
```

Validar conteo completo esperado (27 servidores, 6 monitores, 4 PC, 4 teclados de red):

```bash
npm run import:cctv-infrastructure -- --file backend/data/cctv-legacy-import.json --dry-run --expect-complete
```

## Validaciones

Antes de escribir, el script muestra total, conteo por tipo, registros sin ID, sin tipo, IP inválidas, MAC inválidas, IDs duplicados, inventarios duplicados y seriales duplicados. Si hay errores críticos no inserta datos.

Las ubicaciones (`edificio`, `piso`, `rack`) se buscan en PostgreSQL. Si no coinciden, no se crean por defecto: la referencia queda en `NULL` y el valor original queda en `metadata.legacy` / `metadata.unresolvedLocation`.

Opcionalmente se pueden crear ubicaciones faltantes:

```bash
npm run import:cctv-infrastructure -- --file backend/data/cctv-legacy-import.json --create-missing-locations
```

Usar esa opción solo después de revisar nombres para no crear ubicaciones erróneas.

## UPSERT e idempotencia

La clave estable prioriza `legacy_id`; si no existe usa inventario; si no existe usa `tipo + nombre + serial`. El `id` PostgreSQL se genera con SHA-1 truncado, por lo que ejecuciones repetidas actualizan los mismos registros y no duplican.

## Verificación

Conteo global por tipo:

```sql
SELECT device_type, COUNT(*)
FROM idr.cctv_devices
GROUP BY device_type
ORDER BY device_type;
```

Conteo específico de infraestructura:

```sql
SELECT d.device_type, COUNT(*)
FROM idr.infrastructure_devices i
JOIN idr.cctv_devices d ON d.id = i.device_id
GROUP BY d.device_type
ORDER BY d.device_type;
```

Detalle operativo:

```sql
SELECT
  d.device_type AS tipo,
  COALESCE(i.description, d.description) AS nombre,
  d.asset_number AS inventario,
  i.ip_address::text AS ip,
  b.name AS edificio,
  f.name AS piso,
  r.code AS rack,
  i.hostname,
  i.role
FROM idr.infrastructure_devices i
JOIN idr.cctv_devices d ON d.id = i.device_id
LEFT JOIN idr.buildings b ON b.id = i.building_id
LEFT JOIN idr.floors f ON f.id = i.floor_id
LEFT JOIN idr.racks r ON r.id = i.rack_id
ORDER BY d.device_type, nombre NULLS LAST;
```

Duplicados útiles:

```sql
SELECT legacy_id, COUNT(*) FROM idr.cctv_devices WHERE legacy_id IS NOT NULL GROUP BY legacy_id HAVING COUNT(*) > 1;
SELECT asset_number, COUNT(*) FROM idr.cctv_devices WHERE asset_number IS NOT NULL GROUP BY asset_number HAVING COUNT(*) > 1;
SELECT serial_number, COUNT(*) FROM idr.cctv_devices WHERE serial_number IS NOT NULL GROUP BY serial_number HAVING COUNT(*) > 1;
```

## Reversión

Si la importación falla, la transacción hace rollback completo. Para revertir una importación exitosa por IDs legacy:

```sql
BEGIN;
DELETE FROM idr.cctv_devices
WHERE device_type IN ('server', 'monitor', 'pc', 'network_keyboard')
  AND legacy_id IS NOT NULL;
COMMIT;
```

`infrastructure_devices` se elimina en cascada por la FK.

## Segunda ejecución

Ejecutar nuevamente el importador con el mismo JSON debe terminar sin duplicar por el UPSERT estable. Verificar con las consultas de conteo y duplicados.
