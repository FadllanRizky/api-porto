import express from 'express';
import chatController from '../controllers/chatController.js'; 
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';

const router = express.Router();

// 👑 Admin → List user yang pernah chat (GET /api/chat/admin/users)
router.get('/admin/users', authMiddleware, adminMiddleware, chatController.getChatUsers);

// ✉️ Admin → Kirim pesan spesifik (POST /api/chat/admin/send)
// 🔥 SEKARANG ROUTE INI SUDAH AKTIF DAN AMAN DIBAWAH AUTH & ADMIN MIDDLEWARE!
router.post('/admin/send', authMiddleware, adminMiddleware, chatController.sendMessage);

// 💬 Ambil riwayat chat (GET /api/chat?target_user_id=xxx)
router.get('/', authMiddleware, chatController.getChats);

// ✉️ Customer Umum → Kirim pesan biasa (POST /api/chat)
router.post('/', authMiddleware, chatController.sendMessage);

export default router;