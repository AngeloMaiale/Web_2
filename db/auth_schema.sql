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

INSERT INTO role (code, name) VALUES
  ('ADMIN', 'Administrador'),
  ('PAYROLL_MANAGER', 'Analista de nómina'),
  ('EMPLOYEE', 'Trabajador')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE subsystem (
    id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code  text NOT NULL UNIQUE
);

CREATE TABLE class (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subsystem_id bigint NOT NULL REFERENCES subsystem(id),
    code         text   NOT NULL,
    UNIQUE (subsystem_id, code)
);

CREATE TABLE method (
    id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id  bigint NOT NULL REFERENCES class(id),
    code      text   NOT NULL,
    UNIQUE (class_id, code)
);

CREATE TABLE permission_method (
    role_id   bigint NOT NULL REFERENCES role(id),
    method_id bigint NOT NULL REFERENCES method(id),
    PRIMARY KEY (role_id, method_id)
);

INSERT INTO subsystem (code) VALUES ('nomina');
INSERT INTO class (subsystem_id, code) SELECT id, 'Empresa' FROM subsystem WHERE code = 'nomina';
INSERT INTO method (class_id, code) SELECT id, m FROM class, (VALUES ('listar'), ('crear')) AS v(m) WHERE code = 'Empresa';

INSERT INTO permission_method (role_id, method_id)
SELECT r.id, m.id
  FROM (VALUES
    ('ADMIN',           'listar'),
    ('ADMIN',           'crear'),
    ('PAYROLL_MANAGER', 'listar'),
    ('EMPLOYEE',        'listar')
  ) AS v(role_code, method_code)
  JOIN role r   ON r.code = v.role_code
  JOIN method m ON m.code = v.method_code;
