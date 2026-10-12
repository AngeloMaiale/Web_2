-- Datos SOLO para desarrollo. Contraseñas conocidas: no cargar en producción.
SET search_path = payroll;

INSERT INTO company (legal_name, rif) VALUES ('Empresa Demo C.A.', 'J-00000000-0');

-- admin / Admin123  → un usuario con DOS perfiles (admin y analista de nómina)
INSERT INTO app_user (username, password_hash, email) VALUES
  ('admin',
   'scrypt$56fabb3c202c6d218025f308026452fd$1f2766104ae0329f879fb3ad55be7e6c15ff6e18d17480ca0708ad780f5fb8f7c1fa13cc9dd9c45eeff9cd2737f6bb50aab893dca9c668ef459b1e34b2d14320',
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
