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
    tx_code   integer NOT NULL UNIQUE,
    UNIQUE (class_id, code)
);

CREATE TABLE permission_method (
    role_id   bigint NOT NULL REFERENCES role(id),
    method_id bigint NOT NULL REFERENCES method(id),
    PRIMARY KEY (role_id, method_id)
);

CREATE TABLE option (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subsystem_id bigint NOT NULL REFERENCES subsystem(id),
    code         text   NOT NULL,
    UNIQUE (subsystem_id, code)
);

CREATE TABLE permission_option (
    role_id   bigint NOT NULL REFERENCES role(id),
    option_id bigint NOT NULL REFERENCES option(id),
    PRIMARY KEY (role_id, option_id)
);

-- 1. Subsistemas
INSERT INTO subsystem (code) VALUES ('nomina'), ('seguridad')
ON CONFLICT (code) DO NOTHING;

-- 2. Clases por subsistema
INSERT INTO class (subsystem_id, code)
SELECT s.id, v.class_code
  FROM (VALUES
    ('nomina', 'Empresa'),
    ('nomina', 'Empleado'),
    ('nomina', 'Concepto'),
    ('nomina', 'Asistencia'),
    ('nomina', 'Prestamo'),
    ('nomina', 'Nomina'),
    ('seguridad', 'Usuario'),
    ('seguridad', 'Permiso')
  ) AS v(sub_code, class_code)
  JOIN subsystem s ON s.code = v.sub_code
ON CONFLICT (subsystem_id, code) DO NOTHING;

-- 3. Métodos con tx_code deterministas (Contrato Sección 5.2)
INSERT INTO method (class_id, code, tx_code)
SELECT c.id, v.method_code, v.tx_code
  FROM (VALUES
    -- nomina / Empresa (1-7)
    ('nomina', 'Empresa', 'listar', 1),
    ('nomina', 'Empresa', 'crear', 2),
    ('nomina', 'Empresa', 'actualizar', 3),
    ('nomina', 'Empresa', 'listarDepartamentos', 4),
    ('nomina', 'Empresa', 'crearDepartamento', 5),
    ('nomina', 'Empresa', 'listarCargos', 6),
    ('nomina', 'Empresa', 'crearCargo', 7),

    -- nomina / Empleado (10-17)
    ('nomina', 'Empleado', 'listar', 10),
    ('nomina', 'Empleado', 'obtener', 11),
    ('nomina', 'Empleado', 'crear', 12),
    ('nomina', 'Empleado', 'actualizar', 13),
    ('nomina', 'Empleado', 'cambiarEstado', 14),
    ('nomina', 'Empleado', 'listarTerminos', 15),
    ('nomina', 'Empleado', 'asignarTerminos', 16),
    ('nomina', 'Empleado', 'guardarISLR', 17),

    -- nomina / Concepto (20-29)
    ('nomina', 'Concepto', 'listar', 20),
    ('nomina', 'Concepto', 'crear', 21),
    ('nomina', 'Concepto', 'actualizar', 22),
    ('nomina', 'Concepto', 'listarReglasLey', 23),
    ('nomina', 'Concepto', 'guardarReglaLey', 24),
    ('nomina', 'Concepto', 'listarPorEmpleado', 25),
    ('nomina', 'Concepto', 'asignarAEmpleado', 26),
    ('nomina', 'Concepto', 'desactivarAsignacion', 27),
    ('nomina', 'Concepto', 'listarParametrosLegales', 28),
    ('nomina', 'Concepto', 'guardarParametroLegal', 29),

    -- nomina / Asistencia (30-35)
    ('nomina', 'Asistencia', 'listarHoras', 30),
    ('nomina', 'Asistencia', 'registrarHoras', 31),
    ('nomina', 'Asistencia', 'listarTiposExtra', 32),
    ('nomina', 'Asistencia', 'listarHorasExtra', 33),
    ('nomina', 'Asistencia', 'registrarHoraExtra', 34),
    ('nomina', 'Asistencia', 'aprobarHoraExtra', 35),

    -- nomina / Prestamo (40-44)
    ('nomina', 'Prestamo', 'listar', 40),
    ('nomina', 'Prestamo', 'obtenerCuotas', 41),
    ('nomina', 'Prestamo', 'crear', 42),
    ('nomina', 'Prestamo', 'cancelar', 43),
    ('nomina', 'Prestamo', 'saltarCuota', 44),

    -- nomina / Nomina (50-60)
    ('nomina', 'Nomina', 'listarPeriodos', 50),
    ('nomina', 'Nomina', 'crearPeriodo', 51),
    ('nomina', 'Nomina', 'listarNovedades', 52),
    ('nomina', 'Nomina', 'registrarNovedad', 53),
    ('nomina', 'Nomina', 'calcular', 54),
    ('nomina', 'Nomina', 'cambiarEstadoPeriodo', 55),
    ('nomina', 'Nomina', 'listarRecibos', 56),
    ('nomina', 'Nomina', 'obtenerRecibo', 57),
    ('nomina', 'Nomina', 'resumenDashboard', 58),
    ('nomina', 'Nomina', 'listarTasasBCV', 59),
    ('nomina', 'Nomina', 'registrarTasaBCV', 60),

    -- seguridad / Usuario (70-74)
    ('seguridad', 'Usuario', 'listar', 70),
    ('seguridad', 'Usuario', 'crear', 71),
    ('seguridad', 'Usuario', 'actualizar', 72),
    ('seguridad', 'Usuario', 'asignarPerfil', 73),
    ('seguridad', 'Usuario', 'cambiarPassword', 74),

    -- seguridad / Permiso (80-83)
    ('seguridad', 'Permiso', 'listarMatriz', 80),
    ('seguridad', 'Permiso', 'actualizarPermisoMetodo', 81),
    ('seguridad', 'Permiso', 'actualizarPermisoOpcion', 82),
    ('seguridad', 'Permiso', 'listarAuditoria', 83)
  ) AS v(sub_code, class_code, method_code, tx_code)
  JOIN subsystem s ON s.code = v.sub_code
  JOIN class c ON c.subsystem_id = s.id AND c.code = v.class_code
ON CONFLICT (tx_code) DO NOTHING;

-- 4. Opciones de menú SPA (11 opciones)
INSERT INTO option (subsystem_id, code)
SELECT s.id, v.opt_code
  FROM (VALUES
    ('nomina', 'DASHBOARD'),
    ('nomina', 'ORGANIZACION'),
    ('nomina', 'EMPLEADOS'),
    ('nomina', 'CONCEPTOS'),
    ('nomina', 'TIEMPO'),
    ('nomina', 'PRESTAMOS'),
    ('nomina', 'NOMINA'),
    ('nomina', 'RECIBOS'),
    ('seguridad', 'USUARIOS'),
    ('seguridad', 'PERMISOS'),
    ('seguridad', 'AUDITORIA')
  ) AS v(sub_code, opt_code)
  JOIN subsystem s ON s.code = v.sub_code
ON CONFLICT (subsystem_id, code) DO NOTHING;

-- 5. Permisos iniciales de métodos por rol
-- ADMIN: acceso total a todos los métodos
INSERT INTO permission_method (role_id, method_id)
SELECT r.id, m.id
  FROM role r, method m
 WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- PAYROLL_MANAGER: gestión completa de nómina (lectura empresa, CRUD deptos/cargos, empleados, conceptos, tiempo, préstamos y nómina)
INSERT INTO permission_method (role_id, method_id)
SELECT r.id, m.id
  FROM role r, method m
 WHERE r.code = 'PAYROLL_MANAGER'
   AND m.tx_code IN (
     1, 4, 5, 6, 7,
     10, 11, 12, 13, 14, 15, 16, 17,
     20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
     30, 31, 32, 33, 34, 35,
     40, 41, 42, 43, 44,
     50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60
   )
ON CONFLICT DO NOTHING;

-- EMPLOYEE: autoservicio (sus préstamos, sus recibos, resumen dashboard y lectura básica de empresa)
INSERT INTO permission_method (role_id, method_id)
SELECT r.id, m.id
  FROM role r, method m
 WHERE r.code = 'EMPLOYEE'
   AND m.tx_code IN (1, 40, 41, 56, 57, 58)
ON CONFLICT DO NOTHING;

-- 6. Permisos iniciales de opciones de menú por rol
-- ADMIN: todas las opciones
INSERT INTO permission_option (role_id, option_id)
SELECT r.id, o.id
  FROM role r, option o
 WHERE r.code = 'ADMIN'
ON CONFLICT DO NOTHING;

-- PAYROLL_MANAGER: todas las opciones del subsistema nomina
INSERT INTO permission_option (role_id, option_id)
SELECT r.id, o.id
  FROM role r
  JOIN option o ON true
  JOIN subsystem s ON s.id = o.subsystem_id
 WHERE r.code = 'PAYROLL_MANAGER' AND s.code = 'nomina'
ON CONFLICT DO NOTHING;

-- EMPLOYEE: DASHBOARD, PRESTAMOS, RECIBOS
INSERT INTO permission_option (role_id, option_id)
SELECT r.id, o.id
  FROM role r, option o
 WHERE r.code = 'EMPLOYEE'
   AND o.code IN ('DASHBOARD', 'PRESTAMOS', 'RECIBOS')
ON CONFLICT DO NOTHING;
