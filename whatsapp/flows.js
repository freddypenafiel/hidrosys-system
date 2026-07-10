// whatsapp/flows.js - Motor de Conversación del Bot HIDROSYS
// Máquina de estados por número de teléfono

const pool = require('../db/connection');

// ============================================================
// DATOS GEOGRÁFICOS (Provincia del Cañar)
// ============================================================
const CANTONES = {
    '1': { nombre: 'Azogues',    parroquias: ['Azogues','Cojitambo','Guapán','Javier Loyola','Luis Cordero','Pindilig','Rivera','San Miguel','Taday'] },
    '2': { nombre: 'Biblián',    parroquias: ['Biblián','Nazón','San Francisco de Sageo','Turupamba'] },
    '3': { nombre: 'Cañar',      parroquias: ['Cañar','General Morales','Gualleturo','Honorato Vásquez','Ingapirca','Juncal','San Antonio'] },
    '4': { nombre: 'La Troncal', parroquias: ['La Troncal','Manuel de J. Calle','Pancho Negro'] },
    '5': { nombre: 'El Tambo',   parroquias: ['El Tambo'] },
    '6': { nombre: 'Déleg',      parroquias: ['Déleg','Solano'] },
    '7': { nombre: 'Suscal',     parroquias: ['Suscal'] },
};

const SERVICIOS = {
    '1': 'Instalación de Medidor de Agua',
    '2': 'Revisión / Reparación de Tubería',
    '3': 'Instalación de Red de Gas Domiciliario',
    '4': 'Mantenimiento de Sistema Hidráulico',
    '5': 'Inspección Técnica General',
    '6': 'Otro / Consulta',
};

const CUENTAS_BANCARIAS = `💳 *Cuentas para Transferencia:*
1️⃣ *B. Pichincha* – Cta: 2201948332
2️⃣ *B. Guayaquil* – Cta: 10482938
3️⃣ *Produbanco* – Cta: 0209384729
4️⃣ *JEP (Cooperativa)* – Cta: 551928374
5️⃣ *B. del Pacífico* – Cta: 72938472
6️⃣ *Coop. MEGO* – Cta: 938482932
7️⃣ *Alianza del Valle* – Cta: 384729221
8️⃣ *B. Bolivariano* – Cta: 048293847
_Titular: HIDROSYS EC. · RUC: 1793000000001_`;

// ============================================================
// ESTADO DE SESIONES (en memoria, por número de teléfono)
// ============================================================
const sessions = new Map(); // phone → { step, data }

function getSession(phone) {
    if (!sessions.has(phone)) {
        sessions.set(phone, { step: 'idle', data: {} });
    }
    return sessions.get(phone);
}

function setSession(phone, step, data = {}) {
    const current = getSession(phone);
    sessions.set(phone, { step, data: { ...current.data, ...data } });
}

function clearSession(phone) {
    sessions.set(phone, { step: 'idle', data: {} });
}

// ============================================================
// MENÚ PRINCIPAL
// ============================================================
function menuPrincipal() {
    return `💧 *HIDROSYS EC.* – Asistente Virtual\n\n¿En qué podemos ayudarte?\n\n1️⃣ Agendar visita técnica\n2️⃣ Reportar comprobante de pago\n3️⃣ Consultar estado de mi cita\n4️⃣ Ver catálogo / precios\n\n_Responde con el número de tu opción_`;
}

// ============================================================
// PROCESADOR PRINCIPAL DE MENSAJES
// ============================================================
async function processMessage(phone, text, senderJid) {
    const msg  = text.trim();
    const sess = getSession(phone);
    const step = sess.step;

    // ── Comandos globales ──────────────────────────────────────
    if (['menu', 'hola', 'hi', 'inicio', '0', 'cancel', 'cancelar'].includes(msg.toLowerCase())) {
        clearSession(phone);
        // Guardar el JID completo en la sesion para usar en booking
        if (senderJid) setSession(phone, 'idle', { senderJid });
        return menuPrincipal();
    }

    // Siempre actualizar el JID si viene en este mensaje
    if (senderJid && !sess.data.senderJid) {
        setSession(phone, step, { senderJid });
    }

    // ── IDLE / Saludo inicial ──────────────────────────────────
    if (step === 'idle') {
        clearSession(phone);
        setSession(phone, 'main_menu', { senderJid });
        return `👋 ¡Hola! Bienvenido al sistema de atención de *HIDROSYS EC.*\n\n` + menuPrincipal();
    }

    // ── MENÚ PRINCIPAL ─────────────────────────────────────────
    if (step === 'main_menu') {
        if (msg === '1') { setSession(phone, 'book_name'); return `📝 *Agendar Visita Técnica*\n\nPor favor, escribe tu *nombre completo*:`; }
        if (msg === '2') { setSession(phone, 'pay_phone'); return `💳 *Reportar Comprobante de Pago*\n\nEscribe el *número de teléfono* con el que registraste tu cita (ej. 0987654321):`; }
        if (msg === '3') { setSession(phone, 'status_phone'); return `🔍 *Consultar Estado de Cita*\n\nEscribe el *número de teléfono* con el que te registraste:`; }
        if (msg === '4') { clearSession(phone); setSession(phone, 'idle'); return `📦 *Catálogo de Servicios HIDROSYS:*\n\n🔧 Instalación medidor agua: $15.00\n🔧 Reparación de tubería: $15.00\n⛽ Red de gas domiciliario: $15.00\n🔩 Mant. sistema hidráulico: $15.00\n🔍 Inspección técnica: $15.00\n\n_Precio incluye visita técnica. Materiales adicionales se cotizan en sitio._\n\nEscribe *menu* para volver.`; }
        return `❓ Opción no válida. Responde con 1, 2, 3 o 4.\n\n` + menuPrincipal();
    }

    // ══════════════════════════════════════════════════════════
    //  FLUJO 1: AGENDAR CITA
    // ══════════════════════════════════════════════════════════
    if (step === 'book_name') {
        if (msg.length < 3) return `⚠️ Por favor escribe tu nombre completo (mínimo 3 letras).`;
        setSession(phone, 'book_phone', { name: msg });
        return `📱 Escribe tu número de *celular* (10 dígitos, ej. 0987654321):`;
    }

    if (step === 'book_phone') {
        if (!/^0[0-9]{9}$/.test(msg)) return `⚠️ Número inválido. Debe tener 10 dígitos y empezar con 0 (ej: 0987654321).`;
        setSession(phone, 'book_address', { clientPhone: msg });
        return `🏠 Escribe tu *dirección* o referencia del lugar (ej: Azogues, Barrio El Portete, calle Principal):`;
    }

    if (step === 'book_address') {
        if (msg.length < 5) return `⚠️ Por favor escribe una dirección más detallada.`;
        setSession(phone, 'book_canton', { address: msg });
        const lista = Object.entries(CANTONES).map(([k,v]) => `${k}️⃣ ${v.nombre}`).join('\n');
        return `📍 *Cantón de la Provincia del Cañar:*\n\n${lista}\n\nEscribe el número de tu cantón:`;
    }

    if (step === 'book_canton') {
        if (!CANTONES[msg]) return `❌ Opción inválida. Escribe un número del 1 al ${Object.keys(CANTONES).length}.`;
        const canton = CANTONES[msg];
        setSession(phone, 'book_parish', { canton: canton.nombre, parroquias: canton.parroquias });
        const lista = canton.parroquias.map((p, i) => `${i+1}. ${p}`).join('\n');
        return `🏘️ *Parroquia de ${canton.nombre}:*\n\n${lista}\n\nEscribe el número de tu parroquia:`;
    }

    if (step === 'book_parish') {
        const idx = parseInt(msg) - 1;
        const parroquias = sess.data.parroquias || [];
        if (isNaN(idx) || idx < 0 || idx >= parroquias.length) return `❌ Opción inválida. Escribe un número del 1 al ${parroquias.length}.`;
        setSession(phone, 'book_service', { parish: parroquias[idx], zone: `${sess.data.canton} - ${parroquias[idx]}` });
        const lista = Object.entries(SERVICIOS).map(([k,v]) => `${k}️⃣ ${v}`).join('\n');
        return `🔧 *Tipo de Servicio:*\n\n${lista}\n\nEscribe el número del servicio que necesitas:`;
    }

    if (step === 'book_service') {
        if (!SERVICIOS[msg]) return `❌ Opción inválida. Escribe un número del 1 al ${Object.keys(SERVICIOS).length}.`;
        setSession(phone, 'book_date', { service: SERVICIOS[msg] });
        const today = new Date();
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const minDate = tomorrow.toISOString().split('T')[0];
        return `📅 Escribe la *fecha preferida* para la visita técnica\n(formato: AAAA-MM-DD, mínimo mañana)\nEjemplo: ${minDate}`;
    }

    if (step === 'book_date') {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(msg)) return `❌ Formato incorrecto. Usa el formato AAAA-MM-DD\nEjemplo: 2026-07-15`;
        const fecha = new Date(msg);
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        if (fecha <= hoy) return `❌ La fecha debe ser a partir de mañana.`;
        setSession(phone, 'book_time', { date: msg });
        return `⏰ Escribe la *hora preferida* para la visita:\n\n1. Mañana (08:00 – 12:00)\n2. Tarde (13:00 – 17:00)\n3. Tarde-noche (17:00 – 19:00)\n\nEscribe 1, 2 o 3:`;
    }

    if (step === 'book_time') {
        const horarios = { '1': '09:00', '2': '14:00', '3': '17:00' };
        if (!horarios[msg]) return `❌ Escribe 1, 2 o 3.`;
        setSession(phone, 'book_confirm', { time: horarios[msg] });
        const d = sess.data;
        return `✅ *Resumen de tu cita:*\n\n👤 Nombre: *${d.name}*\n📱 Celular: *${d.clientPhone}*\n🏠 Dirección: *${d.address}*\n📍 Zona: *${d.zone || d.canton}*\n🔧 Servicio: *${d.service}*\n📅 Fecha: *${d.date}*\n⏰ Hora: *${horarios[msg]}*\n\n¿Confirmas esta información?\n1️⃣ Sí, confirmar\n2️⃣ No, empezar de nuevo`;
    }

    if (step === 'book_confirm') {
        if (msg === '2') { clearSession(phone); setSession(phone, 'idle'); return `↩️ Entendido. Escribe *hola* para empezar de nuevo.`; }
        if (msg !== '1') return `Responde con *1* para confirmar o *2* para cancelar.`;

        // Guardar en base de datos
        try {
            const d = sess.data;
            // Guardamos el JID completo del remitente (ej: 593990328940@s.whatsapp.net)
            // para poder enviar la confirmacion directamente al mismo chat sin reconstruir el numero
            const fullJid = d.senderJid || `${phone}@s.whatsapp.net`;
            const result = await pool.query(
                `INSERT INTO appointments
                 (client_name, client_phone, address, zone, service_type, apt_date, apt_time, payment_amount, channel, status, wa_sender)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
                [d.name, d.clientPhone, d.address, d.zone, d.service, d.date, d.time, 15.00, 'WhatsApp', 'Pre-agendado', fullJid]
            );
            await pool.query(
                `INSERT INTO clients (name, phone, address, zone) VALUES ($1,$2,$3,$4) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name`,
                [d.name, d.clientPhone, d.address, d.zone]
            );
            const aptId = result.rows[0].id;
            clearSession(phone);
            setSession(phone, 'idle');
            return `🎉 *¡Cita registrada exitosamente!*\n\n📋 ID de tu cita: *#${aptId}*\n\n⚠️ *IMPORTANTE:* Tu cita está *pre-agendada*. Para confirmarla, debes realizar una transferencia de *$15.00* a cualquiera de estas cuentas:\n\n${CUENTAS_BANCARIAS}\n\nUna vez realizado el pago, escribe *2* en el menú principal para reportar tu comprobante.\n\n_Escribe *menu* en cualquier momento para volver al inicio._`;
        } catch (err) {
            console.error('[WA Bot] Error al guardar cita:', err.message);
            return `❌ Ocurrió un error al registrar tu cita. Por favor, intenta nuevamente o llámanos directamente.`;
        }
    }

    // ══════════════════════════════════════════════════════════
    //  FLUJO 2: REPORTAR PAGO
    // ══════════════════════════════════════════════════════════
    if (step === 'pay_phone') {
        const numLimpio = msg.replace(/\s|-/g,'');
        try {
            const apts = await pool.query(
                `SELECT id, service_type, apt_date, status FROM appointments
                 WHERE client_phone = $1 AND status = 'Pre-agendado' AND receipt_no IS NULL
                 ORDER BY created_at DESC LIMIT 5`,
                [numLimpio]
            );
            if (!apts.rows.length) {
                clearSession(phone); setSession(phone,'idle');
                return `❌ No encontré citas pendientes de pago para ese número.\n\n_Escribe *menu* para volver al inicio._`;
            }
            const lista = apts.rows.map((a, i) => `${i+1}. #${a.id} – ${a.service_type} (${a.apt_date?.toISOString().split('T')[0]})`).join('\n');
            setSession(phone, 'pay_select_apt', { lookupPhone: numLimpio, aptRows: apts.rows });
            return `📋 Citas pendientes de pago:\n\n${lista}\n\nEscribe el *número* de la cita que ya pagaste:`;
        } catch (err) {
            return `❌ Error al buscar citas. Intenta de nuevo.`;
        }
    }

    if (step === 'pay_select_apt') {
        const idx   = parseInt(msg) - 1;
        const rows  = sess.data.aptRows || [];
        if (isNaN(idx) || idx < 0 || idx >= rows.length) return `❌ Número inválido. Escribe entre 1 y ${rows.length}.`;
        setSession(phone, 'pay_bank', { selectedAptId: rows[idx].id });
        return `🏦 ¿En qué banco realizaste la transferencia?\n\n1. Banco Pichincha\n2. Banco Guayaquil\n3. Produbanco\n4. JEP\n5. Banco del Pacífico\n6. Coop. MEGO\n7. Alianza del Valle\n8. Banco Bolivariano\n\nEscribe el número del banco:`;
    }

    if (step === 'pay_bank') {
        const bancos = ['Banco Pichincha','Banco Guayaquil','Produbanco','JEP','Banco del Pacífico','Coop. MEGO','Alianza del Valle','Banco Bolivariano'];
        const idx = parseInt(msg) - 1;
        if (isNaN(idx) || idx < 0 || idx >= bancos.length) return `❌ Número inválido. Escribe entre 1 y 8.`;
        setSession(phone, 'pay_receipt', { bank: bancos[idx] });
        return `🧾 Escribe el *número de comprobante* de la transferencia\n_(si no lo tienes, escribe "sin número")_:`;
    }

    if (step === 'pay_receipt') {
        const receiptNo = msg;
        try {
            const aptId = sess.data.selectedAptId;
            await pool.query(
                `UPDATE appointments SET bank=$1, receipt_no=$2, status='Reportado', payment_status='Pendiente de Validación' WHERE id=$3`,
                [sess.data.bank, receiptNo, aptId]
            );
            clearSession(phone); setSession(phone,'idle');
            return `✅ *¡Pago reportado correctamente!*\n\n📋 Cita: *#${aptId}*\n🏦 Banco: *${sess.data.bank}*\n🧾 Comprobante: *${receiptNo}*\n\nUn administrador verificará tu pago en breve. Cuando sea aprobado, recibirás un mensaje de confirmación en este chat.\n\n_Escribe *menu* para volver al inicio._`;
        } catch (err) {
            return `❌ Error al registrar el pago. Intenta de nuevo.`;
        }
    }

    // ══════════════════════════════════════════════════════════
    //  FLUJO 3: CONSULTAR ESTADO
    // ══════════════════════════════════════════════════════════
    if (step === 'status_phone') {
        const numLimpio = msg.replace(/\s|-/g,'');
        try {
            const apts = await pool.query(
                `SELECT a.id, a.service_type, a.apt_date, a.status, a.payment_status, t.name as tech_name
                 FROM appointments a LEFT JOIN technicians t ON a.tech_id = t.id
                 WHERE a.client_phone = $1 ORDER BY a.created_at DESC LIMIT 3`,
                [numLimpio]
            );
            if (!apts.rows.length) {
                clearSession(phone); setSession(phone,'idle');
                return `❌ No encontré citas para ese número.\n\n_Escribe *menu* para volver al inicio._`;
            }
            const info = apts.rows.map(a => {
                const fecha = a.apt_date?.toISOString().split('T')[0] || 'N/A';
                const tech  = a.tech_name ? `👷 Técnico: ${a.tech_name}` : '';
                return `📋 *Cita #${a.id}*\n🔧 ${a.service_type}\n📅 Fecha: ${fecha}\n🔵 Estado: *${a.status}*\n💳 Pago: ${a.payment_status || 'Pendiente'}${tech ? '\n' + tech : ''}`;
            }).join('\n\n──────────────\n\n');
            clearSession(phone); setSession(phone,'idle');
            return `🔍 *Estado de tus citas:*\n\n${info}\n\n_Escribe *menu* para volver al inicio._`;
        } catch (err) {
            return `❌ Error al consultar. Intenta de nuevo.`;
        }
    }

    // ── Fallback ───────────────────────────────────────────────
    clearSession(phone);
    setSession(phone, 'main_menu');
    return `❓ No entendí tu mensaje. Selecciona una opción:\n\n` + menuPrincipal();
}

// ============================================================
// MENSAJE DE CONFIRMACIÓN (lo llama el servidor cuando admin aprueba)
// ============================================================
async function buildConfirmationMessage(aptId) {
    try {
        const result = await pool.query(
            `SELECT a.*, t.name as tech_name, t.phone as tech_phone
             FROM appointments a LEFT JOIN technicians t ON a.tech_id = t.id
             WHERE a.id = $1`, [aptId]
        );
        if (!result.rows.length) return null;
        const a = result.rows[0];
        const fecha = a.apt_date?.toISOString().split('T')[0] || 'N/A';

        // Determinar el destino del mensaje:
        // Si wa_sender ya tiene '@' es un JID completo (ej: 593990328940@s.whatsapp.net) → usarlo directo
        // Si no, reconstruir el JID desde el numero del cliente
        let targetJid = a.wa_sender || '';
        if (!targetJid.includes('@')) {
            // Reconstruir: quitar ceros y no-digitos, agregar 593 si es local
            const digits = targetJid.replace(/\D/g,'');
            const phone = digits.length <= 10 ? `593${digits.replace(/^0/,'')}` : digits;
            targetJid = `${phone}@s.whatsapp.net`;
        }

        console.log(`[WA Bot] 📤 Enviando confirmación de cita #${aptId} a JID: ${targetJid}`);

        return {
            phone: targetJid,
            message: `✅ *HIDROSYS EC. – ¡Cita Confirmada!*\n\n🎉 Tu pago fue verificado. Tu cita está *CONFIRMADA*:\n\n🔧 Servicio: *${a.service_type}*\n📅 Fecha: *${fecha}*\n⏰ Hora: *${String(a.apt_time).slice(0,5)}*\n📍 Zona: *${a.zone}*\n👷 Técnico: *${a.tech_name || 'Por asignar'}*\n\n¿Confirmas que estarás disponible?\nResponde *SÍ* o *NO*.`,
        };
    } catch (err) {
        console.error('[WA Bot] Error buildConfirmationMessage:', err.message);
        return null;
    }
}

module.exports = { processMessage, buildConfirmationMessage, clearSession, setSession };
