const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const EXPECTED = { server: 27, monitor: 6, pc: 4, network_keyboard: 4 };
const TYPE_MAP = {
  servidor: 'server', server: 'server', servidores: 'server',
  monitor: 'monitor', monitores: 'monitor',
  pc: 'pc', pcs: 'pc', computadora: 'pc', computador: 'pc',
  teclado_red: 'network_keyboard', teclado: 'network_keyboard', network_keyboard: 'network_keyboard', networkkeyboard: 'network_keyboard',
  nvr: 'server', encoder: 'server', analitica: 'server', dvr: 'server'
};

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}
const flags = new Set(process.argv.filter(a => a.startsWith('--')).map(a => a.replace(/^--/, '')));
const dryRun = flags.has('dry-run');
const expectComplete = flags.has('expect-complete');
const createMissingLocations = flags.has('create-missing-locations');
const fileArg = arg('file');
if (!fileArg) throw new Error('Uso: npm run import:cctv-infrastructure -- --file backend/data/cctv-legacy-import.json [--dry-run] [--expect-complete] [--create-missing-locations]');
let filePath = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(filePath) && fileArg.startsWith('backend/')) {
  filePath = path.resolve(process.cwd(), '..', fileArg);
}
if (!fs.existsSync(filePath)) throw new Error(`No existe el archivo JSON: ${filePath}`);

function text(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}
function normType(v) {
  const key = (text(v) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_');
  return TYPE_MAP[key] || null;
}
function validIp(ip) { return !ip || (/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(ip)); }
function normMac(mac) {
  if (!mac) return null;
  const clean = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (clean.length !== 12) return mac.toUpperCase();
  return clean.match(/.{2}/g).join(':');
}
function validMac(mac) { return !mac || /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac) || /^sinrelevarn?\d{1,3}$/i.test(mac); }
function stableId(type, legacyId, asset, name, serial) {
  const source = legacyId ? `legacy:${legacyId}` : asset ? `asset:${asset}` : `${type}:${name || ''}:${serial || ''}`;
  return `infra_${crypto.createHash('sha1').update(source).digest('hex').slice(0, 24)}`;
}
function extract(payload) {
  const root = payload;
  const data = (root && typeof root === 'object' && root._data && typeof root._data === 'object') ? root._data : root;
  return {
    dispositivos: Array.isArray(data?.dispositivos) ? data.dispositivos : [],
    otros: Array.isArray(data?.otros_prod) ? data.otros_prod : []
  };
}

const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const { dispositivos, otros } = extract(payload);

const allowedTypes = ['nvr', 'encoder', 'analitica', 'dvr', 'monitor', 'pc', 'teclado_red'];
const filteredDevices = dispositivos.filter(d => {
  const t = (text(d.tipo) || '').toLowerCase();
  return allowedTypes.includes(t) && t !== 'camara';
});

const otherByDeviceId = new Map(otros.map(x => [text(x.dispositivoId), x]).filter(([id]) => id));

const rows = filteredDevices.map((device, index) => {
  const extra = otherByDeviceId.get(text(device.id)) || {};
  
  const type = normType(device.tipo);
  const legacyId = text(device.id);
  const asset = text(device.patrimonio ?? device.inventario ?? extra.inventario);
  const serial = text(device.serial ?? device.serie ?? extra.serial);
  const name = text(extra.descripcion ?? device.descripcion ?? device.modelo ?? device.tipo);
  const mac = normMac(text(device.mac ?? extra.mac));
  const ip = text(extra.ip ?? device.ip);
  const status = text(device.estado);

  return {
    sourceIndex: index, legacyProductionId: text(extra.id), legacyId, id: stableId(type || 'server', legacyId, asset, name, serial), type,
    status, brand: text(device.marca), model: text(device.modelo), serial, mac, asset,
    firmware: text(device.firmware), comments: text(extra.comentarios || device.comentario), description: name, ip,
    building: text(extra.edificio ?? device.edificio), floor: text(extra.piso ?? device.piso), rack: text(extra.rack ?? device.rack),
    port: text(extra.puerto), hostname: text(device.hostname ?? extra.hostname), role: text(device.tipo ?? extra.descripcion ?? extra.role ?? extra.rol),
    raw: { otros_prod: extra, dispositivo: device }
  };
});

const counts = rows.reduce((a, r) => (r.type && (a[r.type] = (a[r.type] || 0) + 1), a), {});
const dup = (vals) => [...vals.reduce((m, v) => v ? m.set(v, (m.get(v) || 0) + 1) : m, new Map())].filter(([, c]) => c > 1).map(([v]) => v);
const problems = {
  withoutId: rows.filter(r => !r.legacyId).map(r => r.sourceIndex),
  withoutType: rows.filter(r => !r.type).map(r => r.sourceIndex),
  invalidIps: rows.filter(r => !validIp(r.ip)).map(r => `${r.sourceIndex}:${r.ip}`),
  invalidMacs: rows.filter(r => !validMac(r.mac)).map(r => `${r.sourceIndex}:${r.mac}`),
  duplicateIds: dup(rows.map(r => r.legacyId)), duplicateAssets: dup(rows.map(r => r.asset).filter(a => a && !['NO', 'no'].includes(a))), duplicateSerials: dup(rows.map(r => r.serial).filter(s => s))
};
console.log('Resumen CCTV infraestructura');
console.table({ total: rows.length, server: counts.server || 0, monitor: counts.monitor || 0, pc: counts.pc || 0, network_keyboard: counts.network_keyboard || 0 });
console.log(JSON.stringify(problems, null, 2));
if (expectComplete) {
  const ok = rows.length === 41 && Object.entries(EXPECTED).every(([k, v]) => (counts[k] || 0) === v);
  if (!ok) throw new Error(`Conteo completo inesperado. Esperado ${JSON.stringify(EXPECTED)} total 41.`);
}
if (problems.withoutId.length || problems.withoutType.length || problems.invalidIps.length || problems.invalidMacs.length || problems.duplicateIds.length) {
  throw new Error('Errores críticos de validación; no se importó ningún registro.');
}
if (dryRun) { console.log('Dry-run: validación completada; no se escribió en PostgreSQL.'); process.exit(0); }

async function maybeLocation(client, table, value, extra = {}) {
  if (!value) return null;
  if (table === 'buildings') {
    const found = await client.query('SELECT id FROM idr.buildings WHERE lower(name)=lower($1) LIMIT 1', [value]);
    if (found.rowCount) return found.rows[0].id;
    if (createMissingLocations) return (await client.query('INSERT INTO idr.buildings(name) VALUES($1) RETURNING id', [value])).rows[0].id;
    return null;
  }
  if (table === 'floors') {
    const found = await client.query('SELECT id FROM idr.floors WHERE building_id IS NOT DISTINCT FROM $1 AND lower(name)=lower($2) LIMIT 1', [extra.buildingId, value]);
    if (found.rowCount) return found.rows[0].id;
    if (createMissingLocations && extra.buildingId) return (await client.query('INSERT INTO idr.floors(building_id,name) VALUES($1,$2) RETURNING id', [extra.buildingId, value])).rows[0].id;
    return null;
  }
  const found = await client.query('SELECT id FROM idr.racks WHERE building_id IS NOT DISTINCT FROM $1 AND floor_id IS NOT DISTINCT FROM $2 AND lower(code)=lower($3) LIMIT 1', [extra.buildingId, extra.floorId, value]);
  if (found.rowCount) return found.rows[0].id;
  if (createMissingLocations && extra.buildingId) return (await client.query('INSERT INTO idr.racks(building_id,floor_id,code) VALUES($1,$2,$3) RETURNING id', [extra.buildingId, extra.floorId, value])).rows[0].id;
  return null;
}

(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no está configurada');
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const stats = { createdCctv: 0, updatedCctv: 0, createdInfra: 0, updatedInfra: 0 };
    for (const r of rows) {
      try {
        const buildingId = await maybeLocation(client, 'buildings', r.building);
        const floorId = await maybeLocation(client, 'floors', r.floor, { buildingId });
        const rackId = await maybeLocation(client, 'racks', r.rack, { buildingId, floorId });
        const meta = { legacy_tipo: r.raw.dispositivo.tipo, legacy_updatedAt: r.raw.dispositivo.updatedAt, legacy_canales: r.raw.dispositivo.canales, extra_puerto: r.port, legacy: r.raw, legacyProductionId: r.legacyProductionId, unresolvedLocation: { building: buildingId ? null : r.building, floor: floorId ? null : r.floor, rack: rackId ? null : r.rack } };
        
        let existingDeviceId = null;
        if (r.legacyId) {
          const byLegacy = await client.query('SELECT id FROM idr.cctv_devices WHERE legacy_id = $1 LIMIT 1', [r.legacyId]);
          if (byLegacy.rowCount > 0) existingDeviceId = byLegacy.rows[0].id;
          
          if (!existingDeviceId) {
            const byOldId = await client.query('SELECT id FROM idr.cctv_devices WHERE id = $1 LIMIT 1', [r.legacyId]);
            if (byOldId.rowCount > 0) existingDeviceId = byOldId.rows[0].id;
          }
        }
        if (!existingDeviceId && r.mac) {
          const byMac = await client.query('SELECT id FROM idr.cctv_devices WHERE mac_address = $1 LIMIT 1', [r.mac]);
          if (byMac.rowCount > 0) existingDeviceId = byMac.rows[0].id;
        }
        if (!existingDeviceId && r.asset && !['NO', 'no', 'RELEVAR', ''].includes(r.asset)) {
          const byAsset = await client.query('SELECT id FROM idr.cctv_devices WHERE asset_number = $1 LIMIT 1', [r.asset]);
          if (byAsset.rowCount > 0) existingDeviceId = byAsset.rows[0].id;
        }

        const finalDeviceId = existingDeviceId || r.id;

        if (existingDeviceId) {
          await client.query(`UPDATE idr.cctv_devices SET legacy_id=$2, device_type=$3, status=$4, brand=$5, model=$6, serial_number=$7, mac_address=$8, asset_number=$9, firmware=$10, comments=$11, description=$12, updated_at=now() WHERE id=$1`,
            [finalDeviceId, r.legacyId, r.type, r.status, r.brand, r.model, r.serial, r.mac, r.asset, r.firmware, r.comments, r.description]);
          stats.updatedCctv++;
        } else {
          await client.query(`INSERT INTO idr.cctv_devices (id, legacy_id, device_type, status, brand, model, serial_number, mac_address, asset_number, firmware, comments, description)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [finalDeviceId, r.legacyId, r.type, r.status, r.brand, r.model, r.serial, r.mac, r.asset, r.firmware, r.comments, r.description]);
          stats.createdCctv++;
        }

        const checkInfra = await client.query('SELECT 1 FROM idr.infrastructure_devices WHERE device_id = $1 LIMIT 1', [finalDeviceId]);
        if (checkInfra.rowCount > 0) {
          await client.query(`UPDATE idr.infrastructure_devices SET ip_address=$2::inet, building_id=$3, floor_id=$4, rack_id=$5, hostname=$6, role=$7, description=$8, port=$9, metadata=$10::jsonb, updated_at=now() WHERE device_id=$1`,
            [finalDeviceId, r.ip, buildingId, floorId, rackId, r.hostname, r.role, r.description, r.port, JSON.stringify(meta)]);
          stats.updatedInfra++;
        } else {
          await client.query(`INSERT INTO idr.infrastructure_devices (device_id, ip_address, building_id, floor_id, rack_id, hostname, role, description, port, metadata)
            VALUES ($1,$2::inet,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
            [finalDeviceId, r.ip, buildingId, floorId, rackId, r.hostname, r.role, r.description, r.port, JSON.stringify(meta)]);
          stats.createdInfra++;
        }
      } catch (error) { throw new Error(`Falló registro index=${r.sourceIndex} legacyId=${r.legacyId}: ${error.message}`); }
    }
    await client.query('COMMIT');
    console.log(`Importación completada: ${rows.length} registros.`);
    console.log(stats);
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); await pool.end(); }
})();
