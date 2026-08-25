// server.js - API REST de HIDROSYS EC. v3.0
// Backend: Node.js + Express + PostgreSQL

const path    = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const pool    = require('./db/connection');

// WhatsApp Bot (Baileys)
let waBot = null;
if (process.env.WA_BOT_ENABLED !== 'false') {
    try {
        waBot = require('./whatsapp/bot');
    } catch (err) {
        console.warn('⚠️  WhatsApp bot no disponible:', err.message);
    }
}


const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Logger simple
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
    }
    next();
});

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as server_time, version() as pg_version');
        res.json({
            status: 'ok',
            db: 'conectado',
            server_time: result.rows[0].server_time,
            pg_version: result.rows[0].pg_version.split(' ').slice(0,2).join(' ')
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ============================================================
// AUTENTICACIÓN
// ============================================================

// Almacén de sesiones en memoria (se limpia al reiniciar el servidor)
const activeSessions = new Map();

const USERS = [
    {
        username: process.env.ADMIN_USER    || 'admin',
        password: process.env.ADMIN_PASS    || 'hidrosys2026',
        role:     'admin',
        name:     'Administrador',
    },
    {
        username: process.env.EMPLOYEE_USER || 'empleado',
        password: process.env.EMPLOYEE_PASS || 'soporte123',
        role:     'admin',  // mismo nivel de acceso que admin
        name:     'Empleado Hidrosys',
    },
];

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = USERS.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }

    // Generar token de sesión único
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
        username: user.username,
        name:     user.name,
        role:     user.role,
        createdAt: Date.now(),
    });

    res.json({ token, name: user.name, role: user.role });
});

app.get('/api/me', (req, res) => {
    const token = req.headers['x-session-token'];
    if (!token || !activeSessions.has(token)) {
        return res.status(401).json({ error: 'No autenticado.' });
    }
    const session = activeSessions.get(token);
    res.json({ name: session.name, role: session.role });
});

app.post('/api/logout', (req, res) => {
    const token = req.headers['x-session-token'];
    if (token) activeSessions.delete(token);
    res.json({ ok: true });
});

function requireAuth(req, res, next) {
    const token = req.headers['x-session-token'];
    if (!token || !activeSessions.has(token)) {
        return res.status(401).json({ error: 'No autenticado. Inicie sesión como administrador.' });
    }
    req.user = activeSessions.get(token);
    next();
}



// ============================================================
// DASHBOARD STATS
// ============================================================
app.get('/api/stats', async (req, res) => {
    try {
        const [total, pendientes, confirmadas, ingresosMes, clientes, leads] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM appointments'),
            pool.query("SELECT COUNT(*) FROM appointments WHERE status IN ('Pre-agendado','Reportado')"),
            pool.query("SELECT COUNT(*) FROM appointments WHERE status = 'Confirmado' OR status = 'Confirmado por Cliente'"),
            pool.query(`
                SELECT COALESCE(SUM(payment_amount),0) as total
                FROM appointments
                WHERE payment_status IN ('Pagado','Pagado (Anticipo)')
                AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
            `),
            pool.query('SELECT COUNT(*) FROM clients'),
            pool.query("SELECT COUNT(*) FROM leads WHERE status = 'Nuevo'"),
        ]);

        const zonas = await pool.query(`
            SELECT zone, COUNT(*) as count FROM appointments GROUP BY zone ORDER BY count DESC
        `);

        res.json({
            totalCitas:        parseInt(total.rows[0].count),
            citasPendientes:   parseInt(pendientes.rows[0].count),
            citasConfirmadas:  parseInt(confirmadas.rows[0].count),
            ingresosMes:       parseFloat(ingresosMes.rows[0].total),
            totalClientes:     parseInt(clientes.rows[0].count),
            leadsNuevos:       parseInt(leads.rows[0].count),
            citasPorZona:      zonas.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// PRODUCTOS
// ============================================================
app.get('/api/products', async (req, res) => {
    try {
        const { category, q } = req.query;
        let query = 'SELECT * FROM products WHERE active = TRUE';
        const params = [];
        if (category) { params.push(category); query += ` AND category = $${params.length}`; }
        if (q) { params.push(`%${q}%`); query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`; }
        query += ' ORDER BY category, name';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// TÉCNICOS (Gestión Completa y Configurable)
// ============================================================
app.get('/api/technicians', async (req, res) => {
    try {
        const { all } = req.query;
        let query = 'SELECT * FROM technicians';
        if (all !== 'true') {
            query += ' WHERE active = TRUE';
        }
        query += ' ORDER BY id ASC';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/technicians', async (req, res) => {
    try {
        const { name, specialty, zone, phone, email, avatar = '👷', active = true } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre del técnico es obligatorio' });
        const result = await pool.query(
            `INSERT INTO technicians (name, specialty, zone, phone, email, avatar, active, rating)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 5.00) RETURNING *`,
            [name.trim(), specialty?.trim() || '', zone?.trim() || 'Toda la Provincia', phone?.trim() || '', email?.trim() || '', avatar || '👷', active !== false]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/technicians/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, specialty, zone, phone, email, avatar, rating, active } = req.body;
        const result = await pool.query(
            `UPDATE technicians SET 
                name = COALESCE($1, name),
                specialty = COALESCE($2, specialty),
                zone = COALESCE($3, zone),
                phone = COALESCE($4, phone),
                email = COALESCE($5, email),
                avatar = COALESCE($6, avatar),
                rating = COALESCE($7, rating),
                active = COALESCE($8, active)
             WHERE id = $9 RETURNING *`,
            [name, specialty, zone, phone, email, avatar, rating, active, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Técnico no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/technicians/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT COUNT(*) FROM appointments WHERE tech_id = $1', [id]);
        const count = parseInt(check.rows[0].count);
        if (count > 0) {
            await pool.query('UPDATE technicians SET active = FALSE WHERE id = $1', [id]);
            return res.json({ message: 'Técnico desactivado para preservar historial de citas asociadas', deactivated: true });
        }
        await pool.query('DELETE FROM technicians WHERE id = $1', [id]);
        res.json({ message: 'Técnico eliminado permanentemente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// DISPONIBILIDAD Y CONTROL DE CUPOS / HORARIOS
// ============================================================
app.get('/api/availability', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ error: 'Fecha requerida (date=YYYY-MM-DD)' });

        const techRes = await pool.query('SELECT COUNT(*) FROM technicians WHERE active = TRUE');
        const totalTechs = parseInt(techRes.rows[0]?.count || '4');

        const aptRes = await pool.query(
            "SELECT apt_time, COUNT(*) as booked FROM appointments WHERE apt_date = $1 AND status NOT IN ('Cancelado') GROUP BY apt_time",
            [date]
        );

        const slots = [
            { id: '1', time: '09:00', label: 'Mañana (08:00 – 12:00)' },
            { id: '2', time: '14:00', label: 'Tarde (13:00 – 17:00)' },
            { id: '3', time: '17:00', label: 'Tarde-Noche (17:00 – 19:00)' }
        ];

        const availability = slots.map(s => {
            const row = aptRes.rows.find(r => String(r.apt_time).startsWith(s.time.slice(0, 2)));
            const booked = row ? parseInt(row.booked) : 0;
            const free = Math.max(0, totalTechs - booked);
            return {
                id: s.id,
                time: s.time,
                label: s.label,
                totalTechs,
                booked,
                free,
                available: free > 0
            };
        });

        res.json({
            date,
            totalTechs,
            slots: availability
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// CLIENTES (Gestión Completa, Cédula y Configuración)
// ============================================================
app.get('/api/clients', async (req, res) => {
    try {
        const { q } = req.query;
        let query = `
            SELECT c.*, COUNT(a.id) as total_appointments,
                   MAX(a.apt_date) as last_service_date
            FROM clients c
            LEFT JOIN appointments a ON c.phone = a.client_phone
        `;
        const params = [];
        if (q && q.trim()) {
            params.push(`%${q.trim()}%`);
            query += ` WHERE c.name ILIKE $1 OR c.phone ILIKE $1 OR c.cedula ILIKE $1 OR c.email ILIKE $1`;
        }
        query += ' GROUP BY c.id ORDER BY c.created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clients', async (req, res) => {
    try {
        const { name, phone, email, address, zone, notes, cedula } = req.body;
        if (!name || !phone) return res.status(400).json({ error: 'Nombre y teléfono son obligatorios.' });
        const result = await pool.query(
            `INSERT INTO clients (name, phone, email, address, zone, notes, cedula)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (phone) DO UPDATE SET 
                name = EXCLUDED.name, 
                email = COALESCE(EXCLUDED.email, clients.email), 
                address = COALESCE(EXCLUDED.address, clients.address), 
                zone = COALESCE(EXCLUDED.zone, clients.zone), 
                notes = COALESCE(EXCLUDED.notes, clients.notes),
                cedula = COALESCE(EXCLUDED.cedula, clients.cedula)
             RETURNING *`,
            [name.trim(), phone.trim(), email?.trim() || null, address?.trim() || null, zone || null, notes?.trim() || null, cedula?.trim() || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/surveys', async (req, res) => {
    try {
        const { appointmentId, rating, comment, audioDuration } = req.body;
        const result = await pool.query(
            `INSERT INTO surveys (appointment_id, rating, comment, audio_duration)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [appointmentId, rating, comment, audioDuration]
        );
        // Marcar cita como calificada y enviar confirmación por WhatsApp
        if (appointmentId) {
            await pool.query('UPDATE appointments SET survey_completed = TRUE WHERE id = $1', [appointmentId]);
            if (waBot && waBot.notifySurveyReceived) {
                waBot.notifySurveyReceived(parseInt(appointmentId), parseInt(rating)).catch(err => {
                    console.error('[WA Bot] Error notificando recepción de encuesta:', err.message);
                });
            }
        }
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email, address, zone, notes, cedula } = req.body;
        const result = await pool.query(
            `UPDATE clients
             SET name = COALESCE($1, name),
                 phone = COALESCE($2, phone),
                 email = COALESCE($3, email),
                 address = COALESCE($4, address),
                 zone = COALESCE($5, zone),
                 notes = COALESCE($6, notes),
                 cedula = COALESCE($7, cedula)
             WHERE id = $8
             RETURNING *`,
            [name?.trim(), phone?.trim(), email?.trim() || null, address?.trim() || null, zone, notes?.trim() || null, cedula?.trim() || null, id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const cli = await pool.query('SELECT phone FROM clients WHERE id = $1', [id]);
        if (!cli.rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
        const phone = cli.rows[0].phone;
        const aptCheck = await pool.query('SELECT COUNT(*) FROM appointments WHERE client_phone = $1', [phone]);
        if (parseInt(aptCheck.rows[0].count) > 0) {
            return res.status(400).json({ error: 'No se puede eliminar este cliente porque tiene citas registradas en el historial. Puedes editar sus datos.' });
        }
        await pool.query('DELETE FROM clients WHERE id = $1', [id]);
        res.json({ message: 'Cliente eliminado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// VALIDACIÓN DE CLIENTE POR CÉDULA Y CÓDIGO OTP POR WHATSAPP
// ============================================================
const clientOtpStore = new Map(); // cedula -> { code, client, expires }

app.post('/api/clients/lookup-cedula', async (req, res) => {
    try {
        const { cedula } = req.body;
        if (!cedula || cedula.trim().length < 4) {
            return res.status(400).json({ error: 'Número de cédula requerido' });
        }
        const cleanCedula = cedula.trim();
        const result = await pool.query(
            `SELECT * FROM clients WHERE cedula = $1 OR phone LIKE $2 ORDER BY id DESC LIMIT 1`,
            [cleanCedula, `%${cleanCedula}%`]
        );

        if (!result.rows.length) {
            return res.json({ found: false, message: 'Cédula no encontrada en el registro previo.' });
        }

        const client = result.rows[0];
        const code = String(Math.floor(1000 + Math.random() * 9000));
        clientOtpStore.set(cleanCedula, {
            code,
            client,
            expires: Date.now() + 5 * 60 * 1000 // 5 minutos
        });

        // Enviar WhatsApp al celular registrado del cliente
        if (waBot && waBot.sendClientVerificationOtp) {
            waBot.sendClientVerificationOtp(client.phone, client.name, code).catch(err => {
                console.error('[WA Bot] Error enviando OTP:', err.message);
            });
        }

        const rawPhone = client.phone || '';
        const masked = rawPhone.length > 5 ? rawPhone.slice(0, 3) + '****' + rawPhone.slice(-3) : rawPhone;

        res.json({
            found: true,
            maskedPhone: masked,
            clientName: client.name,
            message: `Código de seguridad enviado al WhatsApp ${masked}`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/clients/verify-otp', async (req, res) => {
    try {
        const { cedula, otp } = req.body;
        if (!cedula || !otp) {
            return res.status(400).json({ error: 'Cédula y código requeridos' });
        }
        const cleanCedula = cedula.trim();
        const record = clientOtpStore.get(cleanCedula);

        if (!record) {
            return res.status(400).json({ success: false, error: 'No hay un código pendiente para esta cédula o ya expiró.' });
        }

        if (Date.now() > record.expires) {
            clientOtpStore.delete(cleanCedula);
            return res.status(400).json({ success: false, error: 'El código de seguridad ha expirado. Solicita uno nuevo.' });
        }

        if (record.code !== String(otp).trim()) {
            return res.status(400).json({ success: false, error: 'El código ingresado es incorrecto. Por favor verifica el mensaje en tu WhatsApp.' });
        }

        const client = record.client;
        clientOtpStore.delete(cleanCedula);

        res.json({
            success: true,
            client: {
                name: client.name,
                phone: client.phone,
                email: client.email,
                address: client.address,
                zone: client.zone,
                cedula: client.cedula
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// CITAS (APPOINTMENTS)
// ============================================================
app.get('/api/appointments', async (req, res) => {
    try {
        const { status, zone, date_from, date_to, q, limit = 50, offset = 0 } = req.query;
        let query = 'SELECT * FROM appointments_full WHERE 1=1';
        const params = [];

        if (status) { params.push(status); query += ` AND status = $${params.length}`; }
        if (zone)   { params.push(zone);   query += ` AND zone = $${params.length}`; }
        if (date_from) { params.push(date_from); query += ` AND apt_date >= $${params.length}`; }
        if (date_to)   { params.push(date_to);   query += ` AND apt_date <= $${params.length}`; }
        if (q) {
            params.push(`%${q}%`);
            query += ` AND (client_name ILIKE $${params.length} OR client_phone ILIKE $${params.length} OR service_type ILIKE $${params.length})`;
        }

        query += ` ORDER BY id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/appointments', async (req, res) => {
    try {
        const {
            clientName, clientPhone, clientEmail, address, zone,
            serviceType, aptDate, aptTime, paymentMode, notes, channel
        } = req.body;

        let paymentAmount = 15.00;
        if (paymentMode && paymentMode.toLowerCase().includes('anticipo')) paymentAmount = 7.50;

        const result = await pool.query(
            `INSERT INTO appointments
             (client_name, client_phone, client_email, address, zone, service_type,
              apt_date, apt_time, payment_mode, payment_amount, notes, channel)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [clientName, clientPhone, clientEmail, address, zone, serviceType,
             aptDate, aptTime, paymentMode, paymentAmount, notes, channel || 'Formulario']
        );

        // Upsert del cliente
        await pool.query(
            `INSERT INTO clients (name, phone, email, address, zone)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name`,
            [clientName, clientPhone, clientEmail, address, zone]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const fields = req.body;

        // 1. Obtener estado previo de la cita para detectar cambios reales y evitar duplicados
        const prevRes = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
        if (!prevRes.rows.length) return res.status(404).json({ error: 'Cita no encontrada' });
        const prevApt = prevRes.rows[0];

        // Mapear campos del frontend a columnas de la DB
        const fieldMap = {
            status:          'status',
            paymentStatus:   'payment_status',
            techId:          'tech_id',
            bank:            'bank',
            receiptNo:       'receipt_no',
            receiptImg:      'receipt_img',
            surveyCompleted: 'survey_completed',
            notes:           'notes',
        };

        const updates = [];
        const values  = [];
        Object.entries(fields).forEach(([key, val]) => {
            if (fieldMap[key] !== undefined) {
                values.push(val);
                updates.push(`${fieldMap[key]} = $${values.length}`);
            }
        });

        if (!updates.length) return res.status(400).json({ error: 'No hay campos para actualizar' });

        values.push(id);
        const result = await pool.query(
            `UPDATE appointments SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
            values
        );

        if (!result.rows.length) return res.status(404).json({ error: 'Cita no encontrada' });

        const updatedApt = result.rows[0];

        // 2. Notificación al CLIENTE solo cuando pasa a Confirmado / Pagado por primera vez (evita duplicados)
        const isNowConfirmed = (updatedApt.status === 'Confirmado' || fields.status === 'Confirmado' || updatedApt.payment_status === 'Pagado' || fields.paymentStatus === 'Pagado');
        const wasAlreadyConfirmed = (prevApt.status === 'Confirmado' || prevApt.status === 'Conf. Cliente');

        if (waBot && waBot.notifyPaymentApproved && isNowConfirmed && !wasAlreadyConfirmed) {
            waBot.notifyPaymentApproved(parseInt(id)).catch(err => {
                console.error('[WA Bot] Error en notificación automática PUT /appointments/:id:', err.message);
            });
        }

        // 3. Notificación al TÉCNICO asignado cuando se le asigna o actualiza una cita
        const newTechId = updatedApt.tech_id;
        const prevTechId = prevApt.tech_id;
        if (waBot && waBot.notifyTechnicianJobAssigned && newTechId && (newTechId !== prevTechId || (isNowConfirmed && !wasAlreadyConfirmed))) {
            waBot.notifyTechnicianJobAssigned(parseInt(id), parseInt(newTechId)).catch(err => {
                console.error('[WA Bot] Error notificando al técnico asignado:', err.message);
            });
        }

        // 4. Si el estado se actualiza a Terminado, enviar automáticamente mensaje de conclusión y encuesta CSAT
        if (waBot && waBot.notifyServiceCompleted && (updatedApt.status === 'Terminado' || fields.status === 'Terminado') && prevApt.status !== 'Terminado') {
            waBot.notifyServiceCompleted(parseInt(id)).catch(err => {
                console.error('[WA Bot] Error enviando encuesta de servicio completado:', err.message);
            });
        }

        // 5. Si se envía reporte de pago desde la web o cliente
        if (waBot && waBot.notifyPaymentReported && (fields.bank || fields.receiptNo || fields.status === 'Reportado') && prevApt.status === 'Pre-agendado') {
            waBot.notifyPaymentReported(parseInt(id), fields.bank, fields.receiptNo).catch(err => {
                console.error('[WA Bot] Error en notificación de reporte de pago:', err.message);
            });
        }

        res.json(updatedApt);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para consultar citas pendientes de pago (Búsqueda por Cédula, Teléfono o ID)
app.get('/api/appointments/pending-payment', async (req, res) => {
    try {
        const { q } = req.query;
        let query = `
            SELECT a.*, c.cedula
            FROM appointments a
            LEFT JOIN clients c ON a.client_phone = c.phone
            WHERE a.status = 'Pre-agendado' AND (a.receipt_no IS NULL OR a.receipt_no = 'null' OR a.receipt_no = '')
        `;
        const params = [];
        if (q && q.trim()) {
            params.push(`%${q.trim()}%`);
            query += ` AND (a.client_phone ILIKE $1 OR a.client_name ILIKE $1 OR c.cedula ILIKE $1 OR CAST(a.id AS TEXT) = $1)`;
        }
        query += ' ORDER BY a.id DESC LIMIT 20';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint para consultar citas completadas pendientes de encuesta (Búsqueda por Cédula, Teléfono o ID)
app.get('/api/appointments/pending-survey', async (req, res) => {
    try {
        const { q } = req.query;
        let query = `
            SELECT a.*, c.cedula, t.name as tech_name
            FROM appointments a
            LEFT JOIN clients c ON a.client_phone = c.phone
            LEFT JOIN technicians t ON a.tech_id = t.id
            WHERE a.status = 'Terminado' AND (a.survey_completed = FALSE OR a.survey_completed IS NULL)
        `;
        const params = [];
        if (q && q.trim()) {
            params.push(`%${q.trim()}%`);
            query += ` AND (a.client_phone ILIKE $1 OR a.client_name ILIKE $1 OR c.cedula ILIKE $1 OR CAST(a.id AS TEXT) = $1)`;
        }
        query += ' ORDER BY a.id DESC LIMIT 20';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/appointments/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
        res.json({ message: 'Cita eliminada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// LEADS
// ============================================================
app.get('/api/leads', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/leads', async (req, res) => {
    try {
        const { name, phone, email, address, details, source } = req.body;
        const result = await pool.query(
            `INSERT INTO leads (name, phone, email, address, details, source)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [name, phone, email, address, details, source || 'Web']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/leads/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const result = await pool.query(
            'UPDATE leads SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Convertir lead a cliente
app.post('/api/leads/:id/convert', async (req, res) => {
    try {
        const lead = await pool.query('SELECT * FROM leads WHERE id = $1', [req.params.id]);
        if (!lead.rows.length) return res.status(404).json({ error: 'Lead no encontrado' });

        const l = lead.rows[0];
        const client = await pool.query(
            `INSERT INTO clients (name, phone, email, address)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name RETURNING *`,
            [l.name, l.phone, l.email, l.address]
        );

        await pool.query("UPDATE leads SET status = 'Convertido' WHERE id = $1", [req.params.id]);
        res.json({ client: client.rows[0], lead: { ...l, status: 'Convertido' } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// ENCUESTAS
// ============================================================
app.get('/api/surveys', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.*, a.client_name, a.service_type, a.zone, a.apt_date,
                   t.name as tech_name
            FROM surveys s
            LEFT JOIN appointments a ON s.appointment_id = a.id
            LEFT JOIN technicians t ON a.tech_id = t.id
            ORDER BY s.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/surveys', async (req, res) => {
    try {
        const { appointmentId, rating, comment, audioDuration } = req.body;
        const result = await pool.query(
            `INSERT INTO surveys (appointment_id, rating, comment, audio_duration)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [appointmentId, rating, comment, audioDuration]
        );
        // Marcar cita como calificada
        if (appointmentId) {
            await pool.query('UPDATE appointments SET survey_completed = TRUE WHERE id = $1', [appointmentId]);
        }
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// FRONTEND (SPA - sirve index.html para cualquier ruta no-API)
// ============================================================
// WHATSAPP – Endpoints de control
// ============================================================
app.get('/wa-qr', (req, res) => {
    if (!waBot) return res.send('<h1>WhatsApp bot no está habilitado en el archivo .env</h1>');
    const status = waBot.getBotStatus();
    if (status.connected) {
        return res.send(`
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f0f2f5;">
                <div style="background:white; padding:30px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); text-align:center;">
                    <h2 style="color:#075e54; margin-bottom:10px;">¡WhatsApp ya está conectado! ✅</h2>
                    <p style="color:#667781; font-size:14px; margin-bottom:20px;">Número conectado: +${status.phone}</p>
                    <button onclick="window.close()" style="background:#075e54; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">Cerrar Ventana</button>
                </div>
            </div>
        `);
    }
    const qrData = waBot.getLastQr();
    if (!qrData) {
        return res.send(`
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f0f2f5;">
                <div style="background:white; padding:30px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.15); text-align:center;">
                    <h2 style="color:#e53e3e; margin-bottom:10px;">Generando código QR...</h2>
                    <p style="color:#667781; font-size:14px; margin-bottom:20px;">Por favor espera y recarga la página en unos segundos.</p>
                    <button onclick="location.reload()" style="background:#1976d2; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">🔄 Recargar Página</button>
                </div>
            </div>
        `);
    }
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qrData)}`;
    res.send(`
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; background:#f0f2f5;">
            <div style="background:white; padding:40px; border-radius:18px; box-shadow:0 12px 40px rgba(0,0,0,0.12); text-align:center; max-width:420px; margin:20px;">
                <h2 style="color:#075e54; margin-bottom:8px; font-weight:bold; font-size:24px;">Vincular WhatsApp 💧</h2>
                <p style="color:#667781; font-size:14px; margin-bottom:24px; line-height:1.4;">Abre WhatsApp en tu teléfono -> Dispositivos vinculados -> Vincular un dispositivo y escanea este código:</p>
                <div style="background:#f8f9fa; padding:16px; border-radius:12px; display:inline-block; border:1px solid #e9ecef;">
                    <img src="${qrImageUrl}" alt="WhatsApp QR Code" style="display:block; width:300px; height:300px;"/>
                </div>
                <p style="margin-top:20px; font-size:12px; color:#a0aec0; line-height:1.4;">El código QR se actualiza cada 20 segundos automáticamente.<br>Recarga si no se vincula.</p>
                <button onclick="location.reload()" style="background:#edf2f7; color:#4a5568; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold; margin-top:16px;">🔄 Actualizar QR Manualmente</button>
            </div>
        </div>
    `);
});

app.get('/api/wa/status', (req, res) => {
    if (!waBot) return res.json({ enabled: false, connected: false });
    const status = waBot.getBotStatus();
    res.json({ enabled: true, ...status });
});

app.post('/api/wa/restart', requireAuth, async (req, res) => {
    if (!waBot) return res.status(400).json({ success: false, error: 'Bot de WhatsApp no habilitado' });
    try {
        await waBot.restartWhatsAppBot();
        res.json({ success: true, message: 'Reinicio iniciado. Generando nuevo código QR...' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint temporal para pruebas de envío manual
app.get('/api/wa/test-send', async (req, res) => {
    const { phone, text } = req.query;
    if (!waBot) return res.json({ error: 'Bot no habilitado' });
    if (!phone) return res.json({ error: 'Falta el parámetro phone' });
    try {
        const success = await waBot.sendMessage(phone, text || 'Prueba de conexión Hidrosys');
        res.json({ success });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Llamado automáticamente cuando el admin aprueba un pago
app.post('/api/wa/notify/:aptId', async (req, res) => {
    const { aptId } = req.params;
    if (!waBot) return res.json({ sent: false, reason: 'Bot no habilitado' });
    try {
        const sent = await waBot.notifyPaymentApproved(parseInt(aptId));
        res.json({ sent });
    } catch (err) {
        res.status(500).json({ sent: false, error: err.message });
    }
});

// ============================================================
// FRONTEND (SPA)
// ============================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// INICIO DEL SERVIDOR
// ============================================================
app.listen(PORT, async () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   HIDROSYS EC. - Sistema v3.0          ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`🌐 Servidor corriendo en: http://localhost:${PORT}`);

    // Verificar conexión a DB y ejecutar migraciones básicas
    try {
        const r = await pool.query('SELECT NOW()');
        console.log(`✅ PostgreSQL conectado: ${r.rows[0].now}`);
        
        // Migraciones de columnas necesarias
        await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS wa_sender VARCHAR(50)');
        await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS cedula VARCHAR(20)');
        
        // Limpieza y deduplicación de técnicos si hubiesen duplicados en producción
        try {
            await pool.query(`
                DELETE FROM technicians WHERE id NOT IN (
                    SELECT MIN(id) FROM technicians GROUP BY LOWER(TRIM(name))
                );
            `);
            await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_technicians_unique_name ON technicians (LOWER(TRIM(name)));`);
        } catch (e) {
            console.warn('[DB Migration] Aviso índice técnicos:', e.message);
        }

        console.log('✅ Migraciones de DB: Columnas, índice de técnicos y deduplicación verificadas.\n');
    } catch (err) {
        console.error(`❌ PostgreSQL NO conectado o error en migración: ${err.message}`);
        console.error('   Verifica tu archivo .env y que PostgreSQL esté corriendo\n');
    }

    // Iniciar bot de WhatsApp
    if (waBot) {
        setTimeout(() => {
            waBot.startWhatsAppBot().catch(err => {
                console.error('❌ Error iniciando WhatsApp bot:', err.message);
            });
        }, 2000); // 2s de espera para que el servidor esté listo
    }

    // ============================================================
    // SERVICIO AUTOMÁTICO DE RECORDATORIOS DE CITAS (CRON)
    // ============================================================
    const remindersSent = new Set();
    async function checkAutomatedReminders() {
        try {
            if (!waBot || !waBot.notifyAppointmentReminder) return;
            const todayStr = new Date().toISOString().split('T')[0];
            const res = await pool.query(
                `SELECT id, apt_date, status, client_name, client_phone
                 FROM appointments
                 WHERE apt_date >= CURRENT_DATE AND apt_date <= CURRENT_DATE + INTERVAL '1 day'
                   AND status IN ('Confirmado', 'Conf. Cliente', 'Agendado')`
            );

            for (const apt of res.rows) {
                const reminderKey = `${apt.id}_${todayStr}`;
                if (!remindersSent.has(reminderKey)) {
                    console.log(`[Auto-Reminder] ⏰ Enviando recordatorio automático para cita #${apt.id} (${apt.client_name})...`);
                    await waBot.notifyAppointmentReminder(apt.id);
                    remindersSent.add(reminderKey);
                }
            }
        } catch (err) {
            console.error('[Auto-Reminder] Error en recordatorios automáticos:', err.message);
        }
    }

    // Chequeo periódico cada 30 minutos y primera ejecución a los 25 segundos
    setInterval(checkAutomatedReminders, 30 * 60 * 1000);
    setTimeout(checkAutomatedReminders, 25000);
});
