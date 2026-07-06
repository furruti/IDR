-- ============================================================
-- IDR - CCTV infrastructure devices structure migration
-- Adds/keeps support for non-camera/non-recorder CCTV devices.
--
-- Data import is intentionally separated from this migration. Do not embed
-- the 41 legacy rows here; use backend/scripts/import-cctv-infrastructure.js
-- with an exported cctv_data.json/localStorage/Gist payload.
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

COMMIT;
