-- =====================================================================
-- Sistema de Nómina (Venezuela) - Esquema PostgreSQL
-- Solo esquema: sin lógica de cálculo. Ver docs/modelo-de-datos.md
-- Convenciones: snake_case, PK bigint identity, dinero NUMERIC(18,2),
-- tasas NUMERIC(9,6) (0.040000 = 4%), vigencias con effective_from/to.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- para EXCLUDE de vigencias sin solape
CREATE SCHEMA IF NOT EXISTS payroll;
SET search_path = payroll;

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE pay_frequency      AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
CREATE TYPE salary_type        AS ENUM ('FIXED', 'HOURLY');
CREATE TYPE shift_type         AS ENUM ('DAY', 'NIGHT', 'MIXED');           -- LOTTT art. 173 (8h/7h/7.5h)
CREATE TYPE employee_status    AS ENUM ('ACTIVE', 'SUSPENDED', 'ON_LEAVE', 'TERMINATED');
CREATE TYPE concept_kind       AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION');
CREATE TYPE concept_category   AS ENUM (
    'BASE_SALARY', 'OVERTIME', 'BONUS', 'LEGAL_DEDUCTION',
    'OPTIONAL_DEDUCTION', 'LOAN', 'TAX_WITHHOLDING', 'OTHER');
CREATE TYPE amount_mode        AS ENUM ('FIXED_AMOUNT', 'PERCENT_OF_BASE');
CREATE TYPE period_status      AS ENUM ('OPEN', 'CALCULATED', 'APPROVED', 'PAID', 'CLOSED');
CREATE TYPE loan_status        AS ENUM ('ACTIVE', 'PAID_OFF', 'CANCELLED');
CREATE TYPE installment_status AS ENUM ('PENDING', 'DEDUCTED', 'SKIPPED', 'CANCELLED');
CREATE TYPE currency_code      AS ENUM ('VES', 'USD', 'EUR');
CREATE TYPE legal_base_kind    AS ENUM ('INTEGRAL_SALARY', 'NORMAL_SALARY', 'PROFIT_SHARING'); -- base de cálculo de aportes

-- ---------------------------------------------------------------------
-- 1. Organización
-- ---------------------------------------------------------------------
CREATE TABLE company (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    legal_name       text        NOT NULL,
    rif              text        NOT NULL UNIQUE,          -- J-12345678-9
    ivss_employer_no text,                                  -- N° patronal IVSS
    address          text,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE department (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id  bigint NOT NULL REFERENCES company(id),
    name        text   NOT NULL,
    UNIQUE (company_id, name)
);

CREATE TABLE job_position (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id  bigint NOT NULL REFERENCES company(id),
    name        text   NOT NULL,
    UNIQUE (company_id, name)
);

-- ---------------------------------------------------------------------
-- 2. Trabajadores
-- ---------------------------------------------------------------------
CREATE TABLE employee (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id      bigint NOT NULL REFERENCES company(id),
    employee_code   text   NOT NULL,
    national_id     text   NOT NULL,                        -- cédula V-/E-
    rif             text,
    ivss_no         text,                                   -- N° asegurado IVSS
    first_name      text   NOT NULL,
    last_name       text   NOT NULL,
    birth_date      date,
    email           text,
    phone           text,
    hire_date       date   NOT NULL,
    termination_date date,
    status          employee_status NOT NULL DEFAULT 'ACTIVE',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, employee_code),
    UNIQUE (company_id, national_id),
    CHECK (termination_date IS NULL OR termination_date >= hire_date)
);

CREATE TABLE employee_bank_account (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id   bigint NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    bank_name     text   NOT NULL,
    account_no    text   NOT NULL,                          -- 20 dígitos
    account_type  text,                                     -- corriente/ahorro
    currency      currency_code NOT NULL DEFAULT 'VES',
    is_primary    boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX uq_employee_primary_account
    ON employee_bank_account(employee_id) WHERE is_primary;

-- Condiciones laborales con historial (un solo registro vigente por trabajador)
CREATE TABLE employment_terms (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id      bigint NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    department_id    bigint REFERENCES department(id),
    position_id      bigint REFERENCES job_position(id),
    salary_type      salary_type   NOT NULL,                -- FIXED = salario mensual; HOURLY = por hora
    salary_amount    numeric(18,2) NOT NULL CHECK (salary_amount >= 0),
                     -- FIXED: monto mensual equivalente | HOURLY: tarifa por hora
    currency         currency_code NOT NULL DEFAULT 'VES',
    pay_frequency    pay_frequency NOT NULL,
    shift            shift_type    NOT NULL DEFAULT 'DAY',
    weekly_hours     numeric(5,2)  NOT NULL DEFAULT 40 CHECK (weekly_hours BETWEEN 1 AND 44),
    daily_hours      numeric(4,2)  NOT NULL DEFAULT 8,
    effective_from   date NOT NULL,
    effective_to     date,
    CHECK (effective_to IS NULL OR effective_to >= effective_from),
    EXCLUDE USING gist (employee_id WITH =,
                        daterange(effective_from, effective_to, '[]') WITH &&)
);

-- ---------------------------------------------------------------------
-- 3. Parámetros legales vigentes
-- ---------------------------------------------------------------------
CREATE TABLE statutory_parameter (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code           text          NOT NULL,   -- MIN_WAGE, TAX_UNIT, FOOD_ALLOWANCE_DAILY, ...
    description    text,
    value          numeric(18,6) NOT NULL,
    currency       currency_code,
    effective_from date NOT NULL,
    effective_to   date,
    UNIQUE (code, effective_from),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE exchange_rate (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rate_date  date NOT NULL,
    from_ccy   currency_code NOT NULL,
    to_ccy     currency_code NOT NULL,
    rate       numeric(18,6) NOT NULL CHECK (rate > 0),
    source     text DEFAULT 'BCV',
    UNIQUE (rate_date, from_ccy, to_ccy)
);

-- Reglas de aportes/retenciones de ley, parametrizadas y con vigencia
-- IVSS 4% / 9-11% (tope 5 SM), Paro Forzoso 0.5% / 2% (tope 10 SM),
-- FAOV 1% / 2% (sin tope), INCES 0.5% (utilidades) / 2% (nómina).
CREATE TABLE legal_deduction_rule (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code               text   NOT NULL,          -- IVSS, PARO_FORZOSO, FAOV, INCES
    name               text   NOT NULL,
    employee_rate      numeric(9,6) NOT NULL DEFAULT 0,
    employer_rate      numeric(9,6) NOT NULL DEFAULT 0,
    base_kind          legal_base_kind NOT NULL DEFAULT 'NORMAL_SALARY',
    cap_in_min_wages   numeric(6,2),             -- tope en salarios mínimos (NULL = sin tope)
    weekly_proration   boolean NOT NULL DEFAULT false,
                       -- IVSS/Paro: base = salario*12/52 por lunes del período
    effective_from     date NOT NULL,
    effective_to       date,
    UNIQUE (code, effective_from),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Retención ISLR: tabla por trabajador (porcentaje estimado, Decreto 1808)
CREATE TABLE employee_islr_withholding (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id      bigint NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    percentage       numeric(9,6) NOT NULL CHECK (percentage >= 0),
    declared_on      date NOT NULL,              -- AR-I
    effective_from   date NOT NULL,
    effective_to     date
);

-- ---------------------------------------------------------------------
-- 4. Catálogo de conceptos
-- ---------------------------------------------------------------------
CREATE TABLE concept (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code         text   NOT NULL UNIQUE,         -- SUELDO, HE_DIURNA, BONO_ALIM, IVSS, PRESTAMO...
    name         text   NOT NULL,
    kind         concept_kind     NOT NULL,
    category     concept_category NOT NULL,
    is_salary    boolean NOT NULL DEFAULT true,  -- incide en salario normal (base de aportes)
    legal_rule_code text,                        -- solo LEGAL_DEDUCTION: code en legal_deduction_rule (la regla es versionada) -- solo LEGAL_DEDUCTION: vínculo a regla
    active       boolean NOT NULL DEFAULT true
);

-- Asignaciones recurrentes por trabajador: bonos fijos y descuentos opcionales
-- (sindicato, caja de ahorros, seguro HCM, embargo, etc.)
CREATE TABLE employee_concept (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id    bigint NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    concept_id     bigint NOT NULL REFERENCES concept(id),
    mode           amount_mode   NOT NULL,
    amount         numeric(18,2),                -- si FIXED_AMOUNT
    percentage     numeric(9,6),                 -- si PERCENT_OF_BASE
    currency       currency_code NOT NULL DEFAULT 'VES',
    applies_to     pay_frequency[],              -- NULL = todas; p.ej. solo mensual
    effective_from date NOT NULL,
    effective_to   date,
    notes          text,
    CHECK ((mode = 'FIXED_AMOUNT'    AND amount IS NOT NULL AND percentage IS NULL) OR
           (mode = 'PERCENT_OF_BASE' AND percentage IS NOT NULL AND amount IS NULL))
);

-- ---------------------------------------------------------------------
-- 5. Tiempo: horas trabajadas y horas extra
-- ---------------------------------------------------------------------
CREATE TABLE holiday (
    holiday_date date PRIMARY KEY,
    name         text NOT NULL
);

-- Catálogo: LOTTT art. 118 (recargo 50%), art. 117 (bono nocturno 30%),
-- descanso/feriado trabajado (recargo 50% sobre salario del día).
CREATE TABLE overtime_type (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code           text NOT NULL UNIQUE,         -- HE_DIURNA, HE_NOCTURNA, HE_DESCANSO, HE_FERIADO
    name           text NOT NULL,
    surcharge_rate numeric(9,6) NOT NULL,        -- 0.50 = recargo 50% (multiplicador = 1 + recargo)
    concept_id     bigint NOT NULL REFERENCES concept(id)
);

CREATE TABLE time_entry (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id    bigint NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    work_date      date   NOT NULL,
    regular_hours  numeric(5,2) NOT NULL DEFAULT 0 CHECK (regular_hours >= 0),
    night_hours    numeric(5,2) NOT NULL DEFAULT 0 CHECK (night_hours >= 0),
    is_rest_day    boolean NOT NULL DEFAULT false,
    is_holiday     boolean NOT NULL DEFAULT false,
    source         text NOT NULL DEFAULT 'MANUAL',   -- MANUAL | IMPORT | CLOCK
    UNIQUE (employee_id, work_date)
);

CREATE TABLE overtime_entry (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id      bigint NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    work_date        date   NOT NULL,
    overtime_type_id bigint NOT NULL REFERENCES overtime_type(id),
    hours            numeric(5,2) NOT NULL CHECK (hours > 0),
    approved_by      text,
    approved_at      timestamptz,
    payroll_run_id   bigint,                         -- FK abajo; se llena al liquidar
    UNIQUE (employee_id, work_date, overtime_type_id)
);

-- ---------------------------------------------------------------------
-- 6. Préstamos (descuentos en cuotas)
-- ---------------------------------------------------------------------
CREATE TABLE loan (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id      bigint NOT NULL REFERENCES employee(id),
    principal        numeric(18,2) NOT NULL CHECK (principal > 0),
    currency         currency_code NOT NULL DEFAULT 'VES',
    interest_rate    numeric(9,6)  NOT NULL DEFAULT 0,   -- por período de cuota
    installments_n   integer NOT NULL CHECK (installments_n > 0),
    granted_on       date NOT NULL,
    first_deduction  date NOT NULL,
    status           loan_status NOT NULL DEFAULT 'ACTIVE',
    notes            text
);

CREATE TABLE loan_installment (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loan_id       bigint NOT NULL REFERENCES loan(id) ON DELETE CASCADE,
    seq           integer NOT NULL,
    due_date      date    NOT NULL,
    amount        numeric(18,2) NOT NULL CHECK (amount > 0),
    status        installment_status NOT NULL DEFAULT 'PENDING',
    UNIQUE (loan_id, seq)
);

-- ---------------------------------------------------------------------
-- 7. Períodos y corridas de nómina
-- ---------------------------------------------------------------------
CREATE TABLE payroll_period (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id      bigint NOT NULL REFERENCES company(id),
    frequency       pay_frequency NOT NULL,
    period_start    date NOT NULL,
    period_end      date NOT NULL,
    pay_date        date NOT NULL,
    mondays_count   smallint NOT NULL DEFAULT 0,     -- para IVSS/Paro semanal
    status          period_status NOT NULL DEFAULT 'OPEN',
    UNIQUE (company_id, frequency, period_start),
    CHECK (period_end >= period_start)
);

CREATE TABLE payroll_run (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    period_id     bigint NOT NULL REFERENCES payroll_period(id),
    run_number    smallint NOT NULL DEFAULT 1,       -- permite recálculos/complementarias
    exchange_rate numeric(18,6),                     -- tasa usada si hay USD
    created_by    text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    approved_at   timestamptz,
    UNIQUE (period_id, run_number)
);

ALTER TABLE overtime_entry
    ADD CONSTRAINT fk_overtime_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_run(id);

-- Recibo de pago (uno por trabajador por corrida)
CREATE TABLE payroll_receipt (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id           bigint NOT NULL REFERENCES payroll_run(id) ON DELETE CASCADE,
    employee_id      bigint NOT NULL REFERENCES employee(id),
    terms_id         bigint NOT NULL REFERENCES employment_terms(id),  -- condiciones usadas (snapshot)
    currency         currency_code NOT NULL,
    total_earnings   numeric(18,2) NOT NULL DEFAULT 0,
    total_deductions numeric(18,2) NOT NULL DEFAULT 0,
    net_pay          numeric(18,2) NOT NULL DEFAULT 0,
    employer_cost    numeric(18,2) NOT NULL DEFAULT 0, -- aportes patronales
    bank_account_id  bigint REFERENCES employee_bank_account(id),
    paid_at          timestamptz,
    UNIQUE (run_id, employee_id),
    CHECK (net_pay = total_earnings - total_deductions)
);

-- Líneas del recibo (resultado ya calculado e inmutable)
CREATE TABLE payroll_receipt_line (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    receipt_id      bigint NOT NULL REFERENCES payroll_receipt(id) ON DELETE CASCADE,
    concept_id      bigint NOT NULL REFERENCES concept(id),
    description     text,
    quantity        numeric(12,4),                   -- horas, días, lunes...
    base_amount     numeric(18,2),                   -- base sobre la que se calculó
    rate            numeric(9,6),                    -- tasa o multiplicador aplicado
    amount          numeric(18,2) NOT NULL CHECK (amount >= 0),
    loan_installment_id bigint REFERENCES loan_installment(id),
    employee_concept_id bigint REFERENCES employee_concept(id),
    overtime_entry_id   bigint REFERENCES overtime_entry(id)
);

-- Novedades puntuales del período (bono único, descuento eventual, ajuste)
CREATE TABLE payroll_novelty (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    period_id    bigint NOT NULL REFERENCES payroll_period(id),
    employee_id  bigint NOT NULL REFERENCES employee(id),
    concept_id   bigint NOT NULL REFERENCES concept(id),
    amount       numeric(18,2) NOT NULL CHECK (amount > 0),
    currency     currency_code NOT NULL DEFAULT 'VES',
    reason       text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. Auditoría genérica
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name text NOT NULL,
    row_id     bigint,
    action     text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    old_data   jsonb,
    new_data   jsonb,
    actor      text,
    at         timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Índices de consulta frecuente
-- ---------------------------------------------------------------------
CREATE INDEX ix_terms_employee       ON employment_terms(employee_id, effective_from);
CREATE INDEX ix_time_entry_date      ON time_entry(work_date);
CREATE INDEX ix_overtime_employee    ON overtime_entry(employee_id, work_date);
CREATE INDEX ix_emp_concept_employee ON employee_concept(employee_id);
CREATE INDEX ix_installment_due      ON loan_installment(due_date) WHERE status = 'PENDING';
CREATE INDEX ix_receipt_employee     ON payroll_receipt(employee_id);
CREATE INDEX ix_line_receipt         ON payroll_receipt_line(receipt_id);
CREATE INDEX ix_novelty_period       ON payroll_novelty(period_id, employee_id);