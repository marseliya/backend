import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
// Import HTTP Server bawaan Node.js
import { createServer } from "http";

// Import Socket.IO dan beri alias SocketServer
import { Server as SocketServer } from "socket.io";

import AuthRouter from "../routes/AuthRouter.js";
import BooksRouter from "../routes/BooksRouter.js";
import UsersRouter from "../routes/UsersRoutes.js";
import OrderRoutes from "../routes/OrderRoutes.js";
import CartRouter from "../routes/CartRouter.js";
import VoucherRouter from "../routes/VoucherRouter.js";
import ProfileUserRouter from "../routes/ProfileUserRouter.js";
import DriverRouter from "../routes/DriverRouter.js";
import RatingRouter from "../routes/RatingRouter.js";
import MessageRouter from "../routes/MessageRouter.js"; // tambah

import initAdmin from "../config/initAdmin.js";
import cookieParser from "cookie-parser";

dotenv.config();

// Membuat aplikasi Express
const app = express();

// Membungkus Express ke dalam HTTP Server
// Socket.IO akan menempel pada server ini
const server = createServer(app);

// Membuat instance Socket.IO
const io = new SocketServer(server, {

  // Konfigurasi CORS untuk Socket.IO
  cors: {

    // Frontend yang diizinkan terhubung
    origin: "http://localhost:5173",

    // Method yang diizinkan
    methods: ["GET", "POST"],

    // Mengizinkan cookie/token dikirim
    credentials: true
  }});

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);

/* ================= CORS ================= */
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(cookieParser());

/* ================= ROUTES ================= */
app.use("/api/auth", AuthRouter);
app.use("/api/books", BooksRouter);
app.use("/api/users", UsersRouter);
app.use("/api/orders", OrderRoutes);
app.use("/api/carts", CartRouter);
app.use("/api/vouchers", VoucherRouter);
app.use("/api/profile-user", ProfileUserRouter);
app.use("/api/driver", DriverRouter);
app.use("/api/ratings", RatingRouter);
app.use("/api/messages", MessageRouter); 

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("Celeritas API Running");
});

/* ================= NOT FOUND ================= */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

/* ================= SOCKET.IO ================= */
/* ================= SOCKET.IO ================= */

// Event ketika ada user baru terhubung ke socket
io.on("connection", (socket) => {
  // Menampilkan ID socket user yang terhubung
  console.log("🔌 User connected:", socket.id);

  // User bergabung ke room berdasarkan user ID
  socket.on("join-user", (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined room user-${userId}`);
  });

  // User bergabung ke room order
  socket.on("join-order", (orderId) => {
    socket.join(`order-${orderId}`);
    console.log(`User joined order room: ${orderId}`);
  });

  // Kirim pesan real-time
  socket.on("send-message", async (data) => {
    const { order_id, message, sender_id, receiver_id, sender_name } = data;
    
    // Emit ke receiver
    io.to(`user-${receiver_id}`).emit("new-message", {
      order_id,
      message,
      sender_id,
      sender_name,
      created_at: new Date().toISOString()
    });
    
    // Emit ke room order (agar semua yang lihat order ini dapat update)
    io.to(`order-${order_id}`).emit("order-message", {
      order_id,
      message,
      sender_id,
      sender_name
    });
  });

  socket.on("disconnect", () => {
    console.log("🔌 User disconnected:", socket.id);
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.SERVER_PORT || 3000;

const startServer = async () => {
  try {
    await initAdmin();
    // Menjalankan HTTP Server
// Bukan app.listen()
// Karena Socket.IO terpasang pada server
    server.listen(PORT, () => {  
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Socket.io ready`);
    });
  } catch (error) {
    console.log("❌ Gagal start server:", error);
  }
};

startServer();


