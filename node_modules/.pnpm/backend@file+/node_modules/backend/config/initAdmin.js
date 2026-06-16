import connection from "./db.js";
import argon2 from "argon2";

const initAdmin = async () => {

    try {

        const checkAdmin = await connection.query(
            `
            SELECT * FROM users
            WHERE role = 'ADMIN'
            `
        );

        if (checkAdmin.rows.length === 0) {

            const hashedPassword = await argon2.hash("admin123");

            await connection.query(
                `
                INSERT INTO users
                (
                    nama,
                    email,
                    password,
                    role
                )
                VALUES
                ($1, $2, $3, $4)
                `,
                [
                    "Super Admin",
                    "admin@gmail.com",
                    hashedPassword,
                    "ADMIN"
                ]
            );

            console.log("✅ Default admin berhasil dibuat");

        } else {

            console.log("ℹ️ Admin sudah ada");

        }

    } catch (error) {

        console.log("❌ Init admin gagal:", error);

    }

};

export default initAdmin;