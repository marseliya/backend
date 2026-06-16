import express from "express";
import {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getTopAuthors,
  getLatestBooks,
} from "../controllers/BooksCtrl.js";

import { uploadBook } from "../middleware/uploadBook.js";
import { verifyRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getAllBooks);
router.post("/create", verifyToken, verifyRole("USER", "ADMIN"), uploadBook.single("cover_file"), createBook);
router.put("/update/:id", verifyToken, verifyRole("ADMIN"), uploadBook.single("cover_file"), updateBook);
router.delete("/delete/:id", verifyToken, verifyRole("ADMIN"),deleteBook);
router.get('/top-authors', verifyToken, verifyRole("USER", "ADMIN"), getTopAuthors);
router.get('/latest', verifyToken, verifyRole("USER", "ADMIN"), getLatestBooks);
router.get("/:id", verifyToken, verifyRole("USER", "ADMIN"), getBookById);

export default router;
