-- ====================================================
-- DATOS DE PRUEBA: hidrosys_db
-- Ejecutar DESPUÉS del schema.sql
-- ====================================================

-- Productos del Catálogo
INSERT INTO products (name, category, description, price, specs, icon, stock) VALUES
('Tubo PVC Presión U/C 110mm PN10', 'Agua Potable', 'Tubería PVC para conducción de agua a presión. Campana con unión elastomérica. Longitud 6m.', 45.50, 'Diámetro: 110mm | Presión: PN10 | Norma: INEN 1374', '💧', 120),
('Tubo PEAD 63mm SDR11', 'Agua Potable', 'Tubería Polietileno Alta Densidad flexible, ideal para acometidas domiciliarias.', 3.20, 'Diámetro: 63mm | SDR11 (PN16) | Venta por metro', '🌀', 500),
('Medidor Inteligente Metron 1/2"', 'Medición', 'Medidor de chorro único con pre-equipamiento para lectura remota. Homologado EEQSA.', 78.00, 'Diámetro: 15mm | Clase R160 | Cuerpo: Latón niquelado', '📟', 45),
('Válvula Compuerta Hierro Dúctil 2"', 'Hidráulica', 'Válvula de asiento elástico para agua potable. Cierre hermético de bajo torque.', 115.00, 'Diámetro: 50mm (2") | Bridada | Presión: PN16', '⚙️', 30),
('Regulador Presión Gas 3/4"', 'Gas', 'Regulador de doble etapa para redes de gas natural y GLP residencial/comercial.', 52.00, 'Conexión: 3/4" NPT | Presión entrada: 0.5-4 bar | Caudal: 10 m³/h', '🔥', 20),
('Bomba Centrífuga Pedrollo 1HP', 'Hidráulica', 'Bomba centrífuga para distribución en conjuntos residenciales y sistemas de presión.', 185.00, 'Potencia: 1HP (0.75kW) | Caudal máx: 90l/min | Altura máx: 36m', '⚡', 12),
('Codo PVC 90° 110mm', 'Accesorios', 'Codo de PVC para cambios de dirección en redes de agua potable a presión.', 8.50, 'Diámetro: 110mm | Ángulo: 90° | Material: PVC rígido', '🔩', 80),
('Tee PVC 110mm', 'Accesorios', 'Derivación en T para redes de distribución de agua potable.', 12.00, 'Diámetro: 110mm | Material: PVC rígido | INEN 1374', '🔩', 60)
ON CONFLICT DO NOTHING;

-- Técnicos
INSERT INTO technicians (name, specialty, zone, avatar, phone, email, rating) VALUES
('Ing. Carlos Mendoza', 'Redes de Agua Potable y Tuberías', 'Azogues', '👨‍💻', '+593 98 111 2233', 'c.mendoza@hidrosys.ec', 4.8),
('Sra. Andrea Ruiz', 'Conducción Hidráulica y Válvulas', 'Biblián', '👩‍🔧', '+593 98 222 3344', 'a.ruiz@hidrosys.ec', 4.9),
('Sr. Juan Pérez', 'Sistemas de Distribución de Gas', 'La Troncal', '👨‍🔧', '+593 98 333 4455', 'j.perez@hidrosys.ec', 4.7),
('Ing. Sofía Torres', 'Medición y Mantenimiento General', 'Cañar', '👩‍💻', '+593 98 444 5566', 's.torres@hidrosys.ec', 4.9)
ON CONFLICT DO NOTHING;

-- Clientes de Prueba
INSERT INTO clients (name, phone, email, address, zone) VALUES
('Freddy Loor', '+593 98 765 4321', 'freddy.loor@example.com', 'Av. 24 de Mayo y 10 de Agosto', 'Azogues - Luis Cordero'),
('María Saltos', '+593 99 123 4567', 'maria.saltos@example.com', 'Calle Sucre y Bolívar, Ed. Municipal', 'Biblián - Nazón'),
('Juan Alvear', '+593 95 987 6543', 'juan.alvear@example.com', 'Av. Alfonso Andrade y 3 de Noviembre', 'Cañar - Ingapirca')
ON CONFLICT (phone) DO NOTHING;

-- Citas de Prueba
INSERT INTO appointments (client_name, client_phone, client_email, address, zone, service_type, apt_date, apt_time, payment_mode, payment_amount, payment_status, bank, receipt_no, tech_id, status, notes, channel) VALUES
('Freddy Loor', '+593 98 765 4321', 'freddy.loor@example.com', 'Av. 24 de Mayo y 10 de Agosto', 'Azogues - Luis Cordero', 'Mantenimiento Preventivo Red', '2026-07-05', '10:00', 'Anticipo (50%)', 7.50, 'Pagado (Anticipo)', 'Banco Pichincha', 'TR-982341', 2, 'Confirmado', 'Revisar presión en tuberías de acometida.', 'Formulario'),
('María Saltos', '+593 99 123 4567', 'maria.saltos@example.com', 'Calle Sucre y Bolívar, Ed. Municipal', 'Biblián - Nazón', 'Instalación de Medidor de Agua', '2026-07-07', '14:00', 'Tarifa Base Completa', 15.00, 'Pendiente', NULL, NULL, NULL, 'Pre-agendado', 'Requiere medidor inteligente Metron 1/2".', 'WhatsApp'),
('Juan Alvear', '+593 95 987 6543', 'juan.alvear@example.com', 'Av. Alfonso Andrade y 3 de Noviembre', 'Cañar - Ingapirca', 'Fuga de Gas en Acometida', '2026-07-01', '11:00', 'Tarifa Base Completa', 15.00, 'Pagado', 'Banco Guayaquil', 'TR-110293', 3, 'Terminado', 'Se cambió válvula de bola de 3/4 y empaques.', 'Formulario')
ON CONFLICT DO NOTHING;

-- Lead de Prueba
INSERT INTO leads (name, phone, email, address, details, status, source) VALUES
('Constructora Alfa S.A.', '+593 96 111 2222', 'compras@constructoraalfa.ec', 'Av. 12 de Octubre y Lincoln, Of. 5', 'Cotización para 500m de tubería PEAD 110mm y 120 válvulas bridadas para proyecto inmobiliario en Cumbayá.', 'Nuevo', 'Web')
ON CONFLICT DO NOTHING;

-- Encuesta de Prueba
INSERT INTO surveys (appointment_id, rating, comment) VALUES
(3, 5, 'El técnico Juan fue muy profesional. Resolvió el problema en menos de 1 hora. Excelente servicio.')
ON CONFLICT DO NOTHING;
