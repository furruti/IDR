# IDR

Migración tecnológica fiel de IDR desde HTML/CSS/JavaScript vanilla hacia una base moderna con frontend Next.js + React + TypeScript y backend NestJS + TypeScript.

## Arquitectura

- `legacy/frontend-vanilla/`: aplicación original preservada como referencia funcional y visual.
- `frontend/`: aplicación Next.js con App Router. En esta etapa monta la versión legacy preservada en rutas modernas y sirve sus recursos desde una ruta Next.js `legacy-static`, sin duplicar binarios originales, para mantener equivalencia visual y funcional exacta mientras se encapsulan servicios TypeScript.
- `backend/`: API NestJS mínima con health check.
- `deploy/`: documentación de despliegue futuro. Rancher/Kubernetes no está implementado.

## Tecnologías

- Frontend: Next.js, React, TypeScript, CSS tradicional.
- Backend: NestJS, TypeScript, ConfigModule, ValidationPipe, filtro global de errores.
- Persistencia temporal: localStorage, JSON y GitHub Gist existentes.
- Base de datos: no implementada.
- ORM Prisma: no implementado.
- Autenticación: no implementada.

## Estructura

```text
IDR/
├── frontend/
├── backend/
├── legacy/frontend-vanilla/
├── deploy/
├── .gitignore
└── README.md
```

## Ejecución

### Legacy

```bash
cd legacy/frontend-vanilla
npx live-server
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Puerto: `3000`.

### Backend

```bash
cd backend
npm install
npm run dev
```

Puerto: `3002`.

Health endpoint:

```http
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

## Variables de entorno

Frontend: `frontend/.env.example`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3002/api/v1
```

Backend: `backend/.env.example`

```env
NODE_ENV=development
PORT=3002
CORS_ORIGIN=http://localhost:3000

# DATABASE_URL=
# AUTH_ISSUER_URL=
# AUTH_AUDIENCE=
```

## Rutas migradas

| Ruta nueva | Módulo legacy |
| --- | --- |
| `/` | Launcher principal |
| `/cctv` | `SGC/index.html` |
| `/materiales` | `SGI/index.html` |
| `/racks` | `SGR/index.html` |
| `/licencias` | `SGL/index.html` |
| `/patcheras` | `SGP/patcheras.html` |

Redirecciones compatibles configuradas:

- `/SGC/index.html` → `/cctv`
- `/SGI/index.html` → `/materiales`
- `/SGR/index.html` → `/racks`
- `/SGL/index.html` → `/licencias`
- `/SGP/index.html` → `/patcheras`

## Estado de migración por módulo

| Módulo | Estado migración | Equivalencia visual | Equivalencia funcional | Observaciones |
| ------ | ---------------- | ------------------- | ---------------------- | ------------- |
| Launcher | Migrado a ruta Next.js | IGUAL | IGUAL | Se monta el HTML legacy preservado. |
| Racks | Migrado a ruta Next.js | IGUAL | IGUAL | Se monta `SGR/index.html`. |
| Materiales | Migrado a ruta Next.js | IGUAL | IGUAL | Se monta `SGI/index.html`. |
| CCTV | Migrado a ruta Next.js | IGUAL | IGUAL | Se monta `SGC/index.html`. |
| Licencias | Migrado a ruta Next.js | IGUAL | IGUAL | Se monta `SGL/index.html`. |
| Patcheras | Migrado a ruta Next.js | IGUAL | IGUAL | Se conserva el estado existente de `SGP/patcheras.html`. |

## Claves localStorage conservadas documentadas

- `cctvs:cctv_data_v1`
- `SGI_activos`
- `SGI_herramientas`
- `SGI_dark`
- `SGI_tab`
- `SGI_tab_time`
- `SGI_hist_colapsos`
- `SGI_gist_cfg`
- `mat_gist_cfg` (migración legacy interna hacia `SGI_gist_cfg`)
- `RCK_data`

## GitHub Gist

Se conserva la integración legacy dentro de los archivos preservados. No se ejecutaron operaciones contra Gists reales durante esta etapa. Los servicios TypeScript nuevos incluyen helpers de payload sin realizar escrituras remotas.

## Pendientes

- Migrar progresivamente DOM vanilla a componentes React declarativos módulo por módulo.
- Ampliar inventario completo de claves localStorage y archivos Gist por módulo.
- Agregar comparaciones visuales automatizadas con capturas.
- Implementar PostgreSQL en una etapa futura.
- Implementar Prisma en una etapa futura.
- Implementar autenticación/autorización en una etapa futura.
- Implementar Rancher/Kubernetes en una etapa futura.

## Aclaraciones

- La persistencia sigue siendo localStorage/Gist.
- PostgreSQL no está implementado.
- Prisma no está implementado.
- Rancher no está implementado.
- No hay endpoints de negocio en backend.
