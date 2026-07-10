// db/setup.js - Script para crear la base de datos y cargar datos iniciales
// Uso: node db/setup.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setup() {
    console.log('\n🚀 HIDROSYS - Configuración de Base de Datos\n');

    const dbName = process.env.DB_NAME || 'hidrosys_db';
    const isRemote = process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1';

    // 1. Si estamos en desarrollo local, intentar crear la DB si no existe
    if (!isRemote) {
        try {
            const adminClient = new Client({
                host:     process.env.DB_HOST || 'localhost',
                port:     parseInt(process.env.DB_PORT || '5432'),
                database: 'postgres',
                user:     process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'postgres',
            });
            await adminClient.connect();
            const exists = await adminClient.query(
                `SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]
            );
            if (!exists.rows.length) {
                await adminClient.query(`CREATE DATABASE ${dbName}`);
                console.log(`✅ Base de datos "${dbName}" creada exitosamente`);
            }
            await adminClient.end();
        } catch (err) {
            console.log('ℹ️ Omitiendo creación de base de datos (se conectará directamente):', err.message);
        }
    }

    // 2. Conectar a hidrosys_db / DB de producción y ejecutar schema + seed
    try {
        const appClient = new Client({
            host:     process.env.DB_HOST || 'localhost',
            port:     parseInt(process.env.DB_PORT || '5432'),
            database: dbName,
            user:     process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            ssl: isRemote ? { rejectUnauthorized: false } : false
        });

        await appClient.connect();
        console.log('✅ Conectado a la base de datos de la aplicación');

        const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await appClient.query(schemaSQL);
        console.log('✅ Esquema de tablas verificado/creado');

        const seedSQL = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
        await appClient.query(seedSQL);
        console.log('✅ Datos iniciales verificados');

        await appClient.end();
        console.log('\n🎉 ¡Base de datos configurada con éxito!\n');
    } catch (err) {
        console.error('\n⚠️ Aviso en configuración de tablas:', err.message);
    }
}

setup();
