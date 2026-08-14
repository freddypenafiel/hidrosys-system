const pool = require('./db/connection');

async function fix() {
    try {
        console.log('--- Checking clients table ---');
        // Ensure columns exist
        await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS cedula VARCHAR(20) UNIQUE;');
        await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_cedula VARCHAR(20);');
        await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS wa_sender VARCHAR(100);');
        await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_phone_jid VARCHAR(100);');

        // Check if Freddy exists
        const freddyCheck = await pool.query("SELECT * FROM clients WHERE cedula = '0302886403' OR phone LIKE '%987654321%' OR phone LIKE '%98 765 4321%' OR name ILIKE '%Freddy%'");
        console.log('Existing Freddy rows:', freddyCheck.rows);

        if (freddyCheck.rows.length > 0) {
            await pool.query("UPDATE clients SET cedula = '0302886403', name = 'Freddy Peñafiel', phone = '+593 98 765 4321', email = 'freddyp@example.com', address = 'Av. 24 de Mayo y 10 de Agosto', zone = 'Azogues - Luis Cordero' WHERE id = $1", [freddyCheck.rows[0].id]);
            console.log('Updated Freddy client with ID:', freddyCheck.rows[0].id);
        } else {
            await pool.query("INSERT INTO clients (name, cedula, phone, email, address, zone) VALUES ('Freddy Peñafiel', '0302886403', '+593 98 765 4321', 'freddyp@example.com', 'Av. 24 de Mayo y 10 de Agosto', 'Azogues - Luis Cordero') ON CONFLICT DO NOTHING");
            console.log('Inserted Freddy client.');
        }

        const allClients = await pool.query("SELECT id, name, cedula, phone FROM clients");
        console.log('All clients:', allClients.rows);

        console.log('✅ Database fix completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error fixing database:', err);
        process.exit(1);
    }
}

fix();
