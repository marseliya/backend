import pool from "../config/db.js";

export const getAllVouchers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;
        const search = req.query.search || "";

        const response = await pool.query(
            `
            SELECT 
                *,
                tanggal_mulai AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' as tanggal_mulai,
                tanggal_selesai AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta' as tanggal_selesai
            FROM vouchers
            WHERE nama_vouchers ILIKE $1
            ORDER BY id DESC
            LIMIT $2 OFFSET $3
            `,
            [`%${search}%`, limit, offset]
        );

        // TAMBAHKAN INI - query untuk menghitung total data
        const total = await pool.query(
            `
            SELECT COUNT(*) FROM vouchers
            WHERE nama_vouchers ILIKE $1
            `,
            [`%${search}%`]
        );

        res.status(200).json({
            page,
            limit,
            total_data: parseInt(total.rows[0].count),
            data: response.rows
        });

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

// GET Voucher BY ID
export const getVoucherById = async (req, res) => {
    try {
        const response = await pool.query(
            "SELECT * FROM vouchers WHERE id = $1",
            [req.params.id]
        );

        if (response.rows.length === 0) {
            return res.status(404).json({
                message: "Voucher tidak ditemukan"
            });
        }

        res.status(200).json(response.rows[0]);

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

export const getActiveVouchers = async (req, res) => {
    try {
      const response = await pool.query(
        `
        SELECT *
        FROM vouchers
        WHERE is_active = true
        AND tanggal_mulai::DATE <= CURRENT_DATE
        AND tanggal_selesai::DATE >= CURRENT_DATE
        AND stok > 0
        ORDER BY created_at DESC
        `
      );
  
      res.json({
        success: true,
        data: response.rows
      });
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  };
// CREATE Voucher - tambah validasi juga
export const createVoucher = async (req, res) => {
    try {
        const {
            nama_vouchers,
            tipe_vouchers,
            nilai,
            tanggal_mulai,
            tanggal_selesai,
            stok,
            max_usage_per_user
        } = req.body;

        if (!nama_vouchers || !tipe_vouchers || !nilai || !tanggal_mulai || !tanggal_selesai) {
            return res.status(400).json({
                message: "Semua field wajib diisi"
            });
        }

        // VALIDASI: Tanggal selesai harus >= tanggal mulai
        if (new Date(tanggal_selesai) < new Date(tanggal_mulai)) {
            return res.status(400).json({ 
                message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai" 
            });
        }

        await pool.query(
            `
            INSERT INTO vouchers
            (nama_vouchers, tipe_vouchers, nilai, tanggal_mulai, tanggal_selesai, stok, max_usage_per_user)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [nama_vouchers, tipe_vouchers, nilai, tanggal_mulai, tanggal_selesai, stok || 0, max_usage_per_user || 1]
        );

        res.status(201).json({
            message: "Voucher berhasil ditambahkan"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server Error" });
    }
};

// UPDATE Voucher
export const updateVoucher = async (req, res) => {
    try {
        const {
            nama_vouchers,
            tipe_vouchers,
            nilai,
            tanggal_mulai,
            tanggal_selesai,
            is_active,
            stok,
            max_usage_per_user
        } = req.body;

        // VALIDASI: Tanggal selesai harus >= tanggal mulai
        if (new Date(tanggal_selesai) < new Date(tanggal_mulai)) {
            return res.status(400).json({ 
                message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai" 
            });
        }

        await pool.query(
            `
            UPDATE vouchers
            SET
                nama_vouchers = $2,
                tipe_vouchers = $3,
                nilai = $4,
                tanggal_mulai = $5,
                tanggal_selesai = $6,
                is_active = $7,
                stok = $8,
                max_usage_per_user = $9
            WHERE id = $1
            `,
            [req.params.id, nama_vouchers, tipe_vouchers, nilai, tanggal_mulai, tanggal_selesai, is_active, stok, max_usage_per_user]
        );

        res.json({
            message: "Voucher berhasil diupdate"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server Error" });
    }
};

