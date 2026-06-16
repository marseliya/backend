// Mengimpor library multer
import multer from "multer";

// Mengimpor module path
import path from "path";

// Mengimpor module file system
import fs from "fs";

// Folder penyimpanan foto user
const uploadDir = "uploads/users";

// Mengecek apakah folder sudah ada
if (!fs.existsSync(uploadDir)) {

  // Jika belum ada maka dibuat otomatis
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi penyimpanan file
const storage = multer.diskStorage({

  // Menentukan folder tujuan upload
  destination: (req, file, cb) => {

    // Simpan ke uploads/users
    cb(null, uploadDir);
  },

  // Menentukan nama file
  filename: (req, file, cb) => {

    // Mengambil ekstensi file
    const ext = path.extname(file.originalname);

    // Membuat nama unik berdasarkan timestamp
    // contoh: user-17526728282.png
    cb(null, `user-${Date.now()}${ext}`);
  },
});

// Validasi jenis file
const fileFilter = (req, file, cb) => {

  // Tipe file yang diperbolehkan
  const allowed = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp"
  ];

  // Jika file termasuk yang diperbolehkan
  if (allowed.includes(file.mimetype)) {

    // Izinkan upload
    cb(null, true);

  } else {

    // Tolak upload
    cb(new Error("File harus berupa gambar"), false);
  }
};

// Export middleware upload user
export const uploadUser = multer({

  // Konfigurasi penyimpanan
  storage,

  // Filter file
  fileFilter,

  // Maksimal ukuran file 5 MB
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});