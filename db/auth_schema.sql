-- Autenticación y sesiones. Ejecutar DESPUÉS de db/schema.sql.
SET search_path = payroll;

CREATE TABLE app_user (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      text   NOT NULL,
    password_hash text   NOT NULL,                 -- "scrypt$salt$hash" (ver PasswordHasher)
    email         text,
    active        boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_app_user_username ON app_user (lower(username));

CREATE TABLE role (
    id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code  text NOT NULL UNIQUE,                    -- ADMIN, PAYROLL_MANAGER, EMPLOYEE...
    name  text NOT NULL
);

-- Un usuario, varios perfiles (cada uno con su rol y datos propios)
CREATE TABLE user_profile (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role_id      bigint NOT NULL REFERENCES role(id),
    display_name text   NOT NULL,
    company_id   bigint REFERENCES company(id),
    employee_id  bigint REFERENCES employee(id),   -- si el perfil es de un trabajador
    data         jsonb  NOT NULL DEFAULT '{}',     -- datos extra del perfil
    active       boolean NOT NULL DEFAULT true
);
CREATE INDEX ix_user_profile_user ON user_profile(user_id);

-- Sesiones activas (se guarda el hash del token, nunca el token)
CREATE TABLE user_session (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash  text   NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL
);
CREATE INDEX ix_user_session_user ON user_session(user_id);

INSERT INTO role (code, name) VALUES
  ('ADMIN', 'Administrador'),
  ('PAYROLL_MANAGER', 'Analista de nómina'),
  ('EMPLOYEE', 'Trabajador')
ON CONFLICT (code) DO NOTHING;
