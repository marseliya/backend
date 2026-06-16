import express from "express";

import {
  getProfile
} from "../controllers/ProfileUserCtrl.js";

import { verifyRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();

// profile login
router.get("/", verifyToken, verifyRole("USER", "DRIVER"), getProfile);

export default router;
