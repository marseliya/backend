import express from "express";
import {
  addToCart,
  deleteCart,
  getCart
} from "../controllers/CartCtrl.js";

import { verifyRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", verifyToken, verifyRole("USER"), getCart);
router.post("/add", verifyToken, verifyRole("USER"), addToCart);
router.delete("/delete/:id", verifyToken, verifyRole("USER"), deleteCart);

export default router;