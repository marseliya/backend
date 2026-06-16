// Mengimpor library multer untuk menangani upload file
import multer from "multer";

// Mengimpor module path untuk mengolah nama file dan ekstensi
import path from "path";

// Mengimpor module fs (File System) untuk membaca/membuat folder
import fs from "fs";

// Menentukan lokasi penyimpanan file gambar buku
const uploadDir = "uploads/books";

// Mengecek apakah folder uploads/books sudah ada
if (!fs.existsSync(uploadDir)) {

  // Jika belum ada, maka folder dibuat otomatis
  // recursive:true artinya folder parent juga dibuat jika belum ada
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi penyimpanan file
const storage = multer.diskStorage({

  // Menentukan folder tujuan penyimpanan file
  destination: (req, file, cb) => {

    // cb = callback
    // parameter pertama null artinya tidak ada error
    // parameter kedua adalah lokasi folder penyimpanan
    cb(null, uploadDir);
  },

  // Menentukan nama file yang akan disimpan
  filename: (req, file, cb) => {

    // Mengambil ekstensi file asli (.png, .jpg, dll)
    const ext = path.extname(file.originalname);

    // Membuat nama file unik
    // contoh: book-17526728282.jpg
    cb(
      null,
      `book-${Date.now()}${ext}`
    );
  },
});

// Filter file yang boleh diupload
const fileFilter = (req, file, cb) => {

  // Daftar tipe file yang diizinkan
  const allowed = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ];

  // Jika tipe file sesuai daftar
  if (allowed.includes(file.mimetype)) {

    // Upload diizinkan
    cb(null, true);

  } else {

    // Upload ditolak
    cb(new Error("File harus berupa gambar"), false);
  }
};

// Export middleware upload buku
export const uploadBook = multer({

  // Menggunakan konfigurasi storage di atas
  storage,

  // Menggunakan filter file
  fileFilter,

  // Batas ukuran file
  limits: {

    // Maksimal 5 MB
    fileSize: 5 * 1024 * 1024,
  },
});