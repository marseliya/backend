import pool from "../config/db.js";

// GET ALL ORDERS + FILTER + SORT + PAGINATION
export const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const statusPembayaran = req.query.status_pembayaran || "";
    const statusPengambilan = req.query.status_pengambilan || "";
    const metodePembayaran = req.query.metode_pembayaran || "";

    const allowedSortFields = ["id", "created_at", "total_harga"];
    const sortBy = allowedSortFields.includes(req.query.sortBy)
      ? req.query.sortBy : "created_at";
    const order = req.query.order?.toUpperCase() === "ASC" ? "ASC" : "DESC";

    let baseQuery = `
      FROM orders
      WHERE status_pembayaran ILIKE $1
      AND status_pengambilan ILIKE $2
      AND metode_pembayaran ILIKE $3
    `;
    let values = [
      `%${statusPembayaran}%`,
      `%${statusPengambilan}%`,
      `%${metodePembayaran}%`,
    ];

    // ✅ Search setelah baseQuery dan values ada
    if (search) {
      baseQuery += ` AND kode_pesanan ILIKE $${values.length + 1}`;
      values.push(`%${search}%`);
    }

    if (req.user.role !== "ADMIN" && req.user.role !== "DRIVER") {
      baseQuery += ` AND user_id = $${values.length + 1}`;
      values.push(req.user.id);
    }

    const dataQuery = await pool.query(
      `SELECT * ${baseQuery} ORDER BY ${sortBy} ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );
    const countQuery = await pool.query(`SELECT COUNT(*) ${baseQuery}`, values);

    res.json({
      page, limit,
      total_data: parseInt(countQuery.rows[0].count),
      data: dataQuery.rows,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.status(200).json({
      message: "Berhasil mengambil order user",
      data: result.rows,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getOrderItems = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        oi.*,
        b.judul,
        b.cover
      FROM order_items oi
      JOIN books b
      ON b.id = oi.book_id
    `);

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

const calculateSubtotal = (harga, qty, voucher) => {
  let subtotal = harga * qty;

  if (voucher) {
    if (voucher.tipe_vouchers === "percent") {
      subtotal -= (subtotal * voucher.nilai) / 100;
    }

    if (voucher.tipe_vouchers === "nominal") {
      subtotal -= voucher.nilai;
    }
  }

  return Math.max(0, subtotal);
};

// CREATE ORDER - Perbaikan
export const createOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const userId =
      req.user.role === "ADMIN" && req.body.user_id
        ? req.body.user_id
        : req.user.id;

    // ==============================
    // AMBIL ALAMAT USER
    // ==============================
    const userResult = await client.query(
      `
      SELECT id, role, alamat
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({
        message: "User tidak ditemukan",
      });
    }

    // Admin hanya boleh membuat order untuk USER
    if (req.user.role === "ADMIN" && user.role !== "USER") {
      return res.status(400).json({
        message: "Pesanan hanya dapat dibuat untuk pengguna dengan role USER",
      });
    }

    const userAlamat = user.alamat;

    // ==============================
    // REQUEST BODY
    // ==============================
    const {
      metode_pembayaran,
      metode_pengambilan,
      nomor_debit,
      password_debit,
      items,
      tanggal_pengambilan,
    } = req.body;

    // ==============================
    // VALIDASI ITEMS
    // ==============================
    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Items tidak boleh kosong",
      });
    }

    // ==============================
    // STATUS DEFAULT
    // ==============================
    let status_pembayaran = "pending";
    let status_pengambilan = "pending";

    // ==============================
    // VALIDASI PEMBAYARAN DEBIT
    // ==============================
    if (metode_pembayaran === "debit") {
      if (!nomor_debit) {
        return res.status(400).json({
          message: "Nomor debit wajib diisi",
        });
      }

      if (nomor_debit.length !== 16) {
        return res.status(400).json({
          message: "Nomor debit harus 16 digit",
        });
      }

      if (!password_debit) {
        return res.status(400).json({
          message: "Password debit wajib diisi",
        });
      }

      if (password_debit.length < 6) {
        return res.status(400).json({
          message: "Password debit minimal 6 digit",
        });
      }

      if (metode_pengambilan === "diantar") {
        status_pembayaran = "selesai";
      } else if (metode_pengambilan === "ambil sendiri") {
        status_pengambilan = "selesai";
        status_pembayaran = "selesai";
      }
    }

    if (metode_pembayaran === "cash") {
      if (metode_pengambilan === "ambil sendiri") {
        if (req.user.role === "ADMIN") {
          // Admin konfirmasi langsung → selesai
          status_pembayaran = "selesai";
          status_pengambilan = "selesai";
        } else {
          // User biasa → pending
          status_pembayaran = "pending";
          status_pengambilan = "pending";
        }
      }
    }
    
    let totalHargaProduk = 0; // Harga produk sebelum ongkir

    // ==============================
    // AMBIL SEMUA BOOK ID
    // ==============================
    const bookIds = items.map((item) => item.book_id);

    const voucherIds = [
      ...new Set(
        items.filter((item) => item.voucher_id).map((item) => item.voucher_id)
      ),
    ];

    // ==============================
    // QUERY SEMUA BUKU
    // ==============================
    const booksResult = await client.query(
      `
      SELECT * FROM books
      WHERE id = ANY($1)
      `,
      [bookIds]
    );

    // ==============================
    // QUERY VOUCHERS (jika ada)
    // ==============================
    let vouchersMap = {};
    if (voucherIds.length > 0) {
      const vouchersResult = await client.query(
        `
        SELECT *
        FROM vouchers
        WHERE id = ANY($1)
        `,
        [voucherIds]
      );

      vouchersResult.rows.forEach((voucher) => {
        vouchersMap[voucher.id] = voucher;
      });
    }

    // ==============================
    // BOOK MAP
    // ==============================
    const booksMap = {};

    booksResult.rows.forEach((book) => {
      booksMap[book.id] = book;
    });

    // ==============================
    // DEFINE TODAY
    // ==============================
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ==============================
    // VALIDASI STOK + HITUNG TOTAL
    // ==============================
    for (const item of items) {
      const book = booksMap[item.book_id];
    
      // ==============================
      // CEK BUKU ADA ATAU TIDAK
      // ==============================
      if (!book) {
        return res.status(404).json({
          message: `Book dengan id ${item.book_id} tidak ditemukan`,
        });
      }
    
      // ==============================
      // CEK SOFT DELETE
      // ==============================
      if (book.deleted_at !== null) {
        return res.status(400).json({
          message: `Buku "${book.judul}" sudah tidak tersedia (telah dihapus)`,
        });
      }
    
      // ==============================
      // CEK STOK
      // ==============================
      if (book.stok < item.qty) {
        return res.status(400).json({
          message: `Stok ${book.judul} tidak cukup`,
        });
      }
    
      // ==============================
      // VALIDASI VOUCHER (jika ada)
      // ==============================
      
      if (item.voucher_id) {
        const voucher = vouchersMap[item.voucher_id];

        // Cek apakah voucher ada di database
        if (!voucher) {
          return res.status(404).json({
            message: `Voucher dengan id ${item.voucher_id} tidak ditemukan`,
          });
        }

        // Validasi tanggal_mulai
        const tanggalMulai = new Date(voucher.tanggal_mulai);
        tanggalMulai.setHours(0, 0, 0, 0);

        if (tanggalMulai > today) {
          return res.status(400).json({
            message: `Voucher "${voucher.nama_vouchers}" belum dapat digunakan (berlaku mulai ${voucher.tanggal_mulai})`,
          });
        }

        // Validasi TANGGAL BERAKHIR VOUCHER (KADALUARSA)
        const tanggalSelesai = new Date(voucher.tanggal_selesai);
        tanggalSelesai.setHours(0, 0, 0, 0);

        if (tanggalSelesai < today) {
          return res.status(400).json({
            message: `Voucher "${voucher.nama_vouchers}" sudah kadaluarsa (berlaku sampai ${voucher.tanggal_selesai})`,
          });
        }

        // Validasi is_active
        if (!voucher.is_active) {
          return res.status(400).json({
            message: `Voucher "${voucher.nama_vouchers}" sedang tidak aktif`,
          });
        }

        // Validasi nilai voucher tidak negatif
        if (voucher.nilai <= 0) {
          return res.status(400).json({
            message: `Nilai voucher "${voucher.nama_vouchers}" tidak valid`,
          });
        }

        // ==============================
        // VALIDASI STOK VOUCHER
        // ==============================
        const usageCountResult = await client.query(
          `
          SELECT COUNT(*) as total_used
          FROM voucher_usages
          WHERE voucher_id = $1
          `,
          [item.voucher_id]
        );

        const totalUsed = parseInt(usageCountResult.rows[0].total_used);
        const remainingStok = voucher.stok - totalUsed;

        if (remainingStok <= 0) {
          return res.status(400).json({
            message: `Voucher "${voucher.nama_vouchers}" sudah habis (stok: ${voucher.stok})`,
          });
        }

        // ==============================
        // VALIDASI PENGGUNAAN PER USER
        // ==============================
        const userUsageResult = await client.query(
          `
          SELECT COUNT(*) as user_used
          FROM voucher_usages
          WHERE voucher_id = $1 AND user_id = $2
          `,
          [item.voucher_id, userId]
        );

        const userUsed = parseInt(userUsageResult.rows[0].user_used);

        if (userUsed >= voucher.max_usage_per_user) {
          return res.status(400).json({
            message: `Anda sudah menggunakan voucher "${voucher.nama_vouchers}" sebanyak ${userUsed} kali (maksimal ${voucher.max_usage_per_user} kali per user)`,
          });
        }
      }

      // ==============================
      // HITUNG HARGA AWAL
      // ==============================
      const voucher = vouchersMap[item.voucher_id];
      const subtotal = calculateSubtotal(book.harga, item.qty, voucher);
      totalHargaProduk += subtotal;
    }

    // ==============================
    // HITUNG BIAYA PENGIRIMAN (20% dari total harga produk)
    // ==============================
    let biayaPengiriman = 0;
    if (metode_pengambilan === "diantar") {
      biayaPengiriman = totalHargaProduk * 0.2; // 20% dari total harga produk
    }

    // ==============================
    // TOTAL AKHIR (Produk + Ongkir)
    // ==============================
    const totalAkhir = totalHargaProduk + biayaPengiriman;

    // ==============================
    // KURANGI STOK BUKU
    // ==============================
    for (const item of items) {
      await client.query(
        `
        UPDATE books
        SET stok = stok - $1
        WHERE id = $2
        `,
        [item.qty, item.book_id]
      );
    }

    // ==============================
    // INSERT ORDER
    // ==============================
    const orderResult = await client.query(
      `
      INSERT INTO orders
      (
        user_id,
        kode_pesanan,
        total_harga,
        alamat,
        metode_pembayaran,
        metode_pengambilan,
        nomor_debit,
        status_pembayaran,
        status_pengambilan,
        biaya_pengiriman,
        tanggal_pengambilan
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
      `,
      [
        userId,
        `ORD-${Date.now()}`,
        totalAkhir,
        userAlamat,
        metode_pembayaran,
        metode_pengambilan,
        nomor_debit || null,
        status_pembayaran,
        status_pengambilan,
        biayaPengiriman,
        tanggal_pengambilan||null,
      ]
    );

    const orderId = orderResult.rows[0].id;

    // ==============================
    // INSERT ORDER ITEMS & CATAT PENGGUNAAN VOUCHER
    // ==============================
    for (const item of items) {
      const book = booksMap[item.book_id];
      const voucher = vouchersMap[item.voucher_id];
      const subtotal = calculateSubtotal(book.harga, item.qty, voucher);

      await client.query(
        `
        INSERT INTO order_items
        (order_id, book_id, jml, harga, subtotal, voucher_id)
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          orderId,
          item.book_id,
          item.qty,
          book.harga,
          subtotal,
          item.voucher_id || null,
        ]
      );

      // Catat penggunaan voucher jika ada
      if (item.voucher_id) {
        await client.query(
          `
          INSERT INTO voucher_usages (voucher_id, user_id, order_id)
          VALUES ($1, $2, $3)
          `,
          [item.voucher_id, userId, orderId]
        );
      }
    }

    // ==============================
    // SIMPAN TRANSAKSI
    // ==============================
    await client.query("COMMIT");

    // ==============================
    // RESPONSE
    // ==============================
    res.status(201).json({
      message: "Pesanan berhasil dibuat",
      data: {
        ...orderResult.rows[0],
        rincian_biaya: {
          total_harga_produk: totalHargaProduk,
          biaya_pengiriman: biayaPengiriman,
          total_keseluruhan: totalAkhir
        }
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.log(error);
    res.status(500).json({
      message: "Server error",
    });
  } finally {
    client.release();
  }
};

// UPDATE ORDER
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      status_pembayaran,
      status_pengambilan,
      tanggal_pengambilan,
      catatan,
    } = req.body;

    // ==============================
    // CEK ORDER
    // ==============================
    const existingOrder = await pool.query(
      `
      SELECT * FROM orders
      WHERE id = $1
      `,
      [id]
    );

    if (existingOrder.rows.length === 0) {
      return res.status(404).json({
        message: "Order tidak ditemukan",
      });
    }

    const order = existingOrder.rows[0];

    // ==============================
    // STATUS FINAL
    // ==============================
    let finalStatusPembayaran = status_pembayaran || order.status_pembayaran;

    let finalStatusPengambilan = status_pengambilan || order.status_pengambilan;

    // ==============================
    // CASH + AMBIL SENDIRI
    // ADMIN KONFIRMASI BAYAR
    // ==============================
    if (
      order.metode_pembayaran === "cash" &&
      order.metode_pengambilan === "ambil sendiri"
    ) {
      if (finalStatusPembayaran === "selesai" || finalStatusPengambilan === "selesai") {
        finalStatusPengambilan = "selesai";
        finalStatusPembayaran = "selesai";
      }
    }

    // ==============================
    // CASH + DIANTAR
    // DRIVER KONFIRMASI BAYAR
    // ==============================
    if (
      order.metode_pembayaran === "cash" &&
      order.metode_pengambilan === "diantar"
    ) {
      if (finalStatusPengambilan === "selesai") {
        finalStatusPembayaran = "selesai";
      }
    }

    // ==============================
    // UPDATE ORDER
    // ==============================
    const updatedOrder = await pool.query(
      `
      UPDATE orders
      SET
        status_pembayaran = $1,
        status_pengambilan = $2,
        tanggal_pengambilan = COALESCE($3, tanggal_pengambilan),
        catatan = COALESCE($4, catatan),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
      `,
      [
        finalStatusPembayaran,
        finalStatusPengambilan,
        tanggal_pengambilan,
        catatan,
        id,
      ]
    );

    // ==============================
    // RESPONSE
    // ==============================
    res.status(200).json({
      message: "Order berhasil diupdate",
      data: updatedOrder.rows[0],
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server error",
    });
  }
};

// CANCEL ORDER 
export const deleteOrder = async (req, res) => {
  try {
      const orderId = req.params.id;
      const userId = req.user.id; 

      // 1. CEK APAKAH ORDER ADA
      const orderCheck = await pool.query(
          `
          SELECT 
              id, 
              user_id, 
              status_pembayaran, 
              status_pengambilan,
              metode_pengambilan
          FROM orders 
          WHERE id = $1
          `,
          [orderId]
      );

      if (orderCheck.rows.length === 0) {
          return res.status(404).json({
              message: "Order tidak ditemukan"
          });
      }

      const order = orderCheck.rows[0];

      // 2. CEK APAKAH ORDER MILIK USER INI
      if (order.user_id !== userId) {
          return res.status(403).json({
              message: "Anda tidak memiliki akses untuk membatalkan order ini"
          });
      }

      // 3. CEK STATUS - HANYA BISA BATAL JIKA KEDUA STATUS PENDING
      if (order.status_pembayaran !== "pending" || order.status_pengambilan !== "pending") {
          return res.status(400).json({
              message: "Order hanya bisa dibatalkan jika status pembayaran dan pengambilan masih pending"
          });
      }

      // 4. AMBIL ORDER ITEMS UNTUK RESTORE STOK
      const orderItems = await pool.query(
          `
          SELECT book_id, jml 
          FROM order_items 
          WHERE order_id = $1
          `,
          [orderId]
      );

      // 5. MULAI TRANSACTION
      const client = await pool.connect();
      
      try {
          await client.query("BEGIN");

          // 5a. RESTORE STOK BUKU
          for (const item of orderItems.rows) {
              await client.query(
                  `
                  UPDATE books 
                  SET stok = stok + $1 
                  WHERE id = $2
                  `,
                  [item.jml, item.book_id]
              );
          }

          // 5b. DELETE ORDER ITEMS
          await client.query(
              `
              DELETE FROM order_items 
              WHERE order_id = $1
              `,
              [orderId]
          );

          // 5c. DELETE ORDER
          await client.query(
              `
              DELETE FROM orders 
              WHERE id = $1
              `,
              [orderId]
          );

          await client.query("COMMIT");

          res.json({
              success: true,
              message: "Order berhasil dibatalkan",
              data: {
                  order_id: orderId,
                  restored_stok: orderItems.rows.length > 0
              }
          });

      } catch (error) {
          await client.query("ROLLBACK");
          console.error("Transaction error:", error);
          throw error;
      } finally {
          client.release();
      }

  } catch (error) {
      console.error("Cancel Order Error:", error.message);
      res.status(500).json({
          success: false,
          message: "Server Error"
      });
  }
};