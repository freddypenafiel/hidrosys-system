// whatsapp/get-pairing.js - Script independiente para generar código de vinculación de WhatsApp

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const path = require('path');
const pino = require('pino');

const AUTH_FOLDER = path.join(__dirname, '..', '.wabaileys');

async function run() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version }          = await fetchLatestBaileysVersion();
    const logger = pino({ level: 'silent' });

    console.log('⏳ Solicitando código de emparejamiento para +593968245633...');

    const waSocket = makeWASocket({
        version,
        auth: state,
        logger,
        browser: ['Chrome (Linux)', 'Chrome', '110.0.0.0'],
    });

    waSocket.ev.on('creds.update', saveCreds);

    waSocket.ev.on('connection.update', async (update) => {
        const { qr } = update;
        if (qr) {
            try {
                const code = await waSocket.requestPairingCode('593968245633');
                console.log('\n=============================================');
                console.log(`🔑 CÓDIGO DE VINCULACIÓN EN WHATSAPP: ${code}`);
                console.log('=============================================');
                console.log('   En tu celular ve a WhatsApp -> Configuración ->');
                console.log('   Dispositivos vinculados -> Vincular con código de teléfono');
                console.log(`   E ingresa el código anterior.`);
                console.log('=============================================\n');
                process.exit(0);
            } catch (err) {
                console.error("❌ Error generando pairing code:", err.message);
                process.exit(1);
            }
        }
    });
}

run().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
