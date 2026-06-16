import express from 'express';
import { transactionController } from '../controllers/transactionController.js';
import { authMiddleware} from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';

const router = express.Router();

// 🛒 =============== JALUR AKSES CUSTOMER ===============

// 1. Jalur untuk Checkout Belanja (Potong saldo & stok + hitung estimasi hari)
router.post('/checkout', authMiddleware, transactionController.checkout);

// 2. Jalur untuk melihat History Belanjaan khusus tipe 'shopping'
router.get('/history', authMiddleware, transactionController.getHistory);

// 3. Jalur untuk memberikan Rating Bintang & Komen setelah barang sampai
router.post('/review', authMiddleware, transactionController.reviewProduct);


// 👑 =============== JALUR AKSES KHUSUS ADMIN ===============

// 4. Jalur Admin Monitor Transaksi (Melihat barang apa yang dibeli & sisa stok real-time)
router.get('/admin/dashboard', authMiddleware, adminMiddleware, transactionController.getAdminDashboard);

// 5. Jalur Admin Monitor Ulasan (Melihat semua isi komen & bintang dari user)
router.get('/admin/reviews', authMiddleware, adminMiddleware, transactionController.getAdminReviews);

export default router;