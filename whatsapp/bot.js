// whatsapp/bot.js - Conexion WhatsApp via Baileys para HIDROSYS EC.
// Libreria: @whiskeysockets/baileys
// v4.0 - Bot Empresarial con Polls Interactivos Nativos

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    proto,
    generateWAMessageFromContent,
    getAggregateVotesInPollMessage,
} = require("@whiskeysockets/baileys");

const { Boom }          = require("@hapi/boom");
const pino              = require("pino");
const qrcode            = require("qrcode-terminal");
const path              = require("path");
const fs                = require("fs");
const { processMessage, buildConfirmationMessage, buildReminderMessage, buildServiceCompletedMessage, processAudioMessage, processPollVote } = require("./flows");

// ============================================================
// CONFIGURACION
// ============================================================
const AUTH_FOLDER = path.join(__dirname, "..", ".wabaileys");
let   waSocket    = null;
let   isConnected = false;
let   lastQr      = null;

// ============================================================
// STORE DE MENSAJES (necesario para descifrar votos de poll)
// ============================================================
const messageStore = new Map();
const STORE_MAX    = 3000;

function storeMessage(id, msg) {
    messageStore.set(id, msg);
    if (messageStore.size > STORE_MAX) {
        const firstKey = messageStore.keys().next().value;
        messageStore.delete(firstKey);
    }
}

// ============================================================
// LOGGER SILENCIOSO
// ============================================================
const logger = pino({ level: "silent" });

// ============================================================
// HELPER: Normalizar JID
// ============================================================
function normalizeJid(jidOrPhone) {
    let jid = jidOrPhone;
    if (!jid.includes("@")) {
        const cleanPhone = jid.split(":")[0].replace(/\D/g, "");
        let targetPhone = cleanPhone;
        if (cleanPhone.length <= 10) {
            targetPhone = "593" + cleanPhone.replace(/^0/, "");
        }
        jid = targetPhone + "@s.whatsapp.net";
    }
    return jid;
}

// ============================================================
// INICIALIZAR BOT
// ============================================================
async function startWhatsAppBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version }          = await fetchLatestBaileysVersion();

    console.log("\n+------------------------------------------+");
    console.log("�  ?? HIDROSYS � Bot de WhatsApp v4.0      �");
    console.log("�  Iniciando conexion con Baileys...       �");
    console.log("+------------------------------------------+\n");

    waSocket = makeWASocket({
        version,
        auth: {
            creds:  state.creds,
            keys:   makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: false,
        browser: ["Chrome (Linux)", "Chrome", "110.0.0.0"],
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
    });

    const pairingNum = process.env.WA_PAIRING_NUMBER;
    if (pairingNum && !state.creds.registered) {
        setTimeout(async () => {
            try {
                const cleanNum = pairingNum.replace(/\D/g, "");
                const code = await waSocket.requestPairingCode(cleanNum);
                console.log("\n==================================================");
                console.log("?? NUEVO CODIGO DE VINCULACION: " + code);
                console.log("==================================================");
            } catch (err) {
                console.error("? Error generando codigo de emparejamiento:", err.message);
            }
        }, 6000);
    }

    waSocket.ev.on("creds.update", saveCreds);

    waSocket.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            lastQr = qr;
            if (!pairingNum) {
                console.log("\n?? �ESCANEA EL SIGUIENTE QR CON WHATSAPP!\n");
                qrcode.generate(qr, { small: true });
            }
        }

        if (connection === "close") {
            isConnected = false;
            lastQr = null;
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log("\n??  [WA Bot] Sesion cerrada. Eliminando credenciales...");
                if (fs.existsSync(AUTH_FOLDER)) {
                    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                }
                console.log("   Reinicia el servidor para generar un nuevo QR.\n");
            } else {
                console.log("\n?? [WA Bot] Desconectado (codigo: " + reason + "). Reconectando en 5s...");
                setTimeout(startWhatsAppBot, 5000);
            }
        }

        if (connection === "open") {
            isConnected = true;
            lastQr = null;
            const phone = waSocket.user?.id?.split(":")[0] || "desconocido";
            console.log("\n? [WA Bot] �Conectado exitosamente!");
            console.log("   ?? Numero vinculado: +" + phone);
            console.log("   El bot esta activo y recibiendo mensajes.\n");
        }
    });

    const processedMessageIds = new Set();
    const userLastMsgTime     = new Map();

    // -- Mensajes de texto/audio entrantes --------------------
    waSocket.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
            if (msg.key.fromMe)                                 continue;
            if (msg.key.remoteJid === "status@broadcast")       continue;
            if (msg.key.remoteJid?.endsWith("@g.us"))           continue;

            if (msg.key.id) storeMessage(msg.key.id, msg);

            if (msg.key.id) {
                if (processedMessageIds.has(msg.key.id)) continue;
                processedMessageIds.add(msg.key.id);
                if (processedMessageIds.size > 2000) {
                    const first = processedMessageIds.values().next().value;
                    processedMessageIds.delete(first);
                }
            }

            const jid      = msg.key.remoteJid;
            const cleanJid = jid.split(":")[0];
            const phone    = cleanJid.split("@")[0].replace(/\D/g, "");
            const isAudio  = Boolean(msg.message?.audioMessage);

            let text = "";
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
                text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
            }

            if (!text.trim() && !isAudio) continue;

            const now = Date.now();
            const debounceKey = phone + "_" + text.trim();
            if (userLastMsgTime.has(debounceKey) && (now - userLastMsgTime.get(debounceKey)) < 1500) continue;
            userLastMsgTime.set(debounceKey, now);

            try {
                if (isAudio) {
                    console.log("[WA] ??? Nota de voz recibida de +" + phone);
                    try {
                        await waSocket.sendPresenceUpdate("recording", jid);
                        await new Promise(r => setTimeout(r, 900));
                        await waSocket.sendPresenceUpdate("composing", jid);
                    } catch (e) {}
                    const response = await processAudioMessage(phone, msg, jid, waSocket);
                    if (response) {
                        await new Promise(r => setTimeout(r, 600));
                        await sendMessage(jid, response);
                    }
                    continue;
                }

                console.log("[WA] ?? Mensaje de +" + phone + ": \"" + text + "\"");
                await waSocket.sendPresenceUpdate("composing", jid);

                const response = await processMessage(phone, text, jid);
                if (response) {
                    await new Promise(r => setTimeout(r, 700));
                    await sendMessage(jid, response);
                    console.log("[WA] ? Respuesta enviada a +" + phone);
                }
            } catch (err) {
                console.error("[WA] ? Error procesando mensaje de +" + phone + ":", err.message);
            }
        }
    });

    // -- Votos de Poll (messages.update) ----------------------
    waSocket.ev.on("messages.update", async (updates) => {
        for (const update of updates) {
            if (!update.update?.pollUpdates) continue;

            const pollMsgId = update.key?.id;
            const voterJid  = update.key?.remoteJid;
            if (!pollMsgId || !voterJid) continue;

            const originalPollMsg = messageStore.get(pollMsgId);
            if (!originalPollMsg) {
                console.log("[WA Poll] No se encontro el mensaje de poll original (id: " + pollMsgId + ")");
                continue;
            }

            try {
                const pollVotes = getAggregateVotesInPollMessage({
                    message: originalPollMsg.message,
                    pollUpdates: update.update.pollUpdates,
                });

                const selected = pollVotes?.find(v => v.voters && v.voters.length > 0);
                if (!selected) continue;

                const selectedOption = selected.name;
                const phone = voterJid.split(":")[0].split("@")[0].replace(/\D/g, "");

                console.log("[WA Poll] ??? +" + phone + " voto: \"" + selectedOption + "\"");
                await waSocket.sendPresenceUpdate("composing", voterJid);

                const response = await processPollVote(phone, selectedOption, voterJid);
                if (response) {
                    await new Promise(r => setTimeout(r, 700));
                    await sendMessage(voterJid, response);
                    console.log("[WA Poll] ? Respuesta a voto enviada a +" + phone);
                }
            } catch (err) {
                console.error("[WA Poll] ? Error procesando voto de poll:", err.message);
            }
        }
    });

    return waSocket;
}

// ============================================================
// ENVIAR POLL INTERACTIVO NATIVO
// ============================================================
async function sendPoll(jid, question, options) {
    if (!waSocket || !isConnected) {
        console.warn("[WA Bot] No conectado. Poll no enviado.");
        return null;
    }
    jid = normalizeJid(jid);
    try {
        const msgResult = await waSocket.sendMessage(jid, {
            poll: { name: question, values: options, selectableCount: 1 }
        });
        if (msgResult?.key?.id) storeMessage(msgResult.key.id, msgResult);
        console.log("[WA Bot] ?? Poll enviado a: " + jid + " � \"" + question + "\"");
        return msgResult;
    } catch (err) {
        console.error("[WA Bot] ? Error enviando poll:", err.message);
        const fallback = "*" + question + "*\n\n" + options.map((o, i) => (i+1) + ". " + o).join("\n") + "\n\n_Responde escribiendo el numero de tu opcion._";
        await sendMessage(jid, fallback);
        return null;
    }
}

// ============================================================
// ENVIAR IMAGEN CON CAPTION (Bienvenida corporativa)
// ============================================================
async function sendImageWithCaption(jid, imagePath, caption) {
    if (!waSocket || !isConnected) return false;
    jid = normalizeJid(jid);
    try {
        if (imagePath && fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            await waSocket.sendMessage(jid, { image: imageBuffer, caption: caption });
        } else {
            await sendMessage(jid, caption);
        }
        return true;
    } catch (err) {
        console.error("[WA Bot] ? Error enviando imagen:", err.message);
        await sendMessage(jid, caption);
        return false;
    }
}

// ============================================================
// ENVIAR MENSAJE (helper publico)
// ============================================================
async function sendMessage(jidOrPhone, content) {
    if (!waSocket || !isConnected) {
        console.warn("[WA Bot] No conectado. Mensaje no enviado.");
        return false;
    }
    const jid = normalizeJid(jidOrPhone);
    try {
        if (typeof content === "object" && content !== null && content.type === "poll") {
            return await sendPoll(jid, content.question, content.options);
        }
        let text = content;
        if (typeof text === "object" && text !== null) {
            let formatted = "";
            if (text.title) formatted += "*" + text.title + "*\n\n";
            if (text.text) formatted += text.text + "\n";
            if (text.sections && Array.isArray(text.sections)) {
                formatted += "\n";
                text.sections.forEach(sec => {
                    if (sec.title) formatted += "*" + sec.title + ":*\n";
                    (sec.rows || []).forEach((row, i) => {
                        formatted += (i + 1) + "?? *" + row.title + "* " + (row.description ? "� " + row.description : "") + "\n";
                    });
                });
            }
            if (text.footer) formatted += "\n_" + text.footer + "_";
            text = formatted.trim() || JSON.stringify(text);
        }
        await waSocket.sendMessage(jid, { text: String(text) });
        console.log("[WA Bot] ? Mensaje enviado exitosamente a: " + jid);
        return true;
    } catch (err) {
        console.error("[WA Bot] ? Error enviando mensaje:", err.message);
        return false;
    }
}

// ============================================================
// NOTIFICAR CONFIRMACION DE PAGO
// ============================================================
async function notifyPaymentApproved(aptId) {
    const payload = await buildConfirmationMessage(aptId);
    if (!payload) return false;
    let sent1 = await sendMessage(payload.phone, payload.message);
    const digits1 = (payload.phone || "").replace(/\D/g, "");
    const digits2 = (payload.clientPhoneJid || "").replace(/\D/g, "");
    let sent2 = false;
    if (payload.clientPhoneJid && digits2 && digits2 !== digits1) {
        sent2 = await sendMessage(payload.clientPhoneJid, payload.message);
    }
    return sent1 || sent2;
}

// ============================================================
// NOTIFICAR RECORDATORIO AUTOMATICO DE CITA
// ============================================================
async function notifyAppointmentReminder(aptId) {
    const payload = await buildReminderMessage(aptId);
    if (!payload || !payload.phone) return false;
    return await sendMessage(payload.phone, payload.message);
}

// ============================================================
// NOTIFICAR SERVICIO COMPLETADO / ENCUESTA CSAT
// ============================================================
async function notifyServiceCompleted(aptId) {
    const payload = await buildServiceCompletedMessage(aptId);
    if (!payload || !payload.phone) return false;
    const jid = normalizeJid(payload.phone);
    await sendMessage(jid, payload.message);
    if (payload.pollQuestion && payload.pollOptions) {
        await new Promise(r => setTimeout(r, 1200));
        await sendPoll(jid, payload.pollQuestion, payload.pollOptions);
    }
    return true;
}

// ============================================================
// ENVIAR CODIGO OTP DE VERIFICACION DE IDENTIDAD
// ============================================================
async function sendClientVerificationOtp(phone, clientName, code) {
    if (!phone) return false;
    let cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "593" + cleanPhone.substring(1);
    if (!cleanPhone.startsWith("593")) cleanPhone = "593" + cleanPhone;
    const jid = cleanPhone + "@s.whatsapp.net";
    const message = "?? *HIDROSYS EC. - Verificacion de Identidad*\n\nHola *" + clientName + "*,\n\nTu codigo de seguridad para confirmar tu identidad es:\n\n?? *" + code + "*\n\n_Valido por 5 minutos. Si no solicitaste este codigo, ignoralo._\n\n_HIDROSYS EC. � Seguridad y Control_";
    return await sendMessage(jid, message);
}

// ============================================================
// STATUS
// ============================================================
function getBotStatus() {
    return { connected: isConnected, phone: waSocket?.user?.id?.split(":")[0] || "593968245633", qr: lastQr };
}
function getLastQr() { return lastQr; }

async function restartWhatsAppBot() {
    console.log("[WA Bot] Reinicio solicitado por administrador...");
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
    sendImageWithCaption,
    notifyPaymentApproved,
    notifyAppointmentReminder,
    notifyServiceCompleted,
    sendClientVerificationOtp,
    getBotStatus,
    getLastQr,
    restartWhatsAppBot
};
