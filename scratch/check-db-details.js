const pool = require('../db/connection');

async function run() {
    try {
        const res = await pool.query('SELECT * FROM appointments WHERE id = 12');
        console.log('=== APPOINTMENT 12 DETAILS ===');
        console.log(JSON.stringify(res.rows[0], null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
