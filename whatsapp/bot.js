// whatsapp/bot.js - Conexión WhatsApp via Baileys para HIDROSYS EC.
// Librería: @whiskeysockets/baileys
// v5.1 - Motor Ultra-Rápido, Robusto y Confiable 100%

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
// ENVIAR MENSAJE (helper público)
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
    console.log('║  💬 HIDROSYS – Bot de WhatsApp v5.1      ║');
    console.log('║  Respuestas Inmediatas y Flujo Eficiente ║');
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
// NOTIFICACIONES AUTOMÁTICAS
// ============================================================
async function notifyPaymentApproved(aptId) {
    const payload = await buildConfirmationMessage(aptId);
    if (!payload) return false;
    let sent1 = await sendMessage(payload.phone, payload.message);
    const digits1 = (payload.phone || '').replace(/\D/g, '');
    const digits2 = (payload.clientPhoneJid || '').replace(/\D/g, '');
    let sent2 = false;
    if (payload.clientPhoneJid && digits2 && digits2 !== digits1) {
        sent2 = await sendMessage(payload.clientPhoneJid, payload.message);
    }
    return sent1 || sent2;
}

async function notifyAppointmentReminder(aptId) {
    const payload = await buildReminderMessage(aptId);
    if (!payload || !payload.phone) return false;
    return await sendMessage(payload.phone, payload.message);
}

async function notifyServiceCompleted(aptId) {
    const payload = await buildServiceCompletedMessage(aptId);
    if (!payload || !payload.phone) return false;
    return await sendMessage(payload.phone, payload.message);
}

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
    notifyAppointmentReminder,
    notifyServiceCompleted,
    sendClientVerificationOtp,
    getBotStatus,
    getLastQr,
    restartWhatsAppBot
};
