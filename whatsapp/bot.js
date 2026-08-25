// whatsapp/bot.js - Conexión WhatsApp via Baileys para HIDROSYS EC.
// Librería: @whiskeysockets/baileys
// v5.5 - Control Antiduplicados, Notificación al Técnico y Entrega Inmediata

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const { Boom }          = require('@hapi/boom');
const pino              = require('pino');
const qrcode            = require('qrcode-terminal');
const path              = require('path');
const fs                = require('fs');
const pool              = require('../db/connection');
const { processMessage, buildConfirmationMessage, buildReminderMessage, buildServiceCompletedMessage, processAudioMessage } = require('./flows');

// ============================================================
// CONFIGURACIÓN
// ============================================================
const AUTH_FOLDER = path.join(__dirname, '..', '.wabaileys');
let   waSocket    = null;
let   isConnected = false;
let   lastQr      = null;

// Logger silencioso
const logger = pino({ level: 'silent' });

// ============================================================
// CONTROL DE DEDUPLICACIÓN DE NOTIFICACIONES
// ============================================================
const notifiedPaymentAptIds = new Set();
const notifiedTechJobKeys   = new Set();

// ============================================================
// HELPER: Normalizar JID
// ============================================================
function normalizeJid(jidOrPhone) {
    let jid = String(jidOrPhone || '').trim();
    if (!jid.includes('@')) {
        const cleanPhone = jid.split(':')[0].replace(/\D/g, '');
        let targetPhone = cleanPhone;
        if (cleanPhone.length <= 10) {
            targetPhone = '593' + cleanPhone.replace(/^0/, '');
        }
        jid = targetPhone + '@s.whatsapp.net';
    }
    return jid;
}

// ============================================================
// ENVIAR MENSAJE
// ============================================================
async function sendMessage(jidOrPhone, content) {
    if (!waSocket || !isConnected) {
        console.warn('[WA Bot] No conectado. Mensaje no enviado.');
        return false;
    }
    const jid = normalizeJid(jidOrPhone);

    try {
        let textToSend = content;
        if (typeof textToSend === 'object' && textToSend !== null) {
            let formatted = '';
            if (textToSend.title) formatted += '*' + textToSend.title + '*\n\n';
            if (textToSend.text) formatted += textToSend.text + '\n';
            if (textToSend.footer) formatted += '\n_' + textToSend.footer + '_';
            textToSend = formatted.trim() || JSON.stringify(textToSend);
        }

        await waSocket.sendMessage(jid, { text: String(textToSend) });
        console.log('[WA Bot] ✅ Mensaje entregado a: ' + jid);
        return true;
    } catch (err) {
        console.error('[WA Bot] ❌ Error enviando mensaje:', err.message);
        return false;
    }
}

// ============================================================
// INICIALIZAR BOT
// ============================================================
async function startWhatsAppBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version }          = await fetchLatestBaileysVersion();

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  💬 HIDROSYS – Bot de WhatsApp v5.5      ║');
    console.log('║  Control Antiduplicados y Notificaciones ║');
    console.log('╚══════════════════════════════════════════╝\n');

    waSocket = makeWASocket({
        version,
        auth: {
            creds:  state.creds,
            keys:   makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: false,
        browser: ['Chrome (Linux)', 'Chrome', '110.0.0.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
    });

    const pairingNum = process.env.WA_PAIRING_NUMBER;
    if (pairingNum && !state.creds.registered) {
        setTimeout(async () => {
            try {
                const cleanNum = pairingNum.replace(/\D/g, '');
                const code = await waSocket.requestPairingCode(cleanNum);
                console.log('\n==================================================');
                console.log('🔑 NUEVO CÓDIGO DE VINCULACIÓN: ' + code);
                console.log('==================================================');
            } catch (err) {
                console.error('❌ Error generando código de emparejamiento:', err.message);
            }
        }, 6000);
    }

    waSocket.ev.on('creds.update', saveCreds);

    waSocket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            lastQr = qr;
            if (!pairingNum) {
                console.log('\n📱 ¡ESCANEA EL SIGUIENTE QR CON WHATSAPP!\n');
                qrcode.generate(qr, { small: true });
            }
        }

        if (connection === 'close') {
            isConnected = false;
            lastQr = null;
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log('\n⚠️  [WA Bot] Sesión cerrada. Eliminando credenciales...');
                if (fs.existsSync(AUTH_FOLDER)) {
                    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                }
                console.log('   Reinicia el servidor para generar un nuevo QR.\n');
            } else {
                console.log('\n🔄 [WA Bot] Desconectado (código: ' + reason + '). Reconectando en 5s...');
                setTimeout(startWhatsAppBot, 5000);
            }
        }

        if (connection === 'open') {
            isConnected = true;
            lastQr = null;
            const phone = waSocket.user?.id?.split(':')[0] || 'desconocido';
            console.log('\n✅ [WA Bot] ¡Conectado exitosamente!');
            console.log('   📱 Número vinculado: +' + phone);
            console.log('   El bot está activo y listo para procesar citas.\n');
        }
    });

    const processedMessageIds = new Set();
    const userLastMsgTime     = new Map();

    // ── PROCESAR MENSAJES ENTRANTES ──────────────────────────
    waSocket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (msg.key.fromMe)                                 continue;
            if (msg.key.remoteJid === 'status@broadcast')       continue;
            if (msg.key.remoteJid?.endsWith('@g.us'))           continue;

            const jid      = msg.key.remoteJid;
            const cleanJid = jid.split(':')[0];
            const phone    = cleanJid.split('@')[0].replace(/\D/g, '');

            // Deduplicación por ID de mensaje
            if (msg.key.id) {
                if (processedMessageIds.has(msg.key.id)) continue;
                processedMessageIds.add(msg.key.id);
                if (processedMessageIds.size > 2000) {
                    const first = processedMessageIds.values().next().value;
                    processedMessageIds.delete(first);
                }
            }

            const isAudio = Boolean(msg.message?.audioMessage);

            let text = '';
            if (msg.message?.conversation) {
                text = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
                text = msg.message.extendedTextMessage.text;
            } else if (msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
                text = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
            } else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
                text = msg.message.buttonsResponseMessage.selectedButtonId;
            }

            if (!text.trim() && !isAudio) continue;

            const now = Date.now();
            const debounceKey = phone + '_' + text.trim();
            if (userLastMsgTime.has(debounceKey) && (now - userLastMsgTime.get(debounceKey)) < 1200) continue;
            userLastMsgTime.set(debounceKey, now);

            try {
                if (isAudio) {
                    console.log('[WA] 🎙️ Nota de voz de +' + phone);
                    try {
                        await waSocket.sendPresenceUpdate('recording', jid);
                        await new Promise(r => setTimeout(r, 600));
                        await waSocket.sendPresenceUpdate('composing', jid);
                    } catch (e) {}
                    const response = await processAudioMessage(phone, msg, jid, waSocket);
                    if (response) {
                        await sendMessage(jid, response);
                    }
                    continue;
                }

                console.log('[WA] 📨 Mensaje de +' + phone + ': "' + text + '"');
                await waSocket.sendPresenceUpdate('composing', jid);

                const response = await processMessage(phone, text, jid);
                if (response) {
                    await sendMessage(jid, response);
                    console.log('[WA] ✅ Respuesta enviada a +' + phone);
                }
            } catch (err) {
                console.error('[WA] ❌ Error procesando mensaje de +' + phone + ':', err.message);
            }
        }
    });

    return waSocket;
}

// ============================================================
// NOTIFICACIONES AUTOMÁTICAS (CONTROL ANTIDUPLICADOS)
// ============================================================

// 1. Confirmación de Cita al CLIENTE (1 solo envío garantizado)
async function notifyPaymentApproved(aptId) {
    if (!aptId) return false;
    const cacheKey = String(aptId);
    if (notifiedPaymentAptIds.has(cacheKey)) {
        console.log('[WA Bot] ℹ️ Notificación de pago para cita #' + aptId + ' ya enviada. Omitiendo duplicado.');
        return true;
    }

    const payload = await buildConfirmationMessage(aptId);
    if (!payload || !payload.phone) return false;

    notifiedPaymentAptIds.add(cacheKey);
    return await sendMessage(payload.phone, payload.message);
}

// 2. Notificación de Trabajo Asignado al TÉCNICO
async function notifyTechnicianJobAssigned(aptId, techId) {
    if (!aptId || !techId) return false;
    const cacheKey = aptId + '_' + techId;
    if (notifiedTechJobKeys.has(cacheKey)) return true;

    try {
        const aptRes = await pool.query(
            `SELECT a.*, t.name as tech_name, t.phone as tech_phone, t.email as tech_email
             FROM appointments a
             LEFT JOIN technicians t ON a.tech_id = t.id
             WHERE a.id = $1`,
            [aptId]
        );
        if (!aptRes.rows.length) return false;
        const apt = aptRes.rows[0];
        const techPhone = apt.tech_phone;
        if (!techPhone) {
            console.log('[WA Bot] ⚠️ Técnico #' + techId + ' (' + apt.tech_name + ') no tiene teléfono.');
            return false;
        }

        const dobj = apt.apt_date ? new Date(apt.apt_date) : new Date();
        const diasL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
        const mesesL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const fechaLeg = diasL[dobj.getDay()] + ' ' + dobj.getDate() + ' de ' + mesesL[dobj.getMonth()] + ' (' + (apt.apt_date?.toISOString().split('T')[0] || 'Por coordinar') + ')';

        const msgTech = '👷 *HIDROSYS EC. — Nueva Orden de Trabajo Asignada*\n\n' +
            'Hola *' + apt.tech_name + '*, el administrador te ha asignado una nueva visita técnica:\n\n' +
            '📋 *Orden de Trabajo:* #' + apt.id + '\n' +
            '👤 *Cliente:* ' + apt.client_name + '\n' +
            '📱 *Teléfono Cliente:* ' + apt.client_phone + '\n' +
            '🏠 *Dirección:* ' + apt.address + '\n' +
            '📍 *Zona:* ' + apt.zone + '\n' +
            '🔧 *Servicio:* ' + apt.service_type + '\n' +
            '📅 *Fecha:* ' + fechaLeg + '\n' +
            '⏰ *Horario:* ' + String(apt.apt_time || '').slice(0,5) + '\n' +
            '💰 *Estado de Pago:* ' + (apt.payment_status || 'Pagado') + '\n' +
            (apt.notes ? '📝 *Notas:* "' + apt.notes + '"\n' : '') +
            '\n👉 _Por favor comunícate con el cliente previo a la visita para coordinar tu llegada._';

        notifiedTechJobKeys.add(cacheKey);
        const sent = await sendMessage(techPhone, msgTech);
        if (sent) {
            console.log('[WA Bot] 👷 Notificación de orden enviada al técnico ' + apt.tech_name + ' (' + techPhone + ')');
        }
        return sent;
    } catch (err) {
        console.error('[WA Bot] ❌ Error notificando al técnico:', err.message);
        return false;
    }
}

// 3. Recordatorio de Cita
async function notifyAppointmentReminder(aptId) {
    const payload = await buildReminderMessage(aptId);
    if (!payload || !payload.phone) return false;
    return await sendMessage(payload.phone, payload.message);
}

// 4. Servicio Concluido y Encuesta CSAT
async function notifyServiceCompleted(aptId) {
    const payload = await buildServiceCompletedMessage(aptId);
    if (!payload || !payload.phone) return false;
    return await sendMessage(payload.phone, payload.message);
}

// 5. OTP de Verificación
async function sendClientVerificationOtp(phone, clientName, code) {
    if (!phone) return false;
    let cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '593' + cleanPhone.substring(1);
    if (!cleanPhone.startsWith('593')) cleanPhone = '593' + cleanPhone;
    const jid = cleanPhone + '@s.whatsapp.net';
    const message = '🔐 *HIDROSYS EC. - Verificación de Identidad*\n\nHola *' + clientName + '*,\n\nTu código de seguridad para confirmar tu identidad es:\n\n👉 *' + code + '*\n\n_Válido por 5 minutos. Si no solicitaste este código, ignóralo._\n\n_HIDROSYS EC. • Seguridad y Control_';
    return await sendMessage(jid, message);
}

function getBotStatus() {
    return { connected: isConnected, phone: waSocket?.user?.id?.split(':')[0] || '593968245633', qr: lastQr };
}
function getLastQr() { return lastQr; }

async function restartWhatsAppBot() {
    console.log('[WA Bot] Reinicio solicitado por administrador...');
    try { if (waSocket) waSocket.end(undefined); } catch(e) {}
    isConnected = false;
    lastQr = null;
    if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
    }
    setTimeout(startWhatsAppBot, 1000);
    return true;
}

module.exports = {
    startWhatsAppBot,
    sendMessage,
    notifyPaymentApproved,
    notifyTechnicianJobAssigned,
    notifyAppointmentReminder,
    notifyServiceCompleted,
    sendClientVerificationOtp,
    getBotStatus,
    getLastQr,
    restartWhatsAppBot
};
