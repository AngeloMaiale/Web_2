FROM postgres:17

ENV POSTGRES_USER=nomina \
    POSTGRES_PASSWORD=nomina \
    POSTGRES_DB=nomina

COPY db/schema.sql      /docker-entrypoint-initdb.d/01-schema.sql
COPY db/auth_schema.sql /docker-entrypoint-initdb.d/02-auth-schema.sql
COPY db/seed_dev.sql    /docker-entrypoint-initdb.d/03-seed-dev.sql

EXPOSE 5432
