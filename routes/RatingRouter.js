import express from "express";
import {
  createRating,
  getRatingByOrder,
  getAverageRating,
  getDriverRatingStats,
} from "../controllers/RatingCtrl.js";
import { verifyToken } from "../middleware/auth.js";
import { verifyRole } from "../middleware/auth.js";

const router = express.Router();

// USER routes
router.post("/create", verifyToken, verifyRole("USER"), createRating);
router.get("/order/:order_id", verifyToken, verifyRole("USER"), getRatingByOrder);

// DRIVER routes (lihat rating sendiri)
router.get("/driver/me", verifyToken, verifyRole("DRIVER"), getAverageRating);

// ADMIN routes (lihat rating driver tertentu)
router.get("/driver/:driver_id/stats", verifyToken, verifyRole("ADMIN"), getDriverRatingStats);


export default router;