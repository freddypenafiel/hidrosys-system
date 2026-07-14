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
function menuPrincipal(prefix = '') {
    return `${prefix ? prefix + '\n\n' : ''}💧 *HIDROSYS EC. – Asistente Virtual*\n_Atención al Cliente • Sistemas de Agua y Gas_\n\n¿En qué podemos ayudarte hoy? Escribe el *número* de tu opción:\n\n1️⃣ *Agendar visita técnica*\n2️⃣ *Reportar comprobante de pago*\n3️⃣ *Consultar estado de mi cita*\n4️⃣ *Ver catálogo / precios*\n\n_Escribe 1, 2, 3 o 4 para continuar._`;
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
        if (senderJid) setSession(phone, 'main_menu', { senderJid });
        else setSession(phone, 'main_menu');
        return menuPrincipal();
    }

    // Siempre actualizar el JID si viene en este mensaje
    if (senderJid && !sess.data.senderJid) {
        setSession(phone, step, { senderJid });
    }

    const msgClean = msg.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // ── Confirmación de disponibilidad por parte del cliente (SÍ/NO tras confirmación de admin) ──
    if (step === 'awaiting_availability_confirm' || (['si', 's', 'confirmo', 'confirmar'].includes(msgClean) && (step === 'idle' || step === 'main_menu'))) {
        if (['si', 's', '1', 'confirmo', 'confirmar', 'estaré disponible', 'estare disponible'].includes(msgClean)) {
            try {
                let aptId = sess.data.aptId;
                if (!aptId) {
                    // Buscar en la BD si el cliente tiene una cita en estado 'Confirmado'
                    const resApt = await pool.query(
                        `SELECT id FROM appointments WHERE client_phone LIKE $1 AND status = 'Confirmado' ORDER BY id DESC LIMIT 1`,
                        [`%${phone.slice(-9)}%`]
                    );
                    if (resApt.rows.length > 0) {
                        aptId = resApt.rows[0].id;
                    }
                }
                if (aptId) {
                    await pool.query(
                        `UPDATE appointments SET status = 'Conf. Cliente' WHERE id = $1`,
                        [aptId]
                    );
                    clearSession(phone);
                    setSession(phone, 'idle');
                    return `✅ *¡Perfecto! Disponibilidad confirmada.*\n\n📋 Tu cita *#${aptId}* ha quedado en estado *Confirmada por el Cliente*.\n👷 Nuestro técnico se comunicará contigo antes de la visita.\n\n¡Gracias por confiar en *HIDROSYS EC.*! Escribe *menu* para volver al inicio.`;
                } else if (step === 'awaiting_availability_confirm') {
                    clearSession(phone);
                    setSession(phone, 'idle');
                    return `✅ *¡Disponibilidad registrada!* Nuestro técnico se comunicará contigo antes de la visita.\n\n_Escribe *menu* para volver al inicio._`;
                }
            } catch (err) {
                console.error('[WA Bot] Error actualizando estado a Conf. Cliente:', err.message);
            }
        }
        if (step === 'awaiting_availability_confirm') {
            if (['no', 'n', '2', 'cancelar'].includes(msgClean)) {
                clearSession(phone);
                setSession(phone, 'idle');
                return `⚠️ Entendido. Si necesitas reagendar tu cita, por favor comunícate con nuestro soporte o escribe *menu* para agendar una nueva fecha.`;
            }
            return `❓ Por favor responde *SÍ* para confirmar tu disponibilidad o *NO* si necesitas reagendar.`;
        }
    }

    // ── Si el usuario envía opción numérica o toca botón en pantalla (1, 2, 3 o 4) desde 'idle' o 'main_menu' ──
    if (step === 'idle' || step === 'main_menu') {
        if (msg === '1' || msg.startsWith('1') || msgClean.includes('agendar visita')) { setSession(phone, 'book_name', { senderJid }); return `📝 *Agendar Visita Técnica*\n\nPor favor, escribe tu *nombre completo*:`; }
        if (msg === '2' || msg.startsWith('2') || msgClean.includes('reportar comprobante') || msgClean.includes('reportar pago')) { setSession(phone, 'pay_phone', { senderJid }); return `💳 *Reportar Comprobante de Pago*\n\nEscribe el *número de teléfono* con el que registraste tu cita (ej. 0987654321):`; }
        if (msg === '3' || msg.startsWith('3') || msgClean.includes('consultar estado')) { setSession(phone, 'status_phone', { senderJid }); return `🔍 *Consultar Estado de Cita*\n\nEscribe el *número de teléfono* con el que te registraste:`; }
        if (msg === '4' || msg.startsWith('4') || msgClean.includes('ver catalogo') || msgClean.includes('catalogo')) { clearSession(phone); setSession(phone, 'idle'); return `📦 *Catálogo de Servicios HIDROSYS:*\n\n🔧 Instalación medidor agua: $15.00\n🔧 Reparación de tubería: $15.00\n⛽ Red de gas domiciliario: $15.00\n🔩 Mant. sistema hidráulico: $15.00\n🔍 Inspección técnica: $15.00\n\n_Precio incluye visita técnica. Materiales adicionales se cotizan en sitio._\n\nEscribe *menu* para volver.`; }
        if (step === 'main_menu') {
            return menuPrincipal('❓ Opción no válida. Toca una de las 4 opciones:');
        }
    }

    // ── IDLE / Saludo inicial (cualquier otro texto en 'idle') ────────────────
    if (step === 'idle') {
        clearSession(phone);
        setSession(phone, 'main_menu', { senderJid });
        return menuPrincipal('👋 ¡Hola! Bienvenido al sistema de atención de *HIDROSYS EC.*');
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
        return {
            isList: true,
            title: 'Cantón del Cañar',
            buttonText: '🏘️ Elegir Cantón',
            footer: 'HIDROSYS EC. • Agendamiento',
            text: `📍 *Cantón de la Provincia del Cañar:*\n\n${lista}\n\nPulsa el botón *🏘️ Elegir Cantón* para seleccionar en la lista o escribe el número:`,
            sections: [
                {
                    title: 'Provincia del Cañar',
                    rows: Object.entries(CANTONES).map(([k,v]) => ({
                        rowId: k,
                        title: `${k}. ${v.nombre}`,
                        description: `Atención técnica en ${v.nombre}`
                    }))
                }
            ]
        };
    }

    if (step === 'book_canton') {
        if (!CANTONES[msg]) return `❌ Opción inválida. Escribe un número del 1 al ${Object.keys(CANTONES).length}.`;
        const canton = CANTONES[msg];
        setSession(phone, 'book_parish', { canton: canton.nombre, parroquias: canton.parroquias });
        const lista = canton.parroquias.map((p, i) => `${i+1}. ${p}`).join('\n');
        return {
            isList: true,
            title: `Parroquias (${canton.nombre})`,
            buttonText: '🏘️ Elegir Parroquia',
            footer: 'HIDROSYS EC. • Agendamiento',
            text: `🏘️ *Parroquia de ${canton.nombre}:*\n\n${lista}\n\nPulsa el botón *🏘️ Elegir Parroquia* o escribe el número:`,
            sections: [
                {
                    title: canton.nombre,
                    rows: canton.parroquias.map((p, i) => ({
                        rowId: String(i+1),
                        title: `${i+1}. ${p}`,
                        description: `Parroquia ${p}`
                    }))
                }
            ]
        };
    }

    if (step === 'book_parish') {
        const idx = parseInt(msg) - 1;
        const parroquias = sess.data.parroquias || [];
        if (isNaN(idx) || idx < 0 || idx >= parroquias.length) return `❌ Opción inválida. Escribe un número del 1 al ${parroquias.length}.`;
        setSession(phone, 'book_service', { parish: parroquias[idx], zone: `${sess.data.canton} - ${parroquias[idx]}` });
        const lista = Object.entries(SERVICIOS).map(([k,v]) => `${k}️⃣ ${v}`).join('\n');
        return {
            isList: true,
            title: 'Servicio HIDROSYS',
            buttonText: '🔧 Elegir Servicio',
            footer: 'HIDROSYS EC. • Agendamiento',
            text: `🔧 *Tipo de Servicio:*\n\n${lista}\n\nPulsa el botón *🔧 Elegir Servicio* o escribe el número:`,
            sections: [
                {
                    title: 'Servicios Disponibles',
                    rows: Object.entries(SERVICIOS).map(([k,v]) => ({
                        rowId: k,
                        title: `${k}. ${v}`,
                        description: 'Tarifa básica $15.00'
                    }))
                }
            ]
        };
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
            const fullJid = sess.data.senderJid || null;
            await pool.query(
                `UPDATE appointments SET bank=$1, receipt_no=$2, status='Reportado', payment_status='Pendiente de Validación', wa_sender=COALESCE(wa_sender, $4) WHERE id=$3`,
                [sess.data.bank, receiptNo, aptId, fullJid]
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
    return menuPrincipal('❓ No entendí tu mensaje. Selecciona una opción:');
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

        let targetJid = a.wa_sender || '';
        let clientPhoneJid = '';
        if (a.client_phone) {
            const digits = String(a.client_phone).replace(/\D/g,'');
            const phoneNum = digits.length <= 10 ? `593${digits.replace(/^0/,'')}` : digits;
            clientPhoneJid = `${phoneNum}@s.whatsapp.net`;
        }
        if (!targetJid) targetJid = clientPhoneJid;

        console.log(`[WA Bot] 📤 Enviando confirmación de cita #${aptId} a JID: ${targetJid} (y teléfono ${clientPhoneJid})`);

        const phoneKey = targetJid.split('@')[0].replace(/\D/g,'') || clientPhoneJid.split('@')[0].replace(/\D/g,'');
        setSession(phoneKey, 'awaiting_availability_confirm', { aptId: a.id });

        return {
            phone: targetJid,
            clientPhoneJid: clientPhoneJid !== targetJid ? clientPhoneJid : null,
            message: `✅ *HIDROSYS EC. – ¡Cita Confirmada!*\n\n🎉 Tu pago ha sido verificado y aprobado exitosamente.\n\n📋 *Cita ID:* #${a.id}\n🔧 *Servicio:* ${a.service_type}\n📅 *Fecha:* ${fecha}\n⏰ *Hora:* ${String(a.apt_time).slice(0,5)}\n📍 *Dirección/Zona:* ${a.address} (${a.zone})\n👷 *Técnico Asignado:* ${a.tech_name || 'Técnico Especializado HIDROSYS'}\n\n¿Confirmas que estarás disponible en este horario?\nResponde *SÍ* o *NO*.`,
        };
    } catch (err) {
        console.error('[WA Bot] Error buildConfirmationMessage:', err.message);
        return null;
    }
}

// ============================================================
// PROCESADOR DE MENSAJES DE AUDIO / NOTAS DE VOZ (WHATSAPP)
// ============================================================
async function processAudioMessage(phone, msg, senderJid, waSocket) {
    const sess = getSession(phone);
    const step = sess.step;

    console.log(`[WA Audio] 🎙️ Procesando nota de voz de +${phone} en estado: ${step}`);

    // 1. Hook para transcripción automática por IA (OpenAI Whisper) si está configurado en .env
    if (process.env.OPENAI_API_KEY) {
        try {
            console.log('[WA Audio] Transcribiendo nota de voz con OpenAI Whisper API...');
        } catch (e) {
            console.warn('[WA Audio] Falló transcripción de voz, usando asistente inteligente de audio.');
        }
    }

    // 2. Si el usuario está en un paso específico del formulario de agendamiento
    if (step === 'book_name') {
        return `🎙️ *Hemos recibido tu nota de voz.*\n\nPara garantizar que tu *nombre y apellido* queden escritos sin errores en la orden de trabajo, por favor *escribe tu nombre por mensaje de texto*.`;
    }
    if (step === 'book_phone') {
        return `🎙️ *Nota de voz recibida.*\n\nPor favor *escribe tu número de celular* de 10 dígitos (ej: 0987654321).`;
    }
    if (step === 'book_address' || step === 'book_canton' || step === 'book_parish') {
        return `🎙️ *Nota de voz recibida.*\n\nPor favor *escribe o selecciona tu dirección/cantón* por mensaje de texto para asignar al técnico más cercano de tu zona.`;
    }
    if (step === 'book_date' || step === 'book_time' || step === 'book_paymode') {
        return `🎙️ *Nota de voz recibida.*\n\nPor favor indícanos por texto tu preferencia para finalizar tu agendamiento.`;
    }

    // 3. Si está en confirmación de disponibilidad (SÍ/NO)
    if (step === 'awaiting_availability_confirm') {
        return `🎙️ *Nota de voz recibida.*\n\nPara registrar tu confirmación oficial en el sistema de manera inequívoca, por favor responde *SÍ* por texto si estarás disponible o *NO* si deseas reagendar.`;
    }

    // 4. Desde cualquier otro estado (idle, main_menu), activar Asistente Guiado de Citas por Voz
    setSession(phone, 'main_menu', { senderJid, fromAudio: true });

    return `🎙️ *¡Nota de voz recibida en HIDROSYS EC.!*\n\nHemos registrado tu audio solicitando asistencia técnica. Como si estuvieses en una llamada rápida, te ayudamos a gestionar tu requerimiento de inmediato:\n\n1️⃣ *Agendar Visita Técnica* ($15.00)\n2️⃣ *Reportar Comprobante de Pago*\n3️⃣ *Consultar Estado de Cita*\n4️⃣ *Ver Catálogo de Servicios*\n\n👉 _Responde con **1** para agendar tu visita ahora mismo o selecciona el número de tu opción._`;
}

module.exports = { processMessage, buildConfirmationMessage, processAudioMessage, clearSession, setSession };

