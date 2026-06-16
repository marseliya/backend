import express from "express";
import {
  sendMessage,
  getMessages,
  getUnreadCount
} from "../controllers/MessageCtrl.js";
import { verifyRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/send", verifyToken, verifyRole("USER", "DRIVER"), sendMessage);
router.get("/:order_id", verifyToken, verifyRole("USER", "DRIVER"), getMessages);
router.get("/unread/count", verifyToken, verifyRole("USER", "DRIVER"), getUnreadCount);

export default router;