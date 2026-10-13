SET search_path = payroll;

CREATE TABLE app_user (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      text   NOT NULL,
    password_hash text   NOT NULL,
    email         text,
    active        boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_app_user_username ON app_user (lower(username));

CREATE TABLE role (
    id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code  text NOT NULL UNIQUE,
    name  text NOT NULL
);

CREATE TABLE user_profile (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      bigint NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    role_id      bigint NOT NULL REFERENCES role(id),
    display_name text   NOT NULL,
    company_id   bigint REFERENCES company(id),
    employee_id  bigint REFERENCES employee(id),
    data         jsonb  NOT NULL DEFAULT '{}',
    active       boolean NOT NULL DEFAULT true
);
CREATE INDEX ix_user_profile_user ON user_profile(user_id);

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
