# Base de datos de desarrollo: Postgres con el esquema y datos semilla ya incluidos.
# Construir desde la raíz del repo:  docker build -f docker/Dockerfile -t nomina-db .
FROM postgres:17

# Credenciales de DESARROLLO (públicas a propósito; no usar en producción)
ENV POSTGRES_USER=nomina \
    POSTGRES_PASSWORD=nomina \
    POSTGRES_DB=nomina

# Los scripts de este directorio corren en orden alfabético, solo la primera vez
# que se crea el volumen de datos.
COPY db/schema.sql      /docker-entrypoint-initdb.d/01-schema.sql
COPY db/auth_schema.sql /docker-entrypoint-initdb.d/02-auth-schema.sql
COPY db/seed_dev.sql    /docker-entrypoint-initdb.d/03-seed-dev.sql

EXPOSE 5432
