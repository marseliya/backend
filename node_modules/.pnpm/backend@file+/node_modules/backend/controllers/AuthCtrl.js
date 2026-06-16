import connection from "../config/db.js";
import jwt from "jsonwebtoken";
import argon2 from "argon2";

/* ================= REGISTER ================= */

export const regis = async (req, res) => {

    try {

        const {
            nama,
            email,
            password,
            nomor_hp,
            alamat,
            role
        } = req.body;

        // Validasi
        if (!nama || !email || !password || !alamat) {
            return res.status(400).json({
                message: "Nama, email, password, dan alamat wajib diisi!"
            });
        }

        // Check email
        const checkUser = await connection.query(
            `
            SELECT * FROM users
            WHERE email = $1
            `,
            [email]
        );

        if (checkUser.rows.length > 0) {
            return res.status(400).json({
                message: "Email sudah digunakan!"
            });
        }

        // Hash password
        const hashedPassword = await argon2.hash(password);

        // Insert user
        const result = await connection.query(
            `
            INSERT INTO users
            (
                nama,
                email,
                password,
                nomor_hp,
                alamat,
                role
            )
            VALUES
            ($1, $2, $3, $4, $5, $6)

            RETURNING
            id,
            nama,
            email,
            alamat,
            nomor_hp,
            role
            `,
            [
                nama,
                email,
                hashedPassword,
                nomor_hp || null,
                alamat,
                role
            ]
        );

        return res.status(201).json({
            message: "Registrasi berhasil",
            user: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            message: "Server error",
            error: error.message
        });

    }

};

/* ================= LOGIN ================= */

export const login = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      if (!email || !password) {
        return res.status(400).json({
          message: "Email dan password wajib diisi!"
        });
      }
  
      const result = await connection.query(
        `
        SELECT * FROM users
        WHERE email = $1
        AND deleted_at IS NULL  -- 🔥 TAMBAHKAN INI
        `,
        [email]
      );
  
      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "User tidak ditemukan!"
        });
      }
  
      const user = result.rows[0];
  
      // 🔥 VALIDASI STATUS USER
      if (user.status === false || user.status === "false") {
        return res.status(403).json({
          message: "Akun Anda tidak aktif. Hubungi admin!"
        });
      }
  
      // Verify password
      const validPassword = await argon2.verify(user.password, password);
  
      if (!validPassword) {
        return res.status(401).json({
          message: "Password salah!"
        });
      }
  
      const payload = {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role
      };
  
      const token = jwt.sign(payload, process.env.SECRET_KEY, {
        expiresIn: "1h"
      });
  
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 3600000
      });
  
      res.status(200).json({
        message: "Login berhasil",
        token,
        user: payload
      });
  
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message
      });
    }
  };