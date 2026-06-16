import pool from "../config/db.js";

// =====================================
// GET PROFILE LOGIN
// =====================================
export const getProfile = async (req, res) => {
  try {

    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        id,
        nama,
        email,
        role,
        nomor_hp,
        alamat,
        foto_profile,
        created_at
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User tidak ditemukan"
      });
    }

    res.status(200).json({
      data: result.rows[0]
    });

  } catch (error) {

    console.log(error.message);

    res.status(500).json({
      message: "Server error"
    });
  }
};
