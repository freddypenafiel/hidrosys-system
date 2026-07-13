// server.js - API REST de HIDROSYS EC. v3.0
// Backend: Node.js + Express + PostgreSQL

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
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
        // Si el estado o pago se actualiza a Confirmado / Pagado, enviar automáticamente confirmación de WhatsApp
        if (waBot && waBot.notifyPaymentApproved && (
            updatedApt.status === 'Confirmado' ||
            updatedApt.payment_status === 'Pagado' ||
            updatedApt.payment_status === 'Aprobado' ||
            fields.status === 'Confirmado' ||
            fields.paymentStatus === 'Pagado'
        )) {
            waBot.notifyPaymentApproved(parseInt(id)).catch(err => {
                console.error('[WA Bot] Error en notificación automática PUT /appointments/:id:', err.message);
            });
        }

        res.json(updatedApt);
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

app.post('/api/wa/restart', authMiddleware, async (req, res) => {
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
        
        // Migración: agregar columna wa_sender a appointments
        await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS wa_sender VARCHAR(50)');
        console.log('✅ Migración de DB: Columna "wa_sender" verificada/creada exitosamente.\n');
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
});
