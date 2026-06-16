import express from "express";
import {
  getDriverOrders,
  finishOrderDriver,
  getDriverCommissions,
  getDriverDashboard,
  takeOrder,
} from "../controllers/DriverCtrl.js";
import { verifyRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.use(verifyToken, verifyRole("DRIVER"));

router.get("/orders", verifyToken, verifyRole("DRIVER", "ADMIN"), getDriverOrders);
router.put("/orders/:id/finish", verifyToken, verifyRole("DRIVER"),finishOrderDriver);
router.put("/orders/:id/take", verifyToken, verifyRole("DRIVER"),takeOrder);
router.get("/commissions", verifyToken, verifyRole("DRIVER"),getDriverCommissions);
router.get("/dashboard", verifyToken, verifyRole("DRIVER"),getDriverDashboard);

export default router;