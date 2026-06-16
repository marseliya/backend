import pool from "../config/db.js";

// Tambahkan fungsi ini di DriverCtrl.js
export const takeOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user.id;

    // Cek order
    const orderResult = await pool.query(
      `
      SELECT * FROM orders
      WHERE id = $1 
      AND metode_pengambilan = 'diantar'
      AND status_pengambilan = 'pending'
      AND driver_id IS NULL
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        message: "Order tidak ditemukan atau sudah diambil driver lain",
      });
    }

    // Update order: set driver_id dan status_pengambilan jadi 'dikirim'
    await pool.query(
      `
      UPDATE orders
      SET driver_id = $1, status_pengambilan = 'dikirim', updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [driverId, id]
    );

    res.json({ message: "Order berhasil diambil" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getDriverDashboard = async (req, res) => {
  try {
    const driverId = req.user.id;

    // Total komisi
    const commissionResult = await pool.query(
      `
      SELECT 
        COALESCE(SUM(commission), 0) as total_commission,
        COUNT(*) as total_orders
      FROM commissions
      WHERE driver_id = $1
      `,
      [driverId]
    );

    // Rating rata-rata
    const ratingResult = await pool.query(
      `
      SELECT 
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) as total_ratings
      FROM ratings
      WHERE driver_id = $1
      `,
      [driverId]
    );

    // Order aktif
    const activeOrdersResult = await pool.query(
      `
  SELECT COUNT(*)
  FROM orders
  WHERE 
    metode_pengambilan = 'diantar'
    AND status_pengambilan IN ('pending', 'dikirim')
    AND (driver_id IS NULL OR driver_id = $1)
  `,
      [driverId]
    );

    res.json({
      data: {
        total_commission:
          parseFloat(commissionResult.rows[0].total_commission) || 0,
        total_orders: parseInt(commissionResult.rows[0].total_orders) || 0,
        average_rating: parseFloat(ratingResult.rows[0].average_rating) || 0,
        total_ratings: parseInt(ratingResult.rows[0].total_ratings) || 0,
        active_orders: parseInt(activeOrdersResult.rows[0].count) || 0,
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};
export const getDriverOrders = async (req, res) => {
  try {
    const driverId = req.user.id;

    const result = await pool.query(
      `
      SELECT *
      FROM orders
      WHERE 
        metode_pengambilan = 'diantar'
        AND status_pengambilan IN ('pending', 'dikirim')
        AND (
          driver_id IS NULL 
          OR driver_id = $1
        )
      ORDER BY 
        CASE WHEN status_pengambilan = 'pending' THEN 1 ELSE 2 END,
        created_at ASC
      `,
      [driverId]
    );

    res.json({
      data: result.rows,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};
export const finishOrderDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user.id;

    const orderResult = await pool.query(
      `
      SELECT *
      FROM orders
      WHERE id = $1
        AND metode_pengambilan = 'diantar'
        AND status_pengambilan IN ('pending', 'dikirim')
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        message: "Order tidak ditemukan atau sudah tidak aktif",
      });
    }

    const order = orderResult.rows[0];

    let statusPembayaran = order.status_pembayaran;
    let statusPengambilan = "selesai";

    // cash otomatis lunas saat driver selesai
    if (order.metode_pembayaran === "cash") {
      statusPembayaran = "selesai";
    }

    // Jika order masih pending, set driver_id
    const updatedOrder = await pool.query(
      `
      UPDATE orders
      SET
        driver_id = COALESCE(driver_id, $1),
        status_pengambilan = $2,
        status_pembayaran = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
      `,
      [driverId, statusPengambilan, statusPembayaran, id]
    );

    // Hitung komisi (5% dari total harga)
    const komisi = Number(order.total_harga) * 0.05;

    await pool.query(
      `
      INSERT INTO commissions (driver_id, order_id, total_order, commission)
      VALUES ($1, $2, $3, $4)
      `,
      [driverId, id, order.total_harga, komisi]
    );

    res.json({
      message: "Pesanan selesai",
      data: updatedOrder.rows[0],
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};

export const getDriverCommissions = async (req, res) => {
  try {
    const driverId = req.user.id;

    const result = await pool.query(
      `
      SELECT
        c.*,
        o.kode_pesanan,
        r.rating as driver_rating
      FROM commissions c
      JOIN orders o ON o.id = c.order_id
      LEFT JOIN ratings r ON r.order_id = c.order_id AND r.driver_id = c.driver_id
      WHERE c.driver_id = $1
      ORDER BY c.created_at DESC
      `,
      [driverId]
    );

    res.json({
      data: result.rows,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server error",
    });
  }
};
