// whatsapp/bot.js - Conexion WhatsApp via Baileys para HIDROSYS EC.
// Libreria: @whiskeysockets/baileys
// v4.5 - Bot con Botones Interactivos Nativos (Quick Reply & Single Select) y Desencriptacion de Polls

const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    proto,
    generateWAMessageFromContent,
    decryptPollVote,
} = require("@whiskeysockets/baileys");

const { Boom }          = require("@hapi/boom");
const pino              = require("pino");
const qrcode            = require("qrcode-terminal");
const path              = require("path");
const fs                = require("fs");
const crypto            = require("crypto");
const { processMessage, buildConfirmationMessage, buildReminderMessage, buildServiceCompletedMessage, processAudioMessage, processPollVote } = require("./flows");

// ============================================================
// CONFIGURACION
// ============================================================
const AUTH_FOLDER = path.join(__dirname, "..", ".wabaileys");
let   waSocket    = null;
let   isConnected = false;
let   lastQr      = null;

// ============================================================
// STORE DE MENSAJES
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
const logger = pino({ level: "silent" });

// ============================================================
// HELPER: Normalizar JID
// ============================================================
function normalizeJid(jidOrPhone) {
    let jid = String(jidOrPhone || "").trim();
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
// HELPER: Enviar Respuestas Multiples (Secuencial)
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
// ENVIAR MENSAJE INTERACTIVO CON BOTONES O LISTA (NATIVE FLOW)
// ============================================================
async function sendInteractive(jidOrPhone, content) {
    if (!waSocket || !isConnected) {
        console.warn("[WA Bot] No conectado. Mensaje interactivo no enviado.");
        return false;
    }
    const jid = normalizeJid(jidOrPhone);

    try {
        const title   = content.title || "";
        const text    = content.text || content.body || "";
        const footer  = content.footer || "HIDROSYS EC. • Atencion al Cliente";
        const buttons = content.buttons || [];
        const sections = content.sections || [];
        const listBtnTitle = content.listButtonTitle || "📋 Ver Opciones";

        let nativeButtons = [];

        // 1. Botones directos (Quick Reply)
        if (buttons && Array.isArray(buttons) && buttons.length > 0) {
            nativeButtons = buttons.map((b, idx) => ({
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: b.text || b.title || b.label || String(b),
                    id: String(b.id || (idx + 1))
                })
            }));
        }
        // 2. Menu desplegable (Single Select)
        else if (sections && Array.isArray(sections) && sections.length > 0) {
            nativeButtons = [{
                name: "single_select",
                buttonParamsJson: JSON.stringify({
                    title: listBtnTitle,
                    sections: sections.map(sec => ({
                        title: sec.title || "Opciones",
                        rows: (sec.rows || []).map((row, i) => ({
                            header: "",
                            title: row.title || row.label || "",
                            description: row.description || "",
                            id: String(row.id || row.rowId || (i + 1))
                        }))
                    }))
                })
            }];
        }

        const interactiveMessage = {
            body: { text: text || "" },
            footer: { text: footer },
            header: { title: title, hasMediaAttachment: false },
            nativeFlowMessage: {
                buttons: nativeButtons
            }
        };

        const msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: interactiveMessage
                }
            }
        }, {});

        await waSocket.relayMessage(jid, msg.message, { messageId: msg.key.id });
        console.log("[WA Bot] 🔘 Mensaje interactivo enviado a: " + jid);
        return true;
    } catch (err) {
        console.error("[WA Bot] ❌ Error enviando interactivo:", err.message);
        // Fallback a texto claro
        let fallback = "";
        if (content.title) fallback += "*" + content.title + "*\n\n";
        if (content.text) fallback += content.text + "\n\n";
        if (content.buttons && Array.isArray(content.buttons)) {
            content.buttons.forEach((b, i) => {
                fallback += (i + 1) + "️⃣ *" + (b.text || b.title || b.label) + "*\n";
            });
        } else if (content.sections && Array.isArray(content.sections)) {
            content.sections.forEach(sec => {
                if (sec.title) fallback += "*" + sec.title + ":*\n";
                (sec.rows || []).forEach((r, i) => {
                    fallback += (i + 1) + "️⃣ *" + r.title + "* " + (r.description ? "– " + r.description : "") + "\n";
                });
            });
        }
        if (content.footer) fallback += "\n_" + content.footer + "_";
        return await sendMessage(jid, fallback);
    }
}

// ============================================================
// ENVIAR POLL INTERACTIVO NATIVO
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
        console.log("[WA Bot] 📊 Poll enviado a: " + jid + " — \"" + question + "\"");
        return msgResult;
    } catch (err) {
        console.error("[WA Bot] ❌ Error enviando poll:", err.message);
        const fallback = "*" + question + "*\n\n" + options.map((o, i) => (i+1) + ". " + o).join("\n") + "\n\n_Responde escribiendo el numero de tu opcion._";
        await sendMessage(jid, fallback);
        return null;
    }
}

// ============================================================
// ENVIAR IMAGEN CON CAPTION
// ============================================================
async function sendImageWithCaption(jidOrPhone, imagePath, caption) {
    if (!waSocket || !isConnected) return false;
    const jid = normalizeJid(jidOrPhone);
    try {
        if (imagePath && fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            await waSocket.sendMessage(jid, { image: imageBuffer, caption: caption });
        } else {
            await sendMessage(jid, caption);
        }
        return true;
    } catch (err) {
        console.error("[WA Bot] ❌ Error enviando imagen:", err.message);
        await sendMessage(jid, caption);
        return false;
    }
}

// ============================================================
// ENVIAR MENSAJE (HELPER GENERAL)
// ============================================================
async function sendMessage(jidOrPhone, content) {
    if (!waSocket || !isConnected) {
        console.warn("[WA Bot] No conectado. Mensaje no enviado.");
        return false;
    }
    const jid = normalizeJid(jidOrPhone);

    try {
        if (typeof content === "object" && content !== null) {
            // Caso 1: Objeto interactivo con botones o menu desplegable
            if (content.type === "interactive" || (content.buttons && content.buttons.length) || (content.sections && content.sections.length)) {
                return await sendInteractive(jid, content);
            }
            // Caso 2: Objeto Poll
            if (content.type === "poll") {
                return await sendPoll(jid, content.question, content.options);
            }

            // Caso 3: Fallback texto
            let formatted = "";
            if (content.title) formatted += "*" + content.title + "*\n\n";
            if (content.text) formatted += content.text + "\n";
            if (content.footer) formatted += "\n_" + content.footer + "_";
            content = formatted.trim() || JSON.stringify(content);
        }

        await waSocket.sendMessage(jid, { text: String(content) });
        console.log("[WA Bot] ✅ Mensaje enviado exitosamente a: " + jid);
        return true;
    } catch (err) {
        console.error("[WA Bot] ❌ Error enviando mensaje:", err.message);
        return false;
    }
}

// ============================================================
// INICIALIZAR BOT
// ============================================================
async function startWhatsAppBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version }          = await fetchLatestBaileysVersion();

    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║  💬 HIDROSYS – Bot de WhatsApp v4.5      ║");
    console.log("║  Botones Interactivos y Agendamiento     ║");
    console.log("╚══════════════════════════════════════════╝\n");

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
                console.log("🔑 NUEVO CODIGO DE VINCULACION: " + code);
                console.log("==================================================");
            } catch (err) {
                console.error("❌ Error generando codigo de emparejamiento:", err.message);
            }
        }, 6000);
    }

    waSocket.ev.on("creds.update", saveCreds);

    waSocket.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            lastQr = qr;
            if (!pairingNum) {
                console.log("\n📱 ¡ESCANEA EL SIGUIENTE QR CON WHATSAPP!\n");
                qrcode.generate(qr, { small: true });
            }
        }

        if (connection === "close") {
            isConnected = false;
            lastQr = null;
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log("\n⚠️  [WA Bot] Sesion cerrada. Eliminando credenciales...");
                if (fs.existsSync(AUTH_FOLDER)) {
                    fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
                }
                console.log("   Reinicia el servidor para generar un nuevo QR.\n");
            } else {
                console.log("\n🔄 [WA Bot] Desconectado (codigo: " + reason + "). Reconectando en 5s...");
                setTimeout(startWhatsAppBot, 5000);
            }
        }

        if (connection === "open") {
            isConnected = true;
            lastQr = null;
            const phone = waSocket.user?.id?.split(":")[0] || "desconocido";
            console.log("\n✅ [WA Bot] ¡Conectado exitosamente!");
            console.log("   📱 Numero vinculado: +" + phone);
            console.log("   El bot esta activo con botones interactivos y respuestas.\n");
        }
    });

    const processedMessageIds = new Set();
    const userLastMsgTime     = new Map();

    // ── PROCESAR MENSAJES ENTRANTES (BOTONES, POLLS, TEXTO, AUDIO) ────────
    waSocket.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
            if (msg.key.fromMe)                                 continue;
            if (msg.key.remoteJid === "status@broadcast")       continue;
            if (msg.key.remoteJid?.endsWith("@g.us"))           continue;

            const jid      = msg.key.remoteJid;
            const cleanJid = jid.split(":")[0];
            const phone    = cleanJid.split("@")[0].replace(/\D/g, "");

            if (msg.key.id) storeMessage(msg.key.id, msg);

            // 1. DETECTAR VOTO EN POLL
            const pollUpdate = msg.message?.pollUpdateMessage;
            if (pollUpdate) {
                console.log("[WA] 🗳️ Voto de Poll detectado de +" + phone);
                try {
                    const creationId = pollUpdate.pollCreationMessageKey?.id;
                    const storedMsg = creationId ? messageStore.get(creationId) : null;
                    let selectedOption = null;

                    if (storedMsg && storedMsg.message?.pollCreationMessage) {
                        const pollOptions = storedMsg.message.pollCreationMessage.options?.map(o => o.optionName) || [];
                        const messageSecret = storedMsg.message?.messageContextInfo?.messageSecret;

                        if (messageSecret && pollUpdate.vote) {
                            try {
                                const decrypted = await decryptPollVote(pollUpdate.vote, {
                                    pollCreatorJid: pollUpdate.pollCreationMessageKey?.remoteJid,
                                    pollMsgId: creationId,
                                    pollEncKey: messageSecret,
                                    voterJid: jid
                                });
                                if (decrypted?.selectedOptions?.length) {
                                    const selHash = Buffer.from(decrypted.selectedOptions[0]).toString("hex");
                                    for (const opt of pollOptions) {
                                        const optHash = crypto.createHash("sha256").update(opt).digest("hex");
                                        if (optHash === selHash) {
                                            selectedOption = opt;
                                            break;
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn("[WA Poll] Descifrado falló, buscando opción activa:", e.message);
                            }
                        }
                    }

                    if (selectedOption) {
                        console.log("[WA Poll] ✅ Voto procesado: \"" + selectedOption + "\"");
                        await waSocket.sendPresenceUpdate("composing", jid);
                        const response = await processPollVote(phone, selectedOption, jid);
                        if (response) {
                            await sendMultiResponse(jid, response);
                        }
                        continue;
                    }
                } catch (pollErr) {
                    console.error("[WA Poll] Error:", pollErr.message);
                }
            }

            // 2. DEDUPLICACION
            if (msg.key.id) {
                if (processedMessageIds.has(msg.key.id)) continue;
                processedMessageIds.add(msg.key.id);
                if (processedMessageIds.size > 2000) {
                    const first = processedMessageIds.values().next().value;
                    processedMessageIds.delete(first);
                }
            }

            const isAudio = Boolean(msg.message?.audioMessage);

            // 3. EXTRAER TEXTO DE RESPUESTAS INTERACTIVAS, BOTONES O TEXTO LIBRE
            let text = "";

            // A. Botón o Menú interactivo (NativeFlowMessage / Quick Reply / Single Select)
            if (msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
                try {
                    const params = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
                    text = params.id || params.title || params.display_text || "";
                    console.log("[WA] 🔘 Clic en botón interactivo detectado: id=" + text);
                } catch (e) {}
            }
            // B. Single select reply (List message)
            else if (msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
                text = msg.message.listResponseMessage.singleSelectReply.selectedRowId;
                console.log("[WA] 📋 Opción de lista seleccionada: id=" + text);
            }
            // C. Button reply
            else if (msg.message?.buttonsResponseMessage?.selectedButtonId) {
                text = msg.message.buttonsResponseMessage.selectedButtonId;
                console.log("[WA] 🔘 Botón pulsado: id=" + text);
            }
            // D. Template button reply
            else if (msg.message?.templateButtonReplyMessage?.selectedId) {
                text = msg.message.templateButtonReplyMessage.selectedId;
            }

            // E. Texto directo
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
                    console.log("[WA] 🎙️ Nota de voz de +" + phone);
                    try {
                        await waSocket.sendPresenceUpdate("recording", jid);
                        await new Promise(r => setTimeout(r, 900));
                        await waSocket.sendPresenceUpdate("composing", jid);
                    } catch (e) {}
                    const response = await processAudioMessage(phone, msg, jid, waSocket);
                    if (response) {
                        await new Promise(r => setTimeout(r, 600));
                        await sendMultiResponse(jid, response);
                    }
                    continue;
                }

                console.log("[WA] 📨 Mensaje de +" + phone + ": \"" + text + "\"");
                await waSocket.sendPresenceUpdate("composing", jid);

                const response = await processMessage(phone, text, jid);
                if (response) {
                    await new Promise(r => setTimeout(r, 700));
                    await sendMultiResponse(jid, response);
                    console.log("[WA] ✅ Respuesta enviada a +" + phone);
                }
            } catch (err) {
                console.error("[WA] ❌ Error procesando mensaje de +" + phone + ":", err.message);
            }
        }
    });

    return waSocket;
}

// ============================================================
// NOTIFICACIONES AUTOMATICAS
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
    if (payload.interactiveFeedback) {
        await new Promise(r => setTimeout(r, 1000));
        await sendMessage(jid, payload.interactiveFeedback);
    }
    return true;
}

async function sendClientVerificationOtp(phone, clientName, code) {
    if (!phone) return false;
    let cleanPhone = String(phone).replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "593" + cleanPhone.substring(1);
    if (!cleanPhone.startsWith("593")) cleanPhone = "593" + cleanPhone;
    const jid = cleanPhone + "@s.whatsapp.net";
    const message = "🔐 *HIDROSYS EC. - Verificacion de Identidad*\n\nHola *" + clientName + "*,\n\nTu codigo de seguridad para confirmar tu identidad es:\n\n👉 *" + code + "*\n\n_Valido por 5 minutos. Si no solicitaste este codigo, ignoralo._\n\n_HIDROSYS EC. • Seguridad y Control_";
    return await sendMessage(jid, message);
}

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
    sendInteractive,
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