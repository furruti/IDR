import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { CameraResponse, InfrastructureDeviceResponse, RecorderResponse } from './dto/cctv.responses';

@Injectable()
export class CctvService {
  constructor(private readonly database: DatabaseService) { }

  async findAllCameras(): Promise<CameraResponse[]> {
    const result = await this.database.query(`
    SELECT
      d.id,
      d.status,
      d.brand,
      d.model,
      d.serial_number AS "serialNumber",
      d.mac_address AS "macAddress",
      d.asset_number AS "assetNumber",
      d.firmware,
      d.comments,
      c.form_factor AS "formFactor",
      c.description,
      c.ip_address::text AS "ipAddress",
      b.name AS building,
      f.name AS floor,
      r.code AS rack,
      s.name AS "switchName",
      cnc.switch_port AS "switchPort",

      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object(
            'recorderId', rc.recorder_id,
            'recorderName', recorder_device.description,
            'channelNumber', rc.channel_number
          )
        ) FILTER (WHERE rc.recorder_id IS NOT NULL),
        '[]'::jsonb
      ) AS assignments

    FROM idr.cctv_devices d

    INNER JOIN idr.cameras c
      ON c.device_id = d.id

    LEFT JOIN idr.camera_locations cl
      ON cl.camera_id = d.id

    LEFT JOIN idr.buildings b
      ON b.id = cl.building_id

    LEFT JOIN idr.floors f
      ON f.id = cl.floor_id

    LEFT JOIN idr.camera_network_connections cnc
      ON cnc.camera_id = d.id

    LEFT JOIN idr.racks r
      ON r.id = cnc.rack_id

    LEFT JOIN idr.switches s
      ON s.id = cnc.switch_id

    LEFT JOIN idr.recorder_channels rc
      ON rc.camera_id = d.id

    LEFT JOIN idr.recorders recorder_device
      ON recorder_device.device_id = rc.recorder_id

    WHERE d.device_type = 'camera'

    GROUP BY
      d.id,
      c.device_id,
      b.name,
      f.name,
      r.code,
      s.name,
      cnc.switch_port

    ORDER BY
      d.brand NULLS LAST,
      d.model NULLS LAST,
      d.mac_address NULLS LAST
  `);

    return result.rows as CameraResponse[];
  }

  async findCameraById(id: string): Promise<CameraResponse> {
    const result = await this.database.query(
      `
      SELECT
        d.id,
        d.status,
        d.brand,
        d.model,
        d.serial_number AS "serialNumber",
        d.mac_address AS "macAddress",
        d.asset_number AS "assetNumber",
        d.firmware,
        d.comments,
        c.form_factor AS "formFactor",
        c.description,
        c.ip_address::text AS "ipAddress"
      FROM idr.cctv_devices d
      INNER JOIN idr.cameras c ON c.device_id = d.id
      WHERE d.id = $1
        AND d.device_type = 'camera'
      `,
      [id],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('Cámara no encontrada');
    }

    return result.rows[0] as CameraResponse;
  }

  async createCamera(input: CreateCameraDto): Promise<CameraResponse> {
    const id = input.id ?? randomUUID();

    try {
      await this.database.transaction(async (client) => {
        await client.query(
          `
          INSERT INTO idr.cctv_devices (
            id, device_type, status, brand, model, serial_number,
            mac_address, asset_number, firmware, comments
          )
          VALUES ($1, 'camera', $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            id,
            input.status ?? null,
            input.brand ?? null,
            input.model ?? null,
            input.serialNumber ?? null,
            input.macAddress?.toUpperCase() ?? null,
            input.assetNumber ?? null,
            input.firmware ?? null,
            input.comments ?? null,
          ],
        );

        await client.query(
          `
          INSERT INTO idr.cameras (
            device_id, form_factor, description, ip_address
          )
          VALUES ($1, $2, $3, $4)
          `,
          [
            id,
            input.formFactor ?? null,
            input.description ?? null,
            input.ipAddress ?? null,
          ],
        );
      });

      return this.findCameraById(id);
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        throw new ConflictException('Ya existe una cámara con ese ID, MAC o IP');
      }
      throw error;
    }
  }

  async updateCamera(id: string, input: UpdateCameraDto): Promise<CameraResponse> {
    await this.findCameraById(id);

    await this.database.transaction(async (client) => {
      await client.query(
        `
        UPDATE idr.cctv_devices
        SET
          status = COALESCE($2, status),
          brand = COALESCE($3, brand),
          model = COALESCE($4, model),
          serial_number = COALESCE($5, serial_number),
          mac_address = COALESCE($6, mac_address),
          asset_number = COALESCE($7, asset_number),
          firmware = COALESCE($8, firmware),
          comments = COALESCE($9, comments)
        WHERE id = $1
        `,
        [
          id,
          input.status ?? null,
          input.brand ?? null,
          input.model ?? null,
          input.serialNumber ?? null,
          input.macAddress?.toUpperCase() ?? null,
          input.assetNumber ?? null,
          input.firmware ?? null,
          input.comments ?? null,
        ],
      );

      await client.query(
        `
        UPDATE idr.cameras
        SET
          form_factor = COALESCE($2, form_factor),
          description = COALESCE($3, description),
          ip_address = COALESCE($4, ip_address)
        WHERE device_id = $1
        `,
        [
          id,
          input.formFactor ?? null,
          input.description ?? null,
          input.ipAddress ?? null,
        ],
      );
    });

    return this.findCameraById(id);
  }

  async deleteCamera(id: string) {
    await this.findCameraById(id);

    await this.database.transaction(async (client) => {
      await client.query(
        'UPDATE idr.recorder_channels SET camera_id = NULL WHERE camera_id = $1',
        [id],
      );
      await client.query('DELETE FROM idr.cctv_devices WHERE id = $1', [id]);
    });

    return { deleted: true, id };
  }


  async findAllInfrastructureDevices(): Promise<InfrastructureDeviceResponse[]> {
    const result = await this.database.query(`
      SELECT
        d.id,
        d.device_type AS type,
        d.status,
        d.brand,
        d.model,
        d.serial_number AS "serialNumber",
        d.mac_address AS "macAddress",
        d.asset_number AS "assetNumber",
        d.firmware,
        d.comments,
        i.description,
        i.ip_address::text AS "ipAddress",
        b.name AS building,
        f.name AS floor,
        r.code AS rack,
        i.hostname,
        i.role
      FROM idr.cctv_devices d
      INNER JOIN idr.infrastructure_devices i ON i.device_id = d.id
      LEFT JOIN idr.buildings b ON b.id = i.building_id
      LEFT JOIN idr.floors f ON f.id = i.floor_id
      LEFT JOIN idr.racks r ON r.id = i.rack_id
      WHERE d.device_type IN ('server', 'monitor', 'pc', 'network_keyboard')
      ORDER BY d.device_type, i.description NULLS LAST, d.brand NULLS LAST, d.model NULLS LAST
    `);

    return result.rows as InfrastructureDeviceResponse[];
  }

  async findAllRecorders(): Promise<RecorderResponse[]> {
    const result = await this.database.query(`
      SELECT
        d.id,
        d.device_type AS type,
        d.status,
        d.brand,
        d.model,
        d.serial_number AS "serialNumber",
        d.mac_address AS "macAddress",
        d.asset_number AS "assetNumber",
        d.firmware,
        d.comments,
        r.description,
        r.ip_address::text AS "ipAddress",
        r.channel_capacity AS "channelCapacity",
        rack.code AS rack,
        COUNT(rc.id)::integer AS "configuredChannels",
        COUNT(rc.camera_id)::integer AS "assignedCameras"
      FROM idr.cctv_devices d
      INNER JOIN idr.recorders r ON r.device_id = d.id
      LEFT JOIN idr.racks rack ON rack.id = r.rack_id
      LEFT JOIN idr.recorder_channels rc ON rc.recorder_id = r.device_id
      GROUP BY d.id, r.device_id, rack.code
      ORDER BY d.device_type, d.brand, d.model
    `);

    return result.rows as RecorderResponse[];
  }
}
