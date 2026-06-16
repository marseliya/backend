import pool from "../config/db.js"; 

// 1. GET CART (Sudah diperbaiki ke pool.query)
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT * FROM carts
      WHERE user_id = $1
      `,
      [userId]
    );

    res.status(200).json({
      message: "Berhasil mengambil cart",
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// 2. ADD TO CART (Sudah aman)
export const addToCart = async (req, res) => {
  try {
    const { book_id } = req.body;
    const user_id = req.user.id; 

    if (!book_id) {
      return res.status(400).json({ 
        message: "Book ID wajib disertakan" 
      });
    }

    const queryText = `
      INSERT INTO carts (user_id, book_id, jml)
      VALUES ($1, $2, 1)
      ON CONFLICT (user_id, book_id)
      DO UPDATE SET jml = carts.jml + 1
      RETURNING *;
    `;

    const result = await pool.query(queryText, [user_id, book_id]);

    return res.status(201).json({
      message: "Buku berhasil dimasukkan ke keranjang",
      data: result.rows[0]
    });

  } catch (error) {
    console.error("Error addToCart:", error.message);
    return res.status(500).json({ 
      message: "Terjadi kesalahan pada server" 
    });
  }
};

// 3. DELETE CART (Disinkronkan dengan kiriman book_id dari frontend)
export const deleteCart = async (req, res) => {
  try {
    const user_id = req.user.id;
    const book_id = req.params.id; // Di frontend kamu melempar bookId ke parameter ini

    await pool.query(
        "DELETE FROM carts WHERE user_id = $1 AND book_id = $2",
        [user_id, book_id]
    );

    return res.status(200).json({
        message: "Wishlist berhasil dihapus"
    });

  } catch (error) {
    console.error("Error deleteCart:", error.message);
    return res.status(500).json({
        message: "Terjadi kesalahan saat menghapus wishlist"
    });
  }
};