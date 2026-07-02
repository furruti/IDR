# IDR PostgreSQL local

## Recomendación

- Docker Desktop
- PostgreSQL 16 en contenedor
- DBeaver Community para visualizar y consultar
- El backend es el único componente que conoce DATABASE_URL

## Inicio

1. Descomprimir el paquete.
2. Copiar `.env.example` como `.env`.
3. Cambiar la contraseña en `.env`.
4. Abrir PowerShell en esta carpeta.
5. Ejecutar:

```powershell
docker compose --env-file .env up -d
```

## Conectar DBeaver

- Host: localhost
- Puerto: 5432
- Database: idr
- Usuario: idr_app
- Contraseña: la configurada en `.env`

El esquema de trabajo es `idr`.

## Reiniciar la base desde cero

Los scripts dentro de `/docker-entrypoint-initdb.d` se ejecutan únicamente
cuando el volumen se crea por primera vez.

```powershell
docker compose down -v
docker compose --env-file .env up -d
```

Esto elimina la base local y vuelve a crearla. No hacerlo en producción.

## Archivos

- `001_schema.sql`: estructura completa.
- `002_seed_cctv.sql`: carga inicial desde el JSON actual.
- `docker-compose.yml`: PostgreSQL local.
- `.env.example`: ejemplo de credenciales.

## Seguridad

No subir `.env` al repositorio. Agregar al `.gitignore`:

```gitignore
.env
```

El frontend nunca debe conectarse directamente a PostgreSQL.

```text
Frontend -> Backend/API -> PostgreSQL
```
