const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const EXPECTED = { server: 27, monitor: 6, pc: 4, network_keyboard: 4 };
const TYPE_MAP = {
  servidor: 'server', server: 'server', servidores: 'server',
  monitor: 'monitor', monitores: 'monitor',
  pc: 'pc', pcs: 'pc', computadora: 'pc', computador: 'pc',
  teclado_red: 'network_keyboard', teclado: 'network_keyboard', network_keyboard: 'network_keyboard', networkkeyboard: 'network_keyboard'
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
const byDeviceId = new Map(dispositivos.map(d => [text(d.id), d]).filter(([id]) => id));

const rows = otros.map((op, index) => {
  const linked = byDeviceId.get(text(op.dispositivoId) || '') || {};
  const type = normType(linked.tipo ?? op.tipo);
  const legacyId = text(linked.id) || text(op.dispositivoId) || text(op.id);
  const asset = text(linked.patrimonio ?? linked.inventario ?? op.inventario);
  const serial = text(linked.serial ?? linked.serie ?? op.serial);
  const name = text(op.descripcion ?? linked.descripcion ?? linked.nombre ?? linked.hostname ?? op.hostname);
  const mac = normMac(text(linked.mac ?? op.mac));
  const ip = text(op.ip ?? linked.ip);
  return {
    sourceIndex: index, legacyProductionId: text(op.id), legacyId, id: stableId(type || 'server', legacyId, asset, name, serial), type,
    status: text(linked.estado), brand: text(linked.marca), model: text(linked.modelo), serial, mac, asset,
    firmware: text(linked.firmware), comments: text(linked.comentario ?? op.comentarios), description: name, ip,
    building: text(op.edificio ?? linked.edificio), floor: text(op.piso ?? linked.piso), rack: text(op.rack ?? linked.rack),
    port: text(op.puerto), hostname: text(linked.hostname ?? op.hostname), role: text(linked.role ?? linked.rol ?? op.role ?? op.rol),
    raw: { otros_prod: op, dispositivo: linked }
  };
});

const counts = rows.reduce((a, r) => (r.type && (a[r.type] = (a[r.type] || 0) + 1), a), {});
const dup = (vals) => [...vals.reduce((m, v) => v ? m.set(v, (m.get(v) || 0) + 1) : m, new Map())].filter(([, c]) => c > 1).map(([v]) => v);
const problems = {
  withoutId: rows.filter(r => !r.legacyId).map(r => r.sourceIndex),
  withoutType: rows.filter(r => !r.type).map(r => r.sourceIndex),
  invalidIps: rows.filter(r => !validIp(r.ip)).map(r => `${r.sourceIndex}:${r.ip}`),
  invalidMacs: rows.filter(r => !validMac(r.mac)).map(r => `${r.sourceIndex}:${r.mac}`),
  duplicateIds: dup(rows.map(r => r.legacyId)), duplicateAssets: dup(rows.map(r => r.asset)), duplicateSerials: dup(rows.map(r => r.serial))
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
    for (const r of rows) {
      try {
        const buildingId = await maybeLocation(client, 'buildings', r.building);
        const floorId = await maybeLocation(client, 'floors', r.floor, { buildingId });
        const rackId = await maybeLocation(client, 'racks', r.rack, { buildingId, floorId });
        const meta = { legacy: r.raw, legacyProductionId: r.legacyProductionId, unresolvedLocation: { building: buildingId ? null : r.building, floor: floorId ? null : r.floor, rack: rackId ? null : r.rack } };
        await client.query(`INSERT INTO idr.cctv_devices (id, legacy_id, device_type, status, brand, model, serial_number, mac_address, asset_number, firmware, comments, description)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (id) DO UPDATE SET legacy_id=EXCLUDED.legacy_id, device_type=EXCLUDED.device_type, status=EXCLUDED.status, brand=EXCLUDED.brand, model=EXCLUDED.model, serial_number=EXCLUDED.serial_number, mac_address=EXCLUDED.mac_address, asset_number=EXCLUDED.asset_number, firmware=EXCLUDED.firmware, comments=EXCLUDED.comments, description=EXCLUDED.description, updated_at=now()`,
          [r.id, r.legacyId, r.type, r.status, r.brand, r.model, r.serial, r.mac, r.asset, r.firmware, r.comments, r.description]);
        await client.query(`INSERT INTO idr.infrastructure_devices (device_id, ip_address, building_id, floor_id, rack_id, hostname, role, description, port, metadata)
          VALUES ($1,$2::inet,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
          ON CONFLICT (device_id) DO UPDATE SET ip_address=EXCLUDED.ip_address, building_id=EXCLUDED.building_id, floor_id=EXCLUDED.floor_id, rack_id=EXCLUDED.rack_id, hostname=EXCLUDED.hostname, role=EXCLUDED.role, description=EXCLUDED.description, port=EXCLUDED.port, metadata=EXCLUDED.metadata, updated_at=now()`,
          [r.id, r.ip, buildingId, floorId, rackId, r.hostname, r.role, r.description, r.port, JSON.stringify(meta)]);
      } catch (error) { throw new Error(`Falló registro index=${r.sourceIndex} legacyId=${r.legacyId}: ${error.message}`); }
    }
    await client.query('COMMIT');
    console.log(`Importación completada: ${rows.length} registros.`);
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); await pool.end(); }
})();
