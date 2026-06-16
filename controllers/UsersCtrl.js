import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();

export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // TAMBAHKAN: WHERE deleted_at IS NULL
    const response = await pool.query(
      `SELECT * FROM users
       WHERE nama ILIKE $1
       AND deleted_at IS NULL
       ORDER BY id DESC
       LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]
    );

    const total = await pool.query(
      `SELECT COUNT(*) FROM users
       WHERE nama ILIKE $1
       AND deleted_at IS NULL`,
      [`%${search}%`]
    );

    res.json({
      page,
      limit,
      total_data: parseInt(total.rows[0].count),
      data: response.rows,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const response = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL",
      [req.params.id]
    );

    if (response.rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.json(response.rows[0]);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Server Error" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { nama, nomor_hp, alamat } = req.body;
    const userId = req.params.id;
    
    let foto_profile = null;
    
    // Jika ada file upload, simpan URL lengkap
    if (req.file) {
      foto_profile = `http://localhost:3000/uploads/users/${req.file.filename}`;
    } else if (req.body.foto_profile) {
      foto_profile = req.body.foto_profile === "null" ? null : req.body.foto_profile;
    }
    
    let query;
    let params;
    
    if (foto_profile !== null) {
      query = `
        UPDATE users
        SET nama = $1, nomor_hp = $2, alamat = $3, foto_profile = $4
        WHERE id = $5
        RETURNING *
      `;
      params = [nama, nomor_hp, alamat, foto_profile, userId];
    } else {
      query = `
        UPDATE users
        SET nama = $1, nomor_hp = $2, alamat = $3
        WHERE id = $4
        RETURNING *
      `;
      params = [nama, nomor_hp, alamat, userId];
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      message: "User berhasil diupdate",
      data: result.rows[0],
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // CEK APAKAH USER ADA
    const checkUser = await pool.query(
      `SELECT id, deleted_at, role FROM users WHERE id = $1`,
      [userId]
    );

    if (checkUser.rows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    if (checkUser.rows[0].deleted_at !== null) {
      return res.status(400).json({ message: "User sudah dihapus sebelumnya" });
    }

    // CEK APAKAH USER PERNAH ORDER
    const orderCheck = await pool.query(
      `SELECT id FROM orders WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    // CEK APAKAH USER PERNAH MENJADI DRIVER
    const driverCheck = await pool.query(
      `SELECT id FROM orders WHERE driver_id = $1 LIMIT 1`,
      [userId]
    );

    const hasOrderHistory = orderCheck.rows.length > 0;
    const hasDriverHistory = driverCheck.rows.length > 0;

    let isSoftDelete = false;

    if (hasOrderHistory || hasDriverHistory) {
      await pool.query(
        `UPDATE users SET deleted_at = NOW() WHERE id = $1`,
        [userId]
      );
      isSoftDelete = true;
    } else {
      await pool.query(
        `DELETE FROM users WHERE id = $1`,
        [userId]
      );
    }

    // KIRIM RESPONSE YANG JELAS
    return res.json({
      success: true,
      message: isSoftDelete 
        ? "Akun berhasil dinonaktifkan (riwayat tetap tersimpan)" 
        : "Akun berhasil dihapus permanen",
      soft_delete: isSoftDelete
    });

  } catch (error) {
    console.log("Delete User Error:", error.message);
    
    if (error.code === '23503') {
      return res.status(409).json({
        success: false,
        message: "User tidak dapat dihapus karena masih terkait dengan data lain"
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Server Error" 
    });
  }
};