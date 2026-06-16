import pool from "../config/db.js";

// GET all categories
export const getAllCategories = async (req, res) => {
    try {
        const response = await pool.query(
            `SELECT id, nama, slug, created_at 
             FROM categories 
             ORDER BY nama ASC`
        );

        res.status(200).json({
            success: true,
            data: response.rows
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

export const getPopularCategories = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        const response = await pool.query(
            `SELECT 
                c.id,
                c.nama,
                c.slug,
                COUNT(bc.book_id) as total_buku
             FROM categories c
             LEFT JOIN book_categories bc ON c.id = bc.category_id
             GROUP BY c.id
             ORDER BY total_buku DESC
             LIMIT $1`,
            [limit]
        );

        res.status(200).json({
            success: true,
            data: response.rows
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};