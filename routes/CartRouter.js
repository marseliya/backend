import express from "express";
import {
  addToCart,
  deleteCart,
  getCart
} from "../controllers/CartCtrl.js";

import { verifyRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", verifyToken, verifyRole("USER", "ADMIN"), getCart);
router.post("/add", verifyToken, verifyRole("USER", "ADMIN"), addToCart);
router.delete("/delete/:id", verifyToken, verifyRole("USER", "ADMIN"), deleteCart);

export default router;