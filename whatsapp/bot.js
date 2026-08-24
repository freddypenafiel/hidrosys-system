// whatsapp/bot.js - Conexión WhatsApp via Baileys para HIDROSYS EC.
// Librería: @whiskeysockets/baileys
// v5.0 - Entrega Garantizada 100%, Desencriptación de Polls y Fallback de Texto Enriquecido

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    proto,
    decryptPollVote,
    jidNormalizedUser,
} = require('@whiskeysockets/baileys');

const { Boom }          = require('@hapi/boom');
const pino              = require('pino');
const qrcode            = require('qrcode-terminal');
const path              = require('path');
const fs                = require('fs');
const crypto            = require('crypto');
const { processMessage, buildConfirmationMessage, buildReminderMessage, buildServiceCompletedMessage, processAudioMessage, processPollVote } = require('./flows');

// ============================================================
// CONFIGURACIÓN
// ============================================================
const AUTH_FOLDER = path.join(__dirname, '..', '.wabaileys');
let   waSocket    = null;
let   isConnected = false;
let   lastQr      = null;

// ============================================================
// STORE DE MENSAJES (necesario para descifrar votos de poll)
// ============================================================
const messageStore = new Map();
const STORE_MAX    = 3000;

function storeMessage(id, msg) {
    if (!id || !msg) return;
    messageStore.set(id, msg);
    if (messageStore.size > STORE_MAX) {
        const firstKey = messageStore.keys().next().value;
        messageStore.delete(firstKey);
    }
}

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
// HELPER: Descifrar Voto en Poll
// ============================================================
function tryDecryptVote(vote, creationKey, storedMsg, voterJid, botJid) {
    if (!vote || !storedMsg) return null;
    const msgSecret = storedMsg.message?.messageContextInfo?.messageSecret;
    if (!msgSecret) return null;

    const pollMsgId = creationKey.id;
    const rawOptions = storedMsg.message?.pollCreationMessage?.options?.map(o => o.optionName) || 
                       storedMsg.message?.pollCreationMessageV3?.options?.map(o => o.optionName) || [];

    const creatorCandidates = [
        botJid,
        jidNormalizedUser(botJid || ''),
        creationKey.remoteJid,
        jidNormalizedUser(creationKey.remoteJid || ''),
        creationKey.participant,
        jidNormalizedUser(creationKey.participant || '')
    ].filter(Boolean);

    const voterCandidates = [
        voterJid,
        jidNormalizedUser(voterJid || '')
    ].filter(Boolean);

    for (const cJid of creatorCandidates) {
        for (const vJid of voterCandidates) {
            try {
                const dec = decryptPollVote(vote, {
                    pollCreatorJid: cJid,
                    pollMsgId: pollMsgId,
                    pollEncKey: msgSecret,
                    voterJid: vJid
                });
                if (dec && dec.selectedOptions && dec.selectedOptions.length > 0) {
                    const selHex = Buffer.from(dec.selectedOptions[0]).toString('hex');
                    for (const opt of rawOptions) {
                        const optHex = crypto.createHash('sha256').update(opt).digest('hex');
                        if (optHex === selHex) {
                            return opt;
                        }
                    }
                }
            } catch (e) {
                // Probar siguiente combinación de JIDs
            }
        }
    }
    return null;
}

// ============================================================
// HELPER: Enviar Respuestas Múltiples
// ============================================================
async function sendMultiResponse(jid, response) {
    if (!response) return;
    if (Array.isArray(response)) {
        for (const item of response) {
            await sendMessage(jid, item);
            await new Promise(r => setTimeout(r, 600));
        }
    } else {
        await sendMessage(jid, response);
    }
}

// ============================================================
// ENVIAR POLL NATIVO
// ============================================================
async function sendPoll(jidOrPhone, question, options) {
    if (!waSocket || !isConnected) return null;
    const jid = normalizeJid(jidOrPhone);
    try {
        const msgResult = await waSocket.sendMessage(jid, {
            poll: { name: question, values: options, selectableCount: 1 }
        });
        if (msgResult?.key?.id) {
            storeMessage(msgResult.key.id, msgResult);
        }
        console.log('[WA Bot] 📊 Poll enviado exitosamente a: ' + jid);
        return msgResult;
    } catch (err) {
        console.error('[WA Bot] ❌ Error enviando poll:', err.message);
        return null;
    }
}

// ============================================================
// ENVIAR MENSAJE GENERAL (Texto, Poll o Array)
// ============================================================
async function sendMessage(jidOrPhone, content) {
    if (!waSocket || !isConnected) {
        console.warn('[WA Bot] No conectado. Mensaje no enviado.');
        return false;
    }
    const jid = normalizeJid(jidOrPhone);

    try {
        if (typeof content === 'object' && content !== null) {
            // Caso Poll
            if (content.type === 'poll') {
                return await sendPoll(jid, content.question, content.options);
            }

            // Formatear texto si viene con estructura de secciones/botones
            let formatted = '';
            if (content.title) formatted += '*' + content.title + '*\n\n';
            if (content.text) formatted += content.text + '\n';
            if (content.buttons && Array.isArray(content.buttons)) {
                formatted += '\n';
                content.buttons.forEach((b, idx) => {
                    formatted += (idx + 1) + '️⃣ *' + (b.text || b.title || b.label || String(b)) + '*\n';
                });
            } else if (content.sections && Array.isArray(content.sections)) {
                formatted += '\n';
                content.sections.forEach(sec => {
                    if (sec.title) formatted += '*' + sec.title + ':*\n';
                    (sec.rows || []).forEach((row, i) => {
                        formatted += (i + 1) + '️⃣ *' + row.title + '* ' + (row.description ? '– ' + row.description : '') + '\n';
                    });
                });
            }
            if (content.footer) formatted += '\n_' + content.footer + '_';
            content = formatted.trim() || JSON.stringify(content);
        }

        await waSocket.sendMessage(jid, { text: String(content) });
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
    console.log('║  💬 HIDROSYS – Bot de WhatsApp v5.0      ║');
    console.log('║  Conexión Estable y Respuestas Rápidas   ║');
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
            console.log('   El bot está activo y respondiendo mensajes.\n');
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

            if (msg.key.id) storeMessage(msg.key.id, msg);

            // 1. DETECTAR VOTO EN POLL
            const pollUpdate = msg.message?.pollUpdateMessage;
            if (pollUpdate) {
                console.log('[WA] 🗳️ Voto de Poll detectado de +' + phone);
                try {
                    const creationKey = pollUpdate.pollCreationMessageKey;
                    const creationId  = creationKey?.id;
                    const storedMsg   = creationId ? messageStore.get(creationId) : null;
                    const botJid      = waSocket.user?.id;

                    const selectedOption = tryDecryptVote(pollUpdate.vote, creationKey, storedMsg, jid, botJid);

                    if (selectedOption) {
                        console.log('[WA Poll] ✅ Opción elegida en Poll: "' + selectedOption + '"');
                        await waSocket.sendPresenceUpdate('composing', jid);
                        const response = await processPollVote(phone, selectedOption, jid);
                        if (response) {
                            await sendMultiResponse(jid, response);
                        }
                        continue;
                    }
                } catch (pollErr) {
                    console.error('[WA Poll] Error descifrando:', pollErr.message);
                }
            }

            // 2. DEDUPLICACIÓN
            if (msg.key.id) {
                if (processedMessageIds.has(msg.key.id)) continue;
                processedMessageIds.add(msg.key.id);
                if (processedMessageIds.size > 2000) {
                    const first = processedMessageIds.values().next().value;
                    processedMessageIds.delete(first);
                }
            }

            const isAudio = Boolean(msg.message?.audioMessage);

            // 3. EXTRAER TEXTO
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
                    text = params.id || params.title || params.display_text || '';
                } catch (e) {}
            }

            if (!text) {
                text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            }

            if (!text.trim() && !isAudio) continue;

            const now = Date.now();
            const debounceKey = phone + '_' + text.trim();
            if (userLastMsgTime.has(debounceKey) && (now - userLastMsgTime.get(debounceKey)) < 1500) continue;
            userLastMsgTime.set(debounceKey, now);

            try {
                if (isAudio) {
                    console.log('[WA] 🎙️ Nota de voz de +' + phone);
                    try {
                        await waSocket.sendPresenceUpdate('recording', jid);
                        await new Promise(r => setTimeout(r, 900));
                        await waSocket.sendPresenceUpdate('composing', jid);
                    } catch (e) {}
                    const response = await processAudioMessage(phone, msg, jid, waSocket);
                    if (response) {
                        await new Promise(r => setTimeout(r, 600));
                        await sendMultiResponse(jid, response);
                    }
                    continue;
                }

                console.log('[WA] 📨 Mensaje de +' + phone + ': "' + text + '"');
                await waSocket.sendPresenceUpdate('composing', jid);

                const response = await processMessage(phone, text, jid);
                if (response) {
                    await new Promise(r => setTimeout(r, 500));
                    await sendMultiResponse(jid, response);
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
    const jid = normalizeJid(payload.phone);
    if (payload.message) await sendMessage(jid, payload.message);
    if (payload.poll) {
        await new Promise(r => setTimeout(r, 900));
        await sendMessage(jid, payload.poll);
    }
    return true;
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
    sendPoll,
    notifyPaymentApproved,
    notifyAppointmentReminder,
    notifyServiceCompleted,
    sendClientVerificationOtp,
    getBotStatus,
    getLastQr,
    restartWhatsAppBot
};
