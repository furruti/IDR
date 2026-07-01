# IDR - Sistema de Gestión

## Arquitectura actual

```text
frontend/
```

Contiene la aplicación IDR existente en HTML, CSS y JavaScript vanilla. Conserva Service Workers, manifests PWA, localStorage y la sincronización actual mediante GitHub Gist.

```text
backend/
```

Contiene la base inicial de la futura API Node.js con Express. En esta etapa solo expone un endpoint de comprobación de salud.

```text
deploy/
```

Contendrá configuraciones de Rancher y Kubernetes en una etapa posterior.

## Ejecutar el frontend

El `package.json` existente pertenecía exclusivamente al frontend porque solo define `live-server` para servir la aplicación web. Por eso se movió a `frontend/package.json`, evitando mezclar dependencias del frontend con las del backend.

Desde la raíz del repositorio:

```bash
npx live-server frontend
```

O instalando las dependencias del frontend:

```bash
cd frontend
npm install
npm run dev
```

## Ejecutar el backend

```bash
cd backend
npm install
npm run dev
```

Endpoint de comprobación:

```text
GET http://localhost:3002/api/v1/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "idr-backend",
  "timestamp": "fecha ISO"
}
```

## Estado del proyecto

- El frontend aún conserva localStorage.
- La sincronización mediante GitHub Gist todavía no fue reemplazada.
- La base de datos todavía no fue implementada.
- La autenticación todavía no fue implementada.
- La separación realizada es solamente estructural y preparatoria.
- No se implementaron roles, permisos ni endpoints funcionales de los módulos.
- No se implementó despliegue en Rancher ni Kubernetes.
