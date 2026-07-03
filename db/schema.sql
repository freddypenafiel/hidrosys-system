-- ====================================================
-- ESQUEMA DE BASE DE DATOS: hidrosys_db
-- HIDROSYS EC. - Sistema de Gestión v3.0
-- ====================================================

-- Crear base de datos (ejecutar desde psql si no existe)
-- CREATE DATABASE hidrosys_db;

-- ====================================================
-- TABLA: products (Catálogo de Productos)
-- ====================================================
CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    category    VARCHAR(100) NOT NULL,
    description TEXT,
    price       DECIMAL(10,2) NOT NULL,
    specs       TEXT,
    icon        VARCHAR(10) DEFAULT '⚙️',
    stock       INTEGER DEFAULT 0,
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- TABLA: technicians (Técnicos)
-- ====================================================
CREATE TABLE IF NOT EXISTS technicians (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    specialty   VARCHAR(200),
    zone        VARCHAR(50),
    avatar      VARCHAR(10) DEFAULT '👷',
    phone       VARCHAR(20),
    email       VARCHAR(100),
    rating      DECIMAL(3,2) DEFAULT 5.00,
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- TABLA: clients (Clientes)
-- ====================================================
CREATE TABLE IF NOT EXISTS clients (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    phone       VARCHAR(30) NOT NULL,
    email       VARCHAR(100),
    address     TEXT,
    zone        VARCHAR(50),
    notes       TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone)
);

-- ====================================================
-- TABLA: appointments (Visitas Técnicas)
-- ====================================================
CREATE TABLE IF NOT EXISTS appointments (
    id              SERIAL PRIMARY KEY,
    client_name     VARCHAR(150) NOT NULL,
    client_phone    VARCHAR(30)  NOT NULL,
    client_email    VARCHAR(100),
    address         TEXT,
    zone            VARCHAR(50)  NOT NULL,
    service_type    VARCHAR(200) NOT NULL,
    apt_date        DATE         NOT NULL,
    apt_time        TIME         NOT NULL,
    payment_mode    VARCHAR(100),
    payment_amount  DECIMAL(10,2) DEFAULT 15.00,
    payment_status  VARCHAR(50)  DEFAULT 'Pendiente',
    bank            VARCHAR(100),
    receipt_no      VARCHAR(100),
    receipt_img     VARCHAR(255),
    tech_id         INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
    status          VARCHAR(80)  DEFAULT 'Pre-agendado',
    notes           TEXT,
    channel         VARCHAR(50)  DEFAULT 'Formulario',
    survey_completed BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_updated_at ON appointments;
CREATE TRIGGER appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ====================================================
-- TABLA: leads (Prospectos / Futuros Clientes)
-- ====================================================
CREATE TABLE IF NOT EXISTS leads (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    phone       VARCHAR(30),
    email       VARCHAR(100),
    address     TEXT,
    details     TEXT,
    status      VARCHAR(50) DEFAULT 'Nuevo',
    source      VARCHAR(50) DEFAULT 'Web',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- TABLA: surveys (Encuestas de Satisfacción)
-- ====================================================
CREATE TABLE IF NOT EXISTS surveys (
    id              SERIAL PRIMARY KEY,
    appointment_id  INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    rating          SMALLINT CHECK(rating BETWEEN 1 AND 5),
    comment         TEXT,
    audio_filename  VARCHAR(255),
    audio_duration  VARCHAR(20),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- ÍNDICES PARA OPTIMIZAR BÚSQUEDAS
-- ====================================================
CREATE INDEX IF NOT EXISTS idx_appointments_zone    ON appointments(zone);
CREATE INDEX IF NOT EXISTS idx_appointments_status  ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date    ON appointments(apt_date);
CREATE INDEX IF NOT EXISTS idx_appointments_phone   ON appointments(client_phone);
CREATE INDEX IF NOT EXISTS idx_clients_phone        ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status         ON leads(status);

-- ====================================================
-- VISTA: appointments_full (Vista enriquecida con técnico)
-- ====================================================
CREATE OR REPLACE VIEW appointments_full AS
SELECT
    a.*,
    t.name        AS tech_name,
    t.specialty   AS tech_specialty,
    t.zone        AS tech_zone,
    t.avatar      AS tech_avatar,
    t.rating      AS tech_rating
FROM appointments a
LEFT JOIN technicians t ON a.tech_id = t.id;
