// db/setup.js - Script para crear la base de datos y cargar datos iniciales
// Uso: node db/setup.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
    console.log('\n🚀 HIDROSYS - Configuración de Base de Datos\n');

    // 1. Conectar a "postgres" para crear la DB si no existe
    const adminClient = new Client({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: 'postgres',
        user:     process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
        await adminClient.connect();
        console.log('✅ Conectado a PostgreSQL');

        const dbName = process.env.DB_NAME || 'hidrosys_db';
        const exists = await adminClient.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
        );

        if (!exists.rows.length) {
            await adminClient.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ Base de datos "${dbName}" creada exitosamente`);
        } else {
            console.log(`ℹ️  Base de datos "${dbName}" ya existe`);
        }
        await adminClient.end();

        // 2. Conectar a hidrosys_db y ejecutar schema + seed
        const appClient = new Client({
            host:     process.env.DB_HOST || 'localhost',
            port:     parseInt(process.env.DB_PORT || '5432'),
            database: dbName,
            user:     process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
        });

        await appClient.connect();

        const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await appClient.query(schemaSQL);
        console.log('✅ Esquema de tablas creado/actualizado');

        const seedSQL = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
        await appClient.query(seedSQL);
        console.log('✅ Datos de prueba cargados');

        await appClient.end();

        console.log('\n🎉 ¡Base de datos configurada! Ejecuta: npm start\n');

    } catch (err) {
        console.error('\n❌ Error de configuración:', err.message);
        console.error('\n📋 Verifica tu archivo .env:');
        console.error('   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD\n');
        process.exit(1);
    }
}

setup();
