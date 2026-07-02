-- ============================================================
-- IDR - ESQUEMA POSTGRESQL COMPLETO
-- Módulos:
--   CCTV / Racks / Switches / Patcheras
--   Materiales / Incidencias / Licencias
-- PostgreSQL 16+
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS idr;
SET search_path TO idr, public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- FUNCIONES GENERALES
-- ============================================================

CREATE OR REPLACE FUNCTION idr.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================
-- UBICACIONES
-- ============================================================

CREATE TABLE IF NOT EXISTS buildings (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    address     text,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS floors (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id uuid NOT NULL REFERENCES buildings(id)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
    name        text NOT NULL,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (building_id, name)
);

CREATE TABLE IF NOT EXISTS racks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id uuid NOT NULL REFERENCES buildings(id)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
    floor_id    uuid REFERENCES floors(id)
                    ON UPDATE CASCADE ON DELETE SET NULL,
    code        text NOT NULL,
    description text,
    sector      text,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (building_id, floor_id, code)
);

-- ============================================================
-- SWITCHES Y PATCHERAS
-- Son datos auxiliares para relacionar CCTV con infraestructura.
-- ============================================================

CREATE TABLE IF NOT EXISTS switches (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           text NOT NULL UNIQUE,
    management_ip  inet,
    rack_id        uuid REFERENCES racks(id)
                       ON UPDATE CASCADE ON DELETE SET NULL,
    brand          text,
    model          text,
    description    text,
    active         boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_switch_management_ip
    ON switches(management_ip)
    WHERE management_ip IS NOT NULL;

CREATE TABLE IF NOT EXISTS patch_panels (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rack_id     uuid NOT NULL REFERENCES racks(id)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
    name        text NOT NULL,
    port_count  integer NOT NULL CHECK (port_count > 0),
    description text,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (rack_id, name)
);

CREATE TABLE IF NOT EXISTS patch_panel_ports (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patch_panel_id    uuid NOT NULL REFERENCES patch_panels(id)
                          ON UPDATE CASCADE ON DELETE CASCADE,
    port_number       integer NOT NULL CHECK (port_number > 0),
    destination       text,
    switch_id         uuid REFERENCES switches(id)
                          ON UPDATE CASCADE ON DELETE SET NULL,
    switch_port       text,
    description       text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (patch_panel_id, port_number)
);

-- ============================================================
-- CCTV: CÁMARAS, NVR Y DVR
-- ============================================================

CREATE TABLE IF NOT EXISTS cctv_devices (
    id                 text PRIMARY KEY,
    device_type        text NOT NULL CHECK (device_type IN ('camera','nvr','dvr')),
    status             text,
    brand              text,
    model              text,
    serial_number      text,
    mac_address        varchar(17),
    asset_number       text,
    firmware           text,
    comments           text,
    source_updated_at  timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cctv_mac_format_chk CHECK (
        mac_address IS NULL OR
        mac_address ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cctv_devices_mac
    ON cctv_devices (upper(mac_address))
    WHERE mac_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_cctv_devices_type
    ON cctv_devices(device_type);

CREATE INDEX IF NOT EXISTS ix_cctv_devices_status
    ON cctv_devices(status);

CREATE TABLE IF NOT EXISTS cameras (
    device_id       text PRIMARY KEY REFERENCES cctv_devices(id)
                        ON UPDATE CASCADE ON DELETE CASCADE,
    form_factor     text,
    description     text,
    ip_address      inet,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cameras_ip
    ON cameras(ip_address)
    WHERE ip_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS recorders (
    device_id         text PRIMARY KEY REFERENCES cctv_devices(id)
                          ON UPDATE CASCADE ON DELETE CASCADE,
    recorder_type     text NOT NULL CHECK (recorder_type IN ('nvr','dvr')),
    description       text,
    ip_address        inet,
    channel_capacity  integer NOT NULL CHECK (channel_capacity > 0),
    rack_id           uuid REFERENCES racks(id)
                          ON UPDATE CASCADE ON DELETE SET NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_recorders_ip
    ON recorders(ip_address)
    WHERE ip_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS recorder_channels (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recorder_id     text NOT NULL REFERENCES recorders(device_id)
                        ON UPDATE CASCADE ON DELETE CASCADE,
    channel_number  integer NOT NULL CHECK (channel_number > 0),
    camera_id       text REFERENCES cameras(device_id)
                        ON UPDATE CASCADE ON DELETE SET NULL,
    description     text,
    enabled         boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (recorder_id, channel_number)
);

CREATE INDEX IF NOT EXISTS ix_recorder_channels_camera
    ON recorder_channels(camera_id);

-- Ubicación física de la cámara.
CREATE TABLE IF NOT EXISTS camera_locations (
    camera_id    text PRIMARY KEY REFERENCES cameras(device_id)
                     ON UPDATE CASCADE ON DELETE CASCADE,
    building_id  uuid REFERENCES buildings(id)
                     ON UPDATE CASCADE ON DELETE SET NULL,
    floor_id     uuid REFERENCES floors(id)
                     ON UPDATE CASCADE ON DELETE SET NULL,
    sector       text,
    description  text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Conexión de red de la cámara.
-- switch_id puede quedar NULL hasta que se cargue el nombre real del switch.
CREATE TABLE IF NOT EXISTS camera_network_connections (
    camera_id      text PRIMARY KEY REFERENCES cameras(device_id)
                       ON UPDATE CASCADE ON DELETE CASCADE,
    switch_id      uuid REFERENCES switches(id)
                       ON UPDATE CASCADE ON DELETE SET NULL,
    switch_port    text,
    rack_id        uuid REFERENCES racks(id)
                       ON UPDATE CASCADE ON DELETE SET NULL,
    patch_port_id  uuid REFERENCES patch_panel_ports(id)
                       ON UPDATE CASCADE ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INCIDENCIAS
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS incident_number_seq START 1;

CREATE TABLE IF NOT EXISTS incidents (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_number    text NOT NULL UNIQUE DEFAULT
                       ('INC-' || to_char(current_date, 'YYYY') || '-' ||
                        lpad(nextval('incident_number_seq')::text, 6, '0')),
    title              text NOT NULL,
    description        text,
    incident_type      text,
    priority           text NOT NULL DEFAULT 'normal'
                       CHECK (priority IN ('low','normal','high','critical')),
    status             text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open','assigned','in_progress','resolved','closed','cancelled')),
    building_id        uuid REFERENCES buildings(id)
                           ON UPDATE CASCADE ON DELETE SET NULL,
    floor_id           uuid REFERENCES floors(id)
                           ON UPDATE CASCADE ON DELETE SET NULL,
    sector             text,
    assigned_to        text,
    reported_by        text,
    opened_at          timestamptz NOT NULL DEFAULT now(),
    resolved_at        timestamptz,
    closed_at          timestamptz,
    resolution_notes   text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_incidents_status
    ON incidents(status);

CREATE INDEX IF NOT EXISTS ix_incidents_opened_at
    ON incidents(opened_at DESC);

CREATE TABLE IF NOT EXISTS incident_cctv_devices (
    incident_id  uuid NOT NULL REFERENCES incidents(id)
                     ON UPDATE CASCADE ON DELETE CASCADE,
    device_id    text NOT NULL REFERENCES cctv_devices(id)
                     ON UPDATE CASCADE ON DELETE RESTRICT,
    notes        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (incident_id, device_id)
);

-- ============================================================
-- MATERIALES Y STOCK
-- ============================================================

CREATE TABLE IF NOT EXISTS material_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    description text,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code             text NOT NULL UNIQUE,
    name             text NOT NULL,
    category_id      uuid REFERENCES material_categories(id)
                         ON UPDATE CASCADE ON DELETE SET NULL,
    description      text,
    unit_of_measure  text NOT NULL DEFAULT 'unidad',
    minimum_stock    numeric(14,3) NOT NULL DEFAULT 0
                     CHECK (minimum_stock >= 0),
    storage_location text,
    active           boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS material_movements (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id    uuid NOT NULL REFERENCES materials(id)
                       ON UPDATE CASCADE ON DELETE RESTRICT,
    movement_type  text NOT NULL
                   CHECK (movement_type IN ('entry','exit','return','adjustment')),
    quantity       numeric(14,3) NOT NULL CHECK (quantity <> 0),
    incident_id    uuid REFERENCES incidents(id)
                       ON UPDATE CASCADE ON DELETE SET NULL,
    reference      text,
    reason         text,
    performed_by   text,
    movement_at    timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT material_movement_sign_chk CHECK (
        (movement_type IN ('entry','return') AND quantity > 0)
        OR (movement_type = 'exit' AND quantity > 0)
        OR (movement_type = 'adjustment')
    )
);

CREATE INDEX IF NOT EXISTS ix_material_movements_material
    ON material_movements(material_id, movement_at DESC);

CREATE INDEX IF NOT EXISTS ix_material_movements_incident
    ON material_movements(incident_id)
    WHERE incident_id IS NOT NULL;

CREATE OR REPLACE VIEW material_stock AS
SELECT
    m.id,
    m.code,
    m.name,
    m.unit_of_measure,
    m.minimum_stock,
    COALESCE(SUM(
        CASE
            WHEN mm.movement_type IN ('entry','return') THEN mm.quantity
            WHEN mm.movement_type = 'exit' THEN -mm.quantity
            WHEN mm.movement_type = 'adjustment' THEN mm.quantity
            ELSE 0
        END
    ), 0)::numeric(14,3) AS current_stock,
    (
        COALESCE(SUM(
            CASE
                WHEN mm.movement_type IN ('entry','return') THEN mm.quantity
                WHEN mm.movement_type = 'exit' THEN -mm.quantity
                WHEN mm.movement_type = 'adjustment' THEN mm.quantity
                ELSE 0
            END
        ), 0) <= m.minimum_stock
    ) AS low_stock
FROM materials m
LEFT JOIN material_movements mm ON mm.material_id = m.id
GROUP BY m.id, m.code, m.name, m.unit_of_measure, m.minimum_stock;

-- Evita que una salida deje stock negativo.
CREATE OR REPLACE FUNCTION idr.validate_material_stock()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    available numeric(14,3);
BEGIN
    IF NEW.movement_type = 'exit' THEN
        SELECT current_stock INTO available
        FROM idr.material_stock
        WHERE id = NEW.material_id;

        IF COALESCE(available, 0) < NEW.quantity THEN
            RAISE EXCEPTION
                'Stock insuficiente. Disponible: %, solicitado: %',
                COALESCE(available, 0), NEW.quantity;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_material_stock ON material_movements;
CREATE TRIGGER trg_validate_material_stock
BEFORE INSERT ON material_movements
FOR EACH ROW EXECUTE FUNCTION idr.validate_material_stock();

-- ============================================================
-- LICENCIAS DEL PERSONAL
-- ============================================================

CREATE TABLE IF NOT EXISTS personnel (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code text UNIQUE,
    first_name    text NOT NULL,
    last_name     text NOT NULL,
    email         text,
    active        boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leave_types (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    description text,
    active      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personnel_leaves (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    personnel_id  uuid NOT NULL REFERENCES personnel(id)
                      ON UPDATE CASCADE ON DELETE RESTRICT,
    leave_type_id uuid NOT NULL REFERENCES leave_types(id)
                      ON UPDATE CASCADE ON DELETE RESTRICT,
    start_date    date NOT NULL,
    end_date      date NOT NULL,
    status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','cancelled')),
    notes         text,
    approved_by   text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS ix_personnel_leaves_dates
    ON personnel_leaves(start_date, end_date);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'buildings','floors','racks','switches',
        'patch_panels','patch_panel_ports',
        'cctv_devices','cameras','recorders','recorder_channels',
        'camera_locations','camera_network_connections',
        'incidents','material_categories','materials',
        'personnel','leave_types','personnel_leaves'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON idr.%I',
                       table_name, table_name);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON idr.%I
             FOR EACH ROW EXECUTE FUNCTION idr.set_updated_at()',
            table_name, table_name
        );
    END LOOP;
END;
$$;

COMMIT;
