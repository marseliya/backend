import express from "express";
import {
  getAllOrders,
  createOrder,
  updateOrder,
  getOrderItems,
  getOrdersByUser,
  deleteOrder,
} from "../controllers/OrderCtrl.js";

import { verifyToken } from "../middleware/auth.js";
import { verifyRole } from "../middleware/auth.js";
import { getOrdersByDriver } from "../controllers/RatingCtrl.js";

const router = express.Router();

router.post("/create", verifyToken, verifyRole("USER", "ADMIN"), createOrder);
router.put("/update/:id", verifyToken, verifyRole("ADMIN","DRIVER"), updateOrder);
router.get("/order-items", verifyToken, getOrderItems);
router.get("/", verifyToken, verifyRole("ADMIN", "USER"), getAllOrders);
router.get("/user/:userId", verifyToken, verifyRole("ADMIN"), getOrdersByUser);
// OrderRoutes
router.get("/driver/:driverId", verifyToken, verifyRole("ADMIN"), getOrdersByDriver);
router.delete("/delete/:id", verifyToken, verifyRole("USER"), deleteOrder);

export default router;
