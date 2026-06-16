import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/UsersCtrl.js";
import { verifyRole, verifyToken } from "../middleware/auth.js";
import { uploadUser } from "../middleware/uploadUser.js";

const router = express.Router();

router.delete("/delete/:id", verifyToken, deleteUser);
router.put("/update/:id", verifyToken, uploadUser.single("foto_profile"), updateUser);
router.get("/:id", verifyToken, getUserById);
router.get("/", verifyToken, verifyRole("ADMIN"), getAllUsers);

export default router;