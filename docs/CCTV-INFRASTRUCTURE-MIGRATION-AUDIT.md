# Auditoría migración CCTV infraestructura

## Esquema legacy real

La UI SGC mantiene tres arreglos principales en memoria: `dispositivos`, `grabadores` y `otros_prod`. La firma de sincronización legacy serializa los campos usados de cada arreglo:

- `dispositivos`: `id`, `tipo`, `estado`, `mac`, `serial`, `canales`, `marca`, `modelo`, `patrimonio`, `firmware`, `forma`, `comentario`.
- `grabadores`: `id`, `dispositivoId`, `canales_n`, `descripcion`, `tipo`, `marca`, `modelo`, `ip`, `edificio`, `piso`, `rack`, `puerto`, `mac`, `comentarios`, y `canales_data` con `canal`, `dispositivoId`, `descripcion`, `ip`, `puerto`, `edificio`, `piso`, `rack`, `comentarios`.
- `otros_prod`: `id`, `dispositivoId`, `descripcion`, `ip`, `puerto`, `edificio`, `piso`, `rack`, `comentarios`.

Los tipos builtin relevantes para infraestructura son `servidor`, `monitor`, `pc` y `teclado_red`. El resumen general agrupa `servidor` junto con `nvr`, `dvr`, `analitica` y `encoder` como servidores, y muestra `monitor`, `pc` y `teclado_red` como tipos separados.

## Fuente legacy actual

La fuente legacy histórica es `localStorage` con clave `cctvs:cctv_data_v1` y el payload remoto de Gist `cctv_data.json`. El módulo `GistSync` puede subir/bajar ese mismo payload; para la migración definitiva queda obsoleto como cargador de datos de CCTV y PostgreSQL debe ser la fuente de verdad.

## Datos reales disponibles en el repositorio

El repositorio contiene `backend/data/cctv-legacy-import.json`, pero actualmente está vacío (`dispositivos: []`, `grabadores: []`, `otros_prod: []`). Por lo tanto, en este checkout no existen los 41 registros reales para insertar sin inventar datos. La extracción reproducible debe hacerse con un export real de `cctv_data.json`/localStorage/Gist y validarse con:

```bash
cd backend
npm run import:cctv-infrastructure -- --file backend/data/cctv-legacy-import.json --dry-run --expect-complete
```

## Mapeo implementado

El backend expone `GET /api/v1/cctv/infrastructure-devices` con los tipos `server`, `monitor`, `pc` y `network_keyboard`. El adaptador frontend mapea esos tipos a los valores legacy `servidor`, `monitor`, `pc` y `teclado_red`, conserva la UI original y carga cámaras, grabadores e infraestructura desde la API.

## Pendiente bloqueante

Para completar la inserción de los 41 dispositivos reales en SQL hace falta incorporar al repositorio o suministrar en el entorno el payload legacy real. Sin ese payload, cualquier `INSERT` concreto implicaría inventar registros, lo cual está prohibido por el requerimiento.
