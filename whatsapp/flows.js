// whatsapp/flows.js - Motor de Conversacion del Bot HIDROSYS
// v4.5 - Botones Interactivos Nativos (Quick Reply & Single Select), Barra de Progreso y Fallback

const pool = require('../db/connection');

// ============================================================
// DATOS GEOGRAFICOS (Provincia del Canar)
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
1. *B. Pichincha* – Cta: 2201948332
2. *B. Guayaquil* – Cta: 10482938
3. *Produbanco* – Cta: 0209384729
4. *JEP (Cooperativa)* – Cta: 551928374
5. *B. del Pacífico* – Cta: 72938472
6. *Coop. MEGO* – Cta: 938482932
7. *Alianza del Valle* – Cta: 384729221
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
    book_canton:  [4, 6, 'Cantón de la Provincia del Cañar'],
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

function menuPrincipalInteractive() {
    return {
        type: 'interactive',
        title: '💧 HIDROSYS EC. — Asistente Virtual',
        text: '¡Hola! Bienvenido al sistema oficial de atención de *HIDROSYS EC.*\n\n¿En qué podemos ayudarte hoy? Toca una opción directa:',
        footer: 'HIDROSYS EC. • Sistemas de Agua y Gas',
        buttons: [
            { id: '1', text: '📅 Agendar Visita' },
            { id: '2', text: '💳 Reportar Pago' },
            { id: '3', text: '🔍 Consultar Cita' },
            { id: '4', text: '📦 Ver Catálogo' }
        ]
    };
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
        return menuPrincipalInteractive();
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
            return {
                type: 'interactive',
                title: '📍 Cantón de Cañar',
                text: stepHeader('book_canton') + '¿En qué cantón de la Provincia del Cañar te encuentras?',
                footer: 'Toca el botón para elegir',
                listButtonTitle: '🏘️ Elegir Cantón',
                sections: [{
                    title: 'Provincia del Cañar',
                    rows: Object.entries(CANTONES).map(([k, v]) => ({ id: k, title: v.nombre, description: 'Cobertura cantonal ' + v.nombre }))
                }]
            };
        }
        return menuPrincipalInteractive();
    }

    // Confirmación de disponibilidad
    if (step === 'awaiting_availability_confirm') {
        if (['si','s','1','confirmo','confirmar'].includes(msgN) || msgN.includes('si, disponible') || msgN.includes('disponible')) {
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
        return {
            type: 'interactive',
            title: '❓ Confirmar Disponibilidad',
            text: '¿Estarás disponible en tu domicilio para recibir al técnico en el horario indicado?',
            footer: 'HIDROSYS EC.',
            buttons: [
                { id: '1', text: '✅ SÍ, Disponible' },
                { id: '2', text: '❌ No, Reagendar' }
            ]
        };
    }

    // Menú principal
    if (step === 'idle' || step === 'main_menu') {
        if (msg === '1' || msgN.includes('agendar') || msgN.includes('visita')) {
            setSession(phone, 'book_name', { senderJid });
            return stepHeader('book_name') + 'Por favor, escribe tu *nombre completo*:';
        }
        if (msg === '2' || msgN.includes('pago') || msgN.includes('comprobante') || msgN.includes('reportar')) {
            setSession(phone, 'pay_phone', { senderJid });
            return '💳 *Reportar Comprobante de Pago*\n\nEscribe el *número de teléfono* con el que registraste tu cita (ej. 0987654321):';
        }
        if (msg === '3' || msgN.includes('consultar') || msgN.includes('estado')) {
            setSession(phone, 'status_phone', { senderJid });
            return '🔍 *Consultar Estado de Cita*\n\nEscribe el *número de teléfono* con el que te registraste:';
        }
        if (msg === '4' || msgN.includes('catalogo') || msgN.includes('precio')) {
            clearSession(phone);
            return '📦 *Catálogo de Servicios HIDROSYS EC.:*\n\n💧 Instalación medidor agua: $15.00\n🔩 Reparación de tubería: $15.00\n⛽ Red de gas domiciliario: $15.00\n🔨 Mant. sistema hidráulico: $15.00\n🔍 Inspección técnica: $15.00\n\n_Precio incluye visita técnica y diagnóstico. Materiales cotizados en sitio._\n\nEscribe *menu* para volver.';
        }
        return menuPrincipalInteractive();
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
        return {
            type: 'interactive',
            title: '📍 Cantón del Cañar',
            text: stepHeader('book_canton') + '¿En qué cantón de la Provincia del Cañar se realizará el trabajo?',
            footer: 'Toca el botón para elegir',
            listButtonTitle: '🏘️ Elegir Cantón',
            sections: [{
                title: 'Provincia del Cañar',
                rows: Object.entries(CANTONES).map(([k, v]) => ({ id: k, title: v.nombre, description: 'Atención técnica en ' + v.nombre }))
            }]
        };
    }

    if (step === 'book_canton') {
        let cantonData = CANTONES[msg];
        if (!cantonData) {
            const mn = norm(msg);
            const found = Object.values(CANTONES).find(c => norm(c.nombre) === mn || mn.includes(norm(c.nombre)));
            cantonData = found;
        }
        if (!cantonData) {
            return {
                type: 'interactive',
                title: '📍 Cantón de Cañar',
                text: '❌ Cantón no reconocido. Por favor selecciona tu cantón de la lista:',
                footer: 'HIDROSYS EC.',
                listButtonTitle: '🏘️ Elegir Cantón',
                sections: [{
                    title: 'Provincia del Cañar',
                    rows: Object.entries(CANTONES).map(([k, v]) => ({ id: k, title: v.nombre, description: 'Atención en ' + v.nombre }))
                }]
            };
        }

        setSession(phone, 'book_parish', { canton: cantonData.nombre, parroquias: cantonData.parroquias });

        if (cantonData.parroquias.length === 1) {
            setSession(phone, 'book_service', { parish: cantonData.parroquias[0], zone: cantonData.nombre + ' - ' + cantonData.parroquias[0] });
            return {
                type: 'interactive',
                title: '🔧 Tipo de Servicio',
                text: stepHeader('book_service') + '¿Qué tipo de servicio técnico necesitas?',
                footer: 'Tarifa base de visita técnica: $15.00',
                listButtonTitle: '🔧 Elegir Servicio',
                sections: [{
                    title: 'Servicios Disponibles',
                    rows: SERVICIOS.map((s, i) => ({ id: String(i + 1), title: s, description: 'Tarifa básica $15.00' }))
                }]
            };
        }

        return {
            type: 'interactive',
            title: '🏘️ Parroquia (' + cantonData.nombre + ')',
            text: 'Paso 4 de 6 ▓▓▓▓░░ 67%\n_Selecciona tu parroquia en ' + cantonData.nombre + ':_',
            footer: 'HIDROSYS EC. • Agendamiento',
            listButtonTitle: '🏘️ Elegir Parroquia',
            sections: [{
                title: cantonData.nombre,
                rows: cantonData.parroquias.map((p, i) => ({ id: String(i + 1), title: p, description: 'Parroquia ' + p }))
            }]
        };
    }

    if (step === 'book_parish') {
        const parroquias = sess.data.parroquias || [];
        let parish = null;
        const idx = parseInt(msg) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < parroquias.length) {
            parish = parroquias[idx];
        } else {
            const mn = norm(msg);
            parish = parroquias.find(p => norm(p) === mn || norm(p).includes(mn));
        }
        if (!parish) {
            return {
                type: 'interactive',
                title: '🏘️ Selecciona tu Parroquia',
                text: '❌ Parroquia no reconocida. Elige de la lista:',
                footer: 'HIDROSYS EC.',
                listButtonTitle: '🏘️ Elegir Parroquia',
                sections: [{
                    title: sess.data.canton || 'Parroquias',
                    rows: parroquias.map((p, i) => ({ id: String(i + 1), title: p, description: 'Parroquia ' + p }))
                }]
            };
        }

        setSession(phone, 'book_service', { parish, zone: sess.data.canton + ' - ' + parish });
        return {
            type: 'interactive',
            title: '🔧 Tipo de Servicio',
            text: stepHeader('book_service') + '¿Qué tipo de servicio técnico necesitas?',
            footer: 'Tarifa base de visita técnica: $15.00',
            listButtonTitle: '🔧 Elegir Servicio',
            sections: [{
                title: 'Servicios Disponibles',
                rows: SERVICIOS.map((s, i) => ({ id: String(i + 1), title: s, description: 'Tarifa básica $15.00' }))
            }]
        };
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
            return {
                type: 'interactive',
                title: '🔧 Selecciona un Servicio',
                text: '❌ Servicio no reconocido. Elige de la lista:',
                footer: 'HIDROSYS EC.',
                listButtonTitle: '🔧 Elegir Servicio',
                sections: [{
                    title: 'Servicios Disponibles',
                    rows: SERVICIOS.map((s, i) => ({ id: String(i + 1), title: s, description: 'Tarifa básica $15.00' }))
                }]
            };
        }

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
                const str = dias[d.getDay()] + ' ' + d.getDate() + ' de ' + meses[d.getMonth()];
                optionsDate.push({ iso, str });
                count++;
            }
            offset++;
        }

        setSession(phone, 'book_date', { service, optionsDate });
        return {
            type: 'interactive',
            title: '📅 Fecha de Visita',
            text: stepHeader('book_date') + '¿Qué día prefieres para la visita técnica?',
            footer: 'Atención de Lunes a Sábado',
            listButtonTitle: '📅 Elegir Fecha',
            sections: [{
                title: 'Próximos Días Disponibles',
                rows: optionsDate.map(o => ({ id: o.iso, title: o.str, description: 'Fecha: ' + o.iso }))
            }]
        };
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
            return {
                type: 'interactive',
                title: '📅 Elige una Fecha',
                text: '❌ Fecha no válida. Elige una de las opciones disponibles:',
                footer: 'HIDROSYS EC.',
                listButtonTitle: '📅 Elegir Fecha',
                sections: [{
                    title: 'Días Disponibles',
                    rows: optionsDate.map(o => ({ id: o.iso, title: o.str, description: 'Fecha: ' + o.iso }))
                }]
            };
        }

        setSession(phone, 'book_time', { date: fechaSeleccionada });
        return {
            type: 'interactive',
            title: '⏰ Horario de Visita',
            text: 'Fecha seleccionada: *' + fechaSeleccionada + '*\n\n¿En qué jornada prefieres la visita?',
            footer: 'El técnico confirmará antes de llegar',
            buttons: [
                { id: '1', text: '🌅 Mañana (08-12)' },
                { id: '2', text: '☀️ Tarde (13-17)' },
                { id: '3', text: '🌆 Noche (17-19)' }
            ]
        };
    }

    if (step === 'book_time') {
        let horaFinal = null;
        if ({'1':'09:00','2':'14:00','3':'17:00'}[msg]) horaFinal = {'1':'09:00','2':'14:00','3':'17:00'}[msg];
        else if (/^\d{2}:\d{2}$/.test(msg)) horaFinal = msg;
        else {
            const mn = norm(msg);
            if (mn.includes('manana') || mn.includes('08') || mn.includes('09')) horaFinal = '09:00';
            else if ((mn.includes('tarde') && !mn.includes('noche')) || (mn.includes('13') || mn.includes('14'))) horaFinal = '14:00';
            else if (mn.includes('noche') || mn.includes('17') || mn.includes('tarde-noche')) horaFinal = '17:00';
            else if (mn.includes('tarde')) horaFinal = '14:00';
        }

        if (!horaFinal) {
            return {
                type: 'interactive',
                title: '⏰ Horario de Visita',
                text: '❌ Horario no reconocido. Elige una opción:',
                footer: 'HIDROSYS EC.',
                buttons: [
                    { id: '1', text: '🌅 Mañana (08-12)' },
                    { id: '2', text: '☀️ Tarde (13-17)' },
                    { id: '3', text: '🌆 Noche (17-19)' }
                ]
            };
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
                type: 'interactive',
                title: '✅ Confirmar Solicitud',
                text: '¿Confirmas estos datos para agendar tu cita?',
                footer: 'HIDROSYS EC. • Garantía y Calidad',
                buttons: [
                    { id: '1', text: '✅ SÍ, Confirmar' },
                    { id: '2', text: '✍️ Corregir' },
                    { id: '3', text: '❌ Cancelar' }
                ]
            }
        ];
    }

    if (step === 'book_confirm') {
        const mn = norm(msg);
        if (['2','no','corregir'].includes(mn) || mn.includes('corregir')) {
            setSession(phone, 'book_name', {});
            return stepHeader('book_name') + 'De acuerdo, empecemos de nuevo. Escribe tu *nombre completo*:';
        }
        if (['3','cancelar','cancel'].includes(mn) || mn.includes('cancelar')) {
            clearSession(phone);
            return '↩️ Solicitud cancelada. Escribe *menu* cuando desees agendar nuevamente.';
        }
        if (!['1','si','s','confirmar','confirmo','ok'].includes(mn) && !mn.includes('confirmar')) {
            return {
                type: 'interactive',
                title: '✅ Confirmar Solicitud',
                text: '¿Deseas registrar esta cita?',
                footer: 'HIDROSYS EC.',
                buttons: [
                    { id: '1', text: '✅ SÍ, Confirmar' },
                    { id: '2', text: '✍️ Corregir' },
                    { id: '3', text: '❌ Cancelar' }
                ]
            };
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
                '📲 Una vez realizada la transferencia, escribe *menu* y pulsa *Reportar Pago* para registrar tu comprobante.\n\n' +
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
            return {
                type: 'interactive',
                title: '📋 Citas Pendientes de Pago',
                text: 'Se encontraron citas registradas. Selecciona la que deseas reportar:',
                footer: 'HIDROSYS EC.',
                listButtonTitle: '📋 Seleccionar Cita',
                sections: [{
                    title: 'Citas Encontradas',
                    rows: apts.rows.map(a => ({
                        id: String(a.id),
                        title: 'Cita #' + a.id + ' – ' + a.service_type,
                        description: 'Fecha: ' + (a.apt_date?.toISOString().split('T')[0] || 'N/A')
                    }))
                }]
            };
        } catch (err) { return '❌ Error al buscar citas. Intenta de nuevo escribiendo *menu*.'; }
    }

    if (step === 'pay_select_apt') {
        const rows = sess.data.aptRows || [];
        const matchApt = rows.find(r => String(r.id) === msg);
        let selectedAptId = matchApt ? matchApt.id : null;
        if (!selectedAptId) {
            const idx = parseInt(msg) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < rows.length) selectedAptId = rows[idx].id;
        }
        if (!selectedAptId) return '❌ Cita no válida. Por favor selecciona una de las opciones mostradas.';

        setSession(phone, 'pay_bank', { selectedAptId });
        const bancos = ['Banco Pichincha','Banco Guayaquil','Produbanco','JEP','Banco del Pacífico','Coop. MEGO','Alianza del Valle','Banco Bolivariano'];
        return {
            type: 'interactive',
            title: '🏦 Banco de Transferencia',
            text: 'Selecciona el banco o cooperativa donde realizaste el pago:',
            footer: 'HIDROSYS EC.',
            listButtonTitle: '🏦 Elegir Banco',
            sections: [{
                title: 'Entidades Bancarias',
                rows: bancos.map((b, i) => ({ id: String(i + 1), title: b, description: 'Cuenta Hidrosys EC.' }))
            }]
        };
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
        return {
            type: 'interactive',
            title: '⭐ Calificación del Servicio',
            text: '¿Cómo calificarías la atención técnica recibida hoy?',
            footer: 'HIDROSYS EC.',
            buttons: [
                { id: '5', text: '😍 Excelente (5/5)' },
                { id: '4', text: '😊 Bueno (4/5)' },
                { id: '3', text: '😐 Regular (3/5)' }
            ]
        };
    }

    // Express NLP
    const expressData = parseExpressBookingText(msg);
    if (expressData && (step === 'idle' || step === 'main_menu' || step.startsWith('book_'))) {
        setSession(phone, 'express_confirm', {
            name: expressData.name || sess.data.name || 'Cliente',
            clientPhone: expressData.phone || phone,
            service: expressData.service || 'Inspección Técnica General',
            address: expressData.address || 'Domicilio del Cliente',
            canton: expressData.canton || 'Azogues',
            parish: expressData.parish || expressData.canton || 'Azogues',
            zone: (expressData.canton || 'Azogues') + ' - ' + (expressData.parish || expressData.canton || 'Azogues'),
            date: expressData.date || getTomorrowDateStr(),
            time: expressData.time || '10:00',
            senderJid: senderJid || sess.data.senderJid
        });
        const s = getSession(phone).data;
        return [
            '📋 *¡Datos detectados automáticamente!* ⚡\n\nHemos preparado tu orden de agendamiento:\n\n👤 *Cliente:* ' + s.name + '\n🔧 *Servicio:* ' + s.service + '\n📍 *Ubicación:* ' + s.address + ', ' + s.canton + '\n📅 *Fecha:* ' + s.date + '\n⏰ *Hora:* ' + s.time + '\n💰 *Valor:* $15.00',
            {
                type: 'interactive',
                title: '⚡ Confirmar Agendamiento Rápido',
                text: '¿Confirmas estos datos para registrar la cita de inmediato?',
                footer: 'HIDROSYS EC.',
                buttons: [
                    { id: '1', text: '✅ SÍ, Confirmar' },
                    { id: '0', text: '❌ Cancelar' }
                ]
            }
        ];
    }

    if (step === 'express_confirm') {
        const mn = norm(msg);
        if (['1','si','s','confirmar','confirmo','ok'].includes(mn)) {
            const s = sess.data;
            try {
                await pool.query('INSERT INTO clients (name,phone,address,zone) VALUES ($1,$2,$3,$4) ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name',[s.name,s.clientPhone,s.address,s.zone]);
                const result = await pool.query('INSERT INTO appointments (client_name,client_phone,address,zone,service_type,apt_date,apt_time,status,payment_amount,payment_status,channel,notes,wa_sender) VALUES ($1,$2,$3,$4,$5,$6,$7,\'Agendado\',$8,\'Pendiente\',\'WhatsApp\',\'Agendamiento Express WhatsApp\',$9) RETURNING id',[s.name,s.clientPhone,s.address,s.zone,s.service,s.date,s.time,15.00,s.senderJid||null]);
                const aptId = result.rows[0].id; clearSession(phone);
                return '🎉 *¡Tu cita #' + aptId + ' fue registrada con éxito!*\n\n🛠️ Servicio: *' + s.service + '*\n📅 Fecha: *' + s.date + '* a las *' + s.time + '*\n📍 Dirección: *' + s.address + '* (' + s.canton + ')\n💵 Total: *$15.00*\n\n' + CUENTAS_BANCARIAS + '\n\n👉 _Envía el número de transacción con la opción **2** del menú._';
            } catch (err) { return '❌ Inconveniente al guardar la cita. Escribe *menu* e intenta de nuevo.'; }
        } else {
            clearSession(phone);
            return menuPrincipalInteractive();
        }
    }

    // Fallback
    clearSession(phone);
    setSession(phone, 'main_menu', { senderJid });
    return menuPrincipalInteractive();
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
        if (optN.includes('agendar') || optN.includes('visita')) return await processMessage(phone, '1', senderJid);
        if (optN.includes('pago') || optN.includes('comprobante')) return await processMessage(phone, '2', senderJid);
        if (optN.includes('consultar') || optN.includes('estado')) return await processMessage(phone, '3', senderJid);
        if (optN.includes('catalogo') || optN.includes('precio')) return await processMessage(phone, '4', senderJid);
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

    return await processMessage(phone, opt, senderJid);
}

// ============================================================
// GUARDAR CALIFICACION CSAT
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
// EXPRESS NLP
// ============================================================
function parseExpressBookingText(text) {
    if (!text || text.length < 15) return null;
    const lower = norm(text);
    const hasIntent = lower.includes('agendar') || lower.includes('visita') || lower.includes('mantenimiento') || lower.includes('reparar') || lower.includes('fuga') || lower.includes('bomba') || lower.includes('instal') || lower.includes('tuberia') || lower.includes('nombre:');
    if (!hasIntent) return null;
    let name = '', address = '', canton = 'Azogues', service = 'Inspección Técnica General', date = getTomorrowDateStr(), time = '10:00';
    const phoneMatch = text.match(/09\d{8}/);
    text.split('\n').forEach(l => {
        const parts = l.split(':');
        if (parts.length >= 2) {
            const k = norm(parts[0]);
            const v = parts.slice(1).join(':').trim();
            if (k.includes('nombre') || k.includes('cliente')) name = v;
            if (k.includes('direc') || k.includes('calle') || k.includes('lugar')) address = v;
            if (k.includes('canton') || k.includes('ciudad')) canton = v;
            if (k.includes('servicio') || k.includes('trabajo')) service = v;
            if (k.includes('fecha') || k.includes('dia')) date = v;
            if (k.includes('hora')) time = v;
        }
    });
    Object.values(CANTONES).forEach(c => { if (lower.includes(norm(c.nombre))) canton = c.nombre; });
    if (lower.includes('gas')) service = 'Instalación de Red de Gas Domiciliario';
    else if (lower.includes('bomba') || lower.includes('hidro')) service = 'Mantenimiento de Sistema Hidráulico';
    else if (lower.includes('medidor')) service = 'Instalación de Medidor de Agua';
    else if (lower.includes('tuberia') || lower.includes('fuga') || lower.includes('goteo')) service = 'Revisión / Reparación de Tubería';
    if (!name && lower.includes('soy ')) {
        const a = text.substring(lower.indexOf('soy ') + 4).split(/[,.\n]/)[0].trim();
        if (a.length > 2) name = a;
    }
    if (!address && (lower.includes('en ') || lower.includes('calle '))) {
        const a = text.substring(lower.indexOf('en ') + 3).split(/[,.\n]/)[0].trim();
        if (a.length > 3) address = a;
    }
    if (name || address || phoneMatch) return { name: name || 'Cliente Particular', phone: phoneMatch ? phoneMatch[0] : null, address: address || 'Dirección por confirmar', canton: canton || 'Azogues', parish: canton || 'Azogues', service, date, time };
    return null;
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
                    type: 'interactive',
                    title: '✅ Confirmar Asistencia',
                    text: '¿Confirmas que estarás disponible en este horario?',
                    footer: 'HIDROSYS EC.',
                    buttons: [
                        { id: '1', text: '✅ SÍ, Confirmar' },
                        { id: '2', text: '❌ No, Reagendar' }
                    ]
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
            interactiveFeedback: {
                type: 'interactive',
                title: '⭐ Calificación de Servicio',
                text: '¿Cómo calificarías la atención de nuestro personal técnico?',
                footer: 'HIDROSYS EC. • Calidad y Control',
                buttons: [
                    { id: '5', text: '😍 Excelente (5/5)' },
                    { id: '4', text: '😊 Bueno (4/5)' },
                    { id: '3', text: '😐 Regular (3/5)' }
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
    return menuPrincipalInteractive();
}

module.exports = { processMessage, processPollVote, buildConfirmationMessage, buildReminderMessage, buildServiceCompletedMessage, processAudioMessage, clearSession, setSession };
