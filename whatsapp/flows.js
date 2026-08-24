// whatsapp/flows.js - Motor de Conversación del Bot HIDROSYS
// v5.0 - Flujo Guiado con Polls Nativos + Menús Visuales y Respuesta Inmediata

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
    'Otro / Consulta'
];

const CUENTAS_BANCARIAS = `💳 *Cuentas para Transferencia:*
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
    return 'Paso ' + info[0] + ' de ' + info[1] + ' ' + progressBar(info[0], info[1]) + '\n_' + info[2] + '_\n\n';
}

function menuPrincipalDual() {
    return [
        '💧 *HIDROSYS EC. — Asistente Virtual*\n_Atención al Cliente • Sistemas de Agua y Gas_\n\n¡Hola! ¿En qué podemos ayudarte hoy? Toca una opción en la encuesta abajo o escribe el número:\n\n1️⃣ *Agendar Visita Técnica*\n2️⃣ *Reportar Comprobante de Pago*\n3️⃣ *Consultar Estado de Cita*\n4️⃣ *Ver Catálogo y Precios*',
        {
            type: 'poll',
            question: '💧 HIDROSYS EC. — Elige tu opción:',
            options: [
                '📅 1. Agendar Visita Técnica',
                '💳 2. Reportar Pago',
                '🔍 3. Consultar Estado',
                '📦 4. Ver Catálogo y Precios'
            ]
        }
    ];
}

function getTomorrowDateStr() {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
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
    if (['menu','hola','hi','inicio','0','cancelar','cancel','empezar'].includes(msgN)) {
        clearSession(phone);
        setSession(phone, 'main_menu', { senderJid });
        return menuPrincipalDual();
    }

    // Navegación inversa
    const esAtras = ['atras','volver','corregir','cambiar','anterior'].includes(msgN);
    if (esAtras && ['book_phone','book_address','book_canton','book_parish','book_service','book_date','book_time','book_confirm'].includes(step)) {
        const back = { book_phone:'book_name', book_address:'book_phone', book_canton:'book_address', book_parish:'book_canton', book_service:'book_canton', book_date:'book_service', book_time:'book_date', book_confirm:'book_time' };
        const prev = back[step];
        setSession(phone, prev, {});
        if (prev === 'book_name') return stepHeader('book_name') + 'Escribe de nuevo tu *nombre completo*:';
        if (prev === 'book_phone') return stepHeader('book_phone') + '📱 Escribe tu *celular* (10 dígitos):';
        if (prev === 'book_address') return stepHeader('book_address') + '🏠 Escribe la *dirección* del inmueble:';
        if (prev === 'book_canton') {
            return [
                stepHeader('book_canton') + '📍 *Selecciona tu Cantón en la Provincia del Cañar:*',
                {
                    type: 'poll',
                    question: '📍 Paso 4 de 6 — Selecciona tu Cantón:',
                    options: ['1. Azogues', '2. Biblián', '3. Cañar', '4. La Troncal', '5. El Tambo', '6. Déleg', '7. Suscal']
                }
            ];
        }
        return menuPrincipalDual();
    }

    // Confirmación de disponibilidad por cliente
    if (step === 'awaiting_availability_confirm') {
        if (['si','s','1','confirmo','confirmar'].includes(msgN) || msgN.includes('disponible')) {
            try {
                let aptId = sess.data.aptId;
                if (!aptId) {
                    const res = await pool.query('SELECT id FROM appointments WHERE client_phone LIKE $1 AND status = \'Confirmado\' ORDER BY id DESC LIMIT 1', ['%' + phone.slice(-9) + '%']);
                    if (res.rows.length) aptId = res.rows[0].id;
                }
                if (aptId) {
                    await pool.query('UPDATE appointments SET status = \'Conf. Cliente\' WHERE id = $1', [aptId]);
                    clearSession(phone);
                    return '✅ *¡Perfecto! Disponibilidad confirmada.*\n\n📋 Tu cita *#' + aptId + '* queda registrada como *Confirmada por el Cliente*.\n👷 Nuestro técnico asignado se comunicará contigo antes de la visita.\n\n¡Gracias por confiar en *HIDROSYS EC.*!\n_Escribe *menu* si necesitas algo más._';
                }
            } catch (err) { console.error('[WA] Error Conf. Cliente:', err.message); }
        }
        if (['no','n','2'].includes(msgN) || msgN.includes('reagendar')) {
            clearSession(phone);
            return '⚠️ Entendido. Si necesitas reagendar, escribe *menu* para agendar una nueva fecha.';
        }
        return [
            '❓ *Confirmación de Visita Técnica*\n¿Estarás disponible en tu domicilio en el horario indicado?',
            {
                type: 'poll',
                question: '❓ ¿Confirmas tu disponibilidad?',
                options: ['✅ 1. SÍ, estaré disponible', '❌ 2. NO, necesito reagendar']
            }
        ];
    }

    // Menú principal
    if (step === 'idle' || step === 'main_menu') {
        if (msg === '1' || msg.startsWith('1') || msgN.includes('agendar') || msgN.includes('visita')) {
            setSession(phone, 'book_name', { senderJid });
            return stepHeader('book_name') + 'Por favor, escribe tu *nombre completo*:';
        }
        if (msg === '2' || msg.startsWith('2') || msgN.includes('pago') || msgN.includes('comprobante') || msgN.includes('reportar')) {
            setSession(phone, 'pay_phone', { senderJid });
            return '💳 *Reportar Comprobante de Pago*\n\nEscribe el *número de teléfono* con el que registraste tu cita (ej. 0987654321):';
        }
        if (msg === '3' || msg.startsWith('3') || msgN.includes('consultar') || msgN.includes('estado')) {
            setSession(phone, 'status_phone', { senderJid });
            return '🔍 *Consultar Estado de Cita*\n\nEscribe el *número de teléfono* con el que te registraste:';
        }
        if (msg === '4' || msg.startsWith('4') || msgN.includes('catalogo') || msgN.includes('precio')) {
            clearSession(phone);
            return '📦 *Catálogo de Servicios HIDROSYS EC.:*\n\n💧 Instalación medidor agua: $15.00\n🔩 Reparación de tubería: $15.00\n⛽ Red de gas domiciliario: $15.00\n🔨 Mant. sistema hidráulico: $15.00\n🔍 Inspección técnica: $15.00\n\n_Precio incluye visita técnica y diagnóstico. Materiales se cotizan en sitio._\n\nEscribe *menu* para volver.';
        }
        return menuPrincipalDual();
    }

    // FLUJO 1: AGENDAR VISITA
    if (step === 'book_name') {
        if (msg.length < 3) return '⚠️ Por favor escribe tu nombre completo (mínimo 3 letras).';
        setSession(phone, 'book_phone', { name: msg });
        return stepHeader('book_phone') + '📱 Escribe tu número de *celular* (10 dígitos, ej. 0987654321):';
    }

    if (step === 'book_phone') {
        if (!/^0[0-9]{9}$/.test(msg)) return '⚠️ Número inválido. Debe tener 10 dígitos y empezar con 0 (ej: 0987654321).';
        setSession(phone, 'book_address', { clientPhone: msg });
        return stepHeader('book_address') + '🏠 Escribe la *dirección* o referencia del inmueble:\n_(ej: Barrio El Portete, calle Principal y Bolívar, casa azul)_';
    }

    if (step === 'book_address') {
        if (msg.length < 5) return '⚠️ Por favor escribe una dirección más detallada (mínimo 5 caracteres).';
        setSession(phone, 'book_canton', { address: msg });
        return [
            stepHeader('book_canton') + '📍 *Selecciona tu Cantón en la Provincia del Cañar:*',
            {
                type: 'poll',
                question: '📍 Paso 4 de 6 — Selecciona tu Cantón:',
                options: ['1. Azogues', '2. Biblián', '3. Cañar', '4. La Troncal', '5. El Tambo', '6. Déleg', '7. Suscal']
            }
        ];
    }

    if (step === 'book_canton') {
        let cantonData = CANTONES[msg] || CANTONES[msg.charAt(0)];
        if (!cantonData) {
            const mn = norm(msg);
            cantonData = Object.values(CANTONES).find(c => norm(c.nombre) === mn || mn.includes(norm(c.nombre)));
        }
        if (!cantonData) {
            return [
                '❌ Cantón no reconocido. Por favor selecciona de la lista:',
                {
                    type: 'poll',
                    question: '📍 Selecciona tu Cantón en Cañar:',
                    options: ['1. Azogues', '2. Biblián', '3. Cañar', '4. La Troncal', '5. El Tambo', '6. Déleg', '7. Suscal']
                }
            ];
        }

        setSession(phone, 'book_parish', { canton: cantonData.nombre, parroquias: cantonData.parroquias });

        if (cantonData.parroquias.length === 1) {
            setSession(phone, 'book_service', { parish: cantonData.parroquias[0], zone: cantonData.nombre + ' - ' + cantonData.parroquias[0] });
            return [
                stepHeader('book_service') + '🔧 *¿Qué tipo de servicio técnico necesitas?*',
                {
                    type: 'poll',
                    question: '🔧 Paso 5 de 6 — Tipo de Servicio:',
                    options: [
                        '1. Medidor de Agua ($15)',
                        '2. Reparación Tubería ($15)',
                        '3. Red de Gas ($15)',
                        '4. Mant. Hidráulico ($15)',
                        '5. Inspección Técnica ($15)',
                        '6. Otro / Consulta'
                    ]
                }
            ];
        }

        const parishOptions = cantonData.parroquias.map((p, i) => (i + 1) + '. ' + p);
        return [
            'Paso 4 de 6 ▓▓▓▓░░ 67%\n🏘️ *Parroquia de ' + cantonData.nombre + ':*',
            {
                type: 'poll',
                question: '🏘️ Parroquia de ' + cantonData.nombre + ':',
                options: parishOptions.slice(0, 10)
            }
        ];
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
            return [
                '❌ Parroquia no válida. Elige una opción de la lista:',
                {
                    type: 'poll',
                    question: '🏘️ Elige tu Parroquia:',
                    options: parroquias.map((p, i) => (i + 1) + '. ' + p).slice(0, 10)
                }
            ];
        }

        setSession(phone, 'book_service', { parish, zone: sess.data.canton + ' - ' + parish });
        return [
            stepHeader('book_service') + '🔧 *¿Qué tipo de servicio técnico necesitas?*',
            {
                type: 'poll',
                question: '🔧 Paso 5 de 6 — Tipo de Servicio:',
                options: [
                    '1. Medidor de Agua ($15)',
                    '2. Reparación Tubería ($15)',
                    '3. Red de Gas ($15)',
                    '4. Mant. Hidráulico ($15)',
                    '5. Inspección Técnica ($15)',
                    '6. Otro / Consulta'
                ]
            }
        ];
    }

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
            return [
                '❌ Servicio no reconocido. Elige de la lista:',
                {
                    type: 'poll',
                    question: '🔧 Tipo de Servicio:',
                    options: [
                        '1. Medidor de Agua ($15)',
                        '2. Reparación Tubería ($15)',
                        '3. Red de Gas ($15)',
                        '4. Mant. Hidráulico ($15)',
                        '5. Inspección Técnica ($15)',
                        '6. Otro / Consulta'
                    ]
                }
            ];
        }

        // Generar 5 días hábiles
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
                const str = dias[d.getDay()] + ' ' + d.getDate() + ' ' + meses[d.getMonth()];
                optionsDate.push({ iso, str });
                count++;
            }
            offset++;
        }

        setSession(phone, 'book_date', { service, optionsDate });
        return [
            stepHeader('book_date') + '📅 *¿Qué día prefieres para la visita técnica?*',
            {
                type: 'poll',
                question: '📅 Paso 6 de 6 — Elige la Fecha:',
                options: optionsDate.map((o, i) => (i + 1) + '. ' + o.str)
            }
        ];
    }

    if (step === 'book_date') {
        const optionsDate = sess.data.optionsDate || [];
        let fechaSeleccionada = null;
        const idx = parseInt(msg) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < optionsDate.length) {
            fechaSeleccionada = optionsDate[idx].iso;
        } else {
            const mn = norm(msg);
            const match = optionsDate.find(o => o.iso === msg || norm(o.str) === mn || mn.includes(norm(o.str).split(' ')[1]));
            if (match) fechaSeleccionada = match.iso;
            else if (/^\d{4}-\d{2}-\d{2}$/.test(msg)) {
                const f = new Date(msg);
                const h = new Date(); h.setHours(0,0,0,0);
                if (f > h) fechaSeleccionada = msg;
            }
        }

        if (!fechaSeleccionada) {
            return [
                '❌ Fecha no válida. Elige una de las opciones disponibles:',
                {
                    type: 'poll',
                    question: '📅 Elige la Fecha:',
                    options: optionsDate.map((o, i) => (i + 1) + '. ' + o.str)
                }
            ];
        }

        setSession(phone, 'book_time', { date: fechaSeleccionada });
        return [
            'Fecha seleccionada: *' + fechaSeleccionada + '*\n⏰ *¿En qué jornada prefieres la visita?*',
            {
                type: 'poll',
                question: '⏰ Horario Preferido:',
                options: [
                    '1. Mañana (08:00 – 12:00)',
                    '2. Tarde (13:00 – 17:00)',
                    '3. Tarde-noche (17:00 – 19:00)'
                ]
            }
        ];
    }

    if (step === 'book_time') {
        let horaFinal = null;
        if ({'1':'09:00','2':'14:00','3':'17:00'}[msg] || {'1':'09:00','2':'14:00','3':'17:00'}[msg.charAt(0)]) {
            horaFinal = {'1':'09:00','2':'14:00','3':'17:00'}[msg] || {'1':'09:00','2':'14:00','3':'17:00'}[msg.charAt(0)];
        } else if (/^\d{2}:\d{2}$/.test(msg)) {
            horaFinal = msg;
        } else {
            const mn = norm(msg);
            if (mn.includes('manana') || mn.includes('08') || mn.includes('09')) horaFinal = '09:00';
            else if ((mn.includes('tarde') && !mn.includes('noche')) || (mn.includes('13') || mn.includes('14'))) horaFinal = '14:00';
            else if (mn.includes('noche') || mn.includes('17') || mn.includes('tarde-noche')) horaFinal = '17:00';
            else if (mn.includes('tarde')) horaFinal = '14:00';
        }

        if (!horaFinal) {
            return [
                '❌ Horario no reconocido. Elige una opción:',
                {
                    type: 'poll',
                    question: '⏰ Horario Preferido:',
                    options: [
                        '1. Mañana (08:00 – 12:00)',
                        '2. Tarde (13:00 – 17:00)',
                        '3. Tarde-noche (17:00 – 19:00)'
                    ]
                }
            ];
        }

        setSession(phone, 'book_confirm', { time: horaFinal });
        const d = getSession(phone).data;
        const dobj = new Date(d.date + 'T12:00:00');
        const diasL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const mesesL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const fechaLeg = diasL[dobj.getDay()] + ' ' + dobj.getDate() + ' de ' + mesesL[dobj.getMonth()];

        const resumen = '📋 *Resumen de tu Solicitud de Visita Técnica*\n\n' +
            '──────────────────────\n' +
            '👤 *Cliente:* ' + d.name + '\n' +
            '📱 *Celular:* ' + d.clientPhone + '\n' +
            '🏠 *Dirección:* ' + d.address + '\n' +
            '📍 *Zona:* ' + (d.zone || d.canton) + '\n' +
            '🔧 *Servicio:* ' + d.service + '\n' +
            '📅 *Fecha:* ' + fechaLeg + ' (' + d.date + ')\n' +
            '⏰ *Horario:* ' + horaFinal + '\n' +
            '💰 *Valor Visita:* $15.00 USD\n' +
            '──────────────────────';

        return [
            resumen,
            {
                type: 'poll',
                question: '✅ ¿Confirmas tu cita en HIDROSYS?',
                options: [
                    '✅ 1. SÍ, confirmar mi cita',
                    '✍️ 2. No, corregir datos',
                    '❌ 3. Cancelar agendamiento'
                ]
            }
        ];
    }

    if (step === 'book_confirm') {
        const mn = norm(msg);
        if (['2','no','corregir'].includes(mn) || mn.includes('corregir') || mn.startsWith('2')) {
            setSession(phone, 'book_name', {});
            return stepHeader('book_name') + 'De acuerdo, empecemos de nuevo. Escribe tu *nombre completo*:';
        }
        if (['3','cancelar','cancel'].includes(mn) || mn.includes('cancelar') || mn.startsWith('3')) {
            clearSession(phone);
            return '↩️ Solicitud cancelada. Escribe *menu* cuando desees agendar nuevamente.';
        }
        if (!['1','si','s','confirmar','confirmo','ok'].includes(mn) && !mn.includes('confirmar') && !mn.startsWith('1')) {
            return [
                '¿Confirmas la información de tu cita?',
                {
                    type: 'poll',
                    question: '✅ ¿Confirmas tu cita en HIDROSYS?',
                    options: [
                        '✅ 1. SÍ, confirmar mi cita',
                        '✍️ 2. No, corregir datos',
                        '❌ 3. Cancelar agendamiento'
                    ]
                }
            ];
        }

        try {
            const d = getSession(phone).data;
            const fullJid = d.senderJid || (phone + '@s.whatsapp.net');
            const result = await pool.query(
                'INSERT INTO appointments (client_name,client_phone,address,zone,service_type,apt_date,apt_time,payment_amount,channel,status,wa_sender) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',
                [d.name, d.clientPhone, d.address, d.zone || d.canton, d.service, d.date, d.time, 15.00, 'WhatsApp', 'Pre-agendado', fullJid]
            );
            await pool.query(
                'INSERT INTO clients (name,phone,address,zone) VALUES ($1,$2,$3,$4) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name',
                [d.name, d.clientPhone, d.address, d.zone || d.canton]
            );
            const aptId = result.rows[0].id;
            clearSession(phone);

            return '🎉 *¡Cita registrada exitosamente en HIDROSYS EC.!*\n\n' +
                '📋 *ID de tu Cita: #' + aptId + '*\n\n' +
                '⚠️ *PASO SIGUIENTE PARA CONFIRMAR:*\n' +
                'Realiza una transferencia de *$15.00* a cualquiera de nuestras cuentas oficiales:\n\n' +
                CUENTAS_BANCARIAS + '\n\n' +
                '📲 Una vez realizada la transferencia, escribe *menu* y pulsa *2. Reportar Pago* para registrar tu comprobante.\n\n' +
                '_¡Gracias por elegir HIDROSYS EC.! 💧_';
        } catch (err) {
            console.error('[WA] Error al guardar cita:', err.message);
            return '❌ Ocurrió un error al registrar tu cita. Por favor intenta nuevamente escribiendo *menu*.';
        }
    }

    // FLUJO 2: REPORTAR PAGO
    if (step === 'pay_phone') {
        const numL = msg.replace(/\D/g, '').slice(-9);
        try {
            const apts = await pool.query(
                'SELECT id,service_type,apt_date,status FROM appointments WHERE REGEXP_REPLACE(client_phone,\'\\D\',\'\',\'g\') LIKE \'%\'||$1 AND status=\'Pre-agendado\' AND (receipt_no IS NULL OR receipt_no=\'null\' OR receipt_no=\'\') ORDER BY created_at DESC LIMIT 5',
                [numL]
            );
            if (!apts.rows.length) {
                return '❌ No encontré citas pendientes de pago para ese número.\n\nVerifica e intenta de nuevo, o escribe *menu* para volver al inicio.';
            }
            setSession(phone, 'pay_select_apt', { lookupPhone: numL, aptRows: apts.rows });
            const aptOptions = apts.rows.map(a => '#' + a.id + ' – ' + a.service_type);
            return [
                '📋 *Citas Pendientes de Pago Encontradas:*',
                {
                    type: 'poll',
                    question: '📋 Selecciona la Cita que ya Pagaste:',
                    options: aptOptions
                }
            ];
        } catch (err) { return '❌ Error al buscar citas. Intenta de nuevo escribiendo *menu*.'; }
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
        if (!selectedAptId) return '❌ Cita no válida. Por favor selecciona una opción de la lista.';

        setSession(phone, 'pay_bank', { selectedAptId });
        return [
            '🏦 *¿En qué entidad realizaste la transferencia?*',
            {
                type: 'poll',
                question: '🏦 Banco / Cooperativa:',
                options: [
                    '1. Banco Pichincha',
                    '2. Banco Guayaquil',
                    '3. Produbanco',
                    '4. JEP (Cooperativa)',
                    '5. Banco del Pacífico',
                    '6. Coop. MEGO',
                    '7. Alianza del Valle',
                    '8. Banco Bolivariano'
                ]
            }
        ];
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
        if (!banco) return '❌ Banco no reconocido. Selecciona una entidad de la lista.';

        setSession(phone, 'pay_receipt', { bank: banco });
        return '🧾 Escribe el *número de comprobante* de la transferencia\n_(si no lo tienes, escribe: sin número)_:';
    }

    if (step === 'pay_receipt') {
        try {
            const aptId = sess.data.selectedAptId;
            const fullJid = sess.data.senderJid || null;
            await pool.query(
                'UPDATE appointments SET bank=$1,receipt_no=$2,status=\'Reportado\',payment_status=\'Pendiente de Validación\',wa_sender=COALESCE(wa_sender,$4) WHERE id=$3',
                [sess.data.bank, msg, aptId, fullJid]
            );
            clearSession(phone);
            return '✅ *¡Pago reportado correctamente!*\n\n📋 Cita: *#' + aptId + '*\n🏦 Banco: *' + sess.data.bank + '*\n🧾 Comprobante: *' + msg + '*\n\nUn administrador verificará tu pago en breve. Cuando sea aprobado, recibirás la confirmación oficial en este chat.\n\n_Escribe *menu* para volver al inicio._';
        } catch (err) { return '❌ Error al registrar el comprobante. Intenta de nuevo.'; }
    }

    // FLUJO 3: CONSULTAR ESTADO
    if (step === 'status_phone') {
        const numL = msg.replace(/\s|-/g, '');
        try {
            const apts = await pool.query(
                'SELECT a.id,a.service_type,a.apt_date,a.status,a.payment_status,t.name as tech_name FROM appointments a LEFT JOIN technicians t ON a.tech_id=t.id WHERE a.client_phone=$1 ORDER BY a.created_at DESC LIMIT 3',
                [numL]
            );
            if (!apts.rows.length) {
                clearSession(phone);
                return '❌ No encontré citas registradas para ese número.\n\n_Escribe *menu* para volver al inicio._';
            }
            const info = apts.rows.map(a => {
                const fecha = a.apt_date?.toISOString().split('T')[0] || 'N/A';
                const tech = a.tech_name ? '\n👷 Técnico: ' + a.tech_name : '';
                return '📋 *Cita #' + a.id + '*\n🔧 ' + a.service_type + '\n📅 Fecha: ' + fecha + '\n🔵 Estado: *' + a.status + '*\n💳 Pago: ' + (a.payment_status || 'Pendiente') + tech;
            }).join('\n\n──────────────\n\n');
            clearSession(phone);
            return '🔍 *Estado de tus Citas en HIDROSYS:*\n\n' + info + '\n\n_Escribe *menu* para volver al inicio._';
        } catch (err) { return '❌ Error al consultar. Intenta de nuevo.'; }
    }

    // CSAT
    if (step === 'awaiting_csat') {
        const rating = parseInt(msg);
        if (rating >= 1 && rating <= 5) return await saveCsatRating(phone, sess.data, rating, msg);
        return [
            '⭐ *¿Cómo calificarías la atención técnica recibida hoy?*',
            {
                type: 'poll',
                question: '⭐ Calificación de Servicio:',
                options: [
                    '😍 5 - Excelente',
                    '😊 4 - Bueno',
                    '😐 3 - Regular',
                    '🙁 2 - Malo',
                    '😡 1 - Pésimo'
                ]
            }
        ];
    }

    // Fallback
    clearSession(phone);
    setSession(phone, 'main_menu', { senderJid });
    return menuPrincipalDual();
}

// ============================================================
// PROCESADOR DE VOTOS DE POLL
// ============================================================
async function processPollVote(phone, selectedOption, senderJid) {
    const opt = String(selectedOption || '').trim();
    const optN = norm(opt);
    const sess = getSession(phone);
    const step = sess.step;

    if (step === 'idle' || step === 'main_menu') {
        if (optN.includes('agendar') || optN.includes('visita') || optN.startsWith('1')) return await processMessage(phone, '1', senderJid);
        if (optN.includes('pago') || optN.includes('comprobante') || optN.startsWith('2')) return await processMessage(phone, '2', senderJid);
        if (optN.includes('consultar') || optN.includes('estado') || optN.startsWith('3')) return await processMessage(phone, '3', senderJid);
        if (optN.includes('catalogo') || optN.includes('precio') || optN.startsWith('4')) return await processMessage(phone, '4', senderJid);
    }

    if (step === 'awaiting_csat') {
        let rating = 5;
        if (optN.includes('5') || optN.includes('excelente')) rating = 5;
        else if (optN.includes('4') || optN.includes('bueno')) rating = 4;
        else if (optN.includes('3') || optN.includes('regular')) rating = 3;
        else if (optN.includes('2') || optN.includes('malo')) rating = 2;
        else if (optN.includes('1') || optN.includes('pesimo')) rating = 1;
        return await saveCsatRating(phone, sess.data, rating, opt);
    }

    // Extraer número de opción si viene tipo "1. Azogues"
    const matchNum = opt.match(/^(\d+)[.\s]/);
    if (matchNum) {
        return await processMessage(phone, matchNum[1], senderJid);
    }

    return await processMessage(phone, opt, senderJid);
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
        return '⭐ *¡Gracias por tu calificación!*\n\n' + emojis[rating] + ' *' + labels[rating] + '* (' + rating + '/5)\n\n_Tu opinión nos ayuda a seguir mejorando día a día. ¡Hasta la próxima!_ 💧\n\n_Escribe *menu* si necesitas algo más._';
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
        let targetJid = a.wa_sender || '', clientPhoneJid = '';
        if (a.client_phone) {
            const digits = String(a.client_phone).replace(/\D/g,'');
            const pn = digits.length <= 10 ? '593' + digits.replace(/^0/,'') : digits;
            clientPhoneJid = pn + '@s.whatsapp.net';
        }
        if (!targetJid) targetJid = clientPhoneJid;
        const phoneKey = targetJid.split('@')[0].replace(/\D/g,'') || clientPhoneJid.split('@')[0].replace(/\D/g,'');
        setSession(phoneKey, 'awaiting_availability_confirm', { aptId: a.id });

        return {
            phone: targetJid,
            clientPhoneJid: clientPhoneJid !== targetJid ? clientPhoneJid : null,
            message: [
                '✅ *HIDROSYS EC. — ¡Cita Confirmada!*\n\n🎉 Tu pago fue verificado y aprobado exitosamente.\n\n📋 *Cita ID:* #' + a.id + '\n🔧 *Servicio:* ' + a.service_type + '\n📅 *Fecha:* ' + fecha + '\n⏰ *Hora:* ' + String(a.apt_time).slice(0,5) + '\n📍 *Zona:* ' + a.address + ' (' + a.zone + ')\n👷 *Técnico:* ' + (a.tech_name || 'Técnico Especializado HIDROSYS'),
                {
                    type: 'poll',
                    question: '❓ ¿Confirmas que estarás disponible?',
                    options: ['✅ 1. SÍ, estaré disponible', '❌ 2. NO, necesito reagendar']
                }
            ]
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
            message: '🏁 *HIDROSYS EC. — Servicio Finalizado*\n\nEstimado/a *' + a.client_name + '*, el servicio de *' + a.service_type + '* ha concluido exitosamente.\n\n_¡Gracias por elegir HIDROSYS EC.!_',
            poll: {
                type: 'poll',
                question: '⭐ ¿Cómo calificas la atención recibida?',
                options: [
                    '😍 5 - Excelente',
                    '😊 4 - Bueno',
                    '😐 3 - Regular',
                    '🙁 2 - Malo',
                    '😡 1 - Pésimo'
                ]
            }
        };
    } catch (err) { console.error('[WA] Error buildServiceCompletedMessage:', err.message); return null; }
}

async function processAudioMessage(phone, msg, senderJid, waSocket) {
    const step = getSession(phone).step;
    if (step === 'book_name') return '🎙️ *Nota de voz recibida.*\n\nPara garantizar que tu nombre quede correcto en la orden de trabajo, por favor *escríbelo por texto*.';
    if (step === 'book_phone') return '🎙️ *Nota de voz recibida.*\n\nPor favor *escribe tu número de celular* de 10 dígitos (ej: 0987654321).';
    if (['book_address','book_canton','book_parish'].includes(step)) return '🎙️ *Nota de voz recibida.*\n\nPor favor *escribe tu dirección y cantón* por texto.';
    if (['book_date','book_time'].includes(step)) return '🎙️ *Nota de voz recibida.*\n\nPor favor indica tu *fecha y horario preferido* por texto.';
    if (step === 'awaiting_availability_confirm') return '🎙️ *Nota de voz recibida.*\n\nPara confirmar tu disponibilidad, responde *SÍ* o *NO* por texto.';

    setSession(phone, 'main_menu', { senderJid, fromAudio: true });
    return menuPrincipalDual();
}

module.exports = { processMessage, processPollVote, buildConfirmationMessage, buildReminderMessage, buildServiceCompletedMessage, processAudioMessage, clearSession, setSession };
