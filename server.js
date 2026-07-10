// server.js - API REST de HIDROSYS EC. v3.0
// Backend: Node.js + Express + PostgreSQL

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const crypto  = require('crypto');
const pool    = require('./db/connection');


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
// TÉCNICOS
// ============================================================
app.get('/api/technicians', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM technicians WHERE active = TRUE ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/technicians/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, specialty, zone, phone, email, rating } = req.body;
        const result = await pool.query(
            `UPDATE technicians SET name=$1, specialty=$2, zone=$3, phone=$4, email=$5, rating=$6 WHERE id=$7 RETURNING *`,
            [name, specialty, zone, phone, email, rating, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// CLIENTES
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
        if (q) {
            params.push(`%${q}%`);
            query += ` WHERE c.name ILIKE $1 OR c.phone ILIKE $1`;
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
        const { name, phone, email, address, zone, notes } = req.body;
        const result = await pool.query(
            `INSERT INTO clients (name, phone, email, address, zone, notes)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, address=EXCLUDED.address, zone=EXCLUDED.zone
             RETURNING *`,
            [name, phone, email, address, zone, notes]
        );
        res.status(201).json(result.rows[0]);
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

        query += ` ORDER BY apt_date DESC, apt_time DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
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
        res.json(result.rows[0]);
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

    // Verificar conexión a DB
    try {
        const r = await pool.query('SELECT NOW()');
        console.log(`✅ PostgreSQL conectado: ${r.rows[0].now}\n`);
    } catch (err) {
        console.error(`❌ PostgreSQL NO conectado: ${err.message}`);
        console.error('   Verifica tu archivo .env y que PostgreSQL esté corriendo\n');
    }
});
