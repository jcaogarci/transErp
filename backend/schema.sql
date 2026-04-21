-- =============================================
-- TransERP - Esquema de base de datos PostgreSQL
-- Ejecuta este script en Supabase > SQL Editor
-- =============================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================== USUARIOS ===================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) DEFAULT 'operador' CHECK (rol IN ('admin', 'operador', 'facturacion', 'solo_lectura')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================== CONFIGURACIÓN EMPRESA ===================
CREATE TABLE IF NOT EXISTS configuracion (
  id INTEGER PRIMARY KEY DEFAULT 1,
  razon_social VARCHAR(200),
  cif VARCHAR(20),
  autorizacion_mte VARCHAR(50),
  consejero_dpam VARCHAR(100),
  direccion TEXT,
  telefono VARCHAR(20),
  email VARCHAR(150),
  dias_alerta_itv INTEGER DEFAULT 30,
  dias_alerta_adr_conductor INTEGER DEFAULT 30,
  dias_alerta_seguro INTEGER DEFAULT 30,
  dias_alerta_factura INTEGER DEFAULT 3,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO configuracion (id, razon_social, cif) VALUES (1, 'LogiTrans S.L.', 'B-12345678')
ON CONFLICT (id) DO NOTHING;

-- =================== CLIENTES ===================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razon_social VARCHAR(200) NOT NULL,
  cif VARCHAR(20),
  sector VARCHAR(100),
  carga_habitual VARCHAR(50),
  contacto VARCHAR(100),
  telefono VARCHAR(20),
  email VARCHAR(150),
  direccion TEXT,
  dias_pago VARCHAR(20) DEFAULT '30 días',
  estado VARCHAR(30) DEFAULT 'Activo' CHECK (estado IN ('Activo','Inactivo','Riesgo moroso')),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================== VEHÍCULOS ===================
CREATE TABLE IF NOT EXISTS vehiculos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricula VARCHAR(20) UNIQUE NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Tráiler estándar','Cisterna ADR','Frigorífico','Furgón','Volquete','Plataforma')),
  marca VARCHAR(50),
  modelo VARCHAR(100),
  anio INTEGER,
  km INTEGER DEFAULT 0,
  vencimiento_itv DATE,
  vencimiento_seguro DATE,
  certificado_adr DATE,
  capacidad_kg INTEGER,
  estado VARCHAR(30) DEFAULT 'Disponible' CHECK (estado IN ('Disponible','En ruta','Mantenimiento','Bloqueado')),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================== CONDUCTORES ===================
CREATE TABLE IF NOT EXISTS conductores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  dni VARCHAR(15),
  tipo_carne VARCHAR(10),
  vencimiento_carne DATE,
  vencimiento_adr DATE,
  vencimiento_cap DATE,
  telefono VARCHAR(20),
  email VARCHAR(150),
  estado VARCHAR(30) DEFAULT 'Disponible' CHECK (estado IN ('Disponible','En ruta','Baja','Vacaciones')),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================== EXPEDICIONES ===================
CREATE TABLE IF NOT EXISTS expediciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referencia VARCHAR(20) UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE SET NULL,
  conductor_id UUID REFERENCES conductores(id) ON DELETE SET NULL,
  fecha_salida DATE NOT NULL,
  fecha_entrega DATE,
  origen VARCHAR(100) NOT NULL,
  destino VARCHAR(100) NOT NULL,
  tipo_carga VARCHAR(50) NOT NULL,
  clase_adr VARCHAR(80),
  peso_kg NUMERIC(10,2),
  km_estimados INTEGER,
  importe NUMERIC(10,2) DEFAULT 0,
  estado VARCHAR(30) DEFAULT 'Planificada' CHECK (estado IN ('Planificada','Cargando','En ruta','Entregada','Incidencia','Cancelada')),
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_exp_estado ON expediciones(estado);
CREATE INDEX IF NOT EXISTS idx_exp_fecha ON expediciones(fecha_salida);
CREATE INDEX IF NOT EXISTS idx_exp_cliente ON expediciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_exp_ref ON expediciones(referencia);

-- =================== FACTURAS ===================
CREATE TABLE IF NOT EXISTS facturas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero VARCHAR(30) UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE,
  base_imponible NUMERIC(10,2) NOT NULL DEFAULT 0,
  porcentaje_iva NUMERIC(4,2) DEFAULT 21.00,
  total NUMERIC(10,2) GENERATED ALWAYS AS (base_imponible * (1 + porcentaje_iva/100)) STORED,
  concepto TEXT,
  estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Enviada','Cobrada','Vencida')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================== SUSTANCIAS ADR ===================
CREATE TABLE IF NOT EXISTS sustancias_adr (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero_onu VARCHAR(20) NOT NULL,
  denominacion TEXT NOT NULL,
  clase VARCHAR(20) NOT NULL,
  grupo_embalaje VARCHAR(5),
  punto_inflamacion VARCHAR(20),
  codigo_ems VARCHAR(20),
  restriccion_tunel VARCHAR(10),
  instrucciones_emergencia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================== ALERTAS LOG ===================
CREATE TABLE IF NOT EXISTS alertas_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('red','amber','green')),
  titulo VARCHAR(200) NOT NULL,
  descripcion TEXT,
  leida BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================== FUNCIÓN auto-updated_at ===================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clientes BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vehiculos BEFORE UPDATE ON vehiculos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conductores BEFORE UPDATE ON conductores FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_expediciones BEFORE UPDATE ON expediciones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_facturas BEFORE UPDATE ON facturas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =================== USUARIO ADMIN POR DEFECTO ===================
-- Contraseña: Admin1234! (cámbiala en primer login)
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES ('Administrador', 'admin@transErp.es', '$2b$10$rPWkEsJxP9R3nLkFz4mPIeJ8.8qhzqvGBj7RjXeNvKm2JLsL6tKYi', 'admin')
ON CONFLICT (email) DO NOTHING;

-- =================== DATOS DE EJEMPLO ===================
-- Vehículos
INSERT INTO vehiculos (matricula, tipo, marca, modelo, anio, km, vencimiento_itv, vencimiento_seguro, estado) VALUES
('1234ABC', 'Tráiler estándar', 'Volvo', 'FH 460', 2021, 312000, CURRENT_DATE + 240, CURRENT_DATE + 180, 'En ruta'),
('7892XYZ', 'Tráiler estándar', 'DAF', 'XF 530', 2019, 489200, CURRENT_DATE - 3, CURRENT_DATE + 90, 'Bloqueado'),
('4421DEF', 'Cisterna ADR', 'Mercedes', 'Actros 2553', 2022, 201400, CURRENT_DATE + 130, CURRENT_DATE + 200, 'En ruta'),
('9912GHI', 'Cisterna ADR', 'Scania', 'R 500', 2023, 178800, CURRENT_DATE + 340, CURRENT_DATE + 310, 'Disponible'),
('3310JKL', 'Frigorífico', 'MAN', 'TGX 18.500', 2020, 256000, CURRENT_DATE + 65, CURRENT_DATE + 150, 'En ruta'),
('5531MNO', 'Frigorífico', 'Iveco', 'S-WAY 490', 2022, 148300, CURRENT_DATE + 190, CURRENT_DATE + 220, 'Disponible')
ON CONFLICT (matricula) DO NOTHING;

-- Conductores
INSERT INTO conductores (nombre, dni, tipo_carne, vencimiento_carne, vencimiento_adr, vencimiento_cap, telefono, estado) VALUES
('Manuel García Ruiz', '12345678A', 'C+E', CURRENT_DATE + 1800, CURRENT_DATE + 900, CURRENT_DATE + 400, '600111222', 'En ruta'),
('Juan López Martínez', '23456789B', 'C+E', CURRENT_DATE + 1200, CURRENT_DATE + 600, CURRENT_DATE + 300, '600333444', 'En ruta'),
('Roberto Martín Torres', '34567890C', 'C', CURRENT_DATE + 900, NULL, CURRENT_DATE + 200, '600555666', 'Disponible'),
('Antonio Ruiz Sánchez', '45678901D', 'C+E', CURRENT_DATE + 600, CURRENT_DATE + 12, CURRENT_DATE + 250, '600777888', 'Disponible'),
('Carlos Torres Pérez', '56789012E', 'C+E', CURRENT_DATE + 1500, CURRENT_DATE + 450, CURRENT_DATE + 350, '600999000', 'En ruta'),
('Carmen Fernández Gil', '67890123F', 'C+E', CURRENT_DATE + 1100, CURRENT_DATE + 750, CURRENT_DATE + 400, '601000111', 'Disponible')
ON CONFLICT DO NOTHING;

-- Clientes
INSERT INTO clientes (razon_social, cif, sector, carga_habitual, contacto, telefono, dias_pago, estado) VALUES
('Petronor S.A.', 'A-48123456', 'Energía', 'ADR', 'Pedro Alonso', '944001234', '30 días', 'Activo'),
('Mercadona S.A.', 'A-46103834', 'Distribución', 'General', 'María Blanco', '961001234', '60 días', 'Activo'),
('ChemTrans S.L.', 'B-91234567', 'Química', 'ADR', 'Jorge Vidal', '912345678', '30 días', 'Riesgo moroso'),
('Repsol Comercial S.A.', 'A-30033493', 'Energía', 'ADR', 'Ana Medina', '917001234', '30 días', 'Activo'),
('Frifrío S.L.', 'B-00012345', 'Alimentación', 'Frigorífico', 'Luis Moreno', '963001234', '30 días', 'Activo'),
('Inditex S.A.', 'A-28233658', 'Moda/Retail', 'General', 'Sandra Otero', '981001234', '60 días', 'Activo')
ON CONFLICT DO NOTHING;

-- Sustancias ADR
INSERT INTO sustancias_adr (numero_onu, denominacion, clase, grupo_embalaje, punto_inflamacion, codigo_ems, restriccion_tunel) VALUES
('UN 1203', 'GASOLINA', 'Clase 3', 'II', '-43°C', 'F-E, S-E', 'B/D'),
('UN 1863', 'COMBUSTIBLE PARA MOTORES DE AVIACIÓN', 'Clase 3', 'III', '>23°C', 'F-E, S-E', 'D'),
('UN 1789', 'ÁCIDO CLORHÍDRICO EN SOLUCIÓN', 'Clase 8', 'II', NULL, 'F-A, S-B', 'E'),
('UN 2672', 'AMONIACO EN SOLUCIÓN ACUOSA', 'Clase 8', 'III', NULL, 'F-A, S-B', 'E'),
('UN 1954', 'GAS INFLAMABLE COMPRIMIDO, N.E.P.', 'Clase 2', NULL, NULL, 'F-D, S-U', 'B')
ON CONFLICT DO NOTHING;
