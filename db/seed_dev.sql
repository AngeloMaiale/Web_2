CREATE EXTENSION IF NOT EXISTS pgcrypto;
SET search_path = payroll, public;

INSERT INTO company (legal_name, rif) VALUES ('Empresa Demo C.A.', 'J-00000000-0');

INSERT INTO app_user (username, password_hash, email) VALUES
  ('admin',
   public.crypt('Admin123', public.gen_salt('bf', 10)),
   'admin@demo.local');

INSERT INTO user_profile (user_id, role_id, display_name, company_id, data)
SELECT u.id, r.id, v.display_name, c.id, v.data::jsonb
  FROM app_user u
  CROSS JOIN company c
  JOIN (VALUES
    ('ADMIN',           'Administrador Demo',   '{"theme":"dark"}'),
    ('PAYROLL_MANAGER', 'Analista de Nómina',   '{}')
  ) AS v(role_code, display_name, data) ON true
  JOIN role r ON r.code = v.role_code
 WHERE u.username = 'admin';

INSERT INTO app_user (username, password_hash, email) VALUES
  ('empleado',
   public.crypt('Empleado123', public.gen_salt('bf', 10)),
   'empleado@demo.local');

INSERT INTO user_profile (user_id, role_id, display_name, company_id)
SELECT u.id, r.id, 'Trabajador Demo', c.id
  FROM app_user u, role r, company c
 WHERE u.username = 'empleado' AND r.code = 'EMPLOYEE';
