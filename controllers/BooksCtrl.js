import pool from "../config/db.js";

// GET ALL Books + SEARCH + FILTER HARGA + PAGINATION
export const getAllBooks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;
        const search = req.query.search || "";
        const minHarga = req.query.minHarga || 0;
        const maxHarga = req.query.maxHarga || 999999999;

        // TAMBAHKAN: WHERE deleted_at IS NULL
        let query = `
            SELECT 
                b.*
            FROM books b
            WHERE b.judul ILIKE $1
            AND b.harga BETWEEN $2 AND $3
            AND b.deleted_at IS NULL
        `;
        
        let countQuery = `
            SELECT COUNT(*) FROM books
            WHERE judul ILIKE $1
            AND harga BETWEEN $2 AND $3
            AND deleted_at IS NULL
        `;
        
        let params = [`%${search}%`, minHarga, maxHarga];
        
        query += ` ORDER BY b.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const response = await pool.query(query, params);
        
        const totalParams = params.slice(0, -2);
        const total = await pool.query(countQuery, totalParams);

        res.json({
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

// GET Book BY ID
export const getBookById = async (req, res) => {
    try {
        const response = await pool.query(
            "SELECT * FROM books WHERE id = $1 AND deleted_at IS NULL",
            [req.params.id]
        );

        if (response.rows.length === 0) {
            return res.status(404).json({ message: "Buku tidak ditemukan" });
        }

        res.json(response.rows[0]);

    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Server Error" });
    }
};

// GET TOP AUTHORS (penulis dengan buku terbanyak)
export const getTopAuthors = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 2;
        
        const response = await pool.query(
            `
            SELECT 
                penulis,
                COUNT(*) as total_buku,
                json_agg(
                    json_build_object(
                        'id', id,
                        'judul', judul,
                        'harga', harga,
                        'cover', cover
                    ) ORDER BY id DESC
                ) as buku_terbaru
            FROM books
            WHERE penulis IS NOT NULL 
              AND penulis != ''
              AND deleted_at IS NULL
            GROUP BY penulis
            ORDER BY total_buku DESC
            LIMIT $1
            `,
            [limit]
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

// GET LATEST Books
export const getLatestBooks = async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 6;
      const response = await pool.query(
        `SELECT id, judul, penulis, harga, cover, kategori
         FROM books
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      res.json({ success: true, data: response.rows });
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ message: "Server Error" });
    }
  };

// CREATE Book
export const createBook = async (req, res) => {
    try {
        const {
            judul,
            penulis,
            penerbit,
            tahun_terbit,
            kategori,
            deskripsi,
            harga,
            stok,
            cover_url,
        } = req.body;

        let cover = null;

        if (req.file) {
            cover = `http://localhost:3000/uploads/books/${req.file.filename}`;
        } else if (cover_url) {
            cover = cover_url;
        }

        if (!judul || !penulis) {
            return res.status(400).json({
                message: "judul dan penulis wajib diisi",
            });
        }

        await pool.query(
            `
            INSERT INTO books
            (judul, penulis, penerbit, tahun_terbit, kategori, deskripsi, harga, stok, cover)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `,
            [judul, penulis, penerbit, tahun_terbit, kategori, deskripsi, harga, stok || 0, cover]
        );

        res.status(201).json({
            message: "Book berhasil ditambahkan",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Server Error",
        });
    }
};

// UPDATE Book
export const updateBook = async (req, res) => {
    try {
        const {
            judul,
            penulis,
            penerbit,
            tahun_terbit,
            kategori,
            deskripsi,
            harga,
            stok,
            cover_url,
        } = req.body;

        let cover = cover_url || null;

        if (req.file) {
            cover = `http://localhost:3000/uploads/books/${req.file.filename}`;
        }

        // UPDATE SEMUA FIELD - seperti updateUser!
        await pool.query(
            `
            UPDATE books
            SET
                judul = $2,
                penulis = $3,
                penerbit = $4,
                tahun_terbit = $5,
                kategori = $6,
                deskripsi = $7,
                harga = $8,
                stok = $9,
                cover = $10
            WHERE id = $1
            `,
            [req.params.id, judul, penulis, penerbit, tahun_terbit, kategori, deskripsi, harga, stok, cover]
        );

        res.json({
            message: "Book berhasil diupdate",
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Server Error",
        });
    }
};

// DELETE Book - Soft Delete dengan pengecekan riwayat
export const deleteBook = async (req, res) => {
    try {
        const bookId = req.params.id;

        // CEK APAKAH BUKU SUDAH PERNAH DIPESAN (ada di order_items)
        const checkOrder = await pool.query(
            `SELECT id FROM order_items WHERE book_id = $1 LIMIT 1`,
            [bookId]
        );

        // CEK APAKAH BUKU ADA DI CART (wishlist)
        const checkCart = await pool.query(
            `SELECT id FROM carts WHERE book_id = $1 LIMIT 1`,
            [bookId]
        );

        // CEK APAKAH BUKU SUDAH DI-SOFT DELETE SEBELUMNYA
        const checkBook = await pool.query(
            `SELECT deleted_at FROM books WHERE id = $1`,
            [bookId]
        );

        if (checkBook.rows.length === 0) {
            return res.status(404).json({ message: "Buku tidak ditemukan" });
        }

        // Jika buku sudah dihapus (deleted_at tidak null)
        if (checkBook.rows[0].deleted_at !== null) {
            return res.status(400).json({ 
                message: "Buku sudah dihapus sebelumnya" 
            });
        }

        // Jika ada di order_items ATAU di carts → SOFT DELETE
        if (checkOrder.rows.length > 0 || checkCart.rows.length > 0) {
            await pool.query(
                `UPDATE books SET deleted_at = NOW() WHERE id = $1`,
                [bookId]
            );

            return res.json({
                message: "Buku berhasil dihapus (soft delete - memiliki riwayat pemesanan atau wishlist)",
                soft_delete: true,
                has_order_history: checkOrder.rows.length > 0,
                has_cart_history: checkCart.rows.length > 0
            });
        }

        // Jika tidak ada riwayat → HARD DELETE (DELETE permanen)
        await pool.query(
            `DELETE FROM books WHERE id = $1`,
            [bookId]
        );

        res.json({
            message: "Buku berhasil dihapus permanen",
            soft_delete: false
        });

    } catch (error) {
        console.log("Delete Book Error:", error.message);
        
        // Tangani error foreign key jika ada
        if (error.code === '23503') { // foreign key violation
            return res.status(409).json({
                message: "Buku tidak dapat dihapus karena masih terkait dengan data lain",
                error: error.message
            });
        }
        
        res.status(500).json({ message: "Server Error" });
    }
};