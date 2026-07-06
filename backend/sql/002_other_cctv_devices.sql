-- ============================================================
-- IDR - CCTV infrastructure devices migration
-- Adds support for non-camera/non-recorder CCTV devices.
--
-- Legacy audit source:
-- - legacy/frontend-vanilla/SGC/app.js stores cameras in _data.dispositivos,
--   recorders in _data.grabadores and production infrastructure items in
--   _data.otros_prod.
-- - _data.otros_prod has: id, dispositivoId, descripcion, ip, edificio,
--   piso, rack, puerto, comentarios, updatedAt.
-- - The actual inventory fields for infrastructure devices live in the
--   linked _data.dispositivos record: id, tipo, estado, mac, serial, canales,
--   marca, modelo, patrimonio, firmware, forma, comentario, updatedAt.
--
-- IMPORTANT: this migration intentionally does not invent the 41 legacy rows.
-- Populate legacy_source below only with records exported from the real legacy
-- cctv_data.json/Gist/localStorage payload before applying in production.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS idr;
SET search_path TO idr, public;

ALTER TABLE idr.cctv_devices
  DROP CONSTRAINT IF EXISTS cctv_devices_device_type_check;

ALTER TABLE idr.cctv_devices
  ADD CONSTRAINT cctv_devices_device_type_check
  CHECK (device_type IN ('camera', 'nvr', 'dvr', 'server', 'monitor', 'pc', 'network_keyboard'));

ALTER TABLE idr.cctv_devices
  ADD COLUMN IF NOT EXISTS description text;

CREATE TABLE IF NOT EXISTS idr.infrastructure_devices (
    device_id   text PRIMARY KEY REFERENCES idr.cctv_devices(id)
                    ON UPDATE CASCADE ON DELETE CASCADE,
    ip_address  inet,
    building_id uuid REFERENCES idr.buildings(id)
                    ON UPDATE CASCADE ON DELETE SET NULL,
    floor_id    uuid REFERENCES idr.floors(id)
                    ON UPDATE CASCADE ON DELETE SET NULL,
    rack_id     uuid REFERENCES idr.racks(id)
                    ON UPDATE CASCADE ON DELETE SET NULL,
    hostname    text,
    role        text,
    description text,
    port        text,
    metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_infrastructure_devices_ip
    ON idr.infrastructure_devices(ip_address)
    WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_infrastructure_devices_building_floor
    ON idr.infrastructure_devices(building_id, floor_id);

CREATE INDEX IF NOT EXISTS ix_infrastructure_devices_rack
    ON idr.infrastructure_devices(rack_id)
    WHERE rack_id IS NOT NULL;

-- Real legacy rows must be inserted here as exported data. Keep this CTE empty
-- in source control to avoid fabricated records.
WITH legacy_source (
    id, device_type, status, brand, model, serial_number, mac_address,
    asset_number, firmware, comments, description, ip_address,
    building_name, floor_name, rack_code, hostname, role, port, metadata
) AS (
    SELECT * FROM (VALUES
        -- ('legacy-id', 'server', NULL, 'brand', 'model', 'serial', 'AA:BB:CC:DD:EE:FF',
        --  'asset', 'firmware', 'comments', 'description', '10.0.0.1',
        --  'Anexo A', '1ss', 'RACK 12', 'host', 'role', '443', '{}'::jsonb)
    ) AS v(
        id, device_type, status, brand, model, serial_number, mac_address,
        asset_number, firmware, comments, description, ip_address,
        building_name, floor_name, rack_code, hostname, role, port, metadata
    )
    WHERE false
), normalized AS (
    SELECT
        id::text,
        device_type::text,
        NULLIF(status::text, '') AS status,
        NULLIF(brand::text, '') AS brand,
        NULLIF(model::text, '') AS model,
        NULLIF(serial_number::text, '') AS serial_number,
        CASE
          WHEN NULLIF(mac_address::text, '') IS NULL THEN NULL
          ELSE upper(regexp_replace(mac_address::text, '[-.]', ':', 'g'))
        END AS mac_address,
        NULLIF(asset_number::text, '') AS asset_number,
        NULLIF(firmware::text, '') AS firmware,
        NULLIF(comments::text, '') AS comments,
        NULLIF(description::text, '') AS description,
        NULLIF(ip_address::text, '')::inet AS ip_address,
        NULLIF(building_name::text, '') AS building_name,
        NULLIF(floor_name::text, '') AS floor_name,
        NULLIF(rack_code::text, '') AS rack_code,
        NULLIF(hostname::text, '') AS hostname,
        NULLIF(role::text, '') AS role,
        NULLIF(port::text, '') AS port,
        COALESCE(metadata, '{}'::jsonb) AS metadata
    FROM legacy_source
), upsert_buildings AS (
    INSERT INTO idr.buildings (name)
    SELECT DISTINCT building_name FROM normalized WHERE building_name IS NOT NULL
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name
), all_buildings AS (
    SELECT id, name FROM upsert_buildings
    UNION
    SELECT id, name FROM idr.buildings WHERE name IN (SELECT building_name FROM normalized)
), upsert_floors AS (
    INSERT INTO idr.floors (building_id, name)
    SELECT DISTINCT b.id, n.floor_name
    FROM normalized n
    JOIN all_buildings b ON b.name = n.building_name
    WHERE n.floor_name IS NOT NULL
    ON CONFLICT (building_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, building_id, name
), all_floors AS (
    SELECT id, building_id, name FROM upsert_floors
    UNION
    SELECT id, building_id, name FROM idr.floors
    WHERE (building_id, name) IN (SELECT b.id, n.floor_name FROM normalized n JOIN all_buildings b ON b.name = n.building_name)
), upsert_racks AS (
    INSERT INTO idr.racks (building_id, floor_id, code)
    SELECT DISTINCT b.id, f.id, n.rack_code
    FROM normalized n
    JOIN all_buildings b ON b.name = n.building_name
    LEFT JOIN all_floors f ON f.building_id = b.id AND f.name = n.floor_name
    WHERE n.rack_code IS NOT NULL
    ON CONFLICT (building_id, floor_id, code) DO UPDATE SET code = EXCLUDED.code
    RETURNING id, building_id, floor_id, code
), all_racks AS (
    SELECT id, building_id, floor_id, code FROM upsert_racks
    UNION
    SELECT id, building_id, floor_id, code FROM idr.racks
    WHERE code IN (SELECT rack_code FROM normalized WHERE rack_code IS NOT NULL)
), upsert_devices AS (
    INSERT INTO idr.cctv_devices (
      id, device_type, status, brand, model, serial_number, mac_address,
      asset_number, firmware, comments, description
    )
    SELECT id, device_type, status, brand, model, serial_number, mac_address,
      asset_number, firmware, comments, description
    FROM normalized
    ON CONFLICT (id) DO UPDATE SET
      device_type = EXCLUDED.device_type,
      status = EXCLUDED.status,
      brand = EXCLUDED.brand,
      model = EXCLUDED.model,
      serial_number = EXCLUDED.serial_number,
      mac_address = EXCLUDED.mac_address,
      asset_number = EXCLUDED.asset_number,
      firmware = EXCLUDED.firmware,
      comments = EXCLUDED.comments,
      description = EXCLUDED.description,
      updated_at = now()
    RETURNING id
)
INSERT INTO idr.infrastructure_devices (
  device_id, ip_address, building_id, floor_id, rack_id, hostname, role,
  description, port, metadata
)
SELECT n.id, n.ip_address, b.id, f.id, r.id, n.hostname, n.role,
  n.description, n.port, n.metadata
FROM normalized n
LEFT JOIN all_buildings b ON b.name = n.building_name
LEFT JOIN all_floors f ON f.building_id = b.id AND f.name = n.floor_name
LEFT JOIN all_racks r ON r.building_id = b.id
  AND r.code = n.rack_code
  AND (r.floor_id = f.id OR (r.floor_id IS NULL AND f.id IS NULL))
ON CONFLICT (device_id) DO UPDATE SET
  ip_address = EXCLUDED.ip_address,
  building_id = EXCLUDED.building_id,
  floor_id = EXCLUDED.floor_id,
  rack_id = EXCLUDED.rack_id,
  hostname = EXCLUDED.hostname,
  role = EXCLUDED.role,
  description = EXCLUDED.description,
  port = EXCLUDED.port,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Verification query expected after real rows are added to legacy_source:
-- camera: 422, monitor: 6, network_keyboard: 4, nvr: 6, pc: 4, server: 27
SELECT device_type, COUNT(*)
FROM idr.cctv_devices
GROUP BY device_type
ORDER BY device_type;

COMMIT;
