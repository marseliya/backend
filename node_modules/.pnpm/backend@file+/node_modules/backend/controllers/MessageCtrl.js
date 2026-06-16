import pool from "../config/db.js";

// Kirim pesan
export const sendMessage = async (req, res) => {
  try {
    const { order_id, message } = req.body;
    const sender_id = req.user.id;

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Pesan tidak boleh kosong" });
    }

    // Cek order dan dapatkan receiver_id
    const orderResult = await pool.query(
      `SELECT user_id, driver_id FROM orders WHERE id = $1`,
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order tidak ditemukan" });
    }

    const order = orderResult.rows[0];
    
    // Tentukan receiver (kebalikan dari sender)
    const receiver_id = sender_id === order.user_id ? order.driver_id : order.user_id;

    if (!receiver_id) {
      return res.status(400).json({ message: "Driver belum ditugaskan" });
    }

    // Simpan ke database
    const result = await pool.query(
      `INSERT INTO messages (order_id, sender_id, receiver_id, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [order_id, sender_id, receiver_id, message]
    );

    // Ambil nama sender
    const senderResult = await pool.query(
      `SELECT nama FROM users WHERE id = $1`,
      [sender_id]
    );

    const newMessage = {
      ...result.rows[0],
      sender_name: senderResult.rows[0].nama
    };

    res.status(201).json({
      message: "Pesan terkirim",
      data: newMessage
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Ambil semua pesan per order
export const getMessages = async (req, res) => {
  try {
    const { order_id } = req.params;
    const user_id = req.user.id;

    // Cek apakah user terkait dengan order ini
    const orderResult = await pool.query(
      `SELECT user_id, driver_id FROM orders WHERE id = $1`,
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order tidak ditemukan" });
    }

    const order = orderResult.rows[0];
    if (order.user_id !== user_id && order.driver_id !== user_id) {
      return res.status(403).json({ message: "Akses ditolak" });
    }

    // Ambil pesan
    const messages = await pool.query(
      `SELECT m.*, u.nama as sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.order_id = $1
       ORDER BY m.created_at ASC`,
      [order_id]
    );

    // Tandai pesan sebagai sudah dibaca
    await pool.query(
      `UPDATE messages 
       SET is_read = TRUE 
       WHERE order_id = $1 AND receiver_id = $2 AND is_read = FALSE`,
      [order_id, user_id]
    );

    res.json({ data: messages.rows });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get unread count per order
export const getUnreadCount = async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT m.order_id, COUNT(*) as unread_count
       FROM messages m
       JOIN orders o ON o.id = m.order_id
       WHERE m.receiver_id = $1 AND m.is_read = FALSE
       AND o.status_pengambilan = 'dikirim'
       GROUP BY m.order_id`,
      [user_id]
    );

    const unreadMap = {};
    result.rows.forEach(row => {
      unreadMap[row.order_id] = parseInt(row.unread_count);
    });

    res.json({ data: unreadMap });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};