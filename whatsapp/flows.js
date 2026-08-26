// Registro en memoria de citas recientemente aprobadas pendientes de confirmación
let lastApprovedAptState = { aptId: null, timestamp: 0 };

function trackApprovedApt(aptId) {
    if (aptId) {
        lastApprovedAptState = { aptId: Number(aptId), timestamp: Date.now() };
    }
}

// whatsapp/flows.js - Motor de Conversación del Bot HIDROSYS
// v5.5 - Agendamiento Inteligente, Verificación de Cupos de Técnicos y Flujo Preciso

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
    '7': { nombre: 'Suscal',     parroquias: ['Suscal'] }
};

const SERVICIOS = [
    'Instalación de Medidor de Agua',
    'Revisión / Reparación de Tubería',
    'Instalación de Red de Gas Domiciliario',
    'Mantenimiento de Sistema Hidráulico',
    'Inspección Técnica General',
    'Otro / Consulta Especial'
];

const CUENTAS_BANCARIAS = `💳 *Cuentas Oficiales para Transferencia:*
1️⃣ *B. Pichincha* – Cta: 2201948332
2️⃣ *B. Guayaquil* – Cta: 10482938
3️⃣ *Produbanco* – Cta: 0209384729
4️⃣ *JEP (Cooperativa)* – Cta: 551928374
5️⃣ *B. del Pacífico* – Cta: 72938472
6️⃣ *Coop. MEGO* – Cta: 938482932
7️⃣ *Alianza del Valle* – Cta: 384729221
_Titular: HIDROSYS EC. · RUC: 1793000000001_`;

// ============================================================
// ESTADO DE SESIONES
// ============================================================
const sessions = new Map();

function getSession(phone) {
    if (!sessions.has(phone)) sessions.set(phone, { step: 'idle', data: {} });
    return sessions.get(phone);
}

function setSession(phone, step, data) {
    const cur = getSession(phone);
    sessions.set(phone, { step, data: Object.assign({}, cur.data, data || {}) });
}

function clearSession(phone) {
    sessions.set(phone, { step: 'idle', data: {} });
}

function norm(str) {
    return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function progressBar(step, total) {
    const filled = Math.round((step / total) * 6);
    const bar = '▓'.repeat(filled) + '░'.repeat(6 - filled);
    return bar + ' ' + Math.round((step / total) * 100) + '%';
}

const STEP_LABELS = {
    book_name:    [1, 6, 'Tu nombre completo'],
    book_phone:   [2, 6, 'Tu número de celular'],
    book_address: [3, 6, 'Dirección del inmueble'],
    book_canton:  [4, 6, 'Cantón de Cañar'],
    book_parish:  [4, 6, 'Parroquia'],
    book_service: [5, 6, 'Tipo de servicio'],
    book_date:    [6, 6, 'Fecha de visita'],
    book_time:    [6, 6, 'Horario preferido'],
    book_confirm: [6, 6, 'Confirmación de cita']
};

function stepHeader(k) {
    const info = STEP_LABELS[k];
    if (!info) return '';
    return '📊 *Paso ' + info[0] + ' de ' + info[1] + '* ' + progressBar(info[0], info[1]) + '\n_' + info[2] + '_\n\n';
}

function menuPrincipal() {
    return '💧 *HIDROSYS EC. — Asistente Virtual*\n_Atención al Cliente • Sistemas de Agua y Gas_\n\n¡Hola! ¿En qué podemos ayudarte hoy? Escribe el *número* de tu opción:\n\n1️⃣ *Agendar Visita Técnica* ($15.00)\n2️⃣ *Reportar Comprobante de Pago*\n3️⃣ *Consultar Estado de mi Cita*\n4️⃣ *Ver Catálogo y Precios*\n\n👉 Escribe 1, 2, 3 o 4 para continuar.';
}

async function getRescheduleDateOptions() {
    const techRes = await pool.query("SELECT COUNT(*) FROM technicians WHERE active = TRUE");
    const totalTechs = parseInt(techRes.rows[0]?.count || '4');
    const optionsDate = [];
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    let offset = 1;
    let count = 0;
    while (count < 5 && offset < 15) {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        if (d.getDay() !== 0) { // Lunes a Sábado
            const iso = d.toISOString().split('T')[0];
            const countRes = await pool.query(
                "SELECT COUNT(*) FROM appointments WHERE apt_date = $1 AND status NOT IN ('Cancelado')",
                [iso]
            );
            const bookedCount = parseInt(countRes.rows[0]?.count || '0');
            const maxDayCapacity = totalTechs * 3;
            const hasCapacity = bookedCount < maxDayCapacity;
            const str = dias[d.getDay()] + ' ' + d.getDate() + ' de ' + meses[d.getMonth()];
            const statusLabel = hasCapacity ? '✅ Disponible' : '❌ Cupos Llenos';

            optionsDate.push({ num: String(count + 1), iso, str, hasCapacity, statusLabel });
            count++;
        }
        offset++;
    }
    return { optionsDate, totalTechs };
}

// ============================================================
// PROCESADOR PRINCIPAL DE MENSAJES
// ============================================================
async function processMessage(phone, text, senderJid) {
    const msg  = String(text || '').trim();
    const sess = getSession(phone);
    const step = sess.step;
    const msgN = norm(msg);

    if (senderJid && !sess.data.senderJid) setSession(phone, step, { senderJid });

    // Comandos globales
    if (['menu','hola','hi','inicio','0','cancelar','cancel','empezar','ayuda','soporte'].includes(msgN)) {
        clearSession(phone);
        setSession(phone, 'main_menu', { senderJid });
        return menuPrincipal();
    }

    // Navegación inversa
    const esAtras = ['atras','volver','corregir','cambiar','anterior'].includes(msgN);
    if (esAtras && ['book_phone','book_address','book_canton','book_parish','book_service','book_date','book_time','book_confirm','reschedule_time'].includes(step)) {
        if (step === 'reschedule_time') {
            setSession(phone, 'reschedule_date', {});
            const { optionsDate } = await getRescheduleDateOptions();
            const listaFechas = optionsDate.map(o => o.num + '️⃣ *' + o.str + '* (' + o.iso + ') — ' + o.statusLabel).join('\n');
            return '📅 *Selecciona tu nueva fecha:* \n\n' + listaFechas + '\n\n👉 Escribe el número del 1 al 5 o la fecha (AAAA-MM-DD).';
        }
        const back = { book_phone:'book_name', book_address:'book_phone', book_canton:'book_address', book_parish:'book_canton', book_service:'book_canton', book_date:'book_service', book_time:'book_date', book_confirm:'book_time' };
        const prev = back[step];
        setSession(phone, prev, {});
        if (prev === 'book_name') return stepHeader('book_name') + 'Escribe de nuevo tu *nombre y apellido*:';
        if (prev === 'book_phone') return stepHeader('book_phone') + '📱 Escribe tu *celular* (10 dígitos):';
        if (prev === 'book_address') return stepHeader('book_address') + '🏠 Escribe la *dirección* del inmueble:';
        if (prev === 'book_canton') {
            const lista = Object.entries(CANTONES).map(([k,v]) => k + '️⃣ *' + v.nombre + '*').join('\n');
            return stepHeader('book_canton') + '📍 *Selecciona tu Cantón en Cañar:*\n\n' + lista + '\n\n👉 Escribe el número del 1 al 7 o el nombre del cantón.';
        }
        return menuPrincipal();
    }

        // ══════════════════════════════════════════════════════════
    // CONFIRMACIÓN DE DISPONIBILIDAD Y REAGENDAMIENTO INTELIGENTE
    // Intercepta respuestas 1 / 2 o palabras afirmativas/negativas
    // siempre consultando la DB directamente (independiente de RAM/sesión).
    // ══════════════════════════════════════════════════════════
    const cleanPhone9 = String(phone).replace(/\D/g, '').slice(-9);

    const esConfirmar = ['1','1️⃣','si','s','confirmo','confirmar','disponible','de acuerdo','correcto','estare','ok'].includes(msgN) ||
                        (msgN.startsWith('si') && !msgN.includes('nuevo') && !msgN.includes('cedula'));
    const esReagendar = ['2','2️⃣','no','n','reagendar','cambiar fecha','cambiar hora'].includes(msgN) || msgN === 'reagendar';

    if (step === 'awaiting_availability_confirm' || ((step === 'idle' || step === 'main_menu') && (esConfirmar || esReagendar))) {
        try {
            let aptId = sess.data.aptId || null;
            const jidOrSender = senderJid || (phone + '@s.whatsapp.net');

            // Búsqueda ultra-robusta de la cita activa asociada al número
            let aptData = null;
            // 1. Si hay una cita recientemente aprobada en espera de confirmación (dentro de las últimas 2 horas)
            if (lastApprovedAptState.aptId && (Date.now() - lastApprovedAptState.timestamp) < 2 * 60 * 60 * 1000) {
                const res = await pool.query(
                    "SELECT a.*, t.name as tech_name FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.id=$1 AND a.status='Confirmado'",
                    [lastApprovedAptState.aptId]
                );
                if (res.rows.length) {
                    aptData = res.rows[0];
                    aptId = aptData.id;
                }
            }

            if (!aptData && aptId) {
                const res = await pool.query("SELECT a.*, t.name as tech_name FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.id=$1", [aptId]);
                if (res.rows.length) aptData = res.rows[0];
            }

                        if (!aptData) {
                // 1. Buscar primero la cita en estado 'Confirmado' vinculada a este número o sender
                let res = await pool.query(
                    `SELECT a.*, t.name as tech_name FROM appointments a
                     LEFT JOIN technicians t ON a.tech_id = t.id
                     WHERE (
                        a.wa_sender = $1
                        OR a.wa_sender LIKE $2
                        OR a.client_phone LIKE $2
                        OR RIGHT(REGEXP_REPLACE(COALESCE(a.client_phone,''), '[^0-9]', '', 'g'), 9) = $3
                        OR RIGHT(REGEXP_REPLACE(COALESCE(a.wa_sender,''), '[^0-9]', '', 'g'), 9) = $3
                     )
                     AND a.status = 'Confirmado'
                     ORDER BY a.id DESC LIMIT 1`,
                    [jidOrSender, '%' + cleanPhone9 + '%', cleanPhone9]
                );

                // 2. Si no se encuentra por número exacto (ej. WhatsApp LID multidevice), buscar la cita más reciente en 'Confirmado'
                if (!res.rows.length) {
                    res = await pool.query(
                        `SELECT a.*, t.name as tech_name FROM appointments a
                         LEFT JOIN technicians t ON a.tech_id = t.id
                         WHERE a.status = 'Confirmado'
                         ORDER BY a.id DESC LIMIT 1`
                    );
                }

                // 3. Fallback general para citas no canceladas ni terminadas
                if (!res.rows.length) {
                    res = await pool.query(
                        `SELECT a.*, t.name as tech_name FROM appointments a
                         LEFT JOIN technicians t ON a.tech_id = t.id
                         WHERE (
                            a.wa_sender = $1
                            OR a.wa_sender LIKE $2
                            OR a.client_phone LIKE $2
                            OR RIGHT(REGEXP_REPLACE(COALESCE(a.client_phone,''), '[^0-9]', '', 'g'), 9) = $3
                            OR RIGHT(REGEXP_REPLACE(COALESCE(a.wa_sender,''), '[^0-9]', '', 'g'), 9) = $3
                         )
                         AND a.status NOT IN ('Cancelado', 'Terminado')
                         ORDER BY a.id DESC LIMIT 1`,
                        [jidOrSender, '%' + cleanPhone9 + '%', cleanPhone9]
                    );
                }

                if (res.rows.length) {
                    aptData = res.rows[0];
                    aptId = aptData.id;
                }
            }

            if (aptData && aptId) {
                if (esConfirmar) {
                    // Marcar como confirmada por el cliente y vincular wa_sender
                    await pool.query(
                        "UPDATE appointments SET status = 'Conf. Cliente', wa_sender = COALESCE(NULLIF(wa_sender, ''), $1) WHERE id = $2",
                        [jidOrSender, aptId]
                    );
                    clearSession(phone);
                    return '✅ *¡Disponibilidad Confirmada!*\n\n📋 Tu cita *#' + aptId + '* (' + aptData.service_type + ') ha quedado registrada como *Confirmada por el Cliente*.\n👷 Nuestro técnico asignado *' + (aptData.tech_name || 'Especializado HIDROSYS') + '* se comunicará contigo antes de la visita.\n\n¡Muchas gracias por confiar en *HIDROSYS EC.*! 💧\n_Escribe menu si necesitas algo más._';
                }

                if (esReagendar) {
                    const { optionsDate, totalTechs } = await getRescheduleDateOptions();
                    setSession(phone, 'reschedule_date', { aptId, aptData, totalTechs, optionsDate });
                    const listaFechas = optionsDate.map(o => o.num + '️⃣ *' + o.str + '* (' + o.iso + ') — ' + o.statusLabel).join('\n');
                    return '📅 *Reagendamiento de Visita Técnica*\n\nHola *' + aptData.client_name + '*, vamos a coordinar una nueva fecha para tu cita *#' + aptId + '* (' + aptData.service_type + ').\n\n*Selecciona el nuevo día disponible:*\n\n' + listaFechas + '\n\n👉 Escribe el número del 1 al 5 o la fecha (AAAA-MM-DD).';
                }
            } else if (step === 'awaiting_availability_confirm') {
                clearSession(phone);
                return '✅ *Tu cita ya ha sido registrada como confirmada.*\n\n¡Gracias por confiar en *HIDROSYS EC.*! 💧\n_Escribe menu si necesitas algo más._';
            }
        } catch (err) {
            console.error('[WA] Error confirmación/reagendamiento:', err.message);
        }
    }

    // PASO REAGENDAMIENTO 1: SELECCIONAR FECHA
    if (step === 'reschedule_date') {
        // Siempre recalcular fechas disponibles (no depender de sesión en memoria que puede perderse)
        const { optionsDate, totalTechs } = await getRescheduleDateOptions();
        // Si hay opciones en sesión las usamos; si no, usamos las frescas recalculadas
        const dateOptions = (sess.data.optionsDate && sess.data.optionsDate.length > 0) ? sess.data.optionsDate : optionsDate;
        let fechaObj = dateOptions.find(o => o.num === msg || o.iso === msg);
        if (!fechaObj) {
            const idx = parseInt(msg) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < dateOptions.length) {
                fechaObj = dateOptions[idx];
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(msg)) {
                fechaObj = { iso: msg, hasCapacity: true };
            }
        }

        if (!fechaObj) {
            const listaFechas = dateOptions.map(o => o.num + '️⃣ *' + o.str + '* — ' + o.statusLabel).join('\n');
            return '❌ Fecha no válida. Escribe un número del 1 al 5:\n\n' + listaFechas;
        }

        if (fechaObj.hasCapacity === false) {
            return '⚠️ Ese día no tiene cupos disponibles. Por favor selecciona otra fecha (1 al 5).';
        }

        const fechaSeleccionada = fechaObj.iso;
        const techCount = sess.data.totalTechs || totalTechs || 4;

        const aptRes = await pool.query(
            "SELECT apt_time, COUNT(*) as booked FROM appointments WHERE apt_date = $1 AND status NOT IN ('Cancelado') GROUP BY apt_time",
            [fechaSeleccionada]
        );

        const slots = [
            { id: '1', time: '09:00', label: 'Mañana (08:00 – 12:00)' },
            { id: '2', time: '14:00', label: 'Tarde (13:00 – 17:00)' },
            { id: '3', time: '17:00', label: 'Tarde-Noche (17:00 – 19:00)' }
        ];

        const slotAvailability = slots.map(s => {
            const row = aptRes.rows.find(r => String(r.apt_time).startsWith(s.time.slice(0, 2)));
            const booked = row ? parseInt(row.booked) : 0;
            const free = Math.max(0, techCount - booked);
            return {
                ...s,
                booked,
                free,
                available: free > 0,
                statusText: free > 0 ? '✅ Disponible (' + free + ' ' + (free === 1 ? 'cupo libre' : 'cupos libres') + ')' : '❌ Lleno'
            };
        });

        setSession(phone, 'reschedule_time', {
            aptId: sess.data.aptId,
            aptData: sess.data.aptData,
            newDate: fechaSeleccionada,
            slotAvailability
        });
        const listaSlots = slotAvailability.map(s => s.id + '️⃣ *' + s.label + '* — ' + s.statusText).join('\n');

        return '📅 Nueva fecha: *' + fechaSeleccionada + '*\n\n⏰ *Selecciona tu nuevo horario preferido:*\n\n' + listaSlots + '\n\n👉 _Escribe **1**, **2** o **3**._';
    }

    // PASO REAGENDAMIENTO 2: CONFIRMAR NUEVO HORARIO
    if (step === 'reschedule_time') {
        const slotAvailability = sess.data.slotAvailability || [];
        let chosenSlot = null;
        if (msg === '1' || msg.startsWith('1') || norm(msg).includes('manana') || norm(msg).includes('08') || norm(msg).includes('09')) {
            chosenSlot = slotAvailability.find(s => s.id === '1') || { time: '09:00', available: true };
        } else if (msg === '2' || msg.startsWith('2') || (norm(msg).includes('tarde') && !norm(msg).includes('noche')) || norm(msg).includes('13') || norm(msg).includes('14')) {
            chosenSlot = slotAvailability.find(s => s.id === '2') || { time: '14:00', available: true };
        } else if (msg === '3' || msg.startsWith('3') || norm(msg).includes('noche') || norm(msg).includes('17')) {
            chosenSlot = slotAvailability.find(s => s.id === '3') || { time: '17:00', available: true };
        }

        if (!chosenSlot) return '❌ Horario no reconocido. Escribe **1** (Mañana), **2** (Tarde) o **3** (Tarde-Noche).';
        if (!chosenSlot.available) return '⚠️ Horario sin cupos disponibles. Elige otra opción (1, 2 o 3) o escribe *atras*.';

        try {
            const aptId = sess.data.aptId;
            const newDate = sess.data.newDate;
            const newTime = chosenSlot.time;
            const apt = sess.data.aptData || {};

            await pool.query(
                "UPDATE appointments SET apt_date = $1, apt_time = $2, status = 'Confirmado' WHERE id = $3",
                [newDate, newTime, aptId]
            );
            clearSession(phone);

            return '🎉 *¡Cita Reagendada con Éxito!*\n\n' +
                '📋 *Cita ID:* #' + aptId + '\n' +
                '🔧 *Servicio:* ' + (apt.service_type || 'Visita Técnica') + '\n' +
                '📅 *Nueva Fecha:* ' + newDate + '\n' +
                '⏰ *Nuevo Horario:* ' + newTime + '\n' +
                '📍 *Dirección:* ' + (apt.address || 'Registrada') + ' (' + (apt.zone || 'Cañar') + ')\n' +
                '👷 *Técnico:* ' + (apt.tech_name || 'Especialista Asignado') + '\n\n' +
                '✅ Tu nuevo horario ha sido actualizado en nuestro sistema y notificado a tu técnico.\n\n' +
                '_¡Muchas gracias por preferir HIDROSYS EC.! 💧_';
        } catch (err) {
            console.error('[WA] Error actualizando cita reagendada:', err.message);
            return '❌ Ocurrió un error al actualizar la cita. Por favor intenta de nuevo escribiendo *menu*.';
        }
    }

    // Menú principal
    if (step === 'idle' || step === 'main_menu') {
        if (msg === '1' || msg.startsWith('1') || msgN.includes('agendar') || msgN.includes('visita') || msgN.includes('cita')) {
            setSession(phone, 'book_is_existing_client', { senderJid });
            return '💧 *Agendar Visita Técnica ($15.00)*\n\n¿Ya eres cliente de HIDROSYS o has solicitado servicios antes?\n\n1️⃣ *Sí, validar con mi Cédula* (Autocompletar datos)\n2️⃣ *No, soy cliente nuevo*\n\n👉 Responde con el número 1 o 2.';
        }
        if (msg === '2' || msg.startsWith('2') || msgN.includes('pago') || msgN.includes('comprobante') || msgN.includes('reportar')) {
            setSession(phone, 'pay_phone', { senderJid });
            return '💳 *Reportar Comprobante de Pago*\n\nEscribe el *número de teléfono* con el que registraste tu cita (ej. 0987654321):';
        }
        if (msg === '3' || msg.startsWith('3') || msgN.includes('consultar') || msgN.includes('estado')) {
            setSession(phone, 'status_phone', { senderJid });
            return '🔍 *Consultar Estado de Cita*\n\nEscribe el *número de teléfono* con el que te registraste (ej. 0987654321):';
        }
        if (msg === '4' || msg.startsWith('4') || msgN.includes('catalogo') || msgN.includes('precio')) {
            clearSession(phone);
            return '📦 *Catálogo de Servicios HIDROSYS EC.:*\n\n💧 *Instalación de medidor de agua:* $15.00\n🔩 *Reparación de tubería / fugas:* $15.00\n⛽ *Red de gas domiciliario:* $15.00\n🔨 *Mantenimiento sistema hidráulico:* $15.00\n🔍 *Inspección técnica general:* $15.00\n\n_Nota: El valor de $15.00 incluye visita técnica y diagnóstico profesional. Materiales se cotizan en sitio._\n\n👉 Escribe 1 para agendar ahora o escribe menu para volver.';
        }
        return menuPrincipal();
    }

    // ══════════════════════════════════════════════════════════
    // FLUJO 1: AGENDAR VISITA TÉCNICA (CON VALIDACIÓN CÉDULA/OTP)
    // ══════════════════════════════════════════════════════════
    if (step === 'book_is_existing_client') {
        if (msg === '1' || msgN.includes('si') || msgN.includes('cedula') || msgN.includes('validar')) {
            setSession(phone, 'book_cedula_input', {});
            return '🛡️ *Verificación de Identidad por Cédula*\n\nPor favor escribe tu *número de cédula* (10 dígitos numéricos):';
        } else if (msg === '2' || msgN.includes('no') || msgN.includes('nuevo')) {
            setSession(phone, 'book_name', {});
            return stepHeader('book_name') + 'Por favor, escribe tu *nombre y apellido*:';
        } else {
            return '❓ Por favor responde con:\n1️⃣ *Sí, validar con mi Cédula*\n2️⃣ *No, soy cliente nuevo*\n\n👉 Responde con el número 1 o 2.';
        }
    }

    if (step === 'book_cedula_input') {
        const cleanCed = msg.replace(/\D/g, '');
        if (cleanCed.length < 5 || cleanCed.length > 10) {
            return '⚠️ *Cédula no válida.* Ingrese un número de cédula válido (ej: 0302886395).\n\n_Intente nuevamente:_';
        }

        try {
            const clientRes = await pool.query(
                "SELECT * FROM clients WHERE cedula = $1 OR (phone LIKE $2 AND cedula IS NOT NULL) ORDER BY id DESC LIMIT 1",
                [cleanCed, '%' + cleanCed.slice(-9) + '%']
            );

            if (clientRes.rows.length > 0) {
                const client = clientRes.rows[0];
                const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
                setSession(phone, 'book_cedula_otp', {
                    clientData: client,
                    otpCode,
                    otpAttempts: 0,
                    cedula: cleanCed
                });

                return `🔐 *Código de Seguridad Enviado*\n\nHola *${client.name}*, para confirmar tu identidad tu código es:\n\n👉 *${otpCode}*\n\n_Escribe los 4 dígitos para validar y autocompletar tus datos:_`;
            } else {
                setSession(phone, 'book_name', { cedula: cleanCed });
                return `ℹ️ No registramos servicios previos con la cédula *${cleanCed}*.\nContinuemos con tu agendamiento como nuevo cliente.\n\n` + stepHeader('book_name') + 'Por favor escribe tu *nombre y apellido*:';
            }
        } catch (err) {
            console.error('[WA] Error consultando cédula:', err.message);
            setSession(phone, 'book_name', { cedula: cleanCed });
            return stepHeader('book_name') + 'Por favor escribe tu *nombre y apellido*:';
        }
    }

    if (step === 'book_cedula_otp') {
        const typedOtp = msg.replace(/\D/g, '');
        const expectedOtp = sess.data.otpCode;
        const client = sess.data.clientData;

        if (typedOtp === expectedOtp) {
            // Autocompletar datos del cliente y saltar directo a selección de servicio
            const clientName = client.name || 'Cliente';
            const clientPhone = client.phone || phone;
            const address = client.address || 'Domicilio registrado';
            const zone = client.zone || 'Azogues - Azogues';
            const [cantonPart, parishPart] = zone.includes(' - ') ? zone.split(' - ') : [zone, 'Centro'];

            setSession(phone, 'book_service', {
                name: clientName,
                clientPhone: clientPhone,
                address: address,
                canton: cantonPart,
                parish: parishPart,
                zone: zone,
                cedula: sess.data.cedula || client.cedula
            });

            const listaServ = SERVICIOS.map((s, i) => (i + 1) + '️⃣ *' + s + '* ($15.00)').join('\n');
            return `🎉 *¡Identidad Confirmada!*\n\nBienvenido/a de nuevo *${clientName}*.\n📍 *Dirección registrada:* ${address} (${zone})\n\n` + stepHeader('book_service') + '🔧 *¿Qué tipo de servicio técnico necesitas?*\n\n' + listaServ + '\n\n👉 Escribe el número del 1 al 6.';
        } else {
            sess.data.otpAttempts = (sess.data.otpAttempts || 0) + 1;
            if (sess.data.otpAttempts >= 3) {
                setSession(phone, 'book_name', { cedula: sess.data.cedula });
                return `🔒 Has superado los 3 intentos.\nContinuemos ingresando tus datos manualmente.\n\n` + stepHeader('book_name') + 'Por favor escribe tu *nombre y apellido*:';
            }
            return `❌ *Código incorrecto.* Te quedan ${3 - sess.data.otpAttempts} intento(s).\n\n_Por favor escribe el código de 4 dígitos:_`;
        }
    }

    if (step === 'book_name') {
        const cleanName = msg.replace(/[0-9!@#$%^&*()_+={}\[\]:;<>?,./\\]/g, '').trim();
        if (cleanName.length < 3) {
            return '⚠️ *Nombre no válido.* Por favor escribe tu nombre y apellido usando solo letras (mínimo 3 caracteres).\n\n_Ejemplo: Freddy Peñafiel_';
        }
        setSession(phone, 'book_phone', { name: cleanName });
        return stepHeader('book_phone') + '📱 Escribe tu número de *celular* (10 dígitos numéricos, ej. 0987654321):';
    }

    if (step === 'book_phone') {
        const digits = msg.replace(/\D/g, '');
        if (!/^09\d{8}$/.test(digits) && !/^0[2-7]\d{7}$/.test(digits) && digits.length !== 10) {
            return '⚠️ *Número de celular inválido.* Debe tener exactamente 10 dígitos numéricos y comenzar con 09 (ej: 0987654321).\n\n_Por favor intenta de nuevo:_';
        }
        setSession(phone, 'book_address', { clientPhone: digits });
        return stepHeader('book_address') + '🏠 Escribe la *dirección* o referencia del inmueble:\n_(ej: Barrio El Portete, calle Principal y Bolívar, casa azul de dos pisos)_';
    }

    if (step === 'book_address') {
        if (msg.trim().length < 5) {
            return '⚠️ *Dirección demasiado corta.* Por favor escribe una dirección más detallada con calle y referencia (mínimo 5 caracteres).';
        }
        setSession(phone, 'book_canton', { address: msg.trim() });
        const lista = Object.entries(CANTONES).map(([k,v]) => k + '️⃣ *' + v.nombre + '*').join('\n');
        return stepHeader('book_canton') + '📍 *¿En qué cantón de la Provincia del Cañar te encuentras?*\n\n' + lista + '\n\n👉 Escribe el número del 1 al 7 o el nombre del cantón.';
    }

    if (step === 'book_canton') {
        let cantonData = CANTONES[msg] || CANTONES[msg.charAt(0)];
        if (!cantonData) {
            const mn = norm(msg);
            cantonData = Object.values(CANTONES).find(c => norm(c.nombre) === mn || mn.includes(norm(c.nombre)));
        }
        if (!cantonData) {
            const lista = Object.entries(CANTONES).map(([k,v]) => k + '️⃣ *' + v.nombre + '*').join('\n');
            return '❌ *Cantón no reconocido.* Por favor escribe el número del 1 al 7 o el nombre del cantón:\n\n' + lista;
        }

        setSession(phone, 'book_parish', { canton: cantonData.nombre, parroquias: cantonData.parroquias });

        if (cantonData.parroquias.length === 1) {
            setSession(phone, 'book_service', { parish: cantonData.parroquias[0], zone: cantonData.nombre + ' - ' + cantonData.parroquias[0] });
            const listaServ = SERVICIOS.map((s, i) => (i + 1) + '️⃣ *' + s + '* ($15.00)').join('\n');
            return stepHeader('book_service') + '🔧 *¿Qué tipo de servicio técnico necesitas?*\n\n' + listaServ + '\n\n👉 Escribe el número del 1 al 6.';
        }

        const listaPar = cantonData.parroquias.map((p, i) => (i + 1) + '️⃣ *' + p + '*').join('\n');
        return '📊 *Paso 4 de 6* ▓▓▓▓░░ 67%\n_Parroquia de ' + cantonData.nombre + '_\n\n🏘️ *Selecciona tu parroquia:*\n\n' + listaPar + '\n\n👉 Escribe el número de tu parroquia.';
    }

    if (step === 'book_parish') {
        const parroquias = sess.data.parroquias || [];
        let parish = null;
        const idx = parseInt(msg) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < parroquias.length) {
            parish = parroquias[idx];
        } else {
            const mn = norm(msg);
            parish = parroquias.find(p => norm(p) === mn || mn.includes(norm(p)));
        }
        if (!parish) {
            const listaPar = parroquias.map((p, i) => (i + 1) + '️⃣ *' + p + '*').join('\n');
            return '❌ *Parroquia no válida.* Por favor escribe el número correcto de la lista (1 al ' + parroquias.length + '):\n\n' + listaPar;
        }

        setSession(phone, 'book_service', { parish, zone: sess.data.canton + ' - ' + parish });
        const listaServ = SERVICIOS.map((s, i) => (i + 1) + '️⃣ *' + s + '* ($15.00)').join('\n');
        return stepHeader('book_service') + '🔧 *¿Qué tipo de servicio técnico necesitas?*\n\n' + listaServ + '\n\n👉 Escribe el número del 1 al 6.';
    }

    // PASO 5: TIPO DE SERVICIO Y CHEQUEO DE CUPOS DE TÉCNICOS
    if (step === 'book_service') {
        let service = null;
        const idx = parseInt(msg) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < SERVICIOS.length) {
            service = SERVICIOS[idx];
        } else {
            const mn = norm(msg);
            service = SERVICIOS.find(s => mn.includes(norm(s)) || norm(s).includes(mn.replace(/^[\w]+/,'')));
        }
        if (!service) {
            const listaServ = SERVICIOS.map((s, i) => (i + 1) + '️⃣ *' + s + '*').join('\n');
            return '❌ *Servicio no reconocido.* Por favor responde con un número del 1 al 6:\n\n' + listaServ;
        }

        // Consultar técnicos activos para calcular capacidad
        const techRes = await pool.query('SELECT COUNT(*) FROM technicians WHERE active = TRUE');
        const totalTechs = parseInt(techRes.rows[0]?.count || '4');

        // Generar 5 días hábiles verificando cupos
        const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const optionsDate = [];
        const today = new Date();
        let count = 0, offset = 1;
        while (count < 5 && offset <= 14) {
            const d = new Date(today);
            d.setDate(today.getDate() + offset);
            if (d.getDay() !== 0) {
                const iso = d.toISOString().split('T')[0];
                const countRes = await pool.query(
                    "SELECT COUNT(*) FROM appointments WHERE apt_date = $1 AND status NOT IN ('Cancelado')",
                    [iso]
                );
                const bookedCount = parseInt(countRes.rows[0]?.count || '0');
                const maxDayCapacity = totalTechs * 3;
                const hasCapacity = bookedCount < maxDayCapacity;
                const str = dias[d.getDay()] + ' ' + d.getDate() + ' de ' + meses[d.getMonth()];
                const statusLabel = hasCapacity ? '✅ Disponible' : '❌ Cupos Llenos';

                optionsDate.push({ num: String(count + 1), iso, str, hasCapacity, statusLabel });
                count++;
            }
            offset++;
        }

        setSession(phone, 'book_date', { service, optionsDate, totalTechs });
        const listaFechas = optionsDate.map(o => o.num + '️⃣ *' + o.str + '* (' + o.iso + ') — ' + o.statusLabel).join('\n');
        return stepHeader('book_date') + '📅 *¿Qué día prefieres para la visita técnica?*\n\n' + listaFechas + '\n\n👉 Escribe el número del 1 al 5 o la fecha en formato AAAA-MM-DD.';
    }

    // PASO 6: FECHA Y CHEQUEO DE HORARIOS DISPONIBLES EN TIEMPO REAL
    if (step === 'book_date') {
        const optionsDate = sess.data.optionsDate || [];
        let fechaObj = null;
        const matchOpt = optionsDate.find(o => o.num === msg || o.iso === msg);
        if (matchOpt) {
            fechaObj = matchOpt;
        } else {
            const idx = parseInt(msg) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < optionsDate.length) {
                fechaObj = optionsDate[idx];
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(msg)) {
                const f = new Date(msg);
                const h = new Date(); h.setHours(0,0,0,0);
                if (f > h) fechaObj = { iso: msg, hasCapacity: true };
            }
        }

        if (!fechaObj) {
            const listaFechas = optionsDate.map(o => o.num + '️⃣ *' + o.str + '* — ' + o.statusLabel).join('\n');
            return '❌ Fecha no válida. Escribe un número del 1 al 5:\n\n' + listaFechas;
        }

        if (fechaObj.hasCapacity === false) {
            return '⚠️ Lo sentimos, ese día ya no tiene cupos disponibles. Por favor selecciona otra fecha disponible (1 al 5).';
        }

        const fechaSeleccionada = fechaObj.iso;
        const totalTechs = sess.data.totalTechs || 4;

        // Consultar ocupación por franja horaria para esa fecha
        const aptRes = await pool.query(
            "SELECT apt_time, COUNT(*) as booked FROM appointments WHERE apt_date = $1 AND status NOT IN ('Cancelado') GROUP BY apt_time",
            [fechaSeleccionada]
        );

        const slots = [
            { id: '1', time: '09:00', label: 'Mañana (08:00 – 12:00)' },
            { id: '2', time: '14:00', label: 'Tarde (13:00 – 17:00)' },
            { id: '3', time: '17:00', label: 'Tarde-Noche (17:00 – 19:00)' }
        ];

        const slotAvailability = slots.map(s => {
            const row = aptRes.rows.find(r => String(r.apt_time).startsWith(s.time.slice(0, 2)));
            const booked = row ? parseInt(row.booked) : 0;
            const free = Math.max(0, totalTechs - booked);
            return {
                ...s,
                booked,
                free,
                available: free > 0,
                statusText: free > 0 ? '✅ Disponible (' + free + ' ' + (free === 1 ? 'cupo libre' : 'cupos libres') + ')' : '❌ Lleno'
            };
        });

        setSession(phone, 'book_time', { date: fechaSeleccionada, slotAvailability });
        const listaSlots = slotAvailability.map(s => s.id + '️⃣ *' + s.label + '* — ' + s.statusText).join('\n');

        return '📅 Fecha seleccionada: *' + fechaSeleccionada + '*\n\n⏰ *¿En qué horario prefieres la visita técnica?*\n_Disponibilidad de técnicos en tiempo real:_\n\n' + listaSlots + '\n\n👉 Escribe 1, 2 o 3.';
    }

    if (step === 'book_time') {
        const slotAvailability = sess.data.slotAvailability || [];
        let chosenSlot = null;

        if (msg === '1' || msg.startsWith('1') || norm(msg).includes('manana') || norm(msg).includes('08') || norm(msg).includes('09')) {
            chosenSlot = slotAvailability.find(s => s.id === '1') || { time: '09:00', available: true };
        } else if (msg === '2' || msg.startsWith('2') || (norm(msg).includes('tarde') && !norm(msg).includes('noche')) || norm(msg).includes('13') || norm(msg).includes('14')) {
            chosenSlot = slotAvailability.find(s => s.id === '2') || { time: '14:00', available: true };
        } else if (msg === '3' || msg.startsWith('3') || norm(msg).includes('noche') || norm(msg).includes('17')) {
            chosenSlot = slotAvailability.find(s => s.id === '3') || { time: '17:00', available: true };
        }

        if (!chosenSlot) {
            return '❌ Horario no reconocido. Escribe 1 (Mañana), 2 (Tarde) o 3 (Tarde-Noche).';
        }

        if (!chosenSlot.available) {
            return '⚠️ *Horario sin técnicos disponibles:*\nEl horario seleccionado ya alcanzó su capacidad máxima de técnicos asignados. Por favor elige otro horario con cupos disponibles (1, 2 o 3) o escribe *atras* para cambiar de fecha.';
        }

        const horaFinal = chosenSlot.time;
        setSession(phone, 'book_confirm', { time: horaFinal });
        const d = getSession(phone).data;
        const dobj = new Date(d.date + 'T12:00:00');
        const diasL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const mesesL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const fechaLeg = diasL[dobj.getDay()] + ' ' + dobj.getDate() + ' de ' + mesesL[dobj.getMonth()];

        return '📋 *Resumen de tu Solicitud de Visita Técnica:*\n' +
            '──────────────────────\n' +
            '👤 *Cliente:* ' + d.name + '\n' +
            '📱 *Celular:* ' + d.clientPhone + '\n' +
            '🏠 *Dirección:* ' + d.address + '\n' +
            '📍 *Zona:* ' + (d.zone || d.canton) + '\n' +
            '🔧 *Servicio:* ' + d.service + '\n' +
            '📅 *Fecha:* ' + fechaLeg + ' (' + d.date + ')\n' +
            '⏰ *Horario:* ' + horaFinal + '\n' +
            '💰 *Valor Visita:* $15.00 USD\n' +
            '──────────────────────\n\n' +
            '¿Confirmas esta información?\n\n' +
            '1️⃣ *SÍ, confirmar mi cita*\n' +
            '2️⃣ *No, corregir datos*\n' +
            '3️⃣ *Cancelar*\n\n' +
            '👉 Escribe 1 para confirmar, 2 para corregir o 3 para cancelar.';
    }

    if (step === 'book_confirm') {
        const mn = norm(msg);
        if (['2','no','corregir'].includes(mn) || mn.includes('corregir') || mn.startsWith('2')) {
            setSession(phone, 'book_name', {});
            return stepHeader('book_name') + 'De acuerdo, empecemos de nuevo. Escribe tu *nombre y apellido*:';
        }
        if (['3','cancelar','cancel'].includes(mn) || mn.includes('cancelar') || mn.startsWith('3')) {
            clearSession(phone);
            return '↩️ Solicitud cancelada. Escribe menu cuando desees agendar nuevamente.';
        }
        if (!['1','si','s','confirmar','confirmo','ok'].includes(mn) && !mn.includes('confirmar') && !mn.startsWith('1')) {
            return '❓ Por favor responde con:\n\n1️⃣ *SÍ, confirmar*\n2️⃣ *Corregir datos*\n3️⃣ *Cancelar*\n\n👉 Escribe 1 para confirmar, 2 para corregir o 3 para cancelar.';
        }

        try {
            const d = getSession(phone).data;
            const fullJid = d.senderJid || (phone + '@s.whatsapp.net');
            const result = await pool.query(
                'INSERT INTO appointments (client_name,client_phone,address,zone,service_type,apt_date,apt_time,payment_amount,channel,status,wa_sender) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
                [d.name, d.clientPhone, d.address, d.zone || d.canton, d.service, d.date, d.time, 15.00, 'WhatsApp', 'Pre-agendado', fullJid]
            );
            await pool.query(
                'INSERT INTO clients (name,phone,address,zone,cedula) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, cedula=COALESCE(EXCLUDED.cedula, clients.cedula)',
                [d.name, d.clientPhone, d.address, d.zone || d.canton, d.cedula || null]
            );
            const aptId = result.rows[0].id;
            clearSession(phone);

            return '🎉 *¡Tu cita técnica ha sido registrada exitosamente!*\n\n' +
                '📋 *ID de tu Cita: #' + aptId + '*\n\n' +
                '⚠️ *SIGUIENTE PASO:*\n' +
                'Para confirmar tu cita, realiza una transferencia de *$15.00* a cualquiera de nuestras cuentas:\n\n' +
                CUENTAS_BANCARIAS + '\n\n' +
                '📲 Una vez realizada la transferencia, escribe 2 en el menú para reportar tu comprobante y activar al técnico asignado.\n\n' +
                '_¡Gracias por confiar en HIDROSYS EC.! 💧_';
        } catch (err) {
            console.error('[WA] Error al guardar cita:', err.message);
            return '❌ Ocurrió un error al registrar tu cita. Por favor intenta nuevamente escribiendo menu.';
        }
    }

    // ══════════════════════════════════════════════════════════
    // FLUJO 2: REPORTAR PAGO
    // ══════════════════════════════════════════════════════════
    if (step === 'pay_phone') {
        const numL = msg.replace(/\D/g, '').slice(-9);
        try {
            const apts = await pool.query(
                "SELECT id,service_type,apt_date,status FROM appointments WHERE REGEXP_REPLACE(client_phone,'\\D','','g') LIKE '%'||$1 AND status='Pre-agendado' AND (receipt_no IS NULL OR receipt_no='null' OR receipt_no='') ORDER BY created_at DESC LIMIT 5",
                [numL]
            );
            if (!apts.rows.length) {
                return '❌ No encontré citas pendientes de pago para ese número.\n\nVerifica y escribe nuevamente tu número de teléfono (ej. 0987654321), o escribe menu para volver al inicio.';
            }
            setSession(phone, 'pay_select_apt', { lookupPhone: numL, aptRows: apts.rows });
            const lista = apts.rows.map((a, i) => (i + 1) + '️⃣ *Cita #' + a.id + '* – ' + a.service_type + ' (' + (a.apt_date?.toISOString().split('T')[0]) + ')').join('\n');
            return '📋 *Citas pendientes de pago:*\n\n' + lista + '\n\n👉 Escribe el número de la cita que ya pagaste (1 al ' + apts.rows.length + ').';
        } catch (err) { return '❌ Error al buscar citas. Intenta de nuevo escribiendo menu.'; }
    }

    if (step === 'pay_select_apt') {
        const rows = sess.data.aptRows || [];
        let selectedAptId = null;
        for (const r of rows) {
            if (msg.includes(String(r.id))) {
                selectedAptId = r.id;
                break;
            }
        }
        if (!selectedAptId) {
            const idx = parseInt(msg) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < rows.length) selectedAptId = rows[idx].id;
        }
        if (!selectedAptId) return '❌ Número de cita inválido. Escribe un número entre 1 y ' + rows.length + '.';

        setSession(phone, 'pay_bank', { selectedAptId });
        const bancos = ['Banco Pichincha','Banco Guayaquil','Produbanco','JEP','Banco del Pacífico','Coop. MEGO','Alianza del Valle','Banco Bolivariano'];
        const listaBancos = bancos.map((b, i) => (i + 1) + '️⃣ *' + b + '*').join('\n');
        return '🏦 *¿En qué banco o cooperativa realizaste la transferencia?*\n\n' + listaBancos + '\n\n👉 Escribe el número del 1 al 8 o el nombre del banco.';
    }

    if (step === 'pay_bank') {
        const bancos = ['Banco Pichincha','Banco Guayaquil','Produbanco','JEP','Banco del Pacífico','Coop. MEGO','Alianza del Valle','Banco Bolivariano'];
        let banco = null;
        const idx = parseInt(msg) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < bancos.length) {
            banco = bancos[idx];
        } else {
            const mn = norm(msg);
            banco = bancos.find(b => norm(b) === mn || mn.includes(norm(b)) || norm(b).includes(mn));
        }
        if (!banco) {
            const listaBancos = bancos.map((b, i) => (i + 1) + '️⃣ *' + b + '*').join('\n');
            return '❌ Banco no reconocido. Escribe el número del 1 al 8:\n\n' + listaBancos;
        }

        setSession(phone, 'pay_receipt', { bank: banco });
        return '🧾 Escribe el *número de comprobante* o referencia de la transferencia\n_(si no lo tienes a mano, escribe "sin número")_:';
    }

    if (step === 'pay_receipt') {
        try {
            const aptId = sess.data.selectedAptId;
            const fullJid = sess.data.senderJid || null;
            await pool.query(
                "UPDATE appointments SET bank=$1,receipt_no=$2,status='Reportado',payment_status='Pendiente de Validación',wa_sender=COALESCE(wa_sender,$4) WHERE id=$3",
                [sess.data.bank, msg, aptId, fullJid]
            );
            clearSession(phone);
            return '✅ *¡Pago reportado correctamente!*\n\n📋 Cita: *#' + aptId + '*\n🏦 Banco: *' + sess.data.bank + '*\n🧾 Comprobante: *' + msg + '*\n\nUn administrador verificará tu pago en breve. En cuanto sea aprobado, recibirás la confirmación oficial en este chat.\n\n_Escribe menu para volver al inicio._';
        } catch (err) { return '❌ Error al registrar el comprobante. Intenta de nuevo.'; }
    }

    // ══════════════════════════════════════════════════════════
    // FLUJO 3: CONSULTAR ESTADO
    // ══════════════════════════════════════════════════════════
    if (step === 'status_phone') {
        const numL = msg.replace(/\s|-/g, '');
        try {
            const apts = await pool.query(
                'SELECT a.id,a.service_type,a.apt_date,a.status,a.payment_status,t.name as tech_name FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.client_phone=$1 ORDER BY a.created_at DESC LIMIT 3',
                [numL]
            );
            if (!apts.rows.length) {
                clearSession(phone);
                return '❌ No encontré citas registradas para ese número.\n\n_Escribe menu para volver al inicio._';
            }
            const info = apts.rows.map(a => {
                const fecha = a.apt_date?.toISOString().split('T')[0] || 'N/A';
                const tech = a.tech_name ? '\n👷 Técnico: ' + a.tech_name : '';
                return '📋 *Cita #' + a.id + '*\n🔧 ' + a.service_type + '\n📅 Fecha: ' + fecha + '\n🔵 Estado: *' + a.status + '*\n💳 Pago: ' + (a.payment_status || 'Pendiente') + tech;
            }).join('\n\n──────────────\n\n');
            clearSession(phone);
            return '🔍 *Estado de tus Citas en HIDROSYS EC.:*\n\n' + info + '\n\n_Escribe menu para volver al inicio._';
        } catch (err) { return '❌ Error al consultar. Intenta de nuevo.'; }
    }

    // CSAT
    if (step === 'awaiting_csat') {
        const rating = parseInt(msg);
        if (rating >= 1 && rating <= 5) return await saveCsatRating(phone, sess.data, rating, msg);
        return '⭐ *¿Cómo calificarías la atención recibida hoy?*\n\n5️⃣ Excelente 😍\n4️⃣ Bueno 😊\n3️⃣ Regular 😐\n2️⃣ Malo 🙁\n1️⃣ Pésimo 😡\n\n👉 Responde con un número del 1 al 5.';
    }

    // Fallback
    clearSession(phone);
    setSession(phone, 'main_menu', { senderJid });
    return menuPrincipal();
}

// ============================================================
// GUARDAR CALIFICACIÓN CSAT
// ============================================================
async function saveCsatRating(phone, sessData, rating, rawOption) {
    try {
        const aptId = sessData.aptId;
        if (aptId) await pool.query('INSERT INTO surveys (appointment_id,rating,comment) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',[aptId,rating,rawOption]);
        const emojis = { 5:'😍', 4:'😊', 3:'😐', 2:'🙁', 1:'😡' };
        const labels = { 5:'¡Excelente!', 4:'Bueno', 3:'Regular', 2:'Malo', 1:'Pésimo' };
        clearSession(phone);
        return '⭐ *¡Muchas gracias por tu calificación!*\n\n' + emojis[rating] + ' *' + labels[rating] + '* (' + rating + '/5)\n\n_Tu opinión nos ayuda a seguir brindando el mejor servicio. ¡Hasta la próxima!_ 💧\n\n_Escribe menu si necesitas algo más._';
    } catch (err) { clearSession(phone); return '⭐ ¡Gracias por tu calificación! Tu opinión es muy valiosa para nosotros. 💧'; }
}

// ============================================================
// MENSAJES DE SISTEMA
// ============================================================
async function buildConfirmationMessage(aptId) {
    try {
        const result = await pool.query('SELECT a.*,t.name as tech_name,t.phone as tech_phone FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.id=$1',[aptId]);
        if (!result.rows.length) return null;
        const a = result.rows[0]; const fecha = a.apt_date?.toISOString().split('T')[0] || 'N/A';
        let targetJid = a.wa_sender || '';
        if (!targetJid && a.client_phone) {
            const digits = String(a.client_phone).replace(/\D/g,'');
            const pn = digits.length <= 10 ? '593' + digits.replace(/^0/,'') : digits;
            targetJid = pn + '@s.whatsapp.net';
        }
        const phoneKey = targetJid.split('@')[0].replace(/\D/g,'');
        // Persistir wa_sender y client_phone_jid en la DB para vinculación indestructible
        try {
            await pool.query(
                "UPDATE appointments SET wa_sender = $1, client_phone_jid = $1 WHERE id = $2",
                [targetJid, a.id]
            );
        } catch (e) {
            console.warn('[WA] Aviso actualizando wa_sender en cita #' + a.id, e.message);
        }
        trackApprovedApt(a.id);
        setSession(phoneKey, 'awaiting_availability_confirm', { aptId: a.id });
        if (phoneKey.startsWith('593')) {
            setSession('0' + phoneKey.slice(3), 'awaiting_availability_confirm', { aptId: a.id });
            setSession(phoneKey.slice(3), 'awaiting_availability_confirm', { aptId: a.id });
        }
        if (a.client_phone) {
            const rawDigits = a.client_phone.replace(/\D/g,'');
            setSession(rawDigits, 'awaiting_availability_confirm', { aptId: a.id });
            setSession(rawDigits.slice(-9), 'awaiting_availability_confirm', { aptId: a.id });
        }

        return {
            phone: targetJid,
            message: '✅ *HIDROSYS EC. — ¡Cita Confirmada!*\n\n🎉 Tu pago ha sido verificado y aprobado exitosamente.\n\n📋 *Cita ID:* #' + a.id + '\n🔧 *Servicio:* ' + a.service_type + '\n📅 *Fecha:* ' + fecha + '\n⏰ *Hora:* ' + String(a.apt_time).slice(0,5) + '\n📍 *Zona:* ' + a.address + ' (' + a.zone + ')\n👷 *Técnico Asignado:* ' + (a.tech_name || 'Técnico Especializado HIDROSYS') + '\n\n¿Confirmas que estarás disponible en este horario?\n\n1️⃣ *SÍ, estaré disponible*\n2️⃣ *NO, necesito reagendar*\n\n👉 Responde con el número 1 o 2.'
        };
    } catch (err) { console.error('[WA] Error buildConfirmationMessage:', err.message); return null; }
}

async function buildReminderMessage(aptId) {
    try {
        const result = await pool.query('SELECT a.*,t.name as tech_name FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.id=$1',[aptId]);
        if (!result.rows.length) return null;
        const a = result.rows[0]; const fecha = a.apt_date?.toISOString().split('T')[0] || 'Hoy';
        let targetJid = a.wa_sender || '';
        if (!targetJid && a.client_phone) {
            const digits = String(a.client_phone).replace(/\D/g,'');
            targetJid = (digits.length <= 10 ? '593' + digits.replace(/^0/,'') : digits) + '@s.whatsapp.net';
        }
        return {
            phone: targetJid,
            message: '⏰ *HIDROSYS EC. - Recordatorio Automático de Visita*\n\nEstimado/a *' + a.client_name + '*, le recordamos su visita técnica de hoy:\n\n🛠️ *Servicio:* ' + a.service_type + '\n📅 *Fecha:* ' + fecha + '\n⏰ *Hora:* ' + String(a.apt_time||'').slice(0,5) + '\n📍 *Dirección:* ' + a.address + ' (' + a.zone + ')\n👷 *Técnico:* ' + (a.tech_name || 'Personal Técnico Asignado') + '\n\n_Por favor asegúrese de encontrarse en el inmueble. ¡Muchas gracias!_'
        };
    } catch (err) { console.error('[WA] Error buildReminderMessage:', err.message); return null; }
}

async function buildServiceCompletedMessage(aptId) {
    try {
        const result = await pool.query('SELECT a.*,t.name as tech_name FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.id=$1',[aptId]);
        if (!result.rows.length) return null;
        const a = result.rows[0];
        let targetJid = a.wa_sender || '';
        if (!targetJid && a.client_phone) {
            const digits = String(a.client_phone).replace(/\D/g,'');
            targetJid = (digits.length <= 10 ? '593' + digits.replace(/^0/,'') : digits) + '@s.whatsapp.net';
        }
        const phoneKey = targetJid.split('@')[0].replace(/\D/g,'');
        setSession(phoneKey, 'awaiting_csat', { aptId: a.id });

        return {
            phone: targetJid,
            message: '🏁 *HIDROSYS EC. — Servicio Finalizado*\n\nEstimado/a *' + a.client_name + '*, el servicio técnico de *' + a.service_type + '* ha culminado con éxito.\n\n⭐ *¿Cómo calificarías la atención recibida?*\n\n5️⃣ Excelente 😍\n4️⃣ Bueno 😊\n3️⃣ Regular 😐\n2️⃣ Malo 🙁\n1️⃣ Pésimo 😡\n\n👉 Responde con un número del 1 al 5.'
        };
    } catch (err) { console.error('[WA] Error buildServiceCompletedMessage:', err.message); return null; }
}

async function processAudioMessage(phone, msg, senderJid, waSocket) {
    const step = getSession(phone).step;
    if (step === 'book_name') return '🎙️ *Nota de voz recibida.*\n\nPara garantizar que tu nombre quede correcto en la orden de trabajo, por favor *escríbelo por texto*.';
    if (step === 'book_phone') return '🎙️ *Nota de voz recibida.*\n\nPor favor *escribe tu número de celular* de 10 dígitos (ej: 0987654321).';
    if (['book_address','book_canton','book_parish'].includes(step)) return '🎙️ *Nota de voz recibida.*\n\nPor favor *escribe tu dirección y cantón* por texto.';
    if (['book_date','book_time'].includes(step)) return '🎙️ *Nota de voz recibida.*\n\nPor favor indica tu *fecha y horario preferido* por texto.';
    if (step === 'awaiting_availability_confirm') return '🎙️ *Nota de voz recibida.*\n\nPara confirmar tu disponibilidad, responde con el número 1 (SÍ) o 2 (NO) por texto.';

    setSession(phone, 'main_menu', { senderJid, fromAudio: true });
    return menuPrincipal();
}

module.exports = { processMessage, buildConfirmationMessage, buildReminderMessage, buildServiceCompletedMessage, processAudioMessage, clearSession, setSession };
