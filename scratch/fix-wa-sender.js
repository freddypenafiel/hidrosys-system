// Script de migracion: convierte los wa_sender sin '@' al formato JID completo
// Ejecutar: node scratch/fix-wa-sender.js

const pool = require('../db/connection');

async function run() {
    try {
        // Traer todas las citas con wa_sender que no tengan '@' (formato antiguo)
        const res = await pool.query(
            `SELECT id, wa_sender FROM appointments WHERE wa_sender IS NOT NULL AND wa_sender NOT LIKE '%@%'`
        );

        if (!res.rows.length) {
            console.log('✅ No hay registros con wa_sender en formato antiguo. Todo OK.');
            process.exit(0);
        }

        console.log(`🔧 Encontrados ${res.rows.length} registros para migrar:\n`);

        for (const row of res.rows) {
            const oldSender = row.wa_sender;
            const digits = oldSender.replace(/\D/g, '');
            // Si tiene 10 o menos digitos, agregar 593 (Ecuador)
            const phone = digits.length <= 10
                ? `593${digits.replace(/^0/, '')}`
                : digits;
            const newSender = `${phone}@s.whatsapp.net`;

            await pool.query(
                `UPDATE appointments SET wa_sender=$1 WHERE id=$2`,
                [newSender, row.id]
            );
            console.log(`  ✅ Cita #${row.id}: "${oldSender}" → "${newSender}"`);
        }

        console.log('\n🎉 Migración completada exitosamente.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en migración:', err.message);
        process.exit(1);
    }
}

run();
