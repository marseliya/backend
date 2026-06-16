import express from "express";

import {
  getProfile
} from "../controllers/ProfileUserCtrl.js";

import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// profile login
router.get("/", verifyToken, getProfile);

export default router;
