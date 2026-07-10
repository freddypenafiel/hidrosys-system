// whatsapp/bot.js - Conexión WhatsApp via Baileys para HIDROSYS EC.
// Librería: @whiskeysockets/baileys

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
} = require('@whiskeysockets/baileys');

const { Boom }          = require('@hapi/boom');
const pino              = require('pino');
const qrcode            = require('qrcode-terminal');
const path              = require('path');
const { processMessage, buildConfirmationMessage } = require('./flows');

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
            const phone = jid.split('@')[0].replace(/\D/g,'');

            // Extraer texto del mensaje
            let text = msg.message?.conversation
                || msg.message?.extendedTextMessage?.text
                || msg.message?.buttonsResponseMessage?.selectedButtonId
                || msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId
                || '';

            if (!text.trim()) continue;

            console.log(`[WA] 📨 Mensaje de +${phone}: "${text}"`);

            try {
                // Indicador de "escribiendo"
                await waSocket.sendPresenceUpdate('composing', jid);

                // Procesar mensaje con el motor de flujos
                const response = await processMessage(phone, text);

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
        // Es un número de teléfono → convertir a JID de Ecuador
        const cleaned = jid.replace(/\D/g,'');
        const withCountry = cleaned.startsWith('593') ? cleaned : `593${cleaned.replace(/^0/,'')}`;
        jid = `${withCountry}@s.whatsapp.net`;
    }

    try {
        await waSocket.sendMessage(jid, { text });
        return true;
    } catch (err) {
        console.error('[WA Bot] Error enviando mensaje:', err.message);
        return false;
    }
}

// ============================================================
// NOTIFICAR CONFIRMACIÓN DE PAGO (llamado desde server.js)
// ============================================================
async function notifyPaymentApproved(aptId) {
    const payload = await buildConfirmationMessage(aptId);
    if (!payload) return false;
    return sendMessage(payload.phone, payload.message);
}

// ============================================================
// STATUS
// ============================================================
let lastQr = null;

function getBotStatus() {
    return {
        connected: isConnected,
        phone: waSocket?.user?.id?.split(':')[0] || null,
    };
}

function getLastQr() {
    return lastQr;
}

module.exports = { startWhatsAppBot, sendMessage, notifyPaymentApproved, getBotStatus, getLastQr };
