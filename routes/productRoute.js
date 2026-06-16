import express from 'express';
import {
  getProducts,
  createProduct,
  bulkCreateProducts,
  updateProduct,
  deleteProduct
} from '../controllers/productController.js';

import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js'; // 🔥 Sudah terimport dengan aman bos

const router = express.Router();

// 👥 PUBLIC ROUTE (Siapa saja boleh melihat daftar produk belanjaan)
router.get('/', getProducts);


// 👑 PROTECTED ROUTES - KHUSUS ADMIN PANEL
// Ditambahkan adminMiddleware setelah authMiddleware agar pengecekan token lolos dulu, baru dicek status rolenya.
router.post('/', authMiddleware, adminMiddleware, createProduct);
router.post('/bulk', authMiddleware, adminMiddleware, bulkCreateProducts);
router.put('/:id', authMiddleware, adminMiddleware, updateProduct);
router.delete('/:id', authMiddleware, adminMiddleware, deleteProduct);

// Rute tes rahasia admin panel bos
router.post('/admin/add-product', authMiddleware, adminMiddleware, (req, res) => {
  res.json({ message: "Bos berhasil masuk ke fitur rahasia admin!" });
});

export default router;