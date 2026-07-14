// whatsapp/bot.js - Conexión WhatsApp via Baileys para HIDROSYS EC.
// Librería: @whiskeysockets/baileys

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    proto,
    generateWAMessageFromContent,
} = require('@whiskeysockets/baileys');

const { Boom }          = require('@hapi/boom');
const pino              = require('pino');
const qrcode            = require('qrcode-terminal');
const path              = require('path');
const { processMessage, buildConfirmationMessage, processAudioMessage } = require('./flows');

// ============================================================
// CONFIGURACIÓN
// ============================================================
const AUTH_FOLDER = path.join(__dirname, '..', '.wabaileys');
let   waSocket    = null;
let   isConnected = false;

// Logger silencioso para no ensuciar la consola
const logger = pino({ level: 'silent' });

// ============================================================
// INICIALIZAR BOT
// ============================================================
async function startWhatsAppBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version }          = await fetchLatestBaileysVersion();

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  💬 HIDROSYS – Bot de WhatsApp           ║');
    console.log('║  Iniciando conexión con Baileys...       ║');
    console.log('╚══════════════════════════════════════════╝\n');

    waSocket = makeWASocket({
        version,
        auth: {
            creds:  state.creds,
            keys:   makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: false,
        browser: ['Chrome (Linux)', 'Chrome', '110.0.0.0'], // Navegador compatible para pairing code
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
    });

    // Solicitar código de emparejamiento si se especifica en .env
    const pairingNum = process.env.WA_PAIRING_NUMBER;
    if (pairingNum && !state.creds.registered) {
        setTimeout(async () => {
            try {
                const cleanNum = pairingNum.replace(/\D/g, '');
                const code = await waSocket.requestPairingCode(cleanNum);
                console.log('\n==================================================');
                console.log(`🔑 NUEVO CÓDIGO DE VINCULACIÓN: ${code}`);
                console.log('==================================================');
                console.log('   Por favor ingrésalo en tu celular de inmediato.');
                console.log('==================================================\n');
            } catch (err) {
                console.error('❌ Error generando código de emparejamiento:', err.message);
            }
        }, 6000);
    }

    // ── Guardar credenciales cuando cambien ──────────────────
    waSocket.ev.on('creds.update', saveCreds);

    // ── Estado de conexión ───────────────────────────────────
    waSocket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Guardar el QR para poder servirlo vía HTTP
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
                const fs = require('fs');
                if (fs.existsSync(AUTH_FOLDER)) {
                    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                }
                console.log('   Reinicia el servidor para generar un nuevo QR.\n');
            } else {
                console.log(`\n🔄 [WA Bot] Desconectado (código: ${reason}). Reconectando en 5 segundos...`);
                setTimeout(startWhatsAppBot, 5000);
            }
        }

        if (connection === 'open') {
            isConnected = true;
            lastQr = null;
            const phone = waSocket.user?.id?.split(':')[0] || 'desconocido';
            console.log('\n✅ [WA Bot] ¡Conectado exitosamente!');
            console.log(`   📱 Número vinculado: +${phone}`);
            console.log('   El bot está activo y recibiendo mensajes.\n');
        }
    });

    // ── Procesar mensajes entrantes ──────────────────────────
    waSocket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            // Ignorar mensajes propios, de estado y de grupos
            if (msg.key.fromMe)          continue;
            if (msg.key.remoteJid === 'status@broadcast') continue;
            if (msg.key.remoteJid?.endsWith('@g.us')) continue;

            const jid  = msg.key.remoteJid;
            // Eliminar el sufijo de dispositivo multi-dispositivo (:1, :57, etc.) para obtener el número de teléfono limpio
            const cleanJid = jid.split(':')[0];
            const phone = cleanJid.split('@')[0].replace(/\D/g,'');

            // Extraer texto del mensaje (lista interactiva, botones o texto libre)
            const isAudio = Boolean(msg.message?.audioMessage || msg.message?.audioMessage?.url);

            let text = '';
            if (msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
                text = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
            } else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
                text = msg.message.buttonsResponseMessage.selectedButtonId;
            } else if (msg.message?.templateButtonReplyMessage?.selectedId) {
                text = msg.message.templateButtonReplyMessage.selectedId;
            } else if (msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
                try {
                    const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
                    if (params.id) text = params.id;
                } catch (e) {}
            }
            if (!text) {
                text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            }

            if (!text.trim() && !isAudio) continue;

            try {
                if (isAudio) {
                    console.log(`[WA] 🎙️ Nota de voz (audioMessage) recibida de +${phone}`);
                    try {
                        await waSocket.sendPresenceUpdate('recording', jid);
                        await new Promise(r => setTimeout(r, 900));
                        await waSocket.sendPresenceUpdate('composing', jid);
                    } catch (e) {}

                    const response = await processAudioMessage(phone, msg, jid, waSocket);
                    if (response) {
                        await new Promise(r => setTimeout(r, 600));
                        await sendMessage(jid, response);
                        console.log(`[WA] ✅ Respuesta a nota de voz enviada a +${phone}`);
                    }
                    continue;
                }

                console.log(`[WA] 📨 Mensaje de +${phone}: "${text}"`);

                // Indicador de "escribiendo"
                await waSocket.sendPresenceUpdate('composing', jid);

                // Procesar mensaje con el motor de flujos
                // Pasamos el JID completo original para que se pueda guardar en wa_sender
                const response = await processMessage(phone, text, jid);

                if (response) {
                    // Pequeña pausa para que se vea natural
                    await new Promise(r => setTimeout(r, 800));
                    await sendMessage(jid, response);
                    console.log(`[WA] ✅ Respuesta enviada a +${phone}`);
                }
            } catch (err) {
                console.error(`[WA] ❌ Error procesando mensaje de +${phone}:`, err.message);
            }
        }
    });

    return waSocket;
}

// ============================================================
// ENVIAR MENSAJE (helper público)
// ============================================================
async function sendMessage(jidOrPhone, text) {
    if (!waSocket || !isConnected) {
        console.warn('[WA Bot] No conectado. Mensaje no enviado.');
        return false;
    }

    // Normalizar JID
    let jid = jidOrPhone;
    if (!jid.includes('@')) {
        const cleanPhone = jid.split(':')[0].replace(/\D/g,'');
        // Si tiene 10 o menos dígitos (ej: 0998952546 o 998952546), asumimos Ecuador local y anteponemos 593
        // Si tiene más de 10 dígitos (ej: 593990328940 o 180959907459144), ya es un número internacional completo
        let targetPhone = cleanPhone;
        if (cleanPhone.length <= 10) {
            targetPhone = `593${cleanPhone.replace(/^0/,'')}`;
        }
        jid = `${targetPhone}@s.whatsapp.net`;
    }

    try {
        if (typeof text === 'object' && text !== null) {
            let formatted = '';
            if (text.title) formatted += `*${text.title}*\n\n`;
            if (text.text) formatted += `${text.text}\n`;
            if (text.buttons && Array.isArray(text.buttons)) {
                formatted += '\n';
                text.buttons.forEach((b, idx) => {
                    formatted += `${idx + 1}️⃣ *${b.label || b.title}*\n`;
                });
            } else if (text.sections && Array.isArray(text.sections)) {
                formatted += '\n';
                text.sections.forEach(sec => {
                    if (sec.title) formatted += `*${sec.title}:*\n`;
                    (sec.rows || []).forEach((row, i) => {
                        formatted += `${i + 1}️⃣ *${row.title}* ${row.description ? '– ' + row.description : ''}\n`;
                    });
                });
            }
            if (text.footer) formatted += `\n_${text.footer}_`;
            text = formatted.trim() || JSON.stringify(text);
        }

        await waSocket.sendMessage(jid, { text: String(text) });
        console.log(`[WA Bot] ✅ Mensaje enviado exitosamente a: ${jid}`);
        return true;
    } catch (err) {
        console.error('[WA Bot] ❌ Error enviando mensaje:', err.message);
        return false;
    }
}

// ============================================================
// NOTIFICAR CONFIRMACIÓN DE PAGO (llamado desde server.js)
// ============================================================
async function notifyPaymentApproved(aptId) {
    const payload = await buildConfirmationMessage(aptId);
    if (!payload) return false;
    let sent1 = await sendMessage(payload.phone, payload.message);
    let sent2 = false;
    if (payload.clientPhoneJid && payload.clientPhoneJid !== payload.phone) {
        sent2 = await sendMessage(payload.clientPhoneJid, payload.message);
    }
    return sent1 || sent2;
}

// ============================================================
// STATUS
// ============================================================
let lastQr = null;

function getBotStatus() {
    return {
        connected: isConnected,
        phone: waSocket?.user?.id?.split(':')[0] || '593968245633',
        qr: lastQr
    };
}

function getLastQr() {
    return lastQr;
}

async function restartWhatsAppBot() {
    console.log('[WA Bot] Reinicio solicitado por administrador...');
    try {
        if (waSocket) {
            waSocket.end(undefined);
        }
    } catch(e) {}
    isConnected = false;
    lastQr = null;
    const fs = require('fs');
    if (fs.existsSync(AUTH_FOLDER)) {
        fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
    }
    setTimeout(startWhatsAppBot, 1000);
    return true;
}

module.exports = { startWhatsAppBot, sendMessage, notifyPaymentApproved, getBotStatus, getLastQr, restartWhatsAppBot };
