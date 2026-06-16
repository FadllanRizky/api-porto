import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import {
  getUsers,
  updateUserController,
  deleteUserController,
  getLoans,
  approveLoan,
  rejectLoan,
  createProductController,
  updateProductController,
  deleteProductController,
  getCategories,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController
} from '../controllers/adminController.js';

const router = express.Router();

// 🔥 KUNCI GERBANG UTAMA: Harus login valid & punya role perwira admin
router.use(authMiddleware, adminMiddleware);

// 👥 ROUTE MANAJEMEN USER
router.get('/users', getUsers);
router.put('/users/:id', updateUserController);
router.delete('/users/:id', deleteUserController);

// 💰 ROUTE APPROVAL PINJAMAN KREDIT
router.get('/loans', getLoans);
router.put('/loans/:id/approve', approveLoan);
router.put('/loans/:id/reject', rejectLoan);

// 📦 ROUTE MANAJEMEN ETALASE PRODUK
router.post('/products', createProductController);
router.put('/products/:id', updateProductController);
router.delete('/products/:id', deleteProductController);

// 🏷️ ROUTE MANAJEMEN KATEGORI BARANG
router.get('/categories', getCategories);
router.post('/categories', createCategoryController);
router.put('/categories/:id', updateCategoryController);
router.delete('/categories/:id', deleteCategoryController);

export default router;