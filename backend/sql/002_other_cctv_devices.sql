-- ============================================================
-- IDR - CCTV infrastructure devices structure migration
-- Adds/keeps support for non-camera/non-recorder CCTV devices.
--
-- IMPORTANT: this repository checkout does not include the real legacy
-- cctv_data.json payload. Do not invent the 41 rows. Load the exported
-- legacy payload with backend/scripts/import-cctv-infrastructure.js after
-- applying this structural migration.
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

ALTER TABLE idr.cctv_devices
  ADD COLUMN IF NOT EXISTS legacy_id text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cctv_devices_legacy_id
  ON idr.cctv_devices(legacy_id)
  WHERE legacy_id IS NOT NULL;

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

-- Verification query expected after importing the real legacy payload:
-- SELECT device_type, COUNT(*)
-- FROM idr.cctv_devices
-- GROUP BY device_type
-- ORDER BY device_type;
-- Expected final counts:
-- camera=422, monitor=6, network_keyboard=4, nvr=6, pc=4, server=27.

COMMIT;
