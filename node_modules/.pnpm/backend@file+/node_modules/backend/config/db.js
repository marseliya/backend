import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Membuat koneksi pool PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl: {
        rejectUnauthorized: false,
    },
});

// Test koneksi database
pool
    .connect()
    .then((client) => {
        console.log("✅ Berhasil konek ke Supabase PostgreSQL");
        client.release();
    })
    .catch((err) => {
        console.error("❌ Gagal konek ke database:", err.message);
    });

export default pool;