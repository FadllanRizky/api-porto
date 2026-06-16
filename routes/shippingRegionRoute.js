import express from 'express';
import { shippingRegionController } from '../controllers/shippingRegionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Public: ambil semua wilayah pengiriman
router.get('/', shippingRegionController.getAll);

// Admin: CRUD wilayah pengiriman
router.post('/', authMiddleware, adminMiddleware, shippingRegionController.create);
router.put('/:id', authMiddleware, adminMiddleware, shippingRegionController.update);
router.delete('/:id', authMiddleware, adminMiddleware, shippingRegionController.remove);

export default router;
