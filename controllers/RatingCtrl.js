import pool from "../config/db.js";

// CREATE RATING (USER memberi rating ke driver setelah order selesai)
export const createRating = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { order_id, rating } = req.body;
    const user_id = req.user.id; // dari verifyToken
    
    // Validasi rating 1-5
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating harus antara 1 - 5"
      });
    }
    
    // Cek apakah order milik user ini
    const orderResult = await client.query(
      `
      SELECT o.*, u.id as driver_id
      FROM orders o
      LEFT JOIN users u ON u.id = o.driver_id
      WHERE o.id = $1 AND o.user_id = $2
      `,
      [order_id, user_id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        message: "Order tidak ditemukan atau bukan milik Anda"
      });
    }
    
    const order = orderResult.rows[0];
    
    // Cek apakah order sudah selesai (status_pembayaran = selesai AND status_pengambilan = selesai)
    if (order.status_pembayaran !== "selesai" || order.status_pengambilan !== "selesai") {
      return res.status(400).json({
        message: "Rating hanya bisa diberikan setelah pesanan selesai"
      });
    }
    
    // Cek apakah ada driver (pesanan dengan metode antar)
    if (!order.driver_id) {
      return res.status(400).json({
        message: "Pesanan ini tidak memiliki driver (ambil sendiri)"
      });
    }
    
    // Cek apakah sudah pernah rating untuk order ini
    const existingRating = await client.query(
      `
      SELECT * FROM ratings
      WHERE order_id = $1 AND user_id = $2
      `,
      [order_id, user_id]
    );
    
    if (existingRating.rows.length > 0) {
      return res.status(400).json({
        message: "Anda sudah memberikan rating untuk pesanan ini"
      });
    }
    
    // Insert rating
    await client.query(
      `
      INSERT INTO ratings (order_id, user_id, driver_id, rating)
      VALUES ($1, $2, $3, $4)
      `,
      [order_id, user_id, order.driver_id, rating]
    );
    
    res.status(201).json({
      message: "Rating berhasil diberikan",
      data: {
        order_id,
        rating
      }
    });
    
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error"
    });
  } finally {
    client.release();
  }
};

// GET RATING BY ORDER (cek apakah order sudah dirating)
export const getRatingByOrder = async (req, res) => {
  try {
    const { order_id } = req.params;
    const user_id = req.user.id;
    
    const result = await pool.query(
      `
      SELECT id, rating, created_at
      FROM ratings
      WHERE order_id = $1 AND user_id = $2
      `,
      [order_id, user_id]
    );
    
    res.json({
      data: result.rows[0] || null
    });
    
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error"
    });
  }
};

// GET AVERAGE RATING BY DRIVER (untuk dilihat driver di dashboardnya)
export const getAverageRating = async (req, res) => {
  try {
    const driver_id = req.user.id; // driver yang login
    
    const result = await pool.query(
      `
      SELECT 
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) as total_ratings
      FROM ratings
      WHERE driver_id = $1
      `,
      [driver_id]
    );
    
    res.json({
      data: {
        average_rating: parseFloat(result.rows[0].average_rating) || 0,
        total_ratings: parseInt(result.rows[0].total_ratings) || 0
      }
    });
    
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error"
    });
  }
};

// GET DRIVER RATING STATS (untuk admin melihat rating driver)
export const getDriverRatingStats = async (req, res) => {
  try {
    const { driver_id } = req.params;
    
    const result = await pool.query(
      `
      SELECT 
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1
      FROM ratings
      WHERE driver_id = $1
      `,
      [driver_id]
    );
    
    res.json({
      data: {
        average_rating: parseFloat(result.rows[0].average_rating) || 0,
        total_ratings: parseInt(result.rows[0].total_ratings) || 0,
        distribution: {
          5: parseInt(result.rows[0].rating_5) || 0,
          4: parseInt(result.rows[0].rating_4) || 0,
          3: parseInt(result.rows[0].rating_3) || 0,
          2: parseInt(result.rows[0].rating_2) || 0,
          1: parseInt(result.rows[0].rating_1) || 0
        }
      }
    });
    
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error"
    });
  }
};

// Controller
export const getOrdersByDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const result = await pool.query(
      `SELECT * FROM orders WHERE driver_id = $1 ORDER BY created_at DESC`,
      [driverId]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};
